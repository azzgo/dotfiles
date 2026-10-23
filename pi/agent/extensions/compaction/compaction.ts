import fs from "node:fs";
import path from "node:path";

import { CONFIG_DIR_NAME, sessionEntryToContextMessages, type ExtensionContext, type SessionEntry } from "@earendil-works/pi-coding-agent";
import type { Model, Usage } from "@earendil-works/pi-ai";
import { uuidv7 } from "@earendil-works/pi-ai";

import { collectFileOps, type FileOps } from "./fileops";
import { parseModelRef, readCompactionConfig } from "./model-config";
import { buildCompactionPrompt, buildFallbackSummary, buildOverflowSummary, buildRepairPrompt, renderSummary } from "./prompts";
import { buildSkeleton, selectRequests, type RequestEntry } from "./skeleton";
import { parseCompactionSummary } from "./summary";
import { compactionFailureFile, compactionStatsFile, REQUEST_LINE_LIMIT } from "./types";

/**
 * Compaction Summary as pointer + handoff (docs/adr/0015-compaction-summary-as-pointer.md,
 * superseded in part by docs/adr/0020-compaction-summary-handoff.md).
 *
 * The summary is an orientation, not a replacement for history: the model writes
 * topics / next intent / file notes, the extension contributes the mechanical
 * request line, the file lists and a retrieval handle pointing at the untouched
 * session transcript. Pi's built-in summarizer is never allowed to run.
 *
 * ADR 0020 changes what the model reads: the raw transcript (measured at ~868k
 * tokens, 67% of it tool output) is replaced by the Compaction Skeleton, and the
 * model also sees the window that stays in context — without it the next intent
 * came out older than the session it was describing.
 *
 * This module owns the model call, the failure accounting and the stats log.
 * The model call is tool-less because `ExtensionContext` exposes no agent-turn
 * capability. Parsing lives in ./summary.ts, the skeleton in ./skeleton.ts and
 * file extraction in ./fileops.ts (all Pi-import-free, unit-testable).
 */

function appendCompactionLog(cwd: string, reason: string): void {
	try {
		const target = compactionFailureFile(cwd, CONFIG_DIR_NAME);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.appendFileSync(target, `[${new Date().toISOString()}] ${reason}\n`, "utf8");
	} catch {
		// Logging must never be the reason compaction fails.
	}
}

function appendStatsLog(cwd: string, line: string): void {
	try {
		const target = compactionStatsFile(cwd, CONFIG_DIR_NAME);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.appendFileSync(target, `${line}\n`, "utf8");
	} catch {
		// Logging must never be the reason compaction fails.
	}
}

function readSessionFile(ctx: ExtensionContext): string | undefined {
	try {
		return ctx.sessionManager?.getSessionFile();
	} catch {
		return undefined;
	}
}

export type CompactionEvent = {
	preparation: {
		messagesToSummarize: unknown[];
		turnPrefixMessages: unknown[];
		previousSummary?: string;
		tokensBefore: number;
		firstKeptEntryId: string;
	};
	branchEntries: SessionEntry[];
	reason: "manual" | "threshold" | "overflow";
	signal: AbortSignal;
};

export type CompactionOutcome = {
	compaction: {
		summary: string;
		firstKeptEntryId: string;
		tokensBefore: number;
		usage?: Usage;
	};
};

/**
 * The window that stays in context after the compaction: everything from
 * `firstKeptEntryId` onwards. The summary model has to see it, otherwise its
 * next intent describes a session state older than the one the agent still has.
 */
export function keptTailMessages(branchEntries: readonly SessionEntry[], firstKeptEntryId: string): unknown[] {
	const index = branchEntries.findIndex((entry) => entry.id === firstKeptEntryId);
	if (index < 0) return [];
	const messages: unknown[] = [];
	for (const entry of branchEntries.slice(index)) {
		if (entry.type === "compaction") continue;
		const entryTimestamp = Date.parse(entry.timestamp);
		for (const message of sessionEntryToContextMessages(entry)) {
			messages.push(withTimestamp(message, entryTimestamp));
		}
	}
	return messages;
}

/** Branch entries carry the timestamp; the message may not. */
function withTimestamp(message: unknown, entryTimestamp: number): unknown {
	if (!message || typeof message !== "object") return message;
	const record = message as Record<string, unknown>;
	if (typeof record.timestamp === "number") return message;
	if (!Number.isFinite(entryTimestamp)) return message;
	return { ...record, timestamp: entryTimestamp };
}

export type SummaryModelChoice = {
	model: Model<any> | undefined;
	/** Where the model came from: the config file or the session model. */
	source: "configured" | "session";
	/** Why the configured model could not be used, if it could not. */
	problem?: string;
};

export function resolveSummaryModel(ctx: ExtensionContext): SummaryModelChoice {
	const configured = readCompactionConfig().summaryModel;
	if (!configured) {
		return { model: ctx.model, source: "session", problem: "未配置摘要模型（/compaction-model），使用会话模型" };
	}
	const ref = parseModelRef(configured);
	if (!ref) {
		return { model: ctx.model, source: "session", problem: `配置的摘要模型格式无效（${configured}），使用会话模型` };
	}
	const found = ctx.modelRegistry.find(ref.provider, ref.modelId);
	if (!found) {
		return { model: ctx.model, source: "session", problem: `配置的摘要模型不可用（${configured}），使用会话模型` };
	}
	return { model: found, source: "configured" };
}

/**
 * Resolve the compaction summary. Never throws and never returns undefined: bare
 * `undefined` would let Pi silently run built-in summarization.
 */
export async function buildCompactionSummary(event: CompactionEvent, ctx: ExtensionContext): Promise<CompactionOutcome> {
	const { preparation, reason } = event;
	const sessionFile = readSessionFile(ctx);
	const dropped = [...preparation.messagesToSummarize, ...preparation.turnPrefixMessages];
	const kept = keptTailMessages(event.branchEntries ?? [], preparation.firstKeptEntryId);

	const droppedSkeleton = buildSkeleton(dropped);
	const keptSkeleton = buildSkeleton(kept);
	const requests: RequestEntry[] = selectRequests(
		[...droppedSkeleton.requests, ...keptSkeleton.requests],
		REQUEST_LINE_LIMIT,
	);
	const fileOps: FileOps = collectFileOps(dropped);

	const done = (summary: string, usage?: Usage): CompactionOutcome => ({
		compaction: {
			summary,
			firstKeptEntryId: preparation.firstKeptEntryId,
			tokensBefore: preparation.tokensBefore,
			...(usage ? { usage } : {}),
		},
	});

	// Fast path: the window is already blown and Pi will retry the aborted
	// turn. No model call — the orientation is mechanical and tiny.
	if (reason === "overflow") {
		return done(buildOverflowSummary({ requests, fileOps, sessionFile }));
	}

	const choice = resolveSummaryModel(ctx);
	if (choice.problem) appendCompactionLog(ctx.cwd, choice.problem);
	const model = choice.model;
	if (!model) {
		const reasonText = "没有可用的摘要模型";
		appendCompactionLog(ctx.cwd, reasonText);
		return done(buildFallbackSummary(reasonText, { requests, fileOps, sessionFile }));
	}

	const started = Date.now();
	const prompt = buildCompactionPrompt({
		previousSummary: preparation.previousSummary,
		skeleton: droppedSkeleton.lines,
		keptTail: keptSkeleton.lines,
		requests,
		fileOps,
		sessionFile,
	});

	let usage: Usage | undefined;
	try {
		const response = await callModel(ctx, model, prompt, event.signal);
		if (event.signal.aborted) {
			const reasonText = "摘要调用被取消";
			appendCompactionLog(ctx.cwd, reasonText);
			return done(buildFallbackSummary(reasonText, { requests, fileOps, sessionFile }));
		}
		usage = response.usage;
		const text = response.text;
		const parts = parseCompactionSummary(text);
		if (parts) {
			appendStatsLog(ctx.cwd, statsLine(model, usage, Date.now() - started, "ok", droppedSkeleton.lines.length));
			return done(renderSummary(parts, { requests, fileOps, sessionFile }), usage);
		}

		// One repair attempt: the model produced something unparseable.
		const repaired = await callModel(ctx, model, buildRepairPrompt(text), event.signal);
		if (!event.signal.aborted) usage = mergeUsage(usage, repaired.usage);
		const repairedParts = parseCompactionSummary(repaired.text);
		if (repairedParts) {
			appendStatsLog(ctx.cwd, statsLine(model, usage, Date.now() - started, "repaired", droppedSkeleton.lines.length));
			return done(renderSummary(repairedParts, { requests, fileOps, sessionFile }), usage);
		}

		const reasonText = "摘要模型返回的内容无法解析";
		appendCompactionLog(ctx.cwd, reasonText);
		appendStatsLog(ctx.cwd, statsLine(model, usage, Date.now() - started, "fallback", droppedSkeleton.lines.length));
		return done(buildFallbackSummary(reasonText, { requests, fileOps, sessionFile }), usage);
	} catch (error) {
		if (event.signal.aborted) {
			const reasonText = "摘要调用被取消";
			appendCompactionLog(ctx.cwd, reasonText);
			return done(buildFallbackSummary(reasonText, { requests, fileOps, sessionFile }), usage);
		}
		const message = error instanceof Error ? error.message : String(error);
		appendCompactionLog(ctx.cwd, `摘要调用失败: ${message}`);
		appendStatsLog(ctx.cwd, statsLine(model, usage, Date.now() - started, "error", droppedSkeleton.lines.length));
		if (ctx.hasUI) ctx.ui.notify(`Compaction summary failed: ${message}`, "error");
		return done(buildFallbackSummary(`摘要调用失败: ${message}`, { requests, fileOps, sessionFile }), usage);
	}
}

type ModelResponse = { text: string; usage?: Usage };

async function callModel(
	ctx: ExtensionContext,
	model: Model<any>,
	prompt: string,
	signal: AbortSignal,
): Promise<ModelResponse> {
	const response = await ctx.modelRegistry.complete(
		model,
		{ messages: [{ role: "user" as const, content: [{ type: "text" as const, text: prompt }], timestamp: Date.now() }] },
		{ signal, sessionId: uuidv7(), cacheRetention: "none", maxTokens: 4096 },
	);
	const text = response.content
		.filter((block): block is { type: "text"; text: string } => block.type === "text")
		.map((block) => block.text)
		.join("\n");
	return { text, usage: response.usage };
}

function mergeUsage(first: Usage | undefined, second: Usage | undefined): Usage | undefined {
	if (!first) return second;
	if (!second) return first;
	return {
		...first,
		input: first.input + second.input,
		output: first.output + second.output,
		cacheRead: first.cacheRead + second.cacheRead,
		cacheWrite: first.cacheWrite + second.cacheWrite,
		totalTokens: first.totalTokens + second.totalTokens,
		cost: {
			input: first.cost.input + second.cost.input,
			output: first.cost.output + second.cost.output,
			cacheRead: first.cost.cacheRead + second.cost.cacheRead,
			cacheWrite: first.cost.cacheWrite + second.cost.cacheWrite,
			total: first.cost.total + second.cost.total,
		},
	};
}

function statsLine(
	model: Model<any>,
	usage: Usage | undefined,
	durationMs: number,
	outcome: string,
	skeletonLines: number,
): string {
	const parts = [
		`[${new Date().toISOString()}]`,
		`model=${model.provider}/${model.id}`,
		`input=${usage?.input ?? 0}`,
		`output=${usage?.output ?? 0}`,
		`cacheRead=${usage?.cacheRead ?? 0}`,
		`cost=${((usage?.cost?.total ?? 0) / 1_000_000).toFixed(6)}`,
		`ms=${durationMs}`,
		`skeleton=${skeletonLines}`,
		`outcome=${outcome}`,
	];
	return parts.join(" ");
}

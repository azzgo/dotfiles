import fs from "node:fs";
import path from "node:path";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { uuidv7 } from "@earendil-works/pi-ai";

import { COMPACTION_LOG_DIR, COMPACTION_LOG_FILE } from "./types";
import { collectFileOps, type FileOps } from "./fileops";
import { buildCompactionPrompt, buildFailureSummary, buildOverflowSummary, renderSummary } from "./prompts";
import { parseCompactionSummary } from "./summary";

/**
 * Compaction Summary as pointer (docs/adr/0015-compaction-summary-as-pointer.md).
 *
 * The summary is an orientation, not a replacement for history: the model writes
 * topics / next intent / file notes, the extension contributes the mechanical
 * file lists and a retrieval handle pointing at the untouched session
 * transcript. Pi's built-in summarizer is never allowed to run.
 *
 * The model call is tool-less because `ExtensionContext` exposes no agent-turn
 * capability. Parsing lives in ./summary.ts and file extraction in ./fileops.ts
 * (both Pi-import-free, unit-testable); this module owns the model call and the
 * failure accounting.
 */

function appendCompactionLog(cwd: string, reason: string): void {
	try {
		const target = path.join(cwd, COMPACTION_LOG_DIR, COMPACTION_LOG_FILE);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.appendFileSync(target, `[${new Date().toISOString()}] ${reason}\n`, "utf8");
	} catch {
		// Logging must never be the reason compaction fails.
	}
}

/**
 * The single failure exit: a summary that records the failure in-band and points
 * at the transcript. Pi swallows extension exceptions, so anything not written
 * here is indistinguishable from success.
 */
function failureSummary(reason: string, sessionFile: string | undefined, ctx: Pick<ExtensionContext, "cwd" | "hasUI" | "ui">): string {
	appendCompactionLog(ctx.cwd, reason);
	if (ctx.hasUI) ctx.ui.notify(`Compaction summary failed: ${reason}`, "error");
	return buildFailureSummary(reason, sessionFile);
}

function readSessionFile(ctx: ExtensionContext): string | undefined {
	try {
		return ctx.sessionManager?.getSessionFile();
	} catch {
		return undefined;
	}
}

function serializeMessages(messages: readonly unknown[]): string {
	try {
		return serializeConversation(convertToLlm(messages as never));
	} catch {
		return "";
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
	reason: "manual" | "threshold" | "overflow";
	signal: AbortSignal;
};

export type CompactionOutcome = {
	compaction: {
		summary: string;
		firstKeptEntryId: string;
		tokensBefore: number;
	};
};

/**
 * Resolve the compaction summary. Never throws and never returns undefined: bare
 * `undefined` would let Pi silently run built-in summarization.
 */
export async function buildCompactionSummary(event: CompactionEvent, ctx: ExtensionContext): Promise<CompactionOutcome> {
	const { preparation, reason } = event;
	const sessionFile = readSessionFile(ctx);
	const messages = [...preparation.messagesToSummarize, ...preparation.turnPrefixMessages];
	const fileOps: FileOps = collectFileOps(messages);

	const done = (summary: string): CompactionOutcome => ({
		compaction: {
			summary,
			firstKeptEntryId: preparation.firstKeptEntryId,
			tokensBefore: preparation.tokensBefore,
		},
	});

	try {
		// Fast path: the window is already blown and Pi will retry the aborted
		// turn. No model call — the orientation is mechanical and tiny.
		if (reason === "overflow") return done(buildOverflowSummary(fileOps, sessionFile));

		const model = ctx.model;
		if (!model) return done(failureSummary("no model available for the summary call", sessionFile, ctx));

		const prompt = buildCompactionPrompt({
			previousSummary: preparation.previousSummary,
			transcript: serializeMessages(messages),
			fileOps,
			sessionFile,
		});

		let response: Awaited<ReturnType<ExtensionContext["modelRegistry"]["complete"]>>;
		try {
			response = await ctx.modelRegistry.complete(
				model,
				{ messages: [{ role: "user" as const, content: [{ type: "text" as const, text: prompt }], timestamp: Date.now() }] },
				{ signal: event.signal, sessionId: uuidv7(), cacheRetention: "none" },
			);
		} catch (error) {
			// An abort rejects the call, so classify it here rather than after the
			// await — otherwise a user cancel is reported as a crash.
			if (event.signal.aborted) return done(failureSummary("summary call was aborted", sessionFile, ctx));
			throw error;
		}

		if (event.signal.aborted) return done(failureSummary("summary call was aborted", sessionFile, ctx));

		const text = response.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("\n");

		const parts = parseCompactionSummary(text);
		if (!parts) return done(failureSummary("summary call returned nothing usable", sessionFile, ctx));

		return done(renderSummary(parts, fileOps, sessionFile));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return done(failureSummary(`summary call threw: ${message}`, sessionFile, ctx));
	}
}


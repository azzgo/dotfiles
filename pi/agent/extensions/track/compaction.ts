import fs from "node:fs";
import path from "node:path";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { uuidv7 } from "@earendil-works/pi-ai";

import type { TrackState } from "./types";
import { RECONCILE_LOG_FILE } from "./types";
import { appendToTrack, readTrack } from "./track";
import { buildFailureSummary, buildReconcilePrompt } from "./prompts";
import { parseReconcileResult } from "./reconcile";
import { tailLines } from "./utils";

/**
 * Track-Sourced Compaction (docs/adr/0008-track-sourced-compaction.md).
 *
 * Track content IS the compaction summary; Pi's built-in transcript
 * summarizer is never allowed to run. Reconcile is a tool-less model call
 * because `ExtensionContext` exposes no agent-turn capability.
 *
 * Parsing lives in ./reconcile.ts (Pi-import-free, unit-testable); this module
 * owns the model call and the failure accounting.
 */

// ---- fallback ----

function appendReconcileLog(cwd: string, reason: string): void {
	try {
		const target = path.join(cwd, ".pi/track", RECONCILE_LOG_FILE);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.appendFileSync(target, `[${new Date().toISOString()}] ${reason}\n`, "utf8");
	} catch {
		// Logging must never be the reason compaction fails.
	}
}

/**
 * The single failure exit: a summary that records the failure in-band, plus
 * the transcript tail so the record survives compaction. Pi swallows extension
 * exceptions, so anything not written here is indistinguishable from success.
 */
function failureSummary(
	cwd: string,
	reason: string,
	transcriptTail: string,
	ctx: Pick<ExtensionContext, "hasUI" | "ui">,
): string {
	appendReconcileLog(cwd, reason);
	if (ctx.hasUI) ctx.ui.notify(`Track compaction failed: ${reason}`, "error");
	return buildFailureSummary(reason, transcriptTail);
}

// ---- main entry ----

export type CompactionEvent = {
	preparation: {
		messagesToSummarize: unknown[];
		turnPrefixMessages: unknown[];
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
 * Resolve the compaction summary from Track. Never throws and never returns
 * undefined: bare `undefined` would let Pi silently run built-in summarization.
 */
export async function buildTrackCompaction(
	event: CompactionEvent,
	ctx: ExtensionContext,
): Promise<CompactionOutcome> {
	const cwd = ctx.cwd;
	const { preparation, reason } = event;

	const transcriptTail = () => {
		try {
			const messages = [...preparation.messagesToSummarize, ...preparation.turnPrefixMessages];
			return tailLines(serializeConversation(convertToLlm(messages as never)), 200);
		} catch {
			return "";
		}
	};

	const done = (summary: string): CompactionOutcome => ({
		compaction: {
			summary,
			firstKeptEntryId: preparation.firstKeptEntryId,
			tokensBefore: preparation.tokensBefore,
		},
	});

	try {
		const track = readTrack(cwd);

		// Fast path: the window is already blown and Pi will retry the aborted
		// turn. Read Track and return it — no model call, no reconcile.
		if (reason === "overflow") {
			if (!track.exists) return done(failureSummary(cwd, "overflow with an empty Track", transcriptTail(), ctx));
			return done(renderTrack(track));
		}

		if (!track.exists) return done(failureSummary(cwd, "Track has no content to source a summary from", transcriptTail(), ctx));

		// Reconcile: a tool-less model call returning new entries as JSON.
		const model = ctx.model;
		if (!model) return done(failureSummary(cwd, "no model available for reconcile", transcriptTail(), ctx));

		const prompt = buildReconcilePrompt(track, transcriptTail());
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
			if (event.signal.aborted) return done(failureSummary(cwd, "reconcile was aborted", transcriptTail(), ctx));
			throw error;
		}

		if (event.signal.aborted) return done(failureSummary(cwd, "reconcile was aborted", transcriptTail(), ctx));

		const text = response.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("\n");

		const result = parseReconcileResult(text);
		if (!result) return done(failureSummary(cwd, "reconcile returned no usable entries", transcriptTail(), ctx));

		for (const entry of result.entries) {
			appendToTrack(cwd, entry.file, entry.heading, entry.text);
		}

		return done(renderTrack(readTrack(cwd)));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return done(failureSummary(cwd, `reconcile threw: ${message}`, transcriptTail(), ctx));
	}
}

/** Render Track state as the compaction summary text. */
function renderTrack(track: TrackState): string {
	return [
		"# Working Memory (Track)",
		"",
		"This session's prior context was compacted. The summary below is the Track",
		"scratchpad (`.pi/track/`), not a paraphrase of the conversation.",
		"",
		"## findings.md",
		track.findings.trim() || "(empty)",
		"",
		"## progress.md",
		track.progress.trim() || "(empty)",
	].join("\n");
}

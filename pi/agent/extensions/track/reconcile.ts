import type { ReconcileEntry, ReconcileResult } from "./types";
import { TRACK_FILES } from "./types";

/**
 * Pure parsing of the Compaction Reconcile model output.
 *
 * Deliberately free of any Pi runtime import so it stays unit-testable without
 * the pi package present, and so a malformed model response can never throw
 * into the compaction path.
 */

const VALID_HEADINGS: Record<(typeof TRACK_FILES)[number], readonly string[]> = {
	"findings.md": ["Confirmed Constraints", "Repo / System Findings", "Design Decisions", "Notes"],
	"progress.md": ["Timeline", "Work Completed", "Verification", "Blockers / Interruptions", "Completion Evidence"],
};

/**
 * Parse the reconcile model call's JSON output into validated entries.
 * Returns undefined when nothing usable came back — callers treat that as a
 * failure and fall back to the in-band failure record. Never throws.
 */
export function parseReconcileResult(
	raw: string,
	allowedFiles?: readonly (typeof TRACK_FILES)[number][],
): ReconcileResult | undefined {
	const json = extractJsonObject(raw);
	if (!json) return undefined;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return undefined;
	}
	if (typeof parsed !== "object" || parsed === null) return undefined;

	const allowed = allowedFiles ?? TRACK_FILES;
	const entries: ReconcileEntry[] = [];
	for (const file of allowed) {
		const rawEntries = (parsed as Record<string, unknown>)[file === "findings.md" ? "findings" : "progress"];
		if (!Array.isArray(rawEntries)) continue;
		for (const item of rawEntries) {
			const entry = normalizeEntry(item, file);
			if (entry) entries.push(entry);
		}
	}
	return entries.length > 0 ? { entries } : undefined;
}

function normalizeEntry(item: unknown, file: (typeof TRACK_FILES)[number]): ReconcileEntry | undefined {
	if (typeof item !== "object" || item === null) return undefined;
	const { heading, text } = item as Record<string, unknown>;
	if (typeof text !== "string" || text.trim().length === 0) return undefined;
	const allowed = VALID_HEADINGS[file];
	// Unknown/absent headings fall back to the last section rather than dropping
	// the entry: losing a recorded finding is worse than misfiling it.
	const resolved = typeof heading === "string" && allowed.includes(heading) ? heading : allowed[allowed.length - 1]!;
	return { file, heading: resolved, text: text.trim() };
}

/** Pull the first JSON object out of a model response (fenced or bare). */
function extractJsonObject(raw: string): string | undefined {
	const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = (fenced?.[1] ?? raw).trim();
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) return undefined;
	return candidate.slice(start, end + 1);
}

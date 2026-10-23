/**
 * Pure parsing of the Compaction Summary model output
 * (docs/adr/0015-compaction-summary-as-pointer.md, superseded in part by ADR 0020).
 *
 * Deliberately free of any Pi runtime import so it stays unit-testable without
 * the pi package present, and so a malformed model response can never throw
 * into the compaction path.
 */

export const MAX_TOPICS = 3;

export type FileNote = {
	path: string;
	note: string;
};

export type CompactionSummaryParts = {
	topics: string[];
	nextIntent: string;
	restore: string;
	fileNotes: FileNote[];
};

/**
 * Parse the summary model call's JSON output. Returns undefined only when
 * nothing usable came back — callers treat that as a failure and fall back to
 * the mechanical Compaction Fallback. File notes alone are not a summary: the
 * model echoing back the file list it was given is not an orientation.
 */
export function parseCompactionSummary(raw: string): CompactionSummaryParts | undefined {
	const json = extractJsonObject(raw);
	if (!json) return undefined;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return undefined;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;

	const record = parsed as Record<string, unknown>;
	const topics = toStringList(record.topics).slice(0, MAX_TOPICS);
	const nextIntent = toTrimmedString(record.nextIntent);
	const restore = toTrimmedString(record.restore);
	const fileNotes = toFileNotes(record.fileNotes);

	if (topics.length === 0 && nextIntent === "") return undefined;
	return { topics, nextIntent, restore, fileNotes };
}

function toTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function toStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map(toTrimmedString).filter((entry) => entry.length > 0);
}

function toFileNotes(value: unknown): FileNote[] {
	if (!Array.isArray(value)) return [];
	const notes: FileNote[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		if (typeof item !== "object" || item === null) continue;
		const { path, note } = item as Record<string, unknown>;
		const filePath = toTrimmedString(path);
		if (!filePath || seen.has(filePath)) continue;
		seen.add(filePath);
		notes.push({ path: filePath, note: toTrimmedString(note) });
	}
	return notes;
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

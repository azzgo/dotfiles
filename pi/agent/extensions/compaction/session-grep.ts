/**
 * Session transcript search — the retrieval handle made executable.
 *
 * The Compaction Summary points at the session jsonl, but a pointer nobody can
 * act on is a pointer nobody uses: in the measured session the agent made 238
 * tool calls after compaction and never once grepped that file. This module is
 * the pure part of `session_grep`, a codemode-only tool that searches the
 * current session's transcript.
 */

export type SessionGrepRole = "user" | "assistant" | "toolResult";

export type SessionGrepOptions = {
	query: string;
	role?: SessionGrepRole;
	/** ISO timestamp lower bound (inclusive). */
	since?: string;
	/** ISO timestamp upper bound (inclusive). */
	until?: string;
	limit?: number;
};

export type SessionGrepHit = {
	timestamp: string;
	role: string;
	excerpt: string;
};

const DEFAULT_LIMIT = 20;
const EXCERPT_CHARS = 400;

export function grepSessionJsonl(lines: readonly string[], options: SessionGrepOptions): SessionGrepHit[] {
	const limit = options.limit && options.limit > 0 ? options.limit : DEFAULT_LIMIT;
	const matcher = buildMatcher(options.query);
	if (!matcher) return [];
	const hits: SessionGrepHit[] = [];

	for (const line of lines) {
		if (hits.length >= limit) break;
		const trimmed = line.trim();
		if (!trimmed) continue;
		let entry: Record<string, unknown>;
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
			entry = parsed as Record<string, unknown>;
		} catch {
			continue;
		}
		if (entry.type !== "message") continue;
		const message = entry.message as Record<string, unknown> | undefined;
		if (!message || typeof message !== "object") continue;
		const role = typeof message.role === "string" ? message.role : "";
		if (options.role && role !== options.role) continue;
		const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : "";
		if (options.since && timestamp < options.since) continue;
		if (options.until && timestamp > options.until) continue;
		const text = extractText(message.content);
		if (!text) continue;
		const match = matcher.exec(text);
		if (!match) continue;
		hits.push({ timestamp, role, excerpt: excerptAround(text, match.index, EXCERPT_CHARS) });
	}

	return hits;
}

export function formatHits(hits: readonly SessionGrepHit[]): string {
	if (hits.length === 0) return "(no matches)";
	return hits
		.map((hit) => `[${hit.timestamp}] ${hit.role} ${hit.excerpt.replace(/\s+/g, " ").trim()}`)
		.join("\n");
}

function buildMatcher(query: string): RegExp | undefined {
	const trimmed = query.trim();
	if (!trimmed) return undefined;
	try {
		return new RegExp(trimmed, "i");
	} catch {
		const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(escaped, "i");
	}
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		const record = block as Record<string, unknown>;
		if (record.type === "text" && typeof record.text === "string") parts.push(record.text);
	}
	return parts.join("\n");
}

function excerptAround(text: string, index: number, max: number): string {
	const start = Math.max(0, index - Math.floor(max / 4));
	const slice = text.slice(start, start + max);
	return `${start > 0 ? "…" : ""}${slice}${start + max < text.length ? "…" : ""}`;
}

/**
 * Compaction Skeleton (ADR 0020).
 *
 * The raw transcript of a long session is mostly tool output — in the measured
 * session it was 67% of the characters — and feeding it to the summary model
 * verbatim meant a ~868k-token, uncached request that produced a 6k-character
 * summary and still got the "next step" wrong.
 *
 * The skeleton is the mechanical digest that replaces it: one line per message,
 * error lines kept for failing tool results, user requests collected separately.
 * It is deliberately Pi-import-free so it stays unit-testable.
 */

export type SkeletonOptions = {
	textChars?: number;
	errorLines?: number;
};

export type RequestEntry = {
	timestamp?: number;
	text: string;
};

export type Skeleton = {
	lines: string[];
	requests: RequestEntry[];
};

const DEFAULT_TEXT_CHARS = 200;
const DEFAULT_ERROR_LINES = 3;

const ERROR_MARKER =
	/^\s*(?:✗\s*)?(?:error|errors?|failed|failure|exception|fatal|panic|错误|失败|异常|报错)\b\s*[:：]?|^\s*✗|\bexit (?:code|status)\s*[:：]?\s*[1-9]/i;
export function buildSkeleton(messages: readonly unknown[], options: SkeletonOptions = {}): Skeleton {
	const textChars = options.textChars ?? DEFAULT_TEXT_CHARS;
	const errorLines = options.errorLines ?? DEFAULT_ERROR_LINES;
	const lines: string[] = [];
	const requests: RequestEntry[] = [];

	for (const message of messages) {
		const role = readRole(message);
		if (!role || role === "system") continue;
		const timestamp = readTimestamp(message);

		if (role === "user") {
			const text = extractText(readContent(message)).trim();
			if (!text) continue;
			requests.push({ timestamp, text });
			lines.push(formatLine(timestamp, "user", truncate(collapse(text), textChars)));
			continue;
		}

		if (role === "assistant") {
			const line = assistantLine(readContent(message), textChars);
			if (line) lines.push(formatLine(timestamp, "assistant", line));
			continue;
		}

		if (role === "toolResult") {
			const line = toolResultLine(readContent(message), readIsError(message), textChars, errorLines);
			if (line) lines.push(formatLine(timestamp, "tool", line));
		}
	}

	return { lines, requests };
}

/** The user requests of a session, oldest first, capped to the last `limit`. */
export function selectRequests(requests: readonly RequestEntry[], limit: number): RequestEntry[] {
	if (limit <= 0) return [];
	return requests.slice(-limit);
}

export function formatTimestamp(timestamp: number | undefined): string {
	if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "--";
	const date = new Date(timestamp);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${month}-${day} ${hours}:${minutes}`;
}

export function formatLine(timestamp: number | undefined, role: string, text: string): string {
	return `[${formatTimestamp(timestamp)}] ${role} ${text}`;
}

function assistantLine(content: unknown, textChars: number): string | undefined {
	if (!Array.isArray(content)) return undefined;
	const texts: string[] = [];
	const tools: string[] = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		const record = block as Record<string, unknown>;
		if (record.type === "text" && typeof record.text === "string") {
			texts.push(record.text);
			continue;
		}
		if (record.type === "toolCall" && typeof record.name === "string") {
			tools.push(record.name);
		}
	}
	const text = collapse(texts.join(" "));
	if (text) {
		const suffix = tools.length > 0 ? ` [tool: ${tools.join(", ")}]` : "";
		return `${truncate(text, textChars)}${suffix}`;
	}
	if (tools.length > 0) return `[tool] ${tools.join(", ")}`;
	return undefined;
}

function toolResultLine(
	content: unknown,
	isError: boolean,
	textChars: number,
	errorLines: number,
): string | undefined {
	const raw = extractText(content);
	if (!raw.trim()) return undefined;
	const rawLines = raw
		.split("\n")
		.map((line) => collapse(line))
		.filter((line) => line.length > 0);
	const marked = rawLines.filter((line) => ERROR_MARKER.test(line));
	if (isError || marked.length > 0) {
		const picked = (marked.length > 0 ? marked : rawLines).slice(0, errorLines);
		if (picked.length === 0) return undefined;
		return picked.map((line) => `✗ ${truncate(line, textChars)}`).join(" | ");
	}
	return truncate(rawLines[0] ?? "", textChars);
}

function readRole(message: unknown): string | undefined {
	if (!message || typeof message !== "object") return undefined;
	const role = (message as Record<string, unknown>).role;
	return typeof role === "string" ? role : undefined;
}

function readContent(message: unknown): unknown {
	if (!message || typeof message !== "object") return undefined;
	return (message as Record<string, unknown>).content;
}

function readIsError(message: unknown): boolean {
	if (!message || typeof message !== "object") return false;
	return (message as Record<string, unknown>).isError === true;
}

function readTimestamp(message: unknown): number | undefined {
	if (!message || typeof message !== "object") return undefined;
	const timestamp = (message as Record<string, unknown>).timestamp;
	return typeof timestamp === "number" ? timestamp : undefined;
}

export function extractText(content: unknown): string {
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

function collapse(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
	if (max <= 0) return text;
	return text.length <= max ? text : `${text.slice(0, max)}…`;
}

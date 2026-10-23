/**
 * Mechanical file-operation extraction for the Compaction Summary
 * (docs/adr/0015-compaction-summary-as-pointer.md, refined by ADR 0020).
 *
 * The model never lists files — it only annotates the paths found here. Letting
 * it recall paths is the one failure this design can avoid outright.
 *
 * ADR 0020 caps and de-noises the lists: the measured session produced 86 paths
 * (81% of the summary), eight of them temp files that no longer exist.
 *
 * Pure and Pi-import-free so it stays unit-testable.
 */

import { MODIFIED_LIST_LIMIT, READ_LIST_LIMIT } from "./types";

const READ_TOOLS = new Set(["read", "view"]);
const WRITE_TOOLS = new Set([
	"write",
	"edit",
	"replace",
	"str_replace",
	"multiedit",
	"apply_patch",
	"notebook_edit",
]);

/** Paths that carry no lasting information: temp files, tool scratch dirs, track scratchpads. */
const NOISE_PATH_PATTERNS: RegExp[] = [
	/^\/var\/folders\//,
	/^\/private\/var\/folders\//,
	/^\/tmp\//,
	/^\/private\/tmp\//,
	/\/\.pi\/track\//,
	/\/\.pig\/track\//,
];

export type FileOps = {
	read: string[];
	modified: string[];
};

export function emptyFileOps(): FileOps {
	return { read: [], modified: [] };
}

/**
 * Collect file operations from the messages being summarized, in the order they
 * happened. Nested calls recorded on a tool result count too — a codemode script
 * writing files shows up there rather than as its own tool call.
 */
export function collectFileOps(messages: readonly unknown[]): FileOps {
	const read: string[] = [];
	const modified: string[] = [];
	const seenRead = new Set<string>();
	const seenModified = new Set<string>();

	const record = (toolName: unknown, args: unknown): void => {
		if (typeof toolName !== "string" || typeof args !== "object" || args === null) return;
		const filePath = (args as Record<string, unknown>).path;
		if (typeof filePath !== "string" || filePath.trim() === "") return;
		const target = filePath.trim();
		if (WRITE_TOOLS.has(toolName)) {
			if (seenModified.has(target)) return;
			seenModified.add(target);
			modified.push(target);
			return;
		}
		if (!READ_TOOLS.has(toolName) || seenModified.has(target) || seenRead.has(target)) return;
		seenRead.add(target);
		read.push(target);
	};

	for (const message of messages) {
		collectFromMessage(message, record);
	}
	// A file read before it is edited is only a read up to that point; once it
	// appears in `modified` the read record is noise.
	const touched = new Set(modified);
	return {
		read: cap(read.filter((filePath) => !touched.has(filePath) && !isNoisePath(filePath)), READ_LIST_LIMIT),
		modified: cap(modified.filter((filePath) => !isNoisePath(filePath)), MODIFIED_LIST_LIMIT),
	};
}

/** Temp files and scratch dirs never survive the session; listing them is noise. */
export function isNoisePath(filePath: string): boolean {
	return NOISE_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

/** Keep the most recent entries — the recent ones are the ones still in play. */
function cap(paths: string[], limit: number): string[] {
	if (paths.length <= limit) return paths;
	return paths.slice(paths.length - limit);
}

type ToolRecorder = (toolName: unknown, args: unknown) => void;

function collectFromMessage(message: unknown, record: ToolRecorder): void {
	if (typeof message !== "object" || message === null) return;
	const { content, details, toolResult } = message as Record<string, unknown>;
	if (Array.isArray(content)) {
		for (const item of content) {
			if (typeof item !== "object" || item === null) continue;
			const block = item as Record<string, unknown>;
			if (block.type === "toolCall") record(block.name, block.arguments);
		}
	}
	collectFromNestedCalls(toolResult, record);
	collectFromNestedCalls(details, record);
}

function collectFromNestedCalls(container: unknown, record: ToolRecorder): void {
	if (typeof container !== "object" || container === null) return;
	const nested = (container as Record<string, unknown>).nestedCalls;
	if (!Array.isArray(nested)) return;
	for (const call of nested) {
		if (typeof call !== "object" || call === null) continue;
		const { name, arguments: args } = call as Record<string, unknown>;
		record(name, args);
	}
}

/** Render the file lists for the summary prompt and for the summary text. */
export function formatFileLists(fileOps: FileOps): { modified: string; read: string } {
	return {
		modified: fileOps.modified.join("\n"),
		read: fileOps.read.join("\n"),
	};
}

/**
 * Read tool — returns file contents as LINE#HASH-anchored lines.
 *
 * Adapted from pi-hashline-edit (MIT).
 * Lite version: core formatting + offset/limit + raw mode. No binary
 * detection, no image handling, no snapshot writing.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
	type TruncationResult,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { access as fsAccess, constants } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { computeLineHash } from "./hash";
import { resolveToCwd } from "./path-utils";
import { normalizeToLF, stripBom } from "./text-utils";
import { throwIfAborted } from "./apply";
import {
	READ_DESCRIPTION,
	READ_PROMPT_SNIPPET,
	READ_PROMPT_GUIDELINES,
} from "./prompt";

function normalizePositiveInteger(
	value: number | undefined,
	name: "offset" | "limit",
): number | undefined {
	if (value === undefined) return undefined;
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`Read request field "${name}" must be a positive integer.`);
	}
	return value;
}

function getVisibleLines(text: string): string[] {
	if (text.length === 0) return [];
	const lines = text.split("\n");
	return text.endsWith("\n") ? lines.slice(0, -1) : lines;
}

function formatHashlineRegion(
	lines: readonly string[],
	startLine: number,
	endLine: number,
): string {
	const lineNumberWidth = String(endLine).length;
	const out: string[] = [];
	for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
		const line = lines[lineNum - 1]!;
		const hash = computeLineHash(lines, lineNum - 1);
		const padded = String(lineNum).padStart(lineNumberWidth, " ");
		out.push(`${padded}#${hash}:${line}`);
	}
	return out.join("\n");
}

export function formatHashlineReadPreview(
	text: string,
	options: { offset?: number; limit?: number; raw?: boolean },
): { text: string; truncation?: TruncationResult; nextOffset?: number } {
	const allLines = getVisibleLines(text);
	const totalLines = allLines.length;
	const startLine = normalizePositiveInteger(options.offset, "offset") ?? 1;

	if (totalLines === 0) {
		if (startLine === 1) {
			return {
				text: "File is empty. Use edit with replace on an existing file, or the write tool to create content.",
			};
		}
		return {
			text: `Offset ${startLine} is beyond end of file (0 lines total). The file is empty.`,
		};
	}

	if (startLine > totalLines) {
		return {
			text: `Offset ${startLine} is beyond end of file (${totalLines} lines total). Use offset=1 to read from the start, or offset=${totalLines} to read the last line.`,
		};
	}

	const limit = normalizePositiveInteger(options.limit, "limit");
	const endIdx = limit ? Math.min(startLine - 1 + limit, totalLines) : totalLines;

	const formatted = options.raw
		? allLines.slice(startLine - 1, endIdx).join("\n")
		: formatHashlineRegion(allLines, startLine, endIdx);

	const truncation = truncateHead(formatted);
	if (!options.raw && truncation.firstLineExceedsLimit) {
		return {
			text: `[Line ${startLine} exceeds ${formatSize(truncation.maxBytes)}. Hashline output requires full lines; cannot compute hashes for a truncated preview.]`,
			truncation,
		};
	}

	let preview = truncation.content;
	let nextOffset: number | undefined;
	if (truncation.truncated) {
		const endLineDisplay = startLine + truncation.outputLines - 1;
		nextOffset = endLineDisplay + 1;
		if (truncation.truncatedBy === "lines") {
			preview += `\n\n[Showing lines ${startLine}-${endLineDisplay} of ${totalLines}. Use offset=${nextOffset} to continue.]`;
		} else {
			preview += `\n\n[Showing lines ${startLine}-${endLineDisplay} of ${totalLines} (${formatSize(truncation.maxBytes)} limit). Use offset=${nextOffset} to continue.]`;
		}
	} else if (endIdx < totalLines) {
		nextOffset = endIdx + 1;
		preview += `\n\n[Showing lines ${startLine}-${endIdx} of ${totalLines}. Use offset=${nextOffset} to continue.]`;
	}

	return {
		text: preview,
		truncation: truncation.truncated ? truncation : undefined,
		...(nextOffset !== undefined ? { nextOffset } : {}),
	};
}

export function registerReadTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "read",
		label: "Read",
		description: READ_DESCRIPTION,
		promptSnippet: READ_PROMPT_SNIPPET,
		promptGuidelines: READ_PROMPT_GUIDELINES,
		parameters: Type.Object({
			path: Type.String({
				description: "Path to the file to read (relative or absolute)",
			}),
			offset: Type.Optional(
				Type.Integer({
					minimum: 1,
					description: "Line number to start reading from (1-indexed)",
				}),
			),
			limit: Type.Optional(
				Type.Integer({
					minimum: 1,
					description: "Maximum number of lines to read",
				}),
			),
			raw: Type.Optional(
				Type.Boolean({
					description:
						"Return plain text without LINE#HASH anchors. Saves tokens when you do not plan to edit this file.",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const rawPath = params.path;
			const absolutePath = resolveToCwd(rawPath, ctx.cwd);

			throwIfAborted(signal);
			try {
				await fsAccess(absolutePath, constants.R_OK);
			} catch (error: unknown) {
				const code =
					error instanceof Error
						? (error as NodeJS.ErrnoException).code
						: undefined;
				if (code === "ENOENT") throw new Error(`File not found: ${rawPath}`);
				if (code === "EACCES" || code === "EPERM")
					throw new Error(`File is not readable: ${rawPath}`);
				throw new Error(`Cannot access file: ${rawPath}`);
			}

			throwIfAborted(signal);
			const stats = await stat(absolutePath);
			if (stats.isDirectory()) {
				throw new Error(
					`Path is a directory: ${rawPath}. Use ls to inspect directories.`,
				);
			}

			throwIfAborted(signal);
			const rawContent = await readFile(absolutePath, "utf-8");
			const normalized = normalizeToLF(stripBom(rawContent).text);

			const preview = formatHashlineReadPreview(normalized, {
				offset: params.offset,
				limit: params.limit,
				raw: params.raw,
			});

			return {
				content: [{ type: "text", text: preview.text }],
				details: {
					truncation: preview.truncation,
					...(preview.nextOffset !== undefined
						? { nextOffset: preview.nextOffset }
						: {}),
				},
			};
		},
	});
}

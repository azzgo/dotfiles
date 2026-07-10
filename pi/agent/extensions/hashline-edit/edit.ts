/**
 * Edit tool — hashline-anchored file edits with atomic write.
 *
 * Adapted from pi-hashline-edit (MIT).
 * Lite version:
 * - Only `replace` and `replace_text` ops (no append/prepend).
 * - No dialect normalization (strict canonical format only).
 * - No 3-way merge / snapshot recovery.
 * - No TUI rendering (default shell).
 * - Noop loop guard (in-memory, 3-strike hard block).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import { constants } from "node:fs";
import { access as fsAccess } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyHashlineEdits, throwIfAborted } from "./apply";
import { resolveEditAnchors, type HashlineToolEdit } from "./parse";
import { computeAffectedLineRange, formatHashlineRegion } from "./format";
import { writeFileAtomically } from "./fs-write";
import { resolveToCwd } from "./path-utils";
import {
	detectLineEnding,
	hasMixedLineEndings,
	normalizeToLF,
	restoreLineEndings,
	stripBom,
} from "./text-utils";
import { recordNoopEdit, clearNoopTracker } from "./noop-guard";
import {
	EDIT_DESCRIPTION,
	EDIT_PROMPT_SNIPPET,
	EDIT_PROMPT_GUIDELINES,
} from "./prompt";

// ─── Schema ─────────────────────────────────────────────────────────────

function literalStringSchema<const Value extends string>(
	value: Value,
	options: { description: string },
) {
	return Type.Unsafe<Value>({
		type: "string",
		enum: [value],
		description: options.description,
	});
}

const hashlineEditLinesSchema = Type.Array(Type.String(), {
	description:
		"replacement content, one array entry per line, no LINE#HASH prefix",
});

const hashlineReplaceEditSchema = Type.Object(
	{
		op: literalStringSchema("replace", {
			description:
				"replace one line at pos, or an inclusive pos..end range, with lines",
		}),
		pos: Type.String({ description: "start anchor (LINE#HASH from read)" }),
		end: Type.Optional(
			Type.String({
				description:
					"inclusive end anchor (LINE#HASH) of the range to replace; omit to replace only the line at pos",
			}),
		),
		lines: hashlineEditLinesSchema,
	},
	{ additionalProperties: false },
);

const hashlineReplaceTextEditSchema = Type.Object(
	{
		op: literalStringSchema("replace_text", {
			description: "replace an exact unique substring with newText",
		}),
		oldText: Type.String({
			description: "exact text to replace; must be unique in the file",
		}),
		newText: Type.String({ description: "replacement text" }),
	},
	{ additionalProperties: false },
);

const hashlineEditItemSchema = Type.Union(
	[hashlineReplaceEditSchema, hashlineReplaceTextEditSchema],
	{
		description:
			'discriminated edit item. "replace" uses pos/end/lines; "replace_text" uses oldText/newText.',
	},
);

const hashlineEditToolSchema = Type.Object(
	{
		path: Type.String({ description: "path" }),
		edits: Type.Array(hashlineEditItemSchema, {
			description: "edits over $path",
		}),
	},
	{ additionalProperties: false },
);

// ─── Request validation ─────────────────────────────────────────────────

const ROOT_KEYS = new Set(["path", "edits"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertEditRequest(
	request: unknown,
): asserts request is { path: string; edits: HashlineToolEdit[] } {
	if (!isRecord(request)) {
		throw new Error("Edit request must be an object.");
	}

	const unknownRootKeys = Object.keys(request).filter(
		(key) => !ROOT_KEYS.has(key),
	);
	if (unknownRootKeys.length > 0) {
		throw new Error(
			`Edit request contains unknown or unsupported fields: ${unknownRootKeys.join(", ")}.`,
		);
	}

	if (typeof request.path !== "string" || request.path.length === 0) {
		throw new Error('Edit request requires a non-empty "path" string.');
	}

	if (!Array.isArray(request.edits)) {
		throw new Error('Edit request requires an "edits" array.');
	}
}

// ─── Response builders ──────────────────────────────────────────────────

const ANCHORS_OMITTED_TEXT = "Anchors omitted; use read for subsequent edits.";

function getVisibleLines(text: string): string[] {
	if (text.length === 0) return [];
	const lines = text.split("\n");
	return text.endsWith("\n") ? lines.slice(0, -1) : lines;
}

function warningsBlock(warnings: string[] | undefined): string {
	return warnings?.length ? `\n\nWarnings:\n${warnings.join("\n")}` : "";
}

function buildAnchorsBlock(
	resultLines: string[],
	anchorRange: { start: number; end: number } | null,
): string {
	if (!anchorRange) return ANCHORS_OMITTED_TEXT;
	const formatted = formatHashlineRegion(
		resultLines,
		anchorRange.start,
		anchorRange.end,
	);
	return `--- Anchors ${anchorRange.start}-${anchorRange.end} ---\n${formatted}`;
}

function buildNoopResponse(params: {
	path: string;
	noopEdits:
		| { editIndex: number; loc: string; currentContent: string }[]
		| undefined;
	warnings: string[] | undefined;
}) {
	const { path, noopEdits, warnings } = params;
	const noopDetailsText = noopEdits?.length
		? noopEdits
				.map(
					(edit) =>
						`Edit ${edit.editIndex}: replacement for ${edit.loc} is identical to current content:\n  ${edit.loc}: ${edit.currentContent}`,
				)
				.join("\n")
		: "The edits produced identical content.";

	return {
		content: [
			{
				type: "text" as const,
				text: `No changes made to ${path}\nClassification: noop\n${noopDetailsText}${warningsBlock(warnings)}`,
			},
		],
		details: {
			classification: "noop" as const,
			warnings: warnings ?? [],
		},
	};
}

function buildChangedResponse(params: {
	result: string;
	warnings: string[] | undefined;
	firstChangedLine?: number;
	lastChangedLine?: number;
}) {
	const { result, warnings, firstChangedLine, lastChangedLine } = params;

	const resultLines = getVisibleLines(result);
	const anchorRange = computeAffectedLineRange({
		firstChangedLine,
		lastChangedLine,
		resultLineCount: resultLines.length,
	});
	const anchorsBlock = buildAnchorsBlock(resultLines, anchorRange);

	const text = [anchorsBlock, warningsBlock(warnings).trimStart()]
		.filter((section) => section.length > 0)
		.join("\n\n");

	return {
		content: [{ type: "text" as const, text }],
		details: {
			classification: "applied" as const,
			firstChangedLine,
			warnings: warnings ?? [],
		},
	};
}

// ─── Edit pipeline ──────────────────────────────────────────────────────

async function executeEditPipeline(
	params: { path: string; edits: HashlineToolEdit[] },
	cwd: string,
	signal?: AbortSignal,
): Promise<{
	path: string;
	originalNormalized: string;
	result: string;
	bom: string;
	originalEnding: "\r\n" | "\n";
	warnings: string[];
	noopEdits?: { editIndex: number; loc: string; currentContent: string }[];
	firstChangedLine?: number;
	lastChangedLine?: number;
}> {
	const path = params.path;
	const absolutePath = resolveToCwd(path, cwd);
	const toolEdits = params.edits;

	if (toolEdits.length === 0) {
		throw new Error("No edits provided.");
	}

	throwIfAborted(signal);
	try {
		await fsAccess(absolutePath, constants.R_OK | constants.W_OK);
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			throw new Error(
				`File not found: ${path}. Use the write tool to create new files.`,
			);
		}
		if (code === "EACCES" || code === "EPERM") {
			throw new Error(`File is not writable: ${path}`);
		}
		throw new Error(`Cannot access file: ${path}`);
	}

	throwIfAborted(signal);
	const rawContent = await readFile(absolutePath, "utf-8");
	const { bom, text: rawText } = stripBom(rawContent);
	const originalEnding = detectLineEnding(rawText);
	const mixedEndingWarning = hasMixedLineEndings(rawText)
		? `File had mixed line endings (CRLF and LF); this edit rewrote it uniformly as ${originalEnding === "\r\n" ? "CRLF" : "LF"}.`
		: undefined;
	const originalNormalized = normalizeToLF(rawText);

	const resolved = resolveEditAnchors(toolEdits);
	const anchorResult = applyHashlineEdits(originalNormalized, resolved, signal);

	return {
		path,
		originalNormalized,
		result: anchorResult.content,
		bom,
		originalEnding,
		warnings: [
			...(mixedEndingWarning ? [mixedEndingWarning] : []),
			...(anchorResult.warnings ?? []),
		],
		noopEdits: anchorResult.noopEdits,
		firstChangedLine: anchorResult.firstChangedLine,
		lastChangedLine: anchorResult.lastChangedLine,
	};
}

// ─── Tool registration ──────────────────────────────────────────────────

export function registerEditTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "edit",
		label: "Edit",
		description: EDIT_DESCRIPTION,
		parameters: hashlineEditToolSchema as TSchema,
		promptSnippet: EDIT_PROMPT_SNIPPET,
		promptGuidelines: EDIT_PROMPT_GUIDELINES,
		renderShell: "default",

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			// Validate the request envelope (backstop for when AJV is disabled).
			assertEditRequest(params);
			const path = params.path;
			const absolutePath = resolveToCwd(path, ctx.cwd);
			const mutationTargetPath = resolve(absolutePath);

			return withFileMutationQueue(mutationTargetPath, async () => {
				throwIfAborted(signal);

				const {
					originalNormalized,
					result,
					bom,
					originalEnding,
					warnings,
					noopEdits,
					firstChangedLine,
					lastChangedLine,
				} = await executeEditPipeline(params, ctx.cwd, signal);

				if (originalNormalized === result) {
					const payloadKey = JSON.stringify(params.edits);
					const { count, escalate } = recordNoopEdit(
						mutationTargetPath,
						payloadKey,
					);
					if (escalate) {
						throw new Error(
							`[E_NOOP_LOOP] Edit to ${path} was a byte-identical no-op ${count} times in a row. STOP re-sending this payload. Re-read the file — the content you are trying to write already exists, or your anchors point at the wrong lines.`,
						);
					}
					return buildNoopResponse({ path, noopEdits, warnings });
				}

				throwIfAborted(signal);
				await writeFileAtomically(
					mutationTargetPath,
					bom + restoreLineEndings(result, originalEnding),
				);

				// Successful edit clears the noop tracker for this path.
				clearNoopTracker(mutationTargetPath);

				return buildChangedResponse({
					result,
					warnings,
					firstChangedLine,
					lastChangedLine,
				});
			});
		},
	});
}

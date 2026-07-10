/**
 * Apply engine — anchor validation, edit-span resolution, assembly.
 *
 * Adapted from pi-hashline-edit (MIT), which vendored from oh-my-pi (MIT).
 *
 * Lite version:
 * - Only `replace` and `replace_text` ops (no append/prepend).
 * - Stale anchor detection with textHint fuzzy validation (E_STALE_ANCHOR).
 * - Conflict detection for overlapping spans (E_EDIT_CONFLICT).
 * - No 3-way merge, no multi-version snapshot recovery.
 */

import {
	RE_SIGNIFICANT,
	computeHashFromContext,
	computeLineHash,
	isFuzzyEquivalentLine,
	normalizeHashInput,
} from "./hash";
import type { Anchor, HashlineEdit } from "./parse";
import { computeChangedLineRange } from "./format";

export function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new Error("Operation aborted");
}

interface HashMismatch {
	line: number;
	expected: string;
	actual: string;
	textHint?: string;
}

interface NoopEdit {
	editIndex: number;
	loc: string;
	currentContent: string;
}

// ─── Mismatch formatting ────────────────────────────────────────────────

const CANDIDATE_TOTAL_LIMIT = 8;
const CANDIDATE_PER_ANCHOR_LIMIT = 3;

function formatMismatchError(
	mismatches: HashMismatch[],
	fileLines: string[],
): string {
	const staleRefs = mismatches
		.map((m) => `${m.line}#${m.expected}`)
		.join(", ");
	const out: string[] = [
		`[E_STALE_ANCHOR] ${mismatches.length} stale anchor${mismatches.length > 1 ? "s" : ""}: ${staleRefs}. Re-read the file to get current anchors; keep both endpoints for range replaces.`,
	];

	// Scan for fuzzy-match candidates for stale anchors that carry a textHint.
	const hintedMismatches = mismatches.filter((m) => m.textHint !== undefined);
	if (hintedMismatches.length > 0) {
		type AnchorCandidates =
			| { kind: "list"; lines: number[] }
			| { kind: "overflow"; count: number };

		const perAnchor: { mismatch: HashMismatch; result: AnchorCandidates }[] =
			[];
		let totalCandidates = 0;

		for (const m of hintedMismatches) {
			const hint = m.textHint!;
			const matches: number[] = [];
			for (let i = 0; i < fileLines.length; i++) {
				if (isFuzzyEquivalentLine(hint, fileLines[i]!)) {
					matches.push(i + 1);
				}
			}

			if (totalCandidates + matches.length > CANDIDATE_TOTAL_LIMIT) {
				perAnchor.push({
					mismatch: m,
					result: { kind: "overflow", count: matches.length },
				});
			} else if (matches.length > CANDIDATE_PER_ANCHOR_LIMIT) {
				totalCandidates += matches.length;
				perAnchor.push({
					mismatch: m,
					result: { kind: "overflow", count: matches.length },
				});
			} else {
				totalCandidates += matches.length;
				perAnchor.push({
					mismatch: m,
					result: { kind: "list", lines: matches },
				});
			}
		}

		const hasAnyCandidates = perAnchor.some(
			({ result }) =>
				result.kind === "overflow" ||
				(result.kind === "list" && result.lines.length > 0),
		);
		if (hasAnyCandidates) {
			out.push("");
			out.push(
				"Did you mean (content-matched candidates for stale anchors):",
			);
			for (const { mismatch, result } of perAnchor) {
				if (result.kind === "overflow") {
					out.push(
						`  ${result.count} similar lines found for ${mismatch.line}#${mismatch.expected} — re-read to disambiguate`,
					);
				} else {
					for (const lineNum of result.lines) {
						const freshHash = computeLineHash(fileLines, lineNum - 1);
						const lineContent = fileLines[lineNum - 1]!;
						out.push(`  ${lineNum}#${freshHash}:${lineContent}   ← for stale ${mismatch.line}#${mismatch.expected}`);
					}
				}
			}
		}
	}

	return out.join("\n");
}

// ─── Line index ─────────────────────────────────────────────────────────

type LineIndex = {
	fileLines: string[];
	lineStarts: number[];
	hasTerminalNewline: boolean;
	visibleLineCount: number;
};

function buildLineIndex(content: string): LineIndex {
	const fileLines = content.split("\n");
	const lineStarts: number[] = [];
	let offset = 0;

	for (let index = 0; index < fileLines.length; index++) {
		lineStarts.push(offset);
		offset += fileLines[index]!.length;
		if (index < fileLines.length - 1) offset += 1;
	}

	const hasTerminalNewline = content.endsWith("\n");
	return {
		fileLines,
		lineStarts,
		hasTerminalNewline,
		visibleLineCount: hasTerminalNewline
			? fileLines.length - 1
			: fileLines.length,
	};
}

// ─── Helpers ────────────────────────────────────────────────────────────

function assertDoesNotEmptyFile(
	originalContent: string,
	result: string,
): void {
	if (originalContent.length > 0 && result.length === 0) {
		throw new Error(
			"[E_WOULD_EMPTY] Refusing to empty a non-empty file through edit. If intentional, use the write tool or bash.",
		);
	}
}

function previewText(text: string): string {
	const compact = text.replaceAll("\n", "\\n");
	return compact.length > 32 ? `${compact.slice(0, 29)}...` : compact;
}

function describeEdit(edit: HashlineEdit): string {
	switch (edit.op) {
		case "replace":
			return edit.end
				? `replace ${edit.pos.line}#${edit.pos.hash}-${edit.end.line}#${edit.end.hash}`
				: `replace ${edit.pos.line}#${edit.pos.hash}`;
		case "replace_text":
			return `replace_text "${previewText(edit.oldText)}"`;
	}
}

function throwEditConflict(
	left: { index: number; label: string },
	right: { index: number; label: string },
	reason: string,
): never {
	throw new Error(
		`[E_EDIT_CONFLICT] Conflicting edits in a single request: edit ${left.index} (${left.label}) and edit ${right.index} (${right.label}) ${reason}. Merge them into one non-overlapping change or split the request.`,
	);
}

function findExactUniqueTextMatch(
	content: string,
	oldText: string,
): { start: number; end: number } {
	if (oldText.length === 0) {
		throw new Error("[E_BAD_OP] replace_text requires non-empty oldText.");
	}

	const matches: number[] = [];
	let from = 0;
	while (from <= content.length - oldText.length) {
		const index = content.indexOf(oldText, from);
		if (index === -1) break;
		matches.push(index);
		from = index + 1;
	}

	for (let index = 1; index < matches.length; index++) {
		if (matches[index]! - matches[index - 1]! < oldText.length) {
			throw new Error(
				"[E_MULTI_MATCH] replace_text found overlapping exact matches; re-read and use hashline edits.",
			);
		}
	}

	if (matches.length === 0) {
		throw new Error(
			"[E_NO_MATCH] replace_text found no exact unique match in the current file.",
		);
	}

	if (matches.length > 1) {
		throw new Error(
			"[E_MULTI_MATCH] replace_text found multiple exact matches in the current file. Re-read and use hashline edits.",
		);
	}

	const start = matches[0]!;
	return { start, end: start + oldText.length };
}

// ─── Span resolution ────────────────────────────────────────────────────

type ResolvedEditSpan = {
	kind: "replace";
	index: number;
	label: string;
	start: number;
	end: number;
	replacement: string;
};

function resolveEditToSpan(
	edit: HashlineEdit,
	index: number,
	content: string,
	lineIndex: LineIndex,
	noopEdits: NoopEdit[],
): ResolvedEditSpan | null {
	const { fileLines, lineStarts } = lineIndex;

	switch (edit.op) {
		case "replace": {
			const startLine = edit.pos.line;
			const endLine = edit.end?.line ?? edit.pos.line;
			const originalLines = fileLines.slice(startLine - 1, endLine);
			if (
				originalLines.length === edit.lines.length &&
				originalLines.every(
					(line, li) => line === edit.lines[li],
				)
			) {
				noopEdits.push({
					editIndex: index,
					loc: `${edit.pos.line}#${edit.pos.hash}`,
					currentContent: originalLines.join("\n"),
				});
				return null;
			}

			if (edit.lines.length > 0) {
				return {
					kind: "replace",
					index,
					label: describeEdit(edit),
					start: lineStarts[startLine - 1]!,
					end: lineStarts[endLine - 1]! + fileLines[endLine - 1]!.length,
					replacement: edit.lines.join("\n"),
				};
			}

			// lines: [] → deletion
			if (startLine === 1 && endLine === fileLines.length) {
				return {
					kind: "replace",
					index,
					label: describeEdit(edit),
					start: 0,
					end: content.length,
					replacement: "",
				};
			}

			if (endLine < fileLines.length) {
				return {
					kind: "replace",
					index,
					label: describeEdit(edit),
					start: lineStarts[startLine - 1]!,
					end: lineStarts[endLine]!,
					replacement: "",
				};
			}

			return {
				kind: "replace",
				index,
				label: describeEdit(edit),
				start: Math.max(0, lineStarts[startLine - 1]! - 1),
				end: lineStarts[endLine - 1]! + fileLines[endLine - 1]!.length,
				replacement: "",
			};
		}
		case "replace_text": {
			const match = findExactUniqueTextMatch(content, edit.oldText);
			if (edit.oldText === edit.newText) {
				noopEdits.push({
					editIndex: index,
					loc: `replace_text "${previewText(edit.oldText)}"`,
					currentContent: edit.oldText,
				});
				return null;
			}
			return {
				kind: "replace",
				index,
				label: describeEdit(edit),
				start: match.start,
				end: match.end,
				replacement: edit.newText,
			};
		}
	}
}

function assertNoConflictingSpans(spans: ResolvedEditSpan[]): void {
	for (let i = 0; i < spans.length; i++) {
		for (let j = i + 1; j < spans.length; j++) {
			const left = spans[i]!;
			const right = spans[j]!;
			if (left.start < right.end && right.start < left.end) {
				throwEditConflict(
					left,
					right,
					"overlap on the same original line range",
				);
			}
		}
	}
}

function resolveEditSpans(
	edits: HashlineEdit[],
	content: string,
	lineIndex: LineIndex,
	noopEdits: NoopEdit[],
	signal: AbortSignal | undefined,
): ResolvedEditSpan[] {
	const seenSpanKeys = new Set<string>();
	const resolvedSpans: ResolvedEditSpan[] = [];
	for (const [index, edit] of edits.entries()) {
		throwIfAborted(signal);
		const span = resolveEditToSpan(edit, index, content, lineIndex, noopEdits);
		if (!span) continue;

		const spanKey = `replace:${span.start}:${span.end}:${span.replacement}`;
		if (seenSpanKeys.has(spanKey)) continue;
		seenSpanKeys.add(spanKey);
		resolvedSpans.push(span);
	}

	assertNoConflictingSpans(resolvedSpans);

	// Sort back-to-front for safe in-place assembly.
	return [...resolvedSpans].sort((left, right) => {
		if (right.end !== left.end) return right.end - left.end;
		return left.index - right.index;
	});
}

// ─── Anchor validation ──────────────────────────────────────────────────

/**
 * Validate anchor hashes against current file content.
 * Checks hash match + textHint fuzzy validation. Returns mismatches for
 * stale-anchor error. On range-OOB, throws immediately.
 */
function validateAnchorEdits(
	edits: HashlineEdit[],
	lineIndex: LineIndex,
	warnings: string[],
	signal: AbortSignal | undefined,
): { mismatches: HashMismatch[] } {
	const mismatches: HashMismatch[] = [];
	const acceptedFuzzyRefs = new Set<string>();

	function validate(ref: Anchor): boolean {
		if (ref.line < 1 || ref.line > lineIndex.fileLines.length) {
			throw new Error(
				`[E_RANGE_OOB] Line ${ref.line} does not exist (file has ${lineIndex.visibleLineCount} lines)`,
			);
		}
		const line = lineIndex.fileLines[ref.line - 1]!;
		const actual = computeLineHash(lineIndex.fileLines, ref.line - 1);
		if (actual === ref.hash) {
			// Hash matches but textHint says otherwise → treat as stale (anti-collision guard).
			if (
				ref.textHint !== undefined &&
				!isFuzzyEquivalentLine(ref.textHint, line)
			) {
				mismatches.push({
					line: ref.line,
					expected: ref.hash,
					actual,
					textHint: ref.textHint,
				});
				return false;
			}
			return true;
		}
		if (ref.textHint !== undefined) {
			// Hash mismatched, but recompute using the hint's content in the current
			// file's neighbor context. If that matches and the hint fuzzy-matches,
			// accept (forgiveness for whitespace/Unicode normalization).
			const prevLine = normalizeHashInput(
				ref.line > 1 ? lineIndex.fileLines[ref.line - 2]! : "",
			);
			const nextLine = normalizeHashInput(
				ref.line < lineIndex.fileLines.length
					? lineIndex.fileLines[ref.line]!
					: "",
			);
			const hintedHash = computeHashFromContext(
				prevLine,
				normalizeHashInput(ref.textHint),
				nextLine,
			);
			if (hintedHash === ref.hash && isFuzzyEquivalentLine(ref.textHint, line)) {
				const key = `${ref.line}:${ref.hash}:${ref.textHint}`;
				if (!acceptedFuzzyRefs.has(key)) {
					acceptedFuzzyRefs.add(key);
					warnings.push(
						`Accepted fuzzy anchor validation at line ${ref.line}: exact hash mismatched, but the copied line content still matched after whitespace/Unicode normalization.`,
					);
				}
				return true;
			}
		}
		mismatches.push({
			line: ref.line,
			expected: ref.hash,
			actual,
			textHint: ref.textHint,
		});
		return false;
	}

	for (const edit of edits) {
		throwIfAborted(signal);
		switch (edit.op) {
			case "replace": {
				if (edit.end) {
					if (edit.pos.line > edit.end.line) {
						throw new Error(
							`[E_BAD_OP] Range start line ${edit.pos.line} must be <= end line ${edit.end.line}`,
						);
					}
					const startOk = validate(edit.pos);
					const endOk = validate(edit.end);
					if (!startOk || !endOk) continue;
				} else if (!validate(edit.pos)) {
					continue;
				}
				const endLine = edit.end?.line ?? edit.pos.line;
				if (!edit.end && edit.lines.length > 1) {
					warnings.push(
						`Single-anchor replace at ${describeEdit(edit)} swapped only line ${edit.pos.line}, but you supplied ${edit.lines.length} replacement lines. If you meant to replace a range, add end. If you meant to expand one line into many, ignore this.`,
					);
				}
				const nextLine = lineIndex.fileLines[endLine];
				const replacementLastLine = edit.lines.at(-1)?.trim();
				if (
					nextLine !== undefined &&
					replacementLastLine &&
					RE_SIGNIFICANT.test(replacementLastLine) &&
					replacementLastLine === nextLine.trim()
				) {
					warnings.push(
						`Potential boundary duplication after ${describeEdit(edit)}: the replacement ends with a line that matches the next surviving line after trim.`,
					);
				}
				const prevLine = lineIndex.fileLines[edit.pos.line - 2];
				const replacementFirstLine = edit.lines[0]?.trim();
				if (
					prevLine !== undefined &&
					replacementFirstLine &&
					RE_SIGNIFICANT.test(replacementFirstLine) &&
					replacementFirstLine === prevLine.trim()
				) {
					warnings.push(
						`Potential boundary duplication before ${describeEdit(edit)}: the replacement starts with a line that matches the preceding surviving line after trim.`,
					);
				}
				break;
			}
			case "replace_text":
				break;
		}
	}

	return { mismatches };
}

// ─── Assembly ───────────────────────────────────────────────────────────

function assembleEditResult(
	content: string,
	spans: ResolvedEditSpan[],
	signal: AbortSignal | undefined,
): string {
	let result = content;
	for (const span of spans) {
		throwIfAborted(signal);
		result =
			result.slice(0, span.start) + span.replacement + result.slice(span.end);
	}
	return result;
}

// ─── Public entry point ─────────────────────────────────────────────────

/**
 * Apply hashline-anchored edits to file content.
 *
 * Three-phase pipeline:
 *   1. validateAnchorEdits — check hash matches, collect warnings + mismatches
 *   2. resolveEditSpans   — map edits to character spans, dedup, conflict-detect, sort
 *   3. assembleEditResult — apply spans back-to-front, compute changed range
 */
export function applyHashlineEdits(
	content: string,
	edits: HashlineEdit[],
	signal?: AbortSignal,
): {
	content: string;
	firstChangedLine: number | undefined;
	lastChangedLine: number | undefined;
	warnings?: string[];
	noopEdits?: NoopEdit[];
} {
	throwIfAborted(signal);
	if (!edits.length)
		return {
			content,
			firstChangedLine: undefined,
			lastChangedLine: undefined,
		};

	const lineIndex = buildLineIndex(content);
	const noopEdits: NoopEdit[] = [];
	const warnings: string[] = [];

	// Phase 1: validate anchors
	const { mismatches } = validateAnchorEdits(
		edits,
		lineIndex,
		warnings,
		signal,
	);
	if (mismatches.length) {
		throw new Error(formatMismatchError(mismatches, lineIndex.fileLines));
	}

	// Phase 2: resolve edits to ordered spans
	const orderedSpans = resolveEditSpans(
		edits,
		content,
		lineIndex,
		noopEdits,
		signal,
	);

	// Phase 3: assemble result
	const result = assembleEditResult(content, orderedSpans, signal);
	assertDoesNotEmptyFile(content, result);
	const changedRange = computeChangedLineRange(content, result);

	return {
		content: result,
		firstChangedLine: changedRange?.firstChangedLine,
		lastChangedLine: changedRange?.lastChangedLine,
		...(warnings.length ? { warnings } : {}),
		...(noopEdits.length ? { noopEdits } : {}),
	};
}

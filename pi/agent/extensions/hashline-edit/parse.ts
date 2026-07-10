/**
 * Parsing — anchor ref parsing, edit item validation.
 *
 * Adapted from pi-hashline-edit (MIT), which vendored from oh-my-pi (MIT).
 *
 * Lite version: only `replace` and `replace_text` ops. No `append`/`prepend`.
 * Hash length is hardcoded to 2 (no config module).
 */

import {
	HASH_LENGTH,
	HASH_ALPHABET_RE,
	NIBBLE_STR,
	EXAMPLE_ANCHOR,
} from "./hash";

// ─── Types ──────────────────────────────────────────────────────────────

export type Anchor = { line: number; hash: string; textHint?: string };

/**
 * Lite version: only `replace` and `replace_text`.
 * - `replace` — replace one line at `pos`, or inclusive `pos..end` range
 * - `replace_text` — exact unique substring replace (stale-anchor fallback)
 */
export type HashlineEdit =
	| { op: "replace"; pos: Anchor; end?: Anchor; lines: string[] }
	| { op: "replace_text"; oldText: string; newText: string };

export type HashlineToolEdit = {
	op: string;
	pos?: string;
	end?: string;
	lines?: string[];
	oldText?: string;
	newText?: string;
};

// ─── Display-prefix rejection ───────────────────────────────────────────

/**
 * Regexes that detect (and reject) hashline display prefixes inside edit
 * payloads. The model must send literal file content, not rendered read/diff
 * output. Matching triggers [E_INVALID_PATCH].
 */
const DISPLAY_HASH_QUANT = `[${NIBBLE_STR}]{${HASH_LENGTH},${HASH_LENGTH}}`;
const DISPLAY_PREFIX_RE = new RegExp(
	`^\\s*(?:\\d+\\s*#\\s*|#\\s*)${DISPLAY_HASH_QUANT}:`,
);
const DISPLAY_PREFIX_PLUS_RE = new RegExp(
	`^\\+\\s*(?:\\d+\\s*#\\s*|#\\s*)${DISPLAY_HASH_QUANT}:`,
);
const DIFF_MINUS_RE = /^-\s*\d+\s{4}/;

function assertNoDisplayPrefixes(lines: string[]): void {
	for (const line of lines) {
		if (!line.length) continue;
		if (
			DISPLAY_PREFIX_RE.test(line) ||
			DISPLAY_PREFIX_PLUS_RE.test(line) ||
			DIFF_MINUS_RE.test(line)
		) {
			throw new Error(
				`[E_INVALID_PATCH] "lines" must contain literal file content, not rendered "LINE#HASH:" or diff "+/-" prefixes. Offending line: ${JSON.stringify(line)}`,
			);
		}
	}
}

// ─── Anchor parsing ─────────────────────────────────────────────────────

function diagnoseLineRef(ref: string): string {
	const trimmed = ref.trim();
	const core = ref.replace(/^\s*[>+-]*\s*/, "").trim();

	if (!core.length) {
		return `[E_BAD_REF] Invalid line reference "${ref}". Expected "LINE#HASH" (e.g. "${EXAMPLE_ANCHOR}").`;
	}
	if (/^\d+\s*$/.test(core)) {
		return `[E_BAD_REF] Invalid line reference "${ref}": missing hash, use "LINE#HASH" from read output (e.g. "${EXAMPLE_ANCHOR}").`;
	}
	if (/^\d+\s*:/.test(core)) {
		return `[E_BAD_REF] Invalid line reference "${ref}": wrong separator, use "LINE#HASH" instead of "LINE:...".`;
	}

	const hashMatch = core.match(/^(\d+)\s*#\s*([^\s:]+)(?:\s*:.*)?$/);
	if (hashMatch) {
		const hash = hashMatch[2]!;
		if (hash.length !== HASH_LENGTH) {
			return `[E_BAD_REF] Invalid line reference "${ref}": hash must be exactly ${HASH_LENGTH} characters from ${NIBBLE_STR} (e.g. "${EXAMPLE_ANCHOR}").`;
		}
		if (!HASH_ALPHABET_RE.test(hash)) {
			return `[E_BAD_REF] Invalid line reference "${ref}": hash uses invalid characters, hashes use alphabet ${NIBBLE_STR} only.`;
		}
	}

	return `[E_BAD_REF] Invalid line reference "${trimmed || ref}". Expected "LINE#HASH" (e.g. "${EXAMPLE_ANCHOR}").`;
}

/**
 * Parses LINE#HASH format, tolerating leading ">+-" and whitespace (from
 * mismatch/diff display) and an optional trailing ":content" display suffix,
 * which is preserved as `textHint` for fuzzy anchor validation.
 */
function parseAnchorRef(ref: string): Anchor {
	const core = ref.replace(/^\s*[>+-]*\s*/, "").trimEnd();
	const match = core.match(/^([0-9]+)\s*#\s*([^\s:]+)(?:\s*:(.*))?$/s);
	if (!match) {
		throw new Error(diagnoseLineRef(ref));
	}

	const line = Number.parseInt(match[1]!, 10);
	if (line < 1) {
		throw new Error(
			`[E_BAD_REF] Line number must be >= 1, got ${line} in "${ref}".`,
		);
	}

	const hash = match[2]!;
	if (hash.length !== HASH_LENGTH) {
		throw new Error(
			`[E_BAD_REF] Invalid line reference "${ref}": hash must be exactly ${HASH_LENGTH} characters from ${NIBBLE_STR} (e.g. "${EXAMPLE_ANCHOR}").`,
		);
	}

	if (!HASH_ALPHABET_RE.test(hash)) {
		throw new Error(
			`[E_BAD_REF] Invalid line reference "${ref}": hash uses invalid characters, hashes use alphabet ${NIBBLE_STR} only.`,
		);
	}

	const textHint = match[3];
	return {
		line,
		hash,
		...(textHint !== undefined ? { textHint } : {}),
	};
}

// ─── Content preprocessing ──────────────────────────────────────────────

function hashlineParseText(edit: string[] | undefined): string[] {
	const lines = edit ?? [];
	assertNoDisplayPrefixes(lines);
	return lines;
}

export function normalizeExactText(
	text: string | undefined,
): string | undefined {
	if (typeof text !== "string") return undefined;
	return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

// ─── Edit item validation ───────────────────────────────────────────────

const ITEM_KEYS = new Set(["op", "pos", "end", "lines", "oldText", "newText"]);

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Validate + parse flat tool-schema edits into typed internal representations.
 *
 * Lite version: only `replace` and `replace_text` are accepted.
 * - replace + pos only → single-line replace
 * - replace + pos + end → range replace
 * - replace_text + oldText/newText → exact unique text replace
 */
export function resolveEditAnchors(
	edits: HashlineToolEdit[],
): HashlineEdit[] {
	const result: HashlineEdit[] = [];
	for (const [index, edit] of edits.entries()) {
		assertEditItem(edit as Record<string, unknown>, index);

		const op = edit.op;
		switch (op) {
			case "replace": {
				result.push({
					op: "replace",
					pos: parseAnchorRef(edit.pos!),
					...(edit.end ? { end: parseAnchorRef(edit.end) } : {}),
					lines: hashlineParseText(edit.lines),
				});
				break;
			}
			case "replace_text": {
				result.push({
					op: "replace_text",
					oldText: normalizeExactText(edit.oldText)!,
					newText: normalizeExactText(edit.newText)!,
				});
				break;
			}
		}
	}
	return result;
}

function assertEditItem(
	edit: Record<string, unknown>,
	index: number,
): void {
	const unknownKeys = Object.keys(edit).filter((key) => !ITEM_KEYS.has(key));
	if (unknownKeys.length > 0) {
		throw new Error(
			`Edit ${index} contains unknown or unsupported fields: ${unknownKeys.join(", ")}.`,
		);
	}

	if (typeof edit.op !== "string") {
		throw new Error(`Edit ${index} requires an "op" string.`);
	}
	if (edit.op !== "replace" && edit.op !== "replace_text") {
		throw new Error(
			`[E_BAD_OP] Edit ${index} uses unknown op "${edit.op}". Expected "replace" or "replace_text".`,
		);
	}

	if ("pos" in edit && typeof edit.pos !== "string") {
		throw new Error(`Edit ${index} field "pos" must be a string when provided.`);
	}
	if ("end" in edit && typeof edit.end !== "string") {
		throw new Error(`Edit ${index} field "end" must be a string when provided.`);
	}
	if ("oldText" in edit && typeof edit.oldText !== "string") {
		throw new Error(`Edit ${index} field "oldText" must be a string when provided.`);
	}
	if ("newText" in edit && typeof edit.newText !== "string") {
		throw new Error(`Edit ${index} field "newText" must be a string when provided.`);
	}
	if ("lines" in edit && !isStringArray(edit.lines)) {
		throw new Error(`Edit ${index} field "lines" must be a string array.`);
	}

	if (edit.op === "replace_text") {
		if (typeof edit.oldText !== "string" || typeof edit.newText !== "string") {
			throw new Error(
				`[E_BAD_OP] Edit ${index} with op "replace_text" requires string "oldText" and "newText" fields.`,
			);
		}
		if ("pos" in edit || "end" in edit || "lines" in edit) {
			throw new Error(
				`Edit ${index} with op "replace_text" only supports "oldText" and "newText".`,
			);
		}
		return;
	}

	// op === "replace"
	if (!("lines" in edit)) {
		throw new Error(`Edit ${index} requires a "lines" field.`);
	}
	if ("oldText" in edit || "newText" in edit) {
		throw new Error(
			`Edit ${index} with op "replace" does not support "oldText" or "newText".`,
		);
	}
	if (typeof edit.pos !== "string") {
		throw new Error(
			`[E_BAD_OP] Edit ${index} with op "replace" requires a "pos" anchor string.`,
		);
	}
}

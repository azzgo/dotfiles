/**
 * Hash computation — MD5-based (node:crypto), 16-char alphabet, per-line hash.
 *
 * Adapted from pi-hashline-edit (MIT, github.com/RimuruW/pi-hashline-edit),
 * which vendored from oh-my-pi (MIT, github.com/can1357/oh-my-pi).
 *
 * Lite version: replaces xxhashjs with node:crypto MD5 (zero external deps).
 * Hash length is hardcoded to 2 (256 buckets). Output values differ from the
 * upstream xxh32 implementation but are internally consistent.
 */

import { createHash } from "node:crypto";

// ─── Constants ──────────────────────────────────────────────────────────

/** Hash length — hardcoded to 2 for the lite version. */
export const HASH_LENGTH = 2;

/**
 * Custom 16-character hash alphabet. Deliberately excludes:
 * - Hex digits A–F (prevents confusion with hex literals in code)
 * - Visually confusable letters: D, G, I, L, O (look like digits 0, 6, 1, 1, 0)
 * - Common vowels A, E, I, O, U (prevents accidental English words)
 */
export const NIBBLE_STR = "ZPMQVRWSNKTXJBYH";
export const HASH_ALPHABET_RE = new RegExp(`^[${NIBBLE_STR}]+$`);

/** Lines containing no alphanumeric characters (only punctuation/symbols/whitespace). */
export const RE_SIGNIFICANT = /[\p{L}\p{N}]/u;

/** Example anchor for error messages. */
export const EXAMPLE_ANCHOR = "5#MQ";

// ─── Hash computation ───────────────────────────────────────────────────

/**
 * Compute a 32-bit unsigned integer hash from input using MD5.
 * Takes the first 4 bytes of the MD5 digest (little-endian).
 */
function md5low32(input: string): number {
	return createHash("md5").update(input).digest().readUInt32LE(0);
}

/** Normalize a line for hash input: strip \r, trimEnd. */
export function normalizeHashInput(line: string): string {
	return line.replace(/\r/g, "").trimEnd();
}

/**
 * Compute an N-char hash from a line's content and its immediate neighbors.
 * Uses prev + "\0" + curr + "\0" + next as the hash input ensures:
 * - Distant edits no longer invalidate anchors (only same/adjacent lines affected).
 * - Adjacent-edit invalidation is intentional: editing near an anchor makes it stale.
 * - Silent collisions now require the entire 3-line window to match.
 * All three inputs must already be normalized via normalizeHashInput.
 *
 * Hash length is hardcoded to 2 (lite version). At length 2 the output is a
 * 2-character token drawn from NIBBLE_STR, encoding the low 8 bits of the hash.
 */
export function computeHashFromContext(
	prev: string,
	curr: string,
	next: string,
): string {
	const len = HASH_LENGTH;
	const h = md5low32(prev + "\0" + curr + "\0" + next);
	// Extract `len` nibbles from the low 4*len bits of the hash value.
	let result = "";
	for (let i = len - 1; i >= 0; i--) {
		result += NIBBLE_STR[(h >>> (i * 4)) & 0x0f];
	}
	return result;
}

/**
 * Compute the N-char hash for a line at a given 0-based index within a file.
 * Neighbors outside the file boundaries use "" as their normalized value.
 */
export function computeLineHash(
	fileLines: readonly string[],
	index: number,
): string {
	const prev = normalizeHashInput(index > 0 ? fileLines[index - 1]! : "");
	const curr = normalizeHashInput(fileLines[index]!);
	const next = normalizeHashInput(
		index < fileLines.length - 1 ? fileLines[index + 1]! : "",
	);
	return computeHashFromContext(prev, curr, next);
}

// ─── Fuzzy matching ─────────────────────────────────────────────────────

/** Fuzzy-match Unicode replacement regexes for anchor textHint validation. */
const FUZZY_SINGLE_QUOTES_RE = /[\u2018\u2019\u201A\u201B]/g;
const FUZZY_DOUBLE_QUOTES_RE = /[\u201C\u201D\u201E\u201F]/g;
const FUZZY_HYPHENS_RE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;
const FUZZY_UNICODE_SPACES_RE = /[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g;

export function normalizeFuzzyLine(text: string): string {
	return text
		.trimEnd()
		.replace(FUZZY_SINGLE_QUOTES_RE, "'")
		.replace(FUZZY_DOUBLE_QUOTES_RE, '"')
		.replace(FUZZY_HYPHENS_RE, "-")
		.replace(FUZZY_UNICODE_SPACES_RE, " ");
}

export function isFuzzyEquivalentLine(expected: string, actual: string): boolean {
	return normalizeFuzzyLine(expected) === normalizeFuzzyLine(actual);
}

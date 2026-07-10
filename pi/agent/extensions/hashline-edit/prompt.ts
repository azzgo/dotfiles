/**
 * Prompt text for read/edit tools.
 *
 * Adapted from pi-hashline-edit (MIT) prompts/*.md.
 * Lite version: no append/prepend ops, no grep, hash length 2 hardcoded.
 * Embedded as string constants — no file I/O, no import.meta.url resolution.
 */

import { HASH_LENGTH } from "./hash";

// ─── Read tool prompts ──────────────────────────────────────────────────

export const READ_DESCRIPTION = `Read a text file. Every line returns as \`LINE#HASH:content\`; copy those anchors verbatim into \`edit\` — they are the only way edits address lines.

Page large files with \`offset\` (1-based line) and \`limit\`. Truncated output ends with the exact \`offset\` to continue from.

Set \`raw: true\` to return plain file content without \`LINE#HASH\` prefixes; offset and limit still apply. Use raw mode when reading for context only (no planned edits).`;

export const READ_PROMPT_SNIPPET =
	"Read file contents as LINE#HASH-anchored lines; edit requires these anchors";

export const READ_PROMPT_GUIDELINES = [
	"Use read before edit whenever you do not hold current LINE#HASH anchors for the file.",
	"If read output is truncated, continue with the offset it names — never guess unseen lines.",
	"Use raw: true when reading for context only; anchors are required for edit.",
];

// ─── Edit tool prompts ──────────────────────────────────────────────────

export const EDIT_DESCRIPTION = `Patch a text file at \`LINE#HASH\` anchors copied verbatim from the latest read result or the anchors block of a previous edit.

Batch every change to a file into one \`edit\` call: all operations go in the \`edits\` array, every edit sets \`op\`, and all anchors must come from the same pre-edit read. Edits validate against one snapshot and apply together, so line numbers never shift between entries of the same call.

Ops:
- \`replace\` — replace the single line at \`pos\`, or the inclusive span \`pos\`..\`end\`. \`lines\` is the complete new content for the whole span; \`lines: []\` deletes it. Without \`end\`, exactly one line is replaced no matter how many entries \`lines\` has. To insert or append lines, use \`replace\` on an existing anchor line and include the original line plus the new lines in \`lines\`.
- \`replace_text\` — \`{ "op": "replace_text", "oldText": ..., "newText": ... }\` replaces one exact, unique occurrence and fails otherwise. Prefer anchors; use this only when uniqueness is certain or as a fallback when anchors are stale. \`oldText\`/\`newText\` are invalid on any other op.

Example — single-line and span replace in one call:
\`\`\`json
{ "path": "src/main.ts", "edits": [
  { "op": "replace", "pos": "12#MQ", "lines": ["const x = 1;"] },
  { "op": "replace", "pos": "5#VR", "end": "8#QV", "lines": [
    "function greet(name) {",
    "  return \`Hello, \${name}\`;",
    "}"
  ] }
] }
\`\`\`

Example — insert lines after an existing line (use replace, include original line):
\`\`\`json
{ "op": "replace", "pos": "10#SK", "lines": ["const existing = line10;", "const newLine = 'inserted';"] }
\`\`\`

Rules:
- \`lines\` is literal file content with exact indentation. Never include \`LINE#HASH:\` or bare \`HH:\` prefixes, diff \`+\`/\`-\` markers, or a copy of a neighboring line — the \`:content\` part of an anchor is context for you, not payload, and repeating a boundary line duplicates it in the file.
- Anchors are opaque: copy them exactly, never compute, shift, or guess one.
- Edits in one call must not overlap or touch adjacent lines — merge such changes into a single edit.`;

export const EDIT_PROMPT_SNIPPET =
	"Make precise file edits at LINE#HASH anchors (e.g. 5#MQ) copied from read, batching all edits to a file in one call";

export const EDIT_PROMPT_GUIDELINES = [
	"Use edit with LINE#HASH anchors from the latest read or edit result for all file changes; batch every change to one file into a single edit call.",
	"Never reuse anchors from an earlier read or edit response once a newer one exists for the same file; treat only the most recent response as carrying valid anchors.",
	"After a successful edit, the returned --- Anchors --- block replaces a re-read for nearby follow-up edits.",
	"On [E_STALE_ANCHOR], the error lists the stale refs and any content-matched candidate anchors; re-read the file to get current anchors before retrying.",
	`Hash length is ${HASH_LENGTH} characters in this session; anchors look like "LINE#HH" where HH is 2 chars from the alphabet ZPMQVRWSNKTXJBYH.`,
];

// ─── Session prompt (for system prompt context) ─────────────────────────

/**
 * Brief protocol summary injected as a custom context message on session start.
 * The detailed instructions live in the tool descriptions above; this is just
 * a heads-up so the model knows hashline mode is active before it sees tool defs.
 */
export const SESSION_PROTOCOL_NOTICE = `[Hashline Edit] Active. The read tool returns lines as "LINE#HASH:content" and the edit tool uses those hashes as anchors. Always read before edit to get current anchors. Hash format: LINE#HH (2 chars from ZPMQVRWSNKTXJBYH).`;

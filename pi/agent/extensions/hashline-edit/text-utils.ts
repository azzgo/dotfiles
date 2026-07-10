/**
 * Text utilities — line-ending normalization, BOM stripping.
 *
 * Adapted from pi-hashline-edit (MIT). No external dependencies (diff
 * generation is excluded from the lite version).
 */

export function detectLineEnding(content: string): "\r\n" | "\n" {
	const crlfIdx = content.indexOf("\r\n");
	const lfIdx = content.indexOf("\n");
	if (lfIdx === -1 || crlfIdx === -1) return "\n";
	return crlfIdx < lfIdx ? "\r\n" : "\n";
}

export function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function restoreLineEndings(
	text: string,
	ending: "\r\n" | "\n",
): string {
	return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

export function stripBom(content: string): { bom: string; text: string } {
	return content.startsWith("\uFEFF")
		? { bom: "\uFEFF", text: content.slice(1) }
		: { bom: "", text: content };
}

export function hasMixedLineEndings(content: string): boolean {
	const hasCrlf = /\r\n/.test(content);
	const hasBareLf = /(?<!\r)\n/.test(content);
	const hasLoneCr = /\r(?!\n)/.test(content);
	const styleCount = [hasCrlf, hasBareLf, hasLoneCr].filter(Boolean).length;
	return styleCount > 1;
}

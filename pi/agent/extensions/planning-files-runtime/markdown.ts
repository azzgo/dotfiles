import { nowIso, readText, trimEmptyLines, writeText } from "./utils";
import { getPaths } from "./utils";
import { createProgressTemplate } from "./workspace";

/**
 * Append a bullet to a markdown heading section.
 * If the heading doesn't exist, it is created.
 * If the first bullet is "[empty]", it is replaced.
 */
export function appendBulletToHeading(markdown: string, heading: string, bullet: string): string {
	const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const sectionPattern = new RegExp(`(## ${escapedHeading}\\n)([\\s\\S]*?)(?=\\n## |$)`);
	const match = markdown.match(sectionPattern);
	if (!match) return `${markdown.trim()}\n\n## ${heading}\n- ${bullet}\n`;
	const prefix = match[1] ?? `## ${heading}\n`;
	const body = (match[2] ?? "").replace(/^- \[empty\]\s*$/m, "").trimEnd();
	const nextBody = body === "" ? `- ${bullet}\n` : `${body}\n- ${bullet}\n`;
	return markdown.replace(sectionPattern, `${prefix}${nextBody}`);
}

/**
 * Append a timestamped bullet to the progress.md timeline section.
 */
export function appendProgressTimeline(cwd: string, heading: string, message: string): void {
	const paths = getPaths(cwd);
	const target = paths.files["progress.md"];
	const content = readText(target) || createProgressTemplate();
	const next = appendBulletToHeading(content, heading, `[${nowIso()}] ${message}`);
	writeText(target, trimEmptyLines(next).concat("\n"));
}

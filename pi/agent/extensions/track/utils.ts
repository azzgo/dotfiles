import fs from "node:fs";
import path from "node:path";
import { TRACK_DIR } from "./types";

// ---- time ----

export function nowIso(): string {
	return new Date().toISOString();
}

// ---- file system ----

export function fileExists(target: string): boolean {
	try {
		return fs.existsSync(target);
	} catch {
		return false;
	}
}

export function ensureDir(target: string): void {
	fs.mkdirSync(target, { recursive: true });
}

export function readText(target: string): string {
	try {
		return fs.readFileSync(target, "utf8");
	} catch {
		return "";
	}
}

export function writeText(target: string, content: string): void {
	ensureDir(path.dirname(target));
	fs.writeFileSync(target, content, "utf8");
}

export function trackDir(cwd: string): string {
	return path.join(cwd, TRACK_DIR);
}

// ---- string / markdown ----

export function trimEmptyLines(text: string): string {
	return text.trim().replace(/\n{3,}/g, "\n\n");
}

export function tailLines(text: string, count: number): string {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	return lines.slice(-count).join("\n");
}

export function truncate(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n...[truncated]`;
}

/**
 * Append a bullet to a markdown heading section (track files).
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

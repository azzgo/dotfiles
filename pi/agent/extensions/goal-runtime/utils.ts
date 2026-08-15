import fs from "node:fs";
import path from "node:path";
import { GOALS_DIR, TRACK_DIR } from "./types";

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

export function goalsDir(cwd: string): string {
	return path.join(cwd, GOALS_DIR);
}

export function trackDir(cwd: string): string {
	return path.join(cwd, TRACK_DIR);
}

// ---- string / markdown ----

export function trimEmptyLines(text: string): string {
	return text.trim().replace(/\n{3,}/g, "\n\n");
}

export function extractSection(text: string, heading: string): string | undefined {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = text.match(new RegExp(`^## ${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n## |(?![\\s\\S]))`, "m"));
	return match?.[1]?.trim() || undefined;
}

export function firstMeaningfulLine(text: string | undefined): string | undefined {
	if (!text) return undefined;
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		return trimmed.replace(/^[-*]\s*/, "");
	}
	return undefined;
}

export function tailLines(text: string, count: number): string {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	return lines.slice(-count).join("\n");
}

export function truncate(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n...[truncated]`;
}

// ---- normalisation ----

export function normalizeString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const items: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const trimmed = entry.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		items.push(trimmed);
	}
	return items;
}

// ---- taskmd file frontmatter access (raw read/write of record markdown) ----

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
	const match = content.match(FRONTMATTER_RE);
	if (!match) return { frontmatter: "", body: content };
	return { frontmatter: match[1] ?? "", body: content.slice((match[0] ?? "").length) };
}

/**
 * Read a single string scalar field from a record's frontmatter.
 * Supports `key: "value"`, `key: value`, and `key: ["a", "b"]` (JSON-ish) forms.
 */
export function readFrontmatterString(content: string, key: string): string | undefined {
	const { frontmatter } = splitFrontmatter(content);
	const pattern = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m");
	const match = frontmatter.match(pattern);
	if (!match) return undefined;
	const raw = (match[1] ?? "").trim();
	if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
	return raw;
}

export function readFrontmatterStringArray(content: string, key: string): string[] {
	const { frontmatter } = splitFrontmatter(content);
	const pattern = new RegExp(`^${key}\\s*:\\s*(\\[.*\\])$`, "m");
	const match = frontmatter.match(pattern);
	if (!match) return [];
	try {
		const parsed: unknown = JSON.parse(match[1] ?? "[]");
		return normalizeStringArray(parsed);
	} catch {
		return [];
	}
}

/** Insert or replace scalar/array frontmatter fields, preserving everything else. */
export function writeFrontmatterFields(content: string, fields: Record<string, string | string[]>): string {
	const { frontmatter, body } = splitFrontmatter(content);
	let lines = frontmatter === "" ? [] : frontmatter.split(/\r?\n/);
	for (const [key, value] of Object.entries(fields)) {
		const rendered = Array.isArray(value)
			? `${key}: ${JSON.stringify(value)}`
			: /^[A-Za-z0-9_ .\/:-]+$/.test(value)
				? `${key}: ${value}`
				: `${key}: ${JSON.stringify(value)}`;
		const idx = lines.findIndex((line) => new RegExp(`^${key}\\s*:`).test(line));
		if (idx >= 0) lines[idx] = rendered;
		else lines.push(rendered);
	}
	return `---\n${lines.join("\n")}\n---\n${body}`;
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

/**
 * Insert or replace a `## heading` section in a markdown body.
 * Lines are written as bullet items (`- line`); an empty array writes `- [empty]`.
 */
export function upsertBodySection(body: string, heading: string, lines: string[]): string {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const sectionRe = new RegExp(`(## ${escaped})\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
	const content = lines.length > 0 ? lines.join("\n") : "- [empty]";
	const nextSection = `## ${heading}\n${content}`;
	if (sectionRe.test(body)) return body.replace(sectionRe, nextSection);
	return `${body.replace(/\n*$/, "")}\n\n${nextSection}\n`;
}

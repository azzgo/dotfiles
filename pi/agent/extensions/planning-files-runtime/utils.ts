import fs from "node:fs";
import path from "node:path";
import { PLANNING_DIR, GOAL_STATE_FILE, GOAL_DESIGN_FILE } from "./types";
import type { PathBundle, PlanningFileName } from "./types";

// ---- time ----

export function nowIso(): string {
	return new Date().toISOString();
}

export function archiveStamp(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
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

export function getPaths(cwd: string): PathBundle {
	const root = path.join(cwd, PLANNING_DIR);
	return {
		root,
		archiveRoot: path.join(root, "archive"),
		goalState: path.join(root, GOAL_STATE_FILE),
		goalDesign: path.join(root, GOAL_DESIGN_FILE),
		tasksDir: path.join(root, "tasks"),
		files: {
			"task_plan.md": path.join(root, "task_plan.md"),
			"findings.md": path.join(root, "findings.md"),
			"progress.md": path.join(root, "progress.md"),
		},
	};
}

// ---- string / markdown ----

export function trimEmptyLines(text: string): string {
	return text.trim().replace(/\n{3,}/g, "\n\n");
}

export function extractSection(text: string, heading: string): string | undefined {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = text.match(new RegExp(`^## ${escaped}\\s*\\n+([\\s\\S]*?)(?:\\n## |$)`, "m"));
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

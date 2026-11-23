/**
 * Skill inventory audit: which installed skills were ever actually loaded.
 *
 * Pure, local, model-free. A skill is "loaded" only when the host injected it
 * into a session, which leaves a `<skill name="..." location="...">` marker in
 * the session transcript. Session file mtimes are not evidence of use, so the
 * per-line `timestamp` decides the day.
 *
 * Privacy: this module renders names, categories, dates, counts and line
 * counts. It never renders session content, prompt fragments, project names,
 * or any path containing a project identifier.
 */

import fs from "node:fs";
import path from "node:path";

export type SkillCategory = "pi" | "generic" | "project";

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
	pi: "全局 pi 耦合",
	generic: "全局通用",
	project: "当前项目",
};

export interface InstalledSkill {
	name: string;
	category: SkillCategory;
	lines: number;
	disableModelInvocation: boolean;
}

export interface SkillUsage {
	total: number;
	lastLoaded: string | null;
	recent: number;
}

export interface SkillAuditRow extends InstalledSkill, SkillUsage {}

export interface AuditOptions {
	now?: Date;
	windowDays?: number;
	deadlineMs?: number;
}

export interface AuditResult {
	rows: SkillAuditRow[];
	neverLoaded: SkillAuditRow[];
	stale: SkillAuditRow[];
	windowDays: number;
}

const SKILL_MARKER = /<skill name=\\?"([^"\\]+)\\?"[^>]*location=/g;
const DEFAULT_WINDOW_DAYS = 60;
const DEFAULT_DEADLINE_MS = 15000;
const READ_CONCURRENCY = 8;

function toLocalDate(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function countLines(text: string): number {
	const lines = text.split("\n");
	return text.endsWith("\n") ? lines.length - 1 : lines.length;
}

function readInstalledSkill(dir: string, name: string, category: SkillCategory): InstalledSkill | null {
	const file = path.join(dir, name, "SKILL.md");
	let text: string;
	try {
		text = fs.readFileSync(file, "utf8");
	} catch {
		return null;
	}
	const frontmatter = text.startsWith("---") ? text.slice(3, text.indexOf("\n---", 3) + 4) : "";
	return {
		name,
		category,
		lines: countLines(text),
		disableModelInvocation: /^disable-model-invocation:\s*true\s*$/m.test(frontmatter),
	};
}

export function collectInstalledSkills(dirs: Record<SkillCategory, string>): InstalledSkill[] {
	const out: InstalledSkill[] = [];
	for (const category of Object.keys(dirs) as SkillCategory[]) {
		const dir = dirs[category];
		let entries: fs.Dirent[] = [];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue;
			const full = path.join(dir, entry.name);
			let isDir = entry.isDirectory();
			if (!isDir) {
				try {
					isDir = fs.statSync(full).isDirectory();
				} catch {
					isDir = false;
				}
			}
			if (!isDir) continue;
			const skill = readInstalledSkill(dir, entry.name, category);
			if (skill !== null) out.push(skill);
		}
	}
	return out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function listSessionFiles(dir: string): string[] {
	const out: string[] = [];
	const walk = (current: string): void => {
		let entries: fs.Dirent[] = [];
		try {
			entries = fs.readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(full);
		}
	};
	walk(dir);
	return out.sort();
}

export async function collectSkillUsage(sessionsDir: string, options: AuditOptions = {}): Promise<Map<string, SkillUsage>> {
	const now = options.now ?? new Date();
	const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
	const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
	const windowStart = toLocalDate(new Date(now.getTime() - windowDays * 86400000));
	const files = listSessionFiles(sessionsDir);
	const usage = new Map<string, SkillUsage>();
	const started = Date.now();
	let next = 0;

	const merge = (name: string, hit: SkillUsage): void => {
		const prev = usage.get(name);
		if (prev === undefined) {
			usage.set(name, { ...hit });
			return;
		}
		prev.total += hit.total;
		prev.recent += hit.recent;
		if (hit.lastLoaded !== null && (prev.lastLoaded === null || hit.lastLoaded > prev.lastLoaded)) prev.lastLoaded = hit.lastLoaded;
	};

	const worker = async (): Promise<void> => {
		while (next < files.length && Date.now() - started < deadlineMs) {
			const file = files[next];
			next += 1;
			if (file === undefined) return;
			let text: string;
			try {
				text = await fs.promises.readFile(file, "utf8");
			} catch {
				continue;
			}
			if (!text.includes("<skill name=")) continue;
			for (const line of text.split("\n")) {
				if (!line.includes("<skill name=")) continue;
				let timestamp = "";
				try {
					const parsed = JSON.parse(line) as { timestamp?: unknown };
					if (typeof parsed.timestamp === "string") timestamp = parsed.timestamp;
				} catch {
					continue;
				}
				const ms = Date.parse(timestamp);
				if (!Number.isFinite(ms)) continue;
				const date = toLocalDate(new Date(ms));
				for (const match of line.matchAll(SKILL_MARKER)) {
					const name = match[1];
					if (name === undefined) continue;
					merge(name, { total: 1, lastLoaded: date, recent: date >= windowStart ? 1 : 0 });
				}
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, Math.max(1, files.length)) }, worker));
	return usage;
}

export interface AuditInput extends AuditOptions {
	piSkillsDir: string;
	genericSkillsDir: string;
	projectSkillsDir: string;
	sessionsDir: string;
}

export async function auditSkills(input: AuditInput): Promise<AuditResult> {
	const now = input.now ?? new Date();
	const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
	const windowStart = toLocalDate(new Date(now.getTime() - windowDays * 86400000));
	const installed = collectInstalledSkills({
		pi: input.piSkillsDir,
		generic: input.genericSkillsDir,
		project: input.projectSkillsDir,
	});
	const usage = await collectSkillUsage(input.sessionsDir, { now, windowDays, deadlineMs: input.deadlineMs });
	const byName = new Map<string, SkillUsage>();
	for (const [name, u] of usage) byName.set(name, u);
	const rows: SkillAuditRow[] = installed.map((skill) => {
		const hit = byName.get(skill.name);
		return { ...skill, total: hit?.total ?? 0, lastLoaded: hit?.lastLoaded ?? null, recent: hit?.recent ?? 0 };
	});
	const neverLoaded = rows.filter((r) => r.total === 0);
	const stale = rows.filter((r) => r.total > 0 && (r.lastLoaded === null || r.lastLoaded < windowStart));
	return { rows, neverLoaded, stale, windowDays };
}

function displayWidth(value: string): number {
	return [...value].reduce((n, ch) => n + (/[\u4e00-\u9fff]/.test(ch) ? 2 : 1), 0);
}

function pad(value: string, width: number): string {
	return value + " ".repeat(Math.max(0, width - displayWidth(value)));
}

export function renderAuditTable(rows: SkillAuditRow[], windowDays = DEFAULT_WINDOW_DAYS): string {
	const header = ["skill", "来源", "最近加载", `${windowDays} 天次数`, "SKILL.md 行数", "disable-model-invocation"];
	const body = rows.map((r) => [
		r.name,
		CATEGORY_LABELS[r.category],
		r.lastLoaded ?? "—",
		String(r.recent),
		String(r.lines),
		r.disableModelInvocation ? "yes" : "no",
	]);
	const widths = header.map((h, i) => Math.max(displayWidth(h), ...body.map((row) => displayWidth(row[i] ?? ""))));
	const line = (cell: string[]): string => cell.map((c, i) => pad(c, widths[i] ?? 0)).join("  ").replace(/\s+$/, "");
	return [line(header), "-".repeat(widths.reduce((n, w) => n + w + 2, 0)), ...body.map(line)].join("\n");
}

export function renderAuditReport(result: AuditResult): string {
	const lines: string[] = [renderAuditTable(result.rows, result.windowDays), ""];
	const names = (rows: SkillAuditRow[]): string => rows.map((r) => `${r.name}（${CATEGORY_LABELS[r.category]}）`).join("、");
	lines.push(result.neverLoaded.length === 0 ? "从未加载：无" : `从未加载：${names(result.neverLoaded)}`);
	lines.push(
		result.stale.length === 0
			? `超过 ${result.windowDays} 天未加载：无`
			: `超过 ${result.windowDays} 天未加载：${result.stale.map((r) => `${r.name}（最近 ${r.lastLoaded ?? "未知"}）`).join("、")}`,
	);
	return lines.join("\n");
}

export function renderAuditJson(result: AuditResult): string {
	const prune = (r: SkillAuditRow): Record<string, string | number | boolean | null> => ({
		name: r.name,
		category: r.category,
		lastLoaded: r.lastLoaded,
		recent: r.recent,
		total: r.total,
		lines: r.lines,
		disableModelInvocation: r.disableModelInvocation,
	});
	return JSON.stringify(
		{
			windowDays: result.windowDays,
			skills: result.rows.map(prune),
			neverLoaded: result.neverLoaded.map((r) => r.name),
			stale: result.stale.map((r) => ({ name: r.name, lastLoaded: r.lastLoaded })),
		},
		null,
		2,
	);
}

/**
 * Run storage — pure files under `.pi/workflows/`, no engine, no locks.
 *
 *   .pi/workflows/definitions/<name>.md        Definitions (copied from patterns on start)
 *   .pi/workflows/runs/<run-id>/run.json       machine state (single source of truth)
 *   .pi/workflows/runs/<run-id>/progress.md    human-readable log (one line per flip/reroute)
 *   .pi/workflows/.last-focus                  last-interacted run id (cold-start preselect)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseDefinition } from "./definition";
import {
	DEFINITIONS_DIR,
	GLOBAL_PATTERNS_DIR,
	LAST_FOCUS_FILE,
	RUNS_DIR,
	RUN_LOG_FILE,
	RUN_STATE_FILE,
	WORKFLOWS_DIR,
	TERMINAL_RUN_STATUSES,
	type Definition,
	type LogLine,
	type Run,
	type RunNode,
	type RunStatus,
} from "./types";

export function workflowsDir(cwd: string): string {
	return path.join(cwd, WORKFLOWS_DIR);
}
export function definitionsDir(cwd: string): string {
	return path.join(cwd, DEFINITIONS_DIR);
}
export function runsDir(cwd: string): string {
	return path.join(cwd, RUNS_DIR);
}
export function globalPatternsDir(): string {
	return GLOBAL_PATTERNS_DIR.replace(/^~/, os.homedir());
}
export function runDir(cwd: string, runId: string): string {
	return path.join(runsDir(cwd), runId);
}

/**
 * Permanently delete a Run directory (run.json + progress.md). Human-initiated
 * only — the runtime never removes runs on its own. Definition files are kept.
 */
export function removeRun(cwd: string, runId: string): void {
	fs.rmSync(runDir(cwd, runId), { recursive: true, force: true });
}

export function slugify(s: string): string {
	return (
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40) || "run"
	);
}

/** run-id: <YYYYMMDD-HHmmss>-<name-slug> (unique per second; suffix on collision). */
export function makeRunId(definitionName: string, at: Date, existing: string[]): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
	const base = `${stamp}-${slugify(definitionName)}`;
	if (!existing.includes(base)) return base;
	let n = 2;
	while (existing.includes(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}

// ---- run.json ----

export function readRun(cwd: string, runId: string): Run | undefined {
	const file = path.join(runDir(cwd, runId), RUN_STATE_FILE);
	if (!fs.existsSync(file)) return undefined;
	try {
		const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Run;
		if (!parsed || parsed.id !== runId || !Array.isArray(parsed.nodes)) return undefined;
		return parsed;
	} catch {
		return undefined;
	}
}

export function writeRun(cwd: string, run: Run): void {
	run.updatedAt = new Date().toISOString();
	const dir = runDir(cwd, run.id);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, RUN_STATE_FILE), `${JSON.stringify(run, null, 2)}\n`, "utf8");
}

export function listRunIds(cwd: string): string[] {
	const dir = runsDir(cwd);
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();
}

export function listRuns(cwd: string): Run[] {
	return listRunIds(cwd)
		.map((id) => readRun(cwd, id))
		.filter((r): r is Run => r !== undefined)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function nonTerminalRuns(cwd: string): Run[] {
	return listRuns(cwd).filter((r) => !TERMINAL_RUN_STATUSES.includes(r.status));
}

export function isTerminal(run: Run): boolean {
	return TERMINAL_RUN_STATUSES.includes(run.status);
}

/** Exact id first, then unique prefix match. */
export function resolveRunRef(cwd: string, ref: string): { run?: Run; error?: string } {
	const ids = listRunIds(cwd);
	if (ids.length === 0) return { error: "no runs exist yet — start one with /wf start <definition-name>" };
	if (ids.includes(ref)) return { run: readRun(cwd, ref) };
	const matches = ids.filter((id) => id.startsWith(ref));
	if (matches.length === 1) return { run: readRun(cwd, matches[0]!) };
	if (matches.length > 1) return { error: `"${ref}" is ambiguous — matches ${matches.join(", ")}` };
	return { error: `no run matches "${ref}" — see /wf list` };
}

// ---- progress.md ----

export function formatLogLine(line: LogLine): string {
	return `- ${line.at} | ${line.kind} | ${line.text}`;
}

export function appendLog(cwd: string, runId: string, kind: LogLine["kind"], text: string, at?: string): void {
	const dir = runDir(cwd, runId);
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, RUN_LOG_FILE);
	if (!fs.existsSync(file)) {
		const run = readRun(cwd, runId);
		fs.writeFileSync(
			file,
			`# Workflow Run ${runId}${run ? ` — ${run.title}` : ""}\n\nOne line per state flip / reroute. Written by the workflow-runtime extension only.\n\n`,
			"utf8",
		);
	}
	fs.appendFileSync(file, `${formatLogLine({ at: at ?? new Date().toISOString(), kind, text })}\n`, "utf8");
}

/** Tail of the progress log (non-empty lines, last N). */
export function readLogTail(cwd: string, runId: string, n = 10): string {
	const file = path.join(runDir(cwd, runId), RUN_LOG_FILE);
	if (!fs.existsSync(file)) return "";
	const lines = fs
		.readFileSync(file, "utf8")
		.split(/\r?\n/)
		.filter((l) => l.trim() !== "");
	return lines.slice(-n).join("\n");
}

// ---- last-focus (cold-start preselect; machine-local) ----

export function readLastFocus(cwd: string): string | undefined {
	const file = path.join(cwd, LAST_FOCUS_FILE);
	if (!fs.existsSync(file)) return undefined;
	const id = fs.readFileSync(file, "utf8").trim();
	return id || undefined;
}

export function writeLastFocus(cwd: string, runId: string): void {
	fs.mkdirSync(path.dirname(path.join(cwd, LAST_FOCUS_FILE)), { recursive: true });
	fs.writeFileSync(path.join(cwd, LAST_FOCUS_FILE), `${runId}\n`, "utf8");
}

/** Clear the pointer (e.g. it referenced a since-removed run). */
export function clearLastFocus(cwd: string): void {
	fs.rmSync(path.join(cwd, LAST_FOCUS_FILE), { force: true });
}

// ---- definitions ----

export function definitionPath(cwd: string, name: string): string {
	return path.join(definitionsDir(cwd), `${name}.md`);
}

export function readDefinitionFrom(file: string): Definition | undefined {
	if (!fs.existsSync(file)) return undefined;
	try {
		const { definition } = parseDefinition(fs.readFileSync(file, "utf8"), file);
		return definition;
	} catch {
		return undefined;
	}
}

/** Pattern lookup: project `.pi/workflows/definitions/` first, then the global library. */
export function findDefinition(
	cwd: string,
	name: string,
	globalDirOverride?: string,
): { definition: Definition; from: "project" | "global"; file: string } | { error: string } {
	const projectFile = definitionPath(cwd, name);
	if (fs.existsSync(projectFile)) {
		const def = readDefinitionFrom(projectFile);
		if (def) return { definition: def, from: "project", file: projectFile };
		return { error: `definition "${name}" exists at ${projectFile} but violates the format contract — fix or delete it first` };
	}
	const globalFile = path.join(globalDirOverride ?? globalPatternsDir(), `${name}.md`);
	if (fs.existsSync(globalFile)) {
		const def = readDefinitionFrom(globalFile);
		if (def) return { definition: def, from: "global", file: globalFile };
		return { error: `pattern "${name}" exists at ${globalFile} but violates the format contract — fix it in the library first` };
	}
	return { error: `no definition or pattern named "${name}" (looked in ${DEFINITIONS_DIR}/ and ${GLOBAL_PATTERNS_DIR}/) — draft one with /wf new ${name}` };
}

// ---- run construction / state machine helpers (pure) ----

export function toRunNode(def: Definition): RunNode[] {
	return def.nodes.map((n, i) => ({
		...n,
		brief: n.brief,
		status: i === 0 ? "active" : "pending",
		startedAt: i === 0 ? new Date().toISOString() : undefined,
	}));
}

export function activeNode(run: Run): RunNode | undefined {
	return run.nodes.find((n) => n.id === run.activeNodeId);
}

export function nextPendingNode(run: Run): RunNode | undefined {
	return run.nodes.find((n) => n.status === "pending");
}

/** All nodes reached a terminal state → run status (done unless cancelled). */
export function deriveRunStatus(run: Run): RunStatus {
	const open = run.nodes.some((n) => n.status === "active" || n.status === "pending" || n.status === "failed");
	if (open) return "active";
	return run.status === "cancelled" ? "cancelled" : "done";
}

export function formatNodeLine(n: RunNode): string {
	const mark = { pending: "·", active: "▶", done: "✓", skipped: "○", failed: "✗", cancelled: "×" }[n.status];
	const session = n.sessionId ? ` [${n.sessionId}]` : "";
	return `${mark} ${n.id} (${n.type}, ${n.status})${session} — ${n.title}`;
}

/** Compact one-line-per-run summary used by /wf list, the picker and the widget. */
export function formatRunLine(cwd: string, run: Run, focused: boolean): string {
	const node = activeNode(run) ?? run.nodes.find((n) => n.status === "failed");
	const nodePart = node ? ` · ${node.id}:${node.status}` : "";
	const focus = focused ? " ◀ focus" : "";
	return `${run.id}${focus}${nodePart} · ${run.title} [${run.status}]`;
}

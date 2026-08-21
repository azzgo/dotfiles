/**
 * sub-dispatch — core dispatch engine (shared by the `dispatch` tool, the
 * `/dispatch` command, and the programmatic `runDispatch` bridge for code-mode).
 *
 * Trimmed from pi-interactive-shell (v0.15.0) `spawn.ts` + `config.ts`:
 * only the spawn-agent resolution, worktree creation, and (non-PTY) subprocess
 * execution survive. No overlay / pty / interactive input / monitor machinery.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const EXT_DIR = path.dirname(fileURLToPath(import.meta.url));

/* ── Config ─────────────────────────────────────────────────────────────── */

export interface DispatchConfig {
	defaultAgent: string;
	/** Any key here is a first-class spawn agent (incl. the built-in defaults). */
	commands: Record<string, string>;
	/** Per-agent argument prefix inserted before the prompt (e.g. claude -p). */
	defaultArgs: Record<string, string[]>;
	worktree: boolean;
	worktreeBaseDir?: string;
	/** Output truncation cap (tail). */
	maxOutputChars: number;
	defaultTimeoutSec: number;
}

const DEFAULT_CONFIG: DispatchConfig = {
	defaultAgent: "pi",
	commands: { pi: "pi", codex: "codex", claude: "claude", cursor: "agent" },
	defaultArgs: { pi: [], codex: [], claude: ["-p"], cursor: ["--model", "composer-2-fast"] },
	worktree: false,
	maxOutputChars: 20000,
	defaultTimeoutSec: 600,
};

export function loadConfig(): DispatchConfig {
	try {
		const raw = JSON.parse(readFileSync(path.join(EXT_DIR, "config.json"), "utf-8")) as Partial<DispatchConfig>;
		return {
			...DEFAULT_CONFIG,
			...raw,
			commands: isPlainObject(raw.commands) ? { ...DEFAULT_CONFIG.commands, ...raw.commands } : DEFAULT_CONFIG.commands,
			defaultArgs: isPlainObject(raw.defaultArgs)
				? { ...DEFAULT_CONFIG.defaultArgs, ...raw.defaultArgs }
				: DEFAULT_CONFIG.defaultArgs,
			maxOutputChars: clampInt(raw.maxOutputChars, DEFAULT_CONFIG.maxOutputChars, 1000, 1_000_000),
			defaultTimeoutSec: clampInt(raw.defaultTimeoutSec, DEFAULT_CONFIG.defaultTimeoutSec, 1, 86400),
			worktree: typeof raw.worktree === "boolean" ? raw.worktree : DEFAULT_CONFIG.worktree,
		};
	} catch {
		return DEFAULT_CONFIG;
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const rounded = Math.trunc(value);
	return Math.min(max, Math.max(min, rounded));
}

/* ── Resolve ────────────────────────────────────────────────────────────── */

export type ResolvedCommand =
	| { ok: true; executable: string; args: string[] }
	| { ok: false; error: string };

export function resolveCommand(config: DispatchConfig, agent: string, prompt: string): ResolvedCommand {
	if (!prompt || !prompt.trim()) return { ok: false, error: "Dispatch prompt cannot be empty." };
	// Own-property lookups only: an agent name like "constructor" must not resolve through Object.prototype.
	const executable = Object.hasOwn(config.commands, agent) ? config.commands[agent] : undefined;
	if (!executable) {
		const configured = Object.keys(config.commands).sort().join(", ");
		return { ok: false, error: `Unknown dispatch agent: ${agent}. Configured agents: ${configured}.` };
	}
	const defaultArgs = Object.hasOwn(config.defaultArgs, agent) ? [...config.defaultArgs[agent]] : [];
	return { ok: true, executable, args: [...defaultArgs, prompt] };
}

/* ── Worktree ───────────────────────────────────────────────────────────── */

export type WorktreeResult = { ok: true; cwd: string; path: string } | { ok: false; error: string };

export function createWorktree(config: DispatchConfig, cwd: string, agent: string): WorktreeResult {
	const workingDir = resolve(cwd);
	const repoRoot = runGit(["-C", workingDir, "rev-parse", "--show-toplevel"], workingDir);
	if (!repoRoot.ok) {
		return { ok: false, error: "Cannot create a worktree here because the current directory is not inside a git repository." };
	}
	const baseDir = config.worktreeBaseDir
		? resolve(repoRoot.stdout, config.worktreeBaseDir)
		: join(dirname(repoRoot.stdout), `${basename(repoRoot.stdout)}-worktrees`);
	mkdirSync(baseDir, { recursive: true });

	const timestamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
	const suffix = Math.random().toString(36).slice(2, 7);
	const worktreePath = join(baseDir, `${basename(repoRoot.stdout)}-${agent}-${timestamp}-${suffix}`);
	const addWorktree = runGit(["-C", repoRoot.stdout, "worktree", "add", "--detach", worktreePath, "HEAD"], repoRoot.stdout);
	if (!addWorktree.ok) return { ok: false, error: addWorktree.error };

	const relativeCwd = relative(repoRoot.stdout, workingDir);
	if (relativeCwd.length === 0 || relativeCwd.startsWith("..")) {
		return { ok: true, cwd: worktreePath, path: worktreePath };
	}
	const nestedCwd = join(worktreePath, relativeCwd);
	return { ok: true, cwd: existsSync(nestedCwd) ? nestedCwd : worktreePath, path: worktreePath };
}

function runGit(args: string[], cwd: string): { ok: true; stdout: string } | { ok: false; error: string } {
	try {
		return { ok: true, stdout: execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
	} catch (error) {
		const stderr =
			error instanceof Error && "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: stderr ? `${message}\n${stderr}` : message };
	}
}

/* ── Spawn ──────────────────────────────────────────────────────────────── */

export interface SpawnCommandOptions {
	cwd: string;
	timeoutMs: number;
	signal?: AbortSignal;
	maxOutputChars?: number;
	/** Called with each new chunk of merged output as it arrives (for streaming). */
	onOutput?: (chunk: string) => void;
}

export interface RunDispatchResult {
	ok: boolean;
	exitCode: number | null;
	output: string;
	worktreePath?: string;
}

/**
 * Spawn a subprocess (no PTY), collect stdout+stderr merged, and wait for exit.
 * `detached: true` puts the child in its own process group so we can kill the
 * whole tree; Esc (signal abort) and timeout both terminate the group.
 */
export function spawnCommand(
	executable: string,
	args: string[],
	opts: SpawnCommandOptions,
): Promise<RunDispatchResult> {
	return new Promise((resolvePromise) => {
		let settled = false;
		let output = "";
		const signal = opts.signal;
		const maxOutputChars = opts.maxOutputChars ?? 20000;

		const child = spawn(executable, args, {
			cwd: opts.cwd,
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		});

		const append = (chunk: Buffer | string) => {
			const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
			output += text;
			try {
				opts.onOutput?.(text);
			} catch {
				// streaming callback must never break collection
			}
		};
		child.stdout?.on("data", append);
		child.stderr?.on("data", append);

		const finish = (result: RunDispatchResult) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			resolvePromise({ ...result, output: tailTruncate(output, maxOutputChars) });
		};

		const onAbort = () => {
			killProcessGroup(child);
			output += "\n[aborted by user (Esc)]";
			finish({ ok: false, exitCode: null, output });
		};

		if (opts.signal?.aborted) {
			onAbort();
			return;
		}
		opts.signal?.addEventListener("abort", onAbort, { once: true });

		const timer = setTimeout(() => {
			killProcessGroup(child);
			output += `\n[timed out after ${Math.round(opts.timeoutMs / 1000)}s]`;
			finish({ ok: false, exitCode: null, output });
		}, opts.timeoutMs);

		child.on("error", (err) => {
			output += `\n[spawn error] ${err.message}`;
			finish({ ok: false, exitCode: null, output });
		});
		child.on("close", (code) => {
			finish({ ok: code === 0, exitCode: code, output });
		});
	});
}

/**
 * Programmatic entry for code-mode's `defs` table: spawn a sub-agent and wait.
 * This is the v2b bridge hook (import `runDispatch` from `../sub-dispatch/runner.ts`).
 */
export async function runDispatch(opts: {
	agent: string;
	prompt: string;
	worktree?: boolean;
	timeoutSec?: number;
	cwd?: string;
	signal?: AbortSignal;
}): Promise<RunDispatchResult> {
	const config = loadConfig();
	const cwd = opts.cwd ?? process.cwd();
	const resolved = resolveCommand(config, opts.agent, opts.prompt);
	if (!resolved.ok) return { ok: false, exitCode: null, output: resolved.error };

	let effectiveCwd = cwd;
	let worktreePath: string | undefined;
	if (opts.worktree ?? config.worktree) {
		const wt = createWorktree(config, cwd, opts.agent);
		if (!wt.ok) return { ok: false, exitCode: null, output: wt.error };
		effectiveCwd = wt.cwd;
		worktreePath = wt.path;
	}

	const timeoutSec = opts.timeoutSec ?? config.defaultTimeoutSec;
	const result = await spawnCommand(resolved.executable, resolved.args, {
		cwd: effectiveCwd,
		timeoutMs: timeoutSec * 1000,
		signal: opts.signal,
		maxOutputChars: config.maxOutputChars,
	});
	if (worktreePath) result.worktreePath = worktreePath;
	return result;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function killProcessGroup(child: ChildProcess): void {
	if (child.pid == null) return;
	const pid = child.pid;
	if (process.platform === "win32") {
		try {
			child.kill("SIGTERM");
		} catch {
			/* already gone */
		}
		return;
	}
	// detached child is the leader of its own process group; SIGTERM the group,
	// then escalate to SIGKILL after a short grace so descendants actually die.
	try {
		process.kill(-pid, "SIGTERM");
	} catch {
		/* group may already be gone */
	}
	setTimeout(() => {
		try {
			process.kill(-pid, "SIGKILL");
		} catch {
			/* already gone */
		}
	}, 2000).unref();
}

export function tailTruncate(s: string, maxChars: number): string {
	if (s.length <= maxChars) return s;
	return `… [truncated, showing last ${maxChars} chars]\n${s.slice(-maxChars)}`;
}

let sessionSeq = 0;
export function generateSessionId(name?: string): string {
	sessionSeq++;
	const rand = Math.random().toString(36).slice(2, 7);
	const base = name ? name.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase() : "dispatch";
	return `${base}-${sessionSeq}-${rand}`;
}

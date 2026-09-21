/**
 * sub-dispatch — core dispatch engine (shared by the `dispatch` tool, the
 * `/dispatch` command, and the programmatic `runDispatch` bridge for code-mode).
 *
 * Trimmed from pi-interactive-shell (v0.15.0) `spawn.ts` + `config.ts`:
 * only the spawn-agent resolution and (non-PTY) subprocess
 * execution survive. No overlay / pty / interactive input / monitor machinery.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const EXT_DIR = path.dirname(fileURLToPath(import.meta.url));

/* ── Config ─────────────────────────────────────────────────────────────── */

export interface DispatchConfig {
	defaultAgent: string;
	/** Any key here is a first-class spawn agent (incl. the built-in defaults). */
	commands: Record<string, string>;
	/** Per-agent: pass the prompt to the child's stdin instead of argv. */
	promptViaStdin: Record<string, boolean>;
	/** Argv length above which stdin delivery is forced for agents that support it.
	 * Corporate EDR kills node processes whose single argv entry is >= 1024 bytes.
	 */
	stdinPromptThreshold: number;
	maxOutputChars: number;
	defaultTimeoutSec: number;
}

/**
 * Spawn mode args are NOT configurable: stdin delivery depends on each agent running
 * in its non-interactive (print) mode, so a config mistake here would silently turn
 * dispatches into hanging interactive sessions.
 */
const SPAWN_ARGS: Record<string, string[]> = {
	pi: ["-p"],
	codex: [],
	claude: ["-p"],
	cursor: ["--model", "composer-2-fast"],
};

const DEFAULT_CONFIG: DispatchConfig = {
	defaultAgent: "pi",
	commands: { pi: "pi", codex: "codex", claude: "claude", cursor: "agent" },
	promptViaStdin: { pi: true, claude: true },
	stdinPromptThreshold: 900,
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
			promptViaStdin: isPlainObject(raw.promptViaStdin)
				? { ...DEFAULT_CONFIG.promptViaStdin, ...raw.promptViaStdin }
				: DEFAULT_CONFIG.promptViaStdin,
			stdinPromptThreshold: clampInt(raw.stdinPromptThreshold, DEFAULT_CONFIG.stdinPromptThreshold, 1, 8192),
			maxOutputChars: clampInt(raw.maxOutputChars, DEFAULT_CONFIG.maxOutputChars, 1000, 1_000_000),
			defaultTimeoutSec: clampInt(raw.defaultTimeoutSec, DEFAULT_CONFIG.defaultTimeoutSec, 1, 86400),
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
	| { ok: true; executable: string; args: string[]; stdinData?: string; argvWarning?: string }
	| { ok: false; error: string };

export function resolveCommand(config: DispatchConfig, agent: string, prompt: string, model?: string): ResolvedCommand {
	if (!prompt || !prompt.trim()) return { ok: false, error: "Dispatch prompt cannot be empty." };
	// Own-property lookups only: an agent name like "constructor" must not resolve through Object.prototype.
	const executable = Object.hasOwn(config.commands, agent) ? config.commands[agent] : undefined;
	if (!executable) {
		const configured = Object.keys(config.commands).sort().join(", ");
		return { ok: false, error: `Unknown dispatch agent: ${agent}. Configured agents: ${configured}.` };
	}
	const defaultArgs = Object.hasOwn(SPAWN_ARGS, agent) ? [...SPAWN_ARGS[agent]] : [];
	const modelArgs: string[] = model ? ["--model", model] : [];
	const viaStdin = Object.hasOwn(config.promptViaStdin, agent) && config.promptViaStdin[agent];
	if (viaStdin && prompt.length >= config.stdinPromptThreshold) {
		// EDR mitigation: a single argv entry >= 1024 bytes gets the child SIGKILLed before it runs.
		return { ok: true, executable, args: [...defaultArgs, ...modelArgs], stdinData: prompt };
	}
	const argvWarning = prompt.length >= config.stdinPromptThreshold
		? `Warning: prompt is ${prompt.length} chars but agent "${agent}" has no stdin support; long argv may be killed by endpoint security software.`
		: undefined;
	return { ok: true, executable, args: [...defaultArgs, ...modelArgs, prompt], argvWarning };
}

/* ── Spawn ──────────────────────────────────────────────────────────────── */

export interface SpawnCommandOptions {
	cwd: string;
	timeoutMs: number;
	signal?: AbortSignal;
	maxOutputChars?: number;
	/** Called with each new chunk of merged output as it arrives (for streaming). */
	onOutput?: (chunk: string) => void;
	/** Environment variables merged into the subprocess (on top of process.env). */
	env?: Record<string, string>;
	/** Data written to the child's stdin (stream closed immediately after). */
	stdinData?: string;
}


export interface RunDispatchResult {
	ok: boolean;
	exitCode: number | null;
	output: string;
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
			stdio: [opts.stdinData != null ? "pipe" : "ignore", "pipe", "pipe"],
			detached: true,
			env: opts.env ? { ...process.env, ...opts.env } : undefined,
		});
		if (opts.stdinData != null) {
			// Must always end() — a never-closed stdin makes print-mode agents wait for EOF forever.
			try {
				child.stdin?.end(opts.stdinData);
			} catch {
				/* child already gone */
			}
		}

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
	model?: string;
	timeoutSec?: number;
	cwd?: string;
	signal?: AbortSignal;
	env?: Record<string, string>;
}): Promise<RunDispatchResult> {
	const config = loadConfig();
	const cwd = opts.cwd ?? process.cwd();
	const resolved = resolveCommand(config, opts.agent, opts.prompt, opts.model);
	if (!resolved.ok) return { ok: false, exitCode: null, output: resolved.error };

	const effectiveCwd = cwd;
	const timeoutSec = opts.timeoutSec ?? config.defaultTimeoutSec;
	const result = await spawnCommand(resolved.executable, resolved.args, {
		cwd: effectiveCwd,
		timeoutMs: timeoutSec * 1000,
		signal: opts.signal,
		maxOutputChars: config.maxOutputChars,
		env: opts.env,
		stdinData: resolved.stdinData,
	});
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

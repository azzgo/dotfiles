/**
 * sub-dispatch — core dispatch engine (shared by the `dispatch` tool and the
 * programmatic `runDispatch` bridge for code-mode).
 *
 * pi 1.0 runs a full agent loop in-process via `createAgentSession()`, so a
 * dispatch is an in-memory sub-session instead of a spawned CLI process: no
 * argv building, no stdout capture, no process group. The sub-session is
 * created with `SessionManager.inMemory()` so it never lands in the resume
 * list, and `dispatch` is filtered out of its tools (no recursion).
 *
 * Every dispatch — success, error, abort or timeout — leaves a JSONL forensic
 * dump under `~/.pi/agent/sub-dispatch-logs/` (see LOG_DIR_NAME).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
	createAgentSession,
	type AgentSession,
	type ModelRegistry,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

const EXT_DIR = path.dirname(fileURLToPath(import.meta.url));

/* ── Config ─────────────────────────────────────────────────────────────── */

export interface DispatchConfig {
	defaultTimeoutSec: number;
}

const DEFAULT_CONFIG: DispatchConfig = {
	defaultTimeoutSec: 600,
};

export function loadConfig(): DispatchConfig {
	try {
		const raw = JSON.parse(readFileSync(path.join(EXT_DIR, "config.json"), "utf-8")) as Partial<DispatchConfig>;
		return { defaultTimeoutSec: clampInt(raw.defaultTimeoutSec, DEFAULT_CONFIG.defaultTimeoutSec, 1, 86400) };
	} catch {
		return DEFAULT_CONFIG;
	}
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const rounded = Math.trunc(value);
	return Math.min(max, Math.max(min, rounded));
}

/* ── Agents ─────────────────────────────────────────────────────────────── */

export const SUPPORTED_AGENTS = ["pi"] as const;

export type ResolvedAgent = { ok: true; agent: string } | { ok: false; error: string };

export function resolveAgent(agent: string): ResolvedAgent {
	if (SUPPORTED_AGENTS.includes(agent as (typeof SUPPORTED_AGENTS)[number])) return { ok: true, agent };
	return {
		ok: false,
		error: `Unsupported dispatch agent: ${agent}. In-process dispatch only supports: ${SUPPORTED_AGENTS.join(", ")}.`,
	};
}

/* ── Forensics ──────────────────────────────────────────────────────────── */

export const LOG_DIR_NAME = "sub-dispatch-logs";

export function logDir(): string {
	return path.join(homedir(), ".pi", "agent", LOG_DIR_NAME);
}

function timestampSlug(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-` +
		`${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
	);
}

export function logFilePath(sessionId: string, startedAt: number): string {
	return path.join(logDir(), `${timestampSlug(new Date(startedAt))}-${sanitizeSessionId(sessionId)}.jsonl`);
}

function sanitizeSessionId(id: string): string {
	return id.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

export interface DispatchLog {
	filePath: string;
	append(entry: DispatchLogEntry): void;
}

export type DispatchLogEntry =
	| {
			type: "input";
			agent: string;
			prompt: string;
			cwd: string;
			model?: string;
			sessionId: string;
			startedAt: string;
	  }
	| { type: "message"; message: unknown }
	| {
			type: "result";
			exitCode: number;
			durationMs: number;
			output: string;
			status: DispatchStatus;
			usage?: DispatchUsage;
	  };

/**
 * Open the dump for one dispatch. Appends are fire-and-forget: logging must
 * never delay or fail a dispatch, so write errors are swallowed.
 */
export async function openDispatchLog(sessionId: string, startedAt: number): Promise<DispatchLog> {
	const filePath = logFilePath(sessionId, startedAt);
	let ready: Promise<void>;
	try {
		ready = mkdir(path.dirname(filePath), { recursive: true }).then(() => undefined);
	} catch {
		ready = Promise.resolve();
	}
	const write = (entry: DispatchLogEntry) => {
		void ready
			.then(() => appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf-8"))
			.catch(() => undefined);
	};
	await ready.catch(() => undefined);
	return { filePath, append: write };
}

export interface GcResult {
	deleted: string[];
	kept: number;
}

export async function gcLogs(keep = 50): Promise<GcResult> {
	const dir = logDir();
	let names: string[];
	try {
		names = (await readdir(dir)).filter((n) => n.endsWith(".jsonl"));
	} catch {
		return { deleted: [], kept: 0 };
	}
	// Filenames sort lexicographically by their timestamp prefix, so plain
	// ascending order is oldest-first.
	names.sort();
	const cutoff = Math.max(0, names.length - Math.max(0, keep));
	const deleted = names.slice(0, cutoff);
	for (const name of deleted) {
		await rm(path.join(dir, name), { force: true }).catch(() => undefined);
	}
	return { deleted, kept: names.length - deleted.length };
}

/* ── Session run ────────────────────────────────────────────────────────── */

export type DispatchStatus = "running" | "done" | "error" | "killed" | "timeout";

export interface DispatchUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	total: number;
	cost: number;
}

export interface RunDispatchResult {
	ok: boolean;
	status: DispatchStatus;
	exitCode: number | null;
	output: string;
	usage?: DispatchUsage;
	logFile: string;
}

export interface RunDispatchOptions {
	agent: string;
	prompt: string;
	cwd: string;
	model?: string;
	timeoutSec?: number;
	signal?: AbortSignal;
	modelRegistry?: ModelRegistry;
	/** Called with each new chunk of assistant text as it streams in. */
	onOutput?: (chunk: string) => void;
	/** Called with every session message once it is recorded. */
	onMessage?: (message: unknown) => void;
	/** Called with the live sub-session as soon as it exists (for out-of-band abort). */
	onSession?: (session: AgentSession) => void;
}

export function resolveModelByName(registry: ModelRegistry, name: string) {
	const trimmed = name.trim();
	const slash = trimmed.indexOf("/");
	const candidates = slash > 0
		? [registry.find(trimmed.slice(0, slash), trimmed.slice(slash + 1))]
		: [registry.getAll().find((m) => m.id === trimmed), registry.getAll().find((m) => `${m.provider}/${m.id}` === trimmed)];
	for (const candidate of candidates) {
		if (candidate) return candidate;
	}
	return undefined;
}

function usageFromSession(session: AgentSession): DispatchUsage | undefined {
	try {
		const stats = session.getSessionStats();
		const { tokens } = stats;
		return {
			input: tokens.input,
			output: tokens.output,
			cacheRead: tokens.cacheRead,
			cacheWrite: tokens.cacheWrite,
			total: tokens.total,
			cost: stats.cost,
		};
	} catch {
		return undefined;
	}
}

function lastAssistantText(session: AgentSession): string {
	const text = session.getLastAssistantText();
	if (typeof text === "string") return text;
	const messages = session.messages as Array<{ role?: string; content?: unknown }>;
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message?.role !== "assistant") continue;
		const content = message.content;
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			return content
				.filter((c): c is { type: "text"; text: string } => (c as { type?: string })?.type === "text")
				.map((c) => c.text)
				.join("");
		}
	}
	return "";
}

/**
 * Guards against nested dispatch. Tool filtering already removes `dispatch`
 * from a sub-session, but an extension could still reach `runDispatch` from
 * inside one — that must fail loudly instead of nesting sessions.
 *
 * The flag is async-context scoped, not a plain counter: independent
 * dispatches (e.g. `Promise.all` in a codemode script) run concurrently in the
 * same process and must not be mistaken for nesting.
 */
const dispatchContext = new AsyncLocalStorage<{ depth: number }>();

/**
 * Drive one in-process sub-session to completion. Resolves for every terminal
 * outcome (done/error/killed/timeout) — callers branch on `status`.
 */
export async function runSession(opts: RunDispatchOptions): Promise<RunDispatchResult> {
	const startedAt = Date.now();
	const depth = dispatchContext.getStore()?.depth ?? 0;
	if (depth > 0) {
		const error = "Nested dispatch is not supported: a dispatch cannot run inside another dispatch.";
		return { ok: false, status: "error", exitCode: 1, output: error, logFile: logFilePath(opts.agent, startedAt) };
	}
	return dispatchContext.run({ depth: depth + 1 }, () => runSessionInner(opts, startedAt));
}

async function runSessionInner(opts: RunDispatchOptions, startedAt: number): Promise<RunDispatchResult> {
	const timeoutSec = opts.timeoutSec ?? loadConfig().defaultTimeoutSec;

	let session: AgentSession;
	try {
		session = await createSubSession(opts);
	} catch (err) {
		const log = await openDispatchLog(opts.agent, startedAt);
		const message = err instanceof Error ? err.message : String(err);
		log.append({
			type: "input",
			agent: opts.agent,
			prompt: opts.prompt,
			cwd: opts.cwd,
			model: opts.model,
			sessionId: opts.agent,
			startedAt: new Date(startedAt).toISOString(),
		});
		log.append({ type: "result", exitCode: 1, durationMs: Date.now() - startedAt, output: message, status: "error" });
		return { ok: false, status: "error", exitCode: 1, output: `[session error] ${message}`, logFile: log.filePath };
	}

	const sessionId = session.sessionId;
	const log = await openDispatchLog(sessionId, startedAt);
	log.append({
		type: "input",
		agent: opts.agent,
		prompt: opts.prompt,
		cwd: opts.cwd,
		model: opts.model,
		sessionId,
		startedAt: new Date(startedAt).toISOString(),
	});
	opts.onSession?.(session);

	const seen = new Set<unknown>();
	const record = (message: unknown) => {
		if (seen.has(message)) return;
		seen.add(message);
		log.append({ type: "message", message });
		opts.onMessage?.(message);
	};

	let status: DispatchStatus = "running";
	let timedOut = false;
	// Usage is read before dispose(), which clears the session state.
	let usage: DispatchUsage | undefined;
	let aborted = false;
	// Finalized assistant texts across all turns; the streaming deltas only fill
	// the in-progress turn, so a tool-calling run keeps its earlier narration.
	const finalized: string[] = [];
	let streamed = "";
	let output = "";
	const unsubscribe = session.subscribe((event) => {
		if (event.type === "message_end") {
			record(event.message);
			if ((event.message as { role?: string })?.role === "assistant") {
				const text = lastAssistantText(session);
				finalized.push(text);
				streamed = "";
			}
			return;
		}
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			const delta = event.assistantMessageEvent.delta;
			streamed += delta;
			try {
				opts.onOutput?.(delta);
			} catch {
				// streaming callback must never break collection
			}
		}
	});

	const onAbort = () => {
		aborted = true;
		void session.abort();
	};
	if (opts.signal?.aborted) aborted = true;
	opts.signal?.addEventListener("abort", onAbort, { once: true });

	const timer = setTimeout(() => {
		timedOut = true;
		void session.abort();
	}, timeoutSec * 1000);

	try {
		if (aborted) {
			status = "killed";
		} else {
			await session.prompt(opts.prompt, { source: "rpc" });
			status = timedOut ? "timeout" : aborted ? "killed" : "done";
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		streamed += `${streamed ? "\n" : ""}[session error] ${message}`;
		status = timedOut ? "timeout" : aborted ? "killed" : "error";
	} finally {
		clearTimeout(timer);
		opts.signal?.removeEventListener("abort", onAbort);
		if (status === "running") status = timedOut ? "timeout" : aborted ? "killed" : "error";
		const parts = [...finalized];
		if (streamed.trim()) parts.push(streamed);
		if (aborted && status === "killed") parts.push("[aborted by user (Esc)]");
		else if (timedOut && status === "timeout") parts.push(`[timed out after ${timeoutSec}s]`);
		output = parts.filter((p) => p.trim()).join("\n");
		unsubscribe();
		usage = usageFromSession(session);
		log.append({ type: "result", exitCode: exitCodeFor(status), durationMs: Date.now() - startedAt, output, status, usage });
		try {
			session.dispose();
		} catch {
			// dispose is best-effort during teardown
		}
	}

	return {
		ok: status === "done",
		status,
		exitCode: exitCodeFor(status),
		output,
		usage,
		logFile: log.filePath,
	};
}

function exitCodeFor(status: DispatchStatus): number {
	return status === "done" ? 0 : 1;
}

async function createSubSession(opts: RunDispatchOptions): Promise<AgentSession> {
	const { session } = await createAgentSession({
		cwd: opts.cwd,
		sessionManager: SessionManager.inMemory(opts.cwd),
		excludeTools: ["dispatch"],
	});
	session.setActiveToolsByName(session.getActiveToolNames().filter((name) => name !== "dispatch"));
	if (opts.model) {
		const registry = opts.modelRegistry;
		const model = registry ? resolveModelByName(registry, opts.model) : undefined;
		if (!model) throw new Error(`Unknown dispatch model: ${opts.model}.`);
		await session.setModel(model);
	}
	return session;
}

/**
 * Programmatic entry for code-mode's `defs` table and other extensions:
 * drive a sub-agent session and wait for it.
 */
export async function runDispatch(opts: {
	agent: string;
	prompt: string;
	model?: string;
	timeoutSec?: number;
	cwd?: string;
	signal?: AbortSignal;
	modelRegistry?: ModelRegistry;
	onOutput?: (chunk: string) => void;
}): Promise<RunDispatchResult> {
	const agent = resolveAgent(opts.agent);
	if (!agent.ok) {
		return { ok: false, status: "error", exitCode: 1, output: agent.error, logFile: "" };
	}
	if (!opts.prompt || !opts.prompt.trim()) {
		return { ok: false, status: "error", exitCode: 1, output: "Dispatch prompt cannot be empty.", logFile: "" };
	}
	return runSession({
		agent: agent.agent,
		prompt: opts.prompt,
		cwd: opts.cwd ?? process.cwd(),
		model: opts.model,
		timeoutSec: opts.timeoutSec,
		signal: opts.signal,
		modelRegistry: opts.modelRegistry,
		onOutput: opts.onOutput,
	});
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

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

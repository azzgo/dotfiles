/**
 * sub-dispatch — a minimal sub-agent dispatch extension for pi, trimmed from
 * pi-interactive-shell (v0.15.0). Single use-case: spawn a coding agent as a
 * subprocess (`dispatch` mode) and collect its output. No PTY / interactive
 * input — read-only visibility only (see ui.ts).
 *
 * Files:
 *   index.ts   entry: `dispatch` tool, `/dispatch` peek command, background
 *              session table, widget/renderer wiring
 *   runner.ts  core engine: config, agent resolution, non-PTY spawn
 *   ui.ts      visual surfaces: Dispatch Overview widget, Output Peek viewer,
 *              Dispatch Record renderer
 *   config.json  commands / defaultArgs / caps
 *
 * Bridge hook (v2b, reserved): code-mode imports `runDispatch` programmatically
 * from `../sub-dispatch/runner.ts` for its own execute.
 *
 * Visibility layers (all program-side, zero tokens):
 *   Dispatch Overview — widget: running sessions, live elapsed, 5s settle linger
 *   Output Peek       — `/dispatch` → read-only scrollable output overlay
 *   Dispatch Record   — completion message: one compact line, ctrl+o expands
 */
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
	generateSessionId,
	killProcessGroup,
	loadConfig,
	resolveCommand,
	spawnCommand,
	tailTruncate,
} from "./runner.js";
import {
	createDispatchWidget,
	formatDurationMs,
	lastOutputLine,
	openOutputPeek,
	renderDispatchRecord,
	sessionSummary,
	type CompletionDetails,
	type DispatchWidgetHandle,
} from "./ui.js";

export { runDispatch } from "./runner.js";

interface BgSession {
	id: string;
	agent: string;
	cwd: string;
	child: ChildProcess;
	output: string;
	exitCode: number | null;
	status: "running" | "done" | "error" | "killed" | "timeout";
	startedAt: number;
	doneAt?: number;
	/** Output truncation cap applied to completion notifications. */
	maxOutputChars: number;
	/** Guard so completion is notified exactly once (close+error can both fire). */
	notified?: boolean;
}

/** Module-level background session table (cleared on /reload — expected). */
const bgSessions = new Map<string, BgSession>();

/** Running first (oldest spawn), then settled (newest settle) — picker order. */
function orderedSessions(): BgSession[] {
	const all = [...bgSessions.values()];
	const running = all.filter((s) => s.status === "running").sort((a, b) => a.startedAt - b.startedAt);
	const settled = all.filter((s) => s.status !== "running").sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
	return [...running, ...settled];
}

function formatSessionStatus(s: BgSession): string {
	const durMs = (s.doneAt ?? Date.now()) - s.startedAt;
	const lines = [
		`Session ${s.id} — ${s.status}${s.exitCode != null ? ` (exit ${s.exitCode})` : ""} — ${formatDurationMs(durMs)}`,
		`agent: ${s.agent}`,
	];
	const out = tailTruncate(s.output, 20000);
	if (out.trim()) lines.push("── output ──\n" + out);
	return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
	// ── Dispatch Overview widget (persistent; renders nothing when empty) ──
	// UI surfaces live on ExtensionContext, not ExtensionAPI, so registration
	// happens per session_start. Re-setting the same key is idempotent; the
	// stale handle is disposed so its repaint timer can't leak.
	let widgetHandle: DispatchWidgetHandle | null = null;
	const refreshWidget = (): void => widgetHandle?.refresh();
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		widgetHandle?.dispose();
		widgetHandle = null;
		ctx.ui.setWidget(
			"sub-dispatch",
			(tui, theme) => {
				const handle = createDispatchWidget(tui, theme, () => [...bgSessions.values()]);
				widgetHandle = handle;
				return handle;
			},
			{ placement: "aboveEditor" },
		);
	});

	// Notify the host when a background session settles. `triggerTurn` wakes the
	// agent if idle; `deliverAs: "followUp"` queues behind an in-flight turn so it
	// is never lost. The content is self-contained (status + output tail + how to
	// fetch full details) so the model needs no history to act on it. Rendered
	// compactly in the transcript by the Dispatch Record renderer below.
	const notifyBackgroundDone = (session: BgSession): void => {
		if (session.notified) return;
		session.notified = true;
		const durMs = (session.doneAt ?? Date.now()) - session.startedAt;
		const out = tailTruncate(session.output, session.maxOutputChars);
		const content =
			`Background session ${session.id} — ${session.status}${session.exitCode != null ? ` (exit ${session.exitCode})` : ""} — ${formatDurationMs(durMs)}\n` +
			`agent: ${session.agent}\n` +
			(out.trim() ? `── output ──\n${out}\n` : "") +
			`\nQuery for full details: dispatch({ sessionId: "${session.id}" })`;
		const details: CompletionDetails = {
			sessionId: session.id,
			agent: session.agent,
			status: session.status,
			exitCode: session.exitCode,
			durationMs: durMs,
		};
		pi.sendMessage(
			{ customType: "sub-dispatch", content, display: true, details },
			{ triggerTurn: true, deliverAs: "followUp" },
		);
		refreshWidget();
	};

	const runBackground = (opts: {
		agent: string;
		executable: string;
		args: string[];
		cwd: string;
		maxOutputChars: number;
		env?: Record<string, string>;
	}): BgSession => {
		const id = generateSessionId(opts.agent);
		const child = spawnDetached(opts.executable, opts.args, opts.cwd, opts.env);
		const session: BgSession = {
			id,
			agent: opts.agent,
			cwd: opts.cwd,
			child,
			output: "",
			exitCode: null,
			status: "running",
			startedAt: Date.now(),
			maxOutputChars: opts.maxOutputChars,
		};
		child.stdout?.on("data", (d) => {
			session.output += d.toString("utf-8");
			if (session.output.length > opts.maxOutputChars) {
				session.output = session.output.slice(-opts.maxOutputChars);
			}
		});
		child.stderr?.on("data", (d) => {
			session.output += d.toString("utf-8");
			if (session.output.length > opts.maxOutputChars) {
				session.output = session.output.slice(-opts.maxOutputChars);
			}
		});
		child.on("error", (err) => {
			session.output += `\n[spawn error] ${err.message}`;
			session.status = "error";
			session.doneAt = Date.now();
			notifyBackgroundDone(session);
		});
		child.on("close", (code) => {
			session.exitCode = code;
			// Keep an explicit kill status; only derive done/error for natural exits.
			if (session.status !== "killed") session.status = code === 0 ? "done" : "error";
			session.doneAt = Date.now();
			notifyBackgroundDone(session);
		});
		bgSessions.set(id, session);
		refreshWidget();
		return session;
	};

	pi.registerTool({
		name: "dispatch",
		label: "Dispatch",
		description:
			"Spawn a sub-agent as a subprocess and collect its output (no interactive overlay). Use for fire-and-forget delegations to a coding agent (pi/codex/claude/cursor or a config-added agent). Foreground (default) waits and returns { exitCode, durationMs, output }; background:true returns a sessionId immediately for later query/kill. Pass an existing sessionId to query (or with kill:true to terminate) a background session.",
		promptSnippet: "Dispatch a sub-agent (pi/codex/claude/cursor/custom) as a subprocess and collect its output",
		parameters: Type.Object({
			agent: Type.Optional(
				Type.String({
					description:
						"Spawning agent name: built-in pi/codex/claude/cursor or a custom key from config.commands. Required for a new dispatch; omit when querying/killing by sessionId.",
				}),
			),
			prompt: Type.Optional(
				Type.String({ description: "Task prompt passed to the sub-agent. Required for a new dispatch." }),
			),
			sessionId: Type.Optional(
				Type.String({ description: "Existing background session id to query, or kill with kill:true." }),
			),
			kill: Type.Optional(Type.Boolean({ description: "With sessionId: terminate the background session." })),
			background: Type.Optional(Type.Boolean({ description: "Return immediately with a sessionId (default false)." })),
			timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default 600)." })),
			reason: Type.Optional(Type.String({ description: "UI label / reason." })),
			model: Type.Optional(Type.String({ description: "Model override injected as --model <value> before the prompt (e.g. deepseek-v4-flash)." })),
			env: Type.Optional(Type.Record(Type.String(), Type.String({ description: "Environment variables for the sub-agent process." }))),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const config = loadConfig();
			const cwd = ctx.cwd;
			const p = params as {
				agent?: string;
				prompt?: string;
				model?: string;
				sessionId?: string;
				kill?: boolean;
				background?: boolean;
				timeout?: number;
				reason?: string;
				env?: Record<string, string>;
			};

			// ── Query / kill an existing background session ──
			if (p.sessionId) {
				const session = bgSessions.get(p.sessionId);
				if (!session) {
					return {
						content: [{ type: "text", text: `Unknown background session: ${p.sessionId}` }],
						isError: true,
						details: { sessionId: p.sessionId },
					};
				}
				if (p.kill) {
					killProcessGroup(session.child);
					session.status = "killed";
					session.output += "\n[killed]";
					session.doneAt = Date.now();
					refreshWidget();
					return {
						content: [{ type: "text", text: `Killed background session ${p.sessionId}.` }],
						details: { sessionId: p.sessionId, status: "killed" },
					};
				}
				return {
					content: [{ type: "text", text: formatSessionStatus(session) }],
					details: {
						sessionId: p.sessionId,
						status: session.status,
						exitCode: session.exitCode,
						output: session.output,
					},
				};
			}

			// ── New dispatch requires agent + prompt ──
			if (!p.agent || !p.prompt) {
				return {
					content: [
						{
							type: "text",
							text: "A new dispatch requires 'agent' and 'prompt' (or pass 'sessionId' to query/kill a background session).",
						},
					],
					isError: true,
					details: {},
				};
			}

			const resolved = resolveCommand(config, p.agent, p.prompt, p.model);
			if (!resolved.ok) {
				return { content: [{ type: "text", text: resolved.error }], isError: true, details: {} };
			}

			const timeoutSec = p.timeout ?? config.defaultTimeoutSec;

			if (p.background) {
				const effectiveCwd = cwd;
				const session = runBackground({
					agent: p.agent,
					executable: resolved.executable,
					args: resolved.args,
					cwd: effectiveCwd,
					maxOutputChars: config.maxOutputChars,
				});
				return {
					content: [
						{
							type: "text",
							text:
								`Dispatched in background (id: ${session.id}).\n` +
								`Query: dispatch({ sessionId: "${session.id}" })\n` +
								`Kill: dispatch({ sessionId: "${session.id}", kill: true })`,
						},
					],
					details: { sessionId: session.id, status: "running", agent: p.agent, background: true },
				};
			}

			// ── Foreground (default): wait and return output ──
			const effectiveCwd = cwd;

			const startedAt = Date.now();
			if (ctx.hasUI) ctx.ui.setStatus("sub-dispatch", `${p.reason ? p.reason + " — " : ""}dispatch ${p.agent} — running…`);
			try {
				const result = await spawnCommand(resolved.executable, resolved.args, {
					cwd: effectiveCwd,
					timeoutMs: timeoutSec * 1000,
					signal,
					maxOutputChars: config.maxOutputChars,
					onOutput: (chunk) => onUpdate?.({ content: [{ type: "text", text: chunk }], details: {} }),
					env: p.env,
				});
				const durationMs = Date.now() - startedAt;
				return {
					content: [
						{
							type: "text",
							text:
								`exitCode: ${result.exitCode ?? "null"} — ${result.ok ? "ok" : "failed"} — ${formatDurationMs(durationMs)}` +
								`\n── output ──\n${result.output}`,
						},
					],
					isError: !result.ok,
					details: { exitCode: result.exitCode, ok: result.ok, durationMs, output: result.output },
				};
			} finally {
				if (ctx.hasUI) ctx.ui.setStatus("sub-dispatch", undefined);
			}
		},
	});

	// ── Dispatch Record renderer: compact completion lines, ctrl+o expands ──
	pi.registerMessageRenderer<CompletionDetails>("sub-dispatch", renderDispatchRecord);

	// ── /dispatch command: pure peek surface (dispatching happens only via
	// the orchestrating agent's tool call — Single Dispatch Entry) ──
	pi.registerCommand("dispatch", {
		description: "Peek a dispatch session's output. Usage: /dispatch [sessionId-substring]",
		handler: async (args, ctx) => {
			const needle = (args ?? "").trim();
			const sessions = orderedSessions();
			if (sessions.length === 0) {
				ctx.ui.notify("No dispatch sessions.", "info");
				return;
			}

			let target: BgSession | undefined;
			if (needle) {
				target = sessions.find((s) => s.id.startsWith(needle));
				if (!target) {
					ctx.ui.notify(`No dispatch session matching "${needle}".`, "error");
					return;
				}
			} else {
				// Always list first, then peek — even for a single session.
				const now = Date.now();
				const labels = sessions.map((s) => {
					const preview = lastOutputLine(s.output);
					const base = sessionSummary(s, now);
					return preview ? `${base} ▏ ${preview.slice(0, 48)}` : base;
				});
				const picked = await ctx.ui.select("Dispatch sessions", labels);
				if (picked == null) return;
				target = sessions[labels.indexOf(picked)];
			}
			if (!target) return;

			if (!ctx.hasUI) {
				ctx.ui.notify("Output peek requires an interactive session.", "error");
				return;
			}
			const sessionId = target.id;
			void openOutputPeek({
				ui: ctx.ui,
				getSession: () => bgSessions.get(sessionId),
				autoClose: target.status === "running",
			});
		},
	});

	// ── Cleanup background sessions on shutdown ──
	pi.on("session_shutdown", (_event, ctx) => {
		for (const session of bgSessions.values()) {
			killProcessGroup(session.child);
		}
		bgSessions.clear();
		widgetHandle?.dispose();
		widgetHandle = null;
		if (ctx.hasUI) ctx.ui.setWidget("sub-dispatch", undefined);
	});
}

function spawnDetached(executable: string, args: string[], cwd: string, env?: Record<string, string>): ChildProcess {
	return spawn(executable, args, { cwd, stdio: ["ignore", "pipe", "pipe"], detached: true, env: env ? { ...process.env, ...env } : undefined });
}

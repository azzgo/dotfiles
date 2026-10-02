/**
 * sub-dispatch — a minimal sub-agent dispatch extension for pi, trimmed from
 * pi-interactive-shell (v0.15.0). Single use-case: run a coding agent as an
 * in-process sub-session (`dispatch` mode) and collect its output. No PTY /
 * interactive input — read-only visibility only (see ui.ts).
 *
 * Files:
 *   index.ts   entry: `dispatch` tool, `/dispatch` peek + gc commands,
 *              background session table, widget/renderer wiring
 *   runner.ts  core engine: config, in-process sub-session run, forensics log
 *   ui.ts      visual surfaces: Dispatch Overview widget, Output Peek viewer,
 *              Dispatch Record renderer
 *   config.json  defaultTimeoutSec
 *
 * Bridge hook (v2b, reserved): code-mode imports `runDispatch` programmatically
 * from `../sub-dispatch/runner.ts` for its own execute.
 *
 * Visibility layers (all program-side, zero tokens):
 *   Dispatch Overview — widget: running sessions, live elapsed, 5s settle linger
 *   Output Peek       — `/dispatch` → read-only scrollable output overlay
 *   Dispatch Record   — completion message: one compact line, ctrl+o expands
 */
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
	generateSessionId,
	gcLogs,
	loadConfig,
	logDir,
	resolveAgent,
	runSession,
	tailTruncate,
	type DispatchStatus,
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

/** Cap on the completion notification's output tail. */
const NOTIFICATION_OUTPUT_CHARS = 20000;

interface BgSession {
	id: string;
	agent: string;
	cwd: string;
	agentSession: AgentSession | null;
	abort: AbortController;
	output: string;
	exitCode: number | null;
	status: DispatchStatus;
	startedAt: number;
	doneAt?: number;
	logFile?: string;
	/** Output truncation cap applied to completion notifications. */
	maxOutputChars: number;
	/** Guard so completion is notified exactly once. */
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
	const out = tailTruncate(s.output, NOTIFICATION_OUTPUT_CHARS);
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
		prompt: string;
		cwd: string;
		model?: string;
		timeoutSec: number;
		modelRegistry: Parameters<typeof runSession>[0]["modelRegistry"];
	}): BgSession => {
		const id = generateSessionId(opts.agent);
		const abort = new AbortController();
		const session: BgSession = {
			id,
			agent: opts.agent,
			cwd: opts.cwd,
			agentSession: null,
			abort,
			output: "",
			exitCode: null,
			status: "running",
			startedAt: Date.now(),
			maxOutputChars: NOTIFICATION_OUTPUT_CHARS,
		};
		bgSessions.set(id, session);
		refreshWidget();

		void (async () => {
			try {
				const result = await runSession({
					agent: opts.agent,
					prompt: opts.prompt,
					cwd: opts.cwd,
					model: opts.model,
					timeoutSec: opts.timeoutSec,
					signal: abort.signal,
					modelRegistry: opts.modelRegistry,
					onSession: (created) => {
						session.agentSession = created;
					},
					onOutput: (chunk) => {
						session.output = (session.output + chunk).slice(-session.maxOutputChars);
						refreshWidget();
					},
				});
				session.output = result.output;
				session.exitCode = result.exitCode;
				session.logFile = result.logFile;
				// Keep an explicit kill status; only derive done/error for natural exits.
				session.status = session.status === "killed" ? "killed" : result.status;
			} catch (err) {
				session.output += `${session.output ? "\n" : ""}[session error] ${err instanceof Error ? err.message : String(err)}`;
				session.status = "error";
				session.exitCode = 1;
			} finally {
				session.doneAt = Date.now();
				notifyBackgroundDone(session);
			}
		})();

		return session;
	};

	pi.registerTool({
		name: "dispatch",
		label: "Dispatch",
		description:
			"Run a sub-agent (pi) as an in-process session and collect its output. Foreground (default) waits and returns { exitCode, durationMs, output }; background:true returns a sessionId immediately. Pass an existing sessionId to query it, plus kill:true to abort it.",
		promptSnippet: "Dispatch a sub-agent (pi) in-process and collect its output",
		parameters: Type.Object({
			agent: Type.Optional(Type.String({ description: "Agent name; required for a new dispatch, omit when using sessionId." })),
			prompt: Type.Optional(Type.String({ description: "Task prompt; required for a new dispatch." })),
			sessionId: Type.Optional(Type.String({ description: "Background session id to query (or kill with kill:true)." })),
			kill: Type.Optional(Type.Boolean()),
			background: Type.Optional(Type.Boolean()),
			timeout: Type.Optional(Type.Number({ description: "Seconds (default 600)." })),
			reason: Type.Optional(Type.String({ description: "UI label." })),
			model: Type.Optional(Type.String({ description: "Model override passed to the sub-session." })),
		}),
		annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
		outputSchema: Type.Object({
			sessionId: Type.Optional(Type.String()),
			status: Type.Optional(Type.String()),
			exitCode: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
			durationMs: Type.Optional(Type.Number()),
			output: Type.Optional(Type.String()),
			complete: Type.Optional(Type.Boolean()),
			logFile: Type.Optional(Type.String()),
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
			};

			// ── Query / kill an existing background session ──
			if (p.sessionId) {
				const session = bgSessions.get(p.sessionId);
				if (!session) {
					return {
						content: [{ type: "text", text: `Unknown background session: ${p.sessionId}` }],
						isError: true,
						details: { sessionId: p.sessionId },
						structuredContent: { sessionId: p.sessionId, complete: false },
					};
				}
				if (p.kill) {
					session.abort.abort();
					void session.agentSession?.abort().catch(() => undefined);
					session.status = "killed";
					session.output += `${session.output ? "\n" : ""}[killed]`;
					session.doneAt = Date.now();
					refreshWidget();
					return {
						content: [{ type: "text", text: `Killed background session ${p.sessionId}.` }],
						details: { sessionId: p.sessionId, status: "killed", logFile: session.logFile },
						structuredContent: {
							sessionId: p.sessionId,
							status: "killed",
							durationMs: session.doneAt - session.startedAt,
							exitCode: session.exitCode,
							output: session.output,
							complete: true,
						},
					};
				}
				return {
					content: [{ type: "text", text: formatSessionStatus(session) }],
					details: {
						sessionId: p.sessionId,
						status: session.status,
						exitCode: session.exitCode,
						output: session.output,
						logFile: session.logFile,
					},
					structuredContent: {
						sessionId: p.sessionId,
						status: session.status,
						exitCode: session.exitCode,
						durationMs: (session.doneAt ?? Date.now()) - session.startedAt,
						output: session.output,
						complete: session.status !== "running",
						logFile: session.logFile,
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
					structuredContent: { complete: false },
				};
			}

			const resolved = resolveAgent(p.agent);
			if (!resolved.ok) {
				return {
					content: [{ type: "text", text: resolved.error }],
					isError: true,
					details: {},
					structuredContent: { complete: false },
				};
			}

			const timeoutSec = p.timeout ?? config.defaultTimeoutSec;

			if (p.background) {
				const session = runBackground({
					agent: resolved.agent,
					prompt: p.prompt,
					cwd,
					model: p.model,
					timeoutSec,
					modelRegistry: ctx.modelRegistry,
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
					details: { sessionId: session.id, status: "running", agent: resolved.agent, background: true },
					structuredContent: { sessionId: session.id, status: "running", complete: false },
				};
			}

			// ── Foreground (default): wait and return output ──
			const startedAt = Date.now();
			if (ctx.hasUI) ctx.ui.setStatus("sub-dispatch", `${p.reason ? p.reason + " — " : ""}dispatch ${resolved.agent} — running…`);
			try {
				const result = await runSession({
					agent: resolved.agent,
					prompt: p.prompt,
					cwd,
					model: p.model,
					timeoutSec,
					signal,
					modelRegistry: ctx.modelRegistry,
					onOutput: (chunk) => onUpdate?.({ content: [{ type: "text", text: chunk }], details: {} }),
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
					details: { exitCode: result.exitCode, ok: result.ok, durationMs, output: result.output, logFile: result.logFile },
					structuredContent: {
						exitCode: result.exitCode,
						durationMs,
						output: result.output,
						complete: true,
						logFile: result.logFile,
					},
				};
			} finally {
				if (ctx.hasUI) ctx.ui.setStatus("sub-dispatch", undefined);
			}
		},
	});

	// ── Dispatch Record renderer: compact completion lines, ctrl+o expands ──
	pi.registerMessageRenderer<CompletionDetails>("sub-dispatch", renderDispatchRecord);

	// ── /dispatch command: pure peek surface (dispatching happens only via
	// the orchestrating agent's tool call — Single Dispatch Entry) plus log gc ──
	pi.registerCommand("dispatch", {
		description: "Peek a dispatch session's output, or gc forensic logs. Usage: /dispatch [sessionId-substring | gc [N]]",
		handler: async (args, ctx) => {
			const trimmed = (args ?? "").trim();
			if (trimmed === "gc" || trimmed.startsWith("gc ")) {
				const parsed = Number.parseInt(trimmed.slice(2).trim(), 10);
				const keep = Number.isFinite(parsed) && parsed >= 0 ? parsed : 50;
				const result = await gcLogs(keep);
				const lines = [
					`sub-dispatch logs: deleted ${result.deleted.length}, kept ${result.kept} (${logDir()})`,
					...result.deleted.map((name) => `  − ${name}`),
				];
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}
			const needle = trimmed;
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
			session.abort.abort();
			void session.agentSession?.abort().catch(() => undefined);
		}
		bgSessions.clear();
		widgetHandle?.dispose();
		widgetHandle = null;
		if (ctx.hasUI) ctx.ui.setWidget("sub-dispatch", undefined);
	});
}

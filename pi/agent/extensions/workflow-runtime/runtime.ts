/**
 * workflow-runtime — orchestration skeleton for Workflows (ADR 0006).
 *
 * Books state, suggests flow, notifies. NEVER executes node work, NEVER
 * judges quality, NEVER mutates state from the model.
 *
 * Architecture invariants (see README.md):
 * 1. No engine: Run advances only while a Driving Session acts; state = files.
 * 2. The model never flips state: flips happen in /wf command handlers or in
 *    the sub-dispatch settle callback below.
 * 3. Notification-driven: Auto Nodes run via `dispatch` (background: true)
 *    with reason `wf-<runId>-node-<nodeId>`; the settle notification
 *    (customType "sub-dispatch" → message_end) flips state deterministically.
 * 4. auto→auto cascades without asking; auto→human prompts a brief + question.
 * 5. Global zero-exclusivity: many non-terminal Runs; per-session Focus pointer.
 * 6. Cold start injects nothing: a dismissible Run picker only.
 * 7. Visibility is program-side: widget lines, zero tokens.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createWfCommands, wfHelpText } from "./commands";
import { DISPATCH_REASON_PREFIX, MESSAGE_TYPE_SUB_DISPATCH, MESSAGE_TYPE_WF_PROMPT } from "./types";
import type { Run } from "./types";
import { listRuns, nonTerminalRuns, readLastFocus, readRun, writeRun } from "./state";
import { buildRunWidgetLines } from "./ui";

/** In-flight dispatch correlation: dispatch session id → reason (wf-<runId>-node-<nodeId>). */
const dispatchReasonBySession = new Map<string, string>();

interface DispatchDetails {
	sessionId?: string;
	status?: string;
	exitCode?: number | null;
	[key: string]: unknown;
}

/** Match a `wf-<runId>-node-<nodeId>` reason against known runs/nodes. */
function matchReason(cwd: string, reason: string): { run: Run; nodeId: string } | undefined {
	if (!reason.startsWith(DISPATCH_REASON_PREFIX)) return undefined;
	for (const run of listRuns(cwd)) {
		for (const node of run.nodes) {
			if (reason === `${DISPATCH_REASON_PREFIX}${run.id}-node-${node.id}`) return { run, nodeId: node.id };
		}
	}
	return undefined;
}

export default function workflowRuntime(pi: ExtensionAPI): void {
	let focusRunId: string | null = null;
	let commands: ReturnType<typeof createWfCommands> | null = null;

	const getCommands = (ctx: ExtensionContext): ReturnType<typeof createWfCommands> => {
		if (!commands) {
			commands = createWfCommands({
				cwd: ctx.cwd,
				sendPrompt: (content) =>
					pi.sendMessage({ customType: MESSAGE_TYPE_WF_PROMPT, content, display: false }, { triggerTurn: true, deliverAs: "followUp" }),
				notify: (text, level) => ctx.ui.notify(text, level ?? "info"),
				pickRun: (title, items) => ctx.ui.select(title, items).then((v) => v ?? null),
				now: () => new Date().toISOString(),
			});
		}
		return commands;
	};

	const refreshWidget = (ctx: ExtensionContext): void => {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget("workflow-runtime", buildRunWidgetLines(ctx.cwd, focusRunId), { placement: "aboveEditor" });
	};

	// ---- /wf command family ----

	pi.registerCommand("wf", {
		description:
			"Workflow runtime: orchestration skeleton (new / start / list / status / next / done / skip / insert / replan / focus / switch / save-as-template / cancel).",
		handler: async (args, ctx) => {
			const wf = getCommands(ctx);
			const trimmed = args.trim();
			const [sub, ...rest] = trimmed.split(/\s+/);
			const restStr = rest.join(" ");
			switch (sub) {
				case "":
					await wf.pickRunCmd(readLastFocus(ctx.cwd));
					break;
				case "new":
					wf.newDefinition(restStr);
					break;
				case "start": {
					const [name, ...titleParts] = rest;
					if (!name) {
						ctx.ui.notify("Usage: /wf start <definition-name> [title]", "warning");
						break;
					}
					wf.startRun(name, titleParts.join(" "));
					break;
				}
				case "list":
					wf.listCmd();
					break;
				case "status":
					wf.statusCmd(rest[0]);
					break;
				case "next":
					wf.nextCmd(rest[0]);
					break;
				case "done":
					wf.doneCmd(restStr);
					break;
				case "skip": {
					const [nodeId, ...reasonParts] = rest;
					if (!nodeId || reasonParts.length === 0) {
						ctx.ui.notify("Usage: /wf skip <node-id> <reason> (reason required)", "warning");
						break;
					}
					wf.skipCmd(nodeId, reasonParts.join(" "));
					break;
				}
				case "insert": {
					const [after, ...titleParts] = rest;
					if (!after || titleParts.length === 0) {
						ctx.ui.notify("Usage: /wf insert <after-node-id> <title> [auto|human]", "warning");
						break;
					}
					wf.insertCmd(after, titleParts.join(" "));
					break;
				}
				case "replan":
					wf.replanCmd(restStr);
					break;
				case "focus":
					if (!rest[0]) {
						ctx.ui.notify("Usage: /wf focus <run-id>", "warning");
						break;
					}
					wf.focusCmd(rest[0]);
					break;
				case "switch":
					await wf.pickRunCmd(readLastFocus(ctx.cwd));
					break;
				case "save-as-template":
					wf.saveAsTemplateCmd(rest[0]);
					break;
				case "cancel":
					wf.cancelCmd(rest[0]);
					break;
				case "help":
					ctx.ui.notify(wfHelpText(), "info");
					break;
				default:
					ctx.ui.notify(`Unknown /wf subcommand "${sub}".\n\n${wfHelpText()}`, "warning");
			}
			// keep the session Focus mirror in sync for the widget / settle routing
			focusRunId = wf.getFocus() ?? focusRunId;
			refreshWidget(ctx);
		},
	});

	// ---- dispatch correlation: record reason ↔ sessionId on the dispatch call ----

	const pendingReasonByToolCall = new Map<string, string>();

	pi.on("tool_call", async (event) => {
		if (event.toolName !== "dispatch") return;
		const input = event.input as { background?: boolean; reason?: string } | undefined;
		if (input?.background === true && typeof input.reason === "string" && input.reason.startsWith(DISPATCH_REASON_PREFIX)) {
			pendingReasonByToolCall.set(event.toolCallId, input.reason);
		}
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "dispatch") return;
		const reason = pendingReasonByToolCall.get(event.toolCallId);
		pendingReasonByToolCall.delete(event.toolCallId);
		if (!reason) return;
		const details = (event.result as { details?: DispatchDetails } | undefined)?.details;
		const sessionId = typeof details?.sessionId === "string" ? details.sessionId : undefined;
		if (!sessionId) return;
		dispatchReasonBySession.set(sessionId, reason);
		// persist the correlation on the node so a later settle (even in a later
		// session) can be attributed
		const match = matchReason(ctx.cwd, reason);
		if (match) {
			const fresh = readRun(ctx.cwd, match.run.id);
			const node = fresh?.nodes.find((n) => n.id === match.nodeId);
			if (fresh && node) {
				node.sessionId = sessionId;
				writeRun(ctx.cwd, fresh);
			}
		}
	});

	// ---- settle: sub-dispatch completion notifications flip state deterministically ----

	pi.on("message_end", async (event, ctx) => {
		const message = event.message as
			| { role?: string; customType?: string; details?: DispatchDetails; content?: unknown }
			| undefined;
		if (!message || message.role !== "custom" || message.customType !== MESSAGE_TYPE_SUB_DISPATCH) return;
		const details = message.details ?? {};
		const sessionId = typeof details.sessionId === "string" ? details.sessionId : undefined;
		if (!sessionId) return;
		const status = typeof details.status === "string" ? details.status : "unknown";
		const exitCode = typeof details.exitCode === "number" ? details.exitCode : null;

		// correlate: this session's live map first…
		let reason = dispatchReasonBySession.get(sessionId);
		// …then fall back to run state (cross-session settle: a fresh Driving
		// Session receives the notification for a dispatch recorded on disk)
		if (!reason) {
			for (const run of nonTerminalRuns(ctx.cwd)) {
				const node = run.nodes.find((n) => n.type === "auto" && n.sessionId === sessionId && (n.status === "active" || n.status === "failed"));
				if (node) {
					reason = `${DISPATCH_REASON_PREFIX}${run.id}-node-${node.id}`;
					break;
				}
			}
		}
		dispatchReasonBySession.delete(sessionId);
		if (!reason) return;

		const match = matchReason(ctx.cwd, reason);
		if (!match) return;
		const fresh = readRun(ctx.cwd, match.run.id);
		if (!fresh) return;
		getCommands(ctx).settle(sessionId, status, exitCode, fresh);
		focusRunId = getCommands(ctx).getFocus() ?? focusRunId;
		refreshWidget(ctx);
		if (ctx.hasUI) {
			const ok = status === "done" && (exitCode === 0 || exitCode === null);
			ctx.ui.notify(`wf ▏ ${match.run.id} · ${match.nodeId} → ${ok ? "done" : "failed"} (exit ${exitCode ?? "n/a"})`, ok ? "info" : "warning");
		}
	});

	// ---- cold start: dismissible Run picker (injects NOTHING on dismissal) ----

	pi.on("session_start", async (event, ctx) => {
		focusRunId = null;
		commands = null;
		refreshWidget(ctx);
		const open = nonTerminalRuns(ctx.cwd);
		if (open.length === 0 || !ctx.hasUI) return;
		// preselect only when the session itself points at a run (resumed session)
		// or the last-interacted run — the picker stays fully dismissible
		const preselect = readLastFocus(ctx.cwd);
		void event.reason;
		await getCommands(ctx).pickRunCmd(preselect);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		dispatchReasonBySession.clear();
		pendingReasonByToolCall.clear();
		if (ctx.hasUI) ctx.ui.setWidget("workflow-runtime", undefined);
	});
}

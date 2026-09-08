/**
 * /wf command handlers. Every Run/Node state flip lives here (or in the
 * settle callback) — deterministic validation, readable errors, never silent.
 * Handlers are pi-agnostic: side effects (prompt sending, UI notify, picker)
 * are injected via WfDeps.
 */
import fs from "node:fs";
import path from "node:path";
import {
	activeNode,
	appendLog,
	clearLastFocus,
	definitionPath,
	findDefinition,
	globalPatternsDir,
	listRuns,
	makeRunId,
	nonTerminalRuns,
	readLastFocus,
	readLogTail,
	readRun,
	removeRun,
	resolveRunRef,
	toRunNode,
	writeLastFocus,
	writeRun,
} from "./state";
import {
	buildAutoDispatchPrompt,
	buildHumanNodePrompt,
	buildNewDefinitionPrompt,
	buildReplanPrompt,
} from "./prompts";
import { parseDefinition } from "./definition";
import {
	activateNode,
	applyCancel,
	applyDone,
	applyInsert,
	applyReplan,
	applySettle,
	applySkip,
	type SettleOutcome,
} from "./transitions";
import { DEFINITIONS_DIR, MESSAGE_TYPE_WF_PROMPT, TERMINAL_RUN_STATUSES, type Run, type RunNode } from "./types";

export interface WfDeps {
	cwd: string;
	/** Send an instruction prompt to the driving model (triggerTurn). */
	sendPrompt(content: string): void;
	/** Program-side notification line (zero tokens). */
	notify(text: string, level?: "info" | "warning" | "error"): void;
	/** Dismissible Run picker; resolves null when dismissed (Esc). Preselection is conveyed by a "◀ " item prefix. */
	pickRun(title: string, items: string[]): Promise<string | null>;
	/** Override for tests. */
	now(): string;
	/** Global pattern library dir (overridable for tests). */
	globalPatternsDir?: string;
}

/** Handle a state-changing outcome: log, persist, and route the next prompt. */
function runOutcome(deps: WfDeps, run: Run, outcome: SettleOutcome, context?: string): void {
	const at = deps.now();
	for (const line of outcome.logLines) appendLog(deps.cwd, run.id, line.kind, line.text, at);
	writeRun(deps.cwd, run);
	writeLastFocus(deps.cwd, run.id);
	switch (outcome.next.kind) {
		case "cascade-auto":
			deps.sendPrompt(buildAutoDispatchPrompt(run, outcome.next.node, context));
			deps.notify(`${run.id}: ${outcome.next.node.id} active (auto node — dispatch prompt queued)`, "info");
			break;
		case "cascade-human":
			deps.sendPrompt(buildHumanNodePrompt(run, outcome.next.node, context));
			deps.notify(`${run.id}: ${outcome.next.node.id} active (human node — brief queued)`, "info");
			break;
		case "run-complete":
			deps.notify(`${run.id}: workflow complete 🎉 (${run.nodes.length} nodes)`, "info");
			break;
		case "node-failed":
			deps.sendPrompt(
				[
					`[WF NODE FAILED run=${run.id} node=${outcome.next.node.id}]`,
					`The dispatched sub-agent for node ${outcome.next.node.id} did not succeed (see the sub-dispatch notification above for status/output).`,
					"Inform the user concisely what failed based on the output tail, then STOP. The user decides: `/wf next` re-dispatches the node, `/wf skip <node-id> <reason>` skips it, `/wf replan` reshapes the Spine, `/wf cancel` abandons the run.",
					"Do NOT retry on your own, do NOT touch .pi/workflows/.",
				].join("\n"),
			);
			deps.notify(`${run.id}: node ${outcome.next.node.id} FAILED — decision left to the user`, "warning");
			break;
		case "none":
			deps.notify(`${run.id}: updated`, "info");
			break;
	}
}

export function createWfCommands(deps: WfDeps) {
	const at = (): string => deps.now();
	/** Session Focus pointer (defaults to the last interacted run). */
	let focusRunId: string | null = null;

	function setFocus(run: Run): void {
		focusRunId = run.id;
		writeLastFocus(deps.cwd, run.id);
	}

	function requireFocus(): { run: Run } | { error: string } {
		const runs = nonTerminalRuns(deps.cwd);
		if (focusRunId) {
			const run = readRun(deps.cwd, focusRunId);
			if (run && !TERMINAL_RUN_STATUSES.includes(run.status)) return { run };
			if (run) {
				// Stale Focus on a finished run: release it and say so directly
				// instead of letting each handler trip over its own status check.
				focusRunId = null;
				return {
					error: `run ${run.id} is already ${run.status} — nothing to advance. Pick another with /wf switch (finished runs can be 🗑-removed from the picker).`,
				};
			}
		}
		if (runs.length === 1) {
			focusRunId = runs[0]!.id;
			return { run: runs[0]! };
		}
		if (runs.length === 0) return { error: "no non-terminal runs — start one with /wf start <definition-name>" };
		return { error: `${runs.length} non-terminal runs and no Focus in this session — run /wf switch to pick one (or /wf next <run-id>)` };
	}

	function resolveNodeRef(run: Run, ref: string): RunNode | undefined {
		return run.nodes.find((n) => n.id === ref) ?? run.nodes.find((n) => n.id.startsWith(ref));
	}

	// ---- /wf (bare) & /wf switch ----

/**
	 * Run picker (`/wf`, `/wf switch`, cold start). Esc dismisses with zero
	 * side effects; a run line sets Focus; the "🗑 remove" lines (terminal runs
	 * only) delete the Run directory after an explicit confirm — a purely
	 * manual hygiene action, never offered to the model or auto-run.
	 */
	async function pickRunCmd(preselectRunId?: string): Promise<void> {
		// re-opens after a removal; falls through once nothing remains
		for (;;) {
			const runs = listRuns(deps.cwd);
			if (runs.length === 0) {
				deps.notify("No runs exist yet. Start one with /wf start <definition-name> (or draft with /wf new <topic>).", "info");
				return;
			}
			const open = runs.filter((r) => !TERMINAL_RUN_STATUSES.includes(r.status));
			// the picker is the cleanup entry: list ALL terminal runs, no cap (/wf list keeps its tail view)
			const terminal = runs.filter((r) => TERMINAL_RUN_STATUSES.includes(r.status));

			interface EntryAction {
				run?: Run;
				remove?: boolean;
				removeable?: boolean; // terminal row itself: picking it asks if you meant remove
			}
			const items: string[] = [];
			const actions: EntryAction[] = [];
			const add = (item: string, action: EntryAction): void => void (items.push(item), actions.push(action));

			for (const r of open) {
				const node = activeNode(r) ?? r.nodes.find((n) => n.status === "failed");
				const pre = preselectRunId === r.id ? "◀ " : "  ";
				add(`${pre}${r.id} · ${r.title} · ${node ? `${node.id} (${node.status})` : "no active node"}`, { run: r });
			}
			if (terminal.length > 0) {
				add("── archived (done/cancelled — select 🗑 to delete the run) ──", {});
				for (const r of terminal) {
					add(`   ${r.id} · ${r.title} [${r.status}]`, { run: r, removeable: true });
					add(`🗑 remove ${r.id} · ${r.title}`, { run: r, remove: true });
				}
			}
			const picked = await deps.pickRun("Workflow runs (Esc = do nothing)", items);
			if (picked == null) return; // dismissed: inject NOTHING, change NOTHING
			const action = actions[items.indexOf(picked)];
			if (!action) return;
			// terminal info row: explain that only the 🗑 row removes
			if (action.removeable && !action.remove) {
				deps.notify(`${action.run!.id} is ${action.run!.status}. To delete it from this project, pick its “🗑 remove” row.`, "info");
				continue;
			}
			if (action.remove) {
				const run = action.run!;
				const sure = await deps.pickRun(`Remove ${run.id}? This deletes its run state and progress log (the Definition file is kept).`, [
					`Yes, remove ${run.id}`,
					`Cancel`,
				]);
				if (sure == null || sure.startsWith("Cancel")) return;
				removeRun(deps.cwd, run.id);
				if (focusRunId === run.id) focusRunId = null;
				if (readLastFocus(deps.cwd) === run.id) clearLastFocus(deps.cwd);
				deps.notify(`Removed run ${run.id} (run.json + progress.md deleted; Definition kept).`, "info");
				preselectRunId = undefined;
				continue; // refresh the picker
			}

			if (action.run) {
				setFocus(action.run);
				deps.notify(`Focus: ${action.run.id}`, "info");
			}
			return;
		}
	}

	// ---- /wf new <topic> ----

	function newDefinition(topic: string): void {
		const clean = topic.trim();
		if (!clean) {
			deps.notify("Usage: /wf new <topic>", "warning");
			return;
		}
		deps.sendPrompt(buildNewDefinitionPrompt(clean, path.join(deps.cwd, DEFINITIONS_DIR)));
		deps.notify("Definition drafting prompt queued — the model writes the file, you review it, then /wf start <name>.", "info");
	}

	// ---- /wf start <definition-name> [title] ----

	function startRun(name: string, title?: string): void {
		const cleanName = name.trim();
		if (!cleanName) {
			deps.notify("Usage: /wf start <definition-name> [title]", "warning");
			return;
		}
		const found = findDefinition(deps.cwd, cleanName, deps.globalPatternsDir);
		if ("error" in found) {
			deps.notify(found.error, "warning");
			return;
		}
		const { definition, from, file } = found;
		const doc = fs.readFileSync(file, "utf8");
		const reparse = parseDefinition(doc, file);
		if (!reparse.definition) {
			deps.notify(`Definition "${cleanName}" violates the format contract:\n- ${reparse.errors.join("\n- ")}`, "error");
			return;
		}
		if (from === "global") {
			// Pattern → Definition: copy into the project (the Run's working copy).
			fs.mkdirSync(path.dirname(definitionPath(deps.cwd, cleanName)), { recursive: true });
			fs.copyFileSync(file, definitionPath(deps.cwd, cleanName));
		}
		const existing = listRuns(deps.cwd).map((r) => r.id);
		const runId = makeRunId(definition.name, new Date(at()), existing);
		const run: Run = {
			id: runId,
			title: title?.trim() || definition.description,
			definitionName: definition.name,
			createdAt: at(),
			updatedAt: at(),
			status: "active",
			nodes: toRunNode(definition),
			activeNodeId: definition.nodes[0]!.id,
		};
		appendLog(deps.cwd, runId, "run", `started from definition "${definition.name}" (${from}) — ${definition.nodes.length} nodes`, at());
		writeRun(deps.cwd, run);
		setFocus(run);
		deps.notify(`Started run ${runId} (focus set)`, "info");
		runOutcome(deps, run, {
			run,
			applied: true,
			logLines: [],
			next: definition.nodes[0]!.type === "auto" ? { kind: "cascade-auto", node: run.nodes[0]! } : { kind: "cascade-human", node: run.nodes[0]! },
		});
	}

	// ---- /wf list ----

	function listCmd(): void {
		const runs = listRuns(deps.cwd);
		if (runs.length === 0) {
			deps.notify("No runs exist yet.", "info");
			return;
		}
		const open = runs.filter((r) => r.status === "active");
		const terminal = runs.filter((r) => r.status !== "active").slice(-5);
		const lines = [
			`Non-terminal runs (${open.length}):`,
			...open.map((r) => {
				const node = activeNode(r) ?? r.nodes.find((n) => n.status === "failed");
				return `  ${r.id === focusRunId ? "◀ " : "  "}${r.id} · ${r.title} · ${node ? `${node.id} (${node.status}, ${node.type})` : "no active node"}`;
			}),
			...(terminal.length > 0 ? ["Recently terminal (archive):", ...terminal.map((r) => `  ${r.id} · ${r.title} [${r.status}]`)] : []),
		];
		deps.notify(lines.join("\n"), "info");
	}

	// ---- /wf status [<run-id>] ----

	function statusCmd(runRef?: string): void {
		let run: Run | undefined;
		if (runRef?.trim()) {
			const res = resolveRunRef(deps.cwd, runRef.trim());
			if ("error" in res && res.error) {
				deps.notify(res.error, "warning");
				return;
			}
			run = res.run;
		} else {
			const focus = requireFocus();
			if ("error" in focus) {
				deps.notify(focus.error, "warning");
				return;
			}
			run = focus.run;
		}
		if (!run) return;
		const lines = [
			`Run ${run.id}${run.id === focusRunId ? " (focus)" : ""} — ${run.title} [${run.status}]`,
			`Definition: ${run.definitionName} · created ${run.createdAt}${run.completedAt ? ` · completed ${run.completedAt}` : ""}`,
			"Nodes:",
			...run.nodes.map((n) => {
				const mark = n.id === run.activeNodeId ? "▶" : { pending: "·", done: "✓", skipped: "○", failed: "✗", cancelled: "×", active: "▶" }[n.status];
				const extra = [n.sessionId ? `session=${n.sessionId}` : "", n.completedAt ? `completed=${n.completedAt}` : "", n.note ? `note=${n.note}` : ""]
					.filter(Boolean)
					.join(", ");
				return `  ${mark} ${n.id} (${n.type}, ${n.status}) — ${n.title}${extra ? `\n      ${extra}` : ""}`;
			}),
		];
		const logTail = readLogTailSafe(run.id);
		if (logTail) lines.push("Progress log (tail):", ...logTail.split("\n").map((l) => `  ${l}`));
		deps.notify(lines.join("\n"), "info");
	}

	function readLogTailSafe(runId: string): string {
		try {
			return readLogTail(deps.cwd, runId, 8);
		} catch {
			return "";
		}
	}

	// ---- /wf next [<run-id>] ----

	function nextCmd(runRef?: string): void {
		let run: Run | undefined;
		if (runRef?.trim()) {
			const res = resolveRunRef(deps.cwd, runRef.trim());
			if ("error" in res && res.error) {
				deps.notify(res.error, "warning");
				return;
			}
			run = res.run;
			if (run) setFocus(run);
		} else {
			const focus = requireFocus();
			if ("error" in focus) {
				deps.notify(focus.error, "warning");
				return;
			}
			run = focus.run;
		}
		if (!run) return;
		if (run.status !== "active") {
			deps.notify(`Run ${run.id} is ${run.status} — nothing to advance.`, "warning");
			return;
		}
		const node = activeNode(run) ?? run.nodes.find((n) => n.status === "failed");
		if (!node) {
			deps.notify(`Run ${run.id} has no active or failed node — try /wf status ${run.id}.`, "warning");
			return;
		}
		if (node.status === "failed") {
			deps.notify(`Re-dispatching failed node ${node.id}...`, "info");
			activateNode(node, at());
			run.activeNodeId = node.id;
			appendLog(deps.cwd, run.id, "node", `${node.id} re-dispatch after failure`, at());
			writeRun(deps.cwd, run);
		}
		if (node.sessionId) {
			deps.notify(
				`Node ${node.id} already has a dispatch in flight (session ${node.sessionId}) — wait for the settle notification, or kill it via the dispatch tool.`,
				"warning",
			);
			return;
		}
		run.activeNodeId = node.id;
		writeRun(deps.cwd, run);
		deps.sendPrompt(node.type === "auto" ? buildAutoDispatchPrompt(run, node) : buildHumanNodePrompt(run, node));
	}

	// ---- /wf done [note] ----

	function doneCmd(note?: string): void {
		const focus = requireFocus();
		if ("error" in focus) {
			deps.notify(focus.error, "warning");
			return;
		}
		const run = focus.run;
		const result = applyDone(run, note, at());
		if (!result.ok) {
			deps.notify(result.error, "warning");
			return;
		}
		runOutcome(deps, run, result.outcome);
	}

	// ---- /wf skip <node-id> <reason> ----

	function skipCmd(nodeRef: string, reason: string): void {
		const focus = requireFocus();
		if ("error" in focus) {
			deps.notify(focus.error, "warning");
			return;
		}
		const run = focus.run;
		const node = resolveNodeRef(run, nodeRef.trim());
		if (!node) {
			deps.notify(`No node matching "${nodeRef}" in run ${run.id} — see /wf status`, "warning");
			return;
		}
		const result = applySkip(run, node.id, reason, at());
		if (!result.ok) {
			deps.notify(result.error, "warning");
			return;
		}
		runOutcome(deps, run, result.outcome);
	}

	// ---- /wf insert <after-node-id> <title> [auto|human] ----

	function insertCmd(afterRef: string, titleAndType: string): void {
		const focus = requireFocus();
		if ("error" in focus) {
			deps.notify(focus.error, "warning");
			return;
		}
		const run = focus.run;
		const node = resolveNodeRef(run, afterRef.trim());
		if (!node) {
			deps.notify(`No node matching "${afterRef}" in run ${run.id} — see /wf status`, "warning");
			return;
		}
		const parts = titleAndType.trim().split(/\s+/);
		let type: "human" | "auto" = "human";
		const last = parts[parts.length - 1]?.toLowerCase();
		if (last === "auto" || last === "human") {
			type = last;
			parts.pop();
		}
		const title = parts.join(" ");
		const result = applyInsert(run, node.id, title, type, at());
		if (!result.ok) {
			deps.notify(result.error, "warning");
			return;
		}
		const activeIdx = run.activeNodeId ? run.nodes.findIndex((n) => n.id === run.activeNodeId) : -1;
		const aheadOfActive = activeIdx >= 0 && run.nodes.indexOf(result.node) < activeIdx;
		appendLog(
			deps.cwd,
			run.id,
			"reroute",
			`insert ${result.node.id} (${type}) after ${node.id}: ${title}${aheadOfActive ? " — ahead of the active node; flow returns to it next" : ""}`,
			at(),
		);
		writeRun(deps.cwd, run);
		deps.notify(
			aheadOfActive
				? `Inserted node ${result.node.id} (${type}) after ${node.id} — it sits ahead of the active node, so the flow returns to it as soon as the current node completes.`
				: `Inserted node ${result.node.id} (${type}) after ${node.id} — it will activate when the Spine reaches it.`,
			"info",
		);
	}

	// ---- /wf replan [confirm [note]] ----

	function replanCmd(args: string): void {
		const focus = requireFocus();
		if ("error" in focus) {
			deps.notify(focus.error, "warning");
			return;
		}
		const run = focus.run;
		const sub = args.trim();
		if (sub === "" || sub === "propose") {
			deps.sendPrompt(buildReplanPrompt(run, definitionPath(deps.cwd, run.definitionName)));
			deps.notify("Replan proposal prompt queued — the model proposes, you approve, then `/wf replan confirm`.", "info");
			return;
		}
		if (sub.startsWith("confirm")) {
			const note = sub.slice("confirm".length).trim();
			const file = definitionPath(deps.cwd, run.definitionName);
			let doc: string;
			try {
				doc = fs.readFileSync(file, "utf8");
			} catch {
				deps.notify(`Cannot read ${file} — the model must rewrite the revised Definition there first (see the /wf replan prompt).`, "warning");
				return;
			}
			const parsed = parseDefinition(doc, file);
			if (!parsed.definition) {
				deps.notify(`Revised Definition does not satisfy the format contract:\n- ${parsed.errors.join("\n- ")}`, "error");
				return;
			}
			if (parsed.definition.name !== run.definitionName) {
				deps.notify(`Revised Definition renamed the workflow ("${parsed.definition.name}" ≠ "${run.definitionName}") — keep the name and re-run /wf replan confirm.`, "warning");
				return;
			}
			appendLog(deps.cwd, run.id, "reroute", `replan proposed${note ? `: ${note}` : ""} — old Spine archived below`, at());
			const diff = applyReplan(run, toRunNode(parsed.definition), at());
			for (const line of diff.logLines) appendLog(deps.cwd, run.id, line.kind, line.text, at());
			writeRun(deps.cwd, run);
			deps.notify(`Replan applied to ${run.id} — old Spine archived in the progress log.`, "info");
			for (const o of diff.orphaned) {
				deps.notify(
					`Replan severed node ${o.nodeId} from run ${run.id} — dispatch session ${o.sessionId} is still running and will settle to a noop. Kill it manually via the Dispatch Overview if unwanted.`,
					"warning",
				);
			}
			if (diff.activated) {
				runOutcome(deps, run, {
					run,
					applied: true,
					logLines: [],
					next: diff.activated.type === "auto" ? { kind: "cascade-auto", node: diff.activated } : { kind: "cascade-human", node: diff.activated },
				});
			} else {
				deps.notify(`${run.id}: replan kept the current pointer (no new node activated).`, "info");
			}
			return;
		}
		deps.notify('Usage: /wf replan [confirm [note]] — bare replan proposes; "confirm" applies the approved revision.', "warning");
	}

	// ---- /wf focus <run-id> ----

	function focusCmd(runRef: string): void {
		const res = resolveRunRef(deps.cwd, runRef.trim());
		if ("error" in res && res.error) {
			deps.notify(res.error, "warning");
			return;
		}
		if (res.run) {
			setFocus(res.run);
			deps.notify(`Focus: ${res.run.id}`, "info");
		}
	}

	// ---- /wf save-as-template <run-id> ----

	function saveAsTemplateCmd(runRef?: string): void {
		const ref = runRef?.trim() || focusRunId;
		if (!ref) {
			deps.notify("Usage: /wf save-as-template <run-id>", "warning");
			return;
		}
		const res = resolveRunRef(deps.cwd, ref);
		if ("error" in res && res.error) {
			deps.notify(res.error, "warning");
			return;
		}
		const run = res.run!;
		const source = definitionPath(deps.cwd, run.definitionName);
		if (!fs.existsSync(source)) {
			deps.notify(`Definition file ${source} is missing — nothing to promote.`, "warning");
			return;
		}
		const globalDir = deps.globalPatternsDir ?? globalPatternsDir();
		fs.mkdirSync(globalDir, { recursive: true });
		const target = `${globalDir}/${run.definitionName}.md`;
		if (fs.existsSync(target)) {
			deps.notify(`Pattern "${run.definitionName}" already exists in the library (${target}) — refusing to overwrite.`, "warning");
			return;
		}
		fs.copyFileSync(source, target);
		appendLog(deps.cwd, run.id, "run", `definition promoted to the global pattern library (${target})`, at());
		deps.notify(`Promoted "${run.definitionName}" to ${target}.`, "info");
	}

	// ---- /wf cancel <run-id> ----

	function cancelCmd(runRef?: string): void {
		let run: Run | undefined;
		if (runRef?.trim()) {
			const res = resolveRunRef(deps.cwd, runRef.trim());
			if ("error" in res && res.error) {
				deps.notify(res.error, "warning");
				return;
			}
			run = res.run;
		} else {
			const focus = requireFocus();
			if ("error" in focus) {
				deps.notify(focus.error, "warning");
				return;
			}
			run = focus.run;
		}
		if (!run) return;
		if (run.status !== "active") {
			deps.notify(`Run ${run.id} is already ${run.status}.`, "info");
			return;
		}
		for (const line of applyCancel(run, at())) appendLog(deps.cwd, run.id, line.kind, line.text, at());
		writeRun(deps.cwd, run);
		if (focusRunId === run.id) focusRunId = null;
		deps.notify(`Run ${run.id} cancelled.`, "info");
	}

	// ---- settle callback (event-driven, from runtime.ts) ----

	function settle(sessionId: string, dispatchStatus: string, exitCode: number | null, matched: Run): void {
		const outcome = applySettle(matched, sessionId, dispatchStatus, exitCode, at());
		if (!outcome.applied) return;
		runOutcome(deps, matched, outcome);
	}

	return {
		pickRunCmd,
		newDefinition,
		startRun,
		listCmd,
		statusCmd,
		nextCmd,
		doneCmd,
		skipCmd,
		insertCmd,
		replanCmd,
		focusCmd,
		saveAsTemplateCmd,
		cancelCmd,
		settle,
		getFocus: (): string | null => focusRunId,
	};
}

export function wfHelpText(): string {
	return [
		"/wf — workflow-runtime: orchestration skeleton only (books state, suggests flow, notifies; never executes node work)",
		"  /wf                          Run picker: set Focus, or 🗑 remove finished runs (Esc = nothing)",
		"  /wf new <topic>              Draft a Definition (capability-aware; you review, then /wf start)",
		"  /wf start <name> [title]     Instantiate a Run from a Definition/Pattern; sets Focus; sends the first node brief",
		"  /wf list                     Non-terminal runs + recent terminal archive",
		"  /wf status [<run-id>]        Run detail (nodes, sessions, progress-log tail)",
		"  /wf next [<run-id>]          Drive the active node: auto → dispatch prompt; human → brief + question",
		"  /wf done [note]              Complete the active HUMAN node (auto nodes settle by themselves)",
		"  /wf skip <node-id> <reason>  Reroute: skip a node (reason required)",
		"  /wf insert <after> <title> [auto|human]  Reroute: insert a node",
		"  /wf replan [confirm [note]]  Propose a revised Spine / apply the approved revision",
		"  /wf focus <run-id>           Point this session's Focus at a run",
		"  /wf switch                   Run picker (= bare /wf)",
		"  /wf save-as-template <run-id>  Promote the Run's Definition to the global pattern library",
		"  /wf cancel <run-id>          Cancel a run (logged; open nodes → cancelled)",
	].join("\n");
}

export { MESSAGE_TYPE_WF_PROMPT, DEFINITIONS_DIR };

/**
 * Prompts sent to the Driving Session's model. The model NEVER mutates
 * workflow state — every prompt is an instruction to act (dispatch a
 * sub-agent, present a brief, draft a Definition) and to stop; state flips
 * happen only in command handlers and the settle callback.
 */
import { DISPATCH_REASON_PREFIX } from "./types";
import type { Run, RunNode } from "./types";
import { activeNode } from "./state";

const FORMAT_CONTRACT = `Format contract (Markdown + YAML frontmatter):
---
name: <kebab-case-name>
description: <one line what this workflow is for>
nodes:
  - id: <kebab-case-id>
    title: <short title>
    type: <human|auto>
    suggest: [<skill-name>, ...]
---
## <node-id>
Brief prose: what this node is for, how to approach it.

done-when: <one line completion criterion>`;

export function dispatchReason(runId: string, nodeId: string): string {
	return `${DISPATCH_REASON_PREFIX}${runId}-node-${nodeId}`;
}

function nodeBriefSection(node: RunNode): string[] {
	return [
		`Node: ${node.id} — ${node.title}`,
		`Type: ${node.type}`,
		`Brief: ${node.brief || "(no brief)"}`,
		`Done-when: ${node.doneWhen || "(not specified)"}`,
		...(node.suggest.length > 0 ? [`Suggested skills: ${node.suggest.join(", ")} (use the /skill: syntax or follow them as you see fit)`] : []),
	];
}

/**
 * Prompt for an Auto Node: the model dispatches the node work to a fresh
 * sub-agent in the background and ends its turn. The settle notification
 * (correlated via the dispatch reason) flips state — the model must NOT
 * report completion itself or touch run state.
 */
export function buildAutoDispatchPrompt(run: Run, node: RunNode, context?: string): string {
	return [
		`[WF AUTO NODE run=${run.id} node=${node.id}]`,
		`Workflow "${run.title}" — the following node is an AUTO node: its work is executed by a fresh sub-agent via the dispatch tool (sub-dispatch extension), never by you directly.`,
		"",
		...nodeBriefSection(node),
		...(context ? ["", context] : []),
		"",
		"Instructions:",
		`1. Compose a SELF-CONTAINED prompt for the sub-agent: include the node brief, the done-when criterion, all context it needs (file paths, constraints), and tell it to end with a concise summary of what it did. Do not reference this conversation.`,
		`2. Fire the dispatch in the background and END YOUR TURN immediately afterwards (End-turn Wait Discipline):`,
		`   dispatch({ agent: <available agent, default "pi">, prompt: "<self-contained prompt>", background: true, reason: "${dispatchReason(run.id, node.id)}" })`,
		`   The reason string is a correlation key — copy it EXACTLY. The runtime will flip the node state automatically when the sub-agent settles; you will be woken by that notification.`,
		`3. Do NOT sleep, poll, or query the session afterwards. Do NOT modify anything under .pi/workflows/. Do NOT announce the node as done — the runtime books state, not you.`,
	].join("\n");
}

/**
 * Prompt for a Human Node: the model presents the brief and asks the user to
 * do the work; the user completes the node with /wf done [note].
 */
export function buildHumanNodePrompt(run: Run, node: RunNode, context?: string): string {
	return [
		`[WF HUMAN NODE run=${run.id} node=${node.id}]`,
		`Workflow "${run.title}" — the following node is a HUMAN node: the user performs the work in their own time. Present it and stop.`,
		"",
		...nodeBriefSection(node),
		...(context ? ["", context] : []),
		"",
		"Instructions:",
		"1. Present the node brief to the user in your own words (concise).",
		"2. Tell the user: when the work is finished, run `/wf done <optional note>` to book completion and move to the next node. Alternatives they may want: `/wf skip <node-id> <reason>`, `/wf replan`, `/wf cancel`.",
		"3. STOP and wait for the user. Do NOT do the node's work yourself, do NOT dispatch a sub-agent for a human node, and do NOT touch anything under .pi/workflows/.",
	].join("\n");
}

/** Flow prompt for the run's current active node (used by /wf start and /wf next). */
export function buildNodeFlowPrompt(run: Run, context?: string): string {
	const node = activeNode(run);
	if (!node) return `[WF run=${run.id}] No active node — run /wf status for details.`;
	if (node.type === "auto") return buildAutoDispatchPrompt(run, node, context);
	return buildHumanNodePrompt(run, node, context);
}

/** Cold-start / bare /wf Run picker header (UI-side only — no context injection). */
export function buildPickerItems(runs: Run[], preselectRunId?: string): { items: string[]; preselect: number | undefined } {
	const items = runs.map((r) => {
		const node = r.nodes.find((n) => n.id === r.activeNodeId);
		return `${r.id} · ${r.title} · node ${node ? `${node.id} (${node.status})` : "?"} [${r.status}]`;
	});
	const preselect = preselectRunId ? runs.findIndex((r) => r.id === preselectRunId) : -1;
	return { items, preselect: preselect >= 0 ? preselect : undefined };
}

/** Prompt for /wf new: draft a Definition using actually-available skills. */
export function buildNewDefinitionPrompt(topic: string, projectDefinitionsDir: string): string {
	return [
		`[WF NEW definition topic="${topic}"]`,
		`Draft a workflow Definition for the topic above and write it to ${projectDefinitionsDir}/<name>.md (create the directory if needed).`,
		"",
		FORMAT_CONTRACT,
		"",
		"Rules:",
		"- Capability-Aware: `suggest` arrays must reference skills/sub-agents that are ACTUALLY available in this environment — check which skills you can see (your own skill list) before naming them; use short names only (no paths, no /skill: syntax). Empty arrays are fine.",
		"- The Spine is LINEAR — no branches, no edges. Roughly 3-6 nodes; node-count guidance lives in the pattern, it is not enforced.",
		"- `type` per node: `auto` = a fresh sub-agent can execute it end-to-end; `human` = the user does the work (grilling, review, wayfinding, judgment calls).",
		"- Every node body needs exactly one `done-when:` line — a verifiable completion criterion.",
		"- Write the file, then STOP. Tell the user to review/edit the file and run `/wf start <name> [title]` when satisfied. Do NOT start a run yourself and do NOT touch .pi/workflows/runs/.",
	].join("\n");
}

/** Prompt for /wf replan: propose a revised Spine (AI-proposed, human-approved). */
export function buildReplanPrompt(run: Run, definitionsFile: string): string {
	const nodeStates = run.nodes.map((n) => `- ${n.id} (${n.type}) — ${n.status}: ${n.title}`).join("\n");
	return [
		`[WF REPLAN run=${run.id}]`,
		`The user wants a revised Spine for workflow "${run.title}". Read the current state first:`,
		`- Run state: .pi/workflows/runs/${run.id}/run.json`,
		`- Progress log: .pi/workflows/runs/${run.id}/progress.md`,
		`- Definition file: ${definitionsFile}`,
		"",
		"Current Spine and node states:",
		nodeStates,
		"",
		"Instructions:",
		"1. Propose a revised LINEAR Spine based on actual progress: keep/complete done nodes as-is, drop what became irrelevant, reshape what remains. Explain the delta briefly.",
		"2. Present the proposal to the user and WAIT for approval. Do not edit anything yet.",
		"3. If the user approves, rewrite the Definition file above with the revised nodes (same format contract; keep the same definition name), then tell the user to run `/wf replan confirm [note]` to apply it.",
		"4. Never edit .pi/workflows/runs/ — the runtime applies the replacement and archives the old Spine.",
	].join("\n");
}

/** Cascade context line appended when the next node activates automatically. */
export function settleContextLine(run: Run, settled: RunNode, exitCode: number | null, durationHint?: string): string {
	return `Previous node ${settled.id} settled (session ${settled.sessionId ?? "?"}, exit ${exitCode ?? "n/a"}${durationHint ? `, ${durationHint}` : ""}) — logged automatically.`;
}

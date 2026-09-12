/**
 * Deterministic state transitions — the ONLY place Run/Node state flips.
 * Called from (a) /wf command handlers and (b) the sub-dispatch settle
 * callback. The model never calls any of this directly.
 */
import { activeNode, deriveRunStatus, nextPendingNode } from "./state";
import type { Run, RunNode } from "./types";

export function findNode(run: Run, nodeId: string): RunNode | undefined {
	return run.nodes.find((n) => n.id === nodeId);
}

/**
 * Settle a dispatched Auto Node. Correlation is by dispatch session id.
 * Everything here is pure: returns the mutated run plus a description of
 * what happened, for the caller to log/notify/cascade.
 */
export interface SettleOutcome {
	run: Run;
	/** true if a node actually flipped (duplicate settle → false) */
	applied: boolean;
	logLines: { kind: "node" | "settle" | "run"; text: string }[];
	next:
		| { kind: "none" }
		| { kind: "cascade-auto"; node: RunNode }
		| { kind: "cascade-human"; node: RunNode }
		| { kind: "run-complete" }
		| { kind: "node-failed"; node: RunNode };
}

export function applySettle(
	run: Run,
	sessionId: string,
	dispatchStatus: string,
	exitCode: number | null,
	at: string,
): SettleOutcome {
	const noop = (): SettleOutcome => ({ run, applied: false, logLines: [], next: { kind: "none" } });
	const node = run.nodes.find(
		(n) => n.type === "auto" && n.sessionId === sessionId && (n.status === "active" || n.status === "failed"),
	);
	if (!node) return noop();

	const ok = dispatchStatus === "done" && (exitCode === 0 || exitCode === null);
	if (ok) {
		node.status = "done";
		node.completedAt = at;
		const logLines: SettleOutcome["logLines"] = [
			{ kind: "settle", text: `${node.id} → done (sub-agent session ${sessionId}, exit ${exitCode ?? 0})` },
		];
		const nextNode = nextPendingNode(run);
		if (nextNode) {
			activateNode(nextNode, at);
			logLines.push({ kind: "node", text: `${nextNode.id} → active (auto-cascade from ${node.id})` });
			return {
				run,
				applied: true,
				logLines,
				next: nextNode.type === "auto" ? { kind: "cascade-auto", node: nextNode } : { kind: "cascade-human", node: nextNode },
			};
		}
		run.activeNodeId = null;
		run.status = deriveRunStatus(run);
		run.completedAt = at;
		logLines.push({ kind: "run", text: `run → ${run.status}` });
		return { run, applied: true, logLines, next: { kind: "run-complete" } };
	}

	// failure: node flips to failed (re-dispatchable via /wf next); NO cascade —
	// the failure is surfaced to the user through the model notification prompt.
	node.status = "failed";
	node.completedAt = at;
	node.note = `dispatch ${dispatchStatus} (exit ${exitCode ?? "null"})`;
	run.activeNodeId = node.id;
	return {
		run,
		applied: true,
		logLines: [{ kind: "settle", text: `${node.id} → failed (sub-agent session ${sessionId}, ${dispatchStatus}, exit ${exitCode ?? "null"})` }],
		next: { kind: "node-failed", node },
	};
}

/** Activate a pending node (startedAt stamped; sessionId cleared). */
export function activateNode(node: RunNode, at: string): void {
	node.status = "active";
	node.startedAt = at;
	node.sessionId = undefined;
	node.completedAt = undefined;
	node.note = undefined;
}

/**
 * Complete the active node; advance to the next node. The user outranks the
 * runtime: auto nodes normally settle via their dispatch notification, but a
 * lost/stuck settle must never deadlock the run — /wf done is the human
 * override. A late settle finds no active node with its sessionId and becomes
 * a silent noop.
 */
export function applyDone(
	run: Run,
	note: string | undefined,
	at: string,
): { ok: true; outcome: SettleOutcome } | { ok: false; error: string } {
	const node = activeNode(run);
	if (!node) return { ok: false, error: `run ${run.id} has no active node (status: ${run.status})` };
	if (node.status !== "active") {
		return { ok: false, error: `node ${node.id} is ${node.status}, not active — nothing to complete` };
	}
	node.status = "done";
	node.completedAt = at;
	if (note?.trim()) node.note = note.trim();
	const logLines: SettleOutcome["logLines"] = [
		{
			kind: "node",
			text:
				node.type === "auto"
					? `${node.id} → done (human override of auto node${node.sessionId ? `; in-flight dispatch ${node.sessionId} will settle as a noop` : ""})`
					: `${node.id} → done${note?.trim() ? ` — ${note.trim()}` : ""}`,
		},
	];
	const nextNode = nextPendingNode(run);
	if (nextNode) {
		activateNode(nextNode, at);
		run.activeNodeId = nextNode.id;
		logLines.push({ kind: "node", text: `${nextNode.id} → active` });
		return {
			ok: true,
			outcome: {
				run,
				applied: true,
				logLines,
				next: nextNode.type === "auto" ? { kind: "cascade-auto", node: nextNode } : { kind: "cascade-human", node: nextNode },
			},
		};
	}
	run.activeNodeId = null;
	run.status = deriveRunStatus(run);
	run.completedAt = at;
	logLines.push({ kind: "run", text: `run → ${run.status}` });
	return { ok: true, outcome: { run, applied: true, logLines, next: { kind: "run-complete" } } };
}

/** Skip a pending/active node with a mandatory reason; advance past it. */
export function applySkip(
	run: Run,
	nodeId: string,
	reason: string,
	at: string,
): { ok: true; outcome: SettleOutcome } | { ok: false; error: string } {
	if (!reason.trim()) return { ok: false, error: "a skip REASON is required: /wf skip <node-id> <reason>" };
	const node = findNode(run, nodeId);
	if (!node) return { ok: false, error: `no node "${nodeId}" in run ${run.id} — see /wf status` };
	if (node.status !== "pending" && node.status !== "active" && node.status !== "failed") {
		return { ok: false, error: `node ${node.id} is already ${node.status} — cannot skip` };
	}
	node.status = "skipped";
	node.completedAt = at;
	node.note = reason.trim();
	const wasActive = run.activeNodeId === node.id;
	const logLines: SettleOutcome["logLines"] = [{ kind: "reroute", text: `skip ${node.id}: ${reason.trim()}` }];

	if (wasActive) {
		const nextNode = nextPendingNode(run);
		if (nextNode) {
			activateNode(nextNode, at);
			run.activeNodeId = nextNode.id;
			logLines.push({ kind: "node", text: `${nextNode.id} → active` });
			return {
				ok: true,
				outcome: {
					run,
					applied: true,
					logLines,
					next: nextNode.type === "auto" ? { kind: "cascade-auto", node: nextNode } : { kind: "cascade-human", node: nextNode },
				},
			};
		}
		run.activeNodeId = null;
		run.status = deriveRunStatus(run);
		run.completedAt = at;
		logLines.push({ kind: "run", text: `run → ${run.status}` });
		return { ok: true, outcome: { run, applied: true, logLines, next: { kind: "run-complete" } } };
	}
	return { ok: true, outcome: { run, applied: true, logLines, next: { kind: "none" } } };
}

/** Insert a new node after the given node (Rerouting; reason-free but logged). */
export function applyInsert(
	run: Run,
	afterNodeId: string,
	title: string,
	type: "human" | "auto",
	at: string,
): { ok: true; node: RunNode } | { ok: false; error: string } {
	const after = findNode(run, afterNodeId);
	if (!after) return { ok: false, error: `no node "${afterNodeId}" in run ${run.id} — see /wf status` };
	if (!title.trim()) return { ok: false, error: "usage: /wf insert <after-node-id> <title> [auto|human]" };
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 30) || "node";
	let id = base;
	let n = 2;
	while (findNode(run, id)) id = `${base}-${n++}`;
	const node: RunNode = {
		id,
		title: title.trim(),
		type,
		suggest: [],
		brief: "(inserted mid-run — no brief authored)",
		doneWhen: "(to be defined — refine with /wf replan)",
		status: "pending",
	};
	const idx = run.nodes.indexOf(after);
	run.nodes.splice(idx + 1, 0, node);
	return { ok: true, node };
}

export interface ReplanDiff {
	logLines: { kind: "reroute" | "node"; text: string }[];
	/** The node that becomes active after replacement (cascade target), if any. */
	activated?: RunNode;
	/** In-flight auto dispatches severed by the replan (node dropped/renamed in the new
	 *  Spine). Their sub-agents keep running; settle notifications become a silent noop.
	 *  Surfaced to the user — never auto-killed. */
	orphaned: { nodeId: string; sessionId: string }[];
}

/**
 * Apply a user-approved replan: replace the Spine with the revised Definition
 * nodes. Preserves state of nodes that exist in both old and new Spine
 * (done/skipped stay terminal); new nodes start pending; removed open nodes
 * are logged as dropped. The old Spine was already archived by the caller.
 */
export function applyReplan(run: Run, newNodes: RunNode[], at: string): ReplanDiff {
	const logLines: ReplanDiff["logLines"] = [
		{ kind: "reroute", text: `replan: Spine replaced (${run.nodes.length} → ${newNodes.length} nodes); old Spine: ${run.nodes.map((n) => `${n.id}:${n.status}`).join(", ")}` },
	];
	const oldById = new Map(run.nodes.map((n) => [n.id, n]));
	const newIds = new Set(newNodes.map((n) => n.id));
	const orphaned = run.nodes
		.filter((n) => n.type === "auto" && n.status === "active" && n.sessionId && !newIds.has(n.id))
		.map((n) => ({ nodeId: n.id, sessionId: n.sessionId! }));
	for (const o of orphaned) {
		logLines.push({
			kind: "reroute",
			text: `in-flight dispatch severed: ${o.nodeId} (session ${o.sessionId}) keeps running but no longer belongs to this run — kill it manually via the Dispatch Overview if unwanted`,
		});
	}
	let activated: RunNode | undefined;
	for (const node of newNodes) {
		const prev = oldById.get(node.id);
		if (prev && (prev.status === "done" || prev.status === "skipped")) {
			node.status = prev.status;
			node.completedAt = prev.completedAt;
			node.sessionId = prev.sessionId;
			node.note = prev.note;
		} else if (prev && prev.status === "active" && node.type === "auto" && prev.sessionId) {
			// keep the in-flight dispatch correlation alive across a replan
			node.status = "active";
			node.startedAt = prev.startedAt;
			node.sessionId = prev.sessionId;
		} else {
			node.status = "pending";
		}
	}
	run.nodes = newNodes;
	const firstOpen = newNodes.find((n) => n.status === "pending");
	const inFlight = newNodes.find((n) => n.status === "active");
	if (inFlight) {
		run.activeNodeId = inFlight.id;
		logLines.push({ kind: "node", text: `${inFlight.id} stays active (dispatch in flight)` });
	} else if (firstOpen) {
		activateNode(firstOpen, at);
		run.activeNodeId = firstOpen.id;
		activated = firstOpen;
		logLines.push({ kind: "node", text: `${firstOpen.id} → active (post-replan)` });
	} else {
		run.activeNodeId = null;
		run.status = deriveRunStatus(run);
		run.completedAt = at;
		logLines.push({ kind: "run", text: `run → ${run.status}` });
	}
	return { logLines, activated, orphaned };
}

/** Cancel the run: open nodes become cancelled, run → cancelled. */
export function applyCancel(run: Run, at: string): { kind: "reroute" | "run"; text: string }[] {
	const lines: { kind: "reroute" | "run"; text: string }[] = [];
	for (const node of run.nodes) {
		if (node.status === "pending" || node.status === "active" || node.status === "failed") {
			node.status = "cancelled";
			node.completedAt = at;
			lines.push({ kind: "reroute", text: `${node.id} → cancelled` });
		}
	}
	run.activeNodeId = null;
	run.status = "cancelled";
	run.completedAt = at;
	lines.push({ kind: "run", text: `run → cancelled` });
	return lines;
}

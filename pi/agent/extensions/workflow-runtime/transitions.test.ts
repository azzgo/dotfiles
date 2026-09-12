import { describe, expect, it } from "vitest";
import { applyCancel, applyDone, applyInsert, applyReplan, applySettle, applySkip, activateNode } from "./transitions";
import { makeRun, sampleNodes } from "./test-helpers";

const AT = "2026-09-07T12:00:00.000Z";

describe("applySettle (sub-dispatch settle callback)", () => {
	it("main loop: auto settle → done + cascade to next auto WITHOUT asking", () => {
		const run = makeRun("r1");
		run.nodes[1]!.sessionId = "pi-abc123";
		const outcome = applySettle(run, "pi-abc123", "done", 0, AT);
		expect(outcome.applied).toBe(true);
		expect(run.nodes[1]!.status).toBe("done");
		expect(run.nodes[2]!.status).toBe("active");
		expect(outcome.next).toEqual({ kind: "cascade-auto", node: run.nodes[2] });
		expect(run.status).toBe("active");
	});

	it("auto settle before a human node cascades with a question, not a dispatch", () => {
		const run = makeRun("r1");
		run.nodes[1]!.sessionId = "s1";
		run.nodes[2]!.type = "human"; // fix (auto) → review-like human node
		const outcome = applySettle(run, "s1", "done", 0, AT);
		expect(outcome.next.kind).toBe("cascade-human");
	});

	it("last auto settle completes the run", () => {
		const run = makeRun("r1");
		run.nodes = run.nodes.slice(0, 2);
		run.nodes[1]!.sessionId = "s1";
		const outcome = applySettle(run, "s1", "done", 0, AT);
		expect(outcome.next).toEqual({ kind: "run-complete" });
		expect(run.status).toBe("done");
		expect(run.activeNodeId).toBeNull();
	});

	it("non-zero exit flips the node to failed and does NOT cascade", () => {
		const run = makeRun("r1");
		run.nodes[1]!.sessionId = "s1";
		const outcome = applySettle(run, "s1", "error", 1, AT);
		expect(run.nodes[1]!.status).toBe("failed");
		expect(run.nodes[2]!.status).toBe("pending");
		expect(outcome.next).toEqual({ kind: "node-failed", node: run.nodes[1] });
	});

	it("killed / timeout statuses count as failure", () => {
		const run = makeRun("r1");
		run.nodes[1]!.sessionId = "s1";
		const outcome = applySettle(run, "s1", "killed", null, AT);
		expect(outcome.next.kind).toBe("node-failed");
	});

	it("unknown session ids are ignored (idempotent, no double settle)", () => {
		const run = makeRun("r1");
		const outcome = applySettle(run, "unknown-session", "done", 0, AT);
		expect(outcome.applied).toBe(false);
		expect(run.nodes[1]!.status).toBe("active");
	});

	it("a duplicate settle notification is ignored", () => {
		const run = makeRun("r1");
		run.nodes[1]!.sessionId = "s1";
		applySettle(run, "s1", "done", 0, AT);
		const dup = applySettle(run, "s1", "done", 0, AT);
		expect(dup.applied).toBe(false);
	});
});

describe("applyDone (command handler)", () => {
	it("completes a human node and activates the next", () => {
		const run = makeRun("r1");
		run.nodes[0]!.status = "active";
		run.activeNodeId = "intake";
		run.nodes[1]!.status = "pending";
		run.nodes[2]!.status = "pending";
		const result = applyDone(run, "triaged", AT);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(run.nodes[0]!.note).toBe("triaged");
			expect(result.outcome.next).toEqual({ kind: "cascade-auto", node: run.nodes[1] });
		}
	});

	it("human override completes an AUTO node (a lost settle must never deadlock the run)", () => {
		const run = makeRun("r1"); // active node is 'locate' (auto)
		run.nodes[1]!.sessionId = "sess-xyz";
		const result = applyDone(run, "done by hand", AT);
		expect(result.ok).toBe(true);
		expect(run.nodes[1]!.status).toBe("done");
		expect(run.nodes[1]!.note).toBe("done by hand");
		expect(result.outcome.logLines.some((l) => /human override of auto node/.test(l.text) && /sess-xyz/.test(l.text))).toBe(true);
	});

	it("a late settle after a human override is a silent noop (node is already done)", () => {
		const run = makeRun("r1");
		run.nodes[1]!.sessionId = "sess-xyz";
		applyDone(run, undefined, AT);
		const late = applySettle(run, "sess-xyz", "done", 0, AT);
		expect(late.applied).toBe(false);
	});
});

describe("applySkip / applyInsert (rerouting)", () => {
	it("skip requires a reason", () => {
		const run = makeRun("r1");
		expect(applySkip(run, "locate", "  ", AT).ok).toBe(false);
	});

	it("skips a pending node and logs the reason", () => {
		const run = makeRun("r1");
		const result = applySkip(run, "fix", "obsolete", AT);
		expect(result.ok).toBe(true);
		expect(run.nodes.find((n) => n.id === "fix")!.status).toBe("skipped");
		expect(run.nodes.find((n) => n.id === "fix")!.note).toBe("obsolete");
	});

	it("skipping the ACTIVE node advances the spine", () => {
		const run = makeRun("r1"); // active = locate, pending = fix
		const result = applySkip(run, "locate", "found it already", AT);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.outcome.next.kind).toBe("cascade-auto");
		expect(run.activeNodeId).toBe("fix");
	});

	it("insert adds a pending node after the given node with a unique id", () => {
		const run = makeRun("r1");
		const result = applyInsert(run, "locate", "Write Regression Test", "auto", AT);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(run.nodes.map((n) => n.id)).toEqual(["intake", "locate", "write-regression-test", "fix"]);
			expect(result.node.status).toBe("pending");
		}
	});

	it("insert rejects unknown anchors and empty titles", () => {
		const run = makeRun("r1");
		expect(applyInsert(run, "nope", "x", "auto", AT).ok).toBe(false);
		expect(applyInsert(run, "locate", "  ", "auto", AT).ok).toBe(false);
	});
});

describe("applyReplan (AI-proposed, human-approved)", () => {
	it("preserves terminal nodes, resets open ones, archives old spine info", () => {
		const run = makeRun("r1"); // intake done, locate active, fix pending
		run.nodes[1]!.sessionId = "in-flight";
		const newNodes = sampleNodes().map((n) => ({ ...n }));
		newNodes.splice(2, 1); // drop 'fix'
		const diff = applyReplan(run, newNodes, AT);
		expect(run.nodes.find((n) => n.id === "intake")!.status).toBe("done");
		expect(run.nodes.find((n) => n.id === "locate")!.sessionId).toBe("in-flight"); // correlation preserved
		expect(diff.activated).toBeUndefined();
		expect(diff.logLines.some((l) => l.text.includes("old Spine"))).toBe(true);
	});

	it("activates the first open node when nothing is in flight", () => {
		const run = makeRun("r1");
		run.nodes[1]!.status = "pending";
		run.nodes[1]!.sessionId = undefined;
		const newNodes = sampleNodes().map((n) => ({ ...n }));
		newNodes[1]!.type = "human";
		const diff = applyReplan(run, newNodes, AT);
		expect(diff.activated?.id).toBe("locate");
		expect(run.activeNodeId).toBe("locate");
	});

	it("severs in-flight auto dispatches whose node the new Spine dropped, and logs them", () => {
		const run = makeRun("r1"); // intake done, locate active, fix pending
		run.nodes[1]!.sessionId = "pi-inflight";
		const newNodes = [sampleNodes()[0]!, sampleNodes()[2]!].map((n) => ({ ...n })); // 'locate' dropped
		const diff = applyReplan(run, newNodes, AT);
		expect(diff.orphaned).toEqual([{ nodeId: "locate", sessionId: "pi-inflight" }]);
		expect(diff.logLines.some((l) => l.text.includes("severed: locate"))).toBe(true);
	});

	it("keeping the same in-flight auto node does NOT orphan it", () => {
		const run = makeRun("r1");
		run.nodes[1]!.sessionId = "pi-keep";
		const newNodes = sampleNodes().map((n) => ({ ...n }));
		newNodes.splice(2, 1); // drop 'fix' only; 'locate' survives in-flight
		const diff = applyReplan(run, newNodes, AT);
		expect(diff.orphaned).toEqual([]);
		expect(run.nodes.find((n) => n.id === "locate")!.sessionId).toBe("pi-keep");
	});
});

describe("applyCancel", () => {
	it("cancels open nodes and the run", () => {
		const run = makeRun("r1");
		const lines = applyCancel(run, AT);
		expect(run.status).toBe("cancelled");
		expect(run.nodes.every((n) => n.status !== "active" && n.status !== "pending")).toBe(true);
		expect(lines.length).toBeGreaterThan(0);
	});
});

describe("activateNode", () => {
	it("resets transient dispatch state", () => {
		const node = sampleNodes()[0]!;
		node.sessionId = "stale";
		node.completedAt = AT;
		node.note = "old";
		activateNode(node, AT);
		expect(node.status).toBe("active");
		expect(node.sessionId).toBeUndefined();
		expect(node.completedAt).toBeUndefined();
		expect(node.note).toBeUndefined();
	});
});

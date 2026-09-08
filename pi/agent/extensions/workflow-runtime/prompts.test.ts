import { describe, expect, it } from "vitest";
import { buildAutoDispatchPrompt, buildHumanNodePrompt, buildNewDefinitionPrompt, buildReplanPrompt, dispatchReason } from "./prompts";
import { makeRun } from "./test-helpers";

describe("prompts", () => {
	const run = makeRun("r1");

	it("dispatchReason uses the wf-<runId>-node-<nodeId> correlation prefix", () => {
		expect(dispatchReason("r1", "locate")).toBe("wf-r1-node-locate");
	});

	it("auto prompt mandates background dispatch + exact reason + end-turn discipline", () => {
		const p = buildAutoDispatchPrompt(run, run.nodes[1]!);
		expect(p).toContain("background: true");
		expect(p).toContain('reason: "wf-r1-node-locate"');
		expect(p).toMatch(/END YOUR TURN/);
		expect(p).toMatch(/Do NOT touch anything under \.pi\/workflows\/|Do NOT modify anything under \.pi\/workflows\//);
		expect(p).toMatch(/never by you directly|by a fresh sub-agent/);
	});

	it("human prompt asks the user to complete with /wf done — never dispatch", () => {
		const p = buildHumanNodePrompt(run, run.nodes[0]!);
		expect(p).toContain("HUMAN");
		expect(p).toContain("/wf done");
		expect(p).toMatch(/do NOT dispatch a sub-agent for a human node/);
	});

	it("new-definition prompt is capability-aware and writes to the definitions dir", () => {
		const p = buildNewDefinitionPrompt("build a treehouse", ".pi/workflows/definitions");
		expect(p).toContain("ACTUALLY available");
		expect(p).toContain(".pi/workflows/definitions");
		expect(p).toContain("done-when:");
		expect(p).toContain("/wf start");
	});

	it("replan prompt requires user approval and never touches run state", () => {
		const p = buildReplanPrompt(run, ".pi/workflows/definitions/bugfix.md");
		expect(p).toMatch(/WAIT for approval/);
		expect(p).toContain("/wf replan confirm");
		expect(p).toMatch(/Never edit \.pi\/workflows\/runs\//);
	});
});

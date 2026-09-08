import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	appendLog,
	definitionPath,
	deriveRunStatus,
	findDefinition,
	listRuns,
	makeRunId,
	nonTerminalRuns,
	readLastFocus,
	readLogTail,
	readRun,
	resolveRunRef,
	slugify,
	writeLastFocus,
	writeRun,
} from "./state";
import { makeRun, sampleNodes } from "./test-helpers";

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "wf-state-"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

describe("run storage", () => {
	it("writes and reads run.json round-trip", () => {
		const run = makeRun("r1");
		writeRun(cwd, run);
		const back = readRun(cwd, "r1");
		expect(back?.title).toBe(run.title);
		expect(back?.nodes).toHaveLength(3);
		expect(back?.updatedAt).toBeTruthy();
	});

	it("rejects corrupt or mismatched run.json", () => {
		writeRun(cwd, makeRun("r1"));
		fs.writeFileSync(path.join(cwd, ".pi/workflows/runs/r1/run.json"), "{not json", "utf8");
		expect(readRun(cwd, "r1")).toBeUndefined();
	});

	it("makeRunId is timestamp+slug, unique on collision", () => {
		const at = new Date("2026-09-07T10:20:30");
		expect(makeRunId("bugfix", at, [])).toBe("20260907-102030-bugfix");
		const existing = ["20260907-102030-bugfix"];
		expect(makeRunId("bugfix", at, existing)).toBe("20260907-102030-bugfix-2");
		expect(slugify("Fix the Login Bug!!")).toBe("fix-the-login-bug");
	});

	it("listRuns / nonTerminalRuns sort and filter", () => {
		writeRun(cwd, makeRun("a", { createdAt: "2026-01-02T00:00:00Z" }));
		writeRun(cwd, makeRun("b", { createdAt: "2026-01-01T00:00:00Z", status: "done" }));
		writeRun(cwd, makeRun("c", { createdAt: "2026-01-03T00:00:00Z", status: "cancelled" }));
		expect(listRuns(cwd).map((r) => r.id)).toEqual(["b", "a", "c"]);
		expect(nonTerminalRuns(cwd).map((r) => r.id)).toEqual(["a"]);
	});

	it("resolveRunRef: exact, unique prefix, ambiguous, missing", () => {
		writeRun(cwd, makeRun("20260907-100000-bugfix"));
		writeRun(cwd, makeRun("20260907-110000-bugfix"));
		expect(resolveRunRef(cwd, "20260907-100000-bugfix").run?.id).toBe("20260907-100000-bugfix");
		expect(resolveRunRef(cwd, "20260907-100000").run?.id).toBe("20260907-100000-bugfix");
		expect(resolveRunRef(cwd, "20260907").error).toMatch(/ambiguous/);
		expect(resolveRunRef(cwd, "nope").error).toMatch(/no run matches/);
	});

	it("appendLog + readLogTail", () => {
		writeRun(cwd, makeRun("r1"));
		appendLog(cwd, "r1", "run", "started", "2026-09-07T00:00:00Z");
		appendLog(cwd, "r1", "node", "intake → done", "2026-09-07T00:05:00Z");
		const tail = readLogTail(cwd, "r1", 1);
		expect(tail).toContain("intake → done");
		expect(tail).not.toContain("started");
	});
});

describe("last-focus", () => {
	it("round-trips and defaults to undefined", () => {
		expect(readLastFocus(cwd)).toBeUndefined();
		writeLastFocus(cwd, "r1");
		expect(readLastFocus(cwd)).toBe("r1");
	});
});

describe("deriveRunStatus", () => {
	it("open while any node is active/pending/failed", () => {
		const nodes = sampleNodes();
		expect(deriveRunStatus({ ...makeRun("r"), nodes })).toBe("active");
		const failed = sampleNodes();
		failed[0]!.status = "failed";
		expect(deriveRunStatus({ ...makeRun("r"), nodes: failed })).toBe("active");
	});

	it("done when all nodes terminal", () => {
		const nodes = sampleNodes();
		nodes[0]!.status = "done";
		nodes[1]!.status = "skipped";
		nodes[2]!.status = "done";
		expect(deriveRunStatus({ ...makeRun("r"), nodes })).toBe("done");
	});
});

describe("findDefinition (pattern lookup order)", () => {
	it("finds a project definition and reports its source", () => {
		const projectDir = path.dirname(definitionPath(cwd, "w1"));
		fs.mkdirSync(projectDir, { recursive: true });
		fs.writeFileSync(
			definitionPath(cwd, "w1"),
			`---\nname: w1\ndescription: project definition\nnodes:\n  - id: a\n    title: A\n    type: human\n    suggest: []\n---\n## a\nx\n\ndone-when: y`,
			"utf8",
		);
		const found = findDefinition(cwd, "w1");
		expect(found).toHaveProperty("from", "project");
		if ("definition" in found) expect(found.definition.nodes[0]!.id).toBe("a");
	});

	it("reports a readable error for a missing pattern", () => {
		expect(findDefinition(cwd, "nope")).toHaveProperty("error");
	});
});

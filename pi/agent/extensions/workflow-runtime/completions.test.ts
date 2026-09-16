import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wfCompletions } from "./completions";
import { definitionPath, writeRun } from "./state";
import { makeRun } from "./test-helpers";

const PATTERN = (name: string) =>
	`---
name: ${name}
description: Test workflow for ${name}
nodes:
  - id: intake
    title: Intake
    type: human
    suggest: []
---
## intake
Do intake.

done-when: intake recorded.
`;

let cwd: string;
let patternsDir: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "wf-completions-"));
	patternsDir = path.join(cwd, "lib-patterns");
	fs.mkdirSync(patternsDir, { recursive: true });
	fs.writeFileSync(path.join(patternsDir, "testflow.md"), PATTERN("testflow"), "utf8");
	fs.writeFileSync(path.join(patternsDir, "autoflow.md"), PATTERN("autoflow"), "utf8");
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

describe("wfCompletions", () => {
	it("completes subcommands before the first space", () => {
		expect(wfCompletions(cwd, "").map((i) => i.value)).toContain("start");
		expect(wfCompletions(cwd, "sa")!.map((i) => i.value)).toEqual(["save-as-template"]);
		expect(wfCompletions(cwd, "ref")!.map((i) => i.value)).toEqual(["refine"]);
		expect(wfCompletions(cwd, "zzz")).toBeNull();
	});

	it("start completes definition/pattern names (project first, global deduped)", () => {
		fs.mkdirSync(path.dirname(definitionPath(cwd, "testflow")), { recursive: true });
		fs.writeFileSync(definitionPath(cwd, "testflow"), PATTERN("testflow"), "utf8");
		const items = wfCompletions(cwd, "start ", patternsDir)!;
		expect(items.map((i) => i.value).sort()).toEqual(["start autoflow", "start testflow"]);
		expect(wfCompletions(cwd, "start te", patternsDir)!.map((i) => i.value)).toEqual(["start testflow"]);
		// title after the name is free text — no completions
		expect(wfCompletions(cwd, "start testflow my title", patternsDir)).toBeNull();
	});

	it("run-arg subcommands complete run ids with title/status descriptions", () => {
		const run = makeRun("20260916-120000-testflow");
		writeRun(cwd, run);
		const items = wfCompletions(cwd, "next 2026")!;
		expect(items).toHaveLength(1);
		expect(items[0]!.value).toBe("next 20260916-120000-testflow");
		expect(items[0]!.description).toContain("[active]");
	});

	it("skip/insert complete node ids of the implicit focus run", () => {
		const run = makeRun("solo-run");
		writeRun(cwd, run);
		const items = wfCompletions(cwd, "skip ", patternsDir)!;
		expect(items.map((i) => i.value).sort()).toEqual(["skip fix", "skip intake", "skip locate"].sort());
	});

	it("refine completes definition/pattern names like start", () => {
		const items = wfCompletions(cwd, "refine ", patternsDir)!;
		expect(items.map((i) => i.value).sort()).toEqual(["refine autoflow", "refine testflow"]);
	});

	it("free-text subcommands yield no completions", () => {
		expect(wfCompletions(cwd, "new ")).toBeNull();
		expect(wfCompletions(cwd, "done ")).toBeNull();
	});
});

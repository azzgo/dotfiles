import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWfCommands, type WfDeps } from "./commands";
import { definitionPath, readRun } from "./state";
import { makeRun } from "./test-helpers";

const PATTERN = (name: string, type = "human") =>
	`---
name: ${name}
description: Test workflow for ${name}
nodes:
  - id: intake
    title: Intake
    type: ${type}
    suggest: [grill-with-docs]
  - id: locate
    title: Locate
    type: auto
    suggest: []
---
## intake
Do intake.

done-when: intake recorded.

## locate
Find it.

done-when: found.
`;

let cwd: string;
let patternsDir: string;
let sent: string[];
let notes: { text: string; level?: string }[];

function makeDeps(overrides: Partial<WfDeps> = {}): WfDeps {
	return {
		cwd,
		sendPrompt: (content) => sent.push(content),
		notify: (text, level) => notes.push({ text, level }),
		pickRun: async () => null,
		now: () => "2026-09-07T12:00:00.000Z",
		globalPatternsDir: patternsDir,
		...overrides,
	};
}

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "wf-cmd-"));
	patternsDir = path.join(cwd, "lib-patterns");
	fs.mkdirSync(patternsDir, { recursive: true });
	fs.writeFileSync(path.join(patternsDir, "testflow.md"), PATTERN("testflow"), "utf8");
	fs.writeFileSync(path.join(patternsDir, "autoflow.md"), PATTERN("autoflow", "auto"), "utf8");
	sent = [];
	notes = [];
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

function setupRun(id = "r-run"): ReturnType<typeof createWfCommands> {
	writeRunHelper(id);
	return createWfCommands(makeDeps());
}

function writeRunHelper(id: string): void {
	const run = makeRun(id, { definitionName: "testflow" });
	run.nodes = [
		{ id: "intake", title: "Intake", type: "human", suggest: [], brief: "b", doneWhen: "d", status: "active" },
		{ id: "locate", title: "Locate", type: "auto", suggest: [], brief: "b", doneWhen: "d", status: "pending" },
	];
	run.activeNodeId = "intake";
	const wf = createWfCommands(makeDeps());
	// write directly via state
	fs.mkdirSync(path.join(cwd, ".pi/workflows/runs", id), { recursive: true });
	fs.writeFileSync(path.join(cwd, ".pi/workflows/runs", id, "run.json"), JSON.stringify(run), "utf8");
	void wf;
}

describe("startRun", () => {
	it("instantiates a Run from a global pattern, copies the Definition, sets Focus, sends the first flow prompt", () => {
		const wf = createWfCommands(makeDeps());
		wf.startRun("autoflow", "My Title");
		const runs = fs.readdirSync(path.join(cwd, ".pi/workflows/runs"));
		expect(runs).toHaveLength(1);
		const run = readRun(cwd, runs[0]!)!;
		expect(run.title).toBe("My Title");
		expect(run.definitionName).toBe("autoflow");
		expect(run.nodes[0]!.status).toBe("active");
		expect(fs.existsSync(definitionPath(cwd, "autoflow"))).toBe(true); // pattern copied to project
		expect(wf.getFocus()).toBe(run.id);
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatch(/WF AUTO NODE/);
		expect(sent[0]).toMatch(/reason: "wf-/);
	});

	it("rejections are readable: unknown pattern, invalid contract", () => {
		const wf = createWfCommands(makeDeps());
		wf.startRun("ghost");
		expect(notes[0]!.text).toMatch(/no definition or pattern named "ghost"/);
		fs.writeFileSync(path.join(patternsDir, "broken.md"), "---\nname: broken\n---\nnope", "utf8");
		wf.startRun("broken");
		expect(notes[1]!.text).toMatch(/violates the format contract/);
		expect(sent).toHaveLength(0);
	});
});

describe("done / skip / insert validation", () => {
	it("done completes the human node and queues the next auto dispatch prompt", () => {
		const wf = setupRun();
		wf.doneCmd("triaged it");
		const run = readRun(cwd, "r-run")!;
		expect(run.nodes[0]!.status).toBe("done");
		expect(run.nodes[0]!.note).toBe("triaged it");
		expect(run.nodes[1]!.status).toBe("active");
		expect(run.activeNodeId).toBe("locate");
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatch(/WF AUTO NODE run=r-run node=locate/);
	});

	it("done on an auto node is a human override that cascades", () => {
		const wf = setupRun();
		wf.nextCmd(); // placeholder to ensure focus set
		// manually flip active node to the auto node
		const run = readRun(cwd, "r-run")!;
		run.nodes[0]!.status = "done";
		run.nodes[1]!.status = "active";
		run.activeNodeId = "locate";
		fs.writeFileSync(path.join(cwd, ".pi/workflows/runs/r-run/run.json"), JSON.stringify(run), "utf8");
		notes.length = 0;
		sent.length = 0;
		wf.doneCmd("settled by hand");
		const updated = readRun(cwd, "r-run")!;
		expect(updated.nodes[1]!.status).toBe("done");
		expect(updated.nodes[1]!.note).toBe("settled by hand");
		const log = fs.readFileSync(path.join(cwd, ".pi/workflows/runs/r-run/progress.md"), "utf8");
		expect(log).toContain("human override of auto node");
	});

	it("skip without a reason is refused", () => {
		const wf = setupRun();
		wf.skipCmd("intake", "");
		expect(notes[0]!.text).toMatch(/REASON is required/);
	});

	it("skip with a reason reroutes and logs", () => {
		const wf = setupRun();
		wf.skipCmd("intake", "not needed");
		const run = readRun(cwd, "r-run")!;
		expect(run.nodes[0]!.status).toBe("skipped");
		expect(run.nodes[1]!.status).toBe("active");
		const log = fs.readFileSync(path.join(cwd, ".pi/workflows/runs/r-run/progress.md"), "utf8");
		expect(log).toContain("skip intake: not needed");
	});

	it("insert logs the reroute", () => {
		const wf = setupRun();
		wf.insertCmd("intake", "Extra Check auto");
		const run = readRun(cwd, "r-run")!;
		expect(run.nodes.map((n) => n.id)).toEqual(["intake", "extra-check", "locate"]);
		expect(run.nodes[1]!.type).toBe("auto");
	});

	it("insert after the active node uses the forward-reach wording", () => {
		const wf = setupRun(); // intake active, locate pending
		wf.insertCmd("intake", "Extra Check");
		expect(notes[0]!.text).toMatch(/when the Spine reaches it/);
	});

	it("insert ahead of the active node warns about the backflow (flow returns to it next)", () => {
		const wf = setupRun();
		const run = readRun(cwd, "r-run")!;
		run.nodes[0]!.status = "done";
		run.nodes[1]!.status = "active";
		run.activeNodeId = "locate";
		fs.writeFileSync(path.join(cwd, ".pi/workflows/runs/r-run/run.json"), JSON.stringify(run), "utf8");
		notes.length = 0;
		wf.insertCmd("intake", "Extra Check");
		expect(notes[0]!.text).toMatch(/flow returns to it/);
		// the inserted pending node precedes the active one → nextPendingNode picks it right after
		expect(readRun(cwd, "r-run")!.nodes.map((n) => `${n.id}:${n.status}`)).toEqual(["intake:done", "extra-check:pending", "locate:active"]);
		const log = fs.readFileSync(path.join(cwd, ".pi/workflows/runs/r-run/progress.md"), "utf8");
		expect(log).toMatch(/ahead of the active node/);
	});
});

describe("Focus resolution", () => {
	it("bare commands fail with a readable error when several runs exist and no focus is set", () => {
		writeRunHelper("r-a");
		writeRunHelper("r-b");
		const wf = createWfCommands(makeDeps());
		wf.doneCmd();
		expect(notes[0]!.text).toMatch(/no Focus in this session/);
	});

	it("/wf focus <id> pins the session and explicit ids always win", () => {
		writeRunHelper("r-a");
		writeRunHelper("r-b");
		const wf = createWfCommands(makeDeps());
		wf.focusCmd("r-b");
		expect(wf.getFocus()).toBe("r-b");
		wf.doneCmd();
		const runB = readRun(cwd, "r-b")!;
		expect(runB.nodes[0]!.status).toBe("done");
	});

	it("a lone non-terminal run is implicitly focused", () => {
		setupRun();
		const wf = createWfCommands(makeDeps());
		wf.doneCmd();
		expect(readRun(cwd, "r-run")!.nodes[0]!.status).toBe("done");
	});

	it("a terminal run in Focus gets a direct hint and Focus is released", () => {
		writeTerminalRun("r-done");
		const wf = createWfCommands(makeDeps());
		wf.focusCmd("r-done");
		expect(wf.getFocus()).toBe("r-done");
		notes.length = 0;
		wf.doneCmd();
		expect(notes[0]!.text).toMatch(/already done — nothing to advance/);
		expect(wf.getFocus()).toBeNull();
	});
});

describe("next", () => {
	it("warns when a dispatch is already in flight (never double-dispatch)", () => {
		const wf = setupRun();
		const run = readRun(cwd, "r-run")!;
		run.nodes[0]!.status = "done";
		run.nodes[1]!.status = "active";
		run.nodes[1]!.sessionId = "pi-inflight";
		run.activeNodeId = "locate";
		fs.writeFileSync(path.join(cwd, ".pi/workflows/runs/r-run/run.json"), JSON.stringify(run), "utf8");
		sent.length = 0;
		notes.length = 0;
		wf.nextCmd();
		expect(sent).toHaveLength(0);
		expect(notes[0]!.text).toMatch(/already has a dispatch in flight/);
	});
});

describe("replan", () => {
	it("confirm replaces the Spine from the revised Definition file and archives the old one", () => {
		const wf = setupRun();
		// model rewrote the definition with a revised spine (locate dropped, extra added)
		fs.mkdirSync(path.dirname(definitionPath(cwd, "testflow")), { recursive: true });
		fs.writeFileSync(
			definitionPath(cwd, "testflow"),
			`---
name: testflow
description: Test workflow for testflow
nodes:
  - id: intake
    title: Intake
    type: human
    suggest: []
  - id: extra
    title: Extra
    type: auto
    suggest: []
---
## intake
x

done-when: y

## extra
x

done-when: y
`,
			"utf8",
		);
		wf.replanCmd("confirm keep it tight");
		const run = readRun(cwd, "r-run")!;
		expect(run.nodes.map((n) => n.id)).toEqual(["intake", "extra"]);
		expect(run.nodes[0]!.status).toBe("active"); // still open → re-activated by the replan
		expect(run.nodes[1]!.status).toBe("pending");
		const log = fs.readFileSync(path.join(cwd, ".pi/workflows/runs/r-run/progress.md"), "utf8");
		expect(log).toContain("old Spine");
		expect(sent).toHaveLength(1); // cascade prompt for the re-activated human node
		expect(sent[0]).toMatch(/WF HUMAN NODE run=r-run node=intake/);
	});
});

describe("cancel & save-as-template", () => {
	it("cancel flips open nodes and clears focus", () => {
		const wf = setupRun();
		wf.cancelCmd();
		const run = readRun(cwd, "r-run")!;
		expect(run.status).toBe("cancelled");
		expect(wf.getFocus()).toBeNull();
	});

	it("save-as-template promotes the Definition into the pattern library (never overwrites)", () => {
		writeRunHelper("r-run");
		fs.mkdirSync(path.dirname(definitionPath(cwd, "testflow")), { recursive: true });
		fs.writeFileSync(definitionPath(cwd, "testflow"), PATTERN("testflow"), "utf8");
		const wf = createWfCommands(makeDeps());
		wf.saveAsTemplateCmd("r-run");
		expect(fs.existsSync(path.join(patternsDir, "testflow.md"))).toBe(true);
		// second attempt refuses to overwrite
		notes.length = 0;
		wf.saveAsTemplateCmd("r-run");
		expect(notes[0]!.text).toMatch(/refusing to overwrite/);
	});
});

describe("pickRunCmd (cold-start surface)", () => {
	it("dismissal does nothing: no prompt, no focus, no state change", async () => {
		setupRun();
		let pickCalled = false;
		const wf = createWfCommands(makeDeps({ pickRun: async () => { pickCalled = true; return null; } }));
		await wf.pickRunCmd();
		expect(pickCalled).toBe(true);
		expect(sent).toHaveLength(0);
		expect(wf.getFocus()).toBeNull();
	});

	it("picking a run sets focus", async () => {
		setupRun();
		const wf = createWfCommands(makeDeps({ pickRun: async (_t, items) => items.find((i) => i.includes("r-run")) ?? null }));
		await wf.pickRunCmd();
		expect(wf.getFocus()).toBe("r-run");
	});

	it("lists only 🗑 remove rows for terminal runs (active runs cannot be removed)", async () => {
		setupRun(); // active run
		writeTerminalRun("r-done"); // done run
		const seen: string[][] = [];
		const wf = createWfCommands(makeDeps({ pickRun: async (_t, items) => { seen.push(items); return null; } }));
		await wf.pickRunCmd();
		const items = seen[0]!;
		// active run row is focus-only, with no remove row
		const activeRow = items.find((i) => i.includes("r-run"))!;
		expect(activeRow).not.toMatch(/remove/);
		expect(items.some((i) => i.startsWith("🗑") && i.includes("r-run"))).toBe(false);
		// the terminal run gets both an info row and a remove row
		expect(items.some((i) => i.startsWith("🗑 remove r-done"))).toBe(true);
	});

	it("confirming removal deletes the run directory and refreshes the picker", async () => {
		writeTerminalRun("r-done");
		writeTerminalRun("r-done2");
		const calls: string[][] = [];
		// first picker: choose the remove row; confirmation: say yes;
		// refreshed picker (r-done gone, r-done2 left): dismiss
		const wf = createWfCommands(
			makeDeps({
				pickRun: async (_title, items) => {
					calls.push(items);
					if (calls.length === 1) return items.find((i) => i.startsWith("🗑 remove r-done ")) ?? null;
					if (calls.length === 2) return items.find((i) => i.startsWith("Yes")) ?? null;
					return null;
				},
			}),
		);
		await wf.pickRunCmd();
		expect(fs.existsSync(path.join(cwd, ".pi/workflows/runs/r-done"))).toBe(false);
		expect(fs.existsSync(path.join(cwd, ".pi/workflows/runs/r-done2"))).toBe(true);
		expect(notes.some((n) => n.text.includes("Removed run r-done "))).toBe(true);
		// initial picker → confirmation → refreshed picker (r-done gone)
		expect(calls).toHaveLength(3);
		expect(calls[2]!.some((i) => i.includes("r-done2"))).toBe(true);
		expect(calls[2]!.some((i) => i.includes("r-done "))).toBe(false);
	});

	it("cancelling the confirmation keeps the run on disk", async () => {
		writeTerminalRun("r-done");
		let calls = 0;
		const wf = createWfCommands(
			makeDeps({
				pickRun: async (_title, items) => {
					calls++;
					if (calls === 1) return items.find((i) => i.startsWith("🗑 remove r-done")) ?? null;
					return items.find((i) => i.startsWith("Cancel")) ?? null; // confirm dialog → cancel
				},
			}),
		);
		await wf.pickRunCmd();
		expect(fs.existsSync(path.join(cwd, ".pi/workflows/runs/r-done"))).toBe(true);
	});

	it("picker lists ALL terminal runs (the picker is the cleanup entry — no archive cap)", async () => {
		setupRun();
		for (let i = 0; i < 12; i++) writeTerminalRun(`r-done-${String(i).padStart(2, "0")}`);
		const seen: string[][] = [];
		const wf = createWfCommands(makeDeps({ pickRun: async (_t, items) => { seen.push(items); return null; } }));
		await wf.pickRunCmd();
		const removes = seen[0]!.filter((i) => i.startsWith("🗑 remove r-done-"));
		expect(removes).toHaveLength(12);
	});
});

function writeTerminalRun(id: string): void {
	const run = makeRun(id, { definitionName: "testflow", status: "done", activeNodeId: null, completedAt: "2026-09-07T12:00:00.000Z" });
	run.nodes = [
		{ id: "intake", title: "Intake", type: "human", suggest: [], brief: "b", doneWhen: "d", status: "done" },
	];
	fs.mkdirSync(path.join(cwd, ".pi/workflows/runs", id), { recursive: true });
	fs.writeFileSync(path.join(cwd, ".pi/workflows/runs", id, "run.json"), JSON.stringify(run), "utf8");
}

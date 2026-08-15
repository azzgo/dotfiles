import { describe, expect, it, vi } from "vitest";
import type { GoalPhase, GoalRecord, GoalSnapshot } from "./types";
import {
	buildGoalImplPrompt,
	buildGoalReviewProposalPrompt,
	buildGoalRunProposalPrompt,
	buildGoalSetPrompt,
} from "./prompts";

// Pure-function tests: fake snapshots only, no taskmd subprocess and no FS
// writes. resolveGoal is mocked so buildGoalImplPrompt's not-found path is
// deterministic on any machine (no `taskmd` binary / store needed).
vi.mock("./taskmd", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./taskmd")>();
	return { ...actual, resolveGoal: () => null };
});

function mkGoal(over: { id: string; title: string; phase: GoalPhase } & Partial<GoalRecord>): GoalRecord {
	return {
		id: over.id,
		title: over.title,
		phase: over.phase,
		status: "pending",
		tags: [],
		dependencies: [],
		file_path: `${over.id}-x.md`,
		...over,
	};
}

function mkSnapshot(goals: GoalRecord[], opts: Partial<GoalSnapshot> = {}): GoalSnapshot {
	return {
		cwd: "/repo",
		goalsDir: "/repo/.pi/goals",
		trackDir: "/repo/.pi/track",
		storeExists: true,
		activeGoal: goals.find((g) => g.phase === "active") ?? null,
		draftingGoal: goals.find((g) => g.phase === "drafting") ?? null,
		goals,
		queue: [],
		track: { findings: "", progress: "", exists: false },
		resumedFromPreviousSession: false,
		...opts,
	};
}

describe("buildGoalRunProposalPrompt", () => {
	it("keeps drafting goals visible in the menu with a not-runnable annotation", () => {
		const goals = [
			mkGoal({ id: "021", title: "Ship feature", phase: "active" }),
			mkGoal({ id: "030", title: "Explore idea", phase: "drafting" }),
		];
		const out = buildGoalRunProposalPrompt(mkSnapshot(goals), "resume the active goal");
		expect(out).toContain("021 [active]");
		expect(out).toContain("(not runnable: drafting)");
		expect(out).not.toContain("(not runnable: active)");
	});

	it("routes a drafting intent to finishing /goal set instead of reporting nothing found", () => {
		const out = buildGoalRunProposalPrompt(
			mkSnapshot([mkGoal({ id: "030", title: "Explore", phase: "drafting" })]),
			"keep drafting Explore",
		);
		expect(out).toContain("do NOT report 'nothing found'");
		expect(out).toContain("still drafting");
	});

	it("tells the user to create a goal when none exist yet", () => {
		const out = buildGoalRunProposalPrompt(mkSnapshot([]), "start a goal");
		expect(out).toContain("no goals yet");
	});
});

describe("buildGoalReviewProposalPrompt", () => {
	it("lists ALL goals in the menu, not just reviewable phases", () => {
		const goals = [
			mkGoal({ id: "020", title: "Sealed goal", phase: "complete" }),
			mkGoal({ id: "021", title: "Active goal", phase: "active" }),
		];
		const out = buildGoalReviewProposalPrompt(mkSnapshot(goals), "verify 020");
		expect(out).toContain("020 [complete]");
		expect(out).toContain("021 [active]");
	});

	it("matches bare ids and offers reopening for complete goals", () => {
		const out = buildGoalReviewProposalPrompt(
			mkSnapshot([mkGoal({ id: "020", title: "Sealed", phase: "complete" })]),
			"verify 020",
		);
		expect(out).toContain("bare ids");
		expect(out).toContain("REOPENING");
		expect(out).toContain("complete → in-review");
	});
});

describe("buildGoalSetPrompt", () => {
	it("includes the closing discipline rule", () => {
		const out = buildGoalSetPrompt(mkGoal({ id: "030", title: "Explore idea", phase: "drafting" }));
		expect(out).toContain("Closing discipline");
	});
});

describe("buildGoalImplPrompt", () => {
	it("returns Goal not found when the id does not resolve", () => {
		const out = buildGoalImplPrompt(mkSnapshot([]), "999", "start");
		expect(out).toContain("Goal not found");
	});
});

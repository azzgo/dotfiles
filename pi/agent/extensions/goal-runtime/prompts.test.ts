import { describe, expect, it, vi } from "vitest";
import type { GoalPhase, GoalRecord, GoalSnapshot } from "./types";
import {
	buildGoalImplPrompt,
	buildGoalReviewProposalPrompt,
	buildGoalRunProposalPrompt,
	buildGoalSetPrompt,
	buildTrackContextPrompt,
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

	it("hands off confirmation to the /goal activate command, never a tool call", () => {
		const goals = [mkGoal({ id: "021", title: "Ship feature", phase: "ready" })];
		const out = buildGoalRunProposalPrompt(mkSnapshot(goals), "run the shipping goal");
		expect(out).toContain("/goal activate");
		expect(out).not.toContain("activate_goal");
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

	it("hands off confirmation to the /goal review command, never a tool call", () => {
		const out = buildGoalReviewProposalPrompt(
			mkSnapshot([mkGoal({ id: "020", title: "Sealed", phase: "complete" })]),
			"verify 020",
		);
		expect(out).toContain("`/goal review`");
		expect(out).not.toContain("request_goal_review");
	});
});

describe("buildGoalSetPrompt", () => {
	it("includes the closing discipline rule", () => {
		const out = buildGoalSetPrompt(mkGoal({ id: "030", title: "Explore idea", phase: "drafting" }));
		expect(out).toContain("Closing discipline");
	});

	it("directs drafting edits at the goal record file and /goal commit, never a tool", () => {
		const out = buildGoalSetPrompt(mkGoal({ id: "030", title: "Explore idea", phase: "drafting", file_path: "030-explore-idea.md" }));
		expect(out).toContain("Goal record file: .pi/goals/030-explore-idea.md");
		expect(out).toContain("/goal commit");
		expect(out).not.toContain("save_goal_draft");
	});
});

describe("buildGoalImplPrompt", () => {
	it("returns Goal not found when the id does not resolve", () => {
		const out = buildGoalImplPrompt(mkSnapshot([]), "999", "start");
		expect(out).toContain("Goal not found");
	});
});

describe("buildTrackContextPrompt", () => {
	it("injects working memory context with goal state and tails", () => {
		const goals = [mkGoal({ id: "021", title: "Ship feature", phase: "active", runCount: 2 })];
		const out = buildTrackContextPrompt(mkSnapshot(goals, { track: { findings: "- constraint A", progress: "- [t] did X", exists: true } }));
		expect(out).toContain("[TRACK CONTEXT]");
		expect(out).toContain("Active: 021 [active] Ship feature");
		expect(out).toContain("- constraint A");
		expect(out).toContain("- [t] did X");
		expect(out).toContain("PI_TRACK_UPDATE_EVERY");
		expect(out).not.toContain("just auto-initialized");
	});

	it("marks auto-initialization when track files were missing", () => {
		const out = buildTrackContextPrompt(mkSnapshot([]), { justInitialized: true });
		expect(out).toContain("auto-initialized this session");
		expect(out).toContain("No active goal.");
	});
});

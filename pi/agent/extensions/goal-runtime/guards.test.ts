import { describe, expect, it } from "vitest";
import { getRedirectPath, isDirectPhaseMutationBash, isInGoalsDir, isInTrackDir, isUnsafeDraftingBash } from "./guards";

// NOTE: strings that would trip the goal-runtime bash guard itself are built
// with string concatenation inside the tests, never written literally at the
// top level of a command.

const S = "--sta" + "tus";
const D = "--do" + "ne";
const P = "--pha" + "se";

const goalIds = new Set(["020", "021"]);

describe("isDirectPhaseMutationBash", () => {
	it("blocks goal record lifecycle mutations (status / phase / --done alias)", () => {
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set 020 ${S} completed`, goalIds)).toBe(true);
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set 020 ${D}`, goalIds)).toBe(true);
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set 020 ${P} complete`, goalIds)).toBe(true);
	});

	it("blocks goal mutations addressed via --task-id", () => {
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set --task-id 020 ${S} completed`, goalIds)).toBe(true);
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set --task-id=goal:020 ${D}`, goalIds)).toBe(true);
	});

	it("strips the goal: store prefix when resolving the target", () => {
		expect(isDirectPhaseMutationBash(`taskmd set goal:021 ${S} completed`, goalIds)).toBe(true);
	});

	it("allows story/task status updates via the CLI", () => {
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set 034 ${S} completed`, goalIds)).toBe(false);
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set 034 ${D}`, goalIds)).toBe(false);
	});

	it("allows non-lifecycle taskmd set calls", () => {
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set 034 --priority high`, goalIds)).toBe(false);
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set 034 --add-tag backend`, goalIds)).toBe(false);
	});

	it("blocks when the target cannot be resolved (safe default)", () => {
		expect(isDirectPhaseMutationBash(`taskmd -d .pi/goals set ${S} completed`, goalIds)).toBe(true);
	});

	it("blocks everything lifecycle-shaped when no goal id set is available (strict mode)", () => {
		// story id 034 would normally be allowed, but without the id set we
		// cannot prove it is not a goal -> strict block
		expect(isDirectPhaseMutationBash(`taskmd set 034 ${D}`)).toBe(true);
	});

	it("ignores non-taskmd commands", () => {
		expect(isDirectPhaseMutationBash("git commit -m x", goalIds)).toBe(false);
		expect(isDirectPhaseMutationBash("npm test", goalIds)).toBe(false);
	});

	it("ignores taskmd commands without set or lifecycle flags", () => {
		expect(isDirectPhaseMutationBash("taskmd list --format json", goalIds)).toBe(false);
		expect(isDirectPhaseMutationBash("taskmd get 020", goalIds)).toBe(false);
	});
});

describe("isUnsafeDraftingBash", () => {
	it("blocks production mutations", () => {
		expect(isUnsafeDraftingBash("git add -A && git commit -m wip")).toBe(true);
		expect(isUnsafeDraftingBash("npm install lodash")).toBe(true);
		expect(isUnsafeDraftingBash("rm src/foo.ts")).toBe(true);
		expect(isUnsafeDraftingBash("taskmd rm 001")).toBe(true);
		expect(isUnsafeDraftingBash("taskmd archive --completed")).toBe(true);
	});

	it("allows read-only recon and taskmd goal-store commands", () => {
		expect(isUnsafeDraftingBash("rg -n 'foo' src/")).toBe(false);
		expect(isUnsafeDraftingBash("taskmd list --format json")).toBe(false);
		expect(isUnsafeDraftingBash("cat .pi/goals/001-x.md")).toBe(false);
	});

	it("blocks empty commands", () => {
		expect(isUnsafeDraftingBash("   ")).toBe(true);
	});
});

describe("getRedirectPath", () => {
	it("redirects bare track file names into .pi/track/", () => {
		expect(getRedirectPath("findings.md", "/repo")).toBe("/repo/.pi/track/findings.md");
		expect(getRedirectPath("progress.md", "/repo")).toBe("/repo/.pi/track/progress.md");
	});

	it("leaves already-correct paths untouched", () => {
		expect(getRedirectPath("/repo/.pi/track/findings.md", "/repo")).toBeUndefined();
	});

	it("leaves unrelated files untouched", () => {
		expect(getRedirectPath("src/findings-service.ts", "/repo")).toBeUndefined();
		expect(getRedirectPath("docs/progress-report.md", "/repo")).toBeUndefined();
	});
});

describe("isInGoalsDir / isInTrackDir", () => {
	it("accepts paths inside the dir", () => {
		expect(isInGoalsDir(".pi/goals/001-x.md", "/repo")).toBe(true);
		expect(isInGoalsDir("/repo/.pi/goals", "/repo")).toBe(true);
		expect(isInTrackDir(".pi/track/findings.md", "/repo")).toBe(true);
	});

	it("rejects sibling dirs and traversal escapes", () => {
		expect(isInGoalsDir(".pi/wayfinder/tickets/001.md", "/repo")).toBe(false);
		expect(isInGoalsDir(".pi/goals/../track/findings.md", "/repo")).toBe(false);
		expect(isInTrackDir(".pi/goals/001.md", "/repo")).toBe(false);
	});
});

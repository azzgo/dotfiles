import { describe, expect, it } from "vitest";
import type { TrackSnapshot } from "./types";
import { buildTrackContextPrompt, buildTrackStatusText, buildTrackUpdatePrompt } from "./prompts";

// Pure-function tests: fake snapshots only, no FS writes.

function mkSnapshot(opts: Partial<TrackSnapshot> = {}): TrackSnapshot {
	return {
		cwd: "/repo",
		trackDir: "/repo/.pi/track",
		track: { findings: "", progress: "", exists: false },
		resumedFromPreviousSession: false,
		...opts,
	};
}

describe("buildTrackStatusText", () => {
	it("reports the track dir, existence and tails without mutating anything", () => {
		const out = buildTrackStatusText(
			mkSnapshot({ track: { findings: "- constraint A", progress: "- [t] did X", exists: true } }),
		);
		expect(out).toContain("[TRACK STATUS]");
		expect(out).toContain("Track dir: /repo/.pi/track");
		expect(out).toContain("exists: true");
		expect(out).toContain("- constraint A");
		expect(out).toContain("- [t] did X");
	});
});

describe("buildTrackUpdatePrompt", () => {
	it("instructs the agent to STOP after reconciliation and wait for the user", () => {
		const out = buildTrackUpdatePrompt(mkSnapshot());
		expect(out).toContain("[TRACK UPDATE]");
		expect(out).toContain("STOP");
		expect(out).toContain("checkpoint");
		expect(out).toContain("wait for the user");
	});

	it("tells the agent to ask and wait on discontinuity, never decide itself", () => {
		const out = buildTrackUpdatePrompt(mkSnapshot());
		expect(out).toContain("Ask the user and STOP");
		expect(out).toContain("Never pick one yourself");
	});

	it("names both canonical file paths", () => {
		const out = buildTrackUpdatePrompt(mkSnapshot());
		expect(out).toContain("/repo/.pi/track/findings.md");
		expect(out).toContain("/repo/.pi/track/progress.md");
	});
});

describe("buildTrackContextPrompt", () => {
	it("injects working memory context with tails", () => {
		const out = buildTrackContextPrompt(
			mkSnapshot({ track: { findings: "- constraint A", progress: "- [t] did X", exists: true } }),
		);
		expect(out).toContain("[TRACK CONTEXT]");
		expect(out).toContain("- constraint A");
		expect(out).toContain("- [t] did X");
		expect(out).toContain("`/track update`");
		expect(out).toContain("(loaded via /track context)");
	});

	it("advertises manual commands only — no auto-run, no auto-injection", () => {
		const out = buildTrackContextPrompt(mkSnapshot());
		expect(out).not.toContain("auto");
		expect(out).not.toContain("Auto");
	});
});

describe("buildTrackContextPrompt gating", () => {
	it("permits continuing only on explicit next-step intent; otherwise stop and ask", () => {
		const out = buildTrackContextPrompt(mkSnapshot());
		expect(out).toContain("explicitly asked you to continue");
		expect(out).toContain("Otherwise STOP");
		expect(out).toContain("Do NOT guess or invent tasks");
	});
});

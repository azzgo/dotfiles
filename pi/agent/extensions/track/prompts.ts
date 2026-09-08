import type { TrackSnapshot } from "./types";
import { tailLines } from "./utils";

// ---- /track update ----

export function buildTrackUpdatePrompt(snapshot: TrackSnapshot): string {
	return [
		"[TRACK UPDATE]",
		"Refresh Track (.pi/track/findings.md + .pi/track/progress.md) with current workspace context.",
		"Track is flat working memory — NOT a tracker board. Do NOT create or write findings.md / progress.md anywhere else.",
		`- findings.md: ${snapshot.trackDir}/findings.md`,
		`- progress.md: ${snapshot.trackDir}/progress.md`,
		"",
		"## STOP after reconciliation — this is a checkpoint, not a resume signal",
		"`/track update` is run to flush working memory to disk — typically because the current session is about to end (context budget exhausted, handoff to a fresh session via /track context).",
		"Your ONLY job in this turn: reconcile the two Track files so a fresh session can resume from them. Then STOP and report a one-line summary of what you wrote. Do NOT continue prior work, do NOT start implementation, do NOT dispatch agents, and do NOT take next steps — wait for the user's next instruction. (Auto-continuation is also suppressed at the runtime for this turn.)",
		"If you need user input before writing (see the discontinuity branch below), ask and stop there — never decide it yourself.",
		"",
		"## Continuity Check",
		"Compare actual progress & findings against what's recorded:",
		"- Is the last recorded progress a continuation of what you're doing now?",
		"- Are findings/decisions still valid in the current context?",
		"- Are there new findings or progress not yet recorded?",
		"",
		"### If it IS a continuation",
		"Use write/edit at the exact paths above: findings.md append new discoveries; progress.md append new progress (Timeline / Work Completed / Verification / Blockers / Completion Evidence).",
		"",
		"### If it is NOT a continuation (progress doesn't align, context changed, old records stale)",
		"Don't write yet. Ask the user and STOP, then wait for their choice: 1. **reset** — `/track new` then write fresh content; 2. **write-anyway** — append despite discontinuity; 3. **abort** — don't write. Never pick one yourself.",
		"",
		"## findings.md (tail)",
		tailLines(snapshot.track.findings, 30) || "(missing)",
		"",
		"## progress.md (tail)",
		tailLines(snapshot.track.progress, 30) || "(missing)",
	].join("\n");
}

export function buildTrackStatusText(snapshot: TrackSnapshot): string {
	return [
		"[TRACK STATUS]",
		`Track dir: ${snapshot.trackDir}`,
		`exists: ${snapshot.track.exists}`,
		"",
		"## findings.md (tail)",
		tailLines(snapshot.track.findings, 20) || "(missing)",
		"",
		"## progress.md (tail)",
		tailLines(snapshot.track.progress, 20) || "(missing)",
	].join("\n");
}

// ---- track context (/track context) ----

/**
 * Compact Track context injected on demand via `/track context` (no auto-run):
 * findings/progress tails, so a session can pull working memory into context
 * when the user asks for it.
 */
export function buildTrackContextPrompt(snapshot: TrackSnapshot): string {
	return [
		"[TRACK CONTEXT] (loaded via /track context)",
		"Track is your flat working memory — NOT a tracker board. Keep it current as you work:",
		`- ${snapshot.trackDir}/findings.md — confirmed constraints, repo/system findings, design decisions, notes.`,
		`- ${snapshot.trackDir}/progress.md — timeline, work completed, verification, blockers, completion evidence.`,
		"- Commands: `/track new` (reset), `/track update` (reconcile), `/track status` (report).",
		"",
		"## How to use this context — continue only with explicit intent",
		"Loading context is NOT a command to act. After reading it:",
		"- If the user explicitly asked you to continue/resume the work or named a concrete next step in the same message (e.g. \"continue with the next task\", \"now do X\"), proceed with exactly that intent.",
		"- Otherwise STOP: give a brief orientation summary — where the work stands and what the immediate next step would be — and wait for the user's instruction. Do NOT guess or invent tasks, do speculative implementation, run busywork recon, or dispatch agents just to keep moving. When in doubt about what the user wants, ask.",
		"",
		"## findings.md (tail)",
		tailLines(snapshot.track.findings, 30) || "(empty)",
		"",
		"## progress.md (tail)",
		tailLines(snapshot.track.progress, 30) || "(empty)",
	].join("\n");
}

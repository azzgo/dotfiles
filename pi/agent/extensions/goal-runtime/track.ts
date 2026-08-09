import { randomUUID } from "node:crypto";
import path from "node:path";
import type { TrackState } from "./types";
import { TRACK_FILES, TRACK_DIR } from "./types";
import { appendBulletToHeading, nowIso, readText, trackDir, trimEmptyLines, writeText } from "./utils";

/**
 * Track = flat, non-taskmd working memory at `.pi/track/`.
 * findings.md + progress.md only. Never on the taskmd board.
 */

export function trackPaths(cwd: string): Record<(typeof TRACK_FILES)[number], string> {
	const dir = trackDir(cwd);
	return {
		"findings.md": path.join(dir, "findings.md"),
		"progress.md": path.join(dir, "progress.md"),
	};
}

export function readTrack(cwd: string): TrackState {
	const paths = trackPaths(cwd);
	const findings = readText(paths["findings.md"]);
	const progress = readText(paths["progress.md"]);
	return { findings, progress, exists: findings.length > 0 || progress.length > 0 };
}

function findingsTemplate(goalTitle?: string): string {
	const context = goalTitle ? `> Goal: ${goalTitle}\n>\n` : "";
	return trimEmptyLines(`# Findings

${context}## Confirmed Constraints
- [empty]

## Repo / System Findings
- [empty]

## Design Decisions
- [empty]

## Notes
- [empty]
`);
}

function progressTemplate(goalTitle?: string, runCount?: number): string {
	const initialLine = goalTitle
		? `- [${nowIso()}] Goal implementation started${typeof runCount === "number" ? ` (run ${runCount})` : ""}: ${goalTitle}`
		: `- [${nowIso()}] Track initialized`;
	return trimEmptyLines(`# Progress

## Timeline
${initialLine}

## Work Completed
- [empty]

## Verification
- [empty]

## Blockers / Interruptions
- [empty]

## Completion Evidence
- [empty]
`);
}

/**
 * `/track new` — reset/init the scratchpad. Also used by `/goal run`
 * (auto-reset for hygiene) with the active goal's title + run count.
 */
export function initTrack(cwd: string, opts: { goalTitle?: string; runCount?: number } = {}): void {
	const paths = trackPaths(cwd);
	writeText(paths["findings.md"], `${findingsTemplate(opts.goalTitle)}\n`);
	writeText(paths["progress.md"], `${progressTemplate(opts.goalTitle, opts.runCount)}\n`);
}

/** Append a timestamped bullet to a Track section (progress.md / findings.md). */
export function appendToTrack(cwd: string, file: (typeof TRACK_FILES)[number], heading: string, message: string): void {
	const paths = trackPaths(cwd);
	const target = paths[file];
	const content = readText(target) || (file === "findings.md" ? findingsTemplate() : progressTemplate());
	const next = appendBulletToHeading(content, heading, `[${nowIso()}] ${message}`);
	writeText(target, trimEmptyLines(next).concat("\n"));
}

export function progressTimeline(cwd: string, message: string): void {
	appendToTrack(cwd, "progress.md", "Timeline", message);
}

// transient briefs (verify instructions etc.) live under .pi/track/ but are not part of the two canonical files
export function briefPath(cwd: string, name: string): string {
	return path.join(trackDir(cwd), name);
}

// ---- verify-brief one-time token ----
//
// `verify_goal_result` is governed by a one-time token minted at review entry and
// embedded in the verify brief. Only a caller that read the brief (the dispatched
// verifier) can echo the token back, weakly binding resolution of `in-review` to
// the independent verifier rather than the orchestrator's self-review.

export function verifyBriefPath(cwd: string, goalId: string): string {
	return briefPath(cwd, `verify-brief-${goalId}.md`);
}

export function mintVerifyToken(): string {
	return randomUUID();
}

/** Write a verify brief with the token embedded; returns the token. */
export function writeVerifyBrief(cwd: string, goalId: string, brief: string, token: string): void {
	const withToken = `${brief.trim()}\n\nVERIFY_TOKEN: ${token}\n`;
	writeText(verifyBriefPath(cwd, goalId), withToken);
}

/** Read the token currently recorded in the verify brief, or null. */
export function readVerifyToken(cwd: string, goalId: string): string | null {
	const match = readText(verifyBriefPath(cwd, goalId)).match(/^VERIFY_TOKEN:\s*(\S+)\s*$/m);
	return match?.[1] ?? null;
}

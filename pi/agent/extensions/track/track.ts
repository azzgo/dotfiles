import path from "node:path";
import type { TrackState } from "./types";
import { TRACK_FILES } from "./types";
import { appendBulletToHeading, nowIso, readText, trackDir, trimEmptyLines, writeText } from "./utils";

/**
 * Track = flat working memory at `<host config dir>/track/` (`.pi/track` under pi, `.pig/track` under PiG).
 * findings.md + progress.md only — the model's freeform manual memory.
 */

export function trackPaths(cwd: string, configDirName?: string): Record<(typeof TRACK_FILES)[number], string> {
	const dir = trackDir(cwd, configDirName);
	return {
		"findings.md": path.join(dir, "findings.md"),
		"progress.md": path.join(dir, "progress.md"),
	};
}

export function readTrack(cwd: string, configDirName?: string): TrackState {
	const paths = trackPaths(cwd, configDirName);
	const findings = readText(paths["findings.md"]);
	const progress = readText(paths["progress.md"]);
	return { findings, progress, exists: findings.length > 0 || progress.length > 0 };
}

function findingsTemplate(): string {
	return trimEmptyLines(`# Findings

## Confirmed Constraints
- [empty]

## Repo / System Findings
- [empty]

## Design Decisions
- [empty]

## Notes
- [empty]
`);
}

function progressTemplate(): string {
	return trimEmptyLines(`# Progress

## Timeline
- [${nowIso()}] Track initialized

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

/** `/track new` — reset/init the scratchpad. Also used by the auto-init on first conversation. */
export function initTrack(cwd: string, configDirName?: string): void {
	const paths = trackPaths(cwd, configDirName);
	writeText(paths["findings.md"], `${findingsTemplate()}\n`);
	writeText(paths["progress.md"], `${progressTemplate()}\n`);
}

/** Append a timestamped bullet to a Track section (progress.md / findings.md). */
export function appendToTrack(cwd: string, file: (typeof TRACK_FILES)[number], heading: string, message: string, configDirName?: string): void {
	const paths = trackPaths(cwd, configDirName);
	const target = paths[file];
	const content = readText(target) || (file === "findings.md" ? findingsTemplate() : progressTemplate());
	const next = appendBulletToHeading(content, heading, `[${nowIso()}] ${message}`);
	writeText(target, trimEmptyLines(next).concat("\n"));
}

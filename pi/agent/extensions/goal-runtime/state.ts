import fs from "node:fs";
import path from "node:path";
import type { GoalRecord, GoalSnapshot, QueueState } from "./types";
import { QUEUE_FILE } from "./types";
import { listGoals, readGoalDetail } from "./taskmd";
import { fileExists, goalsDir, readText, trackDir } from "./utils";
import { readTrack } from "./track";

// ---- serial queue (transient runtime state, not goal records) ----

const EMPTY_QUEUE: QueueState = { current: null, ids: [] };

export function readQueueState(cwd: string): QueueState {
	const target = path.join(goalsDir(cwd), QUEUE_FILE);
	if (!fileExists(target)) return EMPTY_QUEUE;
	try {
		const parsed = JSON.parse(readText(target)) as { current?: unknown; ids?: unknown };
		const current = typeof parsed.current === "string" && parsed.current.length > 0 ? parsed.current : null;
		const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === "string") : [];
		return { current, ids };
	} catch {
		return EMPTY_QUEUE;
	}
}

export function writeQueueState(cwd: string, qs: QueueState): void {
	const target = path.join(goalsDir(cwd), QUEUE_FILE);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(qs, null, 2)}\n`, "utf8");
}

/** ids still waiting in the serial queue (for display) */
export function readQueue(cwd: string): string[] {
	return readQueueState(cwd).ids;
}

// ---- snapshot ----

export function getSnapshot(cwd: string, resumedFromPreviousSession = false): GoalSnapshot {
	const gDir = goalsDir(cwd);
	const hasStore = fileExists(gDir);
	let goals: GoalRecord[] = [];
	if (hasStore) {
		try {
			goals = listGoals(cwd).map((g) => readGoalDetail(cwd, g));
		} catch {
			// taskmd unavailable or store not initialized yet — treat as empty
			goals = [];
		}
	}
	const activeGoal = goals.find((g) => g.phase === "active") ?? null;
	const draftingGoal = goals.find((g) => g.phase === "drafting") ?? null;
	return {
		cwd,
		goalsDir: gDir,
		trackDir: trackDir(cwd),
		storeExists: hasStore,
		activeGoal,
		draftingGoal,
		goals,
		queue: readQueue(cwd),
		track: readTrack(cwd),
		resumedFromPreviousSession,
	};
}
/** Cheap existence check without a taskmd subprocess. */
export function storeExists(cwd: string): boolean {
	return fileExists(goalsDir(cwd));
}

export type { GoalRecord, GoalSnapshot };

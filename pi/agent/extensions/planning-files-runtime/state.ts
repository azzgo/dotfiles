import type { DraftingStage, GoalContract, GoalDraft, GoalOverlayState, GoalOverlayStatus } from "./types";
import { fileExists, getPaths, normalizeString, normalizeStringArray, nowIso, readText, writeText } from "./utils";

// ---- defaults ----

export function defaultGoalDraft(): GoalDraft {
	return {
		sourceTopic: "",
		supplementalInputs: [],
		clarificationSummary: [],
		objective: "",
		successCriteria: [],
		constraints: [],
		outOfScope: [],
		blockerRule: "",
		openQuestions: [],
		nextRecommendedQuestion: "",
		draftingStage: "as-is",
	};
}

export function defaultGoalState(): GoalOverlayState {
	return {
		version: 1,
		status: "none",
		updatedAt: nowIso(),
		draft: defaultGoalDraft(),
		goal: null,
		impl: {
			runId: 0,
			planningResetRequired: false,
			initializedAt: null,
			lastResumedAt: null,
			pausedReason: "",
			completedSummary: "",
		},
	};
}

// ---- normalisation ----

export function normalizeGoalDraft(value: unknown): GoalDraft {
	const raw = (value ?? {}) as Record<string, unknown>;
	const stage = normalizeString(raw.draftingStage);
	const validStages: DraftingStage[] = ["as-is", "design", "story", "task"];
	return {
		sourceTopic: normalizeString(raw.sourceTopic),
		supplementalInputs: normalizeStringArray(raw.supplementalInputs),
		clarificationSummary: normalizeStringArray(raw.clarificationSummary),
		objective: normalizeString(raw.objective),
		successCriteria: normalizeStringArray(raw.successCriteria),
		constraints: normalizeStringArray(raw.constraints),
		outOfScope: normalizeStringArray(raw.outOfScope),
		blockerRule: normalizeString(raw.blockerRule),
		openQuestions: normalizeStringArray(raw.openQuestions),
		nextRecommendedQuestion: normalizeString(raw.nextRecommendedQuestion),
		draftingStage: (validStages as string[]).includes(stage) ? (stage as DraftingStage) : "as-is",
	};
}

export function normalizeGoalContract(value: unknown): GoalContract | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	const objective = normalizeString(raw.objective);
	const successCriteria = normalizeStringArray(raw.successCriteria);
	const constraints = normalizeStringArray(raw.constraints);
	const outOfScope = normalizeStringArray(raw.outOfScope);
	const blockerRule = normalizeString(raw.blockerRule);
	if (!objective) return null;
	return {
		objective,
		successCriteria,
		constraints,
		outOfScope,
		blockerRule,
	};
}

export function normalizeGoalState(value: unknown): GoalOverlayState {
	if (!value || typeof value !== "object") return defaultGoalState();
	const raw = value as Record<string, unknown>;
	const status = normalizeString(raw.status);
	const goal = normalizeGoalContract(raw.goal);
	const implRaw = (raw.impl ?? {}) as Record<string, unknown>;
	const normalizedStatus = ["none", "drafting", "ready", "active", "paused", "complete"].includes(status)
		? (status as GoalOverlayStatus)
		: goal
			? "ready"
			: "none";
	return {
		version: 1,
		status: normalizedStatus,
		updatedAt: normalizeString(raw.updatedAt) || nowIso(),
		draft: normalizeGoalDraft(raw.draft),
		goal,
		impl: {
			runId: typeof implRaw.runId === "number" && Number.isFinite(implRaw.runId) ? Math.max(0, Math.trunc(implRaw.runId)) : 0,
			planningResetRequired: implRaw.planningResetRequired === true,
			initializedAt: normalizeString(implRaw.initializedAt) || null,
			lastResumedAt: normalizeString(implRaw.lastResumedAt) || null,
			pausedReason: normalizeString(implRaw.pausedReason),
			completedSummary: normalizeString(implRaw.completedSummary),
		},
	};
}

// ---- I/O ----

export function readGoalState(cwd: string): GoalOverlayState {
	const target = getPaths(cwd).goalState;
	if (!fileExists(target)) return defaultGoalState();
	try {
		return normalizeGoalState(JSON.parse(readText(target)));
	} catch {
		return defaultGoalState();
	}
}

export function writeGoalState(cwd: string, state: GoalOverlayState): void {
	const target = getPaths(cwd).goalState;
	const next: GoalOverlayState = {
		...state,
		updatedAt: nowIso(),
	};
	writeText(target, `${JSON.stringify(next, null, 2)}\n`);
}

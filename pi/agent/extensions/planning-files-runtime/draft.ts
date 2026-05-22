import type { DraftingStage, GoalContract, GoalDraft, GoalOverlayState, GoalOverlayStatus, SaveGoalDraftParams } from "./types";
import { normalizeString, normalizeStringArray } from "./utils";
import { readGoalState, writeGoalState } from "./state";

/**
 * Merge tool params into an existing draft, preserving unchanged fields.
 */
export function mergeDraft(current: GoalDraft, params: SaveGoalDraftParams): GoalDraft {
	const validStages: DraftingStage[] = ["as-is", "design", "story", "task"];
	const nextStage = params.draftingStage !== undefined
		? (normalizeString(params.draftingStage) as DraftingStage)
		: undefined;
	const next: GoalDraft = {
		...current,
		sourceTopic: params.sourceTopic !== undefined ? normalizeString(params.sourceTopic) : current.sourceTopic,
		objective: params.objective !== undefined ? normalizeString(params.objective) : current.objective,
		blockerRule: params.blockerRule !== undefined ? normalizeString(params.blockerRule) : current.blockerRule,
		nextRecommendedQuestion: params.nextRecommendedQuestion !== undefined
			? normalizeString(params.nextRecommendedQuestion)
			: current.nextRecommendedQuestion,
		supplementalInputs: current.supplementalInputs,
		clarificationSummary: params.clarificationSummary !== undefined
			? normalizeStringArray(params.clarificationSummary)
			: current.clarificationSummary,
		successCriteria: params.successCriteria !== undefined ? normalizeStringArray(params.successCriteria) : current.successCriteria,
		constraints: params.constraints !== undefined ? normalizeStringArray(params.constraints) : current.constraints,
		outOfScope: params.outOfScope !== undefined ? normalizeStringArray(params.outOfScope) : current.outOfScope,
		openQuestions: params.openQuestions !== undefined ? normalizeStringArray(params.openQuestions) : current.openQuestions,
		draftingStage: nextStage && (validStages as string[]).includes(nextStage) ? nextStage : current.draftingStage,
	};
	return next;
}

/**
 * Derive a GoalContract from a completed draft.
 * Returns null if any required field is still empty.
 */
export function goalContractFromDraft(draft: GoalDraft): GoalContract | null {
	if (!draft.objective || draft.successCriteria.length === 0 || draft.constraints.length === 0 || draft.outOfScope.length === 0 || !draft.blockerRule) {
		return null;
	}
	return {
		objective: draft.objective,
		successCriteria: draft.successCriteria,
		constraints: draft.constraints,
		outOfScope: draft.outOfScope,
		blockerRule: draft.blockerRule,
	};
}

/**
 * Read goal state, apply a mutation, set a new status, and persist.
 */
export function setGoalStatus(
	cwd: string,
	status: GoalOverlayStatus,
	mutate: (state: GoalOverlayState) => GoalOverlayState,
): GoalOverlayState {
	const current = readGoalState(cwd);
	const next = mutate(current);
	next.status = status;
	writeGoalState(cwd, next);
	return next;
}

import type { PlanningSnapshot } from "./types";

/**
 * Format a one-line status text for the Pi status bar.
 */
export function formatStatusText(state: PlanningSnapshot): string | undefined {
	const goal = state.goalState.goal;
	const shortGoal = goal?.objective ?? state.goalFromPlan;
	switch (state.goalState.status) {
		case "drafting":
			return `🎯 draft · ${state.goalState.draft.draftingStage} · ${state.goalState.draft.openQuestions.length || 0} open q${state.goalState.draft.openQuestions.length === 1 ? "" : "s"}`;
		case "ready":
			return shortGoal ? `🎯 ready · ${shortGoal}` : "🎯 ready";
		case "active":
			return `🎯 active · ${state.currentPhase ?? "planning"}${shortGoal ? ` · ${shortGoal}` : ""}`;
		case "paused":
			return shortGoal ? `⏸ goal paused · ${shortGoal}` : "⏸ goal paused";
		case "complete":
			return shortGoal ? `✅ goal complete · ${shortGoal}` : "✅ goal complete";
		default:
			if (!state.exists) return undefined;
			return state.currentPhase ? `🧭 planning · ${state.currentPhase}` : "🧭 planning";
	}
}

/**
 * Build widget lines displayed above the editor.
 */
export function buildWidgetLines(state: PlanningSnapshot): string[] | undefined {
	if (!state.exists && state.goalState.status === "none") return undefined;
	const lines: string[] = [];
	lines.push(`dir: ${state.planningRoot}`);
	lines.push(`planning: ${state.exists ? "initialized" : "not initialized"}`);
	if (state.goalState.status !== "none") {
		lines.push(`goal: ${state.goalState.status}`);
		if (state.goalState.status === "drafting") lines.push(`stage: ${state.goalState.draft.draftingStage}`);
		if (state.goalState.goal?.objective) lines.push(`objective: ${state.goalState.goal.objective}`);
		if (state.goalState.status === "drafting" && state.goalState.draft.nextRecommendedQuestion) {
			lines.push(`next question: ${state.goalState.draft.nextRecommendedQuestion}`);
		}
	}
	if (state.currentPhase) lines.push(`phase: ${state.currentPhase}`);
	if (state.nextAction) lines.push(`next: ${state.nextAction}`);
	if (state.blocker) lines.push(`blocker: ${state.blocker}`);
	return lines;
}

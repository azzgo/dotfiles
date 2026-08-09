import type { GoalSnapshot } from "./types";
import { readGoalContract } from "./taskmd";

/** One-line status text for the Pi status bar. */
export function formatStatusText(state: GoalSnapshot): string | undefined {
	const active = state.activeGoal;
	const drafting = state.draftingGoal;
	if (active) {
		const contract = readGoalContract(active);
		return `🎯 active · ${active.title}${contract.objective ? ` · ${contract.objective}` : ""}`;
	}
	if (drafting) {
		return `🎯 draft(${drafting.draftingStage ?? "as-is"}) · ${drafting.title}`;
	}
	if (state.goals.some((g) => g.phase === "ready")) {
		return `🎯 ${state.goals.filter((g) => g.phase === "ready").length} ready`;
	}
	if (state.goals.length > 0) {
		const inReview = state.goals.filter((g) => g.phase === "in-review").length;
		const completed = state.goals.filter((g) => g.phase === "complete").length;
		const abandoned = state.goals.filter((g) => g.phase === "abandoned").length;
		return `🎯 ${completed} done${inReview ? ` · ${inReview} in-review` : ""}${abandoned ? ` · ${abandoned} abandoned` : ""}`;
	}
	return undefined;
}

/** Widget lines displayed above the editor. */
export function buildWidgetLines(state: GoalSnapshot): string[] | undefined {
	if (!state.storeExists && !state.track.exists && state.goals.length === 0) return undefined;
	const lines: string[] = [];
	const actives = state.goals.filter((g) => g.phase === "active");
	if (actives.length > 1) lines.push(`⚠ multiple active goals: ${actives.map((g) => g.id).join(", ")}`);
	lines.push(`goals: ${state.goalsDir} (taskmd)`);
	lines.push(`track: ${state.trackDir}${state.track.exists ? "" : " (empty)"}`);
	if (state.activeGoal) {
		lines.push(`active: ${state.activeGoal.id} [${state.activeGoal.phase}] ${state.activeGoal.title}`);
		if (state.queue.length > 0) lines.push(`queue: ${state.queue.join(", ")}`);
	}
	if (state.draftingGoal) {
		lines.push(`drafting: ${state.draftingGoal.id} [stage ${state.draftingGoal.draftingStage ?? "as-is"}] ${state.draftingGoal.title}`);
	}
	const inReview = state.goals.filter((g) => g.phase === "in-review");
	if (inReview.length > 0) lines.push(`in-review: ${inReview.map((g) => g.id).join(", ")}`);
	return lines;
}

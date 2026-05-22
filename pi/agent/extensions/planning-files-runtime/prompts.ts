import type { GoalDraft, GoalOverlayState, PlanningSnapshot } from "./types";
import {
	extractSection,
	firstMeaningfulLine,
	getPaths,
	readText,
	tailLines,
	truncate,
} from "./utils";
import { readGoalState } from "./state";
import { hasPlanningFiles } from "./workspace";

// ---- snapshot ----

export function getPlanningSnapshot(cwd: string, resumedFromPreviousSession: boolean): PlanningSnapshot {
	const paths = getPaths(cwd);
	const taskPlan = readText(paths.files["task_plan.md"]);
	const currentPhase = firstMeaningfulLine(extractSection(taskPlan, "Current Phase"));
	const goalFromPlan = firstMeaningfulLine(extractSection(taskPlan, "Goal"));
	const nextAction = firstMeaningfulLine(extractSection(taskPlan, "Next Concrete Action"))
		?? firstMeaningfulLine(extractSection(taskPlan, "Next Action"));
	const blocker = firstMeaningfulLine(extractSection(taskPlan, "Blocker"));
	return {
		planningRoot: paths.root,
		files: paths.files,
		goalDesignPath: paths.goalDesign,
		tasksDir: paths.tasksDir,
		goalStatePath: paths.goalState,
		exists: hasPlanningFiles(cwd),
		currentPhase,
		goalFromPlan,
		nextAction,
		blocker,
		goalState: readGoalState(cwd),
		resumedFromPreviousSession,
	};
}

// ---- draft summary ----

export function summarizeDraft(state: GoalDraft): string[] {
	const lines: string[] = [];
	if (state.sourceTopic) lines.push(`- Source topic: ${state.sourceTopic}`);
	if (state.objective) lines.push(`- Objective draft: ${state.objective}`);
	if (state.successCriteria.length > 0) lines.push(`- Success criteria: ${state.successCriteria.join("; ")}`);
	if (state.constraints.length > 0) lines.push(`- Constraints: ${state.constraints.join("; ")}`);
	if (state.outOfScope.length > 0) lines.push(`- Out of scope: ${state.outOfScope.join("; ")}`);
	if (state.blockerRule) lines.push(`- If blocked: ${state.blockerRule}`);
	if (state.openQuestions.length > 0) lines.push(`- Open questions (${state.openQuestions.length}): ${state.openQuestions.join("; ")}`);
	if (state.nextRecommendedQuestion) lines.push(`- Recommended next question: ${state.nextRecommendedQuestion}`);
	return lines;
}

// ---- prompt builders ----

export function buildGoalSetPrompt(goalState: GoalOverlayState, supplementalInput?: string): string {
	const draft = goalState.draft;
	const currentGoal = goalState.goal;
	const draftSummary = summarizeDraft(draft);
	const stage = draft.draftingStage || "as-is";
	return [
		"[PLAN GOAL SET]",
		"Goal drafting in 4 stages. Output to .pi/planning/goal-design.md.",
		"Each stage: analyze -> write -> auto-advance. Ask user only if missing key info.",
		"Track stage in .goal-state.json draftingStage. Can go back if user changes mind.",
		"",
		"Stage 1 as-is: Read code. Map real paths, APIs, DB schema, components. List affected modules.",
		"  Output -> goal-design.md ## Design.",
		"Stage 2 design: Recommend 1 approach. Note alternatives + why rejected.",
		"  Cover compat, rollback, test strategy. Output -> goal-design.md ## Design.",
		"Stage 3 story: Vertical slices. Each = end-to-end deliverable.",
		"  Per Story: what, which layers, acceptance. Check vs architecture.md.",
		"  Flag single-layer Stories. Output -> goal-design.md ## Story Breakdown.",
		"Stage 4 task: Break Stories into Tasks. 1 commit per Task.",
		"  Mark hard/soft deps. Mark TDD (unit|component|integration|no).",
		"  Output index table -> goal-design.md ## Task Plan.",
		"  Write each Task card -> tasks/task-NN.md.",
		"All done + contract complete -> commit_plan_goal.",
		"",
		"Output style: caveman. Drop filler. Tech precision. Arrow for causality.",
		"",
		`Current stage: ${stage}`,
		`Goal overlay status: ${goalState.status}`,
		...(currentGoal ? ["", "Committed goal:", `- Objective: ${currentGoal.objective}`] : []),
		...(currentGoal?.successCriteria.length ? [`- Success criteria: ${currentGoal.successCriteria.join("; ")}`] : []),
		"",
		"Current draft state:",
		...(draftSummary.length > 0 ? draftSummary : ["- (empty draft)"]),
		...(supplementalInput ? ["", "New user input for this drafting step:", supplementalInput] : []),
	].join("\n");
}

export function buildGoalImplPrompt(state: PlanningSnapshot, mode: "start" | "resume" | "continue"): string {
	const goal = state.goalState.goal;
	if (!goal) {
		return "[PLAN GOAL IMPL]\nNo committed goal exists. Stop and tell the user to run /plan-goal-set first.";
	}
	const findings = truncate(tailLines(readText(state.files["findings.md"]), 20), 1400);
	const progress = truncate(tailLines(readText(state.files["progress.md"]), 20), 1400);
	const taskPlan = truncate(readText(state.files["task_plan.md"]), 2200);
	return [
		`[PLAN GOAL IMPL mode=${mode} runId=${state.goalState.impl.runId}]`,
		"You are executing a committed goal using planning files as working memory.",
		"Planning files are the only durable execution tracker for this run.",
		"",
		"Goal contract:",
		`- Objective: ${goal.objective}`,
		`- Success criteria: ${goal.successCriteria.join("; ")}`,
		`- Constraints: ${goal.constraints.join("; ") || "(none)"}`,
		`- Out of scope: ${goal.outOfScope.join("; ") || "(none)"}`,
		`- If blocked: ${goal.blockerRule}`,
		"",
		"Execution blueprint: .pi/planning/goal-design.md. Read before starting.",
		"  - Tasks have hard/soft deps. Respect topological order.",
		"  - If TDD marked: red -> green -> refactor, then commit.",
		"  - 1 commit per Task. Merge sequentially. No parallel writes.",
		"",
		"Execution protocol:",
		"- Re-read task_plan.md before major decisions.",
		"- Update findings.md after important discoveries or design decisions.",
		"- Update progress.md after meaningful work, verification, blockers, or completion evidence.",
		"- Keep task_plan.md as the source of truth for current phase and next actions.",
		"- Choose the next concrete action and do it; do not keep re-reading state without moving the work forward.",
		"- If you hit a real blocker, call pause_plan_goal with a concrete reason and suggested action.",
		"- Call complete_plan_goal only when the goal contract is actually satisfied and progress.md contains completion evidence.",
		"",
		"Current planning state:",
		`- Phase: ${state.currentPhase ?? "(missing)"}`,
		`- Next action: ${state.nextAction ?? "(missing)"}`,
		`- Blocker: ${state.blocker ?? "(none)"}`,
		"",
		"task_plan.md:",
		taskPlan || "(missing)",
		"",
		"Recent findings:",
		findings || "(missing)",
		"",
		"Recent progress:",
		progress || "(missing)",
	].join("\n");
}

// ---- task index ----

export function extractTaskIndex(goalDesignPath: string): string | undefined {
	const content = readText(goalDesignPath);
	const section = extractSection(content, "Task Plan");
	if (!section) return undefined;
	return truncate(section, 1200);
}

// ---- injected context ----

export function buildInjectedContext(state: PlanningSnapshot): string | undefined {
	if (!state.exists && state.goalState.status === "none") return undefined;
	const taskPlan = truncate(readText(state.files["task_plan.md"]), 2000);
	const findings = truncate(tailLines(readText(state.files["findings.md"]), 20), 1200);
	const progress = truncate(tailLines(readText(state.files["progress.md"]), 20), 1200);
	const goalLines: string[] = [];
	if (["ready", "active", "paused", "complete"].includes(state.goalState.status) && state.goalState.goal) {
		goalLines.push(`goal overlay status: ${state.goalState.status}`);
		goalLines.push(`goal objective: ${state.goalState.goal.objective}`);
		if (state.goalState.impl.pausedReason) goalLines.push(`goal paused reason: ${state.goalState.impl.pausedReason}`);
		if (state.goalState.status === "active") {
			const taskIndex = extractTaskIndex(state.goalDesignPath);
			if (taskIndex) {
				goalLines.push("");
				goalLines.push("Goal design Task Plan:");
				goalLines.push(taskIndex);
			}
		}
	}
	if (state.goalState.status === "drafting" && state.goalState.draft.openQuestions.length > 0) {
		goalLines.push(`goal draft in progress: ${state.goalState.draft.openQuestions.length} open question(s)`);
	}
	const resumeNote = state.resumedFromPreviousSession
		? "- This session continues from a previous Pi session. Reconcile your next actions against the planning files before changing code."
		: "";
	return [
		"[PLANNING FILES RUNTIME]",
		`Planning files for this project live under ${state.planningRoot}.`,
		"Do not use root-level task_plan.md, findings.md, or progress.md in this project. Use the .pi/planning versions only.",
		"",
		"Rules:",
		"- Re-read the plan before major decisions.",
		"- Update findings.md after discoveries and design decisions.",
		"- Update progress.md after meaningful work, verification, blockers, or completion evidence.",
		"- Keep task_plan.md as the source of truth for phase status and next actions.",
		resumeNote,
		...(goalLines.length > 0 ? ["", ...goalLines] : []),
		"",
		"Current task plan:",
		taskPlan || "(missing)",
		"",
		"Recent findings tail:",
		findings || "(missing)",
		"",
		"Recent progress tail:",
		progress || "(missing)",
	].filter(Boolean).join("\n");
}

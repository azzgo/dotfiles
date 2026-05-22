// ---- constants ----

export const CUSTOM_TYPE = "planning-files-runtime";
export const STATUS_KEY = "planning-files-runtime";
export const WIDGET_KEY = "planning-files-runtime";
export const MESSAGE_TYPE_GOAL_SET = "planning-files-runtime-goal-set";
export const MESSAGE_TYPE_GOAL_IMPL = "planning-files-runtime-goal-impl";
export const MESSAGE_TYPE_CONTINUATION = "planning-files-runtime-goal-continuation";
export const PLANNING_DIR = ".pi/planning";
export const GOAL_STATE_FILE = ".goal-state.json";
export const GOAL_DESIGN_FILE = "goal-design.md";
export const PLANNING_FILES = ["task_plan.md", "findings.md", "progress.md"] as const;
export const PLANNING_FILE_NAMES = [...PLANNING_FILES, GOAL_DESIGN_FILE] as const;
export const GOAL_TOOL_NAMES = [
	"save_plan_goal_draft",
	"commit_plan_goal",
	"pause_plan_goal",
	"complete_plan_goal",
] as const;
export const CONTINUATION_DELAY_MS = 50;
export const MEANINGFUL_PROGRESS_TOOLS = new Set(["bash", "edit", "write", "grep", "find"]);

// ---- types ----

export type DraftingStage = "as-is" | "design" | "story" | "task";
export type PlanningFileName = (typeof PLANNING_FILES)[number];
export type GoalOverlayStatus = "none" | "drafting" | "ready" | "active" | "paused" | "complete";

export type GoalDraft = {
	sourceTopic: string;
	supplementalInputs: string[];
	clarificationSummary: string[];
	objective: string;
	successCriteria: string[];
	constraints: string[];
	outOfScope: string[];
	blockerRule: string;
	openQuestions: string[];
	nextRecommendedQuestion: string;
	draftingStage: DraftingStage;
};

export type GoalContract = {
	objective: string;
	successCriteria: string[];
	constraints: string[];
	outOfScope: string[];
	blockerRule: string;
};

export type GoalImplState = {
	runId: number;
	planningResetRequired: boolean;
	initializedAt: string | null;
	lastResumedAt: string | null;
	pausedReason: string;
	completedSummary: string;
};

export type GoalOverlayState = {
	version: 1;
	status: GoalOverlayStatus;
	updatedAt: string;
	draft: GoalDraft;
	goal: GoalContract | null;
	impl: GoalImplState;
};

export type PlanningSnapshot = {
	planningRoot: string;
	files: Record<PlanningFileName, string>;
	goalDesignPath: string;
	tasksDir: string;
	goalStatePath: string;
	exists: boolean;
	currentPhase?: string;
	goalFromPlan?: string;
	nextAction?: string;
	blocker?: string;
	goalState: GoalOverlayState;
	resumedFromPreviousSession: boolean;
};

export type PathBundle = {
	root: string;
	archiveRoot: string;
	goalState: string;
	goalDesign: string;
	tasksDir: string;
	files: Record<PlanningFileName, string>;
};

export type SaveGoalDraftParams = {
	sourceTopic?: string;
	clarificationSummary?: string[];
	objective?: string;
	successCriteria?: string[];
	constraints?: string[];
	outOfScope?: string[];
	blockerRule?: string;
	openQuestions?: string[];
	nextRecommendedQuestion?: string;
	draftingStage?: DraftingStage;
};

export type CommitGoalParams = GoalContract;

export type PauseGoalParams = {
	reason: string;
	suggestedAction?: string;
};

export type CompleteGoalParams = {
	summary: string;
	evidence?: string[];
};

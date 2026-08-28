// ---- constants ----

export const CUSTOM_TYPE = "goal-runtime";
export const STATUS_KEY = "goal-runtime";
export const WIDGET_KEY = "goal-runtime";

export const MESSAGE_TYPE_GOAL_SMART = "goal-runtime-goal-smart";
export const MESSAGE_TYPE_GOAL_SET = "goal-runtime-goal-set";
export const MESSAGE_TYPE_GOAL_IMPL = "goal-runtime-goal-impl";
export const MESSAGE_TYPE_GOAL_CONTINUATION = "goal-runtime-goal-continuation";
export const MESSAGE_TYPE_GOAL_REVIEW = "goal-runtime-goal-review";
export const MESSAGE_TYPE_GOAL_LIST = "goal-runtime-goal-list";
export const MESSAGE_TYPE_GOAL_STATUS = "goal-runtime-goal-status";
export const MESSAGE_TYPE_GOAL_RUN_PROPOSE = "goal-runtime-goal-run-propose";
export const MESSAGE_TYPE_GOAL_REVIEW_PROPOSE = "goal-runtime-goal-review-propose";
export const MESSAGE_TYPE_TRACK_CONTEXT = "goal-runtime-track-context";
export const MESSAGE_TYPE_TRACK_UPDATE = "goal-runtime-track-update";
export const MESSAGE_TYPE_TRACK_STATUS = "goal-runtime-track-status";

export const GOALS_DIR = ".pi/goals";
export const TRACK_DIR = ".pi/track";
export const TRACK_FILES = ["findings.md", "progress.md"] as const;
export const TRACK_FILE_NAMES = [...TRACK_FILES] as const;

export const GOAL_TAG = "goal";
export const STORY_TAG = "goal:story";
export const TASK_TAG = "goal:task";
export const GOAL_TAG_FAMILY = [GOAL_TAG, STORY_TAG, TASK_TAG] as const;

export const MEANINGFUL_PROGRESS_TOOLS = new Set(["bash", "edit", "write", "grep", "find"]);

/**
 * Overlay-silent marker: dispatched sub-agents (impl-with-spawn leaves and the
 * verifier) must run with this env var set so their goal-runtime instance skips
 * continuation, auto-pause-on-abort, and drafting guards. Set via the dispatch
 * tool's env parameter (not prompt text): dispatch({ env: { PI_GOAL_RUNTIME_CHILD: "1" } }).
 */
export const CHILD_ENV_MARKER = "PI_GOAL_RUNTIME_CHILD";

export const QUEUE_FILE = ".queue.json";

// ---- types ----

export type DraftingStage = "as-is" | "design" | "story" | "task";

/**
 * Lifecycle lives in taskmd's freeform `phase` field (source of truth);
 * `status` is a derived projection onto taskmd's closed status set.
 */
export type GoalPhase =
	| "drafting"
	| "ready"
	| "active"
	| "paused"
	| "in-review"
	| "complete"
	| "abandoned";

export type GoalStatus =
	| "pending"
	| "in-progress"
	| "in-review"
	| "completed"
	| "cancelled";

/** phase (truth) -> status (projection) */
export const PHASE_STATUS: Record<GoalPhase, GoalStatus> = {
	drafting: "pending",
	ready: "pending",
	active: "in-progress",
	paused: "in-progress",
	"in-review": "in-review",
	complete: "completed",
	abandoned: "cancelled",
};

export const TERMINAL_PHASES: GoalPhase[] = ["complete", "abandoned"];

export type TaskmdListRecord = {
	id: string;
	title: string;
	status: string;
	phase?: string;
	priority?: string;
	tags: string[];
	parent?: string;
	dependencies: string[];
	created_at?: string;
	file_path: string;
};

export type QueueState = {
	/** goal id currently being executed in this serial run (head of the run queue) */
	current: string | null;
	/** goal ids still waiting in the serial queue */
	ids: string[];
};

export type GoalRecord = TaskmdListRecord & {
	phase: GoalPhase;
	status: GoalStatus;
	/** custom frontmatter (agent-written) */
	sourceTopic?: string;
	draftingStage?: DraftingStage;
	openQuestions?: string[];
	nextRecommendedQuestion?: string;
	clarificationSummary?: string[];
	runCount?: number;
	body?: string;
};

export type StoryRecord = TaskmdListRecord;
export type TaskRecord = TaskmdListRecord & { body?: string };

export type TaskTier = { tier: number; taskIds: string[] };

export type TrackState = {
	findings: string;
	progress: string;
	exists: boolean;
};

export type GoalSnapshot = {
	cwd: string;
	goalsDir: string;
	trackDir: string;
	storeExists: boolean;
	activeGoal: GoalRecord | null;
	draftingGoal: GoalRecord | null;
	goals: GoalRecord[];
	queue: string[];
	track: TrackState;
	resumedFromPreviousSession: boolean;
};

// ---- tool params ----

/**
 * verify_goal_result is the ONLY goal-runtime tool, registered exclusively in
 * dispatched verifier child processes (PI_GOAL_RUNTIME_CHILD=1); the orchestrator
 * never sees it in its tool list.
 */
export type VerifyResultParams = {
	goalId: string;
	token: string;
	pass: boolean;
	evidence?: string[];
};

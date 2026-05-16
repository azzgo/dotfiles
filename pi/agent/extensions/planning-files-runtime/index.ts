import fs from "node:fs";
import path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CUSTOM_TYPE = "planning-files-runtime";
const STATUS_KEY = "planning-files-runtime";
const WIDGET_KEY = "planning-files-runtime";
const MESSAGE_TYPE_GOAL_SET = "planning-files-runtime-goal-set";
const MESSAGE_TYPE_GOAL_IMPL = "planning-files-runtime-goal-impl";
const MESSAGE_TYPE_CONTINUATION = "planning-files-runtime-goal-continuation";
const PLANNING_DIR = path.join(".pi", "planning");
const GOAL_STATE_FILE = ".goal-state.json";
const PLANNING_FILES = ["task_plan.md", "findings.md", "progress.md"] as const;
const GOAL_TOOL_NAMES = [
	"save_plan_goal_draft",
	"commit_plan_goal",
	"pause_plan_goal",
	"complete_plan_goal",
] as const;
const CONTINUATION_DELAY_MS = 50;
const MEANINGFUL_PROGRESS_TOOLS = new Set(["bash", "edit", "write", "grep", "find"]);

type PlanningFileName = (typeof PLANNING_FILES)[number];
type GoalOverlayStatus = "none" | "drafting" | "ready" | "active" | "paused" | "complete";

type GoalDraft = {
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
};

type GoalContract = {
	objective: string;
	successCriteria: string[];
	constraints: string[];
	outOfScope: string[];
	blockerRule: string;
};

type GoalImplState = {
	runId: number;
	planningResetRequired: boolean;
	initializedAt: string | null;
	lastResumedAt: string | null;
	pausedReason: string;
	completedSummary: string;
};

type GoalOverlayState = {
	version: 1;
	status: GoalOverlayStatus;
	updatedAt: string;
	draft: GoalDraft;
	goal: GoalContract | null;
	impl: GoalImplState;
};

type PlanningSnapshot = {
	planningRoot: string;
	files: Record<PlanningFileName, string>;
	goalStatePath: string;
	exists: boolean;
	currentPhase?: string;
	goalFromPlan?: string;
	nextAction?: string;
	blocker?: string;
	goalState: GoalOverlayState;
	resumedFromPreviousSession: boolean;
};

type PathBundle = {
	root: string;
	archiveRoot: string;
	goalState: string;
	files: Record<PlanningFileName, string>;
};

type SaveGoalDraftParams = {
	sourceTopic?: string;
	clarificationSummary?: string[];
	objective?: string;
	successCriteria?: string[];
	constraints?: string[];
	outOfScope?: string[];
	blockerRule?: string;
	openQuestions?: string[];
	nextRecommendedQuestion?: string;
};

type CommitGoalParams = GoalContract;

type PauseGoalParams = {
	reason: string;
	suggestedAction?: string;
};

type CompleteGoalParams = {
	summary: string;
	evidence?: string[];
};

function nowIso(): string {
	return new Date().toISOString();
}

function archiveStamp(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

function fileExists(target: string): boolean {
	try {
		return fs.existsSync(target);
	} catch {
		return false;
	}
}

function ensureDir(target: string): void {
	fs.mkdirSync(target, { recursive: true });
}

function readText(target: string): string {
	try {
		return fs.readFileSync(target, "utf8");
	} catch {
		return "";
	}
}

function writeText(target: string, content: string): void {
	ensureDir(path.dirname(target));
	fs.writeFileSync(target, content, "utf8");
}

function getPaths(cwd: string): PathBundle {
	const root = path.join(cwd, PLANNING_DIR);
	return {
		root,
		archiveRoot: path.join(root, "archive"),
		goalState: path.join(root, GOAL_STATE_FILE),
		files: {
			"task_plan.md": path.join(root, "task_plan.md"),
			"findings.md": path.join(root, "findings.md"),
			"progress.md": path.join(root, "progress.md"),
		},
	};
}

function defaultGoalDraft(): GoalDraft {
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
	};
}

function defaultGoalState(): GoalOverlayState {
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

function normalizeString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const items: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const trimmed = entry.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		items.push(trimmed);
	}
	return items;
}

function normalizeGoalDraft(value: unknown): GoalDraft {
	const raw = (value ?? {}) as Record<string, unknown>;
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
	};
}

function normalizeGoalContract(value: unknown): GoalContract | null {
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

function normalizeGoalState(value: unknown): GoalOverlayState {
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

function readGoalState(cwd: string): GoalOverlayState {
	const target = getPaths(cwd).goalState;
	if (!fileExists(target)) return defaultGoalState();
	try {
		return normalizeGoalState(JSON.parse(readText(target)));
	} catch {
		return defaultGoalState();
	}
}

function writeGoalState(cwd: string, state: GoalOverlayState): void {
	const target = getPaths(cwd).goalState;
	const next: GoalOverlayState = {
		...state,
		updatedAt: nowIso(),
	};
	writeText(target, `${JSON.stringify(next, null, 2)}\n`);
}

function hasPlanningFiles(cwd: string): boolean {
	const paths = getPaths(cwd);
	return PLANNING_FILES.some((name) => fileExists(paths.files[name]));
}

function trimEmptyLines(text: string): string {
	return text.trim().replace(/\n{3,}/g, "\n\n");
}

function createTaskPlanTemplate(goal?: GoalContract): string {
	const goalSection = goal?.objective || "[One sentence describing the end state]";
	const criteriaSection = goal && goal.successCriteria.length > 0
		? `\n## Goal Success Criteria\n${goal.successCriteria.map((item) => `- ${item}`).join("\n")}\n`
		: "";
	const constraintsSection = goal && goal.constraints.length > 0
		? `\n## Goal Constraints\n${goal.constraints.map((item) => `- ${item}`).join("\n")}\n`
		: "";
	const outOfScopeSection = goal && goal.outOfScope.length > 0
		? `\n## Goal Out of Scope\n${goal.outOfScope.map((item) => `- ${item}`).join("\n")}\n`
		: "";
	const blockedSection = goal?.blockerRule
		? `\n## If Blocked\n${goal.blockerRule}\n`
		: "";
	const keyQuestions = goal
		? [
			"1. Which files or systems must change to satisfy the goal?",
			"2. How will each success criterion be verified before declaring completion?",
		]
		: ["1. [Question to answer]", "2. [Question to answer]"];
	return trimEmptyLines(`# Task Plan: ${goal ? "Goal Implementation" : "[Brief Description]"}
<!--
  WHAT: This is your roadmap for the current work.
  WHY: After many tool calls, original goals and discoveries can get forgotten.
  WHEN: Keep this file current before and after meaningful work.
-->

## Goal
${goalSection}
${criteriaSection}${constraintsSection}${outOfScopeSection}${blockedSection}
## Current Phase
Phase 1

## Next Concrete Action
- [Describe the immediate next step]

## Blocker
[empty]

## Phases

### Phase 1: Requirements & Discovery
- [ ] Understand the current task and repository context
- [ ] Identify constraints and requirements
- [ ] Document findings in findings.md
- **Status:** in_progress

### Phase 2: Planning & Structure
- [ ] Define the technical approach
- [ ] Decide file/module touch points
- [ ] Document decisions with rationale
- **Status:** pending

### Phase 3: Implementation
- [ ] Execute the plan step by step
- [ ] Test incrementally
- [ ] Keep planning files updated
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] Verify all requirements are met
- [ ] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** pending

### Phase 5: Delivery
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to the user
- **Status:** pending

## Key Questions
${keyQuestions.join("\n")}

## Decisions Made
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions
- Log errors to avoid repetition
- Never repeat a failed action unchanged
`);
}

function createFindingsTemplate(goal?: GoalContract): string {
	const goalContext = goal
		? [
			"## Goal Context",
			`- Objective: ${goal.objective}`,
			...goal.constraints.map((item) => `- Constraint: ${item}`),
			...goal.outOfScope.map((item) => `- Out of scope: ${item}`),
			"",
		].join("\n")
		: "";
	return trimEmptyLines(`# Findings

${goalContext}## Confirmed Constraints
- [empty]

## Repo / System Findings
- [empty]

## Design Decisions
- [empty]

## Notes
- [empty]
`);
}

function createProgressTemplate(goal?: GoalContract, runId?: number): string {
	const initialLine = goal
		? `- [${nowIso()}] Goal implementation started${typeof runId === "number" ? ` (run ${runId})` : ""}: ${goal.objective}`
		: `- [${nowIso()}] Planning workspace initialized`;
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

function initializePlanningWorkspace(cwd: string, goal?: GoalContract, runId?: number): void {
	const paths = getPaths(cwd);
	ensureDir(paths.root);
	writeText(paths.files["task_plan.md"], `${createTaskPlanTemplate(goal)}\n`);
	writeText(paths.files["findings.md"], `${createFindingsTemplate(goal)}\n`);
	writeText(paths.files["progress.md"], `${createProgressTemplate(goal, runId)}\n`);
}

function archivePlanningWorkspace(cwd: string, options: { includeGoalState: boolean; label: string }): string | null {
	const paths = getPaths(cwd);
	const archiveTargets = [
		...PLANNING_FILES.map((name) => paths.files[name]),
		...(options.includeGoalState ? [paths.goalState] : []),
	].filter((target) => fileExists(target));
	if (archiveTargets.length === 0) return null;
	ensureDir(paths.archiveRoot);
	const archiveDir = path.join(paths.archiveRoot, `${archiveStamp()}-${options.label}`);
	ensureDir(archiveDir);
	for (const target of archiveTargets) {
		const destination = path.join(archiveDir, path.basename(target));
		try {
			fs.renameSync(target, destination);
		} catch (error) {
			const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
			if (code !== "EXDEV") throw error;
			fs.copyFileSync(target, destination);
			fs.rmSync(target, { force: true });
		}
	}
	return archiveDir;
}

function appendBulletToHeading(markdown: string, heading: string, bullet: string): string {
	const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const sectionPattern = new RegExp(`(## ${escapedHeading}\\n)([\\s\\S]*?)(?=\\n## |$)`);
	const match = markdown.match(sectionPattern);
	if (!match) return `${markdown.trim()}\n\n## ${heading}\n- ${bullet}\n`;
	const prefix = match[1] ?? `## ${heading}\n`;
	const body = (match[2] ?? "").replace(/^- \[empty\]\s*$/m, "").trimEnd();
	const nextBody = body === "" ? `- ${bullet}\n` : `${body}\n- ${bullet}\n`;
	return markdown.replace(sectionPattern, `${prefix}${nextBody}`);
}

function appendProgressTimeline(cwd: string, heading: string, message: string): void {
	const paths = getPaths(cwd);
	const target = paths.files["progress.md"];
	const content = readText(target) || createProgressTemplate();
	const next = appendBulletToHeading(content, heading, `[${nowIso()}] ${message}`);
	writeText(target, trimEmptyLines(next).concat("\n"));
}

function extractSection(text: string, heading: string): string | undefined {
	const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = text.match(new RegExp(`^## ${escaped}\\s*\\n+([\\s\\S]*?)(?:\\n## |$)`, "m"));
	return match?.[1]?.trim() || undefined;
}

function firstMeaningfulLine(text: string | undefined): string | undefined {
	if (!text) return undefined;
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		return trimmed.replace(/^[-*]\s*/, "");
	}
	return undefined;
}

function tailLines(text: string, count: number): string {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	return lines.slice(-count).join("\n");
}

function truncate(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n...[truncated]`;
}

function getPlanningSnapshot(cwd: string, resumedFromPreviousSession: boolean): PlanningSnapshot {
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

function summarizeDraft(state: GoalDraft): string[] {
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

function buildGoalSetPrompt(goalState: GoalOverlayState, supplementalInput?: string): string {
	const draft = goalState.draft;
	const currentGoal = goalState.goal;
	const draftSummary = summarizeDraft(draft);
	return [
		"[PLAN GOAL SET]",
		"You are clarifying or refining a goal overlay for planning-files-runtime.",
		"Do NOT start substantive implementation in this turn.",
		"The durable goal overlay lives in .pi/planning/.goal-state.json. Do not edit that file directly; use save_plan_goal_draft or commit_plan_goal.",
		"Minimal read-only reconnaissance is allowed when it materially improves the goal contract.",
		"The contract is only ready when objective, success criteria, constraints, out-of-scope, and blocker rule are all concrete.",
		"If the contract is incomplete, ask exactly one focused next question or save the partial draft.",
		"If the contract is complete, call commit_plan_goal and stop.",
		"",
		`Current goal overlay status: ${goalState.status}`,
		...(currentGoal ? ["", "Committed goal:", `- Objective: ${currentGoal.objective}`] : []),
		...(currentGoal?.successCriteria.length ? [`- Success criteria: ${currentGoal.successCriteria.join("; ")}`] : []),
		...(currentGoal?.constraints.length ? [`- Constraints: ${currentGoal.constraints.join("; ")}`] : []),
		...(currentGoal?.outOfScope.length ? [`- Out of scope: ${currentGoal.outOfScope.join("; ")}`] : []),
		...(currentGoal?.blockerRule ? [`- If blocked: ${currentGoal.blockerRule}`] : []),
		"",
		"Current draft state:",
		...(draftSummary.length > 0 ? draftSummary : ["- (empty draft)"]),
		...(supplementalInput ? ["", "New user input for this drafting step:", supplementalInput] : []),
	].join("\n");
}

function buildGoalImplPrompt(state: PlanningSnapshot, mode: "start" | "resume" | "continue"): string {
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

function buildInjectedContext(state: PlanningSnapshot): string | undefined {
	if (!state.exists && state.goalState.status === "none") return undefined;
	const taskPlan = truncate(readText(state.files["task_plan.md"]), 2000);
	const findings = truncate(tailLines(readText(state.files["findings.md"]), 20), 1200);
	const progress = truncate(tailLines(readText(state.files["progress.md"]), 20), 1200);
	const goalLines: string[] = [];
	if (["ready", "active", "paused", "complete"].includes(state.goalState.status) && state.goalState.goal) {
		goalLines.push(`goal overlay status: ${state.goalState.status}`);
		goalLines.push(`goal objective: ${state.goalState.goal.objective}`);
		if (state.goalState.impl.pausedReason) goalLines.push(`goal paused reason: ${state.goalState.impl.pausedReason}`);
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

function formatStatusText(state: PlanningSnapshot): string | undefined {
	const goal = state.goalState.goal;
	const shortGoal = goal?.objective ?? state.goalFromPlan;
	switch (state.goalState.status) {
		case "drafting":
			return `🎯 draft · ${state.goalState.draft.openQuestions.length || 0} open question${state.goalState.draft.openQuestions.length === 1 ? "" : "s"}`;
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

function buildWidgetLines(state: PlanningSnapshot): string[] | undefined {
	if (!state.exists && state.goalState.status === "none") return undefined;
	const lines: string[] = [];
	lines.push(`dir: ${state.planningRoot}`);
	lines.push(`planning: ${state.exists ? "initialized" : "not initialized"}`);
	if (state.goalState.status !== "none") {
		lines.push(`goal: ${state.goalState.status}`);
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

function getRedirectPath(inputPath: string, cwd: string): string | undefined {
	const normalized = inputPath.trim();
	if (!normalized) return undefined;
	const base = path.basename(normalized);
	if (!PLANNING_FILES.includes(base as PlanningFileName)) return undefined;
	const target = path.join(getPaths(cwd).root, base);
	const resolvedTarget = path.resolve(target);
	const resolvedInput = path.resolve(cwd, normalized);
	if (resolvedInput === resolvedTarget) return undefined;
	return target;
}

function redirectPlanningPath(event: { toolName: string; input: Record<string, unknown> }, cwd: string): boolean {
	if (!["read", "write", "edit"].includes(event.toolName)) return false;
	const rawPath = event.input.path;
	if (typeof rawPath !== "string") return false;
	const redirected = getRedirectPath(rawPath, cwd);
	if (!redirected) return false;
	ensureDir(getPaths(cwd).root);
	event.input.path = redirected;
	return true;
}

function isUnsafeDraftingBash(command: string): boolean {
	const trimmed = command.trim();
	if (!trimmed) return true;
	const unsafePatterns = [
		/\b(?:rm|mv|cp|mkdir|rmdir|touch|chmod|chown)\b/,
		/\b(?:git\s+(?:add|commit|push|pull|merge|rebase|checkout|switch|restore|reset|clean))\b/,
		/\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update|upgrade)\b/,
	];
	return unsafePatterns.some((pattern) => pattern.test(trimmed));
}

function isMeaningfulProgressToolCall(toolName: string, input: Record<string, unknown>): boolean {
	if (!MEANINGFUL_PROGRESS_TOOLS.has(toolName)) return false;
	if (toolName === "bash") {
		const command = typeof input.command === "string" ? input.command.trim() : "";
		if (!command || /^echo\b/.test(command)) return false;
	}
	return true;
}

function mergeDraft(current: GoalDraft, params: SaveGoalDraftParams): GoalDraft {
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
	};
	return next;
}

function goalContractFromDraft(draft: GoalDraft): GoalContract | null {
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

function setGoalStatus(cwd: string, status: GoalOverlayStatus, mutate: (state: GoalOverlayState) => GoalOverlayState): GoalOverlayState {
	const current = readGoalState(cwd);
	const next = mutate(current);
	next.status = status;
	writeGoalState(cwd, next);
	return next;
}

export default function planningFilesRuntime(pi: ExtensionAPI): void {
	let state = getPlanningSnapshot(process.cwd(), false);
	let goalProgressToolCalledThisTurn = false;
	let turnStoppedFor: string | null = null;
	let continuationQueuedFor: string | null = null;
	let continuationTimer: ReturnType<typeof setTimeout> | null = null;

	function clearContinuation(): void {
		continuationQueuedFor = null;
		if (continuationTimer) {
			clearTimeout(continuationTimer);
			continuationTimer = null;
		}
	}

	function refresh(ctx?: ExtensionContext, resumedFromPreviousSession = state.resumedFromPreviousSession): void {
		state = getPlanningSnapshot(ctx?.cwd ?? process.cwd(), resumedFromPreviousSession);
		if (!ctx?.hasUI) return;
		const statusText = formatStatusText(state);
		ctx.ui.setStatus(STATUS_KEY, statusText ? ctx.ui.theme.fg("accent", statusText) : undefined);
		const widgetLines = buildWidgetLines(state);
		ctx.ui.setWidget(WIDGET_KEY, widgetLines, { placement: "aboveEditor" });
	}

	function queueContinuation(ctx: ExtensionContext, force = false): void {
		if (state.goalState.status !== "active" || !state.goalState.goal) return;
		const runId = state.goalState.impl.runId;
		if (!force && continuationQueuedFor === `${runId}`) return;
		clearContinuation();
		continuationQueuedFor = `${runId}`;
		continuationTimer = setTimeout(() => {
			continuationTimer = null;
			const latest = getPlanningSnapshot(ctx.cwd, state.resumedFromPreviousSession);
			state = latest;
			if (latest.goalState.status !== "active" || latest.goalState.impl.runId !== runId || latest.goalState.impl.planningResetRequired) {
				continuationQueuedFor = null;
				return;
			}
			pi.sendMessage(
				{
					customType: MESSAGE_TYPE_CONTINUATION,
					content: buildGoalImplPrompt(latest, "continue"),
					display: false,
				},
				{ triggerTurn: true, deliverAs: "followUp" },
			);
		}, force ? 0 : CONTINUATION_DELAY_MS);
	}

	function startGoalDrafting(args: string, ctx: ExtensionContext): void {
		ensureDir(getPaths(ctx.cwd).root);
		const current = readGoalState(ctx.cwd);
		const supplementalInput = args.trim();
		let next = current;
		if (current.status === "none") {
			if (!supplementalInput) {
				ctx.ui.notify("Provide a topic: /plan-goal-set <goal topic>", "warning");
				return;
			}
			next = {
				...current,
				status: "drafting",
				draft: {
					...defaultGoalDraft(),
					sourceTopic: supplementalInput,
					supplementalInputs: [supplementalInput],
				},
				impl: {
					...current.impl,
					planningResetRequired: false,
					pausedReason: "",
					completedSummary: "",
				},
			};
		} else if (current.status === "drafting") {
			next = {
				...current,
				status: "drafting",
				draft: {
					...current.draft,
					supplementalInputs: supplementalInput
						? [...current.draft.supplementalInputs, supplementalInput].slice(-20)
						: current.draft.supplementalInputs,
				},
			};
		} else {
			const goal = current.goal;
			next = {
				...current,
				status: "drafting",
				draft: {
					sourceTopic: supplementalInput || goal?.objective || current.draft.sourceTopic,
					supplementalInputs: supplementalInput ? [...current.draft.supplementalInputs, supplementalInput].slice(-20) : current.draft.supplementalInputs,
					clarificationSummary: current.draft.clarificationSummary,
					objective: goal?.objective || current.draft.objective,
					successCriteria: goal?.successCriteria || current.draft.successCriteria,
					constraints: goal?.constraints || current.draft.constraints,
					outOfScope: goal?.outOfScope || current.draft.outOfScope,
					blockerRule: goal?.blockerRule || current.draft.blockerRule,
					openQuestions: current.draft.openQuestions,
					nextRecommendedQuestion: current.draft.nextRecommendedQuestion,
				},
			};
		}
		writeGoalState(ctx.cwd, next);
		clearContinuation();
		refresh(ctx, false);
		pi.sendMessage(
			{
				customType: MESSAGE_TYPE_GOAL_SET,
				content: buildGoalSetPrompt(next, supplementalInput || undefined),
				display: false,
			},
			{ triggerTurn: true },
		);
	}

	function startOrResumeGoalImpl(ctx: ExtensionContext): void {
		const current = readGoalState(ctx.cwd);
		if (!["ready", "paused", "active"].includes(current.status) || !current.goal) {
			ctx.ui.notify("No committed goal is ready to implement. Run /plan-goal-set first.", "warning");
			return;
		}

		let mode: "start" | "resume" | "continue" = "continue";
		const needsReset = current.impl.planningResetRequired || !hasPlanningFiles(ctx.cwd);
		if (current.status === "ready" && needsReset) {
			archivePlanningWorkspace(ctx.cwd, { includeGoalState: false, label: `before-goal-run-${current.impl.runId + 1}` });
			initializePlanningWorkspace(ctx.cwd, current.goal, current.impl.runId + 1);
			mode = "start";
		} else if (current.status === "paused" || needsReset) {
			if (needsReset) initializePlanningWorkspace(ctx.cwd, current.goal, current.impl.runId + 1);
			mode = "resume";
		} else {
			mode = "continue";
		}

		const next: GoalOverlayState = {
			...current,
			status: "active",
			impl: {
				...current.impl,
				runId: mode === "start" ? current.impl.runId + 1 : current.impl.runId || 1,
				planningResetRequired: false,
				initializedAt: mode === "start" ? nowIso() : current.impl.initializedAt,
				lastResumedAt: nowIso(),
				pausedReason: "",
			},
		};
		writeGoalState(ctx.cwd, next);
		appendProgressTimeline(ctx.cwd, "Timeline", mode === "start" ? `Goal implementation started (run ${next.impl.runId})` : `Goal implementation resumed (run ${next.impl.runId})`);
		clearContinuation();
		refresh(ctx, false);
		pi.sendMessage(
			{
				customType: MESSAGE_TYPE_GOAL_IMPL,
				content: buildGoalImplPrompt(getPlanningSnapshot(ctx.cwd, false), mode),
				display: false,
			},
			{ triggerTurn: true },
		);
	}

	pi.registerTool({
		name: "save_plan_goal_draft",
		label: "Save Plan Goal Draft",
		description: "Persist a partially clarified goal draft for later continuation.",
		promptSnippet: "Persist partial goal clarification for /plan-goal-set.",
		promptGuidelines: ["Use save_plan_goal_draft to persist partially clarified goal information during /plan-goal-set drafting."],
		parameters: Type.Object({
			sourceTopic: Type.Optional(Type.String({ description: "Original goal topic, if being set or corrected" })),
			clarificationSummary: Type.Optional(Type.Array(Type.String(), { description: "Short bullets summarizing what is now clear" })),
			objective: Type.Optional(Type.String({ description: "Current draft objective" })),
			successCriteria: Type.Optional(Type.Array(Type.String(), { description: "Current draft success criteria" })),
			constraints: Type.Optional(Type.Array(Type.String(), { description: "Current draft constraints" })),
			outOfScope: Type.Optional(Type.Array(Type.String(), { description: "Current draft out-of-scope items" })),
			blockerRule: Type.Optional(Type.String({ description: "What the agent should do if blocked" })),
			openQuestions: Type.Optional(Type.Array(Type.String(), { description: "Remaining open questions that still need user input" })),
			nextRecommendedQuestion: Type.Optional(Type.String({ description: "The single next question the agent most wants to ask" })),
		}),
		async execute(_toolCallId, params: SaveGoalDraftParams, _signal, _onUpdate, ctx) {
			const current = readGoalState(ctx.cwd);
			const next: GoalOverlayState = {
				...current,
				status: "drafting",
				draft: mergeDraft(current.draft, params),
			};
			writeGoalState(ctx.cwd, next);
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: `Saved goal draft with ${next.draft.openQuestions.length} open question(s).` }],
				details: { status: next.status, openQuestions: next.draft.openQuestions },
			};
		},
	});

	pi.registerTool({
		name: "commit_plan_goal",
		label: "Commit Plan Goal",
		description: "Commit a clarified goal so /plan-goal-impl can execute it.",
		promptSnippet: "Commit a fully clarified goal contract for later implementation.",
		promptGuidelines: ["Use commit_plan_goal only when the goal contract is concrete enough to start implementation later with /plan-goal-impl."],
		parameters: Type.Object({
			objective: Type.String({ description: "One-sentence goal objective" }),
			successCriteria: Type.Array(Type.String(), { description: "Observable evidence that the goal is complete" }),
			constraints: Type.Array(Type.String(), { description: "Hard constraints the implementation must respect" }),
			outOfScope: Type.Array(Type.String(), { description: "Explicitly excluded work" }),
			blockerRule: Type.String({ description: "What the agent should do if blocked" }),
		}),
		async execute(_toolCallId, params: CommitGoalParams, _signal, _onUpdate, ctx) {
			const objective = normalizeString(params.objective);
			const successCriteria = normalizeStringArray(params.successCriteria);
			const constraints = normalizeStringArray(params.constraints);
			const outOfScope = normalizeStringArray(params.outOfScope);
			const blockerRule = normalizeString(params.blockerRule);
			if (!objective || successCriteria.length === 0 || constraints.length === 0 || outOfScope.length === 0 || !blockerRule) {
				return {
					content: [{ type: "text", text: "Goal commit rejected: objective, successCriteria, constraints, outOfScope, and blockerRule must all be non-empty." }],
					isError: true,
				};
			}
			const current = readGoalState(ctx.cwd);
			const goal: GoalContract = { objective, successCriteria, constraints, outOfScope, blockerRule };
			const next: GoalOverlayState = {
				...current,
				status: "ready",
				goal,
				draft: {
					...current.draft,
					objective,
					successCriteria,
					constraints,
					outOfScope,
					blockerRule,
					openQuestions: [],
					nextRecommendedQuestion: "",
				},
				impl: {
					...current.impl,
					planningResetRequired: true,
					pausedReason: "",
					completedSummary: "",
				},
			};
			writeGoalState(ctx.cwd, next);
			turnStoppedFor = "commit_plan_goal";
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: `Committed plan goal: ${objective}` }],
				details: { status: next.status, goal },
			};
		},
	});

	pi.registerTool({
		name: "pause_plan_goal",
		label: "Pause Plan Goal",
		description: "Pause the active goal implementation because of a real blocker.",
		promptSnippet: "Pause the active goal run when a real blocker prevents the next reasonable step.",
		promptGuidelines: ["Use pause_plan_goal instead of just chatting when a real blocker stops goal implementation."],
		parameters: Type.Object({
			reason: Type.String({ description: "Concrete blocker reason" }),
			suggestedAction: Type.Optional(Type.String({ description: "Suggested next user action" })),
		}),
		async execute(_toolCallId, params: PauseGoalParams, _signal, _onUpdate, ctx) {
			const reason = normalizeString(params.reason);
			const suggestedAction = normalizeString(params.suggestedAction);
			const current = readGoalState(ctx.cwd);
			if (current.status !== "active" || !current.goal) {
				return {
					content: [{ type: "text", text: "pause_plan_goal rejected: no active goal implementation is running." }],
					isError: true,
				};
			}
			if (!reason) {
				return {
					content: [{ type: "text", text: "pause_plan_goal rejected: reason is required." }],
					isError: true,
				};
			}
			const next: GoalOverlayState = {
				...current,
				status: "paused",
				impl: {
					...current.impl,
					pausedReason: reason,
				},
			};
			writeGoalState(ctx.cwd, next);
			appendProgressTimeline(ctx.cwd, "Blockers / Interruptions", `Goal paused: ${reason}${suggestedAction ? ` | suggested action: ${suggestedAction}` : ""}`);
			appendProgressTimeline(ctx.cwd, "Timeline", `Goal implementation paused: ${reason}`);
			clearContinuation();
			turnStoppedFor = "pause_plan_goal";
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: `Paused plan goal: ${reason}` }],
				details: { status: next.status, reason, suggestedAction },
			};
		},
	});

	pi.registerTool({
		name: "complete_plan_goal",
		label: "Complete Plan Goal",
		description: "Mark the active goal implementation complete.",
		promptSnippet: "Complete the active goal run after success criteria are truly satisfied and evidence is recorded.",
		promptGuidelines: ["Use complete_plan_goal only after the committed goal has been achieved and progress.md contains completion evidence."],
		parameters: Type.Object({
			summary: Type.String({ description: "Completion summary" }),
			evidence: Type.Optional(Type.Array(Type.String(), { description: "Concrete evidence that the goal is complete" })),
		}),
		async execute(_toolCallId, params: CompleteGoalParams, _signal, _onUpdate, ctx) {
			const summary = normalizeString(params.summary);
			const evidence = normalizeStringArray(params.evidence);
			const current = readGoalState(ctx.cwd);
			if (current.status !== "active" || !current.goal) {
				return {
					content: [{ type: "text", text: "complete_plan_goal rejected: no active goal implementation is running." }],
					isError: true,
				};
			}
			if (!summary) {
				return {
					content: [{ type: "text", text: "complete_plan_goal rejected: summary is required." }],
					isError: true,
				};
			}
			const next: GoalOverlayState = {
				...current,
				status: "complete",
				impl: {
					...current.impl,
					completedSummary: summary,
					pausedReason: "",
				},
			};
			writeGoalState(ctx.cwd, next);
			appendProgressTimeline(ctx.cwd, "Completion Evidence", `${summary}${evidence.length > 0 ? ` | evidence: ${evidence.join("; ")}` : ""}`);
			appendProgressTimeline(ctx.cwd, "Timeline", `Goal implementation completed: ${summary}`);
			clearContinuation();
			turnStoppedFor = "complete_plan_goal";
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: `Completed plan goal: ${summary}` }],
				details: { status: next.status, summary, evidence },
			};
		},
	});

	pi.registerCommand("plan-new", {
		description: "Initialize or reset .pi/planning and clear any current goal overlay.",
		handler: async (_args, ctx) => {
			archivePlanningWorkspace(ctx.cwd, { includeGoalState: true, label: "plan-reset" });
			initializePlanningWorkspace(ctx.cwd);
			writeGoalState(ctx.cwd, defaultGoalState());
			clearContinuation();
			refresh(ctx, false);
			ctx.ui.notify("Planning workspace reset. Goal overlay cleared.", "info");
		},
	});

	pi.registerCommand("plan-goal-set", {
		description: "Create or continue clarifying a goal overlay without resetting current planning files.",
		handler: async (args, ctx) => {
			startGoalDrafting(args, ctx);
		},
	});

	pi.registerCommand("plan-goal-impl", {
		description: "Start or resume implementing the committed goal using planning files as the execution tracker.",
		handler: async (_args, ctx) => {
			startOrResumeGoalImpl(ctx);
		},
	});

	pi.on("session_start", async (event, ctx) => {
		const resumed = event.reason === "resume" || event.reason === "fork";
		refresh(ctx, resumed);
		if (!state.exists && state.goalState.status === "none") return;
		const label = resumed ? "Planning runtime resumed." : `Planning runtime attached to ${state.planningRoot}`;
		ctx.ui.notify(label, "info");
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		refresh(ctx, state.resumedFromPreviousSession);
		const injected = buildInjectedContext(state);
		if (!injected) return;
		return {
			message: {
				customType: CUSTOM_TYPE,
				content: injected,
				display: false,
			},
		};
	});

	pi.on("turn_start", async () => {
		goalProgressToolCalledThisTurn = false;
		turnStoppedFor = null;
	});

	pi.on("tool_call", async (event, ctx) => {
		if (turnStoppedFor) {
			return { block: true, reason: `${turnStoppedFor} already completed in this turn. Stop and summarize instead of calling more tools.` };
		}
		redirectPlanningPath(event as { toolName: string; input: Record<string, unknown> }, ctx.cwd);
		const latestGoalState = readGoalState(ctx.cwd);
		if (latestGoalState.status === "drafting") {
			if (["write", "edit"].includes(event.toolName)) {
				return { block: true, reason: "Goal drafting is read-only. Do not modify files until the goal is committed and /plan-goal-impl starts execution." };
			}
			if (event.toolName === "bash") {
				const command = typeof event.input.command === "string" ? event.input.command : "";
				if (isUnsafeDraftingBash(command)) {
					return { block: true, reason: "Goal drafting only allows read-only reconnaissance commands. Use save_plan_goal_draft / commit_plan_goal instead of mutating the workspace." };
				}
			}
		}
		if (isMeaningfulProgressToolCall(event.toolName, event.input as Record<string, unknown>)) {
			goalProgressToolCalledThisTurn = true;
		}
	});

	pi.on("tool_result", async (event, ctx) => {
		if (["write", "edit", ...GOAL_TOOL_NAMES].includes(event.toolName)) {
			refresh(ctx, false);
		}
	});

	pi.on("turn_end", async (event, ctx) => {
		const stopReason = (event.message as { stopReason?: string } | undefined)?.stopReason;
		if (state.goalState.status === "active" && stopReason === "aborted") {
			const paused = setGoalStatus(ctx.cwd, "paused", (current) => ({
				...current,
				impl: {
					...current.impl,
					pausedReason: "The goal run was interrupted by the user.",
				},
			}));
			appendProgressTimeline(ctx.cwd, "Blockers / Interruptions", "Goal paused because the current run was interrupted by the user.");
			state = getPlanningSnapshot(ctx.cwd, false);
			state.goalState = paused;
			clearContinuation();
			refresh(ctx, false);
			return;
		}
		refresh(ctx, false);
		if (state.goalState.status !== "active") {
			clearContinuation();
			return;
		}
		if (!goalProgressToolCalledThisTurn) {
			clearContinuation();
			return;
		}
		queueContinuation(ctx);
	});
}

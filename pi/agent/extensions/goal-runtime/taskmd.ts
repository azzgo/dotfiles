import { execFileSync } from "node:child_process";
import path from "node:path";
import type {
	GoalPhase,
	GoalRecord,
	GoalStatus,
	StoryRecord,
	TaskRecord,
	TaskTier,
	TaskmdListRecord,
} from "./types";
import { GOAL_TAG, GOALS_DIR, PHASE_STATUS, STORY_TAG, TASK_TAG } from "./types";
import {
	extractSection,
	firstMeaningfulLine,
	goalsDir,
	readFrontmatterString,
	readFrontmatterStringArray,
	readText,
	writeFrontmatterFields,
	writeText,
} from "./utils";

// ---- low-level CLI ----

export function runTaskmd(cwd: string, args: string[]): string {
	return execFileSync("taskmd", ["-d", goalsDir(cwd), ...args], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 10 * 1024 * 1024,
	});
}

export function runTaskmdJson<T>(cwd: string, args: string[]): T {
	const out = runTaskmd(cwd, [...args, "--format", "json"]);
	return JSON.parse(out) as T;
}

export function taskmdAvailable(): boolean {
	try {
		execFileSync("taskmd", ["--version"], { encoding: "utf8", stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// ---- queries ----

export function listRecords(cwd: string, opts: { tag?: string; phase?: string; parent?: string } = {}): TaskmdListRecord[] {
	const filter: string[] = [];
	if (opts.tag) filter.push(`tag=${opts.tag}`);
	if (opts.phase) filter.push(`phase=${opts.phase}`);
	if (opts.parent) filter.push(`parent=${opts.parent}`);
	const args = ["list"];
	for (const f of filter) args.push("--filter", f);
	return runTaskmdJson<TaskmdListRecord[]>(cwd, args);
}

export function listGoals(cwd: string): GoalRecord[] {
	return listRecords(cwd, { tag: GOAL_TAG }).map(normalizeGoalRecord);
}

export function listStories(cwd: string, goalId: string): StoryRecord[] {
	const stories = listRecords(cwd, { tag: STORY_TAG });
	return stories.filter((s) => s.parent === goalId);
}

export function listTasks(cwd: string, goalId?: string): TaskRecord[] {
	const tasks = listRecords(cwd, { tag: TASK_TAG });
	if (!goalId) return tasks;
	const storyIds = new Set(listStories(cwd, goalId).map((s) => s.id));
	return tasks.filter((t) => (t.parent ? storyIds.has(t.parent) : false));
}

export function getRecord(cwd: string, id: string): TaskmdListRecord | null {
	try {
		const matches = listRecords(cwd, {});
		return matches.find((r) => r.id === id) ?? null;
	} catch {
		return null;
	}
}

/** Resolve a user-supplied id (bare id, `goal:003` store-qualified, or title) to a record. */
export function resolveGoal(cwd: string, query: string): GoalRecord | null {
	const stripped = query.replace(/^goal:/, "").trim();
	if (!stripped) return null;
	let goals: GoalRecord[];
	try {
		goals = listGoals(cwd);
	} catch {
		return null;
	}
	const byId = goals.find((g) => g.id === stripped);
	if (byId) return byId;
	const byTitle = goals.find((g) => g.title.toLowerCase().includes(stripped.toLowerCase()));
	return byTitle ?? null;
}

// ---- records ----

export function normalizeGoalRecord(record: TaskmdListRecord): GoalRecord {
	const phase = (record.phase ?? "drafting") as GoalPhase;
	const status = (record.status ?? PHASE_STATUS[phase]) as GoalStatus;
	return {
		...record,
		phase,
		status,
	};
}

export function readRawRecord(cwd: string, record: TaskmdListRecord): string {
	return readText(path.join(goalsDir(cwd), record.file_path));
}

export function readGoalDetail(cwd: string, goal: GoalRecord): GoalRecord {
	const content = readRawRecord(cwd, goal);
	return {
		...goal,
		body: content,
		sourceTopic: readFrontmatterString(content, "source_topic"),
		draftingStage: (readFrontmatterString(content, "drafting_stage") as GoalRecord["draftingStage"]) ?? undefined,
		openQuestions: readFrontmatterStringArray(content, "open_questions"),
		nextRecommendedQuestion: readFrontmatterString(content, "next_recommended_question"),
		clarificationSummary: readFrontmatterStringArray(content, "clarification_summary"),
		runCount: Number(readFrontmatterString(content, "run_count") ?? "0") || 0,
	};
}

export function writeGoalDraftFields(cwd: string, goal: GoalRecord, fields: Record<string, string | string[]>): void {
	const filePath = path.join(goalsDir(cwd), goal.file_path);
	const next = writeFrontmatterFields(readText(filePath), fields);
	writeText(filePath, next);
}

/** Replace a record's body (markdown after the frontmatter block), preserving frontmatter. */
export function overwriteRecordBody(cwd: string, record: TaskmdListRecord, body: string): void {
	const filePath = path.join(goalsDir(cwd), record.file_path);
	const raw = readText(filePath);
	const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
	const head = match ? match[0] : "";
	writeText(filePath, `${head}${body}`);
}

// ---- creation / mutation ----
// ---- creation / mutation ----

export type CreateRecordOptions = {
	tags: string[];
	parent?: string;
	dependsOn?: string[];
	phase?: string;
	status?: string;
};

export function createRecord(cwd: string, title: string, opts: CreateRecordOptions): string {
	const args = ["add", title, "--tags", opts.tags.join(",")];
	if (opts.parent) args.push("--parent", opts.parent);
	if (opts.dependsOn && opts.dependsOn.length > 0) args.push("--depends-on", opts.dependsOn.join(","));
	if (opts.phase) args.push("--phase", opts.phase);
	if (opts.status) args.push("--status", opts.status);
	const out = runTaskmdJson<{ id: string }>(cwd, args);
	return out.id;
}

export function setFields(cwd: string, id: string, fields: Record<string, string>): void {
	const args = ["set", id];
	for (const [key, value] of Object.entries(fields)) {
		args.push(`--${key}`, value);
	}
	runTaskmd(cwd, args);
}

/**
 * Lifecycle transition: phase is the source of truth, status is the derived
 * projection onto taskmd's closed set (board / next / validate compatibility).
 */
export function transitionPhase(cwd: string, id: string, phase: GoalPhase): void {
	setFields(cwd, id, { phase, status: PHASE_STATUS[phase] });
}

// ---- dependency graph / parallel tiers ----

type GraphJson = {
	edges: { from: string; to: string }[];
	nodes: { id: string; title: string; status: string }[];
};

/**
 * Compute execution tiers from the task dependency graph of one Goal's Tasks.
 * Tier 0 = no unmet hard deps; tasks in the same tier may run in parallel.
 * Edges are directional: `B --depends-on A` means B waits for A (edge from A to B).
 */
export function computeTaskTiers(cwd: string, goalId: string): TaskTier[] {
	const tasks = listTasks(cwd, goalId);
	if (tasks.length === 0) return [];
	const taskIds = new Set(tasks.map((t) => t.id));
	const edges = new Map<string, Set<string>>(); // dep -> blocked
	const inDegree = new Map<string, number>();
	for (const t of tasks) inDegree.set(t.id, 0);
	for (const t of tasks) {
		for (const dep of t.dependencies) {
			if (!taskIds.has(dep)) continue; // deps outside this goal's tasks are assumed satisfied
			if (!inDegree.has(dep)) inDegree.set(dep, 0);
			if (!edges.has(dep)) edges.set(dep, new Set());
			edges.get(dep)!.add(t.id);
			inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
		}
	}
	const tiers: TaskTier[] = [];
	let remaining = tasks.map((t) => t.id);
	let tier = 0;
	while (remaining.length > 0) {
		const ready = remaining.filter((id) => (inDegree.get(id) ?? 0) === 0);
		if (ready.length === 0) {
			// cycle guard: dump everything remaining into the last tier
			tiers.push({ tier, taskIds: remaining });
			break;
		}
		tiers.push({ tier, taskIds: ready });
		for (const id of ready) {
			for (const blocked of edges.get(id) ?? []) {
				inDegree.set(blocked, (inDegree.get(blocked) ?? 1) - 1);
			}
		}
		remaining = remaining.filter((id) => !ready.includes(id));
		tier += 1;
	}
	return tiers;
}

// ---- contract validation ----

export type GoalContract = {
	objective: string;
	successCriteria: string[];
	constraints: string[];
	outOfScope: string[];
	blockerRule: string;
};

export function readGoalContract(goal: GoalRecord): GoalContract {
	const body = goal.body ?? "";
	return {
		objective: firstMeaningfulLine(extractSection(body, "Objective")) ?? "",
		successCriteria: bullets(extractSection(body, "Success Criteria")),
		constraints: bullets(extractSection(body, "Constraints")),
		outOfScope: bullets(extractSection(body, "Out of Scope")),
		blockerRule: firstMeaningfulLine(extractSection(body, "Blocker Rule")) ?? "",
	};
}

export function goalContractComplete(contract: GoalContract): boolean {
	return (
		contract.objective.length > 0 &&
		contract.successCriteria.length > 0 &&
		contract.constraints.length > 0 &&
		contract.outOfScope.length > 0 &&
		contract.blockerRule.length > 0
	);
}

function bullets(section: string | undefined): string[] {
	if (!section) return [];
	return section
		.split(/\r?\n/)
		.map((line) => line.trim().replace(/^[-*]\s*/, ""))
		.filter((line) => line.length > 0 && !line.startsWith("[empty]"));
}

// ---- goal body template ----

export const GOAL_BODY_TEMPLATE = `## Objective

<!-- one sentence describing the end state -->

## Success Criteria

- [empty]

## Constraints

- [empty]

## Out of Scope

- [empty]

## Blocker Rule

<!-- what to do if blocked -->

## Design

### As-Is Analysis

<!-- stages 1-2: real paths, APIs, schema, components; recommended approach; rejected alternatives -->

### Recommended Approach

### Rejected Alternatives

## Drafting Notes

<!-- transient drafting state (source topic, open questions). Frontmatter: source_topic, drafting_stage, open_questions, next_recommended_question -->
`;

export const STORY_BODY_TEMPLATE = `## What

<!-- end-to-end deliverable -->

## Layers

<!-- which layers/files this vertical slice touches -->

## Acceptance Criteria

- [empty]
`;

export const TASK_BODY_TEMPLATE = `## One-Commit Spec

<!-- what this single commit changes and why -->

## Hard Deps

<!-- upstream task ids this task strictly waits for -->

## Soft Deps

<!-- preferred ordering, not blocking -->

## TDD Marker

<!-- unit | component | integration | no -->
`;

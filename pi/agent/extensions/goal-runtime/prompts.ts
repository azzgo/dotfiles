import type { GoalRecord, GoalSnapshot, StoryRecord, TaskRecord, TaskTier } from "./types";
import { CHILD_ENV_MARKER, GOALS_DIR, TRACK_DIR } from "./types";
import { computeTaskTiers, listStories, listTasks, readGoalContract, readGoalDetail, resolveGoal } from "./taskmd";
import { tailLines, truncate } from "./utils";

function goalLine(goal: GoalRecord): string {
	const stage = goal.draftingStage ? ` · stage ${goal.draftingStage}` : "";
	const openQ = goal.openQuestions && goal.openQuestions.length > 0 ? ` · ${goal.openQuestions.length} open q` : "";
	return `${goal.id} ${goal.phase}${stage}${openQ} · ${goal.title}`;
}

// ---- /goal set (drafting) ----

export function buildGoalSetPrompt(goal: GoalRecord, supplementalInput?: string): string {
	const stage = goal.draftingStage || "as-is";
	return [
		"[GOAL SET]",
		"Focused drafting session for ONE goal. Output is taskmd records in .pi/goals/ (store is `.pi/goals`, tag family `goal` / `goal:story` / `goal:task`).",
		"Work through 4 stages. Track the current stage in the Goal record frontmatter (`drafting_stage`) — use the save_goal_draft tool or edit the frontmatter directly.",
		"Ask the user only when key info is missing. Keep notes in the Goal record `## Drafting Notes` / frontmatter.",
		"",
		"- Stage 1 as-is: read code. Map real paths, APIs, DB schema, components. Fill the Goal body contract sections (Objective / Success Criteria / Constraints / Out of Scope / Blocker Rule) and `## Design / As-Is Analysis`.",
		"- Stage 2 design: recommend 1 approach; note alternatives + why rejected. Write into `## Design / Recommended Approach` + `## Design / Rejected Alternatives`. Cover compat, rollback, test strategy.",
		"- Stage 3 story: for each vertical slice (end-to-end deliverable), `taskmd -d .pi/goals add \"<Story title>\" --tags goal:story --parent <goal-id> --status pending`, then overwrite the body with the Story template (`## What`, `## Layers`, `## Acceptance Criteria`).",
		"- Stage 4 task: break Stories into Tasks. `taskmd -d .pi/goals add \"<Task title>\" --tags goal:task --parent <story-id> [--depends-on <ids>] --status pending`, then overwrite the body with the Task template (`## One-Commit Spec`, `## Hard Deps`, `## Soft Deps`, `## TDD Marker`). 1 commit per Task. Mark TDD (unit|component|integration|no).",
		"- When the contract is complete (all 5 contract sections non-empty) AND at least one Story with at least one Task exists: call `commit_goal`.",
		"",
		"Output style: caveman. Drop filler. Tech precision. Arrow for causality.",
		"",
		`Current stage: ${stage}`,
		`Goal: ${goalLine(goal)}`,
		...(goal.sourceTopic ? [`Source topic: ${goal.sourceTopic}`] : []),
		...(goal.openQuestions && goal.openQuestions.length > 0 ? [`Open questions (${goal.openQuestions.length}): ${goal.openQuestions.join("; ")}`] : []),
		...(goal.nextRecommendedQuestion ? [`Recommended next question: ${goal.nextRecommendedQuestion}`] : []),
		...(supplementalInput ? ["", "New user input for this drafting step:", supplementalInput] : []),
	].join("\n");
}

// ---- /goal run (orchestrator) ----

export function buildGoalImplPrompt(snapshot: GoalSnapshot, goalId: string, mode: "start" | "resume" | "continue"): string {
	const goal = resolveGoal(snapshot.cwd, goalId);
	if (!goal) {
		return "[GOAL RUN]\nGoal not found. Run /goal list to see available goals.";
	}
	const contract = readGoalContract(goal);
	const stories = listStories(snapshot.cwd, goal.id);
	const tasks = listTasks(snapshot.cwd, goal.id);
	const tiers = computeTaskTiers(snapshot.cwd, goal.id);
	const findings = truncate(tailLines(snapshot.track.findings, 15), 1000);
	const progress = truncate(tailLines(snapshot.track.progress, 15), 1000);
	const queueNote = snapshot.queue.length > 0
		? `\nSerial queue after this goal: ${snapshot.queue.join(", ")} — the queue advances automatically when this goal completes (verifier pass).`
		: "";

	return [
		`[GOAL RUN mode=${mode} goal=${goal.id} runCount=${goal.runCount}]`,
		`You are the **orchestrator** for Goal ${goal.id} (${goal.title}). Goal Runtime stores Goals/Stories/Tasks as taskmd records in ${GOALS_DIR}; Track (working memory) lives in ${TRACK_DIR}/{findings,progress}.md.`,
		"",
		"Goal contract:",
		`- Objective: ${contract.objective}`,
		`- Success criteria: ${contract.successCriteria.join("; ") || "(none)"}`,
		`- Constraints: ${contract.constraints.join("; ") || "(none)"}`,
		`- Out of scope: ${contract.outOfScope.join("; ") || "(none)"}`,
		`- If blocked: ${contract.blockerRule || "(none)"}`,
		"",
		"Stories & Tasks (taskmd):",
		...(stories.length === 0 ? ["- (no stories yet)"] : stories.map((s) => `- Story ${s.id} [${s.status}] ${s.title}`)),
		...(tasks.length === 0 ? ["- (no tasks yet)"] : tasks.map((t) => `- Task ${t.id} [${t.status}]${t.dependencies.length > 0 ? ` deps=${t.dependencies.join(",")}` : ""} ${t.title}`)),
		"",
		"Execution tiers (same tier = independent, parallel-safe):",
		...(tiers.length === 0 ? ["- (no computable tiers; work top-down from stories)"] : tiers.map((t) => `- tier ${t.tier}: ${t.taskIds.join(", ")}`)),
		queueNote,
		"",
		"Execution protocol:",
		"- Re-read the Goal/Story/Task records before major decisions (`taskmd -d .pi/goals get <id>`).",
		"- **You (orchestrator) are the sole Track writer.** Update findings.md / progress.md at .pi/track/ after meaningful work, verification, blockers, completion evidence.",
		"- **Parallel execution:** independent Tasks (no hard dep within the same tier) fan out to leaf sub-agents via the `impl-with-spawn` skill — `interactive_shell` background dispatch (`mode: \"dispatch\"`, `background: true`).",
		"- **Leaf agents must be overlay-silent**: dispatch with the raw command form and the child marker env, e.g. `interactive_shell({ command: \"PI_GOAL_RUNTIME_CHILD=1 pi -p '<self-contained task prompt>'\", mode: \"dispatch\", background: true, reason: \"goal-<id>-task-<taskId>\" })`. Child agents must NOT write Track and must NOT touch goal state — they only do code work and return a summary.",
		"- Consolidate results into Track serially between tiers. Never start tier N+1 before tier N is consolidated.",
		"- Self-check against success criteria while active (this is NOT a state).",
		"- If you hit a real blocker, call `pause_goal` with a concrete reason and suggested action.",
		"- When implementation is done (success criteria satisfied, evidence in Track), call `request_goal_review` — it flips the goal to in-review and tells you how to dispatch the independent verifier. Do NOT self-verify.",
		"- NEVER advance the goal to complete yourself: do NOT call verify_goal_result (verifier-only — it rejects the orchestrator) and do NOT run `taskmd set --phase/--status` (blocked). Your terminal action is request_goal_review → in-review; only the dispatched verifier decides complete vs rework.",
		"",
		"Recent findings (tail):",
		findings || "(empty)",
		"",
		"Recent progress (tail):",
		progress || "(empty)",
	].join("\n");
}

function goalMenuLine(goal: GoalRecord, snapshot: GoalSnapshot): string {
	const detail = readGoalDetail(snapshot.cwd, goal);
	const contract = readGoalContract(detail);
	const obj = contract.objective ? ` — ${contract.objective}` : "";
	const active = goal.id === snapshot.activeGoal?.id ? " ◀ active" : "";
	const runnable = goal.phase === "ready" || goal.phase === "active" || goal.phase === "paused" ? "" : ` (not runnable: ${goal.phase})`;
	return `- ${goal.id} [${goal.phase}]${runnable}${active} ${goal.title}${obj}`;
}

// ---- /goal run (natural-language proposal) ----

export function buildGoalRunProposalPrompt(snapshot: GoalSnapshot, intent: string): string {
	const cleanIntent = intent.trim();
	return [
		"[GOAL RUN]",
		"The user wants to start or resume a goal. Pick from the menu below. Goals are NEVER run in parallel — multiple goals form a SERIAL queue (one active at a time; the next auto-activates after the current one is verified complete). Say so explicitly if the user asks for parallel.",
		"",
		"Goal menu (id [phase] title — objective):",
		...(snapshot.goals.length === 0
			? ["- (no goals yet; tell the user to run `/goal set <topic>` first)"]
			: snapshot.goals.map((g) => goalMenuLine(g, snapshot))),
		...(snapshot.queue.length > 0 ? ["", `Current serial queue: ${snapshot.queue.join(", ")}`] : []),
		"",
		"Rules:",
		"- Only propose goals whose phase is ready / active / paused. drafting must be finished + committed (`commit_goal`) first; in-review is awaiting the verifier; complete / abandoned are done.",
		`- User intent: ${cleanIntent ? `\"${cleanIntent}\"` : "(none given — recommend the single best candidate and say why)"}`,
		"- Match by title / topic / objective. NEVER ask the user for a taskmd id — the id is internal.",
		"- Present a SHORT proposal: which goal(s), one line why, and (if >1) that they run serially in that order. Then STOP and wait for the user to confirm.",
		"- On confirmation, call `activate_goal({ goalId, queue })`. goalId = the menu id of the first goal; queue = optional array of further goal ids to enqueue in order.",
		"- If nothing matches, say so and suggest `/goal set <topic>`.",
	].join("\n");
}

// ---- /goal review (natural-language proposal) ----

export function buildGoalReviewProposalPrompt(snapshot: GoalSnapshot, intent: string): string {
	const cleanIntent = intent.trim();
	const reviewable = snapshot.goals.filter((g) => g.phase === "active" || g.phase === "paused");
	return [
		"[GOAL REVIEW]",
		"The user wants to send a goal to independent verification (phase active / paused -> in-review). The orchestrator may NOT self-verify; a dispatched read-only verifier resolves it.",
		"",
		"Reviewable goals (active or paused):",
		...(reviewable.length === 0
			? ["- (none; a goal must be active or paused to enter review)"]
			: reviewable.map((g) => `- ${g.id} [${g.phase}] ${g.title}`)),
		"",
		"All goals for context:",
		...(snapshot.goals.length === 0 ? ["- (none)"] : snapshot.goals.map((g) => `- ${g.id} [${g.phase}] ${g.title}`)),
		"",
		"Rules:",
		`- User intent: ${cleanIntent ? `\"${cleanIntent}\"` : "(none — recommend the active goal, if any)"}`,
		"- Match by title / topic. NEVER ask the user for an id.",
		"- Propose which goal to review, one line why. Then STOP and wait for confirmation.",
		"- On confirmation, call `request_goal_review({ goalId, summary })`. Do NOT dispatch the verifier yourself unless that tool's response tells you to.",
	].join("\n");
}

// ---- verification ----

/**
 * Brief for the independent read-only verifier sub-agent. The verifier is
 * dispatched overlay-silent (PI_GOAL_RUNTIME_CHILD=1) and resolves the goal's
 * in-review phase via the verify_goal_result tool.
 */
export function buildReviewBrief(snapshot: GoalSnapshot, goalId: string): string {
	const goal = resolveGoal(snapshot.cwd, goalId);
	if (!goal) return "Goal not found.";
	const contract = readGoalContract(goal);
	const stories = listStories(snapshot.cwd, goal.id);
	const tasks = listTasks(snapshot.cwd, goal.id);
	const progress = truncate(tailLines(snapshot.track.progress, 25), 1500);
	return [
		`[GOAL REVIEW] Independent verifier for Goal ${goal.id} (${goal.title}), currently phase=in-review.`,
		"You are a **read-only verifier** — do NOT modify production code, Track, or goal state except via the verify_goal_result tool.",
		"",
		"Contract:",
		`- Objective: ${contract.objective}`,
		`- Success criteria: ${contract.successCriteria.join("; ") || "(none)"}`,
		`- Constraints: ${contract.constraints.join("; ") || "(none)"}`,
		`- Out of scope: ${contract.outOfScope.join("; ") || "(none)"}`,
		"",
		"Scope of evidence:",
		"- Read the Goal record (`taskmd -d .pi/goals get ${goal.id}`), its Stories, its Tasks.",
		"- Read Track progress.md / findings.md at .pi/track/ (completion evidence lives there).",
		"- Inspect the actual code changes (git log/diff) against each success criterion.",
		"- Run `taskmd -d .pi/goals verify <task-id>` for tasks that carry verify hooks, if any.",
		"",
		`Stories: ${stories.map((s) => `${s.id} [${s.status}] ${s.title}`).join("; ") || "(none)"}`,
		`Tasks: ${tasks.map((t) => `${t.id} [${t.status}] ${t.title}`).join("; ") || "(none)"}`,
		"",
		"Progress tail:",
		progress || "(empty)",
		"",
		"Decision:",
		"- The VERIFY_TOKEN line at the end of this brief is required: pass it to verify_goal_result as the `token` argument. It proves you (the dispatched verifier) read this brief.",
		"- PASS (all success criteria verifiably met): call `verify_goal_result({ goalId: \"" + goal.id + "\", token: <VERIFY_TOKEN below>, pass: true, evidence: [...] })`.",
		"- FAIL (something is missing or broken): call `verify_goal_result({ goalId: \"" + goal.id + "\", token: <VERIFY_TOKEN below>, pass: false, evidence: [...] })` — this sends the goal back to active for rework.",
		"- Then stop; report a one-line verdict.",
	].join("\n");
}

// ---- /track update ----

export function buildTrackUpdatePrompt(snapshot: GoalSnapshot): string {
	const active = snapshot.activeGoal;
	return [
		"[TRACK UPDATE]",
		"Refresh Track (.pi/track/findings.md + .pi/track/progress.md) with current workspace context.",
		"Track is flat working memory — NOT taskmd, never on the board. Do NOT create or write findings.md / progress.md anywhere else.",
		`- findings.md: ${snapshot.trackDir}/findings.md`,
		`- progress.md: ${snapshot.trackDir}/progress.md`,
		"",
		"## Continuity Check",
		"Compare actual progress & findings against what's recorded:",
		"- Is the last recorded progress a continuation of what you're doing now?",
		"- Are findings/decisions still valid in the current context?",
		"- Are there new findings or progress not yet recorded?",
		"",
		"### If it IS a continuation",
		"Use write/edit at the exact paths above: findings.md append new discoveries; progress.md append new progress (Timeline / Work Completed / Verification / Blockers / Completion Evidence).",
		"",
		"### If it is NOT a continuation (progress doesn't align, context changed, old records stale)",
		"Don't write yet. Ask the user: 1. **reset** — `/track new` then write fresh content; 2. **write-anyway** — append despite discontinuity; 3. **abort** — don't write.",
		"",
		"## Current Goal State",
		...(active
			? [`Active: ${active.id} [${active.phase}] ${active.title}`, `Run count: ${active.runCount ?? 0}`]
			: ["No active goal."]),
		...(snapshot.draftingGoal ? [`Drafting: ${snapshot.draftingGoal.id} [stage ${snapshot.draftingGoal.draftingStage ?? "as-is"}] ${snapshot.draftingGoal.title}`] : []),
		...(snapshot.queue.length > 0 ? [`Queue: ${snapshot.queue.join(", ")}`] : []),
		"",
		"## findings.md (tail)",
		tailLines(snapshot.track.findings, 30) || "(missing)",
		"",
		"## progress.md (tail)",
		tailLines(snapshot.track.progress, 30) || "(missing)",
	].join("\n");
}

// ---- list / status / smart entry ----

export function buildGoalListText(snapshot: GoalSnapshot): string {
	if (snapshot.goals.length === 0) {
		return "[GOAL LIST]\nNo goals yet in .pi/goals. Run `/goal set <topic>` to create the first one.";
	}
	const lines = [
		"[GOAL LIST]",
		`Store: ${GOALS_DIR} (taskmd) · Track: ${TRACK_DIR}`,
		"",
		...snapshot.goals.map((g) => {
			const q = g.id === snapshot.activeGoal?.id ? " ◀ active" : "";
			return `- ${g.id} ${g.phase}${g.draftingStage ? `(stage ${g.draftingStage})` : ""} · ${g.title}${q}`;
		}),
		...(snapshot.queue.length > 0 ? ["", `Serial queue: ${snapshot.queue.join(", ")}`] : []),
	];
	return lines.join("\n");
}

/** Warning when more than one goal is phase=active (should never happen via the runtime; indicates a hand-edit). */
export function multiActiveWarn(snapshot: GoalSnapshot): string | undefined {
	const actives = snapshot.goals.filter((g) => g.phase === "active");
	if (actives.length <= 1) return undefined;
	return `⚠ ${actives.length} goals are active (${actives.map((g) => g.id).join(", ")}) — one-active is exclusive. Pick one: e.g. /goal run <id> to activate only it, or /goal abandon <id> for the others.`;
}

export function buildGoalStatusText(snapshot: GoalSnapshot, goalId?: string): string {
	const warn = multiActiveWarn(snapshot);
	const target = goalId
		? resolveGoal(snapshot.cwd, goalId)
		: snapshot.activeGoal ?? snapshot.draftingGoal ?? snapshot.goals.at(-1) ?? null;
	if (!target) {
		return "[GOAL STATUS]\nNo goal selected and none active/drafting. Run /goal list.";
	}
	const contract = readGoalContract(target);
	const stories = listStories(snapshot.cwd, target.id);
	const tasks = listTasks(snapshot.cwd, target.id);
	const lines = [
		`[GOAL STATUS] ${target.id} ${target.phase} (status ${target.status}) · ${target.title}`,
		...(warn ? [warn] : []),
		...(target.sourceTopic ? [`Source topic: ${target.sourceTopic}`] : []),
		`Objective: ${contract.objective || "(not set)"}`,
		`Success criteria (${contract.successCriteria.length}): ${contract.successCriteria.join("; ") || "(none)"}`,
		`Constraints (${contract.constraints.length}): ${contract.constraints.join("; ") || "(none)"}`,
		`Out of scope (${contract.outOfScope.length}): ${contract.outOfScope.join("; ") || "(none)"}`,
		`Blocker rule: ${contract.blockerRule || "(not set)"}`,
		...(target.draftingStage ? [`Drafting stage: ${target.draftingStage}`] : []),
		...(target.openQuestions && target.openQuestions.length > 0 ? [`Open questions: ${target.openQuestions.join("; ")}`] : []),
		...(target.nextRecommendedQuestion ? [`Next recommended question: ${target.nextRecommendedQuestion}`] : []),
		`Stories: ${stories.map((s) => `${s.id} [${s.status}] ${s.title}`).join("; ") || "(none)"}`,
		`Tasks: ${tasks.map((t) => `${t.id} [${t.status}] ${t.title}`).join("; ") || "(none)"}`,
	];
	return lines.join("\n");
}

export function buildTrackStatusText(snapshot: GoalSnapshot): string {
	return [
		"[TRACK STATUS]",
		`Track dir: ${snapshot.trackDir}`,
		`exists: ${snapshot.track.exists}`,
		...(snapshot.activeGoal ? [`active goal: ${snapshot.activeGoal.id} [${snapshot.activeGoal.phase}] ${snapshot.activeGoal.title}`] : []),
		"",
		"## findings.md (tail)",
		tailLines(snapshot.track.findings, 20) || "(missing)",
		"",
		"## progress.md (tail)",
		tailLines(snapshot.track.progress, 20) || "(missing)",
	].join("\n");
}

export function buildGoalSmartEntryPrompt(snapshot: GoalSnapshot): string {
	const warn = multiActiveWarn(snapshot);
	return [
		"[GOAL SMART ENTRY]",
		...(warn ? [warn] : []),
		"Inspect the goal state below and route to the right next action:",
		"- drafting goal exists → continue that drafting session (`/goal set <topic>` semantics).",
		"- active goal exists → continue implementation (`/goal run` semantics; resume the active goal).",
		"- ready goal exists, nothing active → recommend `/goal run <id>`.",
		"- nothing exists → ask the user for a topic to run `/goal set <topic>`.",
		...(snapshot.queue.length > 0 ? [`- serial queue pending: ${snapshot.queue.join(", ")}`] : []),
		"",
		"Goals:",
		...(snapshot.goals.length === 0 ? ["- (none)"] : snapshot.goals.map((g) => `- ${goalLine(g)}`)),
	].join("\n");
}

// ---- helper export for tests ----

export const _test = { computeTaskTiers, CHILD_ENV_MARKER };

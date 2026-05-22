import fs from "node:fs";
import path from "node:path";
import { PLANNING_FILES } from "./types";
import type { GoalContract } from "./types";
import { archiveStamp, ensureDir, fileExists, getPaths, nowIso, readText, trimEmptyLines, writeText } from "./utils";

// ---- file detection ----

export function hasPlanningFiles(cwd: string): boolean {
	const paths = getPaths(cwd);
	return PLANNING_FILES.some((name) => fileExists(paths.files[name]));
}

// ---- templates ----

export function createTaskPlanTemplate(goal?: GoalContract): string {
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

export function createFindingsTemplate(goal?: GoalContract): string {
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

export function createProgressTemplate(goal?: GoalContract, runId?: number): string {
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

// ---- workspace lifecycle ----

export function initializePlanningWorkspace(cwd: string, goal?: GoalContract, runId?: number): void {
	const paths = getPaths(cwd);
	ensureDir(paths.root);
	writeText(paths.files["task_plan.md"], `${createTaskPlanTemplate(goal)}\n`);
	writeText(paths.files["findings.md"], `${createFindingsTemplate(goal)}\n`);
	writeText(paths.files["progress.md"], `${createProgressTemplate(goal, runId)}\n`);
}

export function archivePlanningWorkspace(cwd: string, options: { includeGoalState: boolean; includeGoalDesign: boolean; label: string }): string | null {
	const paths = getPaths(cwd);
	const archiveTargets = [
		...PLANNING_FILES.map((name) => paths.files[name]),
		...(options.includeGoalState ? [paths.goalState] : []),
		...(options.includeGoalDesign && fileExists(paths.goalDesign) ? [paths.goalDesign] : []),
	].filter((target) => fileExists(target));
	if (archiveTargets.length === 0 && !(options.includeGoalDesign && fileExists(paths.tasksDir))) return null;
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
	// Archive tasks/ directory if it exists (only during plan-new reset)
	if (options.includeGoalDesign && fileExists(paths.tasksDir)) {
		try {
			fs.renameSync(paths.tasksDir, path.join(archiveDir, "tasks"));
		} catch (error) {
			const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
			if (code !== "EXDEV") throw error;
			// cross-device fallback: skip (tasks dir is ephemeral)
		}
	}
	return archiveDir;
}

export function createGoalDesignSkeleton(cwd: string): void {
	const paths = getPaths(cwd);
	ensureDir(paths.root);
	ensureDir(paths.tasksDir);
	if (!fileExists(paths.goalDesign)) {
		writeText(paths.goalDesign, trimEmptyLines(`# Goal Design

## Design

## Story Breakdown

## Task Plan
`) + "\n");
	}
}

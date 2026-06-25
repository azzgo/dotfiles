import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
	CONTINUATION_DELAY_MS,
	GOAL_TOOL_NAMES,
	MESSAGE_TYPE_CONTINUATION,
	MESSAGE_TYPE_GOAL_IMPL,
	MESSAGE_TYPE_GOAL_SET,
	WIDGET_KEY,
} from "./types";
import type {
	CommitGoalParams,
	CompleteGoalParams,
	GoalOverlayState,
	GoalOverlayStatus,
	PauseGoalParams,
	PlanningSnapshot,
	SaveGoalDraftParams,
} from "./types";

import { ensureDir, fileExists, getPaths, normalizeString, normalizeStringArray, nowIso, readText, tailLines } from "./utils";
import { defaultGoalDraft, defaultGoalState, readGoalState, writeGoalState } from "./state";
import { archivePlanningWorkspace, createGoalDesignSkeleton, hasPlanningFiles, initializePlanningWorkspace } from "./workspace";
import { appendProgressTimeline } from "./markdown";
import { buildGoalImplPrompt, buildGoalSetPrompt, getPlanningSnapshot } from "./prompts";
import { buildWidgetLines } from "./ui";
import { isInPlanningDir, isMeaningfulProgressToolCall, isUnsafeDraftingBash, redirectPlanningPath } from "./guards";
import { mergeDraft, setGoalStatus } from "./draft";

export default function planningFilesRuntime(pi: ExtensionAPI): void {
	let state = getPlanningSnapshot(process.cwd(), false);
	let goalProgressToolCalledThisTurn = false;
	let turnStoppedFor: string | null = null;
	let continuationQueuedFor: string | null = null;
	let continuationTimer: ReturnType<typeof setTimeout> | null = null;

	// ---- continuation ----

	function clearContinuation(): void {
		continuationQueuedFor = null;
		if (continuationTimer) {
			clearTimeout(continuationTimer);
			continuationTimer = null;
		}
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

	// ---- refresh UI ----

	function refresh(ctx?: ExtensionContext, resumedFromPreviousSession = state.resumedFromPreviousSession): void {
		state = getPlanningSnapshot(ctx?.cwd ?? process.cwd(), resumedFromPreviousSession);
		if (!ctx?.hasUI) return;
		const widgetLines = buildWidgetLines(state);
		ctx.ui.setWidget(WIDGET_KEY, widgetLines, { placement: "aboveEditor" });
	}

	// ---- goal lifecycle ----

	function startGoalDrafting(args: string, ctx: ExtensionContext): void {
		ensureDir(getPaths(ctx.cwd).root);
		createGoalDesignSkeleton(ctx.cwd);
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
				status: "drafting" as GoalOverlayStatus,
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
				status: "drafting" as GoalOverlayStatus,
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
				status: "drafting" as GoalOverlayStatus,
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
					draftingStage: "as-is",
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
			archivePlanningWorkspace(ctx.cwd, { includeGoalState: false, includeGoalDesign: false, label: `before-goal-run-${current.impl.runId + 1}` });
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

	// ---- tools ----

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
			draftingStage: Type.Optional(Type.String({ description: "Current drafting stage: as-is, design, story, or task" })),
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
			const goalDesignPath = getPaths(ctx.cwd).goalDesign;
			if (!fileExists(goalDesignPath) || readText(goalDesignPath).trim().length === 0) {
				return {
					content: [{ type: "text", text: "Goal commit rejected: goal-design.md must exist and be non-empty. Complete the 4 drafting stages first." }],
					isError: true,
				};
			}
			const current = readGoalState(ctx.cwd);
			const goal = { objective, successCriteria, constraints, outOfScope, blockerRule };
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
					draftingStage: "as-is",
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

	// ---- commands ----

	pi.registerCommand("plan-new", {
		description: "Initialize or reset .pi/planning and clear any current goal overlay.",
		handler: async (_args, ctx) => {
			archivePlanningWorkspace(ctx.cwd, { includeGoalState: true, includeGoalDesign: true, label: "plan-reset" });
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

	pi.registerCommand("plan-update", {
		description: "检查当前进展和发现是否与 planning files 记录的内容对齐延续。如果是，让 agent 更新 planning files；如果不是，询问用户是否要 reset 再写，还是先中断。",
		handler: async (_args, ctx) => {
			const snapshot = getPlanningSnapshot(ctx.cwd, state.resumedFromPreviousSession);
			state = snapshot;

			if (!snapshot.exists) {
				ctx.ui.notify("没有 planning files，无需更新。", "info");
				return;
			}

			pi.sendMessage(
				{
					customType: "planning-files-runtime-update-context",
					content: [
						"[PLAN UPDATE]",
						"Refresh planning files (task_plan.md, findings.md, progress.md) with current workspace context.",
						"",
						"## Planning File Location (REQUIRED)",
						`All planning files for this project live under ${snapshot.planningRoot}.`,
						"Do NOT create or write task_plan.md, findings.md, or progress.md anywhere else (e.g. repo root or docs/).",
						"Always write/edit using these exact paths:",
						`- ${snapshot.files["task_plan.md"]}`,
						`- ${snapshot.files["findings.md"]}`,
						`- ${snapshot.files["progress.md"]}`,
						"",
						"## Continuity Check",
						"Compare actual progress & findings against what's recorded in planning files:",
						"- Is the last recorded progress in progress.md a continuation of what you're doing now?",
						"- Are the findings and decisions in findings.md still valid in the current context?",
						"- Is task_plan.md's phase/next-action still what you should be working on?",
						"- Are there new findings or progress not yet recorded?",
						"",
						"### If it IS a continuation",
						"Use write/edit to update the planning files at the exact paths above:",
						"- findings.md: append new discoveries",
						"- progress.md: append new progress",
						"- task_plan.md: update phase, next action, blocker, etc.",
						"",
						"### If it is NOT a continuation (progress doesn't align, context changed, old records stale)",
						"Don't write yet. Explain what changed and ask the user:",
						"1. **reset** — Archive current planning files, reinitialize, then write fresh content",
						"2. **write-anyway** — Append current context to planning files despite discontinuity",
						"3. **abort** — Don't write, wait for user decision",
						"",
						"## Current Planning State",
						`Phase: ${snapshot.currentPhase ?? "(missing)"}`,
						`Next action: ${snapshot.nextAction ?? "(missing)"}`,
						`Blocker: ${snapshot.blocker ?? "(none)"}`,
						"",
						"## task_plan.md",
						readText(snapshot.files["task_plan.md"]) || "(missing)",
						"",
						"## findings.md (tail)",
						tailLines(readText(snapshot.files["findings.md"]), 30) || "(missing)",
						"",
						"## progress.md (tail)",
						tailLines(readText(snapshot.files["progress.md"]), 30) || "(missing)",
					].join("\n"),
					display: false,
				},
				{ triggerTurn: true },
			);
		},
	});

	// ---- events ----

	pi.on("session_start", async (event, ctx) => {
		const resumed = event.reason === "resume" || event.reason === "fork";
		refresh(ctx, resumed);
		if (!state.exists && state.goalState.status === "none") return;
		const label = resumed ? "Planning runtime resumed." : `Planning runtime attached to ${state.planningRoot}`;
		ctx.ui.notify(label, "info");
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		refresh(ctx, state.resumedFromPreviousSession);
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
			if (event.toolName === "write") {
				const filePath = typeof event.input.path === "string" ? event.input.path : "";
				if (!isInPlanningDir(filePath, ctx.cwd)) {
					return { block: true, reason: "Goal drafting does not allow creating files outside .pi/planning/. Use save_plan_goal_draft / commit_plan_goal." };
				}
			}
			if (event.toolName === "edit") {
				const filePath = typeof event.input.path === "string" ? event.input.path : "";
				if (!isInPlanningDir(filePath, ctx.cwd)) {
					return { block: true, reason: "Goal drafting only allows editing files within .pi/planning/." };
				}
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

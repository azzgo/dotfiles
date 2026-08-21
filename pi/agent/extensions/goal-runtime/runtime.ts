import path from "node:path";
import { spawn } from "node:child_process";
import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
	CHILD_ENV_MARKER,
	CONTINUATION_DELAY_MS,
	GOALS_DIR,
	GOAL_TAG,
	GOAL_TOOL_NAMES,
	MESSAGE_TYPE_GOAL_CONTINUATION,
	MESSAGE_TYPE_GOAL_IMPL,
	MESSAGE_TYPE_GOAL_RUN_PROPOSE,
	MESSAGE_TYPE_GOAL_LIST,
	MESSAGE_TYPE_GOAL_REVIEW_PROPOSE,
	MESSAGE_TYPE_GOAL_SET,
	MESSAGE_TYPE_GOAL_SMART,
	MESSAGE_TYPE_GOAL_STATUS,
	MESSAGE_TYPE_TRACK_STATUS,
	MESSAGE_TYPE_TRACK_UPDATE,
	PHASE_STATUS,
	TERMINAL_PHASES,
	WIDGET_KEY,
} from "./types";
import type {
	ActivateGoalParams,
	CommitGoalParams,
	GoalPhase,
	GoalRecord,
	PauseGoalParams,
	RequestReviewParams,
	SaveGoalDraftParams,
	VerifyResultParams,
} from "./types";

import { ensureDir, goalsDir, splitFrontmatter, upsertBodySection } from "./utils";
import { appendToTrack, consumeVerifyToken, initTrack, mintVerifyToken, progressTimeline, readVerifyToken, writeVerifyBrief } from "./track";
import { getSnapshot, readQueueState, storeExists, writeQueueState } from "./state";
import {
	GOAL_BODY_TEMPLATE,
	createRecord,
	getRecord,
	listGoals,
	listStories,
	listTasks,
	normalizeGoalRecord,
	overwriteRecordBody,
	readGoalContract,
	readGoalDetail,
	readRawRecord,
	resolveGoal,
	taskmdAvailable,
	transitionPhase,
	writeGoalDraftFields,
} from "./taskmd";
import {
	buildGoalImplPrompt,
	buildGoalRunProposalPrompt,
	buildGoalListText,
	buildGoalSetPrompt,
	buildGoalSmartEntryPrompt,
	buildGoalStatusText,
	buildReviewBrief,
	buildGoalReviewProposalPrompt,
	buildTrackStatusText,
	buildTrackUpdatePrompt,
} from "./prompts";
import { buildWidgetLines } from "./ui";
import { isDirectPhaseMutationBash, isInGoalsDir, isMeaningfulProgressToolCall, isUnsafeDraftingBash, redirectTrackPath } from "./guards";

const GOAL_HELP = [
	"/goal — goal-runtime command family (taskmd-backed Goals/Stories/Tasks + flat Track)",
	"  /goal                      smart entry: inspect state and route",
	"  /goal set <topic>          one focused drafting session (stages 1-2 -> Goal body, 3 -> Stories, 4 -> Tasks)",
	"  /goal run [nl]             propose goal(s) from natural language; confirm to execute (multiple = serial queue); empty = model recommends",
	"  /goal list                 list all goals (retained, incl. completed/abandoned)",
	"  /goal status [<id>]        goal detail",
	"  /goal review [nl]          propose a goal to send to verification; confirm to execute; empty = model recommends",
	"  /goal abandon <id>         abandon a goal (terminal)",
	"  /goal ui                   open the taskmd board for the goals store",
	"  /goal help                 this help",
	"",
	"/track — flat working memory (findings.md + progress.md at .pi/track/)",
	"  /track new                 reset/init the scratchpad",
	"  /track update              reconcile track with current state",
	"  /track status              report track state (no mutation)",
].join("\n");

export default function goalRuntime(pi: ExtensionAPI): void {
	const isChild = process.env[CHILD_ENV_MARKER] === "1";
	let snapshot = getSnapshot(process.cwd());
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

	/** While a goal is active, keep nudging the orchestrator after progress turns. */
	function queueContinuation(ctx: ExtensionContext, force = false): void {
		if (isChild) return;
		const active = snapshot.activeGoal;
		if (!active || active.phase !== "active") return;
		const key = active.id;
		if (!force && continuationQueuedFor === key) return;
		clearContinuation();
		continuationQueuedFor = key;
		continuationTimer = setTimeout(() => {
			continuationTimer = null;
			const latest = getSnapshot(ctx.cwd, snapshot.resumedFromPreviousSession);
			snapshot = latest;
			const g = latest.activeGoal;
			if (!g || g.phase !== "active" || g.id !== key) {
				continuationQueuedFor = null;
				return;
			}
			pi.sendMessage(
				{
					customType: MESSAGE_TYPE_GOAL_CONTINUATION,
					content: buildGoalImplPrompt(latest, key, "continue"),
					display: false,
				},
				{ triggerTurn: true, deliverAs: "followUp" },
			);
		}, force ? 0 : CONTINUATION_DELAY_MS);
	}

	// ---- refresh ----

	function refresh(ctx?: ExtensionContext, resumedFromPreviousSession = snapshot.resumedFromPreviousSession): void {
		snapshot = getSnapshot(ctx?.cwd ?? process.cwd(), resumedFromPreviousSession);
		if (isChild || !ctx?.hasUI) return;
		const widgetLines = buildWidgetLines(snapshot);
		ctx.ui.setWidget(WIDGET_KEY, widgetLines, { placement: "aboveEditor" });
	}

	function send(content: string, customType: string, opts: { deliverAs?: "followUp" | "steer" } = {}): void {
		pi.sendMessage(
			{ customType, content, display: false },
			opts.deliverAs ? { triggerTurn: true, deliverAs: opts.deliverAs } : { triggerTurn: true },
		);
	}

	function requireTaskmd(ctx: ExtensionContext): boolean {
		if (taskmdAvailable()) return true;
		ctx.ui.notify("taskmd is required (Goal Runtime backend) but is not on PATH. Install it or explicitly authorize the agent to install it.", "warning");
		return false;
	}

	// ---- goal lifecycle ----

	function startDrafting(topic: string, ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		ensureGoalsDir(ctx.cwd);
		const existing = snapshot.draftingGoal;
		let goal: GoalRecord;
		if (existing) {
			goal = existing;
		} else {
			const cleanTopic = topic.trim();
			if (!cleanTopic) {
				ctx.ui.notify("Provide a topic: /goal set <goal topic>", "warning");
				return;
			}
			const id = createRecord(ctx.cwd, cleanTopic, { tags: [GOAL_TAG], phase: "drafting", status: PHASE_STATUS.drafting });
			const rec = getRecord(ctx.cwd, id);
			if (!rec) {
				ctx.ui.notify("Failed to create goal record.", "error");
				return;
			}
			goal = readGoalDetail(ctx.cwd, normalizeGoalRecord(rec));
			writeGoalDraftFields(ctx.cwd, goal, { source_topic: cleanTopic, drafting_stage: "as-is" });
			overwriteRecordBody(ctx.cwd, goal, GOAL_BODY_TEMPLATE);
			goal = readGoalDetail(ctx.cwd, normalizeGoalRecord(getRecord(ctx.cwd, id)!));
		}
		clearContinuation();
		refresh(ctx, false);
		send(buildGoalSetPrompt(goal, topic.trim() || undefined), MESSAGE_TYPE_GOAL_SET);
	}

	/**
	 * Activate a goal: exclusive active (auto-pause any other active goal),
	 * increment run counter, auto-reset Track, set the serial queue, and kick
	 * the orchestrator.
	 */
	function activateGoal(
		ctx: ExtensionContext,
		goal: GoalRecord,
		queueIds: string[],
		opts: { deliverAs?: "followUp" } = {},
	): void {
		if (goal.phase === "drafting") {
			ctx.ui.notify(`Goal ${goal.id} is still drafting; run /goal set to finish and commit_goal before running.`, "warning");
			return;
		}
		if (TERMINAL_PHASES.includes(goal.phase) || goal.phase === "in-review") {
			ctx.ui.notify(`Goal ${goal.id} is ${goal.phase}; it cannot be activated.`, "warning");
			return;
		}
		const fresh = getSnapshot(ctx.cwd, snapshot.resumedFromPreviousSession);
		if (fresh.activeGoal && fresh.activeGoal.id !== goal.id) {
			transitionPhase(ctx.cwd, fresh.activeGoal.id, "paused");
			progressTimeline(ctx.cwd, `Goal ${fresh.activeGoal.id} auto-paused; ${goal.id} activated (one active goal at a time)`);
		}
		const runCount = (goal.runCount ?? 0) + 1;
		writeGoalDraftFields(ctx.cwd, goal, { run_count: String(runCount) });
		transitionPhase(ctx.cwd, goal.id, "active");
		initTrack(ctx.cwd, { goalTitle: goal.title, runCount });
		writeQueueState(ctx.cwd, { current: goal.id, ids: queueIds });
		clearContinuation();
		refresh(ctx, false);
		const mode = goal.phase === "paused" ? "resume" : "start";
		send(buildGoalImplPrompt(snapshot, goal.id, mode), MESSAGE_TYPE_GOAL_IMPL, opts);
	}

	function startGoalRunProposal(intent: string, ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		if (snapshot.goals.length === 0) {
			ctx.ui.notify("No goal to run. Use /goal set <topic> first.", "warning");
			return;
		}
		send(buildGoalRunProposalPrompt(snapshot, intent), MESSAGE_TYPE_GOAL_RUN_PROPOSE);
	}

	function startGoalReviewProposal(intent: string, ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		if (snapshot.goals.length === 0) {
			ctx.ui.notify("No goals exist yet. Use /goal set <topic> first.", "warning");
			return;
		}
		// No phase-based pre-gate: the NL proposal prompt always runs so the model can
		// match user intent (incl. bare ids like '020') against the full goal list and
		// explain phase routing (e.g. a complete goal reopening for review).
		send(buildGoalReviewProposalPrompt(snapshot, intent), MESSAGE_TYPE_GOAL_REVIEW_PROPOSE);
	}

	function enterReview(ctx: ExtensionContext, goal: GoalRecord): string {
		transitionPhase(ctx.cwd, goal.id, "in-review");
		progressTimeline(ctx.cwd, `Goal ${goal.id} moved to in-review for independent verification`);
		const brief = buildReviewBrief(getSnapshot(ctx.cwd, snapshot.resumedFromPreviousSession), goal.id);
		const token = mintVerifyToken();
		writeVerifyBrief(ctx.cwd, goal.id, brief, token);
		clearContinuation();
		refresh(ctx, false);
		return token;
	}


	function abandonGoal(q: string | undefined, ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		const goal = q ? resolveGoal(ctx.cwd, q) : snapshot.activeGoal;
		if (!goal) {
			ctx.ui.notify("No goal to abandon. Pass a goal id.", "warning");
			return;
		}
		if (TERMINAL_PHASES.includes(goal.phase)) {
			ctx.ui.notify(`Goal ${goal.id} is already ${goal.phase}.`, "info");
			return;
		}
		transitionPhase(ctx.cwd, goal.id, "abandoned");
		progressTimeline(ctx.cwd, `Goal ${goal.id} abandoned`);
		clearContinuation();
		refresh(ctx, false);
		maybeAdvanceQueue(ctx);
		ctx.ui.notify(`Goal ${goal.id} abandoned (phase=abandoned, status=cancelled).`, "info");
	}

	function smartEntry(ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		send(buildGoalSmartEntryPrompt(snapshot), MESSAGE_TYPE_GOAL_SMART);
	}

	function openGoalsUi(ctx: ExtensionContext): void {
		if (!storeExists(ctx.cwd) || snapshot.goals.length === 0) {
			ctx.ui.notify("No goal store yet. Run /goal set <topic> first.", "warning");
			return;
		}
		const dir = path.resolve(goalsDir(ctx.cwd));
		const port = 8081;
		const child = spawn("taskmd", ["-d", dir, "web", "start", "--port", String(port), "--open"], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		ctx.ui.notify(`Goal board starting at http://localhost:${port} (taskmd web, .pi/goals)`, "info");
	}

	/** Advance the serial queue when the current goal reached a terminal phase. */
	function maybeAdvanceQueue(ctx: ExtensionContext): boolean {
		if (isChild) return false;
		const qs = readQueueState(ctx.cwd);
		if (!qs.current || qs.ids.length === 0) return false;
		const rec = getRecord(ctx.cwd, qs.current);
		if (!rec) {
			writeQueueState(ctx.cwd, { current: null, ids: qs.ids });
			return false;
		}
		if (!TERMINAL_PHASES.includes(rec.phase as GoalPhase)) return false;
		const nextId = qs.ids[0]!;
		const next = resolveGoal(ctx.cwd, nextId);
		if (!next) {
			writeQueueState(ctx.cwd, { current: null, ids: qs.ids.slice(1) });
			return false;
		}
		progressTimeline(ctx.cwd, `Goal ${qs.current} finished; advancing serial queue to ${next.id}`);
		activateGoal(ctx, next, qs.ids.slice(1), { deliverAs: "followUp" });
		return true;
	}

	function ensureGoalsDir(cwd: string): void {
		ensureDir(goalsDir(cwd));
	}

	// ---- tools ----

	pi.registerTool({
		name: "save_goal_draft",
		label: "Save Goal Draft",
		description: "Persist a partially clarified goal draft for later continuation (writes into the drafting Goal record). USER-TRIGGERED ONLY: use exclusively inside a /goal set session the user explicitly initiated; never start goal work on your own.",
		parameters: Type.Object({
			goalId: Type.Optional(Type.String({ description: "Goal record id (defaults to the drafting goal)" })),
			sourceTopic: Type.Optional(Type.String({ description: "Original goal topic, if being set or corrected" })),
			clarificationSummary: Type.Optional(Type.Array(Type.String(), { description: "Short bullets summarizing what is now clear" })),
			openQuestions: Type.Optional(Type.Array(Type.String(), { description: "Remaining open questions that still need user input" })),
			nextRecommendedQuestion: Type.Optional(Type.String({ description: "The single next question the agent most wants to ask" })),
			draftingStage: Type.Optional(Type.String({ description: "Current drafting stage: as-is, design, story, or task" })),
			objective: Type.Optional(Type.String({ description: "One-sentence goal objective (writes Goal body ## Objective)" })),
			successCriteria: Type.Optional(Type.Array(Type.String(), { description: "Observable success criteria (writes Goal body ## Success Criteria)" })),
			constraints: Type.Optional(Type.Array(Type.String(), { description: "Hard constraints (writes Goal body ## Constraints)" })),
			outOfScope: Type.Optional(Type.Array(Type.String(), { description: "Explicitly excluded work (writes Goal body ## Out of Scope)" })),
			blockerRule: Type.Optional(Type.String({ description: "What the agent should do if blocked (writes Goal body ## Blocker Rule)" })),
		}),
		async execute(_toolCallId, params: SaveGoalDraftParams, _signal, _onUpdate, ctx) {
			const goal = params.goalId
				? resolveGoal(ctx.cwd, params.goalId)
				: snapshot.draftingGoal;
			if (!goal) {
				return { content: [{ type: "text", text: "save_goal_draft rejected: no drafting goal found." }], isError: true, details: {} };
			}
			const fields: Record<string, string | string[]> = {};
			if (params.sourceTopic !== undefined) fields.source_topic = params.sourceTopic;
			if (params.draftingStage !== undefined) fields.drafting_stage = params.draftingStage;
			if (params.openQuestions !== undefined) fields.open_questions = params.openQuestions;
			if (params.nextRecommendedQuestion !== undefined) fields.next_recommended_question = params.nextRecommendedQuestion;
			if (params.clarificationSummary !== undefined) fields.clarification_summary = params.clarificationSummary;
			if (Object.keys(fields).length > 0) writeGoalDraftFields(ctx.cwd, goal, fields);
			// contract sections -> body
			const bodySections: Record<string, string[]> = {};
			if (params.objective !== undefined) bodySections["Objective"] = [params.objective];
			if (params.successCriteria !== undefined) bodySections["Success Criteria"] = params.successCriteria;
			if (params.constraints !== undefined) bodySections["Constraints"] = params.constraints;
			if (params.outOfScope !== undefined) bodySections["Out of Scope"] = params.outOfScope;
			if (params.blockerRule !== undefined) bodySections["Blocker Rule"] = [params.blockerRule];
			if (Object.keys(bodySections).length > 0) {
				const { body } = splitFrontmatter(readRawRecord(ctx.cwd, goal));
				let nextBody = body;
				for (const [heading, lines] of Object.entries(bodySections)) {
					nextBody = upsertBodySection(nextBody, heading, lines);
				}
				overwriteRecordBody(ctx.cwd, goal, nextBody);
			}
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: `Saved goal draft for ${goal.id} (stage ${params.draftingStage ?? goal.draftingStage ?? "as-is"}).` }],
				details: { goalId: goal.id, draftingStage: params.draftingStage ?? goal.draftingStage ?? "as-is" },
			};
		},
	});

	pi.registerTool({
		name: "commit_goal",
		label: "Commit Goal",
		description: "Commit a clarified goal (phase drafting -> ready) so /goal run can execute it. USER-TRIGGERED ONLY: use exclusively inside a /goal set session the user explicitly initiated.",
		parameters: Type.Object({
			goalId: Type.Optional(Type.String({ description: "Goal record id (defaults to the drafting goal)" })),
		}),
		async execute(_toolCallId, params: CommitGoalParams, _signal, _onUpdate, ctx) {
			const goal = params.goalId ? resolveGoal(ctx.cwd, params.goalId) : snapshot.draftingGoal;
			if (!goal) {
				return { content: [{ type: "text", text: "commit_goal rejected: no drafting goal found." }], isError: true, details: {} };
			}
			if (goal.phase !== "drafting") {
				return { content: [{ type: "text", text: `commit_goal rejected: goal ${goal.id} is ${goal.phase}, not drafting.` }], isError: true, details: {} };
			}
			const detail = readGoalDetail(ctx.cwd, goal);
			const contract = readGoalContract(detail);
			const missing: string[] = [];
			if (!contract.objective) missing.push("Objective");
			if (contract.successCriteria.length === 0) missing.push("Success Criteria");
			if (contract.constraints.length === 0) missing.push("Constraints");
			if (contract.outOfScope.length === 0) missing.push("Out of Scope");
			if (!contract.blockerRule) missing.push("Blocker Rule");
			if (missing.length > 0) {
				return {
					content: [{ type: "text", text: `commit_goal rejected: Goal body missing sections: ${missing.join(", ")}. Complete the drafting stages first.` }],
					isError: true,
					details: {},
				};
			}
			const stories = listStories(ctx.cwd, goal.id);
			const tasks = listTasks(ctx.cwd, goal.id);
			if (stories.length === 0 || tasks.length === 0) {
				return {
					content: [{ type: "text", text: "commit_goal rejected: need at least one Story and one Task record under the goal (stages 3-4)." }],
					isError: true,
					details: {},
				};
			}
			transitionPhase(ctx.cwd, goal.id, "ready");
			clearContinuation();
			turnStoppedFor = "commit_goal";
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: `Committed Goal ${goal.id}: ${contract.objective}` }],
				details: { goalId: goal.id, phase: "ready" },
			};
		},
	});

	pi.registerTool({
		name: "pause_goal",
		label: "Pause Goal",
		description: "Pause the active goal implementation because of a real blocker (phase active -> paused). USER-TRIGGERED ONLY: use exclusively inside a /goal run session the user explicitly initiated.",
		parameters: Type.Object({
			goalId: Type.Optional(Type.String({ description: "Goal record id (defaults to the active goal)" })),
			reason: Type.String({ description: "Concrete blocker reason" }),
			suggestedAction: Type.Optional(Type.String({ description: "Suggested next user action" })),
		}),
		async execute(_toolCallId, params: PauseGoalParams, _signal, _onUpdate, ctx) {
			const goal = params.goalId ? resolveGoal(ctx.cwd, params.goalId) : snapshot.activeGoal;
			if (!goal || goal.phase !== "active") {
				return { content: [{ type: "text", text: "pause_goal rejected: no active goal implementation is running." }], isError: true, details: {} };
			}
			if (!params.reason.trim()) {
				return { content: [{ type: "text", text: "pause_goal rejected: reason is required." }], isError: true, details: {} };
			}
			transitionPhase(ctx.cwd, goal.id, "paused");
			progressTimeline(ctx.cwd, `Goal ${goal.id} paused: ${params.reason}${params.suggestedAction ? ` | suggested action: ${params.suggestedAction}` : ""}`);
			clearContinuation();
			turnStoppedFor = "pause_goal";
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: `Paused goal ${goal.id}: ${params.reason}` }],
				details: { goalId: goal.id, phase: "paused", reason: params.reason },
			};
		},
	});

	pi.registerTool({
		name: "request_goal_review",
		label: "Request Goal Review",
		description: "Mark the active goal implementation done and move it to in-review for an independent verifier (phase active -> in-review). USER-TRIGGERED ONLY: use exclusively inside a /goal run or /goal review flow the user explicitly initiated.",
		parameters: Type.Object({
			goalId: Type.Optional(Type.String({ description: "Goal record id (defaults to the active goal)" })),
			summary: Type.Optional(Type.String({ description: "Completion summary (recorded in Track)" })),
			evidence: Type.Optional(Type.Array(Type.String(), { description: "Concrete evidence that the goal is complete" })),
		}),
		async execute(_toolCallId, params: RequestReviewParams, _signal, _onUpdate, ctx) {
		const goal = params.goalId ? resolveGoal(ctx.cwd, params.goalId) : snapshot.activeGoal;
		const reviewablePhases: GoalPhase[] = ["active", "paused", "complete"];
		if (!goal || !reviewablePhases.includes(goal.phase)) {
			const reason = goal
				? `goal ${goal.id} is ${goal.phase}`
				: "no goal resolved (no active goal and no matching id)";
			return { content: [{ type: "text", text: `request_goal_review rejected: ${reason}. A goal must be active, paused, or complete to enter review.` }], isError: true, details: {} };
		}
		const reopened = goal.phase === "complete";
		if (reopened) {
			progressTimeline(ctx.cwd, `Goal ${goal.id} reopened for review (was complete without verifier pass); minting a fresh VERIFY_TOKEN`);
		}
			if (params.summary) progressTimeline(ctx.cwd, `Goal ${goal.id} implementation done: ${params.summary}`);
			if (params.evidence && params.evidence.length > 0) {
				appendToTrack(ctx.cwd, "progress.md", "Completion Evidence", `Goal ${goal.id}: ${params.evidence.join("; ")}`);
			}
			enterReview(ctx, goal);
			return {
				content: [
					{
						type: "text",
						text: [
						`Goal ${goal.id} (${goal.title}) is now phase=in-review.${reopened ? " (reopened from complete — fresh VERIFY_TOKEN minted)" : ""}`,
						`Brief written to .pi/track/verify-brief-${goal.id}.md (contains the VERIFY_TOKEN).`,
						"",
						"Dispatch the independent read-only verifier now, then STOP (do not self-verify):",
					`dispatch({ agent: "pi", prompt: "You are the independent verifier for goal ${goal.id} (child marker: PI_GOAL_RUNTIME_CHILD=1). Read .pi/track/verify-brief-${goal.id}.md and follow it exactly. Then call verify_goal_result with your verdict and the VERIFY_TOKEN from the brief.", background: true, reason: "goal-review-${goal.id}" })`,
						].join("\n"),
					},
				],
				details: { goalId: goal.id, phase: "in-review", brief: `.pi/track/verify-brief-${goal.id}.md` },
			};
		},
	});

	pi.registerTool({
		name: "verify_goal_result",
		label: "Verify Goal Result",
		description: "Resolve a goal's in-review phase: pass -> complete (sealed), fail -> back to active (rework). VERIFIER-ONLY: only the dispatched verifier sub-agent (PI_GOAL_RUNTIME_CHILD=1) may call this; the orchestrator must not self-verify.",
		parameters: Type.Object({
			goalId: Type.String({ description: "Goal record id (must be phase=in-review)" }),
			token: Type.String({ description: "One-time VERIFY_TOKEN read from the verify brief (.pi/track/verify-brief-<id>.md) — proves the caller is the dispatched verifier" }),
			pass: Type.Boolean({ description: "true = all success criteria verifiably met; false = needs rework" }),
			evidence: Type.Optional(Type.Array(Type.String(), { description: "Verifier evidence / failed checks" })),
		}),
		async execute(_toolCallId, params: VerifyResultParams, _signal, _onUpdate, ctx) {
			if (!isChild) {
				return {
					content: [{ type: "text", text: "verify_goal_result rejected: this tool is reserved for the dispatched verifier sub-agent (PI_GOAL_RUNTIME_CHILD=1). The orchestrator must NOT self-verify — when implementation is done call request_goal_review (-> in-review), then dispatch the verifier via the dispatch tool as that tool instructs, then stop." }],
					isError: true,
					details: {},
				};
			}
			const goal = resolveGoal(ctx.cwd, params.goalId);
			if (!goal) {
				return { content: [{ type: "text", text: "verify_goal_result rejected: goal not found." }], isError: true, details: {} };
			}
			if (goal.phase !== "in-review") {
				return { content: [{ type: "text", text: `verify_goal_result rejected: goal ${goal.id} is ${goal.phase}, not in-review. Only the verifier may resolve in-review.` }], isError: true, details: {} };
			}
			const expected = readVerifyToken(ctx.cwd, goal.id);
			if (!expected) {
				return {
					content: [{ type: "text", text: `verify_goal_result rejected: VERIFY_TOKEN missing or already consumed for goal ${goal.id} — each review entry allows exactly one verdict; if rework is needed a fresh token is minted by the next request_goal_review.` }],
					isError: true,
					details: {},
				};
			}
			if (!params.token || params.token.trim() !== expected) {
				return {
					content: [{ type: "text", text: `verify_goal_result rejected: VERIFY_TOKEN mismatch for goal ${goal.id}. Read the token from .pi/track/verify-brief-${goal.id}.md — only the dispatched verifier can resolve in-review.` }],
					isError: true,
					details: {},
				};
			}
			consumeVerifyToken(ctx.cwd, goal.id);
			if (params.pass) {
				transitionPhase(ctx.cwd, goal.id, "complete");
				progressTimeline(ctx.cwd, `Goal ${goal.id} verified complete (sealed)`);
				if (params.evidence && params.evidence.length > 0) {
					appendToTrack(ctx.cwd, "progress.md", "Completion Evidence", `Verifier PASS for Goal ${goal.id}: ${params.evidence.join("; ")}`);
				}
			} else {
				transitionPhase(ctx.cwd, goal.id, "active");
				progressTimeline(ctx.cwd, `Goal ${goal.id} sent back to active for rework`);
				if (params.evidence && params.evidence.length > 0) {
					appendToTrack(ctx.cwd, "progress.md", "Verification", `Verifier FAIL for Goal ${goal.id}: ${params.evidence.join("; ")}`);
				}
			}
			clearContinuation();
			refresh(ctx, false);
			return {
				content: [{ type: "text", text: params.pass ? `Goal ${goal.id} verified complete.` : `Goal ${goal.id} returned to active for rework.` }],
				details: { goalId: goal.id, phase: params.pass ? "complete" : "active" },
			};
		},
	});

	pi.registerTool({
		name: "activate_goal",
		label: "Activate Goal",
		description: "Activate a goal for execution after the user confirmed the proposal (exclusive active: auto-pauses any other active goal; serial queue if `queue` ids given). Emits the orchestrator prompt. USER-TRIGGERED ONLY: call only after the user confirmed a /goal run or /goal review proposal in chat.",
		parameters: Type.Object({
			goalId: Type.String({ description: "Goal id (from the goal menu) to activate" }),
			queue: Type.Optional(Type.Array(Type.String(), { description: "Additional goal ids to run serially after goalId, in order" })),
		}),
		async execute(_toolCallId, params: ActivateGoalParams, _signal, _onUpdate, ctx) {
			const goal = resolveGoal(ctx.cwd, params.goalId);
			if (!goal) {
				return { content: [{ type: "text", text: `activate_goal rejected: goal "${params.goalId}" not found.` }], isError: true, details: {} };
			}
			if (goal.phase === "drafting") {
				return { content: [{ type: "text", text: `activate_goal rejected: goal ${goal.id} is still drafting. Finish /goal set and commit_goal first.` }], isError: true, details: {} };
			}
			if (TERMINAL_PHASES.includes(goal.phase) || goal.phase === "in-review") {
				return { content: [{ type: "text", text: `activate_goal rejected: goal ${goal.id} is ${goal.phase}; it cannot be activated.` }], isError: true, details: {} };
			}
			const queueGoals = (params.queue ?? [])
				.map((q) => resolveGoal(ctx.cwd, q))
				.filter((g): g is GoalRecord => g !== null);
			activateGoal(ctx, goal, queueGoals.map((g) => g.id));
			turnStoppedFor = "activate_goal";
			return {
				content: [{ type: "text", text: `Goal ${goal.id} (${goal.title}) activated.${queueGoals.length > 0 ? ` Serial queue: ${queueGoals.map((g) => g.id).join(", ")}` : ""}` }],
				details: { goalId: goal.id, phase: "active", queue: queueGoals.map((g) => g.id) },
			};
		},
	});

	// ---- commands ----

	pi.registerCommand("goal", {
		description: "Goal Runtime: taskmd-backed Goals/Stories/Tasks + flat Track (set / run / list / status / review / abandon / ui).",
		handler: async (args, ctx) => {
			refresh(ctx, false);
			const trimmed = args.trim();
			const [sub, ...rest] = trimmed.split(/\s+/);
			const restStr = rest.join(" ");
			switch (sub) {
				case "":
					smartEntry(ctx);
					break;
				case "set":
					startDrafting(restStr, ctx);
					break;
				case "run":
					startGoalRunProposal(restStr, ctx);
					break;
				case "list":
					if (!requireTaskmd(ctx)) break;
					send(buildGoalListText(snapshot), MESSAGE_TYPE_GOAL_LIST);
					break;
				case "status":
					if (!requireTaskmd(ctx)) break;
					send(buildGoalStatusText(snapshot, rest[0]), MESSAGE_TYPE_GOAL_STATUS);
					break;
				case "review":
					startGoalReviewProposal(restStr, ctx);
					break;
				case "abandon":
					abandonGoal(rest[0], ctx);
					break;
				case "ui":
					openGoalsUi(ctx);
					break;
				case "help":
					ctx.ui.notify(GOAL_HELP, "info");
					break;
				default:
					ctx.ui.notify(`Unknown /goal subcommand "${sub}".\n\n${GOAL_HELP}`, "warning");
					break;
			}
		},
	});

	pi.registerCommand("track", {
		description: "Track: flat working memory (.pi/track/findings.md + progress.md). Commands: new / update / status.",
		handler: async (args, ctx) => {
			refresh(ctx, false);
			const [sub, ...rest] = args.trim().split(/\s+/);
			switch (sub ?? "") {
				case "":
				case "status":
					send(buildTrackStatusText(snapshot), MESSAGE_TYPE_TRACK_STATUS);
					break;
				case "new":
					initTrack(ctx.cwd);
					refresh(ctx, false);
					ctx.ui.notify("Track reset: .pi/track/findings.md + progress.md initialized fresh.", "info");
					break;
				case "update":
					send(buildTrackUpdatePrompt(snapshot), MESSAGE_TYPE_TRACK_UPDATE);
					break;
				default:
					ctx.ui.notify(`Unknown /track subcommand "${sub}".\n/track new | update | status`, "warning");
					break;
			}
		},
	});

	// ---- events ----

	pi.on("session_start", async (event, ctx) => {
		const resumed = event.reason === "resume" || event.reason === "fork";
		refresh(ctx, resumed);
		if (!snapshot.storeExists && !snapshot.track.exists && snapshot.goals.length === 0) return;
		const label = resumed ? "Goal Runtime resumed." : `Goal Runtime attached (${GOALS_DIR} + .pi/track).`;
		ctx.ui.notify(label, "info");
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		// User-trigger-only design: NO goal context is injected into ordinary
		// sessions. The model learns goal state only from prompts emitted by
		// explicit /goal (or /track) commands, and from continuation messages
		// while a user-started goal run is active. Only refresh the widget here.
		refresh(ctx, snapshot.resumedFromPreviousSession);
	});

	pi.on("turn_start", async () => {
		goalProgressToolCalledThisTurn = false;
		turnStoppedFor = null;
	});

	pi.on("tool_call", async (event, ctx) => {
		if (turnStoppedFor) {
			return { block: true, reason: `${turnStoppedFor} already completed in this turn. Stop and summarize instead of calling more tools.` };
		}
		redirectTrackPath(event as { toolName: string; input: Record<string, unknown> }, ctx.cwd);
		if (event.toolName === "bash") {
			const phaseCommand = typeof event.input.command === "string" ? event.input.command : "";
			if (isDirectPhaseMutationBash(phaseCommand)) {
				// resolve goal ids lazily: only goal records are lifecycle-gated
				let goalIds: Set<string> | undefined;
				try {
					goalIds = new Set(listGoals(ctx.cwd).map((g) => g.id));
				} catch {
					goalIds = undefined; // taskmd unavailable -> keep the strict block
				}
				if (isDirectPhaseMutationBash(phaseCommand, goalIds)) {
					return { block: true, reason: "Direct mutation of a GOAL record's phase/status is blocked (--done included — it aliases --status completed). Goal lifecycle transitions must go through the goal-runtime tools (commit_goal / activate_goal / pause_goal / request_goal_review / verify_goal_result), never `taskmd set --phase/--status/--done` on a goal id. Story/Task status updates via the CLI are fine. To finish a goal: call request_goal_review (-> in-review), then dispatch the verifier." };
				}
			}
		}
		if (!isChild && snapshot.activeGoal && !snapshot.draftingGoal) {
			// No hand-edits into the goal store while a run is active/in-review:
			// frontmatter phase flips here would bypass every lifecycle gate.
			if (event.toolName === "write" || event.toolName === "edit") {
				const filePath = typeof event.input.path === "string" ? event.input.path : "";
				if (isInGoalsDir(filePath, ctx.cwd)) {
					return { block: true, reason: "While a goal run is active/in-review, direct write/edit to .pi/goals/ records is blocked — lifecycle must go through goal-runtime tools. Use the taskmd CLI for story/task body updates (phase/status/--done on goals stays tool-gated)." };
				}
			}
		}
		if (!isChild && snapshot.draftingGoal) {
			if (event.toolName === "write" || event.toolName === "edit") {
				const filePath = typeof event.input.path === "string" ? event.input.path : "";
				if (!isInGoalsDir(filePath, ctx.cwd)) {
					return { block: true, reason: "Goal drafting does not allow writing outside .pi/goals/. Use write/edit on goal records or the taskmd CLI; production code changes are out of scope while drafting." };
				}
			}
			if (event.toolName === "bash") {
				const command = typeof event.input.command === "string" ? event.input.command : "";
				if (isUnsafeDraftingBash(command)) {
					return { block: true, reason: "Goal drafting only allows read-only reconnaissance and taskmd goal-store commands. No production mutations during drafting." };
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
		if (isChild) return;
		const stopReason = (event.message as { stopReason?: string } | undefined)?.stopReason;
		if (snapshot.activeGoal && stopReason === "aborted") {
			transitionPhase(ctx.cwd, snapshot.activeGoal.id, "paused");
			progressTimeline(ctx.cwd, "Goal paused because the current run was interrupted by the user.");
			clearContinuation();
			refresh(ctx, false);
			return;
		}
		refresh(ctx, false);
		// serial queue: current goal reached a terminal phase -> activate next
		if (maybeAdvanceQueue(ctx)) return;
		if (snapshot.activeGoal && goalProgressToolCalledThisTurn) {
			queueContinuation(ctx);
		} else {
			clearContinuation();
		}
	});


}

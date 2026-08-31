import path from "node:path";
import { spawn } from "node:child_process";
import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
	CHILD_ENV_MARKER,
	GOALS_DIR,
	GOAL_TAG,
	MESSAGE_TYPE_GOAL_CONTINUATION,
	MESSAGE_TYPE_GOAL_IMPL,
	MESSAGE_TYPE_GOAL_RUN_PROPOSE,
	MESSAGE_TYPE_GOAL_LIST,
	MESSAGE_TYPE_GOAL_REVIEW,
	MESSAGE_TYPE_GOAL_REVIEW_PROPOSE,
	MESSAGE_TYPE_GOAL_SET,
	MESSAGE_TYPE_GOAL_SMART,
	MESSAGE_TYPE_GOAL_STATUS,
	MESSAGE_TYPE_TRACK_CONTEXT,
	MESSAGE_TYPE_TRACK_STATUS,
	MESSAGE_TYPE_TRACK_UPDATE,
	PHASE_STATUS,
	TERMINAL_PHASES,
	WIDGET_KEY,
} from "./types";
import type { GoalPhase, GoalRecord, VerifyResultParams } from "./types";

import { ensureDir, goalsDir } from "./utils";
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
	buildTrackContextPrompt,
	buildTrackStatusText,
	buildTrackUpdatePrompt,
	buildVerifierDispatchPrompt,
} from "./prompts";
import { buildWidgetLines } from "./ui";
import { isDirectPhaseMutationBash, isInGoalsDir, isInTrackDir, isMeaningfulProgressToolCall, isUnsafeDraftingBash } from "./guards";

const GOAL_HELP = [
	"/goal — goal-runtime command family (taskmd-backed Goals/Stories/Tasks + flat Track; lifecycle is command-driven — no goal tools are exposed to the model)",
	"  /goal                      smart entry: inspect state and route",
	"  /goal set <topic>          one focused drafting session (stages 1-2 -> Goal body, 3 -> Stories, 4 -> Tasks; hand off with /goal commit)",
	"  /goal commit [<id>]        validate contract + >=1 Story + >=1 Task, drafting -> ready (default: the drafting goal)",
	"  /goal run [nl]             propose goal(s) from natural language; confirm by running /goal activate (empty = model recommends)",
	"  /goal activate <id> [ids]  activate a goal (exclusive active; extra ids form the serial queue)",
	"  /goal list                 list all goals (retained, incl. completed/abandoned)",
	"  /goal status [<id>]        goal detail",
	"  /goal review [<id>|nl]     <id> = send straight to in-review + dispatch the verifier; nl = propose which goal",
	"  /goal pause <reason>       pause the active goal (real blocker)",
	"  /goal abandon <id>         abandon a goal (terminal)",
	"  /goal ui                   open the taskmd board for the goals store",
	"  /goal help                 this help",
	"",
	"/track — flat working memory (findings.md + progress.md at .pi/track/; auto-initialized once when missing, otherwise fully manual)",
	"  /track new                 reset/init the scratchpad",
	"  /track update              reconcile track with current state",
	"  /track context             inject track context (goal state + findings/progress tails) as a user message",
	"  /track status              report track state (no mutation)",
].join("\n");

export default function goalRuntime(pi: ExtensionAPI): void {
	const isChild = process.env[CHILD_ENV_MARKER] === "1";
	let snapshot = getSnapshot(process.cwd());
	let goalProgressToolCalledThisTurn = false;
	let bgDispatchFiredThisTurn = false;
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

	/**
	 * Keep driving the orchestrator while a goal is active: after a turn that made
	 * progress (and launched NO background sub-agents), immediately re-trigger it.
	 * Event-driven wake: when the orchestrator just fired background dispatches this
	 * is NOT queued — sub-dispatch auto-notifies every completion via triggerTurn,
	 * and those notifications ARE the wake-ups (see the impl-with-spawn skill;
	 * never sleep+query poll).
	 */
	function queueContinuation(ctx: ExtensionContext): void {
		if (isChild) return;
		const active = snapshot.activeGoal;
		if (!active || active.phase !== "active") return;
		const key = active.id;
		if (continuationQueuedFor === key) return;
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
		}, 0);
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
			ctx.ui.notify(`Goal ${goal.id} is still drafting; finish /goal set and run /goal commit first.`, "warning");
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

	// ---- lifecycle commands (user-triggered) ----
	//
	// All goal lifecycle transitions live here, in command handlers the USER runs.
	// The model never gets goal-runtime tools: drafting persistence is done by
	// editing goal record files directly, and phase flips happen in these handlers
	// (deterministic validation + Track side effects, no model in the loop).

	/** `/goal commit [<id>]` — validate the drafting contract, drafting -> ready. */
	function commitGoalFromCommand(query: string | undefined, ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		const goal = query ? resolveGoal(ctx.cwd, query) : snapshot.draftingGoal;
		if (!goal) {
			ctx.ui.notify("No drafting goal found. Pass a goal id or run /goal set <topic> first.", "warning");
			return;
		}
		if (goal.phase !== "drafting") {
			ctx.ui.notify(`Goal ${goal.id} is ${goal.phase}, not drafting.`, "warning");
			return;
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
			ctx.ui.notify(`Goal ${goal.id} not committable — missing: ${missing.join(", ")}. Continue the /goal set session first.`, "warning");
			return;
		}
		if (listStories(ctx.cwd, goal.id).length === 0 || listTasks(ctx.cwd, goal.id).length === 0) {
			ctx.ui.notify(`Goal ${goal.id} not committable — need at least one Story and one Task under it (drafting stages 3-4).`, "warning");
			return;
		}
		transitionPhase(ctx.cwd, goal.id, "ready");
		progressTimeline(ctx.cwd, `Goal ${goal.id} committed via /goal commit (drafting -> ready)`);
		clearContinuation();
		refresh(ctx, false);
		ctx.ui.notify(`Committed Goal ${goal.id}: ${contract.objective} — start it with /goal activate ${goal.id}`, "info");
	}

	/** `/goal activate <id> [ids...]` — activate the first goal; extra ids join the serial queue. */
	function activateGoalFromCommand(first: string, rest: string[], ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		const goal = resolveGoal(ctx.cwd, first);
		if (!goal) {
			ctx.ui.notify(`No goal matches "${first}". Run /goal list.`, "warning");
			return;
		}
		const queueGoals: GoalRecord[] = [];
		const unresolved: string[] = [];
		for (const q of rest) {
			const g = resolveGoal(ctx.cwd, q);
			if (g) queueGoals.push(g);
			else unresolved.push(q);
		}
		activateGoal(ctx, goal, queueGoals.map((g) => g.id));
		if (unresolved.length > 0) {
			ctx.ui.notify(`Ignored unresolvable queue ids: ${unresolved.join(", ")}`, "warning");
		}
	}

	/** `/goal pause <reason>` — pause the active goal (real blocker). */
	function pauseGoalFromCommand(reason: string, ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		const goal = snapshot.activeGoal;
		if (!goal || goal.phase !== "active") {
			ctx.ui.notify("No active goal implementation to pause.", "warning");
			return;
		}
		if (!reason.trim()) {
			ctx.ui.notify("Usage: /goal pause <concrete reason>", "warning");
			return;
		}
		transitionPhase(ctx.cwd, goal.id, "paused");
		progressTimeline(ctx.cwd, `Goal ${goal.id} paused via /goal pause: ${reason}`);
		clearContinuation();
		refresh(ctx, false);
		ctx.ui.notify(`Paused goal ${goal.id}: ${reason} — resume with /goal activate ${goal.id}`, "info");
	}

	/** `/goal review <id> [note]` — send straight to in-review, then prompt the verifier dispatch. */
	function sendToReview(goal: GoalRecord, note: string | undefined, ctx: ExtensionContext): void {
		if (!requireTaskmd(ctx)) return;
		const reviewablePhases: GoalPhase[] = ["active", "paused", "complete"];
		if (!reviewablePhases.includes(goal.phase)) {
			ctx.ui.notify(`Goal ${goal.id} is ${goal.phase} — only active/paused/complete goals enter review (ready goals must run first: /goal activate ${goal.id}).`, "warning");
			return;
		}
		if (goal.phase === "complete") {
			progressTimeline(ctx.cwd, `Goal ${goal.id} reopened for review (was complete without verifier pass); minting a fresh VERIFY_TOKEN`);
		}
		if (note?.trim()) {
			progressTimeline(ctx.cwd, `Goal ${goal.id} sent to review via /goal review: ${note.trim()}`);
		}
		enterReview(ctx, goal);
		send(buildVerifierDispatchPrompt(goal.id), MESSAGE_TYPE_GOAL_REVIEW);
		ctx.ui.notify(`Goal ${goal.id} is in-review; verifier dispatch prompt queued.`, "info");
	}

	// ---- tools ----
	//
	// Intentionally near-empty: the orchestrating session registers NO goal tools.
	// verify_goal_result exists only in dispatched verifier children so the
	// orchestrator cannot even see (let alone call) it — resolution of in-review
	// stays bound to the independent verifier via the one-time VERIFY_TOKEN.

	if (isChild) {
		pi.registerTool({
			name: "verify_goal_result",
			label: "Verify Goal Result",
			description: "Resolve a goal's in-review phase: pass -> complete (sealed), fail -> back to active (rework). VERIFIER-ONLY: only the dispatched verifier sub-agent (PI_GOAL_RUNTIME_CHILD=1) may call this.",
			parameters: Type.Object({
				goalId: Type.String({ description: "Goal record id (must be phase=in-review)" }),
				token: Type.String({ description: "One-time VERIFY_TOKEN read from the verify brief (.pi/track/verify-brief-<id>.md) — proves the caller is the dispatched verifier" }),
				pass: Type.Boolean({ description: "true = all success criteria verifiably met; false = needs rework" }),
				evidence: Type.Optional(Type.Array(Type.String(), { description: "Verifier evidence / failed checks" })),
			}),
			async execute(_toolCallId, params: VerifyResultParams, _signal, _onUpdate, ctx) {
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
						content: [{ type: "text", text: `verify_goal_result rejected: VERIFY_TOKEN missing or already consumed for goal ${goal.id} — each review entry allows exactly one verdict; if rework is needed a fresh token is minted by the next /goal review.` }],
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
				// Narrow the read→consume→transition race: a concurrently re-dispatched
				// second verifier may resolve in-review first — only the first verdict
				// transitions; the loser is rejected instead of double-writing state.
				const stillInReview = resolveGoal(ctx.cwd, goal.id);
				if (!stillInReview || stillInReview.phase !== "in-review") {
					return {
						content: [{ type: "text", text: `verify_goal_result rejected: goal ${goal.id} already left in-review — another verifier resolved it first. Verdict not applied; token consumed.` }],
						isError: true,
						details: {},
					};
				}
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
	}

	// ---- commands ----

	pi.registerCommand("goal", {
		description: "Goal Runtime: taskmd-backed Goals/Stories/Tasks + flat Track (set / commit / run / activate / list / status / review / pause / abandon / ui).",
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
				case "commit":
					commitGoalFromCommand(rest[0], ctx);
					break;
				case "run":
					startGoalRunProposal(restStr, ctx);
					break;
				case "activate": {
					const first = rest[0];
					if (!first) {
						ctx.ui.notify("Usage: /goal activate <id> [<queue ids...>]", "warning");
						break;
					}
					activateGoalFromCommand(first, rest.slice(1), ctx);
					break;
				}
				case "list":
					if (!requireTaskmd(ctx)) break;
					send(buildGoalListText(snapshot), MESSAGE_TYPE_GOAL_LIST);
					break;
				case "status":
					if (!requireTaskmd(ctx)) break;
					send(buildGoalStatusText(snapshot, rest[0]), MESSAGE_TYPE_GOAL_STATUS);
					break;
				case "review": {
					// `<id>` (exact goal id) -> straight to in-review; anything else -> NL proposal.
					const first = rest[0];
					const stripped = first?.replace(/^goal:/, "") ?? "";
					const direct = stripped ? resolveGoal(ctx.cwd, first!) : null;
					if (direct && direct.id === stripped) {
						sendToReview(direct, rest.slice(1).join(" "), ctx);
					} else {
						startGoalReviewProposal(restStr, ctx);
					}
					break;
				}
				case "pause":
					pauseGoalFromCommand(restStr, ctx);
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
		description: "Track: flat working memory (.pi/track/findings.md + progress.md). Commands: new / update / context / status.",
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
				case "context":
					send(buildTrackContextPrompt(snapshot), MESSAGE_TYPE_TRACK_CONTEXT);
					break;
				default:
					ctx.ui.notify(`Unknown /track subcommand "${sub}".\n/track new | update | context | status`, "warning");
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
		refresh(ctx, snapshot.resumedFromPreviousSession);
		// Auto /track new only: at the FIRST conversation of a session the runtime
		// initializes Track when missing, so working memory exists on disk. Nothing
		// is auto-injected into the conversation — the model gets Track context
		// only when the user runs `/track context`, and reconciliation only via
		// `/track update`. Goal lifecycle stays user-trigger-only: beyond this, the
		// model learns goal state from explicit /goal prompts and from continuation
		// messages while a user-started run is active.
		if (isChild || snapshot.track.exists) return;
		initTrack(ctx.cwd);
		refresh(ctx, snapshot.resumedFromPreviousSession);
		ctx.ui.notify("Track initialized: .pi/track/findings.md + progress.md (auto /track new).", "info");
	});

	pi.on("turn_start", async () => {
		goalProgressToolCalledThisTurn = false;
		bgDispatchFiredThisTurn = false;
	});

	pi.on("tool_call", async (event, ctx) => {
		// Event-driven wake: while leaf sub-agents are in flight the turn-end
		// continuation is suppressed — their completion notifications (sub-dispatch
		// triggerTurn) are the wake-ups, never sleep+query poll.
		if (!isChild && event.toolName === "dispatch") {
			const dInput = event.input as Record<string, unknown> | undefined;
			if (dInput && dInput.background === true) bgDispatchFiredThisTurn = true;
		}
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
					return { block: true, reason: "Direct mutation of a GOAL record's phase/status is blocked (--done included — it aliases --status completed). Goal lifecycle transitions go through /goal commands run by the user (/goal commit / activate / pause / review / abandon), never `taskmd set --phase/--status/--done` on a goal id. Story/Task status updates via the CLI are fine. To finish a goal: the user runs /goal review <id> (-> in-review), then the dispatched verifier resolves it." };
				}
			}
		}
		if (!isChild && snapshot.activeGoal && !snapshot.draftingGoal) {
			// No hand-edits into the goal store while a run is active/in-review:
			// frontmatter phase flips here would bypass every lifecycle gate.
			if (event.toolName === "write" || event.toolName === "edit") {
				const filePath = typeof event.input.path === "string" ? event.input.path : "";
				if (isInGoalsDir(filePath, ctx.cwd)) {
					return { block: true, reason: "While a goal run is active/in-review, direct write/edit to .pi/goals/ records is blocked — lifecycle moves through /goal commands. Use the taskmd CLI for story/task body updates (phase/status/--done on goals stays blocked). .pi/track/ stays writable." };
				}
			}
		}
		if (!isChild && snapshot.draftingGoal) {
			if (event.toolName === "write" || event.toolName === "edit") {
				const filePath = typeof event.input.path === "string" ? event.input.path : "";
				if (!isInGoalsDir(filePath, ctx.cwd) && !isInTrackDir(filePath, ctx.cwd)) {
					return { block: true, reason: "Goal drafting allows writes only into .pi/goals/ (goal records) and .pi/track/ (working memory). Production code changes are out of scope while drafting." };
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
		if (event.toolName === "write" || event.toolName === "edit") {
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
			// Event-driven wake: no continuation while background sub-agents are in
			// flight — sub-dispatch completion notifications (triggerTurn) wake the
			// orchestrator (see impl-with-spawn; never sleep+query poll).
			if (bgDispatchFiredThisTurn) clearContinuation();
			else queueContinuation(ctx);
		} else {
			clearContinuation();
		}
	});
}

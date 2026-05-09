import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const CUSTOM_TYPE = "planning-files-runtime";
const STATUS_KEY = "planning-files-runtime";
const WIDGET_KEY = "planning-files-runtime";
const PLANNING_DIR = path.join(".pi", "planning");
const PLANNING_FILES = ["task_plan.md", "findings.md", "progress.md"] as const;
const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(EXTENSION_DIR, "../../skills/planning-with-files");
const SCRIPTS_DIR = path.join(SKILL_ROOT, "scripts");

type PlanningFileName = (typeof PLANNING_FILES)[number];
type PlanningState = {
	planningRoot: string;
	files: Record<PlanningFileName, string>;
	exists: boolean;
	currentPhase?: string;
	goal?: string;
	resumedFromPreviousSession: boolean;
};

type RuntimeState = {
	autoCatchupEnabled: boolean;
};

type ScriptResult = {
	ok: boolean;
	stdout: string;
	stderr: string;
	status: number;
};

function getPlanningRoot(cwd: string): string {
	return path.join(cwd, PLANNING_DIR);
}

function getPlanningFiles(cwd: string): Record<PlanningFileName, string> {
	const root = getPlanningRoot(cwd);
	return {
		"task_plan.md": path.join(root, "task_plan.md"),
		"findings.md": path.join(root, "findings.md"),
		"progress.md": path.join(root, "progress.md"),
	};
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

function tailLines(text: string, count: number): string {
	const lines = text.trim().split(/\r?\n/).filter(Boolean);
	return lines.slice(-count).join("\n");
}

function truncate(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n...[truncated]`;
}

function extractCurrentPhase(taskPlan: string): string | undefined {
	const match = taskPlan.match(/^## Current Phase\s*\n+(.+)$/m);
	return match?.[1]?.trim() || undefined;
}

function extractGoal(taskPlan: string): string | undefined {
	const match = taskPlan.match(/^## Goal\s*\n+([\s\S]*?)(?:\n## |$)/m);
	return match?.[1]?.trim().split(/\r?\n/)[0] || undefined;
}

function getPlanningState(cwd: string, resumedFromPreviousSession: boolean): PlanningState {
	const files = getPlanningFiles(cwd);
	const exists = PLANNING_FILES.some((name) => fileExists(files[name]));
	const taskPlan = readText(files["task_plan.md"]);
	return {
		planningRoot: getPlanningRoot(cwd),
		files,
		exists,
		currentPhase: extractCurrentPhase(taskPlan),
		goal: extractGoal(taskPlan),
		resumedFromPreviousSession,
	};
}

function summarizeState(state: PlanningState, runtimeState: RuntimeState): string[] {
	const lines = [`dir: ${state.planningRoot}`];
	if (state.goal) lines.push(`goal: ${state.goal}`);
	if (state.currentPhase) lines.push(`phase: ${state.currentPhase}`);
	lines.push(`auto-catchup: ${runtimeState.autoCatchupEnabled ? "on" : "off"}`);
	if (state.resumedFromPreviousSession) lines.push("resume: previous session detected");
	return lines;
}

function updateUi(ctx: ExtensionContext, state: PlanningState): void {
	if (!ctx.hasUI) return;
	if (!state.exists) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}

	const summary = state.currentPhase ? `🧭 ${state.currentPhase}` : "🧭 planning";
	ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("accent", summary));
}

function getRedirectPath(inputPath: string, cwd: string): string | undefined {
	const normalized = inputPath.trim();
	if (!normalized) return undefined;
	const base = path.basename(normalized);
	if (!PLANNING_FILES.includes(base as PlanningFileName)) return undefined;

	const target = path.join(getPlanningRoot(cwd), base);
	const resolvedTarget = path.resolve(target);
	const resolvedInput = path.resolve(cwd, normalized);
	const rootCandidate = path.resolve(cwd, base);

	if (resolvedInput === resolvedTarget) return undefined;
	if (normalized === base || resolvedInput === rootCandidate) return target;
	return undefined;
}

function redirectToolPath(event: { toolName: string; input: Record<string, unknown> }, cwd: string): string | undefined {
	if (!["read", "write", "edit"].includes(event.toolName)) return undefined;
	const rawPath = event.input.path;
	if (typeof rawPath !== "string") return undefined;
	const redirected = getRedirectPath(rawPath, cwd);
	if (!redirected) return undefined;
	ensureDir(getPlanningRoot(cwd));
	event.input.path = redirected;
	return redirected;
}

function buildInjectedContext(state: PlanningState): string {
	const taskPlan = truncate(readText(state.files["task_plan.md"]), 2200);
	const findings = truncate(tailLines(readText(state.files["findings.md"]), 30), 1400);
	const progress = truncate(tailLines(readText(state.files["progress.md"]), 30), 1400);
	const resumeNote = state.resumedFromPreviousSession
		? "- This session continues from a previous Pi session. Reconcile your next actions against the planning files before making changes."
		: "";

	return `[PLANNING FILES RUNTIME]\nPlanning files for this project live under ${state.planningRoot}.\nDo not use root-level task_plan.md, findings.md, or progress.md in this project. Use the .pi/planning versions only.\n\nRules:\n- Re-read the plan before major decisions.\n- Update findings.md after discoveries.\n- Update progress.md after meaningful work or verification.\n- Keep task_plan.md as the source of truth for phase status.\n${resumeNote}\n\nCurrent task plan:\n${taskPlan || "(missing)"}\n\nRecent findings tail:\n${findings || "(missing)"}\n\nRecent progress tail:\n${progress || "(missing)"}`;
}

function splitArgs(rawArgs: string): string[] {
	return rawArgs.trim() ? rawArgs.trim().split(/\s+/) : [];
}

function runProcess(command: string, args: string[], cwd: string): ScriptResult {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		env: process.env,
	});

	if (result.error) {
		return {
			ok: false,
			stdout: result.stdout ?? "",
			stderr: result.error.message,
			status: result.status ?? 1,
		};
	}

	return {
		ok: (result.status ?? 0) === 0,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		status: result.status ?? 0,
	};
}

function runShellScript(scriptName: string, cwd: string, args: string[] = []): ScriptResult {
	return runProcess("sh", [path.join(SCRIPTS_DIR, scriptName), ...args], cwd);
}

function runPythonScript(scriptName: string, cwd: string, args: string[] = []): ScriptResult {
	const scriptPath = path.join(SCRIPTS_DIR, scriptName);
	for (const candidate of ["python3", "python"]) {
		const result = runProcess(candidate, [scriptPath, ...args], cwd);
		if (result.stderr.includes("ENOENT") || result.stderr.includes("not found")) continue;
		return result;
	}
	return {
		ok: false,
		stdout: "",
		stderr: "python3/python not available",
		status: 1,
	};
}

function notifyScriptResult(ctx: ExtensionContext, title: string, result: ScriptResult): void {
	const parts = [title];
	if (result.stdout.trim()) parts.push(result.stdout.trim());
	if (result.stderr.trim()) parts.push(result.stderr.trim());
	ctx.ui.notify(parts.join("\n"), result.ok ? "info" : "error");
}

function getStoredRuntimeState(ctx: ExtensionContext): RuntimeState {
	const entries = ctx.sessionManager.getEntries();
	const runtimeEntry = entries
		.filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === CUSTOM_TYPE)
		.pop() as { data?: { autoCatchupEnabled?: boolean } } | undefined;
	return {
		autoCatchupEnabled: runtimeEntry?.data?.autoCatchupEnabled ?? true,
	};
}

function persistState(pi: ExtensionAPI, state: PlanningState, runtimeState: RuntimeState): void {
	pi.appendEntry(CUSTOM_TYPE, {
		planningRoot: state.planningRoot,
		exists: state.exists,
		currentPhase: state.currentPhase,
		goal: state.goal,
		autoCatchupEnabled: runtimeState.autoCatchupEnabled,
		updatedAt: Date.now(),
	});
}

function maybeQueueCatchup(pi: ExtensionAPI, ctx: ExtensionContext, state: PlanningState, runtimeState: RuntimeState): void {
	if (!runtimeState.autoCatchupEnabled || !state.exists || !state.resumedFromPreviousSession) return;
	const catchup = runPythonScript("session-catchup.py", ctx.cwd, [ctx.cwd]);
	const summary = catchup.stdout.trim();
	if (!catchup.ok || !summary || summary.includes("status: missing planning files")) return;
	const prompt = `Read ${state.files["task_plan.md"]}, ${state.files["findings.md"]}, and ${state.files["progress.md"]}. Reconcile the current task state from those planning files before continuing.\n\nCatchup summary:\n${summary}`;
	if (ctx.isIdle()) {
		pi.sendUserMessage(prompt);
	} else {
		pi.sendUserMessage(prompt, { deliverAs: "followUp" });
	}
	ctx.ui.notify("Queued automatic planning catchup.", "info");
}

export default function planningFilesRuntime(pi: ExtensionAPI): void {
	let state = getPlanningState(process.cwd(), false);
	let runtimeState: RuntimeState = { autoCatchupEnabled: true };

	function refresh(ctx?: ExtensionContext, resumedFromPreviousSession = state.resumedFromPreviousSession): void {
		state = getPlanningState(ctx?.cwd ?? process.cwd(), resumedFromPreviousSession);
		if (ctx?.hasUI) {
			updateUi(ctx, state);
			ctx.ui.setWidget(WIDGET_KEY, summarizeState(state, runtimeState), { placement: "aboveEditor" });
		}
	}

	pi.registerCommand("plan-new", {
		description: "Start a fresh plan in .pi/planning/ via skill scripts",
		handler: async (args, ctx) => {
			const result = runShellScript("init-session.sh", ctx.cwd, splitArgs(args));
			refresh(ctx, false);
			persistState(pi, state, runtimeState);
			notifyScriptResult(ctx, "planning initialized", result);
		},
	});

	pi.registerCommand("plan-init", {
		description: "Alias for /plan-new",
		handler: async (args, ctx) => {
			const result = runShellScript("init-session.sh", ctx.cwd, splitArgs(args));
			refresh(ctx, false);
			persistState(pi, state, runtimeState);
			notifyScriptResult(ctx, "planning initialized", result);
		},
	});

	pi.registerCommand("plan-status", {
		description: "Show current .pi/planning status",
		handler: async (_args, ctx) => {
			refresh(ctx);
			const lines = summarizeState(state, runtimeState);
			lines.push(`files present: ${PLANNING_FILES.filter((name) => fileExists(state.files[name])).join(", ") || "none"}`);
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("plan-check", {
		description: "Check plan completion status via skill script",
		handler: async (_args, ctx) => {
			const result = runShellScript("check-complete.sh", ctx.cwd);
			notifyScriptResult(ctx, "plan check", result);
		},
	});

	pi.registerCommand("plan-attest", {
		description: "Attest or inspect the current task plan",
		handler: async (args, ctx) => {
			const result = runShellScript("attest-plan.sh", ctx.cwd, splitArgs(args));
			notifyScriptResult(ctx, "plan attestation", result);
		},
	});

	pi.registerCommand("plan-catchup", {
		description: "Summarize planning state from skill script",
		handler: async (_args, ctx) => {
			const result = runPythonScript("session-catchup.py", ctx.cwd, [ctx.cwd]);
			notifyScriptResult(ctx, "plan catchup", result);
		},
	});

	pi.registerCommand("plan-autocatchup", {
		description: "Show or toggle automatic planning catchup on session start",
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (action === "on" || action === "enable") {
				runtimeState.autoCatchupEnabled = true;
				persistState(pi, state, runtimeState);
				refresh(ctx);
				ctx.ui.notify("Automatic planning catchup enabled.", "info");
				return;
			}
			if (action === "off" || action === "disable") {
				runtimeState.autoCatchupEnabled = false;
				persistState(pi, state, runtimeState);
				refresh(ctx);
				ctx.ui.notify("Automatic planning catchup disabled.", "info");
				return;
			}
			ctx.ui.notify(`Automatic planning catchup: ${runtimeState.autoCatchupEnabled ? "on" : "off"}`, "info");
		},
	});

	pi.registerCommand("plan-continue", {
		description: "Ask the agent to sync from .pi/planning before continuing",
		handler: async (_args, ctx) => {
			refresh(ctx);
			if (!state.exists) {
				ctx.ui.notify("No .pi/planning files found. Run /plan-new first.", "warning");
				return;
			}
			const catchup = runPythonScript("session-catchup.py", ctx.cwd, [ctx.cwd]);
			const summary = catchup.stdout.trim();
			const prompt = summary
				? `Read ${state.files["task_plan.md"]}, ${state.files["findings.md"]}, and ${state.files["progress.md"]}. Sync the current task state from those planning files before continuing.\n\nCatchup summary:\n${summary}`
				: `Read ${state.files["task_plan.md"]}, ${state.files["findings.md"]}, and ${state.files["progress.md"]}. Sync the current task state from those planning files before continuing.`;
			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Queued planning sync as a follow-up.", "info");
			}
		},
	});

	pi.on("session_start", async (event, ctx) => {
		runtimeState = getStoredRuntimeState(ctx);
		const resumedFromPreviousSession = event.reason === "resume" || event.reason === "fork";
		refresh(ctx, resumedFromPreviousSession);
		persistState(pi, state, runtimeState);
		if (!state.exists) return;
		const notice = resumedFromPreviousSession
			? `Planning resumed from previous session. Source: ${event.previousSessionFile ?? "previous session"}`
			: `Planning runtime attached to ${state.planningRoot}`;
		ctx.ui.notify(notice, "info");
		maybeQueueCatchup(pi, ctx, state, runtimeState);
	});

	pi.on("before_agent_start", async () => {
		if (!state.exists) return;
		return {
			message: {
				customType: CUSTOM_TYPE,
				content: buildInjectedContext(state),
				display: false,
			},
		};
	});

	pi.on("tool_call", async (event, ctx) => {
		const redirected = redirectToolPath(event as { toolName: string; input: Record<string, unknown> }, ctx.cwd);
		if (!redirected) return;
		refresh(ctx);
		ctx.ui.notify(`Redirected planning file to ${redirected}`, "info");
	});

	pi.on("tool_result", async (event, ctx) => {
		if (!["write", "edit"].includes(event.toolName)) return;
		refresh(ctx);
		persistState(pi, state, runtimeState);
	});

	pi.on("turn_end", async (_event, ctx) => {
		refresh(ctx);
		persistState(pi, state, runtimeState);
	});
}

import fs from "node:fs";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const CUSTOM_TYPE = "planning-files-runtime";
const STATUS_KEY = "planning-files-runtime";
const WIDGET_KEY = "planning-files-runtime";
const PLANNING_DIR = path.join(".pi", "planning");
const PLANNING_FILES = ["task_plan.md", "findings.md", "progress.md"] as const;

type PlanningFileName = (typeof PLANNING_FILES)[number];
type PlanningState = {
	planningRoot: string;
	files: Record<PlanningFileName, string>;
	exists: boolean;
	currentPhase?: string;
	goal?: string;
	resumedFromPreviousSession: boolean;
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

function buildTaskPlanTemplate(date: string): string {
	return `# Task Plan: [Brief Description]\n\n## Goal\n[One sentence describing the end state]\n\n## Current Phase\nPhase 1\n\n## Phases\n\n### Phase 1: Requirements & Discovery\n- [ ] Understand user intent\n- [ ] Identify constraints\n- [ ] Document in findings.md\n- **Status:** in_progress\n\n### Phase 2: Planning & Structure\n- [ ] Define approach\n- [ ] Create project structure\n- **Status:** pending\n\n### Phase 3: Implementation\n- [ ] Execute the plan\n- [ ] Keep planning files in .pi/planning/\n- **Status:** pending\n\n### Phase 4: Testing & Verification\n- [ ] Verify requirements met\n- [ ] Document test results\n- **Status:** pending\n\n### Phase 5: Delivery\n- [ ] Review outputs\n- [ ] Deliver to user\n- **Status:** pending\n\n## Decisions Made\n| Decision | Rationale |\n|----------|-----------|\n\n## Errors Encountered\n| Error | Resolution |\n|-------|------------|\n\n## Notes\n- Planning files live in \`.pi/planning/\`.\n- Re-read this file before major decisions.\n- Update findings.md and progress.md continuously.\n\n## Session\n- Initialized: ${date}\n`;
}

function buildFindingsTemplate(): string {
	return `# Findings & Decisions\n\n## Requirements\n-\n\n## Research Findings\n-\n\n## Technical Decisions\n| Decision | Rationale |\n|----------|-----------|\n\n## Issues Encountered\n| Issue | Resolution |\n|-------|------------|\n\n## Resources\n-\n`;
}

function buildProgressTemplate(date: string): string {
	return `# Progress Log\n\n## Session: ${date}\n\n### Current Status\n- **Phase:** 1 - Requirements & Discovery\n- **Started:** ${date}\n\n### Actions Taken\n- Initialized planning files in \`.pi/planning/\`.\n\n### Test Results\n| Test | Expected | Actual | Status |\n|------|----------|--------|--------|\n\n### Errors\n| Error | Resolution |\n|-------|------------|\n`;
}

function writeNewPlanningFiles(cwd: string): { written: string[] } {
	const planningRoot = getPlanningRoot(cwd);
	const files = getPlanningFiles(cwd);
	ensureDir(planningRoot);
	const written: string[] = [];
	const date = new Date().toISOString().slice(0, 10);
	const contentByFile: Record<PlanningFileName, string> = {
		"task_plan.md": buildTaskPlanTemplate(date),
		"findings.md": buildFindingsTemplate(),
		"progress.md": buildProgressTemplate(date),
	};

	for (const name of PLANNING_FILES) {
		const target = files[name];
		fs.writeFileSync(target, contentByFile[name], "utf8");
		written.push(target);
	}

	return { written };
}

function summarizeState(state: PlanningState): string[] {
	const lines = [`dir: ${state.planningRoot}`];
	if (state.goal) lines.push(`goal: ${state.goal}`);
	if (state.currentPhase) lines.push(`phase: ${state.currentPhase}`);
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
	ctx.ui.setWidget(WIDGET_KEY, summarizeState(state), { placement: "aboveEditor" });
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

export default function planningFilesRuntime(pi: ExtensionAPI): void {
	let state = getPlanningState(process.cwd(), false);

	function refresh(ctx?: ExtensionContext, resumedFromPreviousSession = state.resumedFromPreviousSession): void {
		state = getPlanningState(ctx?.cwd ?? process.cwd(), resumedFromPreviousSession);
		if (ctx) updateUi(ctx, state);
	}

	function persistState(): void {
		pi.appendEntry(CUSTOM_TYPE, {
			planningRoot: state.planningRoot,
			exists: state.exists,
			currentPhase: state.currentPhase,
			goal: state.goal,
			updatedAt: Date.now(),
		});
	}

	pi.registerCommand("plan-new", {
		description: "Start a fresh plan in .pi/planning/",
		handler: async (_args, ctx) => {
			const result = writeNewPlanningFiles(ctx.cwd);
			refresh(ctx, false);
			persistState();
			ctx.ui.notify(`new planning round started\nwritten: ${result.written.join(", ")}`, "info");
		},
	});

	pi.registerCommand("plan-init", {
		description: "Alias for /plan-new",
		handler: async (_args, ctx) => {
			const result = writeNewPlanningFiles(ctx.cwd);
			refresh(ctx, false);
			persistState();
			ctx.ui.notify(`new planning round started\nwritten: ${result.written.join(", ")}`, "info");
		},
	});

	pi.registerCommand("plan-status", {
		description: "Show current .pi/planning status",
		handler: async (_args, ctx) => {
			refresh(ctx);
			const lines = summarizeState(state);
			lines.push(`files present: ${PLANNING_FILES.filter((name) => fileExists(state.files[name])).join(", ") || "none"}`);
			ctx.ui.notify(lines.join("\n"), "info");
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
			const prompt = `Read ${state.files["task_plan.md"]}, ${state.files["findings.md"]}, and ${state.files["progress.md"]}. Sync the current task state from those planning files before continuing.`;
			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Queued planning sync as a follow-up.", "info");
			}
		},
	});

	pi.on("session_start", async (event, ctx) => {
		const resumed = event.reason === "resume" || event.reason === "fork" || event.reason === "new";
		refresh(ctx, resumed);
		persistState();
		if (!state.exists) return;
		updateUi(ctx, state);
		const notice = resumed
			? `Planning resumed from previous session. Source: ${event.previousSessionFile ?? "previous session"}`
			: `Planning runtime attached to ${state.planningRoot}`;
		ctx.ui.notify(notice, "info");
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
		updateUi(ctx, state);
		persistState();
	});

	pi.on("turn_end", async (_event, ctx) => {
		refresh(ctx);
		updateUi(ctx, state);
		persistState();
	});
}

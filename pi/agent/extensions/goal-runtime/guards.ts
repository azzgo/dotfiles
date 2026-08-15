import path from "node:path";
import { GOALS_DIR, MEANINGFUL_PROGRESS_TOOLS, TRACK_DIR, TRACK_FILE_NAMES } from "./types";
import { ensureDir, goalsDir, trackDir } from "./utils";

/**
 * Redirect read/write/edit tool calls for bare track file names into `.pi/track/`.
 * Returns true when a redirect was applied.
 */
export function getRedirectPath(inputPath: string, cwd: string): string | undefined {
	const normalized = inputPath.trim();
	if (!normalized) return undefined;
	const base = path.basename(normalized);
	if (!TRACK_FILE_NAMES.includes(base as typeof TRACK_FILE_NAMES[number])) return undefined;
	const target = path.join(trackDir(cwd), base);
	const resolvedTarget = path.resolve(target);
	const resolvedInput = path.resolve(cwd, normalized);
	if (resolvedInput === resolvedTarget) return undefined;
	return target;
}

export function redirectTrackPath(event: { toolName: string; input: Record<string, unknown> }, cwd: string): boolean {
	if (!["read", "write", "edit"].includes(event.toolName)) return false;
	const rawPath = event.input.path;
	if (typeof rawPath !== "string") return false;
	const redirected = getRedirectPath(rawPath, cwd);
	if (!redirected) return false;
	ensureDir(trackDir(cwd));
	event.input.path = redirected;
	return true;
}

/** Check whether a file path resolves inside `.pi/goals/` (goal records store). */
export function isInGoalsDir(filePath: string, cwd: string): boolean {
	const root = goalsDir(cwd);
	const resolved = path.resolve(cwd, filePath);
	return resolved === root || resolved.startsWith(root + path.sep);
}

/** Check whether a file path resolves inside `.pi/track/`. */
export function isInTrackDir(filePath: string, cwd: string): boolean {
	const root = trackDir(cwd);
	const resolved = path.resolve(cwd, filePath);
	return resolved === root || resolved.startsWith(root + path.sep);
}

/**
 * Block dangerous bash commands during goal drafting.
 * taskmd CLI mutations of the goal store are allowed; production mutations are not.
 */
export function isUnsafeDraftingBash(command: string): boolean {
	const trimmed = command.trim();
	if (!trimmed) return true;
	const unsafePatterns = [
		/\b(?:rm|mv|cp|rmdir|touch|chmod|chown)\b/,
		/\b(?:git\s+(?:add|commit|push|pull|merge|rebase|checkout|switch|restore|reset|clean|stash))\b/,
		/\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update|upgrade|run|build|dev)\b/,
		/\btaskmd\s+(?:rm|archive|deduplicate|import|sync)\b/,
	];
	return unsafePatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Block direct taskmd phase/status mutations via bash — but only when the target is a
 * GOAL record. Goal lifecycle transitions (drafting→ready→active→paused→in-review→
 * complete/abandoned) must go through the goal-runtime tools, which enforce one-active
 * exclusivity, the verifier gate, and Track side effects. Direct `taskmd set --phase/
 * --status/--done` on a goal bypasses all of that (e.g. an orchestrator jumping
 * active→complete and skipping review). Story/Task status updates via the CLI are
 * legitimate and NOT blocked. `--done` is covered: it aliases `--status completed`.
 */
function extractSetTarget(command: string): string | undefined {
	const taskId = command.match(/--task-id[=\s]+(\S+)/);
	if (taskId?.[1]) return taskId[1].replace(/^goal:/, "");
	const positional = command.match(/\bset\s+(?:-[\w-]+\s+\S+\s+)*(\S+)/);
	if (positional?.[1] && !positional[1].startsWith("-")) {
		return positional[1].replace(/^goal:/, "");
	}
	return undefined;
}

export function isDirectPhaseMutationBash(command: string, goalIds?: Set<string>): boolean {
	const trimmed = command.trim();
	if (!trimmed) return false;
	if (!/\btaskmd\b/.test(trimmed)) return false;
	if (!/\bset\b/.test(trimmed)) return false;
	const mutatesLifecycle = /--phase\b/.test(trimmed) || /--status\b/.test(trimmed) || /--done\b/.test(trimmed);
	if (!mutatesLifecycle) return false;
	if (goalIds) {
		const target = extractSetTarget(trimmed);
		// target resolved and not a goal record -> story/task update, allow it;
		// unresolved target -> block (safe default: likely a goal).
		if (target && !goalIds.has(target)) return false;
	}
	return true;
}

/** Determine whether a tool call represents meaningful progress (continuation eligibility). */
export function isMeaningfulProgressToolCall(toolName: string, input: Record<string, unknown>): boolean {
	if (!MEANINGFUL_PROGRESS_TOOLS.has(toolName)) return false;
	if (toolName === "bash") {
		const command = typeof input.command === "string" ? input.command.trim() : "";
		if (!command || /^echo\b/.test(command)) return false;
	}
	return true;
}

export { GOALS_DIR, TRACK_DIR };

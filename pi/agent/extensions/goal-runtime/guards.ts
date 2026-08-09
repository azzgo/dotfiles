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

import path from "node:path";
import { TRACK_FILE_NAMES } from "./types";
import { ensureDir, trackDir } from "./utils";

/**
 * Redirect read/write/edit tool calls for bare track file names into the host config dir's track folder.
 * Returns true when a redirect was applied.
 */
export function getRedirectPath(inputPath: string, cwd: string, configDirName?: string): string | undefined {
	const normalized = inputPath.trim();
	if (!normalized) return undefined;
	const base = path.basename(normalized);
	if (!TRACK_FILE_NAMES.includes(base as typeof TRACK_FILE_NAMES[number])) return undefined;
	const target = path.join(trackDir(cwd, configDirName), base);
	const resolvedTarget = path.resolve(target);
	const resolvedInput = path.resolve(cwd, normalized);
	if (resolvedInput === resolvedTarget) return undefined;
	return target;
}

export function redirectTrackPath(event: { toolName: string; input: Record<string, unknown> }, cwd: string, configDirName?: string): boolean {
	if (!["read", "write", "edit"].includes(event.toolName)) return false;
	const rawPath = event.input.path;
	if (typeof rawPath !== "string") return false;
	const redirected = getRedirectPath(rawPath, cwd, configDirName);
	if (!redirected) return false;
	ensureDir(trackDir(cwd, configDirName));
	event.input.path = redirected;
	return true;
}

/** Check whether a file path resolves inside the host config dir's track folder. */
export function isInTrackDir(filePath: string, cwd: string, configDirName?: string): boolean {
	const root = trackDir(cwd, configDirName);
	const resolved = path.resolve(cwd, filePath);
	return resolved === root || resolved.startsWith(root + path.sep);
}

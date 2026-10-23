import path from "node:path";

/** Append-only log of Compaction Summary failures and fallbacks (see ADR 0020). */
export const DEFAULT_CONFIG_DIR_NAME = ".pi";
export const COMPACTION_LOG_FILE = "failures.log";

/** Append-only log of every Compaction Summary attempt: model, tokens, duration, outcome. */
export const COMPACTION_STATS_FILE = "stats.log";

/** How many user requests the Request Line keeps (earliest → latest). */
export const REQUEST_LINE_LIMIT = 5;

/** Characters kept per request in the Request Line. */
export const REQUEST_LINE_MAX_CHARS = 400;

/** Characters kept per message line in the Compaction Skeleton. */
export const SKELETON_TEXT_CHARS = 200;

/** How many error lines a failing tool result contributes to the skeleton. */
export const SKELETON_ERROR_LINES = 3;

/** How many skeleton lines of the kept window are shown to the summary model. */
export const KEPT_TAIL_LINES = 40;

/** The skeleton keeps the oldest lines (the session's framing) and the newest ones. */
export const SKELETON_HEAD_LINES = 20;

/** The skeleton keeps at most this many of the most recent lines. */
export const SKELETON_TAIL_LINES = 800;

/** How many files the read list keeps (most recent first). */
export const READ_LIST_LIMIT = 10;

/** How many files the modified list keeps (most recent first). */
export const MODIFIED_LIST_LIMIT = 20;

/** Context usage (percent) at which the Compaction Notice fires once per session. */
export const NOTICE_THRESHOLD_PERCENT = 60;

export function compactionLogDir(cwd: string, configDirName: string = DEFAULT_CONFIG_DIR_NAME): string {
	return path.join(cwd, configDirName, "compaction");
}

export function compactionStatsFile(cwd: string, configDirName: string = DEFAULT_CONFIG_DIR_NAME): string {
	return path.join(compactionLogDir(cwd, configDirName), COMPACTION_STATS_FILE);
}

export function compactionFailureFile(cwd: string, configDirName: string = DEFAULT_CONFIG_DIR_NAME): string {
	return path.join(compactionLogDir(cwd, configDirName), COMPACTION_LOG_FILE);
}

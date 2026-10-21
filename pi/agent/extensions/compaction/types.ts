import path from "node:path";

/** Append-only log of failed Compaction Summary calls (see ADR 0015). */
export const DEFAULT_CONFIG_DIR_NAME = ".pi";
export const COMPACTION_LOG_FILE = "failures.log";

export function compactionLogDir(cwd: string, configDirName: string = DEFAULT_CONFIG_DIR_NAME): string {
	return path.join(cwd, configDirName, "compaction");
}

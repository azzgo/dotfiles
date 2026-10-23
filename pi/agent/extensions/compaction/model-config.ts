import fs from "node:fs";
import path from "node:path";

import { getAgentDir } from "@earendil-works/pi-coding-agent";

/**
 * Which model writes the Compaction Summary.
 *
 * The model id is never hardcoded in the extension: it lives in a machine-level
 * config file next to the agent dir (`~/.pi/agent/compaction.json`, or
 * `~/.pig/agent/compaction.json` under PiG) and is switched with
 * `/compaction-model`. Without a configured model the extension falls back to
 * the session model.
 */

export const COMPACTION_CONFIG_FILE = "compaction.json";

export type CompactionConfig = {
	summaryModel?: string;
};

export function compactionConfigPath(): string {
	const override = process.env.PI_COMPACTION_CONFIG;
	if (override) return override;
	return path.join(getAgentDir(), COMPACTION_CONFIG_FILE);
}

export function readCompactionConfig(): CompactionConfig {
	try {
		const raw = fs.readFileSync(compactionConfigPath(), "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			const summaryModel = (parsed as Record<string, unknown>).summaryModel;
			if (typeof summaryModel === "string" && summaryModel.trim() !== "") {
				return { summaryModel: summaryModel.trim() };
			}
		}
	} catch {
		// No config, unreadable config, or malformed config: fall back to the session model.
	}
	return {};
}

/** `provider/modelId` → the two parts the model registry needs. */
export function parseModelRef(ref: string): { provider: string; modelId: string } | undefined {
	const trimmed = ref.trim();
	const slash = trimmed.indexOf("/");
	if (slash <= 0 || slash === trimmed.length - 1) return undefined;
	return { provider: trimmed.slice(0, slash), modelId: trimmed.slice(slash + 1) };
}

export function writeSummaryModel(model: string | undefined): void {
	const target = compactionConfigPath();
	if (model === undefined) {
		try {
			fs.rmSync(target, { force: true });
		} catch {
			// A stale config that cannot be removed is not worth failing over.
		}
		return;
	}
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify({ summaryModel: model }, null, 2)}\n`, "utf8");
}

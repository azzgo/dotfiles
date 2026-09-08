/**
 * Program-side visibility (zero model tokens): a persistent widget above the
 * editor listing every non-terminal Run — one line per run, Focus highlighted.
 * Follows the sub-dispatch Dispatch Overview pattern: renders nothing when
 * there is nothing to show.
 */
import { activeNode, nonTerminalRuns } from "./state";
import type { Run } from "./types";

export function buildRunWidgetLines(cwd: string, focusRunId: string | null): string[] | undefined {
	const runs = nonTerminalRuns(cwd);
	if (runs.length === 0) return undefined;
	const lines = [`wf: ${runs.length} open run${runs.length === 1 ? "" : "s"}`];
	for (const run of runs) {
		const node = activeNode(run) ?? run.nodes.find((n) => n.status === "failed");
		const nodePart = node ? `${node.id}:${node.status}` : "-";
		const focus = run.id === focusRunId ? " ◀" : "";
		lines.push(`${focus ? "▶" : " "} ${run.id} · ${nodePart} · ${run.title}${focus}`);
	}
	return lines;
}

/** Compact notify line for a settled node (used by the runtime). */
export function formatSettleLine(runId: string, nodeId: string, status: string, exitCode: number | null): string {
	return `wf ▏ ${runId} · ${nodeId} → ${status} (exit ${exitCode ?? "n/a"})`;
}

export type { Run };

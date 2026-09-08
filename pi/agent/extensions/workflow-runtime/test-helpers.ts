/** Shared test fixtures (not a test file — excluded via naming from vitest's *.test.ts glob). */
import type { Definition, Run, RunNode } from "./types";

export function sampleNodes(): RunNode[] {
	return [
		{ id: "intake", title: "Intake", type: "human", suggest: [], brief: "b", doneWhen: "d", status: "done" },
		{ id: "locate", title: "Locate", type: "auto", suggest: [], brief: "b", doneWhen: "d", status: "active" },
		{ id: "fix", title: "Fix", type: "auto", suggest: [], brief: "b", doneWhen: "d", status: "pending" },
	];
}

export function makeRun(id: string, overrides: Partial<Run> = {}): Run {
	return {
		id,
		title: `Run ${id}`,
		definitionName: "bugfix",
		createdAt: "2026-09-07T00:00:00.000Z",
		updatedAt: "2026-09-07T00:00:00.000Z",
		status: "active",
		nodes: sampleNodes(),
		activeNodeId: "locate",
		...overrides,
	};
}

export function makeDefinition(): Definition {
	return {
		name: "bugfix",
		description: "Fix a defect end to end",
		nodes: [
			{ id: "intake", title: "Intake", type: "human", suggest: [], brief: "b", doneWhen: "d" },
			{ id: "locate", title: "Locate", type: "auto", suggest: [], brief: "b", doneWhen: "d" },
			{ id: "fix", title: "Fix", type: "auto", suggest: [], brief: "b", doneWhen: "d" },
			{ id: "review", title: "Review", type: "human", suggest: [], brief: "b", doneWhen: "d" },
		],
	};
}

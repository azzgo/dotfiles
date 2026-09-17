/**
 * Argument completions for /wf (pure, fs-backed — pi passes only the typed
 * prefix, no ctx). Returned values are full argument strings after "/wf "
 * (same contract as the xfer extension).
 */
import fs from "node:fs";
import path from "node:path";
import { definitionsDir, globalPatternsDir, listRuns, nonTerminalRuns, readLastFocus } from "./state";

export interface CompletionItem {
	value: string;
	label: string;
	description: string;
}

const SUBCOMMANDS: CompletionItem[] = [
	{ value: "new", label: "new", description: "Draft a Definition (AI writes the file; you review, then /wf start)" },
	{ value: "start", label: "start", description: "Instantiate a Run from a Definition/Pattern; sets Focus" },
	{ value: "list", label: "list", description: "Non-terminal runs + recent terminal archive" },
	{ value: "status", label: "status", description: "Run detail (nodes, sessions, progress-log tail)" },
	{ value: "next", label: "next", description: "Drive the active node" },
	{ value: "done", label: "done", description: "Complete the active node (human override for auto nodes)" },
	{ value: "skip", label: "skip", description: "Skip a node (reason required)" },
	{ value: "insert", label: "insert", description: "Insert a node after another" },
	{ value: "replan", label: "replan", description: "Propose a revised Spine / apply the approved revision" },
	{ value: "refine", label: "refine", description: "AI-refine a Definition/Pattern file in place" },
	{ value: "open", label: "open", description: "Open the definitions/patterns directory in the file manager" },
	{ value: "patterns", label: "patterns", description: "List project definitions + global patterns" },
	{ value: "focus", label: "focus", description: "Point this session's Focus at a run" },
	{ value: "name", label: "name", description: "Rename the Focus run (title defaults to the Definition description)" },
	{ value: "switch", label: "switch", description: "Run picker (= bare /wf)" },
	{ value: "save-as-template", label: "save-as-template", description: "Promote the Run's Definition to the global pattern library" },
	{ value: "cancel", label: "cancel", description: "Cancel a run" },
	{ value: "help", label: "help", description: "Show the /wf command reference" },
];

/** Definition/pattern names: project definitions first, global library deduped in. */
export function listDefinitionNames(cwd: string, globalDirOverride?: string): string[] {
	const names = new Set<string>();
	for (const dir of [definitionsDir(cwd), globalDirOverride ?? globalPatternsDir()]) {
		if (!fs.existsSync(dir)) continue;
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			if (e.isFile() && e.name.endsWith(".md")) names.add(e.name.slice(0, -3));
		}
	}
	return [...names].sort();
}

/** Node ids of the session's implicit Focus run (last-interacted, else the lone open run). */
function focusedNodeIds(cwd: string): { names: string[]; titles: string[] } {
	const runs = nonTerminalRuns(cwd);
	if (runs.length === 0) return { names: [], titles: [] };
	const lastFocus = readLastFocus(cwd);
	const run = runs.find((r) => r.id === lastFocus) ?? (runs.length === 1 ? runs[0]! : undefined);
	if (!run) return { names: [], titles: [] };
	return { names: run.nodes.map((n) => n.id), titles: run.nodes.map((n) => n.title) };
}

const RUN_ARG_SUBS = new Set(["status", "next", "focus", "cancel", "save-as-template"]);

export function wfCompletions(cwd: string, prefix: string, globalDirOverride?: string): CompletionItem[] | null {
	const trimmed = prefix.replace(/^\s+/, "");
	if (!trimmed.includes(" ")) {
		const items = SUBCOMMANDS.filter((i) => i.value.startsWith(trimmed));
		return items.length > 0 ? items : null;
	}
	const sp = trimmed.indexOf(" ");
	const sub = trimmed.slice(0, sp);
	const after = trimmed.slice(sp + 1);
	if (after.includes(" ")) return null; // third token onward is free text (title / reason / note)

	let entries: { name: string; description: string }[] = [];
	if (sub === "start" || sub === "refine") {
		entries = listDefinitionNames(cwd, globalDirOverride).map((n) => ({ name: n, description: "definition/pattern" }));
	} else if (RUN_ARG_SUBS.has(sub)) {
		entries = listRuns(cwd).map((r) => ({ name: r.id, description: `${r.title} [${r.status}]` }));
	} else if (sub === "skip" || sub === "insert") {
		const { names, titles } = focusedNodeIds(cwd);
		entries = names.map((n, i) => ({ name: n, description: titles[i] ?? "" }));
	} else {
		return null;
	}
	const items = entries
		.filter((e) => e.name.startsWith(after))
		.map((e) => ({ value: `${sub} ${e.name}`, label: e.name, description: e.description }));
	return items.length > 0 ? items : null;
}


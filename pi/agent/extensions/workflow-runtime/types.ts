/** workflow-runtime shared types + constants (pure data; no I/O). */

export const WORKFLOWS_DIR = ".pi/workflows";
export const DEFINITIONS_DIR = `${WORKFLOWS_DIR}/definitions`;
export const RUNS_DIR = `${WORKFLOWS_DIR}/runs`;
export const RUN_STATE_FILE = "run.json";
export const RUN_LOG_FILE = "progress.md";
/** Machine-local pointer to the run this session/user last interacted with (cold-start preselect). */
export const LAST_FOCUS_FILE = `${WORKFLOWS_DIR}/.last-focus`;
/** Global pattern library (peer of skills/ and prompts/; symlinked by `just install-pi`). */
export const GLOBAL_PATTERNS_DIR = "~/.pi/agent/patterns";

/** customType of the prompts this extension sends to the driving model (display: false). */
export const MESSAGE_TYPE_WF_PROMPT = "wf-prompt";
/** customType of program-side notification lines (display: true; zero LLM context). */
export const MESSAGE_TYPE_WF_NOTIFY = "wf-notify";
/** customType of sub-dispatch settle notifications (correlation hook; owned by sub-dispatch). */
export const MESSAGE_TYPE_SUB_DISPATCH = "sub-dispatch";
/** dispatch tool `reason` prefix used to associate a background dispatch with run/node. */
export const DISPATCH_REASON_PREFIX = "wf-";

export type NodeType = "human" | "auto";
export type NodeStatus = "pending" | "active" | "done" | "skipped" | "failed" | "cancelled";
export type RunStatus = "active" | "done" | "cancelled";

export const TERMINAL_RUN_STATUSES: RunStatus[] = ["done", "cancelled"];

/** One entry/exit boundary on a Spine, as authored in a Definition. */
export interface DefNode {
	id: string;
	title: string;
	type: NodeType;
	suggest: string[];
	/** Brief prose from the `## <id>` body section (done-when line excluded). */
	brief: string;
	/** The one `done-when:` line content. */
	doneWhen: string;
}

/** A maintained, human-reviewable Definition (Markdown + YAML frontmatter). */
export interface Definition {
	name: string;
	description: string;
	nodes: DefNode[];
	/** Where the file was loaded from (informational). */
	sourcePath?: string;
}

/** A Node as instantiated inside a Run. */
export interface RunNode extends DefNode {
	status: NodeStatus;
	/** Dispatch session id (Auto Nodes) / noting session info at completion. */
	sessionId?: string;
	startedAt?: string;
	completedAt?: string;
	/** /wf done note, skip reason, or failure note. */
	note?: string;
}

/** One execution instance of a Definition. Pure file state — never an engine. */
export interface Run {
	id: string;
	title: string;
	definitionName: string;
	createdAt: string;
	updatedAt: string;
	status: RunStatus;
	nodes: RunNode[];
	/** Currently active node id (null only when the run is terminal). */
	activeNodeId: string | null;
	completedAt?: string;
}

/** One progress-log line, already rendered (time | type | summary). */
export interface LogLine {
	at: string;
	kind: "run" | "node" | "reroute" | "settle";
	text: string;
}

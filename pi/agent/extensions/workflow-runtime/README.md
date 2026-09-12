# workflow-runtime

Pi extension: the **orchestration skeleton** for Workflows (ADR 0006, replacing
goal-runtime). It only **books state, suggests flow, and notifies** — it never
executes node work, never judges quality, and the model never flips Run/Node
state.

Glossary: see the repo `CONTEXT.md`, section *Workflow (Orchestration
Skeleton)* (Workflow / Definition / Pattern / Run / Spine / Node / Auto Node /
Human Node / Rerouting / Driving Session / Focus).

## Architecture invariants

1. **No engine.** No server, no daemon, no timers, no queue. A Run advances
   only while a Driving Session acts on it; all state is plain files under
   `.pi/workflows/` (gitignored, machine-local).
2. **The model never flips state.** Every Run/Node transition happens either in
   a `/wf` command handler (deterministic validation) or in the sub-dispatch
   settle callback (`message_end` of `customType: "sub-dispatch"`). No
   lifecycle tools are registered for the model — the model only ever receives
   instruction prompts.
3. **Notification-driven.** Auto Nodes are executed by the model dispatching a
   sub-agent via the `dispatch` tool (`background: true`) with
   `reason: "wf-<runId>-node-<nodeId>"`. The extension records the
   reason ↔ sessionId mapping from the dispatch tool call/result, then flips
   node state when the settle notification arrives. **Never sleep, never
   poll.**
4. **auto→auto cascades** without asking; when the next node is human, the
   model is prompted to present the brief and ask the user. A failed auto node
   does NOT cascade — the failure is surfaced and the user decides
   (`/wf next` re-dispatch, `/wf skip`, `/wf replan`, `/wf cancel`).
5. **Global zero-exclusivity.** Any number of non-terminal Runs coexist. A
   per-session Focus pointer (defaults to the run this session last interacted
   with; a lone run is implicit) disambiguates bare commands; explicit run ids
   are always exact.
6. **Cold start injects nothing and asks nothing.** A fresh session never
   triggers a Run picker — entering a workflow is always an explicit user
   action (`/wf`, `/wf switch`, `/wf focus`, `/wf next <run-id>`, `/wf start`).
   When the session's Focus lands on a non-terminal Run, the runtime silently
   injects a **state digest** (a hard-capped plain dump of run.json + the
   progress-log tail; `triggerTurn: false`, zero turn cost) so resuming a
   workflow after context exhaustion costs no archaeology. The digest asks the
   model to do nothing on its own.
7. **Visibility is program-side, zero tokens.** A persistent widget above the
   editor lists every non-terminal Run (one line: name / current node / status,
   Focus highlighted) — modeled on sub-dispatch's Dispatch Overview.
8. **The user outranks the runtime.** Auto Nodes normally settle via their
   dispatch notification, but a lost or stuck settle must never deadlock a
   Run: `/wf done` completes the active node regardless of type (logged as a
   human override; the late settle becomes a silent noop).

## Disk layout

```text
.pi/workflows/
├── definitions/<name>.md   # Definitions (patterns are copied here on /wf start)
├── runs/<run-id>/          # run-id: <YYYYMMDD-HHmmss>-<definition-slug>
│   ├── run.json            # machine state (single source of truth)
│   └── progress.md         # human-readable log, one line per flip/reroute
└── .last-focus             # last-interacted run id (cold-start preselect)
```

Global pattern library: `~/.pi/agent/patterns/<name>.md` (peer of `skills/` and
`prompts/`; symlinked by `just install-pi`). Lookup order: project definitions
first, then the library.

## Definition / Pattern format contract

```markdown
---
name: bugfix
description: One-line what this workflow is for
nodes:
  - id: intake
    title: Receive & triage the defect
    type: human
    suggest: [grill-with-docs]
  - id: locate
    title: Locate the root cause
    type: auto
    suggest: [explore-codebase]
---
## intake
Brief prose: what this node is for, how to approach it.

done-when: repro or root-cause hypothesis is recorded.
```

- The ordered `nodes` array **is** the Spine (linear; no edges, no branches).
- `id` kebab-case and unique; `type` ∈ `human | auto`; `suggest` entries are
  `skill-name` or `name:<path-to-SKILL.md-or-its-dir>` — paths are encouraged
  because most skills are not visible to the driving model by default; the
  array may be empty.
- Every node has a `## <id>` body section with brief prose plus exactly one
  `done-when:` line. Anything violating the contract is rejected with readable
  errors — never silently accepted.

## Commands (`/wf`)

| Command | Behavior |
|---|---|
| `/wf` (bare) / `/wf switch` | Run picker (manual entry — no cold-start popup; Esc = nothing). Open runs set Focus; archived (done/cancelled) runs offer a `🗑 remove` row — deleting the Run directory after a confirm. **Removal is manual, human-only: the model has no tool or prompt for it and the runtime never deletes runs automatically.** |
| `/wf new <topic>` | Prompt the model to draft a Definition (capability-aware: `suggest` entries verified on disk, `name:<path>` encouraged) into `.pi/workflows/definitions/`; you review, then start |
| `/wf start <name> [title]` | Instantiate a Run (global patterns are copied into the project), set Focus, send the first node's flow prompt |
| `/wf list` | Non-terminal Runs + recent terminal archive (program-side, zero tokens) |
| `/wf status [<run-id>]` | Nodes, states, dispatch session ids, progress-log tail |
| `/wf next [<run-id>]` | Drive the active node: auto → dispatch-instruction prompt; human → brief + question. On a failed auto node it re-dispatches. Warns instead of double-dispatching when a session is already in flight |
| `/wf done [note]` | Complete the active node (note lands in the log). Auto nodes normally settle by themselves; `/wf done` is the human override when a settle is lost or stuck (logged as an override; the late settle becomes a noop) |
| `/wf skip <node-id> <reason>` | Reroute; reason mandatory; logged |
| `/wf insert <after-node-id> <title> [auto\|human]` | Reroute; inserts a pending node; logged. Inserting **ahead of the active node is allowed (backflow)**: the flow returns to the inserted node as soon as the current node completes — the notify says so explicitly |
| `/wf replan [confirm [note]]` | Prompt the model to propose a revised Spine → it rewrites the Definition → you approve → `/wf replan confirm` replaces the Spine (old Spine archived in the log). Node states of surviving nodes are preserved, in-flight dispatch correlation is kept; **dropped in-flight dispatches are surfaced as severed** (warning with the session id — kill manually via the Dispatch Overview, never auto-killed) |
| `/wf focus <run-id>` | Point this session's Focus at a Run |
| `/wf save-as-template <run-id>` | Promote the Run's Definition into the global pattern library (a dotfiles git diff; never overwrites) |
| `/wf cancel [<run-id>]` | Terminal cancel; open nodes → cancelled; logged |

## Relation to sub-dispatch and track

- **sub-dispatch** executes Auto Nodes: the driving model calls
  `dispatch({ background: true, reason: "wf-<runId>-node-<nodeId>" })` and ends
  its turn. The settle notification (customType `sub-dispatch`, carrying
  `sessionId`/`status`/`exitCode` in `details`) is the sole wake-up; this
  extension correlates it via the recorded reason/session mapping (with a
  cross-session fallback through the sessionId persisted in `run.json`),
  flips the node, appends the progress line (with the child session id), and
  cascades. Failure (non-zero exit, error/killed/timeout) → `failed`, no
  cascade.
- **track** stays a stranger: Runs keep their own structured progress log
  written by the extension; Track remains the model's freeform manual memory.
  Neither reads the other.

## Files

- `state.ts` — run storage, progress log, pattern lookup, run-id/Focus helpers (incl. `removeRun` for manual picker removal).
- `commands.ts` — command handlers (deterministic validation; every state flip).
- `transitions.ts` — pure state machine: settle, done, skip, insert, replan,
  cancel.
- `state.ts` — run storage, progress log, pattern lookup, run-id/Focus helpers.
- `definition.ts` — strict dependency-free Definition parser (contract
  violations rejected with reasons).
- `prompts.ts` — instruction prompts (dispatch / human brief / new definition /
  replan).
- `ui.ts` — widget lines (program-side visibility).
- `*.test.ts` + `vitest.config.ts` — tests (`npm test`, mirrors goal-runtime's
  setup; Node >= 23.6 native TS).

## Dotfiles integration

Version-controlled in `dotfiles`
(`pi/agent/extensions/workflow-runtime/`), linked into
`~/.pi/agent/extensions/workflow-runtime` via `just install-pi` (wiring —
`settings.json` / justfile — is the orchestrator's task and intentionally not
part of this change).

# sub-dispatch

Pi extension: **minimal sub-agent dispatch** — run a coding agent as an
**in-process sub-session** and collect its output. Trimmed from
[pi-interactive-shell](https://github.com/nicobailon/pi-interactive-shell)
(v0.15.0) to a single use-case (dispatch a sub-agent, no PTY / interactive
input / monitor machinery) plus read-only visibility surfaces (see below).

A historical note: it was built as the **v2b bridge hook** for the since-removed
`code-mode` extension; that role is now filled by pi's built-in `codemode` tool
calling the `dispatch` tool directly (see `docs/adr/0011`).

Key properties of the in-process design (rationale: `docs/adr/0012`):

- A dispatch calls pi 1.0's SDK `createAgentSession()` inside the host process —
  no spawned `pi` subprocess, no argv building, no stdout capture, no process
  group.
- The sub-session is created with `SessionManager.inMemory()`, so it **never
  appears in the resume list**.
- `agent` accepts only **`pi`**; codex/claude/cursor CLI dispatch was removed
  (`resolveAgent` rejects anything else).
- The sub-session's active tools exclude `dispatch` — no recursion.
- Trade-off accepted: the sub-agent shares the host's trust domain (no crash
  isolation).

## Install

Symlinked by the dotfiles `justfile`:

```bash
just install-pi    # links ~/.pi/agent/extensions/sub-dispatch -> pi/agent/extensions/sub-dispatch
```

Requires pi >= 1.0 (the SDK `createAgentSession()` API) and Node >= 23.6 for
native TS type-stripping, same as pi itself. No `pi` binary lookup / PATH
dependency: dispatches run in-process.

## Usage

### Tool `dispatch`

| param        | type    | default | notes                                                        |
|--------------|---------|---------|--------------------------------------------------------------|
| `agent`      | string  | —       | required for a new dispatch; **`pi` only** (in-process sub-session) |
| `prompt`     | string  | —       | required for a new dispatch; task prompt for the sub-agent   |
| `background` | boolean | false   | true → return `{ sessionId }` immediately; query/kill later   |
| `timeout`    | number  | 600     | seconds; aborts the in-process sub-session on expiry         |
| `reason`     | string  | —       | UI label shown in the footer status while foreground-running  |
| `model`      | string  | —       | model override passed to the sub-session (`provider/id` or bare id) |
| `sessionId`  | string  | —       | existing background session to query (or `kill: true`)        |
| `kill`       | boolean | —       | with `sessionId`, abort the background session                |

- **Foreground (default)**: waits, returns `{ exitCode, ok, durationMs, output,
  logFile }` in `details` (assistant text, tail-truncated to 20000 chars by the
  completion notification). Footer status shows `dispatch <agent> — running…`
  while waiting; Esc (abort signal) aborts the sub-session.
- **Tool hints**: `annotations` declares `destructiveHint: true` (kill / abort)
  and `openWorldHint: true` (arbitrary sub-agents).
- **Structured value** (`outputSchema` / `structuredContent`, what codemode
  scripts receive from `tools.dispatch`):
  - foreground → `{ exitCode, durationMs, output, complete: true, logFile }`
  - background → `{ sessionId, status: "running", complete: false }`
  - query → `{ sessionId, status, exitCode, durationMs, output, complete, logFile }`
  - kill → `{ sessionId, status: "killed", durationMs, exitCode, output, complete: true }`
- **Background**: returns immediately with `{ sessionId }`; the host is
  **auto-notified when the session settles** — a `sendMessage` with
  `customType: "sub-dispatch"` and `{ triggerTurn: true, deliverAs: "followUp" }`
  wakes the agent (if idle) or queues behind an in-flight turn, carrying status,
  exit code, the output tail, and how to fetch full details. So the caller can
  fire-and-end-turn with no polling. `dispatch({ sessionId })` remains for
  mid-run status / diagnostics; `dispatch({ sessionId, kill: true })` aborts the
  sub-session (`AbortController` + `session.abort()`) and reports `killed`.
- **Abort / timeout**: `AbortSignal` and the timeout timer both call
  `session.abort()` on the in-process session; the status lands on `killed` or
  `timeout` and the forensic dump is still written.

### Visualization surfaces (all program-side, zero tokens)

Visibility is the extension's job, never the orchestrating agent's — elapsed
time, session count, and output are presented by the UI; the agent is never
asked to poll or report status (see `End-turn Wait Discipline` in the repo
`CONTEXT.md`).

1. **Dispatch Overview** — persistent widget above the editor: one row per
   running session (`glyph · id · status · live elapsed · last output line`).
   A settled row lingers 5s in its final state, then disappears; the widget
   hides entirely when no sessions exist. Output preview is captured by the
   program (ANSI-stripped, `\r` final-frame), never by the model.
2. **Output Peek** — `/dispatch` (no args) always opens a session list first;
   pick one to enter the realtime output stream (`[sessionId-substring]` jumps
   straight to one). The peek is a read-only scrolling overlay over the
   session's full output buffer:
   `↑↓/PgUp/PgDn` scroll, `Home`/`End` (re)tie to tail, `esc` closes. There is
   **no input channel** into the sub-agent. Watching a running session
   auto-closes the overlay when it settles; settled sessions open as archive
   review (no auto-close). This replaces the old manual-dispatch command —
   dispatching happens only through the orchestrating agent.
3. **Dispatch Record** — completion messages render as one compact line
   (`sub-dispatch ▏ ✓ pi-3-x7k2 · done (exit 0) · 1m 10s`) instead of dumping
   the raw output tail into the transcript. The model still receives the full
   self-contained content (Trigger Wake-up semantics unchanged); ctrl+o
   (expanded mode) shows the complete tail inline — the only copy that
   survives `/reload` (the in-memory session table is cleared).

### `runDispatch()` — programmatic bridge

```ts
export async function runDispatch(opts: {
  agent: string;
  prompt: string;
  model?: string;
  timeoutSec?: number;
  cwd?: string;
  signal?: AbortSignal;
  modelRegistry?: ModelRegistry;
  onOutput?: (chunk: string) => void;
}): Promise<{
  ok: boolean;
  status: "running" | "done" | "error" | "killed" | "timeout";
  exitCode: number | null;
  output: string;
  usage?: { input; output; cacheRead; cacheWrite; total; cost };
  logFile: string;
}>
```

Re-exported from `index.ts` and defined in `runner.ts`. External extensions can
import it via a relative path `../sub-dispatch/runner.ts` for their own `execute`.
It drives one in-process sub-session (`runSession`), forwards assistant text to
`onOutput`, and resolves for every terminal outcome — callers branch on `status`
(not on a thrown error). `exitCode` is `0` for `done`, `1` otherwise.

## Forensic dump

Every dispatch — success, error, abort or timeout — writes a JSONL dump to:

```
~/.pi/agent/sub-dispatch-logs/<YYYY-MM-DD-HHmmss>-<sessionId>.jsonl
```

(one file per dispatch, named from its start time; an unknown-session failure
also leaves a dump). Line types:

| line | contents |
|------|----------|
| `input` | agent, prompt, cwd, model, sub-session id, ISO start time |
| `message` | every recorded session message, incl. full tool calls (one JSON object per line) |
| `result` | exit code, durationMs, output, status, and `usage` (tokens + cost) |

Appends are fire-and-forget on purpose: logging never delays or fails a
dispatch.

- The dispatch `details` carry `logFile` (absolute path), which links the main
  session JSONL to the sub-session's forensics — a chain that was broken in the
  spawn era.
- **No automatic cleanup**; `/dispatch gc [N]` prunes the oldest dumps, keeping
  the newest `N` (default **50**) and reporting deleted/kept counts.

## Config

Chosen location: **extension-dir `config.json`** (symlinked with the extension,
self-contained; layout inherited from the retired `code-mode` extension). Fields:

```jsonc
{
  "defaultTimeoutSec": 600
}
```

- `defaultTimeoutSec` is clamped to `1…86400`; unreadable or invalid config falls
  back to `600`.
- `commands`, `defaultArgs` and `maxOutputChars` were **removed** with the
  in-process rewrite: there is no subprocess and no argv to build, the agent set
  is fixed to `pi`, and the only truncation that remains is the completion
  notification's 20000-char tail (a `NOTIFICATION_OUTPUT_CHARS` constant in
  `index.ts`, not config).
- (`~/.pi/agent/sub-dispatch.json` is a documented alternative; this extension
  reads the extension-dir `config.json`.)

## Design notes

- **No process isolation**: a dispatch is an in-memory sub-session in the host
  process, not a subprocess — sub-agent and host share one trust domain.
  Background sessions live in a module-level `Map` (index.ts) — cleared on
  `/reload` (expected; README-accepted) and aborted on `session_shutdown`.
- **No recursion**: `dispatch` is excluded from the sub-session's tools
  (`excludeTools` + `setActiveToolsByName`), and `runSession` additionally
  rejects nesting via an `AsyncLocalStorage` depth guard.
- **Agent resolution** is a fixed allow-list (`SUPPORTED_AGENTS = ["pi"]`), so
  no name can resolve through `Object.prototype`.
- **Usage**: the sub-session's token/cost stats are captured before `dispose()`
  and land in the forensic `result` line.


## Files

- `index.ts` — entry: `dispatch` tool, `/dispatch` peek + `gc` commands, background
  session table, widget/renderer wiring. Re-exports `runDispatch`.
- `runner.ts` — core engine: `config.json` loading, in-process sub-session run
  (`createAgentSession` / `SessionManager.inMemory`), forensic JSONL log + `gcLogs`.
- `ui.ts` — visual surfaces: Dispatch Overview widget, Output Peek viewer,
  Dispatch Record renderer, shared output normalization.
- `config.json` — `defaultTimeoutSec` only.
- `package.json` / `README.md`.

## Known limitations

- No input into running sub-agents and no monitor/hands-free triggers — by
  design (reinstall npm:pi-interactive-shell if you ever need them). Output
  Peek is read-only.
- Foreground runs are one-shot; there is no way to type into a running
  foreground sub-agent.
- Background sessions die on `/reload` (module state reset); the Dispatch
  Record's expanded tail in the transcript is the durable copy.
- Instrumentation lives in the host process: a hard crash of the sub-session
  takes the host down with it (no process isolation).
- Only `pi` can be dispatched; codex/claude/cursor CLI dispatch is gone.

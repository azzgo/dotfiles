# sub-dispatch

Pi extension: **minimal sub-agent dispatch** — spawn a coding agent as a
subprocess and collect its output. Trimmed from
[pi-interactive-shell](https://github.com/nicobailon/pi-interactive-shell)
(v0.15.0) to a single use-case (dispatch a sub-agent, no PTY / interactive
input / monitor machinery) plus read-only visibility surfaces (see below).

A historical note: it was built as the **v2b bridge hook** for the since-removed
`code-mode` extension; that role is now filled by pi's built-in `codemode` tool
calling the `dispatch` tool directly (see `docs/adr/0011`).

## Install

Symlinked by the dotfiles `justfile`:

```bash
just install-pi    # links ~/.pi/agent/extensions/sub-dispatch -> pi/agent/extensions/sub-dispatch
```

Requires Node >= 23.6 (native TS type-stripping, same as pi itself).
pi-interactive-shell has been **removed** (replaced by this extension).

## Usage

### Tool `dispatch`

| param        | type    | default | notes                                                        |
|--------------|---------|---------|--------------------------------------------------------------|
| `agent`      | string  | —       | required for a new dispatch; `pi`/`codex`/`claude`/`cursor` or any key in `config.commands` |
| `prompt`     | string  | —       | required for a new dispatch; task prompt for the sub-agent   |
| `background` | boolean | false   | true → return `{ sessionId }` immediately; query/kill later   |
| `timeout`    | number  | 600     | seconds; kills the whole process group on expiry              |
| `reason`     | string  | —       | UI label shown in the footer status while foreground-running  |
| `env`        | object  | —       | environment variables for the sub-agent process (merged on top of process.env) |
| `sessionId`  | string  | —       | existing background session to query (or `kill: true`)        |
| `kill`       | boolean | —       | with `sessionId`, terminate the background session group      |

- **Foreground (default)**: waits, returns `{ exitCode, durationMs, output }` in
  `details` (stdout+stderr merged, tail-truncated to `maxOutputChars`, default 20000).
  Footer status shows `dispatch <agent> — running…` while waiting; Esc (abort
  signal) kills the process group.
- **Tool hints**: `annotations` declares `destructiveHint: true` (kill /
  process-group termination) and `openWorldHint: true` (arbitrary sub-agents).
- **Structured value** (`outputSchema` / `structuredContent`, what codemode
  scripts receive from `tools.dispatch`):
  - foreground → `{ exitCode, durationMs, output, complete: true }` (no `ok` —
    check `exitCode === 0`; failures also reject the promise)
  - background spawn → `{ sessionId, status: "running", complete: false }`
  - query → `{ sessionId, status, exitCode, durationMs, output, complete }`
  - kill → `{ sessionId, status: "killed", exitCode, output, complete: true }`
- **Background**: returns immediately with `{ sessionId }`; the host is
  **auto-notified when the session settles** — a `sendMessage` with
  `customType: "sub-dispatch"` and `{ triggerTurn: true, deliverAs: "followUp" }`
  wakes the agent (if idle) or queues behind an in-flight turn, carrying status,
  exit code, the output tail, and how to fetch full details. So the caller can
  fire-and-end-turn with no polling. `dispatch({ sessionId })` remains for
  mid-run status / diagnostics; `dispatch({ sessionId, kill: true })` kills the
  group and sends a `killed` notification.
- **Abort**: subprocess is spawned with `detached: true` (own process group);
  abort/timeout signal `SIGTERM` then `SIGKILL` the whole group.

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
  timeoutSec?: number;
  cwd?: string;
  signal?: AbortSignal;
  env?: Record<string, string>;
```

Re-exported from `index.ts` and defined in `runner.ts`. External extensions can
import it via a relative path `../sub-dispatch/runner.ts` for their own `execute`.
an `onOutput` stream callback (that lives on `spawnCommand`); it collects merged
output and returns it.

## codemode integration
With pi's built-in `codemode` tool (see `docs/adr/0011` — the old code-mode
extension was removed), `dispatch` is exposed to scripts as
`tools.dispatch({ agent, prompt, timeout? })`.

- **Foreground semantics**: inside a codemode program `await tools.dispatch(...)`
  blocks until the sub-agent exits and resolves to its structured value
  `{ exitCode, durationMs, output, complete }` (not a string; no `ok` field —
  check `exitCode === 0`) — no background session, no polling.
- **Timeout**: each dispatch inherits `defaultTimeoutSec` (600) unless a
  `timeout` (seconds) is passed; `spawnCommand` kills the process group on
  expiry.
- **Concurrency**: `Promise.all` over dispatches overlaps calls inside the
  script (QuickJS concurrency limits).
- **Abort**: the script-scoped signal is forwarded as the spawn `signal`, so
  Esc/abort at the codemode level kills the child process group.

## Config

Chosen location: **extension-dir `config.json`** (symlinked with the extension,
self-contained; layout inherited from the retired `code-mode` extension). Fields:

```jsonc
{
  "defaultAgent": "pi",
  "commands": { "pi": "pi", "codex": "codex", "claude": "claude", "cursor": "agent" },
  "defaultArgs": { "pi": ["-p"], "codex": [], "claude": ["-p"], "cursor": ["--model", "composer-2-fast"] },
  "maxOutputChars": 20000,
  "defaultTimeoutSec": 600
}
```

- Any key added to `commands` becomes a first-class spawn agent; add a matching
  `defaultArgs` entry for a per-agent argument prefix.
- `claude` ships with `-p` (print/non-interactive mode), which is required since
  sub-dispatch spawns without a PTY. Adjust `defaultArgs` per agent as needed.
- (`~/.pi/agent/sub-dispatch.json` is a documented alternative; this extension
  reads the extension-dir `config.json`.)

## Design notes

- **No shared mutable state across calls**: each dispatch is its own subprocess.
  Background sessions live in a module-level `Map` (index.ts) — cleared on
  `/reload` (expected; README-accepted). Killed on `session_shutdown`.
- **Agent resolution** is own-property-only (`Object.hasOwn`) so names like
  `constructor` don't resolve through `Object.prototype`.

## Files

- `index.ts` — entry: `dispatch` tool, `/dispatch` peek command, background
  session table, widget/renderer wiring. `runDispatch` (shared bridge).
- `ui.ts` — visual surfaces: Dispatch Overview widget, Output Peek viewer,
  Dispatch Record renderer, shared output normalization.
- `package.json` / `README.md`.

## Known limitations

- No input into running sub-agents and no monitor/hands-free triggers — by
  design (reinstall npm:pi-interactive-shell if you ever need them). Output
  Peek is read-only.
- Foreground runs are one-shot; there is no way to type into a running
  foreground sub-agent.
- Background sessions die on `/reload` (module state reset); the Dispatch
  Record's expanded tail in the transcript is the durable copy.
- `claude -p` / `codex exec` assume the CLI is on PATH and accepts a prompt
  positional arg; non-standard agents may need `defaultArgs` tweaks.

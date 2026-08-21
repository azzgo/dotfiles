# sub-dispatch

Pi extension: **minimal sub-agent dispatch** — spawn a coding agent as a
subprocess and collect its output. Trimmed from
[pi-interactive-shell](https://github.com/nicobailon/pi-interactive-shell)
(v0.15.0) to a single use-case (dispatch a sub-agent, no overlay / PTY /
interactive input / monitor machinery).

The secondary purpose is strategic: it provides the **v2b bridge hook** for the
`code-mode` extension (`pi/agent/extensions/code-mode/`) — a self-owned
`execute` for running sub-agents via `runDispatch()`.

## Install

Symlinked by the dotfiles `justfile`:

```bash
just install-pi    # links ~/.pi/agent/extensions/sub-dispatch -> pi/agent/extensions/sub-dispatch
```

Requires Node >= 23.6 (native TS type-stripping, same as `code-mode`).
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

- **Foreground (default)**: waits, returns `{ exitCode, durationMs, output }`
  (stdout+stderr merged, tail-truncated to `maxOutputChars`, default 20000).
  Footer status shows `dispatch <agent> — running…` while waiting; Esc (abort
  signal) kills the process group.
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

### Command `/dispatch`

Manual dispatch: `/dispatch <agent> <prompt...>` — runs in foreground and
notifies the result. E.g. `/dispatch pi "review the diffs"`.

### `runDispatch()` — code-mode bridge hook (v2b, reserved)

```ts
export async function runDispatch(opts: {
  agent: string;
  prompt: string;
  timeoutSec?: number;
  cwd?: string;
  signal?: AbortSignal;
  env?: Record<string, string>;
```

Re-exported from `index.ts` and defined in `runner.ts`. code-mode (same
`~/.pi/agent/extensions/` dir) can import it via a relative path
`../sub-dispatch/runner.ts` for its own `execute`. Note: it does **not** accept
an `onOutput` stream callback (that lives on `spawnCommand`); it collects merged
output and returns it.

## code-mode integration

When the **code-mode** extension is enabled (`/code`), `dispatch` is exposed in
the run_code SDK as `tools.dispatch({ agent, prompt, timeout? })`. code-mode
imports `runDispatch` directly from this package (`../sub-dispatch/runner.ts`).
The two extensions are sibling dirs under `~/.pi/agent/extensions/` and both are
symlinked by `just install-pi`; code-mode assumes sub-dispatch is installed.

- **Foreground semantics**: inside a run_code program `await tools.dispatch(...)`
  blocks until the sub-agent exits and returns the JSON text `{ ok, exitCode,
  output }` — no background session, no polling.
- **Timeout**: each dispatch inherits `defaultTimeoutSec` (600) unless a
  `timeout` (seconds) is passed; `spawnCommand` kills the process group on
  expiry. The run_code wall-clock cap is paused while a dispatch is in flight.
- **Concurrency**: `Promise.all` over dispatches overlaps up to code-mode's
  `maxConcurrent` (TaskPool).
- **Abort**: `runAbort.signal` is forwarded as the spawn `signal`, so Esc/abort
  at the run_code level kills the child process group.

## Config

Chosen location: **extension-dir `config.json`** (symlinked with the extension,
self-contained, mirrors `code-mode`). Fields:

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

- `index.ts` — entry: `dispatch` tool, `/dispatch` command, background table.
  `runDispatch` (shared bridge).
- `package.json` / `README.md`.

## Known limitations

- No interactive input, overlay, hands-free updates, or monitor triggers — by
  design (reinstall npm:pi-interactive-shell if you ever need them).
- Foreground runs are one-shot; there is no way to type into a running
  foreground sub-agent.
- Background sessions die on `/reload` (module state reset).
- `claude -p` / `codex exec` assume the CLI is on PATH and accepts a prompt
  positional arg; non-standard agents may need `defaultArgs` tweaks.

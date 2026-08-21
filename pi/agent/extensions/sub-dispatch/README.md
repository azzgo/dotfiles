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
| `sessionId`  | string  | —       | existing background session to query (or `kill: true`)        |
| `kill`       | boolean | —       | with `sessionId`, terminate the background session group      |

- **Foreground (default)**: waits, returns `{ exitCode, durationMs, output }`
  (stdout+stderr merged, tail-truncated to `maxOutputChars`, default 20000).
  Footer status shows `dispatch <agent> — running…` while waiting; Esc (abort
  signal) kills the process group.
- **Background**: returns immediately with `{ sessionId }`; query via
  `dispatch({ sessionId })`, kill via `dispatch({ sessionId, kill: true })`.
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
```

Re-exported from `index.ts` and defined in `runner.ts`. code-mode (same
`~/.pi/agent/extensions/` dir) can import it via a relative path
`../sub-dispatch/runner.ts` for its own `execute`. Note: it does **not** accept
an `onOutput` stream callback (that lives on `spawnCommand`); it collects merged
output and returns it.

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
  and its path returned to the caller (v2a scope — cleanup deferred to v2b).
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

# code-mode

Pi extension: **Code Mode** — collapse pi's tool catalog into a single `run_code`
tool plus an injected TypeScript SDK. The model writes one TS program that
composes many tool calls via `await tools.name(args)`; the program runs in an
isolated worker thread and only its logs + return value re-enter model context.

Port of DeepSeek Harness "PTC / Code Mode". Spec: `docs/adr/0001-code-mode-extension.md`.

## Install

Installed as a symlink by the dotfiles `justfile`:

```bash
just install-pi          # links ~/.pi/agent/extensions/code-mode -> pi/agent/extensions/code-mode
```

Requires Node >= 23.6 (native TS type-stripping for the worker).

## Usage

- `/code` toggles code mode ON/OFF (session-scoped; defaults OFF; resets on reload).
  - ON: `pi.setActiveTools(["run_code"])` — the model sees only `run_code`.
  - OFF: restores the previously active tool list.
- In code mode, the system prompt is appended with an SDK (`declare const tools`)
  covering the bridged tools and a collapse instruction (run_code is the only
  direct-call tool).
- `run_code` args: `{ code: string, description?: string }`.
  - `code` is an async TS program body; top-level `await` works.
  - End with `return <value>;` (use `return { ... };` for object results), or
    let a final simple expression be returned.
  - Stream intermediate output with `emit(value)` / `console.log`.
  - `fetchResult(toolCallId, offset, size?)` (host function, like `emit`): byte-slice
    the persisted full return value of a past `run_code` call whose result was
    truncated — `{ totalBytes, content, nextOffset }`; pure read from the session
    store, no side-effect replay (ADR 0003).
  - Sub-calls: `await tools.bash({ command: "..." })` — runs the real tool
    host-side (real execute, shared `withFileMutationQueue`), returns text output.
  - Node builtins: `require(...)` is injected into the program (rooted at the
    session cwd), e.g. `const fs = require("node:fs")` — `import` statements
    are NOT supported in the program body.
  - No directly-callable `dispatch` tool in code mode: sub-agents are spawned
    via `await tools.dispatch({ agent, prompt })` inside the program. They run
    in NATIVE mode with every tool callable — the escape hatch when a program
    keeps failing.


### Dispatch (sub-agent bridge)

`tools.dispatch` is bridged to the sibling **sub-dispatch** extension's
`runDispatch` (`../sub-dispatch/runner.ts`). It spawns a sub-agent (pi/codex/
claude/cursor or a custom key) as a foreground subprocess and awaits its exit:

```ts
const impl = await tools.dispatch({ agent: "pi", prompt: "implement X" });
const review = await tools.dispatch({ agent: "codex", prompt: "review the diff" });
return { impl, review };
```

- Resolves to a structured object `{ ok, exitCode, output }` (NOT a string —
  read fields directly; `output` is already tail-truncated by sub-dispatch).
  Parallel dispatch via `Promise.all([...])` overlaps under `maxConcurrent` (TaskPool).
- **Timeout exemption**: while any dispatch is in flight the run's wall-clock
  cap (`timeoutMs`, default 60s) is paused — so minute-scale sub-agents aren't
  killed by the run cap. Each dispatch still has its own internal timeout
  (default 600s) enforced by `runDispatch`/`spawnCommand`. Non-dispatch code
  (e.g. a pure infinite loop) still accrues toward `timeoutMs` and is killed.
- Esc / outer signal abort propagates to the child process group via
  `runAbort.signal` → `runDispatch`.
## Design

- **Presentation ≠ permission**: folding only hides tools; sub-calls execute the
  real built-in tool `execute` (via `createAllToolDefinitions(cwd)`), so
  `withFileMutationQueue` per-file serialization is preserved.
- **Worker isolation**: one fresh `worker_threads` Worker per run; the `tools`
  global proxies sub-calls back to the host over a `MessagePort` (pure
  event-driven, no polling). Wall-clock timeout + signal abort terminate the worker.
- **Result selectivity**: only `emit`/`console.log` output + the return value go
  to the model; every sub-call's full result is recorded in `details.calls`.
  Image-bearing sub-results are kept host-side only. Truncated return values are
  re-fetchable in-program via the `fetchResult()` host function (ADR 0003).
- **Bounded concurrency**: `Promise.all` over independent calls overlaps up to
  `maxConcurrent` (default 10) via a FIFO task pool (`scheduler.ts`).

## Files

- `index.ts` — entry: `/code` toggle, `run_code` tool, `before_agent_start` SDK+collapse.
- `worker.ts` — worker bootstrap (event-driven message bridge, no polling).
- `sdk.ts` — JSON-Schema → TS type projection + SDK text generation.
- `scheduler.ts` — bounded-concurrency sub-call pool.
- `config.json` — blacklist / timeout / concurrency / size caps.

## Config (`config.json`)

```jsonc
{
  "defaultOn": false,          // auto-enable code mode at session start
  "blacklist": ["mcpScript"],   // tools never exposed in SDK nor callable
  "timeoutMs": 60000,           // wall-clock cap per run (kills infinite loops)
  "maxConcurrent": 10,          // in-flight sub-call cap
  "maxResultBytes": 8192,       // return value shown to the model (byte cap; also the fetchResult slice cap)
  "maxRecordBytes": 50000       // per-sub-call content kept in details.calls
}
```

## Known limitations

- Only pi's **built-in** tools (`read`, `bash`, `edit`, `write`, `grep`, `find`,
  `ls`) are bridged. Tools registered by other extensions are not exposable via
  this API (pi's extension surface doesn't expose foreign tool `execute`), so
  they're simply absent from the SDK and rejected if called.
- Bare trailing object/array literals are not auto-returned (JS treats a leading
  `{` as a block) — use explicit `return { ... };`.
- Not a hard security boundary: worker code can reach Node APIs (comparable to
  the `bash` tool). Isolation + empty-env + heap caps + terminate, but no sandbox.

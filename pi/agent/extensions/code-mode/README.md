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
  - Sub-calls: `await tools.bash({ command: "..." })` — runs the real tool
    host-side (real execute, shared `withFileMutationQueue`), returns text output.

## Design

- **Presentation ≠ permission**: folding only hides tools; sub-calls execute the
  real built-in tool `execute` (via `createAllToolDefinitions(cwd)`), so
  `withFileMutationQueue` per-file serialization is preserved.
- **Worker isolation**: one fresh `worker_threads` Worker per run; the `tools`
  global proxies sub-calls back to the host over a `MessagePort` (pure
  event-driven, no polling). Wall-clock timeout + signal abort terminate the worker.
- **Result selectivity**: only `emit`/`console.log` output + the return value go
  to the model; every sub-call's full result is recorded in `details.calls`.
  Image-bearing sub-results are kept host-side only.
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
  "blacklist": ["mcpScript"],   // tools never exposed in SDK nor callable
  "timeoutMs": 60000,           // wall-clock cap per run (kills infinite loops)
  "maxConcurrent": 10,          // in-flight sub-call cap
  "maxResultBytes": 8192,       // return value shown to the model (byte cap)
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

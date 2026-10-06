---
name: impl-with-spawn
description: Delegate goal tasks to pi or cursor sub-agents via dispatch (sub-dispatch extension). Defaults to parallel background dispatch. Supports multi-agent delegation when subtasks are independent. Use when the user wants to "implement this", "build X", "fix Y", "add feature Z", or run multi-step coding tasks by dispatching to sub-agents.
disable-model-invocation: true
---

# Impl with Spawn

Decompose the user's goal into subtasks, then delegate to sub-agents via the `dispatch` tool (from the **sub-dispatch** extension). Parallel background dispatch when subtasks are independent; foreground dispatch for a single blocking task.

## Agent Selection

Consult the shared skill **`spawn-model-selection`** for the model-choice priority list — it is the single source of truth (avoids maintaining the list in multiple places). Key rules:

- User explicitly names an agent/model → use it directly.
- Neither specified → pick cheapest-first, good-enough from what is **actually available** (probe `pi --list-models`).
- Local Ollama small models → commit messages / cleanup only; **cap at 2 concurrent dispatches**.
- When unsure, default to `pi` (the spawn default agent).

## Dispatch semantics (sub-dispatch)

- `dispatch({ agent, prompt })` — **foreground**: waits for the sub-agent to finish, returns `{ exitCode, durationMs, output }`. Blocks this turn until done (default timeout 600s, override with `timeout` seconds).
- `dispatch({ agent, prompt, background: true })` — returns a `sessionId` immediately. The host is **auto-notified when the session completes** (sub-dispatch sends a `triggerTurn` message with status + output tail), so no polling is needed. Kill with `dispatch({ sessionId, kill: true })`; query with `dispatch({ sessionId })` only for diagnostics/recovery.
- Agents: `pi` / `codex` / `claude` / `cursor` + any key added to the extension's `config.json` `commands`.
- `pi` runs in print mode (`defaultArgs` already sets `-p`), so sub-agents exit naturally when done — no quiet-kill risk, no exit-flag troubleshooting.
- No overlay / no interactive takeover: sub-agents run headless as subprocesses. If a task needs interactive guidance, do it yourself instead of dispatching.

## Flow

### 1. Analyze and Decompose

1. **Is the goal decomposable into independent subtasks?**
   - Independent = subtask A doesn't need subtask B's output to start
   - Example: "Add dark mode and fix login bug" → two independent tasks
   - Counter-example: "Design schema, then implement API, then write tests" → sequential

2. **Group by dependency tier.** Parallelize within each tier.

3. **Decide strategy:**

| Scenario | Strategy |
|---|---|
| Simple, single-focus task | Single foreground dispatch |
| Multiple independent subtasks | **Parallel background dispatch** — fire all at once |
| Sequential subtasks (A→B→C) | Foreground dispatch A → wait → dispatch B → … (or background, completion auto-notifies) |
| Mixed | Group into tiers, parallelize within each tier |
| **Local ollama model** | Parallel, **max 2 concurrent** — queue the rest |

### 2. Dispatch

**Single task (foreground, simplest):**
```typescript
dispatch({ agent: "pi", prompt: "concrete task description", reason: "brief note" })
```
The turn blocks until it finishes; the result (exitCode + output) is the return value.

**Parallel dispatch (multiple independent subtasks):**
Fire all dispatches in a single tool-call batch with `background: true`, then **end your turn** — each completion auto-notifies via triggerTurn and wakes you with its output. Do NOT sleep+query poll. Each `prompt` must be **self-contained** — include all context (file paths, expected behavior, constraints). Use distinct `reason` values to match results back to tasks.

If the active model is local ollama, **fire at most 2 dispatches per batch** (hard cap of 2 concurrent sub-agents); wait for their completions before dispatching the next batch.

```typescript
// Batch: fire all independent subtasks at once (parallel tool calls)
dispatch({ agent: "pi", prompt: "Add dark mode to SettingsPage.tsx. Toggle in header, persist to localStorage.", background: true, reason: "subtask-1: dark-mode" })
dispatch({ agent: "pi", prompt: "Fix login redirect bug in auth.ts — redirect to original URL, not /dashboard.", background: true, reason: "subtask-2: login-redirect" })
```

**IMPORTANT:** Do NOT parallelize if a subtask produces output another subtask needs (e.g., "generate types first, then implement"). Run those sequentially.

### 3. Collect Results

- **Foreground**: results are the tool return values — synthesize directly.
- **Background**: each session **auto-notifies on completion** (triggerTurn wake with status + output tail). Fire all, end your turn, and the notifications arrive on their own — never `sleep N && dispatch({ sessionId })` poll. Use `dispatch({ sessionId })` only as a diagnostic/recovery path (e.g. a notification is missing or you need mid-run status).
- **Failure**: re-dispatch with more specific instructions, or fix it yourself.

### 4. Synthesize and Report

1. Review each sub-agent's output
2. Verify all subtasks completed (exitCode 0 + substantive output)
3. If any failed, re-dispatch with more specific instructions or fix it yourself
4. Summarize what was done to the user

## Code Mode shape
## Code Mode shape

Write ONE `codemode` script: dispatch sub-agents with `background: true`, then
join them in-script with `pollMs` long-polls. Never foreground-await a dispatch
in a script — that black-boxes the whole wait (no mid-run visibility, no early
kill), and the sandbox has no sleep for hand-rolled polling.

```ts
const jobs = await Promise.all([
  tools.dispatch({ agent: "pi", prompt: "dark mode in SettingsPage.tsx", background: true, reason: "impl-a", timeout: 300 }),
  tools.dispatch({ agent: "pi", prompt: "fix login redirect in auth.ts", background: true, reason: "impl-b", timeout: 300 }),
  tools.dispatch({ agent: "pi", prompt: "add search filters", background: true, reason: "impl-c", timeout: 300 }),
]);

let results;
for (let i = 0; i < 120; i++) {
  results = await Promise.all(jobs.map((j) => tools.dispatch({ sessionId: j.sessionId, pollMs: 5000 })));
  if (results.every((r) => r.complete)) break;
}
return results.map((r) => ({ status: r.status, exitCode: r.exitCode, output: r.output }));
```

- Fire the batch with `background: true` — each call resolves immediately with
  `{ sessionId, complete: false }`.
- `dispatch({ sessionId, pollMs: 5000 })` long-polls: blocks up to 5s, returns
  early once that session settles. One loop round ≈ 5s; each query is
  observation only and never affects the sub-agent.
- Each query resolves to a structured object `{ sessionId, status, exitCode,
  durationMs, output, complete, logFile }` (read fields directly — no
  JSON.parse; no `ok` field — check `exitCode === 0`).
- Mid-run intervention: if a round shows a session errored / ran off track,
  `tools.dispatch({ sessionId: j.sessionId, kill: true })` it and re-dispatch
  with more specific instructions instead of waiting out its timeout.
- Cap the loop rounds (e.g. 120 ≈ 10 min) so a hung session can't spin forever;
  on cap, kill stragglers and synthesize from what completed.
- The tool-batch + end-turn shape above stays preferred when you don't need the
  joined results inside one turn — completion auto-notifies and you synthesize
  across turns.
- Still respect dependency tiers: run sequential subtasks as sequential `await`s;
  never parallelize when one subtask's output feeds another.

## Examples

- **Single task**: "Fix broken pagination on search results" → single foreground dispatch
- **Parallel**: "Implement user avatars, email notifications, and search filters" → 3 parallel background dispatches, fire and end turn (each completion auto-notifies)
- **Mixed**: "Set up project structure, then implement auth, then add protected routes" → Tier 1: structure (1 foreground dispatch) → Tier 2: auth + routes (2 parallel background dispatches)

---
name: impl-with-spawn
description: Delegate goal tasks to pi or cursor sub-agents via interactive_shell. Defaults to headless background dispatch. Supports parallel multi-agent delegation when subtasks are independent. Use when the user wants to "implement this", "build X", "fix Y", "add feature Z", or run multi-step coding tasks by dispatching to sub-agents.
disable-model-invocation: true
---

# Impl with Spawn

Decompose the user's goal into subtasks, then delegate to sub-agents via `interactive_shell`. Parallel dispatch when subtasks are independent; serial dispatch otherwise.

## Agent Selection

Providers / agents vary by machine (pi, cursor, opencode-go, etc. differ from machine to machine). **Do not rely on a hard-coded mapping — probe the environment before dispatching and choose heuristically:**

1. **User explicitly names an agent** → use it directly.
2. **User names a model** (e.g. `deepseek-v4-pro`) → use `pi --list-models` (then `agent --list-models` if present) to find which agent can run it. **pi runs every provider configured on pi and is the universal fallback.**
3. **Neither specified** → pick from what is **actually available on this machine**, cheapest-first, good-enough:
   - **Simple / mechanical tasks** (refactor, add tests, fix typo, etc.):
     1. `minimax-m2.7` — generous quota, first choice for light tasks (~200K context)
     2. `opencode/hy3` — multimodal, stronger than mimo2.5, currently 8x quota, 256K context
     3. `opencode/mimo-v2.5` — 1M context multimodal ($0.14/$0.28 per 1M), weaker multimodal than hy3
     4. `deepseek-v4-flash` — 1M context, for mid-weight tasks
     5. Local Ollama small models — commit messages, cleanup only; **max 2 concurrent**
   - **Complex / long-context tasks** (multi-file design, large refactor, architecture):
     1. `deepseek-v4-flash` — 1M context, best value for long-context scenarios
     2. `opencode/mimo-v2.5` — 1M context multimodal fallback
     3. `opencode/hy3` — stronger multimodal, but 256K context limit
   - **Note**: `deepseek-v4-pro` no longer recommended by default after price hike, use only when user explicitly requests it; `MiniMax-M3` excluded due to unstable instruction following; prefer `hy3` for multimodal, fall back to `mimo-v2.5` when 1M context is needed
   - Cursor-exclusive Composer models → `cursor` (`agent`); fall back to `pi` if unavailable
4. **Model runs on local ollama** → it shares this machine's GPU/CPU with the main agent. **Cap concurrent dispatches at 2** (see below).

**Rule**: trust the actual `pi --list-models` output; opencode-go / official deepseek mentioned elsewhere are only "maybe available" examples — **never assume they exist**. When unsure, default to `pi` (the spawn default agent).
**Concurrency limit (local ollama):** when the selected model is served by local ollama, never keep more than **2 sub-agents running concurrently** — parallel work beyond that thrashes local GPU/CPU and memory, slowing every agent, including yourself. Dispatch at most 2 at a time, wait for completions, then dispatch the next batch.

## Mode

Default: **background dispatch** — headless, no overlay, multiple can run concurrently (essential for parallel delegation).

```typescript
interactive_shell({
  spawn: { agent: "pi", prompt: "concrete task description" },
  mode: "dispatch",
  background: true,
  handsFree: { autoExitOnQuiet: false },  // don't let a quiet sub-agent get killed
  reason: "brief note"
})
```

If the task is open-ended and the user may want to guide, fall back to foreground `dispatch` (user sees overlay, can take over).

**Every dispatch must pass `handsFree: { autoExitOnQuiet: false }`** — dispatch defaults to `autoExitOnQuiet: true`, and ~8s of silence (thinking, between outputs) can get the sub-agent killed. With `-p` configured the sub-agent exits naturally, so disabling it only prevents accidental kills and doesn't affect completion notifications; if an agent can't exit (no print mode), you must restore `autoExitOnQuiet: true`, otherwise the notification never fires.

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
| Simple, single-focus task | Single dispatch |
| Multiple independent subtasks | **Parallel dispatch** — fire all at once |
| Sequential subtasks (A→B→C) | Dispatch A → end turn → wake → dispatch B → end turn → … |
| Mixed | Group into tiers, parallelize within each tier |
| **Local ollama model** | Parallel, **max 2 concurrent** — queue the rest |

### 2. Dispatch

**Single task:**
```typescript
interactive_shell({
  spawn: { agent: "pi", prompt: "concrete task description" },
  mode: "dispatch",
  background: true,
  handsFree: { autoExitOnQuiet: false },
  reason: "brief note"
})
```

**Parallel dispatch (multiple independent subtasks):**
Fire all dispatches back-to-back in a single tool-call batch. Each `prompt` must be **self-contained** — include all context (file paths, expected behavior, constraints). Use distinct `reason` values to match results back to tasks.

If the active model is local ollama, **fire at most 2 dispatches per batch** (hard cap of 2 concurrent sub-agents); wait for their completions before dispatching the next batch.

```typescript
// Batch: fire all independent subtasks at once
interactive_shell({
  spawn: { agent: "pi", prompt: "Add dark mode to SettingsPage.tsx. Toggle in header, persist to localStorage." },
  mode: "dispatch", background: true,
  handsFree: { autoExitOnQuiet: false },
  reason: "subtask-1: dark-mode"
})
interactive_shell({
  spawn: { agent: "pi", prompt: "Fix login redirect bug in auth.ts — redirect to original URL, not /dashboard." },
  mode: "dispatch", background: true,
  handsFree: { autoExitOnQuiet: false },
  reason: "subtask-2: login-redirect"
})
```

**IMPORTANT:** Do NOT parallelize if a subtask produces output another subtask needs (e.g., "generate types first, then implement"). Run those sequentially.

### 3. Wait for Results

**Dispatch is notification-driven and non-blocking — after dispatching, end the current turn immediately (stop issuing tool calls); no sleep, no polling.** The extension wakes you with `triggerTurn` when a sub-agent finishes; its output is already in context.

**Prerequisite: the sub-agent must be able to exit naturally** or the completion notification won't fire (pi needs print mode: `pi -p` exits when done; TUI-form `pi <prompt>` never exits after finishing and hangs forever). This repo already sets `defaultArgs.pi: ["-p"]` in `pi/agent/interactive-shell.json`, so all pi spawns run in print mode automatically. On an unconfigured machine/agent: give that agent an equivalent exit flag; if impossible, restore `autoExitOnQuiet: true` (accept "done = quiet-kill", notification marked was killed) or manually `query` + `kill`.

- **Parallel tier**: dispatch all → end turn → wake on each completion → synthesize.
- **Serial tier** (A→B→C): dispatch A → **end turn** → wake (A done) → dispatch B → end turn → …
- **Never wait with `sleep N && echo` + status queries**: staying busy only piles up triggerTurn notifications, sleep is wasted waiting, and polling self-reinforces.
- If in-turn progress updates are truly needed: switch to `mode: "hands-free"` (periodic updates; note status queries are rate-limited to 60s by default).

### 4. Synthesize and Report

1. Review each sub-agent's output
2. Verify all subtasks completed
3. If any failed, re-dispatch with more specific instructions or fix it yourself
4. Summarize what was done to the user

## Examples

- **Single task**: "Fix broken pagination on search results" → single dispatch
- **Parallel**: "Implement user avatars, email notifications, and search filters" → 3 parallel dispatches
- **Mixed**: "Set up project structure, then implement auth, then add protected routes" → Tier 1: structure (1 dispatch) → Tier 2: auth + routes (2 parallel dispatches)

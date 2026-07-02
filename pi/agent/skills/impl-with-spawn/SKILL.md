---
name: impl-with-spawn
description: Delegate goal tasks to pi or cursor sub-agents via interactive_shell. Defaults to headless background dispatch. Supports parallel multi-agent delegation when subtasks are independent. Use when the user wants to "implement this", "build X", "fix Y", "add feature Z", or run multi-step coding tasks by dispatching to sub-agents.
---

# Impl with Spawn

Decompose the user's goal into subtasks, then delegate to sub-agents via `interactive_shell`. Parallel dispatch when subtasks are independent; serial dispatch otherwise.

## Agent Selection

Choose agent based on the target model:

| Model family | Agent | Reason |
|---|---|---|
| `composer` (e.g. `composer-2.5`, `composer-2-fast`) | **cursor** | Composer is Cursor's exclusive model |
| `deepseek` — `deepseek-v4-flash` | **opencode-go** | Prefer opencode-go for flash |
| `deepseek` — `deepseek-v4-pro` | **deepseek (official)** | Prefer the official DeepSeek provider |
| `minimax` (e.g. `MiniMax-M2.7`) | **pi** | MiniMax is configured on pi |
| User explicitly names an agent | Use that agent | — |

**Before spawning, pick agent + model together.** Check available models via `pi --list-models` or `agent --list-models`. Prioritize cost-effective models: minimax → pi, deepseek-v4-flash → opencode-go, deepseek-v4-pro → deepseek, composer → cursor.

## Mode

Default: **background dispatch** — headless, no overlay, multiple can run concurrently (essential for parallel delegation).

```typescript
interactive_shell({
  spawn: { agent: "pi", prompt: "具体任务描述" },
  mode: "dispatch",
  background: true,
  reason: "简短说明"
})
```

If the task is open-ended and the user may want to guide, fall back to foreground `dispatch` (user sees overlay, can take over).

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
| Sequential subtasks (A→B→C) | Dispatch A, wait, dispatch B, wait, dispatch C |
| Mixed | Group into tiers, parallelize within each tier |

### 2. Dispatch

**Single task:**
```typescript
interactive_shell({
  spawn: { agent: "pi", prompt: "具体任务描述" },
  mode: "dispatch",
  background: true,
  reason: "简短说明"
})
```

**Parallel dispatch (multiple independent subtasks):**
Fire all dispatches back-to-back in a single tool-call batch. Each `prompt` must be **self-contained** — include all context (file paths, expected behavior, constraints). Use distinct `reason` values to match results back to tasks.

```typescript
// Batch: fire all independent subtasks at once
interactive_shell({
  spawn: { agent: "pi", prompt: "Add dark mode to SettingsPage.tsx. Toggle in header, persist to localStorage." },
  mode: "dispatch", background: true, reason: "subtask-1: dark-mode"
})
interactive_shell({
  spawn: { agent: "pi", prompt: "Fix login redirect bug in auth.ts — redirect to original URL, not /dashboard." },
  mode: "dispatch", background: true, reason: "subtask-2: login-redirect"
})
```

**IMPORTANT:** Do NOT parallelize if a subtask produces output another subtask needs (e.g., "generate types first, then implement"). Run those sequentially.

### 3. Wait for Results

Dispatch mode sends notifications on completion — no polling needed. For sequential tiers, wait for each tier before dispatching the next.

### 4. Synthesize and Report

1. Review each sub-agent's output
2. Verify all subtasks completed
3. If any failed, re-dispatch with more specific instructions or fix it yourself
4. Summarize what was done to the user

## Examples

- **Single task**: "Fix broken pagination on search results" → single dispatch
- **Parallel**: "Implement user avatars, email notifications, and search filters" → 3 parallel dispatches
- **Mixed**: "Set up project structure, then implement auth, then add protected routes" → Tier 1: structure (1 dispatch) → Tier 2: auth + routes (2 parallel dispatches)

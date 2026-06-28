---
name: impl-with-spawn
description: Delegate a goal task to pi or cursor sub-agents via interactive_shell. Defaults to headless background dispatch. Supports parallel multi-agent delegation when subtasks are independent. Use when user wants to "implement this", "build X", "fix Y", or run multi-step coding tasks.
---

Understand the user's goal, decompose into subtasks where possible, then delegate to sub-agents via `interactive_shell`. Parallel dispatch when subtasks are independent; serial dispatch otherwise.

## Agent

Choose the spawn agent based on the target model:

| Model family | Agent | Reason |
|---|---|---|
| `composer` (e.g. `composer-2.5`, `composer-2-fast`) | **cursor** | Composer is Cursor's exclusive model |
| `deepseek` — `deepseek-v4-flash` | **opencode-go** | Prefer opencode-go for flash |
| `deepseek` — `deepseek-v4-pro` | **deepseek (official)** | Prefer the official DeepSeek provider |
| `minimax` (e.g. `MiniMax-M2.7`) | **pi** | MiniMax is configured on pi |
| User explicitly names an agent | Use that agent | — |

## Model Selection (IMPORTANT)

**Before spawning, pick agent + model together.**

1. Check available models:
   - Pi: `pi --list-models`
   - Cursor: `agent --list-models`
2. **Prioritize cost-effective models** (each maps to an agent):
   - `minimax` → pi
   - `deepseek-v4-flash` → opencode-go
   - `deepseek-v4-pro` → deepseek (official)
   - `composer-2.5` → cursor
   - `composer-2-fast` → cursor (Cursor's default)
3. Pass the selected model via `--model` flag.

Example (pi with deepseek):
```bash
pi --list-models  # Verify deepseek is available
```

```typescript
interactive_shell({
  spawn: { agent: "pi", prompt: "具体任务描述" },
  mode: "dispatch",
  background: true,
  reason: "简短说明"
})
// Pi will use the model from config or --model flag
```

Example (cursor with composer):
```bash
agent --list-models  # Verify composer is available
```

```typescript
interactive_shell({
  spawn: { agent: "cursor", prompt: "具体任务描述" },
  mode: "dispatch",
  background: true,
  reason: "简短说明"
})
// Cursor spawn defaults to --model composer-2-fast
```

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

### Step 1: Analyze and Decompose

Before dispatching, analyze the goal:

1. **Is the goal decomposable into independent subtasks?**
   - Independent = subtask A doesn't need subtask B's output to start
   - Example: "Add dark mode to settings and fix the login bug" → two independent tasks
   - Counter-example: "Design schema, then implement API, then write tests" → sequential, each depends on prior

2. **Group by dependency:**
   - If subtasks have dependencies, order them. Parallelize within each dependency tier.

3. **Decide: single agent or multi-agent?**

| Scenario | Strategy |
|---|---|
| Simple, single-focus task | Single dispatch |
| Multiple independent subtasks | **Parallel dispatch** — fire all at once |
| Sequential subtasks (A→B→C) | Dispatch A, wait, dispatch B, wait, dispatch C |
| Mixed: some parallel, some sequential | Group into tiers, parallelize within each tier |

### Step 2: Dispatch

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

Fire all dispatches back-to-back in a single tool-call batch. Each gets its own `reason` so you can identify which result is which:

```typescript
// Batch 1: fire all independent subtasks at once
interactive_shell({
  spawn: { agent: "pi", prompt: "Add dark mode support to SettingsPage.tsx. Toggle in header, persist preference to localStorage." },
  mode: "dispatch",
  background: true,
  reason: "subtask-1: dark-mode"
})

interactive_shell({
  spawn: { agent: "pi", prompt: "Fix the login redirect bug in auth.ts — after login, redirect to the original URL the user was trying to access, not always /dashboard." },
  mode: "dispatch",
  background: true,
  reason: "subtask-2: login-redirect-bug"
})

interactive_shell({
  spawn: { agent: "pi", prompt: "Add unit tests for the user profile form validation in __tests__/profile.test.ts." },
  mode: "dispatch",
  background: true,
  reason: "subtask-3: profile-tests"
})
```

**IMPORTANT for parallel dispatch:**
- Each `prompt` must be **self-contained** — include all context the sub-agent needs (file paths, expected behavior, constraints). The sub-agent starts from scratch and cannot see your analysis.
- Use distinct `reason` values to match results back to tasks.
- Do NOT use the same agent for every task blindly — select agent per subtask based on model suitability (composer for heavy reasoning, deepseek for straightforward code gen, etc.).
- If a subtask produces output another subtask needs (e.g., "generate types first, then implement"), do NOT parallelize those two — run them sequentially.

### Step 3: Wait for Results

Dispatch mode sends notifications on completion. You do not need to poll.

When all parallel dispatches complete, you'll have their outputs. For sequential tiers, wait for each tier before dispatching the next.

### Step 4: Synthesize and Report

1. Review each sub-agent's output
2. Verify all subtasks completed successfully
3. If any failed, re-dispatch that subtask with more specific instructions or fix it yourself
4. Summarize what was done across all sub-agents to the user

## Examples

**Example 1: Single task (no decomposition possible)**

```
User: "Fix the broken pagination on the search results page"
→ Single focus, one file likely → single dispatch
```

**Example 2: Parallel decomposition**

```
User: "Implement these three features: user avatars, email notifications, and search filters"
→ Three independent features → 3 parallel dispatches
→ Each prompt self-contained with file paths and specs
```

**Example 3: Mixed (tiered)**

```
User: "Set up the project structure, then implement auth, then add protected routes"
→ Tier 1: project structure (1 dispatch)
→ Wait for tier 1
→ Tier 2: auth + protected routes are independent once structure exists → 2 parallel dispatches
```

Goal: $@

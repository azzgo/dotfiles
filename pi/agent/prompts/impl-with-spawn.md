---
name: impl-with-spawn
description: Delegate a goal task to a pi or cursor sub-agent via interactive_shell. Defaults to headless background dispatch. Use when user wants to "implement this", "build X", "fix Y", or run multi-step coding tasks.
---

Understand the user's goal, then delegate it to a sub-agent via `interactive_shell`.

## Agent

Choose the spawn agent based on the target model:

| Model family | Agent | Reason |
|---|---|---|
| `composer` (e.g. `composer-2.5`, `composer-2-fast`) | **cursor** | Composer is Cursor's exclusive model |
| `deepseek` (e.g. `deepseek-v4-flash`, `deepseek-v4-pro`) | **pi** | DeepSeek is only configured on pi |
| `minimax` (e.g. `MiniMax-M2.7`) | **pi** | MiniMax is configured on pi |
| Copilot models (claude/gpt/gemini) | **pi** | Available via GitHub Copilot on pi |
| User explicitly names an agent | Use that agent | — |

## Model Selection (IMPORTANT)

**Before spawning, pick agent + model together.**

1. Check available models:
   - Pi: `pi --list-models`
   - Cursor: `agent --list-models`
2. **Prioritize cost-effective models** (each maps to an agent):
   - `minimax` → pi
   - `deepseek-v4-flash` / `deepseek-v4-pro` → pi
   - `composer-2.5` → cursor
   - `composer-2-fast` → cursor (Cursor's default)
   - `gpt-4o-mini` / `gpt-5-mini` → pi (last resort)
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

Default: **background dispatch** — headless, no overlay, multiple can run concurrently.

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

1. 确认目标
2. 根据 target model 确定 agent（composer → cursor，deepseek/minimax/copilot → pi）
3. 拼好 prompt，background dispatch
4. 完成后汇报结果

Goal: $@

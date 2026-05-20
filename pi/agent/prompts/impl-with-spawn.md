---
name: impl-with-spawn
description: Delegate a goal task to a pi or cursor sub-agent via interactive_shell. Defaults to headless background dispatch. Use when user wants to "implement this", "build X", "fix Y", or run multi-step coding tasks.
---

Understand the user's goal, then delegate it to a sub-agent via `interactive_shell`.

## Agent

Default to **pi**. Use **cursor** only if the user explicitly names it.

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
2. 确认 agent（默认 pi）
3. 拼好 prompt，background dispatch
4. 完成后汇报结果

Goal: $@

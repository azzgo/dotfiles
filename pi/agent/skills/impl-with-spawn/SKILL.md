---
name: impl-with-spawn
description: Delegate goal tasks to pi or cursor sub-agents via interactive_shell. Defaults to headless background dispatch. Supports parallel multi-agent delegation when subtasks are independent. Use when the user wants to "implement this", "build X", "fix Y", "add feature Z", or run multi-step coding tasks by dispatching to sub-agents.
disable-model-invocation: true
---

# Impl with Spawn

Decompose the user's goal into subtasks, then delegate to sub-agents via `interactive_shell`. Parallel dispatch when subtasks are independent; serial dispatch otherwise.

## Agent Selection

每台机器配置的 provider / agent 可能不同（pi、cursor、opencode-go 等随机器而异）。**不要依赖硬编码映射——派发前先探测环境，启发式自主选择：**

1. **用户明确指定 agent** → 直接用。
2. **用户指定了模型**（如 `deepseek-v4-pro`）→ 用 `pi --list-models`（若存在再 `agent --list-models`）确认哪个 agent 能跑该模型。**pi 能跑所有配置在 pi 上的 provider，是通用兜底**。
3. **都未指定** → 从**当前机器实际可用**的列表里按成本优先、够用即可选择：
   - 简单/机械任务 → 最便宜的 flash 级模型（如 minimax、deepseek-v4-flash）→ `pi`
   - 复杂/长上下文任务 → pro 级模型（如 deepseek-v4-pro、MiniMax-M3）→ `pi`
   - 需要 Cursor 独占的 Composer 模型 → `cursor`（`agent`），不可用则退回 `pi`

**规则**：以 `pi --list-models` 实际输出为准；别处提到的 opencode-go / 官方 deepseek 等只是"可能可用"的示例，**永远不要假设它们存在**。不确定时默认用 `pi`（spawn 默认 agent）。

## Mode

Default: **background dispatch** — headless, no overlay, multiple can run concurrently (essential for parallel delegation).

```typescript
interactive_shell({
  spawn: { agent: "pi", prompt: "具体任务描述" },
  mode: "dispatch",
  background: true,
  handsFree: { autoExitOnQuiet: false },  // 防止静默子 agent 被误杀
  reason: "简短说明"
})
```

If the task is open-ended and the user may want to guide, fall back to foreground `dispatch` (user sees overlay, can take over).

**所有 dispatch 一律传 `handsFree: { autoExitOnQuiet: false }`**——dispatch 默认 `autoExitOnQuiet: true`，静默约 8s（思考中、输出间隙）就可能被 kill。配置了 `-p` 后子 agent 会自然退出，关掉它只防误杀、不影响完成通知；若某 agent 不会退出（无 print mode），则必须恢复 `autoExitOnQuiet: true`，否则通知永不触发。

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

### 2. Dispatch

**Single task:**
```typescript
interactive_shell({
  spawn: { agent: "pi", prompt: "具体任务描述" },
  mode: "dispatch",
  background: true,
  handsFree: { autoExitOnQuiet: false },
  reason: "简短说明"
})
```

**Parallel dispatch (multiple independent subtasks):**
Fire all dispatches back-to-back in a single tool-call batch. Each `prompt` must be **self-contained** — include all context (file paths, expected behavior, constraints). Use distinct `reason` values to match results back to tasks.

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

**Dispatch 是通知驱动、非阻塞的——派发后立即结束当前轮次（停止发任何 tool-call），不要 sleep、不要轮询。** 子 agent 完成时扩展会用 `triggerTurn` 唤醒你，输出已带在上下文里。

**前提：子 agent 必须能自然退出**，完成通知才会触发（pi 需 print mode：`pi -p` 处理完即退出；TUI 形态的 `pi <prompt>` 完成任务后不退出，会永久挂起）。本仓库已在 `pi/agent/interactive-shell.json` 配置 `defaultArgs.pi: ["-p"]`，所有 pi spawn 自动走 print mode。若在未配置的机器/agent 上运行：给该 agent 配等价退出标志；配不了就恢复 `autoExitOnQuiet: true`（接受"完成 = quiet-kill"，通知标注 was killed）或手动 `query` + `kill`。

- **并行 tier**：全部派出 → 结束轮次 → 每个完成时被唤醒 → 汇总。
- **串行 tier**（A→B→C）：派 A → **结束轮次** → 被唤醒（A 完成）→ 派 B → 结束轮次 → ……
- **绝不要用 `sleep N && echo` + 状态查询来等**：持续 busy 只会让 triggerTurn 通知积压，sleep 白等，轮询自强化。
- 若确实需要轮内进度更新：改用 `mode: "hands-free"`（有周期更新；注意状态查询默认限频 60s/次）。

### 4. Synthesize and Report

1. Review each sub-agent's output
2. Verify all subtasks completed
3. If any failed, re-dispatch with more specific instructions or fix it yourself
4. Summarize what was done to the user

## Examples

- **Single task**: "Fix broken pagination on search results" → single dispatch
- **Parallel**: "Implement user avatars, email notifications, and search filters" → 3 parallel dispatches
- **Mixed**: "Set up project structure, then implement auth, then add protected routes" → Tier 1: structure (1 dispatch) → Tier 2: auth + routes (2 parallel dispatches)

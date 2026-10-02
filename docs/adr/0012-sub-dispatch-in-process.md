# sub-dispatch 改为进程内实现（放弃 spawn 子 pi 进程）

pi 1.0 的 SDK 允许在 tool `execute()` 内用 `createAgentSession()` 驱动完整 agent loop。sub-dispatch 从 spawn 独立 pi 进程改为进程内 in-memory session，理由：删除进程管理/argv 拼装/stdout 捕获约 250 行，获得 usage 计费、流式进度、结构化 transcript，且子会话不再污染 resume list（用户明确不想要子会话出现在 resume 列表）。代价：放弃 codex/claude/cursor 等 CLI 派发（已无需求）与进程崩溃隔离（子 agent 与宿主同信任域，风险可接受）。

## Considered Options

- 官方 `examples/extensions/subagent/` 仍是 spawn 模式——进程隔离、exit code、Ctrl+C 传播是它显式保留的特性；我们不采纳是因为 debug 现场完整性（tool call 序列）与 resume list 干净在本仓库优先级更高。
- 并存灰度被否：workflow-runtime / impl-with-spawn / catalog 都绑定了 `dispatch` 工具协议与 `customType: "sub-dispatch"` 通知，两套实现无法干净并存；trunk-based 下 git 历史即回退手段。

## Consequences

- 对外协议不变：`dispatch({agent, prompt, background, sessionId, kill, timeout, reason, model})`、outputSchema/structuredContent、`deliverAs: "followUp"` 完成通知；workflow-runtime 零改动。`env` 参数与 config 的 `commands`/`defaultArgs`/`maxOutputChars` 删除（无调用方）。
- 禁止递归派发：子 session 的 active tools 过滤掉 `dispatch`（与 impl-with-spawn 的 "no nested dispatch" 一致）。
- debug 现场：子 agent 输入、输出摘要、完整 messages 以 JSONL 落盘到 `~/.pi/agent/sub-dispatch-logs/<date>-<sessionId>.jsonl`；不自动 gc，`/dispatch gc [N]`（默认留 50）。dispatch 结果 `details` 同时记录 `sessionId` 与 `logFile` 绝对路径，主 session JSONL 与子现场经此关联（spawn 时代此链条是断的）。

# Code Mode：以 run_code 为唯一入口的工具呈现模式

移植 DeepSeek Harness "PTC/Code Mode" 的核心思路到 pi 扩展：用 `pi.setActiveTools(["run_code"])` 把工具目录折叠成单一 `run_code` 工具，并在 system prompt 注入一段按当前活跃工具生成的 TypeScript SDK（类型从 JSON Schema 投影）。模型写一段 TS 程序，经 `await tools.name(args)` 组合多步操作，一次执行省 token 与轮次。

## 决策

- **Toggle 而非常开**：`/code` 命令切换，状态仅存 session 内（重启/reload 回到原生模式），新会话默认关闭。
- **Worker 隔离 + 事件驱动消息桥**：每次 run_code 一个全新 `worker_threads` Worker，程序内 `tools.name()` 通过 MessagePort（`postMessage`/`on('message')`，无轮询）回宿主执行；run 结束 worker 即 terminate。TypeScript 用 Node 原生 type-strip（本机 v25.2.1）。
- **呈现 ≠ 权限**：目录折叠只是路由强制；子调用在宿主侧走真实工具 execute，并发安全复用 pi 原生 `withFileMutationQueue` 每文件队列，调度器只做有界并发上限（默认 10），不自建 exclusive barrier。
- **SDK 覆盖全部活跃工具，黑名单排除**（初始：mcpScript、UI 阻塞交互类）。
- **结果精选**：进模型上下文的只有程序显式 emit 的 logs + 最终返回值；全量子调用记录存 `details` 供 TUI 展开审计。图片子结果随 pi 原生 toolResult content 走，不进程序可见结果。返回值超限截断后的续读通道（fetchResult）见 ADR 0003。
- **范围**：v1 不做 Python 语言、细粒度预算（只留 wall-clock 超时防死循环）、专用审计事件流。定位是个人工具延伸，非生产级。

## Considered Options

- 借壳 pi 现有 `mcpScript`（presentation-only via MCP）— 被否：控制力度不足，且用户计划长期移除 MCP 扩展。
- 同进程 eval — 被否：模型代码死循环会冻结 TUI 主进程。
- 子进程 — 被否：IPC 开销与启动成本高于 worker threads，收益有限。

## 参考

上游设计：`/Users/ison/dev/sources/deepseek-harness`，notes 见 `.agents/notes/implemented/feature/2026-06-15-code-mode.md` 及其后续篇。

# Readonly Guard：跨扩展只读授权单例

问题：readonly-mode 的拦截挂在 `pi.on("tool_call")` 扩展事件上，只覆盖模型的直接工具调用；code-mode 的 run_code 子调用直连内置工具工厂的 `execute()`（不经事件总线），readonly ON + code ON 时模型可在程序内静默 edit/write/bash——只读模式存在活洞。

## 决策

- **`Symbol.for` + globalThis 单例 guard**（`readonly-mode/guard.ts`）：pi 无官方插件间通讯（`pi.events` 总线不传播 tool_call handler 返回值；`registerFlag/getFlag` 是 CLI 级启动配置、运行时不可变），且扩展 loader 每个扩展独立 `createJiti({ moduleCache: false })`，模块级单例在两个 jiti 实例间不共享——guard 把实例存 `globalThis[Symbol.for("pi.extensions.readonly-mode.guard")]`，跨模块实例拿到同一对象。
- **guard 是唯一状态源**：readonly 的 tool_call handler 与 controller 全部委托 guard（`authorize` / enable / disable），不存在状态副本；flag（`--readonly`）与会话恢复（persist/restore/reset）入口都已写入 guard。
- **单向依赖 code-mode → readonly-mode**（同 sub-dispatch 先例）：code-mode 在 `execSubCall` 的 try 顶部统一调用 `readonlyGuard.authorize(name, args)`，天然覆盖 dispatch 与 7 个工厂工具；被拦调用 throw 进 `calls` 审计并回传 worker。readonly 未启用时 authorize 恒返回 null，yolo 行为不变。
- **执行范围声明**：guard 只约束 `tools.*` 子调用。run_code 程序内直接 `require("node:fs")` 写文件、dispatch 子代理（独立会话，状态不传播）均**不受** readonly 约束——与 code-mode「可信逃生舱」yolo 语义一致。
- **演进**：pi 官方若提供 `ctx.executeTool` / 插件间通讯，可替换 guard 实现，`authorize(toolName, input)` 调用方协议不变。

## Considered Options

- 事件回放（execSubCall 包裹 `emitToolCall`/`emitToolResult`）— 被否：需捕获 runner 实例 + 原型 monkey patch，违反「只用公开 API」约束。
- `pi.events` 总线握手 — 被否：总线不传播 tool_call handler 返回值，无法承载 block 语义。
- readonly 改用 `setActiveTools` 静态移除 edit/write — 被否：bash 需 per-call 命令级白名单检查，无法静态移除。
- flag 作运行时状态载体 — 被否：`getFlag` 运行时不可变，ExtensionAPI 无 setFlag。

## 参考

- 讨论记录：`.workbuddy/memory/2026-08-26.md`（五轮结论）
- 先例：code-mode → sub-dispatch 跨扩展 import（`docs/adr/0001-code-mode-extension.md`）
- pi 0.84.3 `dist/core/extensions/loader.js`（jiti `moduleCache: false`，每扩展独立实例）

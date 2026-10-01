# 迁移到 pi 内置 MCP 与 codemode，移除自研 code-mode 扩展

日期：2026-10-01　状态：Accepted

## 背景

pi 0.99.2 起内置了两块能力，覆盖了本仓库自研扩展与第三方包的职责：

1. **内置 MCP**（`~/.pi/agent/mcp.json` / `.pi/mcp.json`，`pi mcp` CLI，`/mcp` 面板）：
   stdio + streamable HTTP、OAuth、per-server `exposure`（`codemode` / `deferred` /
   `direct` / `hidden`）与 `toolExposure` 通配、资源读取。默认 `codemode` exposure
   —— MCP 工具不进模型工具目录，经 codemode 脚本 `mcp__<server>__<tool>` 调用。
2. **内置 codemode**：QuickJS 沙箱 + `tools.*` 代理 + `searchTools()` /
   `describeNamespace()` 工具发现 + `store/load` 跨调用记忆 + `image()` /
   `models.classify`，>20KB 结果自动落盘续读。MCP server 连接时自动激活，
   或 `"defaultTools": ["+codemode"]` 常开。

此前本仓库用自研 `code-mode` 扩展（`run_code` + TS SDK 注入，ADR 0001/0003）+
`npm:pi-mcp-adapter` 包实现等价能力。

## 决策

- **移除** `pi/agent/extensions/code-mode/`（ADR 0001、0003 一并 superseded），
  删除 justfile 中的 symlink 安装行。
- **移除** settings `packages` 中的 `npm:pi-mcp-adapter`：其新版已不读
  `~/.pi/agent/mcp.json`，本机也没有 `mcp-adapter.json` / `~/.config/mcp/mcp.json`，
  实际未承载任何 server。
- **清理** `pi/mcp.json` 中 adapter 私有的 `settings` 块（`idleTimeout` /
  `warnOnLargeDirectTools` 内置实现不识别）。
- **settings 增加** `"defaultTools": ["+codemode"]`，codemode 常开。

## 自研扩展与内置 codemode 的能力对照（迁移依据）

| 自研特性 | 内置对应 | 判定 |
|---|---|---|
| `/code` toggle | 无 toggle；常开（`+codemode`）或按会话 `--tools` | 放弃 toggle：折叠本身零上下文代价，常开无负担 |
| `run_code` + 注入 SDK | `codemode` 工具 + `tools` 全局 + `searchTools()` | 等价 |
| `emit()` / `console.log` | `console.log` / `text()` | 等价 |
| `fetchResult` 截断续读（ADR 0003） | >20KB 自动截断落临时文件，脚本内拿全量 | 等价 |
| `tools.dispatch` 桥接 sub-dispatch | sub-dispatch 的 `dispatch` 是普通工具，脚本内直接 `await tools.dispatch(...)` | 等价；无 wall-clock 豁免但 QuickJS 无默认超时 |
| `require("node:fs")` | ❌ 沙箱无 fs/网络；需 filesystem 时走 `tools.bash` / `tools.read` | 有意收紧：呈现即权限边界 |
| worker 超时杀进程 | 无默认 wall-clock | 影响小 |
| MCP 工具经目录折叠进入 SDK | MCP namespace 一等公民（`describeNamespace("mcp__x")`） | 内置更强 |

## 使用方式变化

- 不再有 `/code`。codemode 始终可用；写一段 TS 脚本调用 `tools.<name>(args)`
  组合 read/bash/dispatch/MCP 工具，`console.log` 输出中间结果，`return` 返回终值。
- MCP 工具用 `await searchTools("browser")` 发现，或直接
  `await tools.mcp__chrome_devtools__take_screenshot({...})`；
  server 说明经 `describeNamespace("mcp__chrome_devtools")` 读取。
- MCP server 配置迁移用 `pi mcp add` / 直接编辑 `mcp.json`，`pi mcp list` 验证。

## Consequences

- 系统 prompt 中工具目录折叠为单一 `codemode` + section 化的 `mcp_servers` 摘要，
  缓存行为与原 section 方案（ADR 0001 的 2026-09-21 更新）一致。
- 失去 `require()`：需要 Node 能力的脚本改走 `tools.bash`。
- 相关文档已同步：AGENTS.md、`pi-navigator/catalog.md`、skills（how /
  impl-with-spawn / why）中的 `run_code` / `/code` 表述改为 `codemode`。

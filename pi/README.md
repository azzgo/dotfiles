# Pi config in dotfiles

这部分用于同步 **非敏感** 的 Pi 配置。

## 已纳入仓库

- `pi/agent/settings.json`
- `pi/agent/keybindings.json`
- `pi/agent/prompts/`
- `pi/agent/skills/`
- `pi/mcp.json`
- `pi/agent/extensions/track/`
- `pi/agent/extensions/workflow-runtime/`
- `pi/agent/patterns/`
- `pi/agent/extensions/readonly-mode/`
- `pi/agent/extensions/xfer/`
- `pi/agent/extensions/code-mode/`
- `pi/agent/extensions/sub-dispatch/`

## 保持本地，不入库

- `~/.pi/agent/models.json`
- `~/.pi/agent/auth.json`
- `~/.pi/agent/sessions/`
- `~/.pi/agent/mcp-cache.json`
- `~/.pi/agent/mcp-npx-cache.json`
- `~/.pi/exa-usage.json`
- `~/.pi/web-search.json`
- `~/.pi/pi-acp/`

## 说明

### 1. models.json 与 auth.json 保持本地

`models.json` 和 `auth.json` 都不纳入 dotfiles，也不通过 `just install-pi` 建 link。

这样可以保留每台机器原本的 key、provider 配置和登录状态。

### 2. mcp.json 做了便携化

去掉了原本机器相关的绝对路径参数，方便多端直接复用。

### 3. 扩展与 pattern 目录 link

执行 `just install-pi` 时会把仓库中的扩展目录 link 到本机 Pi 扩展目录，`pi/agent/patterns/` link 到 `~/.pi/agent/patterns/`（workflow pattern 库）。

### 4. 自研扩展：sub-dispatch 与 code-mode

`pi/agent/extensions/sub-dispatch/` — 子 agent 派发扩展（从 pi-interactive-shell 剪裁，仅保留 dispatch 模式，非 PTY 子进程）。配置在扩展目录 `config.json`（内置 pi/codex/claude/cursor，可加自定义 agent）。pi-interactive-shell 已整体移除。

`pi/agent/extensions/code-mode/` — Code Mode 扩展（工具目录折叠为 `run_code` + TS SDK 注入，`/code` 切换）。设计见 `docs/adr/0001-code-mode-extension.md`。

### 5. skills 已纳入 dotfiles

`pi/agent/skills/` 会通过 `just install-pi` link 到 `~/.pi/agent/skills/`。

当前维护的 skills：
- `code-review` / `impl-with-spawn` / `explore-codebase` / `spawn-model-selection` — pi 耦合 skills
- 通用 skills（wayfinder、grill-with-docs、prototype、improve-codebase-architecture 等）已迁至仓库根 `skills/`，经 `just install-skills` 安装到 `~/.agents/skills/`

### 6. prompt templates 已纳入 dotfiles

`pi/agent/prompts/` 会通过 `just install-pi` link 到全局 Pi prompt templates 目录：

- `~/.pi/agent/prompts/*.md`

这样仓库里的 prompts（例如 `grill-me.md`、`wayfinder.md`）可以直接作为全局 `/prompt-name` 使用。

页面元素拾取已改为 `web-picker.user.js` + `/xfer broker` 链路：Tampermonkey userscript 手动连接本地 broker daemon，标注 + prompt 以 xfer handoff 推入目标 session；安装与排障见 `pi/agent/extensions/xfer/docs/web-picker.md`。`open-chrome-pause.md` 保留（MCP 浏览器入口），随 prompts 目录一起 link。

### 8. workflow-runtime（编排骨架）+ track（工作记忆）

goal-runtime 已废弃删除（ADR 0006），替代为两个扩展：

- `workflow-runtime` — 工作流编排骨架：Definition/Run 平面文件存 `.pi/workflows/`，线性 Spine + auto/human 节点，auto 节点经 sub-dispatch 派发新会话执行（事件驱动结算、auto→auto 级联），`/wf` 命令族。只编排不判优，模型不翻转状态。pattern 库在 `pi/agent/patterns/`（首发 feature / bugfix / perf）。
- `track` — 从 goal-runtime 纯提取的工作记忆扩展：`/track`（new / update / context / status），`.pi/track/` 平面文件，与 workflow-runtime 互为陌生人。

历史决策见 `docs/adr/0001-goal-runtime-on-taskmd.md`、`docs/adr/0005-goal-runtime-command-driven-lifecycle.md`（由 ADR 0006 修正/取代）。

另外，当前共享 `settings.json` 里也已移除 `pi-subagents`、`pi-intercom` 与 `pi-interactive-shell`，外部 agent / 子 agent 能力统一由 `sub-dispatch` 扩展承载。

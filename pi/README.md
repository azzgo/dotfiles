# Pi config in dotfiles

这部分用于同步 **非敏感** 的 Pi 配置。

## 已纳入仓库

- `pi/agent/settings.json`
- `pi/agent/keybindings.json`
- `pi/agent/interactive-shell.json`
- `pi/agent/prompts/`
- `pi/agent/skills/`
- `pi/mcp.json`
- `pi/agent/extensions/goal-runtime/`
- `pi/agent/extensions/readonly-mode/`
- `pi/agent/extensions/agent-timer/`
- `pi/agent/extensions/xfer/`
- `pi/agent/extensions/code-mode/`

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

### 3. goal-runtime 扩展已迁移

`~/.pi/agent/extensions/goal-runtime/` 已纳入 dotfiles。

执行 `just install-pi` 时会把仓库中的扩展目录 link 到本机 Pi 扩展目录。

### 4. 自研扩展：sub-dispatch 与 code-mode

`pi/agent/extensions/sub-dispatch/` — 子 agent 派发扩展（从 pi-interactive-shell 剪裁，仅保留 dispatch 模式，非 PTY 子进程）。配置在扩展目录 `config.json`（内置 pi/codex/claude/cursor，可加自定义 agent）。pi-interactive-shell 已整体移除。

`pi/agent/extensions/code-mode/` — Code Mode 扩展（工具目录折叠为 `run_code` + TS SDK 注入，`/code` 切换）。设计见 `docs/adr/0001-code-mode-extension.md`。

### 5. skills 已纳入 dotfiles

`pi/agent/skills/` 会通过 `just install-pi` link 到 `~/.pi/agent/skills/`。

当前维护的 skills：
- `wayfinder` — Personal Wayfinder（本地 taskmd 决策地图）
- `grill-with-docs` — 对着领域文档 grilling 计划
- `prototype` — throwaway prototype 验证设计问题
- `code-review` / `impl-with-spawn` / `improve-codebase-architecture` — 其它本地维护 skills

### 6. prompt templates 已纳入 dotfiles

`pi/agent/prompts/` 会通过 `just install-pi` link 到全局 Pi prompt templates 目录：

- `~/.pi/agent/prompts/*.md`

这样仓库里的 prompts（例如 `grill-me.md`、`wayfinder.md`）可以直接作为全局 `/prompt-name` 使用。

`pick-chrome-element.md` 搭配 `open-chrome-pause.md` 使用（先开 Chrome，再做元素拾取），其伴随脚本 `pick-chrome-element.js` 也位于 `pi/agent/prompts/`，随目录一起 link。

### 8. goal-runtime 已内聚实现 Goals/Stories/Tasks + Track

当前业务侧只保留一个本地维护的 Pi 扩展：`goal-runtime`（前身 planning-files-runtime）。

它现在同时负责：

- Goals/Stories/Tasks 存 taskmd（`.pi/goals/`，tag 族 `goal` / `goal:story` / `goal:task`），Track 工作记忆存 `.pi/track/`（findings.md + progress.md）
- 生命周期：phase 为准，status 为派生投影；one active 互斥
- 命令族：`/goal`（set / run / list / status / review / abandon / ui）+ `/track`（new / update / status）

`planning-with-files` skill 与 `plan-mode` 已移除，不再单独管理。

另外，当前共享 `settings.json` 里也已移除 `pi-subagents`、`pi-intercom` 与 `pi-interactive-shell`，外部 agent / 子 agent 能力统一由 `sub-dispatch` 扩展承载。

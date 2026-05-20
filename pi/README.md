# Pi config in dotfiles

这部分用于同步 **非敏感** 的 Pi 配置。

## 已纳入仓库

- `pi/agent/settings.json`
- `pi/agent/keybindings.json`
- `pi/agent/interactive-shell.json`
- `pi/agent/prompts/`
- `pi/agent/skills/`
- `pi/mcp.json`
- `pi/agent/extensions/planning-files-runtime/`

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

### 3. planning-files-runtime 扩展已迁移

`~/.pi/agent/extensions/planning-files-runtime/` 已纳入 dotfiles。

执行 `just install-pi` 时会把仓库中的扩展目录 link 到本机 Pi 扩展目录。

### 4. pi-interactive-shell 默认配置已纳入 dotfiles

`~/.pi/agent/interactive-shell.json` 现在由 dotfiles 管理。

当前共享默认配置以 `pi` 为默认 agent，并保留 Cursor CLI 的 `agent` 命令映射，便于通过 `pi-interactive-shell` 统一做外部 agent / 可观察子 agent 调度。

### 5. skills 已纳入 dotfiles

`pi/agent/skills/` 会通过 `just install-pi` link 到 `~/.pi/agent/skills/`。

当前维护的 skills：
- `improve-codebase-architecture` — 代码库架构改进
- `pixso-implement-design` — Pixso 设计稿实现
- `skill-creator` — Skill 创建工具

### 6. prompt templates 已纳入 dotfiles

`pi/agent/prompts/` 会通过 `just install-pi` link 到全局 Pi prompt templates 目录：

- `~/.pi/agent/prompts/*.md`

这样仓库里的 prompts（例如 `grill-me.md`）可以直接作为全局 `/prompt-name` 使用。

### 7. planning-files-runtime 已内聚实现 planning + goal overlay

当前业务侧只保留一个本地维护的 Pi 扩展：`planning-files-runtime`。

它现在同时负责：

- baseline planning files workflow
- goal overlay 的设定与恢复
- `task_plan.md` / `findings.md` / `progress.md` 的路径重定向
- `plan-new` / `plan-goal-set` / `plan-goal-impl` 三个命令

`planning-with-files` skill 与 `plan-mode` 已移除，不再单独管理。

另外，当前共享 `settings.json` 里也已移除 `pi-subagents` 与 `pi-intercom`，统一优先走 `pi-interactive-shell` 提供的外部 agent / 子 agent 能力。

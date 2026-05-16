# Pi config in dotfiles

这部分用于同步 **非敏感** 的 Pi 配置。

## 已纳入仓库

- `pi/agent/settings.json`
- `pi/agent/keybindings.json`
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

### 4. planning-files-runtime 已内聚实现 planning + goal overlay

当前只保留一个 Pi 扩展：`planning-files-runtime`。

它现在同时负责：

- baseline planning files workflow
- goal overlay 的设定与恢复
- `task_plan.md` / `findings.md` / `progress.md` 的路径重定向
- `plan-new` / `plan-goal-set` / `plan-goal-impl` 三个命令

`planning-with-files` skill 与 `plan-mode` 已移除，不再单独管理。

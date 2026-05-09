# Pi config in dotfiles

这部分用于同步 **非敏感** 的 Pi 配置。

## 已纳入仓库

- `pi/agent/settings.json`
- `pi/agent/keybindings.json`
- `pi/mcp.json`
- `pi/agent/extensions/planning-files-runtime/`
- `pi/agent/extensions/plan-mode/`
- `pi/agent/skills/`

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

### 4. plan-mode 扩展已迁移

`~/.pi/agent/extensions/plan-mode/` 已纳入 dotfiles。

执行 `just install-pi` 时会把仓库中的扩展目录 link 到本机 Pi 扩展目录。

### 5. Pi global skills 已纳入统一管理

`~/.pi/agent/skills/` 现在整体由 dotfiles 管理，并 link 到仓库中的：

- `pi/agent/skills/`

这意味着放进这个目录的 global Pi skills 都会被统一纳入管理和自动发现，不需要在 `settings.json` 里逐个列出。

其中 `planning-with-files` 自带 templates 和 scripts；`planning-files-runtime` extension 负责通过 Pi commands 调用它们。

它现在位于：

- `~/.pi/agent/skills/planning-with-files/`

对应仓库目录：

- `pi/agent/skills/planning-with-files/`

执行 `just install-pi` 时会直接 link 整个 global Pi skills 目录：`~/.pi/agent/skills/ -> pi/agent/skills/`。

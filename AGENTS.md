# AGENTS.md

## 项目概况

这是一个个人 Dotfiles 仓库，用于统一管理常用开发环境配置，包括：

- 编辑器：Neovim、Vim、Emacs、IDEAVim
- 终端：Alacritty、Kitty、Ghostty
- Shell：bash、zsh、nushell
- 其它工具：tmux、starship、tig、Pi 相关共享配置

仓库以“可单独安装、可组合安装”为目标，安装入口主要由 `justfile` 提供。

## 当前工作方式

- 根目录下的 `README.md` 是面向用户的说明文档。
- `justfile` 是安装与维护入口，常用命令包括：
  - `just install-all`
  - `just install-neovim`
  - `just install-vim`
  - `just install-shell`
  - `just install-terminals`
  - `just install-pi`
- 大多数配置通过软链接或追加 `source` 语句接入用户目录。

## Neovim / lazy.nvim

- Neovim 配置位于 `nvim/`。
- 插件管理使用 `lazy.nvim`。
- **lazy 的安装目录在项目根目录的 `.local` 下**：
  - lazy.nvim 仓库：`<repo>/.local/lazy/lazy.nvim`
  - lazy 插件根目录：`<repo>/.local/lazy`
- 对应实现位于：`nvim/lua/plugins.lua`
- lockfile 位于：`nvim/lua/lazy-lock.json`

## 本仓库的约定

- `.local/` 是本仓库的本地运行目录，已被 `.gitignore` 忽略，不应提交。
- 涉及本地机器状态或敏感内容的文件不要放入仓库。
- 修改 Neovim 插件相关内容时，优先检查 `nvim/lua/plugins.lua` 和 `justfile`。

## 目录速览

- `nvim/`：Neovim 配置
- `vim/`：Vim 配置
- `emacs/`：Emacs 配置
- `shell/`：Shell 配置
- `alacritty/` / `kitty/` / `ghostty/`：终端配置
- `pi/`：Pi 共享配置
- `scripts/`：辅助脚本
- `prompt-library-example/`：AI Prompt 示例

## 给后续代理的提醒

1. 优先阅读 `README.md`、`justfile`、相关配置文件再改动。
2. 不要把 `.local/`、机器本地文件或秘密信息纳入版本控制。
3. 如果需要调整 Neovim 插件安装位置，请以 `nvim/lua/plugins.lua` 中的 `root = vim.g.dot_config_path .. "/.local/lazy"` 为准。

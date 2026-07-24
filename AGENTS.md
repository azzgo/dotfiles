# AGENTS.md

## 项目概况

这是一个个人 Dotfiles 仓库，用于统一管理常用开发环境配置，包括：

- 编辑器：Neovim、Vim、Emacs、IDEAVim
- 终端：Alacritty、Kitty、Ghostty
- Shell：bash、zsh、nushell
- 其它工具：tmux、starship、tig、Pi 相关共享配置

Pi 相关约定补充：
- 当前优先使用 `pi-interactive-shell` 统一承载外部 agent 调用与可观察子 agent 能力。
- 在这个仓库的默认共享配置里，实际可依赖的外部 agent 以 `pi` 和 Cursor 的 `agent` 命令为主。

仓库以“可单独安装、可组合安装”为目标，安装入口主要由 `justfile` 提供。

## 当前工作方式

- 本仓库当前按 **trunk-based** 方式维护，默认直接在 `main` 上演进；除非用户明确要求，否则不要额外创建 feature branch。
- 提交应尽量保持聚焦，避免把无关配置改动和当前任务混在一起。
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

## Skills 维护要求

Skills 定义文件位于多个搜索路径，按优先级加载：

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | `~/.pi/agent/skills/` | 手动安装/精炼的 skill（本仓库相关 skill 安装在此） |
| 2 | `~/.pi/agent/npm/node_modules/*/skills/` | npm 包自带 skill（如 pi-interactive-shell、librarian），不要直接修改 |
| 3 | `~/.agents/skills/` | 其他 agent skill（browser-bridge、pixso、skill-creator） |

本仓库维护的 skills（`grill-with-docs`、`prototype` 等）统一安装在 `~/.pi/agent/skills/` 下。
`~/.pi/agent/skills/README.txt` 仅记录本仓库维护的 skill 来源、安装日期、调整内容和上游地址，不包含其他来源的 skill。

Skills 维护规则：

1. **记录来源** — 从外部安装的 skill 必须在 `~/.pi/agent/skills/README.txt` 中记录来源 URL、commit hash 和安装日期，以便日后判断是否需要升级。
2. **检查上游再更新** — 更新外部 skill 前，先 `git log` 查看上游变更，确认值得更新再操作。
3. **混合来源 skill 保留双上游** — 从多个来源精炼的 skill（如 `code-review`）需同时记录所有上游 URL。
4. **机器本地** — `~/.pi/agent/skills/` 下的 skill 需要每台机器单独安装，不会通过本仓库自动同步。
5. **只记本仓库维护的** — README 中不要混入 npm 管理或与本仓库无关的 skill 条目。

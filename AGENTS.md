# AGENTS.md

## 项目概况

这是一个个人 Dotfiles 仓库，用于统一管理常用开发环境配置，包括：

- 编辑器：Neovim、Vim、IDEAVim
- 终端：Alacritty、Ghostty
- Shell：bash、zsh、nushell
- 其它工具：tmux、starship、Pi 相关共享配置

Pi 相关约定补充：
- 外部 agent 派发与子 agent 能力由本仓库维护的 `sub-dispatch` 扩展承载（`pi/agent/extensions/sub-dispatch/`，从 pi-interactive-shell 剪裁，仅保留 dispatch 模式）。
- Code Mode 使用 pi 内置 `codemode` 工具（`defaultTools: ["+codemode"]` 常开），MCP 工具与扩展工具经 `tools.*` 在脚本内组合调用；自研 `code-mode` 扩展已移除（见 `docs/adr/0011-built-in-mcp-codemode-migration.md`）。
- 工作流编排骨架由 `workflow-runtime` 扩展承载（`pi/agent/extensions/workflow-runtime/`，`/wf` 命令族，设计见 `docs/adr/0006-workflow-runtime-replaces-goal-runtime.md`）；pattern 库在 `pi/agent/patterns/`（经 `install-pi` link 到 `~/.pi/agent/patterns/`）。工作记忆由独立的 `track` 扩展承载（`/track` 命令族）。goal-runtime 已废弃删除（ADR 0006）。
- 命令面板（对所有 slash command 的 fuzzy picker，`alt+.` 呼出，选中后前置插入 composer，不直接执行）由 `command-palette` 扩展承载（`pi/agent/extensions/command-palette/`）。
- 夜间批量执行由 **`nightshift`** 承载（`skills/nightshift/`，repo-root skill + Node CLI，**不是 pi 扩展**；设计见 `docs/adr/0017-nightshift-is-a-script-not-an-extension.md`）：白天把已谈定的事写成 Spec 挂到单一全局板 `~/.cache/nightshift/board/`，夜里 `nightshift run` 按工作目录串行、跨目录并行地派发 `pi -p` 子进程，独立只读 Verifier 会话给出权威 `VERDICT`，结束后归档，次日 `nightshift report` 检查。pi 侧只有一个薄转发 prompt（`pi/agent/prompts/nightshift.md`）。**新增能力默认仍走扩展；只有「无人值守 / 独立进程 / 调度语义」这类需求才参照 ADR 0017 走脚本。**
- **手动派发的长任务**由 **`bg-run`** 承载（`skills/bg-run/`，repo-root skill + 纯 bash 脚本，**不是 pi 扩展**，`disable-model-invocation: true`；设计见 `docs/adr/0019-bg-run-is-a-skill-not-an-extension.md`）：把长命令或另一个 coding agent 起进 detached tmux session（有 Herdr 时起进 Herdr pane），跑完把 stdout/stderr 与**退出码**落在 `~/.cache/bg-run/<name>/`，**完成与否只看退出码，不看输出、不猜提示符**。它与 `sub-dispatch` 并列而非替代：dispatch 是进程内 session、硬超时不可续期、宿主 TUI 一退出就没了；本 skill 的运行能活过会话。它是通用 skill（`~/.agents/skills/`），任何 agent 都能用，且**模型不会自作主张调用**——由人决定何时派发。
- 在这个仓库的默认共享配置里，实际可依赖的外部 agent 以 `pi` 和 Cursor 的 `agent` 命令为主。
- **PiG（pi-in-go）作为并行的第二宿主**：`just install-pig` 装出独立的 `~/.pig` 配置根（agent dir `~/.pig/agent`，项目目录 `.pig`），**不与 `~/.pi` 共享**；共享配置（`keybindings.json`、`APPEND_SYSTEM.md`、`mcp.json`、`prompts/`）以 symlink 接入 `~/.pig/agent`，扩展装 `pi-xfer`、`pi-hashline-edit-pro`（npm）+ `sub-dispatch`、`project-skills`、`track`、`compaction`、`command-palette`（本地路径安装，改仓库即生效，`/reload` 后生效）。`project-skills` 的项目 skills 目录、`track` 的项目 track 目录取 SDK 的 `CONFIG_DIR_NAME`（pi=`.pi`，PiG=`.pig`），`sub-dispatch` 的取证日志取宿主 agent dir —— 这些扩展因此**同一份源码双宿主通用**。PiG 内置 `codemode` 工具但默认关闭，需要时在 `~/.pig/agent/settings.json` 的 `defaultTools` 里加 `"+codemode"`（安装脚本不代管）。PiG 与 pi 的差异（进程模型、少数 slash command 缺失）见 README「PiG (pi-in-go)」小节。

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
- `shell/`：Shell 配置
- `alacritty/` / `ghostty/`：终端配置
- `pi/`：Pi 共享配置
- `skills/`：通用（pi 无关）skills，不再全局安装，由 project-skills 扩展按项目链接
- `mise/`：mise 工具版本管理配置（全局 CLI 工具、node/python/uv、npm 全局包）

## 子进程非交互化（防止命令卡死）

子进程若在等 stdin/TTY（sudo 密码、git pager、vim、`npm init`、`(y/n)` 确认），agent 侧会以为命令还在跑而无限空等。这不是靠加大 timeout 能解决的，要在环境、提示词、检测三层同时防：

1. **强制非交互环境**：跑外部命令时带上 `CI=true`、`DEBIAN_FRONTEND=noninteractive`、`PAGER=cat`、`GIT_PAGER=cat`、`GIT_EDITOR=true`、`EDITOR=true`；必要时 `timeout … </dev/null`；命令尽量带 `-y`/`--yes`/`--no-pager`。
2. **禁止清单**：vim/nano 等交互编辑器、交互 sudo、HTTPS 密码式 git push、无 flag 的 `npm init`、会开 pager 的裸 `git log/diff`。git commit 用 `GIT_EDITOR=true` 或 `-m`；特权命令（sudo 等）交给人手动跑。
3. **检测「在等人」早杀**：输出出现 `password:`、`(y/n)`、`Allow?`、vim 全屏界面等模式时，立即中止该命令并报告「waiting for human / interactive prompt」，不要继续等。测试/长任务优先后台运行 + 轮询中间输出，而非阻塞式等待到超时。
## 给后续代理的提醒

1. 优先阅读 `README.md`、`justfile`、相关配置文件再改动。
2. 不要把 `.local/`、机器本地文件或秘密信息纳入版本控制。
3. 如果需要调整 Neovim 插件安装位置，请以 `nvim/lua/plugins.lua` 中的 `root = vim.g.dot_config_path .. "/.local/lazy"` 为准。

## Skills 维护要求

本仓库维护的 skills 按耦合程度分两处存放：

| 位置 | 内容 | 安装方式 |
|------|------|----------|
| `pi/agent/skills/` | 与 pi 机制耦合的 skill（sub-dispatch / dispatch 工具 / pi prompts） | 不全局链接；由 `project-skills` 扩展的 `/pi-skills` 命令按项目链接到项目 `.pi/skills/` |
| `skills/`（仓库根） | 通用、pi 无关的 skill（`grill-with-docs`、`prototype`、`intake` 等） | `just install-skills` 全局链接到 `~/.agents/skills/` |

Agent 侧的 skill 搜索路径按优先级：

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | `~/.pi/agent/skills/` | pi 耦合 skill（本仓库 `pi/agent/skills/`） |
| 2 | `~/.pi/agent/npm/node_modules/*/skills/` | npm 包自带 skill（如 pi-web-access 的 librarian），不要直接修改 |
| 3 | `~/.agents/skills/` | 通用 skill（本仓库 `skills/` 经 `just install-skills` 全局链接）及其他手动安装的 agent skill（browser-bridge、pixso、skill-creator） |

全局的 `~/.pi/agent/skills` 链接已退役：`install-pi` 会清理旧的 `~/.pi/agent/skills` 与 `~/.agents/skills` 中指向本仓库 pi 耦合 skill 的链接。pi 耦合 skill 需要的项目在项目内运行 `/pi-skills`（project-skills 扩展）按需链接到 `.pi/skills/`，项目可自行删除或覆盖个别 skill；通用 skill 则由 `just install-skills` 全局安装。

两处各有自己的 `README.txt`（`pi/agent/skills/README.txt`、`skills/README.txt`），仅记录本仓库维护的 skill 来源、安装日期、调整内容和上游地址，不包含其他来源的 skill。

Skills 维护规则：

1. **记录来源** — 从外部安装的 skill 必须在所在目录的 `README.txt` 中记录来源 URL、commit hash 和安装日期，以便日后判断是否需要升级。
2. **检查上游再更新** — 更新外部 skill 前，先 `git log` 查看上游变更，确认值得更新再操作。
3. **混合来源 skill 保留双上游** — 从多个来源精炼的 skill（如 `code-review`）需同时记录所有上游 URL。
4. **机器本地** — skill 不会通过本仓库自动同步；扩展经 `just install-pi` 装到每台机器，pi 耦合 skill 按项目经 `/pi-skills` 链接，通用 skill 经 `just install-skills` 全局链接。
5. **只记本仓库维护的** — README 中不要混入 npm 管理或与本仓库无关的 skill 条目。
6. **按耦合归位** — 新 skill 若依赖 pi 机制（dispatch 工具、`/skill:` 语法、pi prompts）放 `pi/agent/skills/`；否则放 `skills/`。迁移 skill 时在对应 `README.txt` 的 Adjustments 里记录迁移日期和去向。

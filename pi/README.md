# Pi config in dotfiles

这部分用于同步 **非敏感** 的 Pi 配置。

## 已纳入仓库

- `pi/agent/settings.json`
- `pi/agent/keybindings.json`
- `pi/agent/prompts/`
- `pi/agent/skills/`
- `pi/mcp.json`
- `pi/agent/extensions/workflow-runtime/`
- `pi/agent/patterns/`
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

### 4. 自研扩展与内置 codemode/MCP

`pi/agent/extensions/sub-dispatch/` — 子 agent 派发扩展（从 pi-interactive-shell 剪裁，仅保留 dispatch 模式，非 PTY 子进程）。配置在扩展目录 `config.json`（内置 pi/codex/claude/cursor，可加自定义 agent）。

Code Mode 与 MCP 使用 pi 内置能力：codemode 经 `settings.json` 的 `defaultTools: ["+codemode"]` 常开，MCP 配置见 `pi/mcp.json`。

### 5. skills 已纳入 dotfiles

`pi/agent/skills/` 会通过 `just install-pi` link 到 `~/.pi/agent/skills/`。

当前维护的 skills：
- `setup-code-review` / `impl-with-spawn` / `how` / `spawn-model-selection` — pi 耦合 skills
- 通用 skills（wayfinder、grill-with-docs、prototype、improve-codebase-architecture 等）位于仓库根 `skills/`，经 `just install-skills` 安装到 `~/.agents/skills/`

### 6. prompt templates 已纳入 dotfiles

`pi/agent/prompts/` 会通过 `just install-pi` link 到全局 Pi prompt templates 目录：

- `~/.pi/agent/prompts/*.md`

这样仓库里的 prompts（例如 `wayfinder.md`、`humanize.md`）可以直接作为全局 `/prompt-name` 使用。

页面元素拾取由 [azzgo/pi-xfer](https://github.com/azzgo/pi-xfer) 的 web-picker 承担：Tampermonkey userscript 手动连接本地 broker daemon，标注 + prompt 以 xfer handoff 推入目标 session；安装与排障见 pi-xfer 仓库的 `docs/web-picker.md`。`open-chrome-pause.md` 保留（MCP 浏览器入口），随 prompts 目录一起 link。

### 8. workflow-runtime（编排骨架）

工作流编排由 `workflow-runtime` 承载：

- `workflow-runtime` — 工作流编排骨架：Definition/Run 平面文件存 `.pi/workflows/`，线性 Spine + auto/human 节点，auto 节点经 sub-dispatch 派发新会话执行（事件驱动结算、auto→auto 级联），`/wf` 命令族。只编排不判优，模型不翻转状态。pattern 库在 `pi/agent/patterns/`（根目录可被 `/wf start` 直接实例化；`examples/` 下是 feature / bugfix / perf 参考样板，不参与实例化——workflow 主张按项目 setup，不维护全局通用样板）。

设计与变更决策见 `docs/adr/0006-workflow-runtime-replaces-goal-runtime.md`。


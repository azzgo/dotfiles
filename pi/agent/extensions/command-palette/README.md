# command-palette

pi 的命令面板扩展：对所有可用 slash command 做快速 fuzzy 选择，选中后插入 composer（不直接执行）。

## 行为

- 绑定快捷键 `alt+.`（自身不注册任何 `/command`）。
- 条目来源：
  - `pi.getCommands()` — extension commands、prompt templates、skill commands（skill 的 name 自带 `skill:` 前缀）。
  - 内置交互命令（`/model`、`/compact` 等）— pi 未通过公开 API 暴露，这里维护一份与 `dist/core/slash-commands.js` 同步的镜像（升级 pi 时留意刷新）。
- 插入规则（只插入，不执行）：
  - composer 为空：插入 `/cmd `
  - composer 有文本：插到最前面 + 空格，即 `/cmd ` + 原文本
- UI：`Input`（过滤输入）+ `SelectList`（结果列表）+ `fuzzyFilter`（对 label + description 模糊匹配排序）。

## 按键

| 键 | 行为 |
|----|------|
| `alt+.` | 呼出面板（`index.ts` 顶部 `SHORTCUT` 常量可改） |
| 任意输入 | fuzzy 过滤 |
| `↑` / `↓`（或 `ctrl+p` / `ctrl+n`） | 移动选择 |
| `pageUp` / `pageDown` | 翻页 |
| `enter` / `tab` | 确认，插入 composer |
| `esc` / `ctrl+c` | 取消 |

## 文件

- `index.ts` — 入口：`registerShortcut`，收集命令条目，插入 composer
- `palette.ts` — `CommandPalette` 组件（TUI）
- 升级 pi 时：对照 pi 包内 `dist/core/slash-commands.js` 的 `BUILTIN_SLASH_COMMANDS` 刷新 `index.ts` 中的 `BUILTIN_COMMANDS`。

## 安装

`just install-pi` 会把本目录软链到 `~/.pi/agent/extensions/command-palette`。

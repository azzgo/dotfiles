# 提案：Neovim AI Prompt Picker

## 概览

本变更希望在 Neovim 中，基于 `snacks.nvim` 提供一个专用的「AI Prompt Picker」。

该 Picker 从本 dotfiles 仓库中的一个固定目录（`ai/prompts/`）中读取一组以 Markdown (`.md`) 文件形式存在的 AI Prompt 模板，并提供以下能力：

- 列出所有可用的 Prompt 文件；
- 在 Picker 中预览 Prompt 内容；
- 打开 Prompt 文件进行编辑（当前窗口 / 分屏 / 新标签页）；
- 复制 Prompt 正文到剪贴板；
- 将 Prompt 正文插入当前 Buffer 光标位置。

本提案**仅面向 Neovim**，不涉及 Emacs / Vim 等其它编辑器的实现。

## 背景与动机

- 当前 Emacs 侧已有「从目录读取 Prompt 文件并加载为指令」的模式（如 `org-directory/prompts`）。
- Neovim 侧已经集成了：
  - `snacks.nvim`，并在 `harpoon.lua`、`term.lua` 中有成熟的自定义 Picker 用法；
  - `codecompanion.lua` 等 AI 相关配置；
  - `users.lib.utils` 中提供的剪贴板与文件工具函数。

但 Neovim 目前缺少一个统一的、基于文件的 AI Prompt 中心，日常使用时，需要手写 Prompt 或从其它地方复制，不够顺手，也难以在 dotfiles 中系统管理。

本提案的目标是：

- 将 AI Prompt 标准化为 dotfiles 仓库内的 Markdown 文件；
- 在 Neovim 中提供一个统一入口，快速浏览、预览、编辑和使用这些 Prompt；
- 为后续和 CodeCompanion 等 AI 工具的整合提供一个稳定的 Prompt 来源。

## 设计范围（Scope）

在本变更中，**纳入范围** 的内容包括：

- Neovim 侧新增一个独立 Lua 模块（如 `nvim/lua/users/ai_prompts.lua`）：
  - 固定使用本仓库内的 `ai/prompts/` 目录作为 Prompt 根目录（路径如何解析在实现阶段细化）；
  - 递归扫描该目录下所有 `.md` 文件；
  - 支持可选的 YAML front-matter（`---` 起止的头部），用于元信息；
  - 构造 `Snacks.picker` 所需的 item 列表。

- 基于 Snacks.nvim 的 AI Prompt Picker：
  - 列表项展示文件名或 front-matter 中的标题；
  - 支持在 Picker 中预览 Prompt 正文（去除 front-matter 部分）；
  - 提供动作（actions）：
    - 打开文件进行编辑（当前窗口 / 分屏 / 新标签页）；
    - 复制 Prompt 正文到剪贴板；
    - 将 Prompt 正文插入当前 Buffer 光标位置。

- Neovim 内的入口：
  - 至少提供一个用户命令（例如 `:AIPromptPicker`，名称在实现阶段定）；
  - 是否绑定快捷键由用户自行决定，本提案**不强制预设键位**；
  - 命令需要有清晰的描述，方便通过 `:help` 或插件文档发现。

- Front-matter 约定：
  - 使用 YAML 形式，位于文件开头，以 `---` 起止；
  - 至少支持以下字段（可选）：
    - `title`: Prompt 的人类可读标题；
    - `description`: 简短描述；
    - `tags`: 标签列表；
  - Picker 在展示列表时：
    - 若存在 `title` 字段，应优先使用 `title` 作为展示文本；
    - 否则退回文件名；
  - 在复制 / 插入时：
    - **只使用正文内容，不包含 front-matter**。

**不在本次变更范围内** 的内容：

- Prompt 文本内容本身的写作规范与语义；
- 与具体 AI 服务（如 OpenAI/OpenRouter/本地 LLM）的直接联动；
- 更通用的 search-mode / analyze-mode 工作流（可在其它变更中定义）。

## 成功标准

若同时满足以下条件，则认为本提案的实现是成功的：

1. dotfiles 仓库中存在 `ai/prompts/` 目录，且其中的 `.md` 文件被 Neovim AI Prompt Picker 正确识别、列出与预览。
2. 当某个 Prompt 文件包含 YAML front-matter 时：
   - 列表中优先显示 front-matter 中的 `title`；
   - 预览区域中显示的正文不包含 front-matter；
   - 复制 / 插入操作仅针对正文。
3. 当调用 AI Prompt Picker 的命令时：
   - 若 Snacks 可用且目录中存在 `.md` 文件，则正常打开 Picker 界面；
   - 若目录不存在或为空，则给出清晰的非致命提示；
   - 若 Snacks 插件未加载或不可用，同样给出明确的错误提示，而不会导致 Neovim 崩溃。
4. 用户可以通过 Neovim 内部的可发现方式（命令说明、帮助或简短文档）了解：
   - AI Prompt 存放目录为 `ai/prompts/`；
   - Prompt 文件必须是 `.md`；
   - 如何编写包含 front-matter 的 Prompt 文件；
   - 如何打开 AI Prompt Picker。

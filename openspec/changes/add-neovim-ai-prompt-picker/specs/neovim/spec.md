## ADDED Requirements

### Requirement: Neovim AI Prompt 目录

Neovim MUST 支持从可配置的目录加载 AI Prompt 模板。

- Prompt 根目录默认为本仓库内的 `prompt-library-example/`。
- 必须支持通过环境变量 `AI_PROMPTS_DIR` 覆盖默认目录。
- 环境变量路径必须支持 `~` 展开到用户主目录。
- 推荐用户设置自定义目录而非使用默认示例目录。
- 实现必须递归扫描该目录下的所有子目录。
- 只允许 `.md` 扩展名的文件被视为 Prompt 文件，其它扩展名必须被忽略。
- 当目录不存在或没有任何 `.md` 文件时：
  - 打开 Prompt Picker 时必须给出清晰的、非致命的提示；
  - Neovim 不得因该情况崩溃。

#### Scenario: 混合文件类型的 Prompt 目录

- 给定 `prompt-library-example/` 目录中包含：
  - `prompt-library-example/code-review.md`
  - `prompt-library-example/tdd/testcase.md`
  - `prompt-library-example/notes.txt`
  - `prompt-library-example/tmp/data.json`
- 当用户在 Neovim 中打开 AI Prompt Picker 时，
- 则列表中必须只包含：
  - `code-review.md`
  - `testcase.md`
- 并且不得列出 `notes.txt` 或 `data.json`。

#### Scenario: 使用环境变量自定义目录

- 给定用户设置了环境变量 `AI_PROMPTS_DIR="~/my-prompts"`，
- 当 Neovim 启动并打开 AI Prompt Picker 时，
- 则必须从 `$HOME/my-prompts/` 目录扫描 Prompt 文件，
- 而不是从默认的 `prompt-library-example/` 目录。

---

### Requirement: AI Prompt 文件的 Front-matter 支持

Neovim MUST 支持可选的 YAML front-matter，用于为 Prompt 文件提供元信息。

- Prompt 文件可以在文件开头以如下格式包含一段 front-matter：

  ```yaml
  ---
  title: 代码评审提示词
  description: 用于生成详细的代码评审意见
  tags:
    - review
    - code
  ---
  这里开始是正文内容……
  ```

- front-matter 必须符合以下规则：
  - 以文件的第一行 `---` 开始；
  - 以后续某一行单独的 `---` 结束；
  - 结束标记之后的内容全部视为 Prompt 正文。
- 至少支持以下字段（均为可选）：
  - `title`：用于在 Picker 中展示的人类可读标题；
  - `description`：对 Prompt 用途的简要说明；
  - `tags`：字符串数组，用于后续筛选或展示（本次变更可以只解析保存，不要求实现筛选）。

- 当存在 front-matter 时：
  - Picker 在构造列表项时，必须优先使用 `title` 字段作为展示文本；
  - 若未提供 `title` 字段，则退回使用文件名。
- 在以下操作中，front-matter 部分必须被排除：
  - 预览区域中显示的 Prompt 正文；
  - 复制到剪贴板的内容；
  - 插入到当前 Buffer 的内容。

#### Scenario: 带 front-matter 的 Prompt 文件

- 给定 `ai/prompts/review.md` 文件中包含上述示例格式的 front-matter 与正文，
- 当用户在 Neovim 中打开 AI Prompt Picker 时，
- 列表中对应项的展示文本必须为 `代码评审提示词`（来自 `title` 字段），
- 当用户预览该项或执行复制 / 插入操作时，
- 显示与操作的内容中不得包含 `---` 包裹的 front-matter 部分。

---

### Requirement: Neovim AI Prompt Picker 列表与预览

Neovim MUST provide an AI Prompt Picker based on `Snacks.picker` to list and preview prompt files.

- Picker 的实现必须基于 `Snacks.picker`。
- 每一个列表项至少必须包含：
  - 一个用于展示的文本（优先来源于 front-matter 的 `title`，否则为文件名）；
  - Prompt 文件的绝对路径，用于预览和打开编辑。
- Picker 必须支持在 Neovim 内预览 Prompt 正文内容（不包含 front-matter）。
- Picker 在每次打开时必须从磁盘重新扫描配置的 Prompt 目录，
  以反映新建或删除的 Prompt 文件，而不要求用户重启 Neovim。

#### Scenario: 打开 Picker 并预览 Prompt

- 给定配置的 Prompt 目录中至少包含一个合法的 `.md` Prompt 文件，
- 当用户通过命令打开 AI Prompt Picker，
- 并在列表中移动光标到某个 Prompt 项时，
- Picker 必须在预览区域中展示该 Prompt 的正文内容。

---

### Requirement: AI Prompt Picker 的动作（Actions）

AI Prompt Picker MUST 提供打开、复制和插入 Prompt 正文内容的动作。

- Picker 必须至少支持以下动作：
  - `edit`：在当前窗口打开对应 Prompt 文件；
  - `vsplit` / `split`：在垂直或水平分屏中打开 Prompt 文件；
  - `tab`：在新标签页中打开 Prompt 文件；
  - `yank`：将 Prompt 正文复制到剪贴板；
  - `insert`：将 Prompt 正文插入到当前 Buffer 的光标位置。
- `yank` 动作必须复用现有的剪贴板工具函数
  （例如 `users.lib.utils.copy_to_clipboard`），以保证：
  - 系统剪贴板（`+` 寄存器）中能获得 Prompt 正文；
  - 与现有配置对 `*` 和默认寄存器的行为保持一致。
- `insert` 动作必须：
  - 只在当前 Buffer 光标位置插入正文内容；
  - 不得无条件覆盖 Buffer 中其它区域的内容。

#### Scenario: 复制 Prompt 正文到剪贴板

- 给定 Neovim 正在运行，且 AI Prompt Picker 已打开，
- 当当前选中项为一个合法 Prompt 文件，
- 且用户触发 `yank` 动作时，
- 则该 Prompt 的正文内容必须被复制到系统剪贴板，
- 并且应显示一条明确的通知，说明复制已完成。

#### Scenario: 将 Prompt 正文插入当前 Buffer

- 给定 Neovim 正在运行，
- 且当前有一个普通文件 Buffer 处于激活状态，
- 光标停留在一个可插入位置，
- 当用户在 AI Prompt Picker 中选择某个 Prompt 项并触发 `insert` 动作时，
- Picker 必须关闭，
- 并且 Prompt 正文内容必须被插入到当前光标位置。

---

### Requirement: AI Prompt Picker 的入口与可发现性

Neovim MUST provide a discoverable entry point for the AI Prompt Picker.

- 必须至少提供一个用户命令（例如 `:AIPromptPicker`，具体名称在实现阶段确定）。
- 本变更不强制预设快捷键，但实现可以选择提供默认键位作为增强能力。
- 该命令需要有简短且清晰的描述，符合现有 Neovim 配置的命名风格。
- 当 Snacks 不可用时：
  - 该命令必须以清晰的错误消息优雅失败；
  - Neovim 不得因此崩溃。

#### Scenario: 通过命令打开 AI Prompt Picker

- 给定 Snacks 插件已经正确安装并加载，
- 当用户在 Neovim 中执行配置好的 AI Prompt Picker 命令时，
- 必须打开该 Picker 界面，
- 并展示来自配置的 Prompt 目录的 Prompt 列表。

#### Scenario: Snacks 不可用时的行为

- 给定 Snacks 插件未安装或未能正确加载，
- 当用户尝试执行 AI Prompt Picker 命令时，
- Neovim 必须给出一条清晰的错误提示，说明 Snacks / Picker 不可用，
- 并且 Neovim 不得异常退出。

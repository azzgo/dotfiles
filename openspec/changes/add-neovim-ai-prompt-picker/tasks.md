# Tasks: add-neovim-ai-prompt-picker

- [x] 1. 分析现有 Neovim Picker 与 AI 配置
  - [x] 阅读 `nvim/lua/users/snacks.lua`、`nvim/lua/users/harpoon.lua`、`nvim/lua/users/term.lua`，总结 Snacks 自定义 Picker 的通用模式。
  - [x] 阅读 `nvim/lua/users/codecompanion.lua`，了解现有 AI 流程中如何消费文本。
  - [x] 参考 `emacs/lisp/init-ai.el` 中基于目录加载 Prompt 的模式，以便对齐思路。

- [x] 2. 确定并文档化 Prompt 目录策略
  - [x] 约定并在文档中明确：Neovim 侧的 AI Prompt 根目录为本仓库内的 `ai/prompts/`。
  - [x] 仅支持 `.md` 文件作为 Prompt 文件类型。
  - [x] 说明该目录将由 git 管理，可跨机器同步。

- [x] 3. 设计 AI Prompt Lua 模块接口
  - [x] 新增一个模块（如 `users.ai_prompts`），对外暴露类似 `open_picker()` 的函数。
  - [x] 在设计中明确：
    - [x] 如何递归扫描 `ai/prompts/` 目录并收集 `.md` 文件；
    - [x] 如何解析可选的 YAML front-matter（`---` 包裹）；
    - [x] 如何构造 Snacks Picker 所需的 item 结构（包含展示文本与文件路径）；
    - [x] 如何将 front-matter 与正文区分开来，以供后续动作使用。

- [x] 4. 基于 Snacks 实现 AI Prompt Picker
  - [x] 使用 `Snacks.picker` 按 spec 要求实现：
    - [x] 列表展示（优先使用 front-matter 的 `title`）；
    - [x] 正文预览（不包含 front-matter）；
    - [x] Actions：`edit` / `vsplit` / `split` / `tab` / `yank` / `insert`。
  - [x] 在 `yank` 中复用 `users.lib.utils.copy_to_clipboard`。
  - [x] 确保每次打开 Picker 时都会重新扫描目录，而不是复用陈旧缓存。

- [x] 5. 添加 Neovim 命令入口与简单文档
  - [x] 添加至少一个用户命令，用于打开 AI Prompt Picker。
  - [x] 在合适的位置为该命令添加描述（例如在 Lua 模块注释或内部文档中），说明：
    - [x] Prompt 目录位置 `ai/prompts/`；
    - [x] Prompt 文件必须是 `.md`；
    - [x] 如何书写可选的 front-matter。
  - [x] 可选：在已有的 Quick Actions 菜单（如 `users/self.lua`）中增加一项，但不作为本提案的强制要求。

- [x] 6. 验证行为与边界情况
  - [x] 手工验证以下场景：
    - [x] 目录存在且有多个 `.md` 文件；
    - [x] 某些文件包含 front-matter，某些不包含；
    - [x] 复制与插入时，front-matter 不会混入正文；
    - [x] 打开编辑 / 分屏 / 新标签页行为符合预期。
  - [x] 验证异常/边界情况：
    - [x] `ai/prompts/` 目录不存在时；
    - [x] 目录存在但没有任何 `.md` 文件时；
    - [x] Snacks 插件未加载或 require 失败时。
  - [x] 如发现 UX 细节问题（提示信息不清晰等），在实现中进行适当调整并更新注释。

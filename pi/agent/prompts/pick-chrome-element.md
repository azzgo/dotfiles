---
name: pick-chrome-element
description: 在已连接的 chrome-devtools MCP 页面中注入/复用元素拾取悬浮按钮，读取用户选中的元素与备注，作为当前轮次的核心上下文。配合 open-chrome-pause 使用（本 prompt 不负责打开 Chrome）。
argument-hint: "[可选：要执行的需求命令]"
---

在已连接的 chrome-devtools MCP 浏览器中管理「元素拾取」。本 prompt **不负责打开 Chrome**——预检失败直接终止。

## 流程

### 1. Preflight 预检
调用 `chrome_devtools_list_pages`：
- 调用失败（MCP 不可用）或没有任何常规页面 → **立即终止**，告诉用户："没有连接可用的 Chrome 实例，请先运行 `/open-chrome-pause`"，不执行后续任何步骤。

### 2. 确认目标页面
- 若已有选中的页面（`list_pages` 结果标注 selected），直接使用；
- 否则用 `chrome_devtools_select_page` 选择与用户上下文匹配的页面（如用户提到的 URL）；若有多个候选且无法判断，询问用户要操作哪个 tab。

### 3. 检查注入状态
用 `chrome_devtools_evaluate_script` 执行检查函数（无参数）：
```
() => !!window.__PI_PICKER__
```
- 返回 `false`（fab 未注入）→ **无论用户是否给了命令，一律忽略命令、不读取任何数据**，执行第 4 步注入后终止。
- 返回 `true` → 跳到第 5 步。

### 4. 注入悬浮按钮
用 bash 读取注入脚本的完整内容：
```
cat ~/.pi/agent/prompts/pick-chrome-element.js
```
把文件内容**原样**（不加包裹、不改动）作为 `function` 参数传给 `chrome_devtools_evaluate_script` 执行。注入成功后告诉用户：
"已注入准星悬浮按钮（右下角，可拖动），点击即进入拾取模式：hover 高亮、`[`/`]` 切层、Enter 选中、可写备注、Esc 退出。"
**立即终止**，等待用户操作。

### 5. 读取批次
用 `chrome_devtools_evaluate_script` 执行：
```
() => { try { const s = sessionStorage.getItem('pi.picks'); return s ? JSON.parse(s) : []; } catch (e) { return []; } }
```
- 返回空数组 → **忽略命令**，终止并提示："页面上还没有选中的元素，请先点击准星悬浮按钮选择元素（可加备注）。"
- 返回非空数组 → 进入第 6 步。

### 6. 消费批次
把返回的 picks 作为**当前轮次的核心上下文**，逐条汇报（序号、selector、文本预览、备注、源码位置），然后立即用以下函数清空存储（fab 角标会自动刷新）：
```
() => { sessionStorage.removeItem('pi.picks'); if (window.__PI_PICKS_API__) window.__PI_PICKS_API__.refresh(); return true; }
```

清空后按命令分支：
- **有命令**（`$@` 非空）：结合 picks + 备注 + 命令综合判断意图，执行 `$@`。
- **无命令**：仅凭 picks + 备注推断用户意图，向用户陈述"我理解你想关注/修改的是……"，等待用户确认或补充。

最后 pause，等待用户下一条指令。

## 汇报格式建议

每条 pick 至少包含：
- `selector` — CSS 选择器（定位元素用）
- `textPreview` — 元素文本预览
- `note` — 用户备注（若有）
- `source` — 源码位置（若有：框架 / 组件名 / 文件:行:列），这是用户希望 agent 关注的源码线索

## 注意

- **每次调用都必须做第 3 步注入状态检查**——页面导航 / HMR 会清掉注入的脚本，需要重新注入。
- 本 prompt 只做「注入」与「读取」两个动作：不要自己打开新 tab、不要导航、不要修改页面内容。
- `source` 仅在 dev 构建存在（React `_debugSource` / Vue `__file`），生产构建为 null，不要编造。

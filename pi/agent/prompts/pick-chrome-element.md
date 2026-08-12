---
name: pick-chrome-element
description: 在已连接的 chrome-devtools MCP 浏览器中**先确认用户当前激活的页面**（`[selected]` ≠ 前台 tab），再注入/复用元素拾取悬浮按钮，读取用户选中的元素与备注，作为当前轮次的核心上下文。配合 open-chrome-pause 使用（本 prompt 不负责打开 Chrome）。
argument-hint: "[可选：要执行的需求命令]"
---

在已连接的 chrome-devtools MCP 浏览器中管理「元素拾取」。本 prompt **不负责打开 Chrome**——预检失败直接终止。

## 流程

### 1. Preflight 预检
调用 `chrome_devtools_list_pages`：
- 调用失败（MCP 不可用）或没有任何常规页面 → **立即终止**，告诉用户："没有连接可用的 Chrome 实例，请先运行 `/open-chrome-pause`"，不执行后续任何步骤。

### 2. 确认当前激活页面（前提：最先确认，不可跳过）
复用第 1 步的 `chrome_devtools_list_pages` 结果（必要时重新调用）。⚠️ `[selected]` 只表示 MCP 当前 attach 的上下文页面，**不代表用户当前正在看的 tab**——用户可能已经切换了 tab，在旧页面上检查注入 / 宣告成功都是错的。

1. 用 `chrome_devtools_evaluate_script` 验证当前选中页面的前台状态：
```
() => ({ href: location.href, title: document.title, visible: document.visibilityState === 'visible' })
```
2. `visible: false`（visibilityState 为 hidden）→ 该页面是后台 tab，用户已切走。从 `list_pages` 找出与用户上下文匹配的页面（URL / 标题），用 `chrome_devtools_select_page(pageId, bringToFront: true)` 切过去再验证；若无法判断用户切到了哪个 tab → **停下来询问用户**，不要在旧页面上继续。
3. 存在多个候选页面且无法判断 → 询问用户当前在哪个 tab。
4. 确认「当前选中页面 = 用户激活页面」后，才进入第 3 步。

### 3. 检查注入状态
**前置：再次确认页面身份**——evaluate `() => location.href`，与用户上下文 / 第 2 步确认的页面一致才继续；不一致（用户又切换了 tab）→ 回到第 2 步重新确认，**不得在旧页面上宣告注入成功**。
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
"已注入准星悬浮按钮（右下角，可拖动），点击即进入拾取模式；或直接按 `⇧⌥P` 进入（零点击，已打开的下拉/浮层不会被 click-outside 关闭）。拾取默认**冻结**页面交互（浮层不会 dismiss）：hover 高亮、`[`/`]` 切层、Enter 选中、可写备注、`F` 冻结⇄实时、Esc 退出。"
**立即终止**，等待用户操作。

### 5. 读取批次
**前置：确认当前页面仍是用户激活的页面**（同第 2 步标准）。picks 存在 sessionStorage，是 **tab 级数据**——切换过 tab 后旧页面的批次读不到，必须先回到正确的页面上再读取。
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

## 程序化拾取 API（可选）

注入后可用 `evaluate_script` 调用 `window.__PI_PICK_API__`（无需用户手动点选）：

- `start()` / `stop()` / `toggle()` — 进入/退出拾取模式（热键 `⇧⌥P` 的等价物，不产生点击）
- `freeze(on?)` — 查询或设置冻结状态（默认冻结；`false` 切实时以便 hover 展开子菜单）
- `pickAt(x, y)` — 按视口坐标直接选中并写入批次，返回记录（适合 agent 全自动拾取）
- `pick(selectorOrEl)` — 按 CSS 选择器 / DOM 元素选中，返回记录
- `snapshot()` — 读取当前批次；`refresh()` — 刷新 fab 角标

当用户明确指了一个元素/位置、或需要自动化流程时，优先用 `pickAt` / `pick` 直接完成，不必等用户手动操作。

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
- **先确认当前激活页面，再检查注入 / 读取**：`list_pages` 的 `[selected]` 不等于用户前台 tab。用户切换 tab 后，旧页面上即使 `window.__PI_PICKER__` 为 true 也只是残留注入，**不得宣告注入成功**。用 `document.visibilityState` 验证（visible = 前台 / hidden = 后台），必要时 `select_page(bringToFront: true)` 切回，或直接询问用户当前在哪个 tab。
- 进入拾取优先用 `⇧⌥P`（不产生点击，不会触发页面 click-outside 逻辑关闭已打开的浮层）；拾取中默认「冻结」页面交互，`F` 可切「实时」（hover 触发子菜单等）。DevTools 面板聚焦时页面收不到热键，改用 API 的 `start()`。
- 原生 popover / `<dialog showModal>` 等 top-layer 浮层可正常选中（事件在 window capture 层拦截，不再依赖 host 覆盖层；覆盖层始终 `pointer-events: none`）。

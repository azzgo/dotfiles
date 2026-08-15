---
name: pick-chrome-element
description: In the connected chrome-devtools MCP browser, first confirm the user's currently active page (`[selected]` ≠ foreground tab), then inject/reuse the element-picker floating button, read the user's picked elements and notes as the core context for the current turn. Pairs with open-chrome-pause (this prompt does NOT open Chrome).
argument-hint: "[optional: the command to execute]"
---

Manage **element picking** in the connected chrome-devtools MCP browser. This prompt does **NOT** open Chrome — abort immediately if the preflight fails.

> Note: quoted user-facing strings below are templates — deliver them in the user's input language (see APPEND_SYSTEM.md language rule).

## Flow

### 1. Preflight check

Call `chrome_devtools_list_pages`:
- Call fails (MCP unavailable) or no regular pages → **abort immediately**, tell the user: "没有连接可用的 Chrome 实例，请先运行 `/open-chrome-pause`" — do not run any further steps.

### 2. Confirm the currently active page (prerequisite: check first, never skip)

Reuse step 1's `chrome_devtools_list_pages` result (re-call if necessary). ⚠️ `[selected]` only means the page MCP is currently attached to — it does **not** mean the user is looking at that tab. The user may have switched tabs; checking injection / declaring success on a stale page is wrong.

1. Verify the foreground state of the currently selected page with `chrome_devtools_evaluate_script`:
```
() => ({ href: location.href, title: document.title, visible: document.visibilityState === 'visible' })
```
2. `visible: false` (visibilityState hidden) → the page is a background tab; the user switched away. Find the page matching the user's context (URL / title) from `list_pages`, switch with `chrome_devtools_select_page(pageId, bringToFront: true)` and re-verify; if you can't tell which tab the user moved to → **stop and ask the user**, do not continue on the stale page.
3. Multiple candidate pages and no way to tell → ask the user which tab they're on.
4. Only proceed to step 3 after confirming "selected page = user's active page".

### 3. Check injection status

**Prerequisite: re-confirm page identity** — evaluate `() => location.href`; continue only if it matches the user's context / the page confirmed in step 2; if not (user switched tabs again) → back to step 2, **never declare injection success on a stale page**.

Run the check function (no args) with `chrome_devtools_evaluate_script`:
```
() => !!window.__PI_PICKER__
```
- Returns `false` (fab not injected) → **ignore the command and read no data, regardless of whether the user gave a command**; run the step 4 injection, then terminate.
- Returns `true` → go to step 5.

### 4. Inject the floating button

Read the full injection script with bash:
```
cat ~/.pi/agent/prompts/pick-chrome-element.js
```
Pass the file content **verbatim** (no wrapping, no modification) as the `function` argument to `chrome_devtools_evaluate_script`. After a successful injection tell the user:
"已注入准星悬浮按钮（右下角，可拖动），点击即进入拾取模式；或直接按 `⇧⌥P` 进入（零点击，已打开的下拉/浮层不会被 click-outside 关闭）。拾取默认**冻结**页面交互（浮层不会 dismiss）：hover 高亮、`[`/`]` 切层、Enter 选中、可写备注、`F` 冻结⇄实时、Esc 退出。"
**Terminate immediately** and wait for the user to act.

### 5. Read the batch

**Prerequisite: confirm the current page is still the user's active page** (same standard as step 2). Picks live in sessionStorage — they are **tab-level data**; after a tab switch the old page's batch is unreadable, so you must return to the correct page before reading.

Run with `chrome_devtools_evaluate_script`:
```
() => { try { const s = sessionStorage.getItem('pi.picks'); return s ? JSON.parse(s) : []; } catch (e) { return []; } }
```
- Empty array → **ignore the command**, terminate and prompt: "页面上还没有选中的元素，请先点击准星悬浮按钮选择元素（可加备注）。"
- Non-empty array → proceed to step 6.

### 6. Consume the batch

Treat the returned picks as the **core context for the current turn**; report each one (index, selector, text preview, note, source location), then immediately clear storage with:
```
() => { sessionStorage.removeItem('pi.picks'); if (window.__PI_PICKS_API__) window.__PI_PICKS_API__.refresh(); return true; }
```
(the fab badge refreshes automatically)

After clearing, branch on the command:
- **Has command** (`$@` non-empty): combine picks + notes + command to infer intent, then execute `$@`.
- **No command**: infer intent from picks + notes alone and state to the user "我理解你想关注/修改的是……", wait for confirmation or additions.

Finally pause and wait for the user's next instruction.

## Programmatic pick API (optional)

After injection you can call `window.__PI_PICK_API__` via `evaluate_script` (no manual clicking needed):

- `start()` / `stop()` / `toggle()` — enter/exit pick mode (equivalent of hotkey `⇧⌥P`, produces no clicks)
- `freeze(on?)` — query or set freeze state (frozen by default; `false` = live so hover expands submenus)
- `pickAt(x, y)` — pick directly at viewport coordinates and write to the batch, returns the record (for fully agent-driven picking)
- `pick(selectorOrEl)` — pick by CSS selector / DOM element, returns the record
- `snapshot()` — read the current batch; `refresh()` — refresh the fab badge

When the user explicitly points at an element/position, or an automated flow is needed, prefer `pickAt` / `pick` to finish directly rather than waiting for manual interaction.

## Report format suggestion

Each pick should include at least:
- `selector` — CSS selector (to locate the element)
- `textPreview` — element text preview
- `note` — user note (if any)
- `source` — source location (if any: framework / component name / file:line:col), the source clue the user wants the agent to focus on

## Notes

- **Every call must do the step 3 injection check** — navigation / HMR clears injected scripts; re-inject as needed.
- This prompt only does "inject" and "read": do not open new tabs, navigate, or modify page content yourself.
- `source` only exists in dev builds (React `_debugSource` / Vue `__file`); it's null in production builds — don't fabricate it.
- **Confirm the active page first, then check injection / read**: `list_pages` `[selected]` ≠ user's foreground tab. After the user switches tabs, `window.__PI_PICKER__` on the old page is just leftover injection — **never declare injection success there**. Verify with `document.visibilityState` (visible = foreground / hidden = background); use `select_page(bringToFront: true)` to switch back if needed, or ask the user which tab they're on.
- Prefer `⇧⌥P` to enter picking (no clicks, won't trigger page click-outside logic that closes already-open overlays); picking is **frozen** by default (overlays won't dismiss), `F` toggles **live** (hover opens submenus, etc.). When DevTools panel has focus the page can't receive hotkeys — use the API's `start()` instead.
- Native popover / `<dialog showModal>` top-layer overlays can be picked normally (events are intercepted at the window capture layer, no host overlay needed; the overlay is always `pointer-events: none`).

---
name: chrome-picker
description: CLI-driven Chrome debugging — manages a dedicated headed Chrome via the experimental chrome-devtools CLI daemon (Unix socket, persistent profile, separate from the MCP browser). Three cases — open the browser, inject the element-picker floating button into the user's active tab, read picked elements and run a command on them. Script payloads travel through shell "$(cat …)", never through model-generated tool args. Use when the user wants to pick/inspect page elements or wants a debug Chrome managed outside the chrome-devtools MCP.
---

# Chrome Picker — chrome-devtools CLI session

This skill owns a **separate headed Chrome** driven through the `chrome-devtools` CLI — the experimental daemon shipped inside `chrome-devtools-mcp` (background process over a Unix socket, i.e. an interactive CLI over CDP).

It is **independent of the chrome-devtools MCP browser** (different user-data-dir; both can run side by side). Keep MCP flows (`/open-chrome-pause` …) untouched.

Core principle: **script payloads travel through the shell** — `"$(cat picker.js)"` — so the picker source never has to be constructed by the model.

## Flow — three cases, state-driven

Pick the case from user intent **and current state**; invocations are idempotent — the same request branches differently depending on daemon / injection / picks state.

### Case ① 打开 — open the debug Chrome

User wants the debug browser ("打开Chrome/调试浏览器", `/pick open [url]`), or any case below needs the daemon and it's down.

1. Ensure the CLI exists: `command -v chrome-devtools >/dev/null 2>&1 || npm i -g chrome-devtools-mcp@latest`
2. Check `chrome-devtools status` — **read the output text, not the exit code** (status exits 0 even when down)
3. Daemon down → start it (see *Daemon rules*), then optionally open a page:
   ```bash
   chrome-devtools new_page "https://example.com"
   ```
4. Tell the user the browser is up, then **pause and wait** — unless combining with Case ②.

### Case ② 注入 — inject the picker into the active tab

User wants to pick elements, or a later case needs the picker and it's missing.

1. Preconditions: Case ① (daemon up); **confirm the active tab** (see *Active tab*) — `[selected]` in `list_pages` is the daemon context, not necessarily the tab the user is looking at.
2. Check injection on that tab:
   ```bash
   chrome-devtools evaluate_script "() => !!window.__PI_PICKER__"
   ```
3. `false` → inject (see *Inject*), then tell the user the controls (see *After-injection message*) and **pause** — the user needs time to click; keep any pending command for the next turn. Never barrel ahead into reading.
4. `true` → move on to Case ③.

### Case ③ 读取并分析 — read picks and act

User says they picked something ("好了/选完了"), or the picker is already present, typically with a command to execute on the picks.

1. Preconditions: daemon up (①), active tab confirmed, injection re-checked (navigation / HMR clears it → re-inject per ②).
2. Read the batch (see *Read & clear*) — picks live in `sessionStorage['pi.picks']`, **tab-level data** (unreadable after a tab switch).
3. Branch:
   - **Empty `[]`** → the user hasn't picked: prompt them to click the fab / press `⇧⌥P`, then **pause**; keep any pending command.
   - **Non-empty** → report each pick (selector, textPreview, note, source) as the core context of this turn, **clear storage** (see *Read & clear*), then:
     - **With a command** (the invocation args): infer intent from picks + notes + command, execute it.
     - **Without a command**: state your understanding ("我理解你想关注/修改的是……") and wait for confirmation or additions.

### Combinations

- **① + ②** — the common opener: start daemon, open page, inject, tell controls, pause. One turn.
- **② → ③ across turns** — ② always ends paused; the user picks, then the next message (any "done" signal or a bare `/pick <command>`) triggers ③.
- **① + ② + ③** — only when picks already exist (persistent profile reused); otherwise injection forces a pause before ③.

## Reference

### Daemon rules

```bash
chrome-devtools start --headless=false --userDataDir ~/.cache/chrome-devtools-mcp/cli-profile
```

- ⚠️ Any tool command run while the daemon is down **auto-starts it headless with a throwaway profile**. If that happened: `chrome-devtools stop`, then run the start command above again.
- `start` on a running daemon **restarts** it (closes the browser; the profile persists). Check `status` first; only restart when needed.
- `chrome-devtools stop` kills daemon + browser. Leaving it running preserves tabs / login state — prefer leaving it running unless asked.

### Pages

```bash
chrome-devtools new_page "https://example.com"        # new tab + select
chrome-devtools list_pages                            # tabs; [selected] marks daemon context
chrome-devtools select_page <pageId> --bringToFront   # pageId: number from list_pages
chrome-devtools navigate_page --type url --url "https://…"
```

### Active tab

`[selected]` only marks the daemon context. Verify the user's foreground tab before injecting or reading:

```bash
chrome-devtools evaluate_script "() => ({ href: location.href, visible: document.visibilityState === 'visible' })"
```

`visible: false` → the user switched tabs; find the matching page in `list_pages`, `select_page <pageId> --bringToFront`, re-verify. Ambiguous → ask the user which tab they're on. **Never inject or read on a stale tab.**

### Inject

```bash
chrome-devtools evaluate_script "$(cat ~/.pi/agent/skills/chrome-picker/picker.js)"
```

- Always via `"$(cat …)"` — never paste picker.js content into a command yourself.
- picker.js must keep its function-expression shape with **no trailing `;`** — the server evaluates `(${fnString})`, a trailing semicolon is a syntax error.

### Read & clear

```bash
chrome-devtools evaluate_script "() => { try { const s = sessionStorage.getItem('pi.picks'); return s ? JSON.parse(s) : []; } catch (e) { return []; } }"
chrome-devtools evaluate_script "() => { sessionStorage.removeItem('pi.picks'); if (window.__PI_PICKS_API__) window.__PI_PICKS_API__.refresh(); return true; }"
```

Append `--output-format=json` to any command for machine-readable output.

### After-injection message

Tell the user in their language:
"已注入准星悬浮按钮（右下角，可拖动），点击即进入拾取模式；或直接按 `⇧⌥P` 进入（零点击，已打开的下拉/浮层不会被关闭）。拾取默认**冻结**页面交互：hover 高亮、`[`/`]` 切层、Enter 选中、可写备注、`F` 冻结⇄实时、Esc 退出。"

### Picker interaction (reference)

- fab 可拖动，点击进入拾取；热键 `⇧⌥P` 进入/退出（零点击，浮层不 dismiss）
- 默认**冻结**（页面收不到 hover/点击，浮层不会关闭）；`F` 切实时（hover 展开子菜单等）
- `[` `]` 切层、`1`-`9` 跳层、Enter 选中 → 备注卡（可留空直接回车）、Esc 取消/退出
- 程序化 API：`window.__PI_PICK_API__` = `{ start, stop, toggle, freeze, pickAt(x, y), pick(sel), snapshot, refresh }` — when the user points at an element/position, prefer `pickAt` / `pick` over waiting for manual interaction
- `source` 字段（React `_debugSource` / Vue `__file`）仅 dev 构建存在，生产构建为 null — 不要编造

## Notes

- CLI daemon browser and MCP browser are **separate instances** (different profiles); logins don't carry over.
- picker.js storage contract: `sessionStorage['pi.picks']` (batch), `sessionStorage['pi.fabPos']` (fab position), `window.__PI_PICKER__` (injection flag).
- Thin prompt shortcut: `/pick` (see `prompts/pick.md`) — routing only, methodology lives here.
- This skill replaces the old `pick-chrome-element` prompt; `/open-chrome-pause` (MCP path) remains for MCP-managed browsers.

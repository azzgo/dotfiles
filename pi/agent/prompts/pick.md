---
name: pick
description: Thin shortcut into the chrome-picker skill — open the CLI debug Chrome, inject the element picker into the active tab, or read picked elements and run a command on them. Methodology lives in the skill.
argument-hint: "[open <url>] | [command to execute on picked elements]"
---

You are invoking the **chrome-picker** skill (CLI-managed debug Chrome, separate from the MCP browser).

This prompt is a **thin shortcut only**. Do **not** invent a second methodology here. Load and follow:

- skill: `chrome-picker` — read `~/.pi/agent/skills/chrome-picker/SKILL.md` and use its three cases (① open / ② inject / ③ read & consume)

## Case routing

Route on the user arguments (`$@`) **and current state** — same invocation branches differently depending on daemon / injection / picks state:

1. **`open` (optionally with a URL), or daemon is down** → Case ①: ensure CLI, start the headed daemon with the persistent `cli-profile`, open the URL if given. If the user's intent includes picking, continue to Case ② in the same turn (①+② combo); otherwise tell the user the browser is up and pause.
2. **Picker missing on the user's active tab** → Case ②: confirm the active tab (`list_pages` + `visibilityState`), inject via `chrome-devtools evaluate_script "$(cat ~/.pi/agent/skills/chrome-picker/picker.js)"`, tell the user the controls, then **pause** — keep any command from `$@` pending for the next turn.
3. **Picker already present** → Case ③: re-check injection (navigation/HMR clears it → re-inject per ②), read `pi.picks`:
   - empty → prompt the user to pick (`⇧⌥P` or the fab) and pause
   - non-empty → report the picks, clear storage, then execute the `$@` command; without a command, state your understanding of the intent and wait

Hard rules (from the skill):

- Never construct picker.js content yourself — always `"$(cat …)"`.
- Never inject or read on a stale tab: `[selected]` ≠ the user's foreground tab.
- After ② always pause for manual picking; only ③ consumes.
- This flow does **not** use the chrome-devtools MCP; `/open-chrome-pause` stays the entry for the MCP browser.

After the routed case completes, pause and wait for the user's next instruction.

User arguments: $@

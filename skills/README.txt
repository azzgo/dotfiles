# Skills Inventory (generic)

This directory (`<repo-root>/skills/`) contains **pi-independent** skills maintained by this dotfiles repo. They are installed by linking each folder into `~/.agents/skills/` via `just install-skills` — they are **not** linked into `~/.pi/agent/skills/`.

Pi-coupled skills (sub-dispatch / dispatch tool / pi prompts) live in `pi/agent/skills/` instead; see the README.txt there.

## Skill Location Strategy

| Priority | Path | Scope | Description |
|----------|------|-------|-------------|
| 1 | `~/.pi/agent/skills/` | User-level | Pi-coupled skills (this repo's `pi/agent/skills/`, via `just install-pi`) |
| 2 | `~/.pi/agent/npm/node_modules/*/skills/` | User-level, npm packages | Skills from npm packages (pi-web-access/librarian) |
| 3 | `~/.agents/skills/` | User-level, shared | This repo's generic skills (via `just install-skills`) + other manually installed agent skills |

Because `~/.agents/skills/` is also a pi skill search path, these skills remain usable from Pi after `just install-skills`, at lower priority than pi-coupled ones.

---

## Skills in this directory (`<repo-root>/skills/`)

### `chrome-devtools-cli`

| Field | Value |
|-------|-------|
| **Source** | Forked from [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/chrome-devtools-cli) `skills/chrome-devtools-cli/` |
| **Description** | Chrome DevTools CLI skill: project-scoped profiles (each `PWD` gets its own isolated Chrome instance via sha256 hash), headed mode by default, no auto-invocation. Replaces the chrome-devtools MCP for browser automation via CLI |
| **Installed** | 2026-08-19 |
| **Adjustments** | `disable-model-invocation: true` (prompt-routed only); default `--headless=false`; project-scoped profile via `~/.cache/chrome-devtools-mcp/profiles/<pwd-hash>` with `.mapping.json` for human readability; multi-profile suffix support for clean/separate contexts; removed PWA, Memory Debugging, experimental features sections; `open-chrome-pause.md` prompt adapted to route through this skill. 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`) |
| **Upstream** | https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/chrome-devtools-cli |

### `grill-with-docs`

| Field | Value |
|-------|-------|
| **Source** | Custom / originally from Pi examples |
| **Description** | Grilling session that challenges plans against existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise |
| **Installed** | 2026-06-15 |
| **Adjustments** | Originally adapted from Pi SDK examples. Created CONTEXT-FORMAT.md and ADR-FORMAT.md as supplementary reference docs. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`). 2026-09-09: added a by-name reference to the `show-me` skill (now in `pi/agent/skills/show-me/`) for visual presentation of design understanding / proposed changes during grilling |
| **Upstream** | Derived from Pi SDK docs; no external upstream to track |

### `handoff`

| Field | Value |
|-------|-------|
| **Source** | Converted from `pi/agent/prompts/handoff.md` (repo-owned prompt) |
| **Description** | Generate a handoff document summarizing the current conversation for a fresh agent to continue the work |
| **Installed** | 2026-08-25 |
| **Adjustments** | Converted prompt → skill per Agent Skills standard; added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only); replaced `$@` prompt substitution with appended instruction (skill args are appended raw, not substituted). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`) |
| **Upstream** | None (repo-owned; no external upstream to track) |

### `improve-codebase-architecture`

| Field | Value |
|-------|-------|
| **Source** | Pi npm package |
| **Description** | Find refactoring opportunities, consolidate tightly-coupled modules, make codebases more testable and AI-navigable |
| **Installed** | 2026-05-20 |
| **Adjustments** | Added HTML-REPORT.md for richer output format. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`); replaced relative links into `../grill-with-docs/` with by-name suggestions (locate the skill in the environment instead of path dependencies) |
| **Upstream** | Pi npm package |

### `prototype`

| Field | Value |
|-------|-------|
| **Source** | [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype) |
| **Description** | Build a throwaway prototype to answer a design question — two branches: LOGIC.md (terminal TUI) for state/logic questions and UI.md (browser variants) for visual questions |
| **Installed** | 2026-07-24 |
| **Source commit** | `ed37663` (2026-07-21) — `refactor(to-tickets): remove redundant instructions for ticket implementation` |
| **Adjustments** | Installed as-is with no modifications. Files: SKILL.md, LOGIC.md, UI.md, agents/openai.yaml. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`) |
| **Upstream** | https://github.com/mattpocock/skills — check for upstream changes regularly |

### `wayfinder`

| Field | Value |
|-------|-------|
| **Source** | Personal adaptation of [mattpocock/skills wayfinder](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md) |
| **Description** | Personal Wayfinder — local decision-map skill over taskmd; keeps original chart/work method, removes team ceremony, stays out of the implementation layer |
| **Installed** | 2026-07-24 |
| **Adjustments** | taskmd backend only; Ticket/Map templates; local skill mapping; thin `/wayfinder` prompt shortcut; no implementation-layer merge. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` and **generalized**: workspace moved out of the repo to `~/.cache/wayfinder/<workspace-id>/tickets/` (workspace-id is a pi-session-style slug of the repo-root abs path (`/`→`-` plus trailing `-`, e.g. `-Users-ison-dev-dotfiles-`); no per-repo gitignore needed); all Goal Runtime coupling removed (`/goal` commands, `.pi/goals/` `.pi/track/` references) in favor of a generic "implementation entry is user-triggered / handoff is suggestion-only" invariant; skill references now by name (`explore-codebase`, `grill-with-docs`, `prototype`) instead of `/skill:` syntax; `web_search`/`fetch_content` tool names replaced by environment-neutral wording; argument routing lives in the skill (single source of truth), pi-side thin prompt `pi/agent/prompts/wayfinder.md` slimmed to a pure forwarder. Existing repos with old data: `mv .pi/wayfinder ~/.cache/wayfinder/<workspace-id>` |
| **Upstream** | https://github.com/mattpocock/skills — check for upstream method changes regularly |

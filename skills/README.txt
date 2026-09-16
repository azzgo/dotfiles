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

### `chrome-devtools`

| Field | Value |
|-------|-------|
| **Source** | Forked from [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/chrome-devtools-cli) `skills/chrome-devtools/` |
| **Description** | Chrome DevTools automation skill, MCP-first: use the chrome-devtools MCP server when configured (process managed by the agent host, no daemon cleanup), fall back to the CLI daemon when MCP is unavailable. Project-scoped profiles (each `PWD` gets its own isolated Chrome instance via hash), headed mode by default, no auto-invocation |
| **Installed** | 2026-08-19 |
| **Adjustments** | `disable-model-invocation: true` (prompt-routed only); default `--headless=false`; project-scoped profile via `~/.cache/chrome-devtools-mcp/profiles/<pwd-hash>` with `.mapping.json` for human readability; multi-profile suffix support for clean/separate contexts; removed PWA, Memory Debugging, experimental features sections; `open-chrome-pause.md` prompt adapted to route through this skill. 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`). 2026-09-13: restructured to MCP-primary/CLI-fallback — SKILL.md is now routing + shared conventions, with `references/mcp-sop.md` (agent-host-managed server, preferred), `references/cli-sop.md` (self-managed daemon fallback) and shared `references/tool-catalog.md`; skills are now provisioned per project via the project-skills extension (`/pi-skills`) instead of global install. 2026-09-13: renamed `chrome-devtools-cli` → `chrome-devtools` (MCP is primary; name no longer CLI-specific) |
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

### `intake`

| Field | Value |
|-------|-------|
| **Source** | Repo-owned; dialogue design informed by [DivikWu/product-requirement-craft](https://github.com/DivikWu/product-requirement-craft) (layered grilling + progressive disclosure) and [45ck/business-analysis-skills](https://github.com/45ck/business-analysis-skills) (ambiguity/assumption hunting), heavily narrowed to single-source alignment |
| **Description** | Requirement intake funnel — archive parsed raw inputs (PRD text, meeting notes, Figma extracts, spreadsheets) per requirement under `~/.cache/intake/<workspace-slug>/<requirement-slug>/`, grilling on ONE source at a time until the agent's understanding matches the user's. No cross-source reconciliation, no solutions, no codebase access; output is the aligned raw requirement, handed down to grill-me / grill-with-docs / wayfinder |
| **Installed** | 2026-09-16 |
| **Adjustments** | Files: SKILL.md (core flow only, grill-with-docs style) + INTAKE-FORMAT.md (STATE.md / raw frontmatter / aligned templates). workspace-slug reuses the wayfinder convention (repo-root abs path → dash-slug with trailing dash). Mandatory step 0: every invocation first lists existing requirement slugs and asks the user to pick or open a new funnel. `STATE.md` is the cross-session baton (index + one-liner, never a conversation log). Parsing intentionally upstream (inputs must arrive pre-parsed) |
| **Upstream** | None (repo-owned; reference-only upstreams above) |

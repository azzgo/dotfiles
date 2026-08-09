# Skills Inventory

This directory (`~/.pi/agent/skills/`) contains skill definitions used by AI agents (primarily Pi and Claude).

## Skill Location Strategy

Skills are loaded from multiple locations in order:

| Priority | Path | Scope | Description |
|----------|------|-------|-------------|
| 1 | `~/.pi/agent/skills/` | User-level | **This directory** — manually installed / refined skills |
| 2 | `~/.pi/agent/npm/node_modules/*/skills/` | User-level, npm packages | Skills from npm packages (pi-interactive-shell, pi-web-access/librarian) |
| 3 | `~/.agents/skills/` | User-level, manual install | Other agent skills (browser-bridge, pixso, skill-creator) |

---

## Skills in this directory (`~/.pi/agent/skills/`)

### `code-review`

| Field | Value |
|-------|-------|
| **Source** | Refined from [sanyuan0704/sanyuan-skills](https://github.com/sanyuan0704/sanyuan-skills) + [mattpocock/skills](https://github.com/mattpocock/skills) code-review |
| **Description** | Two-axis structured code review (Standards + Spec), combining both sources' review axes and further refined |
| **Installed** | 2026-07-10 |
| **Adjustments** | Merged review dimensions from both sources; added code-quality, removal-plan, security, and SOLID checklists as references. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only) |
| **Upstream** | https://github.com/sanyuan0704/sanyuan-skills / https://github.com/mattpocock/skills |

### `grill-with-docs`

| Field | Value |
|-------|-------|
| **Source** | Custom / originally from Pi examples |
| **Description** | Grilling session that challenges plans against existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise |
| **Installed** | 2026-06-15 |
| **Adjustments** | Originally adapted from Pi SDK examples. Created CONTEXT-FORMAT.md and ADR-FORMAT.md as supplementary reference docs. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only) |
| **Upstream** | Derived from Pi SDK docs; no external upstream to track |

### `impl-with-spawn`

| Field | Value |
|-------|-------|
| **Source** | Pi npm package |
| **Description** | Delegate implementation tasks to sub-agents (pi/cursor) via interactive_shell |
| **Installed** | 2026-07-02 |
| **Adjustments** | None (tracked via Pi npm updates). 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-08-09: revised per root-cause analysis (notification-driven dispatch, heuristic agent selection, `handsFree.autoExitOnQuiet: false` on all examples). Root cause found + fixed (2026-08-09): `pi <prompt>` never exits in the extension PTY (interactive TUI), so completion notification never fires with `autoExitOnQuiet:false` — fixed via `defaultArgs.pi: ["-p"]` in `pi/agent/interactive-shell.json` (pi spawns run print mode, exit on completion); skill now documents the "sub-agent must exit" premise. End-to-end verified (spawn form 3s exit + notification). |
| **Upstream** | Pi npm package |

### `improve-codebase-architecture`

| Field | Value |
|-------|-------|
| **Source** | Pi npm package |
| **Description** | Find refactoring opportunities, consolidate tightly-coupled modules, make codebases more testable and AI-navigable |
| **Installed** | 2026-05-20 |
| **Adjustments** | Added HTML-REPORT.md for richer output format. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only) |
| **Upstream** | Pi npm package |

### `prototype`

| Field | Value |
|-------|-------|
| **Source** | [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype) |
| **Description** | Build a throwaway prototype to answer a design question — two branches: LOGIC.md (terminal TUI) for state/logic questions and UI.md (browser variants) for visual questions |
| **Installed** | 2026-07-24 |
| **Source commit** | `ed37663` (2026-07-21) — `refactor(to-tickets): remove redundant instructions for ticket implementation` |
| **Adjustments** | Installed as-is with no modifications. Files: SKILL.md, LOGIC.md, UI.md, agents/openai.yaml. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only) |
| **Upstream** | https://github.com/mattpocock/skills — check for upstream changes regularly |


### `wayfinder`

| Field | Value |
|-------|-------|
| **Source** | Personal adaptation of [mattpocock/skills wayfinder](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md) |
| **Description** | Personal Wayfinder — local decision-map skill over taskmd; keeps original chart/work method, removes team ceremony, stays separate from Goal Runtime |
| **Installed** | 2026-07-24 |
| **Adjustments** | taskmd backend only; per-repo `.pi/wayfinder/tickets/`; Ticket/Map templates; local skill mapping; thin `/wayfinder` prompt shortcut; no Goal Runtime merge. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only) |
| **Upstream** | https://github.com/mattpocock/skills — check for upstream method changes regularly |

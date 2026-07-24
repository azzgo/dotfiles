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
| **Adjustments** | Merged review dimensions from both sources; added code-quality, removal-plan, security, and SOLID checklists as references |
| **Upstream** | https://github.com/sanyuan0704/sanyuan-skills / https://github.com/mattpocock/skills |

### `grill-with-docs`

| Field | Value |
|-------|-------|
| **Source** | Custom / originally from Pi examples |
| **Description** | Grilling session that challenges plans against existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise |
| **Installed** | 2026-06-15 |
| **Adjustments** | Originally adapted from Pi SDK examples. Created CONTEXT-FORMAT.md and ADR-FORMAT.md as supplementary reference docs. |
| **Upstream** | Derived from Pi SDK docs; no external upstream to track |

### `impl-with-spawn`

| Field | Value |
|-------|-------|
| **Source** | Pi npm package |
| **Description** | Delegate implementation tasks to sub-agents (pi/cursor) via interactive_shell |
| **Installed** | 2026-07-02 |
| **Adjustments** | None (tracked via Pi npm updates) |
| **Upstream** | Pi npm package |

### `improve-codebase-architecture`

| Field | Value |
|-------|-------|
| **Source** | Pi npm package |
| **Description** | Find refactoring opportunities, consolidate tightly-coupled modules, make codebases more testable and AI-navigable |
| **Installed** | 2026-05-20 |
| **Adjustments** | Added HTML-REPORT.md for richer output format |
| **Upstream** | Pi npm package |

### `prototype`

| Field | Value |
|-------|-------|
| **Source** | [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype) |
| **Description** | Build a throwaway prototype to answer a design question — two branches: LOGIC.md (terminal TUI) for state/logic questions and UI.md (browser variants) for visual questions |
| **Installed** | 2026-07-24 |
| **Source commit** | `ed37663` (2026-07-21) — `refactor(to-tickets): remove redundant instructions for ticket implementation` |
| **Adjustments** | Installed as-is with no modifications. Files: SKILL.md, LOGIC.md, UI.md, agents/openai.yaml |
| **Upstream** | https://github.com/mattpocock/skills — check for upstream changes regularly |


### `wayfinder`

| Field | Value |
|-------|-------|
| **Source** | Personal adaptation of [mattpocock/skills wayfinder](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md) |
| **Description** | Personal Wayfinder — local decision-map skill over taskmd; keeps original chart/work method, removes team ceremony, stays separate from Planning Files Runtime |
| **Installed** | 2026-07-24 |
| **Adjustments** | taskmd backend only; per-repo `.pi/wayfinder/tickets/`; Ticket/Map templates; local skill mapping; thin `/wayfinder` prompt shortcut; no Planning Files Runtime merge |
| **Upstream** | https://github.com/mattpocock/skills — check for upstream method changes regularly |

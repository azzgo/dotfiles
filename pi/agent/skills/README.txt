# Skills Inventory

This directory (`~/.pi/agent/skills/`) contains **pi-coupled** skill definitions — skills that depend on pi mechanisms (sub-dispatch extension / dispatch tool / pi prompts). It is symlinked from `~/.pi/agent/skills` to this repo directory by `just install-pi`.

Generic, pi-independent skills maintained by this repo live in the repo-root `skills/` directory and install into `~/.agents/skills/` via `just install-skills` (see the README.txt there). Pi still loads `~/.agents/skills/` as a lower-priority search path, so generic skills remain usable from Pi.

## Skill Location Strategy

| Priority | Path | Scope | Description |
|----------|------|-------|-------------|
| 1 | `~/.pi/agent/skills/` | User-level | **This directory** — pi-coupled, manually installed / refined skills |
| 2 | `~/.pi/agent/npm/node_modules/*/skills/` | User-level, npm packages | Skills from npm packages (pi-web-access/librarian) |
| 3 | `~/.agents/skills/` | User-level, shared | Repo-generic skills (`just install-skills`) + other manually installed agent skills |

---

## Skills in this directory (`~/.pi/agent/skills/`)

### `setup-code-review`

| Field | Value |
|-------|-------|
| **Source** | Refined from [sanyuan0704/sanyuan-skills](https://github.com/sanyuan0704/sanyuan-skills) + [mattpocock/skills](https://github.com/mattpocock/skills) code-review; setup orchestration is repo-owned |
| **Description** | One-time project setup that generates a self-contained, project-tuned `<project>-code-review` skill in the project's `.agents/skills/`. Grilling session first (local grill skill preferred), probes project-local skills as SOP replacements, assembles the generated skill in copy mode from `references/` (review-skill-template + checklists), then trial-runs it on a real diff |
| **Installed** | 2026-09-13 |
| **Adjustments** | 2026-09-13: absorbed and retired the standalone `code-review` skill — review focus differs per project, so the skill became a setup tool instead of a directly-invoked review skill. The former three-axis SKILL.md is preserved verbatim as `references/review-skill-template.md` (parameterized `{{PROJECT_NAME}}`, adaptation guide in header comment); the four checklists (SOLID / code-quality / security-race / removal-plan) copied unchanged into `references/`. Hard rules: copy mode (generated skill never references setup-code-review), local-first grilling + SOP replacement, upgrade-in-place instead of duplicate, mandatory trial run |
| **Upstream** | https://github.com/sanyuan0704/sanyuan-skills / https://github.com/mattpocock/skills |

### `explore-codebase`

| Field | Value |
|-------|-------|
| **Source** | Converted from `pi/agent/prompts/explore-codebase.md` (repo-owned prompt) |
| **Description** | Read-only codebase exploration: orchestrate parallel read-only sub-agents (MiniMax-M2.7 / deepseek-v4-flash first), summarize findings |
| **Installed** | 2026-08-12 |
| **Adjustments** | Converted prompt → skill per Agent Skills standard; added `disable-model-invocation: true` (no model auto-invocation; explicit `/skill:explore-codebase` trigger only); replaced `$@` prompt substitution with appended `User arguments:` (skill args are appended raw, not substituted). `wayfinder` skill references updated to `/skill:explore-codebase`. 2026-08-20: root-cause fix after a live exploration session blocked on `sleep 90` — dispatch template was missing `handsFree: { autoExitOnQuiet: false }` (sub-agents quiet-killed at 16s mid-flight) and the skill had no "end turn after dispatch" instruction (2026-08-09 fix only covered impl-with-spawn). Template now requires `autoExitOnQuiet: false`; added Wait discipline section (end turn immediately, triggerTurn wake-up, never sleep/poll); removed the status-check-and-retry bullet that invited polling. 2026-09-08: Phase 4 report presentation upgraded by borrowing the show-me skill's visual vocabulary; 2026-09-09: inline visual-form examples replaced by a by-name reference to the `show-me` skill (single source of truth, token saving — same pattern as `spawn-model-selection`) |
| **Upstream** | None (repo-owned; no external upstream to track) |

### `show-me`

| Field | Value |
|-------|-------|
| **Source** | Attributed to mattpocock's `/show-me` skill; no longer present in https://github.com/mattpocock/skills (no upstream commit to track) — the local copy is authoritative |
| **Description** | Help the user understand the current topic visually with concise diagrams, code-shape sketches, and focused HTML artifacts (pseudocode / call tree / component tree / file tree / Mermaid / diff) |
| **Installed** | 2026-09-07 (into `~/.agents/skills/`); 2026-09-09 moved into this repo directory `pi/agent/skills/show-me/` (installed via `just install-pi` → `~/.pi/agent/skills/`) and now referenced by name from `explore-codebase` and `code-review` |
| **Adjustments** | None to SKILL.md content; location moves only |
| **Upstream** | None trackable (removed upstream); local copy is authoritative |

### `impl-with-spawn`

| Field | Value |
|-------|-------|
| **Source** | Pi npm package |
| **Description** | Delegate implementation tasks to sub-agents (pi/cursor) via dispatch (sub-dispatch ext) |
| **Installed** | 2026-07-02 |
| **Adjustments** | None (tracked via Pi npm updates). 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-08-09: revised per root-cause analysis (notification-driven dispatch, heuristic agent selection, `handsFree.autoExitOnQuiet: false` on all examples). Root cause found + fixed (2026-08-09): `pi <prompt>` never exits in the extension PTY (interactive TUI), so completion notification never fires with `autoExitOnQuiet:false` — fixed via `defaultArgs.pi: ["-p"]` (pi spawns run print mode, exit on completion; now lives in the sub-dispatch extension config); skill now documents the "sub-agent must exit" premise. End-to-end verified (spawn form 3s exit + notification). |
| **Upstream** | Pi npm package |

### `spawn-model-selection`

| Field | Value |
|-------|-------|
| **Source** | Repo-owned (new skill) |
| **Description** | Shared single source of truth for choosing which model to run a spawned sub-agent on; referenced by impl-with-spawn and explore-codebase to avoid maintaining the model-priority list in multiple places |
| **Installed** | 2026-08-20 |
| **Adjustments** | Extracted model-selection priority from impl-with-spawn's Agent Selection section. Simple/mechanical tier: minimax-m2.7 → opencode/hy3 → opencode/mimo-v2.5 → deepseek-v4-flash → local Ollama (commit/cleanup only, max 2 concurrent). Complex/long-context tier: deepseek-v4-flash → opencode/mimo-v2.5 → opencode/hy3. Notes: deepseek-v4-pro excluded by default after price hike (explicit request only); MiniMax-M3 excluded (unstable instruction following); hy3 preferred for multimodal, mimo-v2.5 when 1M context needed |
| **Upstream** | None (repo-owned; no external upstream to track) |

### `why`

| Field | Value |
|-------|-------|
| **Source** | Adapted from [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/why) `why` |
| **Description** | Design-rationale investigation — "why does X work this way". Anchors on code (blame / log --follow / gh PR bodies), then dispatches parallel read-only investigators per available evidence category (source control always; docs / tracker / chat / observability when the environment offers them), synthesizes a confidence-tiered, cited read (references/epistemics.md) |
| **Installed** | 2026-09-17 |
| **Source commit** | `5bf2b15` (2026-09-13) — `feat(pstack): setup-pstack budget ask` |
| **Adjustments** | Trimmed the Cursor-specific MCP discovery mechanism and per-source playbooks (`references/sources/`, `investigator-prompt.md`) — replaced with an environment-neutral category table (source control guaranteed, others opportunistic, nulls documented); dispatch/wait discipline and model selection re-pointed to the repo's own sub-dispatch conventions (spawn-model-selection, code-mode shape, show-me presentation) instead of Cursor Task agents and pstack model configs; epistemics.md reference kept verbatim; incident-postmortem playbook folded into the SKILL.md "defensive code" note |
| **Upstream** | https://github.com/cursor/plugins/tree/main/pstack — check for upstream changes regularly |

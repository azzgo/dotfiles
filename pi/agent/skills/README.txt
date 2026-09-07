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

### `code-review`

| Field | Value |
|-------|-------|
| **Source** | Refined from [sanyuan0704/sanyuan-skills](https://github.com/sanyuan0704/sanyuan-skills) + [mattpocock/skills](https://github.com/mattpocock/skills) code-review |
| **Description** | Multi-axis structured code review (Standards + Spec + Documentation Consistency), combining both sources' review axes and further refined |
| **Installed** | 2026-07-10 |
| **Adjustments** | Merged review dimensions from both sources; added code-quality, removal-plan, security, and SOLID checklists as references. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-08-22: extended from two-axis to multi-axis — added Documentation Consistency as a third independent sub-agent (user-facing docs vs diff / vs each other / vs manifests); rewrote spawn as parallel background dispatch via the `dispatch` tool (fire-and-forget, no sleep-and-poll, timeout/retry belong to the dispatch tool); added a bounded trigger (default diff-signal gate + user "force doc check" override); main agent is the sole dispatcher; sub-agents are static workflows (no nested dispatch). Standards / Spec sub-agent prompts kept unchanged (extension, not refactor) |
| **Upstream** | https://github.com/sanyuan0704/sanyuan-skills / https://github.com/mattpocock/skills |

### `explore-codebase`

| Field | Value |
|-------|-------|
| **Source** | Converted from `pi/agent/prompts/explore-codebase.md` (repo-owned prompt) |
| **Description** | Read-only codebase exploration: orchestrate parallel read-only sub-agents (MiniMax-M2.7 / deepseek-v4-flash first), summarize findings |
| **Installed** | 2026-08-12 |
| **Adjustments** | Converted prompt → skill per Agent Skills standard; added `disable-model-invocation: true` (no model auto-invocation; explicit `/skill:explore-codebase` trigger only); replaced `$@` prompt substitution with appended `User arguments:` (skill args are appended raw, not substituted). `wayfinder` skill references updated to `/skill:explore-codebase`. 2026-08-20: root-cause fix after a live exploration session blocked on `sleep 90` — dispatch template was missing `handsFree: { autoExitOnQuiet: false }` (sub-agents quiet-killed at 16s mid-flight) and the skill had no "end turn after dispatch" instruction (2026-08-09 fix only covered impl-with-spawn). Template now requires `autoExitOnQuiet: false`; added Wait discipline section (end turn immediately, triggerTurn wake-up, never sleep/poll); removed the status-check-and-retry bullet that invited polling | 
| **Upstream** | None (repo-owned; no external upstream to track) |

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

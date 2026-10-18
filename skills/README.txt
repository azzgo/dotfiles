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

### `show-me`

| Field | Value |
|-------|-------|
| **Source** | Attributed to mattpocock's `/show-me` skill; no longer present in https://github.com/mattpocock/skills (no upstream commit to track) — the local copy is authoritative |
| **Description** | Help the user understand the current topic visually with concise diagrams, code-shape sketches, and focused HTML artifacts (pseudocode / call tree / component tree / file tree / Mermaid / diff) |
| **Installed** | 2026-09-07 (into `~/.agents/skills/`); 2026-09-09 moved to `pi/agent/skills/show-me/`; 2026-10-09 moved back to repo-root `skills/` — no pi mechanism coupling, referenced by name only |
| **Adjustments** | None to SKILL.md content; location moves only |
| **Upstream** | None trackable (removed upstream); local copy is authoritative |

### `grilling`

| Field | Value |
|-------|-------|
| **Source** | Converted from `pi/agent/prompts/grill-me.md` (repo-owned prompt), redesigned against [mattpocock/skills grilling](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling) |
| **Description** | Grill the user relentlessly about a plan/decision/idea until shared understanding — the topic mapped as a design tree, worked in frontier rounds: each round asks every currently-unblocked question (numbered, one recommended answer each), the user's answers settle decisions and push the frontier outward; facts are looked up or delegated to a sub-agent, never asked; no action until the user confirms shared understanding |
| **Installed** | 2026-10-09 |
| **Source commit** | `49dd158` (2026-10-09) — mattpocock/skills HEAD |
| **Adjustments** | Prompt → skill per Agent Skills standard (`disable-model-invocation: true`, `$@` replaced by appended user arguments). Adopted upstream's frontier-rounds redesign in full (replaces the old one-question-at-a-time rule); kept the old prompt's "do not enact until confirmed" gate. Sub-agent wording generalized (upstream "dispatch", ours "spawn") — no pi coupling. Added a by-name `show-me` reference for presenting design understanding. Upstream `domain-modeling` was NOT ported as a separate skill — its discipline lives in the `grill-with-docs` skill below |
| **Upstream** | https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling — check for upstream changes regularly |

### `grill-with-docs`

| Field | Value |
|-------|-------|
| **Source** | Custom / originally from Pi examples |
| **Description** | Grilling session that challenges plans against existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise |
| **Installed** | 2026-06-15 |
| **Adjustments** | Originally adapted from Pi SDK examples. Created CONTEXT-FORMAT.md and ADR-FORMAT.md as supplementary reference docs. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`). 2026-09-09: added a by-name reference to the `show-me` skill for visual presentation of design understanding / proposed changes during grilling. 2026-10-09: synced with upstream mattpocock/skills redesign (commit 49dd158): interview mechanics delegated by name to the new `grilling` skill (design tree / frontier rounds, replacing one-question-at-a-time); upstream `domain-modeling` skill deliberately folded in as the "actively build and sharpen the domain model" discipline instead of a separate skill; kept this repo's CONTEXT.md naming (upstream renamed to GLOSSARY.md — not adopted, repo-wide convention here is CONTEXT.md) |
| **Upstream** | https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs — check for upstream changes regularly |
| **Upstream** | Derived from Pi SDK docs; synced 2026-10-09 against https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs (commit 49dd158) |

### `handoff`

| Field | Value |
|-------|-------|
| **Source** | Converted from `pi/agent/prompts/handoff.md` (repo-owned prompt) |
| **Description** | Generate a handoff document summarizing the current conversation for a fresh agent to continue the work |
| **Installed** | 2026-08-25 |
| **Adjustments** | Converted prompt → skill per Agent Skills standard; added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only); replaced `$@` prompt substitution with appended instruction (skill args are appended raw, not substituted). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` (decoupled from pi; installed via `just install-skills` → `~/.agents/skills`). 2026-09-17: added an output contract (capsule / status-tagged threads / problems / next move) adapted from pstack's `recall` skill (upstream commit 5bf2b15) — recall itself was not ported; handoff owns the forward-looking half of that format |
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
| **Description** | Personal Wayfinder — local decision-map skill over its own ticket store (`ticket` CLI, `skills/wayfinder/cli/`); keeps original chart/work method, removes team ceremony, stays out of the implementation layer |
| **Installed** | 2026-07-24 |
| **Adjustments** | taskmd backend only; Ticket/Map templates; local skill mapping; thin `/wayfinder` prompt shortcut; no implementation-layer merge. 2026-07-31: added `disable-model-invocation: true` (no model auto-invocation; explicit trigger only). 2026-09-07: moved from `pi/agent/skills/` to repo-root `skills/` and **generalized**: workspace moved out of the repo to `~/.cache/wayfinder/<workspace-id>/tickets/` (workspace-id is a pi-session-style slug of the repo-root abs path (`/`→`-` plus trailing `-`, e.g. `-Users-ison-dev-dotfiles-`); no per-repo gitignore needed); all Goal Runtime coupling removed (`/goal` commands, `.pi/goals/` `.pi/track/` references) in favor of a generic "implementation entry is user-triggered / handoff is suggestion-only" invariant; skill references now by name (`explore-codebase`, `grill-with-docs`, `prototype`) instead of `/skill:` syntax; `web_search`/`fetch_content` tool names replaced by environment-neutral wording; argument routing lives in the skill (single source of truth), pi-side thin prompt `pi/agent/prompts/wayfinder.md` slimmed to a pure forwarder. Existing repos with old data: `mv .pi/wayfinder ~/.cache/wayfinder/<workspace-id>`. 2026-10-18: storage backend replaced — Wayfinder now owns its store outright via a bundled zero-dependency TypeScript `ticket` CLI (`skills/wayfinder/cli/`, run by path with `node`, no build step, no server); taskmd dependency removed (taskmd itself stays installed for other projects; see docs/adr/0016). `TASKMD-CONVENTION.md` git-mv'd to `CONVENTION.md` and rewritten around the fixed frontmatter schema, the eight check rules (unknown frontmatter key is an error, also on read), and the static self-contained `ticket map` HTML render (Frontier-emphasized, replaces the old Web UI); SKILL.md Prerequisites/taskmd-scoping sections removed, invariant #7 now guards a single store. 2026-10-18 (later): `slugify` fixed to keep CJK instead of stripping it — pure-Chinese titles previously collapsed to `untitled.md`, which made 4 of 6 Tickets ungreppable; the slug is now capped at 180 bytes so a long CJK title cannot exceed the filesystem per-name limit, with three tests covering it
| **Upstream** | https://github.com/mattpocock/skills — check for upstream method changes regularly |

### `intake`

| Field | Value |
|-------|-------|
| **Source** | Repo-owned; dialogue design informed by [DivikWu/product-requirement-craft](https://github.com/DivikWu/product-requirement-craft) (layered grilling + progressive disclosure) and [45ck/business-analysis-skills](https://github.com/45ck/business-analysis-skills) (ambiguity/assumption hunting), heavily narrowed to single-source alignment |
| **Description** | Requirement intake funnel — archive parsed raw inputs (PRD text, meeting notes, Figma extracts, spreadsheets) per requirement under `~/.cache/intake/<workspace-slug>/<requirement-slug>/`, grilling on ONE source at a time until the agent's understanding matches the user's. No cross-source reconciliation, no solutions, no codebase access; output is the aligned raw requirement, handed down to grilling / grill-with-docs / wayfinder |
| **Installed** | 2026-09-16 |
| **Adjustments** | Files: SKILL.md (core flow only, grill-with-docs style) + INTAKE-FORMAT.md (STATE.md / raw frontmatter / aligned templates). workspace-slug reuses the wayfinder convention (repo-root abs path → dash-slug with trailing dash). Mandatory step 0: every invocation first lists existing requirement slugs and asks the user to pick or open a new funnel. `STATE.md` is the cross-session baton (index + one-liner, never a conversation log). Parsing intentionally upstream (inputs must arrive pre-parsed) |
| **Upstream** | None (repo-owned; reference-only upstreams above) |

### `retro`

| Field | Value |
|-------|-------|
| **Source** | Hybrid: process skeleton from [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/in-progress/retro) `retro` (in-progress upstream, 7 improvement categories reused); evidence layer (agentsview MCP first, own session history fallback) and grilling consensus gate are repo-owned designs |
| **Description** | Evidence-driven retrospective over AI agent sessions: gather evidence (agentsview preferred, fallback to the running agent's own history), organise improvement candidates with repetition counts, grilling session, then distil whatever the user decides (skill / rule / hook / pattern / doc) for any target project or agent |
| **Installed** | 2026-09-13 |
| **Adjustments** | Deliberately not agentsview-locked — agentsview is the preferred evidence source, never a hard dependency; deliverable form is user-decided, not assumed to be a skill. 2026-09-17: moved from `.agents/skills/` (dotfiles-project-local) to repo-root `skills/` — retros target arbitrary projects and often improve the target project's rules/checks rather than this repo, so the skill must be discoverable globally via `just install-skills` |
| **Upstream** | https://github.com/mattpocock/skills/tree/main/skills/in-progress/retro (in-progress — re-check before syncing) |

### `tdd`

| Field | Value |
|-------|-------|
| **Source** | [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/tdd) |
| **Description** | TDD bug fix — write the smallest failing regression test before touching production code, confirm fail-before/pass-after, prefer no new test over a bad test |
| **Installed** | 2026-09-17 |
| **Source commit** | `5bf2b15` (2026-09-13) — `feat(pstack): setup-pstack budget ask` |
| **Adjustments** | Installed as-is, no modifications |
| **Upstream** | https://github.com/cursor/plugins/tree/main/pstack — check for upstream changes regularly |

### `bro`

| Field | Value |
|-------|-------|
| **Source** | [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/bro) |
| **Description** | Restate the last message in plain human language, no jargon — a one-prompt skill |
| **Installed** | 2026-09-17 |
| **Source commit** | `5bf2b15` (2026-09-13) — `feat(pstack): setup-pstack budget ask` |
| **Adjustments** | Installed as-is, no modifications |
| **Upstream** | https://github.com/cursor/plugins/tree/main/pstack — check for upstream changes regularly |

### `decision-log`

| Field | Value |
|-------|-------|
| **Source** | [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/show-me-your-work) `show-me-your-work`, renamed and adapted |
| **Description** | Reviewable decision trail for long-running/unattended work — one TSV row per decision (what, why, evidence, result), append-only, local by default, committed only when a reviewer needs the trail |
| **Installed** | 2026-09-17 |
| **Source commit** | `5bf2b15` (2026-09-13) — `feat(pstack): setup-pstack budget ask` |
| **Adjustments** | Renamed `show-me-your-work` → `decision-log` (name clash with the `show-me` skill); transcript-audit step generalized from Cursor's `agent-transcripts/` path to "best available record of the run" (agentsview etc.); cross-model review made conditional on a second model family being available instead of Cursor multi-model spawn; references to the upstream `unslop`/`encode-lessons-in-structure` principle skills dropped (not present in this repo). Template TSV and `log.sh` helper kept as-is |
| **Upstream** | https://github.com/cursor/plugins/tree/main/pstack — check for upstream changes regularly |

### `unslop`

| Field | Value |
|-------|-------|
| **Source** | [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/unslop) |
| **Description** | Cut AI writing tells — 33 numbered detection rules with stable ids (vague -ing phrases, rule of three, em dash overuse, metaphor nouns, over-compression, ...), rewrite + self-audit process |
| **Installed** | 2026-09-17 |
| **Source commit** | `5bf2b15` (2026-09-13) — `feat(pstack): setup-pstack budget ask` |
| **Adjustments** | Installed as-is with one routing note added: unslop targets English technical/general writing; Chinese narrative/fiction stays with the `humanize` pi prompt (author-voice preservation conflicts with unslop's normalize-to-plain-prose rules). Rule ids are cited by other pstack skills; decision-log's "plain words" standard resolves to this skill |
| **Upstream** | https://github.com/cursor/plugins/tree/main/pstack — check for upstream changes regularly |

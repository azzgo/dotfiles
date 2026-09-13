# Skills in .agents/skills/ (dotfiles repo)

Skills installed at the **project level of this dotfiles repo itself** — maintained
with the repo code so any agent working in this repo (pi, zcode, cursor, …)
discovers them via the project skill path. Unlike `skills/` (repo-root, generic,
linked into other projects via `/pi-skills`), these are not distributed; they
exist for working on the dotfiles repo itself — which also serves as the global
listening post for session retros.

## `retro`

| Field | Value |
|-------|-------|
| **Source** | Hybrid: process skeleton from [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/in-progress/retro) `retro` (in-progress upstream, 7 improvement categories reused); evidence layer (agentview MCP first, own session history fallback) and grilling consensus gate are repo-owned designs |
| **Description** | Evidence-driven retrospective over AI agent sessions: gather evidence (agentview preferred, fallback to the running agent's own history), organise improvement candidates with repetition counts, grilling session, then distil whatever the user decides (skill / rule / hook / pattern / doc) for any target project or agent |
| **Installed** | 2026-09-13 |
| **Adjustments** | Deliberately not agentview-locked — agentview is the preferred evidence source, never a hard dependency; deliverable form is user-decided, not assumed to be a skill |
| **Upstream** | https://github.com/mattpocock/skills/tree/main/skills/in-progress/retro (in-progress — re-check before syncing) |

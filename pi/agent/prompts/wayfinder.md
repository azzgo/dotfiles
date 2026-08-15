---
name: wayfinder
description: Thin shortcut into the Personal Wayfinder skill. Quick commands only — methodology lives in the wayfinder skill.
argument-hint: "[init|chart <topic>|work|status|ui|help] or free text for smart entry"
---

You are invoking the **Personal Wayfinder** local skill.

This prompt is a **thin shortcut only**. Do **not** invent a second methodology here. Load and follow:

- skill: `wayfinder`
- convention: `wayfinder/TASKMD-CONVENTION.md` (or the skill's sibling convention file)

## Hard rules from the skill

- taskmd is an explicit prerequisite; no silent fallback tracker
- Plan, don't do — read-only to production code (`.pi/wayfinder/` + throwaway prototype scratch only); writing a handoff spec is planning
- Single-Ticket = directional: **downward** exploration is faithful; **sideways** questions become new Tickets handled in a **new session**, never resolved inline
- HITL never auto-resolved: a HITL-channel Ticket (`wayfinder:hitl`, or `prototype`/`grilling`) is never resolved by the agent — it gets an intake brief and `waiting-human`
- One Active Map; one Current Ticket focus
- Parent = membership; dependency = ordering
- Refer by name, not bare ids
- Tickets are Wayfinder decision units, not Goal Runtime Tasks
- Goal Runtime 是 user-trigger：绝不调用 `/goal` 命令或 goal-runtime 工具（save_goal_draft / commit_goal / activate_goal 等）。Graduate / Exit 时只能**建议用户自己执行** `/goal set`、`/goal run` 等合适能力（capability-aware，也可建议其它覆盖同类能力的本地技能）
- Workspace: `.pi/wayfinder/tickets/`

## Command routing for $@

Parse the user arguments (`$@`) as follows:

### no args / free text (smart entry)
1. Check taskmd availability
2. Inspect local Wayfinder state
3. Route:
   - missing taskmd → stop and ask install path (user install or explicit agent install authorization)
   - multiple Active Maps → stop and require cleanup
   - no workspace / no Active Map → enter Chart path (if free text present, treat it as chart topic seed; otherwise ask for topic)
   - Active Map + Current Ticket → continue Work on that Ticket
   - Active Map + no Current Ticket → Work from Frontier (user-named Ticket wins if present)

### `init`
- check taskmd
- create `.pi/wayfinder/` and `.pi/wayfinder/tickets/` if needed
- do **not** create a Map

### `chart <topic...>`
- if no topic after `chart`, clarify first; do not invent Destination
- short clarification gate
- then create/update Active Map and initial Tickets per skill

### `work [ticket-name-or-hint...]`
- advance exactly one Current Ticket
- if ticket hint provided, that choice wins over automatic Frontier selection
- **pre-execution gate**: read the Ticket's channel before resolving
  - HITL (`wayfinder:hitl` / `prototype` / `grilling`): do **not** auto-resolve — for `research`+HITL write intake brief + set `waiting-human` + stop; for `grilling`/`prototype` start the live exchange
  - AFK (`research` / `setup`): resolve with matching capability
- **single-Ticket directional**: downward exploration OK; sideways questions → new Ticket for a new session, never inline
- mature "ready to build, no decision left" Tickets → **graduate** (Resolution = handoff pointer, `completed`), do not implement here; **suggest the user** start the implementation path (`/goal run` / spawn / direct coding) — never invoke it yourself

### `status`
- report state only
- no mutations

### `ui`
- ensure workspace exists (or explain that init/chart is required)
- start taskmd Web UI for human inspection with:
  `interactive_shell({ command: "taskmd -d .pi/wayfinder/tickets web start --port 8080 --open", mode: "dispatch", background: true })`
- report URL (`http://localhost:8080`) and session id; user can `/attach` if needed
- agent keeps using CLI for mutations

### `help`
- print the command surface and one-paragraph when-to-use guidance
- do not start work unless user continues

## After routing

Execute the chosen path using the wayfinder skill methodology and taskmd convention.

User arguments: $@

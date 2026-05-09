---
name: planning-with-files
description: Use when a project uses `.pi/planning/` files to track task state across turns or sessions. Keeps `task_plan.md`, `findings.md`, and `progress.md` synchronized with implementation work.
---

# Planning With Files

This project uses planning files under `.pi/planning/` as working memory.

## Pi integration

This skill is self-contained: it ships its own templates and helper scripts.

The `planning-files-runtime` extension is the runtime bridge that calls those scripts from Pi commands and keeps tool-path redirection/UI state aligned.

Current extension-backed behavior:

- initializes `.pi/planning/` files via `/plan-new` and `/plan-init`
- exposes helper commands like `/plan-check`, `/plan-attest`, and `/plan-catchup`
- redirects `task_plan.md`, `findings.md`, and `progress.md` into `.pi/planning/`
- injects recent planning context before the agent starts
- restores planning context across resumed sessions
- surfaces lightweight planning status in the UI

## Managed files

- `.pi/planning/task_plan.md`
- `.pi/planning/findings.md`
- `.pi/planning/progress.md`

## Rules

- Treat `.pi/planning/task_plan.md` as the source of truth for current phase and next steps.
- Re-read the planning files before major decisions or after resuming work.
- Update `.pi/planning/findings.md` after important discoveries, constraints, or design decisions.
- Update `.pi/planning/progress.md` after meaningful implementation work, verification, or blockers.
- Prefer the `.pi/planning/` files over any root-level `task_plan.md`, `findings.md`, or `progress.md`.

## Suggested workflow

1. Run `/plan-new` if the project has not initialized planning files yet.
2. Read the three planning files at the start of work.
3. Reconcile the current user request with the active phase and pending steps.
4. Record discoveries before or during implementation if they affect approach.
5. Record progress after edits, tests, or verification.
6. Keep plan state consistent before handing off the task.

## When planning files are missing

- If the project clearly expects planning files but they are missing, initialize them with `/plan-new` or confirm with the user first.
- Do not invent stale state; create or confirm a fresh baseline first.

## Included assets

- `templates/task_plan.md`
- `templates/findings.md`
- `templates/progress.md`
- `scripts/init-session.sh`
- `scripts/check-complete.sh`
- `scripts/attest-plan.sh`
- `scripts/resolve-plan-dir.sh`
- `scripts/session-catchup.py`

## Scope notes

- This local Pi setup uses a single project planning directory at `.pi/planning/`.
- The skill remains usable on its own because the templates and helper scripts live with it.
- The extension is responsible for invoking those scripts under Pi commands so runtime behavior stays consistent with redirected `.pi/planning/` paths.

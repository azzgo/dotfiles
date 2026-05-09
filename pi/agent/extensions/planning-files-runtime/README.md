# planning-files-runtime

A local Pi extension that keeps planning files inside each project at `.pi/planning/` and makes them easier to use across sessions.

## What it does

- Adds `/plan-new` and `/plan-init` to create fresh planning files via the skill scripts
- Adds `/plan-status` to show current planning status
- Adds `/plan-check` to check completion status via the skill script
- Adds `/plan-attest` to attest or inspect the current plan via the skill script
- Adds `/plan-catchup` to summarize planning state via the skill script
- Adds `/plan-autocatchup` to show or toggle automatic catchup on session start
- Adds `/plan-continue` to ask Pi to resync from the planning files
- Redirects `task_plan.md`, `findings.md`, and `progress.md` to `.pi/planning/`
- Injects recent planning context into the agent before it starts
- Optionally queues an automatic catchup prompt on resumed sessions
- Shows a small planning status widget in the Pi UI

## Managed files

This extension expects and manages these files under the current project:

- `.pi/planning/task_plan.md`
- `.pi/planning/findings.md`
- `.pi/planning/progress.md`

## Dotfiles integration

This directory is version-controlled in `dotfiles` and linked into:

- `~/.pi/agent/extensions/planning-files-runtime`

via `just install-pi`.

## Entry file

- `index.ts`

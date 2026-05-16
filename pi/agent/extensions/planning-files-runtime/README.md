# planning-files-runtime

A single Pi extension that owns both:

- baseline planning files workflow under `.pi/planning/`
- an optional goal overlay that can drive a focused implementation run

## Public commands

- `/plan-new` — initialize or reset `.pi/planning/` and clear any current goal overlay
- `/plan-goal-set` — create or continue clarifying a goal overlay without resetting planning files
- `/plan-goal-impl` — start or resume implementing the committed goal using planning files as the execution tracker

## Managed files

Planning files:

- `.pi/planning/task_plan.md`
- `.pi/planning/findings.md`
- `.pi/planning/progress.md`

Goal overlay state:

- `.pi/planning/.goal-state.json`

## Runtime behavior

- Redirects `task_plan.md`, `findings.md`, and `progress.md` into `.pi/planning/`
- Injects planning context before the agent starts
- Keeps baseline planning usable even when no goal overlay exists
- Persists partial goal clarification so `/plan-goal-set` can continue from where it left off
- Keeps `/plan-goal-set` drafting read-only by blocking `write`/`edit` and unsafe mutating shell commands during goal clarification
- On the first `/plan-goal-impl` for a committed goal, archives the old planning workspace and initializes a fresh planning run from the goal
- On later `/plan-goal-impl` runs, resumes from existing planning files instead of resetting them again
- Uses planning files as the only durable implementation tracker during goal execution

## Dotfiles integration

This directory is version-controlled in `dotfiles` and linked into:

- `~/.pi/agent/extensions/planning-files-runtime`

via `just install-pi`.

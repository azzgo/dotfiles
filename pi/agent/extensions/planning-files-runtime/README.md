# planning-files-runtime

A single Pi extension that owns:

- baseline planning files workflow under `.pi/planning/`
- an optional goal overlay that drives focused implementation runs
- goal design blueprint (`goal-design.md`) with staged drafting (4 stages)

## Public commands

- `/plan-new` — reset `.pi/planning/` including goal-design.md + tasks/, clear goal overlay
- `/plan-goal-set` — 4-stage goal drafting (as-is → design → story → task), outputs to goal-design.md
- `/plan-goal-impl` — execute committed goal using Task Plan from goal-design.md as blueprint

## Managed files

Session tracking (per-run):

- `.pi/planning/task_plan.md`
- `.pi/planning/findings.md`
- `.pi/planning/progress.md`

Goal epic blueprint (cross-run):

- `.pi/planning/goal-design.md` — Design, Story Breakdown, Task Plan index
- `.pi/planning/tasks/task-NN.md` — individual Task cards with deps + TDD

Goal overlay state:

- `.pi/planning/.goal-state.json` — includes `draftingStage` field for 4-stage tracking

## Runtime behavior

- Redirects `task_plan.md`, `findings.md`, `progress.md`, `goal-design.md` into `.pi/planning/`
- Injects planning context + Task index before agent starts
- Drafting stages auto-advance; agent asks user only when key info missing
- Drafting: `write` blocked outside `.pi/planning/`; `edit` allowed inside; `bash` read-only
- `commit_plan_goal` validates `goal-design.md` exists and non-empty
- `goal-design.md` + `tasks/` persist across runs; only archived on `/plan-new`
- Execution follows Task hard/soft deps + TDD (red → green → refactor, 1 commit per Task)

## Dotfiles integration

Version-controlled in `dotfiles`, linked into `~/.pi/agent/extensions/planning-files-runtime` via `just install-pi`.

# goal-runtime

Goal Runtime — the execution-oriented Pi extension (replaces `planning-files-runtime`).

Multi-Goal, **taskmd-backed**: Goals / Stories / Tasks are taskmd records in a store
separate from Wayfinder's (`.pi/goals/`, tag family `goal` / `goal:story` / `goal:task`).
**Track** (`.pi/track/findings.md` + `progress.md`) is flat, non-taskmd working memory —
never on the taskmd board.

See `docs/adr/0001-goal-runtime-on-taskmd.md` (decision of record) and `CONTEXT.md`
(glossary).

## Prerequisites

- `taskmd` must be on PATH (same hard prerequisite as Wayfinder). No silent fallback tracker.

## Disk layout

```text
.pi/
├── goals/       # goal-runtime taskmd store: Goal/Story/Task records (+ .queue.json runtime state)
├── track/       # Track: findings.md + progress.md (flat, non-taskmd, not on board)
└── wayfinder/   # unchanged (Wayfinder's store)
```

## Public commands

- `/goal` — smart entry: inspect state and route
- `/goal set <topic>` — one focused drafting session (4 stages → taskmd records)
- `/goal run [<id>...]` — activate (exclusive) + execute; serial queue with multiple ids
- `/goal list` — all goals, retained incl. completed/abandoned
- `/goal status [<id>]` — goal detail
- `/goal review [<id>]` — active goal → `in-review` + dispatch independent verifier
- `/goal abandon <id>` — abandon (terminal, stays on the board)
- `/goal ui` — open the taskmd board for the goals store
- `/track new` — reset/init the scratchpad (independent of Goals)
- `/track update` — reconcile Track with current state
- `/track status` — report Track state (no mutation)

## Model

| Record | Tag | Parent | Body |
|---|---|---|---|
| Goal | `goal` | — | contract (Objective / Success Criteria / Constraints / Out of Scope / Blocker Rule) + Design (as-is, recommended approach, rejected alternatives) |
| Story | `goal:story` | Goal | vertical slice (what / layers / acceptance criteria) |
| Task | `goal:task` | Story | 1-commit spec (hard/soft deps, TDD marker); `depends-on` between Tasks |

**Lifecycle**: taskmd `phase` is the source of truth; `status` is a derived projection
(`drafting|ready → pending`, `active|paused → in-progress`, `in-review → in-review`,
`complete → completed`, `abandoned → cancelled`).

Flow: `drafting →(commit_goal)→ ready →(run)→ active →(request_goal_review)→ in-review
→(verify_goal_result pass)→ complete` (sealed) or `→ active` (fail/rework).
`active ↔ paused`; any → `abandoned`.

Invariants: one agent one focus; one `active` Goal exclusive (auto-pause);
Track never on the board; Goal → Track one-way; lifecycle truth in `phase`.

## Execution model

- `/goal run` activates the goal (auto-pauses any other active goal), auto-resets Track,
  and sends the orchestrator prompt with the task dependency graph + tiers injected.
- The orchestrator is the **sole Track writer**. Independent Tasks (same tier, no hard dep)
  fan out via `impl-with-spawn` leaf agents (background dispatch, `mode: "dispatch"`,
  `background: true`) that must be **overlay-silent** — dispatch with the raw command form
  and the child marker env: `PI_GOAL_RUNTIME_CHILD=1 pi -p "..."`. Child agents never write
  Track and never touch goal state.
- Completion is gated by an **independent read-only verifier sub-agent** (also dispatched
  overlay-silent with `PI_GOAL_RUNTIME_CHILD=1`), which reads the Goal/Stories/Tasks + Track,
  checks acceptance criteria, and resolves `in-review` via `verify_goal_result`.
- `verify_goal_result` is **token-governed**: `request_goal_review` / `/goal review` mints a
  one-time `VERIFY_TOKEN` embedded in the verify brief (`.pi/track/verify-brief-<id>.md`);
  the verifier must echo it back, so only a caller that read the brief (the dispatched
  verifier) can resolve `in-review` — the orchestrator cannot self-verify.
- If goal records are hand-edited so that more than one goal is `active`, `/goal status`,
  smart entry, and the widget surface a warning (one-active is exclusive; pick one).
- The continuation mechanism keeps the orchestrator driving while `active` and advances the
  serial queue when the current goal reaches a terminal phase.

## Tools

- `save_goal_draft` — persist draft metadata (stage, open questions, contract sections) into the drafting Goal record
- `commit_goal` — drafting → ready (validates contract + ≥1 Story + ≥1 Task)
- `pause_goal` — active → paused (real blocker)
- `request_goal_review` — active → in-review; instructs dispatching the verifier
- `verify_goal_result` — verifier-only; in-review → complete (pass) or active (fail/rework)

## Notes

- Legacy `.pi/planning/` from `planning-files-runtime` is not migrated automatically;
  archive it manually if you want it gone. New state lives in `.pi/goals/` + `.pi/track/`.
- `.pi/goals/.queue.json` holds transient serial-queue state only — goals themselves are
  always queried from taskmd.
- Drafting guards: while a Goal is drafting, writes are restricted to `.pi/goals/` and bash
  is restricted to read-only recon + taskmd goal-store commands.

## Dotfiles integration

Version-controlled in `dotfiles`, linked into `~/.pi/agent/extensions/goal-runtime` via
`just install-pi`. Registered in `pi/agent/settings.json` as
`+extensions/goal-runtime/index.ts`.

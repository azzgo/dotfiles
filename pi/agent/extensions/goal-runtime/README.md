# goal-runtime

Goal Runtime — the execution-oriented Pi extension (replaces `planning-files-runtime`).

Multi-Goal, **taskmd-backed**: Goals / Stories / Tasks are taskmd records in a store
separate from Wayfinder's (`.pi/goals/`, tag family `goal` / `goal:story` / `goal:task`).
**Track** (`.pi/track/findings.md` + `progress.md`) is flat, non-taskmd working memory —
never on the taskmd board.

See `docs/adr/0001-goal-runtime-on-taskmd.md` (taskmd decision of record),
`docs/adr/0005-goal-runtime-command-driven-lifecycle.md` (command-driven lifecycle + Track auto-init)
and `CONTEXT.md` (glossary).

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
- `/goal set <topic>` — one focused drafting session (4 stages → taskmd records; the model edits goal record files directly and hands off with `/goal commit`)
- `/goal commit [<id>]` — validate contract + ≥1 Story + ≥1 Task, drafting → ready (default: the drafting goal)
- `/goal run [nl]` — propose goal(s) from natural language; confirm by running `/goal activate` (empty = model recommends)
- `/goal activate <id> [ids]` — activate a goal (exclusive active; extra ids form the serial queue)
- `/goal list` — all goals, retained incl. completed/abandoned
- `/goal status [<id>]` — goal detail
- `/goal review [<id>|nl]` — with an exact goal id: send straight to in-review and prompt the verifier dispatch; with natural language: propose which goal (matches titles AND bare ids; routes by phase, incl. reopening a goal that reached complete without review)
- `/goal pause <reason>` — pause the active goal (real blocker)
- `/goal abandon <id>` — abandon (terminal, stays on the board)
- `/goal ui` — open the taskmd board for the goals store
- `/track new` — reset/init the scratchpad (independent of Goals; also runs **automatically** at the first conversation of a session when the track files are missing)
- `/track update` — reconcile Track with current state (manual)
- `/track context` — inject the current Track (goal state + findings/progress tails) as a user message (manual; nothing is auto-injected)
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

Flow: `drafting →(/goal commit)→ ready →(/goal activate)→ active →(/goal review)→ in-review
→(verifier pass)→ complete` (sealed) or `→ active` (fail/rework).
`active ↔ paused` (`/goal pause` / interrupt); any → `abandoned`.

Reopen: `complete →(/goal review)→ in-review` — recovers a goal that was marked
complete without a verifier pass (bypass recovery); mints a fresh VERIFY_TOKEN.

Invariants: one agent one focus; one `active` Goal exclusive (auto-pause);
Track never on the board; Goal → Track one-way; lifecycle truth in `phase`.

## Execution model

**Command-driven lifecycle, manual Track**: goal lifecycle stays strictly user-triggered —
the orchestrating session registers **no goal tools at all** (the model cannot see or call
them), every goal flow starts from an explicit `/goal` command typed by the user, and every
lifecycle transition runs inside a command handler (deterministic validation + Track side
effects). Agents (including Wayfinder) may only **suggest the user run** a `/goal ...`
command. **Track initializes itself once** (auto `/track new` when the files are missing at
the first conversation of a session) and is otherwise fully manual: `/track context` injects
working memory into the conversation on demand, `/track update` reconciles it. Nothing is
auto-injected and there is no periodic auto-run.
While a goal run is active, wake-up is **event-driven**: after a turn that made progress and launched
no background sub-agents the orchestrator is immediately re-triggered to keep driving;
while leaf sub-agents are in flight the runtime stays silent — their **sub-dispatch
completion notifications** (`triggerTurn`) are the wake-ups (no sleep/poll). This
continues until the goal reaches a terminal phase.

- `/goal activate <id>` activates the goal (auto-pauses any other active goal), auto-resets
  Track, and sends the orchestrator prompt with the task dependency graph + tiers injected.
- When the orchestrator finishes (or hits a blocker), it stops and tells the user to run
  `/goal review <id>` (or `/goal pause <reason>`) — the transition itself is the command's job.
- The orchestrator is the **sole Track writer**. Independent Tasks (same tier, no hard dep)
  fan out via `impl-with-spawn` leaf agents — `dispatch` background dispatch (`background: true`)
  with the child marker set via the dispatch env parameter:
  `dispatch({ agent: "pi", prompt: "<self-contained task prompt>", env: { PI_GOAL_RUNTIME_CHILD: "1" }, background: true, reason: "goal-<id>-task-<taskId>" })`.
  Child agents must be **overlay-silent**, never write Track and never touch goal state.
- Completion is gated by an **independent read-only verifier sub-agent** (also dispatched
  overlay-silent with `PI_GOAL_RUNTIME_CHILD=1`), which reads the Goal/Stories/Tasks + Track,
  checks acceptance criteria, and resolves `in-review` via `verify_goal_result` — the only
  goal-runtime tool, registered exclusively in the verifier child process, so the
  orchestrator never sees it in its tool list.
- `verify_goal_result` is **token-governed**: every entry into `in-review` (`/goal review <id>`,
  incl. the complete → in-review reopen path) mints a **fresh** one-time
  `VERIFY_TOKEN` embedded in the verify brief (`.pi/track/verify-brief-<id>.md`); the verifier
  must echo it back and the token is **consumed on first use** — a verdict (pass or fail)
  rewrites the brief line to `VERIFY_TOKEN(consumed)` (file kept for audit), so each review
  entry allows exactly one verdict and rework must re-enter review to get a new token. Only a
  caller that read the brief (the dispatched verifier) can resolve `in-review` — the
  orchestrator cannot self-verify.
- If goal records are hand-edited so that more than one goal is `active`, `/goal status`,
  smart entry, and the widget surface a warning (one-active is exclusive; pick one).
- Wake-up is **event-driven** while `active`: a turn that made progress and launched no
  background sub-agents is immediately continued by the runtime; a turn that launched
  background sub-agents is NOT — each sub-dispatch completion auto-notifies (`triggerTurn`)
  and wakes the orchestrator with status + output tail (never sleep+query poll). The serial
  queue advances when the current goal reaches a terminal phase.

## Tools

The orchestrating session registers **no goal tools** — lifecycle is command-driven
(`set` / `commit` / `run` / `activate` / `pause` / `review` / `abandon`).

- `verify_goal_result` — **verifier-child-only** (registered only when
  `PI_GOAL_RUNTIME_CHILD=1`, so the orchestrator never sees it); in-review → complete
  (pass) or active (fail/rework), gated by the one-time VERIFY_TOKEN from the verify brief

## Notes

- Legacy `.pi/planning/` from `planning-files-runtime` is not migrated automatically;
  archive it manually if you want it gone. New state lives in `.pi/goals/` + `.pi/track/`.
- `.pi/goals/.queue.json` holds transient serial-queue state only — goals themselves are
  always queried from taskmd.
- Drafting guards: while a Goal is drafting, writes are restricted to `.pi/goals/` (goal
  records) and `.pi/track/` (working memory), and bash is restricted to read-only recon +
  taskmd goal-store commands.
- Lifecycle guards (always on): bash mutations of a **Goal** record's phase/status
  (`--phase` / `--status` / `--done`, incl. the `--task-id` form) are blocked — they must
  go through `/goal` commands. Story/Task status updates via the CLI stay allowed.
  While a goal is active/in-review (and none is drafting), write/edit into `.pi/goals/`
  is blocked entirely — no hand-edited frontmatter phase flips.

## Dotfiles integration

Version-controlled in `dotfiles`, linked into `~/.pi/agent/extensions/goal-runtime` via
`just install-pi`. Registered in `pi/agent/settings.json` as
`+extensions/goal-runtime/index.ts`.

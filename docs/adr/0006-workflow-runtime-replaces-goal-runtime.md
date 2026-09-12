# Workflow runtime replaces goal-runtime; Track splits out; taskmd exits the execution layer

Status: accepted

## Context

goal-runtime (ADR 0001, ADR 0005) managed execution as Goal → Story → Task records on
taskmd, with an exclusive one-active Goal, a serial queue, a command-driven lifecycle
(`set / commit / run / activate / pause / review / abandon`), and an independent verifier
gated by one-time VERIFY_TOKENs. Practice showed three things:

- Real work follows a small set of repeating patterns (feature: intake → build → release;
  bug: locate → reproduce → fix → patch; perf: tracing access → evidence → locate →
  reproduce → fix → release). The machinery around the pattern — exclusive activation,
  drafting validation, token-gated verification — cost more than it returned at personal
  scale.
- The workflow skeleton should only orchestrate: book state, recommend flow, notify.
  Loops, parallel dispatch, and quality judgment belong inside nodes, carried by skills
  and sub-agents (the Node is an entry/exit boundary, nothing more).
- Verification at personal scale is better served by dispatched review skills
  (`code-review`), explicit verify nodes in patterns, and a human at every node boundary
  than by a cryptographic gate designed for unattended long runs.

## Decision

- **goal-runtime is retired.** Code deleted from the repo; per-project `.pi/goals/` remain
  as read-only archives; no migration tooling (no live Goals pending at retirement).
- **Track is extracted** into the standalone `track` extension, behavior-preserving
  (commands `/track new|update|context|status`, auto-init on first conversation,
  `/track update` as a stop-point), with the two goal couplings cut: activation-time
  auto-reset is gone (activation no longer exists) and verify-briefs die with
  goal-runtime. Track and the workflow runtime are strangers — Runs keep structured
  progress logs written by the extension; Track stays the model's freeform manual memory.
- **A new `workflow-runtime` extension** provides the orchestration-only skeleton:
  - Session-driven, no engine: a Run advances only while a Driving Session is attached;
    it is dormant otherwise. No server, no queue, no database.
  - Storage: flat files under `.pi/workflows/` (Definitions and Runs), gitignored,
    machine-local.
  - A linear Spine of Nodes with explicit Rerouting (skip / insert / replan — AI-proposed,
    human-approved). No graph edges; node-count guidance (≈5) lives in patterns, unenforced.
  - Node types: **Auto Node** (executed by a fresh sub-agent session via sub-dispatch;
    event-driven settle flips state deterministically; auto→auto cascades without asking)
    and **Human Node** (user performs the work and completes it with a command). The
    next-node question surfaces at the start of whichever fresh session the user opens.
  - Global zero-exclusivity: many non-terminal Runs coexist; a per-session Focus pointer
    disambiguates bare commands; `/wf list` plus a Run picker (manual + cold-start,
    dismissible, injects nothing) provide visibility.
  - Pattern library at `pi/agent/patterns/` (peer of `skills/` and `prompts/`; symlinked by
    `install-pi`), Markdown + YAML frontmatter; shipped with feature / bugfix / perf.
    Authoring loop: `/wf new` (AI drafts using actually-available skills) → human review →
    `/wf start`.
- **taskmd exits the execution layer** (amends ADR 0001): taskmd remains Wayfinder's
  planning-layer backend only.
- This ADR **carries over ADR 0005's lessons** and supersedes its lifecycle specifics:
  the extension flips Run/Node state deterministically on events — the model never
  mutates lifecycle state directly; context enters a conversation only by explicit ask or
  a dismissible cold-start question, never by injection.

## Considered Options

- **taskmd store for Runs** (extend ADR 0001): free web board and validated statuses, but
  run/park semantics do not fit its status set, Definitions need human-reviewable files
  anyway, and it re-imports the weight being retired. Rejected.
- **Persistent engine** (SQLite + resident server, à la osolmaz/pi-workflows): durable
  unattended execution is not a requirement — every node boundary is human-paced.
  Rejected.
- **Graph of nodes + edges** (à la AgwaB/pi-workflow): branch conditions are runtime
  knowledge at this scale; pre-wired edges degenerate into DSL-taxed rerouting. Rejected
  in favor of a linear spine with replan.
- **Keep verifier tokens on Auto Nodes**: mismatched to human-paced boundaries;
  verification reassigned to code-review dispatches, pattern verify nodes, and human
  pacing. Consciously rejected.

## Consequences

- The one-active invariant, serial queue, auto-pause, and activation-time Track reset are
  all dead.
- CONTEXT.md retires the Goal / Goal Runtime / Story / Task vocabulary; Project, Track,
  and Taskmd Backend entries are rewritten; Wayfinder entries de-staled (workspace moved
  to `~/.cache/wayfinder/`, skill moved to repo-root `skills/`).
- Wayfinder's post-Exit-Condition implementation handoff repoints from `/goal` commands to
  the workflow runtime (`/wf new` or a pattern).
- `just install-pi` gains the `patterns` symlink and the `track` extension link, and drops
  the goal-runtime link; `pi/agent/settings.json` registration updated accordingly.
- Cross-session continuity relies on disk state plus session-start surfaces; "the plugin
  opens a new interactive session by itself" remains impossible without a terminal
  multiplexer (herdr/tmux) — out of scope by decision.

## Amendment (2026-09-12, from a week of session evidence)

Two original decisions are revised after live use:

- **No cold-start picker.** The dismissible cold-start Run question is removed —
  every new session had to answer it even in free ("vibe") mode, and the Esc
  path kept being misread as "am I in the workflow?". Entering a workflow is
  now always an explicit user action (`/wf`, `/wf switch`, `/wf focus`,
  `/wf next <run-id>`, `/wf start`); the widget remains the standing visibility.
- **The state digest is an exception to "never by injection".** Sessions resumed
  after context exhaustion cost dozens of tool calls of manual archaeology
  (`.pi/track`, wayfinder tickets, run.json) before real work restarted. When a
  session's Focus lands on a non-terminal Run, the runtime now silently injects
  a hard-capped plain dump of run state (`triggerTurn: false`, no turn, no
  analysis, no action requested). Context still enters only by explicit user
  action — focusing a run *is* that action.
- **Human override on Auto Nodes.** Auto Nodes relied entirely on the settle
  notification; a lost settle deadlocked the run and `/wf done` refused to
  intervene. The user outranks the runtime: `/wf done` now completes the active
  node regardless of type, logged as a human override; a late settle becomes a
  silent noop.

# Goal Runtime on taskmd; Track stays flat; retire the "Planning" name

Status: accepted

The `planning-files-runtime` extension was single-Goal, zero-dependency, pure file-IO, with no retention or traceability — completed Goals were dumped into opaque timestamped archive folders and were not queryable. We are rebuilding it as **`goal-runtime`**: a multi-Goal system that stores **Goals, Stories, and Tasks as taskmd records** (in a store separate from Wayfinder's, tag family `goal` / `goal:story` / `goal:task`), while **Track** (the `findings.md` + `progress.md` working-memory scratchpad) stays as flat, non-taskmd files used only for cross-session / context-tight continuity. The old "Planning" name is retired everywhere because the Task layer was extracted into the Goal mechanism and the remnant no longer resembles "planning with files".

We chose taskmd because the user runs both Wayfinder and this system, so two parallel tracker backends felt more fragmented than one shared backend with isolated stores. taskmd hands us the registry, web board, validated status machine, dependency graph, and `verify` hook for free — every one of which the design needs (multi-Goal listing, one-active enforcement, parallel-tier computation, the `in-review` verification gate).

## Considered Options

- **Custom file registry** (`goals.json` + per-Goal `goal.json` / `goal-design.md` dirs), zero dependency. Rejected: it rebuilds what taskmd already provides and leaves the user with two side-by-side tracker systems (the very fragmentation we want to avoid).
- **taskmd as shared backend** (chosen). Cost: taskmd becomes a hard prerequisite for goal-runtime (previously zero-dep) and the runtime becomes taskmd-driven instead of pure file-IO. Worth it for unification + the free capabilities.

## Consequences

- **taskmd is now a hard prerequisite for goal-runtime**, not only Wayfinder (`CONTEXT.md` updated).
- **Runtime nature changes**: fs-only → taskmd-driven (shells to `taskmd` CLI or its MCP).
- **Cross-store references need qualification**: taskmd ids are sequential per store, so Wayfinder Ticket → Goal handoffs use store-qualified ids (`wayfinder:003` → `goal:007`).
- **Goal → Track is a one-way dependency**: `/goal run` auto-resets Track for hygiene; `/track new` / `/track update` are fully independent and know nothing of Goals (acyclic = still "orthogonal"). Track never appears on the taskmd board.
- **Closed taskmd status set**: the Goal lifecycle (`drafting | ready | active | paused | in-review | complete | abandoned`) lives in the freeform `phase` field as source of truth; `status` is a derived projection onto taskmd's canonical set for board / `next` / `validate` compatibility.
- **One agent, one focus, everywhere**: single-topic `/goal set`; batch Goal creation is an orchestrator spawning N focused sub-agents, never one agent multi-drafting (mirrors Wayfinder's Single-Ticket Session). Parallel execution = independent Tasks within one active Goal, via `impl-with-spawn` leaf agents that are overlay-silent and never write Track.
- **Naming migration required** across `pi/agent/skills/wayfinder/{README,SKILL,TASKMD-CONVENTION}.md`, `pi/agent/prompts/wayfinder.md`, and `pi/README.md`: Planning Files Runtime → Goal Runtime; Planning Goal → Goal; Planning Task → Task; `/plan-goal-set` → `/goal set`; `/plan-goal-impl` → `/goal run`; `planning-files-runtime` → `goal-runtime`.

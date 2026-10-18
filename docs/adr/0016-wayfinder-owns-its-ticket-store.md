# Wayfinder owns its Ticket store; taskmd leaves the planning layer

Status: accepted — supersedes the "taskmd remains Wayfinder's planning-layer backend" clause of ADR 0006; amends the shared-backend reasoning of ADR 0001

## Context

ADR 0001 chose taskmd as a shared backend for two systems on the grounds that one backend beats two side-by-side trackers. ADR 0006 retired goal-runtime, leaving Wayfinder as taskmd's only remaining consumer in this repo, and kept taskmd for the planning layer only.

The shared backend was never actually shared. An audit of the two live Wayfinder workspaces on 2026-10-18 found four defects, three of them silent:

1. **`status: waiting-human` is not a valid taskmd status.** It is the status carrying Wayfinder's HITL mechanism — invariant #9, the research-HITL flow, the Frontier exclusion, the exit condition. taskmd's status set is hard-coded in `sdk/go/model/task.go` as `pending · in-progress · completed · in-review · blocked · cancelled`. `taskmd set --status waiting-human` errors; writing the frontmatter by hand makes `taskmd validate` report an error.
2. **`taskmd next` answers a different question than Frontier.** It scores actionable tasks by priority, phase, critical-path position, effort and git-worktree claim. Wayfinder's Frontier is a boolean: membership, `pending`, dependencies satisfied, not the Current Ticket, not `waiting-human`. The convention doc had already conceded the mismatch ("adapt to installed taskmd version", "list + filter in agent logic").
3. **An unknown frontmatter key silently erased the dependency graph.** One workspace's Tickets carry `depends_on: [...]`, where taskmd's schema key is `dependencies`. taskmd ignores unknown keys and preserves them verbatim, so all five Tickets there had **no dependency edges at all** — while `validate` reported nothing about them. Frontier silently widened to "every pending Ticket".
4. **The Active Map did not exist.** `012-wayfinder-space-entry-add-scene.md`, the live workspace's Active Map, has no frontmatter. taskmd's forgiving filename fallback derived an id and a title from the filename and accepted the file with an empty status, while ten Tickets pointed their parent at it. As far as taskmd was concerned, that workspace had no Active Map.

Defects 1, 3 and 4 are not bugs a general-purpose tracker could fix. They follow from what taskmd *is*: statuses are fixed in code and not configurable, while membership and kind are carried as free-form `wayfinder:*` tags in a store shared with records Wayfinder does not own.

Wayfinder also carried a scoping hazard, recorded in the convention doc as the 2026-09-09 incident: taskmd resolves its task directory from `~/.taskmd.yaml` when `-d` is omitted, so a bare `taskmd set 002` mutated a different workspace's Ticket.

## Decision

- **The Wayfinder Store belongs to Wayfinder outright.** It is Wayfinder's own storage, not one store inside a general-purpose tracker, and it is written only by Wayfinder's own tooling.
- **`ticket`, a Wayfinder-local CLI, owns every write.** It lives with the skill at `skills/wayfinder/cli/`, written in TypeScript with no pi coupling, so Wayfinder stays a pi-independent skill. It is invoked by path rather than installed on PATH.
- **The schema is Wayfinder's and it is strict.** `type` and `channel` are first-class fields; the `wayfinder:*` tag namespace and `priority` are gone. Six statuses, including `waiting-human`.
- **Unknown metadata is an error, not a warning.** `ticket check` rejects any key the tooling did not write, and parsing rejects on read as well as on validate — so a hand-edited file fails at the first operation instead of quietly losing a dependency edge.
- **No compatibility layer.** No aliases, no migration tool. The two existing workspaces (27 Tickets) are discarded rather than migrated.
- **Viewing is read-only and produced by tooling, never by the agent.** `ticket map` renders a dependency-and-status view into `$TMPDIR`. No server, no port, no process lifecycle. Prose is edited in the user's own editor through `ticket open`; metadata never is.
- **Ticket metadata is machine-owned.** A Ticket exists to be advanced through the flow, not maintained by hand. The editor is a prose surface, not a metadata surface.

## Considered Options

- **Keep taskmd and work around it** — agent edits frontmatter directly instead of using `set`, and stop calling `validate`. This costs a few lines of convention doc and fixes defect 1. It leaves defects 2, 3 and 4 in place, because they come from what taskmd is rather than from how it is driven. The convention doc had already drifted into describing behaviour the binary does not have (`set --depends-on` is undocumented; `next --filter` cannot express Frontier) — not something a working dependency should require.
- **Fork taskmd's Go SDK** (`sdk/go`, MIT, one dependency, ~4,200 LOC of genuinely hard code: id allocation, surgical frontmatter I/O, validator with cycle reconstruction). Rejected: it cannot fix defect 1 either, since the status enum lives in the SDK; it carries `next`'s 875-line scorer plus 15 of 19 SDK packages Wayfinder never used; and a fork forfeits upstream fixes — 0.6.1 fixed a bug that corrupted Prettier-formatted frontmatter. The language also conflicts: this repo's extension ecosystem is TypeScript.
- **Depend on `sdk/go` as a library** and write ~200 lines of commands on top. Keeps upstream bugfixes without a fork. Rejected for the same reason as the fork — it still cannot express `waiting-human` — and it adds a Go toolchain for no gain.
- **Keep taskmd as the store and build Wayfinder semantics on top.** Rejected by the ownership rule: a store with a single consumer should not carry a general-purpose tracker's vocabulary.
- **Drop the CLI entirely** and let the agent edit markdown by hand. Rejected: id allocation, status-machine enforcement and cycle detection are precisely the things an LLM should not be trusted with by convention — `waiting-human` is what convention-based discipline costs.

## Consequences

- **taskmd is no longer a Wayfinder prerequisite.** The prerequisite gate, the hard scoping rule (`-d` on every call) and the "no silent tracker fallback" invariant are all rewritten: they now guard against a second store appearing, not against taskmd disappearing.
- **taskmd stays installed and stays in use elsewhere.** An unrelated project in this workspace keeps 16 taskmd Tickets that use exactly the general-purpose features Wayfinder does not want — priority, effort, free-form tags, an external tracker id. That project is the standing evidence that the general tracker is not the problem; Wayfinder was simply never its user.
- **The 27 existing Tickets are lost**: 24 completed decisions, 2 `waiting-human`, 1 Map with no frontmatter. This retires Wayfinder's promise that you can return after days and pick up where it left off — for past work only.
- **The human-override surface is gone.** The taskmd web UI was the documented place for occasional hand edits. `ticket map` views and does not edit. Prose edits move to the user's editor; metadata edits are refused by design.
- **CONTEXT.md**: `Taskmd Backend`, `Wayfinder Tag` and `Wayfinder Web UI` are removed; `Wayfinder Store`, `Ticket Type`, `Ticket Channel`, `Ticket Machine Ownership` and `Map Render` are added; `Ticket`, `Map`, `Agent-Driven Operation`, `Wayfinder Ticket Directory`, `Wayfinder Artifact Layout` and `Map Title Convention` are rewritten.
- `skills/wayfinder/TASKMD-CONVENTION.md` becomes `CONVENTION.md`, rewritten around the `ticket` schema.

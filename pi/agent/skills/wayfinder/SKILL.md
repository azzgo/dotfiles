---
name: wayfinder
description: Plan foggy, multi-session work as a local decision map of Tickets on taskmd, then resolve one Ticket at a time until the route to the destination is clear. Personal Wayfinder variant — no team claim flow, taskmd backend only, separate from Planning Files Runtime.
---

# Personal Wayfinder

A loose idea has arrived — too big for one agent session, and wrapped in fog. Wayfinding finds the **route**, not charges at the destination.

This skill charts a **shared Map** in the repository's local **taskmd** workspace, then works **decision Tickets** one at a time until the route is clear. Tickets resolve **decisions / investigations / prototypes / setup**, not implementation slices.

This is a **Personal Wayfinder**:

- keeps the original decision-oriented method
- removes team collaboration ceremony
- uses **taskmd as an explicit backend** (not built-in, not swapped silently)
- stays **separate from Planning Files Runtime** (`.pi/planning/`)
- recommends only capabilities available in the current agent/repo environment

## Plan, don't do

Wayfinder is **planning** by default. Each Ticket resolves a decision. The Map is done when the way is clear — nothing left to decide before someone goes and builds.

Allowed:

- research
- grilling
- throwaway prototypes
- setup that unblocks a later decision
- Map / Ticket maintenance

Not allowed by default:

- production implementation of the destination
- turning Tickets into a build backlog
- silently expanding into Planning Files Runtime execution

When remaining work is mostly "how to implement", exit Wayfinder and hand off to implementation planning (`/plan-goal-set`, `/plan-goal-impl`, or ordinary coding).

## Core objects

| Term | Meaning |
|---|---|
| **Map** | Canonical overview for one destination |
| **Ticket** | One decision / investigation / prototype / setup unit |
| **Frontier** | Unblocked pending Tickets under the Active Map |
| **Current Ticket** | The single Ticket this session is advancing |
| **Wayfinder Workspace** | Per-repo local storage at `.pi/wayfinder/` |
| **Planning Task** | Implementation work under `.pi/planning/` — different system |

Human-facing prose always says **Ticket**, never "task", except when quoting literal taskmd CLI objects/commands.

## Refer by name

Every Map and Ticket has a **name** (title). In everything the human reads — narration, Map decisions — refer by **name**, not bare id. IDs may ride inside a named link, but never stand alone as the reference.

## Prerequisites

Before any workspace mutation:

1. Check that `taskmd` is available (`command -v taskmd` or equivalent).
2. If missing:
   - **stop**
   - explain that taskmd is an explicit prerequisite
   - offer options:
     - user installs it
     - user explicitly authorizes the agent to install it
   - do **not** invent a fallback tracker
3. Only continue after taskmd is available.

Details of CLI flags, tags, filters, and templates live in [TASKMD-CONVENTION.md](TASKMD-CONVENTION.md).

## Workspace

- Path: `.pi/wayfinder/`
- taskmd ticket dir: `.pi/wayfinder/tickets/`
- Per-repository isolation
- Local only; already covered by `.pi/` gitignore in this dotfiles repo
- Lazy init: create only on explicit Wayfinder start (`init` / first `chart`), never from mere discussion

One **Active Map** per repository at a time.

## Map

The Map is a special taskmd record tagged `wayfinder:map`.

- Title: `Wayfinder: <Destination>`
- Status while active: `in-progress`
- Body uses a **fixed template** (sections must exist even if empty):

```markdown
## Destination

<what reaching the end of this map looks like>

## Notes

<domain notes; skills every session should consult; standing preferences>

## Decisions So Far

<!-- index only: one-line gist + name/link to closed Ticket -->

## Not Yet Specified

<!-- formal fog: in-scope unknowns not sharp enough to ticket yet -->

## Out of Scope

<!-- formal exclusions beyond this Destination; never graduates into this Map -->
```

The Map is an **index**, not a dump of every Ticket body. Open Tickets are discovered by query, not listed in the Map.

## Tickets

Each Ticket is a taskmd record under the Active Map.

- Parent points to the Map (**membership only**)
- Dependency edges exist **only between Tickets** (**ordering / blocking**)
- Type tag is one of:
  - `wayfinder:research`
  - `wayfinder:prototype`
  - `wayfinder:grilling`
  - `wayfinder:setup`
- Title is human-readable and question-focused (**no type prefixes**)
- Body uses a **fixed light template**:

```markdown
## Question

<the decision or investigation this ticket resolves>

## Why Now

<why this is on or near the frontier>

## Notes

<investigation process, observations, drafts>

## Resolution

<final answer when done; empty while open>

## Follow-ups

<new tickets / fog / out-of-scope candidates surfaced by resolution>
```

### Ticket types and local capabilities

| Type | Intent | Default local capability |
|---|---|---|
| `research` | Gather facts needed for a decision | `/explore-codebase` for in-repo research |
| `prototype` | Cheap concrete artifact to react to | `prototype` skill |
| `grilling` | Live decision interview | `grill-with-docs` (fallback `/grill-me`) |
| `setup` | Prep work that unblocks a later decision | no dedicated skill; checklist / shell / manual prep |

Do **not** hard-code foreign skills. When handing off, recommend only capabilities available in the current agent/repo environment (**Capability-Aware Handoff**).

### Status semantics

| Status | Use |
|---|---|
| `pending` | Not started; may still wait on dependencies |
| `in-progress` | Current Ticket (or Active Map) |
| `completed` | Answered, including negative conclusions |
| `cancelled` | Lost relevance before resolution / mis-scoped |
| `blocked` | Real exceptional blocker only (permissions, broken env, missing external input) |

Ordinary unmet dependencies stay `pending`. Do **not** mark every dependent Ticket `blocked`.

## Frontier

The Frontier is:

- under the Active Map
- not the Map itself
- `status=pending`
- all Ticket dependencies satisfied
- not already the Current Ticket

Selection rules:

1. If the user names a Ticket → user choice wins
2. Else agent chooses from Frontier
3. If a Current Ticket already exists (`in-progress`) → continue it; do not re-pick casually

## Fog of war

The Map is deliberately incomplete.

- **Ticket when** the question is already sharp (even if blocked)
- **Not Yet Specified when** you can sense the area but cannot yet phrase a sharp Ticket
- **Out of Scope when** the idea is worthwhile but beyond this Destination

Fog is formal. Out of Scope is formal. Neither is a junk drawer.

## Invariants

1. **Plan, don't do**
2. **Refer by name**
3. **Single-Ticket Session** — advance exactly one Current Ticket (small research bursts allowed only if they feed that same Ticket)
4. **Decision Double-Write** — write Resolution on the Ticket **and** append a one-line gist to Map `Decisions So Far`
5. **One Active Map**
6. **Parent = membership; Dependency = ordering**
7. **No silent tracker fallback**
8. **No silent destination invention**

Parallel **read-only** sub-agents are allowed for research if all results merge back into the same Current Ticket / Map.

## Modes

### Chart the Map

Use when there is no usable Active Map, or the destination has shifted enough to require a new Map.

1. Require an explicit topic / destination input.
2. Run a **short clarification gate** (grilling) to lock Destination + immediate boundary.
   - If topic is already sharp, keep this short.
   - If no clear topic, clarify first; do **not** invent a destination and chart it.
3. If clarification shows the journey is already small and clear, stop and ask whether a Map is needed at all.
4. Initialize workspace if needed.
5. Create the Map with fixed template.
6. Create the Tickets that are already sharp.
7. Wire Ticket dependencies in a second pass (need ids first).
8. Leave the rest in `Not Yet Specified` / `Out of Scope`.
9. Optionally fire parallel research sub-agents for fresh `research` Tickets.
10. Stop. Charting does not resolve non-research Tickets in the same pass unless the user explicitly continues into Work mode.

### Work Through the Map

Use when an Active Map already exists.

1. Load the Map (low-res overview, not every Ticket body).
2. Choose Ticket:
   - user-named Ticket if provided
   - else Current Ticket if already `in-progress`
   - else first/best Frontier Ticket
3. Mark it Current (`status=in-progress`) before real work.
4. Resolve it with the matching local capability.
5. Write:
   - full answer into Ticket `Resolution`
   - one-line gist into Map `Decisions So Far`
6. Mark Ticket `completed` (or `cancelled` only if abandoned before answer).
7. Graduate fog into new Tickets if now sharp; clear graduated fog from `Not Yet Specified`.
8. Rule mis-scoped work into `Out of Scope` and cancel those Tickets.
9. Update / create dependency edges as needed.
10. Stop after that one Ticket unless the user explicitly continues.

## Destination Shift

If the Destination changes materially:

1. close / complete the old Active Map
2. chart a **new** Map

Do not endlessly mutate one Map into a different journey.

## Exit condition

Exit Wayfinder when all are true:

1. Destination is clear enough
2. necessary decisions are recorded in `Decisions So Far`
3. Frontier no longer holds decision-blocking Tickets
4. remaining work is primarily implementation rather than choice

Then:

- finish the Active Map
- summarize the route for the user
- hand off to Planning Files Runtime / implementation if needed

## Invocation surface

Primary methodology lives in this skill.

Thin prompt shortcut: `/wayfinder` (see `pi/agent/prompts/wayfinder.md`).

| Invocation | Behavior |
|---|---|
| bare `/wayfinder` | Smart entry: inspect state and route |
| `/wayfinder init` | Check deps + create workspace only |
| `/wayfinder chart <topic>` | Clarification gate + create Map |
| `/wayfinder work` | Advance one Current Ticket |
| `/wayfinder status` | Report state only; no mutation |
| `/wayfinder ui` | Open taskmd Web UI for human inspection (background by default) |

Smart entry routing:

1. taskmd missing → stop / install authorization path
2. multiple Active Maps → stop and require cleanup
3. no workspace / no Active Map → chart path
4. Active Map + Current Ticket → continue that Ticket
5. Active Map + no Current Ticket → Frontier selection into Work mode

## Relationship to other systems

| System | Role |
|---|---|
| Personal Wayfinder | Decision map while foggy |
| taskmd | Local backend + human Web UI |
| Planning Files Runtime | Execution-phase progress after decisions are clear |
| `grill-with-docs` / `prototype` / `/explore-codebase` | Local capabilities used by Ticket types |

Never confuse:

- **Ticket** (Wayfinder decision unit)
- **Planning Task** (implementation unit under `.pi/planning/tasks/`)
- taskmd's underlying `task` record (storage primitive only)

## Do / Don't

### Do

- keep fog and out-of-scope explicit
- operate through taskmd CLI as agent backend
- open Web UI when the human wants inspection/manual override (default: `interactive_shell` dispatch + background)
- recommend only locally available skills on handoff
- keep one Current Ticket focus

### Don't

- invent a tracker when taskmd is missing
- merge Wayfinder into Planning Files Runtime
- implement the destination under Wayfinder
- resolve many unrelated Tickets in one unfocused session
- use bare ids in human-facing narration
- silently expand Destination scope

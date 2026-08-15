---
name: wayfinder
description: Plan foggy, multi-session work as a local decision map of Tickets on taskmd, then resolve one Ticket at a time until the route to the destination is clear. Personal Wayfinder variant — no team claim flow, taskmd backend only, separate from Goal Runtime.
disable-model-invocation: true
---

# Personal Wayfinder

A loose idea has arrived — too big for one agent session, and wrapped in fog. Wayfinding finds the **route**, not charges at the destination.

This skill charts a **shared Map** in the repository's local **taskmd** workspace, then works **decision Tickets** one at a time until the route is clear. Tickets resolve **decisions / investigations / prototypes / setup**, not implementation slices.

This is a **Personal Wayfinder**:

- keeps the original decision-oriented method
- removes team collaboration ceremony
- uses **taskmd as an explicit backend** (not built-in, not swapped silently)
- stays **separate from Goal Runtime** (`.pi/goals/` + `.pi/track/`)
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
- silently expanding into Goal Runtime execution
- invoking Goal Runtime — never call goal-runtime tools (`/goal set`, `/goal run`, `/goal review`, `save_goal_draft`, `commit_goal`, `activate_goal`, …) from a Wayfinder session. Goal flows are **user-triggered**: the Wayfinder agent may only **suggest the user run** a `/goal ...` command at Graduate/Exit, and only as one capability-aware option among others
- mutating production code — the Wayfinder session is **read-only** to production code; only `.pi/wayfinder/` and throwaway prototype scratch may be written

Writing a handoff spec / Goal contract is **planning**, not implementation — it stays in scope. Specs are Wayfinder's decision-layer output and may be written **incrementally** (a partial spec as soon as one part of the exploration is decided, handed off via Graduate) or as a single unified spec when exploration completes.

When remaining work is mostly "how to implement", exit Wayfinder (see [Exit condition](#exit-condition)) and hand off by **suggesting commands for the user to run** (capability-aware, not hard-coded; `/goal set` is one option, not the default).

## Core objects

| Term | Meaning |
|---|---|
| **Map** | Canonical overview for one destination |
| **Ticket** | One decision / investigation / prototype / setup unit |
| **Frontier** | Unblocked pending Tickets under the Active Map |
| **Current Ticket** | The single Ticket this session is advancing |
| **Wayfinder Workspace** | Per-repo local storage at `.pi/wayfinder/` |
| **Task** | Implementation work under Goal Runtime (`.pi/goals/` records + `.pi/track/`) — different system |

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

### Ticket types, channels, and local capabilities

Every Ticket has a **channel** — how its answer is obtained:

- **AFK** — the agent drives it alone (research in the repo / on the web; shell prep).
- **HITL** — the answer only comes through a human; the agent **never** stands in for the human's side.

Channel defaults by type; only `research` and `setup` are genuinely dual-mode:

| Type | Intent | Default channel | Local capability |
|---|---|---|---|
| `research` | Gather facts needed for a decision | AFK | `/skill:explore-codebase` (in-repo) or web fetch (`web_search` + `fetch_content`) |
| `research` + HITL | Facts only obtainable via a human (a colleague, the requirement owner, an architecture doc the agent can't reach) | HITL | none the agent runs itself — see [HITL research](#hitl-research) |
| `prototype` | Cheap concrete artifact to react to | HITL (fixed) | `prototype` skill |
| `grilling` | Live decision interview | HITL (fixed) | `grill-with-docs` (fallback `/grill-me`) |
| `setup` | Prep work that unblocks a later decision | AFK or HITL | no dedicated skill; checklist / shell / manual prep |

Channel is recorded as the tag `wayfinder:hitl` when HITL; its absence means AFK. `prototype`/`grilling` are HITL by nature, so the tag is redundant but harmless.

#### HITL research

A `research` + HITL Ticket resolves to an **answer** (like any research), but the agent cannot fetch it itself. The agent's job is to **write a precise intake brief**, then **stop**:

- who to ask / where to look (person, doc, system)
- the exact question, and the form of answer that would unblock each downstream Ticket
- which downstream Tickets wait on it

The agent sets the Ticket to `waiting-human` and does **not** auto-resolve it, even if it could guess an answer. Resolution resumes when the human returns with the input; only then is `## Resolution` filled.

Do **not** hard-code foreign skills. When handing off, recommend only capabilities available in the current agent/repo environment (**Capability-Aware Handoff**).

### Status semantics

| Status | Use |
|---|---|
| `pending` | Not started; may still wait on dependencies |
| `in-progress` | Current Ticket (or Active Map) |
| `waiting-human` | Ticket paused awaiting human input (typically a HITL Ticket whose intake brief has been issued) |
| `completed` | Answered, including negative conclusions; also used for **graduated** Tickets handed off to build |
| `cancelled` | Lost relevance before resolution / mis-scoped |
| `blocked` | Real external blocker only (permissions, broken env); **not** for routine human-input waits |

`waiting-human` is the routine "needs a human" state; reserve `blocked` for true exceptions. Ordinary unmet dependencies stay `pending`. Do **not** mark every dependent Ticket `blocked`.

## Frontier

The Frontier is:

- under the Active Map
- not the Map itself
- `status=pending`
- all Ticket dependencies satisfied
- not already the Current Ticket
- not `waiting-human` (paused on a human, not takeable)

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

1. **Plan, don't do** — Wayfinder is the decision layer; its output is Spec(s), never implementation code. Specs may be written incrementally (partial, during exploration) or unified (at exit). Implementation is **always a separate agent/session** — never inside Wayfinder — and may start for an already-spec'd portion before the whole exploration is done.
2. **Refer by name**
3. **Single-Ticket Session, directional** — advance exactly one Current Ticket. Exploration that **points down** (drills into this Ticket's question: fetch related context, consult skills, split the Ticket's own work and research each sub-area) is faithful and allowed. Exploration that **points sideways** — surfacing a *different, independent* question — must **graduate to a new Ticket** and be handled in a **new session**, never resolved inline in this one.
4. **Decision Double-Write** — on completing a Ticket: write `## Resolution`, **insert a `## Decision` summary section at the top of the Ticket body** (so a closed Ticket reads as a decision record, not an exploration log), **and** append a one-line gist to Map `Decisions So Far`
5. **One Active Map**
6. **Parent = membership; Dependency = ordering**
7. **No silent tracker fallback**
8. **No silent destination invention**
9. **HITL never auto-resolved** — a HITL-channel Ticket is never resolved by the agent standing in for the human; it gets an intake brief and `waiting-human`
10. **Goal ops are user-triggered** — never invoke Goal Runtime (`/goal` commands or goal-runtime tools) from a Wayfinder session. At Graduate/Exit, **suggest the user run** the fitting capability (`/goal set`, `/goal run`, or an alternative that exists in this environment); if other local skills cover the need, suggest those too. The agent only recommends — the user pulls the trigger.

Parallel **read-only** research sub-agents are allowed **only in Chart mode**, **only for `research`-AFK Tickets**, and all results merge back into the Map/Chart pass. They are never used to resolve HITL Tickets.

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
9. Optionally fire parallel **read-only** research sub-agents for fresh `research`-**AFK** Tickets (never research-HITL; see Invariant #9).
10. Stop. Charting does not resolve non-research Tickets in the same pass unless the user explicitly continues into Work mode.

### Work Through the Map

Use when an Active Map already exists.

1. Load the Map (low-res overview, not every Ticket body).
2. Choose Ticket:
   - user-named Ticket if provided
   - else Current Ticket if already `in-progress`
   - else first/best Frontier Ticket
3. Mark it Current (`status=in-progress`) before real work.
4. **Pre-execution gate**, before resolving:
   - read the Ticket's channel (type + `wayfinder:hitl`)
   - if **HITL** (`research`+HITL, `prototype`, `grilling`, or `setup`+HITL): the agent does **not** auto-resolve. For `research`+HITL, write the [intake brief](#hitl-research) into `## Notes`, set `status=waiting-human`, and **stop** — resume only when the human returns. For `grilling`/`prototype`, begin the live exchange with the human.
   - if **AFK** (`research` or `setup`): proceed to resolve with the matching local capability.
5. Resolve it within the Single-Ticket boundary: **downward** exploration is fine; **sideways** questions become new Tickets for a new session, never handled inline.
6. Write:
   - full answer into Ticket `## Resolution`
   - **one-paragraph convergence summary as a new `## Decision` section at the very top of the**
     **Ticket body** (so the completed Ticket reads as a decision record from first glance,
     not as an ongoing exploration)
   - one-line gist into Map `## Decisions So Far`
7. Mark Ticket `completed` (or `cancelled` only if abandoned before answer).
8. **Graduate** if the Ticket has matured into "ready to build, no decision left": set `## Resolution` to a pointer into the **spec layer** (a spec link, or `Graduated → Goal <id>` **if the user has already created** such a goal via `/goal set`), mark `completed`, and record the gist in `## Decisions So Far` as a route step. This is the partial-spec handoff path: **suggest the user** start a separate implementation session (`/goal run`, a spawn agent, ordinary coding) for the spec'd portion — but do **not** implement it inside Wayfinder and do **not** invoke `/goal` or goal tools yourself.
9. Graduate fog into new Tickets if now sharp; clear graduated fog from `Not Yet Specified`.
10. Rule mis-scoped work into `Out of Scope` and cancel those Tickets.
11. Update / create dependency edges as needed.
12. Stop after that one Ticket unless the user explicitly continues.

## Destination Shift

If the Destination changes materially:

1. close / complete the old Active Map
2. chart a **new** Map

Do not endlessly mutate one Map into a different journey.

## Exit condition

Exit Wayfinder when all are true:

1. Destination is clear enough
2. necessary decisions are recorded in `Decisions So Far`
3. Frontier no longer holds decision-blocking Tickets (remaining Tickets are `waiting-human` or graduated)
4. remaining work is primarily implementation rather than choice

Then:

- finish the Active Map
- summarize the route for the user
- **capability-aware, spec-as-boundary handoff — suggestions to the USER, not agent actions**:
  - **Spec side (Wayfinder's own output).** Suggest the user finalize the spec via whatever spec-writing capability actually exists here (running `/goal set <topic>` themselves, or an alternative). Partial specs may already have been handed off during exploration via Graduate; at exit the unified spec covers the rest.
  - **Implementation side (separate agent/session, never inside Wayfinder).** Once a spec exists, suggest the user open a new session on the fitting path (`/goal run`, cursor/pi spawn agents, ordinary coding, etc.). Implementation for an already-spec'd portion may have started earlier and may continue in parallel with remaining exploration — but never in the Wayfinder session, and never bundled with spec-writing.
- detect which capabilities actually exist on each side and **suggest** the fitting one to the user — do **not** hard-code a single path and do **not** execute it yourself.

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
| `/wayfinder help` | Print the command surface + one-paragraph when-to-use guidance; start no work |

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
| `/goal set` (Goal spec) | Writing the implementable spec — Wayfinder's decision-layer output; **user-triggered only**: Wayfinder suggests the user run it, never invokes it |
| `/goal run` (Goal Runtime) | Implementation session — always a separate agent/session the **user** starts; may run in parallel with ongoing Wayfinder exploration once a spec exists |
| `grill-with-docs` / `prototype` / `/skill:explore-codebase` | Local capabilities used by Ticket types |

Never confuse:

- **Ticket** (Wayfinder decision unit)
- **Task** (implementation unit under Goal Runtime: `.pi/goals/` records + `.pi/track/`)
- taskmd's underlying `task` record (storage primitive only)

## Do / Don't

### Do

- keep fog and out-of-scope explicit
- operate through taskmd CLI as agent backend
- open Web UI when the human wants inspection/manual override (default: `interactive_shell` dispatch + background)
- recommend only locally available skills on handoff — as **suggestions for the user to run**, never as actions the Wayfinder agent executes
- keep one Current Ticket focus

### Don't

- invent a tracker when taskmd is missing
- merge Wayfinder into Goal Runtime
- invoke `/goal` commands or goal-runtime tools from a Wayfinder session — goal flows are user-triggered; suggest, don't execute
- implement the destination under Wayfinder
- resolve many unrelated Tickets in one unfocused session
- use bare ids in human-facing narration
- silently expand Destination scope

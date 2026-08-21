# taskmd Convention for Personal Wayfinder

This document is the **storage and command convention** layer for Personal Wayfinder.  
Methodology lives in [SKILL.md](SKILL.md). Do not redefine method here.

## Prerequisites

- Binary: `taskmd` must be available on PATH
- If missing: stop; user installs or explicitly authorizes agent install
- No silent fallback tracker

## Paths

| Purpose | Path |
|---|---|
| Wayfinder Workspace | `.pi/wayfinder/` |
| taskmd ticket directory | `.pi/wayfinder/tickets/` |

Always pass the ticket directory explicitly to taskmd, for example:

```bash
taskmd --task-dir .pi/wayfinder/tickets <command>
```

Use the project's actual relative/absolute path for the current repo.

## Identity tags

All Wayfinder records must carry a `wayfinder:*` tag. Untagged taskmd records are out of Wayfinder logic.

| Record | Required tags |
|---|---|
| Map | `wayfinder:map` |
| Research Ticket | `wayfinder:research` |
| Prototype Ticket | `wayfinder:prototype` |
| Grilling Ticket | `wayfinder:grilling` |
| Setup Ticket | `wayfinder:setup` |

**Channel tag** (optional, encodes HITL/AFK — see [Ticket types, channels](SKILL.md#ticket-types-channels-and-local-capabilities)):

| Tag | Meaning |
|---|---|
| `wayfinder:hitl` | Ticket is HITL-channel — agent must not auto-resolve; write intake brief and set `waiting-human` |

Absence of `wayfinder:hitl` means AFK. `prototype`/`grilling` are HITL by nature (tag redundant but allowed). Use `wayfinder:hitl` on `research`/`setup` when the answer/prep must come through a human.

Optional extra tag for bulk filtering: `wayfinder`

Do **not** rely on taskmd `type` / `group` / `scope` for first-class Wayfinder identity. Tags are the membership system.

## Status conventions

| Object | Status | Meaning |
|---|---|---|
| Active Map | `in-progress` | Current map being worked |
| Historical Map | `completed` or `cancelled` | Closed map |
| Current Ticket | `in-progress` | Session focus |
| Ready / waiting Ticket | `pending` | Not started; may wait on deps |
| Awaiting-human Ticket | `waiting-human` | HITL Ticket paused on human input; intake brief issued |
| Answered Ticket | `completed` | Decision recorded (incl. negative answers); also **graduated** handoff Tickets |
| Abandoned Ticket | `cancelled` | Lost relevance before answer |
| Exceptionally stuck Ticket | `blocked` | Real external blocker only (permissions, broken env) — **not** routine human-input waits |

Rules:

- Only one Active Map (`wayfinder:map` + `in-progress`)
- Only one Current Ticket (non-map + `in-progress`) preferred
- Ordinary unmet dependencies stay `pending`
- `waiting-human` is the routine "needs a human" state; `blocked` is reserved for true exceptions

## Relationship model

| Relationship | Meaning | taskmd expression |
|---|---|---|
| Parent | Ticket belongs to Map | Ticket `parent` = Map id |
| Dependency | Downstream waits for upstream | Ticket `dependencies` / `--depends-on` |

Important:

- Parent is **membership only**
- Dependency is the only relationship that shapes Frontier
- Tickets must **not** depend on the Map itself just to express membership

Direction:

- `B --depends-on A` means B waits for A
- A is upstream of B

## Titles

| Object | Title format |
|---|---|
| Map | `Wayfinder: <Destination>` |
| Ticket | plain human question / decision name |

No type prefixes in Ticket titles. Type lives in tags.

## Body templates

### Map body

```markdown
## Destination

## Notes

## Decisions So Far

## Not Yet Specified

## Out of Scope
```

All five sections must exist even when empty.

### Ticket body

```markdown
## Question

## Why Now

## Notes

## Resolution

## Follow-ups
```

All five sections must exist even when empty.
When the Ticket is completed, a `## Decision` section is inserted at the very top (before `## Question`) —
see [Complete Ticket](#complete-ticket) and [Decision double-write](#decision-double-write).

## Decision double-write

When completing a Ticket:

1. Fill Ticket `## Resolution`
2. **Insert a `## Decision` section at the very top of the Ticket body** with a one-paragraph
   summary of what was decided and why — the completed Ticket must read as a decision
   record, not an exploration document. Existing body sections stay unchanged.
3. Append one line to Map `## Decisions So Far`:

```markdown
- [<Ticket title>](link-or-id-context) — <one-line gist>
```

Prefer named references over bare ids in human-facing text.

## Frontier query intent

Frontier candidates are Tickets that:

1. are tagged `wayfinder:research|prototype|grilling|setup` (not `wayfinder:map`)
2. belong to the Active Map (parent)
3. have `status=pending`
4. have all dependencies satisfied / completed
5. are not already the Current Ticket
6. are **not** `waiting-human` (those are paused on a human, not takeable)

Practical composition:

- use taskmd dependency-aware next/list features where available
- filter to Wayfinder tags + `status=pending`
- explicitly exclude `status=waiting-human` (paused on human, not Frontier)
- skip map records
- if user named a Ticket, that overrides automatic selection

Suggested mental command shape (adapt to installed taskmd version):

```bash
taskmd --task-dir .pi/wayfinder/tickets next \
  --filter status=pending \
  --filter tag=wayfinder:research
# also consider prototype / grilling / setup tags as needed
```

If native next/filter cannot express everything cleanly, list + filter in agent logic. Correctness of frontier semantics beats clever one-liners.

## Common operations

Exact flags may vary by taskmd version. Prefer:

1. discover actual CLI help (`taskmd --help`, `taskmd add --help`, etc.)
2. then apply the semantics below

### Init workspace

```bash
mkdir -p .pi/wayfinder/tickets
# optional: smoke-check taskmd against the dir
taskmd --task-dir .pi/wayfinder/tickets list
```

### Create Map

Verified against taskmd `0.2.6`:

```bash
taskmd -d .pi/wayfinder/tickets add "Wayfinder: <Destination>" \
  --tags wayfinder:map --status in-progress --format json
```

Then overwrite the created markdown body with the Map template. Default `taskmd add` body is Objective/Tasks/Acceptance Criteria and is not Wayfinder-shaped.

### Create Ticket

```bash
taskmd -d .pi/wayfinder/tickets add "<question-focused title>" \
  --tags wayfinder:<type> --status pending --parent <map-id> --format json
```

Then overwrite the body with the Ticket template.

- dependencies: only after related ids exist

### Wire dependencies

Second pass after create:

```bash
# conceptual
taskmd -d .pi/wayfinder/tickets set <ticket-id> --depends-on <upstream-id>
# multiple: --depends-on 002,003
```

### Mark Current Ticket

```bash
taskmd -d .pi/wayfinder/tickets set <ticket-id> --status in-progress
```

Set chosen Ticket to `status=in-progress`.  
Ensure no other non-map Ticket remains `in-progress` unless the user intentionally overrides.

### Park on human input (HITL)

For a HITL-channel Ticket (`research`+HITL, `prototype`, `grilling`, `setup`+HITL), the agent does **not** auto-resolve. For `research`+HITL in particular:

1. write the **intake brief** into `## Notes` (who to ask / where to look; exact question; answer form; downstream Tickets waiting on it)
2. set `status=waiting-human`
3. **stop** — do not fill `## Resolution`
4. resume (fill `## Resolution`, complete) only when the human returns with the input

```bash
taskmd -d .pi/wayfinder/tickets set <ticket-id> --status waiting-human
```

`prototype`/`grilling` are live HITL exchanges and stay `in-progress` during the conversation, not `waiting-human`.

### Complete Ticket

```bash
taskmd -d .pi/wayfinder/tickets set <ticket-id> --status completed
# or: taskmd -d .pi/wayfinder/tickets set <ticket-id> --done
```

1. write `## Resolution`
2. **insert a `## Decision` section at the very top of the Ticket body** (before `## Question`) —
   the summary of what was decided and why, so the completed Ticket reads as a decision
   record from the first line, not as an ongoing exploration
3. append Map `## Decisions So Far`
4. set status `completed`
5. graduate fog / out-of-scope as needed

#### Graduation (handoff to build)

When a Ticket has matured into "ready to build, no decision left", complete it as a **graduation** rather than a decision:

- `## Resolution` = handoff pointer, e.g. `Graduated → Goal <id>` or a spec link
- `## Decision` summary states it was handed off to build, not decided inline
- Map `## Decisions So Far` line records it as a **route step** (e.g. `- [Name](link) — graduated to build → Goal 003`)
- status `completed`
- do **not** implement the destination here (Wayfinder session is read-only to production code)

Graduation is a resolution mode, not a new status or type.

### Cancel Ticket

Use when the Ticket is abandoned or mis-scoped before resolution:

- status `cancelled`
- if out of scope: also record on Map `## Out of Scope`

### Open Web UI

Human inspection surface. Default launch path for `/wayfinder ui`:

```bash
taskmd -d .pi/wayfinder/tickets web start --port 8080 --open
```

How the agent should start it:

1. Prefer `bash` background launch with:
   - `mode: "dispatch"`
   - `background: true`
2. Report:
   - URL (default `http://localhost:8080`)
   - session id for later `/attach`
3. Do **not** use plain `bash`/nohup as the primary path — long-lived web servers are unreliable there.
4. Agent still mutates state via CLI, never by driving the web UI.

Web UI can also be opened in the foreground for manual inspection when the user wants to watch. Background launch is the default.


## Status report fields

`/wayfinder status` should summarize at least:

- taskmd available? yes/no
- workspace path exists?
- Active Map name + destination gist
- Current Ticket name (if any)
- Frontier candidates (named)
- Tickets `waiting-human` (named, with intake-brief status) — surfaced separately from Frontier
- graduated Tickets not yet built (named, with handoff pointer)
- blocked exceptions
- recent Decisions So Far (tail)

No hidden mutation during status.

## Validation / cleanup checks

Stop and ask the human when detecting:

- multiple Active Maps
- multiple Current Tickets without explicit user intent
- Wayfinder-tagged records outside `.pi/wayfinder/tickets/`
- Tickets without parent Map
- circular dependencies (use taskmd validate if available)
- HITL Tickets stuck `in-progress` without a live human exchange (should be `waiting-human` or completed)

## Language boundary

- This convention doc and the skill docs are English
- Human conversation may be Chinese
- Keep canonical terms untranslated: Map, Ticket, Frontier, Destination, Current Ticket

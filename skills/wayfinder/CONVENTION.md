# Ticket Convention for Personal Wayfinder

This document is the **storage and command convention** layer for Personal Wayfinder.
Methodology lives in [SKILL.md](SKILL.md). Do not redefine method here.

The Wayfinder store is owned by the `ticket` CLI at `skills/wayfinder/cli/` (TypeScript, zero runtime dependencies, no build step). Every read and write of the store goes through it:

```bash
node <repo>/skills/wayfinder/cli/main.ts <command> [args]
```

Design authority: `docs/adr/0016-wayfinder-owns-its-ticket-store.md`.

## Paths

| Purpose | Path |
|---|---|
| Wayfinder Workspace | `~/.cache/wayfinder/<workspace-id>/` |
| Ticket directory | `~/.cache/wayfinder/<workspace-id>/tickets/` |

`<workspace-id>` is derived from the repository root — resolve it with `git rev-parse --show-toplevel` (fallback: current directory), take its absolute path, strip any trailing slash, replace every `/` with `-` (the leading slash becomes the leading dash), and append a trailing `-`. Example: `/path/to/repo` → `-path-to-repo-`. Data lives outside the repo, so nothing needs gitignoring.

The CLI resolves this itself; use `--store <dir>` only to point at an explicit directory (tests, unusual setups). Never hand-edit ticket files while a command is running — and never invent a second store location.

## File format

One Ticket (or Map) per file, filename `<id>-<slug>.md`. The slug is computed once at creation and is **stable thereafter** — `set` never renames the file. Slug rules: lowercase ASCII, keep digits, drop everything else, collapse runs to `-`.

```yaml
---
id: "003"
title: 弹窗承载哪些创建动作与提交粒度
type: grilling
status: waiting-human
parent: "012"
dependencies: ["016"]
channel: hitl
created_at: 2026-10-18
completed_at:
---
```

| Field | Required | Rule |
|---|---|---|
| `id` | yes | quoted string, zero-padded to ≥3 digits, unique in the store |
| `title` | yes | one line |
| `type` | yes | exactly one of `map` `research` `prototype` `grilling` `setup` |
| `status` | yes | exactly one of `pending` `in-progress` `waiting-human` `completed` `cancelled` `blocked` |
| `parent` | yes for `type != map`; must not appear on `type: map` | id of the Map |
| `dependencies` | optional | list of Ticket ids (ids only, never a Map) |
| `channel` | optional | `afk` \| `hitl`; **absent means `afk`** |
| `created_at` | yes | `YYYY-MM-DD`, bare |
| `completed_at` | optional | `YYYY-MM-DD` or empty |

`type` and `channel` are **first-class fields, not tags** — a free-form tag list is not machine-checkable. **Any unknown frontmatter key is an error**, on read as well as on `check`. There is no alias, no migration path, no back-compat: strict from day one.

Frontmatter is **machine-owned**: a human edits prose, never frontmatter; the agent mutates frontmatter only through `ticket` commands.

## Commands

```
ticket check [dir]                 # exit 1 on any error; prints ALL errors, not just the first
ticket list [--status S] [--type T]
ticket set <id> --status S [--channel afk|hitl]
ticket depends <id> --on <id>…     # add edges
ticket depends <id> --clear        # drop all edges
ticket open <id>                   # open the file in the user's editor
ticket map [--out PATH]            # default: $TMPDIR/wayfinder-<workspace-id>.html
```

All commands accept `--store <dir>` to override the ticket directory.

- Every mutating command first validates the **whole** store strictly; a store with any error (including an unknown frontmatter key in an unrelated file) is not writable.
- `ticket open` uses `$EDITOR`, then `$VISUAL`, then macOS `open -t <file>`; it reports which one it used.
- `ticket map` writes a **single self-contained HTML file** (no network, no server, no port, no daemon, no watch mode) and prints the output path.

## Check rules

`ticket check` enforces exactly these eight rules:

```
1. unknown frontmatter key                        → error
2. type ∈ 5-value enum                             → error
3. status ∈ 6-value enum                           → error
4. id unique; filename <id>- prefix == frontmatter id → error
5. parent exists, is not self, no parent cycle     → error
6. dependencies all exist, no dependency cycle     → error
7. at most one Active Map       (type=map, status=in-progress)
8. at most one Current Ticket   (type!=map, status=in-progress)
```

Rule 1 applies on **read too**: `ticket set 003 …` on a file carrying a stray key fails immediately, before writing anything — the danger is not the invalid file, it is the tool operating on a file whose dependency graph it cannot see.

## Status conventions

| Status | Meaning |
|---|---|
| `in-progress` on a Map | Active Map |
| `completed` / `cancelled` on a Map | Closed map |
| `in-progress` on a Ticket | Current Ticket (session focus) |
| `pending` | Ready / waiting; may wait on deps |
| `waiting-human` | HITL Ticket paused on human input; intake brief issued |
| `completed` | Decision recorded (incl. negative answers); also **graduated** Tickets |
| `cancelled` | Lost relevance before answer |
| `blocked` | Real external blocker only (permissions, broken env) — **not** routine human-input waits |

Only one Active Map and one Current Ticket. Ordinary unmet dependencies stay `pending`; `waiting-human` is the routine "needs a human" state.

## Relationship model

| Relationship | Meaning | Field |
|---|---|---|
| Parent | Ticket belongs to Map (**membership only**) | `parent` |
| Dependency | Downstream waits for upstream (**ordering**) | `dependencies` |

- `B dependencies: ["A"]` means B waits for A; A is upstream of B
- Dependency is the only relationship that shapes the Frontier
- Tickets must **not** depend on the Map itself to express membership

## Titles

| Object | Title format |
|---|---|
| Map | `Wayfinder: <Destination>` |
| Ticket | plain human question / decision name |

No type prefixes in Ticket titles. Type lives in `type`.

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

All five sections must exist even when empty. When the Ticket is completed, a `## Decision` section is inserted at the very top (before `## Question`) — see [Decision double-write](#decision-double-write).

## Decision double-write

When completing a Ticket:

1. Fill Ticket `## Resolution`
2. **Insert a `## Decision` section at the very top of the Ticket body** with a one-paragraph summary of what was decided and why — the completed Ticket must read as a decision record, not an exploration document
3. Append one line to Map `## Decisions So Far`:

```markdown
- [<Ticket title>](link-or-id-context) — <one-line gist>
```

Prefer named references over bare ids in human-facing text.

## Map rendering intent

`ticket map` renders the whole board with **default emphasis on the Frontier**, not the board:

- Node shows exactly: id, title, status, type
- Edges: `parent` = membership (Map → Ticket), `dependencies` = ordering (upstream → downstream)
- **Frontier** = `type != map`, `status=pending`, all dependencies satisfied, under the Active Map, not the Current Ticket, not `waiting-human` — highlighted by default; completed chains render as background
- Click a node → highlight its full upstream + downstream chain; click a Map → collapse its subtree; filter by status / type
- **No body content** — prose stays in the file; `ticket open` is how you read it
- Prints the output path

## Frontier query intent

Frontier candidates are Tickets that:

1. are not `type=map`
2. belong to the Active Map (`parent`)
3. have `status=pending`
4. have all dependencies satisfied / completed
5. are not already the Current Ticket
6. are **not** `waiting-human` (paused on a human, not takeable)

`ticket list` marks Frontier candidates with `◆`. If the user named a Ticket, that overrides automatic selection.

## Common operations

### Init workspace

```bash
mkdir -p ~/.cache/wayfinder/<workspace-id>/tickets
node skills/wayfinder/cli/main.ts check
```

### Create Map / Ticket / wire dependencies

Creation is always a CLI write — never hand-author frontmatter:

```bash
node skills/wayfinder/cli/main.ts add "<title>" --type map
node skills/wayfinder/cli/main.ts add "<question-focused title>" --type research --parent <map-id>
```

`add` allocates the id (`max + 1`, zero-padded to at least 3 digits), computes the slug, writes `<id>-<slug>.md` in the canonical field order with the fixed body template for the type, and prints the new id.

```
ticket add <title> --type map|research|prototype|grilling|setup
                [--status S] [--parent <id>] [--depends-on <id>…]
                [--channel afk|hitl] [--body <string> | --body-file <path>]
```

- `--status` defaults to `in-progress` for a Map, `pending` for a Ticket
- `--parent` is required for non-map types and must name an existing Map; must not appear for `type: map`
- `--depends-on` wires dependencies at creation; every id must exist (wire in a second pass when upstream ids don't exist yet):

```bash
node skills/wayfinder/cli/main.ts depends <ticket-id> --on <upstream-id>
```

### Mark Current Ticket

```bash
node skills/wayfinder/cli/main.ts set <ticket-id> --status in-progress
```

### Park on human input (HITL)

1. write the **intake brief** into `## Notes` (who to ask / where to look; exact question; answer form; downstream Tickets waiting on it)
2. `node skills/wayfinder/cli/main.ts set <ticket-id> --status waiting-human`
3. **stop** — do not fill `## Resolution`
4. resume only when the human returns with the input

`prototype`/`grilling` are live HITL exchanges and stay `in-progress` during the conversation, not `waiting-human`.

### Complete Ticket

1. write `## Resolution`
2. insert a `## Decision` section at the very top of the Ticket body
3. append Map `## Decisions So Far`
4. `node skills/wayfinder/cli/main.ts set <ticket-id> --status completed`
5. graduate fog / out-of-scope as needed

#### Graduation (handoff to build)

When a Ticket has matured into "ready to build, no decision left", complete it as a **graduation** rather than a decision:

- `## Resolution` = handoff pointer, e.g. a spec link or `Graduated → <implementation record>`
- `## Decision` summary states it was handed off to build, not decided inline
- Map `## Decisions So Far` line records it as a **route step**
- do **not** implement the destination here (Wayfinder session is read-only to production code)

### Cancel Ticket

Use when the Ticket is abandoned or mis-scoped before resolution: status `cancelled`; if out of scope, also record on Map `## Out of Scope`.

### Human inspection

```bash
node skills/wayfinder/cli/main.ts map        # prints path; open the file in a browser
node skills/wayfinder/cli/main.ts open <id>  # single Ticket prose
```

No server, no port, no process to stop.

## Status report fields

`/wayfinder status` should summarize at least:

- workspace path exists? (`ticket check` clean?)
- Active Map name + destination gist
- Current Ticket name (if any)
- Frontier candidates (named; `ticket list` `◆` marks)
- Tickets `waiting-human` (named, with intake-brief status) — surfaced separately from Frontier
- graduated Tickets not yet built (named, with handoff pointer)
- blocked exceptions
- recent Decisions So Far (tail)

No hidden mutation during status.

## Validation / cleanup checks

Stop and ask the human when detecting:

- multiple Active Maps
- multiple Current Tickets without explicit user intent
- Ticket files outside `~/.cache/wayfinder/<workspace-id>/tickets/`
- any `ticket check` error (the CLI names all of them)
- HITL Tickets stuck `in-progress` without a live human exchange (should be `waiting-human` or completed)

## Language boundary

- This convention doc and the skill docs are English
- Human conversation may be Chinese
- Keep canonical terms untranslated: Map, Ticket, Frontier, Destination, Current Ticket

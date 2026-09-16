# pi-navigator: a curated capability router injected on demand

Status: accepted

## Context

Every skill in this repo is `disable-model-invocation`, and the extension command
families (`/wf`, `/track`, `/xfer`, `/pi-skills`, `/readonly`) plus the `dispatch`
and `run_code` tools are invisible to the driving model unless something tells it
they exist. As the capability surface grew (8 extensions, 12+ skills, a pattern
library), "which capability do I use for this task?" became a question only the
user could answer from memory.

Reference implementations studied:

- **pstack's poteto-mode** (cursor/plugins): an entry-mode skill that matches the
  task to a playbook and routes to other skills as steps fire — the "entry mode"
  shape.
- **mattpocock/skills `ask-matt`**: a `disable-model-invocation` router skill — a
  hand-written decision tree over the repo's skills, organized by situation with
  main flow, on-ramps, and anti-patterns. Notably it is *not* generated from
  frontmatter: routing quality comes from curated judgment ("which situation →
  which skill, and what not to do").

## Decision

- A new `pi-navigator` extension registers `/nav <task or question>`. It is a
  **router, not an executor**: the model answers with a proposed workflow
  (which `/skill:<name>`, which command, which pattern, in what order, and one
  recommended next action) and executes nothing.
- Capability knowledge is **hand-curated first**: `catalog.md` inside the
  extension directory holds the judgment content (extension capabilities, skill
  routing by situation, patterns, anti-patterns), maintained alongside the
  capabilities it describes. This follows the `ask-matt` lesson — auto-generated
  frontmatter lists tell the model what exists but not when to use what.
- An **auto-scan backstop** enumerates SKILL.md frontmatter across the three
  skill search paths (`~/.pi/agent/skills/`, `<cwd>/.pi/skills/`,
  `~/.agents/skills/`) at invocation time, so the catalog can never go stale
  about what actually exists or where it lives. Extensions are not scanned —
  the set is small and stable in-repo, so the catalog hand-lists them.
- Injection is **on demand, per invocation**: catalog + inventory + user input
  are sent as an invisible message with `triggerTurn: true` (the track
  extension's pattern). Nothing is added to the system prompt — the full
  catalog is too heavy to pay every turn for a capability the user asks for
  occasionally.

## Consequences

- `just install-pi` links the extension like the others; no new install path.
- Catalog drift is the main maintenance cost: adding a skill/extension/pattern
  should update `catalog.md`; the scan backstop degrades gracefully if forgotten.
- Not yet a sticky mode (poteto-mode persists across turns); if `/nav` usage
  shows repeated re-invocation within one effort, a sticky variant can be added.

# Capability Catalog

This catalog is the navigator's hand-curated map of every capability maintained by
the dotfiles repo: pi extensions, skills, and workflow patterns. Route by
**situation**, not by name. The auto-scanned skill inventory appended after this
catalog is the source of truth for what actually exists on disk right now —
trust it over this file when they disagree.

## How to answer

Propose a **workflow** (ordered steps), not just a single skill. Reference every
capability explicitly:

- Skills by `/skill:<name>` (they are all `disable-model-invocation` — the model
  can never load them on its own; only explicit user invocation loads them).
- Extension commands by their slash command (`/wf`, `/track`, `/xfer`, ...).
- Tools by name (`dispatch`, `run_code`).
- Say what the first concrete step is, and when to stop or switch routes.

## Extension capabilities

| Capability | Form | Use when |
|---|---|---|
| workflow-runtime | `/wf` command family | Multi-node orchestrated work: `/wf new` drafts a Definition (nodes with human/auto steps and `suggest` refs), `/wf start <pattern>` instantiates a pattern, `/wf` books state and suggests the next node — it never executes node work itself |
| track | `/track` command family | Working memory across steps/sessions: `/track new`, `/track update` (checkpoint before ending a session), `/track context` (reload findings into a fresh context) |
| sub-dispatch | `dispatch` tool | Parallel/foreground sub-agents: spawn pi/codex/claude/cursor subprocesses for delegated work; consumed by impl-with-spawn and how skills — prefer going through those skills rather than calling dispatch raw |
| code-mode | `run_code` tool | Bulk programmatic work over the repo (many files, structured queries) in one TypeScript program instead of dozens of tool calls |
| readonly-mode | `/readonly` toggle | Fence the agent to read-only tools during exploration or review on precious branches |
| xfer | `/xfer` | Hand the work to another Pi/Cursor instance in a different terminal/project via Unix socket |
| command-palette | `alt+.` | User-facing: fuzzy-pick any slash command into the composer (mention it to the user, don't invoke it) |
| project-skills | `/pi-skills` | One-time per project: link pi-coupled skills into `<cwd>/.pi/skills/` |

## Skill routing by situation

**Have an idea / requirement to sharpen**

- Raw requirements from documents (PRD, meeting notes, Figma dumps) → `/skill:intake` (grills ONE archived source at a time, no solutions).
- A plan that needs stress-testing against the domain model → `/skill:grill-with-docs` (updates CONTEXT.md / ADRs inline as decisions crystallise).

**Foggy, multi-session effort** → `/skill:wayfinder` first (decision map of Tickets), then resolve tickets one at a time.

**Need to understand the codebase before touching it** → `/skill:how` (read-only, parallel sub-agents). Anti-pattern: skipping exploration and jumping straight to implementation on an unfamiliar area.

**Need the motivation behind the code's shape** ("why was this built this way", design rationale, regression/postmortem context) → `/skill:why` (code anchor + parallel evidence investigators, confidence-tiered cited read). Companion to how: that answers how it works, this answers what forces led to its shape.

**Ready to implement** → `/skill:impl-with-spawn` (delegates via `dispatch`; consults `/skill:spawn-model-selection` internally for model choice).

**The design question needs runnable answers first** → `/skill:prototype` (throwaway; LOGIC.md for state models, UI.md for look-and-feel).

**Explain or visualize something** → `/skill:show-me` (diagrams, code-shape sketches, HTML artifacts).

**Browser is involved** (verify UI, drive Chrome) → `/skill:chrome-devtools` (MCP-first, CLI fallback).

**Architecture deepening / refactor candidates** → `/skill:improve-codebase-architecture` (reads CONTEXT.md + docs/adr/ for the domain language).

**Context is running out or switching agents** → `/skill:handoff` (summary doc for a fresh agent), or `/xfer` for a live peer, or `/track update` to checkpoint working memory.

**Review workflow for this project** → `<project>-code-review` skill, generated once by `/skill:setup-code-review` in the project's `.agents/skills/`.

## Workflow patterns

`/wf start <name>` instantiates a Pattern from `~/.pi/agent/patterns/`. Root
patterns are intentionally per-project only; `examples/` (bugfix, feature, perf)
are references for drafting a project Definition via `/wf new`, not for direct
use. When the task maps onto a repeated multi-step shape, suggest `/wf new` and
draft a Definition whose node `suggest` entries reference the skills above.

## Anti-patterns

- Don't recommend a skill by description alone without checking it exists in the scanned inventory.
- Don't stack entry funnels: intake → grill-with-docs → wayfinder all sharpen intent; pick the one matching the input type, not all of them.
- Don't route implementation through raw `dispatch` when `/skill:impl-with-spawn` covers it.
- Don't suggest `/wf` for tasks that are one skill invocation; orchestration is for multi-node work.
- End with exactly one recommended next action — a menu of five options is not a workflow.

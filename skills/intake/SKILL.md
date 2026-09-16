---
name: intake
description: Requirement intake funnel — archive parsed raw inputs (PRD text, meeting notes, Figma extracts, spreadsheets) and grill on ONE source at a time until the agent's understanding matches the user's. No cross-source reconciliation, no solutions, no codebase access; output is the aligned raw requirement.
disable-model-invocation: true
---

<what-to-do>

Intake is the funnel mouth: inputs arrive from many directions (PRDs, meeting minutes, Figma extracts, spreadsheets — none authored by you), and each one gets archived and aligned **one source at a time**. Intake never reconciles sources, never proposes solutions, never opens the codebase — cross-source work belongs downstream (grill-me / grill-with-docs / wayfinder).

**Step 0 — locate the funnel (always, before touching the input material).** Compute the workspace slug (same convention as the `wayfinder` skill: repo-root abs path → dash-slug, e.g. `/path/to/repo` → `-Users-ison-dev-dotfiles-`), list requirement directories under `~/.cache/intake/<workspace-slug>/`, and ask the user: does this input belong to one of these, or is it a new requirement? Even if the user names one, confirm the match — don't guess.

**Step 1 — file the source.** Write `raw/<YYYY-MM-DD>-<source-name>.md`: the input as received, unaltered, with a source frontmatter (type, originator, fidelity). Do not summarize or clean up — the raw file is evidence. If the input is still a link or binary, ask the user to parse it with the appropriate skill/MCP first.

**Step 2 — grill on this source only.** Interview the user, one question at a time, until the agent's understanding of *this document* matches the user's: what it actually says (restate and let them correct), ambiguous or overloaded terms, what it conspicuously does not say, and why it landed on the user's desk. Not a checklist — a dialogue.

**Step 3 — write aligned + update the index.** Record the agreed understanding in `aligned/<same-name>.aligned.md` and append one row to `STATE.md` (rewriting its one-liner if the picture moved). Formats: [INTAKE-FORMAT.md](./INTAKE-FORMAT.md).

Then loop if the user has another source; otherwise stop — intake is never "done", the funnel stays open in any later session.

</what-to-do>

<supporting-info>

## Layout

```
~/.cache/intake/<workspace-slug>/<requirement-slug>/
├── STATE.md                                  # cross-session baton: one-liner + source index
├── raw/<YYYY-MM-DD>-<source-name>.md
└── aligned/<YYYY-MM-DD>-<source-name>.aligned.md
```

Lazy init: create the directory only when the first source is filed. `STATE.md` is an index, never a conversation log — its one-liner is all a fresh session needs.

## Hard boundaries

- One source per alignment; never compare, rank, or reconcile sources.
- Conversation-level only — the input is the raw requirement, the only artifact under construction.
- No solutions: design ideas that surface are recorded as what the source says or as open questions.
- Parsing is upstream; downstream handoff (grill-me / grill-with-docs / wayfinder) is suggestion-only, user-triggered.

</supporting-info>

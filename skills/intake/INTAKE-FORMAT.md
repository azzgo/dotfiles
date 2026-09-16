# INTAKE-FORMAT.md

File formats for the `intake` skill. Create files lazily — only when there is something to write.

## STATE.md (per requirement)

Created when the first source is filed. An **index, not a log**: the one-liner at the top is rewritten as understanding evolves; never record conversation history here.

```markdown
# Intake: <requirement-slug>

- **Created**: <YYYY-MM-DD>
- **One-liner**: <current one-sentence statement of the requirement>

## Sources

| Date | Source | One-line gist | Aligned |
|------|--------|---------------|---------|
| 2026-09-16 | checkout-prd | ... | yes |
| 2026-09-18 | kickoff-notes | ... | no |
```

`Aligned` is `no` until the grilling on that source is confirmed by the user and the `.aligned.md` is written.

## raw/<YYYY-MM-DD>-<source-name>.md

The input as received, unaltered — no summarizing, reordering, or cleanup. Frontmatter only:

```markdown
---
source-type: prd | meeting-notes | figma-extract | spreadsheet | verbal | other
originator: <person/team, if known>
captured: <YYYY-MM-DD>
fidelity: verbatim | paraphrase
---
```

If fidelity is `paraphrase` (e.g. an upstream tool already digested it), say so in the grilling — the user should know they are aligning against a secondary rendition.

## aligned/<YYYY-MM-DD>-<source-name>.aligned.md

The agreed understanding of that one source. Sections may be empty; they may not be dropped.

```markdown
---
source: <matching raw file name>
aligned: <YYYY-MM-DD>
---

## Statement

<what this source is asking for, in agreed wording>

## Confirmed facts

- <fact> — <quote/section reference into the raw file>

## Ambiguities resolved

- <term> → <agreed meaning>

## Open questions

- <unanswered> — <who would know>

## User's concerns

<why this landed on the user's desk; what they actually care about here>
```

Discipline: facts trace to the raw file; no solutions, no codebase references, no claims about other sources.

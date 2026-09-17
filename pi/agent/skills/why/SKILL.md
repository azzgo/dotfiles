---
name: why
description: Investigate the motivation and intent behind code — "why does X work this way", "why we picked Y", design rationale, regressions, postmortems. Anchors on the code, then queries evidence sources in parallel (git/gh always; docs, chat, issue trackers, observability when available) and returns a cited, confidence-tiered read on decisions and tradeoffs. Use explore-codebase for how code works; use this for why it has its shape.
disable-model-invocation: true
---

# Why (design-rationale investigation)

Investigate the motivation and intent behind code. Companion to
**`explore-codebase`**: that skill answers what the code does and how it
works; this one answers what forces led to its shape.

Adapted from pstack's `why` (Cursor MCP-centric evidence sweep trimmed to
environment-neutral sources).

Invocation: `/skill:why [target and question]`. The user's arguments are
appended as plain text after this content — that is the investigation target.

> Final summary is user-facing: deliver it in the user's input language (see APPEND_SYSTEM.md language rule).

Operating posture: **careful, cautious, precise investigator**. Be honest
about what you know vs what you're inferring. The synthesizer must follow
`references/epistemics.md` — every claim in the final output sits in one of
its five confidence tiers (Direct / Supported / Inferred / Speculative /
Unknown).

## Step 1. Understand the target and the question

The **target** is usually a chunk of code, a pattern, a feature, or a named
design decision. The **question** is usually design rationale, a tradeoff, a
motivating edge case, an external constraint, dead code, or a broad history
sweep.

If the target is vague ("why do we do it this way?" with no clear referent),
make your best guess from conversation context (recent edits, what was just
discussed). State your interpretation briefly so the user can redirect if
you're off, then proceed.

## Step 2. Establish the code anchor (inline, before dispatch)

Anchor the investigation in concrete code. You need:

- The relevant file path(s) and line range(s)
- The key symbols (function names, class names, constants)
- An initial commit list — the last few commits touching the target
- PR numbers from merge commits (pattern `(#1234)` in the subject line)

```bash
# Blame target lines for last-touch commits
git blame -L <start>,<end> <file>

# Full file history, with patches, through renames
git log --follow -p -- <file>

# Last N commits touching the file, PR numbers visible
git log --oneline -20 -- <file>

# PR bodies and discussion for substantive commits
gh pr view <number> --json title,body,author,createdAt,mergedAt,labels,closingIssuesReferences,comments,reviews
```

Capture this as seed context (paths, symbols, commits, PR numbers, linked
ticket IDs) and pass it to every investigator.

## Step 3. Map evidence sources, then dispatch parallel investigators

**Source control is the only guaranteed source — always spawn that
investigator.** Then map whatever else the environment actually offers to an
evidence category, and spawn one investigator per category that has a real
source. Don't force categories that have no backing tool; do record the gap —
a null result is a finding, not a skip.

| Category | Typical source in this environment | Uniquely surfaces |
|----------|-----------------------------------|-------------------|
| Source control history | git log / blame, `gh pr view` | implementation-time rationale captured during review — **always spawn** |
| Issue / ticket tracker | `gh issue`, project tracker if available | the product or business forcing function |
| Long-form documents | `docs/`, ADRs, CONTEXT.md, RFCs, wikis | recorded design deliberation and rejected alternatives |
| Real-time chat | Slack/IM archives if accessible | incident context, off-the-record constraints |
| Observability / error tracking | dashboards, error trackers if accessible | what actually broke in production and how often |

Extra playbook: if the target code looks **defensive** (null checks, retry
logic, timeouts, rate limiting, feature flags, egress guards, OOM handlers),
explicitly task one investigator with hunting for the incident or failure
that made the author defensive — defensive code is fossilized pain.

#### Dispatch

Use the `dispatch` tool (sub-dispatch extension), same wait discipline as
`explore-codebase`: fire all investigators in a **single parallel batch**
with `background: true`, end your turn, collect from completion
notifications; query `dispatch({ sessionId })` only for diagnosis/recovery.

Model selection: shared skill **`spawn-model-selection`**, simple /
mechanical tier, same as exploration. Investigators are read-only in spirit —
include the read-only constraint in every prompt (no file writes, no
state-changing commands). If code mode (`/code`) is on, use the foreground
`Promise.all` + `run_code` shape from `explore-codebase`.

#### Investigator prompt template

```
You are a read-only evidence investigator. Your only job is to search and read
sources to answer why code has its current shape.

=== READ-ONLY CONSTRAINT ===
No file creation/modification, no state-changing commands. Search and read only.

=== YOUR EVIDENCE CATEGORY ===
[one category from the table above, with its concrete source/tool]

=== CODE ANCHOR ===
[file paths + lines, key symbols, commit hashes, PR numbers, ticket IDs from Step 2]

=== THE QUESTION ===
[user's original question, verbatim]

=== OUTPUT REQUIREMENTS ===
Findings with explicit citations (commit SHA, PR #, doc path, message URL).
For every claim, state which tier it sits in: Direct (an explicit written
rationale), Supported (multiple indirect sources converge), Inferred (your
reading of context), Speculative (a guess), or Unknown (you searched <what>
and found nothing). A null result with the list of what you searched is a
valid, valuable answer. Output findings directly; do not create files.
```

## Step 4. Synthesize and present

Merge investigator findings, de-duplicate, and write the final read:

1. **The answer up front**: 2-5 sentences answering the question at the
   highest confidence tier the evidence supports, with citations.
2. **The decision trail**: chronological — what was introduced when, by which
   PR/commit, and what each step says (or doesn't) about motivation.
3. **Confidence-tiered detail**: claims grouped by tier per
   `references/epistemics.md`. Never flatten an Inferred claim into Direct
   phrasing ("because" needs an adjacent citation).
4. **Competing hypotheses**: when evidence is thin, lay out the plausible
   readings side by side instead of picking one.
5. **Coverage map**: which evidence categories were searched and came up
   empty, which had no source available. A documented null beats a silent
   skip.

Present with **`show-me`** where a visual compresses the trail (e.g. a
timeline of commits/PRs); keep the confidence discussion in prose.

---

User arguments: <user arguments appear here>

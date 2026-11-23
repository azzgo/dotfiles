# Rationale track

Investigate the motivation and intent behind code — "why does X work this way",
"why we picked Y", design rationale, regressions, postmortems. The code tells
you what it does; this track collects what forces led to its shape.

Read this file only when Phase 1 triage put the question on the rationale
track. The confidence discipline lives next to it in `epistemics.md` — every
claim in the final output sits in one of its five tiers (Direct / Supported /
Inferred / Speculative / Unknown).

Operating posture: **careful, cautious, precise investigator**. Be honest about
what you know versus what you're inferring.

## Rationale triage

Rationale questions have their own triage, separate from the exploration
fan-out. Do not dispatch investigators for a question one read can settle.

- **Inline** (single file, single commit, one obvious referent): answer it
  yourself with `git blame -L <start>,<end> <file>`, `git log --follow -p -- <file>`,
  and `gh pr view <number>`. No investigator, no fan-out.
- **Parallel** (evidence spans multiple files or categories, or the answer
  lives in PR discussion / incident context): dispatch read-only investigators,
  one per evidence category, using the Phase 3 dispatch shape and wait
  discipline in `SKILL.md`.

## Step 1. Understand the target and the question

The **target** is usually a chunk of code, a pattern, a feature, or a named
design decision. The **question** is usually design rationale, a tradeoff, a
motivating edge case, an external constraint, dead code, or a broad history
sweep.

If the target is vague ("why do we do it this way?" with no clear referent),
make your best guess from conversation context (recent edits, what was just
discussed). State your interpretation briefly so the user can redirect if
you're off, then proceed.

## Step 2. Establish the code anchor

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

## Step 3. Map evidence sources, then dispatch investigators

**Source control is the only guaranteed source — always cover it.** Then map
whatever else the environment actually offers to an evidence category, and
assign one investigator per category that has a real source. Don't force
categories that have no backing tool; do record the gap — a null result is a
finding, not a skip.

| Category | Typical source in this environment | Uniquely surfaces |
|----------|-----------------------------------|-------------------|
| Source control history | git log / blame, `gh pr view` | implementation-time rationale captured during review — **always cover** |
| Issue / ticket tracker | `gh issue`, project tracker if available | the product or business forcing function |
| Long-form documents | `docs/`, ADRs, CONTEXT.md, RFCs, wikis | recorded design deliberation and rejected alternatives |
| Real-time chat | Slack/IM archives if accessible | incident context, off-the-record constraints |
| Observability / error tracking | dashboards, error trackers if accessible | what actually broke in production and how often |

Extra playbook: if the target code looks **defensive** (null checks, retry
logic, timeouts, rate limiting, feature flags, egress guards, OOM handlers),
explicitly assign one investigator the hunt for the incident or failure that
made the author defensive — defensive code is fossilized pain.

### Investigator prompt template

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

Model selection and the dispatch/wait shape are the ones in `SKILL.md`
(simple / mechanical tier, read-only constraint restated in every prompt).

## Step 4. Synthesize and present

Merge investigator findings, de-duplicate, and write the final read:

1. **The answer up front**: 2-5 sentences answering the question at the
   highest confidence tier the evidence supports, with citations.
2. **The decision trail**: chronological — what was introduced when, by which
   PR/commit, and what each step says (or doesn't) about motivation.
3. **Confidence-tiered detail**: claims grouped by tier per `epistemics.md`.
   Never flatten an Inferred claim into Direct phrasing ("because" needs an
   adjacent citation).
4. **Competing hypotheses**: when evidence is thin, lay out the plausible
   readings side by side instead of picking one.
5. **Coverage map**: which evidence categories were searched and came up
   empty, which had no source available. A documented null beats a silent
   skip.

Present with **`show-me`** where a visual compresses the trail (e.g. a
timeline of commits/PRs); keep the confidence discussion in prose.

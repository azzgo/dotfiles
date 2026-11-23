---
name: blast-radius
description: "Review a change delivered from outside (a design team, an agency, another squad) before merging it — prove the change is only visual and find where it leaked into the functional layer. Use for 'review this style change', 'is this safe to merge', 'what else does this touch' when the nominal scope is styling, layout, tokens, or assets."
disable-model-invocation: true
---

# Blast radius

Review a change **someone else delivered** before it lands. The nominal scope is
presentation: styles, layout, spacing, tokens, assets, text casing. The job is
to (1) find where it stopped being presentation, and (2) prove the visual claim
instead of trusting the deliverable's description.

Companion to **`how`**: how tells you what the code does, including its
rationale track (`how/references/rationale.md` + `epistemics.md`) when you need
to know why a component is shaped the way it is. This skill tells you what the
change reaches.

Adapted from pstack's `blast-radius` (Cursor Task/arena orchestration and
cross-model review trimmed; evidence ladder kept verbatim).

## Triage before you start

- **Inline** (one file, pure variable/spacing/asset swap, no shared token):
  read the diff, run the two checks below once, hand back.
- **Full flow** (shared tokens, global styles, a reused component, a vendor
  bundle, or anything touching a design-system package): run every section.
  When in doubt, take the full flow — the cost of a wrong "safe" is a
  production regression nobody asked for.

## 越界判定

A styling delivery crosses from presentation into function when any of these
signals appears. Check each one explicitly against the diff; a hit is reported
by name with its `file:line`, never softened into "minor logic change".

| Signal | What to look for | How to locate it |
|---|---|---|
| Conditional rendering or branching | ternaries, `if`, `&&` added next to markup, new early returns | read the diff hunks, not just the style files; grep the touched components for `?`, `if (`, `&&` |
| Event handlers | `onClick` / `onChange` / listeners added, moved, or rewired | grep the changed files for `on[A-Z]`, `addEventListener`, `dispatch(` |
| State | new `useState` / `useReducer` / store wiring / signals / refs | grep for state hooks and store imports in changed files |
| Props or component contracts | new required prop, changed default, altered prop types, renamed slot | diff the component signature and every call site (`grep -rn "<ComponentName"`) |
| Data requests | fetch / query / API calls added or altered, cache keys changed | grep changed files for `fetch(`, `useQuery`, `axios`, client calls |
| Routing | path, param, or navigation changes | grep for router imports, `push(`, `Link to=`, route tables |
| Permissions and analytics | auth checks, gating, tracking events added or removed | grep for auth guards and `track(` / `analytics` / event names |
| Logging | new logs, error reporting, debug output | grep for `console.`, logger calls |

Anything in this list that appears is a **finding**: name the file and line,
state what behavior it can change, and say whether the delivery described it.
Silence is not an option — "the diff also adds an onClick, which the summary
does not mention" is exactly what this review exists to surface.

## 影响面清单

Styling usually leaks through sharing: a token, a global rule, or a component
used in more places than the deliverable mentions. Build the list before
judging the change.

1. **Shared tokens and variables.** Every changed custom property, SCSS
   variable, theme key, or Tailwind token: grep for all references, not just
   the diff. List every consumer.
2. **Global styles.** Any change to resets, base element rules, `:root`,
   typography defaults, or a global stylesheet reaches every page that imports
   it. Enumerate the pages or entry points.
3. **Reused components.** For each changed component, grep every import site
   and list the affected screens, including tests, stories, and emails or
   server-rendered templates that reuse the same markup.
4. **Assets and breakpoints.** A changed image, font, icon set, or breakpoint
   can shift layout on screens the deliverable never opened.

Write the list out, one line per affected page or entry point. **"Looks like it
only affects one place" is not a conclusion** — it is the absence of this list.
If grep finds nothing, say which grep you ran and where.

## 视觉等价证明

Prove "only the visuals moved" with a comparison, not with an opinion. Pick the
strongest form the environment supports and paste the command into the output:

- **Pixel diff** of before/after renders (screenshot diff, `pixelmatch`,
  visual-regression runner) with a number: changed pixel count or a zero.
- **DOM or computed-style snapshot** diff for components whose rendering cannot
  be screenshotted headlessly.
- **Deterministic structural check** when neither exists: the same query run
  against both revisions, diffed, with the result shown.

The proof must cover the pages from the impact list, not one lucky screen. If
the environment cannot render (no browser, no fixture), say so and downgrade
the claim — the fact is then unproven, not "visually identical".

## Don't trust your own writeup

A blast-radius writeup that sounds right is worthless. It reads as convincing
whether or not it's true. So don't hand back the writeup. Find the one or two
facts the whole thing depends on and prove them by running code.

### How sure are you

For each fact the change's safety depends on, get it as far down this list as
is cheap, and say where it stopped.

1. You said so. Worthless on its own.
2. You pointed at the line. A real `file:line`, or the library's own source.
3. You showed the bad case can't happen. You walked the failure step by step and it doesn't reach.
4. You ran it. A script or test that calls the real code and fails loud if you're wrong.
5. You reproduced it in the running app.

Two facts carry this review, and both must reach **ran** (4) — not walked:

- **"This change is purely presentational."** Reaching level 4 means a script or
  test that exercises the changed surface and still passes, or a render diff
  with a stated delta — not a reading of the diff.
- **"No other consumer is affected."** Reaching level 4 means running the
  enumeration from the impact list against the real tree and showing the
  result, not asserting that nothing else imports it.

Stopping at levels 1-3 makes the finding **`unproven`**. Never write `safe` on
levels 1-3. Say which level each fact reached and why it stopped there.

## Steps

1. **Read the delivery, not its summary.** The diff, the symbols it adds,
   changes, and deletes, and what it now does differently — including the part
   the summary doesn't spell out. Pull commit/PR context the way the `how`
   rationale track's Step 2 does (`git blame -L`, `git log --follow -p`,
   `gh pr view`).
2. **Run the crossing check.** Walk the 越界判定 table row by row against the
   diff. Record hits with `file:line`; record checked-and-clean rows too, so the
   coverage is visible.
3. **Build the impact list.** Enumerate every token, global rule, and reused
   component consumer per 影响面清单. This is the part that "looks fine" right
   up until the second page breaks.
4. **Prove the visuals.** Run the comparison per 视觉等价证明 and paste the
   command plus its result.
5. **Find the one fact it's safe because of.** Most changes that look risky are
   safe because of a single fact, like "this token is only consumed by the two
   screens we diffed". If that fact holds, most risky cases clear at once. Spend
   the time here, not on a long list of maybes.
6. **Look where grep stops.** Read the library source you call and check its
   pinned version and any local patch. Work out when things run: microtasks,
   teardown, framework lifecycle. Follow what a symbol search misses: the JSON
   an API returns, a DB column, a wire format, a server-rendered template, a
   feature flag, code three hops downstream.
7. **Be honest about each risk.** Give it a real chance of happening and a real
   cost if it does. Keep the confirmed ones, list the checked-and-cleared ones
   apart. Cite a real `file:line`; a search that finds nothing is still an
   answer; never invent a caller or an API. The confidence discipline is the
   one in `how/references/epistemics.md`.
8. **For a big or wide change**, dispatch parallel reviewers via `dispatch`
   (read-only, one per angle: crossing check / impact list / visual proof) and
   merge — different reviewers catch different leaks.

## Where this stops and code-review starts

The project's code-review skill owns general quality: correctness of the logic
being changed, naming, structure, tests for new behavior, review etiquette.
This skill owns one axis: **impact surface and crossing evidence**. It does not
re-review the project's coding standards, and it does not bless a functional
change that arrived inside a styling delivery — a crossing finding goes back to
the reviewer as a scope violation, not as a style nit.

## What to hand back

- **What it does.** What changed, including the part that isn't obvious.
- **Crossing findings.** Every functional-layer signal found, with `file:line`
  and the behavior it can alter, or an explicit "checked, none" per table row.
- **Impact list.** Every affected page, entry point, or consumer; the greps
  that established it.
- **The visual proof.** The command and its output, or `unproven` with the
  reason the environment could not render it.
- **The one fact it's safe because of.** State it, say which rung of the ladder
  it reached, and show the proof.
- **Risks.** Only the real ones. Each names how it breaks, the `file:line`, how
  likely and how bad, and how to check.
- **Before you merge.** The cheapest test or repro that catches the real bug,
  including the script you wrote.

Keep the writeup plain: concrete nouns, whole sentences, no jargon or abstract
framing, no decorative formatting, no claims without a pointer. Strip anything
private before it goes anywhere public.

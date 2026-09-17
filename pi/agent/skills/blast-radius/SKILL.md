---
name: blast-radius
description: "Find what a change could break somewhere else before it ships, beyond the diff, and prove the one fact it's safe because of by running real code instead of writing it up. Use for 'blast radius of X', 'what could this break', or reviewing a small diff you don't trust."
disable-model-invocation: true
---

# Blast radius

Find what a change breaks somewhere else, before it ships. Use for "blast
radius of X", "what could this break", or reviewing a small diff you don't
trust yet.

Companion to **`how`** and **`why`**: how tells you what the code does, why
tells you why it's shaped that way, blast radius tells you what it breaks
somewhere else.

Adapted from pstack's `blast-radius` (Cursor Task/arena orchestration and
cross-model review trimmed; evidence ladder kept verbatim).

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

Any safety fact you can't get to step 4, say so. Don't write it up as settled.
Step 4 is usually one small script that imports the same library the app ships
and calls the exact function you're worried about — it does not require the
app's runtime environment to be up. When only steps 1-3 are reachable, the
finding is "unproven", never "safe".

## Steps

1. **Read the change.** The diff, the symbols it adds, changes, and deletes,
   and what it now does differently, including the part the diff doesn't spell
   out. Pull commit/PR context the same way `why` step 2 does (blame,
   `git log --follow -p`, `gh pr view`).
2. **Find the one fact it's safe because of.** Most changes that look risky
   are safe because of a single fact, like "this call only drops already-dead
   cache entries and does nothing else". Find that fact. If it holds, most
   risky cases are cleared at once. Spend your time here, not on a long list
   of maybes.
3. **Look where grep stops.** Read the source of the library you call, and
   check its pinned version and any local patch. Work out when things run:
   microtasks, teardown, framework lifecycle. Follow what a symbol search
   misses: the JSON an API returns, a DB column, a wire format, another
   language reading the same bytes, a feature flag, code three hops
   downstream.
4. **Be honest about each risk.** Give it a real chance of happening and a
   real cost if it does. Keep the risks you confirmed. List the ones you
   checked and cleared separately. Same confidence discipline as `why` (see
   its `references/epistemics.md`): cite a real `file:line`, a search that
   finds nothing is still an answer, and never make up a caller or an API.
5. **Prove the one fact.** Write a script or test that runs the real code,
   run it, and paste what happened. If you can't prove it cheaply, mark it
   unproven. Don't overstate.
6. **For a big or wide change**, dispatch parallel reviewers via `dispatch`
   (read-only, one per risk angle) and merge — different reviewers catch
   different real bugs.

## What to hand back

- **What it does.** What changed, including the part that isn't obvious.
- **The one fact it's safe because of.** State it, say which rung of the
  ladder it reached, and show the proof. If it couldn't be proven, write
  unproven.
- **Risks.** Only the real ones. Each names how it breaks, the `file:line`,
  how likely and how bad, and how to check. Paste the proof for the ones that
  matter.
- **Cleared.** What you checked and why it's fine.
- **Before you merge.** The cheapest test or repro that catches the real bug,
  including the script you wrote.

Keep the writeup plain (the `unslop` skill's standards apply). Strip anything
private before it goes anywhere public.

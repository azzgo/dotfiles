---
name: verify-playbook
description: Run the step chain and collect Evidence for the aligned requirement or feature this playbook covers. Load after Env Harness reports ready.
disable-model-invocation: true
---

# Verify Playbook

Project-local acceptance for **one** aligned requirement or feature. Bring the environment to ready with the repo’s **Env Harness** skill first; then run this chain and record Evidence.

> Replace the placeholders below when `create-verify-playbook` authors this file. Keep harness bring-up out of this document — reference the harness skill instead.

## Scope

- **Goal:** <aligned goal, including boundaries / non-goals>
- **Approach (only as needed to exercise):** <short>
- **Out of scope for this run:** <what this playbook does not claim>

## Prerequisites

- Env Harness skill has reported **ready** (load and follow that skill by name; do not duplicate its steps here).
- Aligned checkable signal: <what “done” looks like>

## Step chain

Numbered steps. Mark branches explicitly (`if …`, otherwise continue).

1. **<step>** — do …  
   - **Evidence:** <what to capture or observe>
2. **<step>** — …  
   - **Branch:** if <condition>, go to step N; else continue.  
   - **Evidence:** …
3. **<step>** — …

## Evidence log

For each step/branch taken, record:

| Step | Result | Evidence (path, screenshot note, command output summary, URL) |
|------|--------|---------------------------------------------------------------|
| 1    | pass / fail / skipped | |
| …    |        | |

## Finish

- Summarize: goal met or not, with pointers to Evidence rows.
- Leave the environment as the Env Harness teardown section specifies (call into that skill; do not invent a second teardown here).

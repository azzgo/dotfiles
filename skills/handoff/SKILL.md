---
name: handoff
description: Generate a handoff document summarizing the current conversation for a fresh agent to continue the work.
disable-model-invocation: true
---

# Handoff

Generate a handoff document summarising the current conversation so a fresh agent can continue the work.

## Rules

- Save to the temporary directory of the user's OS — not the current workspace.
- Include a "suggested skills" section listing skills from the agent's repertoire that would help the target agent complete the task.
- Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.
- Redact any sensitive information, such as API keys, passwords, or personally identifiable information.
- If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

## Output contract

Lead with the capsule, then the thread status, then the problems, then the next move. Deeper detail goes below or gets cut. (Contract adapted from pstack's `recall` skill.)

- **Capsule.** At most 5 bullets. What this work is and where it stands overall.
- **Threads.** One line each, prefixed with exactly one status tag: `[merged #N]`, `[open PR #N]`, `[in flight <branch>]`, `[verified, uncommitted]`, `[reverted #N]`, or `[planned, not started]`. A thread with no tag is not done yet, so tag it.
- **Problems.** At most 5, the recurring ones — including anything that was tried and reverted, so the next attempt starts where the last one failed.
- **Next move.** The single most useful next action, concrete.
- **Suggested skills.** What the fresh agent should load to continue (as per the rules above).

An adjacent feature or ticket stays out unless it blocks this one. When the capsule and thread lines outgrow a screen, cut detail before you cut threads.

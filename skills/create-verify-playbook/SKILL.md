---
name: create-verify-playbook
description: Create or refine a consuming repo's Verify Playbook skill from already-aligned materials (goal, approach, checkable signal). Does not run day-to-day acceptance — the in-repo Playbook does.
disable-model-invocation: true
---

# Create Verify Playbook

Author or refine the **Verify Playbook** skill inside the consuming repo. This meta-skill writes the playbook; day-to-day acceptance is run by that project-local skill, not by this one.

Design background: `docs/adr/0021-goal-driven-verify-playbook-and-env-harness.md`.

## When to use

- The user wants a project-local Verify Playbook created or updated for a requirement / feature.
- Aligned materials exist (or will be confirmed in this session): meeting notes, design notes, chat decisions — format is open.

## Completeness gate (all three, or stop)

Proceed only when **all** of the following are already aligned with the user. If any is missing, return to alignment (intake / grilling / grill-with-docs / wayfinder — user-triggered); do not invent “what the system should have” by reading the codebase.

1. **Goal aligned** — what lands, including boundaries and non-goals, stated clearly enough to disagree with.
2. **Approach aligned** — how it lands at the level needed to know what to exercise (not a full design dump).
3. **Checkable aligned** — what to look at, run, or compare to prove it landed (the evidence shape).

Restate the three briefly and get confirmation before writing or refining the Playbook.

## What you produce

A project-local skill (Agent Skills layout: folder + `SKILL.md`, kebab slug, frontmatter) that an agent can load later to **run** verification for this requirement / feature:

- A **branchable step chain** (happy path + the branches that matter for this goal).
- **Evidence points** per step or branch: what artifact, UI state, log line, API response, or diff counts as proof.
- A clear **hand-off from Env Harness**: assume the harness brings the env to ready; **reference** that skill by name/path — do not paste long bring-up / teardown prose into the Playbook.
- Scope limited to this requirement / feature. Steady-state full-repo regression is out of scope for this skill.

Starter shape: [references/verify-playbook.SKILL.md](./references/verify-playbook.SKILL.md). Adapt naming and paths to the consuming repo’s existing skills convention.

## Workflow

1. Confirm consuming-repo root and where project-local skills live.
2. Run the completeness gate; stop and hand back to alignment if incomplete.
3. If an Env Harness skill is missing or clearly stale for this work, say so and point at `create-env-harness` — do not expand this skill into harness authorship.
4. Draft or refine the Verify Playbook `SKILL.md` in the consuming repo (create the folder if needed).
5. Show the user the path, the step/evidence outline, and what still needs their edit.

## Responsibilities (positive)

- Turn aligned materials into an executable, branchable Playbook with evidence points.
- Keep Playbook and Harness separated: Playbook references Harness.
- Refine an existing Playbook when the aligned goal / approach / checkable signal moved.

## Done when

- Playbook file(s) exist in the consuming repo at an agreed path.
- Steps + evidence cover the aligned goal and stated branches.
- Harness is referenced, not inlined.
- User knows this meta-skill’s job is finished; running acceptance means loading the **in-repo** Playbook.

---
name: create-env-harness
description: Create or refine a consuming repo's Env Harness skill — bring-up, readiness checks, and teardown for verification. Does not run day-to-day acceptance playbooks.
disable-model-invocation: true
---

# Create Env Harness

Author or refine the **Env Harness** skill inside the consuming repo. This meta-skill writes the harness; Verify Playbooks load it to get a ready environment, then run their own step chains.

Design background: `docs/adr/0021-goal-driven-verify-playbook-and-env-harness.md`.

## When to use

- The user wants a project-local Env Harness created or updated.
- A Verify Playbook (or several) will need a shared way to bring the verification environment up, know it is ready, and tear it down.

## What the harness owns

Three jobs only:

1. **Bring-up** — how to start whatever the verification needs (services, seeds, flags, tunnels, test accounts, build artifacts).
2. **Readiness** — concrete checks that must pass before a Playbook starts (commands, URLs, health endpoints, file presence). Fail closed: not ready → do not hand off.
3. **Teardown** — how to leave the machine/repo in the agreed post-run state (stop processes, unset overrides, optional data cleanup).

Analogous content to “launch / doctor / cleanup” style checklists elsewhere; use clear names that fit the consuming repo.

## What you produce

A project-local skill (folder + `SKILL.md`, kebab slug, frontmatter) that:

- Spells out bring-up, readiness, and teardown as executable steps an agent can follow.
- States the **ready** signal explicitly (what to print or observe when hand-off is allowed).
- Stays environment-focused: no requirement-specific acceptance steps (those belong in Verify Playbook).
- Is safe to reference from multiple Playbooks.

Starter shape: [references/env-harness.SKILL.md](./references/env-harness.SKILL.md). Adapt naming and paths to the consuming repo’s skills convention.

## Workflow

1. Confirm consuming-repo root and where project-local skills live.
2. Gather how this repo actually brings verification up today (scripts, compose files, just recipes, documented manual steps). Prefer existing entrypoints over inventing parallel ones.
3. Draft or refine the Env Harness `SKILL.md` (create the folder if needed).
4. If Verify Playbooks already exist, note that they should **reference** this harness rather than keep copied bring-up prose — offer to trim duplicates only when the user asks.
5. Show the user the path, readiness criteria, and teardown expectations.

## Responsibilities (positive)

- Encode bring-up, readiness, and teardown for verification in one project-local skill.
- Make the ready → hand-off-to-Playbook boundary obvious.
- Refine the harness when the shared environment procedure changes.

## Done when

- Harness file(s) exist in the consuming repo at an agreed path.
- Bring-up, readiness, and teardown are each actionable.
- User knows Playbooks should reference this skill; this meta-skill does not run those Playbooks.

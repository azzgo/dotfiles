---
name: setup-code-review
description: One-time project setup that generates a self-contained, project-tuned code-review skill (<project>-code-review) in the project's .agents/skills/. Runs a grilling session first, probes project-local skills for SOP replacements, assembles the generated skill in copy mode, then trial-runs it. Use when entering a new project or when review quality on a project keeps disappointing.
disable-model-invocation: true
---

# Setup Code Review

This skill does **not** review code. It sets up a project-level code-review skill that does.

**Why project-level**: review focus differs per project — a UI-heavy monorepo fears style regression and spec drift; a backend service fears race conditions and API-doc mismatch. A single global skill cannot carry every project's emphasis. The generated skill lives in the project (`<project>/.agents/skills/<project>-code-review/`), is versioned with the project, and is tuned by this setup.

**Copy mode (hard rule)**: the generated skill is assembled by **copying** material from this skill's `references/`. It must be a closed loop within the project — it must **never** reference `setup-code-review`, its template, or its reference files. This setup skill will keep iterating independently; a generated skill that references it would drift or break. References to shared *user-level* skills (`show-me`, `spawn-model-selection`) stay by-name only, since those are stable user-level infrastructure, not setup products.

## Inputs

- **Project root** — where the generated skill lands. Never assume the current repo; ask if ambiguous.
- **Project name** — used for the generated skill's name: `<project>-code-review`.

## Process

### 1. Grilling session (hard gate — no generation before consensus)

Run a grilling interview about how code review should work **in this project**. Skill-selection rule: **local first** — probe for a grill-type skill in this order and follow the first one found:

1. `<project>/.agents/skills/` — any project-local grilling / plan-challenging skill
2. `~/.agents/skills/grill-with-docs`
3. `~/.pi/agent/skills/` — any grilling skill there

If none exists, fall back to the inline question list below (one question at a time, always offering your recommended answer; if a question can be answered by exploring the repo, explore instead of asking):

1. **What does review most need to catch here?** (style regression? spec/requirement drift? API-doc mismatch? race conditions? design debt?) → decides which of the three axes (Standards / Spec / Documentation Consistency) to keep and which supplementary dimensions (Code Quality / Race Condition / Removal Plan / Simplification) to promote or drop.
2. **Where do specs/requirements live?** (commit conventions? a spec dir? a ticket system? nowhere?) → pre-fills step 2 of the template.
3. **Where are the standards documented?** (AGENTS.md? linter config? team wiki?) → pre-fills step 3.
4. **Which project-local skills can replace parts of the toolkit's SOP?** (see step 2 of this setup) → decides which SOP fragments get replaced by a pointer to the local skill.
5. **What verification commands count as quality gates?** (lint/test/typecheck commands from the manifest) → pre-fills step 6f.

End the session with a written consensus summary: retained axes, dropped axes, project sources, local-skill replacements, quality gates. The user must confirm it before generation starts.

### 2. Probe project-local skills (SOP replacement)

Scan, in priority order (same as the pi skill search path):

| Priority | Path | Notes |
|---|---|---|
| 1 | `<project>/.agents/skills/` | project-coupled, closest to the actual situation — strongest replacement candidates |
| 2 | `~/.pi/agent/skills/` | user-level pi-coupled |
| 3 | `~/.agents/skills/` | user-level generic |

For each local skill, judge whether it can **replace** part of the toolkit's SOP — a local skill that already encodes the project's conventions beats the generic baseline. Typical replacements observed in practice:

- A project design-extraction skill (e.g. `figma-fig-extract`-style) can replace generic UI-review checklists with a precise "extract before review" step.
- A project component-creator / DS-pipeline skill can sharpen Standards findings on design-system conformance.
- A project review skill that already exists (e.g. a previous `<project>-code-review`) → **upgrade it in place** instead of generating a duplicate; diff against the template first.

**Replacement form**: the generated skill references the local skill **by name** (like `show-me`), describing when to invoke it — it does not copy the local skill's content (the local skill remains the single source of truth for itself). Only toolkit material from this skill's `references/` is copied.

### 3. Assemble the generated skill (copy mode)

Target: `<project>/.agents/skills/<project>-code-review/`.

1. **SKILL.md** — copy `references/review-skill-template.md` in full, then adapt per the grilling consensus (the adaptation guide is at the top of the template file):
   - set `name: <project>-code-review`
   - delete ruled-out axes/dimensions together with all their traces (process steps, sub-agent prompts, output sections, strict constraints)
   - hard-code the project's spec/standards/docs source locations into steps 2–3b, replacing the generic discovery chains with the known paths (keep the generic chain only as a fallback)
   - insert the local-skill replacement pointers agreed in step 2
2. **references/** — copy **only** the reference files the retained axes need (`solid-checklist.md`, `code-quality-checklist.md`, `security-checklist.md`, `removal-plan.md`). Unused ones are not copied.
3. **README.txt** — record in the generated skill's directory: generated by setup-code-review, date, template version (git SHA of this repo), grilling consensus summary, local-skill replacements. This is the trace for future re-setup decisions.

### 4. Trial run (acceptance)

Before declaring done, run the generated skill on a real recent diff of the project (small one; if none exists, synthesize a tiny scratch commit range):

- invoke `/skill:<project>-code-review` as the project agent would
- verify: correct fixed-point pinning, sub-agents fire as parallel background dispatches, each retained axis produces its verbatim section, the output format matches the template's step 7, and any local-skill pointer resolves

Fix the generated skill until the trial passes. Report the trial result to the user.

### 5. Wrap-up

- Do **not** commit in the project unless the user asks; the generated skill is project content owned by the project's workflow.
- Tell the user: re-run this setup when the project's review focus shifts, or when a template iteration in this repo is worth propagating — then the generated skill is regenerated (grilling again, but seeded by the existing generated skill's README.txt).

## Strict Constraints

- **Grilling is a hard gate** — no generation before the written consensus summary is confirmed.
- **Local-first skill selection** — project-local skills replace toolkit SOP wherever they cover it; the toolkit is the fallback, not the default.
- **Copy mode** — generated skill is self-contained; no references to setup-code-review or its files. Shared user-level skills (`show-me`, `spawn-model-selection`) by name only.
- **One generated skill per project** — if a `<project>-code-review` already exists, upgrade in place after diffing, never duplicate.
- **Trial run is mandatory** — a setup that hasn't survived one real review run is not done.

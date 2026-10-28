---
name: diverge-paths
description: From already-held understanding, diverge into path/state sketches so the user can see which paths are worth considering. Follows draw-path-chart by name. Thin entry — not a formal-verification kit.
disable-model-invocation: true
---

# Diverge Paths

Thin entry: start from **understanding you already hold** (aligned notes, a design tree, a prior chart, the user’s stated model) and **diverge** into path / state sketches. Goal: surface paths worth considering — not to prove the system as-is, and not to run acceptance.

Follow the shared **`draw-path-chart`** skill by name for presentation, node/edge naming, `draft` marking, and optional formal deepening. Design background: `docs/adr/0022-on-demand-path-chart-skills.md`.

## When to use

- The user wants to explore alternative flows, failure branches, or “what else could happen” from a model they already accept enough to sketch.
- Usage example (not the sole purpose): during an alignment phase, laying out candidate paths before locking checkable signals.

## Workflow

1. Restate the held understanding in one short block (states + transitions you believe are in scope). Confirm if anything material is missing — do not invent product goals by reading the codebase.
2. Follow **`draw-path-chart`**: produce one or more **`draft`** charts that diverge — happy path plus the branches that change outcomes.
3. Call out which paths look high-value to discuss next (cost, risk, user-visible). Keep suggestions **loose**; do not hard-wire or name-bind a Verify Playbook, alignment doc, or other downstream skill as mandatory next steps.
4. Stop when the user can see the fork set; refining acceptance steps or bringing up env is outside this entry.

## Responsibilities (positive)

- Expand held understanding into readable path/state sketches.
- Keep charts marked `draft` until the user says otherwise.
- Defer chart craft to `draw-path-chart`; defer as-is / bug tracing to `trace-paths` when the question is “what can the running system reach today?”.

## Done when

- Draft chart(s) show the diverge set the user asked for.
- High-value paths are named in plain language beside the chart.
- No formal/TLC run unless the user strongly asked this turn (via `draw-path-chart`’s optional deepening).

---
name: trace-paths
description: From code/system as-is plus symptoms or bug description, infer a currently reachable path chart with human-readable reproduction steps. Temporary diagnostic — follows draw-path-chart by name.
disable-model-invocation: true
---

# Trace Paths

Thin entry: start from the **system as it is** (code, configs, runtime behavior you can inspect) plus **extra input** (bug report, logs, screenshots, user-described symptoms) and infer a **currently reachable** path chart. Main artifact includes **human-readable reproduction steps**. The chart is **temporary diagnostic**, not a long-term product truth source.

Follow the shared **`draw-path-chart`** skill by name for presentation, node/edge naming, `temporary-diagnostic` marking, reproduction paragraph shape, and optional formal deepening. Design background: `docs/adr/0022-on-demand-path-chart-skills.md`.

## When to use

- The user needs to see how the live/codebase system can reach a bad or surprising state.
- Usage example (not the sole purpose): a production-shaped issue that lacks a clear repro, and the chart + steps become the shared walkthrough.

## Workflow

1. Gather as-is facts (read code, configs, tests, logs as available) and the symptom input. Prefer evidence over guesswork; mark assumptions explicitly on the chart.
2. Follow **`draw-path-chart`**: emit a **`temporary-diagnostic`** chart of reachable paths that explain or bound the symptom.
3. Add the **reproduction paragraph** (numbered steps + expected observations + stop condition) using `draw-path-chart`’s wording conventions so someone can attempt the path without reading every edge.
4. Offer **loose** next-step suggestions only (e.g. “worth confirming flag X”, “worth capturing log Y”). Do not hard-wire or name-bind a Verify Playbook, Env Harness, or alignment doc as required follow-through — if the consuming repo already has those, mentioning them by name as optional is enough.
5. Do not promote the chart into a Feature Map or lasting architecture doc in this skill.

## Responsibilities (positive)

- Infer reachable paths from as-is system + symptom input.
- Deliver chart + human-readable reproduction together.
- Keep the artifact marked `temporary-diagnostic`.
- Defer shared chart craft to `draw-path-chart`; defer “what paths should we consider from aligned understanding?” to `diverge-paths`.

## Done when

- A `temporary-diagnostic` chart is visible and tied to cited as-is evidence (files, behaviors, or logs).
- Reproduction steps sit beside it and are attemptable.
- No formal/TLC run unless the user strongly asked this turn (via `draw-path-chart`’s optional deepening).

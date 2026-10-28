---
name: draw-path-chart
description: Shared conventions for path/state-style charts — presentation, node naming, draft vs temporary-diagnostic marks, and reusable human-readable reproduction wording. Default engine is draw/list paths; optional TLA+/TLC only when the user strongly asks this turn. Followed by name from other skills (e.g. diverge-paths, trace-paths).
disable-model-invocation: true
---

# Draw Path Chart

Shared capability for **path / state-style** diagrams. Other skills follow this one **by name** (same pattern as `grilling` → `show-me`). Design background: `docs/adr/0022-on-demand-path-chart-skills.md`.

## Default engine

**Draw or list paths.** Prefer the smallest chart that makes reachability clear: text state machine, bullet path list, Mermaid `stateDiagram` / `flowchart`, or a short call-tree of transitions. Real names from the domain or code when known; invented labels only when exploring alternatives and mark them as provisional.

Do **not** start with TLA+ / TLC / exhaustive interleaving unless the user **this turn** strongly asks for formalization or exhaustive exploration. Formal deepening is optional and documented below; it is available, not the default path.

## Presentation conventions

- **One chart per question.** If diverge and happy-path collide, split into two charts rather than one overloaded figure.
- **Nodes** = states, modes, or named waiting points a human can point at. Prefer nouns the user already uses.
- **Edges** = events, user actions, messages, timers, or failures that move between nodes. Label the trigger; omit decoration that does not change reachability.
- **Start / end** = mark explicitly (`[*]` in Mermaid, or `START` / `END` in text).
- **Happy path** vs **branches**: keep the main path readable first; put rare/error branches as side edges or a second small chart.

### Draft vs temporary diagnostic

Mark the chart’s role in a one-line caption above or below it:

| Mark | Meaning |
|------|---------|
| `draft` | Exploratory sketch from current understanding; expected to change as alignment moves. |
| `temporary-diagnostic` | Built for this incident / bug thread from as-is system + symptoms; not a long-term source of truth for the product. |
| `aligned` (optional) | Only when the user has confirmed the chart matches shared understanding for this session. |

Do not treat a `draft` or `temporary-diagnostic` chart as a Feature Map or as acceptance truth. Positive verification of an aligned goal still goes through a Verify Playbook when that path exists (see ADR 0021) — this skill does not author or run Playbooks.

## Human-readable reproduction paragraphs

When a caller (e.g. `trace-paths`) needs a **reproduction** the user can follow without reading the chart:

1. Numbered steps a person can do (UI clicks, API calls, env flags) — one action per step.
2. **Expected observation** after each critical step (what to see, hear, or log).
3. **Stop condition** — how you know you reached the target state or failure.
4. Optional **setup** line (accounts, feature flags, data) kept short; point at Env Harness by name only if the consuming repo already has one — do not paste bring-up essays here.

Keep reproduction prose next to the chart it explains; the chart stays the structure, the paragraph stays the walkthrough.

## Optional deepening (formal)

Capability is **in** this skill so callers do not invent ad-hoc formal steps:

- When the user **explicitly** asks for formalization / exhaustive interleaving this turn, you may sketch a small TLA+ (or equivalent) model of the **same** nodes/edges already on the chart, and run TLC (or equivalent) if the environment has it.
- Scope the model to the question asked; do not expand into a consuming-repo formal-verification kit or a project-level meta skill.
- Report counterexamples back as ordinary path charts + reproduction paragraphs so the default audience still reads human artifacts.

If the user did not ask for formalization, stay on draw/list.

## Done when

- A chart (or short path list) is visible with the right role mark (`draft` / `temporary-diagnostic` / …).
- Node and edge names are checkable against the user’s vocabulary or the code under discussion.
- If reproduction was requested, the numbered paragraph sits beside the chart.
- Formal tools were used only under an explicit user ask this turn.

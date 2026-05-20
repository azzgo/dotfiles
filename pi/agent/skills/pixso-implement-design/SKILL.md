---
name: pixso-implement-design
description: Implements Pixso designs as production-ready application code with high visual fidelity using the Pixso MCP tools. Use when the user provides a Pixso design URL, an item-id, or asks to build/implement/update a component or page so it matches a Pixso design; also use when Claude needs to inspect Pixso nodes, variants, styles, variables, exports, or generated code before writing repository code.
---

# Pixso Implement Design

## Overview

Translate a Pixso node into repository code with minimal guesswork. Fetch the node structure, image reference, styles, variables, and variants first; then map them onto the target codebase's existing components, tokens, and conventions.

## Skill Boundaries

- Use this skill when the deliverable is code in the user's repository.
- If the user wants to edit the Pixso document itself, do not use this workflow as the primary plan.
- Treat Pixso generated code as reference input, not the final implementation style.

## Prerequisites

- Pixso MCP must be connected.
- Prefer a Pixso URL containing `item-id`, for example `https://host/app/design/file?item-id=1:2`.
- If no URL is available, operate on the currently selected Pixso node.
- Know the target framework before generating code hints: use `react` for React apps, `vue` for Vue apps, otherwise `html`.

## Required Workflow

Follow these steps in order. Do not skip discovery.

### Step 1: Resolve the target node

Get the node identity before implementation:

- If the user provides a Pixso URL, extract `item-id` from it.
- If the user provides an explicit node id such as `1:2`, use it directly.
- Otherwise use the currently selected node in Pixso.

### Step 2: Capture the visual source of truth

Fetch a visual reference immediately and keep it available during implementation.

- Run `get_image` for a fast reference image.
- If exact export constraints matter, run `get_export_image`.
- Use the image as the primary parity check while coding.

### Step 3: Fetch structural design context

Inspect the node before writing code:

- Run `get_node_dsl` to inspect layout, hierarchy, text, fills, strokes, effects, spacing, and sizing.
- If the node is a component set or likely stateful, run `get_variants`.
- If component reuse is likely, run `get_all_components`.

If the returned structure is large, focus on the specific node or major child sections that map to implementation boundaries.

### Step 4: Fetch styles and tokens

Do not hardcode design values before checking reusable styles:

- Run `get_local_styles` and `get_remote_styles` when style reuse matters.
- Run `get_variable_sets` and then `get_variables` for relevant sets when colors, spacing, typography, radii, or effects may already be tokenized.
- Prefer variables and styles over literal values when the target codebase also uses a token system.

### Step 5: Use generated code only as a hint

Run `design_to_code` only after the node is understood.

- Use the target framework that matches the repository.
- Treat generated code as a structural hint for layout and semantics.
- Do not paste generated output blindly into the repo.
- Replace generated naming, styling, and composition with repository conventions.

### Step 6: Map into project conventions

Translate the Pixso node into the repository's architecture:

- Reuse existing components before creating new ones.
- Map Pixso variables and styles onto design-system tokens already used by the project.
- Preserve layout intent: spacing, alignment, size constraints, typography hierarchy, radii, borders, shadows, and states.
- Prefer the project's accessibility and state patterns over literal design duplication when a conflict exists.

### Step 7: Validate for 1:1 parity

Before finishing, compare the implementation against the Pixso reference.

Validation checklist:

- Layout matches spacing, alignment, and sizing.
- Typography matches hierarchy, weight, size, and line height.
- Colors, borders, shadows, and radii are consistent.
- Variants and interaction states are implemented when present.
- Assets render crisply and use the provided Pixso export where needed.
- Responsive behavior follows the node structure and constraints.
- Accessibility is not regressed.

## Tool Selection Guide

- Use `get_image` for quick visual validation.
- Use `get_export_image` when exact output size, format, or export settings matter.
- Use `get_node_dsl` for authoritative structure and style inspection.
- Use `get_variants` to understand interactive states or component-set axes.
- Use `design_to_code` after discovery, not before.
- Use `get_all_components` when deciding whether a node is based on an existing component.
- Use `get_local_styles` / `get_remote_styles` for reusable style discovery.
- Use `get_variable_sets` + `get_variables` for token mapping.

Read `references/pixso-parity-checklist.md` when the implementation spans a page, complex section, or multiple component states.

## Implementation Rules

- Start from Pixso evidence, not assumptions.
- Do not invent assets if Pixso can export them.
- Avoid hardcoded magic numbers when the design already exposes reusable tokens or variables.
- Keep implementation minimal and local to the requested scope.
- Document any intentional deviation in the final handoff, including why it was necessary.

## Common Issues

### Missing fidelity

Cause: implementation started from generated code or screenshots alone.

Fix: go back to `get_node_dsl`, verify spacing, radii, typography, and effects, then re-check against the image.

### Unclear variants

Cause: only the default node was inspected.

Fix: run `get_variants` and implement the explicit state axes actually used by the design.

### Token mismatch

Cause: Pixso values and repo tokens differ.

Fix: prefer repo tokens for consistency, then make the smallest possible layout adjustments to recover visual parity.

### Oversized generated output

Cause: `design_to_code` was treated as final code.

Fix: reduce it to structure, then rebuild with the repo's components and style system.

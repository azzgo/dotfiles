# Pixso Parity Checklist

Use this checklist for page-level work, complex sections, or any task with multiple states.

## Before coding

- Confirm the exact node via `item-id` or current selection.
- Capture a fresh visual reference with `get_image` or `get_export_image`.
- Inspect `get_node_dsl` before opening implementation files.
- Check `get_variants` if the node may contain states or modes.
- Check variables and styles before hardcoding values.

## During implementation

- Split the node into implementation boundaries that match the repository.
- Reuse existing UI primitives first.
- Preserve vertical rhythm and internal spacing.
- Preserve text hierarchy before chasing minor decoration.
- Keep asset usage faithful to Pixso exports.

## Final review

- Compare the rendered UI against the Pixso image side by side.
- Verify default, hover, active, disabled, selected, or empty states when applicable.
- Verify truncation, wrapping, and overflow behavior.
- Verify icon sizes, stroke weight appearance, and padding around icons.
- Verify shadows, borders, radii, and background layering.
- Verify responsive behavior at the breakpoints implied by the repository.
- Record any intentional deviations in the final report.

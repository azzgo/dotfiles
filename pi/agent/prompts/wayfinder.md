---
name: wayfinder
description: Thin shortcut into the Personal Wayfinder skill. Methodology and command routing live in the wayfinder skill — this prompt only forwards.
argument-hint: "[init|chart <topic>|work|status|ui|help] or free text for smart entry"
---

Invoke the **Personal Wayfinder** skill and follow it exactly.

This prompt is a **thin shortcut only** — it owns no methodology, no rules, and no routing. The `wayfinder` skill is the single source of truth for hard rules, argument routing (`init` / `chart <topic>` / `work` / `status` / `ui` / `help` / free-text smart entry), the workspace layout (`~/.cache/wayfinder/<workspace-id>/`), and the taskmd convention.

Pass the user arguments through to the skill **raw** (do not substitute or reinterpret them).

User arguments: $@

---
name: nightshift
description: Thin shortcut into the nightshift skill. The board, schema, and command surface live in the skill — this prompt only forwards.
argument-hint: "[add|list|ready|check|run|report|show|review] or free text"
---

Invoke the **nightshift** skill and follow it exactly.

This prompt is a **thin shortcut only** — it owns no convention, no schema, no rules. The `nightshift` skill is the single source of truth for daytime spec writing, and `skills/nightshift/CONVENTION.md` is the single source of truth for the board layout, spec schema, and CLI verbs.

Common entry points (mirror only; the CLI usage text is authoritative):

- `add` — 把刚谈定的事写成 Spec（正文从 stdin 读，状态 draft）
- `ready <id>` — 唯一的状态升级动作，只有 ready 会被夜里派发
- `list` / `show <id>` / `check` — 只读
- `run [--until HH:MM]` / `report` / `review <id> --drop` — 夜间执行与早上检查

Pass the user arguments through to the skill **raw** (do not substitute or reinterpret them).

User arguments: $@

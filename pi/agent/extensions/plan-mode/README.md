# plan-mode

A local Pi extension for switching the agent into a read-only planning workflow before execution.

## What it does

- Adds `/plan` to toggle plan mode
- Adds `/todos` to show extracted plan steps
- Adds `Ctrl+Alt+P` as a shortcut for toggling plan mode
- Restricts available tools to read-only ones while plan mode is enabled
- Blocks non-allowlisted `bash` commands in plan mode
- Extracts numbered steps from a `Plan:` section
- Tracks execution progress with `[DONE:n]` markers and a small UI widget

## Main files

- `index.ts`
- `utils.ts`

## Dotfiles integration

This directory is version-controlled in `dotfiles` and linked into:

- `~/.pi/agent/extensions/plan-mode`

via `just install-pi`.

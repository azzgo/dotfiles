---
description: use chrome-devtools-cli skill to open chrome and do user command
---
Load and follow skill: `chrome-devtools-cli` (read `~/.pi/agent/skills/chrome-devtools-cli/SKILL.md`).

1. Ensure `chrome-devtools` CLI is available (`command -v chrome-devtools || npm i -g chrome-devtools-mcp@latest`).
2. Compute the project-scoped profile from the current working directory:
   ```bash
   PROJECT_HASH=$(printf '%s' "$PWD" | shasum | cut -c1-12)
   PROFILE_DIR=~/.cache/chrome-devtools-mcp/profiles/$PROJECT_HASH
   ```
   If the user explicitly asks for a separate/clean browser context, append a semantic suffix (e.g. `${PROJECT_HASH}-clean`).
3. Start the daemon in **headed** mode with the computed profile:
   ```bash
   chrome-devtools start --headless=false --userDataDir "$PROFILE_DIR"
   ```
4. Execute the user's command: `$@`
5. Pause and wait for the user's next instruction.
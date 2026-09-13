# CLI Route (Fallback)

Use only when MCP is not configured. The CLI runs a standalone daemon that **you** manage — start it project-scoped and leave it running (it preserves tabs and login state); clean it up when switching profiles or when the user asks.

First-time install: `npm i chrome-devtools-mcp@latest -g`, then `chrome-devtools status` to verify. See [installation.md](installation.md).

## SOP

1. **Compute profile** from `PWD`:
   ```bash
   PROJECT_HASH=$(printf '%s' "$PWD" | shasum | cut -c1-12)
   PROFILE_DIR=~/.cache/chrome-devtools-mcp/profiles/$PROJECT_HASH
   ```
   Optionally register the hash→path mapping for readability:
   ```bash
   mkdir -p ~/.cache/chrome-devtools-mcp/profiles
   MAPPING=~/.cache/chrome-devtools-mcp/profiles/.mapping.json
   [ -f "$MAPPING" ] || echo '{}' > "$MAPPING"
   jq --arg h "$PROJECT_HASH" --arg p "$PWD" '.[$h] = $p' "$MAPPING" > "$MAPPING.tmp" && mv "$MAPPING.tmp" "$MAPPING"
   ```
2. **Check status, start only if needed** — do not run `start`/`status`/`stop` before each command; the daemon persists.
   ```bash
   chrome-devtools status
   ```
   - Not running or wrong profile → `stop` first, then start project-scoped and headed:
     ```bash
     chrome-devtools start --headless=false --userDataDir "$PROFILE_DIR"
     ```
   - Each profile has its own daemon (different `--userDataDir` = different socket).
3. **Execute tools**:
   ```sh
   chrome-devtools <tool> [arguments] [flags]
   ```
   - Required arguments positionally; optional ones as flags; `--help` works on any command.
   - Output is plain Markdown-like text; `--output-format=json` for JSON.
4. **Snapshot → act** — see [tool-catalog.md](tool-catalog.md). State persists across commands.
5. **Leave it running** unless the user asks to stop or you are switching profiles:
   ```bash
   chrome-devtools stop   # stops daemon + browser
   ```
6. **Unrestricted file access** (only when writing outside the OS temp dir):
   ```bash
   chrome-devtools start --headless=false --allowUnrestrictedPaths=true --userDataDir "$PROFILE_DIR"
   ```

## Avoid

- `chrome-devtools start` with no flags — headless throwaway profile; use the project-scoped start instead.
- Running CLI and MCP routes against the same profile simultaneously.

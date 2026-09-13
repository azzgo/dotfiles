# MCP Route (Primary)

The `chrome-devtools-mcp` server runs as an MCP server attached to the agent session. The agent host spawns it on demand and tears it down with the session — **no daemon to start, status-check, or clean up manually**.

## Configuration

Already configured globally for pi in `~/.pi/agent/mcp.json` (symlinked from the dotfiles repo):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

For **per-project isolation**, add a project-level `.mcp.json` pinning the project profile:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y", "chrome-devtools-mcp@latest",
        "--headless=false",
        "--userDataDir=$HOME/.cache/chrome-devtools-mcp/profiles/<project-hash>"
      ]
    }
  }
}
```

Notes:
- `--headless=false` keeps the headed default; omit for headless.
- MCP config does not expand `$PWD`; compute the hash once and write the literal path.
- If both global and project config exist, follow the project one. If the project entry uses a *different* profile than the shared default, that is intentional isolation — do not "fix" it.
- Changing MCP config requires restarting the agent session to take effect.

## SOP

1. **Verify availability** — chrome-devtools tools are exposed in this session. If configured but absent, ask the user to restart the session; do not silently fall back to the CLI while config says MCP.
2. **Call tools directly** — the MCP tool set mirrors the CLI catalog exactly (see [tool-catalog.md](tool-catalog.md)); invoke e.g. `navigate_page`, `take_snapshot`, `click` as native tools.
3. **Snapshot → act** — `take_snapshot` to get `<uid>`s, then `click`/`fill`/etc. State persists across calls within the browser session.
4. **No lifecycle management** — never look for a daemon; do not run any `start`/`status`/`stop` equivalents. If the browser seems stuck, report it — the process belongs to the agent host.
5. **Unrestricted file access** — only needed when writing outside the OS temp dir; requires the server flag `--allowUnrestrictedPaths=true` in the MCP args (restart the session after editing config). Temp-dir writes (default `--filePath` targets under `/tmp`) work without it.

## Troubleshooting

- **Tools missing in session** — MCP config changed after session start → restart the session.
- **Wrong profile / lost login state** — a project-level `.mcp.json` overrides the global config; check which `--userDataDir` it pins.
- **Install/update** — `npm i chrome-devtools-mcp@latest -g` (or rely on `npx -y` picking latest); update takes effect on next session start.

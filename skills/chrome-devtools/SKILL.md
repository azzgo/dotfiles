---
name: chrome-devtools
description: "Automate Chrome via Chrome DevTools (CDP). MCP-first: use the chrome-devtools MCP server when configured, fall back to the chrome-devtools CLI otherwise. Forked from ChromeDevTools/chrome-devtools-mcp with project-scoped profiles and headed defaults."
disable-model-invocation: true
---

Chrome DevTools automation with two routes. **MCP is the primary route** — its server process is spawned and reaped by the agent host (pi), so there is no standalone daemon to clean up. The CLI is the fallback for environments where MCP is not configured (plain shell, scripts, non-pi agents).

## Route Selection

1. **MCP available?** If this session already exposes `chrome-devtools` MCP tools → follow [references/mcp-sop.md](references/mcp-sop.md).
2. **MCP configured but not loaded?** Check `~/.pi/agent/mcp.json` or the project's `.mcp.json` for a `chrome-devtools` entry. If present, the server is attached to the agent session — use MCP; if the tools are missing, the session needs a restart to pick up config.
3. **No MCP configured** (and you cannot/should not add one) → follow [references/cli-sop.md](references/cli-sop.md). Do not start a CLI daemon just because MCP tools exist — avoid running both routes against the same profile at once.

Tool names are identical on both routes; the only differences are invocation (direct MCP tool calls vs `chrome-devtools <tool>` shell commands) and daemon lifecycle (host-managed vs self-managed). The shared tool catalog and the snapshot/uid workflow live in [references/tool-catalog.md](references/tool-catalog.md).

## Shared Conventions

- **Headed by default** — a visible browser window, for debugging.
- **Project-scoped profiles** — each project gets its own Chrome user-data-dir; multiple projects never share a browser instance:
  ```bash
  PROJECT_HASH=$(printf '%s' "$PWD" | shasum | cut -c1-12)
  PROFILE_DIR=~/.cache/chrome-devtools-mcp/profiles/$PROJECT_HASH
  ```
  For a separate/clean/ephemeral browser, append a suffix: `${PROJECT_HASH}-clean`, `${PROJECT_HASH}-test`.
- **Workflow**: snapshot → get element `<uid>` → act (`click`/`fill`/…). State persists within the browser session.

  ```
  uid=1_0 RootWebArea "Example Domain" url="https://example.com/"
    uid=1_1 heading "Example Domain" level="1"
  ```
- **File access** is limited to the OS temp dir by default; writing elsewhere (screenshots, traces, uploads) requires the unrestricted-paths flag (see the SOPs).

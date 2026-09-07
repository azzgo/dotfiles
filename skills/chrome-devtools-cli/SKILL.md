---
name: chrome-devtools-cli
description: "Use this skill to write shell scripts or run shell commands to automate tasks in the browser or otherwise use Chrome DevTools via CLI. Forked from ChromeDevTools/chrome-devtools-mcp with project-scoped profiles and headed defaults."
disable-model-invocation: true
---

The `chrome-devtools` CLI lets you interact with the browser from the terminal. This is a **forked** version of the upstream skill, customized for:
- **Headed mode by default** (visible browser window for debugging)
- **Project-scoped profiles** — each project directory gets its own isolated Chrome instance
- **No auto-invocation** — only triggered via prompts (e.g. `/open-chrome-pause`)

## Project-Scoped Profile

Every project gets its own Chrome user-data-dir so that multiple projects never share a browser instance.

Compute the profile from the current working directory:

```bash
PROJECT_HASH=$(printf '%s' "$PWD" | shasum | cut -c1-12)
PROFILE_DIR=~/.cache/chrome-devtools-mcp/profiles/$PROJECT_HASH
```

Register the mapping for human readability (optional but recommended on first use):

```bash
mkdir -p ~/.cache/chrome-devtools-mcp/profiles
MAPPING=~/.cache/chrome-devtools-mcp/profiles/.mapping.json
# Initialize or update the mapping
if [ ! -f "$MAPPING" ]; then echo '{}' > "$MAPPING"; fi
echo "$(jq --arg h "$PROJECT_HASH" --arg p "$PWD" '.[$h] = $p' "$MAPPING")" > "$MAPPING"
```

**Rules:**
- Default profile: `~/.cache/chrome-devtools-mcp/profiles/<project-hash>` — computed from `PWD`
- If the user explicitly asks for a separate/clean/ephemeral browser, append a suffix: `${PROJECT_HASH}-clean`, `${PROJECT_HASH}-test`, etc.
- Each profile has its own daemon instance (different `--userDataDir` = different socket)
- Before `start`, check `chrome-devtools status`; if a daemon is running on a *different* profile, `stop` it first, then `start` with the correct profile
- **Do not** run `start`/`status`/`stop` before each command — the daemon persists. Only manage lifecycle when switching profiles or on explicit request.

## Setup

_First-time installation only — see [references/installation.md](references/installation.md)._

```bash
npm i chrome-devtools-mcp@latest -g
chrome-devtools status
```

## AI Workflow

1. **Compute profile** from `PWD` (see above).
2. **Start daemon** (if not running or wrong profile):
   ```bash
   chrome-devtools start --headless=false --userDataDir "$PROFILE_DIR"
   ```
3. **Execute**: Run tools directly (e.g., `chrome-devtools list_pages`).
4. **Inspect**: Use `take_snapshot` to get an element `<uid>`.
5. **Act**: Use `click`, `fill`, etc. State persists across commands.

Snapshot example:

```
uid=1_0 RootWebArea "Example Domain" url="https://example.com/"
  uid=1_1 heading "Example Domain" level="1"
```

## Permissions & File Access

By default, the server only has access to the **OS temp directory**. File-saving parameters (`--filePath`, `--outputDirPath`) and `upload_file` outside temp require:

```bash
chrome-devtools start --headless=false --allowUnrestrictedPaths=true --userDataDir "$PROFILE_DIR"
```

## Command Usage

```sh
chrome-devtools <tool> [arguments] [flags]
```

- Required arguments are passed positionally; optional arguments use flags.
- Use `--help` on any command for usage details.
- Output defaults to plain Markdown-like text; pass `--output-format=json` for JSON.

## Input Automation (<uid> from snapshot)

```bash
chrome-devtools take_snapshot
chrome-devtools click "id"
chrome-devtools click "id" --dblClick true --includeSnapshot true
chrome-devtools drag "src" "dst"
chrome-devtools drag "src" "dst" --includeSnapshot true
chrome-devtools fill "id" "text"
chrome-devtools fill "id" "text" --includeSnapshot true
chrome-devtools handle_dialog accept
chrome-devtools handle_dialog dismiss --promptText "hi"
chrome-devtools hover "id"
chrome-devtools hover "id" --includeSnapshot true
chrome-devtools press_key "Enter"
chrome-devtools press_key "Control+A" --includeSnapshot true
chrome-devtools type_text "hello"
chrome-devtools type_text "hello" --submitKey "Enter"
chrome-devtools upload_file "id" "file.txt"
chrome-devtools upload_file "id" "file.txt" --includeSnapshot true
```

## Navigation

```bash
chrome-devtools close_page 1
chrome-devtools list_pages
chrome-devtools navigate_page --url "https://example.com"
chrome-devtools navigate_page --type "reload" --ignoreCache true
chrome-devtools navigate_page --url "https://example.com" --timeout 5000
chrome-devtools navigate_page --handleBeforeUnload "accept"
chrome-devtools navigate_page --type "back" --initScript "foo()"
chrome-devtools new_page "https://example.com"
chrome-devtools new_page "https://example.com" --background true --timeout 5000
chrome-devtools new_page "https://example.com" --isolatedContext "ctx"
chrome-devtools select_page 1
chrome-devtools select_page 1 --bringToFront true
```

## Emulation

```bash
chrome-devtools emulate --networkConditions "Offline"
chrome-devtools emulate --cpuThrottlingRate 4 --geolocation "0x0"
chrome-devtools emulate --colorScheme "dark" --viewport "1920x1080"
chrome-devtools emulate --userAgent "Mozilla/5.0..."
chrome-devtools resize_page 1920 1080
```

## Performance

```bash
chrome-devtools performance_analyze_insight "1" "LCPBreakdown"
chrome-devtools performance_start_trace true false
chrome-devtools performance_start_trace true true --filePath "t.json.gz"
chrome-devtools performance_stop_trace
chrome-devtools performance_stop_trace --filePath "t.json.gz"
```

## Network

```bash
chrome-devtools get_network_request
chrome-devtools get_network_request --reqid 1 --requestFilePath "req.md"
chrome-devtools get_network_request --responseFilePath "res.md"
chrome-devtools list_network_requests
chrome-devtools list_network_requests --pageSize 50 --pageIdx 0
chrome-devtools list_network_requests --resourceTypes Fetch
chrome-devtools list_network_requests --includePreservedRequests true
```

## Debugging & Inspection

```bash
chrome-devtools evaluate_script "() => document.title"
chrome-devtools evaluate_script "(a) => a.innerText" --args 1_4
chrome-devtools get_console_message 1
chrome-devtools lighthouse_audit --mode "navigation"
chrome-devtools lighthouse_audit --mode "snapshot" --device "mobile"
chrome-devtools lighthouse_audit --outputDirPath ./out
chrome-devtools list_console_messages
chrome-devtools list_console_messages --pageSize 20 --pageIdx 1
chrome-devtools list_console_messages --types error --types info
chrome-devtools list_console_messages --includePreservedMessages true
chrome-devtools take_screenshot
chrome-devtools take_screenshot --fullPage true --format "jpeg" --quality 80
chrome-devtools take_screenshot --uid "id" --filePath "s.png"
chrome-devtools take_snapshot
chrome-devtools take_snapshot --verbose true --filePath "s.txt"
```

## Extensions

```bash
chrome-devtools list_extensions
chrome-devtools install_extension "/path/to/extension"
chrome-devtools uninstall_extension "extension_id"
chrome-devtools reload_extension "extension_id"
chrome-devtools trigger_extension_action "extension_id"
```

## Service Management

```bash
chrome-devtools start   # Start (headless, throwaway profile — avoid; use project-scoped start instead)
chrome-devtools status  # Check if running
chrome-devtools stop    # Stop daemon + browser
```

**Preferred start (project-scoped, headed):**

```bash
PROJECT_HASH=$(printf '%s' "$PWD" | shasum | cut -c1-12)
chrome-devtools start --headless=false --userDataDir ~/.cache/chrome-devtools-mcp/profiles/$PROJECT_HASH
```

Leaving the daemon running preserves tabs and login state — prefer leaving it running unless asked to stop or switching projects.

# Tool Catalog (Shared by MCP and CLI Routes)

Tool names and semantics are identical on both routes. MCP: call tools directly. CLI: `chrome-devtools <tool> [arguments] [flags]` (required args positional, optional as flags, `--output-format=json` for JSON).

## Input Automation (<uid> from snapshot)

```bash
take_snapshot
click "id"
click "id" --dblClick true --includeSnapshot true
drag "src" "dst"
drag "src" "dst" --includeSnapshot true
fill "id" "text"
fill "id" "text" --includeSnapshot true
handle_dialog accept
handle_dialog dismiss --promptText "hi"
hover "id"
hover "id" --includeSnapshot true
press_key "Enter"
press_key "Control+A" --includeSnapshot true
type_text "hello"
type_text "hello" --submitKey "Enter"
upload_file "id" "file.txt"
upload_file "id" "file.txt" --includeSnapshot true
```

## Navigation

```bash
list_pages
select_page 1
select_page 1 --bringToFront true
new_page "https://example.com"
new_page "https://example.com" --background true --timeout 5000
new_page "https://example.com" --isolatedContext "ctx"
navigate_page --url "https://example.com"
navigate_page --type "reload" --ignoreCache true
navigate_page --url "https://example.com" --timeout 5000
navigate_page --handleBeforeUnload "accept"
navigate_page --type "back" --initScript "foo()"
close_page 1
```

## Emulation

```bash
emulate --networkConditions "Offline"
emulate --cpuThrottlingRate 4 --geolocation "0x0"
emulate --colorScheme "dark" --viewport "1920x1080"
emulate --userAgent "Mozilla/5.0..."
resize_page 1920 1080
```

## Performance

```bash
performance_start_trace true false
performance_start_trace true true --filePath "t.json.gz"
performance_stop_trace
performance_stop_trace --filePath "t.json.gz"
performance_analyze_insight "1" "LCPBreakdown"
```

## Network

```bash
list_network_requests
list_network_requests --pageSize 50 --pageIdx 0
list_network_requests --resourceTypes Fetch
list_network_requests --includePreservedRequests true
get_network_request
get_network_request --reqid 1 --requestFilePath "req.md"
get_network_request --responseFilePath "res.md"
```

## Debugging & Inspection

```bash
take_snapshot
take_snapshot --verbose true --filePath "s.txt"
take_screenshot
take_screenshot --fullPage true --format "jpeg" --quality 80
take_screenshot --uid "id" --filePath "s.png"
evaluate_script "() => document.title"
evaluate_script "(a) => a.innerText" --args 1_4
list_console_messages
list_console_messages --pageSize 20 --pageIdx 1
list_console_messages --types error --types info
list_console_messages --includePreservedMessages true
get_console_message 1
lighthouse_audit --mode "navigation"
lighthouse_audit --mode "snapshot" --device "mobile"
lighthouse_audit --outputDirPath ./out
```

## Extensions

```bash
list_extensions
install_extension "/path/to/extension"
uninstall_extension "extension_id"
reload_extension "extension_id"
trigger_extension_action "extension_id"
```

## CLI-only lifecycle (not part of the MCP route)

```bash
chrome-devtools start   # standalone daemon; see cli-sop.md for project-scoped start
chrome-devtools status
chrome-devtools stop
```

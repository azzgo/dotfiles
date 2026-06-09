# Blocking Commands — Use Interactive Shell
Commands that may block (editor popup, prompt, interactive process) must use `interactive_shell` instead of `bash`.
- `interactive_shell({ command: "...", mode: "hands-free" })` — user can watch/take over
- `interactive_shell({ command: "...", mode: "dispatch" })` — fire-and-forget
- Set `GIT_EDITOR=true` / `GIT_SEQUENCE_EDITOR=true` to suppress unwanted editor popups.

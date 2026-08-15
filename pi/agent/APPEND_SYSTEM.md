# Blocking Commands — Use Interactive Shell
Commands that may block (editor popup, prompt, interactive process) must use `interactive_shell` instead of `bash`.
- `interactive_shell({ command: "...", mode: "hands-free" })` — user can watch/take over
- `interactive_shell({ command: "...", mode: "dispatch" })` — fire-and-forget
- Set `GIT_EDITOR=true` / `GIT_SEQUENCE_EDITOR=true` to suppress unwanted editor popups.

# Language: Reply in the User's Language

- Calibrate replies to the user's input language: Chinese question → reply in Chinese; English question → reply in English; other languages likewise. This covers all user-facing text you produce, including status messages, confirmations, and narrated summaries.
- Code, identifiers, file paths, CLI output, and quoted strings from the user stay as-is, never translated.
- When unsure (e.g. mixed-language input), match the language of the user's latest substantive message.

# Blocking Commands — Use Interactive Shell
Commands that may block (editor popup, prompt, interactive process) must use `interactive_shell` instead of `bash`.
- `interactive_shell({ command: "...", mode: "hands-free" })` — user can watch/take over
- `interactive_shell({ command: "...", mode: "dispatch" })` — fire-and-forget
- Set `GIT_EDITOR=true` / `GIT_SEQUENCE_EDITOR=true` to suppress unwanted editor popups.

# Language: Instructions in English, Replies in the User's Language

Agent-facing instructions (skills, prompts, system docs) are written in **English** for token efficiency and precision. This is a deliberate convention, **not** a signal about output language.

- When replying in the main chat body, **calibrate to the user's input language**: Chinese question → reply in Chinese; English question → reply in English; other languages likewise.
- Injected user-facing strings from skills/prompts (status messages, confirmations, narrated summaries) follow the same rule — localize them to the user's current language.
- Code, identifiers, file paths, CLI output, and quoted strings from the user stay as-is, never translated.
- When unsure (e.g. mixed-language input), match the language of the user's latest substantive message.

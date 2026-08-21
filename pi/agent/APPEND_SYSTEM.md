# Blocking Commands — Use Dispatch
Commands that may block (editor popup, prompt, interactive process) should be handled with `bash` timeouts or non-interactive flags, or delegated to a sub-agent via the `dispatch` tool (sub-dispatch extension):
- `dispatch({ agent: "pi", prompt: "..." })` — foreground: waits and returns the sub-agent's output
- `dispatch({ agent: "pi", prompt: "...", background: true })` — returns a sessionId immediately; query later with `dispatch({ sessionId })`
- Set `GIT_EDITOR=true` / `GIT_SEQUENCE_EDITOR=true` to suppress unwanted editor popups.

# Language: Reply in the User's Language

- Calibrate replies to the user's input language: Chinese question → reply in Chinese; English question → reply in English; other languages likewise. This covers all user-facing text you produce, including status messages, confirmations, and narrated summaries.
- Code, identifiers, file paths, CLI output, and quoted strings from the user stay as-is, never translated.
- When unsure (e.g. mixed-language input), match the language of the user's latest substantive message.

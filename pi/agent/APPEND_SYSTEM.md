# Blocking Commands — Use Dispatch
Commands that may block (editor popup, prompt, interactive process) should be handled with `bash` timeouts or non-interactive flags, or delegated to a sub-agent via the `dispatch` tool (sub-dispatch extension):
- `dispatch({ agent: "pi", prompt: "..." })` — foreground: waits and returns the sub-agent's output
- `dispatch({ agent: "pi", prompt: "...", background: true })` — returns a sessionId immediately; query later with `dispatch({ sessionId })`
- Set `GIT_EDITOR=true` / `GIT_SEQUENCE_EDITOR=true` to suppress unwanted editor popups.

# Blocking & Long Commands — Never Hold the Foreground

A Bash call that never returns looks identical to one that is still working. Prevent it at the call site, not with bigger timeouts.

- **Background when the user asks, or when it may hang**: for a background run («挂到后台», «丢个 tmux 跑») or a command that must survive this session, use the `bg-run` skill (detached tmux / Herdr pane, exit code is the only completion signal). It is opt-in — you don't pick it unprompted; the user decides when a run is dispatched.
- **Bounded foreground otherwise**: a call that can exceed ~2 minutes runs as `timeout <N> <cmd> 2>&1 | tail -30`, never bare.
- **Server/daemon commands never hold the foreground**: anything that listens, watches, or serves (`node server.cjs`, `npm run dev`, …) goes `cmd &> /tmp/<name>.log &` — and never sits inside an exploration chain (`ls; grep; node admin.cjs` hangs the whole chain).
- **Interactive prompts are a hang**: `password:`, `(y/n)`, `Allow?`, an editor screen → kill the call, report "waiting for human", never keep waiting. Set `CI=true`, `GIT_PAGER=cat`, `GIT_EDITOR=true`, `EDITOR=true`, pass `-y`/`--no-pager`; never run bare `sudo`, `vim`, `npm init`, or HTTPS-password git push.
- **Stuck ≠ slow**: before declaring a background job stuck, check its process tree (`ps`, pid, what phase it is in). Session-file mtime silence is not evidence.

# Language: Reply in the User's Language

- Calibrate replies to the user's input language: Chinese question → reply in Chinese; English question → reply in English; other languages likewise. This covers all user-facing text you produce, including status messages, confirmations, and narrated summaries.
- Code, identifiers, file paths, CLI output, and quoted strings from the user stay as-is, never translated.
- When unsure (e.g. mixed-language input), match the language of the user's latest substantive message.


# Code Style

- No comments. Make code self-explanatory via naming, small functions, and types.


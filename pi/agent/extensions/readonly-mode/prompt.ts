/**
 * System-prompt instructions injected when read-only mode is active.
 *
 * edit/write are removed from the active tool set entirely, so the model
 * never sees them; these instructions cover bash restrictions and the
 * intent of the mode.
 */

export function getReadonlyInstructions(): string {
  return `[READ-ONLY MODE ACTIVE]
You are in read-only mode — exploration mode for planning, code review, and architecture analysis.

- bash is restricted to read-only commands (ls, grep, cat, head, tail, pwd, file, stat, which, type, env, echo, printf, sort, uniq, wc, find, git status/log/diff/show/blame, git branch/tag/remote, curl without file writes, and similar safe commands)
- file-modification tools (edit/write) are not available in this mode
- External tools (MCP, skills, custom tools) are NOT restricted

You MAY propose code changes, suggest edits, and show code snippets in your response.
This mode is ideal for code review, planning, architecture exploration, and codebase navigation.`;
}

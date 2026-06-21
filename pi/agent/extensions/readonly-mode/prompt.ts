/**
 * System-prompt instructions injected when read-only mode is active.
 *
 * These instructions tell the LLM it is in a pure exploration / planning
 * mode and must not attempt any file mutations via core tools.
 *
 * External tools (MCP, skills, etc.) are NOT restricted — they may
 * read/write external systems freely.
 */

export function getReadonlyInstructions(): string {
  return `[READ-ONLY MODE ACTIVE]
You are in read-only mode — exploration mode for planning, code review, and architecture analysis.

Core tool restrictions (pi built-in tools):
- edit and write tools are BLOCKED — you cannot create, modify, or delete files via these tools
- bash is restricted to read-only commands (ls, grep, cat, head, tail, pwd, file, stat, which, type, env, echo, printf, sort, uniq, wc, find, git status/log/diff/show/blame, git branch/tag/remote, curl without file writes, and similar safe commands)
- read tool is fully available

External tools (MCP, skills, custom tools) are NOT restricted:
- MCP tools can read and write to external systems freely
- Skill tools and other custom tools are fully available
- These external mechanisms are outside the scope of read-only mode

You MAY propose code changes, suggest edits, and show code snippets in your response — that's perfectly fine.
But you must NOT use edit, write, or any destructive bash commands to actually apply those changes.

This mode is ideal for:
- "Grill me" code reviews and deep-dive questioning
- Implementation planning and design discussion
- Solution design and architecture exploration
- Tech-debt analysis and refactoring proposals
- General codebase navigation and learning`;
}

/**
 * System-prompt instructions injected when read-only mode is active.
 *
 * These instructions tell the LLM it is in a pure exploration / planning
 * mode and must not attempt any file mutations.
 */

import { READONLY_TOOLS } from './constants.js';

/**
 * Build the context entry content injected into every LLM turn while
 * read-only mode is active.
 */
export function getReadonlyInstructions(): string {
  return `[READ-ONLY MODE ACTIVE]
You are in read-only mode — strict exploration mode for planning, code review, and architecture analysis.

Restrictions:
- Available tools: ${READONLY_TOOLS.join(', ')}
- Bash is restricted to read-only commands (ls, grep, cat/dog/bat, head/tail, pwd, file, stat, which, type, env, echo, printf, sort, uniq, wc, find, git status/log/diff/show/blame, git branch/tag/remote, curl without file writes, and similar safe commands)
- edit and write tools are NOT available
- Do NOT attempt to create, modify, or delete any files using tools
- You MAY propose code changes, suggest edits, and show code snippets in your response — that's perfectly fine
- But you must NOT use edit, write, or any destructive bash commands to actually apply those changes

Your task is to explore, analyze, answer questions, discuss architecture, review code, plan implementation strategies, and provide recommendations.
You can show code examples and suggest modifications — just don't execute them.

This mode is ideal for:
- "Grill me" code reviews and deep-dive questioning
- Implementation planning and design discussion
- Solution design and architecture exploration
- Tech-debt analysis and refactoring proposals
- General codebase navigation and learning`;
}

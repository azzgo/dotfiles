/**
 * Read-only mode constants.
 *
 * READONLY_TOOLS defines the minimal tool set available when
 * read-only mode is active — only read, safe bash, and search.
 */
export const READONLY_TOOLS = ['read', 'bash', 'grep', 'find', 'ls'];
export const STATE_ENTRY = 'readonly-mode';
export const CONTEXT_ENTRY = 'readonly-mode-context';
export const READONLY_FLAG = 'readonly';
export const READONLY_CMD = 'readonly';

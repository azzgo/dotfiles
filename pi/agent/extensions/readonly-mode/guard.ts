/**
 * Shared read-only authorization guard (cross-extension singleton).
 *
 * readonly-mode owns this module and keeps the runtime `enabled` state here;
 * other extensions (code-mode) import it to authorize sub-calls before
 * executing them. readonly-mode itself stays unaware of its consumers.
 *
 * Sharing mechanism: pi's extension loader creates one jiti instance per
 * extension with moduleCache: false, so a plain module-level const is NOT
 * shared between two extensions. Symbol.for + globalThis is the shared
 * channel across module instances.
 */
import { isSafeCommand } from './utils.js';

export interface AuthorizeResult {
  block: true;
  reason: string;
}

class ReadonlyGuard {
  private enabled = false;

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  /** Returns a block verdict when readonly is ON and the call mutates state; null = allow. */
  authorize(toolName: string, input: Record<string, unknown>): AuthorizeResult | null {
    if (!this.enabled) return null;

    if (toolName === 'edit' || toolName === 'write') {
      return {
        block: true,
        reason:
          'Read-only mode: file modifications are not allowed. Use /readonly to exit read-only mode first.',
      };
    }

    if (toolName === 'bash') {
      const command = input.command as string;
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `Read-only mode: command blocked. Only read-only commands are allowed.\nCommand: ${command}\nUse /readonly to exit read-only mode first.`,
        };
      }
    }

    return null;
  }
}

const GUARD_KEY = Symbol.for('pi.extensions.readonly-mode.guard');
const g = globalThis as Record<symbol, unknown>;
if (!g[GUARD_KEY]) {
  g[GUARD_KEY] = new ReadonlyGuard();
}
export const readonlyGuard = g[GUARD_KEY] as ReadonlyGuard;

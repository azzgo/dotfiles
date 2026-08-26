/**
 * Read-only mode controller.
 *
 * Delegates the enabled/disabled state to the shared readonly guard
 * (guard.ts) and handles UI indicators and state persistence.
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { STATE_ENTRY } from './constants.js';
import { readonlyGuard } from './guard.js';
import { findSavedReadonlyState, type PersistedState, type StateEntry } from './state.js';

export class ReadonlyController {
  constructor(private readonly pi: ExtensionAPI) {}

  isEnabled(): boolean {
    return readonlyGuard.isEnabled();
  }

  enableFromFlag(): void {
    readonlyGuard.enable();
  }

  enter(ctx: ExtensionContext): void {
    readonlyGuard.enable();
    this.updateUI(ctx);
    this.persist();
    ctx.ui.notify('🛡️ Read-only mode ON — core tools restricted, MCP/skills unrestricted', 'info');
  }

  exit(ctx: ExtensionContext): void {
    readonlyGuard.disable();
    this.updateUI(ctx);
    this.persist();
    ctx.ui.notify('🛡️ Read-only mode OFF — full tool access restored', 'info');
  }

  toggle(ctx: ExtensionContext): void {
    if (this.isEnabled()) {
      this.exit(ctx);
    } else {
      this.enter(ctx);
    }
  }

  restore(ctx: ExtensionContext, entries: StateEntry[]): void {
    const saved = findSavedReadonlyState(entries);
    if (saved !== undefined) {
      saved ? readonlyGuard.enable() : readonlyGuard.disable();
    }

    this.updateUI(ctx);
  }

  reset(): void {
    readonlyGuard.disable();
  }

  private persist(): void {
    this.pi.appendEntry<PersistedState>(STATE_ENTRY, {
      readonlyMode: readonlyGuard.isEnabled(),
    });
  }

  private updateUI(ctx: ExtensionContext): void {
    ctx.ui.setStatus(
      'readonly-mode',
      readonlyGuard.isEnabled() ? ctx.ui.theme.fg('accent', '🛡️ readonly') : undefined,
    );
  }
}

/**
 * Read-only mode controller.
 *
 * Manages the enabled/disabled state, tool visibility, UI indicators,
 * and state persistence.
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { STATE_ENTRY } from './constants.js';
import { findSavedReadonlyState, type PersistedState, type StateEntry } from './state.js';

export class ReadonlyController {
  private enabled = false;

  constructor(private readonly pi: ExtensionAPI) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  enableFromFlag(): void {
    this.enabled = true;
  }

  enter(ctx: ExtensionContext): void {
    this.enabled = true;
    this.updateUI(ctx);
    this.persist();
    ctx.ui.notify('🛡️ Read-only mode ON — core tools restricted, MCP/skills unrestricted', 'info');
  }

  exit(ctx: ExtensionContext): void {
    this.enabled = false;
    this.updateUI(ctx);
    this.persist();
    ctx.ui.notify('🛡️ Read-only mode OFF — full tool access restored', 'info');
  }

  toggle(ctx: ExtensionContext): void {
    if (this.enabled) {
      this.exit(ctx);
    } else {
      this.enter(ctx);
    }
  }

  restore(ctx: ExtensionContext, entries: StateEntry[]): void {
    const saved = findSavedReadonlyState(entries);
    if (saved !== undefined) {
      this.enabled = saved;
    }

    this.updateUI(ctx);
  }

  reset(): void {
    this.enabled = false;
  }

  private persist(): void {
    this.pi.appendEntry<PersistedState>(STATE_ENTRY, {
      readonlyMode: this.enabled,
    });
  }

  private updateUI(ctx: ExtensionContext): void {
    ctx.ui.setStatus(
      'readonly-mode',
      this.enabled ? ctx.ui.theme.fg('accent', '🛡️ readonly') : undefined,
    );
  }
}

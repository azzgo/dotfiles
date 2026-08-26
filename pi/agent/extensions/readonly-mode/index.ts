/**
 * Read-only mode extension for pi.
 *
 * Provides a lightweight toggle (/readonly, --readonly) that restricts the agent to read-only tools — perfect for:
 *   - "Grill me" code reviews & deep-dive questioning
 *   - Implementation planning & design discussion
 *   - Architecture exploration & tech-debt analysis
 *   - General codebase navigation & learning
 *
 * Reference: @dreki-gg/pi-ask-mode (adapted for broader read-only scenarios)
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { CONTEXT_ENTRY, READONLY_CMD, READONLY_FLAG } from './constants.js';
import { ReadonlyController } from './controller.js';
import { readonlyGuard } from './guard.js';
import { getReadonlyInstructions } from './prompt.js';
import type { StateEntry } from './state.js';

export default function readonlyMode(pi: ExtensionAPI): void {
  const readonlyCtrl = new ReadonlyController(pi);

  // ── CLI flag ──────────────────────────────────────────────────
  pi.registerFlag(READONLY_FLAG, {
    description: 'Start in read-only mode (exploration, planning, code review)',
    type: 'boolean',
    default: false,
  });

  // ── Slash command ─────────────────────────────────────────────
  pi.registerCommand(READONLY_CMD, {
    description: 'Toggle read-only mode',
    handler: async (args, ctx) => {
      readonlyCtrl.toggle(ctx);
      if (args?.trim()) {
        pi.sendUserMessage(args.trim());
      }
    },
  });

  // ── Keyboard shortcut (also toggle) ───────────────────────────
  // Fires when the editor is focused. To change the key, edit this line.
  pi.registerShortcut('ctrl+shift+r', {
    description: 'Toggle read-only mode',
    handler: async (ctx) => {
      readonlyCtrl.toggle(ctx);
    },
  });

  // ── Block destructive tool calls ──────────────────────────────
  pi.on('tool_call', async (event) => {
    return readonlyGuard.authorize(event.toolName, (event.input ?? {}) as Record<string, unknown>) ?? undefined;
  });

  // ── Inject context message on each turn ───────────────────────
  pi.on('before_agent_start', async () => {
    if (!readonlyCtrl.isEnabled()) return;

    return {
      message: {
        customType: CONTEXT_ENTRY,
        content: getReadonlyInstructions(),
        display: false,
      },
    };
  });

  // ── Filter out stale context entries when mode is off ─────────
  pi.on('context', async (event) => {
    if (readonlyCtrl.isEnabled()) return;

    return {
      messages: event.messages.filter((message) => {
        const msg = message as typeof message & { customType?: string };
        return msg.customType !== CONTEXT_ENTRY;
      }),
    };
  });

  // ── Restore state on session start ────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    if (pi.getFlag(READONLY_FLAG) === true) {
      readonlyCtrl.enableFromFlag();
    }

    readonlyCtrl.restore(ctx, ctx.sessionManager.getEntries() as StateEntry[]);
  });

  // ── Reset & restore on tree navigation ────────────────────────
  pi.on('session_tree', async (_event, ctx) => {
    readonlyCtrl.reset();
    const entries = (ctx.sessionManager.getBranch?.() ??
      ctx.sessionManager.getEntries()) as StateEntry[];
    readonlyCtrl.restore(ctx, entries);
  });
}

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

const INSTRUCTIONS_SECTION = 'readonly-instructions';
const WRITE_TOOLS = ['edit', 'write'];


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

  // ── System-prompt section + active-tool filtering per turn ────
  //
  // Uses structured systemPromptOptions edits (not full systemPrompt
  // replacement and not per-turn injected messages): Pi diffs the sections
  // against the previous turn and appends a single patch, preserving the
  // provider's cached prompt prefix. edit/write are also removed from the
  // active tool set so the model never sees (or attempts) them; the
  // tool_call guard stays as the last line of defense. Deactivation
  // restores the removed tools, deferred a turn when code mode is on
  // (run_code active) because code-mode owns the active set then.
  let removedTools: string[] | null = null;
  let restorePending = false;

  pi.on('before_agent_start', async (event) => {
    const sections = event.systemPromptOptions.sections;
    if (readonlyCtrl.isEnabled()) {
      if (removedTools === null) {
        const active = pi.getActiveTools();
        removedTools = active.filter((name) => WRITE_TOOLS.includes(name));
        if (removedTools.length > 0) {
          pi.setActiveTools(active.filter((name) => !WRITE_TOOLS.includes(name)));
        }
      }
      event.systemPromptOptions.sections = {
        ...sections,
        [INSTRUCTIONS_SECTION]: getReadonlyInstructions(),
      };
      return;
    }

    if (sections) delete sections[INSTRUCTIONS_SECTION];
    if (removedTools === null && !restorePending) return;
    if (pi.getActiveTools().includes('run_code')) {
      restorePending = true;
      return;
    }
    const active = pi.getActiveTools();
    const registered = new Set(pi.getAllTools().map((tool) => tool.name));
    const toRestore = [...(removedTools ?? []), ...(restorePending ? WRITE_TOOLS : [])].filter(
      (name) => registered.has(name) && !active.includes(name),
    );
    if (toRestore.length > 0) pi.setActiveTools([...active, ...toRestore]);
    removedTools = null;
    restorePending = false;
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
    removedTools = null;
    restorePending = false;
    if (pi.getFlag(READONLY_FLAG) === true) {
      readonlyCtrl.enableFromFlag();
    }

    readonlyCtrl.restore(ctx, ctx.sessionManager.getEntries() as StateEntry[]);
  });

  // ── Reset & restore on tree navigation ────────────────────────
  removedTools = null;
  restorePending = false;

  pi.on('session_tree', async (_event, ctx) => {
    readonlyCtrl.reset();
    const entries = (ctx.sessionManager.getBranch?.() ??
      ctx.sessionManager.getEntries()) as StateEntry[];
    readonlyCtrl.restore(ctx, entries);
  });
}

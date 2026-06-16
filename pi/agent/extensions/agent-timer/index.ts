/**
 * agent-timer — Standalone pi extension for per-turn agent duration display.
 *
 * Shows agent running time in the status bar:
 *   ● Agent · 2h 35m 12s   (active turn, live count-up, resets each turn)
 *   ○ Agent · 2h 35m 12s   (idle, frozen at last completed turn's duration)
 *   ○ Last run: 2h 35m     (after shutdown, persisted to disk)
 *
 * Per-turn timing with sub-agent awareness:
 *   When interactive_shell dispatch/hands-free sub-agents are running,
 *   the timer keeps counting through turn_end boundaries and does NOT
 *   reset on the subsequent triggerTurn turn_start. This ensures the
 *   wall-clock time spent waiting for sub-agents is accurately reflected.
 *
 *   ● = counting (active turn OR sub-agent running)
 *   ○ = frozen  (truly idle, no sub-agent)
 */

import type { ExtensionAPI, ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// =============================================================================
// Types
// =============================================================================

interface LastRunData {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
}

// =============================================================================
// Persistence
// =============================================================================

function getStateFilePath(): string {
  const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, ".agent-timer-last-run.json");
}

async function writeLastRun(data: LastRunData): Promise<void> {
  try {
    await writeFile(getStateFilePath(), JSON.stringify(data), "utf8");
  } catch {
    // Best-effort persistence
  }
}

async function readLastRun(): Promise<LastRunData | null> {
  try {
    const raw = await readFile(getStateFilePath(), "utf8");
    return JSON.parse(raw) as LastRunData;
  } catch {
    return null;
  }
}

// =============================================================================
// Duration formatting
// =============================================================================

export function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatTimeAgo(ms: number): string {
  if (ms < 0) return "just now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// =============================================================================
// Timer state machine
// =============================================================================
//
// Timing model with sub-agent awareness:
//   ● (active) — timer resets to 0 at turn_start, live count-up every second
//   ● (sub-agent) — timer keeps counting through turn_end while sub-agent runs
//   ○ (idle)   — timer freezes, shows the last completed turn's duration
//
// Sub-agent detection via tool_call interception:
//   - interactive_shell with mode:"dispatch" or mode:"hands-free" → increment counter
//   - interactive_shell with kill:true or dismissBackground → decrement counter
//   - turn_end: if counter > 0 → keep counting (don't freeze)
//   - turn_start: if counter > 0 → decrement, keep counting (don't reset)
//   - Counter handles multiple concurrent sub-agents correctly: each triggerTurn
//     from a completed sub-agent decrements by one, so the timer keeps counting
//     until ALL sub-agents have completed and been processed.

const STATUS_KEY = "agent-timer";
const WIDGET_KEY = "agent-timer-widget";

export function setupAgentTimer(pi: ExtensionAPI): void {
  let durationTimer: ReturnType<typeof setInterval> | null = null;
  let sessionStartTime = 0;
  let turnStartTime = 0;
  let lastTurnDurationMs = 0;
  let isActive = false;
  let subAgentCount = 0;
  let sessionId = "";
  let tuiRef: { requestRender: () => void } | null = null;
  let ctxRef: ExtensionCommandContext | null = null;

  const requestRender = (): void => {
    tuiRef?.requestRender();
  };

  /**
   * Current display duration:
   * - If active (●): time elapsed since turn_start (live count-up)
   * - If idle (○):  frozen duration of the last completed turn
   */
  const currentDisplayMs = (): number =>
    isActive && turnStartTime > 0
      ? Date.now() - turnStartTime
      : lastTurnDurationMs;

  const updateAgentStatus = (): void => {
    if (!ctxRef) return;
    const theme = ctxRef.ui.theme;
    const d = formatDuration(currentDisplayMs());
    const icon = isActive
      ? theme.fg("accent", "●")   // active turn or sub-agent running
      : theme.fg("dim", "○");     // idle, frozen at last turn's duration
    ctxRef.ui.setStatus(
      STATUS_KEY,
      icon + " " + theme.fg("accent", theme.bold("Agent")) + " " + theme.fg("dim", d),
    );
  };

  const startInterval = (): void => {
    if (durationTimer) return;
    durationTimer = setInterval(() => {
      updateAgentStatus();
      requestRender();
    }, 1000);
  };

  const stopInterval = (): void => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
  };

  // ── tool_call (sub-agent detection) ──────────────────────────────
  //
  // Intercept interactive_shell calls to track when sub-agents are
  // dispatched. This must be registered before turn_start/turn_end
  // so the flag is set before turn_end evaluates it.

  pi.on("tool_call", (event) => {
    if (event.toolName !== "interactive_shell") return;

    const input = event.input as Record<string, unknown>;

    // Starting a sub-agent session (dispatch or hands-free with command/spawn)
    if (
      (input.mode === "dispatch" || input.mode === "hands-free") &&
      (typeof input.command === "string" || typeof input.spawn === "object")
    ) {
      subAgentCount++;
      return;
    }

    // Ending sub-agent sessions
    if (input.kill === true) {
      subAgentCount = Math.max(0, subAgentCount - 1);
      return;
    }

    // dismissBackground: true (all) or "session-id" (specific)
    if (input.dismissBackground === true || typeof input.dismissBackground === "string") {
      subAgentCount = Math.max(0, subAgentCount - 1);
      return;
    }
  });

  // ── session_start ────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    ctxRef = ctx;

    // Capture the session ID to scope time tracking to this session.
    sessionId = ctx.sessionManager?.getSessionId?.() ?? "";

    // Try to restore last-run data for continuity display.
    const lastRun = await readLastRun();

    // Reset timer for genuinely new sessions.
    // reason: "startup" | "reload" | "new" | "resume" | "fork"
    if (_event.reason === "startup" || _event.reason === "resume" || _event.reason === "new") {
      sessionStartTime = 0;
      turnStartTime = 0;
      lastTurnDurationMs = 0;
      isActive = false;
      subAgentCount = 0;
    }
    // On "fork" and "reload", keep sessionStartTime to avoid visual reset.

    // Hidden widget to capture tui reference — same pattern as pi-interactive-shell
    ctx.ui.setWidget(
      WIDGET_KEY,
      (tui: { requestRender: () => void }, _theme: Theme) => {
        tuiRef = tui;
        return { render: () => [], invalidate: () => {} };
      },
    );

    // Show initial status: idle state with last-run info (if no active session yet)
    if (sessionStartTime === 0 && lastRun && lastRun.durationMs > 0) {
      const theme = ctx.ui.theme;
      const d = formatDuration(lastRun.durationMs);
      ctx.ui.setStatus(
        STATUS_KEY,
        theme.fg("dim", "○") + " " + theme.fg("dim", "Last:") + " " + d,
      );
    } else {
      updateAgentStatus();
    }
  });

  // ── turn_start / turn_end ─────────────────────────────────────────
  //
  // Sub-agent-aware per-turn timing:
  //   ● turn_start (counter == 0) → reset timer to 0, start live count-up
  //   ● turn_start (counter > 0) → decrement counter, keep counting (one
  //     dispatch completed and triggered this turn via triggerTurn)
  //   ● turn_end (counter > 0) → keep counting, stay in ● mode
  //   ○ turn_end (counter == 0) → freeze at last turn's duration, stop interval

  pi.on("turn_start", async (_event) => {
    // Record session start on first turn (used for "Last run" persistence).
    if (sessionStartTime === 0) {
      sessionStartTime = Date.now();
    }

    if (subAgentCount > 0) {
      // One dispatch sub-agent completed and triggered this turn.
      // Decrement the counter and keep counting — the timer has been
      // running continuously through the sub-agent wait. If other
      // sub-agents are still running, the counter stays > 0 and
      // the timer keeps counting through subsequent turn_end events.
      subAgentCount--;
      // turnStartTime stays as-is, isActive stays true
      startInterval();
      updateAgentStatus();
    } else {
      // Normal: reset per-turn timer, each new turn starts from zero.
      turnStartTime = Date.now();
      lastTurnDurationMs = 0;
      isActive = true;
      startInterval();
      updateAgentStatus();
    }
  });

  pi.on("turn_end", async () => {
    if (subAgentCount > 0) {
      // One or more sub-agents are still running (e.g. dispatch/hands-free).
      // Keep counting, stay in ● mode, don't freeze.
      updateAgentStatus();
    } else {
      // Freeze at the duration of the just-completed turn.
      if (turnStartTime > 0) {
        lastTurnDurationMs = Date.now() - turnStartTime;
      }
      turnStartTime = 0;
      isActive = false;
      stopInterval();
      updateAgentStatus();
    }
  });

  // ── session_shutdown ──────────────────────────────────────────────

  pi.on("session_shutdown", async (_event, ctx) => {
    stopInterval();
    tuiRef = null;
    ctx.ui.setWidget(WIDGET_KEY, undefined);

    const totalMs = sessionStartTime > 0 ? Date.now() - sessionStartTime : 0;

    if (totalMs > 0) {
      // Persist for next startup.
      await writeLastRun({
        sessionId,
        startTime: sessionStartTime,
        endTime: Date.now(),
        durationMs: totalMs,
      });

      // Show "last run" info in the status bar.
      const theme = ctx.ui.theme;
      const d = formatDuration(totalMs);
      ctx.ui.setStatus(
        STATUS_KEY,
        theme.fg("dim", "○") + " " + theme.fg("dim", "Last run:") + " " + d,
      );
    } else {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }

    // Clear state — ready for next session.
    sessionStartTime = 0;
    turnStartTime = 0;
    lastTurnDurationMs = 0;
    isActive = false;
    subAgentCount = 0;
    sessionId = "";
    ctxRef = null;
  });
}

// =============================================================================
// Extension Entry Point
// =============================================================================

export default function (pi: ExtensionAPI) {
  setupAgentTimer(pi);
}

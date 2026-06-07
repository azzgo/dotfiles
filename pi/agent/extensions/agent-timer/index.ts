/**
 * agent-timer — Standalone pi extension for persistent agent duration display.
 *
 * Shows agent running time in the status bar:
 *   ● Agent · 2h 35m 12s   (active, updates every second)
 *   ○ Agent · 2h 35m 12s   (idle, between turns)
 *   ○ Last run: 2h 35m     (after shutdown, persisted to disk)
 *
 * Fixes the dispatch-reset bug: accumulated time is always shown, never
 * lost when interactive_shell completion triggers a new turn.
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

const STATUS_KEY = "agent-timer";
const WIDGET_KEY = "agent-timer-widget";

export function setupAgentTimer(pi: ExtensionAPI): void {
  let durationTimer: ReturnType<typeof setInterval> | null = null;
  let accumulatedMs = 0;
  let currentTurnStart = 0;
  let sessionId = "";
  let tuiRef: { requestRender: () => void } | null = null;
  let ctxRef: ExtensionCommandContext | null = null;

  const requestRender = (): void => {
    tuiRef?.requestRender();
  };

  /**
   * Total active agent time. When a turn is running, includes both
   * previously accumulated turns AND the current turn's elapsed time.
   *
   * This is the key fix for the dispatch-reset bug: even when a new
   * turn starts (e.g. triggered by interactive_shell completion),
   * the accumulated time from earlier turns is always visible.
   */
  const totalActiveMs = (): number =>
    accumulatedMs + (currentTurnStart > 0 ? Date.now() - currentTurnStart : 0);

  const updateAgentStatus = (): void => {
    if (!ctxRef) return;
    const theme = ctxRef.ui.theme;
    const d = formatDuration(totalActiveMs());
    const icon = currentTurnStart > 0
      ? theme.fg("accent", "●")   // active turn
      : theme.fg("dim", "○");     // idle
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

  // ── session_start ────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    ctxRef = ctx;

    // Capture the session ID to scope time tracking to this session.
    sessionId = ctx.sessionManager?.getSessionId?.() ?? "";

    // Try to restore last-run data for continuity display.
    const lastRun = await readLastRun();

    // Only reset accumulated time for genuinely new sessions, not reloads.
    // reason: "startup" | "reload" | "new" | "resume" | "fork"
    if (_event.reason === "startup" || _event.reason === "resume" || _event.reason === "new") {
      accumulatedMs = 0;
    }
    // On "fork" and "reload", keep accumulated time to avoid visual reset.
    // (A fork event on the main pi is unlikely, but be defensive.)

    currentTurnStart = 0;

    // Hidden widget to capture tui reference — same pattern as pi-interactive-shell
    ctx.ui.setWidget(
      WIDGET_KEY,
      (tui: { requestRender: () => void }, _theme: Theme) => {
        tuiRef = tui;
        return { render: () => [], invalidate: () => {} };
      },
    );

    // Show initial status: idle state with accumulated time (or last-run info)
    if (accumulatedMs === 0 && lastRun && lastRun.durationMs > 0) {
      // Show last-run info briefly, then switch to real accumulated time
      // once turns start. We set accumulatedMs to 0 but show the last-run
      // info as the status text directly.
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

  pi.on("turn_start", async (_event) => {
    // Only track the turn start time; accumulatedMs preserves history.
    currentTurnStart = Date.now();
    startInterval();
    updateAgentStatus();
  });

  pi.on("turn_end", async () => {
    // Accumulate this turn's duration into the running total.
    if (currentTurnStart > 0) {
      accumulatedMs += Date.now() - currentTurnStart;
      currentTurnStart = 0;
    }
    updateAgentStatus();
    // Stop the 1s interval when idle — saves CPU.
    stopInterval();
  });

  // ── session_shutdown ──────────────────────────────────────────────

  pi.on("session_shutdown", async (_event, ctx) => {
    stopInterval();
    tuiRef = null;
    ctx.ui.setWidget(WIDGET_KEY, undefined);

    // Capture any still-active turn before finalizing.
    if (currentTurnStart > 0) {
      accumulatedMs += Date.now() - currentTurnStart;
      currentTurnStart = 0;
    }

    if (accumulatedMs > 0) {
      // Persist for next startup.
      await writeLastRun({
        sessionId,
        startTime: Date.now() - accumulatedMs,
        endTime: Date.now(),
        durationMs: accumulatedMs,
      });

      // Show "last run" info in the status bar.
      const theme = ctx.ui.theme;
      const d = formatDuration(accumulatedMs);
      ctx.ui.setStatus(
        STATUS_KEY,
        theme.fg("dim", "○") + " " + theme.fg("dim", "Last run:") + " " + d,
      );
    } else {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }

    // Clear state — ready for next session.
    accumulatedMs = 0;
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

import fs from "node:fs";
import path from "node:path";
import { homeBase, loadBoard, loadConfig, pidAlive, runsDir, sessionsDir, type RunLock } from "./board.ts";
import { fmtDur, localHM } from "./time.ts";
import type { Spec, SpecStatus } from "./spec.ts";

export type Liveness = "alive" | "stalled" | "orphaned" | "gone" | "-";

export interface StatusRow {
  id: string;
  status: SpecStatus;
  dir: string;
  phase: string;
  pid: number | null;
  elapsedMs: number | null;
  lastOutputAgeMs: number | null;
  liveness: Liveness;
  worstEndAt: number | null;
  note: string;
}

export interface PidRecord {
  pid: number;
  phase: string;
  startedAt: string;
}

export interface StatusOptions {
  base?: string;
  /** 超过这个时间没产出就算 stalled（分钟）。 */
  stallMinutes?: number;
  now?: () => number;
}

/** 读某个 spec 最近一次派发留下的 pid 记录（扫所有 run 目录，取最新的）。 */
export function latestPidRecord(id: string, base = homeBase()): PidRecord | null {
  const dir = runsDir(base);
  let dirs: string[] = [];
  try {
    dirs = fs.readdirSync(dir).sort();
  } catch {
    return null;
  }
  let best: { rec: PidRecord; mtimeMs: number } | null = null;
  for (const runId of dirs) {
    const file = path.join(dir, runId, `${id}.pid`);
    try {
      const rec = JSON.parse(fs.readFileSync(file, "utf8")) as PidRecord;
      const mtimeMs = fs.statSync(file).mtimeMs;
      if (best === null || mtimeMs > best.mtimeMs) best = { rec, mtimeMs };
    } catch {
      // 读不到就跳过
    }
  }
  return best === null ? null : best.rec;
}

/** 实现 Agent 的 session jsonl：最后一个文件就是最近一次尝试。 */
export function lastSessionFile(id: string, base = homeBase()): { file: string; mtimeMs: number; size: number } | null {
  const dir = path.join(sessionsDir(base), id);
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl"));
  } catch {
    return null;
  }
  let best: { file: string; mtimeMs: number; size: number } | null = null;
  for (const n of names) {
    const file = path.join(dir, n);
    try {
      const st = fs.statSync(file);
      if (best === null || st.mtimeMs > best.mtimeMs) best = { file, mtimeMs: st.mtimeMs, size: st.size };
    } catch {
      // 读不到就跳过
    }
  }
  return best;
}

function lockInfo(base: string): RunLock | null {
  try {
    const raw = fs.readFileSync(path.join(base, "run.lock"), "utf8");
    const lock = JSON.parse(raw) as RunLock;
    return typeof lock.pid === "number" ? lock : null;
  } catch {
    return null;
  }
}

/**
 * 板子上一条 Spec 的活性。
 *
 * 「活着还是 zombie」这个问题的答案在这里：
 * - `alive`    子进程在，且最近有产出
 * - `stalled`  子进程在，但很久没产出了（可能卡在长思考或挂着的请求）
 * - `orphaned` 板上写着 running，但派发它的 run 早没了 —— 真正的僵尸
 * - `gone`     子进程已经不在了
 */
export function specLiveness(
  spec: Spec,
  base: string,
  lock: RunLock | null,
  nowMs: number,
  stallMs: number,
): { phase: string; pid: number | null; elapsedMs: number | null; lastOutputAgeMs: number | null; liveness: Liveness; note: string } {
  if (spec.status !== "running") {
    return { phase: "-", pid: null, elapsedMs: null, lastOutputAgeMs: null, liveness: "-", note: "" };
  }
  const rec = latestPidRecord(spec.id, base);
  const pid = rec === null ? null : rec.pid;
  const phase = rec === null ? "?" : rec.phase;
  const elapsedMs = rec === null ? null : Math.max(0, nowMs - new Date(rec.startedAt).getTime());
  const session = lastSessionFile(spec.id, base);
  const lastOutputAgeMs = session === null ? null : Math.max(0, nowMs - session.mtimeMs);
  const supervisorAlive = lock !== null && pidAlive(lock.pid);
  const childAlive = pid !== null && pidAlive(pid);

  // 没有 pid 记录（派发时用的 CLI 还没这个特性）⇒ 只能看输出新鲜度
  if (rec === null) {
    if (!supervisorAlive) {
      return {
        phase,
        pid,
        elapsedMs,
        lastOutputAgeMs,
        liveness: "orphaned",
        note: "板上写着 running，但派发它的 run 已经不在了 —— 僵尸状态，需要 ns rearm 收尸",
      };
    }
    if (lastOutputAgeMs !== null && lastOutputAgeMs > stallMs) {
      return {
        phase,
        pid,
        elapsedMs,
        lastOutputAgeMs,
        liveness: "stalled",
        note: "没有 pid 记录（派发时 CLI 较旧），但已很久没有新产出",
      };
    }
    return { phase, pid, elapsedMs, lastOutputAgeMs, liveness: "-", note: "没有 pid 记录（派发时 CLI 较旧）" };
  }

  if (!supervisorAlive) {
    return {
      phase,
      pid,
      elapsedMs,
      lastOutputAgeMs,
      liveness: "orphaned",
      note: "板上写着 running，但派发它的 run 已经不在了 —— 僵尸状态，需要 ns rearm 收尸",
    };
  }
  if (!childAlive) {
    return {
      phase,
      pid,
      elapsedMs,
      lastOutputAgeMs,
      liveness: "gone",
      note: "子进程已经不在了（run 稍后会接手）",
    };
  }
  if (lastOutputAgeMs !== null && lastOutputAgeMs > stallMs) {
    return {
      phase,
      pid,
      elapsedMs,
      lastOutputAgeMs,
      liveness: "stalled",
      note: "进程还在，但很久没有新产出",
    };
  }
  return { phase, pid, elapsedMs, lastOutputAgeMs, liveness: "alive", note: "" };
}

/**
 * 一条在跑的 Spec 最晚几点结束：实现阶段 = 派发时刻 + 实现预算 + 验证预算；
 * 验证阶段 = 开始时刻 + 验证预算。超了就说明它拖过头了。
 */
export function worstEndAt(rec: PidRecord, cfg: { timeoutSec: number; verifyTimeoutSec: number }): number {
  const start = new Date(rec.startedAt).getTime();
  const budgetMs = (rec.phase === "verify" ? cfg.verifyTimeoutSec : cfg.timeoutSec + cfg.verifyTimeoutSec) * 1000;
  return start + budgetMs;
}

export function collectStatus(opts: StatusOptions = {}): StatusRow[] {
  const base = opts.base ?? homeBase();
  const nowMs = (opts.now ?? (() => Date.now()))();
  const stallMs = (opts.stallMinutes ?? 15) * 60_000;
  const lock = lockInfo(base);
  const cfg = loadConfig();
  const board = loadBoard(base);
  return board.specs.map((spec) => {
    const l = specLiveness(spec, base, lock, nowMs, stallMs);
    const rec = latestPidRecord(spec.id, base);
    return {
      id: spec.id,
      status: spec.status,
      dir: spec.dir,
      phase: l.phase,
      pid: l.pid,
      elapsedMs: l.elapsedMs,
      lastOutputAgeMs: l.lastOutputAgeMs,
      liveness: l.liveness,
      worstEndAt: rec === null ? null : worstEndAt(rec, cfg),
      note: l.note,
    };
  });
}

export function fmtDuration(ms: number | null): string {
  if (ms === null) return "-";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 > 0 ? String(s % 60).padStart(2, "0") : ""}`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 > 0 ? String(m % 60).padStart(2, "0") : ""}`;
}

export const LIVENESS_ICON: Record<Liveness, string> = {
  alive: "●",
  stalled: "◐",
  orphaned: "☠",
  gone: "○",
  "-": " ",
};

import fs from "node:fs";
import path from "node:path";
import {
  acquireLock,
  archiveRun,
  boardDir,
  loadBoard,
  runsDir,
  releaseLock,
  updateLock,
  writeSpec,
  type Config,
} from "./board.ts";
import { buildImplArgs, buildVerifyArgs, DispatchError, parseReviewHint, parseVerdict, runChild } from "./dispatch.ts";
import { countCommits, preflight, residualCount, headOf, shortSha } from "./git.ts";
import { implPrompt, verifyPrompt } from "./prompt.ts";
import { blockQueue, compareQueueOrder, releaseBlockedBy } from "./queue.ts";
import { renderReport } from "./report.ts";
import type { Spec } from "./spec.ts";

export interface RunOptions {
  base: string;
  cfg: Config;
  until: string | null;
  jobs: number;
  log: (line: string) => void;
  now?: () => Date;
}

const WINDOW_RE = /^(\d{1,2}):(\d{2})$/;
const RELATIVE_RE = /^\+(\d+)(m|min|h)$/i;

/**
 * `+30m` / `+2h` → 从 now 起算的绝对时刻。
 * `07:00` → 今天的 07:00；已过则视为明天。
 */
export function resolveDeadline(window: string, jobsDate: Date): Date | null {
  const rel = window.match(RELATIVE_RE);
  if (rel) {
    const n = Number(rel[1]);
    const ms = rel[2].toLowerCase() === "h" ? n * 3600_000 : n * 60_000;
    return new Date(jobsDate.getTime() + ms);
  }
  const m = window.match(WINDOW_RE);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  const d = new Date(jobsDate);
  d.setHours(hh, mm, 0, 0);
  if (d.getTime() <= jobsDate.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

export class WindowTooLongError extends Error {
  readonly hours: number;
  readonly maxHours: number;
  constructor(hours: number, maxHours: number) {
    super(
      `window would run ${hours.toFixed(1)}h, over maxWindowHours=${maxHours}. ` +
        `A scheduler that fires at the wrong time (e.g. a missed launchd/cron run caught up the next morning) ` +
        `would otherwise start a day-long run. Refusing; check how you are invoking this.`,
    );
    this.hours = hours;
    this.maxHours = maxHours;
  }
}

export function assertWindowSane(startedAt: Date, deadline: Date, maxHours: number): void {
  const hours = (deadline.getTime() - startedAt.getTime()) / 3600_000;
  if (hours > maxHours) throw new WindowTooLongError(hours, maxHours);
}

function dateStamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function makeRunId(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

interface Job {
  spec: Spec;
  serialKey: string;
}

const MAX_ATTEMPTS = 2;

async function runImpl(spec: Spec, cfg: Config, base: string, attempt: number, feedback: string | null): Promise<{ hint: string | null }> {
  let output = "";
  const baseline = spec.baseline;
  const prompt = implPrompt({ spec, baseline, attempt, feedback });
  const args = buildImplArgs(spec, cfg, base);
  const res = await runChild({
    bin: cfg.piBin,
    args,
    cwd: spec.dir,
    timeoutMs: cfg.timeoutSec * 1000,
    stdin: prompt,
    onStdout: (chunk) => {
      output += chunk;
    },
  });
  const hint = parseReviewHint(output);
  if (res.timedOut) {
    const left = residualCount(spec.dir);
    const detail = left > 0 ? ` (${left} uncommitted path(s) left in the worktree)` : "";
    throw new DispatchError(`implementation timed out after ${cfg.timeoutSec}s${detail}`);
  }
  if (res.exitCode === null) {
    const tail = res.stderr.trim().split("\n").filter((l) => l.trim() !== "").slice(-1)[0];
    throw new DispatchError(
      `implementation died on ${res.signal ?? "a signal"}` + (tail ? ` — ${tail.slice(0, 200)}` : ""),
    );
  }
  if (res.exitCode !== 0 && res.stdout.trim() === "") {
    const tail = res.stderr.trim().split("\n").filter((l) => l.trim() !== "").slice(-1)[0];
    const detail = tail ? ` — ${tail.slice(0, 200)}` : "";
    throw new DispatchError(`implementation exited ${res.exitCode} without producing output${detail}`);
  }
  return { hint };
}

async function runVerify(spec: Spec, cfg: Config): Promise<{ verdict: string; reason: string | null }> {
  const head = headOf(spec.dir);
  const prompt = verifyPrompt({ spec, baseline: spec.baseline, head });
  const args = buildVerifyArgs(spec, cfg);
  const res = await runChild({
    bin: cfg.piBin,
    args,
    cwd: spec.dir,
    timeoutMs: cfg.verifyTimeoutSec * 1000,
    stdin: prompt,
  });
  if (res.timedOut) return { verdict: "verify-error", reason: `verifier timed out after ${cfg.verifyTimeoutSec}s` };
  return parseVerdict(res.stdout, res.exitCode, { signal: res.signal, stderr: res.stderr });
}

function persist(spec: Spec, base: string): void {
  writeSpec(spec, base);
}

async function processSpec(job: Job, cfg: Config, base: string, log: (s: string) => void): Promise<Spec> {
  const spec = job.spec;
  const pf = preflight(spec.dir);
  if (!pf.ok) {
    spec.status = "skipped";
    spec.reason = pf.reason;
    persist(spec, base);
    log(`${spec.id} skipped: ${pf.reason}`);
    return spec;
  }
  spec.baseline = pf.baseline;
  spec.attempts = 0;
  spec.verdict = null;
  spec.reason = null;
  spec.status = "running";
  persist(spec, base);
  log(`${spec.id} dispatch (baseline ${shortSha(pf.baseline)})`);

  let feedback: string | null = null;
  let hint: string | null = null;
  let verdict = "verify-error";
  let reason: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    spec.attempts = attempt + 1;
    persist(spec, base);
    try {
      const impl = await runImpl(spec, cfg, base, attempt, feedback);
      if (impl.hint !== null) hint = impl.hint;
    } catch (e) {
      spec.status = "verify-error";
      spec.verdict = null;
      spec.reason = e instanceof DispatchError ? e.message : String(e);
      spec.commits = countCommits(spec.dir, pf.baseline);
      spec.residual = residualCount(spec.dir);
      persist(spec, base);
      log(`${spec.id} impl error: ${spec.reason}`);
      return spec;
    }
    const v = await runVerify(spec, cfg);
    verdict = v.verdict;
    reason = v.reason;
    log(`${spec.id} verify ${verdict}${reason ? ` — ${reason}` : ""}`);
    if (verdict === "pass") break;
    if (verdict === "verify-error") break;
    feedback = reason;
  }

  spec.verdict = verdict;
  spec.reason = reason;
  spec.status = verdict === "pass" ? "passed" : verdict === "fail" ? "needs-review" : "verify-error";
  spec.commits = countCommits(spec.dir, spec.baseline ?? pf.baseline);
  spec.residual = residualCount(spec.dir);
  spec.hint = hint;
  spec.finished = new Date().toISOString();
  persist(spec, base);
  return spec;
}

export async function runNightshift(opts: RunOptions): Promise<{ archivedTo: string | null; report: string; specs: Spec[] }> {
  const { base, cfg, log } = opts;
  const now = opts.now ?? (() => new Date());
  const startedAt = now();
  const deadline = resolveDeadline(opts.until ?? cfg.window, startedAt);
  if (deadline === null) throw new Error(`unparseable window: ${opts.until ?? cfg.window}`);
  assertWindowSane(startedAt, deadline, cfg.maxWindowHours);

  const lock = acquireLock(base);
  const runId = makeRunId(startedAt);
  updateLock(lock, { runId }, base);
  log(`run ${runId} started, deadline ${deadline.toISOString()}`);

  let handled: Spec[] = [];
  try {
    const board = loadBoard(base);
    if (board.errors.length > 0) {
      for (const e of board.errors) log(`board error: ${e}`);
    }
    const ready = board.specs.filter((s) => s.status === "ready").sort(compareQueueOrder);
    const queues = new Map<string, Job[]>();
    for (const s of ready) {
      const key = s.dir;
      queues.set(key, [...(queues.get(key) ?? []), { spec: s, serialKey: key }]);
    }
    const jobsLimit = Math.max(1, opts.jobs);

    const finished: Spec[] = [];
    const active = new Map<string, Promise<Spec>>();

    const pump = async (): Promise<void> => {
      for (;;) {
        if (now().getTime() >= deadline.getTime()) {
          log("window closed, no new dispatch");
          break;
        }
        const freeKeys: string[] = [];
        for (const [key, queue] of queues) {
          if (queue.length === 0) continue;
          if (active.has(key)) continue;
          freeKeys.push(key);
        }
        if (freeKeys.length === 0) break;
        const slots = jobsLimit - active.size;
        if (slots <= 0) break;
        for (const key of freeKeys.slice(0, slots)) {
          const job = queues.get(key)!.shift()!;
          const p = processSpec(job, cfg, base, log).then((spec) => {
            active.delete(key);
            finished.push(spec);
            settleQueue(key, spec);
            return spec;
          });
          active.set(key, p);
        }
        if (active.size === 0) break;
        await Promise.race([...active.values()]);
      }
      if (active.size > 0) await Promise.all([...active.values()]);
    };

    const settleQueue = (key: string, spec: Spec): void => {
      if (spec.status === "passed") {
        const released = releaseBlockedBy(spec.id, base);
        for (const next of released) {
          log(`${next.id} unblocked (${spec.id} passed)`);
          queues.set(key, [...(queues.get(key) ?? []), { spec: next, serialKey: key }]);
        }
        return;
      }
      const remaining = queues.get(key) ?? [];
      queues.set(key, []);
      if (remaining.length === 0) return;
      const blocked = blockQueue(key, spec, base);
      for (const b of blocked) log(`${b.id} blocked: ${spec.id} ${spec.status}`);
    };
    await pump();
    handled = finished;

    const dispatchedIds = new Set(handled.map((s) => s.id));
    const date = dateStamp(startedAt);
    const leftover = loadBoard(base).specs.filter((s) => !dispatchedIds.has(s.id));
    const report = renderReport({
      date,
      windowText: `窗口 ${startedAt.toISOString().slice(11, 16)}–${deadline.toISOString().slice(11, 16)}`,
      specs: [...handled, ...leftover],
    });

    const runDir = path.join(runsDir(base), runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, "run.json"),
      JSON.stringify(
        {
          runId,
          startedAt: startedAt.toISOString(),
          deadline: deadline.toISOString(),
          jobs: jobsLimit,
          specs: handled.map((s) => ({
            id: s.id,
            status: s.status,
            verdict: s.verdict,
            attempts: s.attempts,
            baseline: s.baseline,
            commits: s.commits,
            residual: s.residual,
          })),
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(runDir, "report.txt"), report);

    const archivedTo = handled.length > 0 ? archiveRun(handled, date, report, base) : null;
    return { archivedTo, report, specs: handled };
  } finally {
    releaseLock(base);
  }
}


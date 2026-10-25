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
import { inboxPath, runDir } from "./board.ts";
import { countCommits, isAncestor, preflight, residualCount, headOf, shortSha, updateRef } from "./git.ts";
import { implPrompt, verifyPrompt } from "./prompt.ts";
import { fmtDur, localHM } from "./time.ts";
import { blockQueue, compareQueueOrder, isBlockReason, orderedSpecs, releaseBlockedBy } from "./queue.ts";
import { classifyDispatchError, classifyVerifyError, markInfra } from "./infra.ts";
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
const RELATIVE_RE = /^\+(\d+)(s|sec|secs|second|seconds|m|min|minute|minutes|h|hr|hour|hours)$/i;

/**
 * `+30m` / `+2h` / `+45s` → 从 now 起算的绝对时刻。
 * `07:00` → 今天的 07:00；已过则视为明天。
 */
export function resolveDeadline(window: string, jobsDate: Date): Date | null {
  const rel = window.match(RELATIVE_RE);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("h")
      ? n * 3600_000
      : unit.startsWith("s")
        ? n * 1000
        : n * 60_000;
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
        `would otherwise start a day-long run. Refusing; check how you are invoking this. ` +
        `要放开：在 ~/.pi/agent/nightshift/config.json 里设 "maxWindowHours": 0（0 = 不限）。`,
    );
    this.hours = hours;
    this.maxHours = maxHours;
  }
}

export function assertWindowSane(startedAt: Date, deadline: Date, maxHours: number): void {
  if (maxHours <= 0) return; // 0 = 不限
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
/** 基础设施故障的额外重试次数——不计入 attempts。 */
const MAX_INFRA_RETRIES = 2;

async function runImpl(
  spec: Spec,
  cfg: Config,
  base: string,
  attempt: number,
  feedback: string | null,
  runId: string,
): Promise<{ hint: string | null }> {
  let output = "";
  const baseline = spec.baseline;
  const prompt = implPrompt({ spec, baseline, attempt, feedback, inbox: inboxPath(spec.id, base) });
  const args = buildImplArgs(spec, cfg, base);
  const res = await runChild({
    bin: cfg.piBin,
    args,
    cwd: spec.dir,
    timeoutMs: cfg.timeoutSec * 1000,
    stdin: prompt,
    onSpawn: (pid) => writePidFile(base, runId, spec.id, pid, "impl"),
    onActivity: () => touchPidFile(base, runId, spec.id),
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

async function runVerify(
  spec: Spec,
  cfg: Config,
  base: string,
  runId: string,
): Promise<{ verdict: string; reason: string | null }> {
  const head = headOf(spec.dir);
  const prompt = verifyPrompt({ spec, baseline: spec.baseline, head });
  const args = buildVerifyArgs(spec, cfg);
  const res = await runChild({
    bin: cfg.piBin,
    args,
    cwd: spec.dir,
    timeoutMs: cfg.verifyTimeoutSec * 1000,
    timeoutMs: cfg.verifyTimeoutSec * 1000,
    stdin: prompt,
    onSpawn: (pid) => writePidFile(base, runId, spec.id, pid, "verify"),
    onActivity: () => touchPidFile(base, runId, spec.id),
  });
  if (res.timedOut) return { verdict: "verify-error", reason: `verifier timed out after ${cfg.verifyTimeoutSec}s` };
  return parseVerdict(res.stdout, res.exitCode, { signal: res.signal, stderr: res.stderr });
}

function persist(spec: Spec, base: string): void {
  writeSpec(spec, base);
}

/** 落 pid 文件：`ns status` 看活性、`ns stop` 找得到要杀的那个进程。 */
function writePidFile(base: string, runId: string, id: string, pid: number, phase: string): void {
  const dir = runDir(runId, base);
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  fs.writeFileSync(
    path.join(dir, `${id}.pid`),
    JSON.stringify({ pid, phase, startedAt: now, lastActivityAt: now }, null, 2),
  );
}

/** 子进程有输出时刷新心跳。只改 mtime + lastActivityAt，不重写整个文件；读不到就跳过（写竞态无害）。 */
function touchPidFile(base: string, runId: string, id: string): void {
  const file = path.join(runDir(runId, base), `${id}.pid`);
  try {
    const rec = JSON.parse(fs.readFileSync(file, "utf8")) as { lastActivityAt?: string };
    if (rec.lastActivityAt && Date.now() - new Date(rec.lastActivityAt).getTime() < 10_000) return;
    fs.writeFileSync(file, JSON.stringify({ ...rec, lastActivityAt: new Date().toISOString() }, null, 2));
  } catch {
    // pid 文件还没落或刚被清掉：心跳没有可附着的对象，忽略
  }
}

/**
 * 历史被改写（rebase / pull --rebase / reset）会让基线脱离 HEAD 的祖先链，
 * 此时 `baseline..HEAD` 已经不是"本任务改了什么"——拿它去判必然出假判决。
 * 与其判错，不如作废：明确说"本轮判决不可信"，并告诉人怎么重新装填。
 */
function voidVerdict(spec: Spec, base: string, log: (s: string) => void, when: string): Spec {
  const anchor = `refs/nightshift/base/${spec.id}`;
  spec.status = "verify-error";
  spec.verdict = null;
  spec.reason =
    `baseline ${shortSha(spec.baseline)} 已不在 HEAD 的祖先链上（历史在${when}被改写：` +
    "rebase / pull --rebase / reset）；本轮判决作废——baseline..HEAD 已不代表本任务的改动。" +
    `请 nightshift rearm ${spec.id} 重新装填（会把基线重锚到当前 HEAD，并带上本轮理由）。` +
    `原基线仍钉在 ${anchor}。`;
  spec.commits = null;
  spec.residual = residualCount(spec.dir);
  persist(spec, base);
  log(`${spec.id} baseline rewritten (${when}) — verdict voided`);
  return spec;
}

async function processSpec(
  job: Job,
  cfg: Config,
  base: string,
  log: (s: string) => void,
  runId: string,
  deadline: Date,
): Promise<Spec> {
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
  // 把基线钉在非分支 ref 上：历史被改写后仍可查、不会被 gc 剪掉
  updateRef(spec.dir, `refs/nightshift/base/${spec.id}`, pf.baseline);
  // 上一轮的理由（重新装填后仍然有效）当作本轮的初始反馈
  const priorReason = spec.reason;
  const lifetimeAttempts = spec.attempts;
  spec.verdict = null;
  spec.reason = null;
  spec.status = "running";
  persist(spec, base);
  const nowMs = Date.now();
  const perSpecWorstMs = (MAX_ATTEMPTS + MAX_INFRA_RETRIES) * (cfg.timeoutSec + cfg.verifyTimeoutSec) * 1000;
  log(
    `${spec.id} dispatch (baseline ${shortSha(pf.baseline)}, timeout ${cfg.timeoutSec}s + verify ${cfg.verifyTimeoutSec}s, 窗口剩 ${fmtDur(deadline.getTime() - nowMs)}, ` +
      `本条最晚 ${localHM(new Date(nowMs + perSpecWorstMs))} 结束)`,
  );

  let feedback: string | null = isBlockReason(priorReason) ? null : priorReason;
  let hint: string | null = null;
  let verdict = "verify-error";
  let reason: string | null = null;
  // 本轮真正烧掉的尝试次数。基础设施错误不算（见下面的 catch 分支）。
  let burnedAttempts = 0;
  // 基础设施故障的额外重试额度：网关抽风不该吃掉实现的重试额度。
  let infraRetries = 0;
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    spec.attempts = lifetimeAttempts + burnedAttempts + 1;
    persist(spec, base);
    try {
      const impl = await runImpl(spec, cfg, base, attempt, feedback, runId);
      if (impl.hint !== null) hint = impl.hint;
    } catch (e) {
      const message = e instanceof DispatchError ? e.message : String(e);
      if (classifyDispatchError(message) === "infra") {
        // 基础设施坏了，不是实现没写对：这一轮不算一次尝试，也不该被读成判决。
        infraRetries += 1;
        spec.attempts = lifetimeAttempts + burnedAttempts;
        if (infraRetries <= MAX_INFRA_RETRIES) {
          spec.status = "running";
          spec.reason = markInfra(message);
          persist(spec, base);
          log(`${spec.id} infra error (不消耗尝试次数，重试): ${message}`);
          continue;
        }
        spec.status = "verify-error";
        spec.verdict = null;
        spec.reason = markInfra(message);
        spec.commits = countCommits(spec.dir, pf.baseline);
        spec.residual = residualCount(spec.dir);
        persist(spec, base);
        log(`${spec.id} infra error (尝试次数不计入): ${message}`);
        return spec;
      }
      spec.status = "verify-error";
      spec.verdict = null;
      spec.reason = message;
      spec.commits = countCommits(spec.dir, pf.baseline);
      spec.residual = residualCount(spec.dir);
      persist(spec, base);
      log(`${spec.id} impl error: ${spec.reason}`);
      return spec;
    }
    burnedAttempts += 1;
    attempt += 1;
    // 验证之前先验基线：基线一旦脱离祖先链，判决就不可信
    if (!isAncestor(spec.dir, spec.baseline ?? pf.baseline)) {
      return voidVerdict(spec, base, log, "实现过程中");
    }
    const v = await runVerify(spec, cfg, base, runId);
    verdict = v.verdict;
    reason = v.reason;
    if (verdict === "verify-error" && reason !== null && classifyVerifyError(reason) === "infra") {
      reason = markInfra(reason);
    }
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
  // 窗口只管“还能不能派新活”；在飞的任务照跑到底，所以最坏结束时间 = 窗口关 + 单条最坏耗时
  const perSpecWorstMs = (MAX_ATTEMPTS + MAX_INFRA_RETRIES) * (cfg.timeoutSec + cfg.verifyTimeoutSec) * 1000;
  const worstEnd = new Date(deadline.getTime() + perSpecWorstMs);
  log(
    `run ${runId} started, 窗口 ${localHM(startedAt)}–${localHM(deadline)} (${fmtDur(deadline.getTime() - startedAt.getTime())})` +
      `, 最坏结束 ${localHM(worstEnd)}`,
  );

  let handled: Spec[] = [];
  try {
    const board = loadBoard(base);
    if (board.errors.length > 0) {
      for (const e of board.errors) log(`board error: ${e}`);
    }
    // 队列顺序 = 同目录内的 order 秩。先把缺秩的目录补齐（一次性迁移，会写盘），再重新读板。
    const dirs = [...new Set(board.specs.filter((s) => s.status === "ready").map((s) => s.dir))];
    for (const dir of dirs) orderedSpecs(dir, base);
    const ready = loadBoard(base).specs.filter((s) => s.status === "ready").sort(compareQueueOrder);
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
          const p = processSpec(job, cfg, base, log, runId, deadline).then((spec) => {
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
    const finishedAt = now();
    const overrunMs = Math.max(0, finishedAt.getTime() - deadline.getTime());
    const report = renderReport({
      date,
      windowText:
        `窗口 ${localHM(startedAt)}–${localHM(deadline)}` +
        (overrunMs > 0 ? ` · 实际结束 ${localHM(finishedAt)} · 超窗 ${fmtDur(overrunMs)}` : ""),
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


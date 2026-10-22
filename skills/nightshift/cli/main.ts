#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  archiveDir,
  boardDir,
  ensureLayout,
  homeBase,
  listArchiveDates,
  loadBoard,
  loadConfig,
  type Config,
  nextId,
  readArchiveSpecs,
  sessionsDir,
  specPath,
  writeSpec,
  writeSpecTo,
  inboxDir,
  inboxPath,
  pidAlive,
} from "./src/board.ts";
import { SpecError, bodyTemplate, checkSpec, parseSpec, type Spec } from "./src/spec.ts";
import { headOf, listRange } from "./src/git.ts";
import { collectStatus, fmtDuration, LIVENESS_ICON } from "./src/status.ts";
import { renderReport } from "./src/report.ts";
import { renderSpecDetail } from "./src/show.ts";
import { releaseLock } from "./src/board.ts";
import { revertTo, shortSha } from "./src/git.ts";
import { runNightshift } from "./src/run.ts";
import { blockedBy, compareQueueOrder, isBlockReason, moveSpec, orderedSpecs, placeSpec, queueOnDir, releaseBlockedBy } from "./src/queue.ts";

const USAGE = `nightshift — 夜间批量执行队列

usage:
  nightshift add --dir <path> [--title <t>] [--model m] [--thinking lvl]
                           [--tools a,b] [--extensions p] [--before id | --after id]
                           # 正文从 stdin 读；--before/--after 决定它在同目录队列里的位置
  nightshift list [--status S] [--all]
  nightshift show <id>
  nightshift ready <id>
  nightshift unready <id>
  nightshift unblock <id>          # 只解掉一条被同目录 fail 挡住的队列项
  nightshift check
  nightshift run [--until HH:MM|+30m] [--jobs N]
  nightshift report [--date YYYY-MM-DD] [--list-dates]
  nightshift review <id> [--drop]   # --drop 回滚 baseline，并放行被它挡住的下一条
  nightshift rearm <id>            # 重新装填：回到 ready，基线重锚当前 HEAD，保留上一轮理由
  nightshift status [--stall MIN]  # 板子活性：哪些活着 / 卡住 / 成了僵尸
  nightshift nudge <id> <text>     # 给正在跑的 Agent 递一句话（写进 inbox/<id>.md）
  nightshift stop <id> | --all     # 停掉在跑的子进程（--all 连 run 一起停）
  nightshift queue [--dir P]        # 看同目录串行队列（含被挡住的）
  nightshift queue --move <id> [--before id | --after id]   # 在队列里挪位置
  nightshift release <id>           # 放行被 <id> 挡住（needs-review/verify-error）的下一条
  nightshift path

env:
  NIGHTSHIFT_HOME   override ~/.cache/nightshift
`;

function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function resolveOverrides(cfg: Config): Config {
  const patch: Partial<Config> = {};
  const bin = process.env.NIGHTSHIFT_PI_BIN;
  if (bin) patch.piBin = bin;
  const model = process.env.NIGHTSHIFT_MODEL;
  if (model) patch.defaultModel = model;
  const jobs = process.env.NIGHTSHIFT_JOBS;
  if (jobs) patch.jobs = Number(jobs);
  return { ...cfg, ...patch };
}
function overlayFromEnv(cfg: Config): Config {
  return cfg;
}

function parseArgs(argv: string[]): { positional: string[]; flags: Map<string, string[]> } {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, [...(flags.get(key) ?? []), next]);
        i += 2;
      } else {
        flags.set(key, [...(flags.get(key) ?? []), ""]);
        i += 1;
      }
    } else {
      positional.push(a);
      i += 1;
    }
  }
  return { positional, flags };
}

function one(flags: Map<string, string[]>, key: string): string | undefined {
  const v = flags.get(key);
  return v === undefined ? undefined : v[v.length - 1];
}

function has(flags: Map<string, string[]>, key: string): boolean {
  return flags.has(key);
}

function csv(flags: Map<string, string[]>, key: string): string[] {
  const raw = flags.get(key);
  if (!raw) return [];
  return raw.flatMap((s) => s.split(",").map((x) => x.trim())).filter((x) => x !== "");
}

function readStdin(): string {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function loadBoardStrict(base: string) {
  const board = loadBoard(base);
  if (board.errors.length > 0) die(board.errors.map((e) => `error: ${e}`).join("\n"));
  return board;
}

function byId(id: string, base: string): { spec: Spec; specs: Spec[] } {
  const board = loadBoardStrict(base);
  const spec = board.specs.find((s) => s.id === id);
  if (!spec) die(`error: spec ${id} not found in ${boardDir(base)}`);
  return { spec, specs: board.specs };
}

function archivedSpec(id: string, base: string): Spec | null {
  for (const date of listArchiveDates(base).slice().reverse()) {
    const spec = readArchiveSpecs(date, base).specs.find((s) => s.id === id);
    if (spec) return spec;
  }
  return null;
}

function uniqueDir(raw: string): string {
  const dir = fs.realpathSync.native(raw).replace(/\/+$/, "");
  const aliases = fs.existsSync("/private" + dir) ? ["/private" + dir] : [];
  for (const candidate of [dir, ...aliases]) {
    if (specsOnDir(candidate).length > 0) return candidate;
  }
  return dir;
}

function specsOnDir(dir: string): Spec[] {
  return loadBoard(homeBase()).specs.filter((s) => s.dir === dir);
}

function cmdAdd(base: string, flags: Map<string, string[]>): void {
  const dirRaw = one(flags, "dir");
  if (!dirRaw) die("error: --dir <absolute path> is required");
  if (!path.isAbsolute(dirRaw)) die(`error: --dir must be absolute, got: ${dirRaw}`);
  if (!fs.existsSync(dirRaw)) die(`error: --dir does not exist: ${dirRaw}`);
  const dir = uniqueDir(dirRaw);
  const title = one(flags, "title") ?? path.basename(dir);
  const body = readStdin();
  const id = nextId(base);
  const spec: Spec = {
    id,
    status: "draft",
    dir,
    title,
    created: new Date().toISOString(),
    model: one(flags, "model") ?? null,
    thinking: one(flags, "thinking") ?? null,
    tools: csv(flags, "tools"),
    extensions: csv(flags, "extensions"),
    baseline: null,
    attempts: 0,
    order: null,
    verdict: null,
    reason: null,
    commits: null,
    residual: null,
    hint: null,
    finished: null,
    run: null,
    body: body.trim() === "" ? bodyTemplate() : "\n" + body.trim() + "\n",
    file: `${id}.md`,
  };
  ensureLayout(base);
  const beforeId = one(flags, "before") ?? null;
  const afterId = one(flags, "after") ?? null;
  if (beforeId !== null && afterId !== null) die("error: --before 与 --after 只能给一个");
  placeSpec(spec, dir, base, beforeId, afterId);
  console.log(`${id}  ${boardDir(base)}/${id}.md`);
  const ahead = loadBoardStrict(base).specs.filter(
    (s) => s.dir === dir && s.id !== id && s.status !== "passed" && compareQueueOrder(s, spec) < 0,
  );
  if (ahead.length > 0) {
    console.log(`queue: ${ahead.length} spec(s) ahead on this dir (${ahead.map((s) => s.id).join(", ")})`);
  }
}

function cmdList(base: string, flags: Map<string, string[]>): void {
  const board = loadBoardStrict(base);
  const status = one(flags, "status");
  const showAll = has(flags, "all");
  const rows = board.specs.filter((s) => (status ? s.status === status : showAll ? true : s.status !== "passed"));
  if (rows.length === 0) {
    console.log("(empty board)");
    return;
  }
  for (const s of rows) {
    const meta = [
      s.id.padEnd(7),
      s.status.padEnd(13),
      path.basename(s.dir).padEnd(20),
      s.attempts > 0 ? `try:${s.attempts}` : "       ",
      s.status === "blocked" ? (blockedBy(s)?.id ?? "") : (s.verdict ?? ""),
    ].join(" ");
    console.log(`${meta}  ${s.title}`);
  }
}

function cmdShow(base: string, id: string | undefined): void {
  if (!id) die("error: show <id>");
  const { spec } = byId(id, base);
  process.stdout.write(renderSpecDetail(spec, base));
}

function cmdReady(base: string, id: string | undefined, target: "ready" | "draft"): void {
  if (!id) die(`error: ${target === "ready" ? "ready" : "unready"} <id>`);
  const { spec } = byId(id, base);
  if (target === "ready") {
    const errors = checkSpec(spec, spec.file);
    if (errors.length > 0) die(errors.map((e) => `error: ${e}`).join("\n"));
  }
  spec.status = target;
  spec.reason = null;
  writeSpec(spec, base);
  console.log(`${spec.id} -> ${target}`);
  if (target === "ready") {
    const ahead = queueOnDir(spec.dir, base).filter((s) => s.id !== spec.id && compareQueueOrder(s, spec) < 0);
    if (ahead.length > 0) {
      console.log(`queue: ${ahead.length} spec(s) ahead on this dir (${ahead.map((s) => s.id).join(", ")})`);
    }
  }
}

function cmdCheck(base: string): void {
  const board = loadBoard(base);
  const errors = [...board.errors];
  for (const s of board.specs) errors.push(...checkSpec(s, s.file));
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`error: ${e}\n`);
    process.stderr.write(`${errors.length} error(s) in ${boardDir(base)}\n`);
    process.exit(1);
  }
  console.log(`ok: ${board.specs.length} spec(s) in ${boardDir(base)}`);
}

function cmdUnblock(base: string, id: string | undefined): void {
  if (!id) die("error: unblock <id>");
  const { spec } = byId(id, base);
  if (spec.status !== "blocked") die(`error: ${spec.id} is ${spec.status}, not blocked`);
  spec.status = "ready";
  spec.reason = null;
  writeSpec(spec, base);
  console.log(`${spec.id} -> ready (queue re-armed)`);
}

function cmdRelease(base: string, id: string | undefined): void {
  if (!id) die("error: release <id>");
  const released = releaseBlockedBy(id, base);
  if (released.length === 0) {
    console.log(`(nothing blocked by ${id})`);
    return;
  }
  for (const s of released) console.log(`${s.id} -> ready`);
}

function cmdQueue(base: string, flags: Map<string, string[]>): void {
  const moveId = one(flags, "move") ?? null;
  const beforeId = one(flags, "before") ?? null;
  const afterId = one(flags, "after") ?? null;
  if (moveId !== null) {
    if (beforeId !== null && afterId !== null) die("error: --before 与 --after 只能给一个");
    const { spec } = byId(moveId, base);
    moveSpec(spec, spec.dir, base, beforeId, afterId);
    console.log(`${spec.id} moved in ${spec.dir}`);
  }
  const dirRaw = one(flags, "dir");
  const board = loadBoardStrict(base);
  const dir = dirRaw === undefined ? null : (fs.existsSync(dirRaw) ? uniqueDir(dirRaw) : dirRaw);
  const rows =
    dir === null
      ? board.specs.filter((s) => s.status === "ready" || s.status === "blocked").sort(compareQueueOrder)
      : board.specs.filter((s) => s.dir === dir && (s.status === "ready" || s.status === "blocked")).sort(compareQueueOrder);
  if (rows.length === 0) {
    console.log("(empty queue)");
    return;
  }
  for (const s of rows) {
    const blocked = blockedBy(s);
    const note = blocked === null ? s.status : `blocked by ${blocked.id} (${blocked.status})`;
    const rank = s.order === null ? "?" : String(s.order);
    console.log(`${rank.padStart(3)}. ${s.id.padEnd(7)} ${s.created}  ${path.basename(s.dir).padEnd(20)} ${note}`);
  }
}

async function cmdRun(base: string, flags: Map<string, string[]>): Promise<void> {
  const cfg = overlayFromEnv(resolveOverrides(loadConfig()));
  const until = one(flags, "until") ?? null;
  const jobsRaw = one(flags, "jobs");
  const jobs = jobsRaw ? Number(jobsRaw) : cfg.jobs;
  if (!Number.isFinite(jobs) || jobs < 1) die(`error: --jobs must be a positive integer`);
  const result = await runNightshift({
    base,
    cfg,
    until,
    jobs,
    log: (line) => process.stderr.write(`[nightshift] ${line}\n`),
  });
  process.stdout.write(result.report);
  if (result.archivedTo) process.stderr.write(`[nightshift] archived to ${result.archivedTo}\n`);
}

function cmdReport(base: string, flags: Map<string, string[]>): void {
  if (has(flags, "list-dates")) {
    const dates = listArchiveDates(base);
    console.log(dates.length === 0 ? "(no archives)" : dates.join("\n"));
    return;
  }
  const date = one(flags, "date");
  if (date) {
    const archived = readArchiveSpecs(date, base);
    if (archived.errors.length > 0) die(archived.errors.map((e) => `error: ${e}`).join("\n"));
    const file = path.join(archiveDir(base), date, "report.txt");
    if (fs.existsSync(file)) {
      process.stdout.write(fs.readFileSync(file, "utf8"));
      return;
    }
    process.stdout.write(
      renderReport({ date, windowText: "（归档报告缺失，重新渲染）", specs: archived.specs }),
    );
    return;
  }
  const board = loadBoardStrict(base);
  const today = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const pending = board.specs.filter((s) => s.status === "ready" || s.status === "draft" || s.status === "blocked");
  process.stdout.write(
    renderReport({
      date: `${stamp}（板上待命）`,
      windowText: "",
      specs: pending,
    }),
  );
  const dates = listArchiveDates(base);
  if (dates.length > 0) {
    process.stdout.write(`\n最近归档: ${dates.slice(-3).join(", ")}  →  nightshift report --date <date>\n`);
  }
}

function cmdReview(base: string, id: string | undefined, flags: Map<string, string[]>): void {
  if (!id) die("error: review <id> [--drop]");
  const onBoard = loadBoardStrict(base).specs.find((s) => s.id === id);
  const spec = onBoard ?? archivedSpec(id, base);
  if (!spec) die(`error: spec ${id} not found in ${boardDir(base)} or the archive`);
  if (!has(flags, "drop")) {
    process.stdout.write(renderSpecDetail(spec, base));
    return;
  }
  if (spec.baseline === null) die(`error: ${spec.id} has no baseline recorded; refusing to reset`);
  const discarded = listRange(spec.dir, spec.baseline);
  if (discarded.length > 0) {
    console.log(`${spec.id}: 将丢弃 ${discarded.length} 个提交（备份在 refs/nightshift/backup/${spec.id}）:`);
    for (const line of discarded) console.log(`  ${line}`);
  }
  const r = revertTo(spec.dir, spec.baseline, spec.id);
  if (!r.ok) die(`error: ${r.message}`);
  console.log(`${spec.id}: ${r.message} (baseline ${shortSha(spec.baseline)})`);
  const released = releaseBlockedBy(spec.id, base);
  for (const next of released) console.log(`${next.id} -> ready (queue released)`);
}

/**
 * 重新装填一条 Spec：把它放回 `ready`，基线重锚到当前 HEAD，并**保留上一轮的理由**
 * （下一轮派发时它会作为 feedback 喂给 Agent）。
 *
 * 为什么需要它：基线悬空（历史被改写）时，判决本身不可信；但重派发会把 `attempts`
 * 归零、把 `feedback` 清空——于是"上一轮到底为什么失败"就丢了。这个动词把
 * 「停机 → unlock → unready → 补上下文 → ready」那一串手工步骤收成一条命令。
 */
function cmdRearm(base: string, id: string | undefined): void {
  if (!id) die("error: rearm <id>");
  const onBoard = loadBoardStrict(base).specs.find((s) => s.id === id);
  const spec = onBoard ?? archivedSpec(id, base);
  if (!spec) die(`error: spec ${id} not found in ${boardDir(base)} or the archive`);
  if (spec.status === "running") die(`error: ${spec.id} 正在跑；先停掉那一次派发再 rearm`);
  const errors = checkSpec(spec, spec.file);
  if (errors.length > 0) die(errors.map((e) => `error: ${e}`).join("\n"));
  if (!onBoard) {
    // 从归档搬回板上
    writeSpecTo(specPath(id, base), spec);
  }
  const head = headOf(spec.dir);
  const kept = isBlockReason(spec.reason) ? null : spec.reason;
  spec.status = "ready";
  spec.verdict = null;
  spec.reason = kept;
  spec.baseline = head;
  spec.commits = null;
  spec.residual = null;
  spec.finished = null;
  writeSpec(spec, base);
  console.log(`${spec.id} -> ready (baseline ${shortSha(head)})`);
  if (kept !== null) console.log(`  保留上一轮理由作为下一轮的反馈: ${kept.slice(0, 160)}`);
  const ahead = queueOnDir(spec.dir, base).filter((s) => s.id !== spec.id && compareQueueOrder(s, spec) < 0);
  if (ahead.length > 0) {
    console.log(`queue: ${ahead.length} spec(s) ahead on this dir (${ahead.map((s) => s.id).join(", ")})`);
  }
}

function cmdPath(base: string): void {
  console.log(`board:    ${boardDir(base)}`);
  console.log(`archive:  ${archiveDir(base)}`);
  console.log(`sessions: ${sessionsDir(base)}`);
}

/**
 * 板子活性。回答“它到底活着还是 zombie 了”：
 * - ● alive    子进程在，最近有产出
 * - ◐ stalled  子进程在，但很久没产出
 * - ☠ orphaned 板上写着 running，但派发它的 run 已经没了（真正的僵尸）
 */
function cmdStatus(base: string, flags: Map<string, string[]>): void {
  const stallRaw = one(flags, "stall");
  const stallMinutes = stallRaw === undefined ? 15 : Number(stallRaw);
  if (!Number.isFinite(stallMinutes) || stallMinutes <= 0) die("error: --stall must be a positive number of minutes");
  const rows = collectStatus({ base, stallMinutes });
  if (rows.length === 0) {
    console.log("(empty board)");
    return;
  }
  for (const r of rows) {
    const icon = LIVENESS_ICON[r.liveness];
    const phase = r.phase === "-" ? "-" : r.phase;
    const pid = r.pid === null ? "-" : String(r.pid);
    const elapsed = fmtDuration(r.elapsedMs);
    const lastOut = r.lastOutputAgeMs === null ? "-" : `${fmtDuration(r.lastOutputAgeMs)} 前`;
    console.log(
      `${icon} ${r.id.padEnd(7)} ${r.status.padEnd(13)} ${phase.padEnd(6)} pid ${pid.padEnd(7)} ${elapsed.padStart(6)}  最后产出 ${lastOut}` +
        (r.note === "" ? "" : `\n    ↳ ${r.note}`),
    );
  }
}

/**
 * 给正在跑的 Agent 递一句话。
 *
 * 无人值守的 Agent 没有别的输入通道（stdin 启动时就用完了、steering 只能走 RPC、
 * 扩展也被关了），它能读到的只有仓库和 bash 输出。所以这个动词把文字写进
 * `inbox/<id>.md`，而实现 Agent 的 prompt 里已经写明“每轮动手前先读一次这个文件”。
 */
function cmdNudge(base: string, positional: string[]): void {
  const id = positional[0];
  if (!id) die("error: nudge <id> <text>");
  const text = positional.slice(1).join(" ").trim() || readStdin().trim();
  if (text === "") die("error: nudge <id> <text>  (正文也可以走 stdin)");
  fs.mkdirSync(inboxDir(base), { recursive: true });
  const file = inboxPath(id, base);
  const stamp = new Date().toISOString();
  const header = fs.existsSync(file) ? "" : `# 给 ${id} 的临时交代\n\n`;
  fs.appendFileSync(file, `${header}## ${stamp}\n\n${text}\n\n`);
  console.log(`${id}: 已递到 ${file}`);
  console.log("（Agent 会在下一轮动手前读到）");
}

/**
 * 停掉在跑的东西。
 * - `ns stop <id>`：杀掉那条 Spec 的子进程，run 会把它落成 verify-error 并继续排下一条
 * - `ns stop --all`：连 run 自己一起停，释放锁；板上残留的 running 用 `ns rearm` 收尸
 */
function cmdStop(base: string, positional: string[], flags: Map<string, string[]>): void {
  const all = has(flags, "all");
  const id = positional[0];
  if (!all && !id) die("error: stop <id> | stop --all");
  const rows = collectStatus({ base });
  const targets = rows.filter((r) => r.pid !== null && (all || r.id === id));
  if (targets.length === 0) {
    console.log(all ? "没有在跑的子进程" : `${id} 没有在跑的子进程`);
  }
  for (const t of targets) {
    if (t.pid === null) continue;
    try {
      process.kill(t.pid, "SIGTERM");
      console.log(`SIGTERM -> ${t.id} (pid ${t.pid}, ${t.phase})`);
    } catch {
      console.log(`${t.id} (pid ${t.pid}) 已经不在了`);
    }
  }
  if (all) {
    const lockPath = path.join(base, "run.lock");
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { pid?: number };
      if (typeof lock.pid === "number" && pidAlive(lock.pid)) {
        try {
          process.kill(lock.pid, "SIGTERM");
          console.log(`SIGTERM -> run supervisor (pid ${lock.pid})`);
        } catch {
          console.log(`run supervisor (pid ${lock.pid}) 已经不在了`);
        }
      }
    } catch {
      // 没有锁文件
    }
    releaseLock(base);
    console.log("锁已释放；板上残留的 running 用 nightshift rearm <id> 收尸");
  }
}

async function main(): Promise<void> {
  const [verb, ...rest] = process.argv.slice(2);
  if (!verb || verb === "-h" || verb === "--help" || verb === "help") {
    process.stdout.write(USAGE);
    return;
  }
  const base = homeBase();
  const { positional, flags } = parseArgs(rest);
  try {
    switch (verb) {
      case "add":
        cmdAdd(base, flags);
        break;
      case "list":
        cmdList(base, flags);
        break;
      case "show":
        cmdShow(base, positional[0]);
        break;
      case "ready":
        cmdReady(base, positional[0], "ready");
        break;
      case "unready":
        cmdReady(base, positional[0], "draft");
        break;
      case "unblock":
        cmdUnblock(base, positional[0]);
        break;
      case "queue":
        cmdQueue(base, flags);
        break;
      case "release":
        cmdRelease(base, positional[0]);
        break;
      case "check":
        cmdCheck(base);
        break;
      case "run":
        await cmdRun(base, flags);
        break;
      case "report":
        cmdReport(base, flags);
        break;
      case "review":
        cmdReview(base, positional[0], flags);
        break;
      case "rearm":
        cmdRearm(base, positional[0]);
        break;
      case "status":
        cmdStatus(base, flags);
        break;
      case "nudge":
        cmdNudge(base, positional);
        break;
      case "stop":
        cmdStop(base, positional, flags);
        break;
      case "path":
        cmdPath(base);
        break;
      case "unlock":
        releaseLock(base);
        console.log("lock released");
        break;
      default:
        die(`error: unknown verb "${verb}"\n\n${USAGE}`);
    }
  } catch (e) {
    if (e instanceof SpecError) die(`error: ${e.message}`);
    throw e;
  }
}

main().catch((e) => {
  process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});

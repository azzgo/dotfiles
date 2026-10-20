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
  writeSpec,
} from "./src/board.ts";
import { SpecError, bodyTemplate, checkSpec, parseSpec, type Spec } from "./src/spec.ts";
import { renderReport } from "./src/report.ts";
import { renderSpecDetail } from "./src/show.ts";
import { releaseLock } from "./src/board.ts";
import { revertTo, shortSha } from "./src/git.ts";
import { runNightshift } from "./src/run.ts";

const USAGE = `nightshift — 夜间批量执行队列

usage:
  nightshift add --dir <path> [--title <t>] [--model m] [--thinking lvl]
                           [--tools a,b] [--extensions p]   # 正文从 stdin 读
  nightshift list [--status S] [--all]
  nightshift show <id>
  nightshift ready <id>
  nightshift unready <id>
  nightshift check
  nightshift run [--until HH:MM|+30m] [--jobs N]
  nightshift report [--date YYYY-MM-DD] [--list-dates]
  nightshift review <id> [--drop]
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

function uniqueDir(raw: string): string {
  const dir = fs.realpathSync.native(raw).replace(/\/+$/, "");
  for (const candidate of [dir, ...(fs.existsSync("/private" + dir) ? ["/private" + dir] : [])]) {
    if (specsOnDir(candidate).length > 0) {
      checkDirFree(candidate);
      return candidate;
    }
  }
  return dir;
}

function specsOnDir(dir: string): Spec[] {
  return loadBoard(homeBase()).specs.filter((s) => s.dir === dir);
}

function checkDirFree(dir: string): void {
  const busy = specsOnDir(dir).filter((s) => s.status === "draft" || s.status === "ready");
  if (busy.length > 0) {
    die(
      `error: ${dir} already has unfinished spec(s): ${busy.map((s) => `${s.id}(${s.status})`).join(", ")}\n` +
        `       同一目录的 Spec 是串行的；先 ready/归档其中一条，或用不同目录（worktree）。`,
    );
  }
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
  writeSpec(spec, base);
  console.log(`${id}  ${boardDir(base)}/${id}.md`);
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
      s.verdict ?? "",
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
  const pending = board.specs.filter((s) => s.status === "ready" || s.status === "draft");
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
  const { spec } = byId(id, base);
  if (!has(flags, "drop")) {
    process.stdout.write(renderSpecDetail(spec, base));
    return;
  }
  if (spec.baseline === null) die(`error: ${spec.id} has no baseline recorded; refusing to reset`);
  const r = revertTo(spec.dir, spec.baseline);
  if (!r.ok) die(`error: ${r.message}`);
  console.log(`${spec.id}: ${r.message} (baseline ${shortSha(spec.baseline)})`);
}

function cmdPath(base: string): void {
  console.log(`board:    ${boardDir(base)}`);
  console.log(`archive:  ${archiveDir(base)}`);
  console.log(`sessions: ${sessionsDir(base)}`);
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

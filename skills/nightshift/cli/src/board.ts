import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SpecError, parseSpec, serializeSpec, type Spec } from "./spec.ts";

export const BOARD_DIRNAME = "board";
export const ARCHIVE_DIRNAME = "archive";
export const RUNS_DIRNAME = "runs";
export const SESSIONS_DIRNAME = "sessions";
export const LOCK_FILE = "run.lock";

export function homeBase(): string {
  if (process.env.NIGHTSHIFT_HOME) return path.resolve(process.env.NIGHTSHIFT_HOME);
  return path.join(os.homedir(), ".cache", "nightshift");
}

export function boardDir(base = homeBase()): string {
  return path.join(base, BOARD_DIRNAME);
}

export function archiveDir(base = homeBase()): string {
  return path.join(base, ARCHIVE_DIRNAME);
}

export function runsDir(base = homeBase()): string {
  return path.join(base, RUNS_DIRNAME);
}

export function runDir(runId: string, base = homeBase()): string {
  return path.join(runsDir(base), runId);
}

export function inboxDir(base = homeBase()): string {
  return path.join(base, "inbox");
}

/** 派发中的 Agent 会被告知：每轮动手前先读这个文件（不存在就跳过）。 */
export function inboxPath(id: string, base = homeBase()): string {
  return path.join(inboxDir(base), `${id}.md`);
}

export function sessionsDir(base = homeBase()): string {
  return path.join(base, SESSIONS_DIRNAME);
}

export function lockPath(base = homeBase()): string {
  return path.join(base, LOCK_FILE);
}

export function configPath(): string {
  return path.join(os.homedir(), ".pi", "agent", "nightshift", "config.json");
}

export interface Config {
  defaultModel: string | null;
  verifyModel: string | null;
  verifyThinking: string | null;
  jobs: number;
  window: string;
  piBin: string;
  timeoutSec: number;
  maxWindowHours: number;
  verifyTimeoutSec: number;
}

export const DEFAULT_CONFIG: Config = {
  defaultModel: null,
  verifyModel: null,
  verifyThinking: null,
  jobs: 3,
  window: "07:00",
  piBin: "pi",
  timeoutSec: 3600,
  maxWindowHours: 14,
  verifyTimeoutSec: 1800,
};

export function loadConfig(p = configPath()): Config {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
  return resolveConfig(raw);
}

export function resolveConfig(raw: Record<string, unknown>): Config {
  const str = (k: string, d: string | null): string | null =>
    typeof raw[k] === "string" && (raw[k] as string).trim() !== "" ? (raw[k] as string) : d;
  const num = (k: string, d: number): number => {
    const v = raw[k];
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.trunc(v) : d;
  };
  return {
    defaultModel: str("defaultModel", DEFAULT_CONFIG.defaultModel),
    verifyModel: str("verifyModel", DEFAULT_CONFIG.verifyModel),
    verifyThinking: str("verifyThinking", DEFAULT_CONFIG.verifyThinking),
    jobs: num("jobs", DEFAULT_CONFIG.jobs),
    window: str("window", DEFAULT_CONFIG.window) ?? DEFAULT_CONFIG.window,
    piBin: str("piBin", DEFAULT_CONFIG.piBin) ?? DEFAULT_CONFIG.piBin,
    timeoutSec: num("timeoutSec", DEFAULT_CONFIG.timeoutSec),
    maxWindowHours: num("maxWindowHours", DEFAULT_CONFIG.maxWindowHours),
    verifyTimeoutSec: num("verifyTimeoutSec", DEFAULT_CONFIG.verifyTimeoutSec),
  };
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface RunLock {
  pid: number;
  startedAt: string;
  runId: string;
}

export class LockHeldError extends Error {
  readonly holder: RunLock;
  constructor(holder: RunLock) {
    super(`another nightshift run is active: pid ${holder.pid} (run ${holder.runId}, since ${holder.startedAt})`);
    this.holder = holder;
  }
}

export function acquireLock(base = homeBase()): RunLock {
  const p = lockPath(base);
  if (fs.existsSync(p)) {
    let holder: RunLock | null = null;
    try {
      holder = JSON.parse(fs.readFileSync(p, "utf8")) as RunLock;
    } catch {
      holder = null;
    }
    if (holder && typeof holder.pid === "number" && pidAlive(holder.pid)) throw new LockHeldError(holder);
  }
  const lock: RunLock = { pid: process.pid, startedAt: new Date().toISOString(), runId: "" };
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(lock, null, 2));
  return lock;
}

export function updateLock(lock: RunLock, patch: Partial<RunLock>, base = homeBase()): void {
  Object.assign(lock, patch);
  fs.writeFileSync(lockPath(base), JSON.stringify(lock, null, 2));
}

export function releaseLock(base = homeBase()): void {
  try {
    fs.rmSync(lockPath(base), { force: true });
  } catch {}
}

export interface Board {
  dir: string;
  specs: Spec[];
  errors: string[];
}

export function loadBoard(base = homeBase()): Board {
  const dir = boardDir(base);
  const errors: string[] = [];
  const specs: Spec[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { dir, specs, errors };
  }
  for (const name of entries.sort()) {
    if (!name.endsWith(".md")) continue;
    const file = path.join(dir, name);
    try {
      const spec = parseSpec(fs.readFileSync(file, "utf8"), name);
      const expected = `${spec.id}.md`;
      if (name !== expected) errors.push(`${name}: filename should be ${expected}`);
      specs.push(spec);
    } catch (e) {
      errors.push(e instanceof SpecError ? e.message : `${name}: ${String(e)}`);
    }
  }
  const seen = new Map<string, string>();
  for (const s of specs) {
    const prev = seen.get(s.id);
    if (prev) errors.push(`${s.file}: duplicate id ${s.id} (also in ${prev})`);
    seen.set(s.id, s.file);
  }
  return { dir, specs, errors };
}

export function specPath(id: string, base = homeBase()): string {
  return path.join(boardDir(base), `${id}.md`);
}

export function nextId(base = homeBase()): string {
  const dir = boardDir(base);
  const used = new Set<number>();
  const scan = (d: string): void => {
    let names: string[] = [];
    try {
      names = fs.readdirSync(d);
    } catch {
      return;
    }
    for (const n of names) {
      const m = n.match(/^ns-(\d+)\.md$/);
      if (m) used.add(Number(m[1]));
    }
    let subdirs: string[] = [];
    try {
      subdirs = fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {}
    for (const s of subdirs) scan(path.join(d, s));
  };
  scan(dir);
  scan(archiveDir(base));
  let n = 1;
  while (used.has(n)) n++;
  return `ns-${String(n).padStart(4, "0")}`;
}

export function ensureLayout(base = homeBase()): void {
  for (const d of [base, boardDir(base), archiveDir(base), runsDir(base), sessionsDir(base)]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function writeSpec(spec: Spec, base = homeBase()): void {
  fs.mkdirSync(boardDir(base), { recursive: true });
  writeSpecTo(path.join(boardDir(base), `${spec.id}.md`), spec);
}

export function writeSpecTo(file: string, spec: Spec): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, serializeSpec(spec));
  fs.renameSync(tmp, file);
}

export function removeSpecFile(id: string, base = homeBase()): void {
  fs.rmSync(specPath(id, base), { force: true });
}

export function archiveRun(specs: Spec[], date: string, reportText: string, base = homeBase()): string {
  const target = path.join(archiveDir(base), date);
  fs.mkdirSync(target, { recursive: true });
  for (const spec of specs) {
    writeSpecTo(path.join(target, `${spec.id}.md`), spec);
    removeSpecFile(spec.id, base);
  }
  fs.writeFileSync(path.join(target, "report.txt"), reportText);
  return target;
}

export function readArchiveSpecs(date: string, base = homeBase()): Board {
  const dir = path.join(archiveDir(base), date);
  const errors: string[] = [];
  const specs: Spec[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { dir, specs, errors: [`no archive for ${date}: ${dir}`] };
  }
  for (const name of entries.sort()) {
    if (!name.endsWith(".md")) continue;
    try {
      specs.push(parseSpec(fs.readFileSync(path.join(dir, name), "utf8"), name));
    } catch (e) {
      errors.push(e instanceof SpecError ? e.message : `${name}: ${String(e)}`);
    }
  }
  return { dir, specs, errors };
}

export function listArchiveDates(base = homeBase()): string[] {
  try {
    return fs
      .readdirSync(archiveDir(base), { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

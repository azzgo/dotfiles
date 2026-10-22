import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

import { bodyTemplate, checkSpec, missingSections, parseSpec, serializeSpec } from "../src/spec.ts";
import { nextId, loadBoard, loadConfig, acquireLock, releaseLock, resolveConfig, DEFAULT_CONFIG } from "../src/board.ts";
import { buildImplArgs, buildVerifyArgs, parseVerdict, parseReviewHint, DispatchError } from "../src/dispatch.ts";
import { assertWindowSane, resolveDeadline, runNightshift, WindowTooLongError } from "../src/run.ts";
import { implPrompt, verifyPrompt, extractSection } from "../src/prompt.ts";
import { preflight, revertTo, countCommits } from "../src/git.ts";
import { collectStatus } from "../src/status.ts";
import { lintSpec } from "../src/lint.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "..", "main.ts");
const FAKE_PI = path.join(HERE, "fake-pi.mjs");

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeRepo() {
  const dir = fs.realpathSync.native(tmp("ns-repo-"));
  const git = (args) => {
    const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "nightshift@example.test"]);
  git(["config", "user.name", "Nightshift Test"]);
  fs.writeFileSync(path.join(dir, "README.md"), "# test\n");
  git(["add", "README.md"]);
  git(["commit", "-q", "-m", "init"]);
  return { dir, git };
}

function specBody(overrides = {}) {
  const parts = {
    Goal: "add a fake file",
    Change: "create nightshift-fake.txt",
    Constraints: "do not touch README.md",
    Verify: "nightshift-fake.txt exists",
    "Out of scope": "anything else",
    ...overrides,
  };
  return (
    "\n" +
    Object.entries(parts)
      .map(([k, v]) => `## ${k}\n${v}\n`)
      .join("\n") +
    "\n"
  );
}

function makeSpec(over = {}) {
  return {
    id: "ns-0001",
    status: "ready",
    dir: "/tmp/example",
    title: "fake spec",
    created: "2026-10-19T00:00:00.000Z",
    model: null,
    thinking: null,
    tools: [],
    extensions: [],
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
    body: specBody(),
    file: "ns-0001.md",
    ...over,
  };
}

function runCli(args, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status ?? 1, out: r.stdout, err: r.stderr };
}

// ── spec ────────────────────────────────────────────────────────────────

test("spec: roundtrip preserves body bytes", () => {
  const text = serializeSpec(makeSpec());
  const parsed = parseSpec(text, "ns-0001.md");
  assert.strictEqual(parsed.id, "ns-0001");
  assert.strictEqual(parsed.body, makeSpec().body);
});

test("spec: unknown frontmatter key is an error", () => {
  const text = serializeSpec(makeSpec()).replace("---\nid:", "---\nbogus_key: 1\nid:");
  assert.throws(() => parseSpec(text, "ns-0001.md"), /unknown frontmatter key: bogus_key/);
});

test("spec: inline lists parse", () => {
  const s = makeSpec({ tools: ["+replace_match", "codemode"] });
  const parsed = parseSpec(serializeSpec(s), "ns-0001.md");
  assert.deepStrictEqual(parsed.tools, ["+replace_match", "codemode"]);
});

test("spec: bad status rejected", () => {
  const text = serializeSpec(makeSpec()).replace("status: ready", "status: done");
  assert.throws(() => parseSpec(text, "ns-0001.md"), /unknown status: done/);
});

test("spec: missing sections detected", () => {
  assert.deepStrictEqual(missingSections(specBody()), []);
  assert.deepStrictEqual(missingSections("## Goal\nx\n"), ["Change", "Constraints", "Verify", "Out of scope"]);
});

test("spec: ready spec with empty Change is rejected by checkSpec", () => {
  const s = makeSpec({ body: specBody({ Change: "" }) });
  const errors = checkSpec(s, "ns-0001.md");
  assert.ok(errors.some((e) => e.includes('"Change"')));
});

test("spec: bodyTemplate has all five sections", () => {
  assert.deepStrictEqual(missingSections(bodyTemplate()), []);
});

// ── board ───────────────────────────────────────────────────────────────

test("board: nextId starts at ns-0001 and skips used ids", () => {
  const base = tmp("ns-base-");
  assert.strictEqual(nextId(base), "ns-0001");
  fs.mkdirSync(path.join(base, "board"), { recursive: true });
  fs.writeFileSync(path.join(base, "board", "ns-0001.md"), "x");
  assert.strictEqual(nextId(base), "ns-0002");
});

test("board: nextId scans archive too", () => {
  const base = tmp("ns-base-");
  fs.mkdirSync(path.join(base, "archive", "2026-10-19"), { recursive: true });
  fs.writeFileSync(path.join(base, "archive", "2026-10-19", "ns-0001.md"), "x");
  assert.strictEqual(nextId(base), "ns-0002");
});

test("board: loadBoard reports filename mismatch", () => {
  const base = tmp("ns-base-");
  fs.mkdirSync(path.join(base, "board"), { recursive: true });
  fs.writeFileSync(path.join(base, "board", "wrong-name.md"), serializeSpec(makeSpec()));
  const board = loadBoard(base);
  assert.ok(board.errors.some((e) => e.includes("filename should be ns-0001.md")));
});

test("board: config defaults when file missing", () => {
  const cfg = loadConfig("/nonexistent/config.json");
  assert.deepStrictEqual(cfg, DEFAULT_CONFIG);
});

test("board: verifyTimeoutSec is configurable and defaults to 1800", () => {
  const cfg = loadConfig("/nonexistent/config.json");
  assert.strictEqual(cfg.verifyTimeoutSec, 1800);
  const resolved = resolveConfig({ verifyTimeoutSec: 5400 });
  assert.strictEqual(resolved.verifyTimeoutSec, 5400);
  const fallback = resolveConfig({ verifyTimeoutSec: 0 });
  assert.strictEqual(fallback.verifyTimeoutSec, DEFAULT_CONFIG.verifyTimeoutSec);
});

test("board: lock refuses a second live holder", () => {
  const base = tmp("ns-base-");
  acquireLock(base);
  const second = spawnSync(process.execPath, ["-e", "1"], { encoding: "utf8" });
  void second;
  assert.throws(() => {
    const { acquireLock: again } = { acquireLock };
    const tmpBase = base;
    const lockFile = path.join(tmpBase, "run.lock");
    const holder = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    if (holder.pid === process.pid) throw Object.assign(new Error("same pid"), { name: "LockHeldError" });
    again(tmpBase);
  });
  releaseLock(base);
  assert.ok(!fs.existsSync(path.join(base, "run.lock")));
});

test("board: stale lock is reclaimed", () => {
  const base = tmp("ns-base-");
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, "run.lock"), JSON.stringify({ pid: 999999, startedAt: "x", runId: "old" }));
  const lock = acquireLock(base);
  assert.strictEqual(lock.pid, process.pid);
  releaseLock(base);
});

// ── dispatch argv ───────────────────────────────────────────────────────

test("dispatch: impl argv disables extensions, mcp, skills and keeps plain tool set", () => {
  const args = buildImplArgs(makeSpec({ tools: ["+codemode"] }), DEFAULT_CONFIG, "/base");
  assert.ok(args.includes("-ne"));
  assert.ok(args.includes("--no-mcp"));
  assert.ok(args.includes("-ns"));
  const toolsIdx = args.indexOf("--tools");
  assert.strictEqual(args[toolsIdx + 1], "+codemode");
});

test("dispatch: the prompt never appears in argv", () => {
  const prompt = "PROMPT-MARKER-" + "x".repeat(5000);
  for (const args of [buildImplArgs(makeSpec(), DEFAULT_CONFIG, "/base"), buildVerifyArgs(makeSpec(), DEFAULT_CONFIG)]) {
    assert.ok(!args.some((a) => a.includes("PROMPT-MARKER")), "prompt must travel over stdin, not argv");
    const argc = args.join(" ").length;
    assert.ok(argc < 500, `argv must stay short, got ${argc} chars`);
  }
});

test("dispatch: tool names without a sign get a plus", () => {
  const args = buildImplArgs(makeSpec({ tools: ["codemode"] }), DEFAULT_CONFIG, "/base");
  assert.strictEqual(args[args.indexOf("--tools") + 1], "+codemode");
});

test("dispatch: sub-dispatch extension is refused", () => {
  assert.throws(
    () => buildImplArgs(makeSpec({ extensions: ["/x/pi/agent/extensions/sub-dispatch/index.ts"] }), DEFAULT_CONFIG, "/b"),
    DispatchError,
  );
});

test("dispatch: verify argv is read-only and sessionless", () => {
  const args = buildVerifyArgs(makeSpec(), DEFAULT_CONFIG);
  assert.ok(args.includes("--no-session"));
  assert.ok(args.includes("-ne"));
  assert.strictEqual(args[args.indexOf("--tools") + 1], "read,bash,grep,find,ls");
});

test("dispatch: model omitted when nothing configured", () => {
  const args = buildImplArgs(makeSpec(), DEFAULT_CONFIG, "/b");
  assert.ok(!args.includes("--model"));
});

test("dispatch: spec model wins over config default", () => {
  const cfg = { ...DEFAULT_CONFIG, defaultModel: "cfg" };
  const args = buildImplArgs(makeSpec({ model: "spec-model" }), cfg, "/b");
  assert.strictEqual(args[args.indexOf("--model") + 1], "spec-model");
});

// ── verdict ─────────────────────────────────────────────────────────────

test("verdict: last VERDICT line wins", () => {
  const out = "thinking\nVERDICT: fail\nREASON: nope\nmore\nVERDICT: pass\nREASON: ok\n";
  assert.deepStrictEqual(parseVerdict(out, 0), { verdict: "pass", reason: "ok" });
});

test("verdict: missing line becomes verify-error, never fail", () => {
  const r = parseVerdict("no verdict here\n", 1);
  assert.strictEqual(r.verdict, "verify-error");
  assert.ok(r.reason.includes("no VERDICT"));
});

test("verdict: a killed verifier reports the signal, not just a bare exit", () => {
  const r = parseVerdict("", null, { signal: "SIGKILL", stderr: "" });
  assert.strictEqual(r.verdict, "verify-error");
  assert.ok(r.reason.includes("SIGKILL"), r.reason);
});

test("verdict: the stderr tail is surfaced so a spawn failure is diagnosable", () => {
  const r = parseVerdict("", 1, { signal: null, stderr: "line a\nError: disk full\n" });
  assert.ok(r.reason.includes("exit 1"), r.reason);
  assert.ok(r.reason.includes("Error: disk full"), r.reason);
});

test("verdict: indented lines are accepted", () => {
  assert.strictEqual(parseVerdict("  VERDICT: pass\n", 0).verdict, "pass");
});

test("verdict: inline mention is not a verdict", () => {
  assert.strictEqual(parseVerdict("I will write VERDICT: pass later\n", 0).verdict, "verify-error");
});

test("verdict: review hint parsed", () => {
  assert.strictEqual(parseReviewHint("work done\nREVIEW-HINT: look at cli/\n"), "look at cli/");
  assert.strictEqual(parseReviewHint("nothing"), null);
});

// ── prompt ──────────────────────────────────────────────────────────────

test("prompt: extractSection isolates Verify", () => {
  const body = specBody({ Verify: "file exists" });
  assert.strictEqual(extractSection(body, "Verify").trim(), "file exists");
});

test("prompt: impl prompt carries discipline and omits self-check", () => {
  const p = implPrompt({ spec: makeSpec(), baseline: "abc1234", attempt: 0, feedback: null });
  assert.ok(p.includes("禁止 `git add -A`"));
  assert.ok(!p.includes("SELF-CHECK"));
});

test("prompt: retry includes feedback", () => {
  const p = implPrompt({ spec: makeSpec(), baseline: "abc1234", attempt: 1, feedback: "tests missing" });
  assert.ok(p.includes("tests missing"));
});

test("prompt: verify prompt demands the verdict format", () => {
  const p = verifyPrompt({ spec: makeSpec(), baseline: "abc1234", head: "def5678" });
  assert.ok(p.includes("VERDICT: pass"));
  assert.ok(p.includes("只能"));
});

// ── window ──────────────────────────────────────────────────────────────

test("window: relative +30m", () => {
  const now = new Date("2026-10-19T23:00:00Z");
  assert.strictEqual(resolveDeadline("+30m", now).toISOString(), "2026-10-19T23:30:00.000Z");
});

test("window: HH:MM rolls to tomorrow when already past", () => {
  const now = new Date(2026, 9, 19, 23, 30, 0);
  const d = resolveDeadline("07:00", now);
  assert.strictEqual(d.getDate(), 20);
  assert.strictEqual(d.getHours(), 7);
});

test("window: garbage returns null", () => {
  assert.strictEqual(resolveDeadline("soon", new Date()), null);
  assert.strictEqual(resolveDeadline("99:99", new Date()), null);
});

// ── git ─────────────────────────────────────────────────────────────────

test("git: preflight on non-repo fails", () => {
  const dir = tmp("ns-nogit-");
  assert.strictEqual(preflight(dir).ok, false);
});

test("git: revertTo restores baseline", () => {
  const repo = makeRepo();
  const base = preflight(repo.dir);
  assert.strictEqual(base.ok, true);
  fs.writeFileSync(path.join(repo.dir, "new.txt"), "x");
  repo.git(["add", "new.txt"]);
  repo.git(["commit", "-q", "-m", "add"]);
  assert.strictEqual(countCommits(repo.dir, base.baseline), 1);
  const r = revertTo(repo.dir, base.baseline);
  assert.strictEqual(r.ok, true);
  assert.ok(!fs.existsSync(path.join(repo.dir, "new.txt")));
});

// ── cli end-to-end ──────────────────────────────────────────────────────

test("cli: add writes a draft, ready refuses an empty Change", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const add = runCli(["add", "--dir", repo.dir, "--title", "demo"], {
    NIGHTSHIFT_HOME: base,
  });
  assert.strictEqual(add.status, 0, add.err);
  const id = add.out.trim().split(/\s+/)[0];
  assert.match(id, /^ns-\d{4}$/);

  const list = runCli(["list"], { NIGHTSHIFT_HOME: base });
  assert.ok(list.out.includes("draft"));

  const ready = runCli(["ready", id], { NIGHTSHIFT_HOME: base });
  assert.notStrictEqual(ready.status, 0);
  assert.ok(ready.err.includes("empty"), ready.err);
});

test("cli: add via stdin + ready succeeds, check passes", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const id = r.stdout.trim().split(/\s+/)[0];
  assert.strictEqual(runCli(["ready", id], { NIGHTSHIFT_HOME: base }).status, 0);
  const check = runCli(["check"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(check.status, 0, check.stderr);
  assert.ok(check.out.includes("ok: 1 spec"));
});

test("cli: show renders baseline instructions once a spec has a baseline", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  const id = r.stdout.trim().split(/\s+/)[0];
  const specFile = path.join(base, "board", `${id}.md`);
  const spec = parseSpec(fs.readFileSync(specFile, "utf8"), `${id}.md`);
  spec.baseline = preflight(repo.dir).baseline;
  fs.writeFileSync(specFile, serializeSpec(spec));
  const show = runCli(["show", id], { NIGHTSHIFT_HOME: base });
  assert.ok(show.out.includes(`git -C ${repo.dir}`), show.out);
});

test("cli: report after a run points at the baseline range", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  const id = r.stdout.trim().split(/\s+/)[0];
  runCli(["ready", id], { NIGHTSHIFT_HOME: base });
  const run = runCli(["run", "--until", "+1m"], {
    NIGHTSHIFT_HOME: base,
    NIGHTSHIFT_PI_BIN: pi,
  });
  assert.strictEqual(run.status, 0, run.err);
  assert.ok(run.out.includes(`git -C ${repo.dir} log --oneline`), run.out);
  assert.ok(run.out.includes(`${id}`), run.out);
});

// ── run loop ────────────────────────────────────────────────────────────

function withFakePiScript() {
  const dir = tmp("ns-fakepi-");
  const file = path.join(dir, "pi");
  const body = fs.readFileSync(FAKE_PI, "utf8").replace(/^#!.*\n/, "");
  fs.writeFileSync(file, `#!${process.execPath}\n` + body);
  fs.chmodSync(file, 0o755);
  return file;
}

async function runLoop(base, cfg, jobs = 1, until = "+2m") {
  const logs = [];
  const result = await runNightshift({
    base,
    cfg,
    until,
    jobs,
    log: (l) => logs.push(l),
  });
  return { result, logs };
}

function writeReady(base, id, dir, created) {
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, `${id}.md`),
    serializeSpec({ ...makeSpec({ id, status: "ready", dir, created }), file: `${id}.md` }),
  );
}

test("run: both agents receive their prompt over stdin, and argv stays short", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({ ...makeSpec({ id: "ns-0001", status: "ready", dir: repo.dir }), file: "ns-0001.md" }),
  );
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_REQUIRE_STDIN = "1";
  process.env.FAKE_ASSERT_PROMPT = "## Verify";
  try {
    const { result, logs } = await runLoop(base, cfg, 1);
    assert.strictEqual(result.specs[0].status, "passed", logs.join("\n"));
  } finally {
    delete process.env.FAKE_REQUIRE_STDIN;
    delete process.env.FAKE_ASSERT_PROMPT;
  }
});

test("run: a killed impl agent surfaces the signal instead of a bare verify-error", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({ ...makeSpec({ id: "ns-0001", status: "ready", dir: repo.dir }), file: "ns-0001.md" }),
  );
  const base2 = tmp("ns-fakepi-kill-");
  const pi = path.join(base2, "pi");
  fs.writeFileSync(pi, `#!${process.execPath}\nprocess.kill(process.pid, "SIGKILL");\n`);
  fs.chmodSync(pi, 0o755);
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg, 1);
  assert.strictEqual(result.specs[0].status, "verify-error", logs.join("\n"));
  assert.ok(result.specs[0].reason.includes("SIGKILL"), result.specs[0].reason);
});

test("run: a timed-out impl reports the residual it left behind", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({ ...makeSpec({ id: "ns-0001", status: "ready", dir: repo.dir }), file: "ns-0001.md" }),
  );
  const base2 = tmp("ns-fakepi-hang-");
  const pi = path.join(base2, "pi");
  fs.writeFileSync(
    pi,
    `#!${process.execPath}\n` +
      `import fs from "node:fs";\n` +
      `fs.writeFileSync("leftover.txt", "x");\n` +
      `setTimeout(() => {}, 600000);\n`,
  );
  fs.chmodSync(pi, 0o755);
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 1 };
  const { result, logs } = await runLoop(base, cfg, 1);
  assert.strictEqual(result.specs[0].status, "verify-error", logs.join("\n"));
  assert.ok(result.specs[0].reason.includes("timed out after 1s"), result.specs[0].reason);
  assert.ok(result.specs[0].reason.includes("uncommitted path"), result.specs[0].reason);
});

test("run: full pass path archives the spec and leaves a commit", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  const id = r.stdout.trim().split(/\s+/)[0];
  runCli(["ready", id], { NIGHTSHIFT_HOME: base });

  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg);
  assert.strictEqual(result.specs.length, 1, logs.join("\n"));
  assert.strictEqual(result.specs[0].status, "passed", logs.join("\n"));
  assert.strictEqual(result.specs[0].attempts, 1);
  assert.ok((result.specs[0].commits ?? 0) >= 1);
  assert.ok(result.archivedTo !== null);
  assert.ok(fs.existsSync(path.join(result.archivedTo, `${id}.md`)));
  assert.ok(fs.existsSync(path.join(result.archivedTo, "report.txt")));
  assert.strictEqual(loadBoard(base).specs.length, 0);
});

test("run: fail then retry, ends needs-review with 2 attempts", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  const id = r.stdout.trim().split(/\s+/)[0];
  runCli(["ready", id], { NIGHTSHIFT_HOME: base });

  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_VERDICT = "fail";
  process.env.FAKE_REASON = "missing test";
  try {
    const { result, logs } = await runLoop(base, cfg);
    assert.strictEqual(result.specs[0].status, "needs-review", logs.join("\n"));
    assert.strictEqual(result.specs[0].attempts, 2);
    assert.strictEqual(result.specs[0].reason, "missing test");
  } finally {
    delete process.env.FAKE_VERDICT;
    delete process.env.FAKE_REASON;
  }
});

test("run: missing VERDICT yields verify-error without retry", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  const id = r.stdout.trim().split(/\s+/)[0];
  runCli(["ready", id], { NIGHTSHIFT_HOME: base });

  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_NO_VERDICT = "1";
  try {
    const { result, logs } = await runLoop(base, cfg);
    assert.strictEqual(result.specs[0].status, "verify-error", logs.join("\n"));
    assert.strictEqual(result.specs[0].attempts, 1);
  } finally {
    delete process.env.FAKE_NO_VERDICT;
  }
});

test("run: different dirs run in parallel", async () => {
  const base = tmp("ns-home-");
  const repoA = makeRepo();
  const repoB = makeRepo();
  const pi = withFakePiScript();
  for (const repo of [repoA, repoB]) {
    const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
      encoding: "utf8",
      env: { ...process.env, NIGHTSHIFT_HOME: base },
      input: specBody(),
    });
    const id = r.stdout.trim().split(/\s+/)[0];
    runCli(["ready", id], { NIGHTSHIFT_HOME: base });
  }
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg, 3);
  assert.strictEqual(result.specs.length, 2, logs.join("\n"));
  assert.ok(result.specs.every((s) => s.status === "passed"), logs.join("\n"));
  const dirs = new Set(result.specs.map((s) => s.dir));
  assert.strictEqual(dirs.size, 2);
});

test("cli: a second spec on the same dir is queued instead of refused", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const first = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "one"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  assert.strictEqual(first.status, 0, first.stderr);
  const second = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "two"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  assert.strictEqual(second.status, 0, second.stderr);
  assert.ok(second.stdout.includes("queue: 1 spec(s) ahead"), second.stdout);
  const listed = runCli(["list"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(listed.out.trim().split("\n").length, 2, listed.out);
  assert.strictEqual(runCli(["check"], { NIGHTSHIFT_HOME: base }).status, 0);
});

test("run: an over-capacity serial queue drains one at a time", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  for (const id of ["ns-0001", "ns-0002"]) {
    fs.writeFileSync(
      path.join(boardDirPath, `${id}.md`),
      serializeSpec({ ...makeSpec({ id, status: "ready", dir: repo.dir }), file: `${id}.md` }),
    );
  }
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg, 3);
  assert.strictEqual(result.specs.length, 2, logs.join("\n"));
  assert.strictEqual(logs.filter((l) => l.includes("dispatch")).length, 2);
});

test("run: draft specs are never dispatched", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg);
  assert.strictEqual(result.specs.length, 0, logs.join("\n"));
  assert.strictEqual(loadBoard(base).specs.length, 1);
});

test("run: second concurrent run is refused by the lock", async () => {
  const base = tmp("ns-home-");
  acquireLock(base);
  const cfg = { ...DEFAULT_CONFIG, piBin: process.execPath, timeoutSec: 5 };
  await assert.rejects(() => runLoop(base, cfg), /another nightshift run is active/);
  releaseLock(base);
});

test("window: an over-long window is refused before any dispatch", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", "demo"], {
    encoding: "utf8",
    env: { ...process.env, NIGHTSHIFT_HOME: base },
    input: specBody(),
  });
  const id = r.stdout.trim().split(/\s+/)[0];
  runCli(["ready", id], { NIGHTSHIFT_HOME: base });
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30, maxWindowHours: 2 };
  await assert.rejects(() => runLoop(base, cfg, 1, "+3h"), /over maxWindowHours=2/);
  assert.strictEqual(loadBoard(base).specs[0].status, "ready");
});

test("window: assertWindowSane boundary", () => {
  const start = new Date("2026-10-20T23:00:00Z");
  assertWindowSane(start, new Date("2026-10-21T07:00:00Z"), 8);
  assert.throws(() => assertWindowSane(start, new Date("2026-10-21T07:00:01Z"), 8), WindowTooLongError);
});

test("run: same-dir queue drains in created order", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  writeReady(base, "ns-0002", repo.dir, "2026-10-19T02:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg, 3);
  assert.deepStrictEqual(result.specs.map((s) => s.id), ["ns-0001", "ns-0002"], logs.join("\n"));
  assert.ok(result.specs.every((s) => s.status === "passed"), logs.join("\n"));
  assert.strictEqual(loadBoard(base).specs.length, 0);
});

test("run: a needs-review spec stops the rest of its dir queue", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const other = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  writeReady(base, "ns-0002", repo.dir, "2026-10-19T02:00:00.000Z");
  writeReady(base, "ns-0003", other.dir, "2026-10-19T03:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_VERDICT = "fail";
  process.env.FAKE_REASON = "nope";
  try {
    const { result, logs } = await runLoop(base, cfg, 3);
    const byId = new Map(result.specs.map((s) => [s.id, s]));
    assert.strictEqual(byId.get("ns-0001").status, "needs-review", logs.join("\n"));
    assert.strictEqual(byId.get("ns-0003").status, "needs-review", logs.join("\n"));
    assert.ok(!byId.has("ns-0002"), logs.join("\n"));
    const left = loadBoard(base).specs.find((s) => s.id === "ns-0002");
    assert.strictEqual(left.status, "blocked", JSON.stringify(left));
    assert.strictEqual(left.reason, "blocked by ns-0001 (needs-review)");
    assert.ok(result.report.includes("queue stopped: ns-0001 needs-review"), result.report);
    assert.ok(result.report.includes("队列停止 1"), result.report);
  } finally {
    delete process.env.FAKE_VERDICT;
    delete process.env.FAKE_REASON;
  }
});

test("run: verify-error also stops the dir queue", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  writeReady(base, "ns-0002", repo.dir, "2026-10-19T02:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_NO_VERDICT = "1";
  try {
    const { result, logs } = await runLoop(base, cfg, 3);
    assert.deepStrictEqual(result.specs.map((s) => s.id), ["ns-0001"], logs.join("\n"));
    assert.strictEqual(result.specs[0].status, "verify-error");
    const left = loadBoard(base).specs.find((s) => s.id === "ns-0002");
    assert.strictEqual(left.status, "blocked");
    assert.strictEqual(left.reason, "blocked by ns-0001 (verify-error)");
  } finally {
    delete process.env.FAKE_NO_VERDICT;
  }
});

test("run: skipped also stops the dir queue", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const noRepo = fs.realpathSync.native(tmp("ns-nogit-"));
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", noRepo, "2026-10-19T01:00:00.000Z");
  writeReady(base, "ns-0002", noRepo, "2026-10-19T02:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg, 3);
  assert.deepStrictEqual(result.specs.map((s) => s.id), ["ns-0001"], logs.join("\n"));
  assert.strictEqual(result.specs[0].status, "skipped");
  assert.strictEqual(loadBoard(base).specs[0].status, "blocked");
  void repo;
});

test("cli: release unblocks the dir queue after a failure", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0001", status: "blocked", dir: repo.dir }),
      reason: "blocked by ns-0000 (needs-review)",
      file: "ns-0001.md",
    }),
  );
  const r = runCli(["release", "ns-0000"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  assert.ok(r.out.includes("ns-0001 -> ready"), r.out);
  assert.strictEqual(loadBoard(base).specs[0].status, "ready");
});

test("cli: review --drop releases the blocked queue behind its baseline", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const baseline = preflight(repo.dir).baseline;
  fs.writeFileSync(path.join(repo.dir, "work.txt"), "x");
  repo.git(["add", "work.txt"]);
  repo.git(["commit", "-q", "-m", "work"]);
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0001", status: "needs-review", dir: repo.dir }),
      baseline,
      file: "ns-0001.md",
    }),
  );
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0002.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0002", status: "blocked", dir: repo.dir }),
      reason: "blocked by ns-0001 (needs-review)",
      file: "ns-0002.md",
    }),
  );
  const r = runCli(["review", "ns-0001", "--drop"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  assert.ok(r.out.includes("ns-0002 -> ready (queue released)"), r.out);
  assert.ok(!fs.existsSync(path.join(repo.dir, "work.txt")));
  const ns2 = loadBoard(base).specs.find((s) => s.id === "ns-0002");
  assert.strictEqual(ns2.status, "ready");
  assert.strictEqual(ns2.reason, null);
});

test("cli: review finds an archived spec so a stopped queue can be released", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const baseline = preflight(repo.dir).baseline;
  fs.mkdirSync(path.join(base, "archive", "2026-10-19"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "archive", "2026-10-19", "ns-0001.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0001", status: "needs-review", dir: repo.dir }),
      baseline,
      file: "ns-0001.md",
    }),
  );
  fs.mkdirSync(path.join(base, "board"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "board", "ns-0002.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0002", status: "blocked", dir: repo.dir }),
      reason: "blocked by ns-0001 (needs-review)",
      file: "ns-0002.md",
    }),
  );
  const shown = runCli(["review", "ns-0001"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(shown.status, 0, shown.err);
  assert.ok(shown.out.includes("ns-0001 — fake spec"), shown.out);
  const r = runCli(["review", "ns-0001", "--drop"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  const ns2 = loadBoard(base).specs.find((s) => s.id === "ns-0002");
  assert.strictEqual(ns2.status, "ready");
});

// ── queue order ─────────────────────────────────────────────────────────

test("spec: order round-trips through the frontmatter", () => {
  const parsed = parseSpec(serializeSpec(makeSpec({ order: 3 })), "ns-0001.md");
  assert.strictEqual(parsed.order, 3);
  const back = parseSpec(serializeSpec(makeSpec({ order: null })), "ns-0001.md");
  assert.strictEqual(back.order, null);
});

test("queue: a spec added with --before lands in front of the existing queue", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const env = { ...process.env, NIGHTSHIFT_HOME: base };
  for (const title of ["one", "two"]) {
    const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", title], {
      encoding: "utf8",
      env,
      input: specBody(),
    });
    assert.strictEqual(r.status, 0, r.stderr);
  }
  const third = spawnSync(
    process.execPath,
    [CLI, "add", "--dir", repo.dir, "--title", "three", "--before", "ns-0001"],
    { encoding: "utf8", env, input: specBody() },
  );
  assert.strictEqual(third.status, 0, third.stderr);
  for (const id of ["ns-0001", "ns-0002", "ns-0003"]) {
    const r = runCli(["ready", id], { NIGHTSHIFT_HOME: base });
    assert.strictEqual(r.status, 0, r.err);
  }
  const q = runCli(["queue", "--dir", repo.dir], { NIGHTSHIFT_HOME: base });
  const ids = q.out.trim().split("\n").map((l) => l.trim().split(/\s+/)[1]);
  assert.deepStrictEqual(ids, ["ns-0003", "ns-0001", "ns-0002"], q.out);
  const ranks = loadBoard(base).specs
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => s.order);
  assert.deepStrictEqual(ranks, [1, 2, 3]);
});

test("queue: --move relocates a spec inside its dir queue", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const env = { ...process.env, NIGHTSHIFT_HOME: base };
  for (const title of ["one", "two", "three"]) {
    const r = spawnSync(process.execPath, [CLI, "add", "--dir", repo.dir, "--title", title], {
      encoding: "utf8",
      env,
      input: specBody(),
    });
    assert.strictEqual(r.status, 0, r.stderr);
  }
  const moved = runCli(["queue", "--move", "ns-0003", "--before", "ns-0001"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(moved.status, 0, moved.err);
  for (const id of ["ns-0001", "ns-0002", "ns-0003"]) {
    const r = runCli(["ready", id], { NIGHTSHIFT_HOME: base });
    assert.strictEqual(r.status, 0, r.err);
  }
  const q = runCli(["queue", "--dir", repo.dir], { NIGHTSHIFT_HOME: base });
  const ids = q.out.trim().split("\n").map((l) => l.trim().split(/\s+/)[1]);
  assert.deepStrictEqual(ids, ["ns-0003", "ns-0001", "ns-0002"], q.out);
});

test("run: the dispatch order follows the explicit order, not created", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  writeReady(base, "ns-0002", repo.dir, "2026-10-19T02:00:00.000Z");
  const moved = runCli(["queue", "--move", "ns-0002", "--before", "ns-0001"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(moved.status, 0, moved.err);
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  const { result, logs } = await runLoop(base, cfg, 3);
  assert.deepStrictEqual(result.specs.map((s) => s.id), ["ns-0002", "ns-0001"], logs.join("\n"));
});

// ── baseline integrity / rearm / drop guardrails ────────────────────────

test("run: a rewritten history voids the verdict instead of judging a wrong range", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_REWRITE_HISTORY = "1";
  try {
    const { result, logs } = await runLoop(base, cfg, 1);
    const spec = result.specs[0];
    assert.strictEqual(spec.status, "verify-error", logs.join("\n"));
    assert.strictEqual(spec.verdict, null);
    assert.ok(/祖先链/.test(spec.reason ?? ""), spec.reason);
    assert.ok(/判决作废/.test(spec.reason ?? ""), spec.reason);
    assert.ok(logs.some((l) => l.includes("verdict voided")), logs.join("\n"));
  } finally {
    delete process.env.FAKE_REWRITE_HISTORY;
  }
});

test("cli: review --drop refuses when the baseline is dangling", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const git = (args) => spawnSync("git", ["-C", repo.dir, ...args], { encoding: "utf8" }).stdout.trim();
  fs.writeFileSync(path.join(repo.dir, "b.txt"), "b\n");
  git(["add", "b.txt"]);
  git(["commit", "-q", "-m", "second"]);
  const dangling = git(["rev-parse", "HEAD"]);
  git(["reset", "--hard", "HEAD~1"]);
  const headBefore = git(["rev-parse", "HEAD"]);
  fs.mkdirSync(path.join(base, "board"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "board", "ns-0001.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0001", status: "needs-review", dir: repo.dir }),
      baseline: dangling,
      file: "ns-0001.md",
    }),
  );
  const r = runCli(["review", "ns-0001", "--drop"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(/祖先链/.test(r.err), r.err);
  assert.strictEqual(git(["rev-parse", "HEAD"]), headBefore, "HEAD must not move");
});

test("cli: review --drop leaves a backup ref of the discarded head", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const git = (args) => spawnSync("git", ["-C", repo.dir, ...args], { encoding: "utf8" }).stdout.trim();
  const baseline = git(["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(repo.dir, "b.txt"), "b\n");
  git(["add", "b.txt"]);
  git(["commit", "-q", "-m", "second"]);
  const headBefore = git(["rev-parse", "HEAD"]);
  fs.mkdirSync(path.join(base, "board"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "board", "ns-0001.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0001", status: "needs-review", dir: repo.dir }),
      baseline,
      file: "ns-0001.md",
    }),
  );
  const r = runCli(["review", "ns-0001", "--drop"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  assert.ok(r.out.includes("将丢弃 1 个提交"), r.out);
  assert.strictEqual(git(["rev-parse", "HEAD"]), baseline);
  assert.strictEqual(git(["rev-parse", "refs/nightshift/backup/ns-0001"]), headBefore);
});

test("cli: rearm restores an archived spec, re-anchors the baseline and keeps the reason", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const git = (args) => spawnSync("git", ["-C", repo.dir, ...args], { encoding: "utf8" }).stdout.trim();
  const head = git(["rev-parse", "HEAD"]);
  fs.mkdirSync(path.join(base, "archive", "2026-10-19"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "archive", "2026-10-19", "ns-0001.md"),
    serializeSpec({
      ...makeSpec({ id: "ns-0001", status: "needs-review", dir: repo.dir }),
      baseline: "deadbeef",
      verdict: "fail",
      reason: "V2 链仍经共享 coordinator 加载 V1 模块",
      file: "ns-0001.md",
    }),
  );
  const r = runCli(["rearm", "ns-0001"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  assert.ok(r.out.includes("-> ready"), r.out);
  const spec = loadBoard(base).specs.find((s) => s.id === "ns-0001");
  assert.ok(spec, "spec must be back on the board");
  assert.strictEqual(spec.status, "ready");
  assert.strictEqual(spec.baseline, head, "baseline must be re-anchored to the current HEAD");
  assert.strictEqual(spec.reason, "V2 链仍经共享 coordinator 加载 V1 模块");
  assert.strictEqual(spec.verdict, null);
});

test("run: a rearmed spec hands the previous reason to the agent as feedback", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  fs.mkdirSync(path.join(base, "board"), { recursive: true });
  const file = path.join(base, "board", "ns-0001.md");
  const spec = parseSpec(fs.readFileSync(file, "utf8"), "ns-0001.md");
  spec.reason = "上一轮：V2 链仍引用 V1 runtime";
  spec.verdict = "fail";
  fs.writeFileSync(file, serializeSpec(spec));
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_ASSERT_IMPL_PROMPT = "上一轮：V2 链仍引用 V1 runtime";
  try {
    const { result, logs } = await runLoop(base, cfg, 1);
    assert.strictEqual(result.specs[0].status, "passed", logs.join("\n"));
  } finally {
    delete process.env.FAKE_ASSERT_IMPL_PROMPT;
  }
});

// ── status / nudge / stop ───────────────────────────────────────────────

function writePidRecord(base, id, pid, phase = "impl") {
  const dir = path.join(base, "runs", "20261019-010000");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${id}.pid`),
    JSON.stringify({ pid, phase, startedAt: new Date().toISOString() }),
  );
}

function writeLock(base, pid) {
  fs.writeFileSync(
    path.join(base, "run.lock"),
    JSON.stringify({ pid, startedAt: new Date().toISOString(), runId: "20261019-010000" }),
  );
}

test("status: a running spec with a live child and fresh output reads as alive", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({ ...makeSpec({ id: "ns-0001", status: "running", dir: repo.dir }), file: "ns-0001.md" }),
  );
  writePidRecord(base, "ns-0001", process.pid, "impl");
  writeLock(base, process.pid);
  const sess = path.join(base, "sessions", "ns-0001");
  fs.mkdirSync(sess, { recursive: true });
  fs.writeFileSync(path.join(sess, "a.jsonl"), "{}\n");
  const rows = collectStatus({ base });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].liveness, "alive", JSON.stringify(rows[0]));
  assert.strictEqual(rows[0].pid, process.pid);
});

test("status: a running spec whose supervisor is gone reads as orphaned", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({ ...makeSpec({ id: "ns-0001", status: "running", dir: repo.dir }), file: "ns-0001.md" }),
  );
  writePidRecord(base, "ns-0001", process.pid, "impl");
  writeLock(base, 2147483646); // 不存在的 pid
  const rows = collectStatus({ base });
  assert.strictEqual(rows[0].liveness, "orphaned", JSON.stringify(rows[0]));
  assert.ok(/僵尸/.test(rows[0].note), rows[0].note);
});

test("cli: nudge writes the text into the spec inbox", () => {
  const base = tmp("ns-home-");
  const r = runCli(["nudge", "ns-0001", "基线变了，从 db58ec4d4 继续"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  const file = path.join(base, "inbox", "ns-0001.md");
  assert.ok(fs.existsSync(file), file);
  const body = fs.readFileSync(file, "utf8");
  assert.ok(body.includes("基线变了，从 db58ec4d4 继续"), body);
  const r2 = runCli(["nudge", "ns-0001", "第二条"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r2.status, 0, r2.err);
  const body2 = fs.readFileSync(file, "utf8");
  assert.ok(body2.includes("第一条") === false && body2.includes("基线变了") && body2.includes("第二条"), body2);
});

test("cli: stop kills the child process of a running spec", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 120000)"], { stdio: "ignore" });
  const boardDirPath = path.join(base, "board");
  fs.mkdirSync(boardDirPath, { recursive: true });
  fs.writeFileSync(
    path.join(boardDirPath, "ns-0001.md"),
    serializeSpec({ ...makeSpec({ id: "ns-0001", status: "running", dir: repo.dir }), file: "ns-0001.md" }),
  );
  writePidRecord(base, "ns-0001", child.pid, "impl");
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));
  const r = runCli(["stop", "ns-0001"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  assert.ok(r.out.includes("SIGTERM"), r.out);
  const result = await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
  assert.ok(result !== null, "child process survived ns stop");
  assert.strictEqual(result.signal, "SIGTERM");
});

test("run: the impl prompt points the agent at its inbox", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_ASSERT_IMPL_PROMPT = path.join(base, "inbox", "ns-0001.md");
  try {
    const { result, logs } = await runLoop(base, cfg, 1);
    assert.strictEqual(result.specs[0].status, "passed", logs.join("\n"));
  } finally {
    delete process.env.FAKE_ASSERT_IMPL_PROMPT;
  }
});

// ── lint ────────────────────────────────────────────────────────────────

test("lint: a stale SHA and a missing path are flagged", () => {
  const repo = makeRepo();
  const body = [
    "",
    "## Goal",
    "g",
    "",
    "## Change",
    "把 `does-not-exist.ts` 改成别的，参考 `deadbeefcafe1234` 的做法。",
    "",
    "## Constraints",
    "不改 `README.md`",
    "",
    "## Verify",
    "跑测试就行",
    "",
    "## Out of scope",
    "无",
    "",
  ].join("\n");
  const spec = { ...makeSpec({ body }), dir: repo.dir };
  const findings = lintSpec(spec, repo.dir);
  const codes = findings.map((f) => f.code);
  assert.ok(codes.includes("stale-sha"), JSON.stringify(findings));
  assert.ok(codes.includes("missing-path"), JSON.stringify(findings));
  assert.ok(codes.includes("unverifiable"), JSON.stringify(findings));
  assert.ok(!codes.includes("empty-out-of-scope"), JSON.stringify(findings));
});

test("lint: an empty Out of scope is flagged", () => {
  const repo = makeRepo();
  const body = specBody({ "Out of scope": "" });
  const findings = lintSpec({ ...makeSpec({ body }), dir: repo.dir }, repo.dir);
  assert.ok(findings.some((f) => f.code === "empty-out-of-scope"), JSON.stringify(findings));
});

test("lint: a well-formed spec is clean", () => {
  const repo = makeRepo();
  const body = specBody({
    Goal: "README.md 里出现一行 hello",
    Change: "在 `README.md` 末尾加一行 hello",
    Constraints: "不改 `README.md` 以外的东西",
    Verify: "`README.md` 的最后一行是 hello",
    "Out of scope": "不加别的文件",
  });
  const findings = lintSpec({ ...makeSpec({ body }), dir: repo.dir }, repo.dir);
  assert.deepStrictEqual(findings, [], JSON.stringify(findings));
});

test("cli: lint exits non-zero when a spec has an error", () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const body = specBody({ "Out of scope": "" });
  fs.mkdirSync(path.join(base, "board"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "board", "ns-0001.md"),
    serializeSpec({ ...makeSpec({ id: "ns-0001", status: "ready", dir: repo.dir, body }), file: "ns-0001.md" }),
  );
  const r = runCli(["lint"], { NIGHTSHIFT_HOME: base });
  assert.ok(r.out.includes("ns-0001"), r.out);
});

// ── 窗口预算 / tail ─────────────────────────────────────────────────────

test("window: there is no cap by default (maxWindowHours = 0)", () => {
  assert.strictEqual(DEFAULT_CONFIG.maxWindowHours, 0, "默认不设上限");
  assert.strictEqual(resolveConfig({}).maxWindowHours, 0);
  const start = new Date("2026-10-20T23:00:00Z");
  assert.doesNotThrow(() => assertWindowSane(start, new Date("2026-10-22T07:00:00Z"), 0));
  assert.throws(() => assertWindowSane(start, new Date("2026-10-22T07:00:00Z"), 14), /maxWindowHours=14/);
});

test("run: the report shows a local-time window and the overrun", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30 };
  process.env.FAKE_SLEEP_MS = "1500";
  try {
    // 窗口 1 秒，任务跑 1.5 秒 ⇒ 必然超窗
    const { result, logs } = await runLoop(base, cfg, 1, "+1s");
    assert.ok(/窗口 \d{2}:\d{2}–\d{2}:\d{2}/.test(result.report), result.report);
    assert.ok(result.report.includes("超窗"), result.report);
    // 报告里的窗口必须是本地时间：与 run.json 的 startedAt 对得上
    const runsDir = path.join(base, "runs");
    const runDir = fs.readdirSync(runsDir).sort().pop();
    const runJson = JSON.parse(fs.readFileSync(path.join(runsDir, runDir, "run.json"), "utf8"));
    const started = new Date(runJson.startedAt);
    const hm = `${String(started.getHours()).padStart(2, "0")}:${String(started.getMinutes()).padStart(2, "0")}`;
    assert.ok(result.report.includes(hm), `${result.report} (期望本地时间 ${hm})`);
  } finally {
    delete process.env.FAKE_SLEEP_MS;
  }
});

test("run: the start log states the window length and the worst-case end", async () => {
  const base = tmp("ns-home-");
  const repo = makeRepo();
  const pi = withFakePiScript();
  writeReady(base, "ns-0001", repo.dir, "2026-10-19T01:00:00.000Z");
  const cfg = { ...DEFAULT_CONFIG, piBin: pi, timeoutSec: 30, verifyTimeoutSec: 30 };
  const { logs } = await runLoop(base, cfg, 1, "+2h");
  const start = logs.find((l) => l.includes("started"));
  assert.ok(start !== undefined, logs.join("\n"));
  assert.ok(/窗口 \d{2}:\d{2}–\d{2}:\d{2} \(/.test(start), start);
  assert.ok(start.includes("最坏结束"), start);
  const dispatch = logs.find((l) => l.includes("dispatch"));
  assert.ok(/窗口剩 .*本条最晚 \d{2}:\d{2} 结束/.test(dispatch ?? ""), dispatch);
});

test("cli: tail renders the recent agent events", () => {
  const base = tmp("ns-home-");
  const sess = path.join(base, "sessions", "ns-0001");
  fs.mkdirSync(sess, { recursive: true });
  const ev = (role, content, toolName) =>
    JSON.stringify({
      type: "message",
      id: "x",
      timestamp: "2026-10-19T01:00:00.000Z",
      message: { role, content, toolName },
    });
  fs.writeFileSync(
    path.join(sess, "a.jsonl"),
    [
      ev("assistant", [{ type: "thinking", thinking: "先想一下" }]),
      ev("assistant", [{ type: "toolCall", name: "bash", arguments: { command: "ls" } }]),
      ev("toolResult", [{ type: "text", text: "file.txt" }], "bash"),
    ].join("\n") + "\n",
  );
  const r = runCli(["tail", "ns-0001", "-n", "5"], { NIGHTSHIFT_HOME: base });
  assert.strictEqual(r.status, 0, r.err);
  assert.ok(r.out.includes("[思考] 先想一下"), r.out);
  assert.ok(r.out.includes("[调用 bash]"), r.out);
  assert.ok(r.out.includes("[结果 bash]"), r.out);
});

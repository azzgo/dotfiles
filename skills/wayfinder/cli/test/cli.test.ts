import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { charUnits, truncateTitle, unitBudget } from "../src/map.ts";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "main.ts");

function tmpStore(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ticket-test-"));
}

function write(dir: string, name: string, frontmatter: string, body = "\n## Question\n\n"): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, frontmatter + "\n" + body);
  return p;
}

function run(args: string[], env: Record<string, string> = {}): { status: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, EDITOR: "", VISUAL: "", ...env },
    });
    return { status: 0, out };
  } catch (e: any) {
    return { status: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

function map(): string {
  return `---
id: "001"
title: "Wayfinder: destination"
type: map
status: in-progress
created_at: 2026-10-18
---
`;
}

function ticket(id: string, extra = "", status = "pending", deps = ""): string {
  return `---
id: "${id}"
title: "ticket ${id}"
type: research
status: ${status}
parent: "001"
created_at: 2026-10-18${extra}${deps}
---
`;
}

test("rule 1: unknown frontmatter key is a check error", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002", "\ndepends_on: [\"003\"]"));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /unknown frontmatter key: depends_on/);
});

test("rule 1: read-time rejection in ticket set", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002", "\ndepends_on: [\"003\"]"));
  const before = fs.readFileSync(path.join(dir, "002-t.md"), "utf8");
  const r = run(["set", "002", "--status", "in-progress", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /depends_on/);
  assert.equal(fs.readFileSync(path.join(dir, "002-t.md"), "utf8"), before);
});

test("rule 2: invalid type is an error", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002").replace("type: research", "type: task"));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /invalid type: task/);
});

test("rule 3: invalid status is an error; waiting-human is valid", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002", "", "wating-human"));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /invalid status: wating-human/);

  const ok = tmpStore();
  write(ok, "001-map.md", map());
  write(ok, "002-t.md", ticket("002", "\nchannel: hitl", "waiting-human"));
  write(ok, "003-t.md", ticket("003", "\nchannel: hitl", "waiting-human"));
  write(ok, "004-t.md", ticket("004", "", "in-progress"));
  const r2 = run(["check", "--store", ok]);
  assert.equal(r2.status, 0, r2.out);
});

test("rule 4: duplicate id and filename prefix mismatch are errors", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002"));
  write(dir, "003-t.md", ticket("002"));
  write(dir, "004-not-this.md", ticket("005"));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /duplicate id 002/);
  assert.match(r.out, /filename id prefix \(004\) != frontmatter id \(005\)/);
});

test("rule 5: parent missing, self, and map-with-parent are errors", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002").replace('parent: "001"', 'parent: "099"'));
  write(dir, "013-t.md", ticket("013").replace('parent: "001"', 'parent: "013"'));
  write(dir, "014-t.md", ticket("014"));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /parent 099 not found/);
  assert.match(r.out, /parent is self/);
  const r2 = run(["check", "--store", (() => {
    const d = tmpStore();
    fs.writeFileSync(path.join(d, "010-map.md"), `---
id: "010"
title: "map 010"
type: map
status: completed
parent: "011"
created_at: 2026-10-18
---
`);
    return d;
  })()]);
  assert.equal(r2.status, 1);
  assert.match(r2.out, /type map must not carry a parent/);
});

test("rule 6: missing dependency and dependency cycle are errors", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002", "", "pending", '\ndependencies: ["099"]'));
  write(dir, "003-t.md", ticket("003", "", "pending", '\ndependencies: ["004"]'));
  write(dir, "004-t.md", ticket("004", "", "pending", '\ndependencies: ["003"]'));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /dependency 099 not found/);
  assert.match(r.out, /dependency cycle: 003 -> 004 -> 003/);
});

test("rule 7: multiple Active Maps are errors", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-map.md", map().replace('id: "001"', 'id: "002"'));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /multiple Active Maps/);
});

test("rule 8: multiple Current Tickets are errors", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002", "", "in-progress"));
  write(dir, "003-t.md", ticket("003", "", "in-progress"));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /multiple Current Tickets/);
});

test("check passes on a well-formed store and list marks the frontier", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002", "", "completed", '\ndependencies: ["003"]'));
  write(dir, "003-t.md", ticket("003", "", "waiting-human", "\nchannel: hitl"));
  write(dir, "004-t.md", ticket("004", "", "in-progress"));
  write(dir, "005-t.md", ticket("005"));
  const r = run(["check", "--store", dir]);
  assert.equal(r.status, 0, r.out);
  const l = run(["list", "--store", dir]);
  assert.equal(l.status, 0);
  assert.match(l.out, /◆ 005/);
  assert.doesNotMatch(l.out, /◆ 00[234]/);
  const f = run(["list", "--status", "pending", "--type", "research", "--store", dir]);
  assert.equal(f.status, 0);
  assert.match(f.out, /005/);
  assert.doesNotMatch(f.out, /004/);
});

test("set and depends mutate correctly and keep filename stable", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-some-slug.md", ticket("002"));
  write(dir, "003-t.md", ticket("003"));
  write(dir, "004-t.md", ticket("004"));
  let r = run(["set", "002", "--status", "in-progress", "--channel", "hitl", "--store", dir]);
  assert.equal(r.status, 0, r.out);
  let text = fs.readFileSync(path.join(dir, "002-some-slug.md"), "utf8");
  assert.match(text, /status: in-progress/);
  assert.match(text, /channel: hitl/);
  r = run(["depends", "002", "--on", "003", "--on", "004", "--store", dir]);
  assert.equal(r.status, 0, r.out);
  text = fs.readFileSync(path.join(dir, "002-some-slug.md"), "utf8");
  assert.match(text, /dependencies: \["003", "004"\]/);
  r = run(["depends", "002", "--clear", "--store", dir]);
  assert.equal(r.status, 0, r.out);
  text = fs.readFileSync(path.join(dir, "002-some-slug.md"), "utf8");
  assert.doesNotMatch(text, /dependencies/);
  r = run(["depends", "002", "--on", "099", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /dependency 099 not found/);
});

test("map writes a self-contained HTML file showing id, title, status, type", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002"));
  const out = path.join(tmpStore(), "map.html");
  const r = run(["map", "--out", out, "--store", dir]);
  assert.equal(r.status, 0, r.out);
  const html = fs.readFileSync(out, "utf8");
  assert.match(html, /"title":"Wayfinder: destination"/);
  assert.match(html, /"frontier":true/);
  assert.doesNotMatch(html, /src=|<link|fetch\(|XMLHttpRequest/);
  assert.match(r.out, /\.html/);
});

test("open uses EDITOR", () => {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-t.md", ticket("002"));
  const fake = path.join(tmpStore(), "fake-editor.sh");
  fs.writeFileSync(fake, "#!/bin/sh\necho EDITOR_SAW_$#_ARGS >> \"$FAKE_LOG\"\n");
  fs.chmodSync(fake, 0o755);
  const log = path.join(tmpStore(), "log");
  const r = run(["open", "002", "--store", dir], { EDITOR: fake, FAKE_LOG: log });
  assert.equal(r.status, 0, r.out);
  assert.match(fs.readFileSync(log, "utf8"), /EDITOR_SAW_1_ARGS/);
  assert.match(r.out, /opened .* with /);
});

function designFixture(): string {
  const dir = tmpStore();
  write(dir, "001-map.md", map());
  write(dir, "002-a.md", ticket("002"));
  write(dir, "003-b.md", ticket("003", "", "pending", '\ndependencies: ["002"]').replace("type: research", "type: grilling"));
  write(dir, "004-c.md", ticket("004", "\nchannel: hitl", "waiting-human"));
  write(dir, "005-d.md", ticket("005", "", "completed").replace("type: research", "type: setup"));
  write(dir, "006-e.md", ticket("006", "", "pending", '\ndependencies: ["005"]'));
  write(dir, "007-f.md", ticket("007", "", "in-progress").replace("type: research", "type: prototype"));
  return dir;
}

test("R1-R4: map render positions the Map, all edges finite, dependency depth visible", () => {
  const dir = designFixture();
  const out = path.join(tmpStore(), "map.html");
  const r = run(["map", "--out", out, "--store", dir]);
  assert.equal(r.status, 0, r.out);
  const html = fs.readFileSync(out, "utf8");
  const posMatch = html.match(/const POS = (\{.*\});/)!;
  const pos = JSON.parse(posMatch[1]);
  assert.equal(Object.keys(pos).length, 7, "all 7 nodes positioned");
  assert.ok(pos["001"].y < pos["002"].y, "map above members");
  assert.ok(pos["002"].y < pos["003"].y, "002 above 003 (dependency depth)");
  assert.ok(pos["005"].y < pos["006"].y, "005 above 006 (dependency depth)");
  const paths = [...html.matchAll(/d": "([^"]*)"/g)].map((m) => m[1]);
  void paths;
  const ds = [...html.matchAll(/setAttribute\("d", `([^`]*)`\)/g)].map((m) => m[1]);
  assert.equal(ds.length, 1, "one edge template");
  assert.doesNotMatch(ds[0], /NaN|undefined/);
  assert.match(html, /edge\(n\.parent, n\.id, false\)/);
  assert.match(html, /edge\(d, n\.id, true\)/);
  const texts = [...html.matchAll(/mk\((\d+), (\d+), "[^"]*"/g)].map((m) => `${m[1]},${m[2]}`);
  assert.equal(new Set(texts).size, texts.length, "no two header texts share x,y");
});

test("R7: depends --on own parent is rejected at write time", () => {
  const dir = designFixture();
  const file = path.join(dir, "006-e.md");
  const before = fs.readFileSync(file, "utf8");
  const r = run(["depends", "006", "--on", "001", "--store", dir]);
  assert.equal(r.status, 1);
  assert.match(r.out, /own parent/);
  assert.equal(fs.readFileSync(file, "utf8"), before);
  const r2 = run(["depends", "006", "--on", "006", "--store", dir]);
  assert.equal(r2.status, 1);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});

test("R8: add creates a well-formed ticket with fixed body template", () => {
  const dir = designFixture();
  const r = run(["add", "some new question", "--type", "research", "--parent", "001", "--store", dir]);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out.trim().split("\n").pop(), "008");
  const text = fs.readFileSync(path.join(dir, "008-some-new-question.md"), "utf8");
  for (const key of ["id", "title", "type", "status", "parent", "created_at"]) {
    assert.match(text, new RegExp(`^${key}:`, "m"));
  }
  for (const section of ["## Question", "## Why Now", "## Notes", "## Resolution", "## Follow-ups"]) {
    assert.ok(text.includes(section), section);
  }
  const chk = run(["check", "--store", dir]);
  assert.equal(chk.status, 0, chk.out);
  const r2 = run(["add", "second map", "--type", "map", "--store", dir]);
  assert.equal(r2.status, 0);
  assert.equal(r2.out.trim().split("\n").pop(), "009");
  const clean = tmpStore();
  write(clean, "001-map.md", map());
  const bad = run(["add", "orphan", "--type", "research", "--store", clean]);
  assert.equal(bad.status, 1);
  assert.match(bad.out, /requires --parent/);
  const badDep = run(["add", "t", "--type", "research", "--parent", "001", "--depends-on", "099", "--store", clean]);
  assert.equal(badDep.status, 1);
  assert.match(badDep.out, /099 not found/);
});

test("F1: stylesheet carries no text-anchor; every text element carries its own anchor", () => {
  const dir = designFixture();
  const out = path.join(tmpStore(), "map.html");
  const r = run(["map", "--out", out, "--store", dir]);
  assert.equal(r.status, 0, r.out);
  const html = fs.readFileSync(out, "utf8");
  const style = html.match(/<style>([\s\S]*?)<\/style>/)![1];
  assert.doesNotMatch(style, /text-anchor/, "stylesheet must not set text-anchor");
  assert.match(html, /mk\(12, 24, "id", n\.id\);/, "id text has no anchor argument (defaults to start)");
  assert.match(html, /mk\(W - 12, 24, "meta st-" \+ n\.status, n\.type \+ " · " \+ n\.status, "end"\);/,
    "type · status right-anchored at node's right edge (R5 not regressed)");
  assert.match(html, /mk\(12, 64, "meta", "◆ frontier", "start"\);/,
    "frontier badge left-anchored inside the node");
});

test("T1/T3: title truncation is width-aware", () => {
  const budget = unitBudget();
  assert.ok(budget > 0);
  const ascii = "a".repeat(40);
  const asciiCut = truncateTitle(ascii, budget);
  assert.ok(asciiCut.endsWith("…"));
  assert.ok(asciiCut.length < 40);
  const width = (t: string) => [...t].reduce((n, ch) => n + charUnits(ch), 0);
  assert.ok(width(asciiCut.replace("…", "")) <= budget - 1, "ASCII cut fits budget with room for the tail");

  const cjk = "内".repeat(40);
  const cjkCut = truncateTitle(cjk, budget);
  assert.ok(cjkCut.endsWith("…"));
  assert.ok(cjkCut.length < asciiCut.length, "CJK truncated harder than ASCII at equal length");
  assert.ok(width(cjkCut.replace("…", "")) <= budget - 1, "CJK cut fits budget with room for the tail");

  const fits = "short title";
  assert.equal(truncateTitle(fits, budget), fits, "fitting title unchanged");
  assert.doesNotMatch(truncateTitle(fits, budget), /…/);

  const realCut = truncateTitle("Wayfinder: 内化 taskmd 之后的路线", budget);
  assert.ok(width(realCut) <= budget, "real Chinese Map title incl. tail inside the budget");
  const real = truncateTitle("Wayfinder: 内化 taskmd 之后的路线", budget);
  assert.ok(real.startsWith("Wayfinder: "));
  assert.ok(real.endsWith("…"));
  assert.ok(width(real.replace("…", "")) <= budget);
});

test("T2: full title emitted as SVG <title> tooltip", () => {
  const dir = designFixture();
  const out = path.join(tmpStore(), "map.html");
  const r = run(["map", "--out", out, "--store", dir]);
  assert.equal(r.status, 0, r.out);
  const html = fs.readFileSync(out, "utf8");
  assert.match(html, /createElementNS\(NS, "title"\)/);
  assert.match(html, /full\.textContent = n\.title;/, "textContent assignment needs no XML escaping");
});

test("inline script executes: vm + DOM stub renders nodes, collapse works, no ReferenceError", async () => {
  const vm = await import("node:vm");
  const dir = designFixture();
  const out = path.join(tmpStore(), "map.html");
  const r = run(["map", "--out", out, "--store", dir]);
  assert.equal(r.status, 0, r.out);
  const html = fs.readFileSync(out, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1);
  const code = scripts[0];

  const makeEl = (tag: string) => {
    const el: any = {
      tag, attrs: {}, children: [], listeners: {}, classes: [] as string[], textContent: "",
      setAttribute(k: string, v: unknown) { this.attrs[k] = String(v); },
      appendChild(c: any) { this.children.push(c); return c; },
      addEventListener(ev: string, fn: () => void) { (this.listeners[ev] ??= []).push(fn); },
      classList: null as unknown,
    };
    el.classList = { add: (...cs: string[]) => el.classes.push(...cs) };
    return el;
  };
  const svg = makeEl("svg");
  Object.defineProperty(svg, "innerHTML", {
    set() { svg.children.length = 0; },
    get() { return ""; },
  });
  const bars: Record<string, any> = {};
  const documentStub = {
    createElementNS: (_ns: string, tag: string) => makeEl(tag),
    createElement: (tag: string) => makeEl(tag),
    createTextNode: (text: string) => ({ tag: "#text", textContent: text }),
    querySelectorAll: () => [],
    getElementById(id: string) {
      if (id === "canvas") return svg;
      return (bars[id] ??= makeEl("span"));
    },
  };
  const filterBar = () => ({ ...makeEl("span"), querySelectorAll: () => [] });
  bars["stFilters"] = filterBar();
  bars["tyFilters"] = filterBar();
  svg.querySelectorAll = () => [];

  const sandbox = { document: documentStub };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const nodeGroups = svg.children.filter((c: any) => String(c.attrs.class ?? "").includes("node"));
  const edges = svg.children.filter((c: any) => String(c.attrs.class ?? "").includes("edge"));
  assert.equal(nodeGroups.length, 7, "all 7 nodes rendered by the inline script");
  assert.equal(edges.length, 8, "6 membership + 2 dependency edges rendered");
  for (const e of edges) assert.doesNotMatch(e.attrs.d ?? "", /NaN|undefined/);
  assert.ok(nodeGroups.some((g: any) => g.children.some((c: any) => c.tag === "title" && c.textContent !== "")),
    "full-title tooltip present");
  const titleTexts = nodeGroups.map((g: any) => g.children.find((c: any) => c.tag === "title")?.textContent ?? "");
  assert.ok(titleTexts.includes("Wayfinder: destination"), "untruncated title in tooltip");
  assert.ok(titleTexts.every((t: string) => t.length > 0));

  const mapNode = nodeGroups.find((g: any) => String(g.attrs.class).includes(" map"))!;
  mapNode.listeners.click[0]();
  assert.equal(svg.children.filter((c: any) => String(c.attrs.class ?? "").includes("node")).length, 1,
    "collapse hides the Map's Tickets");
  assert.equal(svg.children.filter((c: any) => String(c.attrs.class ?? "").includes("edge")).length, 0,
    "collapse hides all edges");
  mapNode.listeners.click[0]();
  assert.equal(svg.children.filter((c: any) => String(c.attrs.class ?? "").includes("node")).length, 7,
    "second click restores the subtree");
  assert.equal(svg.children.filter((c: any) => String(c.attrs.class ?? "").includes("edge")).length, 8);
});

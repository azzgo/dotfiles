#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseFrontmatter, serializeTicket, TYPES, STATUSES, type Ticket } from "./src/frontmatter.ts";
import { isFrontier, loadStore, resolveStoreDir, slugify } from "./src/store.ts";
import { StoreError } from "./src/frontmatter.ts";
import { defaultMapOut, writeMap } from "./src/map.ts";

const USAGE = `ticket — Wayfinder Ticket store CLI

usage:
  ticket check [--store DIR]
  ticket list [--status S] [--type T] [--store DIR]
  ticket set <id> --status S [--channel afk|hitl] [--store DIR]
  ticket depends <id> --on <id>... | --clear [--store DIR]
  ticket open <id> [--store DIR]
  ticket map [--out PATH] [--store DIR]
`;

function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function parseArgs(argv: string[]) {
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
        flags.set(key, flags.get(key) ?? []);
        i += 1;
      }
    } else {
      positional.push(a);
      i += 1;
    }
  }
  return { positional, flags };
}

function loadStrict(dir: string) {
  const store = loadStore(dir);
  if (store.errors.length > 0) {
    die(store.errors.map((e) => `error: ${e}`).join("\n"));
  }
  return store;
}

function byIdOrDie(store: { tickets: Ticket[] }, id: string): Ticket {
  const t = store.tickets.find((x) => x.id === id);
  if (!t) die(`error: ticket ${id} not found`);
  return t;
}

function cmdCheck(storeDir: string): void {
  const store = loadStore(storeDir);
  if (store.errors.length > 0) {
    for (const e of store.errors) process.stderr.write(`error: ${e}\n`);
    process.stderr.write(`${store.errors.length} error(s) in ${store.dir}\n`);
    process.exit(1);
  }
  console.log(`ok: ${store.tickets.length} ticket(s) in ${store.dir}`);
}

function cmdList(storeDir: string, flags: Map<string, string[]>): void {
  const store = loadStrict(storeDir);
  const byId = new Map(store.tickets.map((t) => [t.id, t]));
  const status = flags.get("status");
  const type = flags.get("type");
  for (const t of store.tickets) {
    if (status && !status.includes(t.status)) continue;
    if (type && !type.includes(t.type)) continue;
    const mark = isFrontier(t, byId) ? "◆" : " ";
    console.log(`${mark} ${t.id}  [${t.status}] ${t.type}${t.channel === "hitl" ? " ·hitl" : ""}  ${t.title}`);
  }
}

function cmdSet(storeDir: string, positional: string[], flags: Map<string, string[]>): void {
  const id = positional[0];
  if (!id) die("usage: ticket set <id> --status S [--channel afk|hitl]");
  const status = flags.get("status")?.[0];
  if (!status || !STATUSES.includes(status as never)) {
    die(`usage: --status must be one of ${STATUSES.join(" | ")}`);
  }
  const channel = flags.get("channel")?.[0];
  if (channel && channel !== "afk" && channel !== "hitl") die("usage: --channel afk|hitl");
  const store = loadStrict(storeDir);
  const t = byIdOrDie(store, id);
  const file = path.join(store.dir, t.file);
  const text = fs.readFileSync(file, "utf8");
  parseFrontmatter(text, t.file);
  const next: Ticket = { ...t, status: status as Ticket["status"] };
  if (channel === "afk" || channel === "hitl") next.channel = channel;
  fs.writeFileSync(file, serializeTicket(next));
  console.log(`set ${id} status=${next.status}${next.channel === "hitl" ? " channel=hitl" : ""} (${t.file})`);
}

function cmdDepends(storeDir: string, positional: string[], flags: Map<string, string[]>): void {
  const id = positional[0];
  if (!id) die("usage: ticket depends <id> --on <id>... | --clear");
  const clear = flags.has("clear");
  const on = flags.get("on") ?? [];
  if (!clear && on.length === 0) die("usage: ticket depends <id> --on <id>... | --clear");
  const store = loadStrict(storeDir);
  const t = byIdOrDie(store, id);
  if (t.type === "map") die("error: a Map carries no dependencies");
  for (const d of clear ? [] : on) {
    if (d === t.id) die(`error: ticket ${id} cannot depend on itself`);
    if (d === t.parent) die(`error: dependency ${d} is ${id}'s own parent; membership is not ordering`);
    if (!store.tickets.some((x) => x.id === d)) die(`error: dependency ${d} not found in store`);
  }
  const next: Ticket = { ...t, dependencies: clear ? [] : [...new Set([...t.dependencies, ...on])] };
  fs.writeFileSync(path.join(store.dir, t.file), serializeTicket(next));
  console.log(`depends ${id}: ${next.dependencies.length ? next.dependencies.join(", ") : "(none)"}`);
}

const MAP_BODY = "## Destination\n\n\n## Notes\n\n\n## Decisions So Far\n\n\n## Not Yet Specified\n\n\n## Out of Scope\n";
const TICKET_BODY = "## Question\n\n\n## Why Now\n\n\n## Notes\n\n\n## Resolution\n\n\n## Follow-ups\n";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function padId(n: number): string {
  return String(n).padStart(3, "0");
}

function cmdAdd(storeDir: string, positional: string[], flags: Map<string, string[]>): void {
  const title = positional[0];
  if (!title || title.startsWith("--")) die("usage: ticket add <title> --type map|research|prototype|grilling|setup [--status S] [--parent <id>] [--depends-on <id>…] [--channel afk|hitl] [--body <string> | --body-file <path>]");
  const type = flags.get("type")?.[0];
  if (!type || !TYPES.includes(type as never)) die(`usage: --type must be one of ${TYPES.join(" | ")}`);
  const store = loadStrict(storeDir);
  const parent = flags.get("parent")?.[0];
  if (type === "map") {
    if (parent) die("error: type map must not carry a parent");
  } else if (!parent) {
    die("error: non-map ticket requires --parent <map-id>");
  }
  if (parent && !store.tickets.some((x) => x.id === parent && x.type === "map")) {
    die(`error: parent ${parent} is not an existing Map`);
  }
  const dependsOn = flags.get("depends-on") ?? [];
  for (const d of dependsOn) {
    if (d === parent) die(`error: dependency ${d} is the ticket's own parent; membership is not ordering`);
    if (!store.tickets.some((x) => x.id === d)) die(`error: dependency ${d} not found in store`);
  }
  let status = flags.get("status")?.[0];
  if (!status) status = type === "map" ? "in-progress" : "pending";
  if (!STATUSES.includes(status as never)) die(`usage: --status must be one of ${STATUSES.join(" | ")}`);
  const channel = flags.get("channel")?.[0];
  if (channel && channel !== "afk" && channel !== "hitl") die("usage: --channel afk|hitl");
  let body = "";
  if (flags.has("body")) body = flags.get("body")![0];
  else if (flags.has("body-file")) body = fs.readFileSync(flags.get("body-file")![0], "utf8");
  else body = type === "map" ? MAP_BODY : TICKET_BODY;
  if (body !== "" && !body.startsWith("\n")) body = "\n" + body;

  const maxExisting = store.tickets.reduce((mx, t) => Math.max(mx, parseInt(t.id, 10)), 0);
  const id = padId(maxExisting + 1);
  const ticket: Ticket = {
    id,
    title,
    type: type as Ticket["type"],
    status: status as Ticket["status"],
    parent: type === "map" ? undefined : parent,
    dependencies: dependsOn,
    channel: channel === "hitl" ? "hitl" : "afk",
    created_at: today(),
    file: `${id}-${slugify(title)}.md`,
    body,
  };
  fs.writeFileSync(path.join(store.dir, ticket.file), serializeTicket(ticket));
  console.log(id);
}

function cmdOpen(storeDir: string, positional: string[]): void {
  const id = positional[0];
  if (!id) die("usage: ticket open <id>");
  const store = loadStrict(storeDir);
  const t = byIdOrDie(store, id);
  const file = path.join(store.dir, t.file);
  const editor = process.env.EDITOR ?? process.env.VISUAL;
  if (editor) {
    const r = spawnSync(editor, [file], { stdio: "inherit" });
    if (r.status !== 0) die(`error: editor exited with ${r.status}`);
    console.log(`opened ${file} with ${editor}`);
    return;
  }
  const r = spawnSync("open", ["-t", file]);
  if (r.status !== 0) die(`error: could not open ${file}`);
  console.log(`opened ${file} with open -t`);
}

function cmdMap(storeDir: string, flags: Map<string, string[]>): void {
  const store = loadStrict(storeDir);
  const out = flags.get("out")?.[0] ?? defaultMapOut();
  writeMap(store, path.resolve(out));
  console.log(path.resolve(out));
}

function main(): void {
  const argv = process.argv.slice(2);
  const { positional, flags } = parseArgs(argv);
  const cmd = positional.shift();
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(USAGE);
    return;
  }
  const storeDir = resolveStoreDir(flags.get("store")?.[0]);
  switch (cmd) {
    case "check":
      return cmdCheck(storeDir);
    case "list":
      return cmdList(storeDir, flags);
    case "set":
      return cmdSet(storeDir, positional, flags);
    case "depends":
      return cmdDepends(storeDir, positional, flags);
    case "add":
      return cmdAdd(storeDir, positional, flags);
    case "open":
      return cmdOpen(storeDir, positional);
    case "map":
      return cmdMap(storeDir, flags);
    default:
      die(`unknown command: ${cmd}\n` + USAGE);
  }
}

try {
  main();
} catch (e) {
  if (e instanceof StoreError) die(`error: ${e.message}`);
  throw e;
}

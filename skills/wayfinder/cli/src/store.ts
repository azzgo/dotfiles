import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { StoreError, type Ticket } from "./frontmatter.ts";
import { parseTicket } from "./frontmatter.ts";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

export function workspaceId(repoRoot: string): string {
  const repo = repoRoot.replace(/\/+$/, "");
  return repo.replace(/\//g, "-") + "-";
}

export function repoRoot(): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout.trim() !== "") return r.stdout.trim();
  return process.cwd();
}

export function defaultStoreDir(): string {
  return path.join(process.env.HOME ?? "", ".cache", "wayfinder", workspaceId(repoRoot()), "tickets");
}

export function resolveStoreDir(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  return defaultStoreDir();
}

export function fileNameFor(t: Ticket): string {
  return `${t.id}-${slugify(t.title)}.md`;
}

export interface Store {
  dir: string;
  tickets: Ticket[];
  errors: string[];
}

export function loadStore(dir: string): Store {
  const errors: string[] = [];
  const tickets: Ticket[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    throw new StoreError(`store directory not found: ${dir}`);
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const file = path.join(dir, entry.name);
    const text = fs.readFileSync(file, "utf8");
    try {
      const t = parseTicket(text, entry.name);
      const prefix = entry.name.match(/^(\d+)-/)?.[1];
      if (prefix !== t.id) {
        errors.push(`${entry.name}: filename id prefix (${prefix}) != frontmatter id (${t.id})`);
      }
      tickets.push(t);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  const seen = new Map<string, string>();
  for (const t of tickets) {
    const prev = seen.get(t.id);
    if (prev) errors.push(`duplicate id ${t.id}: ${prev} and ${t.file}`);
    else seen.set(t.id, t.file);
  }
  errors.push(...graphErrors(tickets));
  errors.push(...cardinalityErrors(tickets));
  return { dir, tickets, errors };
}

function hasCycle(nodes: string[], edges: (n: string) => string[]): string | null {
  const state = new Map<string, number>();
  const stack: string[] = [];
  const visit = (n: string): string | null => {
    const s = state.get(n);
    if (s === 1) return [...stack.slice(stack.indexOf(n)), n].join(" -> ");
    if (s === 2) return null;
    state.set(n, 1);
    stack.push(n);
    for (const m of edges(n)) {
      const cyc = visit(m);
      if (cyc) return cyc;
    }
    stack.pop();
    state.set(n, 2);
    return null;
  };
  for (const n of nodes) {
    const cyc = visit(n);
    if (cyc) return cyc;
  }
  return null;
}

function graphErrors(tickets: Ticket[]): string[] {
  const errors: string[] = [];
  const ids = new Set(tickets.map((t) => t.id));
  for (const t of tickets) {
    if (t.type !== "map" && t.parent && !ids.has(t.parent)) {
      errors.push(`${t.file}: parent ${t.parent} not found in store`);
    }
    if (t.parent === t.id) errors.push(`${t.file}: parent is self`);
    for (const d of t.dependencies) {
      if (!ids.has(d)) errors.push(`${t.file}: dependency ${d} not found in store`);
    }
    if (t.dependencies.includes(t.id)) errors.push(`${t.file}: depends on itself`);
  }
  const nodes = tickets.map((t) => t.id);
  const pcyc = hasCycle(nodes, (n) => {
    const t = tickets.find((x) => x.id === n);
    return t?.parent && t.parent !== n ? [t.parent] : [];
  });
  if (pcyc) errors.push(`parent cycle: ${pcyc}`);
  const dcyc = hasCycle(nodes, (n) => {
    const t = tickets.find((x) => x.id === n);
    return t ? t.dependencies.filter((d) => ids.has(d) && d !== n) : [];
  });
  if (dcyc) errors.push(`dependency cycle: ${dcyc}`);
  return errors;
}

function cardinalityErrors(tickets: Ticket[]): string[] {
  const errors: string[] = [];
  const activeMaps = tickets.filter((t) => t.type === "map" && t.status === "in-progress");
  if (activeMaps.length > 1) {
    errors.push(`multiple Active Maps (type=map, status=in-progress): ${activeMaps.map((t) => t.id).join(", ")}`);
  }
  const current = tickets.filter((t) => t.type !== "map" && t.status === "in-progress");
  if (current.length > 1) {
    errors.push(`multiple Current Tickets (type!=map, status=in-progress): ${current.map((t) => t.id).join(", ")}`);
  }
  return errors;
}

export function isFrontier(t: Ticket, byId: Map<string, Ticket>): boolean {
  if (t.type === "map") return false;
  if (t.status !== "pending") return false;
  const depsOk = t.dependencies.every((d) => {
    const dep = byId.get(d);
    return dep && (dep.status === "completed" || dep.status === "cancelled");
  });
  if (!depsOk) return false;
  if (t.parent) {
    const map = byId.get(t.parent);
    if (!map || map.status !== "in-progress") return false;
  }
  return true;
}

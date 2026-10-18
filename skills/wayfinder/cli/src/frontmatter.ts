export const TYPES = ["map", "research", "prototype", "grilling", "setup"] as const;
export const STATUSES = ["pending", "in-progress", "waiting-human", "completed", "cancelled", "blocked"] as const;
export const CHANNELS = ["afk", "hitl"] as const;
const KNOWN_KEYS = ["id", "title", "type", "status", "parent", "dependencies", "channel", "created_at", "completed_at"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^\d{3,}$/;

export type TicketType = (typeof TYPES)[number];
export type TicketStatus = (typeof STATUSES)[number];

export interface Ticket {
  id: string;
  title: string;
  type: TicketType;
  status: TicketStatus;
  parent?: string;
  dependencies: string[];
  channel: "afk" | "hitl";
  created_at: string;
  completed_at?: string;
  file: string;
  body: string;
}

export class StoreError extends Error {}

function unquote(raw: string): string {
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseList(raw: string): string[] {
  const t = raw.trim();
  if (t === "") return [];
  if (t === "[]") return [];
  const m = t.match(/^\[(.*)\]$/s);
  if (!m) throw new StoreError(`list must be quoted inline form like ["016"], got: ${raw}`);
  const inner = m[1].trim();
  if (inner === "") return [];
  return inner.split(",").map((s) => unquote(s.trim()));
}

export interface ParsedFrontmatter {
  fields: Map<string, string | string[]>;
  body: string;
}

export function parseFrontmatter(text: string, file: string): ParsedFrontmatter {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new StoreError(`${file}: no frontmatter block found`);
  const fields = new Map<string, string | string[]>();
  for (const line of m[1].split(/\r?\n/)) {
    if (line.trim() === "") throw new StoreError(`${file}: empty line inside frontmatter`);
    const km = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s?(.*)$/);
    if (!km) throw new StoreError(`${file}: unparseable frontmatter line: ${line}`);
    const [, key, restRaw] = km;
    if (fields.has(key)) throw new StoreError(`${file}: duplicate frontmatter key: ${key}`);
    if (!KNOWN_KEYS.includes(key)) throw new StoreError(`${file}: unknown frontmatter key: ${key}`);
    const rest = restRaw.trim();
    if (key === "dependencies") {
      fields.set(key, parseList(rest));
    } else {
      fields.set(key, rest);
    }
  }
  return { fields, body: m[2] };
}

export function parseTicket(text: string, file: string): Ticket {
  const { fields, body } = parseFrontmatter(text, file);
  const str = (k: string): string => {
    const v = fields.get(k);
    if (typeof v !== "string" || v === "") throw new StoreError(`${file}: missing required field: ${k}`);
    return unquote(v);
  };
  const id = str("id");
  if (!ID_RE.test(id)) throw new StoreError(`${file}: id must be a quoted string of >=3 digits, got: ${id}`);
  const title = str("title");
  const type = str("type");
  if (!TYPES.includes(type as TicketType)) throw new StoreError(`${file}: invalid type: ${type}`);
  const status = str("status");
  if (!STATUSES.includes(status as TicketStatus)) throw new StoreError(`${file}: invalid status: ${status}`);
  let parent: string | undefined;
  if (fields.has("parent")) {
    const p = unquote(fields.get("parent") as string);
    if (p === "") throw new StoreError(`${file}: parent must not be empty`);
    if (type === "map") throw new StoreError(`${file}: type map must not carry a parent`);
    parent = p;
  } else if (type !== "map") {
    throw new StoreError(`${file}: non-map ticket requires a parent`);
  }
  const deps = fields.get("dependencies") as string[] | undefined;
  if (deps && deps.some((d) => d === parent && type !== "map")) {
    throw new StoreError(`${file}: ticket ${id} depends on its own parent ${parent}`);
  }
  let channel: Ticket["channel"] = "afk";
  if (fields.has("channel")) {
    const c = unquote(fields.get("channel") as string);
    if (c !== "" && !CHANNELS.includes(c as (typeof CHANNELS)[number])) {
      throw new StoreError(`${file}: invalid channel: ${c}`);
    }
    if (c === "hitl") channel = "hitl";
  }
  const created_at = str("created_at");
  if (!DATE_RE.test(created_at)) throw new StoreError(`${file}: created_at must be YYYY-MM-DD, got: ${created_at}`);
  let completed_at: string | undefined;
  if (fields.has("completed_at")) {
    const c = unquote(fields.get("completed_at") as string);
    if (c !== "") {
      if (!DATE_RE.test(c)) throw new StoreError(`${file}: completed_at must be YYYY-MM-DD or empty, got: ${c}`);
      completed_at = c;
    }
  }
  return { id, title, type: type as TicketType, status: status as TicketStatus, parent, dependencies: deps ?? [], channel, created_at, completed_at, file, body };
}

export function serializeTicket(t: Ticket): string {
  const q = (s: string) => JSON.stringify(s);
  const lines: string[] = ["---"];
  lines.push(`id: ${q(t.id)}`);
  lines.push(`title: ${q(t.title)}`);
  lines.push(`type: ${t.type}`);
  lines.push(`status: ${t.status}`);
  if (t.type !== "map") lines.push(`parent: ${q(t.parent!)}`);
  if (t.dependencies.length > 0) lines.push(`dependencies: [${t.dependencies.map(q).join(", ")}]`);
  if (t.channel === "hitl") lines.push(`channel: hitl`);
  lines.push(`created_at: ${t.created_at}`);
  if (t.completed_at) lines.push(`completed_at: ${t.completed_at}`);
  lines.push("---", "");
  return lines.join("\n") + t.body;
}

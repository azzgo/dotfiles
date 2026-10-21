export const STATUSES = [
  "draft",
  "ready",
  "blocked",
  "running",
  "passed",
  "needs-review",
  "verify-error",
  "skipped",
] as const;
export type SpecStatus = (typeof STATUSES)[number];

export const SECTIONS = ["Goal", "Change", "Constraints", "Verify", "Out of scope"] as const;

const KNOWN_KEYS = [
  "id",
  "status",
  "dir",
  "title",
  "created",
  "model",
  "thinking",
  "tools",
  "extensions",
  "baseline",
  "attempts",
  "verdict",
  "reason",
  "commits",
  "residual",
  "hint",
  "finished",
  "run",
] as const;

const LIST_KEYS = new Set(["tools", "extensions"]);
const NULLABLE_KEYS = new Set(["verdict", "reason", "baseline", "hint", "finished", "run", "model", "thinking"]);

const ID_RE = /^ns-\d{4,}$/;

export class SpecError extends Error {}

export interface Spec {
  id: string;
  status: SpecStatus;
  dir: string;
  title: string;
  created: string;
  model: string | null;
  thinking: string | null;
  tools: string[];
  extensions: string[];
  baseline: string | null;
  attempts: number;
  verdict: string | null;
  reason: string | null;
  commits: number | null;
  residual: number | null;
  hint: string | null;
  finished: string | null;
  run: string | null;
  body: string;
  file: string;
}

export type MetaKey = (typeof KNOWN_KEYS)[number];

function unquote(raw: string): string {
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseList(raw: string, file: string, key: string): string[] {
  const t = raw.trim();
  if (t === "" || t === "[]") return [];
  const m = t.match(/^\[(.*)\]$/s);
  if (!m) throw new SpecError(`${file}: ${key} must be an inline list like ["a", "b"]`);
  const inner = m[1].trim();
  if (inner === "") return [];
  return inner.split(",").map((s) => unquote(s.trim()));
}

function parseFrontmatter(text: string, file: string): { fields: Map<string, string | string[]>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new SpecError(`${file}: no frontmatter block found`);
  const fields = new Map<string, string | string[]>();
  for (const line of m[1].split(/\r?\n/)) {
    if (line.trim() === "") throw new SpecError(`${file}: empty line inside frontmatter`);
    const km = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s?(.*)$/);
    if (!km) throw new SpecError(`${file}: unparseable frontmatter line: ${line}`);
    const [, key, restRaw] = km;
    if (fields.has(key)) throw new SpecError(`${file}: duplicate frontmatter key: ${key}`);
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
      throw new SpecError(`${file}: unknown frontmatter key: ${key}`);
    }
    const rest = restRaw.trim();
    fields.set(key, LIST_KEYS.has(key) ? parseList(rest, file, key) : rest);
  }
  return { fields, body: m[2] };
}

export function missingSections(body: string): string[] {
  const found = new Set(
    [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1].trim().toLowerCase()),
  );
  return SECTIONS.filter((s) => !found.has(s.toLowerCase()));
}

export function parseSpec(text: string, file: string): Spec {
  const { fields, body } = parseFrontmatter(text, file);
  const str = (k: string): string => {
    const v = fields.get(k);
    if (typeof v !== "string" || v === "") throw new SpecError(`${file}: missing required field: ${k}`);
    return unquote(v);
  };
  const opt = (k: string): string | null => {
    const v = fields.get(k);
    if (typeof v !== "string") return null;
    const u = unquote(v);
    return u === "" || u === "null" ? null : u;
  };
  const list = (k: string): string[] => {
    const v = fields.get(k);
    return Array.isArray(v) ? v : [];
  };
  const num = (k: string): number | null => {
    const v = opt(k);
    if (v === null) return null;
    if (!/^\d+$/.test(v)) throw new SpecError(`${file}: ${k} must be a non-negative integer, got: ${v}`);
    return Number(v);
  };

  const id = str("id");
  if (!ID_RE.test(id)) throw new SpecError(`${file}: id must look like ns-0001, got: ${id}`);
  const status = str("status");
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new SpecError(`${file}: unknown status: ${status}`);
  }
  const dir = str("dir");
  if (!dir.startsWith("/")) throw new SpecError(`${file}: dir must be an absolute path, got: ${dir}`);

  for (const key of fields.keys()) {
    if (NULLABLE_KEYS.has(key) || LIST_KEYS.has(key)) continue;
    if (["id", "status", "dir", "title", "created", "attempts", "commits", "residual"].includes(key)) continue;
    throw new SpecError(`${file}: unexpected key: ${key}`);
  }

  return {
    id,
    status: status as SpecStatus,
    dir,
    title: str("title"),
    created: str("created"),
    model: opt("model"),
    thinking: opt("thinking"),
    tools: list("tools"),
    extensions: list("extensions"),
    baseline: opt("baseline"),
    attempts: num("attempts") ?? 0,
    verdict: opt("verdict"),
    reason: opt("reason"),
    commits: num("commits"),
    residual: num("residual"),
    hint: opt("hint"),
    finished: opt("finished"),
    run: opt("run"),
    body,
    file,
  };
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function listLit(items: string[]): string {
  return `[${items.map(quote).join(", ")}]`;
}

function val(s: string | null, q = false): string {
  if (s === null) return "null";
  return q ? quote(s) : s;
}

export function serializeSpec(s: Spec): string {
  const lines = [
    "---",
    `id: ${s.id}`,
    `status: ${s.status}`,
    `dir: ${s.dir}`,
    `title: ${quote(s.title)}`,
    `created: ${s.created}`,
    `model: ${val(s.model, true)}`,
    `thinking: ${val(s.thinking, true)}`,
    `tools: ${listLit(s.tools)}`,
    `extensions: ${listLit(s.extensions)}`,
    `baseline: ${val(s.baseline, true)}`,
    `attempts: ${s.attempts}`,
    `verdict: ${val(s.verdict, true)}`,
    `reason: ${val(s.reason, true)}`,
    `commits: ${s.commits ?? "null"}`,
    `residual: ${s.residual ?? "null"}`,
    `hint: ${val(s.hint, true)}`,
    `finished: ${val(s.finished, true)}`,
    `run: ${val(s.run, true)}`,
    "---",
  ];
  return lines.join("\n") + "\n" + s.body;
}

export function bodyTemplate(): string {
  return [
    "",
    "## Goal",
    "",
    "",
    "## Change",
    "",
    "",
    "## Constraints",
    "",
    "",
    "## Verify",
    "",
    "",
    "## Out of scope",
    "",
    "",
  ].join("\n");
}

export function checkSpec(s: Spec, file: string): string[] {
  const errors: string[] = [];
  const missing = missingSections(s.body);
  if (missing.length > 0) errors.push(`${file}: missing body section(s): ${missing.join(", ")}`);
  if (s.body.trim() === "") errors.push(`${file}: empty body`);
  if (s.status === "ready" || s.status === "draft") {
    for (const name of ["Goal", "Change", "Verify"]) {
      const m = s.body.match(new RegExp(`^##[ \\t]+${name}[ \\t]*$\\n([\\s\\S]*?)(?=^##[ \\t]|\\Z)`, "m"));
      if (m && m[1].trim() === "") errors.push(`${file}: section "${name}" is empty (required when ${s.status})`);
    }
  }
  return errors;
}

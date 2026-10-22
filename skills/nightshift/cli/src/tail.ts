import fs from "node:fs";
import { homeBase, sessionsDir } from "./board.ts";

export interface TailEvent {
  ts: string;
  role: string;
  text: string;
  bytes: number;
}

interface RawMessage {
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    toolName?: string;
  };
}

function textOf(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v ?? "");
}

/** 把一条 session 事件压成一行人能读的摘要。 */
export function summarizeEvent(line: string): TailEvent | null {
  let o: RawMessage;
  try {
    o = JSON.parse(line) as RawMessage;
  } catch {
    return null;
  }
  const m = o.message;
  if (m === undefined) return null;
  const role = m.role ?? "?";
  const parts: string[] = [];
  if (role === "assistant") {
    const content = Array.isArray(m.content) ? m.content : [];
    for (const c of content as Array<Record<string, unknown>>) {
      if (c.type === "thinking") parts.push(`[思考] ${textOf(c.thinking).slice(0, 400)}`);
      else if (c.type === "text") parts.push(`[发言] ${textOf(c.text).slice(0, 400)}`);
      else if (c.type === "toolCall") {
        const args = textOf(c.arguments);
        parts.push(`[调用 ${String(c.name)}] ${args.slice(0, 300)}`);
      }
    }
  } else if (role === "toolResult") {
    parts.push(`[结果 ${m.toolName ?? "?"}] ${textOf(m.content).slice(0, 300)}`);
  } else if (role === "user") {
    parts.push(`[输入] ${textOf(m.content).slice(0, 300)}`);
  }
  if (parts.length === 0) return null;
  return { ts: o.timestamp ?? "", role, text: parts.join("\n      "), bytes: line.length };
}

/** 找到某条 Spec 最近一次尝试的 session jsonl。 */
export function latestSessionFile(id: string, base = homeBase()): string | null {
  const dir = `${sessionsDir(base)}/${id}`;
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl"));
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  names.sort();
  const last = names[names.length - 1];
  return `${dir}/${last}`;
}

/** 读出最后 n 条可读事件。 */
export function readTail(file: string, n: number): TailEvent[] {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const out: TailEvent[] = [];
  for (const l of lines) {
    const e = summarizeEvent(l);
    if (e !== null) out.push(e);
  }
  return out.slice(-n);
}

export function renderEvent(e: TailEvent): string {
  return `${e.ts.slice(11, 19)}  ${e.text}`;
}

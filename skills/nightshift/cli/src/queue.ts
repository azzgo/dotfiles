import { homeBase, loadBoard, writeSpec } from "./board.ts";
import type { Spec, SpecStatus } from "./spec.ts";

const BLOCK_REASON_RE = /^blocked by (ns-\d{4,}) \(([a-z-]+)\)$/;

export function blockReason(blocker: Spec): string {
  return `blocked by ${blocker.id} (${blocker.status})`;
}

export function blockedBy(spec: Spec): { id: string; status: SpecStatus } | null {
  if (spec.reason === null) return null;
  const m = spec.reason.match(BLOCK_REASON_RE);
  if (m === null) return null;
  return { id: m[1], status: m[2] as SpecStatus };
}

export function compareQueueOrder(a: Spec, b: Spec): number {
  if (a.created !== b.created) return a.created < b.created ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function queueOnDir(dir: string, base = homeBase()): Spec[] {
  return loadBoard(base)
    .specs.filter((s) => s.dir === dir && (s.status === "ready" || s.status === "blocked"))
    .sort(compareQueueOrder);
}

export function blockQueue(dir: string, blocker: Spec, base = homeBase()): Spec[] {
  const blocked: Spec[] = [];
  for (const spec of loadBoard(base).specs) {
    if (spec.dir !== dir || spec.status !== "ready") continue;
    spec.status = "blocked";
    spec.reason = blockReason(blocker);
    writeSpec(spec, base);
    blocked.push(spec);
  }
  return blocked;
}

export function releaseBlockedBy(blockerId: string, base = homeBase()): Spec[] {
  const released: Spec[] = [];
  for (const spec of loadBoard(base).specs) {
    if (spec.status !== "blocked") continue;
    const blocked = blockedBy(spec);
    if (blocked === null || blocked.id !== blockerId) continue;
    spec.status = "ready";
    spec.reason = null;
    writeSpec(spec, base);
    released.push(spec);
  }
  return released;
}

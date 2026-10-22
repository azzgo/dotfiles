import { homeBase, loadBoard, writeSpec } from "./board.ts";
import { SpecError, type Spec, type SpecStatus } from "./spec.ts";

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

/**
 * 队列顺序 = 同目录内的 `order` 秩（1,2,3…）。`order` 为 null 的老板子按
 * (created, id) 排，并在 `orderedSpecs` 里一次性迁移成显式秩。
 */
export function compareQueueOrder(a: Spec, b: Spec): number {
  if (a.order !== null && b.order !== null) {
    if (a.order !== b.order) return a.order - b.order;
    return a.id < b.id ? -1 : 1;
  }
  if (a.created !== b.created) return a.created < b.created ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/**
 * 同目录的全部 Spec，按队列顺序排好，并把缺失的 `order` 补成 1..n（一次性迁移）。
 * 只改元数据，不动正文。
 */
export function orderedSpecs(dir: string, base = homeBase()): Spec[] {
  const board = loadBoard(base);
  const specs = board.specs.filter((s) => s.dir === dir);
  const sorted = specs.slice().sort(compareQueueOrder);
  if (specs.some((s) => s.order === null)) {
    sorted.forEach((s, i) => {
      if (s.order === i + 1) return;
      s.order = i + 1;
      writeSpec(s, base);
    });
  }
  return sorted;
}

/**
 * 把 `spec` 放进同目录队列的指定位置，并重排秩。
 * `beforeId` / `afterId` 为 null 时追加到队尾。
 */
export function placeSpec(
  spec: Spec,
  dir: string,
  base: string,
  beforeId: string | null,
  afterId: string | null,
): void {
  const list = orderedSpecs(dir, base).filter((s) => s.id !== spec.id);
  let idx = list.length;
  if (beforeId !== null) {
    const i = list.findIndex((s) => s.id === beforeId);
    if (i < 0) throw new SpecError(`${spec.id}: --before ${beforeId} 不在同目录队列里`);
    idx = i;
  } else if (afterId !== null) {
    const i = list.findIndex((s) => s.id === afterId);
    if (i < 0) throw new SpecError(`${spec.id}: --after ${afterId} 不在同目录队列里`);
    idx = i + 1;
  }
  list.splice(idx, 0, spec);
  list.forEach((s, i) => {
    if (s.order === i + 1) return;
    s.order = i + 1;
    writeSpec(s, base);
  });
}

/**
 * 在同目录队列里挪动一条 Spec 的位置（`queue --move`）。
 */
export function moveSpec(spec: Spec, dir: string, base: string, beforeId: string | null, afterId: string | null): void {
  placeSpec(spec, dir, base, beforeId, afterId);
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
    const blocker = blockedBy(spec);
    if (blocker === null || blocker.id !== blockerId) continue;
    spec.status = "ready";
    spec.reason = null;
    writeSpec(spec, base);
    released.push(spec);
  }
  return released;
}

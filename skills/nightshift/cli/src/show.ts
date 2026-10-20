import { shortSha } from "./git.ts";
import type { Spec } from "./spec.ts";
import { sessionsDir } from "./board.ts";
import path from "node:path";

export function renderSpecDetail(spec: Spec, base: string): string {
  const lines: string[] = [];
  lines.push(`${spec.id} — ${spec.title}`);
  lines.push("─".repeat(72));
  lines.push(`status:     ${spec.status}`);
  lines.push(`dir:        ${spec.dir}`);
  lines.push(`created:    ${spec.created}`);
  if (spec.model) lines.push(`model:      ${spec.model}`);
  if (spec.thinking) lines.push(`thinking:   ${spec.thinking}`);
  if (spec.tools.length > 0) lines.push(`tools:      ${spec.tools.join(", ")}`);
  if (spec.extensions.length > 0) lines.push(`extensions: ${spec.extensions.join(", ")}`);
  if (spec.baseline) lines.push(`baseline:   ${shortSha(spec.baseline)}`);
  if (spec.attempts > 0) lines.push(`attempts:   ${spec.attempts}`);
  if (spec.verdict) lines.push(`verdict:    ${spec.verdict}`);
  if (spec.reason) lines.push(`reason:     ${spec.reason}`);
  if (spec.commits !== null) lines.push(`commits:    ${spec.commits}`);
  if (spec.residual !== null) lines.push(`residual:   ${spec.residual}`);
  if (spec.hint) lines.push(`hint:       ${spec.hint}`);
  if (spec.finished) lines.push(`finished:   ${spec.finished}`);
  if (spec.run) lines.push(`run:        ${spec.run}`);
  lines.push("");
  lines.push("body:");
  lines.push(spec.body.trimEnd());
  lines.push("");
  lines.push("next steps:");
  if (spec.baseline) {
    lines.push(`  git -C ${spec.dir} log --oneline ${shortSha(spec.baseline)}..HEAD`);
    lines.push(`  git -C ${spec.dir} diff ${shortSha(spec.baseline)}..HEAD`);
  }
  if (spec.status !== "draft") {
    lines.push(`  pi -r --session-dir ${path.join(sessionsDir(base), spec.id)}`);
  }
  if (spec.baseline) lines.push(`  nightshift review ${spec.id} --drop    # 丢弃本轮提交，回到 baseline`);
  return lines.join("\n") + "\n";
}

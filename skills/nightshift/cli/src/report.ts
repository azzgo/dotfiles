import type { Spec } from "./spec.ts";
import { shortSha } from "./git.ts";
import { blockedBy } from "./queue.ts";
import { isInfraReason } from "./infra.ts";

const ICONS: Record<string, string> = {
  passed: "✅",
  "needs-review": "⚠️ ",
  "verify-error": "🟡",
  skipped: "⏭️ ",
  ready: "⏸ ",
  running: "▶️ ",
  draft: "✏️ ",
  blocked: "⛔",
};

export interface ReportInput {
  date: string;
  windowText: string;
  specs: Spec[];
}

export function renderReport(input: ReportInput): string {
  const { date, windowText, specs } = input;
  const dispatched = specs.filter((s) => s.status !== "ready" && s.status !== "draft" && s.status !== "blocked");
  const passed = specs.filter((s) => s.status === "passed").length;
  const review = specs.filter((s) => s.status === "needs-review" || s.status === "verify-error").length;
  const blockedCount = specs.filter((s) => s.status === "blocked").length;
  const lines: string[] = [];
  lines.push(
    `Nightshift ${date}  ${windowText}  派发 ${dispatched.length} / 通过 ${passed} / 需看 ${review}` +
      (blockedCount > 0 ? ` / 队列停止 ${blockedCount}` : ""),
  );
  lines.push("─".repeat(72));
  if (specs.length === 0) {
    lines.push("（本次没有任何 Spec）");
    return lines.join("\n") + "\n";
  }
  for (const s of specs) {
    const icon = ICONS[s.status] ?? "•";
    const commits = s.commits === null ? "" : `${s.commits} commit${s.commits === 1 ? "" : "s"}`;
    lines.push(`${icon} ${s.id}  ${basename(s.dir)}  ${commits}  ${s.status}`.replace(/\s+/g, " ").replace(/ $/, ""));
    if (s.verdict !== null) lines.push(`   verdict: ${s.verdict}${s.reason ? ` — ${s.reason}` : ""}`);
    if (s.status === "blocked") {
      const blocker = blockedBy(s);
      const where = blocker === null ? "?" : `${blocker.id} ${blocker.status}`;
      lines.push(`   queue stopped: ${where} — 同目录后续 Spec 停在板上，处理完这条后再跑`);
    }
    if (s.residual !== null && s.residual > 0) {
      lines.push(`   residual: ${s.residual} uncommitted path(s) left in the worktree`);
    }
    if (s.hint !== null) lines.push(`   hint: ${s.hint}`);
    if (s.baseline !== null) {
      lines.push(`   → git -C ${s.dir} log --oneline ${shortSha(s.baseline)}..HEAD`);
    }
    if (s.status === "needs-review" || s.status === "verify-error") {
      lines.push(`   → nightshift show ${s.id}`);
      lines.push(`   → nightshift release ${s.id}    # 放行同目录被挡住的下一条`);
      lines.push(`   → nightshift pass ${s.id}         # 人工判通过（不回滚提交）`);
    }
    if (s.status === "verify-error" && isInfraReason(s.reason)) {
      lines.push(`   ↳ 基础设施错误（不是代码问题）：建议 nightshift rearm ${s.id} 重跑（不消耗尝试次数）`);
    }
    if (s.status === "skipped") lines.push(`   （未派发：${s.reason ?? "队列未轮到"}）`);
    if (s.status === "ready") lines.push("   （未派发：窗口用尽，仍在板上）");
  }
  return lines.join("\n") + "\n";
}

function basename(p: string): string {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || p;
}

export function summarizeCounts(specs: Spec[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of specs) out[s.status] = (out[s.status] ?? 0) + 1;
  return out;
}

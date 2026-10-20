import type { Spec } from "./spec.ts";
import { shortSha } from "./git.ts";

const ICONS: Record<string, string> = {
  passed: "✅",
  "needs-review": "⚠️ ",
  "verify-error": "🟡",
  skipped: "⏭️ ",
  ready: "⏸ ",
  running: "▶️ ",
  draft: "✏️ ",
};

export interface ReportInput {
  date: string;
  windowText: string;
  specs: Spec[];
}

export function renderReport(input: ReportInput): string {
  const { date, windowText, specs } = input;
  const dispatched = specs.filter((s) => s.status !== "ready" && s.status !== "draft");
  const passed = specs.filter((s) => s.status === "passed").length;
  const review = specs.filter((s) => s.status === "needs-review" || s.status === "verify-error").length;
  const lines: string[] = [];
  lines.push(
    `Nightshift ${date}  ${windowText}  派发 ${dispatched.length} / 通过 ${passed} / 需看 ${review}`,
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
    if (s.residual !== null && s.residual > 0) {
      lines.push(`   residual: ${s.residual} uncommitted path(s) left in the worktree`);
    }
    if (s.hint !== null) lines.push(`   hint: ${s.hint}`);
    if (s.baseline !== null) {
      lines.push(`   → git -C ${s.dir} log --oneline ${shortSha(s.baseline)}..HEAD`);
    }
    if (s.status === "needs-review" || s.status === "verify-error") {
      lines.push(`   → nightshift show ${s.id}`);
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

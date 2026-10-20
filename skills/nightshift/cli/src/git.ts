import { spawnSync } from "node:child_process";

export type GitPreflight = { ok: true; baseline: string } | { ok: false; reason: string };

function git(dir: string, args: string[]): { status: number; out: string } {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  return { status: r.status ?? 1, out: (r.stdout ?? "").trim() };
}

export function isGitRepo(dir: string): boolean {
  return git(dir, ["rev-parse", "--git-dir"]).status === 0;
}

export function headOf(dir: string): string | null {
  const r = git(dir, ["rev-parse", "HEAD"]);
  return r.status === 0 && r.out !== "" ? r.out : null;
}

export function preflight(dir: string): GitPreflight {
  if (!isGitRepo(dir)) return { ok: false, reason: `${dir} is not a git repository` };
  const head = headOf(dir);
  if (head === null) return { ok: false, reason: `${dir} has no commits yet` };
  return { ok: true, baseline: head };
}

export function countCommits(dir: string, baseline: string): number {
  const r = git(dir, ["rev-list", "--count", `${baseline}..HEAD`]);
  return r.status === 0 && /^\d+$/.test(r.out) ? Number(r.out) : 0;
}

export function residualCount(dir: string): number {
  const r = git(dir, ["status", "--porcelain"]);
  if (r.status !== 0) return 0;
  return r.out === "" ? 0 : r.out.split("\n").filter((l) => l.trim() !== "").length;
}

export function shortSha(sha: string | null): string {
  return sha === null ? "-------" : sha.slice(0, 7);
}

export function revertTo(dir: string, baseline: string): { ok: boolean; message: string } {
  const head = headOf(dir);
  if (head === baseline) return { ok: true, message: `already at baseline ${shortSha(baseline)}` };
  const r = spawnSync("git", ["-C", dir, "reset", "--hard", baseline], { encoding: "utf8" });
  if ((r.status ?? 1) !== 0) return { ok: false, message: (r.stderr ?? "").trim() || "git reset failed" };
  return { ok: true, message: `reset ${shortSha(head)} -> ${shortSha(baseline)}` };
}

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

/** `sha` 是否是 HEAD 的祖先。历史被改写（rebase / pull --rebase / reset）后会变成 false。 */
export function isAncestor(dir: string, sha: string): boolean {
  if (sha === "") return false;
  return git(dir, ["merge-base", "--is-ancestor", sha, "HEAD"]).status === 0;
}

/** `baseline..HEAD` 里的提交（一行一条）。baseline 悬空时返回空数组。 */
export function listRange(dir: string, baseline: string): string[] {
  const r = git(dir, ["log", "--oneline", `${baseline}..HEAD`]);
  if (r.status !== 0 || r.out === "") return [];
  return r.out.split("\n").filter((l) => l.trim() !== "");
}

/**
 * 落一个非分支 ref。用途有两个：
 * - `refs/nightshift/base/<id>`：把派发时的基线钉住，历史被改写后仍可查、且不会被 gc 剪掉
 * - `refs/nightshift/backup/<id>`：`review --drop` 之前备份 HEAD，丢掉的提交永远找得回来
 */
export function updateRef(dir: string, ref: string, sha: string): boolean {
  return git(dir, ["update-ref", ref, sha]).status === 0;
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

export function revertTo(dir: string, baseline: string, id?: string): { ok: boolean; message: string } {
  const head = headOf(dir);
  if (head === baseline) return { ok: true, message: `already at baseline ${shortSha(baseline)}` };
  // 基线悬空 = 历史被改写。此时 reset --hard 会把分支甩到另一条历史上，
  // 把别人的提交一并丢掉 —— 拒绝。
  if (!isAncestor(dir, baseline)) {
    return {
      ok: false,
      message:
        `baseline ${shortSha(baseline)} 不在 HEAD 的祖先链上（历史被改写：rebase / pull --rebase / reset），` +
        "拒绝 reset —— 那会把分支甩到另一条历史上。若只是想回到远端，请自己执行 git reset --hard origin/<branch>。",
    };
  }
  const discarded = listRange(dir, baseline);
  const backup = id === undefined ? null : `refs/nightshift/backup/${id}`;
  if (backup !== null) updateRef(dir, backup, head);
  const r = spawnSync("git", ["-C", dir, "reset", "--hard", baseline], { encoding: "utf8" });
  if ((r.status ?? 1) !== 0) return { ok: false, message: (r.stderr ?? "").trim() || "git reset failed" };
  const note = discarded.length > 0 ? `，丢弃 ${discarded.length} 个提交` : "";
  const back = backup === null ? "" : ` (备份在 ${backup})`;
  return { ok: true, message: `reset ${shortSha(head)} -> ${shortSha(baseline)}${note}${back}` };
}

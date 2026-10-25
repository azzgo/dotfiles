import { spawn } from "node:child_process";
import path from "node:path";
import type { Config } from "./board.ts";
import { sessionsDir } from "./board.ts";
import type { Spec } from "./spec.ts";

export type Verdict = "pass" | "fail" | "verify-error";

export const FORBIDDEN_EXTENSION = /sub-dispatch/;

export class DispatchError extends Error {}

export interface ChildResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Prompts go over stdin, never argv. Corporate endpoint security intercepts
 * spawn() calls with large argv and SIGKILLs the child before it starts, with
 * no stderr and no output — indistinguishable from a crash. Piped stdin is
 * unaffected, and pi prepends it to the first prompt (docs/cli.md).
 */
export function buildImplArgs(spec: Spec, cfg: Config, base: string): string[] {
  const args = ["-p", "--mode", "text", "-ne", "--no-mcp", "-ns"];
  args.push("--session-dir", path.join(sessionsDir(base), spec.id));
  args.push("--name", `nightshift-${spec.id}`);
  args.push("--thinking", spec.thinking ?? "off");
  const model = spec.model ?? cfg.defaultModel;
  if (model !== null) args.push("--model", model);
  args.push("-a");
  const extra = spec.tools.map((t) => t.trim()).filter((t) => t !== "");
  if (extra.length > 0) {
    args.push("--tools", extra.map((t) => (t.startsWith("+") || t.startsWith("-") ? t : `+${t}`)).join(","));
  }
  for (const ext of spec.extensions) {
    if (FORBIDDEN_EXTENSION.test(ext)) {
      throw new DispatchError(`${spec.id}: extension "${ext}" refused (nightshift agents never dispatch)`);
    }
    args.push("-e", ext);
  }
  return args;
}

export function buildVerifyArgs(spec: Spec, cfg: Config): string[] {
  const args = ["-p", "--mode", "text", "-ne", "--no-mcp", "-ns", "--no-session"];
  args.push("--thinking", cfg.verifyThinking ?? "off");
  const model = cfg.verifyModel ?? spec.model ?? cfg.defaultModel;
  if (model !== null) args.push("--model", model);
  args.push("-a");
  args.push("--tools", "read,bash,grep,find,ls");
  return args;
}

export function parseVerdict(
  stdout: string,
  exitCode: number | null,
  detail: { signal?: NodeJS.Signals | null; stderr?: string } = {},
): { verdict: Verdict; reason: string | null } {
  const verdicts = [...stdout.matchAll(/^[ \t]*VERDICT:[ \t]*(pass|fail)[ \t]*$/gm)];
  if (verdicts.length === 0) {
    const exit = exitCode === null ? "no exit code" : `exit ${exitCode}`;
    const signal = detail.signal ? `, ${detail.signal}` : "";
    const tail = (detail.stderr ?? "").trim().split("\n").filter((l) => l.trim() !== "").slice(-1)[0];
    const body = `${exit}${signal}`;
    const hint =
      exitCode === null && !detail.signal
        ? "verifier produced no VERDICT line and exited uncleanly"
        : `verifier produced no VERDICT line (${body})${tail ? ` — ${tail.slice(0, 200)}` : ""}`;
    return { verdict: "verify-error", reason: hint };
  }
  const verdict = verdicts[verdicts.length - 1][1] as "pass" | "fail";
  const reasons = [...stdout.matchAll(/^[ \t]*REASON:[ \t]*(.+?)[ \t]*$/gm)];
  const reason = reasons.length > 0 ? reasons[reasons.length - 1][1].trim() : null;
  return { verdict, reason };
}

export function parseReviewHint(stdout: string): string | null {
  const hits = [...stdout.matchAll(/^[ \t]*REVIEW-HINT:[ \t]*(.+?)[ \t]*$/gm)];
  return hits.length > 0 ? hits[hits.length - 1][1].trim() : null;
}

export interface SpawnOptions {
  bin: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  stdin?: string;
  onStdout?: (chunk: string) => void;
  /** 子进程每有输出就触达一次（心跳）：`ns status` 靠它区分「活着没产出」和「真挂了」。 */
  onActivity?: () => void;
  /** 子进程起来后的回调（拿 pid）——用于落 pid 文件，好让 `ns status` / `ns stop` 能找到它。 */
  onSpawn?: (pid: number) => void;
}

export function runChild(opts: SpawnOptions): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(opts.bin, opts.args, {
        cwd: opts.cwd,
        stdio: [opts.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      });
    } catch (e) {
      reject(new DispatchError(`failed to spawn ${opts.bin}: ${String(e)}`));
      return;
    }
    if (opts.onSpawn && child.pid !== undefined) opts.onSpawn(child.pid);
    if (opts.stdin !== undefined && child.stdin) {
      child.stdin.on("error", () => {});
      child.stdin.end(opts.stdin);
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    let timer: NodeJS.Timeout | null = null;
    if (opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000).unref?.();
      }, opts.timeoutMs);
      timer.unref?.();
    }

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      stdout += d;
      opts.onStdout?.(d);
      opts.onActivity?.();
    });
    child.stderr.on("data", (d: string) => {
      stderr += d;
      opts.onActivity?.();
    });

    const settle = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ exitCode, signal, stdout, stderr, timedOut });
    };

    child.on("error", (e) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(new DispatchError(`failed to spawn ${opts.bin}: ${e.message}`));
    });
    child.on("close", settle);
  });
}

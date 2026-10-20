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

export function buildImplArgs(spec: Spec, cfg: Config, base: string, prompt: string): string[] {
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
  args.push("--", prompt);
  return args;
}

export function buildVerifyArgs(spec: Spec, cfg: Config, prompt: string): string[] {
  const args = ["-p", "--mode", "text", "-ne", "--no-mcp", "-ns", "--no-session"];
  args.push("--thinking", cfg.verifyThinking ?? "off");
  const model = cfg.verifyModel ?? spec.model ?? cfg.defaultModel;
  if (model !== null) args.push("--model", model);
  args.push("-a");
  args.push("--tools", "read,bash,grep,find,ls");
  args.push("--", prompt);
  return args;
}

export function parseVerdict(stdout: string, exitCode: number | null): { verdict: Verdict; reason: string | null } {
  const verdicts = [...stdout.matchAll(/^[ \t]*VERDICT:[ \t]*(pass|fail)[ \t]*$/gm)];
  if (verdicts.length === 0) {
    const hint =
      exitCode === null
        ? "verifier produced no VERDICT line and exited uncleanly"
        : `verifier produced no VERDICT line (exit ${exitCode})`;
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
  onStdout?: (chunk: string) => void;
}

export function runChild(opts: SpawnOptions): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(opts.bin, opts.args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      reject(new DispatchError(`failed to spawn ${opts.bin}: ${String(e)}`));
      return;
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
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      stdout += d;
      opts.onStdout?.(d);
    });
    child.stderr.on("data", (d: string) => {
      stderr += d;
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

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { extractSection } from "./prompt.ts";
import type { Spec } from "./spec.ts";

export interface LintFinding {
  level: "error" | "warn";
  code: string;
  message: string;
}

const CODE_EXT = "ts|tsx|js|jsx|mjs|cjs|json|md|mdx|yaml|yml";
const PATH_RE = new RegExp(
  `(?<![\\w/])([\\w.][\\w./-]*\\.(?:${CODE_EXT}))(?![\\w/])`,
  "g",
);
const SHA_RE = /\b([0-9a-f]{7,40})\b/g;

/** Constraints 里的"不许碰 X"。 */
const FORBID_RE = new RegExp(
  `(?:不改|不要改|不要动|不碰|不得修改|不许修改|禁止修改|不要修改|不动|零改动|内容不变)\\s*\`?([\\w./-]+)\`?`,
  "g",
);
/** Verify 里的"X 必须没被动过"。 */
const UNTOUCHED_RE = new RegExp(
  "`?([\\w./-]+)`?\\s*(?:不被引用|未被引用|不被|零改动|没有被修改|未修改|不改动|不含|没有改动|不引用)",
  "g",
);
/** 反引号里的路径样 token。 */
const BACKTICK_RE = /`([^`\n]{1,120})`/g;
/** 不可判定的验收措辞。 */
const VAGUE_VERIFY = [
  "跑测试",
  "跑一遍测试",
  "测试通过",
  "没有报错",
  "不报错",
  "看起来",
  "差不多",
  "合理",
  "正常",
];

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".cache",
  "vendor",
  "__pycache__",
]);

/**
 * 仓库里所有文件（相对路径），带缓存。Spec 里点名的路径常常是**子目录相对**的
 * （`claude-runtime-v2/client.ts`），所以不能只按仓库根去找——用后缀匹配。
 */
const fileIndexCache = new Map<string, string[]>();

function fileIndex(dir: string): string[] {
  const hit = fileIndexCache.get(dir);
  if (hit !== undefined) return hit;
  const out: string[] = [];
  const walk = (rel: string): void => {
    const abs = rel === "" ? dir : path.join(dir, rel);
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".pi") continue;
      const childRel = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(childRel);
      } else {
        out.push(childRel);
      }
    }
  };
  walk("");
  fileIndexCache.set(dir, out);
  return out;
}

function existsUnder(dir: string, rel: string): boolean {
  const relPath = rel.replace(/^\.\//, "").replace(/^(\.\.\/)+/, "");
  // TS 仓库里 import 常写 .js 后缀（ESM 风格），实际文件是 .ts
  const candidates = [relPath];
  if (relPath.endsWith(".js")) {
    candidates.push(relPath.replace(/\.js$/, ".ts"), relPath.replace(/\.js$/, ".tsx"));
  }
  for (const cand of candidates) {
    const roots = [dir, path.join(dir, "apps", "backend"), path.join(dir, "apps", "frontend"), path.join(dir, "packages")];
    for (const root of roots) {
      try {
        if (fs.existsSync(path.join(root, cand))) return true;
      } catch {
        // 忽略
      }
    }
    // 后缀匹配：Spec 里常写子目录相对路径
    if (fileIndex(dir).some((p) => p.endsWith(cand) || p.endsWith("/" + cand))) return true;
  }
  return false;
}

function shaExists(dir: string, sha: string): boolean {
  const r = spawnSync("git", ["-C", dir, "cat-file", "-e", `${sha}^{commit}`], { encoding: "utf8" });
  return r.status === 0;
}

/**
 * Spec 正文的静态自检。全是纯静态判断，不需要模型。
 *
 * 动机：2026-10-22 夜班，ns-0006 的 `Constraints` 写着「不改
 * `agent-runtime/public.ts`」，而 `Verify` 要求「V2 链不引用任何 V1 runtime
 * 模块」——而 `ensureRuntimeWorkspaceId` 正是从 public.ts 进来的。约束与验收
 * 标准直接打架，Agent 花 1h29m 才发现，最后的结论是"这活儿不是复制七个文件
 * 能干的"。这类矛盾应该在入板前就被指出来。
 */
export function lintSpec(spec: Spec, dir: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const change = extractSection(spec.body, "Change");
  const constraints = extractSection(spec.body, "Constraints");
  const verify = extractSection(spec.body, "Verify");
  const scope = extractSection(spec.body, "Out of scope");

  // 1. 点名的路径在仓库里不存在
  //    只看“应该已经存在”的那些：Constraints / Verify 里的路径，以及 Change 里
  //    明确说“改/指向/引用”的那些。“要造一个新文件”的行跳过（那种路径本来就不存在）。
  const CREATE_RE = /(新建|创建|复制|新增|拷贝|加一个|写一个|产出|不要复制|不复制)/;
  const EXISTING_RE = /(修改|改成|改到|指向|引用|位于|在)/;
  const missing = new Set<string>();
  const checkLines = [
    ...constraints.split("\n").map((l) => [l, true] as const),
    ...verify.split("\n").map((l) => [l, true] as const),
    ...change.split("\n").map((l) => [l, false] as const),
  ];
  for (const [line, always] of checkLines) {
    if (CREATE_RE.test(line)) continue;
    if (!always && !EXISTING_RE.test(line)) continue;
    for (const m of line.matchAll(PATH_RE)) {
      const rel = m[1];
      if (rel.includes("*") || rel.includes("...") || rel.startsWith("http")) continue;
      if (/xxx|example|示例/i.test(rel)) continue;
      if (existsUnder(dir, rel)) continue;
      missing.add(rel);
    }
  }
  if (missing.size > 0) {
    const list = [...missing].slice(0, 6).map((p) => `\`${p}\``).join("、");
    const more = missing.size > 6 ? ` 等 ${missing.size} 个` : "";
    findings.push({
      level: "warn",
      code: "missing-path",
      message: `点名了不存在的路径：${list}${more} —— 可能是路径漂移或写错`,
    });
  }

  // 2. 正文里的 SHA 已经不在历史里（典型：rebase 之前的旧 SHA）
  const shas = uniq([...change.matchAll(SHA_RE), ...constraints.matchAll(SHA_RE)].map((m) => m[1]));
  for (const sha of shas) {
    if (!shaExists(dir, sha)) {
      findings.push({
        level: "warn",
        code: "stale-sha",
        message: `正文里的 \`${sha}\` 已经不在仓库历史里 —— rebase 之后旧 SHA 会失效`,
      });
    }
  }

  // 3. 互斥检测：Constraints 说"不许动 X"，而 Change 里既没有 X 的替代品、
  //    Verify 又要求"V2 不得引用 X" —— 三者同时成立是不可能的。
  //    （只报机械可判的那类：X 是个文件、且 Change 里确实没有它的替代品。
  //    "Verify 口径比 Change 严"这种语义层的错，lint 判不了——那要靠闭包分析脚本。）
  const forbidden = uniq([...constraints.matchAll(FORBID_RE)].map((m) => m[1]));
  const changePaths = uniq([...change.matchAll(PATH_RE)].map((m) => m[1]));
  const verifyWantsUnreferenced = /不被引用|未被引用|不得引用/.test(verify);
  if (verifyWantsUnreferenced) {
    for (const raw of forbidden) {
      const name = raw.replace(/\/\*+$/, "").replace(/^\/+|\/+$/g, "");
      if (name === "" || name.includes("*")) continue;
      // 只看文件：带扩展名或带斜杠的；package.json / 锁文件 / schema 天然不会被"复制一份"
      if (!/\.[A-Za-z]+$/.test(name) && !name.includes("/")) continue;
      if (/(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|.*\.lock)$/.test(name)) continue;
      if (/schema/i.test(name)) continue;
      const stem = name.replace(/\.[A-Za-z]+$/, "").split("/").pop() ?? name;
      if (stem.length < 3) continue;
      const hasReplacement = changePaths.some((p) => {
        const s = p.replace(/\.[A-Za-z]+$/, "").split("/").pop() ?? p;
        return s === `${stem}-v2` || s === `${stem}_v2` || s.startsWith(`${stem}-v2`) || s.startsWith(`${stem}_v2`);
      });
      if (hasReplacement) continue;
      findings.push({
        level: "error",
        code: "constraint-conflict",
        message:
          `Constraints 说「不许动 \`${name}\`」，Verify 又要求「不得引用它」，但 Change 里没有它的替代品` +
          `（没有 \`${stem}-v2\` 这样的副本或新 facade）—— 这两条同时成立是不可能的`,
      });
    }
  }

  // 4. Verify 里的不可判定措辞
  for (const phrase of VAGUE_VERIFY) {
    if (!verify.includes(phrase)) continue;
    findings.push({
      level: "warn",
      code: "unverifiable",
      message: `Verify 里有「${phrase}」这种不可判定的措辞 —— 写成"怎样才算通过"而不是"跑什么"`,
    });
  }

  // 5. Out of scope 为空
  if (scope.trim() === "") {
    findings.push({
      level: "warn",
      code: "empty-out-of-scope",
      message: "Out of scope 是空的 —— Agent 会顺手做掉一半相关重构",
    });
  }

  return findings;
}

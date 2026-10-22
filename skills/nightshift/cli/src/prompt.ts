import type { Spec } from "./spec.ts";
import { shortSha } from "./git.ts";

export interface ImplPromptInput {
  spec: Spec;
  baseline: string | null;
  attempt: number;
  feedback: string | null;
}

const IMPL_DISCIPLINE = [
  "你正在夜间无人值守地执行一条 Spec。没有人能回答你的问题，不要等待确认。",
  "",
  "纪律（不可协商）：",
  "- 只 `git add` 你实际修改过的路径；禁止 `git add -A` / `git add .`。",
  "- 在当前分支上 `commit`；禁止 push、禁止 switch/checkout 其它分支、禁止 stash、禁止 reset、禁止开 PR。",
  "- 不要修改 `.pi/` 下的任何配置，不要修改夜班板与 `~/.cache/nightshift/`。",
  "- 不需要输出自检报告；只把活儿做完并提交。",
  "- 结束时输出一行：`REVIEW-HINT: <一句话，说明你希望人重点看哪里>`（没有就不输出）。",
].join("\n");

export function implPrompt(input: ImplPromptInput): string {
  const { spec, baseline, attempt, feedback } = input;
  const parts = [
    `Spec ${spec.id} — ${spec.title}`,
    `工作目录: ${spec.dir}`,
    `基线提交: ${shortSha(baseline)}`,
    attempt > 0 ? `这是第 ${attempt + 1} 次尝试（上一次未通过验证）。` : "",
    "",
    spec.body.trim(),
    "",
    IMPL_DISCIPLINE,
  ];
  if (feedback !== null && feedback.trim() !== "") {
    parts.push("", "── 上一轮验证失败的理由（请针对性修正）──", feedback.trim());
  }
  return parts.filter((p) => p !== "").join("\n") + "\n";
}

export interface VerifyPromptInput {
  spec: Spec;
  baseline: string | null;
  head: string | null;
}

export function verifyPrompt(input: VerifyPromptInput): string {
  const { spec, baseline, head } = input;
  const verifySection = extractSection(spec.body, "Verify");
  return [
    "你是一个只读验证者。判断下面这条 Spec 是否真的被完成了。",
    "",
    `Spec ${spec.id} — ${spec.title}`,
    `工作目录: ${spec.dir}`,
    `基线提交: ${shortSha(baseline)}   当前 HEAD: ${shortSha(head)}`,
    "",
    "你可以用 read / grep / find / ls / bash 查看代码并运行测试命令。",
    "你没有任何写权限：不要试图修改文件或提交。",
    "",
    "── 验收标准（来自 Spec 的 Verify 段）──",
    verifySection.trim() === "" ? "（Spec 没有写 Verify 段，此时以 Goal 段为验收依据）" : verifySection.trim(),
    "",
    "── Spec 全文 ──",
    spec.body.trim(),
    "",
    "── 检查建议 ──",
    "- 验收标准是**对当前工作区的状态判断**（文件在不在、引用指向谁、门禁过不过），这是判决依据。",
    `- 用 \`git -C ${spec.dir} log --oneline ${shortSha(baseline)}..HEAD\` 看它到底改了什么（仅作参考）。`,
    `- 用 \`git -C ${spec.dir} diff ${shortSha(baseline)}..HEAD\` 看具体改动（仅作参考）。`,
    `- 若 \`git -C ${spec.dir} merge-base --is-ancestor ${shortSha(baseline)} HEAD\` 失败，说明历史被改写，` +
      "**忽略上面的 diff 范围**，只按验收标准判断，并在 REASON 里写明历史被改写。",
    "- 逐条核对验收标准，必要时真跑命令。",
    "",
    "── 输出格式（必须严格照做）──",
    "先写你的核对过程与结论理由，最后两行必须是：",
    "VERDICT: pass",
    "REASON: <一行理由>",
    "",
    "VERDICT 只能是 pass 或 fail。不确定时倾向 fail。",
  ].join("\n");
}

export function extractSection(body: string, name: string): string {
  const re = new RegExp(`^##[ \\t]+${name}[ \\t]*$\\n([\\s\\S]*?)(?=^##[ \\t]|(?![\\s\\S]))`, "m");
  const m = body.match(re);
  return m ? m[1] : "";
}

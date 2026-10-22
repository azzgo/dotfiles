#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isVerify = args.includes("--no-session");

const prompt = fs.readFileSync(0, "utf8");
if (process.env.FAKE_REQUIRE_STDIN === "1" && prompt.trim() === "") {
  process.stderr.write("fake-pi: no prompt on stdin\n");
  process.exit(2);
}
if (process.env.FAKE_ASSERT_PROMPT && !prompt.includes(process.env.FAKE_ASSERT_PROMPT)) {
  process.stderr.write("fake-pi: prompt missing marker " + process.env.FAKE_ASSERT_PROMPT + "\n");
  process.exit(2);
}
if (
  !isVerify &&
  process.env.FAKE_ASSERT_IMPL_PROMPT &&
  !prompt.includes(process.env.FAKE_ASSERT_IMPL_PROMPT)
) {
  process.stderr.write("fake-pi: impl prompt missing marker " + process.env.FAKE_ASSERT_IMPL_PROMPT + "\n");
  process.exit(2);
}

function git(argv) {
  return spawnSync("git", argv, { encoding: "utf8" });
}

if (isVerify) {
  const verdict = process.env.FAKE_VERDICT ?? "pass";
  const reason = process.env.FAKE_REASON ?? "fake verifier";
  const complain = process.env.FAKE_NO_VERDICT === "1";
  if (complain) {
    process.stdout.write("I could not decide.\n");
    process.exit(0);
  }
  process.stdout.write(`checked the diff\nVERDICT: ${verdict}\nREASON: ${reason}\n`);
  process.exit(0);
}

const marker = process.env.FAKE_TOUCH ?? "nightshift-fake.txt";
fs.writeFileSync(marker, `written at ${new Date().toISOString()}\n`);
git(["add", marker]);
git(["commit", "-m", `fake nightshift work (${marker})`]);
if (process.env.FAKE_REWRITE_HISTORY === "1") {
  // 把基线那个提交重写掉：基线不再是 HEAD 的祖先（模拟 rebase / pull --rebase）
  git(["reset", "--soft", "HEAD~1"]);
  git(["commit", "--amend", "-m", "rewritten history"]);
}
process.stdout.write(`did the work\nREVIEW-HINT: look at ${marker}\n`);

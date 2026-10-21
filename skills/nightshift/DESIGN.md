# Nightshift — 实现契约

> 术语见 `CONTEXT.md` 的 *Nightshift（夜间批量执行）*；决策理由见 `docs/adr/0017-nightshift-is-a-script-not-an-extension.md`。
> 本文只写"怎么实现"，不重复方法论。

## 1. 文件布局

```text
<repo>/skills/nightshift/
├── SKILL.md              # 白天的澄清 → 上板（任何 agent 可用）
├── CONVENTION.md         # 板子布局 / schema / 命令动词（机器可读的唯一约定）
├── DESIGN.md             # 本文件
├── GUIDE.md              # 面向人的操作手册
├── scripts/
│   ├── nightshift          # PATH wrapper（找 CLI + 找 node）
│   └── nightshift-keep-awake   # 平台相关睡醒抑制 + `run`
└── cli/
    ├── package.json      # {"private":true,"type":"module"}
    ├── main.ts           # 命令行入口（动词分派）
    ├── src/
    │   ├── spec.ts        # frontmatter 解析 / 序列化 / 严格 schema 校验
    │   ├── board.ts       # 板与归档的读写、id 分配、config、单实例锁
    │   ├── git.ts         # baseline / commits / residual / reset 守卫
    │   ├── dispatch.ts    # argv 拼装（实现侧 + Verifier 侧）、spawn、Verdict 解析
    │   ├── prompt.ts      # 实现 prompt / verify prompt 模板
    │   ├── run.ts         # 调度：串行键、并发、窗口、归档
    │   ├── queue.ts       # 同目录串行队列：排序 / 停止 / 放行
    │   ├── report.ts      # Report 渲染
    │   └── show.ts        # 单条详情 + 下一步命令
    └── test/
        ├── cli.test.ts    # 54 个测试
        └── fake-pi.mjs    # 假 pi，零 token 验证整个调度循环
<repo>/pi/agent/prompts/nightshift.md   # 薄快捷键，只转发
```

运行时目录（机器本地，不进仓库，同 ADR 0014 理由）：

```text
~/.cache/nightshift/
├── board/<spec-id>.md              # 未结束的 Spec
├── archive/<YYYY-MM-DD>/
│   ├── <spec-id>.md                # 已结束的 Spec（含 verdict 元数据）
│   └── report.txt                  # 该次 Run 的 Report 快照
├── runs/<run-id>/run.json          # Run 记录（窗口、派发序列、耗时）
├── sessions/<spec-id>/             # pi --session-dir
└── run.lock                        # 单实例锁（pid + startedAt）
```

配置：`~/.pi/agent/nightshift/config.json`

```json
{ "defaultModel": "sonnet:high", "jobs": 3, "window": "07:00", "piBin": "pi" }
```

缺省：`jobs: 3`、`window: "07:00"`、`piBin: "pi"`、`defaultModel` 不设（继承 pi 当前默认）。

## 2. Spec schema

frontmatter 全部由 CLI 写；人/agent 只写正文。

```yaml
---
id: ns-0007              # CLI 分配，ns-<4位>
status: ready            # draft | ready | blocked | running | needs-review | passed | verify-error | skipped
dir: /Users/ison/dev/dotfiles
title: 夜间看板 CLI
created: 2026-10-19T14:02:11Z
model: sonnet:high       # 可选，缺省用 config.defaultModel
tools: []                # 可选，追加到默认工具面
extensions: []           # 可选，绝对路径；拒绝 sub-dispatch
baseline: 275dd85        # CLI 派发前写入
attempts: 0              # CLI 写
verdict: null            # CLI 写：pass | fail | verify-error | null
reason: null             # CLI 写：Verifier 的一行理由
---
## Goal
## Change
## Constraints
## Verify
## Out of scope
```

正文模板固定五节，缺节在 `check` 里报错。`dir` 必须是已存在的 git 仓库（`preflight` 检查 `rev-parse --git-dir` + 有 HEAD），否则该 Spec 在派发前就落 `skipped`。

**同一 `dir` 允许多条未完成（`draft`/`ready`/`blocked`）的 Spec 共存**：`add` 不再拒绝第二条。同目录的 Spec 构成一条**串行队列**，顺序 = `created` 时间序（相同则按 id）——先入板先跑。队列的推进与停止见 §4。

## 3. 命令动词

```text
nightshift add --dir <path> [--title <t>]        # 从 stdin 读正文，写 draft
nightshift list [--status ready]                 # 一行一条
nightshift show <id>                             # 渲染 Spec + 最近一次日志
nightshift ready <id>                            # draft → ready（唯一的状态升级动作）
nightshift check                                  # schema 校验（不写盘）
nightshift run [--until HH:MM] [--jobs N]        # 夜间排水（持有 run.lock）
nightshift report [--date YYYY-MM-DD]            # 只读检查面
nightshift review <id> [--drop]                  # --drop 才动盘：git reset --hard <baseline>，并放行被它挡住的下一条
nightshift queue [--dir P]                       # 看同目录串行队列（ready / blocked）
nightshift unblock <id>                          # blocked → ready（只放这一条）
nightshift release <id>                          # 放行所有 reason 里写着 blocked by <id> 的项
```

`status` 的转移只发生在：`add→draft`、`draft→ready`（`ready` 动词）、`ready→draft`（`unready`）、`ready→blocked`（同目录前一条未通过）、`blocked→ready`（`unblock` / `release` / `review --drop`）、`run→running→{passed|needs-review|verify-error}`、`run→skipped`（git 前置失败）、归档时 `passed|needs-review|verify-error|skipped` 移出板。`draft` 永不被派发；窗口用尽未派发的 `ready` 留在板上等下一夜。

## 4. `run` 的调度算法

```text
acquire run.lock            # 已存在且 pid 存活 → 拒绝启动并打印该 pid
snapshot = board 中所有 status=ready 的 id（快照后新加的 Spec 不参与本次）
queues  = group snapshot by dir (Serial Key)
loop:
  if now >= window: break
  ready = 所有非空 queue 的队首，且其 dir 当前无在跑任务
  launch min(jobs - running, len(ready)) 条（spawn pi -p）
  wait 任意一条 settle → 落盘 verdict → 该 dir 的 queue 前进 / 停止
exit when: 所有 queue 空 → 归档 → 释放锁
```

- **队内顺序** = `created` 时间序（同刻按 id）。`ready` 快照进队时即排序。仍为 `draft` 的 Spec 不占队列位置（未 ready = 未获授权，不挡后面的 `ready`）。
- **同 Serial Key 严格串行**：一个 dir 同时最多一条在跑；前一条 **passed 后**才派发同目录的下一条。
- **前一条不是 passed 就停止该目录队列**：`needs-review` / `verify-error` / `skipped` 都会把该目录**剩余未派发的 `ready`** 就地改成 `blocked`，`reason` 写 `blocked by <blocker-id> (<blocker-status>)`。避免在坏地基上继续盖楼。跨目录不受影响。
- **跨 Serial Key 并行**：受 `--jobs` 限制（默认 3）。
- **无 sleep 轮询**：用子进程 `exit` 事件驱动，队列空即退出。
- **窗口到点**：不再启动新任务；在跑的任务等其自然结束；未派发的保持 `ready` 留在板上。
- **窗口长度守卫**：`assertWindowSane` 在派发前检查 `deadline - startedAt <= maxWindowHours`（默认 14），超出直接抛错。防的是调度器补跑把 `--until 07:00` 从 8 小时变成 22 小时。守卫放在核心而不是 shell 层，因为它与调度器无关。

## 5. 派发 argv（实现 Agent）

```text
pi -p
   --mode text
   -ne --no-mcp -ns
   --session-dir ~/.cache/nightshift/sessions/<spec-id>
   --name nightshift-<spec-id>
   --thinking <spec.thinking ?? off>
   --model <spec.model ?? config.defaultModel>          # 有值才传
   -a
   --tools +replace_match,+insert                       # 只在 spec.tools 非空时追加同名/指定项
   -- "<实现 prompt>"                                    # 注意 -- 终止位
```

`cwd` 由 spawn 的 `cwd: spec.dir` 提供 —— **pi 没有 `-C` 开关**（`-c` 是 `--continue`）。

三条已核实的事实决定了上面的形状（原文见 pi `docs/cli.md`）：

1. **裸名字会替换整个工具集。** `--tools read,bash` 不是"加上这两个"，而是"只要这两个"。默认集是 `read,bash,edit,write`。因此这里**不给裸名字**，`spec.tools` 一律以 `+name` 形式追加。
2. **`-ne` 会连带关掉由扩展提供的工具。** `replace_match` / `insert` / `copy` / `move` / `undo_last_change` 来自 `pi-hashline-edit-pro`（`~/.pi/agent/settings.json` 的 packages），扩展一关就没了。Spec 需要它们时必须 `-e <path>` 显式加载，或改用内置的 `edit`（精确文本替换）。
3. **prompt 走 argv，不走 stdin。** pi 的 print 模式从 argv 读 prompt；`stdio: ["ignore", "pipe", "pipe"]` 让子进程不持有 stdin，也就不会出现"等待输入"的挂起。长 prompt 由 `--` 终止位保护，避免被当成选项。

固定纪律写进 prompt（不由 Spec 控制）：

```text
你在夜间无人值守地执行一条 Spec。
- 只 git add 你实际修改的路径；禁止 git add -A / git add .
- 在当前分支 commit，禁止 push / switch / stash / reset / 开 PR
- 不要修改 .pi/ 下的任何配置
- 结束时输出一行 REVIEW-HINT: <一句话，说明你希望人重点看哪里>
```

`REVIEW-HINT` 只进 Report，不作判决。

## 6. 派发 argv（Verifier）

```text
pi -p
   --mode text
   -ne --no-mcp -ns
   --no-session
   --thinking <config.verifyThinking ?? off>
   --model <config.verifyModel ?? spec.model ?? config.defaultModel>   # 有值才传
   -a
   --tools read,bash,grep,find,ls        # 裸名字：Verifier 只要这五个
   -- "<verify prompt>"
```

verify prompt 自包含：Spec 的 `Verify` 段落 + `dir` + `baseline` + `git diff` 提示 + 强制输出格式。

```text
最后两行必须是：
VERDICT: pass
REASON: <一行理由>
```

## 7. Verdict 解析

```text
stdout 正则 /^VERDICT:[ \t]*(pass|fail)[ \t]*$/m  → 命中即判决
REASON  同法取最后一条 ^REASON:
未命中                → verify-error（不重试）
exit code 非零 + 未命中 → 仍是 verify-error（进程挂了，非代码失败）
```

判决只看**行首**（允许缩进）的 `VERDICT:`——文中顺口提到 "VERDICT: pass" 不会被误认。多行取最后一条。

失败重试：`fail` 且 `attempts < 2` → 重派实现 Agent，把 `REASON` 作为反馈附加进 prompt；第二次仍 `fail` → `needs-review`（`attempts = 2`）。

**`SELF-CHECK` 不入协议。** 实现者自检完全自主：CLI 不要求、不解析、不判定。上一版曾设计实现者输出 `SELF-CHECK:` 供 CLI 抓取，已被否决——判决只认 Verifier，多一个被抓取的自由文本字段只会制造第二个"看起来像权威"的信号。

**`REVIEW-HINT:` 同处理。** 它是给 Report 用的提示，抓不到就是没有，不影响 verdict，不影响重试。

## 8. Git 协议

| 时刻 | 动作 |
|---|---|
| 派发前 | `git -C dir rev-parse HEAD` → `baseline`；不是仓库/无提交则落 `skipped`，不派发 |
| 执行中 | agent 在当前分支提交，不切不移 |
| 结束后 | 报告对比 `baseline..HEAD` 的提交数与 `git status --porcelain` 剩余项 |
| `review --drop` | `git reset --hard <baseline>`；`baseline` 为 null 时拒绝 |

`git add -A` 的禁区由 prompt 纪律 + 报告里的 `git status` 剩余项共同兜底（漏 add 会显形在报告里）。

## 9. Report 格式

```text
Nightshift 2026-10-19  窗口 23:10–07:00  派发 5 / 通过 3 / 需看 2 / 队列停止 1
────────────────────────────────────────────────────────────
✅ ns-0007 dotfiles 3 commits passed
   verdict: pass — 只动了 cli/，未触及 justfile
   hint: 重点看 run.ts 的窗口判断
   → git -C /Users/ison/dev/dotfiles log --oneline 275dd85..HEAD
⚠️ ns-0008 dotfiles 2 commits needs-review
   verdict: fail — 缺少空队列路径的测试
   → nightshift show ns-0008
   → nightshift release ns-0008    # 放行同目录被挡住的下一条
🟡 ns-0009 dotfiles verify-error
   verdict: verify-error — verifier produced no VERDICT line (exit 1)
⛔ ns-0011 dotfiles blocked
   queue stopped: ns-0009 verify-error — 同目录后续 Spec 停在板上，处理完这条后再跑
⏸ ns-0010 other ready
   （未派发：窗口用尽，仍在板上）
```

`blocked` 条目独立计数（标题行的「队列停止 N」），并在条目下显式标出停在哪一条。纯文本、无 UI、可重定向。`--date` 从 archive 读。

## 10. 单实例锁

`~/.cache/nightshift/run.lock` 写 `{pid, startedAt, runId}`。启动时若文件存在：读 pid，`kill -0` 存活则拒绝并打印；不存活则视为陈旧锁，覆盖。

## 11. 安装与调度边界

仓库只装两个 wrapper，**不安装任何定时器产物**（无 plist / crontab / systemd timer）。`just install-nightshift` 把 `scripts/` 链到 `~/.local/bin`；`just install-skills` 负责让 wrapper 能定位到 CLI。

```sh
# scripts/nightshift          → exec <node> ~/.agents/skills/nightshift/cli/main.ts "$@"
# scripts/nightshift-keep-awake
#   Darwin          exec caffeinate -i nightshift run "$@"
#   Linux           exec systemd-inhibit --what=sleep:idle --mode=block nightshift run "$@"
#   other           exec nightshift run "$@"
```

node 的解析顺序：`$NIGHTSHIFT_NODE` → mise shim → `PATH`。原因是调度环境（launchd / systemd / cron）默认是裸 `PATH`，而 pi 自身也是 `#!/usr/bin/env node`——两层都需要 node 可解析。

## 12. 动手顺序

Phase 0–4 已完成（54 个测试全绿，`just test-nightshift`）。

Phase 0 · 无 pi 依赖
  ✅ A. `cli/src/spec.ts`    frontmatter 解析/序列化 + 五节校验 + 未知 key 报错
  ✅ B. `cli/src/board.ts`   id 分配、板读写、归档、config、run.lock
  ✅ C. `main.ts` 的白日动词  add / list / show / ready / unready / check

Phase 1 · 派发
  ✅ D. `cli/src/dispatch.ts` argv 拼装（实现侧 + Verifier 侧）
  ✅ E. Verdict 解析        行首正则 + 三值判决（退出码不参与）
  ✅ F. `cli/src/prompt.ts`  实现 prompt / verify prompt 两个模板

Phase 2 · 夜间骨架
  ✅ G. `cli/src/run.ts`     串行键分组、并发上限、窗口、事件驱动、快照
  ✅ H. 归档                结束即移出板 + 写 run.json + report.txt 快照

Phase 3 · 人的检查面
  ✅ I. `cli/src/report.ts`  Report 渲染（baseline 区间、REVIEW-HINT、residual）
  ✅ J. `review --drop`      reset --hard 守卫（bad baseline 拒绝）

Phase 4 · 文档与接线
  ✅ K. `SKILL.md`           白天：澄清 → add → 补正文 → ready；何时不该上板
  ✅ L. `CONVENTION.md`      schema / 动词 / 派发契约 / 调度边界
  ✅ M. `prompts/nightshift.md`  薄转发
  ✅ N. `GUIDE.md`           面向人的操作手册
  ✅ O. `scripts/` + `just install-nightshift` + `just test-nightshift`
  ✅ P. `skills/README.txt` + `AGENTS.md` + 本文件 登记

Phase 5 · 首次真跑（唯一烧 token 的一步）
  ☐ Q. 手写 1 条真实 Spec → `nightshift run --until +5m` → 看 Report 是否可信
  ☐ R. 按 Q 的结果回调 A–J 的假设

已用 `test/fake-pi.mjs` 零成本验证过的路径：全绿通过、fail 后重试至 needs-review、
缺失 VERDICT 落 verify-error 且不重试、跨目录并行、同目录串行队列按 created 排空、
同目录前一条 fail/verify-error/skipped 后队列停止并能被 release 重新武装、draft 不派发、
单实例锁拒绝、超长窗口拒绝、归档搬迁。真跑只需要验证真实的 pi 是否会遵守 prompt 纪律与输出格式。

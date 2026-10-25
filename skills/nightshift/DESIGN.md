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
        ├── cli.test.ts    # 61 个测试
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
{ "defaultModel": "sonnet:high", "jobs": 3, "window": "07:00", "piBin": "pi", "timeoutSec": 7200, "verifyTimeoutSec": 5400 }
```

缺省：`jobs: 3`、`window: "07:00"`、`piBin: "pi"`、`timeoutSec: 3600`、`verifyTimeoutSec: 1800`、`defaultModel` 不设（继承 pi 当前默认）。

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
order: 1                 # CLI 写：同目录队列里的秩（1,2,3…），可 null
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

**同一 `dir` 允许多条未完成（`draft`/`ready`/`blocked`）的 Spec 共存**：`add` 不再拒绝第二条。同目录的 Spec 构成一条**串行队列**，顺序 = `order` 秩（缺省按 `created`，相同则按 id）——先入板先跑，但 `add --before/--after` 与 `queue --move` 可以把新任务插到前面。队列的推进与停止见 §4。

## 3. 命令动词

```text
nightshift add --dir <path> [--title <t>] [--before id | --after id]   # 从 stdin 读正文，写 draft；--before/--after 决定队列位置
nightshift list [--status ready]                 # 一行一条
nightshift show <id>                             # 渲染 Spec + 最近一次日志
nightshift ready <id>                            # draft → ready（唯一的状态升级动作）
nightshift check                                  # schema 校验（不写盘）
nightshift lint [<id>]                           # Spec 正文静态自检（不写盘、不用模型）
nightshift run [--until HH:MM] [--jobs N]        # 夜间排水（持有 run.lock）
nightshift report [--date YYYY-MM-DD]            # 只读检查面
nightshift review <id> [--drop]                  # --drop 才动盘：git reset --hard <baseline>，并放行被它挡住的下一条
nightshift rearm <id>                           # 重新装填：回到 ready，基线重锚当前 HEAD，保留上一轮理由
nightshift pass <id> [--reason R]                # 人工判通过：needs-review/verify-error/running → passed，不回滚提交，放行被挡住的下一条
nightshift status [--stall MIN]                 # 板子活性：alive / stalled / orphaned / gone
nightshift tail <id> [-n N] [-f]                # 看正在跑的 Agent 的实时进展（-f 跟着刷）
nightshift nudge <id> <text>                    # 给正在跑的 Agent 递一句话（inbox/<id>.md）
nightshift stop <id> | --all                    # 停掉在跑的子进程（--all 连 run 一起停）
nightshift queue [--dir P]                       # 看同目录串行队列（ready / blocked）
nightshift queue --move <id> [--before id | --after id]   # 在同目录队列里挪位置
nightshift unblock <id>                          # blocked → ready（只放这一条）
nightshift release <id>                          # 放行所有 reason 里写着 blocked by <id> 的项
```

`status` 的转移只发生在：`add→draft`、`draft→ready`（`ready` 动词）、`ready→draft`（`unready`）、`ready→blocked`（同目录前一条未通过）、`blocked→ready`（`unblock` / `release` / `review --drop`）、`run→running→{passed|needs-review|verify-error}`、`run→skipped`（git 前置失败）、归档时 `passed|needs-review|verify-error|skipped` 移出板。`draft` 永不被派发；窗口用尽未派发的 `ready` 留在板上等下一夜。、`needs-review|verify-error|running→passed`（`pass` 动词，人工判决）。`draft` 永不被派发；窗口用尽未派发的 `ready` 留在板上等下一夜。

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

- **队内顺序** = `order` 秩（同目录内 1,2,3…，缺 `order` 的按 `created` 排并一次性补齐）。`status` 只决定**是否被派发**，不改变位置：`draft` 不占派发位，但保留自己的秩，所以它变 `ready` 时回到原位。仍为 `draft` 的 Spec 不挡后面的 `ready`（未 ready = 未获授权）。
- **同 Serial Key 严格串行**：一个 dir 同时最多一条在跑；前一条 **passed 后**才派发同目录的下一条。
- **前一条不是 passed 就停止该目录队列**：`needs-review` / `verify-error` / `skipped` 都会把该目录**剩余未派发的 `ready`** 就地改成 `blocked`，`reason` 写 `blocked by <blocker-id> (<blocker-status>)`。避免在坏地基上继续盖楼。跨目录不受影响。
- **跨 Serial Key 并行**：受 `--jobs` 限制（默认 3）。
- **无 sleep 轮询**：用子进程 `exit` 事件驱动，队列空即退出。
- **窗口到点**：不再启动新任务；在跑的任务等其自然结束；未派发的保持 `ready` 留在板上。
- **窗口长度守卫**：`assertWindowSane` 在派发前检查 `deadline - startedAt <= maxWindowHours`。**默认 0 = 不限**；设成 >0 时超出直接抛错（防的是调度器补跑把 `--until 07:00` 从 8 小时变成 22 小时）。守卫放在核心而不是 shell 层，因为它与调度器无关。
- **窗口只管派发，不管在飞的任务**：窗口一到就不再派新活，在跑的任务照跑到底。所以 run 的结束时间是 `窗口关 + 单条最坏耗时`；派发日志会打出「窗口剩 X · 本条最晚 Y 结束」，报告里打出「实际结束 · 超窗 Z」。
- **两条超时独立**：`timeoutSec`（实现 Agent）与 `verifyTimeoutSec`（Verifier）分开配。两者都是「单条 Spec 的上界」，不是「整夜预算」——一条用满上界就意味着当夜跑不完后面几条，所以上界该按「最长的单条 Spec 要多久」设，而不是按窗口时长设。
- **超时不留悬念**：实现 Agent 超时时，`reason` 写 `implementation timed out after <n>s (<N> uncommitted path(s) left in the worktree)`。超时的典型后果是「工作区留了半成品」，这个数字决定人早上是「提交它」还是「回滚它」，不能只写一句超时。

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
   # 没有 -- <prompt>：prompt 从 stdin 送（见下）
```

`cwd` 由 spawn 的 `cwd: spec.dir` 提供 —— **pi 没有 `-C` 开关**（`-c` 是 `--continue`）。

四条已核实的事实决定了上面的形状（原文见 pi `docs/cli.md`；第 3 条是本地环境约束，已在真实 pi 上复现）：

1. **裸名字会替换整个工具集。** `--tools read,bash` 不是"加上这两个"，而是"只要这两个"。默认集是 `read,bash,edit,write`。因此这里**不给裸名字**，`spec.tools` 一律以 `+name` 形式追加。
2. **`-ne` 会连带关掉由扩展提供的工具。** `replace_match` / `insert` / `copy` / `move` / `undo_last_change` 来自 `pi-hashline-edit-pro`（`~/.pi/agent/settings.json` 的 packages），扩展一关就没了。Spec 需要它们时必须 `-e <path>` 显式加载，或改用内置的 `edit`（精确文本替换）。
3. **prompt 走 stdin，不走 argv。** pi 会把 piped stdin 前置到第一个 prompt（`docs/cli.md` 的 Input 表）。`runChild` 用 `stdio: ["pipe", "pipe", "pipe"]` 并通过 `child.stdin.end(prompt)` 一次性写入，子进程随后自己 EOF，不会挂起。
   这一条不是风格偏好，是**环境约束**：`argv` 超过约 990 字符时，企业端点安全软件会把这次 `spawn()` 直接 SIGKILL —— 零输出、零 stderr、`exitCode === null`，现场看起来和「pi 崩了」完全一样。真实 Spec 的 prompt 普遍 5KB+，走 argv 必死。stdin 路径不受该限制（5000/50000 字符实测正常）。

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
   # 没有 -- <prompt>：prompt 同样从 stdin 送
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

**infra 分类**：派发阶段的报错（502 / connection refused / SIGKILL 等）被归类为**基础设施故障**——它不是实现没写对，所以不消耗 `attempts`、当场重试（`MAX_INFRA_RETRIES = 2`），用尽后落 `verify-error` 且 `reason` 带 `[infra]` 前缀。我们自己预算内的超时不算 infra（那是实现跑太久）。

**`SELF-CHECK` 不入协议。** 实现者自检完全自主：CLI 不要求、不解析、不判定。上一版曾设计实现者输出 `SELF-CHECK:` 供 CLI 抓取，已被否决——判决只认 Verifier，多一个被抓取的自由文本字段只会制造第二个"看起来像权威"的信号。

**`REVIEW-HINT:` 同处理。** 它是给 Report 用的提示，抓不到就是没有，不影响 verdict，不影响重试。

## 8. Git 协议

| 时刻 | 动作 |
|---|---|
| 派发前 | `git -C dir rev-parse HEAD` → `baseline`；不是仓库/无提交则落 `skipped`，不派发。同时把基线钉在 `refs/nightshift/base/<id>`（非分支 ref，gc 不会剪掉，历史被改写后仍可查） |
| 执行中 | agent 在当前分支提交，不切不移 |
| 验证前 | `git merge-base --is-ancestor <baseline> HEAD` —— 不成立则说明历史被改写（rebase / pull --rebase / reset），**本轮判决作废**（落 `verify-error`），不跑 Verifier |
| 结束后 | 报告对比 `baseline..HEAD` 的提交数与 `git status --porcelain` 剩余项 |
| `review --drop` | `git reset --hard <baseline>`；`baseline` 为 null 时拒绝；**基线悬空时拒绝**（历史被改写，reset 会把分支甩到另一条历史上）；reset 前先把 HEAD 备份到 `refs/nightshift/backup/<id>` |

`git add -A` 的禁区由 prompt 纪律 + 报告里的 `git status` 剩余项共同兜底（漏 add 会显形在报告里）。

### 8.1 基线是会腐烂的引用

`baseline` 是一个裸 SHA，而**共享工作区里历史随时可能被改写**（`pull --rebase`、切分支、别的会话 rebase）。一旦它不再是 HEAD 的祖先，`baseline..HEAD` 就不再代表"本任务改了什么"——拿它去判只会得到假判决。

因此：

- 派发时把基线钉成 ref（`refs/nightshift/base/<id>`），保证对象不被 gc；
- 验证前查一次祖先关系，不成立就**作废本轮判决**并说清楚原因，而不是照判；
- 人要重跑时用 `rearm`：基线重锚到当前 HEAD，上一轮的理由作为 feedback 带给 Agent。

## 8.2 活性：怎么知道它活着还是成了僵尸

`status` 里写着 `running` 的 Spec 可能处在四种状态：

| 判定 | 含义 | 依据 |
|---|---|---|
| ● alive | 子进程在，最近有产出 | pid 活着 + 心跳是新的 |
| ◐ stalled | 子进程在，但很久没产出 | pid 活着，但心跳超过阈值（默认 15 分钟） |
| ☠ orphaned | **僵尸**：板上写着 running，但派发它的 run 已经不在了 | run.lock 里的 pid 已死（含僵尸进程） |
| ○ gone | 子进程已经不在了，run 稍后会接手 | pid 文件里的 pid 已死 |

**心跳有两个来源**，取两者中更新的那个（`status` 用 `(session)` 后缀标出后者）：

- `lastActivityAt`：pid 文件里的字段，子进程 stdout/stderr 每有输出就刷新；
- session jsonl 的 mtime：Agent 自己的会话文件落盘时间。

第二个来源不是可选的：`pi` 在 `-p --mode text` 下几乎不往 stdout 写东西，只落 session 文件。只看第一个，`lastActivityAt` 一旦写入就永不为空，降级路径不可达，一个正常干活的长思考 Agent 会在启动 N 分钟后被显示成"心跳很久没动"。

`verify` 阶段（`--no-session`）只看 pid 心跳：那时的 session 文件属于上一轮 impl，不代表 verifier 的进展——这正是当初把 mtime 降级成次选信号的原因。

`orphaned` 尤其重要：run 被 kill 后，Spec 会永远停在 `running` 没人管——今天就是这么发现的。收尸用 `rearm`，它对 `orphaned` / `gone` 直接放行，只在 `alive` / `stalled` 时拒绝并提示 `ns stop <id>`。

## 8.3 怎么给正在跑的 Agent 递话

无人值守的 Agent 没有别的输入通道：

- stdin 在启动时就用完了（piped stdin 只拼进**第一个** prompt）；
- steering / follow-up 队列只能走 **RPC 模式**（`--mode rpc`），而夜里跑的是 `-p --mode text`；
- 扩展被关了（`-ne`），所以连 xfer 这样的外部通道都没有。

**它能读到的只有仓库和 bash 输出。** 所以 `nudge` 就写进它读得到的地方：

- `nudge <id> <text>` 把文字追加到 `inbox/<id>.md`；
- 实现 Agent 的 prompt 里写明「每轮动手前先读一次这个文件（不存在就跳过）」；
- 于是下一轮工具调用时，交代就进对话了。

`rearm` 之后，Agent 下一轮会同时看到：新的基线、上一轮的验证理由、inbox 里的临时交代。

## 8.4 `review --drop` 的护栏

`git reset --hard <baseline>` 会丢掉 `baseline..HEAD` 里的**所有**提交——包括别的会话在同一工作区里产生的。所以：

1. `baseline` 不在 HEAD 的祖先链上 ⇒ **拒绝**（那不是"回滚本任务"，那是"把分支甩到另一条历史上"）；
2. reset 前把当前 HEAD 备份到 `refs/nightshift/backup/<id>`，丢掉的提交永远找得回来；
3. reset 前把将被丢弃的提交列出来。

## 8.5 `lint`：Spec 正文的静态自检

`check` 只看格式（五节齐全、非空）。`lint` 看**内容**，全是机械判断，不用模型：

| 检查 | 报什么 |
|---|---|
| `missing-path` | Change / Verify 点名的路径在仓库里找不到（路径漂移、改名、写错） |
| `stale-sha` | 正文里的 SHA 已经不在历史里（典型：rebase 之后的旧 SHA） |
| `unverifiable` | Verify 里有「跑测试」「没有报错」这种不可判定的措辞 |
| `empty-out-of-scope` | Out of scope 是空的 |
| `constraint-conflict` | Constraints 说「不许动 X」，Verify 说「不得引用 X」，而 Change 里没有 X 的替代品 |

最后一条是**能机械判的那一类**。语义层的错（"Verify 的口径比 Change 严"——比如要求"V2 链不引用任何 V1 runtime 模块"，但泄漏发生在共用领域服务里）lint 判不了，那要靠闭包分析脚本（仓库里的 `.pi/track/closure.mjs`）或人眼。

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
   → nightshift pass ns-0008         # 人工判通过（不回滚提交）
🟡 ns-0009 dotfiles verify-error
   verdict: verify-error — verifier produced no VERDICT line (exit 1)
⛔ ns-0011 dotfiles blocked
   queue stopped: ns-0009 verify-error — 同目录后续 Spec 停在板上，处理完这条后再跑
⏸ ns-0010 other ready
   （未派发：窗口用尽，仍在板上）
```

`blocked` 条目独立计数（标题行的「队列停止 N」），并在条目下显式标出停在哪一条。纯文本、无 UI、可重定向。`--date` 从 archive 读。

## 10. 单实例锁

`~/.cache/nightshift/run.lock` 写 `{pid, startedAt, runId}`。启动时若文件存在：读 pid，存活则拒绝并打印；不存活则视为陈旧锁，**自动接管**并打一行 `stale lock from pid N (...), taking over`。

"存活"不能只靠 `kill(pid, 0)`：它对**僵尸**（已退出、父进程还没 wait）也返回成功，而僵尸恰恰是"supervisor 被杀但父进程还在"的常见形态（agent 的 bash tool、CI 包装层杀掉进程组却不回收）。所以存活之后还要看 `ps -o state=` 是不是 `Z`。把僵尸当活着，锁就永远解不开，报错还会把用户指向一个不存在的进程。

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

Phase 0–4 已完成（61 个测试全绿，`just test-nightshift`）。

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
  ✅ Q. 手写 1 条真实 Spec → `nightshift run --until +5m` → Report 可信
  ✅ R. 按 Q 的结果回调：暴露了 argv 长度限制（见 §5 第 3 条），prompt 改走 stdin

已用 `test/fake-pi.mjs` 零成本验证过的路径：全绿通过、fail 后重试至 needs-review、
缺失 VERDICT 落 verify-error 且不重试、跨目录并行、同目录串行队列按 order 秩排空、
历史被改写时判决作废（不照判错范围）、基线悬空时 review --drop 拒绝且留备份 ref、
rearm 把归档件搬回 ready 并把上一轮理由当 feedback 喂给 Agent、
同目录前一条 fail/verify-error/skipped 后队列停止并能被 release 重新武装、
prompt 只走 stdin 且 argv 保持短、子进程被信号杀死时 reason 里带信号名、draft 不派发、
单实例锁拒绝、超长窗口拒绝、归档搬迁。

2026-10-21 已在真实 pi 上跑通一条最小 Spec（impl 提交 → Verifier 真验证 → pass → 归档）。
走 argv 的版本在同一天集体失败，原因见 §5 第 3 条。

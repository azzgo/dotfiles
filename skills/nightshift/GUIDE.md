# Nightshift 使用说明

面向人的操作手册。方法论在 `SKILL.md`，schema 与动词在 `CONVENTION.md`，实现细节在 `DESIGN.md`。

## 0. 安装

```sh
just install-skills       # ① 把 skills/nightshift/ 链到 ~/.agents/skills/nightshift
just install-nightshift   # ② 把两个 wrapper 链到 ~/.local/bin
```

两步分工：`install-skills` 让 CLI **能被找到**（wrapper 内部按 `~/.agents/skills/nightshift/cli/main.ts` 定位），`install-nightshift` 让命令 **在 PATH 上**。顺序反了也能装，只是第一次调用会报"CLI not found"并告诉你跑哪条命令。

装完得到两个命令：

| 命令 | 作用 |
|---|---|
| `nightshift` | 所有动词（`add` / `ready` / `run` / `report` / …） |
| `nightshift-keep-awake` | `nightshift run` 外面套一层"别让系统睡眠"，按平台自动选择 |

pi 侧的斜杠命令 `/nightshift` 无需额外安装：`pi/agent/prompts/` 整个目录由 `just install-pi` 链入，`nightshift.md` 已在其内。

验证：

```sh
nightshift path
nightshift list
```

首次运行会自动创建 `~/.cache/nightshift/{board,archive,runs,sessions}`。

### wrapper 里为什么要处理 node

`pi` 自己的启动器是 `#!/usr/bin/env node`，nightshift 的 wrapper 也一样需要 node。它按顺序找：`$NIGHTSHIFT_NODE` → `~/.local/share/mise/shims/node` → `command -v node`。所以即使在你没有 PATH 的调度环境里（launchd / systemd / cron 经常是裸环境），只要 mise shim 存在就能跑；实在不行 `export NIGHTSHIFT_NODE=/path/to/node`。

## 1. 一分钟走完一遍

```sh
# ① 写一条 Spec（正文从 stdin 读）
nightshift add --dir /Users/you/dev/some-repo --title "加一个 --dry-run 开关" <<'SPEC'
## Goal
`mytool export` 支持 `--dry-run`：打印将要写入的路径，不落盘。

## Change
新增 CLI flag `--dry-run`；在 internal/export 里加 dryRun 分支，复用现有路径计算。

## Constraints
不要动 internal/cache；不要改 go.mod。

## Verify
`mytool export --dry-run` 在临时目录下运行后，目录仍为空且 stdout 含目标路径；
`mytool export` 不带 flag 时行为与现在完全一致（跑一遍既有测试确认）。

## Out of scope
不改 `import` 子命令；不加配置文件支持。
SPEC

# ② 确认正文没问题（可选）
nightshift check
nightshift show ns-0001

# ③ 升级为 ready —— 唯一的"可以交给夜里"动作
nightshift ready ns-0001
```

夜里（或现在就想试）：

```sh
nightshift run --until 07:00
```

第二天早上：

```sh
nightshift report
```

## 2. 命令速查

| 我想…… | 命令 |
|---|---|
| 记下一条已经谈定的事 | `nightshift add --dir <abs> [--title T]`，正文走 stdin |
| 把新任务插到队列最前面 | `nightshift add --dir <abs> --before ns-0007`，正文走 stdin |
| 调整某条在队列里的位置 | `nightshift queue --move ns-0008 --before ns-0007` |
| 看看板上有什么 | `nightshift list` / `nightshift list --all` / `nightshift list --status ready` |
| 看一条的详情 | `nightshift show ns-0007` |
| 校验全板格式 | `nightshift check` |
| 看看某条 Spec 写得好不好 | `nightshift lint ns-0007`（路径漂移 / 旧 SHA / 不可判定措辞） |
| 标成"可以夜里跑" | `nightshift ready ns-0007` |
| 撤回，先不跑 | `nightshift unready ns-0007` |
| 跑一夜 | `nightshift run [--until 07:00] [--jobs 3]` |
| 早上看结果 | `nightshift report` |
| 看历史某天 | `nightshift report --date 2026-10-19` |
| 列出所有归档日期 | `nightshift report --list-dates` |
| 丢弃某条的提交（并放行同目录后续） | `nightshift review ns-0007 --drop` |
| 某条判错了，想换个基线重跑 | `nightshift rearm ns-0007`（基线重锚到当前 HEAD，上一轮理由会带上；`☠ 僵尸` 也接受，直接收尸） |
| 某条其实做完了，人工判通过 | `nightshift pass ns-0007 [--reason "看过 diff，做完了"]`（不回滚提交，顺带放行被挡住的下一条） |
| 夜里的任务现在什么状态 | `nightshift status`（● 活着 / ◐ 很久没动静 / ☠ 成了僵尸） |
| 看它此刻在干什么 | `nightshift tail ns-0007`（`-f` 跟着刷） |
| 给正在跑的任务递句话 | `nightshift nudge ns-0007 "基线变了，从 abc123 继续"` |
| 不想让它继续跑了 | `nightshift stop ns-0007`（`--all` 连整个 run 一起停） |
| 看同目录串行队列 | `nightshift queue [--dir /abs/path]`（左边那个数字就是队列位次）|
| 放行被某条挡住的下一条 | `nightshift release ns-0007` |
| 只放行某一条 blocked | `nightshift unblock ns-0008` |
| 锁卡住了 | 先直接 `nightshift run`：陈旧锁（持有进程已死，含僵尸）会自动接管。仍拒绝时 `nightshift unlock` |
| 目录都建在哪 | `nightshift path` |

## 3. 五节怎么填（唯一真正要学的东西）

```md
## Goal          做完之后什么东西存在或改变了（结果，不是动作）
## Change        改什么，能点名文件/函数/签名就点名
## Constraints   不许碰什么
## Verify        怎样才算通过 —— 交给一个独立的只读验证 Agent 判断
## Out of scope  明确不做什么
```

三节在 `ready` 时不允许为空：`Goal`、`Change`、`Verify`。

**`Verify` 是最有价值的一段。** 它不是命令，是标准。夜里没人判断"做完了吗"，只有这一段能让判决变成权威而不是 agent 自述。

反面示例：

| 写法 | 为什么不行 |
|---|---|
| `Verify: 跑测试` | 测试可能压根不覆盖这次改动，verdict 变成噪音 |
| `Verify: 代码质量良好` | 不可判定 |
| `Verify: 实现正确` | 同义反复 |
| `Verify: go test ./...` | 命令本身没问题，但没说"哪些行为必须为真"；验证者会只看绿/红 |

正面示例：

> `--dry-run` 在空临时目录中运行后目录仍为空，且 stdout 含每个目标路径；不带 flag 时既有测试全绿且行为不变。

## 4. 工作目录与串行

- `--dir` 必须是**绝对路径**，会规范成 realpath。
- **同一个目录可以挂多条未完成的 Spec**。它们构成一条**串行队列**：一次只跑一条，前一条 `passed` 后才派下一条。`add` 不再拒绝第二条，只会提示队列里有几条在前。
- 队列顺序 = `created` 时间序（先 `add` 先跑，同刻按 id）。想让 B 排在 A 后面，按顺序 `add` 即可，不必等 A 跑完。
- **前一条没过（`needs-review` / `verify-error` / `skipped`）就停下整个目录队列**：同目录剩余未派发的 `ready` 会变成 `blocked`，`reason` 写明被谁挡住。这样不会在坏地基上继续盖楼。
- 处理完阻塞项后：`ns release <阻挡者 id>` 放行同目录后续，`ns pass <阻挡者 id>` 判它通过并放行，或 `ns review <阻挡者 id> --drop` 回滚并放行。`ns queue [--dir P]` 查看队列与阻塞来源。
- `draft` 不占队列位置：只有 `ready` 会进队列。
- 不同目录**可以并行**（受 `--jobs` 限制，默认 3）。串行键是**工作目录**，不是 git 仓库；同一个 repo 开两个 worktree = 两条独立队列。
- 需要真正的内容并行？先开 worktree，再给每个 worktree 各写一条 Spec。

## 5. 配置

`~/.pi/agent/nightshift/config.json`（可选，全部有缺省）：

```json
{
  "defaultModel": "sonnet:high",   // 缺省不使用，继承 pi 当前默认
  "verifyModel": null,             // 验证用更强的模型？填这里（避免自己判自己）
  "verifyThinking": null,          // 缺省 off
  "jobs": 3,                       // 跨目录并发上限
  "window": "07:00",               // 截止时间；也接受 "+45s" / "+30m" / "+2h"
  "piBin": "pi",
  "timeoutSec": 3600,              // 单条实现超时
  "maxWindowHours": 0              // 窗口上限；0 = 不限（默认），见下
}
```

时间窗口语义：`07:00` 表示"今天 07:00 或明天 07:00（若已过）"，到点后不再派发新任务，在跑的任务等它自然结束。`+30m` 表示从现在起 30 分钟。

### 窗口管什么，不管什么

**窗口只管"还能不能派新活"**，不管在跑的任务：到点就不再派新活，已经在跑的照跑到底（不砍）。所以：

- 派发时那行日志会告诉你这条要跑多久：`ns-0010 dispatch (baseline db58ec4, 窗口剩 2h19m, 本条最晚 01:41 结束)`
- 报告里会写实际几点结束、超窗多久（窗口一律本地时间）
- `nightshift status` 里也有一列「最晚」

### `maxWindowHours` 守护的是什么

`07:00` 这个写法在夜里启动时是 8 小时窗口，但如果调度器在**上午 9 点**才把它补跑起来（launchd 睡眠后补偿、cron 补跑、你手动重放），`07:00` 会被解析成"明天早上"，变成 **22 小时**窗口——整台机器被占一天。

所以如果你要这道保险，把 `maxWindowHours` 设成 >0（**默认 0 = 不限**），`run` 会在派发任何东西之前先算窗口长度，超了直接拒绝，板子一个字节都不动：

```
error: window would run 22.0h, over maxWindowHours=14. A scheduler that fires at the
wrong time ... would otherwise start a day-long run. Refusing; check how you are
invoking this. 要放开：在 ~/.pi/agent/nightshift/config.json 里设 "maxWindowHours": 0
```

这条守卫是**平台无关**的——它不关心你用什么调度器，只关心"这次到底要跑多久"。所以下面不需要任何 shell 层的时间闸门。

## 6. 夜里怎么挂

`run` 的行为是"排空队列或窗口用尽即退出"，因此对任何调度机制都成立。**仓库本身不安装、不管理任何定时器产物**（没有 plist、没有 crontab、没有 timer 单元），你用自己的机制指向这两个命令之一：

```sh
# ① 想防止系统在跑的时候睡眠（跨平台自动选择）
nightshift-keep-awake --until 07:00

# ② 不在乎睡眠，或系统本来就不睡
nightshift run --until 07:00
```

`nightshift-keep-awake` 按平台自动选睡醒抑制手段：

| 平台 | 手段 |
|---|---|
| macOS | `caffeinate -i`（只挡空闲睡眠，显示器仍可睡） |
| Linux | `systemd-inhibit --what=sleep:idle --mode=block`（有则用） |
| 其它 | 不加抑制，直接 `run`，交给系统电源策略 |

你自己的调度器长什么样都行：

```sh
# 前台 / tmux / herdr
nightshift-keep-awake --until 07:00

# systemd timer（Linux）
ExecStart=%h/.local/bin/nightshift-keep-awake --until 07:00

# launchd（macOS）
#   ProgramArguments: /Users/you/.local/bin/nightshift-keep-awake, --until, 07:00
#   别忘了在 EnvironmentVariables 里给 PATH（调度环境通常是裸 PATH）

# 定时任务只在夜里接受工作，白天启动会被 maxWindowHours 拒绝（不会误跑一天）
# 因此调度频次可以放宽：跑几次、错过几次都无所谓，队列空就秒退
```

**单实例锁**：同一时刻只允许一个 `run`。第二个启动会立刻拒绝并打印现有实例的 pid 与 run id。陈旧锁（持有进程已死，**包括还没被回收的僵尸进程**）会被自动接管，并打一行 `stale lock from pid N (...), taking over`；实在卡住用 `nightshift unlock`。

**调度环境的两个坑**（这不是 nightshift 的问题，但会咬你）：

1. **PATH 是裸的**。launchd / systemd / cron 通常没有你 shell 里的 PATH。给它们配 `PATH=~/.local/share/mise/shims:~/.local/bin:/usr/bin:/bin`，或者直接在 `ProgramArguments` 里写绝对路径。
2. **模型端点可能依赖 GUI 会话**。如果你的 provider 走的是本地服务或需要登录态的客户端，夜里必须保持同一用户登录；机器锁屏没事，注销/切用户会断。

## 7. 早上怎么看

`nightshift report` 就是给你排好序的检查清单：

```text
Nightshift 2026-10-19  窗口 23:10–07:00  派发 5 / 通过 3 / 需看 2 / 队列停止 1
────────────────────────────────────────────────────────────────
✅ ns-0007  dotfiles  3 commits  passed
   verdict: pass — 只改了 cli/，未触及 justfile
   hint: 重点看 run.ts 的窗口判断
   → git -C /Users/ison/dev/dotfiles log --oneline 275dd85..HEAD
⚠️ ns-0008  dotfiles  2 commits  needs-review
   verdict: fail — 缺少空队列路径的测试
   → nightshift show ns-0008
   → nightshift release ns-0008    # 放行同目录被挡住的下一条
   → nightshift pass ns-0008         # 人工判通过（不回滚提交）
🟡 ns-0009  api   verify-error
   verdict: verify-error — verifier produced no VERDICT line (exit 1)
⛔ ns-0011  dotfiles  blocked
   queue stopped: ns-0009 verify-error — 同目录后续 Spec 停在板上，处理完这条后再跑
⏸ ns-0010  /Users/ison/dev/other  ready
   （未派发：窗口用尽，仍在板上）
```

图标含义：

| 图标 | 状态 | 意思 | 你该做什么 |
|---|---|---|---|
| ✅ | `passed` | 验证通过 | 看 diff，满意就合并/推进 |
| ⚠️ | `needs-review` | 两次实现后仍 `fail` | 看 `reason`，要么重写 Spec，要么手工收尾 |
| 🟡 | `verify-error` | 验证本身没跑完 | 流程问题，不是代码问题；`show` 看原因后重跑。理由带 `[infra]` 的是基础设施故障（网关 502 / 连接被拒），不消耗尝试次数，`rearm` 重跑即可 |
| ⏭️ | `skipped` | git 前置失败（非仓库/无提交） | 修环境后重上板 |
| ⛔ | `blocked` | 同目录前一条没过，队列被停下 | 处理完阻挡者后 `release` 或 `review --drop` |
| ⏸ | `ready` | 窗口用尽，没轮到 | 下一夜会自动继续 |
| ✏️ | `draft` | 还没标 ready | 补正文后 `ready` |

### 结果怎么看

成果靠 **baseline sha** 定位，不靠分支名——脚本不切分支、不推送：

```sh
git -C /Users/ison/dev/dotfiles log  --oneline 275dd85..HEAD   # 它做了哪几个提交
git -C /Users/ison/dev/dotfiles diff 275dd85..HEAD             # 具体改了什么
```

不满意就一键丢弃（回到派发前）：

```sh
nightshift review ns-0008 --drop
```

想听它当时怎么想的：

```sh
pi -r --session-dir ~/.cache/nightshift/sessions/ns-0008
```

## 8. 归档

- run 结束时，**所有处理过的 Spec 一律归档**到 `~/.cache/nightshift/archive/<日期>/`，包括失败的。
- 理由：失败项若留在板上，第二夜会被自动重跑——这是无人察觉的烧钱循环。
- 板上只留：`draft`、`ready`（窗口用尽没轮到）。
- 归档目录里同时有 `report.txt`（该夜的检查面快照）。

## 9. 常见问题

**Q: 我改了正文，需要重新 ready 吗？**
不需要。正文随时可改（这不是元数据）。但如果 Spec 已经跑过、归档了，就要新开一条。

**Q: 同目录的第二条 Spec 会被拒绝吗？**
不会。同目录的 Spec 排成一条串行队列（按 `created`），夜里一条一条跑。`add` 只会提示前面还有几条。

**Q: 同目录前一条挂了，后面还会跑吗？**
不会。前一条落 `needs-review` / `verify-error` / `skipped` 时，该目录剩余的 `ready` 全部变成 `blocked` 留在板上。处理完那条后用 `nightshift release <id>` 放行（或用 `review <id> --drop` 回滚并放行）。跨目录不受影响。

**Q: 可以手改 frontmatter 吗？**
不要。元数据归 CLI，未知 key 会直接报错（wayfinder 踩过这个坑：一个手写 key 静默抹掉了整张依赖图）。要改文件属性用命令。

**Q: `needs-review` 会自动重试吗？**
不会。已经归档。重试只有当夜那一次（`fail` 后带 `REASON` 重派一次）。要再来一遍就新开一条 Spec，把失败原因写进 `Change`。

**Q: 机器判错了，但我确认这事做完了怎么办？**
`nightshift pass ns-0007`——它把判决翻成 `passed`、写明理由、并放行被它挡住的同目录队列。提交原样保留（它不 reset 任何东西）；确实想丢弃那些提交再用 `nightshift review ns-0007 --drop`。

**Q: 夜里 Agent 能不能自己再派子 agent？**
不能。实现 Agent 用 `-ne` 启动——不发现任何扩展，`dispatch` 工具根本不存在。Spec 里写 `extensions:` 想加回 `sub-dispatch` 会被直接拒绝。

**Q: 它会不会顺手把我没提交的改动一起 commit？**
协议禁止 `git add -A`，只加它自己改过的路径。报告里会显示 `residual`（剩余未提交路径数），漏了会显形。

**Q: 为什么不推送、不开 PR？**
合并是你的动作。脚本只负责把该看的东西按最省力的顺序摆出来，和一条可以随时丢弃的提交链。

**Q: 我能在白天跑吗？**
能。`nightshift run --until +5m` 就用 5 分钟窗口试一遍。用 `piBin` 指向假脚本可以零成本验证整个调度循环（见 `cli/test/fake-pi.mjs`）。

## 10. 开发与测试

```sh
just test-nightshift       # 61 个测试，全部不需要真调模型
```

`test/fake-pi.mjs` 按环境变量返回预设 verdict（`FAKE_VERDICT` / `FAKE_REASON` / `FAKE_NO_VERDICT`），因此调度器、重试、归档、锁都能零 token 验证。

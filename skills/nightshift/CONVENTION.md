# Nightshift Convention

机器可读约定：目录、schema、命令动词、状态机。方法论在 `SKILL.md`，实现细节在 `DESIGN.md`。

安装（两步，由 `just` 管理）：

```sh
just install-skills       # skills/nightshift/ → ~/.agents/skills/nightshift
just install-nightshift   # scripts/{nightshift,nightshift-keep-awake} → ~/.local/bin
```

装完直接调：

```sh
nightshift <verb> [args]
nightshift-keep-awake [run args]     # = 平台相关的睡醒抑制 + nightshift run
```

不安装也能按路径调用：`node <repo>/skills/nightshift/cli/main.ts <verb> [args]`。

运行时目录由 `NIGHTSHIFT_HOME` 覆盖，缺省 `~/.cache/nightshift`。
node 查找顺序：`$NIGHTSHIFT_NODE` → `~/.local/share/mise/shims/node` → `PATH` 上的 `node`。

## 目录

```text
~/.cache/nightshift/
├── board/<id>.md              # 未结束的 Spec（draft/ready/running）
├── archive/<YYYY-MM-DD>/
│   ├── <id>.md                # 已结束的 Spec（含 verdict 元数据）
│   └── report.txt             # 该夜 Report 快照
├── runs/<run-id>/run.json     # 每次 Run 的派发记录
├── sessions/<id>/             # pi --session-dir，早上可 pi -r 回看
└── run.lock                   # 单实例锁
```

配置：`~/.pi/agent/nightshift/config.json`

```json
{
  "defaultModel": "sonnet:high",
  "verifyModel": null,
  "verifyThinking": null,
  "jobs": 3,
  "window": "07:00",
  "piBin": "pi",
  "timeoutSec": 3600,
  "maxWindowHours": 14
}
```

全部可省略。`window` 既接受 `HH:MM`（今天或明天的此刻）也接受 `+30m` / `+2h`。

`maxWindowHours` 是 `run` 的前置守卫：算出的窗口长度超过它就直接拒绝启动，不碰板子、不派发。作用是在调度器补跑（launchd 睡眠补偿、cron 补跑、手动重放）把 `--until 07:00` 从"今晚 8 小时"变成"明天早上 22 小时"时兜底。

## Spec schema

frontmatter **只由 CLI 写**。手改任何元数据都会被 `parseSpec` 当成错误（未知 key 直接报错，这是 ADR 0016 踩过的坑）。

```yaml
---
id: ns-0007
status: draft | ready | running | passed | needs-review | verify-error | skipped
dir: /absolute/workspace/path
title: "一行标题"
created: 2026-10-19T14:02:11.000Z
model: "sonnet:high"        # 可 null
thinking: "off"             # 可 null
tools: ["+codemode"]        # 可空列表
extensions: []              # 可空列表；含 sub-dispatch 的会被拒绝
baseline: "275dd85..."      # CLI 派发前写入，可 null
attempts: 0                 # CLI 写
verdict: "pass"             # pass|fail|verify-error|null
reason: "一行理由"           # Verifier 的 REASON
commits: 3                  # 结束后 CLI 写
residual: 0                 # 结束后未提交路径数
hint: "重点看 cli/"          # 实现者的 REVIEW-HINT
finished: 2026-10-20T06:11:02.000Z
run: "20261019-231000"
---
```

正文五节，顺序固定，缺节即错：

```md
## Goal
## Change
## Constraints
## Verify
## Out of scope
```

`status` 为 `draft` 或 `ready` 时，`Goal`、`Change`、`Verify` 三节不得为空。

## 状态机

```
add ──→ draft ──ready──→ ready ──run──→ running ──┬─→ passed        （归档）
          │                                       ├─→ needs-review  （归档，attempts=2）
          └─unready←──ready                     ├─→ verify-error  （归档，不重试）
                                                  └─→ skipped       （归档，git 前置失败）

归档时：passed / needs-review / verify-error / skipped 全部移出 board。
未派发的 ready（窗口用尽）留在 board 上。
draft 永不被派发。
```

## 动词

| 动词 | 作用 | 动盘 |
|---|---|---|
| `add --dir P [--title T] [--model M] [--thinking L] [--tools a,b] [--extensions p]` | 从 stdin 读正文，新建 `draft` | 板 |
| `list [--status S] [--all]` | 一行一条 | 只读 |
| `show <id>` | 详情 + 下一步命令 | 只读 |
| `ready <id>` | `draft → ready`，先跑校验 | 板 |
| `unready <id>` | `ready → draft` | 板 |
| `check` | 全板 schema 校验 | 只读 |
| `run [--until HH:MM\|+30m] [--jobs N]` | 夜间排水 | 板 + git（commit 由 agent 做） |
| `report [--date YYYY-MM-DD] [--list-dates]` | 检查面 | 只读 |
| `review <id> [--drop]` | 详情；`--drop` 才 `git reset --hard <baseline>` | 仅 `--drop` |
| `path` | 打印三个目录 | 只读 |
| `unlock` | 清掉陈旧锁 | 锁 |

环境变量覆盖（测试与临时调整用）：`NIGHTSHIFT_HOME`、`NIGHTSHIFT_PI_BIN`、`NIGHTSHIFT_MODEL`、`NIGHTSHIFT_JOBS`；wrapper 另认 `NIGHTSHIFT_NODE`、`NIGHTSHIFT_SKILL_HOME`、`NIGHTSHIFT_BIN`。

## 调度

仓库**不安装也不管理任何定时器产物**——没有 plist、crontab、systemd timer 单元。`run` 的契约是"排空队列或窗口用尽即退出"，交给外部调度：

- 想防睡眠：`nightshift-keep-awake`（Darwin → `caffeinate -i`；Linux → `systemd-inhibit`；其它 → 直接跑）
- 不要写 `while :; do ...; sleep 1800; done`——那需要常驻会话，且重启不恢复
- 调度环境通常是裸 `PATH`，需要显式配 `PATH` 或在 `ProgramArguments` 里写绝对路径

## 派发契约

实现 Agent：

```sh
pi -p --mode text -ne --no-mcp -ns \
   --session-dir <base>/sessions/<id> --name nightshift-<id> \
   --thinking <off> [--model M] -a [--tools +x,+y] [-e <ext>] \
   -- "<实现 prompt>"
```

- `-ne` 不发现任何扩展（`dispatch` 因此不存在，夜里不可能递归派发）
- 默认工具面是 pi 的内置集 `read,bash,edit,write`；`tools:` 只以 `+name` 形式追加
- Git 纪律写在 prompt 里：只 `git add` 自己改过的路径、在当前分支 commit、不 push/不 switch/不 stash/不 reset

验证 Agent：

```sh
pi -p --mode text -ne --no-mcp -ns --no-session \
   --thinking <off> [--model M] -a \
   --tools read,bash,grep,find,ls \
   -- "<verify prompt>"
```

只读工具集，无法修改代码。必须输出：

```
VERDICT: pass | fail
REASON: <一行>
```

解析规则：取 stdout 中**最后一条**行首（允许缩进）的 `VERDICT:`；没有则 `verify-error`（流程故障，不重试）。退出码不参与判决。

## 重试

`fail` 且 `attempts < 2` → 带 `REASON` 重派一次。第二次仍 `fail` → `needs-review`。
`verify-error` 与 `skipped` 不重试。

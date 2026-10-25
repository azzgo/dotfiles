---
name: nightshift
description: Turn a clarified discussion into a Spec on the nightshift board so a headless CLI can execute it overnight, then check the results the next morning. Use when the user wants to queue work for unattended execution, says "写进看板 / 挂到夜班 / 我明天看", or asks what to do with decisions that are already settled.
disable-model-invocation: true
---

# Nightshift

Nightshift is a **queue**, not a workflow. You spend the白天把已经谈定的事写成 Spec 挂到一块全局板上；夜里 `nightshift run` 逐条派发 `pi -p` 子进程去执行，各自验证、回写状态、归档；第二天早上 `nightshift report` 摊开来看。

Daytime (this skill) 只做一件事：**把已经谈定的事写成一条能独立执行的 Spec**。它不执行、不驱动、不判断成败。

- 板子、目录、schema 的机器可读约定在 `CONVENTION.md`（唯一事实来源）
- 实现细节在 `DESIGN.md`
- 术语与决策理由见仓库 `CONTEXT.md` 的 *Nightshift* 一节与 `docs/adr/0017-nightshift-is-a-script-not-an-extension.md`

CLI 由 `just install-skills` + `just install-nightshift` 装到 PATH 上：

```sh
nightshift <verb> [args]
```

未安装时可按路径调用：`node <repo>/skills/nightshift/cli/main.ts <verb> [args]`。下文用 `ns` 代表它。

## 白天的工作流

```
讨论 / grilling
   ↓  用户认可"这事定了"
ns add --dir <绝对路径>            ← 正文从 stdin 读；id 自动分配，状态 draft
   ↓  补五节正文（下方模板）
ns check                            ← 可选，自检
   ↓  确认可以交给无人值守
ns ready ns-0007                    ← 唯一的状态升级；只有 ready 会被夜里排水
```

**默认从 draft 开始，不替用户决定 ready。** 一条 Spec 是不是"定了"，由用户说，不由你推断。

## Spec 正文模板

五节全部必填（`Goal` / `Change` / `Constraints` / `Verify` / `Out of scope`）。`Goal`、`Change`、`Verify` 在 `ready` 时不允许为空。

```md
## Goal
一句话：做完之后什么东西存在或改变了。

## Change
要改什么。能点名文件、函数、接口签名就点名——夜里没人能追问。

## Constraints
不许碰的东西：其它模块、生成文件、依赖、提交纪律之外的动作。

## Verify
验收标准。写"怎样才算通过"，不是"跑什么命令"——
这一段会整段交给一个独立的只读验证 Agent，它自己决定怎么核实。

## Out of scope
明确不做的事。没有就写"无"，但不要留空。
```

### 每一节最容易漏写的东西

| 节 | 常见漏写 | 后果 |
|---|---|---|
| `Goal` | 写成"重构 X"（动作）而非"Y 变成 Z"（结果） | 验证者无从判断边界 |
| `Change` | 只说"支持配置"却不给字段名 | Agent 自创一套，早上要重写 |
| `Constraints` | 忘了说"不要动 justfile / 锁文件 / 生成代码" | 夜里顺手把你的改动卷进提交 |
| `Verify` | 写成"跑测试" | 测试本来就不覆盖这块，verdict 变成噪音 |
| `Out of scope` | 留空 | Agent 顺手做掉一半相关重构，diff 变巨大 |

**`Verify` 是这条流水线上最重要的一段。** 它是唯一权威判决的输入。写不出可判定的验收标准，就说明这事还没到能上板的程度。

## 什么时候不该上板

明确拒绝，并说明原因：

- **还有人要答的问题**——那是 Wayfinder 的 Ticket，不是 Spec。Spec 只装已经定下来的事。
- **需要人在场观察或反复调参的活**（调 UI 观感、试配色、跑交互式调试）。
- **同一条 Spec 里塞了多个彼此独立的改动**——切成多条；夜里一条失败不会拖累另一条。
- **跨多个工作目录的改动**——一条 Spec 只有一个 `dir`；拆开。
- **既要「把东西铺开」又要「把东西修绿」的活**——分成两条。复制/迁移会天然带着旧代码的债（硬编码文案、旧组件、算错的相对路径），门禁必然拦；把铺开和修绿塞进一条，Agent 会在两头拉扯，最后两边都做不好。典型：复制一整套模块到新目录 ⇒ 一条「铺开并标来源」，一条「修类型/换组件/本地化到门禁全绿」。
- **没有任何可判定结果的探索性任务**——`Verify` 会退化成"看起来不错"，等于没有判决。
- **spec 的内容需要用户口头授权才能做**（生产环境、删除数据、推送远端）。

## 工作目录与串行

`--dir` 必须是绝对路径。**同一个目录可以挂多条 Spec**，它们构成一条**串行队列**：夜里严格一次只跑一条，前一条 `passed` 之后才派发下一条。

队列有三个必须知道的性质：

1. **顺序 = `created` 时间序**（先 `add` 先跑，同刻按 id）。想让 B 在 A 之后，就按 A → B 的顺序 `add`，不用等 A 跑完再提交 B。
2. **前一条没过就停下整个目录队列**。前一条落 `needs-review` / `verify-error` / `skipped` 时，该目录剩余未派发的 `ready` 会被就地改成 `blocked`（`reason: blocked by <id> (<status>)`），避免在坏地基上继续盖楼。跨目录并行不受影响。
3. **`draft` 不占队列位置**。只有 `ready` 才会进队列；同目录一条 `draft` 不会挡住后面的 `ready`。

早上处理完阻塞项后，用 `ns release <阻挡者 id>` 一次放行同目录后续，`ns pass <阻挡者 id>` 判它通过并放行，或 `ns review <阻挡者 id> --drop` 回滚它的提交并放行。`ns queue [--dir P]` 看当前队列与阻塞来源。

同一仓库的多个 git worktree 是**不同目录**，因此是**不同的队列**——这才是真正的内容并行手段。不要为了凑并行去改 Spec 的 `dir`。

## 可选字段

只在用户明确要求、或该目录确实需要时使用：

```sh
ns add --dir /abs/path \
   --title "标题" \
   --model sonnet:high \        # 覆盖 config.defaultModel
   --thinking high \            # 缺省 off
   --tools codemode \           # 追加到默认工具面（自动加 +）
   --extensions /abs/plugin.ts  # 显式加载扩展；含 sub-dispatch 的请求会被拒绝
```

不要在没被要求时预设 `--model`：缺省继承全局配置，是最不容易出错的形态。

## 夜里与早上（不做，只告诉用户怎么做）

```sh
ns run --until 07:00            # 夜间排水；队列空或窗口尽即退出，可反复由 cron 调用
ns report                       # 早上第一眼看这个
ns status                       # 夜里瞄一眼：哪些活着 / 卡住 / 成了僵尸
ns show ns-0007                 # 单条详情 + 下一步命令
ns rearm ns-0007                # 换个基线重跑：基线重锚当前 HEAD，上一轮理由会带上；僵尸 running 也接受
ns pass ns-0007 --reason "看过 diff，做完了"   # 人工判通过：不回滚提交，放行被挡住的下一条
ns nudge ns-0007 "基线变了"      # 给正在跑的那条递句话（它下轮动手前会读到）
ns stop ns-0007                 # 不想让它跑下去了
ns review ns-0007 --drop        # 丢弃该条提交，回到 baseline
```

- 失败项**也会归档**，不会留在板上被第二夜自动重跑。
- 早上人工看过 diff、确认某条其实做完了，用 `ns pass <id>` 把它判为通过——它**不回滚提交**，只翻案判决并放行被挡住的队列。想丢弃提交仍然是 `ns review <id> --drop`。
- 报告里带 `[infra]` 的 `verify-error` 是**基础设施故障**（网关 502 / 连接被拒 / 进程被打死），不是代码问题：它不消耗尝试次数，`ns rearm <id>` 重跑即可。
- 同目录队列被前一条阻塞时，后续项**留在板上但不跑**（`blocked`），需要 `ns release` / `ns review --drop` 手动放行——不会自动重试。
- 结果靠 `baseline..HEAD` 看，脚本不切分支、不推送、不合并。清理用 `review --drop`。
- ⚠️ **共享工作区里历史被改写会让判决不可信**（`pull --rebase` / 别的会话 rebase）。`run` 会查基线是否还在 HEAD 的祖先链上，不在就**作废本轮判决**并说清原因——这时候用 `ns rearm <id>` 换个基线重跑，别直接重跑。

## 硬规则

1. **元数据只由 CLI 写。** 永远不要手改 Spec 的 frontmatter；正文随便改。
2. **只有 `ready` 会被派发。** 不升级 draft 不会被跑，也不会报错。
3. **一条 Spec 只做一件事、只在一个目录。** 需要拆就别硬塞。
4. **`Verify` 写成可判定的验收标准。** 不是命令，是标准。
5. **不替用户拍板"这事定了"。** `ready` 是用户的动作，你只负责把正文写到位。

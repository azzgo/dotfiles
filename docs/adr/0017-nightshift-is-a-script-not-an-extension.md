# Nightshift 是脚本，不是 pi 扩展

Status: accepted

## Context

本仓库的默认路径是"能力 = pi 扩展"：`track`、`workflow-runtime`、`sub-dispatch`、`command-palette`、`project-skills` 全部由 `just install-pi` 链接进 `~/.pi/agent/extensions/`，能力通过工具、斜杠命令、widget 暴露给模型和用户。（`pi-navigator` 曾是其中一员，已于 2026-10-20 退役，见 ADR 0018。）

Nightshift（`CONTEXT.md` 的 *Nightshift（夜间批量执行）* 一节）是一个夜间待办队列：白天把澄清好的 Spec 写上单一全局板，夜里由 CLI 逐条派发 `pi -p` 子进程执行、验证、回写状态并归档。它的使用场景与上面所有扩展相反——**没有人在场，也没有宿主 TUI**。

按默认路径，它应该做成扩展。三个事实否掉了这条路。

1. **宿主进程内跑不了无人值守。** ADR 0012 把 `sub-dispatch` 从 spawn 子进程改为进程内 `createAgentSession()`：派发随宿主 TUI 退出而消失。夜间批量执行的前提恰好是"关掉 TUI 之后还在跑"，这与进程内派发互斥。
2. **扩展能提供的三样东西都有更便宜的替代。** 斜杠命令 → `pi/agent/prompts/nightshift.md`（零运行时代码，纯转发）；实时进度 widget → 无人会盯，早上 `nightshift report` 一次看；SDK 提速 → 正是第 1 条否掉的形态。
3. **`pi -p` 已经提供了所需的一切。** `--model`、`--tools`、`--exclude-tools`、`-ne`、`--no-mcp`、`-ns`、`--session-dir`、`-a` 足以精确控制一个夜间子进程的工具面与模型。真正需要的"结合"只是命令行，不是运行时 API。

同时，队列的调度语义（串行键、并发上限、单实例锁、时间窗口、退出即止）属于调度器，不属于 agent。把这些交给模型判断，正是本仓库一直在避免的那类设计。

## Decision

- **Nightshift 落地为 skill + Node CLI，不是 pi 扩展。** 形态照抄 `skills/wayfinder/`：`skills/nightshift/{SKILL.md,CONVENTION.md,cli/}`，CLI 按路径调用（`node <repo>/skills/nightshift/cli/main.ts`），不安装到 PATH，`just install-skills` 链接到 `~/.agents/skills/`。
- **扩展层不存在。** 唯一的 pi 侧产物是 `pi/agent/prompts/nightshift.md`，一个只做转发、不拥有方法论的薄快捷键（与 `prompts/wayfinder.md` 同构）。
- **夜间执行体是 `pi -p` 子进程，不是进程内 session。** 每次派发是一次独立进程，CLI 通过退出码与 stdout 末行判定结果。
- **实现 Agent 的工具面默认最小且由 CLI 写死。** `-ne -ns --no-mcp` 关闭扩展发现、skill 发现与 MCP，`--tools` 只放内置文件工具；Spec 可以用 `tools:` / `extensions:` 追加，但任何指向 `sub-dispatch` 的扩展请求被拒绝——夜间 Agent 永不递归派发。
- **判决权归 Verifier。** 一个独立只读会话凭 Spec 的 `Verify` 段落输出 `VERDICT: pass|fail`；抓不到即 `verify-error`（流程故障，不是代码失败，不重试）。实现者的自述不作为任何判定依据。
- **元数据归 CLI。** 状态、baseline、Verifier 判决、尝试次数只由 CLI 写入；人和 agent 只写 Spec 正文。沿用 ADR 0016 的机器所有权规则。
- **Git 归你。** 夜里只在当前分支上 commit，不 push、不 switch、不 stash、不 reset、不做 `git add -A`；baseline sha 由 CLI 记录，清理失败项是后续一条显式的 `review --drop`。成果靠 `baseline..HEAD` 检查，不靠分支名。

## Considered Options

- **做成扩展 + 进程内 SDK 循环**（唯一能保留"在 pi 里实时看进度"的形态）。Rejected: 需要整夜挂一个 TUI，而无人值守的定义就是不挂；进度可视化的真实需求是"早上看一次"，由 `report` 满足。
- **做成扩展 + 扩展内 spawn 子进程。** 逻辑上可行，但扩展只充当入口，等于把一个 CLI 塞进扩展骨架，多了一层生命周期（`/reload` 会清状态表）。Rejected: 扩展没有承担任何它独占的职责。
- **复用 `workflow-runtime` 的 Auto Node 作为夜间执行体。** Rejected: 它的核心不变量是"无引擎、Driving Session 驱动、节点内不做质量判断"，与"有引擎、无人驱动、必须判成败"逐条冲突；硬塞等于重写 workflow-runtime。
- **复用 Wayfinder 的 Ticket 作为 Spec 存储。** Rejected: Ticket 存的是待决策的问题（Plan Don't Do），Spec 存的是已决定的可执行变更；共用一套状态机会让两边都无法收敛。
- **`--exclude-tools dispatch` 作为递归防护。** Rejected 为不足：它只掐掉一个工具名，而 `-ne` 直接不加载任何扩展，防护面更大且不依赖扩展的实现细节。
- **失败项留在板上等下一夜自动重试。** Rejected: 无人察觉的烧钱循环。失败项一律归档，重试只能是当夜那一次带 Verifier 反馈的重派。

## Consequences

- **本仓库出现"能力不是扩展"的例外。** 后续能力若同样要求"无人值守 / 独立进程 / 调度语义"，本 ADR 是先行判例；若只是要求新的工具或命令面，仍走扩展。
- **pi 侧只剩一个 prompt 文件。** `install-pi` 不需要为新能力做任何链接，只要 `just install-skills` 已经跑过。
- **调度器不进仓库。** 时间调度由 cron / launchd / tmux 循环负责，Nightshift 只保证"队列空或窗口尽就退出"，从而对任何调度器友好。单实例由板级锁文件保证，多个 loop 不会互相打架。
- **验证成本是双份模型调用。** 每条 Spec 至少一次实现 + 一次验证；重试一次则最多四次。这是"无人值守必须有可执行判决"的直接代价，已在设计中被接受。
- **`CONTEXT.md`** 新增 *Nightshift（夜间批量执行）* 一节：Nightshift / Spec / Board / Serial Key / Nightshift Run / Verifier / Verdict / Report / Archive / Baseline。

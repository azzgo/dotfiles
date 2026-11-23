# Skill 面收敛与 skills-audit

Status: accepted

## Context

`~/.pi/agent/skills/` 与 `~/.agents/skills/` 里的 skill 数量已经超过日常真正会叫用的数量。逐个回看之后发现三类问题，成因不同，但都指向同一件事：**入口的成本大于它带来的收益**。

- `why`（pi 耦合）与 `how` 并列存在，但日常动机问题几乎全部被内联的 `git blame -L` / `git log --follow -p` 解决。它不是内容无用，而是作为第二个 slash 入口既没有自己的 triage，输出版式又比问题本身重，于是每次都被绕过。
- `blast-radius` 从 pstack 继承的定位是"我自己改的东西会炸什么"。真实的审查场景已经换成"合并设计团队交付的、名义上纯样式的改动"——这时要证明的不是自己的改动安全，而是别人的改动没有越界到功能层，并且影响面被枚举干净。旧描述让 skill 在真实场景里不会被想起。
- `decision-log` 记录长时间/无人值守执行的决策轨迹。出现这种场景的地方在本仓库只有一个：nightshift 的 Spec。独立 skill 意味着 Agent 要在夜里主动想起"该记日志了"，而它并不知道日志该放哪、谁归档、早上谁看。
- `unslop` 两个月零加载。中文写作已由 `humanize` prompt 承接，英文"说人话"由 `bro` 承接；剩下被引用的只是"写作规范"这个概念，而概念不需要一个 skill 目录。
- 缺少一个能回答"我装的这些 skill 哪些其实从没被加载过"的确定性入口。人工回忆不可靠，模型自评更不可靠。

## Decision

- **`why` 并入 `how`。** `why` 的 Step 1-4 迁到 `how/references/rationale.md`，`epistemics.md` 迁到 `how/references/epistemics.md`，删除 `why/` 目录。合并时把 triage 一起带过去，而不是平移内容：单文件/单 commit 的动机问题内联完成（`git blame -L`、`git log --follow -p`、`gh pr view`），只有跨多文件、多证据源或依赖 PR 讨论/事故背景时才并行派只读调查员；输出仍按 `epistemics.md` 的五档置信度分档，并附覆盖图。`how/SKILL.md` 的描述与 Phase 1 复杂度分级各加 rationale 一档，并新增 `## Rationale track` 一节说明这三件事。
- **`blast-radius` 重定位。** description 改为"审查外部交付的、名义上纯样式的改动，证明它只动了视觉、并检出越界到功能层的地方"。正文新增三节：`越界判定`（条件渲染/事件处理器/状态/props 与组件契约/数据请求/路由/权限与埋点/日志，逐条给定位方法，出现即点名）、`影响面清单`（共享 token / 全局样式 / 复用组件用 grep 找出全部引用方，禁止以"看起来只影响一处"结案）、`视觉等价证明`（改动前后渲染对比，命令写进产出）。证明阶梯保留并具体化：两类关键事实（"这次改动是纯样式"与"不影响其他引用方"）都必须证到 *ran* 级，停在 1-3 级只能写 `unproven`。加入单文件内联 / 共享面全流程的 triage，并写清与项目级 code-review 的分工：code-review 管常规质量，blast-radius 管影响面与越界证据。
- **`decision-log` 归入 `nightshift`（文档与 CLI 同步改）。** 决策轨迹变成 Spec 的执行产物：路径 `<base>/board/<id>.decisions.tsv`，六列固定（`ts`/`phase`/`decision`/`why`/`evidence`/`result`），一行一个决策，`evidence` 只放指针，`result` 写谓词状态。实现 Agent 的纪律段要求执行中追加（首次写表头），`nightshift show` 渲染轨迹、无记录时显示「（无决策记录）」，`nightshift report` 给一行条数指针，归档时把文件一并搬进 `archive/<date>/`（不存在则跳过）。删除 `skills/decision-log/`。
- **删除 `unslop`。** 目录删除，不引入替代 skill。全仓引用清理时，凡原本依赖"写作规范"这个概念的地方，直接把要求写在那句话里；`humanize` 的英文路由改为内联的写作要求。
- **`project-skills` 扩展新增 `/skills-audit`。** 纯本地、不联网、不调用模型的确定性命令：扫描三类已安装 skill（全局 pi 耦合、全局通用、当前项目，后者按 `CONFIG_DIR_NAME` 取 `.pi` 或 `.pig`），从宿主会话 `sessions/**/*.jsonl` 里的注入标记 `skill name="<name>" location=` 判定真实加载，按每行 `timestamp` 归日，输出 skill 名、来源类别、最近加载日期、近 60 天次数、`SKILL.md` 行数、是否 `disable-model-invocation`，并单列"从未加载"与"超过 60 天未加载"。只输出计数与日期，不输出会话内容或任何项目标识；`--json` 给原始结构。扫描全量上限 15 秒，命令不修改任何文件。

## Considered Options

- **保留 `why` 作为独立入口，只精简输出。** Rejected：问题不在版式而在入口成本与缺 triage。用户不会为了一个日常动机问题先想起来还有第三个 slash 命令；只要它仍然要求"走完整流程"，它就会继续被 `git blame` 取代。
- **把 `why` 拆成 `how` 的第二个参考文件但保留 `/skill:why` 转发。** Rejected：那等于保留两个入口、两份调用说明，却没有第二个使用时机。
- **继续把 `blast-radius` 定位成"自己的改动"的预检。** Rejected：真实使用场景是合并外部交付。定位不换，skill 在需要它的那一刻不会被想起，内容写得再细也不生效。
- **给 `decision-log` 单独加 CLI，或用 hook 强制它写。** Rejected：这会在仓库里多一个无人值守产物，而唯一的使用场景（nightshift）已经拥有 Spec 元数据、归档与次日回看的完整回路。把轨迹放进 Spec 的生命周期，才能保证它真的被写、被搬、被看到。
- **为 `unslop` 保留一份精简版规则。** Rejected：零加载说明问题不是规则太多。写作要求写在用它的那句话里就够了。
- **把 `/skills-audit` 做成 skill。** Rejected：skill 需要模型判断与调用时机，而这里要的恰恰相反——一个不看模型心情、每次给出同一张表的确定性命令，且它需要跨会话扫描，属于扩展的职责边界（ADR 0017 已确立"无人值守/独立进程语义走脚本，其余走扩展"）。
- **用会话文件 mtime 或最后修改时间判定"最近使用"。** Rejected：会话文件会在无关对话中被继续写入，mtime 只证明文件被碰过。注入标记 + 行内 `timestamp` 才对应"这个 skill 真的进了上下文"。

## Consequences

- `/skill:why` 消失。`how` 现在是探索、定位/归属/分层、设计动机三类问题的唯一入口；它的 reference 目录里 `rationale.md` 与 `epistemics.md` 并存，其他 skill 引用这两份文件而不是旧 skill。
- `blast-radius` 的审核动作变成外部交付的验收环节：越界信号必须点名，影响面必须枚举，视觉等价必须给出可比对的证据，停在推理层的事实一律 `unproven`。
- nightshift 的 Spec 多了一个可选产物 `decisions.tsv`：板上有、归档里有，`show` 与 `report` 都能看到；它不参与 schema 校验，也不阻塞派发，缺失视为"没有需要记录的决策"。
- `skills/decision-log/` 与 `skills/unslop/` 目录不存在。两处 `README.txt` 按最终状态同步：`decision-log` 条目删除，`nightshift` 条目记录吸收内容；`unslop` 保留来源行并标注移除日期与理由。
- `project-skills` 扩展多了一个命令（`/skills-audit`），与 `/pi-skills` 同一份源码双宿主通用（项目目录与会话目录都按 `CONFIG_DIR_NAME` 推导）。它是只读命令，不修改 skill、板子或会话。
- 本 ADR 记录的取舍只针对 skill 面的收敛；`draw-path-chart` / `diverge-paths` / `trace-paths` 保留观察窗口，不在本轮处理。

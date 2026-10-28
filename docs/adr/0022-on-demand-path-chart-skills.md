# 路径/状态图采用按需三件套，而非仓内形式化验证套件

Status: accepted

## Context

探索「系统可能怎么走」和「现状实际能走到哪」时，常见做法是：用一份形式化元技能（例如 poteto / pstack 的 `/statechart` 与 `create-formal-verification-skill` 一类公开路径）在 consuming repo 里生成长期维护的形式化套件，并默认走向 TLC（或等价穷尽交错）来当真理源。

本仓库已经用 ADR 0021 选定了目标驱动的 Verify Playbook / Env Harness：正向验收回答「这次对齐的目标做成了没有」。路径图解决的是另一类问题——发散值得考虑的路径，或从现状 + 现象推出可达路径与人话复现——不必默认升格成仓内形式化护栏，也不必和 Playbook 硬绑。

需要一套轻、按需加载、默认只画/列路径的形状；形式化作为可选加深，仅当用户当次强烈要求时再走。

## Decision

- **本仓库提供按需三件套（`skills/`），不产 consuming repo 内的形式化验证套件。**
  - `draw-path-chart`：共享能力——路径/状态类图的呈现约定、节点命名、草稿 vs 临时诊断图的标法，以及调用方需要时可复用的人话复现段落写法。可被其它技能按名引用。
  - `diverge-paths`：薄入口——从**已有理解**发散路径/状态草图，帮助看见还有哪些路径值得考虑；按名 follow `draw-path-chart`。
  - `trace-paths`：薄入口——从**代码/系统现状** + 额外输入（缺陷描述、现象等）推断当前可达路径图，主产物含**人话复现步骤**；图是临时诊断用；按名 follow `draw-path-chart`。
- **默认引擎是画图/列路径，不是「必须先 TLC」。** TLA+/TLC（或等价形式化）写在 `draw-path-chart` 里作为可选加深，常在但默认不走；仅当用户当次强烈要求形式化 / 穷尽交错时再走。
- **与 ADR 0021 弱关联。** 正向验收仍走 Verify Playbook（及 Env Harness）。路径图可用于对齐前后的探索或线上缺复现时的诊断；不点名强绑 Playbook、对齐文档或其它下游技能——入口技能最多按上下文附松散建议。
- **两个入口气质分开。** diverge 从已持有的理解向外铺；trace 从 as-is 系统向内证。共享呈现层，不合并成单一「状态图技能」。

## Considered Options

- **照搬 poteto / pstack 式 `/statechart` + `create-formal-verification-skill`，在 consuming repo 落地形式化套件并默认 TLC。**（出处：[cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) 公开技能族；两者系作者正在内测的 beta 方向，尚未进主分支。）否决为本路径：那是「产仓内长期套件 + 形式化默认」；本路径要的是按需草图/诊断图，真理源不落到「模型跑完的穷尽结果」，也避免每个 consuming repo 多一套要维护的形式化资产。
- **单一技能同时覆盖发散、现状追溯与形式化。** 否决：入口气质不同（已有理解 vs as-is + 现象），合并后容易默认走上重的那条；拆成共享约定 + 两个薄入口更清晰。
- **路径图技能硬绑 Verify Playbook / 对齐文档。** 否决：会把探索工具抬成验收前置；与 ADR 0021「对齐材料完备后再写 Playbook」叠加后职责缠绕。弱关联、松散建议即可。
- **默认每次都跑 TLC / 穷尽交错。** 否决：贵、慢，且多数会话只需要看得见的路径草图；形式化留给用户当次明确加码。

## Consequences

- 本仓库新增三个通用技能：`skills/draw-path-chart/`、`skills/diverge-paths/`、`skills/trace-paths/`（经 `just install-skills` 链到 `~/.agents/skills/`）。均为按需 skill，不创建项目级 meta。
- consuming repo 不因本 ADR 自动获得形式化套件；若某仓另有形式化需求，与本三件套并列，不由这三份技能代写仓内 meta。
- 与 ADR 0021 的关系：Playbook / Harness 仍负责正向可检验收；路径图另见本 ADR，不改写 0021 的完备门与职责拆分。
- 与 `show-me` / `grilling` 的关系：一般视觉说明仍可走 `show-me`；需要**路径/状态可达性**专用约定（草稿标法、复现段落、可选形式化加深）时走本三件套。

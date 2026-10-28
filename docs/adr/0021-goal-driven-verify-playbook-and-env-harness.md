# 验收采用双元技能 + 仓内 Verify Playbook / Env Harness

Status: accepted

## Context

在 consuming repo 里做需求验收时，常见两条路：

1. **稳态护栏**：维护一份从代码扫出来的能力图（Feature Map 一类），再配「日更 map / 默认全仓 Drive」的回归栈，用护栏兜住「系统现在还能干什么」。
2. **目标驱动**：先把本需求对齐到可检，再为本需求写一条可分支的步骤链，环境就绪后按链跑、留证据。

本仓库要的是第 2 条。验收回答的是「这次要对齐的目标做成了没有」，不是「全仓稳态是否仍成立」。能力图若从现有代码生成，容易把「代码里碰巧有的东西」当成真理源；全仓回归对单需求又贵、又占 token。需要一套轻、可复用、且把「写验收技能」和「日常跑验收」拆开的形状。

## Decision

- **双元技能住在本仓库（`skills/`），只负责创建或 refine consuming repo 内的项目技能；日常验收由仓内技能自己跑。**
  - `create-verify-playbook`：根据**已对齐**材料，创建或 refine consuming repo 的 **Verify Playbook** skill。
  - `create-env-harness`：创建或 refine consuming repo 的 **Env Harness** skill（拉起验证环境、就绪检查、收摊）。
- **仓内两份项目技能分工固定。** Env Harness 把环境备到就绪后交给 Playbook；Verify Playbook 跑本需求/本 feature 的可分支步骤链，并留下 Evidence。Playbook **引用** Harness，不复制搭环境长文。
- **元技能开工的完备条件是对齐，不是读代码补全。** 目标对齐（含边界与非目标）、改法对齐、可检对齐（到时看什么能证明做成）三条同时成立才继续写 Playbook；缺则退回对齐流程。输入不定型（纪要 / 方案 / 对话均可）。
- **刻意不采用「代码生成的能力图 + 默认全仓回归」作为本路径的真理源或默认闸门。** 轻回归、省 token；护栏类能力若 consuming repo 另有需要，与本路径并列，不由这两份元技能承载。

## Considered Options

- **照搬 poteto / pstack 式 Feature Map + maintain 日更 + 默认全仓 Drive**（出处：[cursor/plugins pstack `poteto-mode`](https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/SKILL.md)，公开资料）。** 否决为本路径：那是稳态全仓护栏，真理源偏「代码里已有什么」；本路径要的是「本次对齐的目标是否落地」，材料来自对齐，不来自扫仓。
- **单一「验证技能」同时写 Playbook、搭环境、日常跑验收。** 否决：职责缠在一起后，refine 环境会带动改步骤链，日常跑又会顺手改技能正文；拆成「元技能写、仓内技能跑」更稳。
- **把搭环境长文内联进每份 Playbook。** 否决：多需求重复同一套拉起/收摊，环境一变要改 N 份；统一 Env Harness，Playbook 只引用。
- **元技能在材料不齐时靠读代码推断「系统该有什么」。** 否决：会把实现细节抬成验收目标，和「对齐后再写可检步骤」相反。

## Consequences

- 本仓库新增两个通用元技能：`skills/create-verify-playbook/`、`skills/create-env-harness/`（经 `just install-skills` 链到 `~/.agents/skills/`）。各带一份最小仓内 skill 模板，供写入 consuming repo 时起步。
- consuming repo 内出现（或更新）项目本地的 Verify Playbook 与 Env Harness；具体路径与命名由元技能按该仓惯例选定，本 ADR 不钉死目录名。
- 日常验收会话加载仓内 Playbook（及它所引用的 Harness），不默认加载这两份元技能来「替跑」验收。
- 与 intake / grilling / grill-with-docs / wayfinder 的关系：对齐在上游完成；元技能消费的是已对齐材料，不替代对齐流程。
- 路径/状态探索图（发散草图、现状可达路径与人话复现）另见 ADR 0022；不改变本 ADR 的完备门与 Playbook/Harness 职责拆分。

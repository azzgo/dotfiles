# pi-navigator 退役

Status: accepted — supersedes ADR 0010

## Context

ADR 0010 引入 `pi-navigator`：一个 `/nav <输入>` 命令，按需注入手工策展的能力目录（`pi/agent/extensions/pi-navigator/catalog.md`，95 行）+ 运行时扫描的 skill 清单，让模型提出一套工作流。理由是：本仓库所有 skill 都是 `disable-model-invocation`，扩展命令对模型不可见，模型无法自己路由到它们。

这个理由是真的，但推出它的成本没有兑现价值：

1. **创建以来没有被使用过。** 唯一能证明它有用的行动是"用户在任务开始时想起 `/nav`"，而这正是它想解决的问题本身——一个需要先被想起才能帮助你想起的入口。实际使用中，任务开始时的能力选择直接由用户点名（`/skill:wayfinder`、`/wf`），或由模型在对话里建议，绕过了 `/nav`。
2. **维护成本是持续的、被制度化的。** 不只是"有空更新一下目录"：`dotfiles-code-review` skill 把 `catalog.md` 列为**硬编码固定源第 2 位**，并规定"diff 触及 `pi/` 或 `skills/` 就必须强制检查 catalog 并在报告里单列 `## catalog.md Sync` 小节"。于是每加一个 skill、每改一个扩展命令、每删一个能力，都多一道必查工序，服务于一个没人调用的入口。
3. **它描述的能力表面本身在变化。** catalog 里 20+ 条 skill 路由中，一半指向 `skills/` 下的通用 skill（`intake`、`grilling`、`prototype`、`tdd`…），而这些的取舍判断在对话里当场就能做出——这恰恰是最不需要预先策展的一类知识。

ADR 0010 自己在 Consequences 里已经标出了这个风险信号："Not yet a sticky mode; if `/nav` usage shows repeated re-invocation within one effort, a sticky variant can be added." 实际观察结果相反：usage 一直为零。

## Decision

- **删除 `pi/agent/extensions/pi-navigator/` 整个目录**，包括 `index.ts`、`catalog.md`、`README.md`、`package.json`。`just install-pi` 的两行软链同步移除，已安装机器上的 `~/.pi/agent/extensions/pi-navigator` 一并删除。
- **`catalog.md` 的内容不迁移、不保留。** 不转成 skill，不塞进 `APPEND_SYSTEM.md`。判断是：那 95 行里唯一的增量信息是"按情境路由"的取舍，而它服务的能力（`/nav`）已被证明不被需要；保留到别处只是把维护成本换个位置。
- **`dotfiles-code-review` 的固定源表收缩为 5 项**，`catalog.md` 整条移除；随之删除的还有它的制度性产物：`## catalog.md Sync` 报告小节、"diff 触及 `pi/` 或 `skills/` 则强制检查 catalog" 的触发规则、以及 Removal Plan 里"catalog 是否仍路由到它"的检查项。
- **不新增替代机制。** 能力发现仍由两条既有路径承担：模型在对话里建议（`description` 可见的那部分），以及用户点名 `/skill:*`、`/wf`、`/track`。

## Considered Options

- **保留扩展，但把 catalog 缩到只收 pi 耦合能力**（5 个 skill + 7 个扩展）。Rejected：这解决的是维护成本的一半，不解决调用率为零。而且"只收 pi 耦合"会让 catalog 丢掉它最有价值的东西——`grilling` 这类通用 funnel 是整个仓库唯一被反复复用的入口，删掉它等于让路由表失去主干。
- **降级为 `disable-model-invocation` 的 `skills/route/`**，由用户显式 `/skill:route` 调用。Rejected：换壳不换问题。它仍是一个需要被想起的入口，仍需要随着能力表面同步维护；`/nav` 零调用率的原因不是它住在一个扩展里，而是它要解决的需求不存在。
- **把 catalog 塞进 `APPEND_SYSTEM.md`**，让模型每轮都能看到。Rejected：每轮 token 成本，且与本次同一时期确立的"能力默认不进 system prompt"原则冲突（`disable-model-invocation` 全线适用）。
- **保留扩展与 catalog，只把 code-review 的强制检查改成可选**。Rejected：这是最坏的一档——保住了维护对象，却撤掉了唯一让人更新它的压力，会稳定退化成一份说谎的文档。

## Consequences

- **能力表面不再有单一策展入口。** 新增一个 skill 时，除了 `README.txt`（来源登记）与 `AGENTS.md`（如涉及约定）之外，不再有"必须同步某个目录"的要求。这个自由度是刻意换来的：宁可少一份权威清单，也不要一份会腐烂的权威清单。
- **`dotfiles-code-review` 的文档一致性检查变轻。** 触发条件不变（md/txt、`docs/`、`skills/`、`pi/`、justfile recipe、根目录增删、install 软链目标），但少了一道强制小节和一个固定源。固定源编号由 6 项重排为 5 项。
- **`/nav` 命令消失。** 任何记忆或旧笔记里提到 `/nav` 的地方都已失效；仓库内引用已全部清理（`README.md`、`AGENTS.md`、`justfile`、ADR 0011、ADR 0017、code-review skill 及其 README.txt）。
- **ADR 0010 保留为历史记录**，不删除、不改写其正文；本 ADR 明确标注 supersede 关系。
- 一度存在两个相邻的"能力入口"实体的疑问就此收敛：本仓库不再维护任何"能力目录"产物。能力要么是扩展命令（`/wf`、`/track`、`/xfer`、`/pi-skills`、`alt+.`），要么是 skill（一律 `disable-model-invocation`，由用户或对话中点名）。

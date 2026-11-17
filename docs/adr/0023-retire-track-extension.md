# track 扩展退役

Status: accepted — supersedes ADR 0006 的 track 分离决定与 ADR 0008（已由 ADR 0015 取代）

## Context

`track` 是 ADR 0006 从 goal-runtime 里纯提取出来的工作记忆扩展：`/track new|update|context|status` 四个命令，写 `<project>/.pi/track/findings.md` 与 `progress.md`（PiG 下为 `.pig/track/`），并在每个项目第一次对话时**自动初始化**这两个模板文件。

它存在的理由分两步被抽空：

1. **压缩用途**先被 ADR 0015 拿走。ADR 0008 曾让 Track 担任压缩摘要；0015 改为指针式摘要后，压缩机制迁到独立的 `compaction` 扩展，track 扩展里连 `session_before_compact` 都不再存在。
2. **手动用途**在实践中零调用。本机 7 个 `.pi/track` 目录里，5 个仍是 `- [empty]` 模板原样（`~/AppImages`、`~/tmp` 这种只被打开过一次的目录也有），只有 `pi-cf` / `pi-xfer` 两个项目有真实内容，且最后一次写入都在数周前。ADR 0015 已经诊断过同一件事：“常在线场景里没有人会记得跑 `/track update`”。

同时，这个扩展的**成本是持续的**：

- `before_agent_start` 里无条件 auto-init，任何打开过的目录都会多出 `.pi/track/`。本仓库 `.gitignore` 里有 `.pi/` 所以自身无害，但任何没忽略 `.pi/` 的仓库都会凭空出现未跟踪目录。
- 代码里的几处机制已经不生效：`guards.ts`（把裸 `findings.md` / `progress.md` 重定向到 track 目录）从未被 `runtime.ts` import；`suppressContinuationThisTurn` 只在 `turn_end` 里被置回 false，没有任何地方读它去抑制续跑。
- 唯一的 UI 是一行 `track: <dir>` widget，唯一被读取的时刻是用户手打 `/track context`。

ADR 0018 退役 pi-navigator 时的判断标准同样适用：**一个需要先被想起才会被使用的入口，调用率为零，维护成本却持续存在。**

## Decision

- **删除 `pi/agent/extensions/track/` 整个目录**（含源码、测试、README、package 文件）。`just install-pi` 的两行软链、`just install-pig` 的 `pig install` 一行、`just test-track` recipe 一并移除。
- **已安装机器上的软链清理走既有机制**：`just install-pi` 在链接前会 `find ~/.pi/agent/extensions -maxdepth 1 -xtype l -delete`，删掉仓库目录后该软链自动失效并被清理。
- **磁盘上遗留的 `.pi/track/` 不主动删除。** 它们属于各项目的数据，其中 `pi-cf` / `pi-xfer` 有真实内容；扩展不再读写它们，但删除与否交给用户。
- **`compaction` 扩展开头的 noise filter 去掉 `.pi/track/` 两条正则**：这两个路径不再被扩展产生，继续过滤只会掩盖“有人在读遗留文件”这一事实。
- **文档与术语同步收缩**：`AGENTS.md`、`README.md`、`pi/README.md`、`CONTEXT.md`、`compaction/README.md`、`workflow-runtime/README.md`、`dotfiles-code-review` skill 中的 track 条目全部移除或改为“已退役”；`CONTEXT.md` 的 **Track** 词条删除，**Project** 定义不再包含 `.pi/track/`。
- **不新增替代机制。** 跨会话续接由原生 resume/fork 承担，压缩前状态由 `compaction` 扩展的指针式摘要承担，结构化进度由 `workflow-runtime` 的 Run 日志承担。

## Considered Options

- **只删掉 auto-init，保留 `/track` 命令。** Rejected：这解决了目录污染，但保留了一条零调用的命令面、一个 effect-less 的 auto-continue 标志、一个死掉的 guards 模块，以及仍在文档里说谎的“Track 是工作记忆”叙事。用一个更小的东西继续承担同样的维护成本，不如不承担。
- **把存储搬到 `~/.cache/track/<cwd-slug>/`**（`skills/wayfinder` 的做法，ADR 0016）。Rejected：搬家只解决“污染项目目录”这一条，不解决调用率为零。搬迁还会让少数已有真实内容的项目数据失去原位。
- **降级为通用 skill（`skills/track/`）**，由用户显式 `/skill:track` 调用，内容仍是“写两个 markdown”。Rejected：这本来就是一条 prompt，不需要一个 skill 框架；而且它正是 ADR 0022 对 skill 的边界判断——“产出是一次性编排而非知识”的东西不该做成 skill。
- **保留扩展但标记 deprecated 一版再说。** Rejected：没有兼容性约束（纯本地个人配置），deprecated 只会延长一份文档与代码的腐烂期。

## Consequences

- **`.pi/track/` 不再随会话产生。** 新项目里不会再出现空模板目录；已存在的目录成为普通遗留文件，随时可删，删除后也无人报错。
- **`/track` 命令消失。** 记忆或旧笔记里提到 `/track`、`.pi/track/` 的地方均已失效；本仓库内的引用已全部清理（`AGENTS.md`、`README.md`、`pi/README.md`、`CONTEXT.md`、两个扩展 README、code-review skill、justfile）。
- **`just test-track` 消失**，`dotfiles-code-review` 的可选校验表少一行，code-review README 的可选校验改为 `just test-compaction`。
- **ADR 0001 / 0005 / 0006 / 0008 / 0015 / 0018 保留为历史记录**，不删除、不改写正文；它们对 Track 的描述以本 ADR 为终点。
- **仓库不再维护任何“工作记忆平面文件”产物。** 需要跨会话记忆时，用会话 resume/fork 或压缩摘要里的文件引用；需要写笔记时，直接写项目自己的文档。

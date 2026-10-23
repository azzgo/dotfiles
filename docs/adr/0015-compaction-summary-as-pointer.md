# 0015-compaction-summary-as-pointer

Status: accepted. Supersedes [ADR 0008](0008-track-sourced-compaction.md). Refined by [ADR 0020](0020-compaction-summary-handoff.md) — 其中两条决定被推翻：「待压消息全量交给模型」与「下一步意图只来自被丢弃的旧窗口」。
压缩摘要从「Track 的全文」改为「模型写的主题 / 下一步意图 / 文件注释 + 扩展写的原始记录指针」；Track 退出摘要来源，回归手动维护。触发这次改动的是一个新场景：**单会话连续运行的常在线 agent**。在这种场景下 ADR 0008 的两个隐含前提都不成立——会话很长，Track 只增不减且无人维护；而压缩的目的不是"保住这段对话"，而是"让压缩后的 agent 知道自己在哪、下一步干什么、缺什么可以去哪里找"。

## Context

常在线 agent 的目标形态是**一个不结束的长会话**（后台 dispatch 完成唤醒、workflow auto node 接力）。这与当前的使用形态（短会话 + 磁盘状态接力）根本不同：压缩从偶发事件变成高频事件，摘要的质量直接决定 agent 会不会在腐坏的上下文上继续干活。

三条查证到的事实构成了新设计的地基：

- **压缩不删原始记录。** 被摘要掉的条目完整留在 `~/.pi/agent/sessions/--<path>--/<ts>_<id>.jsonl` 里（`docs/compaction.md:83`），`get_entries` 明确包含 pre-compaction history。
- **扩展能拿到当前会话文件路径。** `ctx.sessionManager.getSessionFile()`（`session-manager.d.ts:178`）。
- **Pi Durable 已经存在**（`@earendil-works/pi-durable`，随 Pi 1.0 发布），它的压缩是后台 task、**跑在对话继续进行的同时**，摘要插到下一个 turn 边界，只有"下一轮请求塞不下"时才同步等待；旧消息永远留在 storage。

最后一条改变了问题的性质：压缩不再需要"扛住全部历史"，它只需要"指路"。因此不再需要 pi-durable 尚不可用这个借口，也不再需要三档阈值——那套机制是在同步阻塞的扩展层模拟"提前压缩"，而 durable 已经把提前压缩做进 harness 了。

## Decision

**摘要由四块组成，其中三块模型写、一块扩展写。**

| 块 | 谁写 | 更新语义 | 上限 |
|---|---|---|---|
| 主题 | 模型 | 可整条重写 | ≤ 5 条，一行一条 |
| 下一步意图 | 模型 | **整条替换** | 1 条 |
| 文件注释 | 模型 | 随文件记录追加 | 无 |
| 原始记录指针 | **扩展常量** | — | ~30 token |

**文件路径由扩展机械提取，模型只写注释。** `readFiles` / `modifiedFiles` 从 `preparation.messagesToSummarize` 的 tool call 里提取（内置压缩用的是同一套提取，`docs/compaction.md:200-204`；扩展自带摘要时 pi 不会替我们带，详见同处）。约定：`modified` 累计（责任边界，出事时要能查），`read` 只留本轮（随时能重读，累计没有意义）。让模型自己列文件清单是本设计里最容易发生也最难发现的错误，而它可以完全避免。

**下一步意图兼任恢复指令。** 不存在独立的"约束 / 未解"字段。需要先恢复上下文时，意图写成"先从 `<jsonl>` 找回 X"；机械推进任务时，意图直接把任务说清楚。主题因此可以整条重写——丢的信息由指针兜底，捞回的成本是一次 grep。

**指针是扩展写的常量，不是模型写的字段。** 它给出当前会话 jsonl 的绝对路径和一行用法。它和"模型写的约束"性质不同：后者会被模型重写而坍塌，前者不会。

**Track 回归手动维护，并且不进摘要正文。** 它通过"文件引用"被下一步意图牵引：意图说"去找 findings 里的 X"，agent 自己 `read .pi/track/findings.md`。这与 ADR 0008 的差别不是"少了一次自动写入"，而是**Track 从真相源降级为可寻址的档案**。

**待压消息全量交给模型，不再截尾。** ADR 0008 用 `tailLines(..., 200)`，会漏掉密集工具调用下的中段决策。有了指针之后，漏记的代价从"永久丢失"降级为"多花一次 grep"。

**失败兜底从"嵌入 200 行对话尾部"降为"指路"。** 解析失败或模型无可用输出时，摘要正文只写一句"本次压缩未生成摘要，原始记录在 `<jsonl 路径>`"。兜底文本从 200 行降到 30 token，且信息没有丢——这正是指针存在的意义。

**overflow 走快路径，不调模型。** 窗口已经超限时 Pi 会重试被中断的那轮（`willRetry`），此时花时间做摘要是纯粹的延迟。而 ADR 0008 的快路径要"读 Track 返回"，现在没有 Track 可读了——所以快路径改为**只写机械信息**（文件列表 + 指针 + 一句"先回到旧记录确认自己在做什么"）。这比旧方案更好：往一个已经爆掉的窗口里塞 Track 是净损失，而这份快路径摘要只有十几行。

**摘要提示词是本次改动的全部实现。** 摘要文本由扩展拼装：模型的三块排在首尾，机械的文件列表夹在中间（防止中间的长列表吃掉模型对首尾的注意力）。

## Durable 上的落地
压缩机制的实现仍留在 `pi-coding-agent` 扩展层，但**契约按两层都能接受的形状定**：摘要是"模型写的结构化字段 + 扩展写的指针"，不依赖同步阻塞的 `session_before_compact`，也不依赖任何 coding-agent 特有的文件布局。迁到 durable 时，指针那部分会变成平台职责（storage 本来就保留旧消息），模型写的三块不变。

## Considered Options

- **维持 ADR 0008（Track 即摘要）** — 否决。单会话连续压缩下 Track 单调增长且摘要无上限，压缩本身的输入成本随会话线性上升；而常在线场景里没有人会记得跑 `/track update`。
- **纯 prose 摘要（内置风格 + 换提示词）** — 否决。文件引用交给模型必然漏，而它恰好可以机械提取；主题和意图则适合模型写。混合方案两头的失败率都更低。
- **在摘要里加"约束与未解"第四字段** — 否决。它属于意图的范畴，且由模型重写会引入反复重写的坍塌风险（ACE, arXiv 2510.04618）。
- **自建 `session_search` 工具 / 用 agentsview MCP 捞回** — 暂不做。jsonl 直接 grep 已够用；agentsview 解决的是跨会话搜索，而这里要的是本次会话被丢掉的那一段，且它有索引延迟。`session_search` 留作后备，需要时再写。
- **三档阈值（notice / warning / force + 硬切断封锁工具）** — **deferred，既不采纳也不否决**。它值得讨论的真正理由是它在模拟"提前压缩"，而在 durable 上后台压缩已是默认行为，三档退化成"后台压缩提前多久启动"这一个阈值——实现成本近乎为零，价值也近乎为零。如果最终迁移到 durable，这笔钱可以省下来；如果继续留在 coding-agent，最小形态是 notice 档把 `ctx.getContextUsage()` 的数字告诉模型、force 档只封锁写操作（读操作必须放行，腐坏的上下文下重新读文件是 agent 的自救能力）。

## Consequences

- 压缩机制已从 `track` 扩展拆到新的 `compaction` 扩展（`pi/agent/extensions/compaction/`）；失败日志从 `.pi/track/compaction.log` 迁到 `.pi/compaction/failures.log`。ADR 0008 的 compaction 路径已重写。**它最贵的那条约束仍然成立且必须继承**：`ExtensionRunner.emit()` 吞掉 handler 异常，把 `undefined` 当作"没有扩展结果"并静默回落到内置摘要。所以新实现仍然永不 throw、永不返回 `undefined`（`compaction/compaction.ts` 的 `failureSummary`）。
- `CONTEXT.md` 里 **Track-Sourced Compaction**、**Compaction Reconcile**、**Compaction Failure Record** 三个词条失效，由 **Compaction Summary** / **Retrieval Handle** / **Next Intent** 取代；**Track** 的定义要改（不再是摘要来源）。
- `track` 扩展的 README 与代码在实现之前不动——ADR 记录决定，不记录尚未存在的实现。
- 摘要不再随会话长度增长，之前那个"每次压缩都把整个 Track 重新喂一遍模型"的成本问题自然消失。
- 模型获得了捞回权，因此**指针必须写清楚**：路径写错或漏写，整套机制静默空转，而且没有任何报错。

# 0020-compaction-summary-handoff

Status: accepted — supersedes [ADR 0015](0015-compaction-summary-as-pointer.md) **in part**：推翻一条决定（待压消息全量交给模型）、修订一条决定（四块组成 → 五块）、补上一条约束（下一步意图必须与保留窗口一致）、细化一条决定（失败兜底不再是「只有一句指路」）；ADR 0015 的其余决定继续有效。经由 0015 继承对 [ADR 0008](0008-track-sourced-compaction.md) 的取代关系。
ADR 0015 把压缩摘要定义成「模型写的主题 / 下一步意图 / 文件注释 + 扩展写的原始记录指针」，并且**把待压消息全量交给模型**。用真实会话量过一次之后，这个形状有两处站不住：

- **摘要调用喂了 767,619 token**（被压缩窗口 3,070,474 字符，其中 67% 是工具输出），`cacheRetention: "none"`，是整个会话最贵的一次请求；而它产出的 6,198 字符摘要里，**81% 是文件清单**（33 个「改过」+ 53 个「读过」，其中 8 个是早已消失的 `/var/folders/...` 临时文件）。
- **下一步意图比现场还旧**。Pi 的 `prepareCompaction()` 只把**被丢弃的旧窗口**交给扩展；压缩后仍留在上下文里的最近 ~20k token **不在摘要提示词里**。于是模型写出的「下一步」停留在旧状态：实测那次摘要写着「等 ns-0010 (R1-a) verdict」，而压缩前 4 分钟的真实状态是「ns-0010 已 pass、ns-0008 needs-review」。

指针本身也空转了：摘要写着「需要上文时 grep 这个文件」，而压缩之后的 **238 次工具调用里没有一次**去 grep 那个 transcript；agent 改去重读源码——75 个文件是新读一遍的。

## Decision

**摘要模型不再读全文，改读 Compaction Skeleton。** 骨架是扩展机械抽出的逐行消息流：每条消息一行（user/assistant/tool），assistant 的文本截断到 200 字符，工具结果只保留含错误特征的行或首行。骨架保留**最老 20 行**（会话的定场）与**最近 800 行**，中间省略。同一份会话，提示词从 767,619 token 降到 **19,876 token**（39×）。

**摘要模型同时看到保留窗口。** `session_before_compact` 事件带 `branchEntries`，扩展用 `sessionEntryToContextMessages()` 重建 `firstKeptEntryId` 之后的原文，作为「保留窗口」一节喂给模型，并明确要求：下一步意图必须与保留窗口一致，冲突时以保留窗口为准。**这一条是修掉「下一步比现场旧」的唯一办法**——模型看不到现场，就写不出现场的现状。

**摘要带 Request Line（请求线）。** 用户说过的那几句话是意图的唯一来源，而且稀少、简短。扩展机械抽取最近 5 条用户请求（每条截断 400 字）写进摘要首块。这不是「最近窗口」的重复：窗口是原文，请求线是被保留下来的**意图**。

**文件清单降级为垫底的机械事实。** 「改过」保留最近 20 个，「读过」保留最近 10 个，永久过滤临时路径（`/var/folders`、`/tmp`）与 track 草稿目录，并在清单标题上标注「机械事实，可能已过时」。

**失败兜底改为 Compaction Fallback。** 解析失败时先做**一次 repair 重试**（把模型原文回灌，要求重出 JSON）；仍失败则产出**机械兜底摘要**（请求线 + 文件清单 + 旧记录位置），而不是一句「未生成」。失败路径从此也有 orientation。

**检索指针变成可执行的。** 摘要给出可直接粘贴的命令（`grep -n '"role":"user"' <jsonl> | tail -20`），扩展另外注册一个 **`exposure: "codemode"` 的 `session_grep` 工具**（关键词/正则 + role + 时间范围过滤）。刻意不注册成 `direct`：那会把一个低频需求变成每轮请求 system prompt 的常驻成本。

**摘要模型可配置，代码不内置 model id。** 模型写在 agent 目录下的 `compaction.json`（`~/.pi/agent/compaction.json`，PiG 下是 `~/.pig/agent/compaction.json`），用 `/compaction-model` 切换。未配置时回落到会话模型，并记一条失败日志。摘要模型不必是会话模型——它只写「主题 / 下一步 / 文件注释」。

**加 Compaction Notice。** 用量跨过 60% 时提示一次「建议 /compact」。压缩仍然由人决定，扩展不自动压。自动压缩的触发点实测是 `tokens > window - reserveTokens`，1M 窗下是 **98.4%**——太晚，压缩时已经没有余量。

**开销可见。** 扩展把摘要调用的 `usage` 回传给 Pi（footer 的成本统计从此包含它），并把每次压缩的模型 / token / 耗时 / 结果追加到 `<project>/.pi/compaction/stats.log`。

## Considered Options

- **继续把待压消息全量交给模型**（ADR 0015 的原决定）—— 否决。理由是 ADR 0015 当初怕的「漏掉密集工具调用里的中段决策」，可以由**骨架保留 assistant 文本行 + 请求线**兜住；决策本来就出现在这两处，不在 grep 输出里。代价是 39× 的 token 和一次注意力被稀释的总结。
- **保留前缀的压缩（缓存友好的「追加式」压缩）**—— 否决，SDK 层没有这个开关：`CompactionSettingsSchema` 只有 `enabled / reserveTokens / keepRecentTokens`，`buildContextEntries()` 无条件丢掉 `firstKeptEntryId` 之前的全部。社区里的 `pi-cached-compaction` 走的是另一条路（不压缩，只摘要），不是扩展层能实现的。
- **把 `session_grep` 注册成模型可见的工具**—— 否决。每轮请求都要多带一份工具声明，成本与收益不成比例。`codemode` 曝光保留了可检索性，不污染主对话。
- **失败时只留一句「未生成」**—— 否决。Pi 吞掉扩展异常，失败必须带在上下文里；带一句「未生成」等于没有 orientation，带机械兜底才有。
- **把下一步意图交给模型之外的机制**（例如从请求线机械推导）—— 否决。下一步是判断，不是抽取。

## Consequences

- `pi/agent/extensions/compaction/` 新增 `skeleton.ts`（骨架与请求线）、`session-grep.ts`（transcript 检索）、`model-config.ts`（摘要模型配置）；`prompts.ts` 改为渲染新形状，`fileops.ts` 加去噪与上限，`compaction.ts` 负责 repair / 兜底 / usage / stats。
- ADR 0015 的「待压消息全量交给模型」不再成立，改为骨架；它的四块摘要变为五块（多一块请求线，文件清单挪到末尾）；失败兜底从「只有一句指路」细化为机械兜底摘要；下一步意图多了一条约束（必须与保留窗口一致）。其余（模型写主题 / 下一步 / 文件注释三块、扩展写指针、overflow 快路径、失败带在上下文里）继续有效。
- 摘要的**长度不再是会话长度的函数**，而是固定的几块：请求线（≤5 条）、下一步（1 条）、主题（≤3 条）、文件清单（≤30 行）、旧记录（1 行）。
- `CONTEXT.md` 的 Compaction Summary / Next Intent / Retrieval Handle 三条随之改写，Compaction Failure Record 更名为 Compaction Fallback，新增 Compaction Skeleton / Request Line / Compaction Notice / Summary Model。

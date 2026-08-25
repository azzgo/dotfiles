# Code Mode：截断结果的会话内续读（fetchResult）

run_code 的返回值按 `maxResultBytes`（8KB）截断后，模型此前唯一的恢复路径是重跑程序——这会重放 `edit`/`write`/`bash` 子调用的副作用（文件改两遍、命令跑两遍）。决定：截断标记自带寻址信息（toolCallId + 总字节数），并在 worker 内注入与 `emit` 同级的宿主函数 `fetchResult(toolCallId, offset, size?)`，从 `ctx.sessionManager` 持久化的 entry 中按字节切片取回原始返回值。**存储量为零**：session JSONL 本来就全量落盘 `details.value`（compaction 只追加不重写，跨 reload/resume 存活），无需任何新 store。

## 决策细节

- **范围只覆盖 return value**：`tools.dispatch` 的 tail-truncated output 与 `details.calls` 审计记录明确 out of scope。前者是独立截断层（sub-dispatch 在返回前就截了），后者违背 ADR 0001 "结果精选"——模型需要大块文件内容的正确姿势是 read 自带 offset/limit 分段读，不是捞审计记录。
- **寻址用 toolCallId**：模型上下文里 tool_use 消息本来就带它，零成本；扩展内部 `run_code-N` 序号是 session 内存态，reload 后归零会撞车。
- **切片语义与 `truncateStr` 的字节语义对齐**（`Buffer.byteLength`），切在 UTF-8 序列边界上安全截断，保证 offset 与截断标记所见一致。
- **size 归一化**：`size` 省略或超过 `maxResultBytes` 时 clamp 到 `maxResultBytes`；`nextOffset = offset + 实际返回字节数`，到尾为 `null`。统一"每片 ≤8KB"心智模型——切片无论走 return 还是 emit 都是安全大小，模型不需要理解两条通道的容量差异。
- **边界行为**：`offset >= totalBytes` → `{ content: "", nextOffset: null }`（空串非报错，支撑干净的 drain 循环）；参数误用（负 offset、非正 size）与结果不存在（entry 缺失 / run 出错无 value）→ 明确报错。
- **预检纯文案**：`SDK_HEADER` 从静态常量改为按 `maxResultBytes` 参数化的模板，教模型自测 `Buffer.byteLength(JSON.stringify(v))`、大结果分块 emit（每块 ≤ 上限）；不加任何机制，不给 emit 设总上限。
- **fetchResult 不写 `details.calls` 审计、不走 TaskPool**：读的是 session 状态，纯内存读，不是副作用调用。

## Considered Options

- **LRU result store**（新 Map 存序列化结果，容量/淘汰/单条上限三参数）— 被否：session 已是 store，自建即冗余；淘汰后 fetch 旧 id 只能报"已淘汰"。
- **引用 Map**（execute 返回前持 `value` 引用，惰性 stringify 缓存）— 被否：compaction 裁掉 entry 后对象因扩展持引用变僵尸驻留；resume 后 Map 为空，跨 reload 失效。
- **fs 直读 session JSONL** — 被否：`ctx.sessionManager.getEntries()` 已带树/分支/compaction 语义，绕过它自己解析文件要重复处理分支逻辑。
- **新顶层只读工具 `run_code_result`** — 被否：打破 "run_code 是唯一直接工具" 的折叠不变量，COLLAPSE 文案与 `/code` toggle 的保存/恢复逻辑全要同步改。

## Consequences

- **递归截断**：fetch 回的切片作为新程序的 return 值再超限时，会再产生一个新的可 fetch 结果——行为正确但循环嵌套，SDK 文案需说破并推荐以 emit 交付切片。
- 模型常态下的正确姿势仍是"预检 + 分块 emit"（省一轮 fetch 往返）；fetchResult 是补救通道，不是默认交付方式。
- 续读依赖 `details.value` 落盘这一既有事实，成为它的第二个消费者（第一个是 TUI 审计）——将来若改 details 结构需同步此路径。

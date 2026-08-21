# Status: accepted (2026-08-21)
# ADR 0002：sub-dispatch 通知机制的后置决策

# sub-dispatch 完成通知（triggerTurn）作为独立后续议题

pi-interactive-shell 被替换为 sub-dispatch 后，原生模式（非 code-mode）下的后台派发失去了完成通知机制——上游 dispatch 模式靠 triggerTurn 唤醒 agent，剪裁时被丢弃，导致模型退化出 `sleep N && echo done` + 轮询查询的反模式（2026-08-21 deepseek-harness 探索 session 实录：spawn×2 → query → sleep 15 → query → sleep 20 → …）。

决定：不在 sub-dispatch 里单独补通知；code-mode 整合（v2b）先行——`run_code` 程序内 `await tools.dispatch(...)` 是 foreground promise，完成即 resolve，轮询问题在该形态下不存在。code-mode 未启用时的通知兼容（triggerTurn 或等价机制）作为 v2b 之后的独立实现议题。

## Consequences

- ~~过渡期内原生模式的后台派发仍可能触发轮询 pattern~~ **已解决**：sub-dispatch 现于后台 session 结算时向宿主发送 `sendMessage` 完成通知（`customType: "sub-dispatch"`，`{ triggerTurn: true, deliverAs: "followUp" }`），agent 空闲即被唤醒，在飞则排队到当前回合结束。通知自包含（状态 + exitCode + 输出 tail + 如何取全量），模型醒来即可行动，原生模式不再需要 `sleep + query` 轮询。
- ~~"triggerTurn 兼容"议题需在 v2b 验收后启动~~ **已实现**（实现提交见 git 历史，紧随 v2b commit `5e6c65d`）：技能指引（impl-with-spawn / explore-codebase）已改为"fire and end turn，完成自动唤醒，严禁 sleep+query 轮询"，`dispatch({ sessionId })` 退化为诊断/异常路径。
- code-mode 路径不受影响：`run_code` 内 `await tools.dispatch(...)` 走 `runDispatch`（foreground），不经 `runBackground`，故不产生上述通知。

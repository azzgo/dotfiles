# ADR 0002：sub-dispatch 通知机制的后置决策

# sub-dispatch 完成通知（triggerTurn）作为独立后续议题

pi-interactive-shell 被替换为 sub-dispatch 后，原生模式（非 code-mode）下的后台派发失去了完成通知机制——上游 dispatch 模式靠 triggerTurn 唤醒 agent，剪裁时被丢弃，导致模型退化出 `sleep N && echo done` + 轮询查询的反模式（2026-08-21 deepseek-harness 探索 session 实录：spawn×2 → query → sleep 15 → query → sleep 20 → …）。

决定：不在 sub-dispatch 里单独补通知；code-mode 整合（v2b）先行——`run_code` 程序内 `await tools.dispatch(...)` 是 foreground promise，完成即 resolve，轮询问题在该形态下不存在。code-mode 未启用时的通知兼容（triggerTurn 或等价机制）作为 v2b 之后的独立实现议题。

## Consequences

- 过渡期内原生模式的后台派发仍可能触发轮询 pattern；缓解：skill 指引优先 foreground dispatch（单任务等待即返回，无轮询）。
- "triggerTurn 兼容"议题需在 v2b 验收后启动，避免长期停留在过渡态。

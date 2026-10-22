# BG Run 是 skill，不是 pi 扩展

Status: accepted

## Context

本仓库的默认路径是"能力 = pi 扩展"：`track`、`workflow-runtime`、`sub-dispatch`、`command-palette`、`project-skills` 全部由 `just install-pi` 链接进 `~/.pi/agent/extensions/`，能力通过工具、斜杠命令、widget 暴露给模型和用户。ADR 0017 为"无人值守"开了第一个例外（Nightshift 走 skill + Node CLI），并在 Consequences 里写下了判例："后续能力若同样要求'无人值守 / 独立进程 / 调度语义'，本 ADR 是先行判例；若只是要求新的工具或命令面，仍走扩展。"

有一类需求落在这条线的另一侧：任务长到会占住终端，或必须活过当前会话，但**人一直都在**——他只是不打算盯着。这类任务今天没有归属形态，实测中会以三种方式撞墙。

取证（agentsview，2026-09-15 → 2026-10-22，跨 agent 索引）：

- **E1**（`pi:01a15eb9`，ord 436）用户在一次阻塞式派发后纠正："恩，你不能用 tmux 验证么，我等了你 3min，一直卡着，我想你 tmux capture 就知道有没有问题了"。前置动作是在 bash 里跑阻塞的 `pi -p`，3 分钟无输出。
- **E2**（`pi:01a15be6`，ord 770–780）用户说"你跑一个 tmux pig 进程，让它去修，你就不管了"。agent 手工拼了 4 条 tmux 命令（`kill-session` → `new-session -d` → `send-keys` → `capture-pane`），中途踩坑——第一次 `send-keys` 后命令没执行，多按了一次 Enter（ord 774："命令还没执行，仍停在提示符。再按一次回车"）。
- **E3**（`pi:01a15eb9`，ord 378–390）agent 自己在结论里写下："foreground — it will block the terminal for hours. Suggest tmux/nohup."

三条证据指向同一个形状：**长任务的派发需要脱离当前会话的能力、完成信号、以及随时介入的入口**，而 `sub-dispatch` 一条都给不了。ADR 0012 把它改成进程内 `createAgentSession()`，代价是三条硬约束：
1. **宿主 TUI 一退出，派发就没了**（ADR 0017 转述 ADR 0012 时的措辞："派发随宿主 TUI 退出而消失"）。
2. **超时是一次性硬墙，不可续期。** `runner.ts:355` 一个 `setTimeout(timeoutSec * 1000)` 到点 `session.abort()`；`runner.ts` + `index.ts` 里 `setInterval` / `heartbeat` / `keepalive` / `renew` 的匹配数为 **0**。`pollMs` 是纯观察，工具描述原文写着 "Observation only — the session keeps running regardless"。
3. **它只有一种运行位置**：宿主的信任域内。

需要澄清一个容易记错的点：`dispatch` 的 `background: true` + `triggerTurn` 完成通知解决的是"**不用轮询就等完成**"（CONTEXT.md 的 *End-turn Wait Discipline*），不是"**定期上报可以续命**"。后者在本仓库不存在。

## Decision

- **`bg-run` 落地为 repo-root skill + 纯 bash 脚本**，形态照抄 `skills/decision-log/`（`SKILL.md` + `scripts/`）：`skills/bg-run/{SKILL.md,scripts/bg}`。不装到 PATH，不进 `~/.pi/agent/extensions/`，`just install-skills` 链到 `~/.agents/skills/`。
- **不写进 `APPEND_SYSTEM.md`，不注册为扩展工具，模型不可见。** skill 带 `disable-model-invocation: true`，只在用户 `/skill:bg-run` 显式调用时加载。理由是本 ADR 的核心：**派发长任务是人的决定，不是模型的决定**——模型一旦知道这个姿势，就会在你没要求的时候自作主张派发，而这正是 ADR 0018 判为"一个需要先被想起才能帮助你想起的入口"而退役 `pi-navigator` 的那类行为。
- **完成与否只看退出码文件，不看输出。** tmux 路径的包装层把 stdout+stderr 写进 `~/.cache/bg-run/<name>/out.log`，退出码写进 `rc`；`rc` 存在即结束。**不解析输出、不猜 shell 提示符**——E2 里那多出来的一次 Enter 就是猜提示符的代价。
- **两条路径，按环境选。** 有 Herdr 时用 Herdr（`HERDR_ENV=1`）：状态判定（`idle` / `working` / `blocked` / `done` / `unknown`）由 Herdr 的生命周期检测给出，比读屏幕可靠；无 Herdr 时退回纯 tmux。`--agent KIND`（pi、claude、codex、gemini、cursor、omp…）把活交给另一个 coding agent，无 Herdr 时**拒绝**而不是静默降级。
- **与 `sub-dispatch` 并列，不替代。** dispatch 管"进程内、要回传结果、随宿主生死"的子 agent；`bg-run` 管"长时、要脱离当前会话、人可随时介入"的活。两者的边界写在 `AGENTS.md` 与 skill 正文里。
- **skill 自带一份浓缩的 Herdr SOP**（`pane split` / `tab create` / `pane run` / `agent start` / `agent prompt` / `agent wait` / `agent read` 的实际语法与 ID 形态），不依赖 Herdr 自己的 skill 被安装——否则"herdr 装了但 skill 没装"的机器上，agent 面对一个没进过训练库的 CLI 会无从下手。

## Considered Options

- **做成 pi 扩展 + 新工具面**（`bg_start` / `bg_capture` 之类）。Rejected：这正是"只是要求新的工具或命令面"的情况，按 ADR 0017 的判例仍走扩展——但走扩展就意味着模型每轮都看得见这个工具，而派发的时机属于人。同一条需求，扩展形态解不了"由人决定何时派发"这一半。
- **做成扩展 + 进程内 SDK 循环**（复用 `sub-dispatch` 的 `runSession`）。Rejected：与 ADR 0012 的第一条约束直接冲突——进程内 session 活不过宿主 TUI，而"活过当前会话"正是本需求的全部意义。
- **把 tmux 姿势写进 `APPEND_SYSTEM.md`**。Rejected：那文件是 pi 专属 system prompt，每轮都注入，写进去等于 (a) 破坏跨 agent 复用（别的 agent 读不到），(b) 让模型自动看到并可能自动调用这个姿势。用户明确要求 agent 不该知道这个 skill。
- **扩展 `sub-dispatch` 的 timeout 语义**（加心跳续期、支持更长时限）。Rejected：`dispatch` 是进程内 session，"活过宿主"这条它无论续期多久都做不到；给一条走不通的路加续期机制是在错误的层面解决问题。同时它会侵占 `dispatch` 已经在承担的"长任务"位置——`dispatch` 的位置不动。
- **做一个"判断该不该派发长任务"的规则集**（写进 skill 描述或 system prompt，让模型自查）。Rejected：判断的前提是模型已经知道这个工具存在。`disable-model-invocation` 下模型看不见这个 skill，自然也用不上这套规则；用户在对话里点名 `/skill:bg-run` 本身就是"我已经决定派发"的信号。
- **让脚本自己判断"任务是否完成"**（轮询 capture、检测提示符回归）。Rejected：这是 E2 的坑本身。完成信号必须是外部事实（退出码、Herdr 的生命周期状态），不能是脚本对屏幕的猜测。
- **复用 Herdr，不自己写 tmux 层**。Rejected 为唯一实现、接受为兜底：Herdr 的 skill 不在本仓库、依赖 `HERDR_ENV=1`（只在 Herdr 管理的终端内为 1），且 `herdr` 本身不是每台机器都装。但它的能力（状态判定、多 agent kind、`--until STATUS` 等待）值得直接用，所以做成"有则用、无则退回 tmux"。
- **Herdr 路径用 split pane 而非新 tab**。Rejected：`pane split` 把可用宽度对半分，所以新 pane 总是当前 pane 的一半左右——本仓库实测到过 12 列的 pane split 出 11 列，agent 输出被折成每行两三个字符的碎片，完全不可读（E2 里"再按一次回车"的误判就发生在读不清屏幕的情况下）。新 tab 是全宽，实测输出正常。

## Consequences

- **本仓库出现第二个"能力不是扩展"的先例，且判例边界被划清。** ADR 0017 放行的是"无人值守 / 独立进程 / 调度语义"；本 ADR 放行的是"**脱离当前会话 + 由人显式派发 + 不需模型自行路由**"。两者共同确立的判据是：**当"谁在何时决定使用"比"能力面"更重要时，能力降级为 skill + 脚本，把决定权留在人手里。** 仍是扩展的场景不变：新的工具面、新的命令面。
- **跨 agent 复用成立。** skill 在 `~/.agents/skills/`，任何读这个目录的 agent 都能用；脚本只有 bash + tmux/herdr/jq 依赖，不含 pi 机制。
- **模型看不到这个 skill。** `disable-model-invocation: true` 让它不出现在 pi 的可用 skill 列表里（已实测：`pi -p` 列出的 skill 只有 auto-invocable 那几个，`bg-run` 不在其中），`/skill:bg-run` 显式调用则正常加载全文。
- **`AGENTS.md` 记录了这个能力的定位与它和 `sub-dispatch` 的分工**，但 `APPEND_SYSTEM.md` 不变。
- **Herdr 的使用姿势在本仓库有了一份自己的副本**（skill 里的浓缩 SOP）。它是快照，不是 Herdr 官方文档；Herdr 改了命令面，这段会过期。与 `~/.agents/skills/herdr/` 里那份的关系是"降级兜底"——那份不在本仓库、也不保证每台机器都有。
- **后台运行会持续消耗 token。** skill 规则第 3、4 条要求：派发后告诉用户去看什么；结果不需要时（fire-and-forget）就不要再"顺手 capture 一下"。跑起来的东西活过会话，这是它的价值，也是它的代价。
- **`~/.cache/bg-run/<name>/` 是唯一的完成事实来源。** `out.log` 与 `rc` 由包装层写，不由 agent 写、不由人改。`bg list` 只列本 skill 自己的运行，`bg kill` 只接受名字——不越界杀别人起的东西。

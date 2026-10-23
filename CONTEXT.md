# Pi Workflow, Track & Wayfinder

This context defines the local workflows maintained in this dotfiles repo for Pi. It distinguishes decision-oriented wayfinding (Wayfinder), execution orchestration (Workflow runtime), freeform working memory (Track), and unattended nightly execution (Nightshift) so future prompts, skills, and automation use consistent terms.

## Language

**Wayfinder**:
A decision-oriented planning method for work that is still foggy. It maps a destination, unresolved decisions, and dependency edges before implementation starts.
_Avoid_: implementation plan, task runner, todo list

**Track**:
The shared, reset-able working-memory scratchpad managed by the standalone `track` extension — the freeform findings and progress narrative a session accumulates. Manually maintained: an agent reaches it through file references, not through the Compaction Summary. A stranger to the Workflow runtime: Runs keep their own structured progress logs, Track is the model's freeform memory.
_Avoid_: compaction source, goal history, permanent log, per-run notebook

**Compaction Summary**:
The text that replaces a compacted span of the conversation. It carries what the agent needs to keep going — the request line, next intent, topics, annotated file references — plus a retrieval handle pointing at the untouched session transcript. It is an orientation, not a replacement for history, and its length is fixed rather than a function of session length.
_Avoid_: Track dump, transcript paraphrase, session summary

**Retrieval Handle**:
The extension-written pointer inside a Compaction Summary that names the session transcript file on disk and gives a command that fetches from it. It is why a summary may drop detail: whatever is missing can be fetched back from the transcript.
_Avoid_: pointer, index reference, file list

**Next Intent**:
The single forward-looking statement in a Compaction Summary — what the agent does next and, when context is missing, what it must go recover first. It is written against the kept window as well as the skeleton, so it never describes a state older than the session it summarises. Replaced wholesale on every compaction, never appended to.
_Avoid_: next steps list, TODO, action items

**Compaction Fallback**:
The mechanical summary written in-band when no usable model summary can be produced — request line, file lists and the retrieval handle. Recorded in-band because Pi swallows extension exceptions, so an unrecorded failure is indistinguishable from success.
_Avoid_: failure record, silent fallback, built-in compaction fallback

**Compaction Skeleton**:
The one-line-per-message digest of a compacted span that the summary model reads instead of the raw transcript. Mechanical, bounded, and never the conversation itself.
_Avoid_: transcript, summary, context window

**Request Line**:
The recent user requests preserved inside a Compaction Summary. The intent of a session is scarce and short, so it is kept verbatim while the rest of the span is summarized.
_Avoid_: recent window, conversation tail, prompt history

**Compaction Notice**:
The one-time hint that the context window is filling up. Compacting stays a human decision; the notice never compacts by itself.
_Avoid_: auto compact, threshold, warning banner

**Summary Model**:
The model that writes a Compaction Summary. Configured separately from the session model, and never hardcoded.
_Avoid_: compaction model, default model
**Project**:
The repository scope that owns the local automation workspaces — the Workflow storage (`.pi/workflows/`), the Track scratchpad (`.pi/track/`), and a Wayfinder workspace. Many non-terminal Runs may coexist in a Project; nothing is exclusive.
_Avoid_: workspace (see Wayfinder Workspace), map, global account

**Local Skill**:
A Pi skill maintained inside this dotfiles repo for personal use on the current machine setup. It optimizes for local usefulness, not packaging or external distribution.
_Avoid_: package, product, shared extension

**Wayfinder Store**:
The per-repository storage that Personal Wayfinder owns outright, holding its Maps, its Tickets, and the dependency edges between them. It belongs to Wayfinder alone — it is not one store inside a general-purpose tracker — and the Workflow runtime is a stranger to it, keeping Definitions and Runs as flat files under `.pi/workflows/`.
_Avoid_: taskmd backend, general-purpose tracker, workflow storage backend

**Personal Wayfinder**:
A local Wayfinder variant that keeps the original decision-oriented method while removing team coordination ceremony. It recommends only the skills and prompts available in this repo.
_Avoid_: generic issue tracker workflow, full team-process port

**Wayfinder Workspace**:
The per-repository storage area for a Personal Wayfinder map and its tickets, stored at `~/.cache/wayfinder/<workspace-id>/` (workspace-id is a slug of the repo-root abs path). It is isolated from other repositories and kept out of version control.
_Avoid_: global tracker, shared inbox, project-local .pi directory

**Ticket**:
A Wayfinder child item that captures one decision, investigation, prototype, or other unit of planning work under a Map. It exists to be advanced through the Wayfinder flow, not maintained by hand.
_Avoid_: task, todo, card

**Ticket Type**:
The kind of a Ticket, and the one thing that distinguishes a Map from its children and a grilling from a setup. A Ticket has exactly one kind; anything about it that is not its kind is either a Channel or plain prose.
_Avoid_: tag, category, priority

**Ticket Channel**:
How a Ticket's answer is obtained: AFK, where the agent can reach it alone, or HITL, where a human must supply it. A HITL Ticket is never resolved by the agent, no matter how well it can guess.
_Avoid_: mode, owner, assignee, priority

**Ticket Machine Ownership**:
The metadata of a Ticket belongs to the tooling that owns the Wayfinder Store, not to whoever has the file open. A human edits a Ticket's prose; nobody hand-edits its metadata, and metadata that the tooling did not write is treated as a fault rather than a convenience.
_Avoid_: hand-editable frontmatter, wiki-style editing, free-form fields

**Active Map**:
The single Wayfinder Map in a repository that is currently being worked through. A repository may keep historical Maps, but only one Map may be active at a time.
_Avoid_: parallel map, shared active queue

**Current Ticket**:
The single Ticket the current personal workflow is actively advancing right now. It replaces the team-style owner concept with a lightweight in-progress marker.
_Avoid_: owner, assignee, team claim

**Setup Ticket**:
A Ticket type for manual preparation work that unlocks later decisions in Wayfinder. It is part of planning flow, not an implementation task.
_Avoid_: task, chore, planning task

**Map**:
The canonical overview object for a Wayfinder run. It carries the destination, planning notes, decisions so far, unresolved areas, and explicit out-of-scope items, and is distinguished from the Tickets beneath it by kind rather than by naming convention.
_Avoid_: generic task, plain backlog root, project board


**Map Template**:
The fixed section layout required in a Map body: `Destination`, `Notes`, `Decisions So Far`, `Not Yet Specified`, and `Out of Scope`. All sections must exist even when some are temporarily empty.
_Avoid_: freeform notes blob, ad-hoc headings, partial template

**Single-Ticket Session**:
A Wayfinder session should advance exactly one Current Ticket. Small research bursts are allowed only when they directly feed that same Ticket.
_Avoid_: multi-ticket drift, opportunistic backlog sweeping

**Parallel Research Burst**:
A set of read-only sub-agent explorations that run in parallel to answer one Current Ticket faster. They are allowed only when their results are merged back into that same Ticket and Map.
_Avoid_: parallel ticket advancement, detached side quests

**Capability-Aware Handoff**:
A handoff rule that recommends follow-on skills or prompts based on what the current repository and agent environment actually provide. It should not suggest unavailable skills as if they were standard Wayfinder defaults.
_Avoid_: hard-coded foreign skill lists, generic tool advice divorced from local capabilities

**Decision Double-Write**:
When a Ticket is resolved, its conclusion must be written both on the Ticket itself and into the Map's `Decisions So Far` section. The Ticket keeps local detail; the Map keeps global planning memory.
_Avoid_: single-location resolution notes, silent ticket closure

**Not Yet Specified**:
A formal Map section for questions or unknowns that have been identified but are not yet ready to become Tickets. It preserves fog of war without pretending the plan is already concrete.
_Avoid_: junk drawer notes, premature ticket explosion

**Out of Scope**:
A formal Map section for worthwhile directions that are explicitly excluded from the current Destination. It protects the Map from agent overreach and keeps those ideas from quietly entering the active frontier.
_Avoid_: silent scope creep, forgotten side ideas

**Wayfinder Ticket Directory**:
The directory inside a Wayfinder Workspace that holds every Ticket of that repository. It sits outside the repository, so nothing inside the repository needs ignoring.
_Avoid_: tasks directory, generic task store, repo-local .pi directory

**Active Map Status**:
An Active Map is the Map marked with `wayfinder:map` and `status=in-progress`. Historical Maps should move to completed or cancelled states instead of remaining active.
_Avoid_: pending active map, multiple in-progress maps

**Current Ticket Status**:
The Current Ticket is the single non-Map Ticket marked `status=in-progress`. Other candidate Tickets remain pending until they become the focus of a session.
_Avoid_: current tag, owner-based current marker

**Blocked Status**:
The `blocked` status is reserved for real exceptional blockers outside normal dependency waiting, such as missing permissions, broken environments, or absent external input. Ordinary unmet dependencies should remain `pending`.
_Avoid_: marking every dependent Ticket as blocked

**Lazy Wayfinder Initialization**:
A Wayfinder Workspace is created only when the user explicitly starts Wayfinder work, such as initializing the workspace or creating the first Map. Discussion alone should not create files.
_Avoid_: eager workspace creation, side-effectful planning chat

**Frontier Selection**:
When no Current Ticket exists, the next Ticket should normally be chosen by the agent from the unblocked pending frontier of the Active Map. If the user explicitly names a Ticket, that user choice takes priority over automatic selection.
_Avoid_: random ticket picking, ignoring explicit user choice

**Chart the Map**:
The Wayfinder mode used when no usable Active Map exists yet or a new destination must be charted. It defines the destination, opens the first planning Tickets, and shapes the initial fog boundary.
_Avoid_: implementation mode, backlog grooming

**Work Through the Map**:
The Wayfinder mode used when an Active Map already exists and the workflow should advance one Current Ticket from the frontier. It resolves decisions against the existing map instead of redrawing the destination from scratch.
_Avoid_: re-planning from zero, freeform execution mode

**Destination Shift**:
A major change in the goal an Active Map is trying to reach. When the destination shifts materially, the old Map should be closed and a new Map should be charted.
_Avoid_: endlessly mutating map identity, silent goal replacement

**Wayfinder Prompt Shortcut**:
A thin manual entrypoint such as `/wayfinder` that triggers the Personal Wayfinder skill. It should provide quick execution commands, not duplicate or redefine the core methodology owned by the skill.
_Avoid_: standalone methodology prompt, second source of truth

**Wayfinder Command Surface**:
The manual interface for Personal Wayfinder should be a single `/wayfinder` entrypoint with lightweight subcommands such as `chart`, `work`, or `status`. It keeps invocation unified while leaving methodology in the skill.
_Avoid_: many split prompt entrypoints, duplicated command families

**Wayfinder Smart Entry**:
A bare `/wayfinder` invocation should inspect the local Wayfinder state and route to the right next action, such as dependency setup, charting a new Map, or continuing work on the current frontier.
_Avoid_: dumb help-only default, forcing users to restate obvious context

**Ticket Template**:
Every Wayfinder Ticket should use the same lightweight body template: `Question`, `Why Now`, `Notes`, `Resolution`, and `Follow-ups`. The structure stays fixed even when some sections are temporarily empty.
_Avoid_: freeform ticket body, per-ticket improvisation

**Map Title Convention**:
A Map title should follow the fixed format `Wayfinder: <Destination>` so it is recognisable at a glance in a Ticket listing or Map Render.
_Avoid_: bare destination title, ambiguous map naming

**Ticket Title Convention**:
A Ticket title should stay human-readable and question-focused without type prefixes. Ticket type belongs in Wayfinder tags, not in the title text.
_Avoid_: `[Research]` prefixes, metadata-heavy ticket names

**Completed Ticket Status**:
A Ticket that has been answered reaches `completed` status even when the conclusion is negative or rules out a direction. `cancelled` is reserved for Tickets that lose relevance before resolution.
_Avoid_: using cancelled for answered questions, leaving resolved tickets pending

**Agent-Driven Operation**:
Personal Wayfinder is primarily operated by the agent through the tooling that owns the Wayfinder Store. The agent owns routine Map and Ticket updates instead of treating any viewing surface as the editing surface.
_Avoid_: web-first maintenance, manual-first tracker workflow

**Map Render**:
The human-facing inspection surface for a Wayfinder Workspace: a read-only view of the dependency edges and statuses among Tickets, produced by the tooling that owns the store rather than by the agent. It changes nothing — every state change goes through that tooling.
_Avoid_: web UI, dashboard, server, agent-drawn diagram

**Map Render Command**:
The manual command that produces a Map Render, run as `ticket map`. It is a viewing action only; it is not a separate methodology entrypoint, and it is not where a Ticket is changed.
_Avoid_: web UI command, dashboard server, split UI prompt family

**Wayfinder Init Command**:
`/wayfinder init` prepares a repository for Personal Wayfinder by checking prerequisites and creating the local workspace structure. It does not chart a Map by itself.
_Avoid_: auto-charting during init, implicit environment mutation without request

**Wayfinder Status Command**:
`/wayfinder status` reports the current Personal Wayfinder state without advancing work. It should summarize prerequisites, workspace health, the Active Map, the Current Ticket, and the visible frontier.
_Avoid_: hidden state mutation during status checks, forcing work progression when user asked for visibility

**Chart Topic Requirement**:
`/wayfinder chart` should take an explicit topic or destination input. If the command is invoked without one, the agent may clarify through grilling, but must not invent and chart a destination on its own.
_Avoid_: destination guesswork, silent auto-charting from vague intent

**Chart Clarification Gate**:
`/wayfinder chart` first runs a short clarification pass to lock the destination and its immediate boundary, then creates the Map. It should not write a Map from an unexamined topic.
_Avoid_: immediate file write on vague chart, long design workshop before first Map

**Wayfinder Exit Condition**:
Personal Wayfinder ends when the Destination is clear enough, the necessary decisions are recorded, the frontier no longer holds decision-blocking Tickets, and remaining work is primarily implementation rather than choice. At that point the Active Map should be closed and implementation-oriented planning may begin.
_Avoid_: endless wayfinding after decisions are clear, starting implementation while key choices remain foggy

**Ticket Parent Link**:
A Ticket points to its Map with a parent relationship. This means membership only: the Ticket belongs to that Map.
_Avoid_: treating parent as a blocking dependency

**Ticket Dependency**:
A dependency edge between Tickets means the downstream Ticket waits for the upstream Ticket to be resolved first. Dependency is the only relationship that shapes the frontier.
_Avoid_: depending on the Map itself, using parent as ordering

**Frontier**:
The set of unblocked pending Tickets under the Active Map that are ready to become the next Current Ticket. It is defined by membership, status, and satisfied Ticket dependencies.
_Avoid_: all open tickets, owner-based work queue

**Plan Don't Do**:
Personal Wayfinder produces decisions, clarified destinations, and map advancement — not implementation deliverables. Research, grilling, throwaway prototypes, and setup are allowed; production implementation of the destination itself is out of scope for Wayfinder.
_Avoid_: turning Tickets into build backlog, shipping production code under Wayfinder

**Wayfinder Artifact Layout**:
Personal Wayfinder lives as a generic skill at `skills/wayfinder/SKILL.md` (repo root, installed via `just install-skills`), with the store and command conventions in `skills/wayfinder/CONVENTION.md` and the `ticket` CLI that owns the store in `skills/wayfinder/cli/`, plus a thin prompt shortcut at `pi/agent/prompts/wayfinder.md`. Wayfinding state lives outside the repo at `~/.cache/wayfinder/<workspace-id>/`.
_Avoid_: single mega skill file, methodology inside the prompt

**Wayfinder Doc Language**:
Wayfinder skill and prompt documents are written in English for token efficiency and stable terminology. Human conversation may still be Chinese.
_Avoid_: full Chinese methodology docs, mixed bilingual instruction bodies

## Workflow (Orchestration Skeleton)

**Workflow**:
A human-started, resumable unit of work shaped as a linear Spine of Nodes. A Workflow only books state and recommends flow — it never executes node internals and never judges work quality. Domain-agnostic: SDLC patterns are one application, not a boundary.
_Avoid_: Goal, pipeline engine, autonomous process

**Definition**:
The maintained, human-reviewable text artifact describing one Workflow: its node list, each node's brief, type, and suggested skills/sub-agents. Drafted by AI, edited by hand, promotable from a good Run.
_Avoid_: template (use Definition or Pattern), code-defined workflow, DSL graph

**Pattern**:
A curated Definition shipped in the repo's pattern library (`pi/agent/patterns/`, e.g. feature / bugfix / perf), format-identical to any Definition. Starting a Run copies it into the project; promoting a good Run back (`save-as-template`) writes to the library — visible as a dotfiles git diff.
_Avoid_: built-in code, hardcoded flow, skill

**Run**:
One execution instance of a Definition, stored under `.pi/workflows/runs/` with node states, per-node session links, and a progress log. A Run is dormant whenever no Driving Session is attached — it never runs by itself.
_Avoid_: workflow (reserved for the concept), session, Goal

**Spine**:
The ordered, linear node list of a Workflow. No edges, no conditional branches; structural changes happen only as explicit Rerouting.
_Avoid_: graph, DAG, conditional edges

**Node**:
One entry/exit boundary on a Spine. A Node owns only its completion semantics; loops, parallel dispatch, and quality judgment live inside the Node — carried by the skills or sub-agents it suggests.
_Avoid_: task, stage, quality gate

**Auto Node**:
A Node executed by a fresh sub-agent session via dispatch (sub-dispatch). Completion is event-driven: the extension flips state on settle, logs progress with the child session id, and notifies the user; consecutive Auto Nodes cascade without asking.
_Avoid_: babysat dispatch, unattended cascade into Human Nodes

**Human Node**:
A Node whose work the user performs in their own session (grilling, wayfinding, review) and completes with an explicit command. The extension then logs progress and asks about the next Node — at session start of whichever fresh session the user opens next.
_Avoid_: workflow-owned gate, auto-completed step

**Rerouting**:
An explicit mid-Run change to the Spine — skip, insert, or replan (AI-proposed revision, human-approved). Every reroute appends its reason to the Run's progress log.
_Avoid_: silent mutation, conditional edge

**Driving Session**:
The pi session currently advancing a Run: it dispatches Auto Nodes, hosts Human Node commands, and stays deliberately thin — node work happens in sub-sessions or the user's hands, never in the driver's own context.
_Avoid_: orchestrator that executes, main session doing node work

**Focus**:
The per-session pointer to the Run that bare `/wf` commands target — defaults to the Run this session last interacted with. A cold-start Run picker (dismissible, injects nothing) sets it when a fresh session meets dormant Runs; sessions opened with a run already named in context preselect it.
_Avoid_: activation, exclusive lock, global current-run

## Element Picking（元素拾取）

Chrome 页面元素拾取工作流：Tampermonkey userscript（`web-picker.user.js`）手动连接 `/xfer broker`（本地 WS daemon，`broker-main.ts`），页面标注 + prompt 经 `annotation.submit` 帧以 xfer handoff 推入目标 pi session；反向为 session 侧经 broker 提问（页面 ask modal）。安装与排障见 `pi/agent/extensions/xfer/docs/web-picker.md`。

**pick**:
用户在页面上选中并记录的一个元素条目（selector、xpath、文本预览、rect、备注、源码位置等）。
_Avoid_: annotation、标注（pick-to-edit 的术语，本方案不采用）

**batch**:
一次"积攒 → 消费"循环中累积的全部 picks（含备注）。每个 batch 由 agent 一次性读取，读取后即清空，无版本号。
_Avoid_: version、轮询游标

**consume**:
发送（submit）该批 picks 后即清空本地 batch（sessionStorage）——提交即消费，无版本号。

**picker**:
userscript 在页面上的全部能力（`web-picker.user.js`）：shadow-DOM 隔离的 fab、hover 拾取、备注面板、send-to-agent 表单。无 CDP 注入——脚本由 Tampermonkey 安装，页面加载即挂载。
_Avoid_: CDP evaluate_script 注入、annotation server、本地 daemon

**fab / 悬浮按钮**:
picker 在页面上的唯一常驻形态——一个可拖动的悬浮按钮，点击后进入 pick 模式；顶部圆点显示 broker 连接状态（灰=未连接、琥珀=连接中、绿=已连接）。另有 ⇧⌥P / ⇧⌥L 快捷键。

**inject**:
userscript 页面加载时把 fab 挂上 shadow DOM 的动作（幂等），仅此一个动作，不进入 pick 模式、不读取存储。不再是 CDP `evaluate_script` 注入。

**pick 模式**:
点击 fab 后进入的选择交互态：hover 高亮、`[`/`]` 切层、Enter 选中+备注、⇧Enter/⇧click 把元素聚合成组（amber 虚线 mark，整组共用一条组备注）、Esc 退出回闲置（fab 常驻）。

**send-to-agent**:
向 broker 提交标注 + prompt 的动作：选择目标 session（`targets.list` → `~/.pi/xfer/*.sock`），以 `annotation.submit` 帧发送，broker 转成 xfer handoff 推入目标 session。prompt 可留空——留空时自动改用默认指令（逐条回应标注 note / 解释元素渲染逻辑）。
_Avoid_: chrome-devtools 驱动、直接写 session 存储

**ask-page（反向通道）**:
session 侧经 broker 向页面提问：`page.request` 帧 → 页面 ask modal（问题卡片）→ 回答以 `page.response` 帧回 broker，broker 再以 notify 推回提问 session。
_Avoid_: 轮询页面、页面主动拉取

## 子代理调度（Sub-agent Dispatch via Pi）

通过 `sub-dispatch` 扩展后台派发 pi 子代理的本地约定：非阻塞、通知驱动、子代理完成后自动回传，主进程不阻塞等待。

**Sub-agent Dispatch（后台派发）**:
通过 `sub-dispatch` 扩展的 `dispatch` 工具以 `background: true` 对子代理做的非阻塞调用。子代理完成后由扩展以 `triggerTurn` 唤醒主代理，输出已在上下文中。
_Avoid_: 前台 dispatch 做并行、sleep 轮询等待、阻塞式等待

**Trigger Wake-up（triggerTurn 唤醒）**:
后台子代理完成时，sub-dispatch 扩展发出的通知事件（customType `sub-dispatch`，携带状态、退出码与输出尾部）。它恢复主代理的 turn，且子代理输出已载入上下文，主代理只需收集并综合。
_Avoid_: 状态轮询、sleep 循环、手动查询会话状态来“检查”

**Print Mode（pi -p 打印模式）**:
pi 子代理的 spawn 形式：pi 以非交互打印模式运行（由 `sub-dispatch` 扩展 `config.json` 的 `defaultArgs.pi: ["-p"]` 强制），完成后自然退出，正是它让完成通知得以触发。无 quiet-kill 误杀风险。
_Avoid_: 交互式 TUI 形式 `pi <prompt>`（永不退出，通知永不触发）

**End-turn Wait Discipline（结束 turn 等待纪律）**:
派发子代理后，主代理立即结束当前 turn，交由 triggerTurn 通知驱动后续。绝不许发出 `sleep N && echo`、sleep 后查询循环或轮询会话状态。
_Avoid_: sleep、轮询循环、在 turn 内手动查状态

**Sub-dispatch Config（sub-dispatch config.json）**:
仓库级 Pi 配置（`pi/agent/extensions/sub-dispatch/config.json`），统一设置 spawn 默认值（pi 以打印模式 `-p` 运行）与默认超时，是派发行为的唯一事实来源。skill 不应重复声明它已拥有的配置。
_Avoid_: 在 skill 内硬编码 pi 的 spawn 参数、重复配置

**Dispatch-oriented Skill（派发型 skill）**:
通过后台派发编排子代理的 skill（如 `impl-with-spawn`、`how`）。它必须内嵌等待纪律，而非假定读者已知。
_Avoid_: 半套 dispatch 模板、缺失等待纪律小节

**Dispatch Session（派发会话）**:
一次后台派发从启动到结算的完整生命周期实体，是派发可视性与后续管理的基本单位。结算（done / error / killed / timeout）即终结，不常驻。
_Avoid_: 子代理进程（口语可指代，正式术语用本词）、BgSession（实现名）、pi session（主会话）

**Extension-owned Visibility（扩展侧可视性）**:
派发的可视性（数量、时长、输出情况）由扩展程序侧实时呈现：程序截取输出与计时，零模型 token。编排 agent 不承担状态汇报或检查职责——这是 End-turn Wait Discipline 的另一面。
_Avoid_: 要求编排 agent 轮询检查、模型汇报状态、用 token 换可视化

**Dispatch Overview（派发总览）**:
运行中派发会话的常驻一眼视图：每个活跃会话一行（身份、状态、实时时长、最新输出预览行，均为程序截取）。结算行以终态短暂停留（约 5 秒余像）后消失；无会话时整体隐藏。它回答"现在派出了多少、跑了多久"。
_Avoid_: 翻消息流找状态、常驻完成列表、靠命令查询才能看到

**Output Peek（输出抽查）**:
对运行中派发会话输出的只读流式查看：可滚动浏览全量缓冲，无任何输入通道，会话结算时自动关闭。定位是抽查而非值班盯屏，与上游 pi-interactive-shell 的人工介入严格区分。
_Avoid_: 人工介入子代理、向子代理输入、常驻监控室

**Dispatch Record（派发档案）**:
派发会话结算后在聊天流中留下的终态档案：默认紧凑一行（身份、状态、退出码、总时长），全局展开模式下才显示完整输出 tail。它是唯一持久的原始输出副本（内存表清空后仍在）。
_Avoid_: 原始输出直接灌聊天流、常驻多行输出预览

**Single Dispatch Entry（派发单一入口）**:
子代理派发只经由编排 agent 调用 dispatch 工具完成；人的命令面（`/dispatch`）收敛为纯查看入口（会话选择器 → Output Peek），不承担派发。
_Avoid_: 命令行手动派发、绕过编排 agent 直派

## Code Mode（工具折叠模式）

pi 的 code-mode 扩展把工具目录折叠为单一 `run_code` 工具时的工作约定。

**Result Re-fetch（结果续读）**:
从 session 持久化的工具结果中按需取回被截断的 run_code 返回值分段。恢复路径无副作用重放——取段是纯读，区别于重跑程序。
_Avoid_: result pagination（暗示主动分页源）、re-run（重放副作用）、cache（无缓存语义）

## Nightshift（夜间批量执行）

一个脚本驱动的夜间待办队列：白天把已澄清的工作写成 Spec 上板，夜里由一个不依赖 Pi 宿主进程的 CLI 逐条派发 `pi -p` 子进程执行、验证、回写状态并归档。

**Nightshift**:
夜间批量执行机制的整体名字，指这套板子 + CLI + 技能的合称。它是一个队列，不是状态机：没有节点、没有分支、没有 Driving Session。
_Avoid_: 无人值守 workflow、夜间 Workflow Run、Ralph loop 框架

**Spec**:
板上的一条待办单元，由白天澄清产出、由 CLI 派发给一个实现 Agent。自带工作目录、目标变更、边界与验证标准，足够让一个零上下文的 Agent 独立执行。
_Avoid_: task、ticket、issue、card

**Board**:
单一全局的 Spec 存放处（`~/.cache/nightshift/board/`），跨所有工作目录共用一块板。它存在的理由就是跨项目排水，而不是每仓一个板。
_Avoid_: 每仓看板、全局 tracker、多板并行

**Serial Key**:
决定两条 Spec 能否同时执行的分组键，取值是 Spec 的工作目录（绝对路径规范化后的值）。同键严格串行，不同键可并行；它与 git 仓库边界无关，因此同一仓库的不同 Worktree 是两个可并行的键。
_Avoid_: repo 键、workspace 键、锁文件

**Nightshift Run**:
一次夜间排水从启动到退出的完整过程，捕获一个时间窗口与其派发记录。队列排空或窗口用尽即结束，不常驻、不轮询。
_Avoid_: daemon、守护进程、常驻服务

**Verifier**:
由一个全新的 Agent 会话仅凭只读工具对已提交工作做出的判决，是 Spec 是否通过的唯一权威来源。它不吃实现者的自述，也不修改代码。
_Avoid_: 自检、实现者自述、CI、单元测试

**Verdict**:
Verifier 输出的三值判决（pass / fail / verify-error）。其中 verify-error 表示验证本身没能跑完，属于流程故障，不属于代码失败。
_Avoid_: 退出码、测试结果、评分

**Report**:
Nightshift Run 结束后面向人的一份只读检查面，按"该看的顺序"列出每条 Spec 的 baseline 区间、提交数、Verdict 与下一步命令。它不合并、不推送、不改盘。
_Avoid_: dashboard、Web UI、通知

**Archive**:
已结束的 Spec 的存放处（`~/.cache/nightshift/archive/<日期>/`），按 Nightshift Run 的日期分批。失败项也必须进来：留在板上就会被下一夜自动重跑，那是无人察觉的烧钱循环。
_Avoid_: 历史看板、回收站、日志目录

**Baseline**:
派发前记录的 HEAD 提交，是早上检查成果的唯一锚点。Nightshift 不切分支、不建分支，因此"它改了什么"靠 `baseline..HEAD` 而不是分支名；丢弃不想要的结果就是回到 baseline。
_Avoid_: 起点分支、快照、tag

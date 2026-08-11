# Pi Goal, Track & Wayfinder Workflows

This context defines the local workflows maintained in this dotfiles repo for Pi. It distinguishes goal-driven execution (Goals and Track, via Goal Runtime) from decision-oriented wayfinding so future prompts, skills, and automation use consistent terms.

## Language

**Wayfinder**:
A decision-oriented planning workflow for work that is still foggy. It maps a destination, unresolved decisions, and dependency edges before implementation starts.
_Avoid_: implementation plan, task runner, todo list

**Goal Runtime**:
The execution-oriented Pi extension (`goal-runtime`) that manages Goals (durable, taskmd-backed implementation targets) and Track (the shared working-memory scratchpad) during implementation. It shares the taskmd backend with Wayfinder but keeps separate stores and tag families.
_Avoid_: wayfinder, roadmap engine, issue tracker

**Track**:
The shared, reset-able working-memory scratchpad managed by Goal Runtime — the freeform findings and progress narrative that accumulates execution context. Track is orthogonal to Goals: resetting it (`/track new`) clears the scratchpad without touching Goal records, and Track updates (`/track update`) run independently of goal lifecycle.
_Avoid_: goal history, permanent log, per-goal notebook

**Project**:
The repository scope that owns one Goal Runtime workspace and the Goals within it. A Project may hold many Goals, but only one Goal may be active at a time.
_Avoid_: workspace (see Wayfinder Workspace), map, global account

**Local Skill**:
A Pi skill maintained inside this dotfiles repo for personal use on the current machine setup. It optimizes for local usefulness, not packaging or external distribution.
_Avoid_: package, product, shared extension

**Taskmd Backend**:
The local task tracker used as shared storage by both Wayfinder (Maps, Tickets, dependency edges) and Goal Runtime (Goals, Stories, Tasks), exposed through taskmd's CLI and web UI. Each system uses its own store directory and tag family. It is an explicit prerequisite, not a built-in fallback.
_Avoid_: embedded database, custom UI core, wayfinder-only backend

**Personal Wayfinder**:
A local Wayfinder variant that keeps the original decision-oriented method while removing team coordination ceremony. It recommends only the skills and prompts available in this repo.
_Avoid_: generic issue tracker workflow, full team-process port

**Wayfinder Workspace**:
The per-repository local storage area for a Personal Wayfinder map and its tickets, stored by default at `.pi/wayfinder/`. It is isolated from other repositories and kept out of version control.
_Avoid_: global tracker, shared inbox, goal-runtime directory

**Ticket**:
A Wayfinder child item that captures one decision, investigation, prototype, or other unit of planning work under a Map. In taskmd it is stored as a task, but Wayfinder prose should call it a Ticket to avoid confusion with Goal Runtime Tasks.
_Avoid_: task, todo, card

**Task**:
The leaf execution unit under a Story in Goal Runtime — a one-commit-granularity work item with dependency edges and TDD markers, stored as a taskmd record. It is the parallelizable unit of implementation, distinct from a Wayfinder Ticket (decision unit) and from taskmd's generic storage primitive.
_Avoid_: ticket, wayfinder task, taskmd storage primitive

**Goal**:
A durable implementation target owned by Goal Runtime — an epic or feature expressed as a contract (objective, acceptance criteria, constraints, out-of-scope) and a design blueprint, decomposed into Stories and Tasks. A Project holds many Goals, each with its own identity; a Goal is retained after completion for traceability rather than consumed once. It is the spec-layer handoff target for Wayfinder (`Graduated → Goal`).
_Avoid_: ticket, todo, one-shot disposable feature

**Story**:
A vertical-slice breakdown layer of a Goal — an end-to-end deliverable with its own acceptance criteria, sitting between a Goal and its Tasks. A Goal is decomposed into Stories, and each Story into Tasks.
_Avoid_: epic, ticket, milestone, task

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
The canonical overview object for a Wayfinder run. It carries the destination, planning notes, decisions so far, unresolved areas, and explicit out-of-scope items, and is marked specially inside taskmd so it does not get confused with general-purpose tracker items.
_Avoid_: generic task, plain backlog root, project board

**Wayfinder Tag**:
A `wayfinder:*` tag used to mark taskmd records as part of the Personal Wayfinder workflow. Only records with these tags participate in map, ticket, and frontier logic.
_Avoid_: implicit membership, mixed untagged tracker items

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
The default taskmd storage directory inside a Wayfinder Workspace, stored at `.pi/wayfinder/tickets/`. The name follows Wayfinder's human-facing Ticket language instead of taskmd's generic task wording.
_Avoid_: tasks directory, generic task store

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
A Map title should follow the fixed format `Wayfinder: <Destination>` so it is easy to identify inside a general-purpose taskmd workspace.
_Avoid_: bare destination title, ambiguous map naming

**Ticket Title Convention**:
A Ticket title should stay human-readable and question-focused without type prefixes. Ticket type belongs in Wayfinder tags, not in the title text.
_Avoid_: `[Research]` prefixes, metadata-heavy ticket names

**Completed Ticket Status**:
A Ticket that has been answered reaches `completed` status even when the conclusion is negative or rules out a direction. `cancelled` is reserved for Tickets that lose relevance before resolution.
_Avoid_: using cancelled for answered questions, leaving resolved tickets pending

**Agent-Driven Operation**:
Personal Wayfinder is primarily operated by the agent through taskmd CLI commands. The agent owns routine Map and Ticket updates instead of treating the web interface as the main editing surface.
_Avoid_: web-first maintenance, manual-first tracker workflow

**Wayfinder Web UI**:
The taskmd web interface is the human-facing inspection and optional manual-override surface for a Wayfinder Workspace. It exists for visibility and occasional hand edits, and should be easy to launch from the `/wayfinder` prompt flow.
_Avoid_: agent backend, primary automation channel

**Wayfinder UI Command**:
The standard manual command for opening the human-facing taskmd interface should be `/wayfinder ui`. It is part of the prompt shortcut surface, not a separate methodology entrypoint.
_Avoid_: split web commands, separate UI prompt family

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
Personal Wayfinder lives as a local skill at `pi/agent/skills/wayfinder/SKILL.md`, with taskmd field and command conventions in `pi/agent/skills/wayfinder/TASKMD-CONVENTION.md`, and a thin prompt shortcut at `pi/agent/prompts/wayfinder.md`.
_Avoid_: single mega skill file, methodology inside the prompt

**Wayfinder Doc Language**:
Wayfinder skill and prompt documents are written in English for token efficiency and stable terminology. Human conversation may still be Chinese.
_Avoid_: full Chinese methodology docs, mixed bilingual instruction bodies

## Element Picking（元素拾取）

Chrome 页面元素拾取工作流：`pick-chrome-element.md` prompt + `pick-chrome-element.js` 注入脚本，配合 `open-chrome-pause.md`（先开 Chrome）使用，通过 chrome-devtools MCP 驱动。

**pick**:
用户在页面上选中并记录的一个元素条目（selector、xpath、文本预览、rect、备注、源码位置等）。
_Avoid_: annotation、标注（pick-to-edit 的术语，本方案不采用）

**batch**:
一次"积攒 → 消费"循环中累积的全部 picks（含备注）。每个 batch 由 agent 一次性读取，读取后即清空，无版本号。
_Avoid_: version、轮询游标

**consume**:
agent 读取 batch 并开始回复，即视为已接收该批 picks，随后清空 sessionStorage 中的这批数据。

**picker**:
注入到页面上的元素选择脚本（`pick-chrome-element.js`），Shadow DOM 隔离。
_Avoid_: pick-to-edit 的 annotation server、本地 daemon

**fab / 悬浮按钮**:
picker 注入到页面上的唯一形态——一个可拖动的悬浮按钮，点击后进入 pick 模式。无热键。

**inject**:
确保 fab 在页面上的动作（幂等），仅此一个动作，不进入 pick 模式、不读取存储。

**pick 模式**:
点击 fab 后进入的选择交互态：hover 高亮、`[`/`]` 切层、Enter 选中+备注、Esc 退出回闲置（fab 常驻）。

**preflight**:
prompt 执行前的连接预检——通过 `list_pages` 确认 chrome-devtools MCP 有可用页面，否则终止并提示用户先运行 `open-chrome-pause`。

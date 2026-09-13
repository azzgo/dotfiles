---
name: retro
description: Conduct an evidence-driven retrospective over AI agent sessions (any project, any agent). Use when the user asks for a retro / 复盘 / 回顾 of their work sessions.
disable-model-invocation: true
---

# Retro

Improve how the user and their agents work — not by opinion, but by reading what actually happened in recorded sessions.

**Scope**: the improvement target can be any project and any agent the user names, not just the repo this skill runs in. The dotfiles repo (where this skill is maintained) acts as the listening post; the retro can reach anywhere the evidence reaches.

**Deliverable is whatever the user decides**: a skill (via the `setup-*` skills when applicable), a rule in AGENTS.md, a hook, a workflow pattern example, a doc, a tooling change — or "nothing, just noted". Never presume the output format; the grilling session decides it.

## Process

### 1. Scope the retro

Ask (or infer) three things before touching evidence:

- **Which sessions?** A named session, the current one, a project, a date range, or "everything this week".
- **Which concern?** Open-ended ("what went wrong") or focused ("why do UI tasks keep looping", "where do tokens go").
- **Which projects / agents?** agentview indexes pi / cursor / zcode / codex / gemini alike; the user may want cross-agent comparison.

### 2. Gather evidence

**Preferred source — agentview MCP** (`search_sessions`, `search_content`, `list_sessions`, `get_session_overview`, `get_messages`, `get_usage_summary`): cross-agent, cross-project, persisted. Notes on degraded modes:

- `query_recall` (semantic/distilled) may be unavailable (`recall index is not available`) — fall back to lexical `search_sessions` / `search_content` without drama, and suggest running `agentsview embeddings build --store recall` once as a follow-up.
- Tool names are prefixed `mcp__agentview__` in some clients; the functions are the same.

**Fallback — the agent's own history.** If no agentview MCP is available (this skill may be read by agents other than pi — they can still retro), use whatever session history the running agent natively has: its own transcript, its session store on disk, its `/history` equivalent, or files the user points at. State plainly which source was used and its blind spots (e.g. own-transcript-only means no cross-agent view).

**What to extract**, per session or search pass — concrete, quotable facts, not vibes:

- repeated loops (same fix attempted, same failure returning)
- user corrections (where the user overrides the agent — these are steering failures)
- wasted work (long explorations that a pointer would have shortcut; expensive tool calls)
- what the user did manually afterwards (unsatisfied with the agent's result)
- recurring task shapes (candidates for a workflow pattern or skill)
- rule hits and rule misses (existing AGENTS.md / skill guidance followed, ignored, or missing)

### 3. Organise candidates

Group findings into improvement candidates, each with evidence links (session ids + quoted snippets) and a frequency/repetition count — repetition is the priority signal. Use these categories (from mattpocock's retro skill, plus one of ours):

- **Navigation** — hard-to-find info a pointer would fix
- **Automated checks** — a mistake a linter / test / hook should have caught
- **Coding standards** — a rule the review layer should enforce, drop, or clarify
- **Steering files** — AGENTS.md bloat, no-op instructions, misplaced content
- **Tool economy** — token-expensive calls that better tooling would avoid
- **Information access** — crucial info the agent never had (logs, readonly access)
- **Recurring patterns** — a repeated task shape worth distilling (this is the `setup-*` / pattern-library feed)

### 4. Grilling session (consensus gate)

Run a grilling interview over the candidates before acting. Skill-selection rule — **local first**: use the first grilling-type skill found in `<project>/.agents/skills/`, then `~/.agents/skills/`, then `~/.pi/agent/skills/`; otherwise interview inline (one question at a time, recommended answer offered each time).

Decide per candidate: act now / queue for later / drop. For "act now", decide the **form** together with the user — the evidence suggests candidates, the user owns the verdict.

### 5. Distil (per the consensus)

Execute each agreed item in whatever form was chosen:

- a project-tuned skill → `setup-code-review` / a future `setup-workflow` / hand-drafted, per the setup skills' rules (copy mode, local-first)
- a steering change → the target project's AGENTS.md (or this repo's, if that is the target)
- a mechanical guard → a hook, a CI check, or a lint rule
- a workflow shape → a Definition in the project, or an example refined in the dotfiles pattern library
- none of the above → record it in the retro summary and stop

Close with a short written summary: scope, evidence highlights, decisions, actions taken (with file paths), follow-ups left open.

## Strict Constraints

- **Evidence before opinion** — every candidate cites session evidence; no candidates from general principle alone.
- **Grilling is a hard gate** — no distillation before consensus, same as the setup skills.
- **Form follows the user** — "not everything should become a skill" is the default stance; push back only with evidence.
- **State your evidence source and its blind spots** — agentview cross-agent, own history single-agent; never present a limited view as complete.

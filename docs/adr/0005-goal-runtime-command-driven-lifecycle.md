# Goal lifecycle becomes command-driven; Track is the one auto surface

Status: accepted

## Context

The goal-runtime extension originally exposed six model-facing tools (`save_goal_draft`, `commit_goal`, `activate_goal`, `pause_goal`, `request_goal_review`, `verify_goal_result`): the orchestrating model validated inputs and flipped lifecycle phases by calling them. That left three problems:

- **Non-deterministic lifecycle.** Validation lived in tool bodies, and the model could call a lifecycle tool at the wrong moment or with wrong arguments; misfires showed up as bad phase flips that had to be repaired by hand.
- **Self-verification pressure.** `verify_goal_result` had to be registered in the orchestrating session (with a runtime `isChild` guard rejecting the orchestrator), so the orchestrator always *saw* the one tool that could seal its own work. A prompt-level "do not call this" is weaker than absence from the tool list.
- **Cold-start working memory.** The old strict "user-trigger-only" principle meant ordinary sessions injected no context at all, so the model started every session blind to Track (`findings.md` / `progress.md`) unless the user typed a `/track` command.

## Decision

- **The orchestrating session registers no goal tools at all.** The five lifecycle tools are removed. `verify_goal_result` is the sole survivor and is registered **only** in dispatched verifier child processes (`PI_GOAL_RUNTIME_CHILD=1`), so the orchestrator cannot even see (let alone call) it. Resolution of `in-review` stays bound to the independent verifier via the one-time `VERIFY_TOKEN`.
- **Lifecycle transitions move into `/goal` command handlers the USER runs** — `set` / `commit` (drafting → ready; validates contract + ≥1 Story + ≥1 Task) / `run` (proposal only; confirmation is the user running `activate`) / `activate <id> [ids]` (exclusive active + serial queue + auto Track reset) / `pause <reason>` / `review [<id>|nl]` (exact id → straight to in-review + verifier-dispatch prompt; NL → proposal) / `abandon` / `list` / `status` / `ui`. Handlers do deterministic validation plus Track side effects — no model in the loop for phase flips.
- **Drafting persistence is direct file editing**: the `/goal set` prompt directs the model to edit the Goal record file (frontmatter + body sections) with write/edit, replacing `save_goal_draft`.
- **Track is the one auto surface**: at the first conversation of a session the runtime auto-initializes Track when missing (equivalent of `/track new`) and injects it as persistent context; `/track update` additionally auto-runs every N turn ends (`PI_TRACK_UPDATE_EVERY`, default 20, `0` = off), skipped while drafting, while a verifier is pending in-review, and on turns a goal continuation just took over. Goal lifecycle itself stays strictly user-triggered.

## Consequences

- The user-facing command surface grows to `set / commit / run / activate / list / status / review / pause / abandon / ui`; `pi/README.md`, `pi/agent/skills/wayfinder/{README,SKILL}.md` and `pi/agent/prompts/wayfinder.md` are updated to match. ADR 0001's "`/goal run` auto-resets Track" line now reads `/goal activate`.
- Old tool names may still appear in stale conversation histories; calling them yields tool-not-found, which is harmless.
- Auto-Track means every project opened with pi gets a `.pi/track/` on first conversation — accepted as the intended UX of "working memory always in play".
- The old README principle "the runtime injects **no** context into ordinary sessions" is deliberately narrowed: goal lifecycle remains user-trigger-only; Track context is the single exception.

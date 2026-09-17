---
name: dotfiles-code-review
description: Project-tuned code review for this dotfiles repo — Spec drift vs pinned doc sources, Documentation Consistency, Removal Plan, Simplification. Sub-agents run as parallel background dispatches. Review-only.
disable-model-invocation: true
---

# Dotfiles Code Review

Multi-axis review of the diff against a fixed point, tuned for a **configuration repository** (no application code).

**Retained axes** (from setup grilling): **Spec** and **Documentation Consistency** (run as independent sub-agents), plus main-agent supplements **Removal Plan** and **Simplification**. **Dropped axes**: Standards/SOLID, Code Quality, Race Condition — this repo has no business code for them to catch.

**Core design**: Spec and Documentation Consistency run as **independent sub-agents** (parallel background dispatches via the dispatch tool — fire-and-forget, no sleep-and-poll; timeout and retry are the dispatch tool's responsibility, not the main agent's). The main agent then aggregates their findings and supplements with **Removal Plan** and **Simplification** analysis.

A change can pass one axis and fail another:
- A config change that does exactly what was asked but leaves `AGENTS.md` or `catalog.md` stale → **Spec pass, Documentation Consistency fail.**
- A doc edit that describes behaviour the diff doesn't implement → **Doc-Consistency pass, Spec fail.**

Reporting them separately stops one axis from masking the other.

**Dispatcher model** (applies to every step below that spawns a sub-agent):
- **Main agent is the sole dispatcher.** It fires all relevant sub-agents in one parallel `dispatch({ background: true })` batch, then ends its turn.
- **Never sleep-and-poll.** Each sub-agent's completion auto-notifies via `triggerTurn`.
- **Sub-agents are static workflows.** No nested dispatch.
- **`timeout` and retry are the dispatch tool's responsibility.** Defaults: `timeout: 300`, retry once with a sharper prompt on transient failure.

---

## Process

### 1. Pin the fixed point

The user supplies a fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they don't specify one, use this auto-detection chain:

1. `git diff` (working tree vs index)
2. If empty → `git diff --cached` (index vs HEAD)
3. If both empty → report "no changes to review" and ask the user if they want to specify a path or commit range

When the user does supply a fixed point, capture the diff command: `git diff <fixed-point>...HEAD` (three-dot). Also note commits via `git log <fixed-point>..HEAD --oneline`.

Before proceeding, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty.

### 2. Identify the spec source

The "spec" in this repo is what the change claimed it would do, plus the curated docs that state intent:

1. **Commit messages** — `git log <fixed-point>..HEAD` is usually the whole spec here (e.g. `feat(pi-navigator): /nav — curated capability router`).
2. **`docs/adr/`** — the decision record if the change touches a designed mechanism (extensions, workflow runtime, skills layout).
3. **`CONTEXT.md`** — the domain glossary; check the change doesn't redefine a term already defined there.
4. **Ask the user** — if none apply, the **Spec** sub-agent is **skipped** in step 5 (Doc-Consistency still runs).

### 3. Pinned documentation sources (no discovery needed)

The doc-consistency check has a **hard-coded fixed-point list** — do not re-discover:

| # | Source | What must stay in sync |
|---|---|---|
| 1 | `AGENTS.md` | 目录速览 vs actual root entries; justfile command list; skills 维护规则 description |
| 2 | `pi/agent/extensions/pi-navigator/catalog.md` | **Core.** New/renamed/removed skills, extension commands (`/wf`, `/track`, `/xfer`, `/nav`, …), patterns must be reflected |
| 3 | `skills/README.txt` and `pi/agent/skills/README.txt` | Every maintained skill recorded with source + date |
| 4 | `docs/adr/*.md` | ADR claims vs actual implementation |
| 5 | `README.md` | User-facing install entry points vs actual justfile targets |
| 6 | *(fallback)* other claim-bearing docs | Any README / guide in a touched directory |

**Mandatory trigger rule**: if the diff touches any path under `pi/` or `skills/`, the `catalog.md` check (source #2) is **mandatory regardless of the step-4 trigger computation**, and the final report carries a dedicated `## catalog.md Sync` section (may read "(in sync)").

### 4. Decide the Documentation Consistency trigger

Compute `doc_check_triggered = true` if the diff touches any of:

- paths matching `*.md` / `*.txt` / `README*`
- paths under `docs/`, `skills/`, `pi/` (the `pi/` / `skills/` case also fires the mandatory `catalog.md` section)
- justfile recipe additions/removals/renames
- file or directory additions/removals/moves at the repo root (the 目录速览 set changed)
- symlink targets changed in any `justfile` install recipe

User override: invocation phrases like "force doc check" / "重点关注文档一致性" force `true`.

The Doc-Consistency sub-agent re-performs this trigger check internally as a defensive double-check; on failure it returns `no documentation-relevant change` and the verbatim section records that.

### 5. Spawn sub-agents (parallel background dispatches)

Fire all relevant sub-agents in **one parallel tool-call batch** with `background: true`, then **end your turn**.

| Sub-agent | Fired when |
|---|---|
| Spec | only if a spec was located in step 2 |
| Documentation Consistency | only if `doc_check_triggered = true` (step 4) |

Each dispatch:

```typescript
dispatch({
  agent: "pi",
  prompt: "<sub-agent prompt incl. READ-ONLY constraint>",
  background: true,
  reason: "subagent-N: <focus>",
  timeout: 300,
})
```

**Read-only constraint** — include verbatim in every sub-agent prompt:

> You are strictly forbidden from creating, modifying, or deleting any file; running write-operation commands (`mkdir`, `touch`, `rm`, `cp`, `mv`, `git add/commit`, output redirection, etc.); or using any file editing tools. Your tools are limited to grep / glob / read / read-only shell (`ls`, `git log`, `git diff`, `cat`, `find`).

**Why independent**: the Spec sub-agent should not know whether docs match the change, and vice versa.

**Model selection**: per `spawn-model-selection`, sub-agents use the **simple / mechanical** tier (`minimax-cn/MiniMax-M2.7` → `openrouter/xiaomi/mimo-v2.5` → `deepseek/deepseek-v4-flash`). Confirm availability via `pi --list-models` before each batch. Always pass `provider/model` — bare ids fail when multiple providers share the name.

**Handling large diffs**: split by top-level directory into batches and review each batch through both axes before aggregating.

#### Spec sub-agent prompt

Include:
- The diff command, commit list, and the diff output (or batch).
- The spec material (commit messages / ADR / CONTEXT.md excerpt).
- The brief:
  > "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep — e.g. config changes bundled beyond the stated intent); (c) items that look implemented but where the implementation contradicts the ADR or CONTEXT.md glossary (check term usage). Quote the spec line for each finding. Under 400 words."

#### Documentation Consistency sub-agent prompt

```
=== READ-ONLY CONSTRAINT ===
(verbatim constraint above)

=== FIXED POINT ===
fixed_point: <commit/branch>
diff_command: git diff <fixed-point>...HEAD
commit_list: git log <fixed-point>..HEAD --oneline
diff_output: <full diff>

=== TRIGGER CHECK ===
If the diff touches none of: *.md / *.txt / README*; docs/; skills/; pi/;
justfile recipe changes; root-level file/directory additions or removals;
symlink target changes in install recipes — return exactly:
  "no documentation-relevant change"
and exit.

=== PINNED DOC SOURCES (check in this order) ===
1. AGENTS.md — 目录速览 vs root entries; justfile command list; skills 维护规则
2. pi/agent/extensions/pi-navigator/catalog.md — skills / extension commands / patterns sync  ← CORE
3. skills/README.txt, pi/agent/skills/README.txt — every maintained skill recorded
4. docs/adr/*.md — ADR claims vs implementation
5. README.md — install entry points vs justfile targets
6. fallback — READMEs in touched directories

=== BOUNDARY RULES ===
DO report — docs contradicting each other, docs vs the diff's actual behaviour,
docs vs justfile-declared targets/commands.
DO NOT report — functional-spec gaps (Spec axis), dead config (Simplification),
removal follow-through (Removal Plan axis).

=== OUTPUT FORMAT ===
## Documentation Consistency
### A. 文档间不一致
- **[fileA]:line** vs **[fileB]:line** — description
  - Impact (P0–P3) / Suggested direction
### B. 文档与实际改动不一致
- **[doc-file]:line** says X, but **[changed path]** does Y
  - Impact / Suggested direction
### C. 文档与 justfile 不一致
- **[doc-file]:line** claims X, but justfile defines Y
  - Impact / Suggested direction
(For each class with no finding, write "(none)". Every finding must cite file:line.)

=== BRIEF ===
First perform TRIGGER CHECK; if triggered, scan the pinned sources per BOUNDARY RULES;
output per OUTPUT FORMAT, ≤ 800 words.
```

### 6. Main agent: aggregate + supplement

#### 6a. Collect sub-agent reports

Present each sub-agent's report verbatim or lightly cleaned — do **not** merge or rerank findings across axes. Keep them under separate `## Spec` and `## Documentation Consistency` headings, plus the `## catalog.md Sync` section when the mandatory trigger fired.

Per-section empty / failure rendering:

| Sub-agent outcome | Verbatim section content |
|---|---|
| Spawned and reported normally | the sub-agent's report, verbatim |
| Trigger check failed (Doc-Consistency only) | `(no documentation-relevant change in diff)` |
| Spec missing (Spec only) | `(no spec available)` |
| Dispatch errored / retry exhausted | `(sub-agent failed: <error>)` — and add to `## Assumptions / Not Covered` |

#### 6b. Removal Plan

Read `references/removal-plan.md`. Identify config, files, symlinks, or docs in the diff that remove, deprecate, or replace existing behaviour. In this repo removals have **paired cleanups** — check each removal for:

- install recipe (`justfile`) still referencing the removed item
- `AGENTS.md` 目录速览 / 维护规则 mentioning it
- `pi-navigator` `catalog.md` still routing to it
- the relevant `README.txt` (skills dirs) still listing it
- stale symlinks the install recipes would create on a fresh machine

Classify each item: **Safe to Remove Now** / **Defer Removal** (with migration + rollback), using the reference file's templates.

#### 6c. Simplification Opportunities

Scan the diff for config or docs that could be simpler without changing behaviour:

- dead config: aliases, keymaps, plugin entries, env vars no longer reachable
- duplicated settings across sibling configs (nvim/vim, alacritty/ghostty)
- docs restating what a neighbouring doc already says correctly
- speculative scaffolding in extensions/scripts

Apply the four principles (preserve functionality, apply repo conventions, enhance clarity, maintain balance). **Non-blocking by default.**

#### 6d. Optional verification (no hard gates)

This repo has no lint/test/typecheck gates. Suggest, only when the diff's paths warrant:

| Diff touches | Suggested check |
|---|---|
| `nvim/**` | `just nvim-health` |
| `pi/agent/extensions/track*` | `just test-track` |
| `justfile` install recipes | `just info` |

Report each as `not run` (review-only) with the suggested command — never fabricate a pass/fail.

### 7. Output format

Sub-agent reports stay separate. The aggregated `Findings (P0–P3)` section covers Removal Plan and Simplification findings plus high-severity cross-references from sub-agent reports (tagged `[Spec]` / `[Doc-Consistency]` / `[Removal]` / `[Simplification]`).

**Visual presentation**: per the shared **`show-me`** skill, where a finding is clearest as a diff, tree, or config-shape sketch, show it in that form — real paths, one visual per point.

```markdown
## Code Review Summary

**Scope**: [git diff / git diff --cached / <fixed-point>...HEAD]
**Files reviewed**: X files
**Overall assessment**: [APPROVE / REQUEST_CHANGES / COMMENT]

---

## Spec

<verbatim sub-agent report, or "(no spec available)">

## Documentation Consistency

<verbatim sub-agent report, "(no documentation-relevant change in diff)",
or "(sub-agent failed: <error>)">

## catalog.md Sync

<only when the pi/ or skills/ trigger fired: catalog.md sync verdict against the
diff — "(in sync)" or specific gaps>

---

## Findings (Aggregated)

### P0 - Critical
### P1 - High
### P2 - Medium
### P3 - Low

---

## Removal / Iteration Plan

- Safe to Remove Now
- Defer Removal (with migration + rollback)

## Simplification Opportunities

(none or list, non-blocking; include path, why it is simpler, and the safe direction)

## Optional Verification

- [not run] `just nvim-health` — diff touches nvim/**
- ...

## Assumptions / Not Covered

## Next Steps
1. Fix all P0 and P1 items
2. Fix selected items
3. Review only, no changes
```

### Axis/section boundary rules

- **Spec / Doc-Consistency sections** — verbatim sub-agent reports; never merged into the aggregated section.
- **Findings (P0–P3)** — Removal / Simplification items, plus tagged high-severity cross-references.
- **Simplification** — always non-blocking; real defects move to severity sections.
- **Empty / failure rendering** — see the 6a table; never fabricate a report.

---

## Strict Constraints

- **Review-only by default** — do not change files unless the user explicitly asks.
- **No fabricated rules** — every conclusion traceable to a pinned doc source, the ADR/glossary, or a repo fact.
- **Pinned sources are authoritative** — check `catalog.md` and `AGENTS.md` directly at the hard-coded paths; no discovery chains (the fallback row is the only exception).
- **Don't merge the axes** — sub-agent reports stay distinct; aggregated items carry source-axis tags.
- **catalog.md is a mandatory trigger** — `pi/` or `skills/` diff paths force the `## catalog.md Sync` section.
- **No hard quality gates** — verification is suggestion-only; never report a fabricated pass/fail.
- **Extend context when needed** — read full files when a hunk is insufficient; note the expansion.
- **Word limits** — Spec ≤ 400, Doc-Consistency ≤ 800; supplementary sections focused but complete.
- **Sub-agents are static workflows** — no nested dispatch; main agent is the sole dispatcher.
- **Never sleep-and-poll** — completion auto-notifies via `triggerTurn`.
- **`timeout` and retry belong to the dispatch tool** — default `timeout: 300`, retry once on transient failure.

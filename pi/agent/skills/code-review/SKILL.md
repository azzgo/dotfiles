---
name: code-review
description: Multi-axis code review — Standards, Spec, Documentation Consistency. Three sub-agents run as parallel background dispatches (fire-and-forget). Review-only.
disable-model-invocation: true
---

# Code Review

Three-axis review of the diff against a fixed point, with supplementary dimensions added during aggregation.

**Core design**: Standards, Spec, and Documentation Consistency run as **independent sub-agents** (parallel background dispatches via the dispatch tool — fire-and-forget, no sleep-and-poll; timeout and retry are the dispatch tool's responsibility, not the main agent's) so they don't pollute each other's context. The main agent then aggregates their findings and supplements with **Code Quality**, **Race Condition**, **Removal Plan**, and **Simplification** analysis.

A change can pass one axis and fail another:
- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what was asked but breaks conventions → **Spec pass, Standards fail.**
- Code that compiles and matches the spec but the README says it does something different → **Spec pass, Standards pass, Documentation Consistency fail.**

Reporting them separately stops one axis from masking the other.

**Dispatcher model** (applies to every step below that spawns a sub-agent):
- **Main agent is the sole dispatcher.** It fires all relevant sub-agents in one parallel `dispatch({ background: true })` batch, then ends its turn.
- **Never sleep-and-poll.** Do not call `sleep N && dispatch({ sessionId })`. Each sub-agent's completion auto-notifies via `triggerTurn`.
- **Sub-agents are static workflows.** They do not dispatch further sub-agents internally. Nested dispatch is forbidden (token budget and stop semantics become hard to reason about, and dynamic workflows inside a static review pipeline buy little).
- **`timeout` and retry are the dispatch tool's responsibility**, not the main agent's. Defaults: `timeout: 300`, retry once with a sharper prompt on transient failure.

---

## Process

### 1. Pin the fixed point

The user supplies a fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they don't specify one, use this auto-detection chain:

1. `git diff` (working tree vs index)
2. If empty → `git diff --cached` (index vs HEAD)
3. If both empty → report "no changes to review" and ask the user if they want to specify a path or commit range

When the user does supply a fixed point, capture the diff command: `git diff <fixed-point>...HEAD` (three-dot, compares against the merge-base). Also note commits via `git log <fixed-point>..HEAD --oneline`.

Before proceeding, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty.

### 2. Identify the spec source

Look for the originating spec in this order:

1. **Commit messages** — Scan `git log` for references like `Closes #123`, `implements XYZ`, or a conventional-commit scope that names a feature. Extract the likely requirement.
2. **User-provided path** — If the user passes a file path to a spec/PRD/story, read it directly.
3. **Repo spec directories** — Look under `docs/`, `specs/`, `.scratch/`, or any project-specific spec location for files matching the branch name, feature name, or commit scope.
4. **Ask the user** — If nothing is found, ask where the spec is. If they say there isn't one, the **Spec** sub-agent is **skipped** in step 5 (Standards and Documentation Consistency still run, as they don't depend on the spec).

### 3. Identify the standards sources

Find anything in the repo that documents code conventions:

- **`AGENTS.md`** (root and nested) — the de-facto agent-ecosystem standard for coding rules.
- `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `STYLE_GUIDE.md`
- Linter config with documented rules, or a team wiki page checked into the repo.

On top of whatever the repo documents, the Standards axis always carries two fixed baselines:

- **Fowler 12 smell baseline** (below) — code-shape smells.
- **SOLID principles** (`references/solid-checklist.md`) — responsibility/boundary smells. SOLID and Fowler smells overlap partially but are **not interchangeable**: LSP / ISP / DIP have no Fowler equivalent and must be checked independently.

Three rules bind both baselines:

- **The repo overrides.** A documented repo standard always wins; where it endorses something a baseline would flag, suppress the finding.
- **Skip anything tooling already enforces.** If a linter/formatter/type-checker already catches a rule, don't re-flag it in review — that's noise.
- **Always a judgement call.** Each smell/principle is a labelled heuristic, never a hard violation.

#### Fowler Smell Baseline (Refactoring, ch.3)

| Smell | What to look for | Direction |
|---|---|---|
| **Mysterious Name** | A function, variable, or type whose name doesn't reveal what it does or holds | Rename it; if no honest name comes, the design's murky |
| **Duplicated Code** | The same logic shape appears in more than one hunk or file in the change | Extract the shared shape, call it from both |
| **Feature Envy** | A method reaches into another object's data more than its own | Move the method onto the data it envies |
| **Data Clumps** | The same few fields or params keep travelling together | Bundle them into one type, pass that |
| **Primitive Obsession** | A primitive or string standing in for a domain concept that deserves its own type | Give the concept its own small type |
| **Repeated Switches** | The same `switch`/`if`-cascade on the same type recurs across the change | Replace with polymorphism, or one map both sites share |
| **Shotgun Surgery** | One logical change forces scattered edits across many files in the diff | Gather what changes together into one module |
| **Divergent Change** | One file or module is edited for several unrelated reasons | Split so each module changes for one reason |
| **Speculative Generality** | Abstraction, parameters, or hooks added for needs the spec doesn't have | Delete it; inline back until a real need shows |
| **Message Chains** | Long `a.b().c().d()` navigation the caller shouldn't depend on | Hide the walk behind one method on the first object |
| **Middle Man** | A class or function that mostly just delegates onward | Cut it, call the real target direct |
| **Refused Bequest** | A subclass or implementer that ignores or overrides most of what it inherits | Drop the inheritance, use composition |

### 3b. Identify the documentation sources (new)

For the Documentation Consistency axis, gather the inputs the sub-agent will need. Use these grep patterns to seed each list — capture results as `docs_paths`, `manifests`, and `cli_surfaces` for use in step 5.

**User-facing docs** — the "A class" subject set and the "B / C class" reference set:
- `README*`, `CHANGELOG*`, `CONTRIBUTING*`, `LICENSE*` at the repo root
- `docs/**/*.{md,markdown,rst,txt}`, `adr/**/*.{md,markdown}`, `specs/**/*.{md,markdown}`
- Files bearing JSDoc / docstring / rustdoc — `grep -rE '^\s*(///|//!\s|/\*\*|## |""")' --include='*.{rs,ts,js,tsx,jsx,py,go,java,kt,swift}' .` and keep only files the diff actually touches or imports from

**Manifests** — the "C class" right-hand side (declarative commands / entry points):
- `justfile`, `package.json`, `Cargo.toml`, `pyproject.toml`, `Makefile`, `go.mod`, `pom.xml`, `build.gradle*`
- `*.yaml`, `*.yml`, `*.toml` under config directories (the diff itself shows which paths matter)

**CLI / API surfaces** — auto-extract from the diff for the "B class" check:
- Exported symbols — `git diff <fixed-point>...HEAD | grep -E '^[-+]\s*(export\s+)?(async\s+)?(function|const|let|var|class|interface|type|fn|pub\s+fn|def)\s+[A-Za-z_][A-Za-z0-9_]*'`
- CLI flag / subcommand changes — `grep -E '^[-+]\s*\.(option|argument|flag|subcommand)\(' diff` or `.add_argument(`
- Config schema field changes — `git diff | grep -E '^[-+]\s*[A-Za-z_][A-Za-z0-9_]*\s*[:=]'` against manifest files

### 4. Decide the Documentation Consistency trigger

Before firing dispatches, compute `doc_check_triggered`:

- **Default**: `doc_check_triggered = true` if the diff touches any of:
  - paths matching `*.md` / `*.markdown` / `*.txt` / `*.rst` / `CHANGELOG*` / `README*`
  - paths under `docs/` / `adr/` / `specs/`
  - lines containing renamed or deleted exported symbols
  - lines containing CLI flag / option / subcommand changes
  - lines containing manifest field changes (package.json / Cargo.toml / pyproject.toml / justfile)
  - lines containing config schema field changes
- **User override**: if the user's invocation contains "force doc check" / "重点关注文档一致性" / "review documentation" / similar natural-language signals, set `doc_check_triggered = true` regardless of diff content.

The Doc-Consistency sub-agent performs the same trigger check internally as a defensive double-check (cheap; avoids silent trust in the main agent's classification). If the sub-agent's own check fails, it returns `no documentation-relevant change` and the verbatim section records that — not an error.

### 5. Spawn three sub-agents (parallel background dispatches)

Fire all relevant sub-agents in **one parallel tool-call batch** with `background: true`, then **end your turn**. Each completion auto-notifies via `triggerTurn`; do not poll.

| Sub-agent | Reason field | Fired when |
|---|---|---|
| Standards | `subagent-1: standards` | always |
| Spec | `subagent-2: spec` | only if a spec was located in step 2 |
| Documentation Consistency | `subagent-3: doc-consistency` | only if `doc_check_triggered = true` (step 4) |

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

> You are strictly forbidden from creating, modifying, or deleting any file; running write-operation commands (`mkdir`, `touch`, `rm`, `cp`, `mv`, `git add/commit`, `npm install`, `pip install`, output redirection, etc.); or using any file editing tools. Your tools are limited to grep / glob / read / read-only shell (`ls`, `git log`, `git diff`, `cat`, `find`).

**Why independent**: the Standards sub-agent should not know whether the code matches the spec, and vice versa — otherwise "the code does what was asked" can mask "the code breaks conventions" (or the reverse). Documentation Consistency is independent of both: it answers a different question ("do the user-facing docs still match the diff and each other?").

**Model selection**: per `spawn-model-selection`, all three sub-agents use the **simple / mechanical** tier (`minimax-m2.7` → `opencode/mimo-v2.5` → `deepseek-v4-flash`). Confirm availability via `pi --list-models` before each batch.

**Handling large diffs**: if the diff is large, split it by module / directory into batches and review each batch through both / all three axes before aggregating.

#### Standards sub-agent prompt (existing, unchanged)

Include in the prompt:
- The full diff command, commit list, and the diff output (or batch).
- The list of standards-source files you found, **plus the Fowler smell baseline from step 3 pasted in full**, **plus the SOLID checklist pasted in full** — the sub-agent has no other access to them.
- The brief:
  > "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); (b) any Fowler baseline smell you spot: name it and quote the hunk; (c) any SOLID violation: name the principle and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells and SOLID findings are always judgement calls, and a documented repo standard overrides both. Skip anything tooling already enforces. Under 500 words."

#### Spec sub-agent prompt (existing, unchanged)

Include in the prompt:
- The diff command, commit list, and the diff output (or batch).
- The path or fetched contents of the spec (or extracted requirement from commit messages).
- The brief:
  > "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent entirely — the `## Spec` verbatim section in the final report is `(no spec available)`, and `## Assumptions / Not Covered` gains a one-line entry `- Spec sub-agent skipped: no spec located at <search paths>`.

#### Documentation Consistency sub-agent prompt (new)

```
=== READ-ONLY CONSTRAINT ===
(verbatim constraint above)

=== FIXED POINT ===
fixed_point: <commit/branch>
diff_command: git diff <fixed-point>...HEAD
commit_list: git log <fixed-point>..HEAD --oneline
diff_output: <full diff>

=== TRIGGER CHECK ===
If the diff contains none of: paths matching *.md / *.markdown / *.txt / *.rst /
CHANGELOG* / README*; paths under docs/ / adr/ / specs/; renamed or deleted
exported symbols; CLI flag / option / subcommand changes; manifest field changes;
config schema field changes — return exactly:
  "no documentation-relevant change"
and exit. Do not report findings.

=== DOCUMENT SOURCES ===
docs_paths: <from step 3b>
manifests: <from step 3b>
cli_surfaces: <from step 3b>

=== BOUNDARY RULES (avoid overlap with Standards / Spec) ===
DO report — three classes only:
- A. User-facing docs (README / CHANGELOG / docs/ / specs/ / ADR / JSDoc)
     contradicting each other.
- B. User-facing docs vs the diff's changed code behavior.
- C. User-facing docs vs manifests' declared commands / entry points.

DO NOT report — these belong to other axes:
- AGENTS.md / CONTRIBUTING.md / linter config vs code  → Standards
- Spec (functional requirement) vs code                 → Spec
- Code smells / Fowler smells / SOLID violations        → Standards
- Dead code / simplification opportunities              → Simplification

=== OUTPUT FORMAT ===
## Documentation Consistency
### A. 文档间不一致
- **[fileA]:line** vs **[fileB]:line** — description
  - Impact / user-misled risk (P0–P3)
  - Suggested direction
### B. 文档与代码不一致
- **[doc-file]:line** says X, but **[code-file]:line** does Y
  - Impact
  - Suggested direction
### C. 文档与规范不一致
- **[doc-file]:line** claims X, but **[manifest-file]** defines Y
  - Impact
  - Suggested direction
(For each class with no finding, write "(none)". Every finding must cite file:line.)

=== BRIEF ===
You are the Documentation Consistency sub-agent. Independent of Standards / Spec.
First perform TRIGGER CHECK; if triggered, scan the three classes per BOUNDARY RULES;
output per OUTPUT FORMAT, ≤ 800 words.
```

### 6. Main agent: aggregate + supplement

This is where the skill adds coverage beyond the three axes.

#### 6a. Collect sub-agent reports

Present each sub-agent's report verbatim or lightly cleaned — do **not** merge or rerank findings across axes. Keep them under separate `## Standards`, `## Spec`, `## Documentation Consistency` headings.

Per-section empty / failure rendering:

| Sub-agent outcome | Verbatim section content |
|---|---|
| Spawned and reported normally | the sub-agent's report, verbatim |
| Trigger check failed (Doc-Consistency only) | `(no documentation-relevant change in diff)` |
| Spec missing (Spec only) | `(no spec available)` |
| Dispatch errored / retry exhausted | `(sub-agent failed: <error>)` — and add `- <axis> sub-agent failed: <error>` to `## Assumptions / Not Covered` |

#### 6b. Code Quality check

Read `references/code-quality-checklist.md`. Scan the diff for:
- **Error handling** — swallowed exceptions, overly broad catch, error leakage, missing handling, unhandled async rejections
- **Performance / caching / N+1** — hot-path waste, N+1 queries, missing pagination, cache strategy gaps
- **Null safety / boundary conditions** — missing null checks, truthy-falsy misuse, unchecked collection access, off-by-one

#### 6c. Race Condition check

Read `references/security-checklist.md` (race condition only). Scan the diff for concurrency hazards:
- Check-then-act (TOCTOU)
- Read-modify-write without synchronisation
- Missing transactions / locks / version checks / idempotency keys
- Multi-request windows (permission/state checks valid at read-time but expired before write)

For each finding, output using the structured template (Location / Scenario / Impact / Mitigation / Severity) from the reference file.

#### 6d. Removal Plan

Read `references/removal-plan.md`. Identify code in the diff that removes, deprecates, or replaces existing behaviour. Classify each item:
- **Safe to Remove Now** — no downstream consumers, or consumers already migrated in this change. No rollback risk.
- **Defer Removal** — needs migration window, backward-compat shim, feature flag, or co-existence period. Must include migration plan and rollback strategy.

Use the report templates from the reference file.

#### 6e. Simplification Opportunities

Scan the diff for code that could be made simpler without changing behaviour. Apply the **four principles** to decide whether to flag:

1. **Preserve functionality** — the suggestion must not change existing behaviour, public contracts, or test expectations.
2. **Apply project standards** — align with the repo's own conventions.
3. **Enhance clarity** — prioritise reducing understanding cost, not line count.
4. **Maintain balance** — don't sacrifice boundaries, abstraction, or maintainability for brevity.

Target patterns include:
- Dead code, redundant logic, speculative generality
- Overly deep nesting, long functions, mixed responsibilities
- Unclear naming, scattered related logic, excessive explanatory comments
- Nested ternary operators (suggest named variables, lookup tables, or early returns)

**Simplification findings are always non-blocking by default.** If a finding is actually a real defect, architecture violation, or concurrency risk, it belongs in the corresponding severity-bucketed section (Code Quality / Race Condition / Removal Plan) or in P0–P3, not in Simplification.

#### 6f. Quality Gate Status

Assess whether the diff would pass the project's standard verification commands. Report status as `pass` / `fail` / `unknown` for each gate:
- lint
- test
- typecheck

If you cannot determine pass/fail, say "unknown" and suggest the user run the verification.

### 7. Output format

The three sub-agent reports stay separate (per "don't merge the axes" principle). The aggregated `Findings (P0–P3)` section covers findings from the **supplementary dimensions** (Code Quality, Race Condition, Removal) plus any high-severity items the main agent deems worth cross-referencing from any sub-agent report — each such item is tagged with its source axis `[Standards]` / `[Spec]` / `[Doc-Consistency]` / `[Code Quality]` / `[Race]` / `[Removal]` so the origin is traceable.

```markdown
## Code Review Summary

**Scope**: [git diff / git diff --cached / <fixed-point>...HEAD]
**Files reviewed**: X files
**Overall assessment**: [APPROVE / REQUEST_CHANGES / COMMENT]

---

## Standards

<verbatim or lightly cleaned Standards sub-agent report>

## Spec

<verbatim or lightly cleaned Spec sub-agent report, or "(no spec available)">

## Documentation Consistency

<verbatim or lightly cleaned Doc-Consistency sub-agent report,
or "(no documentation-relevant change in diff)" if trigger failed,
or "(sub-agent failed: <error>)" if dispatch failed>

---

## Findings (Aggregated)

### P0 - Critical
1. **[path:line]** [Axis tag] Title
   - Why
   - Suggested fix

### P1 - High
...

### P2 - Medium
...

### P3 - Low
...

---

## Code Quality
(none or list — error handling / performance / null safety findings)

## Race Condition Risks
(none or list, structured: Location / Scenario / Impact / Mitigation / Severity)

## Removal / Iteration Plan
- Safe to Remove Now
- Defer Removal (with migration + rollback)

## Simplification Opportunities
(none or list, non-blocking; include path, why it is simpler, and the safe direction)

## Quality Gate Status
- lint: [pass / fail / unknown]
- test: [pass / fail / unknown]
- typecheck: [pass / fail / unknown]
- blockers: ...

## Assumptions / Not Covered
- Doc-Consistency sub-agent skipped: no trigger signal in diff
- Spec sub-agent skipped: no spec located at <search paths>
- <Axis> sub-agent failed: <error>  (only if a dispatch errored)

## Next Steps
1. Fix all P0 and P1 items
2. Fix selected items
3. Review only, no code changes
```

### Axis/section boundary rules

To keep the output non-redundant and each section's role clear:

- **Standards / Spec / Documentation Consistency sections** — verbatim sub-agent reports. Never edited into the aggregated section.
- **Findings (P0–P3)** — severity-ranked items from supplementary dimensions (Code Quality, Race Condition, Removal). May also cross-reference high-severity items surfaced by any sub-agent report, tagged with the source axis.
- **Code Quality / Race Condition / Removal sections** — full structured detail for those dimensions (the P0–P3 section may summarize, these sections hold the complete analysis).
- **Simplification** — always non-blocking. If a simplification candidate is actually a defect, move it to the appropriate severity section.
- **Empty / failure rendering of an axis section** — see step 6a table; never fabricate a report when none exists.

---

## Strict Constraints

- **Review-only by default** — do not change code unless the user explicitly asks for it.
- **No fabricated rules** — every conclusion must be traceable to a documented standard, the smell/SOLID baseline, or a code fact.
- **The repo overrides baselines** — a documented repo standard wins over Fowler smells and SOLID findings.
- **Skip tooling-enforced rules** — don't re-flag what a linter/formatter/type-checker already catches.
- **Don't conflate optimisations with defects** — Simplification Opportunities are independently reported and non-blocking by default.
- **Don't merge the axes** — Standards / Spec / Documentation Consistency reports stay distinct; the aggregated P0–P3 section tags items with their source axis rather than dissolving the distinction.
- **Extend context when needed** — if a diff hunk is insufficient to judge, read the full file(s); note the expansion in the report.
- **Word limits** — Standards sub-agent ≤ 500, Spec ≤ 400, Documentation Consistency ≤ 800. Supplementary sections stay focused but complete.
- **Sub-agents are static workflows** — no nested dispatch. Main agent is the sole dispatcher.
- **Never sleep-and-poll** — sub-agent completion auto-notifies via `triggerTurn`. Do not call `sleep N && dispatch({ sessionId })`.
- **`timeout` and retry belong to the dispatch tool**, not the main agent. Default `timeout: 300`, retry once on transient failure.
- **Doc-Consistency trigger is bounded** — only spawns when the diff touches docs/API/CLI/config schema or the user forces it. Defensive double-check inside the sub-agent prompt is allowed (and cheap).
- **Doc-Consistency boundary is exclusive** — AGENTS.md / CONTRIBUTING.md / linter config vs code is Standards; functional spec vs code is Spec; code smells are Standards; simplification is Simplification.

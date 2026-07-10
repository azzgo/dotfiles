---
name: code-review
description: Two-axis structured code review — Standards (does the code follow documented standards + the Fowler smell baseline + SOLID?) and Spec (does it match the originating requirement?). Both axes run as independent sub-agents to avoid cross-contamination; pick whatever sub-agent mechanism is available. The main agent then aggregates and supplements with code quality, race-condition analysis, removal plan, and simplification opportunities. Default review-only, does not change code.
---

# Code Review

Two-axis review of the diff against a fixed point, with supplementary dimensions added during aggregation.

**Core design**: Standards and Spec run as **independent sub-agents** (parallel when possible) so they don't pollute each other's context. The main agent then aggregates their findings and supplements with **Code Quality**, **Race Condition**, **Removal Plan**, and **Simplification** analysis.

A change can pass one axis and fail the other:
- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what was asked but breaks conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.

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
4. **Ask the user** — If nothing is found, ask where the spec is. If they say there isn't one, the **Spec** sub-agent skips and reports "no spec available".

### 3. Identify the standards sources

Find anything in the repo that documents code conventions:

- **`AGENTS.md`** (root and nested) — the de-facto agent-ecosystem standard for coding rules.
- `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `STYLE_GUIDE.md`
- Linter config with documented rules, or a team wiki page checked into the repo.

On top of whatever the repo documents, the Standards axis always carries two fixed baselines:

- **Fowler 12 smell baseline** (below) — code-shape smells.
- **SOLID principles** (`references/solid-checklist.md`) — responsibility/boundary smells. SOLID and Fowler smells overlap partially but are **not interchangeable**: LSP / ISP / DIP have no Fowler equivalent and must be checked independently.

Two rules bind both baselines:

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

### 4. Spawn both sub-agents (tool-agnostic)

Launch two independent sub-agents — **parallel when the environment allows it**. Pick whatever sub-agent mechanism is available (agent tool, dispatch, fork, etc.). If no sub-agent mechanism is available, the main agent runs the two axes in **two separate sequential passes**, keeping each axis's reasoning self-contained to avoid cross-contamination.

**Why independent**: the Standards sub-agent should not know whether the code matches the spec, and vice versa — otherwise "the code does what was asked" can mask "the code breaks conventions" (or the reverse).

**Handling large diffs**: if the diff is large, split it by module/directory into batches and review each batch through both axes before aggregating.

**Standards sub-agent prompt** — include:

- The full diff command, commit list, and the diff output (or batch).
- The list of standards-source files you found, **plus the Fowler smell baseline from step 3 pasted in full**, **plus the SOLID checklist pasted in full** — the sub-agent has no other access to them.
- The brief:

> "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); (b) any Fowler baseline smell you spot: name it and quote the hunk; (c) any SOLID violation: name the principle and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells and SOLID findings are always judgement calls, and a documented repo standard overrides both. Skip anything tooling already enforces. Under 500 words."

**Spec sub-agent prompt** — include:

- The diff command, commit list, and the diff output (or batch).
- The path or fetched contents of the spec (or extracted requirement from commit messages).
- The brief:

> "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Main agent: aggregate + supplement

This is where the skill adds coverage beyond the two axes.

#### 5a. Collect sub-agent reports

Present both reports verbatim or lightly cleaned — do **not** merge or rerank findings across axes. Keep them under separate `## Standards` and `## Spec` headings.

#### 5b. Code Quality check

Read `references/code-quality-checklist.md`. Scan the diff for:

- **Error handling** — swallowed exceptions, overly broad catch, error leakage, missing handling, unhandled async rejections
- **Performance / caching / N+1** — hot-path waste, N+1 queries, missing pagination, cache strategy gaps
- **Null safety / boundary conditions** — missing null checks, truthy-falsy misuse, unchecked collection access, off-by-one

#### 5c. Race Condition check

Read `references/security-checklist.md` (race condition only). Scan the diff for concurrency hazards:

- Check-then-act (TOCTOU)
- Read-modify-write without synchronisation
- Missing transactions / locks / version checks / idempotency keys
- Multi-request windows (permission/state checks valid at read-time but expired before write)

For each finding, output using the structured template (Location / Scenario / Impact / Mitigation / Severity) from the reference file.

#### 5d. Removal Plan

Read `references/removal-plan.md`. Identify code in the diff that removes, deprecates, or replaces existing behaviour. Classify each item:

- **Safe to Remove Now** — no downstream consumers, or consumers already migrated in this change. No rollback risk.
- **Defer Removal** — needs migration window, backward-compat shim, feature flag, or co-existence period. Must include migration plan and rollback strategy.

Use the report templates from the reference file.

#### 5e. Simplification Opportunities

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

#### 5f. Quality Gate Status

Assess whether the diff would pass the project's standard verification commands. Report status as `pass` / `fail` / `unknown` for each gate:

- lint
- test
- typecheck

If you cannot determine pass/fail, say "unknown" and suggest the user run the verification.

### 6. Output format

The two axes' raw reports stay separate (per Matt's "don't merge the axes" principle). The aggregated `Findings (P0–P3)` section covers findings from the **supplementary dimensions** (Code Quality, Race Condition, Removal) plus any high-severity items the main agent deems worth cross-referencing from the sub-agent reports — each such item is tagged with its source axis `[Standards]` / `[Spec]` / `[Code Quality]` so the origin is traceable.

```markdown
## Code Review Summary

**Scope**: [git diff / git diff --cached / <fixed-point>...HEAD]
**Files reviewed**: X files
**Overall assessment**: [APPROVE / REQUEST_CHANGES / COMMENT]

---

## Standards

<verbatim or lightly cleaned Standards sub-agent report>

## Spec

<verbatim or lightly cleaned Spec sub-agent report, or "No spec available">

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
- ...

## Next Steps
1. Fix all P0 and P1 items
2. Fix selected items
3. Review only, no code changes
```

### Axis/section boundary rules

To keep the output non-redundant and each section's role clear:

- **Standards / Spec sections** — verbatim sub-agent reports. Never edited into the aggregated section.
- **Findings (P0–P3)** — severity-ranked items from supplementary dimensions (Code Quality, Race Condition, Removal). May also cross-reference high-severity items surfaced by the sub-agent reports, tagged with the source axis.
- **Code Quality / Race Condition / Removal sections** — full structured detail for those dimensions (the P0–P3 section may summarize, these sections hold the complete analysis).
- **Simplification** — always non-blocking. If a simplification candidate is actually a defect, move it to the appropriate severity section.

---

## Strict Constraints

- **Review-only by default** — do not change code unless the user explicitly asks for it.
- **No fabricated rules** — every conclusion must be traceable to a documented standard, the smell/SOLID baseline, or a code fact.
- **The repo overrides baselines** — a documented repo standard wins over Fowler smells and SOLID findings.
- **Skip tooling-enforced rules** — don't re-flag what a linter/formatter/type-checker already catches.
- **Don't conflate optimisations with defects** — Simplification Opportunities are independently reported and non-blocking by default.
- **Don't merge the two axes** — Standards and Spec reports stay distinct; the aggregated P0–P3 section tags items with their source axis rather than dissolving the distinction.
- **Extend context when needed** — if a diff hunk is insufficient to judge, read the full file(s); note the expansion in the report.
- **Word limits** — sub-agent reports target ~400–500 words. Supplementary sections stay focused but complete.

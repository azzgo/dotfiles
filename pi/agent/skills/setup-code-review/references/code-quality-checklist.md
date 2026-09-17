# Code Quality Checklist

> General-purpose code quality review checklist covering error handling, performance, null safety, and boundary conditions. Not tied to any project.

## 1) Error Handling

### Issues to flag

- Swallowed exceptions: empty `catch` or only logs without re-throwing / returning failure
- Overly broad catch: catching `Error/Exception` as a catch-all that masks specific failure types
- Error leakage: exposing stack traces / internal implementation details to users
- Missing handling: no error handling on fallible paths such as I/O, network, parsing
- Missing async handling: unhandled promise rejection, missing `.catch()`

### Review questions

- Can the caller perceive a failure?
- Does the log carry enough context to locate the issue?
- Do recoverable failures have a fallback or retry strategy?

---

## 2) Performance / Caching / N+1

### Hotspots

- Repeated expensive operations on hot paths (repeated parse, encryption, complex regex)
- Synchronous blocking operations on the main request path
- Repeated computation without memoization / caching

### Data access & N+1

- Per-item queries in a loop (N+1) instead of batch queries
- Missing pagination loading the full dataset at once
- Over-fetching (`SELECT *` but only a few fields used)
- Missing index on key queries (when inferable from schema/index)

### Caching strategy

- Expensive results suitable for caching are not cached
- Cache exists but has no TTL
- Cache exists but has no invalidation strategy
- Cache key design is insufficient, causing collisions
- User data held in a global cache causing cross-user data leakage

### Review questions

- What happens at 10x / 100x data scale?
- Should this computation / query be cached or batched?
- Are there hidden N+1 patterns or repeated I/O?

---

## 3) Null Safety / Boundary Conditions

### Nulls & optionals

- Missing null/undefined checks with direct deep property access
- `if (value)` killing legitimate values (`0`, `''`, `false`)
- Excessive optional chaining masking structural design issues
- Inconsistent mixing of null/undefined semantics

### Collections & boundaries

- Empty arrays / empty objects not handled
- Reading `arr[0]` / `arr[arr.length - 1]` without length check
- Division by zero, negative values, out-of-bounds, off-by-one
- Strings not trimmed / not length-capped

### Review questions

- Is it stable when empty, zero, negative, or at the max boundary?
- Is failure behaviour controllable when input is missing fields or has extra fields?

## 4) Comments / Constraint Encoding

> A comment justifying code shape is a claim, not a fact. Adapted from pstack's no-comments skill: keep only constraints that are provably external, and prefer encoding constraints in structure over prose.

### Issues to flag

- Constraint comments ("do not remove", "do not change", "talk to X first") with no stated reason, or a reason that is actually a codebase-internal choice we control
- Comments that explain *what* the next line does (the code already says it); comments should carry intent, external contracts, or gotchas only
- Workaround comments ("hack", "temporary", "revisit later") with no linked issue or follow-up — a symptom guard bolted on instead of the root-cause fix
- Suppressed checks (eslint-disable, typeignore, nolint) without a scoped justification comment naming why the suppression is correct

### Review questions

- Is this constraint about something we cannot change (external API contract, protocol, data format owned elsewhere)? If not, the fix is to change the code, not to keep the comment
- Can this constraint be encoded mechanically instead — a lint rule, type, test, assertion, or CI check? If yes, propose encoding it, then deleting the comment
- If the comment must stay, does it say who owns the constraint and where it's documented?

### Severity guidance

- Suppressed checks guarding correctness/safety without justification: high
- Constraint comment on an internal choice blocking refactors: medium
- What-it-does narration comments: low (churn noise, flag in batches)

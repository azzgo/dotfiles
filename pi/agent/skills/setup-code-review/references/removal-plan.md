# Removal Plan (Safe vs Deferred + Rollback)

> General-purpose removal / migration plan framework. Identifies code in the diff that removes, deprecates, or replaces existing behaviour, and classifies it accordingly.

## Priority

- **P0**: remove immediately (high risk, blocks development, clearly wrong behaviour)
- **P1**: remove in the current iteration
- **P2**: schedule for a later iteration

---

## Safe to Remove Now

Can be classified as "safe to remove now" when:

- No references found via code search (including static and common dynamic paths)
- No external consumers (API/SDK/docs/scripts)
- Removal does not break any currently shipped capability
- Verifiable via existing tests or minimal regression

Report template:

| Field | Details |
|---|---|
| Location | `path/to/file.ts:line` |
| Rationale | reason for removal |
| Evidence | no references / deprecation flag / replacement already shipped |
| Impact | expected impact (None/Low) |
| Steps | delete code, clean up config/tests/docs |
| Verification | lint/test/typecheck + key-path regression |

---

## Deferred Removal (must include a plan)

Classify as deferred when:

- There are still active callers
- A migration window or cross-team coordination is needed
- Compatibility or gradual rollout strategy is involved

Report template:

| Field | Details |
|---|---|
| Location | `path/to/file.ts:line` |
| Why defer | reason for deferral |
| Preconditions | conditions before removal (e.g. usage is 0) |
| Breaking changes | contracts that may break |
| Migration plan | caller migration steps |
| Timeline | target iteration / date |
| Owner | responsible owner |
| Validation | observability metrics and acceptance criteria |
| Rollback plan | rollback path and trigger conditions |

---

## Rollback minimum requirements

- A clearly recoverable version / commit and recovery steps
- Clear rollback trigger conditions (error rate, core-path failure, data inconsistency)
- Clear post-rollback verification items (core APIs, key pages, logs/alerts)

---

## Pre-removal checklist

- [ ] Use `rg` to search the whole repo for references
- [ ] Check for dynamic / reflective calls
- [ ] Verify no external consumers depend on it
- [ ] Update tests and docs in sync
- [ ] Record risks and rollback plan in the review conclusion

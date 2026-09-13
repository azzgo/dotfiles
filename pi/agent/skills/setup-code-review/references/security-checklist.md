# Security Checklist (Race Condition Only)

> Covers only concurrency and race-condition risks. Does not block on a full OWASP / crypto / supply-chain review.

## 1) Shared State Concurrent Access

- Do multiple requests / tasks concurrently read-write shared state without synchronisation
- Do global singletons / in-process caches have concurrency visibility or overwrite issues
- Does lazy initialisation have a double-checked locking risk

## 2) Check-Then-Act / TOCTOU

- Is `if exists -> create/use` atomic
- Can authorisation state change during `if authorized -> perform`
- Is there a race window between a file/resource existence check and the subsequent operation
- Is the "check then deduct" on balance / inventory within the same atomic operation

## 3) Database Concurrency

- Does read-modify-write lack a transaction or lock
- Are counter updates using atomic updates
- Do concurrent inserts rely on unique constraints and conflict handling
- Is optimistic lock (version/updatedAt) or pessimistic lock (e.g. `FOR UPDATE`) missing

## 4) Distributed & Cache Races

- Does the cache invalidation / write ordering cause stale reads
- Is event ordering assumed by default (no idempotency / no out-of-order tolerance)
- Can retry requests cause duplicate writes (missing idempotency key)

---

## Review output requirements

For each race-condition risk, provide:

| Field | Content |
|---|---|
| Location | `path/to/file.ts:line` |
| Scenario | concurrent trigger scenario (how two requests enter simultaneously) |
| Impact | data error / privilege escalation / duplicate execution / state corruption |
| Mitigation | transaction, lock, atomic update, idempotency, version check, etc. |
| Severity | P0/P1/P2/P3 |

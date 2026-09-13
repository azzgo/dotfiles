# SOLID Principles Checklist

> General-purpose architecture review checklist, not tied to any project. Complements the Fowler smell baseline: smells identify "what the code looks like", SOLID asks "are the responsibility boundaries correct".

## SRP (Single Responsibility)

- Does a file/module simultaneously handle HTTP, business orchestration, and data access
- Does a module have more than one "reason to change"
- Are there overly long functions, god objects, or mixed cross-layer orchestration
- Key question: what is the single reason this module changes?

## OCP (Open/Closed)

- When adding a new variant, must multiple `if/switch` branches be modified
- Are variation points concentrated in the core flow rather than extension points (strategy/factory/hook)
- Key question: can new behaviour be added through extension rather than modifying existing core branches?

## LSP (Liskov Substitution)

- Does a subtype break the supertype contract (throwing unexpected exceptions, weakening return guarantees)
- Does the caller have to resort to `instanceof` / type branching to compensate
- Key question: can the caller substitute a concrete implementation transparently?

## ISP (Interface Segregation)

- Is the interface too wide, forcing implementers to provide empty / fake implementations
- Does the caller depend on a large interface while only needing a few methods
- Key question: can the interface be split into smaller contracts per call scenario?

## DIP (Dependency Inversion)

- Does high-level business logic directly depend on concrete database / network / framework implementations
- Is the lack of abstraction injection making business logic hard to replace or test
- Key question: can the underlying implementation be replaced without changing business logic?

---

## Relationship with the Fowler smell baseline

SOLID and the Fowler 12 smells overlap partially but are not interchangeable:

| SOLID | Corresponding Fowler smell (partial) |
|---|---|
| SRP | Divergent Change / Shotgun Surgery |
| OCP | Repeated Switches |
| LSP | Refused Bequest |
| DIP | (no direct correspondence) |

**LSP / ISP / DIP have no counterpart in the Fowler smell baseline** and must be checked independently via SOLID — they cannot be omitted.

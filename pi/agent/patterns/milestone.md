---
name: milestone
description: Land a milestone end to end — diverge on the feature list, settle each feature's design, implement and verify in iterate loops, then summarize as release-note material.
nodes:
  - id: brainstorm
    title: Diverge on the milestone feature list
    type: human
    suggest: [intake, grilling]
  - id: design
    title: Settle the implementation plan per feature
    type: human
    suggest: [grill-with-docs, wayfinder]
  - id: implement-and-verify
    title: Implement and verify in iterate loops
    type: human
    suggest: [impl-with-spawn, tdd, hunk-review, <project>-code-review]
  - id: summarize
    title: Write the milestone summary as release-note material
    type: auto
    suggest: []
---
## brainstorm
Diverge freely: collect candidate features, ideas, and known pain points that could belong
in this milestone. No filtering yet — breadth over depth. Then converge with the user on a
final, ordered feature list and record what is explicitly out of scope. If raw inputs exist
(PRDs, notes, links), file them with the intake skill; use the grilling skill for lightweight
discussion of ideas that need sharpening — no docs-based design work here, that belongs to
the next node.

done-when: a written milestone feature list exists and the user has approved it (out-of-scope items noted).
## design
Work through the feature list one by one. For each feature, grill the design against the
existing domain model until the implementation approach is concrete; use wayfinder when the
path forward is unclear. Each feature ends with a short written plan (approach, touched
areas, risks).

done-when: every feature on the milestone list has an agreed, written implementation plan.
## implement-and-verify
Implement the features per the settled plans, looping implementation and verification per
feature: dispatch a sub-agent to implement (impl-with-spawn), then verify the result — the
project's test suite, a code-review pass, and hunk-review for line-level judgment — before
moving to the next feature. Fix-ups loop inside this node until the user accepts. Follow
the project's own conventions throughout: branch model and commit granularity as stated in
its AGENTS.md / CONTEXT.md, and any generated or build artifacts that must be committed.

done-when: every feature on the milestone list is implemented, verified, and accepted by the user (test suite green).
## summarize
Write the milestone summary: what shipped, key decisions, notable fixes, and follow-ups.
Shape it so it can be pasted as input material for release notes.

done-when: a milestone summary document exists and is usable as release-note input.

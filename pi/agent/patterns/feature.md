---
name: feature
description: Take a feature from a raw request through clarification, implementation, review, and release.
nodes:
  - id: intake
    title: Receive & clarify the feature request
    type: human
    suggest: [grill-with-docs]
  - id: design
    title: Confirm the design or prototype the risky part
    type: human
    suggest: [prototype, show-me]
  - id: implement
    title: Implement the feature
    type: auto
    suggest: [impl-with-spawn]
  - id: review
    title: Review & verify the result
    type: human
    suggest: [code-review, hunk-review]
  - id: release
    title: Ship the change
    type: human
    suggest: []
---
## intake
Understand what the user actually wants before any code moves. Grilling against the
existing domain model is the default here; if the request is still foggy after grilling,
use the wayfinder skill inside this node to map the unknowns before proceeding.

done-when: the requirement is written down as a concrete, testable statement of intent.
## design
Settle the shape of the solution. For simple features this node can be skipped via
rerouting (the node stays on the Spine; use skip), but anything with a novel state model
or UI deserves a throwaway prototype or a quick diagram to align on before implementation.

done-when: the approach is chosen and any open design question is resolved or explicitly deferred.
## implement
Dispatch the implementation to a sub-agent. Large features should be decomposed into
independent subtasks inside this node — parallel background dispatches are fine here;
the node only cares that the work lands and the result is reported back.

done-when: the implementation is complete in the working tree and self-tested by the sub-agent.
## review
The user inspects the result. Recommended inside this node: dispatch code-review for a
multi-axis pass, and walk the diff with hunk-review for line-level judgment. Fix-ups loop
inside this node until the user accepts.

done-when: the diff is reviewed and the user explicitly accepts the change.
## release
Land the work. Typical actions: commit, run the project's install or packaging step, and
cut a release if the project has one. The user decides what "shipped" means here.

done-when: the change is committed, installed/released as the project requires, and any follow-ups are noted.

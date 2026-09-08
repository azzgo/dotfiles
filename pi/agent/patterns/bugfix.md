---
name: bugfix
description: Triage a defect, find and prove its root cause, fix it, and ship a verified patch.
nodes:
  - id: intake
    title: Receive & triage the defect
    type: human
    suggest: []
  - id: locate
    title: Locate the root cause
    type: auto
    suggest: [explore-codebase]
  - id: reproduce
    title: Reproduce & pin a regression test
    type: auto
    suggest: [browser-bridge, chrome-devtools-cli]
  - id: fix
    title: Implement the fix
    type: auto
    suggest: [impl-with-spawn]
  - id: verify
    title: Verify & ship the patch
    type: human
    suggest: [code-review]
---
## intake
Capture the report and triage: what is broken, since when, how severe, and is it worth
fixing now. The user supplies repro context and decides priority; nothing dispatches yet.

done-when: the defect is described precisely enough to investigate, with a priority decision.
## locate
Dispatch a read-only exploration to find the actual root cause, not the first plausible
symptom. The sub-agent traces the failure through the codebase and reports a root-cause
hypothesis with evidence.

done-when: a root-cause hypothesis backed by code evidence is recorded.
## reproduce
Prove the hypothesis. Write a failing test or repro that demonstrates the defect; for
UI-facing bugs gather evidence with the browser skills inside this node. The repro
doubles as the regression test the fix must satisfy.

done-when: a failing repro or regression test exists and reliably demonstrates the defect.
## fix
Dispatch the fix to a sub-agent with the root cause and the repro as inputs. The fix
must turn the repro green without weakening the test.

done-when: the fix is implemented and the regression test passes.
## verify
The user checks the patch: review the diff (dispatch code-review inside this node),
confirm the repro is fixed in a real run, and decide how the patch ships — commit,
install, or release.

done-when: the patch is reviewed, accepted, and committed/released as the user decides.

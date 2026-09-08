---
name: perf
description: Establish a performance evidence channel, locate the bottleneck, fix it, and prove the win against a baseline.
nodes:
  - id: instrumentation
    title: Establish the evidence channel
    type: human
    suggest: [browser-bridge, chrome-devtools-cli]
  - id: collect
    title: Collect & analyze performance data
    type: auto
    suggest: [explore-codebase]
  - id: locate
    title: Pin down the bottleneck
    type: auto
    suggest: []
  - id: baseline
    title: Reproduce & lock a baseline benchmark
    type: auto
    suggest: []
  - id: fix
    title: Implement the optimization
    type: auto
    suggest: [impl-with-spawn]
  - id: verify
    title: Verify the win & ship
    type: human
    suggest: [code-review]
---
## instrumentation
Before measuring anything, make performance observable. The user decides the evidence
channel — browser tracing for web UIs (browser skills can attach here), profilers,
timings, logs — and it is wired up so later nodes can pull real data instead of guessing.

done-when: a working path exists to capture traces/profile data for the slow path in question.
## collect
Dispatch a sub-agent to gather the data and read the relevant code paths side by side.
The goal is a ranked picture of where time or resources actually go, not anecdotes.

done-when: profile data and code-level analysis are recorded, with candidate bottlenecks ranked.
## locate
Narrow the candidates down to the one bottleneck worth attacking, confirmed by data.
Deeper targeted profiling or micro-experiments inside this node are encouraged; the node
exits only when the culprit is pinned.

done-when: a single bottleneck is identified with measurements to back the claim.
## baseline
Make the problem repeatable before touching code. Build a benchmark or repro that
reliably shows the current numbers, and record them as the baseline every later
comparison must beat.

done-when: a repeatable benchmark exists and its baseline numbers are recorded.
## fix
Dispatch the optimization to a sub-agent. Optimizations should stay as small and
reviewable as possible; behavior must not change, only the numbers.

done-when: the optimization is implemented without behavior change and the benchmark still runs.
## verify
The user judges the result: benchmark after vs. baseline must show a real win, the diff
gets reviewed (dispatch code-review inside this node), and the change ships — commit,
install, or release.

done-when: the benchmark comparison shows the target improvement is met and the change is committed/released.

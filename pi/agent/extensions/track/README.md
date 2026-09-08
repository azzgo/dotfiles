# track

Track — the standalone Pi extension for flat working-memory scratchpads
(`.pi/track/findings.md` + `.pi/track/progress.md`). Extracted verbatim from the
retired `goal-runtime` extension (see `docs/adr/0006-workflow-runtime-replaces-goal-runtime.md`);
the `/track` command surface, auto-init behavior, and file paths are unchanged.
The two goal couplings (activation-time Track auto-reset, verify-briefs) died
with goal-runtime.

## Public commands

- `/track new` — reset/init the scratchpad (also runs **automatically** at the first conversation of a session when the track files are missing)
- `/track update` — reconcile Track with current state, then **STOP and wait for the user** (the reconciliation turn is a checkpoint — auto-continuation is suppressed so the agent doesn't keep running after the flush)
- `/track context` — inject the current Track (findings/progress tails) as a user message (manual; nothing is auto-injected). The agent **continues only when the user stated an explicit next step** in the same message — otherwise it gives an orientation summary and waits; it never guesses tasks just to keep moving
- `/track status` — report Track state (no mutation)

## Disk layout

```text
.pi/track/
├── findings.md   # confirmed constraints, repo/system findings, design decisions, notes
└── progress.md   # timeline, work completed, verification, blockers, completion evidence
```

Flat files, never on any tracker board.

## Relationship to workflow-runtime

Track and the `workflow-runtime` extension are **strangers**: Runs keep their own
structured progress logs written by that extension; Track stays the model's
freeform manual memory. There is no automatic channel between them — no
reset-on-activation, no shared state, no cross-injection.

## Dotfiles integration

Version-controlled in `dotfiles` under `pi/agent/extensions/track/`, linked into
`~/.pi/agent/extensions/track` via `just install-pi` (registration in
`pi/agent/settings.json` handled by the workflow-runtime retirement change).

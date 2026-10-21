# track

Track — the standalone Pi extension for flat working-memory scratchpads
(`<project>/.pi/track/findings.md` + `progress.md` under pi, `<project>/.pig/track/`
under PiG — the directory name follows the SDK's `CONFIG_DIR_NAME`). Extracted
verbatim from the retired `goal-runtime` extension (see
`docs/adr/0006-workflow-runtime-replaces-goal-runtime.md`);
the `/track` command surface and auto-init behavior are unchanged.
The two goal couplings (activation-time Track auto-reset, verify-briefs) died
with goal-runtime.

Track used to supply Pi's compaction summary (ADR 0008). That moved to the
`compaction` extension in ADR 0015; Track is manual working memory now, and an
agent reaches it through file references rather than through the summary.

## Public commands

- `/track new` — reset/init the scratchpad (also runs **automatically** at the first conversation of a session when the track files are missing)
- `/track update` — reconcile Track with current state, then **STOP and wait for the user** (the reconciliation turn is a checkpoint — auto-continuation is suppressed so the agent doesn't keep running after the flush)
- `/track context` — inject the current Track (findings/progress tails) as a user message (manual; nothing is auto-injected). The agent **continues only when the user stated an explicit next step** in the same message — otherwise it gives an orientation summary and waits; it never guesses tasks just to keep moving
- `/track status` — report Track state (no mutation)

## Disk layout

```text
<project>/<config dir>/track/     # .pi/track under pi, .pig/track under PiG
├── findings.md    # confirmed constraints, repo/system findings, design decisions, notes
├── progress.md    # timeline, work completed, verification, blockers, completion evidence
```

Flat files, never on any tracker board.

## Relationship to workflow-runtime

Track and the `workflow-runtime` extension are **strangers**: Runs keep their own
structured progress logs written by that extension; Track stays the model's
freeform manual memory. There is no automatic channel between them — no
reset-on-activation, no shared state, no cross-injection.

## Compaction

Not this extension's job. The compaction summary is owned by `../compaction`
(`docs/adr/0015-compaction-summary-as-pointer.md`) — Track is manual, and the two
share nothing but the filesystem.

## Dotfiles integration

Version-controlled in `dotfiles` under `pi/agent/extensions/track/`, linked into
`~/.pi/agent/extensions/track` via `just install-pi`. Pi auto-discovers every
entry under `~/.pi/agent/extensions/`, so the symlink **is** the registration —
there is no `settings.json` entry to maintain.

## Tests

```bash
just test-track                       # whole suite
just test-track summary.test.ts        # vitest args pass through
```

Every suite here is pure — Track needs no Pi runtime, so nothing skips. The
compaction extension has the Pi-runtime-dependent tests.

```bash
PI_NM=~/.pi/agent/install/releases/$(pi --version | head -1)/node_modules/@earendil-works
mkdir -p pi/agent/extensions/track/node_modules/@earendil-works
ln -sfn "$PI_NM/pi-coding-agent" pi/agent/extensions/track/node_modules/@earendil-works/pi-coding-agent
ln -sfn "$PI_NM/pi-ai" pi/agent/extensions/track/node_modules/@earendil-works/pi-ai
```

Those links live under a gitignored `node_modules/` and are never committed.

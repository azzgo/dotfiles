# track

Track — the standalone Pi extension for flat working-memory scratchpads
(`.pi/track/findings.md` + `.pi/track/progress.md`). Extracted verbatim from the
retired `goal-runtime` extension (see `docs/adr/0006-workflow-runtime-replaces-goal-runtime.md`);
the `/track` command surface, auto-init behavior, and file paths are unchanged.
The two goal couplings (activation-time Track auto-reset, verify-briefs) died
with goal-runtime.

Track also **supplies Pi's compaction summary** — see [Compaction](#compaction)
and `docs/adr/0008-track-sourced-compaction.md`.

## Public commands

- `/track new` — reset/init the scratchpad (also runs **automatically** at the first conversation of a session when the track files are missing)
- `/track update` — reconcile Track with current state, then **STOP and wait for the user** (the reconciliation turn is a checkpoint — auto-continuation is suppressed so the agent doesn't keep running after the flush)
- `/track context` — inject the current Track (findings/progress tails) as a user message (manual; nothing is auto-injected). The agent **continues only when the user stated an explicit next step** in the same message — otherwise it gives an orientation summary and waits; it never guesses tasks just to keep moving
- `/track status` — report Track state (no mutation)

## Disk layout

```text
.pi/track/
├── findings.md    # confirmed constraints, repo/system findings, design decisions, notes
├── progress.md    # timeline, work completed, verification, blockers, completion evidence
└── reconcile.log  # append-only log of failed Compaction Reconciles (local, untracked)
```

Flat files, never on any tracker board.

## Relationship to workflow-runtime

Track and the `workflow-runtime` extension are **strangers**: Runs keep their own
structured progress logs written by that extension; Track stays the model's
freeform manual memory. There is no automatic channel between them — no
reset-on-activation, no shared state, no cross-injection.

## Compaction

Track supplies **Pi's compaction summary** — built-in transcript summarization
never runs. See `docs/adr/0008-track-sourced-compaction.md`.

On `session_before_compact` the extension:

1. **`reason: "overflow"` — fast path.** Read Track, return it as the summary.
   No model call, no reconcile: the window is already blown and Pi will retry
   the aborted turn. Newest un-recorded progress is lost with the compaction.
2. **Otherwise — reconcile.** A tool-less `modelRegistry.complete()` call takes
   the current Track files *plus the transcript tail* and returns new entries
   as JSON. The extension **appends** them (`appendToTrack()`) — never rewrites,
   because the reconcile only sees the tail and a rewrite would drop what
   earlier reconciles recorded.
3. **Read back** both files and return them as `summary`.

`firstKeptEntryId` is passed through unchanged, so recent raw turns survive
alongside the Track summary. The aggressive variant — Track as the *only*
surviving context — is not automatic; it is `/track update` + a fresh session.

### Why failures are recorded in-band

Pi's `ExtensionRunner.emit()` catches every handler exception and only logs it;
`agent-session.js` then treats the `undefined` result exactly like "no extension
result" and runs `_runDefaultCompaction()`. **Returning `undefined` and throwing
are the same thing** — both silently reinstate built-in summarization.

So the handler never throws. Any failure returns a `compaction` whose summary is
an **explicit failure note** carrying the serialized transcript tail, so the
record survives compaction and the next agent sees it. Failures also raise
`ui.notify(..., "error")` and append to `.pi/track/reconcile.log`.

### Diagnosing a failed reconcile

| Place | What you get |
|---|---|
| The context itself | An in-band failure note with the transcript tail |
| The UI | An `error` notification at compaction time |
| `.pi/track/reconcile.log` | Append-only log for counting failures over time |

## Dotfiles integration

Version-controlled in `dotfiles` under `pi/agent/extensions/track/`, linked into
`~/.pi/agent/extensions/track` via `just install-pi`. Pi auto-discovers every
entry under `~/.pi/agent/extensions/`, so the symlink **is** the registration —
there is no `settings.json` entry to maintain.

## Tests

```bash
just test-track                       # whole suite
just test-track reconcile.test.ts     # vitest args pass through
```

`reconcile.test.ts` covers the pure parsing logic and needs nothing but vitest.
`compaction.test.ts` exercises the real reconcile path, so it needs the Pi
runtime resolvable from `node_modules/@earendil-works/`; it **skips** (rather
than fails) when that is missing. To run it locally, from the repo root:

```bash
mkdir -p pi/agent/extensions/track/node_modules/@earendil-works
ln -sfn "$(npm root -g)/@earendil-works/pi-coding-agent" \
  pi/agent/extensions/track/node_modules/@earendil-works/pi-coding-agent
ln -sfn "$(npm root -g)/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai" \
  pi/agent/extensions/track/node_modules/@earendil-works/pi-ai
```

Those links live under a gitignored `node_modules/` and are never committed.

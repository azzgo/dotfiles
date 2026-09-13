# Track supplies the compaction summary; built-in summarization is never used

Status: accepted

## Context

Built-in compaction summarizes the conversation transcript into a
`CompactionEntry`. Its summary is a paraphrase of everything that happened:
decisions, dead ends, tool chatter, and abandoned directions all survive in
condensed form. In practice this is both expensive to produce and
counterproductive to read — the resumed agent gets a narrative of the
conversation rather than a statement of where the work stands.

Track (`.pi/track/findings.md` + `progress.md`) already holds exactly the
distilled form we want: confirmed constraints, design decisions, timeline,
work completed, blockers. It was, however, written only on explicit
`/track update`. The obvious move — feed Track into the built-in summary as
extra input — keeps the paraphrase. What we actually want is for Track to *be*
the summary.

Two constraints discovered while designing this are load-bearing:

- **`session_before_compact` cannot run an agent turn.** `ExtensionContext`
  exposes `modelRegistry` but no dispatch/spawn capability. The only model call
  available is `modelRegistry.complete()` — text in, text out, no tools. So a
  reconcile step cannot read or write files itself; the extension must write.
- **Pi swallows extension exceptions.** `ExtensionRunner.emit()` wraps every
  handler in `try/catch` and only logs via `emitError()`; the result becomes
  `undefined`, which `agent-session.js` treats identically to "no extension
  result" and proceeds with `_runDefaultCompaction()`. Returning `undefined`
  and throwing are therefore *the same thing* from our side: both silently
  hand control back to built-in summarization.

## Decision

**Track content is the compaction summary.** On `session_before_compact` the
extension returns `{ compaction: { summary, firstKeptEntryId, tokensBefore } }`
where `summary` is the read-back Track files. Built-in summarization is never
allowed to run.

- **Reconcile is a tool-less call.** The extension builds a prompt from the
  current Track files plus the *tail* of `messagesToSummarize` /
  `turnPrefixMessages`, and asks for **new entries only** as JSON
  (`{findings:[{heading,text}], progress:[{heading,text}]}`). The extension
  appends them via the existing `appendToTrack()`. Appending is deliberate: the
  reconcile sees only the transcript tail, so a rewrite would drop what earlier
  reconciles recorded.
- **`firstKeptEntryId` is passed through unchanged.** Recent raw turns are
  retained alongside the Track summary. The aggressive variant (Track as the
  *only* surviving context) is reachable via explicit `/track update` + a fresh
  session, and is not made the automatic default.
- **`reason: "overflow"` takes a fast path** — read Track, return it, no LLM
  call and no reconcile. Overflow means the window is already blown and Pi will
  retry the aborted turn (`willRetry`); spending time on a model call there
  delays recovery. The cost is that the newest un-recorded progress is lost
  with the compaction.
- **Failure is recorded in-band, never thrown.** The whole handler is wrapped;
  any error returns a `compaction` whose summary is an explicit failure note
  carrying the serialized transcript tail. This is the only way to keep the
  mechanism observable, because an escaping exception is swallowed and silently
  replaced by built-in summarization. Failures additionally raise
  `ui.notify(..., "error")` and append to `.pi/track/reconcile.log`.

## Considered Options

- **Feed Track into the built-in summary as extra context** — rejected: keeps
  the paraphrase we are trying to eliminate, and keeps built-in summarization's
  cost on every compaction.
- **Auto-run `/track update` as an agent turn before compacting** — not
  available: no agent-turn capability in `ExtensionContext`.
- **Have the model return whole file contents and overwrite** — rejected:
  requires the model to restate existing content verbatim; long files drift or
  lose content. Append-only JSON entries degrade to "one dropped bullet" and
  reuse tested code paths.
- **Return `undefined` on failure to fall back to built-in compaction** —
  rejected: silently reinstates the behavior this ADR removes, and is
  indistinguishable from success because Pi never surfaces the difference.
- **Aggressive `firstKeptEntryId` (Track only, no raw turns)** — deferred, not
  rejected. Conservative-by-default keeps a slow Track reconcile from becoming
  a correctness problem.

## Consequences

- Track is now a *compaction-critical* artifact: if it goes stale, the resumed
  agent's memory of the work goes stale with it. The reconcile tail window is
  the mitigation, not a guarantee.
- `CONTEXT.md`'s Track entry no longer says "fully manual" — Track participates
  in compaction automatically. `/track update` remains as the explicit
  checkpoint for handoff and for the aggressive reset-and-resume path.
- `/track context` stays meaningful: under conservative `firstKeptEntryId`,
  Track is *not* automatically in context across session boundaries.
- Reconcile failures are diagnosable from three places: the failure note in the
  context itself, the error notification, and `.pi/track/reconcile.log`.

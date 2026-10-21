# compaction

Pi's compaction summary as an **orientation plus a retrieval handle** — see
`docs/adr/0015-compaction-summary-as-pointer.md`. Built-in transcript
summarization never runs.

The summary is not a replacement for history. Compaction drops raw messages out
of the context window but never deletes them: the session transcript keeps
everything, including the pre-compaction span. So the summary only has to say
where the agent is, what it does next, which files it touched, and where to go
look for the rest.

Four blocks — three written by the model, one by the extension:

| Block | Written by | Update |
|---|---|---|
| 主题 topics | model | rewritten wholesale, ≤ 5 |
| 下一步 nextIntent | model | **replaced** wholesale, 1 entry |
| file notes | model | annotated onto mechanically extracted paths |
| 旧记录 retrieval handle | extension | constant (~30 tokens) |

## Flow

On `session_before_compact` (`runtime.ts`):

1. **Extract file operations mechanically** from the tool calls in
   `preparation.messagesToSummarize` — `readFiles` / `modifiedFiles`, the same
   extraction built-in compaction does (`fileops.ts`). The model never lists
   paths; it only annotates paths it was given. A file read before being edited
   counts as modified only.
2. **`reason: "overflow"` — fast path.** No model call: the window is already
   blown and Pi will retry the aborted turn. The summary is mechanical
   information only (file lists + retrieval handle), which is deliberately tiny.
3. **Otherwise — one tool-less `modelRegistry.complete()` call** (`compaction.ts`)
   with the previous summary, the full messages being summarized, the mechanical
   file lists, and the session transcript path. It returns JSON:
   `{topics, nextIntent, restore, fileNotes}`. `restore` is optional and only
   used when the model knows which earlier context is missing.
4. **Assemble** the four blocks into the summary text (`prompts.ts`). Model-written
   blocks come first so the mechanical file list cannot crowd them out.

`firstKeptEntryId` passes through unchanged, so recent raw turns survive
alongside the summary.

## Why the model never writes the file list

Letting the model recall paths is the one failure this design can avoid outright:
it would silently drop a file the agent is still relying on, and nothing
downstream would notice. `fileops.ts` also reads `nestedCalls` on tool results,
so files written by a codemode script are counted.

## The retrieval handle

`ctx.sessionManager.getSessionFile()` names the transcript, and the summary says
to grep it. That is what makes a pointer-style summary safe, and it is why the
summary no longer grows with session length — the thing that made ADR 0008's
Track-as-summary approach expensive.

## Why failures are recorded in-band

Pi's `ExtensionRunner.emit()` catches every handler exception and only logs it;
`agent-session.js` then treats the `undefined` result exactly like "no extension
result" and runs `_runDefaultCompaction()`. **Returning `undefined` and throwing
are the same thing** — both silently reinstate built-in summarization.

So the handler never throws. Unusable model output returns a **Compaction
Failure Record** that names the reason and points at the transcript — nothing is
actually lost, so the record does not need to embed the conversation any more.
Failures also raise `ui.notify(..., "error")` and append to
`.pi/compaction/failures.log` (`.pig/compaction/failures.log` under PiG — the
directory follows the SDK's `CONFIG_DIR_NAME`).

| Where to look | What you get |
|---|---|
| The context itself | An in-band failure record naming the reason |
| The UI | An `error` notification at compaction time |
| `<project>/<config dir>/compaction/failures.log` | Append-only log for counting failures over time |

## Relationship to track

None, since ADR 0015. Track is manual working memory that an agent reaches
through file references; the compaction summary is session infrastructure. They
share nothing but the filesystem.

## Dotfiles integration

Version-controlled in `dotfiles` under `pi/agent/extensions/compaction/`, linked
into `~/.pi/agent/extensions/compaction` via `just install-pi`. Pi auto-discovers
every entry under `~/.pi/agent/extensions/`, so the symlink **is** the
registration.

## Tests

```bash
just test-compaction                     # whole suite
just test-compaction summary.test.ts     # vitest args pass through
```

`summary.test.ts` and `fileops.test.ts` are pure and need nothing but vitest.
`compaction.test.ts` exercises the real model-call path, so it needs the Pi
runtime resolvable from `node_modules/@earendil-works/`; it **skips** (rather
than fails) when that is missing. To run it locally, from the repo root:

```bash
PI_NM=~/.pi/agent/install/releases/$(pi --version | head -1)/node_modules/@earendil-works
mkdir -p pi/agent/extensions/compaction/node_modules/@earendil-works
ln -sfn "$PI_NM/pi-coding-agent" pi/agent/extensions/compaction/node_modules/@earendil-works/pi-coding-agent
ln -sfn "$PI_NM/pi-ai" pi/agent/extensions/compaction/node_modules/@earendil-works/pi-ai
```

`npm install` in this directory prunes those links — re-run the two `ln` after it.
They live under a gitignored `node_modules/` and are never committed.

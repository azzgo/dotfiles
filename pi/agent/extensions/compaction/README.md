# compaction

Pi's compaction summary as an **orientation plus a retrieval handle** — see
`docs/adr/0015-compaction-summary-as-pointer.md`, superseded in part by
`docs/adr/0020-compaction-summary-handoff.md`. Built-in transcript
summarization never runs.

The summary is not a replacement for history. Compaction drops raw messages out
of the context window but never deletes them: the session transcript keeps
everything, including the pre-compaction span. So the summary only has to say
where the agent is, what it does next, which files it touched, and where to go
look for the rest.

## Shape

Five blocks. The model writes the next intent and the topics (and only annotates the file list); the extension writes the request line, the retrieval handle and the file lists themselves:

| Block | Written by | Update |
|---|---|---|
| 请求线 request line | extension | mechanical, last 5 user requests |
| 下一步 next intent | model | **replaced** wholesale, 1 entry |
| 主题 topics | model | rewritten wholesale, ≤ 3 |
| 旧记录 retrieval handle | extension | constant (~30 tokens) |
| 文件 file lists | extension | mechanical, ≤ 20 modified / ≤ 10 read |

The file lists sit last: they are mechanical fact that may already be stale, and
they must not crowd out the orientation.

## Flow

On `session_before_compact` (`runtime.ts`):

1. **Build the Compaction Skeleton** (`skeleton.ts`) — one line per message of
   the span being dropped, instead of the raw transcript. The measured session
   fed 767,619 tokens to the summary model; the skeleton brings that to
   19,876.
2. **Rebuild the kept window** — `branchEntries` + `sessionEntryToContextMessages()`
   recover the turns that stay in context after the compaction. The summary
   model sees them too, so its next intent cannot predate the session it
   summarises.
3. **Extract file operations mechanically** from the tool calls
   (`fileops.ts`). The model never lists paths; it only annotates paths it was
   given. Temp paths and track scratchpads are filtered out.
4. **`reason: "overflow"` — fast path.** No model call: the window is already
   blown and Pi will retry the aborted turn.
5. **Otherwise — one tool-less `modelRegistry.complete()` call** (`compaction.ts`)
   with the skeleton, the kept window, the request line and the file lists. It
   returns JSON: `{topics, nextIntent, restore, fileNotes}`.
6. **Unparseable output → one repair retry**, then the mechanical
   **Compaction Fallback** (request line + file lists + handle). The failure path
   always has orientation.

`firstKeptEntryId` passes through unchanged, so recent raw turns survive
alongside the summary.

## Summary model

The model that writes the summary is configurable and never hardcoded:

```bash
/compaction-model                                   # show the current setup
/compaction-model magpie/nas/deepseek/deepseek-flash
/compaction-model reset                             # fall back to the session model
```

The choice lives in `compaction.json` next to the agent dir
(`~/.pi/agent/compaction.json`, `~/.pig/agent/compaction.json` under PiG), so it
survives reloads and is per-machine. With nothing configured the session model
writes the summary and the extension records a note in `failures.log`.

## Retrieving what was dropped

The summary carries a runnable command, and the extension registers a
codemode-only `session_grep` tool:

```bash
grep -n '"role":"user"' "<session file>" | tail -20
```

`session_grep` takes a query (text or regex), an optional `role`
(`user` / `assistant` / `toolResult`), an optional `since` / `until` ISO bound
and an optional `limit`. It is registered with `exposure: "codemode"`, so it
never enters the tool schema of the main conversation.

## Compaction Notice

When context usage crosses 60%, the extension notifies once per session that
`/compact` may be worth running. It never compacts by itself — the automatic
trigger in Pi fires at `window - reserveTokens` (98.4% on a 1M window), which is
too late to have room left for the summary call.

## Where the numbers are

| Where | What you get |
|---|---|
| `<project>/<config dir>/compaction/failures.log` | Append-only log of failures and fallbacks |
| `<project>/<config dir>/compaction/stats.log` | One line per compaction: model, tokens, cost, duration, outcome |
| The footer | Summary usage is returned to Pi, so it counts towards the session cost |

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

`summary.test.ts`, `fileops.test.ts`, `skeleton.test.ts` and `session-grep.test.ts`
are pure and need nothing but vitest. `compaction.test.ts` exercises the real
model-call path, so it needs the Pi runtime resolvable from
`node_modules/@earendil-works/`; it **skips** (rather than fails) when that is
missing. To run it locally, from the repo root:

```bash
PI_NM=~/.pi/agent/install/releases/$(pi --version | head -1)/node_modules/@earendil-works
mkdir -p pi/agent/extensions/compaction/node_modules/@earendil-works
ln -sfn "$PI_NM/pi-coding-agent" pi/agent/extensions/compaction/node_modules/@earendil-works/pi-coding-agent
ln -sfn "$PI_NM/pi-ai" pi/agent/extensions/compaction/node_modules/@earendil-works/pi-ai
```

`npm install` in this directory prunes those links — re-run the two `ln` after it.
They live under a gitignored `node_modules/` and are never committed.

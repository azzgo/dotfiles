# hashline-edit (lite)

Content-hash-anchored `read`/`edit` tool override for pi-coding-agent.

Adapted from [pi-hashline-edit](https://github.com/RimuruW/pi-hashline-edit) (MIT),
which vendored from [oh-my-pi](https://github.com/can1357/oh-my-pi) (MIT).

## What it does

Replaces the built-in `read` and `edit` tools with hashline-anchored versions:

- **read** returns lines as `LINE#HASH:content` — every line gets a 2-character
  hash computed from its content + immediate neighbors.
- **edit** uses those hashes as anchors (`pos: "12#MQ"`) for precise,
  stale-resistant edits. If the file changed since the last read, the hash
  won't match and the edit is rejected with `[E_STALE_ANCHOR]`.

## Lite version differences from upstream

| Feature | Upstream | Lite |
|---------|----------|------|
| Hash engine | xxhashjs (xxh32) | node:crypto MD5 (zero deps) |
| Hash length | configurable 2–4 | hardcoded 2 |
| Edit ops | replace, append, prepend, replace_text | replace, replace_text |
| grep tool | yes | no |
| 3-way merge recovery | yes | no |
| Multi-version snapshot | yes | no |
| Dialect normalization | yes | no (strict canonical) |
| Config file (hashline.json) | yes | no |
| Binary/image detection | yes | no |
| External deps | xxhashjs, diff, file-type | none |

## Supported ops

### `replace`
Replace one line at `pos`, or an inclusive `pos`..`end` range:
```json
{ "op": "replace", "pos": "12#MQ", "lines": ["const x = 1;"] }
```
Range replace:
```json
{ "op": "replace", "pos": "5#VR", "end": "8#QV", "lines": ["line5", "line6"] }
```
Delete (empty lines): `"lines": []`

To **insert** lines, use `replace` on an existing anchor and include the
original line plus new lines in `lines`.

### `replace_text`
Exact unique substring replacement (fallback when anchors are stale):
```json
{ "op": "replace_text", "oldText": "old code", "newText": "new code" }
```

## Safety guards

- **E_STALE_ANCHOR** — hash mismatch means the file changed since last read
- **E_EDIT_CONFLICT** — overlapping edits in a single call
- **E_NOOP_LOOP** — 3 consecutive identical no-op edits → hard block
- **textHint** validation — anchor's `:content` is cross-checked against
  actual file content as a collision guard (1/256 at hash length 2)

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Extension entry — registers read/edit tools |
| `hash.ts` | MD5 hash engine (node:crypto, len=2) |
| `parse.ts` | Anchor parsing + edit validation |
| `apply.ts` | Edit application pipeline (stale + conflict detection) |
| `format.ts` | LINE#HASH formatting + changed-line range |
| `read.ts` | Read tool (formatting + offset/limit) |
| `edit.ts` | Edit tool (pipeline + atomic write + noop guard) |
| `noop-guard.ts` | Noop loop guard (in-memory, 3-strike) |
| `fs-write.ts` | Atomic write (tempfile + rename) |
| `prompt.ts` | Protocol prompt text |
| `text-utils.ts` | Line-ending normalization, BOM stripping |
| `path-utils.ts` | Path resolution |

## Install

Via `just install-pi` — symlinks this directory to `~/.pi/agent/extensions/hashline-edit/`
and registers `+extensions/hashline-edit/index.ts` in settings.json.

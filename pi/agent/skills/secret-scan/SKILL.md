---
name: secret-scan
description: Set up and run a leak scan that actually fires — gitleaks wired into pre-commit plus a project .gitleaks.toml for the identifiers gitleaks cannot know, an echo-trap check for values the code regenerates at runtime, a history sweep with a rewrite-vs-rotate decision, and a manual pass for the prose leaks no tool sees. Use before publishing a repo, when a milestone ends, or whenever someone says "was this ever leaked".
disable-model-invocation: true
---

# Secret scan

A repo has to be *publishable*, not merely *not obviously secret*. The failure this
skill exists to prevent is not "we never looked" — it is "we looked once, late,
by hand, and got lucky".

The motivating case is a repo that shipped for ~70 commits with the maintainer's own
infrastructure addresses, machine names and node names in it. Every one of those was
caught manually during a milestone retrospective: an RFC1918 address and a **public**
IPv4 in a setup guide, a log sample, a JSON schema's `examples`, and a test fixture
plus the regex asserting the error message that fixture feeds. The local push hook
printed `secret scan runs in CI`, so the local layer that would have caught them at
commit time did not exist, and the CI layer ran after the force-push. That is the
shape of the problem this skill is for.

Four layers of automation plus a manual pass, because each one misses what the next catches:

| Layer | Catches | Never catches |
|---|---|---|
| 1 · gitleaks default ruleset | credentials: provider tokens, cloud keys, private keys, JWTs, high-entropy values next to `token` / `secret` / `password` | addresses, hostnames, machine names, bare passwords |
| 2 · project `.gitleaks.toml` | *your* identifier shapes: IPs, pool/node/host values, endpoint hosts | values the code generates instead of storing |
| 3 · echo-trap discipline | the value that re-enters through an assertion after you scrubbed the fixture | anything outside the tree |
| 4 · history sweep | values that were committed and then removed | publication that already happened |
| 5 · manual prose pass | machine names in docs, real hostnames, rules the rulebook contradicts | — |

Layers 1–4 are mechanical. Layer 5 is a checklist on purpose: no scanner can tell
that `arch` is somebody's laptop.

## Ground rules

- **A scan that silently skips is the failure mode.** If the scanner is missing, say
  so and fail. Never `command -v gitleaks || echo "runs in CI"`. The scripts here exit
  non-zero and name the install command; keep that property in any wiring you write.
- **Local before remote.** The layer that matters is the one that runs before the
  commit exists, on the machine that has the value in memory.
- **Calibrate every rule against the real tree.** A rule you never ran either cries
  wolf (and gets ignored) or gets file-allowlisted wholesale (and goes blind). Both are
  worse than no rule.
- **Rotate beats rewrite.** Deleting a committed credential and rewriting history does
  not un-publish it. Decide rotation first; treat the rewrite as cleanup of the
  artefact, not as the remediation.
- **Allowlists carry a reason.** One line above each entry, in the config, saying why.

## Layer 1 — install the scanner, wire the hook

`gitleaks` is a single Go binary. Install it with whatever the machine already uses,
record which one in the repo's docs so the next machine is not a mystery:

```bash
pacman -S gitleaks                        # Arch
brew install gitleaks                     # macOS
mise use -g aqua:gitleaks/gitleaks        # cross-platform, pins a version
go install github.com/gitleaks/gitleaks/v8@latest
```

Verify: `gitleaks version` (this skill was written against **8.30.1**).

Wire the pre-commit hook. The command matters — `protect` and `detect` were deprecated
in 8.19.0, and `--staged` is what makes the scan see the index rather than history:

```bash
gitleaks git --staged --redact --no-banner
```

Use `scripts/scan.sh staged` instead of the bare command — it refuses to run when the
binary is absent, redacts findings, and prints the decision prompts below. Wire it via
whatever hook runner the repo already has (husky, pre-commit, lefthook, plain
`.git/hooks/pre-commit`); do not add a second runner just for this.

```sh
# .husky/pre-commit (or the equivalent)
"$REPO/scripts/scan.sh" staged
```

Escape hatch: `SKIP_SECRET_SCAN=1` for the legitimate case (recovering a real token
from a config file that must be committed). If you add one, it is loud and it is
logged. Never an `|| true`.

**Verify the hook, do not assume it.** Stage a fake credential, confirm the hook
blocks the commit, unstage:

```bash
printf 'token: ghp_16C7e42F292c6912E7710c838347Ae178B4a\n' > /tmp/leak-probe.txt
cp /tmp/leak-probe.txt ./leak-probe.txt && git add leak-probe.txt
git commit -m probe            # must FAIL
git restore --staged leak-probe.txt && rm leak-probe.txt
```

## Layer 2 — the project `.gitleaks.toml`

Two things live in this file, and they are different jobs:

1. **Custom rules for the project's own identifier shapes.** gitleaks' default ruleset
   is keyword-anchored and entropy-based; it finds credentials. It cannot know that
   `100.64.7.21` is your server or that `"pool": "arch"` names a machine. Those only
   become detectable once the file names their shape. This is the whole justification
   for the file — a scanned-but-unfired default ruleset proves nothing about them.
2. **An allowlist for placeholders that must stay quiet.** Without it the docs
   placeholders trip every build and someone file-allowlists the docs directory, which
   is how the scan goes blind.

Scaffold from `references/gitleaks.toml.template`, then calibrate — `references/calibration.md`
holds the two-sided fixture (every line that must fire, every line that must stay quiet, and
the near-misses in between) and the loop that keeps a config honest:

1. Replace `{{PROJECT_NAME}}`.
2. Delete or rename rules for vocabulary the project does not have.
3. Add rules for the identifiers the project *does* have — its own hostnames, its own
   `pool=` / `node=` style keys, its own actor names.
4. Run the fixture from `references/calibration.md`: `trips.md` fully hit, `quiet.md` empty,
   `edges.md` exact.
5. Run `scripts/scan.sh dir .` on the real tree, read **every** hit, and for each one either
   fix the content or add an allowlist entry with a reason.

Step 4 is what separates a config from a decoration. Measured on the motivating repo, the
scaffolded rules caught 9 of 9 real leaks, but an early version fired 800 times on vendored
Lua — both facts are only visible if you run both sides.

### The scaffolded rules, and why they are shaped that way

The template carries IP rules, an `identifier-quoted` rule (`"pool": "arch"`,
`hostname: box-01`), an `identifier-assigned` rule (`pool=arch`, `node=node-b`),
and an `endpoint-host` rule (`endpoint: engine-a`). Shapes learned the hard way:

- **Split the quoted and assigned forms.** One catch-all rule with a loose value class
  either eats prose punctuation (`endpoint: engine.`) or nests capture groups. Two
  narrow rules are calibratable; one clever rule is not.
- **`(?-i:…)` for the first character.** `(?i)` at the start makes the value class
  case-insensitive, which then matches `Node: the` in English prose. Lowercase the first
  character explicitly and the prose noise disappears.
- **Keyword lists are the performance contract.** gitleaks only runs a rule's regex on
  lines containing one of its `keywords`. That is why a rule can be this loose without
  costing a full scan; it is also why a rule with the wrong keywords silently never
  fires. When a rule "doesn't work", check the keyword list first.
- **Placeholders must be matched exactly.** `pool=prod` is a placeholder;
  `pool=prod-blue` is a real pool. Anchor the placeholder allowlist with a terminator
  class (`(?:[?&\s;,"']|$)`), not `\b`.
- **Rule-scoped allowlists (`[[rules.allowlists]]`), not global ones.** They cannot blind
  another rule to a real value on the same line.
- **Allowlist what the docs must teach.** `example.com`, `engine.example.com`,
  `127.0.0.1`, `192.0.2.0/24`, `local-test`, `EXAMPLE_TOKEN`: these are the *point* of
  the docs. They belong in the allowlist; the real values they replaced do not.
- **RegEx is RE2.** No lookarounds, no backreferences — a `(?!...)` makes gitleaks
  **panic at config load**, not fail gracefully. Test every regex before committing it.

## Layer 3 — the echo trap

The one rule that cannot be automated around: **scrubbing a string in a test file is
not done until the test that surfaces that string passes.**

A test fixture carried a real engine address, and the assertion checked the error
message produced from it. The fixture was scrubbed and the assertion was updated — but
the code under test echoed *the caller's own value* back into the message, so the
address re-entered through a second fixture that nobody had looked at. The test went
red, and that redness is the only reason it was caught.

The general shape: the value is not only *stored* in the tree, it is *regenerated* at
runtime by code that interpolates its input. Grep only finds storage.

Run `scripts/echo-audit.sh '<pattern>'` after scrubbing. A pattern that now matches
only test files means you are standing in the trap. Then:

1. Run the test suite. A test that fails after the scrub is the code under test telling
   you where the value is generated.
2. Read that code for every value it interpolates from input — `JSON.stringify`, template
   literals, `util.inspect`, formatted log lines, error messages.
3. Re-run the audit with the placeholder you intend to keep.

This is cheap and it is not optional. It is the difference between "I removed the
string" and "the string is gone".

## Layer 4 — history, and what to do about it

A value can sit in the tree for dozens of commits before anyone looks. Sweep the whole
history, every time, not just HEAD:

```bash
gitleaks git . --log-opts="--all"       # every reachable commit
gitleaks git . --log-opts="BASE..HEAD"  # one branch's worth
git log -S'192.168.31.7' --oneline --all   # when you know the value, find its commits
```

Also check what is *still* published elsewhere: release tarballs, container layers,
package registries, the CI provider's build logs. A rewrite does not touch those.

### Rewrite or rotate

Both, usually. The decision is about **the secret**, not about the diff.

| Situation | Do |
|---|---|
| Credential was ever live **and** pushed to a shared remote | **Rotate first.** Then decide whether the history is worth rewriting at all — the value is public whatever you do next |
| Credential was never live (EXPIRED, EXAMPLE, a fixture that always was fake) | Fix the content; history is untidy, not unsafe. A rewrite is optional |
| Non-credential identifier that is merely private (an IP, a machine name, an internal hostname) | Rewrite is legitimate *and* the value stays known to anyone who fetched it. Decide by how much you care about it being known |
| Repo has forks, mirrored clones, open PRs, or package tarballs of the affected commits | Assume every SHA downstream is invalidated and the old objects still exist somewhere. Weigh that cost honestly |

**Costs of a rewrite, all real:** force-push does not un-publish; every downstream SHA
breaks; clones, forks and CI caches retain objects; registry tarballs are immutable.
Write the cost down before starting, not after.

**If you rewrite:**

- `git filter-repo --replace-text` (or `--path`) is the supported tool;
  `filter-branch --tree-filter` works and is brutally slow — the motivating case took a
  full pass over 268 commits.
- Purge the safety net: `refs/original`, then
  `git reflog expire --expire=now --all`, then `git gc --prune=now --aggressive`.
  A "scrubbed" repo with the old commits still reachable via reflog is not scrubbed.
- Push with an **exact** lease, never bare `--force`:
  `git push --force-with-lease=main:<expected-sha> origin main`. The lease is what
  protects you from someone else's commits on top of the history you did not see.
- Re-run the layer 4 sweep **after** the rewrite and confirm the pattern returns nothing
  over `--all`.

## Layer 5 — the prose pass no scanner sees

For a repo with docs, a schema, notes and a rulebook (AGENTS.md / CONTRIBUTING / README),
grep and gitleaks between them will miss most of this class. Read for:

- **Real IPs.** Public worse than private. Private addresses leak network topology;
  public ones leak a target.
- **Real hostnames and domains**, including in `examples` arrays, log samples, and
  schema defaults.
- **Machine names, pool names, node names, actor names** used as *values*: a distro name
  standing in for a machine, a colleague's remote box, an agent name from someone's
  config. These read as harmless strings and are the reason `identifier-quoted` exists.
- **Verbatim log samples.** A pasted log line carries everything the log line had.
- **Test fixtures and the assertions derived from them** (see layer 3).
- **Counts and enumerations that assert something the tree contradicts.** "Four committed
  build products" listing three; a rulebook naming a file that no longer exists. Not a
  secret — the same class of drift, and the same fix: make the claim greppable and check
  it. If a doc says four, `ls` the four.

Make the check concrete rather than vibes: `scripts/scan.sh dir .` covers the mechanical
half, then read the diff of every doc the change touched with the list above in hand.

## Workflow

Default path for a repo that has never had this:

1. **Inventory** — is gitleaks installed? is there a hook? a `.gitleaks.toml`? CI
   coverage? Note what exists instead of replacing it.
2. **Layer 1** — install, wire, and *probe* the hook (the fake-PAT commit above).
3. **Layer 2** — scaffold `.gitleaks.toml`, add the project's own identifier shapes,
   calibrate against the real tree.
4. **Layer 4** — sweep `--all`. If dirty, make the rotate-vs-rewrite decision with the
   maintainer before touching history; nothing here rewrites history unasked.
5. **Layer 5** — docs pass over the files the sweep and the diff point at.
6. **Record** — the install path, the hook, the config's rules and every allowlist
   reason live in the repo, not in this conversation.

For an *ongoing* repo, step 4 runs at every release or milestone boundary. The motivated
failure mode is "we last looked at this seventy commits ago".

## Reporting

Never paste a live secret into a chat, an issue, or a commit message. Report
`rule · file · line` and a redacted context line; the full value belongs in the local
JSON report (`SECRET_SCAN_REPORT=/tmp/scan.json scripts/scan.sh ...`) and nowhere else.

Say plainly which layers ran and which did not. "Scan clean" from a scanner that never
found the file it was supposed to look at is a lie with a good conscience.

## Strict constraints

- **Never report clean from a skipped scan.** Missing scanner → non-zero exit and an
  install instruction.
- **Never an allowlisted file where a narrow regex will do.** File-level allowlisting is
  permanent blindness, and it outlives whoever wrote it.
- **Never rewrite history as a substitute for rotating a credential.** Rotation first,
  always.
- **Never bare `--force`.** `--force-with-lease=<ref>:<exact-sha>`.
- **Never declare a scrub done without re-running the audit and the tests.** Layer 3 is
  the reason this skill exists.

## References

- `scripts/scan.sh` — the one scanner invocation; modes `staged`, `head`, `range`,
  `history`, `dir`, `stdin`; fails loud when gitleaks is missing.
- `scripts/echo-audit.sh` — post-scrub check that distinguishes "gone" from "only
  removed from the files you remembered".
- `references/gitleaks.toml.template` — the scaffold, with the rule rationale inline.
- `references/calibration.md` — the two-sided fixture and the loop for proving a rule both
  fires and stays quiet; every config edit goes through it before it is committed.

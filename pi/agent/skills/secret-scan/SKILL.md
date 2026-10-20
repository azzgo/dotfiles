---
name: secret-scan
description: Set up and run a leak scan that actually fires — gitleaks wired into pre-commit plus a project .gitleaks.toml for the identifiers gitleaks cannot know, an echo-trap check for values the code regenerates at runtime, a history sweep with a rewrite-vs-rotate decision, and a manual pass for the prose leaks no tool sees. Use before publishing a repo, at every release boundary, or whenever someone asks "was this ever leaked".
disable-model-invocation: true
---

# Secret scan

## Coverage

| Layer | Catches | Does not catch |
|---|---|---|
| 1 · gitleaks default ruleset | credentials: provider tokens, cloud keys, private keys, JWTs, high-entropy values next to `token` / `secret` / `password` | addresses, hostnames, machine names, bare passwords |
| 2 · project `.gitleaks.toml` | identifier shapes: IPs, pool/node/host values, endpoint hosts | values the code generates instead of storing |
| 3 · echo-trap audit | the value that re-enters through an assertion after the fixture was scrubbed | anything outside the tree |
| 4 · history sweep | values that were committed and then removed | publication that already happened |
| 5 · manual prose pass | machine names in docs, real hostnames, rulebook claims the tree contradicts | — |

Run all five. Layers 1–4 are commands; layer 5 is a checklist.

## Ground rules

- Missing scanner → non-zero exit and an install command. Never a skip, never `|| true`.
- Every scan runs locally before the commit exists.
- Every rule is calibrated against the real tree before it is committed
  (`references/calibration.md`).
- Rotation is decided before any history rewrite.
- Every allowlist entry carries a one-line reason, in the config.

## Layer 1 — install, wire, probe

Install:

```bash
pacman -S gitleaks                        # Arch
brew install gitleaks                     # macOS
mise use -g aqua:gitleaks/gitleaks        # cross-platform, pins a version
go install github.com/gitleaks/gitleaks/v8@latest
```

Confirm with `gitleaks version`. Written against **8.30.1**.

Pre-commit command:

```bash
gitleaks git --staged --redact --no-banner
```

`protect` and `detect` were deprecated in 8.19.0. `--staged` is what points the scan at
the index instead of history.

Use `scripts/scan.sh staged` rather than the bare command — it fails when the binary is
absent, redacts output, and prints the triage prompts. Wire it into the hook runner the
repo already has (husky, pre-commit, lefthook, `.git/hooks/pre-commit`). Do not add a
second runner.

```sh
# .husky/pre-commit (or the equivalent)
"$REPO/scripts/scan.sh" staged
```

If an escape hatch is needed, name it `SKIP_SECRET_SCAN=1`, make it print a line, and
keep it out of the default path.

Probe the hook before trusting it:

```bash
printf 'token: ghp_16C7e42F292c6912E7710c838347Ae178B4a\n' > /tmp/leak-probe.txt
cp /tmp/leak-probe.txt ./leak-probe.txt && git add leak-probe.txt
git commit -m probe            # must FAIL
git restore --staged leak-probe.txt && rm leak-probe.txt
```

## Layer 2 — project `.gitleaks.toml`

The file holds two different things:

1. **Rules for the project's own identifier shapes.** The default ruleset is
   keyword-anchored and entropy-based; it finds credentials and nothing else. Addresses,
   pool values, node names and endpoint hosts become detectable only once this file names
   their shape. A default ruleset that never fired proves nothing about them.
2. **Allowlists for placeholders that must stay quiet.** Without them the doc placeholders
   trip every build until someone allowlists a whole directory, and the scan is blind there.

Scaffold from `references/gitleaks.toml.template`, then:

1. Replace `{{PROJECT_NAME}}`.
2. Delete or rename rules for vocabulary the project does not have.
3. Add rules for the identifier shapes it does have — its hostnames, its own `key=value`
   keys, its actor names.
4. Run the fixture in `references/calibration.md`: `trips.md` fully hit, `quiet.md` empty,
   `edges.md` exact.
5. Run `scripts/scan.sh dir .` on the real tree. Read every hit. For each one: fix the
   content, or add a narrow allowlist entry with a reason.

Repeat step 4 after every config edit.

### Rule shapes

The template carries `local-ip`, `public-ip`, `identifier-quoted`, `identifier-assigned`
and `endpoint-host`.

- Keep the quoted and assigned forms as separate rules. A shared loose value class either
  eats prose punctuation (`endpoint: engine.`) or nests capture groups.
- Anchor the value's first character case-sensitively: `(?-i:[a-z0-9])`. Whether `(?i)`
  covers it decides if `Node: the` in English prose matches.
- Keep `keywords` accurate. gitleaks runs a rule's regex only on lines containing one of
  them; a wrong keyword list means the rule never fires.
- Match placeholders exactly, terminated by `(?:[?&\s;,"']|$)`. `pool=prod` is a
  placeholder; `pool=prod-blue` is a real value.
- Use rule-scoped `[[rules.allowlists]]`, never the global `[allowlist]`, unless the entry
  is genuinely project-wide.
- Allowlist what the docs must teach: `example.com`, `engine.example.com`, `127.0.0.1`,
  `192.0.2.0/24`, `203.0.113.0/24`, `local-test`, `EXAMPLE_TOKEN`.
- Regex is RE2: no lookarounds, no backreferences. `(?!...)` panics at config load.
- Mirror optional syntax in `regexTarget = "match"` allowlists. A rule with
  `(?:https?://)?` needs the allowlist to repeat it.
- Type annotations (`{ pool: string }`) and module specifiers (`node:fs`) need their own
  allowlist entries; add them the first time calibration flags them.

## Layer 3 — the echo trap

Rule: scrubbing a string in a test file is not done until the test that surfaces that
string passes.

After any scrub, run:

```bash
scripts/echo-audit.sh '<pattern>'
```

Exit status tells you where you are:

| Exit | Meaning | Next |
|---|---|---|
| 0 | no match in the rev, working tree, or index | done |
| 3 | matches only inside test files | the code under test can regenerate the value |
| 4 | matches outside test files | not done; fix those first |

On exit 3:

1. Run the test suite. A test that fails after the scrub identifies the code that
   generates the value.
2. Read that code for everything it interpolates from input: `JSON.stringify`, template
   literals, `util.inspect`, formatted log lines, error messages.
3. Re-run the audit with the placeholder that will be kept.

Pattern note: a value inside a regex literal is escaped (`192\.168`), so pass the escaped
form too when auditing.

## Layer 4 — history

```bash
gitleaks git . --log-opts="--all"              # every reachable commit
gitleaks git . --log-opts="BASE..HEAD"         # one branch
git log -S'<value>' --oneline --all            # when the value is known
```

Also check what is published elsewhere: release tarballs, container layers, package
registries, CI build logs. A rewrite does not touch those.

### Rewrite or rotate

| Situation | Do |
|---|---|
| Credential was ever live and pushed to a shared remote | Rotate first. Then decide whether the history is worth rewriting; the value is public either way |
| Credential was never live (EXPIRED, EXAMPLE, always-fake fixture) | Fix the content. Rewrite optional |
| Non-credential identifier that is merely private (IP, machine name, internal hostname) | Rewrite is legitimate; the value stays known to anyone who fetched it |
| Repo has forks, mirrored clones, open PRs, or package tarballs of the affected commits | Every downstream SHA is invalidated and the old objects persist somewhere. State that cost before starting |

### If a rewrite is chosen

```bash
git filter-repo --replace-text <file>        # supported tool
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease=<ref>:<expected-sha> origin <ref>
```

- `filter-branch --tree-filter` works and is slow; prefer `filter-repo`.
- Purging `refs/original` plus the reflog plus `gc` is part of the rewrite. A repo whose
  old objects are still reachable has not been rewritten.
- Push with an exact lease, never bare `--force`.
- Re-run the `--all` sweep after the rewrite and confirm the pattern returns nothing.

## Layer 5 — manual prose pass

Read the docs, schema examples, notes and rulebook (AGENTS.md / CONTRIBUTING / README) for:

- Real IPs. Public IPs first.
- Real hostnames and domains, including in `examples` arrays, log samples, schema defaults.
- Machine names, pool names, node names, actor names used as values: a distro name as a
  machine, a remote box, an agent name.
- Verbatim pasted log lines.
- Test fixtures and the assertions derived from them (layer 3).
- Counts and enumerations the tree contradicts: "four committed build products" listing
  three; a rulebook naming a file that no longer exists. Make the claim greppable, then
  check it.

Run `scripts/scan.sh dir .` for the mechanical half, then read every doc the diff touched
against the list above.

## Workflow

For a repo that has never had this:

1. **Inventory** — gitleaks installed? hook present? `.gitleaks.toml` present? CI coverage?
   Note what exists instead of replacing it.
2. **Layer 1** — install, wire, probe.
3. **Layer 2** — scaffold, add identifier shapes, run the calibration fixture, run on the
   real tree.
4. **Layer 4** — sweep `--all`. If dirty, present the rewrite-vs-rotate decision and wait
   for the maintainer. Do not rewrite history unasked.
5. **Layer 5** — prose pass over the files the sweep and the diff point at.
6. **Record** — install path, hook, config rules, and every allowlist reason go into the
   repo.

For an existing repo, step 4 runs at every release boundary.

## Reporting

Report `rule · file · line` plus a redacted context line. The full value goes into the
local JSON report (`SECRET_SCAN_REPORT=/tmp/scan.json scripts/scan.sh …`) and nowhere else.
Never paste a live secret into a chat, an issue, or a commit message.

State which layers ran and which did not.

## Strict constraints

- Never report clean from a skipped scan.
- Never allowlist a file where a narrow regex will do.
- Never rewrite history as a substitute for rotating a credential.
- Never bare `--force`; always `--force-with-lease=<ref>:<exact-sha>`.
- Never call a scrub done without re-running the echo audit and the tests.

## References

- `scripts/scan.sh` — modes `staged`, `head`, `range`, `history`, `dir`, `stdin`; fails
  when gitleaks is missing.
- `scripts/echo-audit.sh` — post-scrub audit; distinguishes "gone" from "only gone from
  the files you remembered".
- `references/gitleaks.toml.template` — the scaffold.
- `references/calibration.md` — two-sided fixture; every config edit goes through it.

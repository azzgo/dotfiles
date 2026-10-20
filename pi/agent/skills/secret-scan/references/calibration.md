# Calibrating a project `.gitleaks.toml`

Two-sided fixture for `.gitleaks.toml`. Every config edit runs through it before commit.

Two failure modes it screens out:

- **Cries wolf** — every doc edit trips the scan, then a directory gets allowlisted and
  the scan is blind there.
- **Never fires** — wrong `keywords`, an over-broad allowlist, or a regex that matches
  nothing. The scan reports clean and proves nothing.

## 1. The fixture files

Create a throwaway repo with three files. Use invented values, not real ones: the fixture
tests shapes, not values.

`trips.md` — every line here must produce a finding:

```
Endpoint: 192.168.31.7
Public: 100.64.7.21
pool: acme7
node=box-lab7
"pool": "box-mac2"
actor=agent7
endpoint: engine-a
pool=box-mac2
token: ghp_16C7e42F292c6912E7710c838347Ae178B4a
```

`quiet.md` — no line here may produce a finding:

```
Connect to http://engine.example.com:6420/ with pool: workstation
Fallback http://127.0.0.1:6420/ and http://localhost:8080/
Use EXAMPLE_TOKEN in the docs and your_api_key in configs.
"pool": "local-test", node=test, pool: default
Docs example: 192.0.2.10 and 203.0.113.7
import fs from node:fs
```

`edges.md` — the near-misses that decide whether the rules are actually precise:

```
actor: queries                  # no finding: prose, not a value (see (?-i:) note)
actor=agent7               # finding: an assigned actor name
pool=prod-blue                 # finding: starts like a placeholder, is not one
node=prod                      # no finding: exact placeholder
node="local-test"              # no finding: quoted exact placeholder
node=workstationx              # finding: starts like a placeholder, is not one
```

## 2. Run both sides

```bash
gitleaks dir . --config .gitleaks.toml --no-banner --report-format json --report-path /tmp/cal.json
```

Then check the three lists, by line number:

```bash
jq -r '.[] | select(.File=="trips.md") | .StartLine' /tmp/cal.json | sort -n | tr '\n' ' '
jq -r '.[] | select(.File=="quiet.md") | .StartLine' /tmp/cal.json
jq -r '.[] | select(.File=="edges.md") | .StartLine' /tmp/cal.json | sort -n | tr '\n' ' '
```

- `trips.md` must list **every** line. A missing one is a rule that does not fire.
- `quiet.md` must be **empty**. Anything there is noise that will train people to ignore
  the scan.
- `edges.md` must list exactly the finding lines and no others. This is the file that
  catches an allowlist written with `\b` instead of a terminator class.

## 3. Check the thing that actually matters

Fixture passing does not clear the real tree. Run it there and read every hit:

```bash
gitleaks dir . --config .gitleaks.toml --no-banner -v
```

For each hit, exactly one of two things is true:

- it is a leak → fix the content (see the echo trap in `SKILL.md` when it sat in a test
  fixture), or
- it is a legitimate placeholder → allowlist **the narrow form** with a reason, in the
  rules section, not the global allowlist.

Whole-file allowlist: only for generated code, vendored dependencies and lockfiles.
Not for source that happens to hold unreplaced config.

## 4. Re-run after every rule change

Every edit to `.gitleaks.toml` gets the fixture pass before commit.

## Rule-writing constraints

- **RE2: no lookarounds, no backreferences.** `(?!)` panics at config load. Use allowlists
  to exclude.
- **`regexTarget = "match"` compares against the rule's matched text, not the line.** A
  rule with optional syntax (`(?:https?://)?`) needs the allowlist to repeat it, or the
  allowlist stops matching whenever the value is written in that form.

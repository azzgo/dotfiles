# Calibrating a project `.gitleaks.toml`

A rule you never ran is not a rule. Two failure modes, both worse than no rule at all:

- **Cries wolf** — every doc edit trips the scan, someone allows the docs directory, the
  scan is now blind to docs.
- **Never fires** — a wrong keyword list, an allowlist that is too broad, or a regex
  that looks right and matches nothing. The scan reports clean and proves nothing.

This file is the two-sided test that catches both. Copy it into a scratch directory,
drop your rules in, and make every line land on the side it belongs.

## 1. The fixture files

Create a throwaway repo, then write three files. Keep the real values out of it — the
point of the fixture is the *shape*, and you can use a value you invented.

`trips.md` — every line here must produce a finding:

```
Endpoint: 192.168.31.7
Public: 100.64.7.21
pool: arch
node=node-b
"pool": "local-test"
actor=agent7
endpoint: engine-a
pool=local-test
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

A config that fires on your fixture can still be wrong on your real tree. Run it there
and **read every hit**:

```bash
gitleaks dir . --config .gitleaks.toml --no-banner -v
```

For each hit, exactly one of two things is true:

- it is a leak → fix the content (and see the echo trap in `SKILL.md` if it sat in a
  test fixture), or
- it is a legitimate placeholder → allowlist **the narrow form** with a reason, in the
  rules section, not the global allowlist.

If a whole file is noise, ask why before allowlisting it. Generated code, vendored
dependencies and lockfiles belong in the global `paths` allowlist. Source that merely
happens to have unreplaced config in it does not.

## 4. Re-run after every rule change

Every edit to `.gitleaks.toml` gets the fixture pass before it is committed. A rule
change is config code; it gets tested like config code, or it is decoration.

## Two failures worth knowing before you write a rule

- **RE2 has no lookarounds.** `(?!)` makes gitleaks panic at config load with a Go regex
  error, not a friendly message. Use allowlists for exclusion.
- **`regexTarget = "match"` on an allowlist compares against the rule's matched text,
  not the line.** If your rule starts with optional syntax (`(?:https?://)?`), the
  allowlist must repeat that optional syntax, or it will stop matching exactly when the
  value is written in the form the docs actually use.

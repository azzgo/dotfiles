# secret-scan calibration fixture

Invented values that exist to prove the rules still fire. They are **not** real
hosts, keys or machines, and they are deliberately *not* allowed by `.gitleaks.toml`
as values — the path is allowlisted instead, so the tree scan stays quiet while the
rules stay honest.

| File | Expectation |
|------|-------------|
| `trips.md` | every line produces a finding |
| `quiet.md` | no line produces a finding |
| `edges.md` | exactly the lines marked `finding` |

Run it:

```bash
just secret-scan              # calibration + tree + index + history
scripts/secret-scan-calibrate.sh   # calibration only
```

The script copies the fixture outside the repo first: inside the repo the path
allowlist would hide the very values the calibration is looking for.

Rules of the fixture:

- invent the values; never copy a real one
- keep the values distinct from the ones the secret-scan skill's own docs use, so
  a rule cannot pass by accident on an allowlisted example
- every rule in `.gitleaks.toml` needs at least one line here that fires it

---
name: pre-commit-sensitive-scan
description: Mechanical scan of staged changes for local machine identity, other-project identifiers, and secrets before committing in this dotfiles repo. Script-driven, zero model tokens on a clean pass. Reports hits; never edits.
disable-model-invocation: true
---

# Pre-commit sensitive scan

A dotfiles repo is full of absolute paths, machine-local state and cross-project notes. Any of
those can end up in git history permanently — a force-push rewrite is expensive and breaks every
existing clone. This skill runs the checks **before** the commit exists, so the fix is one
`git reset` away.

It is a **detector, not an editor**. It reports; you decide.

## Run it

```sh
scripts/scan            # staged changes (pre-commit — the default)
scripts/scan --head     # the last commit, for auditing an existing commit
scripts/scan --all      # every commit, counting hits per pattern — expensive, history audits
scripts/scan --diff     # print matching lines with context instead of a summary
```

Exit 0 = clean, exit 1 = hits found, exit 2 = bad usage.

## What it checks

| Class | Patterns |
|---|---|
| **machine identity** | `/Users/<name>/`, `/home/<name>/`, `$HOME`-literal expansions of it, hostname, `whoami` output committed as a literal, worktree names |
| **other projects** | paths outside this repo that appear in notes/ADRs — sibling workspace dirs, other repos' ticket dirs, other projects' tracker ids |
| **other workspaces** | Ticket / file names from a *different* local workspace leaking in as examples or fixtures |
| **secrets** | private key blocks, `ghp_` / `github_pat_` / `gho_` tokens, `Bearer <20+>`, `api_key = "<16+>"`, bare `password = "…"`, `.env` contents |
| **machine state** | files that should never be tracked at all: `.local/`, `node_modules/`, `.pi/`, `*.auth.json`, `*.local.json`, editor session dirs |

The last row is checked as **"is this path being staged at all"**, not as a content grep — a
tracked `node_modules` shows up regardless of what pattern matched.

## Pattern config

`patterns.local` holds the repo-specific rows — the sibling workspace path, other projects'
tracker prefixes, your own home directory. It is intentionally **tracked**, because the scan is
useless if the machine-specific values only exist on one machine. It contains *paths and project
names*, never secret values; a secret in here would be the leak, not the defense.

Generic rows (secrets, machine identity shape, machine-state paths) live in the script itself so
they work on a fresh clone.

## Interpreting a hit

A hit is not automatically a leak. Decide per line:

- **Real leak** — another project's identifier, a credential, your real username, another
  workspace's content. Fix it in the working tree, `git add`, re-run.
- **False positive** — a generic example (`/path/to/repo`), a documented convention, a pattern
  used to *describe* what not to do. Keep it. If the pattern will keep firing, add a
  `# fp: <reason>` comment on the line in `patterns.local` rather than weakening the rule.

When something is a false positive often enough, add it to the `allow` section of
`patterns.local` — an explicit path prefix or a literal that is known-safe in this repo.

## After a real leak has already been committed

Do **not** immediately force-push. In order:

1. Confirm the blast radius: `git log -S"<pattern>" --oneline` gives the commits, and
   `git rev-list --count <sha>..HEAD` gives how many descendants would be rewritten. A single
   old hit can still mean hundreds of rewritten commits.
2. Check `git tag --contains <sha>` — tags pointing past the hit all need handling.
3. Weigh it. One provenance line in a README is not worth breaking every clone.
4. If it is worth it, say so explicitly before running `git filter-repo`; it is not reversible by
   ordinary means and it requires a force push to a public branch.

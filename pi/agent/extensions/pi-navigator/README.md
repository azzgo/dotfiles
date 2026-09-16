# pi-navigator

`/nav <task or question>` — single entry point over every capability this repo
maintains (extensions, skills, workflow patterns). Modeled after pstack's
poteto-mode and mattpocock's `ask-matt`: a hand-curated router, not an executor.

## Why

Every skill in this repo is `disable-model-invocation`, and extension commands
(`/wf`, `/track`, `/xfer`, …) are invisible to the driving model by default. So
the model can't route to them on its own. `/nav` injects the capability
knowledge on demand: hand-curated `catalog.md` + an auto-scanned inventory of
the skills actually on disk (`~/.pi/agent/skills/`, `<cwd>/.pi/skills/`,
`~/.agents/skills/`), sent as an invisible message that triggers a turn. The
model answers with a concrete workflow — which `/skill:<name>`, which command,
which pattern, in what order — without executing anything.

## Maintenance

`catalog.md` is the curated core: extension capabilities, skill routing by
situation, patterns, and anti-patterns. When you add a skill, extension, or
pattern, update it. The scanned inventory is only a freshness backstop, so
catalog drift degrades gracefully.

Decision record: `docs/adr/0010-pi-navigator-extension.md`.

pi/agent/patterns/ — pattern library maintained by this repo.

Format contract: each Pattern is a Definition — YAML frontmatter (name, description,
ordered nodes[] with id/title/type/suggest) followed by a `## <node-id>` prose section
with a `done-when:` line per node.

## Layout

- Root level: patterns directly instantiable via `/wf start <name>` (flat `<name>.md` lookup).
- `examples/`: reference Definitions only — NOT part of the flat `/wf start` lookup
  (the runtime resolves `<name>.md` at the library root only). They demonstrate
  structure and are meant to be adapted per project, not used globally: each
  project's workflow should be set up concretely for that project; there is
  deliberately no universal workflow template.

Created: 2026-09-08
2026-09-13: feature / bugfix / perf moved into `examples/` — no project-agnostic
workflow template is maintained; workflows should be set up per project instead.

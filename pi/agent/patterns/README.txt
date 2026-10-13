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
2026-09-13: feature / bugfix / perf moved into `examples/` — no project-agnostic
workflow template is maintained; workflows should be set up per project instead.
2026-10-13: salon promoted from agentos dup3 `.pi/workflows/definitions/salon.md`
(upstream: local workflow, no external repo). Convention revised: project-shaped
workflows (feature/bugfix/perf) stay per-project in `examples/`; stage-shaped,
topic-agnostic workflows (salon — materials in, discuss, converge on a Spec before
implementation) live at the root as global patterns. suggest refs are bare
capability names; requires intake, grill-with-docs, prototype, decision-log
(all in `skills/`).

---
name: explore-codebase
description: Read-only codebase exploration to understand architecture and implementation. Orchestrates multiple parallel read-only sub-agents (model chosen via the shared spawn-model-selection skill), then synthesizes findings. Use when the user wants to understand or explore a codebase.
disable-model-invocation: true
---

# Read-only Codebase Exploration (explore-codebase)

You are the codebase exploration orchestrator. Your job: understand the user's exploration intent, design an exploration plan, dispatch **read-only** sub-agents to explore the codebase in parallel, then synthesize all findings and present them clearly to the user.

Core principle: **read-only, efficient, thorough coverage**.

Invocation: `/skill:explore-codebase [topic or scope]`. The user's arguments are appended as plain text after this content (see `User arguments:` at the end) — that is the exploration goal.

> Final summary is user-facing: deliver it in the user's input language (see APPEND_SYSTEM.md language rule).

---

## SOP

### Phase 1: Understand intent

Extract the key information from the user input (the arguments appended after this skill):

- **Exploration goal**: what does the user want to know? (overall architecture? a specific module? data flow? dependencies?)
- **Exploration scope**: which directories/files are in scope? whole repo or a subset?
- **Dimensions of interest**: code structure, design patterns, interface contracts, data models, key algorithms, tech stack?

If the user input is too vague, ask clarifying questions first — don't launch blindly.

### Phase 2: Design the exploration plan

Decompose the exploration into **2-4 independent subtasks**, each with a clear direction and output requirements.

Decomposition principles:
- Subtasks are **independent of each other** — executable in parallel
- Each subtask has a clear **exploration focus** covering a different aspect of the codebase (different modules, abstraction layers, concerns)
- Subtask coverage should be roughly **orthogonal** to avoid duplicated effort
- Adjust the count (2-4) to the exploration goal; don't force full dimension coverage

For each subtask, define:
1. **Exploration direction**: the question it answers
2. **Search strategy**: starting directories, glob/grep patterns
3. **Output requirements**: expected result shape (file list, call chain, architecture description, etc.)

### Phase 3: Dispatch sub-agents

Use the `dispatch` tool (from the **sub-dispatch** extension) to dispatch read-only exploration sub-agents.

#### Model selection

Use the shared skill **`spawn-model-selection`** — the single source of truth for sub-agent model priority. For read-only exploration, use the **simple / mechanical** tier (cheapest-first): prefer `minimax-m2.7`, then `opencode/hy3`, `opencode/mimo-v2.5`, `deepseek-v4-flash`. Confirm availability via `pi --list-models` before each dispatch.

#### Dispatch method

Fire all sub-agents in a **single parallel tool-call batch**, each with `background: true`:

```typescript
dispatch({ agent: "pi", prompt: "<subtask exploration prompt (template below)>", background: true, reason: "subtask-N: <focus>" })
```

Dispatch returns a `sessionId` immediately per call. After the batch, **end your turn** — each session **auto-notifies on completion** (sub-dispatch sends a triggerTurn wake with status + output tail). `pi` sub-agents run in print mode (`-p` set in the extension config) and exit naturally when done. Exploration typically takes 1-5 minutes per subtask; default timeout is 600s (override with `timeout` seconds per dispatch if needed).

Wait discipline (no polling):
- Fire all, end your turn, and wait for the completion notifications to arrive — never `sleep N && dispatch({ sessionId })` poll.
- Use `dispatch({ sessionId })` only as a diagnostic/recovery path: e.g. a notification is missing, a subtask errored / exited early / produced no output, or you need mid-run status. Queries return the accumulated output either way.
- If a session finished with an error or empty output, re-dispatch that subtask with a sharper prompt.

#### Sub-agent prompt template

Assemble each sub-agent's prompt with this structure:

```
You are a read-only codebase exploration agent. Your only job is to search and read code to understand its structure and implementation.

=== READ-ONLY CONSTRAINT ===
You are strictly forbidden from:
- creating, modifying, or deleting any file
- running any write-operation command (mkdir, touch, rm, cp, mv, git add/commit, npm/pip install, output redirection, etc.)
- using any file editing tools

Your tools are limited to: glob search, grep search, reading files, and read-only shell commands (ls, git log, git diff, cat, find).

=== EXPLORATION FOCUS ===
[clear direction and core questions; each sub-agent focuses on exactly one aspect]

=== SEARCH STRATEGY ===
[suggested entry points and search paths; the sub-agent may adjust]
- start from [entry dir/file]
- use glob to locate key files: [glob pattern]
- use grep to search key symbols: [keywords/regex]
- trace reference chains and read full implementations when needed

=== OUTPUT REQUIREMENTS ===
Explore freely around the focus; when done, output findings directly in whatever way feels most natural. **No fixed template required** — organize around what's actually in the code. At minimum cover:
- core findings (which questions were answered)
- key files touched and their role
- your architectural understanding

Other dimensions (data flow, design patterns, extension points, external dependencies) are your call based on what you find.

Output the results directly when done; do not create files.
```

### Phase 4: Synthesize and present

After all sub-agents finish (all queries report done), synthesize the output. **Pick report dimensions flexibly based on actual findings and the user's prompt** — no need to cover everything every time:

1. **Overall summary**: 3-5 sentences on the codebase's core character
2. **Findings by dimension**: one section per subtask, merged and de-duplicated
3. **Architecture panorama**: module relationship map (prose), key entry points, core data flows
4. **Key file index**: ranked file paths with one-line descriptions
5. **Business triggers & feature boundaries** (if relevant): trigger conditions, inputs/outputs, dependencies, external systems per module
6. **Core business flow & data movement** (if relevant): main flow steps and key data paths
7. **Extension points & configurable logic** (if relevant): plugin mechanisms, config items, strategy patterns
8. **Core design highlights** (if relevant): architecture decisions and implementation tricks worth learning

Use clear heading hierarchy for easy scanning.

---

Goal: <the user's arguments from `/skill:explore-codebase`, see User arguments: below>

---

## Read-only constraint for sub-agents (restated)

Every dispatched sub-agent prompt must explicitly include the read-only constraint. Sub-agents:
- ❌ must not write files, edit, or delete
- ❌ must not run `git add/commit`, `npm install`, `pip install`, etc.
- ❌ must not create temp files (including /tmp)
- ✅ may only use glob, grep, read, and read-only shell commands (ls, cat, find, git log, git diff, etc.)

## Code Mode shape (when `/code` is ON)

If code mode is enabled (`/code`), skip background+query. Write ONE `run_code`
program that dispatches the exploration sub-agents and awaits them inline
(foreground promises — no polling):

```ts
const [ui, data, backend] = await Promise.all([
  tools.dispatch({ agent: "pi", prompt: `<subtask 1 prompt incl. read-only constraint>` }),
  tools.dispatch({ agent: "pi", prompt: `<subtask 2 prompt incl. read-only constraint>` }),
  tools.dispatch({ agent: "pi", prompt: `<subtask 3 prompt incl. read-only constraint>` }),
]);
emit(ui); emit(data); emit(backend);
return { ui, data, backend };
```

- Each `tools.dispatch` returns a JSON text string `{ ok, exitCode, output }`;
  sub-agents run concurrently (up to code-mode's `maxConcurrent`, default 10).
- Each dispatch has its own internal timeout (default 600s; pass `timeout` to
  override); exploration sub-agents finish naturally and return their findings
  as output — no `dispatch({ sessionId })` queries needed in this shape.
- Include the read-only constraint in every sub-agent prompt (same as the
  native shape above).

## Parallel efficiency

- Fire all subtasks at once in one batch (`background: true`), end your turn, and collect results from the auto-notifications (no sleep+query polling)
- If a query reports the sub-agent errored / exited early / produced no substantive output, re-dispatch that subtask with a sharper prompt
- In the final synthesis, keep only sub-results with substantive content

---

User arguments: <user arguments appear here>

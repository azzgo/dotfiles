---
name: bg-run
description: "Run a long command or another coding agent in the background — a detached tmux session or a Herdr pane — then capture its output later without blocking the current session. Use when a task takes many minutes, when the work must survive the current session ending, when you want to hand it to another agent, or when the user says «挂到后台» / «丢个 tmux 跑» / «起个 pig 进程去修» / «不用管结果». Also for tasks whose result is not needed at all — fire and forget."
disable-model-invocation: true
---

# BG Run

Start work that outlives the current turn. The command runs in a detached tmux
session (or a Herdr pane), keeps running after this session ends, and leaves a
file you can read whenever you want.

**This skill is for work you deliberately hand off.** It is opt-in: the model
never picks it on its own. Use it when the user asks for a background run, or
when the user has already said the work should run unsupervised.

## Choose the shape

| Situation | Route |
|---|---|
| Long command: build, test suite, batch job | tmux (`bg start -- <cmd>`) |
| Another coding agent should do the work | Herdr (`bg start --agent pi -- "<prompt>"`) |
| Long command **and** you want to watch it live | Herdr pane, then `bg attach` |
| Nothing here yet | Plain `bash` is fine — do not reach for this |

`bg` picks the route for you: `--agent` needs Herdr, everything else is tmux.

## The command

The script lives next to this file. Resolve it once per session:

```sh
BG_SCRIPT="$(ls -d ~/.agents/skills/bg-run/scripts/bg 2>/dev/null || echo /path/to/repo/skills/bg-run/scripts/bg)"
```

If the skill is not linked into `~/.agents/skills/`, use the path in the repo
instead.

### Start

```sh
"$BG_SCRIPT" start --name fonts-fix --cwd /path/to/repo -- ./gradlew test
"$BG_SCRIPT" start --name fonts-fix --agent pi --cwd /path/to/repo -- "Fix the failing test in packages/bridge/internal/fonts. Do not commit."
```

- `--name` — a label you pick. Without it you get a timestamp. Names must be
  unique; a second `start` with the same name kills the first.
- `--cwd` — where the work happens. Defaults to the current directory.
- `-- <command...>` — the command to run. Its stdout **and** stderr are captured.
- `--agent KIND -- "<prompt>"` — hand the work to a coding agent. `KIND` is one of
  `pi`, `claude`, `codex`, `gemini`, `cursor`, `omp`, `opencode`, … (see
  `herdr agent start --help` for the full list).

### Capture

```sh
"$BG_SCRIPT" capture --name fonts-fix
"$BG_SCRIPT" capture --name fonts-fix --lines 200
```

Output starts with a status line, then the exit code, then the tail of what the
command printed.

### The rest

```sh
"$BG_SCRIPT" list                      # every run this skill manages
"$BG_SCRIPT" send --name fonts-fix -- "also run the linter"
"$BG_SCRIPT" attach --name fonts-fix   # jump into the live session
"$BG_SCRIPT" kill --name fonts-fix     # stop it and clean up
```

## How to tell whether it finished

**Never infer it from the output.** A command that prints a shell prompt, or an
agent that goes quiet, may still be working. The exit code file is the only
authority:

```
~/.cache/bg-run/<name>/rc      the exit code, written when the command ends
~/.cache/bg-run/<name>/out.log everything it printed
```

`bg capture` prints `== exit code: (still running)` until `rc` exists. When it
appears, the run is over and that number is the verdict.

For a Herdr agent run there is no `rc`; the status line comes from Herdr's own
lifecycle detection: `idle`, `working`, `blocked`, `done`, or `unknown`.

## Rules

1. **Do not poll in a loop.** Capture once when you have a reason to. Do not
   `sleep 30 && capture` repeatedly — that burns turns and tells you nothing new.
2. **Do not block the terminal.** A long command belongs in `bg start`, never in
   a bare `bash` call that will hold the session open for an hour.
3. **A background run outlives this session.** That is the point — but it also
   means the work keeps burning tokens after you stop watching. Tell the user
   when you started one and what to check.
4. **Fire-and-forget is allowed.** If the user says the result is not needed,
   start it, say so, and stop. Do not capture it later "to be thorough".
5. **Never kill a run you did not start.** `bg list` shows only this skill's
   runs; `kill` takes a name.
6. **`blocked` means a question, not progress.** When Herdr reports `blocked`,
   the agent is waiting for an answer. Read the output, then ask the user before
   answering on its behalf.

## Working with Herdr

Herdr manages this terminal as a set of workspaces, tabs, and panes. It knows
which pane holds which agent and whether that agent is working or waiting.

### Reading the current layout

```sh
herdr pane layout --current          # panes and their sizes
herdr agent list                     # every agent Herdr sees, with status
```

Pane IDs look like `w5Q:p1`; tab IDs like `w5Q:t1`. Read them from command
output — never guess them from sidebar order.

### Splitting a pane

Split the pane you are in, keeping your own focus and directory:

```sh
herdr pane split --current --direction right --cwd "$PWD" --no-focus
```

The response carries the new pane ID in `.result.pane.pane_id`. `--direction
down` puts it below instead.

**Width decides readability.** `pane split` halves the available width, so the
new pane ends up narrow — and a narrow pane wraps every line, making agent
output unreadable. Prefer a new tab when the work needs room:

```sh
herdr tab create --cwd "$PWD" --label mytask --no-focus
```

### Running a command in a pane

```sh
herdr pane run <pane-id> "just test"          # sends text and Enter together
herdr pane wait-output <pane-id> --match "test result" --timeout 120000
herdr pane read <pane-id> --source recent-unwrapped --lines 120
```

`pane read --source recent-unwrapped` joins soft-wrapped lines — use it for
logs and transcripts. `visible` is the current viewport, `recent` keeps the
wraps.

### Agents

```sh
herdr agent start reviewer --kind pi --pane <pane-id>
herdr agent prompt reviewer "Review the diff." --wait --timeout 120000
herdr agent wait reviewer --until blocked --timeout 120000
herdr agent read reviewer --source recent-unwrapped --lines 120
herdr agent get reviewer
herdr agent send-keys reviewer esc
```

`agent start` succeeds only once Herdr sees the agent come up in that pane.
`agent prompt --wait` waits for the first settled state (`idle`, `done`, or
`blocked`); it does not mean the whole task is done — for that use
`agent wait --until done` or check `agent get`.

Send keys with logical names (`esc`, `ctrl+c`), not escape sequences.

### When to use the raw pane surface

`herdr agent …` operates on the agent Herdr recognizes. Use `herdr pane …` when
you deliberately want raw terminal control — sending a literal keystroke, or
reading what is on screen without agent interpretation.

## When Herdr is not there

`HERDR_ENV` is unset outside a Herdr-managed terminal. Then `bg start --agent`
refuses, and everything else still works through plain tmux.

Plain tmux equivalents, when you need them directly. The script names its
sessions `bgrun-<name>`, so a session it created is reachable by that name:

```sh
tmux new-session -d -s bgrun-<name> -c <dir> '<command>'
tmux send-keys -t bgrun-<name> '<text>' Enter
tmux capture-pane -p -t bgrun-<name> -S -100
tmux kill-session -t bgrun-<name>
```

Two tmux details that cost time when they are forgotten:

- `capture-pane` shows the pane, so `remain-on-exit` is what lets you read the
  output after the command exits. Set it with
  `tmux set-option -w -t bgrun-<name> remain-on-exit on`.
- `send-keys` pastes text but does not always submit it. If the command has not
  started, send `Enter` a second time.

`bg start` already handles both.

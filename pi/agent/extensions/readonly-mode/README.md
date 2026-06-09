# read-only mode 🛡️

A pi extension that restricts the agent to **read-only tools** — perfect for exploration, planning, code review, and architecture discussion without the agent jumping into implementation.

## Use Cases

- **"Grill me" 代码审查** — 深度质疑你的代码设计决策，模拟严格的 Code Review
- **Implementation Planning** — 讨论实现方案而不让 agent 提前改代码
- **方案讨论 / Solution Design** — 在白板阶段充分讨论架构与设计
- **Code Explorer** — 自由浏览和学习代码库，零副作用

## Install

The extension auto-discovers from `~/.pi/agent/extensions/readonly-mode/` (symlinked from the dotfiles repo).

## Usage

| Feature | Key | Notes |
|---------|-----|-------|
| Flag | `--readonly` | Start pi in read-only mode |
| Command | `/readonly` | Toggle read-only mode on/off |
| Shortcut | `Ctrl+Alt+R` | Toggle read-only mode |

### Examples

Start in read-only mode:

```bash
pi --readonly
```

Toggle inside pi:

```
/readonly
```

Enter read-only mode with a specific prompt in one step:

```
/readonly How is authentication handled in this project?
```

Run `/readonly` again to exit.

## Allowed Tools

- `read` — Read file contents
- `bash` — Read-only commands (ls, cat, grep, git status/log/diff, pwd, which, head, tail, etc.)
- `grep` — Search file contents
- `find` — Find files by pattern
- `ls` — List directories

## Blocked

- `edit` — File editing
- `write` — File creation/overwriting
- Destructive bash commands: `rm`, `mv`, `cp`, `mkdir`, `chmod`, `sed -i`, `git commit/push`, `npm install`, output redirects (`>`, `>>`), and any command that could modify the filesystem

## How it Works

Two layers of protection:

1. **Tool whitelist** — `setActiveTools()` restricts the LLM to only read-only tools.
2. **Defense-in-depth** — A `tool_call` handler blocks `edit`, `write`, and destructive bash commands even if the LLM somehow attempts them.

State persists across session restarts and tree navigation.

## Credits

Based on the design of [`@dreki-gg/pi-ask-mode`](https://github.com/dreki-gg/pi-extensions/tree/main/packages/ask-mode), adapted for broader exploration/planning/code-review scenarios with a customized safety checker and tailored system prompts.

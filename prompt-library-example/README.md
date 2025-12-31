# AI Prompt Templates - Example Library

This directory contains example AI prompt templates for reference.

**⚠️ Important**: This is an example library. It's recommended to create your own custom prompt directory rather than modifying these examples.

## Setting Up Your Custom Prompt Directory

Configure a custom directory for your personal prompts:

**Bash/Zsh** (add to `~/.bashrc` or `~/.zshrc`):
```bash
export AI_PROMPTS_DIR="$HOME/my-prompts"
```

**Nushell** (add to `config.nu`):
```nushell
$env.AI_PROMPTS_DIR = "~/my-prompts"
```

The path supports `~` expansion and will be resolved to your home directory.

## Prompt File Format

Create Markdown files (`.md`) with optional YAML front-matter:

```markdown
---
title: My Prompt Title
description: Brief description of what this prompt does
tags:
  - tag1
  - tag2
---

Your actual prompt content goes here...
```

### Front-matter Fields

All fields are optional:

- **title**: Human-readable name shown in the picker (fallback: filename)
- **description**: Brief description of the prompt's purpose
- **tags**: List of tags for categorization

## Usage in Neovim

### Opening the Picker

- Command: `:AIPromptPicker`
- Quick Actions menu: Press `<Alt-.>` and select `[AI] - prompt picker`

### Picker Actions

| Key | Action | Description |
|-----|--------|-------------|
| `<Enter>` | Edit | Open prompt file in current window |
| `<Ctrl-v>` | VSplit | Open in vertical split |
| `<Ctrl-s>` | Split | Open in horizontal split |
| `<Ctrl-t>` | Tab | Open in new tab |
| `<Ctrl-y>` | Yank | Copy prompt content to clipboard |
| `<Ctrl-i>` | Insert | Insert prompt content at cursor |

## Example Prompts in This Directory

- `code-review.md` - Code review guidelines
- `refactor.md` - Refactoring assistance
- `tdd-help.md` - TDD test case generation
- `examples/explain-code.md` - Code explanation template

## Creating Your Own Prompts

1. Create a new `.md` file in your custom prompts directory
2. Optionally add YAML front-matter at the top
3. Write your prompt content below the front-matter
4. The picker will automatically detect new files (no restart needed)

## Best Practices

- Use descriptive filenames (they serve as fallback titles)
- Add front-matter for better organization
- Keep prompts focused and reusable
- Use subdirectories to organize prompts by category
- Test prompts with your AI tool before committing

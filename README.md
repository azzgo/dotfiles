# Dotfiles

A comprehensive collection of configurations for editors, terminals, shells, and development tools optimized for productivity and modern development workflows.

## Overview

This repository contains configurations for:

- **Editors**: Neovim, Vim, IDEAVim
- **Terminals**: Alacritty, Ghostty
- **Shells**: bash, zsh, nushell
- **Development Tools**: starship prompt, tmux, and more
- **AI Tooling**: Pi shared configuration (non-sensitive parts only)

All configurations are designed to work together seamlessly and can be installed individually or as a complete environment.

## Prerequisites

- **Platform**: Linux, macOS, or WSL (not tested on Windows)
- **Git**: For cloning the repository
- **Just**: Command runner for installation ([installation guide](https://github.com/casey/just))

### Editor-Specific Requirements

- **Neovim**: Version 0.8+ required
- **C compiler**: Required for Neovim treesitter parsers
- **ripgrep**: Enhanced grep for fuzzy finding ([installation guide](https://github.com/BurntSushi/ripgrep))

## Quick Start

Clone the repository and install your preferred configurations:

```bash
# Clone the repository
git clone https://github.com/azzgo/dotfiles
cd dotfiles

# Install everything (recommended for first-time setup)
just install-all

# Or install specific components
just install-neovim    # Neovim configuration
just install-vim       # Vim configuration
just install-ideavim   # IDEAVim configuration
just install-terminals # Terminal configurations
just install-shell     # Shell configurations
just install-pi        # Pi shared configuration
just install-herdr    # herdr configuration (symlink config.toml)
```

## Configurations

### Editors

#### Neovim
Modern Neovim setup with Lua configuration, featuring:
- Plugin management via [Lazy.nvim](https://github.com/folke/lazy.nvim)
- LSP support with autocompletion and diagnostics
- Treesitter for enhanced syntax highlighting
- Fuzzy finding with fzf-lua and telescope
- Git integration and file management
- **AI Prompt Picker**: Browse and insert AI prompt templates

**Installation**: `just install-neovim`

#### Vim
Classic Vim configuration with:
- Essential plugins for productivity
- Optimized key bindings and settings
- Compatible with the Neovim setup

**Installation**: `just install-vim`

#### IDEAVim
Vim emulation for JetBrains IDEs with:
- Essential Vim bindings and motions
- IDE integration optimizations

**Requirements**: Install IdeaVim plugin from JetBrains Plugin Store
**Installation**: `just install-ideavim`

### Terminals

#### Alacritty
GPU-accelerated terminal with:
- Catppuccin Macchiato theme
- Optimized font configuration
- Custom key bindings for copy/paste
- Performance-focused settings

#### Ghostty
Modern terminal emulator with:
- Fast rendering and low latency
- Comprehensive configuration options

**Installation**: `just install-terminals` (installs all available terminal configs)

### Shells

#### Bash
Enhanced bash configuration with:
- Comprehensive git aliases for common workflows
- Navigation shortcuts and productivity helpers
- Color scheme integration

#### Zsh
Advanced zsh setup featuring:
- Shared aliases with bash for consistency
- Enhanced completion and history
- Integration with development tools

#### Nushell
Modern shell with structured data support:
- Intuitive command syntax
- Built-in git workflow aliases
- Editor integration (automatically detects nvim/vim)
- File manager integration with lf

**Installation**: `just install-shell`

### Development Tools

#### Starship Prompt
Cross-shell prompt with:
- Git status and branch information
- Command duration display
- Customizable modules for various tools

#### Tmux
Terminal multiplexer configuration with:
- Optimized key bindings
- Session management
- Integration with other tools

#### Pi
Shared Pi setup with:
- Version-controlled `settings.json`, `keybindings.json`, `mcp.json`, `prompts/`, `skills/`, `extensions/`
- **Extensions load by directory auto-discovery, not by the `settings.json` `extensions` array.** Pi scans `~/.pi/agent/extensions/` and loads every entry it finds (`addAutoDiscoveredResources` in pi's `package-manager.js`), so `install-pi`'s symlinks are the actual load list. Do **not** add a redundant `extensions` array — entries there are only meaningful as filters (`-extensions/x` to force-disable an auto-discovered extension, `+extensions/x` to override an exclusion). A plain (unprefixed) entry turns the array into a whitelist and hides everything else.
- `pi/agent/APPEND_SYSTEM.md` — appended to pi's system prompt globally (language rule + blocking-command guidance)
- `pi/agent/prompts/` is linked to Pi's global prompt templates directory: `~/.pi/agent/prompts/`
- `models.json` and `auth.json` remain local on each machine
- Only cross-device-safe Pi config is linked by dotfiles
- `pi/agent/skills/` holds pi-coupled skills (sub-dispatch / dispatch tool / pi prompts). Skills are **not linked globally** anymore — the `project-skills` pi extension provisions them per project: run `/pi-skills` inside a project to link `pi/agent/skills/` and `skills/` into `<project>/.pi/skills/` and `<project>/.agents/skills/`, then delete or override individual links as the project needs.

**Installation**: `just install-pi` or `just link` (per-project skills via `/pi-skills` in the target project)

#### PiG (pi-in-go)

A second, **independent** host for the same extensions — [PiG](https://pi-in-go.dev/) is the Go implementation of pi, built against the same upstream pi release (pi 1.3.0).

- Config root `~/.pig` (agent dir `~/.pig/agent`), project dir `<project>/.pig` — **not shared** with `~/.pi`
- `models.json` / `auth.json` / `settings.json` are copied once into `~/.pig/agent` and stay local to that config
- Linked from the repo (shared config): `keybindings.json`, `APPEND_SYSTEM.md`, `mcp.json`, `prompts/`
- Installed extensions: `pi-xfer` (npm), `pi-hashline-edit-pro` (npm), `sub-dispatch`, `project-skills`, `track`, `compaction`, `command-palette` — the repo ones install as local paths, so repo edits apply after `/reload`
- `project-skills`, `sub-dispatch` and `track` are host-aware: the project config dir follows the SDK's `CONFIG_DIR_NAME` (`.pi` under pi, `.pig` under PiG) and the dispatch forensic log follows the host agent dir
- Code Mode: PiG ships `codemode` as a built-in tool but keeps it off by default — enable it in `~/.pig/agent/settings.json` with `"defaultTools": ["+codemode"]`

**Installation**: `just install-pig` (downloads the pinned `pig` release, verifies its SHA-256, writes `~/.pig`, links the shared config files, installs the extensions)

**Not carried over**: `workflow-runtime` (its pattern library and `/wf` stay pi-only for now), `pi-web-access`, `pi-cc-extensions` and the pi-coupled skills (those arrive per project via `/pi-skills`)

## Available Just Commands

| Command | Description |
|---------|-------------|
| `just install-all` | Install all configurations |
| `just install-neovim` | Install Neovim configuration and plugins |
| `just install-vim` | Install Vim configuration and plugins |
| `just install-ideavim` | Install IDEAVim configuration |
| `just install-terminals` | Install all terminal configurations |
| `just install-shell` | Install shell, tmux, and starship configurations |
| `just install-pi` | Link shared Pi configuration files |
| `just install-pig` | Install the PiG (pi-in-go) binary and a separate `~/.pig` configuration |
| `just install-git-hooks` | Wire the secret-scan pre-commit hook (`core.hooksPath=.githooks`) |
| `just secret-scan` | Calibrate and run the secret scan (fixture, tree, index, history) |
| `just test-track` | Run the track extension's test suite (args pass through to vitest) |
| `just install-herdr` | Symlink herdr config.toml into ~/.config/herdr |
| `just link` | Alias for `install-pi` |
| `just nvim-health` | Check Neovim health and dependencies |
| `just nvim-update` | Update Neovim plugins |
| `just nvim-leaderf` | Install LeaderF C extension |
| `just pack-linux64` | Package dotfiles for Linux x64 distribution |
| `just info` | Display system and configuration information |
| `just clean` | Remove temporary files |

## Installation Details

The installation scripts create symbolic links to configuration files in this repository, preserving your existing configurations by appending source commands where appropriate.

### What Gets Installed

- **Neovim**: Sources `nvim/init.vim` in `~/.config/nvim/init.vim`
- **Vim**: Sources `vim/vimrc` in `~/.vimrc`
- **IDEAVim**: Links `.ideavimrc` to home directory
- **Terminals**: Links config directories to `~/.config/`
- **Shells**: Sources shell configs in respective rc files, links tmux and starship configs
- **Pi**: Links shared Pi config into `~/.pi/agent/`, including `workflow-runtime`, `track`, `code-mode`, `sub-dispatch`, the workflow pattern library (`pi/agent/patterns/` → `~/.pi/agent/patterns/`), and global prompt templates under `~/.pi/agent/prompts/`, while `models.json` and `auth.json` stay local per machine

## Customization

All configurations are designed to be modular and customizable:

- **Local overrides**: Most configurations support local customization files
- **Modular structure**: Individual components can be used independently
- **Theme consistency**: Coordinated color schemes across tools where supported

## Secret scan

Commits are scanned for secrets before they land. The scanner is the
[`secret-scan`](pi/agent/skills/secret-scan/) skill's own script; it fails when
`gitleaks` is missing, so a commit never passes silently unscanned.

| Piece | Where |
|-------|-------|
| Scanner | `gitleaks` v8.30.1 (`go install github.com/zricethezav/gitleaks/v8@v8.30.1`, or `mise use -g aqua:gitleaks/gitleaks`) |
| Rules + allowlists | `.gitleaks.toml` — every allowlist entry carries its reason in the file |
| Hook | `.githooks/pre-commit` — the only hook runner; wired by `just install-git-hooks` (`core.hooksPath=.githooks`) |
| Calibration fixture | `refs/secret-scan-fixture/` — invented values that must fire the rules |
| Full scan | `just secret-scan` — calibration, working tree, index |
| History sweep | `just secret-scan-history` — every reachable commit; run at release boundaries |

Escape hatch: `SKIP_SECRET_SCAN=1 git commit …` prints a line and skips the index
scan. It is not part of the default path.

## Troubleshooting

- **Neovim issues**: Run `just nvim-health` to check configuration and dependencies
- **Plugin problems**: Run `just nvim-update` to sync plugins
- **Permission errors**: Ensure you have write access to configuration directories
- **Missing commands**: Verify all prerequisites are installed for your platform

## Contributing

Feel free to fork this repository and adapt the configurations to your needs. The modular structure makes it easy to add or remove components.


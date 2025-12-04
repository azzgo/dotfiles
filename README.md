# Dotfiles

A comprehensive collection of configurations for editors, terminals, shells, and development tools optimized for productivity and modern development workflows.

## Overview

This repository contains configurations for:

- **Editors**: Neovim, Vim, Emacs, IDEAVim
- **Terminals**: Alacritty, Kitty, Ghostty  
- **Shells**: bash, zsh, nushell
- **Development Tools**: starship prompt, tmux, tig git interface, and more

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
just install-emacs     # Emacs configuration
just install-ideavim   # IDEAVim configuration
just install-terminals # Terminal configurations
just install-shell     # Shell configurations
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

**Installation**: `just install-neovim`

#### Vim
Classic Vim configuration with:
- Essential plugins for productivity
- Optimized key bindings and settings
- Compatible with the Neovim setup

**Installation**: `just install-vim`

#### Emacs
Modular Emacs configuration with:
- Organized into separate feature modules
- Modern package management
- Customizable local configuration support

**Installation**: `just install-emacs`

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

#### Kitty
Feature-rich terminal emulator with:
- Advanced text rendering
- Theme support and customization
- Efficient resource usage

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

#### Tig
Interactive git interface featuring:
- Enhanced git log browsing
- Custom key bindings
- Clipboard integration for commit hashes

**Included with shell installation**: `just install-shell`

## Available Just Commands

| Command | Description |
|---------|-------------|
| `just install-all` | Install all configurations |
| `just install-neovim` | Install Neovim configuration and plugins |
| `just install-vim` | Install Vim configuration and plugins |
| `just install-emacs` | Install Emacs configuration |
| `just install-ideavim` | Install IDEAVim configuration |
| `just install-terminals` | Install all terminal configurations |
| `just install-shell` | Install shell, tmux, and starship configurations |
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
- **Emacs**: Links configuration files to `~/.emacs.d/`
- **IDEAVim**: Links `.ideavimrc` to home directory
- **Terminals**: Links config directories to `~/.config/`
- **Shells**: Sources shell configs in respective rc files, links tmux and starship configs

## Customization

All configurations are designed to be modular and customizable:

- **Local overrides**: Most configurations support local customization files
- **Modular structure**: Individual components can be used independently  
- **Theme consistency**: Coordinated color schemes across tools where supported

## Troubleshooting

- **Neovim issues**: Run `just nvim-health` to check configuration and dependencies
- **Plugin problems**: Run `just nvim-update` to sync plugins
- **Permission errors**: Ensure you have write access to configuration directories
- **Missing commands**: Verify all prerequisites are installed for your platform

## Contributing

Feel free to fork this repository and adapt the configurations to your needs. The modular structure makes it easy to add or remove components.


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository containing configuration files for various development tools. The configurations are designed to work across Linux, macOS, and WSL environments.

## Development Commands

### Installation Commands

- **Install Neovim config**: `make install-neovim`
- **Install Vim config**: `make install-vim`
- **Install IdeaVim config**: `make install-ideavim`
- **Install Emacs config**: `make install-emacs`
- **Install Wezterm config**: `make install-wezterm`
- **Install Shell configs**: `make install-shell`
- **Package for Linux x64**: `make pack-linux64`

### Neovim Specific Commands

After installation, you may need to run:
- Update Treesitter parsers: `nvim --headless -c 'TSUpdateSync' -c 'sleep 20' -c 'qa'`
- Install LeaderF C extension (if Python3 available): In Neovim, run `:LeaderfInstallCExtension`

## Architecture and Structure

### Configuration Architecture

The repository uses a layered configuration approach:

1. **Core Configuration**: Shared vim settings in `vim/core` that work for both Vim and Neovim
2. **Plugin Management**: 
   - Neovim uses Lazy.nvim (`nvim/lua/plugins.lua`)
   - Vim uses vim-plug (`vim/plugin.vim`)
3. **Modular User Configs**: Neovim configurations are split into modules under `nvim/lua/users/`

### Key Configuration Patterns

- **Path Variables**: The configs use global variables to reference paths:
  - `g:vim_config_path`: Points to the vim directory
  - `g:neovim_config_path`: Points to the nvim directory
  - `g:dot_config_path`: Points to the root dotfiles directory

- **Local Overrides**: Both Vim and Neovim support local config files:
  - Neovim: `~/.config/nvim/local.vim`
  - Vim: `~/.vim/local.vim`
  - Emacs: `~/.emacs.d/lisp/init-local.el`

- **Plugin Storage**: Lazy.nvim plugins are stored in `.local/lazy/` within the dotfiles directory (not in the standard location)

### Key Technologies and Dependencies

- **Required**: 
  - Neovim 0.8+ (for Neovim configs)
  - Python3 with neovim package (`pip install --user neovim`)
  - C compiler toolchain (for Treesitter)
  - ripgrep (for LeaderF fuzzy finder)

- **Main Plugin Ecosystem**:
  - LSP: coc.nvim for both Vim and Neovim
  - Fuzzy Finding: LeaderF (requires Python3)
  - AI Assistance: GitHub Copilot and CodeCompanion
  - Git: vim-fugitive and gitsigns.nvim
  - File Management: oil.nvim (Neovim), netrw (Vim)

### Shell Integration

The shell configurations (bashrc/zshrc) source from a common structure:
- Common aliases in `shell/alias`
- FZF integration with fd for file finding
- Starship prompt configuration
- Custom scripts in `scripts/` directory

### Emacs Configuration

The Emacs setup uses a modular approach with separate files for:
- Package management (`init-packages.el`)
- UI configuration (`init-ui.el`)
- Language support (`init-lang.el`)
- Meow modal editing (`init-meow.el`)
- AI integration (`init-ai.el`)
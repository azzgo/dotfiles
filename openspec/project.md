# Project Context

## Purpose
Personal dotfiles repository providing consistent development environment configurations across editors (Neovim, Vim, Emacs, IdeaVim), terminals (Alacritty, Kitty, Ghostty), shells (bash, zsh, nushell), and development tools.

## Tech Stack
- **Configuration Languages**: Lua (Neovim), VimScript, Emacs Lisp, TOML, YAML, Shell scripts
- **Build System**: Just (command runner and task automation)
- **Package Management**: Lazy.nvim (Neovim plugins), vim-plug (Vim plugins)
- **Version Control**: Git with automated CI/CD packaging via GitHub Actions
- **Target Platforms**: Linux, macOS, WSL (Windows Subsystem for Linux)

## Project Conventions

### Code Style
- Use 2-space indentation for Lua, 4-space for shell scripts
- Kebab-case for file names and directory structure
- Modular configuration: split functionality into focused files under appropriate subdirectories
- Comment headers for major sections and complex configurations
- Prefer symlinks over copying files to maintain single source of truth

### Architecture Patterns
- **Modular Design**: Each editor/tool has its own directory with self-contained configuration
- **Source-Based Loading**: Configurations append source lines to user configs rather than overwriting
- **Plugin Management**: Lazy loading where supported, explicit dependency management
- **Cross-Platform Compatibility**: Use conditional logic for OS-specific behaviors
- **Automation First**: Use Just recipes for all setup and maintenance tasks

### Testing Strategy
- Manual testing across target platforms (Linux/macOS/WSL)
- Health checks for Neovim configuration (`just nvim-health`)
- CI automation for Linux x64 packaging
- Version compatibility testing (Neovim 0.8+, modern shell versions)

### Git Workflow
- Main branch for stable configurations
- Feature branches for new tools or major changes
- Descriptive commit messages focusing on what changes and why
- Automated releases via GitHub Actions for packaged distributions

## Domain Context
This is a **personal development environment** project focused on:
- **Editor Configuration**: Comprehensive setups for multiple editors with shared keybindings where possible
- **Terminal Theming**: Catppuccin Macchiato theme consistency across all tools
- **Shell Enhancement**: Aliases, functions, and prompt customization for productivity
- **Development Workflow**: Integration with common development tools (git, ripgrep, fuzzy finders)

Key concepts:
- **Dotfiles**: Hidden configuration files (starting with .) that customize Unix-like systems
- **Editor Plugins**: Extended functionality through community packages
- **Symlinks**: Filesystem links allowing single configuration source with multiple access points

## Important Constraints
- **Backward Compatibility**: Must support Neovim 0.8+ (older versions not tested)
- **Platform Limitations**: Windows native support not provided (WSL required)
- **Dependency Requirements**: Requires C compiler toolchain for Treesitter, Python neovim support
- **Installation Safety**: Never overwrite existing user configurations, only append source lines
- **Performance**: Plugin choices prioritize speed and minimal startup time

## External Dependencies
- **ripgrep**: Fast text search, required for fuzzy finding workflows
- **Treesitter**: Syntax highlighting and parsing (requires C compiler)
- **Python neovim**: Required for coc-snippets and some plugin functionality
- **Git**: Version control integration throughout configurations
- **Just**: Task runner for all automation scripts
- **Node.js**: Required for COC (Conquer of Completion) language server functionality

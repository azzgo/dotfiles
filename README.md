# DotFiles

The dotfiles are common used in my work and life.


## Before Start

### Neovim

For Neovim must 0.8+

- linux/macos/WSL environment. the dotfiles are not tested on windows
- c compile toolchains in your promgramming environment - it is for treesitter
- for fuzzy finding with fzf-lua
  - [ripgrep](https://github.com/BurntSushi/ripgrep): better grep
- [Lazy.nvim](https://github.com/folke/lazy.nvim) the plugin management tool

### IdeaVim

First You need install Ideavim in Idea Plugin Store

## Quick start

Feel free to pick the part you need.

```sh
# Clone the Repo first
git clone https://github.com/azzgo/dotfiles
cd dotfiles


# Neovim Setup
just install-neovim


# Vim Setup 
just install-vim

# IdeaVim 
just install-ideavim

# Emacs
just install-emacs

# Terminals (Alacritty, Kitty, Ghostty)
just install-terminals

# Shells
just install-shell


# DotFiles

The dotfiles are common used in my work and life.


## Before Start

### Neovim

For Neovim must 0.8+

- linux/macos/WSL environment. the dotfiles are not tested on windows
- c compile toolchains in your promgramming environment - it is for treesitter
- for LeaderF, charmming fuzzy finder
  - [ripgrep](https://github.com/BurntSushi/ripgrep): better grep
- [Lazy.nvim](https://github.com/folke/lazy.nvim) the plugin management tool
- [python-neovim] `pip install --user neovim`, `coc-snippets` need neovim python support now

### IdeaVim

First You need install Ideavim in Idea Plugin Store

## Quick start

Feel free to pick the part you need.

```sh
# Clone the Repo first
git clone https://github.com/azzgo/dotfiles
cd dotfils


# Neovim Setup
make install-neovim


# Vim Setup 
make install-vim

# IdeaVim 
make install-ideavim

# Emacs
make install-emacs

# Wezterm
make install-wezterm

# Shells
make install-shell


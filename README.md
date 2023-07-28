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


# Neovim Setup
mkdir -p ~/.config/nvim
echo "source $PWD/dotfiles/vim/vimrc" >> ~/.config/nvim/init.vim
nvim -c ":Lazy install"


# Vim Setup 
ln -sf $PWD/dotfiles/vim ~/.vim                 # linux or osx environment required
echo "source $PWD/dotfiles/vim/vimrc" >> ~/.vimrc
vim -c ":PlugInstall"

# IdeaVim 
ln -sf $PWD/dotfils/ideavim ~/.ideavim # After do it then restart Idea

# Emacs
mkdir -p ~/.emacs.d
ln -sf $ $PWD/dotfils/emacs/init.el ~/.emacs.d/init.el
ln -sf $ $PWD/dotfils/emacs/lisp ~/.emacs.d/lisp
## your customize local file
echo "(provide 'init-local)" >> ~/.emacs/lisp/init-local

# Wezterm
mkdir -p ~/.config
ln -sf $PWD/wezterm ~/.config/wezterm

# Shells
echo "source $PWD/shell/bashrc" >> ~/.bashrc

# Tmux
ln -sf $PWD/tmux.conf ~/.tmux.conf

# Starship Shell Prompt
ln -sf $PWD/starship.toml ~/.config/starship.toml
```

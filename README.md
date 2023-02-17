# DotFiles

The dotfiles are common used in my work and life.


## Before Start

### Neovim

For Neovim must 0.8+

- linux/macos/WSL environment. the dotfiles are not tested on windows
- c compile toolchains in your promgramming environment - it is for treesitter
- for telescope, charmming fuzzy finder
  - [fd](https://github.com/sharkdp/fd): better find
  - [ripgrep](https://github.com/BurntSushi/ripgrep): better grep
- [packer](https://github.com/wbthomason/packer.nvim) the plugin management tool

### IdeaVim

First You need install Ideavim in Idea Plugin Store

## Quick start

Feel free to pick the part you need.

```sh
# Clone the Repo first
git clone https://github.com/azzgo/dotfiles


# Neovim Setup
ln -sf $PWD/dotfiles/nvim ~/.config/nvim      # linux or osx environment required
nvim -c ":PackerSync"


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
```

# DotFiles for Archives


The dotfiles are common used in my work and life.

In nowadays, just use neovim and vim

## Neovim

Neovim must 7.0+，for use some lua plugin which is only supported after 7.0

When i prepare the config, learned a lot from this repo [dotfiles-public](https://github.com/craftzdog/dotfiles-public/blob/master/.config/nvim/after/plugin/telescope.rc.vim)


### Requirement for my plugins

#### treesitter

- g++, gcc: for syntax file compile

#### telescope

- fzf: for extension for telescope-fzf-native
  - make: for plugin install compile

### Language Server 

use [lsp-install](https://github.com/williamboman/nvim-lsp-installer) manage Language Server, you need prepare

- nodejs with npm globally
- golang globally

#### null-ls

only `prettier` you need install globally.

## Vim 

The vim config is only a minimal config for liking server enviroment editor, so it doesn't have magic here.

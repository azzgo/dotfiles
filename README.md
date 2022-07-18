# DotFiles for Archives

The dotfiles are common used in my work and life.

[TOC]

## Neovim

Neovim must 7.0+，for use some lua plugin which is only supported after 7.0


### Requirement for my plugins

#### treesitter

- g++, gcc: for syntax file compile

#### fzf.lua

- [fzf](https://github.com/junegunn/fzf): a fatasitc binary executable program dependency you must install first.
- optional: suggest to install for better performance in search file and text
  - [fd](https://github.com/sharkdp/fd): better find
  - [ripgrep](https://github.com/BurntSushi/ripgrep): better grep

### Language Server 

use [lsp-install](https://github.com/williamboman/nvim-lsp-installer) manage Language Server, you need prepare

- nodejs with npm globally
- golang globally

#### null-ls

only `prettier` you need install globally.

#### Java jdtls

I use nvim-jdtls for java Language client, but the plugin follow kiss principle, so you need configure the java and [jdtls](https://github.com/eclipse/eclipse.jdt.ls) by your self.

For my configuration you need add a named "java-lsp" script on you path, the script you can follow the [nvim-jdtls official wiki](https://github.com/eclipse/eclipse.jdt.ls)

### other notes

- the sql syntax file is forked copy from [Improved SQL syntax for vim](https://github.com/shmup/vim-sql-syntax)

## vimrc - with coc 

- sometime i need a simple but quick develop enviroment, coc with vim is suit for me

## Vim bare - the vimrc.bare

The vim config is only a minimal config for liking server enviroment editor, so it doesn't have magic here.

## wezterm

A amazing gui based terminal i liked

## For Macos

I use the yabai and skhd is to provide the tilling wm experience.

for the additional, I use [Simple Bar](https://github.com/Jean-Tinland/simple-bar) get beauity bar in Macos, it is worth.

my porn

![osxporn](.assets/osxporn.jpeg)

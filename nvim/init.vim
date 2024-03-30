let g:vim_config_path = expand('<sfile>:h:h') . '/vim'
let g:neovim_config_path = expand('<sfile>:h:h') . '/nvim'
let g:dot_config_path = expand('<sfile>:h:h')

" source basic file of vim config
exe 'source' (g:vim_config_path . '/core')


set inccommand=split

" unmap netrw for prepare nvim tree
unmap <leader>nn
let g:loaded_netrw = 1
let g:loaded_netrwPlugin = 1

" import plugins config
lua package.path = vim.g.neovim_config_path .. "/lua/?.lua;" .. package.path
lua require('plugins')

" ---------------------------
"  插件相关配置
" ---------------------------

" 设置主题样式
set t_Co=256   " This is may or may not needed.

set background=dark
" set background=light
set termguicolors
" colorscheme PaperColor

" colorscheme nord
" colorscheme catppuccin " catppuccin-latte, catppuccin-frappe, catppuccin-macchiato, catppuccin-mocha
colorscheme catppuccin-macchiato " catppuccin-latte, catppuccin-frappe, catppuccin-macchiato, catppuccin-mocha
" colorscheme rose-pine-dawn

" change git fugitive summary format
let g:fugitive_summary_format = "%s %cr"

au TextYankPost * silent! lua vim.highlight.on_yank {higroup="IncSearch", timeout=150}

"" local config for override
call SourceIfExists("~/.config/nvim/local.vim")

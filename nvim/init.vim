let g:vim_config_path = expand('<sfile>:h:h') . '/vim'
let g:neovim_config_path = expand('<sfile>:h:h') . '/nvim'
let g:dot_config_path = expand('<sfile>:h:h')

" source basic file of vim config
exe 'source' (g:vim_config_path . '/core')

set inccommand=split

" unmap netrw
unmap <leader>nn
let g:loaded_netrw = 1
let g:loaded_netrwPlugin = 1

" import plugins config
lua package.path = vim.g.neovim_config_path .. "/lua/?.lua;" .. package.path
lua require('plugins')
lua require('users.self')
" add cfilter
packadd cfilter

" ---------------------------
"  big file
" ---------------------------
"  from jdhao config
" ref: https://vi.stackexchange.com/a/169/15292
function! s:handle_large_file() abort
  let g:file_size_limit = 524288 " 0.5MB
  let f = expand("<afile>")

  if getfsize(f) > g:file_size_limit || getfsize(f) == -2
    setlocal eventignore=all
    " turning off relative number helps a lot
    setlocal norelativenumber
    setlocal noswapfile bufhidden=unload undolevels=-1
  endif
endfunction

augroup LargeFile
  autocmd!
  autocmd BufReadPre * call s:handle_large_file()
augroup END

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

"" disable nvim intro
set shortmess+=I

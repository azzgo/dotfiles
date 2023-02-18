" set winbar as file path
function! WinBarLine()
  let l:symbol = get(b:,'coc_current_function', '')
  if (empty(l:symbol))
    return expand('%f')
  else
    return expand('%f') . '#' . symbol
  endif
endfunction

set winbar=%{WinBarLine()}

let g:vim_config_path = expand('<sfile>:h:h') . '/vim'
let g:neovim_config_path = expand('<sfile>:h:h') . '/nvim'
let g:dot_config_path = expand('<sfile>:h:h')

" source basic file of vim config
exe 'source' (g:vim_config_path . '/core')

set inccommand=split

" unmap netrw for prepare nvim tree
unmap <leader>nn
unmap <leader>nf
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

" set background=dark
set background=dark
set termguicolors
" colorscheme PaperColor


let g:nord_italic = v:false
colorscheme nord


"" local config for override
call SourceIfExists("~/.config/nvim/local.vim")

" change git fugitive summary format
let g:fugitive_summary_format = "%s %cr"

" You can configure Neovim to automatically run :PackerCompile whenever plugins.lua is updated with an autocommand:
augroup packer_user_config
  autocmd!
  autocmd BufWritePost plugins.lua source <afile> | PackerCompile
augroup end



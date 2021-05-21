" 设置 leader key
let mapleader=" "
let g:mapleader=" "

set updatetime=300
set timeoutlen=500

" 插件管理
call plug#begin('~/.config/nvim/plugged')

Plug 'tpope/vim-surround'
Plug 'tpope/vim-repeat'
Plug 'neoclide/coc.nvim', {'branch': 'release'}
Plug 'ryanoasis/vim-devicons'
Plug 'NLKNguyen/papercolor-theme'  " 样式插件
Plug 'mhinz/vim-startify'          " 开屏页
Plug 'tpope/vim-commentary'        " 快速注释
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'
Plug 'easymotion/vim-easymotion'  " 快速移动

call plug#end()

" 语法高亮
syntax on

" 开启鼠标，主要为了拖拽
" set mouse=a

" 换行
set wrap

" 设置切换buffer不要提示保存
set hidden
set autowrite

" 开启文件类型检测
filetype on

" 文件类型
set fileencodings=utf-8,gb2312,gb18030,gbk,ucs-bom,cp936,latin1
set encoding=UTF-8

" 缩进
set tabstop=2
set softtabstop=2
set shiftwidth=2
set autoindent "自动缩进
set smartindent " 类C缩进
set expandtab " 将<Tab>换成<Space>
set list listchars=eol:¬,tab:▸\ ,trail:., "显示制表符

" 设置搜索匹配高亮
set hlsearch
set incsearch

" 设置行号
set number

" 设置相对行号
set relativenumber

" 标尺
set ruler

" 不允许换行
set nowrap

" 展示命令
set showcmd

" 总是展示状态栏
set laststatus=2

" 不兼容 vi mode
set nocompatible
set backspace=indent,eol,start

" 没有备份文件
set nobackup
set nowritebackup
set noswapfile

" 快速保存
nnoremap <leader>w :w<CR>

" 取消高亮
nnoremap <leader><cr> :noh<CR>


" 插入状态下，类emacs 行首行尾操作
inoremap <c-a> <c-o>I
inoremap <c-e> <c-o>A

" 折叠相关
let g:FoldMethod = 0
nmap <leader>zz :call ToggleFold()<cr>
function! ToggleFold()
    if g:FoldMethod == 0
        exe "normal! zM"
        let g:FoldMethod = 1
    else
        exe "normal! zR"
        let g:FoldMethod = 0
    endif
endfunc

" 纠正拼写 个人拼写习惯容错
iabbrev cosnt const

" .vimrc 编辑生效
nnoremap <leader>ev :e $MYVIMRC<CR>
nnoremap <leader>sv :source $MYVIMRC<CR>


" bufferNavigate
nnoremap <silent> [b :bprevious<CR> 
nnoremap <silent> ]b :bnext<CR> 
nnoremap <silent> [B :bfirst<CR> 
nnoremap <silent> ]B :blast<CR> 

" set terminal esc
:tnoremap <Esc> <C-\><C-n>
nnoremap <silent> <C-w>t :<C-u>CocCommand terminal.Toggle<CR>

" ---------------------------
"  插件相关配置
" ---------------------------

" toggle 文件浏览器
nnoremap <silent> <leader>nn :CocCommand explorer<CR>
nnoremap <silent> <leader>nf :CocCommand explorer --preset buffer<CR>

" 设置主题样式
set t_Co=256   " This is may or may not needed.

set background=dark
colorscheme PaperColor


" coc config
let g:coc_global_extensions = [
  \ 'coc-tsserver',
  \ 'coc-eslint', 
  \ 'coc-prettier', 
  \ 'coc-json', 
  \ 'coc-lists',
  \ 'coc-project',
  \ 'coc-git',
  \ 'coc-explorer',
  \ 'coc-terminal',
  \ 'coc-jest'
  \ ]
" from readme

" Use K to show documentation in preview window.
nnoremap <silent> K :call <SID>show_documentation()<CR>

function! s:show_documentation()
  if (index(['vim','help'], &filetype) >= 0)
    execute 'h '.expand('<cword>')
  elseif (coc#rpc#ready())
    call CocActionAsync('doHover')
  else
    execute '!' . &keywordprg . " " . expand('<cword>')
  endif
endfunction


" Tab 自动补全
inoremap <silent><expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()
inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

" Use <c-space> to trigger completion.
inoremap <silent><expr> <c-space> coc#refresh()
" fix: Iterm <c-space> 会发出 nul 字符，没有找到解绑的地方
inoremap <silent><expr> <Nul> coc#refresh()

" Use <cr> to confirm completion, `<C-g>u` means break undo chain at current
" position. Coc only does snippet and additional edit on confirm.
if exists('*complete_info')
  inoremap <expr> <cr> complete_info()["selected"] != "-1" ? "\<C-y>" : "\<C-g>u\<CR>"
else
  imap <expr> <cr> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"
endif


" Remap keys for gotos
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gh <Plug>(coc-type-definition)
nmap <silent> gi <Plug>(coc-implementation)
nmap <silent> gr <Plug>(coc-references)

" Remap for rename current word
nmap <F2> <Plug>(coc-rename)

" Find symbol of current document.
nnoremap <silent> <space>o  :<C-u>CocList outline<cr>

" Add `:Format` command to format current buffer.
command! -nargs=0 Format :call CocActionAsync('format')

" ========coc Mapping 相关==========
" Fix autofix problem of current line
nmap <leader>qf  <Plug>(coc-fix-current) 
" Format file
nmap <leader>cff  :call CocActionAsync('format')<CR>

" 一些常见的 coc 命令
nmap <silent><nowait><leader>cm :<C-u>CocCommand<CR>
nmap <silent><nowait><leader>cl :<C-u>CocList<CR>
nmap <silent><nowait><leader>co :<C-u>CocList outline<CR>
nmap <silent><nowait><leader>ca :<C-u>CocList diagnostics<CR>
nmap <silent><nowait><leader>cr :<C-u>CocListResume<CR>
" Do default action for next item.
nnoremap <silent><nowait> <leader>j  :<C-u>CocNext<CR>
" Do default action for previous item.
nnoremap <silent><nowait> <leader>k  :<C-u>CocPrev<CR>

" 搜索文件
nnoremap <leader>p :CocList files<CR>
nnoremap <leader>pp :CocList files<CR>
" Grep 项目搜索
nnoremap <leader>pg :CocList grep<CR>
" ========coc Mapping 相关==========

" coc-git 相关=========

" navigate chunks of current buffer
nmap [h <Plug>(coc-git-prevchunk)
nmap ]h <Plug>(coc-git-nextchunk)
" show chunk diff at current position
nmap <leader>gs :<C-u>CocList --normal gstatus<CR>
nmap <leader>gh :<C-u>:CocCommand git.chunkInfo<CR>
nmap <leader>gc :<C-u>:CocCommand git.showCommit<CR>

" coc-git 相关 End=========

" Map function and class text objects
" NOTE: Requires 'textDocument.documentSymbol' support from the language server.
xmap if <Plug>(coc-funcobj-i)
omap if <Plug>(coc-funcobj-i)
xmap af <Plug>(coc-funcobj-a)
omap af <Plug>(coc-funcobj-a)
xmap ic <Plug>(coc-classobj-i)
omap ic <Plug>(coc-classobj-i)
xmap ac <Plug>(coc-classobj-a)
omap ac <Plug>(coc-classobj-a)
" Map function and class text objects End
"
" Remap <C-f> and <C-b> for scroll float windows/popups.
if has('nvim-0.4.0') || has('patch-8.2.0750')
  nnoremap <silent><nowait><expr> <C-f> coc#float#has_scroll() ? coc#float#scroll(1) : "\<C-f>"
  nnoremap <silent><nowait><expr> <C-b> coc#float#has_scroll() ? coc#float#scroll(0) : "\<C-b>"
  inoremap <silent><nowait><expr> <C-f> coc#float#has_scroll() ? "\<c-r>=coc#float#scroll(1)\<cr>" : "\<Right>"
  inoremap <silent><nowait><expr> <C-b> coc#float#has_scroll() ? "\<c-r>=coc#float#scroll(0)\<cr>" : "\<Left>"
  vnoremap <silent><nowait><expr> <C-f> coc#float#has_scroll() ? coc#float#scroll(1) : "\<C-f>"
  vnoremap <silent><nowait><expr> <C-b> coc#float#has_scroll() ? coc#float#scroll(0) : "\<C-b>"
endif
" Remap <C-f> and <C-b> for scroll float windows/popups. End

" 开屏问候语
let g:startify_custom_header = map(split(system('fortune -s chinese | cowsay | cat'), '\n'), '"   ". v:val') + ['','']


" 设置 leader key
let mapleader=" "
let g:mapleader=" "

set updatetime=300
set timeoutlen=500

" import plugins config
lua require('plugins')
lua require('users.comment')
lua require('users.gitsigns')
lua require('users.treesitter')
lua require('users.telescope')
lua require('users.ufo')
lua require('users.fugitive')
lua require('users.lualine')
lua require('users.neotree')
lua require('users.null-ls')
lua require('users.tabby')
lua require('users.wilder')

" 语法高亮
syntax on

" 开启鼠标操作, 不追求完全全键盘操作
set mouse=n

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
nnoremap <leader>q <c-w>c

" map Q to q for ex mode is not usable for me
map Q q

" 取消高亮
nnoremap <leader><cr> :noh<CR>

" 当前行个高亮
set cursorline


" 插入状态下，类emacs 行首行尾操作
inoremap <c-a> <home>
inoremap <c-e> <end>
inoremap <c-f> <right>
inoremap <c-b> <left>

" 纠正拼写 个人拼写习惯容错
iabbrev cosnt const

" .vimrc 编辑生效
nnoremap <leader>ev :e $MYVIMRC<CR>
nnoremap <leader>sv :source $MYVIMRC<CR>
" open with current buffer workdir
nnoremap <expr><leader>ew ":e ".expand('%:h')

" bufferNavigate
nnoremap <silent> [b :bprevious<CR> 
nnoremap <silent> ]b :bnext<CR> 
nnoremap <silent> [B :bfirst<CR> 
nnoremap <silent> ]B :blast<CR> 
nnoremap <silent> [q :cprevious<CR> 
nnoremap <silent> ]q :cnext<CR> 

" tabs
nnoremap <silent> <leader>nt :tabnew<CR> 
nnoremap <silent> [t :tabprevious<CR> 
nnoremap <silent> ]t :tabnext<CR> 
" map alt + n -> tab n
nnoremap <M-1> 1gt
nnoremap <M-2> 2gt
nnoremap <M-3> 3gt
nnoremap <M-4> 4gt
nnoremap <M-5> 5gt

" set terminal esc
:tnoremap <Esc> <C-\><C-n>
:tnoremap <C-o> <C-\><C-n>

" remap C-C for lua error sometimes
inoremap <C-c> <Esc>`^
cnoremap <C-c> <Esc>`^
xnoremap <C-c> <Esc>`^
nnoremap <C-c> <Esc>`^
lnoremap <C-c> <Esc>`^
snoremap <C-c> <Esc>`^
tnoremap <C-c> <Esc>`^

" 更改 grep use riggrep
if executable("rg")
    set grepprg=rg\ --vimgrep\ --no-heading
    set grepformat=%f:%l:%c:%m,%f:%l:%m
endif

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

function! SourceIfExists(file)
  if filereadable(expand(a:file))
    exe 'source' a:file
  endif
endfunction

call SourceIfExists("~/.config/nvim/coc.vim")
"" local config for override
call SourceIfExists("~/.config/nvim/local.vim")

" change git fugitive summary format
let g:fugitive_summary_format = "%s %cr"

" You can configure Neovim to automatically run :PackerCompile whenever plugins.lua is updated with an autocommand:
augroup packer_user_config
  autocmd!
  autocmd BufWritePost plugins.lua source <afile> | PackerCompile
augroup end


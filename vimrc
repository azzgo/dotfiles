" 设置 leader key
let mapleader=" "
let g:mapleader=" "

set updatetime=300
set timeoutlen=800

" 语法高亮
syntax on

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

" bufferNavigate
nnoremap <silent> [b :bprevious<CR> 
nnoremap <silent> ]b :bnext<CR> 
nnoremap <silent> [B :bfirst<CR> 
nnoremap <silent> ]B :blast<CR> 

" 插入状态下，类emacs 行首行尾操作
inoremap <c-a> <Esc>I
inoremap <c-e> <Esc>A

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

" 纠正拼写 个人拼写习惯容错¬
iabbrev cosnt const¬

" .vimrc 编辑生效
nnoremap <leader>ev :e $MYVIMRC<CR>
nnoremap <leader>sv :source $MYVIMRC<CR>

colorscheme koehler


"============ netrw 配置 ==============

" 具备 tree 风格
let g:netrw_liststyle = 3


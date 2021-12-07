" import plug config
runtime ./plug.vim
" 设置 leader key
let mapleader=" "
let g:mapleader=" "

set updatetime=300
set timeoutlen=500


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
nnoremap <leader>q :bd<CR>

" 取消高亮
nnoremap <leader><cr> :noh<CR>


" 插入状态下，类emacs 行首行尾操作
inoremap <c-a> <c-o>I
inoremap <c-e> <c-o>A

" 纠正拼写 个人拼写习惯容错
iabbrev cosnt const

" .vimrc 编辑生效
nnoremap <leader>ev :e $MYVIMRC<CR>
nnoremap <leader>sv :source $MYVIMRC<CR>
" open with current buffer workdir
nnoremap <leader>ew :e %:h

" bufferNavigate
nnoremap <silent> [b :bprevious<CR> 
nnoremap <silent> ]b :bnext<CR> 
nnoremap <silent> [B :bfirst<CR> 
nnoremap <silent> ]B :blast<CR> 

" tabNew
nnoremap <silent> <leader>nt :tabnew<CR> 

" set terminal esc
:tnoremap <Esc> <C-\><C-n>

" 更改 grep use riggrep
if executable("rg")
    set grepprg=rg\ --vimgrep\ --no-heading
    set grepformat=%f:%l:%c:%m,%f:%l:%m
endif

" ---------------------------
"  插件相关配置
" ---------------------------
" remap easymotion prefix
map <Leader>e <Plug>(easymotion-prefix)

" toggle 文件浏览器
nnoremap <silent> <leader>nn :NvimTreeToggle<CR>
nnoremap <silent> <leader>nf :NvimTreeFindFile<CR>

" 设置主题样式
set t_Co=256   " This is may or may not needed.

set background=dark
colorscheme PaperColor


" Not want shift + G
nmap <leader>gg :<C-u>Git 
nmap <leader>gl :<C-u>Gclog<CR>


" plasticboy/vim-markdown Configuration
let g:vim_markdown_folding_disabled = 1
let g:vim_markdown_emphasis_multiline = 0


" Markdown configuration
autocmd FileType markdown set nowrap
command! -nargs=0 ImgPaste :call mdip#MarkdownClipboardImage()<CR> 
autocmd FileType markdown nmap <silent><leader>pi :<C-u>ImgPaste<CR> 
" there are some defaults for image directory and image name, you can change them
let g:mdip_imgdir = 'assets'
let g:mdip_imgname = 'pic'

function! SourceIfExists(file)
  if filereadable(expand(a:file))
    exe 'source' a:file
  endif
endfunction

"" local config for overide
call SourceIfExists("~/.config/nvim/local.vim")
""

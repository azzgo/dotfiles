call plug#begin()
" quick move
Plug 'justinmk/vim-sneak'

" must plugin
Plug 'tpope/vim-surround'
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-commentary'
Plug 'airblade/vim-gitgutter'

" coc powered up
Plug 'neoclide/coc.nvim', {'branch': 'release'}

" theme
Plug 'arcticicestudio/nord-vim'
Plug 'itchyny/lightline.vim'
 
call plug#end()


" setting leader key
let mapleader=" "
let g:mapleader=" "

set updatetime=300
set timeoutlen=800

" syntax highlight
syntax on

" switch buffer not prompt saving
set hidden
set autowrite

" fily type detect
filetype on

" default encoding
set fileencodings=utf-8,gb2312,gb18030,gbk,ucs-bom,cp936,latin1
set encoding=UTF-8

" intent
set tabstop=2
set softtabstop=2
set shiftwidth=2
set autoindent
set smartindent
set expandtab
set list listchars=eol:¬,tab:▸\ ,trail:.,

" search highlight
set hlsearch
set incsearch

" line numbers
set number
set relativenumber

" show ruler
set ruler
" disable wrap
set nowrap

" show cmd on triggering
set showcmd

" always show statusline
set laststatus=2

" disable vi mode
set nocompatible
set backspace=indent,eol,start

" no backup file
set nobackup
set nowritebackup
set noswapfile

" quick save and quit
nnoremap <leader>w :w<CR>
nnoremap <leader>q :bd<CR>

" map Q to q for ex mode is not usable for me
map Q q

" cancal highlight keymap
nnoremap <leader><cr> :noh<CR>

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

" emacs  like kemap in insert mode
inoremap <c-a> <home>
inoremap <c-e> <end>
inoremap <c-f> <right>
inoremap <c-b> <left>

" spell correct
iabbrev cosnt const¬

" .vimrc quick kemap source and edit
nnoremap <leader>ev :e $MYVIMRC<CR>
nnoremap <leader>sv :source $MYVIMRC<CR>

" open with current buffer workdir
nnoremap <expr><leader>ew ":e ".expand('%:h')

"============ netrw setting ==============

" tree style
let g:netrw_liststyle = 3

if executable("rg")
  set grepprg=rg\ --vimgrep\ --no-heading
  set grepformat=%f:%l:%c:%m,%f:%l:%m
endif

"============ Coc Configs ==============
inoremap <silent><expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ CheckBackspace() ? "\<TAB>" :
      \ coc#refresh()
inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

function! CheckBackspace() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

" Use <c-space> to trigger completion.
inoremap <silent><expr> <c-@> coc#refresh()

" Make <CR> auto-select the first completion item and notify coc.nvim to
" format on enter, <cr> could be remapped by other vim plugin
inoremap <silent><expr> <cr> pumvisible() ? coc#_select_confirm()
                              \: "\<C-g>u\<CR>\<c-r>=coc#on_enter()\<CR>"

" coc-diagnostic
nnoremap <silent> [d <Plug>(coc-diagnostic-prev)
nnoremap <silent> ]d <Plug>(coc-diagnostic-next)
nnoremap <silent> <c-k>  :<c-u>call CocAction('diagnosticInfo')<CR>


" GoTo code navigation.
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gD <Plug>(coc-type-definition)
nmap <silent> gi <Plug>(coc-implementation)
nmap <silent> gr <Plug>(coc-references)
nmap <silent> gK :<c-u>CocList diagnostics<cr>

" coc list
nmap <silent>ggr :<c-u>CocListResume<cr>

" fuzzy search
nnoremap <silent> <leader>ff  :<c-u>CocList files<CR>
nnoremap <silent> <leader>fg  :<c-u>CocList grep<CR>
nnoremap <silent> <leader>fh  :<c-u>CocList helptags<CR>
nnoremap <silent> <leader>fq  :<c-u>CocList quickfix<CR>
nnoremap <silent> <leader>fb  :<c-u>CocList buffers<CR>



" do hover
nnoremap <silent> K :call ShowDocumentation()<CR>

function! ShowDocumentation()
  if CocAction('hasProvider', 'hover')
    call CocActionAsync('doHover')
  else
    call feedkeys('K', 'in')
  endif
endfunction

" Symbol renaming.
nmap <f2> <Plug>(coc-rename)

xmap <leader>cff <Plug>(coc-format-selected)
nmap <leader>cff <Plug>(coc-format)

" Applying codeAction to the selected region.
xmap <leader>ca  <Plug>(coc-codeaction-selected)
" Remap keys for applying codeAction to the current buffer.
nmap <leader>ca  <Plug>(coc-codeaction)
" Apply AutoFix to problem on the current line.
nmap <leader>cq  <Plug>(coc-fix-current)

" Requires 'textDocument.documentSymbol' support from the language server.
xmap if <Plug>(coc-funcobj-i)
omap if <Plug>(coc-funcobj-i)
xmap af <Plug>(coc-funcobj-a)
omap af <Plug>(coc-funcobj-a)
xmap ic <Plug>(coc-classobj-i)
omap ic <Plug>(coc-classobj-i)
xmap ac <Plug>(coc-classobj-a)
omap ac <Plug>(coc-classobj-a)

if has('nvim-0.4.0')
  nnoremap <silent><nowait><expr> <C-f> coc#float#has_scroll() ? coc#float#scroll(1) : "\<C-f>"
  nnoremap <silent><nowait><expr> <C-b> coc#float#has_scroll() ? coc#float#scroll(0) : "\<C-b>"
  inoremap <silent><nowait><expr> <C-f> coc#float#has_scroll() ? "\<c-r>=coc#float#scroll(1)\<cr>" : "\<Right>"
  inoremap <silent><nowait><expr> <C-b> coc#float#has_scroll() ? "\<c-r>=coc#float#scroll(0)\<cr>" : "\<Left>"
  vnoremap <silent><nowait><expr> <C-f> coc#float#has_scroll() ? coc#float#scroll(1) : "\<C-f>"
  vnoremap <silent><nowait><expr> <C-b> coc#float#has_scroll() ? coc#float#scroll(0) : "\<C-b>"
endif

command! -nargs=0 Format :call CocActionAsync('format')

" Add `:Fold` command to fold current buffer.
command! -nargs=? Fold :call     CocAction('fold', <f-args>)

nnoremap <silent> <leader>o :<c-u>CocOutline<CR>

let g:coc_global_extensions = ['coc-json', 'coc-tsserver', 'coc-eslint', 'coc-css', 'coc-prettier', 'coc-lists', 'coc-snippets']
" ======= Git fugive config ===========
nnoremap <leader>gg :<c-u>G<CR>
nnoremap <leader>ga :<c-u>G add
nnoremap <leader>gp :<c-u>G push<CR>
nnoremap <leader>gup :<c-u>G pull --rebase<CR>
nnoremap <leader>gc :<c-u>G commit -v<CR>

nnoremap ]h :GitGutterNextHunk<CR>
nnoremap [h :GitGutterPrevHunk<CR>
nnoremap ghp :GitGutterPreviewHunk<CR>

" === theme ===
set background=dark
set termguicolors
colorscheme nord

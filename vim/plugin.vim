
call plug#begin()
" quick move
Plug 'justinmk/vim-sneak'

" must plugin
Plug 'tpope/vim-surround'
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-commentary'
Plug 'mhinz/vim-signify'

" coc powered up
Plug 'neoclide/coc.nvim', {'branch': 'release'}

" fzf
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'

" theme
Plug 'arcticicestudio/nord-vim'
Plug 'itchyny/lightline.vim'

" rcfile
Plug 'zaid/vim-rec'
 
call plug#end()

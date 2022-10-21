
call plug#begin()
" quick move
Plug 'justinmk/vim-sneak'

" must plugin
Plug 'machakann/vim-sandwich'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-commentary'
Plug 'mhinz/vim-signify'

" fzf
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'

" nerdtree
Plug 'preservim/nerdtree'

" theme
Plug 'arcticicestudio/nord-vim'
Plug 'itchyny/lightline.vim'

" rcfile
Plug 'zaid/vim-rec'

call plug#end()

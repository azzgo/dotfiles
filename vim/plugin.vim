
call plug#begin()
" quick move
Plug 'easymotion/vim-easymotion'

" must plugin
Plug 'tpope/vim-surround'
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-commentary'
Plug 'mhinz/vim-signify'

" fzf
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'

" theme
Plug 'arcticicestudio/nord-vim'
Plug 'itchyny/lightline.vim'

" rcfile
Plug 'zaid/vim-rec'

" vinegar
Plug 'tpope/vim-vinegar'

" coc
Plug 'neoclide/coc.nvim', {'branch': 'release'}

" syntax
Plug 'MaxMEllon/vim-jsx-pretty'

call plug#end()

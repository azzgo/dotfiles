
call plug#begin(g:dot_config_path .. '/.local/plugged')

" must plugin
Plug 'tpope/vim-surround'
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-commentary'
Plug 'mhinz/vim-signify'

" theme
Plug 'itchyny/lightline.vim'

call plug#end()

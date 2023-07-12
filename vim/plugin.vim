
call plug#begin()
" quick move
Plug 'easymotion/vim-easymotion'

" must plugin
Plug 'tpope/vim-surround'
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-commentary'
Plug 'mhinz/vim-signify'

" LeaderF
Plug 'Yggdroot/LeaderF', { 'do': ':LeaderfInstallCExtension' }

" theme
Plug 'arcticicestudio/nord-vim'
Plug 'itchyny/lightline.vim'

" rcfile
Plug 'zaid/vim-rec'

" vinegar
Plug 'tpope/vim-vinegar'

" syntax
Plug 'MaxMEllon/vim-jsx-pretty'

" dadbod for sql connection
Plug 'tpope/vim-dadbod'
Plug 'kristijanhusak/vim-dadbod-ui'

call plug#end()

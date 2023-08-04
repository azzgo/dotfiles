
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
Plug 'Yggdroot/LeaderF-marks'
Plug 'linjiX/LeaderF-git'

" theme
Plug 'arcticicestudio/nord-vim'
Plug 'itchyny/lightline.vim'

" rcfile
Plug 'zaid/vim-rec'

" snippets
Plug 'SirVer/ultisnips'

" dirvish
Plug 'justinmk/vim-dirvish'

" syntax
Plug 'MaxMEllon/vim-jsx-pretty'

call plug#end()

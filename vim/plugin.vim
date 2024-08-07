
call plug#begin(g:dot_config_path .. '/.local/plugged')
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
Plug 'itchyny/lightline.vim'

" dirvish
Plug 'justinmk/vim-dirvish'

call plug#end()

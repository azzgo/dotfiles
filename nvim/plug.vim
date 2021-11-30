" 插件管理
call plug#begin('~/.config/nvim/plugged')

Plug 'tpope/vim-surround'
" Plug 'aklt/plantuml-syntax'
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-fugitive'                         " git cmmand support
Plug 'preservim/nerdtree'                         " Vim Exporer
Plug 'honza/vim-snippets'                         " Snippet
Plug 'ryanoasis/vim-devicons'
Plug 'jiangmiao/auto-pairs'
Plug 'NLKNguyen/papercolor-theme'  " 样式插件
Plug 'mhinz/vim-startify'          " 开屏页
Plug 'tpope/vim-commentary'        " 快速注释
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'
Plug 'easymotion/vim-easymotion'  " 快速移动
" markdown 所需
Plug 'godlygeek/tabular'
Plug 'iamcco/markdown-preview.nvim', { 'do': 'cd app && npm install'  }
Plug 'ferrine/md-img-paste.vim'

" lua plugin start
" deps
Plug 'nvim-lua/plenary.nvim'

" lsp config
Plug 'neovim/nvim-lspconfig'
Plug 'tami5/lspsaga.nvim', { 'branch': 'nvim51' }
Plug 'simrat39/symbols-outline.nvim'

" syntax
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'} 

" fuzzy finder
Plug 'nvim-telescope/telescope.nvim'

" completion
" " main one
Plug 'ms-jpq/coq_nvim', {'branch': 'coq'}
" 9000+ Snippets
Plug 'ms-jpq/coq.artifacts', {'branch': 'artifacts'}

" git
Plug 'lewis6991/gitsigns.nvim'

" lua plugin end

call plug#end()

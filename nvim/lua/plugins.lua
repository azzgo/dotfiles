vim.cmd [[packadd packer.nvim]]

return require('packer').startup(function()
  -- Packer can manage itself
  use 'wbthomason/packer.nvim'
  --  origin vim plugin
  use 'tpope/vim-surround'
  -- use 'aklt/plantuml-syntax'
  use 'tpope/vim-repeat'
  -- git cmmand support
  use 'tpope/vim-fugitive'
  use 'jiangmiao/auto-pairs'
  use 'NLKNguyen/papercolor-theme'
  -- 开屏页
  use 'mhinz/vim-startify'
  -- 快速移动
  use 'easymotion/vim-easymotion'
  -- markdown 所需
  use 'godlygeek/tabular'
  use { 'iamcco/markdown-preview.nvim', run = 'cd app && npm install' }
  use 'ferrine/md-img-paste.vim'
  -- todo
  use 'freitass/todo.txt-vim'
  -- profill
  use 'dstein64/vim-startuptime'

  -- ##########lua plugins start##############
  use 'numToStr/Comment.nvim'
  use {
    'kyazdani42/nvim-tree.lua',
    requires = {
      'kyazdani42/nvim-web-devicons', -- optional, for file icon
    },
    opt = true,
    cmd = { 'NvimTreeToggle', 'NvimTreeFindFileToggle' },
    config = function() require'nvim-tree'.setup {} end,
  }

  -- statusline
  use {
    'nvim-lualine/lualine.nvim',
    requires = {'kyazdani42/nvim-web-devicons', opt = true}
  }

  --  lsp config
  use 'neovim/nvim-lspconfig'
  use 'tami5/lspsaga.nvim'
  use 'simrat39/symbols-outline.nvim'

  -- syntax
  use {'nvim-treesitter/nvim-treesitter', run = ':TSUpdate'} 

  -- fuzzy finder
   use {
    'nvim-telescope/telescope.nvim',
    requires = { {'nvim-lua/plenary.nvim'} }
  }

  -- completion
  use { 'ms-jpq/coq_nvim', branch = 'coq'}
  -- 9000+ Snippets
  use { 'ms-jpq/coq.artifacts', branch = 'artifacts'}

  -- git
  use {
    'lewis6991/gitsigns.nvim', requires = { 'nvim-lua/plenary.nvim' },
    config = function() require('gitsigns').setup() end
  }

  -- ###### lua plugin end ##########
end)

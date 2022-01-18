vim.cmd [[packadd packer.nvim]]

return require('packer').startup(function()
  -- Packer can manage itself
  use 'wbthomason/packer.nvim'
  --  origin vim plugin
  use 'tpope/vim-surround'
  use 'aklt/plantuml-syntax'
  use 'tpope/vim-repeat'
  -- git cmmand support
  use 'tpope/vim-fugitive'


  -- use 'jiangmiao/auto-pairs'

  -- 快速移动
  use 'easymotion/vim-easymotion'
  -- markdown 所需
  use { 'iamcco/markdown-preview.nvim', run = 'cd app && npm install' }
  use 'ferrine/md-img-paste.vim'
  -- todo
  use 'freitass/todo.txt-vim'
  -- profill
  use 'dstein64/vim-startuptime'
  -- theme
  use 'NLKNguyen/papercolor-theme'

  -- ##########lua plugins start##############

  use 'numToStr/Comment.nvim'
  use 'kyazdani42/nvim-web-devicons'
  use {
    'kyazdani42/nvim-tree.lua',
    requires = {
      'kyazdani42/nvim-web-devicons', -- optional, for file icon
    },
    opt = true,
    cmd = { 'NvimTreeToggle', 'NvimTreeFindFileToggle' },
    config = function() require'nvim-tree'.setup {} end,
  }
  -- 开屏页
  use {
    'goolord/alpha-nvim',
    config = function ()
      require'alpha'.setup(require'alpha.themes.startify'.opts)
    end
  }

  -- statusline
  use {
    'nvim-lualine/lualine.nvim',
    requires = { 'kyazdani42/nvim-web-devicons' },
    config = function()
      require'lualine'.setup {
        options = { theme  = 'auto' },
      }
    end
  }

  --  lsp config
  use 'neovim/nvim-lspconfig'
  use 'tami5/lspsaga.nvim'

  -- syntax
  use {'nvim-treesitter/nvim-treesitter', run = ':TSUpdate'} 

  -- fuzzy finder
  use {
    'nvim-telescope/telescope.nvim',
    requires = { 
      {'nvim-lua/plenary.nvim'},
     }
  }

  use {'nvim-telescope/telescope-fzf-native.nvim', run = 'make' }

  --- cmp
  use 'L3MON4D3/LuaSnip'
  use 'hrsh7th/cmp-nvim-lsp'
  use 'hrsh7th/cmp-buffer'
  use 'hrsh7th/cmp-path'
  use 'hrsh7th/cmp-cmdline'
  use 'hrsh7th/nvim-cmp'
  use 'onsails/lspkind-nvim'

  -- git
  use {
    'lewis6991/gitsigns.nvim', requires = { 'nvim-lua/plenary.nvim' },
    config = function() require('gitsigns').setup() end
  }

  -- ###### lua plugin end ##########
end)

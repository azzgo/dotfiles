vim.cmd [[packadd packer.nvim]]

return require('packer').startup(function()
  -- Packer can manage itself
  use 'wbthomason/packer.nvim'
  --  origin vim plugin use 'tpope/vim-surround'
  use 'tpope/vim-surround'
  use 'aklt/plantuml-syntax'
  use 'tpope/vim-repeat'
  -- git cmmand support
  use 'tpope/vim-fugitive'

  -- which key
  use {
  "folke/which-key.nvim",
   config = function()
    require("which-key").setup {
      -- your configuration comes here
      -- or leave it empty to use the default settings
      -- refer to the configuration section below
    }
   end
  }

  -- use 'jiangmiao/auto-pairs'

  -- 快速移动
  use 'easymotion/vim-easymotion'
  -- markdown 所需
  use { 'iamcco/markdown-preview.nvim', run = 'cd app && npm install' }
  use 'ferrine/md-img-paste.vim'
  -- profill
  use 'dstein64/vim-startuptime'
  -- theme
  use 'NLKNguyen/papercolor-theme'
  use 'sainnhe/gruvbox-material'

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
    config = function() require'nvim-tree'.setup { view = { width = 50 } } end,
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
  use { 'liuchengxu/vista.vim', requires = { 'neovim/nvim-lspconfig' } }

  -- syntax
  use {'nvim-treesitter/nvim-treesitter', run = ':TSUpdate'} 

  -- fuzzy finder
  use {
    'nvim-telescope/telescope.nvim',
    requires = { 
      {'nvim-lua/plenary.nvim'},
     }
  }

  use {
    "folke/todo-comments.nvim",
    requires = "nvim-lua/plenary.nvim",
    config = function()
      require("todo-comments").setup {
        keywords = {
          FIX = {
            icon = " ", -- icon used for the sign, and in search results
            color = "error", -- can be a hex color, or a named color (see below)
            alt = { "FIXME", "BUG", "FIXIT", "ISSUE" }, -- a set of other keywords that all map to this FIX keywords
            -- signs = false, -- configure signs for some keywords individually
          },
          TODO = { icon = " ", color = "info" },
          HACK = { icon = " ", color = "warning" },
          WARN = { icon = " ", color = "warning", alt = { "WARNING", "XXX" } },
          PERF = { icon = " ", alt = { "OPTIM", "PERFORMANCE", "OPTIMIZE" } },
          NOTE = { icon = " ", color = "hint", alt = { "INFO" } },
        },
      }
    end
  }

  use {'nvim-telescope/telescope-fzf-native.nvim', run = 'make' }

  --- cmp
  use 'L3MON4D3/LuaSnip'
  use 'rafamadriz/friendly-snippets'
  use 'hrsh7th/cmp-nvim-lsp'
  use 'hrsh7th/cmp-buffer'
  use 'hrsh7th/cmp-path'
  use 'hrsh7th/cmp-cmdline'
  use 'hrsh7th/nvim-cmp'
  use 'saadparwaiz1/cmp_luasnip'
  use 'onsails/lspkind-nvim'

  -- git
  use {
    'lewis6991/gitsigns.nvim', requires = { 'nvim-lua/plenary.nvim' },
    config = function() require('gitsigns').setup() end
  }

  -- ###### lua plugin end ##########
end)

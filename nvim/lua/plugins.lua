vim.cmd([[packadd packer.nvim]])

require("packer").init({
  auto_clean = false,
})

return require("packer").startup(function()
  -- Packer can manage itself
  use("wbthomason/packer.nvim")

  --- quick move
  use { "justinmk/vim-sneak", config = "vim.cmd[[source ~/.config/nvim/sneak.vim]]" }

  -- matchup
  use("andymass/vim-matchup")

  --  origin vim plugin use 'tpope/vim-surround'
  use("machakann/vim-sandwich")
  -- git cmmand support
  use { "tpope/vim-fugitive", config = "vim.cmd[[source ~/.config/nvim/fugitive.vim]]" }
  -- theme
  -- use("NLKNguyen/papercolor-theme")
  -- use("sainnhe/gruvbox-material")
  use({ "shaunsingh/nord.nvim" })

  -- ##########lua plugins start##############

  use { "numToStr/Comment.nvim", config = [[require('users.comment')]] }
  use("kyazdani42/nvim-web-devicons")

  -- neotree
  use({
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v2.x",
    requires = {
      "nvim-lua/plenary.nvim",
      "kyazdani42/nvim-web-devicons", -- not strictly required, but recommended
      "MunifTanjim/nui.nvim",
    },
    config = [[ require('users.neotree') ]]
  })

  -- statusline
  use({
    "nvim-lualine/lualine.nvim",
    requires = { "kyazdani42/nvim-web-devicons" },
    config = [[ require('users.lualine') ]]
  })

  --  lsp config
  use({ "neoclide/coc.nvim", branch = "release", config = "vim.cmd[[source ~/.config/nvim/coc.vim]]" })


  -- syntax
  use({ "nvim-treesitter/nvim-treesitter", config = [[ require('users.treesitter') ]] })
  -- fuzzy
  use({ "nvim-telescope/telescope.nvim", config = [[ require('users.telescope') ]] })
  use({ "nvim-telescope/telescope-fzf-native.nvim", run = "make" })

  -- git
  use({
    "lewis6991/gitsigns.nvim",
    requires = { "nvim-lua/plenary.nvim" },
    config = [[ require('users.gitsigns') ]]
  })

  -- ufo
  use({
    "kevinhwang91/nvim-ufo",
    requires = "kevinhwang91/promise-async",
    config = [[ require('users.ufo') ]]
  })

  --- tabby
  use { "nanozuki/tabby.nvim", config = [[ require('users.tabby') ]] }

  -- ###### lua plugin end ##########
end)

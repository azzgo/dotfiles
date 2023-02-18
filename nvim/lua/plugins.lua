vim.cmd([[packadd packer.nvim]])

require("packer").init({
  auto_clean = false,
})

return require("packer").startup(function()
  -- Packer can manage itself
  use("wbthomason/packer.nvim")

  --- quick move
  use { "justinmk/vim-sneak" }

  -- matchup
  use("andymass/vim-matchup")

  --  origin vim plugin use 'tpope/vim-surround'
  use("tpope/vim-surround")
  -- git cmmand support
  use { "tpope/vim-fugitive", config = function()
    vim.cmd[[
      exe 'source' (g:vim_config_path . '/after/plugin/fugitive.vim')
    ]]
  end}
  -- theme
  -- use("NLKNguyen/papercolor-theme")
  -- use("sainnhe/gruvbox-material")
  use({ "shaunsingh/nord.nvim" })

  -- ##########lua plugins start##############

  use { "numToStr/Comment.nvim", config = [[require('users.comment')]] }
  use("kyazdani42/nvim-web-devicons")

  -- statusline
  use({
    "nvim-lualine/lualine.nvim",
    requires = { "kyazdani42/nvim-web-devicons" },
    config = [[ require('users.lualine') ]]
  })

  -- ranger
  use({ 'francoiscabrol/ranger.vim',
    config = function()
      vim.g.ranger_map_keys = 0
      vim.g.ranger_replace_netrw = 1
      vim.keymap.set("n", "<leader>nn", vim.cmd.RangerWorkingDirectory, { noremap = true, silent = true })
      vim.keymap.set("n", "<leader>nf", vim.cmd.Ranger, { noremap = true, silent = true })
    end,
    requires = { 'azzgo/bclose.vim' }
  })

  --  lsp config
  use({ "neoclide/coc.nvim", branch = "release",
    config = function()
      vim.cmd[[
        let g:coc_config_home=g:dot_config_path . '/coc'
        exe 'source' (g:dot_config_path . '/coc/coc.vim')
      ]]
    end
  })


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

  -- undotree
  use({ "mbbill/undotree", config = function()
    vim.keymap.set('n', '<leader>u', vim.cmd.UndotreeToggle, {})
  end })

  -- todo highlight
  use({ "folke/todo-comments.nvim", config = [[ require('users.todo') ]] })

  -- ###### lua plugin end ##########
end)

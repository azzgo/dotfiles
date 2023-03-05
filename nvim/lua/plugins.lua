local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

return require("lazy").setup({
  --- quick move
  "justinmk/vim-sneak",
  -- matchup
  "andymass/vim-matchup",

  --  origin vim plugin use 'tpope/vim-surround'
  "tpope/vim-surround",
  -- git cmmand support
  { "tpope/vim-fugitive", config = function()
    vim.cmd[[
      exe 'source' (g:vim_config_path . '/after/plugin/fugitive.vim')
    ]]
  end},
  -- theme
  -- use("NLKNguyen/papercolor-theme")
  -- use("sainnhe/gruvbox-material")
  { "shaunsingh/nord.nvim", lazy = true },

  -- ##########lua plugins start##############

  { "numToStr/Comment.nvim", config = function ()
   require('users.comment') 
  end },
  "kyazdani42/nvim-web-devicons",

  -- statusline
  {
    "nvim-lualine/lualine.nvim",
    dependencies = { "kyazdani42/nvim-web-devicons" },
    config = function() require('users.lualine') end
  },

  -- ranger
  { 'francoiscabrol/ranger.vim',
    init = function ()
      vim.g.ranger_map_keys = 0
      vim.g.ranger_replace_netrw = 1
    end,
    config = function()
      vim.keymap.set("n", "<leader>nn", vim.cmd.RangerWorkingDirectory, { noremap = true, silent = true })
      vim.keymap.set("n", "<leader>nf", vim.cmd.Ranger, { noremap = true, silent = true })
    end,
    dependencies = { 'azzgo/bclose.vim' }
  },

  --  lsp config
  { "neoclide/coc.nvim", branch = "release",
    config = function()
      vim.cmd[[
        let g:coc_config_home=g:dot_config_path . '/coc'
        exe 'source' (g:dot_config_path . '/coc/coc.vim')
      ]]
    end
  },


  -- syntax
  { "nvim-treesitter/nvim-treesitter", config = function() require('users.treesitter') end },
  -- fuzzy
  { "nvim-telescope/telescope.nvim", config = function() require('users.telescope') end },
  { "nvim-telescope/telescope-fzf-native.nvim", build = "make" },

  -- git
  {
    "lewis6991/gitsigns.nvim",
    dependencies = { "nvim-lua/plenary.nvim" },
    config = function() require('users.gitsigns') end
  },

  -- ufo
  {
    "kevinhwang91/nvim-ufo",
    dependencies = "kevinhwang91/promise-async",
    config = function() require('users.ufo') end
  },

  --- tabby
  { "nanozuki/tabby.nvim", config = function() require('users.tabby') end },

  -- undotree
  { "mbbill/undotree", config = function()
    vim.keymap.set('n', '<leader>u', vim.cmd.UndotreeToggle, {})
  end },

  -- todo highlight
  { "folke/todo-comments.nvim", ft = { "typescript", "javascript", "typescriptreact", "javascriptreact" }, config = function() require('users.todo') end },

  -- ###### lua plugin end ##########
})

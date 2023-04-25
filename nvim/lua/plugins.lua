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

  -- snippets plugin
  { 'SirVer/ultisnips',
    init = function ()
     vim.cmd[[
      let g:UltiSnipsSnippetDirectories = [g:neovim_config_path  . '/ultisnips']
      let g:UltiSnipsExpandTrigger="<c-s>"
      let g:UltiSnipsJumpForwardTrigger="<c-j>"
      let g:UltiSnipsJumpBackwardTrigger="<c-k>"
     ]]
    end
  },
  --  origin vim plugin use 'tpope/vim-surround'
  "tpope/vim-surround",
  -- git cmmand support
  { "tpope/vim-fugitive", config = function()
    vim.cmd[[
      exe 'source' (g:vim_config_path . '/after/plugin/fugitive.vim')
    ]]
  end},
  -- theme
  { "catppuccin/nvim", name = "catppuccin", lazy=true },
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
  { 'kevinhwang91/rnvimr' ,
    init = function ()
      vim.g.rnvimr_enable_ex = 1
      vim.g.rnvimr_enable_picker = 1
    end,
    config = function()
      vim.keymap.set("n", "<leader>nf", vim.cmd.RnvimrToggle, { noremap = true, silent = true })
    end,
    event = 'VeryLazy'
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
    config = function() require('users.ufo') end,
    event = 'VeryLazy'
  },

  --- tabby
  { "nanozuki/tabby.nvim", config = function() require('users.tabby') end },

  -- undotree
  { "mbbill/undotree", config = function()
    vim.keymap.set('n', '<leader>u', vim.cmd.UndotreeToggle, {})
    end,
    event = 'VeryLazy'
  },

  -- todo highlight
  { "folke/todo-comments.nvim", ft = { "typescript", "javascript", "typescriptreact", "javascriptreact" }, config = function() require('users.todo') end },

  -- ###### lua plugin end ##########
})

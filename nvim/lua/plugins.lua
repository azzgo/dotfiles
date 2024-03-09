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
  {
    "easymotion/vim-easymotion",
    config = function()
      vim.cmd [[
      exe 'source' (g:vim_config_path . '/after/plugin/easymotion.vim')
    ]]
    end
  },
  -- matchup
  "andymass/vim-matchup",

  -- snippets plugin
  {
    'SirVer/ultisnips',
    init = function()
      vim.cmd [[
        exe 'source' (g:vim_config_path . '/after/plugin/ultisnips.vim')
     ]]
    end
  },
  --  origin vim plugin use 'tpope/vim-surround'
  "tpope/vim-surround",
  "tpope/vim-repeat",
  -- git cmmand support
  {
    "tpope/vim-fugitive",
    config = function()
      vim.cmd [[
      exe 'source' (g:vim_config_path . '/after/plugin/fugitive.vim')
    ]]
    end
  },
  -- theme
  { "catppuccin/nvim",      name = "catppuccin", lazy = true },
  { "shaunsingh/nord.nvim", lazy = true },
  { 'rose-pine/neovim',     name = 'rose-pine' },

  -- ##########lua plugins start##############

  {
    "numToStr/Comment.nvim",
    config = function()
      require('users.comment')
    end
  },
  "kyazdani42/nvim-web-devicons",

  -- statusline
  {
    "nvim-lualine/lualine.nvim",
    dependencies = { "kyazdani42/nvim-web-devicons" },
    config = function() require('users.lualine') end
  },

  {
    'stevearc/oil.nvim',
    opts = {},
    config = function()
      require("oil").setup()
      vim.keymap.set('n', '<leader>nn', vim.cmd.Oil, {})
    end
  },
  --  lsp config
  {
    "neoclide/coc.nvim",
    branch = "release",
    init = function()
      vim.cmd [[
        let g:coc_config_home=g:dot_config_path . '/coc'
      ]]
    end,
    config = function()
      vim.cmd [[
        exe 'source' (g:dot_config_path . '/coc/coc.vim')
     ]]
    end
  },
  { 'antoinemadec/coc-fzf' },

  -- tabnine
  -- { 'codota/tabnine-nvim', build = "./dl_binaries.sh", config = function() require('users.tabnine') end },

  -- syntax
  { "leafgarland/typescript-vim" },
  { "pangloss/vim-javascript" },
  -- fuzzy
  {
    "Yggdroot/LeaderF",
    build = function()
      vim.cmd.LeaderfInstallCExtension()
    end,
    dependencies = { 'Yggdroot/LeaderF-marks' },
    config = function()
      vim.cmd [[
        exe 'source' (g:vim_config_path . '/after/plugin/LeaderF.vim')
      ]]
    end
  },
  -- bqf
  { "kevinhwang91/nvim-bqf" },
  {
    'kevinhwang91/nvim-ufo',
    dependencies = { 'kevinhwang91/promise-async' },
    config = function()
      require('users.ufo')
    end
  },
  {
    'junegunn/fzf',
    build = function()
      vim.fn['fzf#install']()
    end,
    init = function()
      vim.cmd [[
        function! _L_FZF_WRAPPER_RUN_(opts) abort
          call fzf#run(fzf#wrap(a:opts))
        endfunction
      ]]
    end
  },
  {
    "ThePrimeagen/harpoon",
    branch = "harpoon2",
    dependencies = { "nvim-lua/plenary.nvim" },
    config = function() require('users.harpoon') end
  },
  -- git
  {
    "lewis6991/gitsigns.nvim",
    dependencies = { "nvim-lua/plenary.nvim" },
    config = function() require('users.gitsigns') end
  },

  --- tabby
  { "nanozuki/tabby.nvim",  config = function() require('users.tabby') end },

  -- undotree
  {
    "mbbill/undotree",
    config = function()
      vim.keymap.set('n', '<leader>u', vim.cmd.UndotreeToggle, {})
    end,
    event = 'VeryLazy'
  },

  -- todo highlight
  {
    "folke/todo-comments.nvim",
    ft = { "typescript", "javascript", "typescriptreact", "javascriptreact" },
    config = function()
      require('users.todo')
    end
  },
  -- color highlight
  { "lilydjwg/colorizer" },

  -- zen mode
  {
    "folke/zen-mode.nvim",
    opts = {
      window = {
        width = 1,
      },
    },
    init = function()
      vim.keymap.set('n', '<A-z>', vim.cmd.ZenMode, {})
    end,
  },
  -- vim-rec
  { 'zaid/vim-rec',         init = function() vim.g.recutils_no_folding = 1 end },
  --- weapp
  { 'chemzqm/wxapp.vim' },
  --- marks enhance
  { 'chentoast/marks.nvim', config = function() require('marks').setup() end },
  -- ###### lua plugin end ##########
})

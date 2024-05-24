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

  {
    "L3MON4D3/LuaSnip",
    -- follow latest release.
    version = "v2.*", -- Replace <CurrentMajor> by the latest released major (first number of latest release)
    -- install jsregexp (optional!).
    build = "make install_jsregexp",
    config = function()
      require('users.luasnip')
    end
  },
  --  origin vim plugin use 'tpope/vim-surround'
  "tpope/vim-surround",
  "tpope/vim-repeat",
  -- git command support
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
  {
    'Exafunction/codeium.vim',
    init = function()
      vim.g.codeium_disable_bindings = 1
    end,
    cond = function()
      return vim.env.TERMUX_VERSION == nil
    end,
    config = function()
      vim.keymap.set('i', '<C-Space>', function() return vim.fn['codeium#Accept']() end, { expr = true, silent = true })
    end
  },

  -- syntax
  -- { "leafgarland/typescript-vim" },
  -- { "pangloss/vim-javascript" },
  {
    'nvim-treesitter/nvim-treesitter',
    config = function()
      require 'nvim-treesitter.configs'.setup {
        highlight = { enable = true },
        incremental_selection = { enable = false },
        ensure_installed = { 'javascript', 'typescript' },
        indent = { enable = false },
      }
    end
  },
  -- fuzzy
  {
    "Yggdroot/LeaderF",
    build = function()
      vim.cmd.LeaderfInstallCExtension()
    end,
    cond = function()
      return vim.fn.has('python3') == 1;
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
  { "nanozuki/tabby.nvim", config = function() require('users.tabby') end },

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
  { 'zaid/vim-rec',     init = function() vim.g.recutils_no_folding = 1 end },
  --- weapp
  { 'chemzqm/wxapp.vim' },
  --- marks enhance
  {
    'chentoast/marks.nvim',
    event = 'VeryLazy',
    config = function()
      require('marks')
          .setup()
    end
  },
  -- tasks
  {
    'skywind3000/asynctasks.vim',
    dependencies = { 'skywind3000/asyncrun.vim' },
    event = 'VeryLazy',
    init = function()
      vim.g.asyncrun_open = 6
      vim.g.asyncrun_rootmarks = { '.git', '.svn', '.root', '.project', 'package.json' }
    end,
    config = function()
      vim.cmd [[
      exe 'source' (g:vim_config_path . '/after/plugin/fzf-tasks.vim')
      exe 'source' (g:vim_config_path . '/after/plugin/fugitive-run.vim')
      ]]
    end
  },
  -- intent
  {
    'shellRaining/hlchunk.nvim',
    event = { "UIEnter" },
    config = function()
      require("hlchunk").setup(
        {
          chunk = {
            enable = true,
            use_treesitter = true,
          },

          indent = {
            enable = true,
            use_treesitter = false,
          },
          line_num = {
            enable = true,
            use_treesitter = false,
          },
          blank = {
            enable = true,
          },
        }
      )
    end
  },
  -- ###### lua plugin end ##########
})

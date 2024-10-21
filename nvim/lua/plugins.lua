local lazypath = vim.g.dot_config_path .. "/.local/lazy/lazy.nvim"
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
  root = vim.g.dot_config_path .. "/.local/lazy",
  spec = {
    {
      "folke/flash.nvim",
      event = "VeryLazy",
      opts = {
        modes = {
          char = {
            enabled = false
          }
        }
      },
      -- stylua: ignore
      keys = {
        { "s", mode = { "n", "x" }, function() require("flash").jump() end,       desc = "Flash" },
        { "S", mode = { "n" },      function() require("flash").treesitter() end, desc = "Flash Treesitter" },
      },
    },
    -- matchup
    {
      "andymass/vim-matchup",
      init = function()
        vim.g.matchup_matchparen_deferred = 1;
      end
    },

    {
      "L3MON4D3/LuaSnip",
      version = "v2.*", -- Replace <CurrentMajor> by the latest released major (first number of latest release)
      build = "make install_jsregexp",
      config = function()
        require('users.luasnip')
      end
    },
    --  origin vim plugin use 'tpope/vim-surround'
    "tpope/vim-surround",
    "tpope/vim-repeat",
    {
      'beloglazov/vim-textobj-quotes',
      dependencies = { "kana/vim-textobj-user" },
      config = function()
        vim.keymap.set('n', '<A-y>', 'yiq', { remap = true })
      end
    },
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
    { "catppuccin/nvim",     name = "catppuccin", lazy = true },
    -- { "shaunsingh/nord.nvim", lazy = true },
    -- { 'rose-pine/neovim',     name = 'rose-pine' },

    -- ##########lua plugins start##############
    -- ai plugins
    {
      'github/copilot.vim',
      init = function()
        vim.keymap.set('i', '<C-space>', 'copilot#Accept("\\<CR>")', {
          expr = true,
          replace_keycodes = false
        })
        vim.g.copilot_no_tab_map = true
      end
    },

    {
      "numToStr/Comment.nvim",
      config = function()
        require('users.comment')
      end
    },
    {
      "nvim-tree/nvim-web-devicons",
      config = function()
        require 'nvim-web-devicons'.setup {
          override_by_extension = {
            ['toml'] = {
              icon = "",
              color = "#81e043",
              name = "Toml"
            },
            ['vue'] = {
              icon = "﵂",
              color = "#42B883",
              name = "Vue"
            }
          }
        }
      end
    },

    -- statusline
    {
      "nvim-lualine/lualine.nvim",
      config = function() require('users.lualine') end
    },

    {
      'stevearc/oil.nvim',
      opts = {},
      config = function()
        local oil = require("oil")
        oil.setup({
          float = {
            padding = 10
          }
        })
        vim.keymap.set('n', '<leader>nn', function()
          oil.open()
        end, {})
      end
    },
    --  lsp config
    {
      "neoclide/coc.nvim",
      branch = "release",
      event = "VeryLazy",
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

    -- syntax
    -- { "leafgarland/typescript-vim" },
    -- { "pangloss/vim-javascript" },
    { 'mracos/mermaid.vim' },
    {
      'nvim-treesitter/nvim-treesitter',
      config = function()
        require 'nvim-treesitter.configs'.setup {
          highlight = { enable = true, },
          incremental_selection = { enable = false },
          ensure_installed = { 'c', 'lua', 'javascript', 'typescript', 'vue', 'vim', 'vimdoc', 'query' },
          indent = { enable = false },
        }
      end
    },
    -- fuzzy
    {
      "Yggdroot/LeaderF",
      -- conflic in cond, need do it manually now
      -- build = function()
      --   vim.cmd.LeaderfInstallCExtension()
      -- end,
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
      ft = { "typescript", "javascript", "typescriptreact", "javascriptreact", 'lua' },
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
    { 'zaid/vim-rec',      init = function() vim.g.recutils_no_folding = 1 end },
    --- weapp
    -- { 'chemzqm/wxapp.vim' },
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
              enable = false,
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
              enable = false,
            },
          }
        )
      end
    },
    {
      'voldikss/vim-floaterm',
      config = function()
        vim.keymap.set('n', '<A-t>', function()
          vim.cmd [[ FloatermNew --cwd=<buffer> ]]
        end, {})
      end
    },
    {
      "robitx/gp.nvim",
      config = function()
        require("gp").setup({
          providers = {
            copilot = {
              endpoint = "https://api.githubcopilot.com/chat/completions",
              secret = {
                "bash",
                "-c",
                "cat ~/.config/github-copilot/hosts.json | sed -e 's/.*oauth_token...//;s/\".*//'",
              },
            },
          },
          default_command_agent = "copilot",
          default_chat_agent = "copilot",
        })
      end,
    },
    {
      "oysandvik94/curl.nvim",
      cmd = { "CurlOpen" },
      dependencies = {
        "nvim-lua/plenary.nvim",
      },
      config = true,
    },
    {
      "folke/persistence.nvim",
      opts = {
      },
      config = function()
        require('users.sessions')
      end
    },
    -- ###### lua plugin end ##########
  },
})

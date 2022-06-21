vim.cmd([[packadd packer.nvim]])

require("packer").init({
  auto_clean = false
})

return require("packer").startup(function()
	-- Packer can manage itself
	use("wbthomason/packer.nvim")

	-- Improve startup time for Neovim
	use({
		"lewis6991/impatient.nvim",
		config = function()
			--  require('impatient');
		end,
	})

	--- quick move
	use("justinmk/vim-sneak")

	--  origin vim plugin use 'tpope/vim-surround'
	use("tpope/vim-surround")
	use("aklt/plantuml-syntax")
	use("tpope/vim-repeat")
	-- git cmmand support
	use({
		"tpope/vim-fugitive",
		config = function()
			vim.api.nvim_set_keymap("n", "<leader>gg", ":<c-u>G<CR>", { noremap = true, silent = true })
			vim.api.nvim_set_keymap("n", "<leader>ga", ":<c-u>G add ", { noremap = true })
			vim.api.nvim_set_keymap("n", "<leader>gp", ":<c-u>G push<CR>", { noremap = true, silent = true })
			vim.api.nvim_set_keymap("n", "<leader>gup", ":<c-u>G pull --rebase<CR>", { noremap = true, silent = true })
			vim.api.nvim_set_keymap("n", "<leader>gc", ":<c-u>G commit -v<CR>", { noremap = true, silent = true })
		end,
	})

	-- which key
	use({
		"folke/which-key.nvim",
		config = function()
			-- require("which-key").setup({
			-- 	-- your configuration comes here
			-- 	-- or leave it empty to use the default settings
			-- 	-- refer to the configuration section below
			-- })
		end,
	})

	-- profill
	use("dstein64/vim-startuptime")
	-- theme
	use("NLKNguyen/papercolor-theme")
	use("sainnhe/gruvbox-material")

	-- ##########lua plugins start##############

	use("numToStr/Comment.nvim")
	use("kyazdani42/nvim-web-devicons")

	-- neotree
	vim.cmd([[ let g:neo_tree_remove_legacy_commands = 1 ]])
	use({
		"nvim-neo-tree/neo-tree.nvim",
		branch = "v2.x",
		requires = {
			"nvim-lua/plenary.nvim",
			"kyazdani42/nvim-web-devicons", -- not strictly required, but recommended
			"MunifTanjim/nui.nvim",
		},
		config = function()
			require("neo-tree").setup({
				window = {
					mappings = {
						["<space>"] = {
							"toggle_node",
							nowait = true, -- disable `nowait` if you have existing combos starting with this char that you want to use
						},
					},
				},
			})
			-- toggle 文件浏览器
			vim.api.nvim_set_keymap("n", "<leader>nn", ":Neotree toggle<CR>", { noremap = true, silent = true })
			vim.api.nvim_set_keymap("n", "<leader>nb", ":Neotree buffers<CR>", { noremap = true, silent = true })
			vim.api.nvim_set_keymap(
				"n",
				"<leader>nf",
				":Neotree reveal_force_cwd<CR>",
				{ noremap = true, silent = true }
			)
		end,
	})

	-- bufferline
	use({
		"akinsho/bufferline.nvim",
		tag = "v2.*",
		requires = "kyazdani42/nvim-web-devicons",
		config = function()
			require("bufferline").setup({
        options = {
          mode = "tabs"
        }
      })
		end,
	})

	-- 开屏页
	use({
		"goolord/alpha-nvim",
		config = function()
			require("alpha").setup(require("alpha.themes.startify").opts)
		end,
	})

	-- statusline
	use({
		"nvim-lualine/lualine.nvim",
		requires = { "kyazdani42/nvim-web-devicons" },
		config = function()
			require("lualine").setup({
				options = { theme = "auto" },
			})
		end,
	})

	--  lsp config
  vim.g.coc_global_extensions = { 'coc-json', 'coc-tsserver', 'coc-eslint', 'coc-css', 'coc-prettier', 'coc-lists', 'coc-snippets', 'coc-xml' }
  use({ "neoclide/coc.nvim", branch = "release" })

	-- syntax
	use({ "nvim-treesitter/nvim-treesitter", run = ":TSUpdate" })

	use({
		"folke/todo-comments.nvim",
		requires = "nvim-lua/plenary.nvim",
		config = function()
			require("todo-comments").setup({
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
			})
		end,
	})

	-- git
	use({
		"lewis6991/gitsigns.nvim",
		requires = { "nvim-lua/plenary.nvim" },
		config = function()
			require("gitsigns").setup()
		end,
	})

	-- ###### lua plugin end ##########
end)

vim.cmd([[packadd packer.nvim]])

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
	use("tpope/vim-fugitive")

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

	-- markdown 所需
	use({ "iamcco/markdown-preview.nvim", run = "cd app && npm install" })
	use("ferrine/md-img-paste.vim")
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
			require("bufferline").setup({})
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
	use("neovim/nvim-lspconfig")
	use("tami5/lspsaga.nvim")
	use({ "liuchengxu/vista.vim", requires = { "neovim/nvim-lspconfig" } })
	use({
		"jose-elias-alvarez/null-ls.nvim",
		config = function()
			local null_ls = require("null-ls")
			null_ls.setup({
				on_attach = function(client, bufnr)
					local opts = { noremap = true, silent = true }
					vim.api.nvim_buf_set_keymap(bufnr, "n", "<leader>cf", "<cmd>lua vim.lsp.buf.formatting()<CR>", opts)
				end,
				sources = {
					null_ls.builtins.diagnostics.eslint,
					null_ls.builtins.formatting.stylua,
					null_ls.builtins.formatting.prettier,
				},
			})
		end,
		requires = { "nvim-lua/plenary.nvim", "neovim/nvim-lsp" },
	})

	-- syntax
	use({ "nvim-treesitter/nvim-treesitter", run = ":TSUpdate" })
	use({
		"nvim-treesitter/nvim-treesitter-textobjects",
		config = function()
			require("nvim-treesitter.configs").setup({
				textobjects = {
					select = {
						enable = true,

						-- Automatically jump forward to textobj, similar to targets.vim
						lookahead = true,

						keymaps = {
							-- You can use the capture groups defined in textobjects.scm
							["af"] = "@function.outer",
							["if"] = "@function.inner",
							["ac"] = "@class.outer",
							["ic"] = "@class.inner",
						},
					},
				},
			})
		end,
	})

	-- fuzzy finder
	use({
		"nvim-telescope/telescope.nvim",
		requires = {
			{ "nvim-lua/plenary.nvim" },
		},
	})

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

	use({ "nvim-telescope/telescope-fzf-native.nvim", run = "make" })

	--- cmp
	use("L3MON4D3/LuaSnip")
	use("rafamadriz/friendly-snippets")
	use("hrsh7th/cmp-nvim-lsp")
	use("hrsh7th/cmp-buffer")
	use("hrsh7th/cmp-path")
	use("hrsh7th/cmp-cmdline")
	use("hrsh7th/nvim-cmp")
	use("saadparwaiz1/cmp_luasnip")
	use("onsails/lspkind-nvim")

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

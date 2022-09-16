vim.cmd([[packadd packer.nvim]])

require("packer").init({
	auto_clean = false,
})

return require("packer").startup(function()
	-- Packer can manage itself
	use("wbthomason/packer.nvim")

	--- quick move
	use("justinmk/vim-sneak")

	-- matchup
	use("andymass/vim-matchup")

	--  origin vim plugin use 'tpope/vim-surround'
	use("tpope/vim-surround")
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
			vim.api.nvim_set_keymap("n", "<leader>gb", ":<c-u>G blame<CR>", { noremap = true, silent = true })
		end,
	})

	-- theme
	-- use("NLKNguyen/papercolor-theme")
	-- use("sainnhe/gruvbox-material")
	use({ "shaunsingh/nord.nvim" })

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

	-- statusline
	use({
		"nvim-lualine/lualine.nvim",
		requires = { "kyazdani42/nvim-web-devicons" },
		config = function()
			require("lualine").setup({
				options = { theme = "auto" },
				sections = {
					lualine_b = {},
				},
			})
		end,
	})
	-- session
	use({
		"rmagatti/auto-session",
		config = function()
			require("auto-session").setup({
				log_level = "error",
				auto_session_suppress_dirs = { "~/", "~/projects", "~/Downloads", "/" },
				pre_save_cmds = {
					function()
						require("neo-tree.sources.manager").close_all()
						vim.notify("closed all")
					end,
				},
			})
		end,
	})

	--  lsp config
	use({ "neoclide/coc.nvim", branch = "release" })
	use({
		"jose-elias-alvarez/null-ls.nvim",
		config = function()
			local null_ls = require("null-ls")
			null_ls.setup({
				---@diagnostic disable-next-line: unused-local
				on_attach = function(client, bufnr)
					local opts = { noremap = true, silent = true }
					vim.api.nvim_buf_set_keymap(bufnr, "n", "<leader>cf", "<cmd>lua vim.lsp.buf.formatting()<CR>", opts)
				end,
				sources = {
					null_ls.builtins.formatting.stylua,
					null_ls.builtins.formatting.prettier,
				},
			})
			-- noise when lots of diagnose reports.
			vim.diagnostic.config({
				virtual_text = false,
			})
		end,
		requires = { "nvim-lua/plenary.nvim", "neovim/nvim-lsp" },
	})

	-- wilder
	use({
		"gelguy/wilder.nvim",
		config = function()
			local wilder = require("wilder")
			wilder.setup({
				modes = { ":", "/", "?" },
				previous_key = "<m-p>",
				next_key = "<m-n>",
			})
			wilder.set_option(
				"renderer",
				wilder.popupmenu_renderer({
					-- highlighter applies highlighting to the candidates
					highlighter = wilder.basic_highlighter(),
				})
			)
		end,
	})

	-- syntax
	use({ "nvim-treesitter/nvim-treesitter", run = ":TSUpdate" })

	use({
		"ibhagwan/fzf-lua",
		requires = { "kyazdani42/nvim-web-devicons" },
		config = function()
			require("fzf-lua").setup({
				fzf_opts = {
					["--ansi"] = "",
					["--info"] = "inline",
					["--height"] = "100%",
					["--layout"] = "reverse",
					["--border"] = "none",
					["--cycle"] = "",
				},
			})
		end,
	})

	-- git
	use({
		"lewis6991/gitsigns.nvim",
		requires = { "nvim-lua/plenary.nvim" },
		config = function()
			require("gitsigns").setup({
				current_line_blame = true,
			})
		end,
	})

	-- ufo
	use({
		"kevinhwang91/nvim-ufo",
		requires = "kevinhwang91/promise-async",
	})

	-- ###### lua plugin end ##########
end)

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
	use("tpope/vim-fugitive")

	-- theme
	-- use("NLKNguyen/papercolor-theme")
	-- use("sainnhe/gruvbox-material")
	use({ "shaunsingh/nord.nvim" })

	-- ##########lua plugins start##############

	use("numToStr/Comment.nvim")
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
	})

	-- statusline
	use({
		"nvim-lualine/lualine.nvim",
		requires = { "kyazdani42/nvim-web-devicons" },
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

	use({ "nvim-telescope/telescope.nvim" })
	use({ "nvim-telescope/telescope-fzf-native.nvim", run = "make" })

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

	--- tabby
	use({
		"nanozuki/tabby.nvim",
		config = function()
			local theme = {
				fill = "TabLineFill",
				-- Also you can do this: fill = { fg='#f2e9de', bg='#907aa9', style='italic' }
				head = "TabLine",
				current_tab = "TabLineSel",
				tab = "TabLine",
				win = "TabLine",
				tail = "TabLine",
			}
			require("tabby.tabline").set(function(line)
				return {
					line.tabs().foreach(function(tab)
						local hl = tab.is_current() and theme.current_tab or theme.tab
						return {
							line.sep("█", hl, theme.fill),
							tab.is_current() and "" or "",
							tab.number(),
							tab.name(),
							line.sep("█", hl, theme.fill),
							hl = hl,
							margin = " ",
						}
					end),
					line.spacer(),
					hl = theme.fill,
				}
			end)
		end,
	})

	-- ###### lua plugin end ##########
end)

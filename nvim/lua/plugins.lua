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
	use("jose-elias-alvarez/null-ls.nvim")

	-- cmp only for cmdline
	use("hrsh7th/nvim-cmp")
	use("hrsh7th/cmp-cmdline")
	use("hrsh7th/cmp-buffer")
	use("hrsh7th/cmp-path")

	-- syntax
	use({ "nvim-treesitter/nvim-treesitter", run = ":TSUpdate" })

	use({ "nvim-telescope/telescope.nvim" })
	use({ "nvim-telescope/telescope-fzf-native.nvim", run = "make" })

	-- git
	use({
		"lewis6991/gitsigns.nvim",
		requires = { "nvim-lua/plenary.nvim" },
	})

	-- ufo
	use({
		"kevinhwang91/nvim-ufo",
		requires = "kevinhwang91/promise-async",
	})

	--- tabby
	use("nanozuki/tabby.nvim")

	-- ###### lua plugin end ##########
end)

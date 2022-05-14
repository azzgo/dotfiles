if vim.g.loaded_nvim_treesitter == nil then
	print("Not loaded treesitter")
	return
end

require("nvim-treesitter.configs").setup({
	ensure_installed = {
		"tsx",
		"json",
		"yaml",
		"html",
		"scss",
		"vue",
		"go",
		"fish",
		"lua",
	},
	highlight = {
		enable = true,
		additional_vim_regex_highlighting = false,
	},
	intent = {
		enable = false,
	},
})

local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.tsx.filetype_to_parsername = { "javascript", "typescript.tsx" }

-- set options
vim.api.nvim_set_option("foldexpr", "manual")

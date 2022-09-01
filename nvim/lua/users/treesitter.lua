local ok, treesitter_config = pcall(require, "nvim-treesitter.configs")

if not ok then
  return
end

treesitter_config.setup({
	ensure_installed = {
		"tsx",
		"typescript",
		"json",
		"yaml",
		"html",
		"scss",
		"vue",
		"go",
		"fish",
		"lua",
	},
  matchup = {
    enable = true
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

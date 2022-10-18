local ok, treesitter_config = pcall(require, "nvim-treesitter.configs")

if not ok then
  return
end

treesitter_config.setup({
	ensure_installed = {
		"tsx",
		"typescript",
		"json",
		"html",
		"scss",
		"vue",
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

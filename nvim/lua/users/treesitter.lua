local ok, treesitter_config = pcall(require, "nvim-treesitter.configs")

if not ok then
  return
end

treesitter_config.setup({
	ensure_installed = {
		"tsx",
		"typescript",
		"scss",
	},
  ignore_install = { "javascript", "c", "vim" },
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

local ft_to_parser = require"nvim-treesitter.parsers".filetype_to_parsername
ft_to_parser.javascript = "typescript"

local ok, treesitter_config = pcall(require, "nvim-treesitter.configs")

if not ok then
  return
end

treesitter_config.setup({
	ensure_installed = {
		"tsx",
    "javascript",
		"typescript",
		"scss",
	},
  matchup = {
    enable = true
  },
  incremental_selection = {
    enable = true,
    keymaps = {
      init_selection = "gnn", -- set to `false` to disable one of the mappings
      node_incremental = "<CR>",
      node_decremental = "<BS>",
    },
  },
	highlight = {
		enable = false,
    disable = { "vim", "lua", "c" },
		additional_vim_regex_highlighting = false,
	},
	intent = {
		enable = false,
	},
})

vim.treesitter.language.register('javascript', 'typescript')
vim.treesitter.language.register('tsx', 'typescriptreact')

-- nvim_set_keymap
vim.api.nvim_set_keymap(
	"n",
	"<leader>f",
	"<cmd>lua require('fzf-lua').files()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>/",
	"<cmd>lua require('fzf-lua').grep()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>b",
	"<cmd>lua require('fzf-lua').buffers()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>h",
	"<cmd>lua require('fzf-lua').help_tags()<cr>",
	{ noremap = true, silent = true }
)

-- resume
vim.api.nvim_set_keymap(
	"n",
	"ggr",
	"<cmd>lua require('fzf-lua').resume()<cr>",
	{ noremap = true, silent = true }
)

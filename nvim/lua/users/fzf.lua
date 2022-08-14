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
	"<leader>c",
	"<cmd>lua require('fzf-lua').files { cwd=vim.fn.expand('%:p:h') }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>zq",
	"<cmd>lua require('fzf-lua').quickfix()<cr>",
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

vim.api.nvim_set_keymap(
	"n",
	"gr",
	"<cmd>lua require('fzf-lua').lsp_references()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gd",
	"<cmd>lua require('fzf-lua').lsp_definitions({ jump_to_single_result = true })<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gi",
	"<cmd>lua require('fzf-lua').lsp_implementations({ jump_to_single_result = true })<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gD",
	"<cmd>lua require('fzf-lua').lsp_typedefs()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gK",
	"<cmd>lua require('fzf-lua').lsp_document_diagnostics()<cr>",
	{ noremap = true, silent = true }
)

-- resume
vim.api.nvim_set_keymap(
	"n",
	"ggr",
	"<cmd>lua require('fzf-lua').resume()<cr>",
	{ noremap = true, silent = true }
)

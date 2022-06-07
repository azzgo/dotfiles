require'fzf-lua'.setup({})

-- nvim_set_keymap
vim.api.nvim_set_keymap(
	"n",
	"<leader>ff",
	"<cmd>lua require('fzf-lua').files()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fg",
	"<cmd>lua require('fzf-lua').grep()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fc",
	"<cmd>lua require('fzf-lua').files { cwd=vim.fn.expand('%:p:h') }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fq",
	"<cmd>lua require('fzf-lua').quickfix()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fb",
	"<cmd>lua require('fzf-lua').buffers()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fh",
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
	"<cmd>lua require('fzf-lua').lsp_definitions()<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gi",
	"<cmd>lua require('fzf-lua').lsp_implementations()<cr>",
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

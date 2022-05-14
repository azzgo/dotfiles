local gitsigns = require("gitsigns")

gitsigns.setup({
	current_line_blame = true,
})

vim.api.nvim_set_keymap("n", "]h", ":Gitsigns next_hunk<CR>", { noremap = true, silent = true })
vim.api.nvim_set_keymap("n", "[h", ":Gitsigns prev_hunk<CR>", { noremap = true, silent = true })
vim.api.nvim_set_keymap("n", "<leader>ghp", ":Gitsigns preview_hunk<CR>", { noremap = true, silent = true })

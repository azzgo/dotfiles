if vim.g.loaded_fugitive ~= 1 then
	return
end

vim.keymap.set("n", "<leader>gg", ":<c-u>G<CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>ga", ":<c-u>G add ", { noremap = true })
vim.keymap.set("n", "<leader>gp", ":<c-u>G push<CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>gup", ":<c-u>G pull --rebase<CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>gc", ":<c-u>G commit -v<CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>gb", ":<c-u>G blame<CR>", { noremap = true, silent = true })

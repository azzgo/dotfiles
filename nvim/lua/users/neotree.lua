local ok, neotree = pcall(require, "neo-tree")

if not ok then
	return
end

vim.cmd([[ let g:neo_tree_remove_legacy_commands = 1 ]])
neotree.setup({
	window = {
		mappings = {
			["<space>"] = {
				"toggle_node",
				nowait = true, -- disable `nowait` if you have existing combos starting with this char that you want to use
			},
		},
	},
})
-- toggle 文件浏览器
vim.keymap.set("n", "<leader>nn", ":Neotree toggle<CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>nb", ":Neotree buffers<CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>nf", ":Neotree reveal_force_cwd<CR>", { noremap = true, silent = true })

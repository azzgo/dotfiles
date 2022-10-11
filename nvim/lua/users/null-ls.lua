local ok, null_ls = pcall(require, "null-ls")
if not ok then
	return
end

null_ls.setup({
	---@diagnostic disable-next-line: unused-local
	on_attach = function(client, bufnr)
		local opts = { noremap = true, silent = true }
		vim.api.nvim_buf_set_keymap(bufnr, "n", "<leader>cf", "<cmd>lua vim.lsp.buf.format()<CR>", opts)
	end,
	sources = {
		null_ls.builtins.formatting.stylua,
		null_ls.builtins.formatting.prettier,
	},
})
-- noise when lots of diagnose reports.
vim.diagnostic.config({
	virtual_text = false,
})

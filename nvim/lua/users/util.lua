local mod = {}

local aerial = require("aerial")

function mod.lsp_on_attach(client, bufnr)
	-- init aerial with lsp
	aerial.on_attach(client, bufnr)
	local function buf_set_keymap(...)
		vim.api.nvim_buf_set_keymap(bufnr, ...)
	end
	local function buf_set_option(...)
		vim.api.nvim_buf_set_option(bufnr, ...)
	end

	-- Enable completion triggered by <c-x><c-o>
	buf_set_option("omnifunc", "v:lua.vim.lsp.omnifunc")
	-- Mappings start
	local opts = { noremap = true, silent = true }

	buf_set_keymap("n", "<leader>cf", "<cmd>lua vim.lsp.buf.formatting()<CR>", opts)
	buf_set_keymap("i", "<c-k>", "<cmd>lua vim.lsp.buf.signature_help()<CR>", { noremap = true, silent = true })

	-- set saga keymap use buf_set_keymap in case in non lsp config file trigger error
	if vim.g.loaded_lspsaga then
		buf_set_keymap("n", "]d", ":Lspsaga diagnostic_jump_next<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "[d", ":Lspsaga diagnostic_jump_prev<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "<c-k>", ":Lspsaga show_line_diagnostics<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "K", ":Lspsaga hover_doc<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "<F2>", "<cmd>Lspsaga rename<CR>", opts)
		buf_set_keymap("n", "ca", ":Lspsaga code_action<CR>", { noremap = true, silent = true })
		buf_set_keymap("x", "ca", ":<c-u>Lspsaga range_code_action<CR>", { noremap = true, silent = true })
	end
	-- Mappings end

	if client.name == "tsserver" then
		client.resolved_capabilities.document_formatting = false
	end
end

return mod

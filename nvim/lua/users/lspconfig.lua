local nvim_lsp_ok, nvim_lsp = pcall(require, "lspconfig")

if not nvim_lsp_ok then
	return
end

local userCmp = require("users.cmp")

local ts_utils = require("nvim-lsp-ts-utils")
local nvimLspInstaller = require("nvim-lsp-installer")
local aerial = require("aerial")

-- load lsp-install before lsp config
nvimLspInstaller.setup({
	automatic_installation = false,
})

userCmp.setup()


-- Use an on_attach function to only map the following keys
-- after the language server attaches to the current buffer
local on_attach = function(client, bufnr)
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

local servers = { "volar", "pyright", "gopls", "rls", "cssls", "tailwindcss", "sumneko_lua", "jsonls" }
for _, lsp in ipairs(servers) do
	nvim_lsp[lsp].setup({
		on_attach = on_attach,
		capabilities = userCmp.capabilities,
		flags = { debounce_text_changes = 150 },
	})
end

-- tsserver

nvim_lsp.tsserver.setup({
	on_attach = function(client, bufnr)
		ts_utils.setup({})
		on_attach(client, bufnr)

		ts_utils.setup_client(client)
	end,
	capabilities = userCmp.capabilities,
	flags = { debounce_text_changes = 150 },
	handlers = {
		["textDocument/publishDiagnostics"] = vim.lsp.with(vim.lsp.diagnostic.on_publish_diagnostics, {
			-- Disable virtual_text
			virtual_text = false,
		}),
	},
})

-- noise when lots of diagnose reports.
vim.diagnostic.config({
	virtual_text = false,
})

--- setup aerial
aerial.setup({
	on_attach = function(bufnr)
		local function buf_set_keymap(...)
			vim.api.nvim_buf_set_keymap(bufnr, ...)
		end
		local opts = { noremap = true, silent = true }
		-- aerial
		buf_set_keymap("n", "<leader>o", "<cmd>AerialToggle!<CR>", opts)
		buf_set_keymap("n", "[o", "<cmd>AerialPrev<CR>", opts)
		buf_set_keymap("n", "]o", "<cmd>AerialNext<CR>", opts)
	end,
})

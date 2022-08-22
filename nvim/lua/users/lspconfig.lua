local nvim_lsp_ok, nvim_lsp = pcall(require, "lspconfig")

if not nvim_lsp_ok then
	return
end

local user_cmp = require("users.cmp")
local user_util = require("users.util")

local ts_utils = require("nvim-lsp-ts-utils")
local nvimLspInstaller = require("nvim-lsp-installer")
local aerial = require("aerial")

-- load lsp-install before lsp config
nvimLspInstaller.setup({
	automatic_installation = false,
})

user_cmp.setup()



local servers = { "vuels", "pyright", "gopls", "rls", "cssls", "tailwindcss", "sumneko_lua", "jsonls" }
for _, lsp in ipairs(servers) do
	nvim_lsp[lsp].setup({
		on_attach = user_util.lsp_on_attach,
		capabilities = user_cmp.capabilities,
		flags = { debounce_text_changes = 150 },
	})
end

-- tsserver

nvim_lsp.tsserver.setup({
	on_attach = function(client, bufnr)
		ts_utils.setup({})
		user_util.lsp_on_attach(client, bufnr)

		ts_utils.setup_client(client)
	end,
	capabilities = user_cmp.capabilities,
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

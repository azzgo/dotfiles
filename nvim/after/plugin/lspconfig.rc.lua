-- vim.lsp.set_log_level("debug")
if vim.g.lspconfig == nil then
	return
end

if vim.g.loaded_cmp == nil then
	return
end

-- load lsp-install before lsp config
require("nvim-lsp-installer").setup({
  automatic_installation = true,
})

local nvim_lsp = require("lspconfig")
local cmp = require("cmp")
local lspkind = require("lspkind")
local luasnip = require("luasnip")
local ts_utils = require("nvim-lsp-ts-utils")

-- load vscode style snippets
require("luasnip.loaders.from_vscode").lazy_load()

local has_words_before = function()
	local line, col = unpack(vim.api.nvim_win_get_cursor(0))
	return col ~= 0 and vim.api.nvim_buf_get_lines(0, line - 1, line, true)[1]:sub(col, col):match("%s") == nil
end

cmp.setup({
	snippet = {
		-- REQUIRED - you must specify a snippet engine
		expand = function(args)
			luasnip.lsp_expand(args.body) -- For `luasnip` users.
		end,
	},
	mapping = {
		["<C-b>"] = cmp.mapping(cmp.mapping.scroll_docs(-4), { "i", "c" }),
		["<C-f>"] = cmp.mapping(cmp.mapping.scroll_docs(4), { "i", "c" }),
		["<C-Space>"] = cmp.mapping(cmp.mapping.complete(), { "i", "c" }),
		["<C-y>"] = cmp.config.disable, -- Specify `cmp.config.disable` if you want to remove the default `<C-y>` mapping.
		["<C-e>"] = cmp.mapping({
			i = cmp.mapping.abort(),
			c = cmp.mapping.close(),
		}),
		["<CR>"] = cmp.mapping.confirm({ select = true }), -- Accept currently selected item. Set `select` to `false` to only confirm explicitly selected items.
		["<C-n>"] = cmp.mapping(function(fallback)
			if cmp.visible() then
				cmp.select_next_item()
			elseif luasnip.expand_or_jumpable() then
				luasnip.expand_or_jump()
			elseif has_words_before() then
				cmp.complete()
			else
				fallback()
			end
		end, { "i", "s", "c" }),

		["<C-p>"] = cmp.mapping(function(fallback)
			if cmp.visible() then
				cmp.select_prev_item()
			elseif luasnip.jumpable(-1) then
				luasnip.jump(-1)
			else
				fallback()
			end
		end, { "i", "s", "c" }),
	},
	sources = cmp.config.sources({
		{ name = "nvim_lsp" },
		{ name = "luasnip" }, -- For luasnip users.
		{ name = "buffer" },
		{ name = "path" },
		{ name = "nvim_lsp_signature_help" },
	}),
	formatting = {
		format = function(entry, vim_item)
			if not prsnt then
				-- Source
				vim_item.menu = ({
					buffer = "[Buffer]",
					nvim_lsp = "[LSP]",
					luasnip = "[LuaSnip]",
					nvim_lua = "[Lua]",
				})[entry.source.name]
				return vim_item
			else
				return lspkind.cmp_format({
					mode = "symbol_text",
					with_text = false, -- do not show text alongside icons
					maxwidth = 50, -- prevent the popup from showing more than provided characters (e.g 50 will not show more than 50 characters)
				})
			end
		end,
	},
})

-- Use buffer source for `/` (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline("/", {
	sources = {
		{ name = "buffer" },
	},
})

-- Use cmdline & path source for ':' (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline(":", {
	sources = cmp.config.sources({
		{ name = "path" },
	}, {
		{ name = "cmdline" },
	}),
})

-- Setup lspconfig.
local capabilities = require("cmp_nvim_lsp").update_capabilities(vim.lsp.protocol.make_client_capabilities())

-- Use an on_attach function to only map the following keys
-- after the language server attaches to the current buffer
local on_attach = function(client, bufnr)
  -- init aerial with lsp
  require("aerial").on_attach(client, bufnr);
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

	buf_set_keymap("n", "<F2>", "<cmd>lua vim.lsp.buf.rename()<CR>", opts)
	buf_set_keymap("n", "<leader>cf", "<cmd>lua vim.lsp.buf.formatting()<CR>", opts)
	buf_set_keymap("i", "<c-k>", "<cmd>lua vim.lsp.buf.signature_help()<CR>", { noremap = true, silent = true })

	-- set saga keymap use buf_set_keymap in case in non lsp config file trigger error
	if vim.g.loaded_lspsaga then
		buf_set_keymap("n", "]d", ":Lspsaga diagnostic_jump_next<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "[d", ":Lspsaga diagnostic_jump_prev<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "<c-k>", ":Lspsaga show_line_diagnostics<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "K", ":Lspsaga hover_doc<CR>", { noremap = true, silent = true })
		buf_set_keymap("n", "ca", ":Lspsaga code_action<CR>", { noremap = true, silent = true })
		buf_set_keymap("x", "ca", ":<c-u>Lspsaga range_code_action<CR>", { noremap = true, silent = true })
	end
	-- Mappings end

	if client.name == "tsserver" then
		client.resolved_capabilities.document_formatting = false
	end
end

local servers = { "volar", "pyright", "gopls", "rls", "cssls", "tailwindcss", 'sumneko_lua', 'jsonls' }
for _, lsp in ipairs(servers) do
	nvim_lsp[lsp].setup({ on_attach = on_attach, capabilities = capabilities, flags = { debounce_text_changes = 150 } })
end

-- tsserver

nvim_lsp.tsserver.setup({
	on_attach = function(client, bufnr) 
    ts_utils.setup {}
    on_attach(client, bufnr)

    ts_utils.setup_client(client)
  end,
	capabilities = capabilities,
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
require("aerial").setup({
  on_attach = function(bufnr)
    local function buf_set_keymap(...)
      vim.api.nvim_buf_set_keymap(bufnr, ...)
    end
    local opts = { noremap = true, silent = true }
    -- aerial
    buf_set_keymap("n", "<leader>o", "<cmd>AerialToggle!<CR>", { noremap = true, silent = true })
    buf_set_keymap("n", "[o", "<cmd>AerialPrev<CR>", { noremap = true, silent = true })
    buf_set_keymap("n", "]o", "<cmd>AerialNext<CR>", { noremap = true, silent = true })
  end
})



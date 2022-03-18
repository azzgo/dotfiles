if !exists('g:lspconfig')
  finish
endif

if !exists('g:loaded_cmp')
  finish
endif

" Debug 时开启
lua << EOF
--vim.lsp.set_log_level("debug")
EOF

lua << EOF
local nvim_lsp = require('lspconfig')
local cmp = require('cmp')
local lspkind = require('lspkind')
local luasnip = require("luasnip")

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
    ['<C-b>'] = cmp.mapping(cmp.mapping.scroll_docs(-4), { 'i', 'c' }),
    ['<C-f>'] = cmp.mapping(cmp.mapping.scroll_docs(4), { 'i', 'c' }),
    ['<C-Space>'] = cmp.mapping(cmp.mapping.complete(), { 'i', 'c' }),
    ['<C-y>'] = cmp.config.disable, -- Specify `cmp.config.disable` if you want to remove the default `<C-y>` mapping.
    ['<C-e>'] = cmp.mapping({
      i = cmp.mapping.abort(),
      c = cmp.mapping.close(),
    }),
    ['<CR>'] = cmp.mapping.confirm({ select = true }), -- Accept currently selected item. Set `select` to `false` to only confirm explicitly selected items.
    ["<Tab>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_next_item()
      elseif luasnip.expand_or_jumpable() then
        luasnip.expand_or_jump()
      elseif has_words_before() then
        cmp.complete()
      else
        fallback()
      end
    end, { "i", "s" }),

    ["<S-Tab>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_prev_item()
      elseif luasnip.jumpable(-1) then
        luasnip.jump(-1)
      else
        fallback()
      end
    end, { "i", "s" }),
  },
  sources = cmp.config.sources({
    { name = 'nvim_lsp' },
    { name = 'luasnip' }, -- For luasnip users.
    { name = 'buffer' },
    { name = 'path' },
  }),
  formatting = {
    format = lspkind.cmp_format({
      with_text = false, -- do not show text alongside icons
      maxwidth = 50, -- prevent the popup from showing more than provided characters (e.g 50 will not show more than 50 characters)
    })
  }
})

-- Use buffer source for `/` (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline('/', {
  sources = {
    { name = 'buffer' }
  }
})

-- Use cmdline & path source for ':' (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline(':', {
  sources = cmp.config.sources({
    { name = 'path' }
  }, {
    { name = 'cmdline' }
  })
})

-- Setup lspconfig.
local capabilities = require('cmp_nvim_lsp').update_capabilities(vim.lsp.protocol.make_client_capabilities())

-- Use an on_attach function to only map the following keys
-- after the language server attaches to the current buffer
local on_attach = function(client, bufnr)
  local function buf_set_keymap(...) vim.api.nvim_buf_set_keymap(bufnr, ...) end
  local function buf_set_option(...) vim.api.nvim_buf_set_option(bufnr, ...) end

  -- Enable completion triggered by <c-x><c-o>
  buf_set_option('omnifunc', 'v:lua.vim.lsp.omnifunc')
    -- Mappings.
  local opts = { noremap=true, silent=true }

  buf_set_keymap('n', '<F2>', '<cmd>lua vim.lsp.buf.rename()<CR>', opts)
  buf_set_keymap('n', '<leader>cf', '<cmd>lua vim.lsp.buf.formatting()<CR>', opts)
  if client.name == 'tsserver' then
    client.resolved_capabilities.document_formatting = false
  end
end



local servers = { 'pyright', 'gopls', 'rls' }
for _, lsp in ipairs(servers) do
  nvim_lsp[lsp].setup {on_attach = on_attach, capabilities = capabilities, flags = { debounce_text_changes = 150 }}
end

-- tsserver


nvim_lsp.tsserver.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = { debounce_text_changes = 150 },
  handlers = {
   ["textDocument/publishDiagnostics"] = vim.lsp.with(
     vim.lsp.diagnostic.on_publish_diagnostics, {
       -- Disable virtual_text
       virtual_text = false
     }
   ),
  },
  commands = {
    OrganizeImports = {
      function ()
        local params = {
          command = "_typescript.organizeImports",
          arguments = {vim.api.nvim_buf_get_name(0)},
          title = ""
        }
        vim.lsp.buf.execute_command(params)
      end,
      description = "Organize Imports"
    }
  }
}

-- noise when lots of diagnose reports.
vim.diagnostic.config {
  virtual_text = false,
}

nvim_lsp.diagnosticls.setup {
  on_attach = on_attach,
  filetypes = { 'javascript', 'javascriptreact', 'json', 'typescript', 'typescriptreact', 'css', 'less', 'scss', 'markdown', 'pandoc' },
  init_options = {
    linters = {
      eslint = {
        command = 'eslint_d',
        rootPatterns = { '.git' },
        debounce = 100,
        args = { '--stdin', '--stdin-filename', '%filepath', '--format', 'json' },
        sourceName = 'eslint_d',
        parseJson = {
          errorsRoot = '[0].messages',
          line = 'line',
          column = 'column',
          endLine = 'endLine',
          endColumn = 'endColumn',
          message = '[eslint] ${message} [${ruleId}]',
          security = 'severity'
        },
        securities = {
          [2] = 'error',
          [1] = 'warning'
        }
      },
    },
    filetypes = {
      javascript = 'eslint',
      javascriptreact = 'eslint',
      typescript = 'eslint',
      typescriptreact = 'eslint',
    },
    formatters = {
      eslint_d = {
        command = 'eslint_d',
        rootPatterns = { '.git' },
        args = { '--stdin', '--stdin-filename', '%filename', '--fix-to-stdout' },
        rootPatterns = { '.git' },
      },
      prettier = {
        command = 'prettier',
        rootPatterns = { '.git' },
        -- requiredFiles: { 'prettier.config.js' },
        args = { '--stdin-filepath', '%filename' }
      }
    },
    formatFiletypes = {
      css = 'prettier',
      javascript = 'prettier',
      javascriptreact = 'prettier',
      json = 'prettier',
      scss = 'prettier',
      less = 'prettier',
      typescript = 'prettier',
      typescriptreact = 'prettier',
      json = 'prettier',
      markdown = 'prettier',
    }
  }
}
EOF

" vista config
let g:vista_default_executive = 'nvim_lsp'

nnoremap <leader>o :Vista<CR>

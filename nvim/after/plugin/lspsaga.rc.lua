if vim.g.loaded_lspsaga == nil then
  return
end

local saga = require 'lspsaga'

saga.init_lsp_saga {
  border_style = "round",
}

vim.api.nvim_set_keymap('n', ']d', ':Lspsaga diagnostic_jump_next<CR>', { noremap = true, silent = true })
vim.api.nvim_set_keymap('n', '[d', ':Lspsaga diagnostic_jump_prev<CR>', { noremap = true, silent = true })
vim.api.nvim_set_keymap('n', '<c-k>', ':Lspsaga show_line_diagnostics<CR>', { noremap = true, silent = true })
vim.api.nvim_set_keymap('n', 'K', ':Lspsaga hover_doc<CR>', { noremap = true, silent = true })



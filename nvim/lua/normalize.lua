-- remove default kemap for lsp as I use coc not nvim-lsp
if vim.fn.has('nvim-0.11') == 1 then
  vim.keymap.del('n', 'grn')
  vim.keymap.del({'n', 'x'}, 'gra')
  vim.keymap.del('n', 'grr')
  vim.keymap.del('n', 'gri')
  vim.keymap.del('n', 'gO')
  vim.keymap.del('n', ']<Space>')
  vim.keymap.del('n', '[<Space>')
end

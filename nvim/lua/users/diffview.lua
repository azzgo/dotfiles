vim.keymap.set('n', '<leader>gl', vim.cmd.DiffviewFileHistory, {})
vim.keymap.set('n', '<leader>gf', function ()
  vim.cmd[[ DiffviewFileHistory % ]]
end, {})
vim.keymap.set('n', '<leader>gd', ':DiffviewOpen', {})

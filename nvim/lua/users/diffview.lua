vim.keymap.set('n', '<leader>gl', vim.cmd.DiffviewFileHistory, {})
vim.keymap.set('n', '<leader>gf', function()
  vim.cmd [[ DiffviewFileHistory % ]]
end, {})
vim.keymap.set('n', '<leader>gd', ':DiffviewOpen', {})
vim.keymap.set('n', '<leader>gc', function()
  local commitId = vim.trim(vim.fn.input('Commit ID: '))
  if commitId ~= '' then
    vim.cmd('DiffviewOpen ' .. commitId .. '^!')
  end
end, {})

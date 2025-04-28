vim.keymap.set('n', '<leader>gl', vim.cmd.DiffviewFileHistory, {})
vim.keymap.set('n', '<leader>gf', function()
  vim.cmd [[ DiffviewFileHistory % ]]
end, {})
vim.keymap.set('n', '<leader>gd', ':DiffviewOpen', {})
vim.keymap.set('n', '<leader>gc', function()
  vim.ui.input({ prompt = 'Commit ID: ' }, function(input)
    if input == nil then
      return
    end
    local commitId = vim.trim(input);
    if commitId ~= '' then
      vim.cmd('DiffviewOpen ' .. commitId .. '^!')
    end
  end)
end, {})


require("diffview").setup({
  hooks = {
    view_enter = function(view)
      vim.cmd.CocDisable()
    end,
    view_leave = function(view)
      vim.schedule(function()
        vim.cmd.CocEnable()
      end)
    end,
  },
})

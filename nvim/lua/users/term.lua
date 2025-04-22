local commands = {
  root = 'root',
  buffer = 'buffer',
}

vim.keymap.set('n', '<A-t>', function()
  local buffer_path = vim.fn.expand('%:p')
  local has_valid_path = buffer_path ~= '' and vim.loop.fs_stat(buffer_path) ~= nil

  if has_valid_path then
    vim.ui.select(
      { commands.root, commands.buffer },
      {
        prompt = 'FloatTerm in:',
      },
      function(choice)
        if choice == commands.root then
          vim.cmd('FloatermNew')
        elseif choice == commands.buffer then
          vim.cmd('FloatermNew --cwd=<buffer>')
        end
      end
    )
  else
    vim.cmd('FloatermNew')
  end
end, {})

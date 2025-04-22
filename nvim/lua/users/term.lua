local utils = require('users.lib.utils')
local commands = {
  root = 'root',
  buffer = 'buffer',
}

vim.keymap.set('n', '<A-t>', function()
  if utils.check_buffer_is_a_file() then
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

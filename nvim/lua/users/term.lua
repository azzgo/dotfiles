local commands = {
  root = 'root',
  buffer = 'buffer',
}


vim.keymap.set('n', '<A-t>', function()
  vim.ui.select(
    vim.tbl_keys(commands),
    {
      prompt = 'FloatTerm in:',
      format_item = function(item)
        return commands[item]
      end,
    },
    function(choice)
      if choice == 'root' then
        vim.cmd('FloatermNew')
      elseif choice == 'buffer' then
        vim.cmd('FloatermNew --cwd=<buffer>')
      end
    end
  )
end, {})

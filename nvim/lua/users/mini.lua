local ok, ai = pcall(require, "mini.ai")

if not ok then
  return
end

ai.setup();

vim.keymap.set('n', '<A-y>', function()
  vim.fn.feedkeys('yiq')
  vim.fn.feedkeys('"*yiq')
  vim.fn.feedkeys('"+yiq')
end, { remap = true }, 'yank current quote')

vim.keymap.set('n', '<leader>y', function()
  vim.cmd('normal! yiw')
  local text = vim.fn.getreg('""')
  vim.fn.setreg('*', text)
  vim.fn.setreg('+', text)
end, { remap = true }, 'yank current word')

vim.keymap.set('v', '<leader>y', function()
  vim.cmd('normal! y')
  local text = vim.fn.getreg('""')
  vim.fn.setreg('*', text)
  vim.fn.setreg('+', text)
end, { remap = true }, 'yank selected text')

vim.keymap.set('n', '<c-y>', function()
  vim.fn.feedkeys('yi%')
  vim.fn.feedkeys('"*yi%')
  vim.fn.feedkeys('"+yi%')
end, { remap = true }, 'yank current bracket')

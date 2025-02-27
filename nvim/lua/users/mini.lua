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

vim.keymap.set({'n', 'x'}, '<leader>y', function()
  vim.fn.feedkeys('yiw')
  vim.fn.feedkeys('"*yiw')
  vim.fn.feedkeys('"+yiw')
end, { remap = true }, 'yank current word')

vim.keymap.set('n', '<c-y>', function()
  vim.fn.feedkeys('yi%')
  vim.fn.feedkeys('"*yi%')
  vim.fn.feedkeys('"+yi%')
end, { remap = true }, 'yank current bracket')

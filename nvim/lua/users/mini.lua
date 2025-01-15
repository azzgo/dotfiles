local ok, ai = pcall(require, "mini.ai")

if not ok then
  return
end

ai.setup();

vim.keymap.set('n', '<A-y>', function()
  vim.fn.feedkeys('yiq')
  vim.fn.feedkeys('"*yiq')
  vim.fn.feedkeys('"+yiq')
end, { remap = true })

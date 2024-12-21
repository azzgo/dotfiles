local ok, snacks = pcall(require, "snacks")
if not ok then
  return
end

snacks.setup({
  bigfile = { enabled = false },
  dashboard = { enabled = false },
  indent = { enabled = true },
  input = { enabled = false },
  notifier = {
    enabled = true,
    timeout = 3000,
  },
  quickfile = { enabled = true },
  scroll = { enabled = false },
  statuscolumn = { enabled = false },
  words = { enabled = false },
})

vim.keymap.set("n", "<A-z>", function()
  Snacks.zen()
end, { desc = "Zen mode" })

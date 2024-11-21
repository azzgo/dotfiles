local ok, persistence = pcall(require, "persistence")

if not ok then
  return
end

persistence.setup({
  dir = vim.g.dot_config_path .. "/.local" .. "/sessions/",
  need = 1,
})

persistence.stop()

vim.keymap.set("n", "<M-r>", function() persistence.load() end)

local ok, dressing = pcall(require, "dressing")

if not ok then
  return
end

dressing.setup({
  input = {
    enabled = false,
  },
  select = {
    enabled = true,
    backend = { 'builtin', 'fzf' },
    builtin = {
      relative = 'cursor',
      mappings = {
        ["<Esc>"] = "Close",
        ["<C-c>"] = "Close",
        ["<CR>"] = "Confirm",
      },
    }
  },
})

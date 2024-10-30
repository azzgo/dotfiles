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
      border = 'single',
      min_width = { 1, 0.1 },
      min_height = { 1, 0.1 },
      mappings = {
        ["<Esc>"] = "Close",
        ["<C-c>"] = "Close",
        ["<CR>"] = "Confirm",
      },
      override =  function (config)
        config.title_pos = 'left'
        return config
      end
    }
  },
})

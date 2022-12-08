local ok, tree = pcall(require, "nvim-tree")

if not ok then
  return
end

tree.setup({
  view = {
    adaptive_size = true
  }
})

vim.keymap.set("n", "<leader>nn", ':NvimTreeToggle<CR>', { noremap = true, silent = true })
vim.keymap.set("n", "<leader>nf", ':NvimTreeFindFile<CR>', { noremap = true, silent = true })

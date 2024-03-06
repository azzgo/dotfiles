local ok, harpoon = pcall(require, "harpoon")

if not ok then
  return
end

harpoon:setup()

local function harpoon_fzf_popup(harpoon_files)
  local source = {}
  for _, item in ipairs(harpoon_files.items) do
    table.insert(source, item.value)
  end

  vim.fn['_L_FZF_WRAPPER_RUN_']({ source = source })
end

vim.keymap.set("n", "<A-a>", function() harpoon:list():append() end)
vim.keymap.set("n", "<A-r>", function() harpoon:list():remove() end)
-- vim.keymap.set("n", "<leader><tab>", function() harpoon.ui:toggle_quick_menu(harpoon:list()) end)
vim.keymap.set("n", "<leader><tab>", function() harpoon_fzf_popup(harpoon:list()) end)
vim.keymap.set("n", "<C-S-P>", function() harpoon:list():prev() end)
vim.keymap.set("n", "<C-S-N>", function() harpoon:list():next() end)

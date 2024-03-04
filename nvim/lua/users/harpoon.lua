local ok, harpoon = pcall(require, "harpoon")

if not ok then
  return
end

harpoon:setup()

local extensions = require("harpoon.extensions")

harpoon:extend(extensions.builtins.navigate_with_number())
harpoon:extend({
  UI_CREATE = function(cx)
    vim.keymap.set("n", "<C-v>", function()
      harpoon.ui:select_menu_item({ vsplit = true })
    end, { buffer = cx.bufnr })

    vim.keymap.set("n", "<C-x>", function()
      harpoon.ui:select_menu_item({ split = true })
    end, { buffer = cx.bufnr })

    vim.keymap.set("n", "<C-t>", function()
      harpoon.ui:select_menu_item({ tabedit = true })
    end, { buffer = cx.bufnr })
  end,
  ADD = function(cx)
    print("[harpoon] file added, location of", cx.item.value)
  end,
  REMOVE = function(cx)
    print("[harpoon] file removed, location of", cx.item.value)
  end
})

vim.keymap.set("n", "<A-a>", function() harpoon:list():append() end)
vim.keymap.set("n", "<A-r>", function() harpoon:list():remove() end)
vim.keymap.set("n", "<leader><tab>", function() harpoon.ui:toggle_quick_menu(harpoon:list()) end)
vim.keymap.set("n", "<C-S-P>", function() harpoon:list():prev() end)
vim.keymap.set("n", "<C-S-N>", function() harpoon:list():next() end)


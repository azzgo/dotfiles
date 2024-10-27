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

  vim.fn['_L_FZF_WRAPPER_RUN_']({ source = source, options = { '--layout=reverse-list', '--cycle' } })
end

local function harpoon_fzf_action_popup()
  local menu = {
    'add',
    'remove',
    'list',
    'clear',
  }
  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = menu,
    options = { '--prompt', 'harpoon actions: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      if action == 'add' then
        return harpoon:list():append()
      elseif action == 'remove' then
        return harpoon:list():remove()
      elseif action == 'list' then
        return harpoon_fzf_popup(harpoon:list())
      elseif action == 'clear' then
        return harpoon:list():clear()
      end
    end
  })
end

harpoon:extend({
  ADD = function(cx)
    print("[harpoon] file added, location of", cx.item.value)
  end,
  REMOVE = function(cx)
    print("[harpoon] file removed, location of", cx.item.value)
  end
})

vim.keymap.set("n", "<leader>e", function() harpoon_fzf_action_popup() end)
vim.keymap.set("n", "<C-e>", function() harpoon_fzf_popup(harpoon:list()) end)

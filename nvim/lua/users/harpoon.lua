local ok, harpoon = pcall(require, "harpoon")
local helper = require('users.lib.self-helper')

if not ok then
  return
end

harpoon:setup()

local function harpoon_fzf_popup()
  local source = helper.assemble_harsoon_files()

  Snacks.picker.pick(
    'harpoon',
    {
      items = source,
      refresh = true,
      multi = false,
      actions = {
        harpoon_remove = function(picker)
          local item = picker:current()
          harpoon:list():remove({
            idx = item.idx,
            value = item.file,
          })
          table.remove(source, item.idx)
          picker:find()
        end,
      },
      win = {
        input = {
          keys = {
            ["<c-x>"] = { "harpoon_remove", mode = { "n", "i" }, desc = "remove file from harpoon list" },
          },
        },
      },
    }
  )
end

local function harpoon_fzf_action_popup()
  local menu = {
    'add',
    'list',
    'clear',
  }
  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = menu,
    options = { '--prompt', 'harpoon actions: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      if action == 'add' then
        return harpoon:list():add()
      elseif action == 'list' then
        return harpoon_fzf_popup()
      elseif action == 'clear' then
        return harpoon:list():clear()
      end
    end
  })
end

harpoon:extend({
  ADD = function(cx)
    local fileName = vim.fn.fnamemodify(cx.item.value, ':t')
    Snacks.notify.info(string.format("[file] %s added", fileName), {
      title = "harpoon",
    })
  end,
  REMOVE = function(cx)
    local fileName = vim.fn.fnamemodify(cx.item.value, ':t')
    Snacks.notify.warn(string.format("[file] %s removed", fileName), {
      title = "harpoon",
    })
  end
})

vim.keymap.set("n", "<leader>e", function() harpoon_fzf_action_popup() end)
vim.keymap.set("n", "<C-e>", function() harpoon_fzf_popup() end)

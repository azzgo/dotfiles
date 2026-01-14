local ok, opencode = pcall(require, "opencode")

if not ok then
  return
end


vim.g.opencode_opts = {
  provider = {
    enabled = "snacks",
    snacks = {
      win = {
        position = "right",
        width = 0.6,
      },
    },
  }
}

vim.o.autoread = true


-- Recommended/example keymaps.

local opencode_actions = {
  {
    label = "Toggle",
    action = function() opencode.toggle() end
  },
  {
    label = "Ask (@this:)",
    action = function() opencode.ask("@this: ", { submit = true }) end
  },
  {
    label = "Select",
    action = function() opencode.select() end
  },
  {
    label = "Operator (range)",
    action = function() opencode.operator("@this ") end
  },
  {
    label = "Operator (line)",
    action = function() opencode.operator("@this ") end -- 可根据需要扩展
  },
  {
    label = "Half Page Up",
    action = function() opencode.command("session.half.page.up") end
  },
  {
    label = "Half Page Down",
    action = function() opencode.command("session.half.page.down") end
  },
}

vim.keymap.set({ "n", "t", "x" }, "<C-.>", function()
  local items = {}
  for _, v in ipairs(opencode_actions) do
    table.insert(items, v.label)
  end
  vim.ui.select(items, { prompt = "Opencode Action" }, function(choice)
    for _, v in ipairs(opencode_actions) do
      if v.label == choice then
        v.action()
        break
      end
    end
  end)
end, { desc = "Opencode actions menu" })

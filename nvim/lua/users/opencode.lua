local ok, opencode = pcall(require, "opencode")

if not ok then
  return
end


vim.g.opencode_opts = {
  server = {
    start = function()
      require("opencode.terminal").open("opencode --port", {
        split = "right",
        width = math.floor(vim.o.columns * 0.6),
      })
    end,
    stop = function()
      require("opencode.terminal").close()
    end,
    toggle = function()
      require("opencode.terminal").toggle("opencode --port", {
        split = "right",
        width = math.floor(vim.o.columns * 0.6),
      })
    end,
  },
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
    action = function() opencode.ask("@this: ") end
  },
  {
    label = "Select",
    action = function() opencode.select() end
  },
}

vim.keymap.set({ "n", "t", "x" }, "<A-i>", function()
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

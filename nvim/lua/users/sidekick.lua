local ok, sidekick = pcall(require, "sidekick")

if not ok then
  return
end

sidekick.setup({
  nes = { enabled = false },
  cli = {
    win = {
      layout = "right",
      split = {
        width = math.floor(vim.o.columns * 0.6),
      },
    },
    tools = {
      codex = {},
      opencode = {},
      cursor = {},
    },
  },
})

vim.o.autoread = true

local sidekick_actions = {
  {
    label = "Toggle",
    action = function() require("sidekick.cli").toggle({ focus = true, filter = { installed = true } }) end,
  },
  {
    label = "Select AI CLI",
    action = function() require("sidekick.cli").select({ filter = { installed = true } }) end,
  },
  {
    label = "Ask (@this:)",
    action = function() require("sidekick.cli").send({ msg = "{this}" }) end,
  },
  {
    label = "Select",
    action = function() require("sidekick.cli").select() end,
  },
}

vim.keymap.set({ "n", "t", "x" }, "<A-i>", function()
  local items = {}
  for _, v in ipairs(sidekick_actions) do
    table.insert(items, v.label)
  end
  vim.ui.select(items, { prompt = "Sidekick Action" }, function(choice)
    for _, v in ipairs(sidekick_actions) do
      if v.label == choice then
        v.action()
        break
      end
    end
  end)
end, { desc = "Sidekick actions menu" })

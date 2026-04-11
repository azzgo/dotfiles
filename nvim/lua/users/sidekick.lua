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
      keys = {
        buffers       = false,
        files         = false,
        hide_n        = false,
        hide_ctrl_q   = false,
        hide_ctrl_dot = false,
        hide_ctrl_z   = false,
        prompt        = false,
        stopinsert    = false,
        nav_left      = false,
        nav_down      = false,
        nav_up        = false,
        nav_right     = false,
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
    label = "Prompt",
    action = function() require("sidekick.cli").prompt() end,
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

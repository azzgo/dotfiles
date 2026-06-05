vim.keymap.set('n', '<leader>gl', vim.cmd.DiffviewFileHistory, {})
vim.keymap.set('n', '<leader>gf', function()
  vim.cmd [[ DiffviewFileHistory % ]]
end, {})
vim.keymap.set('n', '<leader>gd', ':DiffviewOpen', {})
vim.keymap.set('n', '<leader>gc', function()
  vim.ui.input({ prompt = 'Commit ID: ' }, function(input)
    if input == nil then
      return
    end
    local commitId = vim.trim(input);
    if commitId ~= '' then
      vim.cmd('DiffviewOpen ' .. commitId .. '^!')
    end
  end)
end, {})


local actions = require("diffview.actions")

require("diffview").setup({
  hooks = {
    view_enter = function()
      vim.cmd.CocDisable()
    end,
    view_leave = function()
      vim.schedule(function()
        vim.cmd.CocEnable()
      end)
    end,
  },
  view = {
    default = {
      layout = "diff2_horizontal",
    },
    cycle_layouts = {
      default = { "diff2_horizontal", "diff1_inline" },
    },
  },
  keymaps = {
    view = {
      { "n", "gf", actions.goto_file_edit_close, { desc = "Open the file and close" } },
    },
    file_panel = {
      { "n", "gf", actions.goto_file_edit_close, { desc = "Open the file and close" } },
    },
    file_history_panel = {
      { "n", "gf", actions.goto_file_edit_close, { desc = "Open the file and close" } },
    },
  },
})

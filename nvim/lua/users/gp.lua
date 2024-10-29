local ok, gp = pcall(require, "gp")

if not ok then
  return
end

gp.setup({
  providers = {
    copilot = {
      endpoint = "https://api.githubcopilot.com/chat/completions",
      secret = {
        "bash",
        "-c",
        "cat ~/.config/github-copilot/hosts.json | sed -e 's/.*oauth_token...//;s/\".*//'",
      },
    },
  },
  default_command_agent = "copilot",
  default_chat_agent = "copilot",
})

local normal_menu = {
  'GpChatNew vsplit',
  'GpChatNew split',
  'GpChatNew tabnew',
  'GpChatNew popup'
}

local visiual_menu = {
  'GpRewrite',
  'GpAppend',
  'GpPrepend',
  'GpEnew',
  'GpNew',
  'GpTabnew',
  'GpPopup',
  'GpImplement'
}

vim.keymap.set("n", "<leader>i", function()
  vim.ui.select(normal_menu, {
    prompt = 'Gp actions: ',
    format_item = function(item)
      return item
    end,
  }, function(selection)
    if not selection then
      return
    end
    vim.cmd(selection)
  end)
end
)

vim.keymap.set({ "x", "i" }, "<leader>i", function()
  if vim.api.nvim_get_mode().mode == "i" then
    vim.cmd("stopinsert")
  end
  vim.ui.select(visiual_menu, {
    prompt = 'Gp actions: ',
    format_item = function(item)
      return item
    end,
  }, function(selection)
    if not selection then
      return
    end
    vim.cmd(selection)
  end)
end)

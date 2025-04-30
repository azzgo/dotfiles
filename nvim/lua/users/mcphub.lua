local ok, mcphub = pcall(require, "mcphub")
local utils = require("users.lib.utils")

if not ok then
  return
end

local configFilePath = "~/.config/mcphub/servers.json";

-- create the config file and directory if it doesn't exist
local configDir = vim.fn.expand("~/.config/mcphub")
utils.make_sure_dir(configDir)
if vim.fn.filereadable(configFilePath) == 0 then
  local configFile = io.open(vim.fn.expand(configFilePath), "w")
  if configFile then
    configFile:write('{ "mcpServers": {} }')
    configFile:close()
  end
end


mcphub.setup({
  config = vim.fn.expand(configFilePath),
  extensions = {
    codecompanion = {
      show_result_in_chat = false,
      make_vars = true, -- make chat #variables from MCP server resources
    },
  },
})

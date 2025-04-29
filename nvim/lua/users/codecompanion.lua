local ok, codecompanion = pcall(require, "codecompanion")

if not ok then
  return
end

codecompanion.setup({
  opts = {
    language = 'English',
  },
  strategies = {
    chat = {
      adapter = 'copilot',
      keymaps = {
        close = {
          modes = { n = "<A-q>", i = "<A-q>" },
        },
        completion = {
          modes = { i = "<C-space>" },
        },
        stop = {
          modes = { i = "<C-c>", n = "<C-c>" },
        },
        yank_code = {
          modes = { n = "<C-y>" },
        },
      },
      tools = {
        ["mcp"] = {
          -- calling it in a function would prevent mcphub from being loaded before it's needed
          callback = function() return require("mcphub.extensions.codecompanion") end,
          description = "Call tools and resources from the MCP Servers",
          opts = {
            requires_approval = true,
          }
        }
      },
    },
    inline = {
      adapter = 'copilot',
    },
  },
  display = {
    diff = {
      enabled = true,
      layout = "vertical"
    },
  }
})

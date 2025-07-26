local ok, codecompanion = pcall(require, "codecompanion")
local utils = require("users.lib.utils")

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
          modes = { n = "g<A-q>", i = '<nop>' },
        },
        completion = {
          modes = { i = "<C-space>" },
        },
        stop = {
          modes = { n = "<C-c>" },
        },
        yank_code = {
          modes = { n = "<C-y>" },
        },
      },
      variables = {
        ["buffer"] = {
          opts = {
            default_params = 'pin', -- or 'watch'
          },
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
    action_palette = {
      provider = "default",
    },
    diff = {
      enabled = true,
      layout = "vertical"
    },
    chat = {
      window = {
        layout = 'horizontal',
        position = "bottom",
        height = 0.4,
        width = 1,
      },
    },
  },
  extensions = {
    history = {
      enabled = true,
      opts = {
        history_dir = vim.fn.stdpath("data") .. "/codecompanion/",
      },
      callback = {
        setup = function(opts)
          local chat_keymaps = require("codecompanion.config").strategies.chat.keymaps
          local dir = opts.history_dir
          utils.make_sure_dir(dir)

          chat_keymaps.save_chat = {
            modes = {
              n = opts.keymap or "g<A-w>",
            },
            description = "Save Chat",
            callback = function(chat)
              local buf = chat.bufnr
              if utils.check_buffer_is_a_file(buf) then
                vim.api.nvim_buf_call(buf, function()
                  vim.cmd("write")
                end)
              else
                -- generate a random filename based on date and time
                local filename = os.date("%Y-%m-%d_%H-%M-%S") .. ".md"
                local default_filepath = dir .. filename
                Snacks.input({ prompt = "Save Location: ", default = default_filepath, icon = '' }, function(input)
                  if input == nil then
                    return
                  end
                  vim.api.nvim_buf_set_option(buf, "buftype", '')
                  vim.api.nvim_buf_set_name(buf, input)
                  vim.api.nvim_buf_call(buf, function()
                    vim.cmd("write " .. input)
                  end)
                end)
              end
            end
          }
        end,
      }
    },
  }
})

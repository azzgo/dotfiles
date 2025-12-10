local ok, codecompanion = pcall(require, "codecompanion")
local utils = require("users.lib.utils")

if not ok then
  return
end

codecompanion.setup({
  opts = {
    language = 'Chinese',
  },
  prompt_library = {
    ['Refine Test'] = {
      strategy = "chat",
      description = "Refine testcase in buffer",
      opts = {
        index = 50,
        is_default = false,
        is_slash_cmd = true,
        short_name = "refine_test",
        auto_submit = true,
      },
      prompts = {
        {
          role = "system",
          content = "You are an expert of Tdd, write test first and let the implemention to user",
        },
        {
          role = "user",
          content = "@{files} refine the test case in #{buffer}. If the test fixture desctiption is not suitable, change it. You should edit file and show the diff to me."
        }
      },
    },
    ['Auto Commit'] = {
      strategy = "workflow",
      description = "Generate a commit message and commit directly",
      opts = {
        index = 51,
        is_default = false,
        is_slash_cmd = true,
        short_name = "auto_commit",
      },
      prompts = {
        {
          {
            role = "system",
            content = "You are an expert at following the Conventional Commit specification. You will generate a commit message and then execute the git commit command directly.",
          },
          {
            role = "user", 
            content = function()
              local diff = vim.system({ "git", "diff", "--no-ext-diff", "--staged" }, { text = true }):wait()
              if diff.stdout == "" then
                return "No staged changes found. Please stage your changes first with `git add` and then try again."
              end
              return string.format(
                [[Based on the following git diff of staged changes, generate a commit message following the Conventional Commit specification and then use the cmd_runner tool to execute `git commit -m "your_generated_message"`:

```diff
%s
```

Please:
1. Generate an appropriate commit message following conventional commit format (e.g., "feat:", "fix:", "docs:", etc.)
2. Use the @{cmd_runner} tool to execute the git commit command with your generated message
2.1 If message is multiline, separate each line to multiple `-m "{line}"`
3. Do both steps in the same response]],
                diff.stdout
              )
            end,
            opts = {
              contains_code = true,
              auto_submit = true,
            },
          },
        },
      },
    },
  },
  adapters = {
    http= {
      local_llm = function()
        return require("codecompanion.adapters").extend("openai_compatible", {
          env = {
            url = "http://127.0.0.1:11434", -- optional: default value is ollama url http://127.0.0.1:11434
            models_endpoint = "/v1/models", -- optional: attaches to the end of the URL to form the endpoint to retrieve models
          },
          schema = {
            model = {
              default = "gpt-oss:20b",  -- define llm model to be used
            },
          },
        })
      end,
      openrouter = function ()
        return require("codecompanion.adapters").extend('openai_compatible', {
          env = {
            url = "https://openrouter.ai/api",
            api_key = "cmd:pass show ai/openrouter | tail -n1 | tr -d '\n'",
          },
          schema = {
            model = {
              default = "qwen/qwen3-coder-30b-a3b-instruct",
            },
          },
        })
      end
    }
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

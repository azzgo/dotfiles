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
          content =
          "@{files} refine the test case in #{buffer}. If the test fixture desctiption is not suitable, change it. You should edit file and show the diff to me."
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
            content =
            "You are an expert at following the Conventional Commit specification. You will generate a commit message and then execute the git commit command directly.",
          },
          {
            role = "user",
            content = function()
              local diff = vim.system({ "git", "diff", "--no-ext-diff", "--staged" }, { text = true }):wait()
              if diff.stdout == "" then
                return "No staged changes found. Please stage your changes first with `git add` and then try again."
              end
              return string.format(
                [[Based on the following git diff of staged changes, generate a commit message(in English) following the Conventional Commit specification and then use the cmd_runner tool to execute `git commit -m "your_generated_message"`:

```diff
%s
```

Please:
1. Generate an appropriate commit message following conventional commit format (e.g., "feat:", "fix:", "docs:", etc.)
2. Use the @{cmd_runner} tool to execute the git commit command with your generated message
2.1 If message is multiline, separate each line to multiple `-m "{line}"`
2.2 Limit the subject line to 50 characters
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
    -- based on builtin prompt `explain.md`
    ['Explain code'] = {
      strategy = "chat",
      description = "Explain how the code work",
      opts = {
        index = 99,
        is_default = false,
        is_slash_cmd = true,
        short_name = "explain",
        auto_submit = false,
      },
      prompts = {
        {
          role = "system",
          content = [[When asked to explain code, follow these steps:

1. Identify the programming language.
2. Describe the purpose of the code and reference core concepts from the programming language.
3. Explain each function or significant block of code, including parameters and return values.
4. Highlight any specific functions or methods used and their roles.
5. Provide context on how the code fits into a larger application if applicable.
]],
        },
        {
          role = 'user',
          content = '#{buffer} If reference can not reason full logic of the funciton, use @{read_file} and @{grep_search} @{file_search} refine reference, and please explain this code',
        },
      }
    }
  },
  adapters = {
    http = {
      local_llm = function()
        return require("codecompanion.adapters").extend("openai_compatible", {
          env = {
            url = "http://127.0.0.1:11434", -- optional: default value is ollama url http://127.0.0.1:11434
            models_endpoint = "/v1/models", -- optional: attaches to the end of the URL to form the endpoint to retrieve models
          },
          schema = {
            model = {
              default = "gpt-oss:20b", -- define llm model to be used
            },
          },
        })
      end,
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
      opts = {
        show_default_prompt_library = false,
      },
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
})

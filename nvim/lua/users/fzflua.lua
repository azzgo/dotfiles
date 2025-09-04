local ok, fzfLua = pcall(require, 'fzf-lua')

if not ok then
  return
end

local utils = require('users.lib.utils')

-- 使用 fzf-lua 实现 grep_string
local function grep_string(search)
  if not search then
    vim.ui.input({ prompt = "Grep> " }, function(input)
      if input then
        fzfLua.live_grep({ query = input })
      end
    end)
  else
    fzfLua.live_grep({ query = search })
  end
end

-- 使用 fzf-lua 实现 find_files
local function find_files(search)
  if not search then
    vim.ui.input({ prompt = "File> " }, function(input)
      if input then
        fzfLua.files({ query = input, previewer = false})
      end
    end)
  else
    fzfLua.files({ query = search, previewer = false })
  end
end

local function leaderf_commands_actions(what)
  if what == "resume" then
    fzfLua.resume()
  elseif what == "lines" then
    fzfLua.blines({ previewer = false })
  elseif what == "cword" then
    fzfLua.grep_cword()
  elseif what == 'grep_quickfix' then
    fzfLua.grep_quickfix()
  end
end

local function leaderf_commands()
  local source = { 'resume', 'lines', 'grep buffer', 'grep_quickfix' }
  vim.ui.select(source, { prompt = "Fzflua Commands" }, function(selected)
    leaderf_commands_actions(selected)
  end)
end

-- Key Mappings
vim.keymap.set('n', '<A-l>', leaderf_commands, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>f', find_files, { silent = true, noremap = true })
vim.keymap.set('v', '<leader>f', function()
  local text, _ = utils.get_selected_text(true)
  find_files(text)
end, { silent = true, noremap = true })

vim.keymap.set('n', '<leader>/', function() grep_string() end, { silent = true, noremap = true })
vim.keymap.set('v', '<leader>/', function()
  fzfLua.grep_visual()
end, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>gs', function()
  fzfLua.git_status({ previewer = false })
end, { silent = true, noremap = true })

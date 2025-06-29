local utils = require('users.lib.utils')

vim.g.Lf_WindowPosition = 'popup'
vim.g.Lf_PopupAutoAdjustHeight = 0
vim.g.Lf_PopupWidth = 0.45
vim.g.Lf_PopupHeight = 0.6
vim.g.Lf_MruEnable = 0

vim.g.Lf_PreviewResult = {
  File = 0,
  Buffer = 0,
  Mru = 0,
  Tag = 0,
  BufTag = 0,
  Function = 1,
  Line = 1,
  Colorscheme = 1,
  Rg = 0,
  Gtags = 0
}

vim.g.Lf_WildIgnore = {
  dir = { '.svn', '.git', '.hg', 'node_modules' },
  file = { '*.sw?', '~$*', '*.bak', '*.exe', '*.o', '*.so', '*.py[co]', '*.DS_store' }
}

vim.g.Lf_CommandMap = {
  ['<C-K>'] = {'<C-P>', '<C-K>'},
  ['<C-J>'] = {'<C-N>', '<C-J>'}
}

-- Update grep_string to accept optional search
local function grep_string(search)
  if not search then
    vim.ui.input({ prompt = "Grep> " }, function(input)
      if input then
        vim.cmd('Leaderf rg --nameOnly -F "' .. input .. '"')
      end
    end)
  else
    vim.cmd('Leaderf rg --nameOnly -F "' .. search .. '"')
  end
end

-- Update find_files to accept optional search
local function find_files(search)
  local function do_search(s)
    s = vim.fn.trim(s)
    s = s:gsub('^@[%w%-_]*/', '')
    vim.cmd('Leaderf file --input "' .. s .. '"')
  end
  if not search then
    vim.ui.input({ prompt = "File> " }, function(input)
      if input then do_search(input) end
    end)
  else
    do_search(search)
  end
end

vim.keymap.set('n', '<leader>/', function() grep_string() end, { silent = true, noremap = true })
vim.keymap.set('v', '<leader>/', function()
  local text, _ = utils.get_selected_text(true)
  grep_string(text)
end, { silent = true, noremap = true })

vim.keymap.set('n', '<leader>f', find_files, { silent = true, noremap = true })
vim.keymap.set('v', '<leader>f', function()
  local text, _ = utils.get_selected_text(true)
  find_files(text)
end, { silent = true, noremap = true })


local function grep_quickfix()
local qfList = {}
-- Get the location list or fallback to the quickfix list
local loclist = vim.fn.getloclist(0)
local qflist = vim.fn.getqflist()
local list = (#loclist > 0) and loclist or qflist

for _, l in ipairs(list) do
  local fname = l.filename or vim.api.nvim_buf_get_name(l.bufnr)
  if fname and #fname > 0 then
    local rfname = vim.fn.fnamemodify(fname, ':.')
    table.insert(qfList, '-g ' .. rfname)
  end
end

qfList = vim.fn.uniq(qfList)

if #qfList == 0 then
  Snacks.notify('No quickfix list found')
  return
end
  vim.ui.input({ prompt = "Grep> " }, function(input)
    if input then
      local search = input
      vim.cmd('Leaderf rg --nameOnly --input "' .. search .. '" ' .. table.concat(qfList, ' '))
    end
  end)
end

local function leaderf_commands_actions(what)
  if what == "recall" then
    vim.cmd('Leaderf --recall')
  elseif what == "window" then
    vim.cmd('Leaderf window')
  elseif what == "cword" then
    vim.cmd('Leaderf rg --cword')
  elseif what == "lines" then
    vim.cmd('Leaderf line --all')
  elseif what == "grep buffer" then
    vim.cmd('Leaderf rg --all-buffers')
  elseif what == "grep quickfix" then
    grep_quickfix()
  end
end

local function leaderf_commands()
  local source = { 'recall', 'window', 'lines', 'cword', 'grep buffer', 'grep quickfix' }
  vim.ui.select(source, { prompt = "Leaderf Commands" }, function(selected)
    leaderf_commands_actions(selected)
  end)
end

-- Key Mappings
vim.keymap.set('n', '<A-l>', leaderf_commands, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>/', function() grep_string() end, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>f', find_files, { silent = true, noremap = true })

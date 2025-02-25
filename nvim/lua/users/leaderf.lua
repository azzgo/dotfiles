vim.g.Lf_WindowPosition = 'popup'
vim.g.Lf_PopupAutoAdjustHeight = 0
vim.g.Lf_PopupWidth = 0.45
vim.g.Lf_PopupHeight = 0.6

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

-- Helper Functions
local function grep_string()
  vim.ui.input({ prompt = "Grep> " }, function(input)
    if input then
      search = input
      vim.cmd('Leaderf rg --nameOnly --input "' .. search .. '"')
    end
  end)
end

local function find_files()
  vim.ui.input({ prompt = "File> " }, function(input)
    if input then
      local search = vim.fn.trim(input)
      vim.cmd('Leaderf file --input "' .. search .. '"')
    end
  end)
end

local function leaderf_commands_actions(what)
  if what == "recall" then
    vim.cmd('Leaderf --recall')
  elseif what == "mru" then
    vim.cmd('Leaderf mru')
  elseif what == "window" then
    vim.cmd('Leaderf window')
  elseif what == "quickfix" then
    vim.cmd('Leaderf quickfix')
  elseif what == "cword" then
    vim.cmd('Leaderf rg --cword')
  end
end

local function leaderf_commands()
  local source = { 'mru', 'recall', 'window', 'quickfix', 'cword' }
  local opts = { source = source, sink = leaderf_commands_actions }

  vim.fn['_L_FZF_WRAPPER_RUN_'](opts)
end

-- Key Mappings
vim.keymap.set('n', '<leader>l', leaderf_commands, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>/', function() grep_string() end, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>f', find_files, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>b', ':Leaderf buffer<CR>', { silent = true, noremap = true })

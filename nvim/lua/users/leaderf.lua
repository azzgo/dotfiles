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

local function grep_quickfix()
  local qfList = {}
  for _, l in ipairs(loclist and vim.fn.getloclist(0) or vim.fn.getqflist()) do
    local fname = l.filename or vim.api.nvim_buf_get_name(l.bufnr)
    if fname and #fname > 0 then
      rfname = vim.fn.fnamemodify(fname, ':.')
      table.insert(qfList, '-g ' .. rfname)
    end
    qfList = vim.fn.uniq(qfList)
  end
  if #qfList == 0 then
    Snacks.notify('No quickfix list found')
    return
  end
  Snacks.input({ prompt = "Grep> " }, function(input)
    if input then
      search = input
      vim.cmd('Leaderf rg --nameOnly --input "' .. search .. '" ' .. table.concat(qfList, ' '))
    end
  end)
  vim.fn.feedkeys("i")
end

local function leaderf_commands_actions(what)
  if what == "recall" then
    vim.cmd('Leaderf --recall')
  elseif what == "mru" then
    vim.cmd('Leaderf mru')
  elseif what == "window" then
    vim.cmd('Leaderf window')
  elseif what == "cword" then
    vim.cmd('Leaderf rg --cword')
  elseif what == "grep buffer" then
    vim.cmd('Leaderf rg --all-buffers')
  elseif what == "grep quickfix" then
    grep_quickfix()
  end
end

local function leaderf_commands()
  local source = { 'mru', 'recall', 'window', 'cword', 'grep buffer', 'grep quickfix' }
  local opts = { source = source, sink = leaderf_commands_actions }

  vim.fn['_L_FZF_WRAPPER_RUN_'](opts)
end

-- Key Mappings
vim.keymap.set('n', '<leader>l', leaderf_commands, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>/', function() grep_string() end, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>f', find_files, { silent = true, noremap = true })
vim.keymap.set('n', '<leader>b', ':Leaderf buffer<CR>', { silent = true, noremap = true })

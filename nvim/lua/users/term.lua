local utils = require('users.lib.utils')
local terms = require("toggleterm.terminal")

-- Setup toggleterm
require("toggleterm").setup({
   size = function(term)
    if term.direction == "horizontal" then
      return 20
    elseif term.direction == "vertical" then
      return vim.o.columns * 0.7
    end
  end,
  open_mapping = nil, -- We'll handle this ourselves
  hide_numbers = true,
  shade_filetypes = {},
  shade_terminals = true,
  shading_factor = 2,
  insert_mappings = true,
  start_in_insert = true,
  persist_size = true,
  direction = 'horizontal',
  close_on_exit = true,
  shell = vim.o.shell,
  float_opts = {
    border = 'curved',
    winblend = 0,
    highlights = {
      border = "Normal",
      background = "Normal",
    }
  }
})

local term_counter = 0;
-- Helper function to create new terminal
local function create_terminal(cwd)
  local Terminal = require('toggleterm.terminal').Terminal
  term_counter = (term_counter + 1) % 99

  local term = Terminal:new({
    count = term_counter,
    dir = cwd,
    display_name = "Terminal " .. term_counter .. (cwd and " (" .. vim.fn.fnamemodify(cwd, ":t") .. ")" or ""),
  })

  return term
end

-- Helper function to get current buffer directory
local function get_buffer_cwd()
  if utils.check_buffer_is_a_file() then
    return vim.fn.expand('%:p:h')
  end
  return nil
end

-- Commands definition
local commands = {
  root = 'New Root Directory Terminal',
  buffer = 'New Buffer Directory Terminal',
  list = 'List Existing Terminals',
  opencode = 'New Opencode Instance',
  quitall = 'Exit all Terminals'
}

-- Function to show existing terminals
local function show_terminal_list()
  local Snacks = require("snacks")
  local terminals = terms.get_all(true)
  if #terminals == 0 then
    vim.notify("没有可用终端", vim.log.levels.INFO)
    return
  end

  local items = {}
  for _, term in ipairs(terminals) do
    table.insert(items, {
      label = (term.display_name or ("Terminal " .. term.count)),
      value = term,
    })
  end

  Snacks.picker.pick({
    title = "终端列表",
    items = items,
    refresh = true,
    multi = false,
    layout = {
      preset = "select",
      preview = false,
    },
    actions = {
      open_terminal = function(picker, item)
        local term = item.value;
        picker:close()
        if term:is_open() then
          term:focus()
        else
          term:open()
        end
      end,
      close_terminal = function(picker, item)
        item.value:shutdown()
        table.remove(items, item.idx)
        if #items == 0 then
          picker:close()
          vim.schedule(function()
            vim.notify("所有终端已销毁", vim.log.levels.INFO)
          end)
        else
          picker:find()
        end
      end,
    },
    win = {
      input = {
        keys = {
          ['<cr>'] = { 'open_terminal', mode = { "n", "i" }, desc = "打开终端" },
          ["<c-x>"] = { "close_terminal", mode = { "n", "i" }, desc = "关闭终端" },
        },
      },
    },
    format_item = function(item)
      return item.label
    end,
  })
end

-- Quit all existing terminals
local function quitAll(terminals)
  for i in pairs(terminals) do
    terminals[i]:shutdown();
  end
  vim.notify("All terminial removed.", vim.log.levels.INFO)
end


-- Main terminal selection menu
local function show_terminal_menu()
  local terminals = terms.get_all(true)
  local choices = {}

  if #terminals ~= 0 then
    table.insert(choices, commands.list)
  end

  -- Always show root option
  table.insert(choices, commands.root)

  -- Show buffer option only if we're in a file buffer
  if utils.check_buffer_is_a_file() then
    table.insert(choices, commands.buffer)
  end
  -- add opencode when opencode exists in system
  if vim.fn.executable("opencode") == 1 then
    table.insert(choices, commands.opencode)
  end

  table.insert(choices, commands.quitall);

  vim.ui.select(choices, {
    prompt = 'Terminal Options:',
  }, function(choice)
    if choice == commands.root then
      local term = create_terminal(vim.fn.getcwd())
      term:toggle()
    elseif choice == commands.buffer then
      local buffer_cwd = get_buffer_cwd()
      local term = create_terminal(buffer_cwd)
      term:toggle()
    elseif choice == commands.list then
      show_terminal_list()
    elseif choice == commands.opencode then
      local Terminal = require('toggleterm.terminal').Terminal
      term_counter = (term_counter + 1) % 99
      local opencode_term = Terminal:new({
        count = term_counter,
        cmd = "opencode",
        direction = "vertical",
        display_name = "Opencode",
      })
      opencode_term:toggle()
    elseif choice == commands.quitall then
      quitAll(terminals)
    end
  end)
end


-- Function to rename current terminal with better UX
local function rename_current_terminal()
  local current_term = require('toggleterm.terminal').find(function(term)
    return term:is_focused();
  end)
  if not current_term then
    vim.notify("No active terminal to rename", vim.log.levels.WARN)
    return
  end

  -- Step 1: Close the terminal
  current_term:toggle()

  -- Step 2: Show snacks input for rename
  local current_name = current_term.display_name or ("Terminal " .. current_term.name)

  require("snacks").input({
    prompt = "Rename terminal:",
    value = current_name,
  }, function(new_name)
    if new_name and new_name:match("^%s*(.-)%s*$") ~= "" then
      -- Step 3a: User confirmed - apply new name and restore terminal
      new_name = new_name:match("^%s*(.-)%s*$") -- trim whitespace
      vim.cmd(current_term.count .. "ToggleTermSetName " .. vim.fn.shellescape(new_name))
      current_term:toggle()                     -- restore terminal
      vim.notify("Terminal renamed to: " .. new_name, vim.log.levels.INFO)
    else
      -- Step 3b: User cancelled or empty input - just restore terminal
      current_term:toggle()
    end
  end)
end

-- Key mappings
vim.keymap.set({ 'n', 't' }, '<A-t>', show_terminal_menu, { desc = 'Open terminal menu' })

-- Terminal mode key mappings
vim.keymap.set('t', '<f12>', function()
  vim.cmd('ToggleTermToggleAll')
end, { desc = 'Hide current terminal' })

-- Terminal rename key mapping with better UX
vim.keymap.set('t', '<F2>', rename_current_terminal, { desc = 'Rename current terminal' })

-- Function to destroy current terminal if filetype is toggleterm
local function destroy_current_terminal()
  local bufnr = vim.api.nvim_get_current_buf()
  local ft = vim.api.nvim_buf_get_option(bufnr, 'filetype')
  if ft == 'toggleterm' then
    local current_term = require('toggleterm.terminal').find(function(term)
      return term:is_focused();
    end)
    if current_term then
      current_term:shutdown()
      vim.notify("Terminal destroyed", vim.log.levels.INFO)
    else
      vim.notify("No terminal found to destroy", vim.log.levels.WARN)
    end
  end
end

-- Alt+F12 key mapping to destroy current terminal
vim.keymap.set({ 't' }, '<leader><F12>', destroy_current_terminal,
  { desc = 'Destroy current terminal if filetype is toggleterm' })

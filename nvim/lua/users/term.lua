local utils = require('users.lib.utils')

--- Terminal display names (for winbar)
--- keyed by snacks.win id
local term_names = {}

--- Get the display name for a terminal
---@param term snacks.win
---@return string
local function get_term_name(term)
  return term_names[term.id] or ("Terminal " .. term.id)
end

--- Set the display name for a terminal
---@param term snacks.win
---@param name string
local function set_term_name(term, name)
  term_names[term.id] = name
end

--- Create a new terminal
---@param cwd? string
---@param position? "float"|"bottom"|"top"|"left"|"right"
---@return snacks.win
local function create_terminal(cwd, position)
  position = position or "float"
  local opts = {
    cwd = cwd,
    interactive = true,
    win = {
      position = position,
      style = {},
      border = position == "float" and "rounded" or "none",
      wo = {
        winbar = "",
      },
    },
  }

  if position == "float" then
    opts.win.width = math.floor(vim.o.columns * 0.9)
    opts.win.height = math.floor(vim.o.lines * 0.9)
    opts.win.backdrop = 60
  elseif position == "horizontal" or position == "bottom" then
    opts.win.height = 20
  elseif position == "vertical" or position == "left" or position == "right" then
    opts.win.width = math.floor(vim.o.columns * 0.5)
  end

  local term = Snacks.terminal.open(nil, opts)
  local name = "Terminal " .. term.id .. (cwd and " (" .. vim.fn.fnamemodify(cwd, ":t") .. ")" or "")
  set_term_name(term, name)
  if term:win_valid() then
    if position == "float" then
      term:set_title(" " .. name .. " ", "center")
    else
      vim.wo[term.win].winbar = " " .. name .. " "
    end
  end
  return term
end

--- Helper function to get current buffer directory
local function get_buffer_cwd()
  if utils.check_buffer_is_a_file() then
    return vim.fn.expand('%:p:h')
  end
  return nil
end

--- Commands definition
local commands = {
  root = 'New Root Directory Terminal',
  root_split = 'New Root Directory Terminal(split)',
  buffer = 'New Buffer Directory Terminal',
  buffer_split = 'New Buffer Directory Terminal(split)',
  list = 'List Existing Terminals',
  quitall = 'Exit all Terminals'
}

--- Function to show existing terminals
local function show_terminal_list()
  local all = Snacks.terminal.list()
  if #all == 0 then
    vim.notify("没有可用终端", vim.log.levels.INFO)
    return
  end

  local items = {}
  for _, term in ipairs(all) do
    if not utils.is_pi_terminal(term) then
      local name = get_term_name(term)
      table.insert(items, {
        text = name,
        label = name,
        value = term,
      })
    end
  end

  if #items == 0 then
    vim.notify("没有可用终端（所有终端都是 Pi）", vim.log.levels.INFO)
    return
  end

  Snacks.picker.pick({
    title = "终端列表  (<c-r>rename  <c-t>new)",
    items = items,
    refresh = true,
    multi = false,
    layout = {
      preset = "default",
    },
    actions = {
      open_terminal = function(picker, item)
        local term = item.value
        picker:close()
        if term:valid() then
          term:focus()
        else
          term:show()
        end
      end,
      close_terminal = function(picker, item)
        local term = item.value
        term:close()
        term_names[term.id] = nil
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
      rename_terminal = function(picker, item)
        local term = item.value
        picker:close()
        local current = get_term_name(term)
        vim.ui.input({ prompt = "Rename terminal: ", default = current }, function(input)
          if input and input ~= "" then
            set_term_name(term, input)
            if term:win_valid() then
              if term.win_opts and term.win_opts.position == "float" then
                term:set_title(" " .. input .. " ", "center")
              else
                vim.wo[term.win].winbar = " " .. input .. " "
              end
            end
            vim.notify('Terminal renamed to "' .. input .. '"', vim.log.levels.INFO)
          else
            vim.notify("Rename cancelled", vim.log.levels.INFO)
          end
        end)
      end,
      new_terminal = function(picker, _item)
        picker:close()
        create_terminal(vim.fn.getcwd(), "float")
      end,
    },
    win = {
      input = {
        keys = {
          ['<cr>'] = { 'open_terminal', mode = { "n", "i" }, desc = "打开终端" },
          ["<c-x>"] = { "close_terminal", mode = { "n", "i" }, desc = "删除终端" },
          ["<c-r>"] = { "rename_terminal", mode = { "n", "i" }, desc = "重命名终端" },
          ["<c-t>"] = { "new_terminal", mode = { "n", "i" }, desc = "新建终端" },
        },
      },
    },
    preview = function(ctx)
      local term = ctx.item.value
      local buf = term.buf

      if not buf or not vim.api.nvim_buf_is_valid(buf) then
        ctx.preview:set_lines({ "[Terminal buffer no longer exists]" })
        return true
      end

      local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)

      -- Trim to last N lines for preview
      local max_lines = 100
      if #lines > max_lines then
        lines = vim.list_slice(lines, #lines - max_lines + 1, #lines)
      end

      ctx.preview:set_lines(lines)
      ctx.preview.win:set_title(" " .. ctx.item.label .. " ", "center")
      return true
    end,
    format_item = function(item)
      return item.label
    end,
  })
end

--- Quit all existing terminals
local function quitAll()
  local all = Snacks.terminal.list()
  for _, term in ipairs(all) do
    if not utils.is_pi_terminal(term) then
      term:close()
      term_names[term.id] = nil
    end
  end
  vim.notify("All terminals removed.", vim.log.levels.INFO)
end

--- Main terminal selection menu
local function show_terminal_menu()
  utils.hide_all_floats_in_current_tab()
  local all = Snacks.terminal.list()
  local choices = {}
  local position = 'float'

  -- Filter out Pi terminals for the list
  local non_pi = {}
  for _, term in ipairs(all) do
    if not utils.is_pi_terminal(term) then
      table.insert(non_pi, term)
    end
  end

  if #non_pi ~= 0 then
    table.insert(choices, commands.list)
  end

  -- Always show root option
  table.insert(choices, commands.root)
  table.insert(choices, commands.root_split)

  -- Show buffer option only if we're in a file buffer
  if utils.check_buffer_is_a_file() then
    table.insert(choices, commands.buffer)
    table.insert(choices, commands.buffer_split)
  end

  table.insert(choices, commands.quitall)

  vim.ui.select(choices, {
    prompt = 'Terminal Options:',
  }, function(choice)
    if vim.list_contains({ commands.root, commands.root_split }, choice) then
      local pos = choice == commands.root_split and "right" or "float"
      create_terminal(vim.fn.getcwd(), pos)
    elseif vim.list_contains({ commands.buffer, commands.buffer_split }, choice) then
      local pos = choice == commands.buffer_split and "right" or "float"
      local buffer_cwd = get_buffer_cwd()
      create_terminal(buffer_cwd, pos)
    elseif choice == commands.list then
      show_terminal_list()
    elseif choice == commands.quitall then
      quitAll()
    end
  end)
end

-- Key mappings
vim.keymap.set({ 'n', 't' }, '<A-t>', show_terminal_menu, { desc = 'Open terminal menu' })

-- Function to destroy current terminal if filetype is snacks_terminal
local function destroy_current_terminal()
  local bufnr = vim.api.nvim_get_current_buf()
  local ft = vim.api.nvim_buf_get_option(bufnr, 'filetype')
  if ft == 'snacks_terminal' then
    local all = Snacks.terminal.list()
    for _, term in ipairs(all) do
      if term.buf == bufnr then
        term:close()
        term_names[term.id] = nil
        vim.notify("Terminal destroyed", vim.log.levels.INFO)
        return
      end
    end
    vim.notify("No terminal found to destroy", vim.log.levels.WARN)
  end
end

return {
  show_terminal_menu = show_terminal_menu,
}

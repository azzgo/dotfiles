local utils = require('users.lib.utils')

local M = {}

--- Track the last toggled Pi terminal id for toggle resolution
local last_pi_id = nil

--- Counter for unique Pi terminal IDs (ensures each Pi gets a unique tid in Snacks.terminal)
local pi_counter = 0

--- Find a Pi terminal by predicate
---@param predicate fun(term): boolean
---@return snacks.win|nil
local function find_pi(predicate)
  local all = Snacks.terminal.list()
  for _, term in ipairs(all) do
    if utils.is_pi_terminal(term) and predicate(term) then
      return term
    end
  end
  return nil
end

--- Create a new Pi terminal
---@return snacks.win|nil
function M.new()
  if vim.fn.executable("pi") == 0 then
    vim.notify("pi binary not found in PATH", vim.log.levels.WARN)
    return nil
  end

  pi_counter = pi_counter + 1
  local name = utils.next_pi_name()
  local dir = vim.fn.getcwd()

  local term = Snacks.terminal.open({ "pi" }, {
    cwd = dir,
    count = pi_counter,
    auto_close = false,
    interactive = true,
    win = {
      position = "float",
      style = "terminal",
      border = "rounded",
      title = " " .. name .. " ",
      title_pos = "center",
      backdrop = 60,
      width = math.floor(vim.o.columns * 0.9),
      height = math.floor(vim.o.lines * 0.9),
      wo = {
        winbar = "",
      },
    },
  })

  vim.b[term.buf].pi_name = name
  last_pi_id = term.id
  return term
end

--- Toggle the last opened Pi terminal.
--- If last_pi is alive, toggle it (show if hidden, hide if visible).
--- If no last_pi, hide any visible Pi, or create a new one.
function M.toggle()
  -- 1. last_pi still alive?
  if last_pi_id then
    local all = Snacks.terminal.list()
    for _, term in ipairs(all) do
      if term.id == last_pi_id then
        term:toggle()
        return
      end
    end
  end
  last_pi_id = nil

  -- 2. any visible Pi? hide it
  local visible = find_pi(function(term) return term:valid() end)
  if visible then
    last_pi_id = visible.id
    visible:toggle()
    return
  end

  -- 3. none → create new
  M.new()
end

--- Ensure a Pi terminal is open and return it, creating one if needed.
---@return snacks.win|nil
local function ensure_pi_open()
  -- Try existing: focused > visible > last tracked
  local term = find_pi(function(t)
    return t:win_valid() and vim.api.nvim_get_current_win() == t.win
  end) or find_pi(function(t)
    return t:valid()
  end) or (last_pi_id and (function()
    local all = Snacks.terminal.list()
    for _, t in ipairs(all) do
      if t.id == last_pi_id then return t end
    end
    return nil
  end)() or nil)

  if term then
    if not term:valid() then
      term:show()
    end
    last_pi_id = term.id
    term:focus()
    return term
  end

  -- None exists — create and open
  term = M.new()
  if term then
    last_pi_id = term.id
    return term
  end
  return nil
end

--- Get relative path from cwd for the current buffer
---@return string|nil
local function get_relative_path()
  local bufname = vim.api.nvim_buf_get_name(0)
  if bufname == "" then return nil end
  local rel = vim.fn.fnamemodify(bufname, ":.")
  return rel
end

--- Send file path reference to Pi (@path)
function M.send_file()
  local rel = get_relative_path()
  if not rel then
    vim.notify("Buffer has no file path", vim.log.levels.WARN)
    return
  end

  local term = ensure_pi_open()
  if not term then return end

  local channel = vim.bo[term.buf].channel
  if channel and channel > 0 then
    vim.fn.chansend(channel, "@" .. rel)
  end
end

--- Send location reference to Pi (@path L22 - L33)
function M.send_selection()
  local rel = get_relative_path()
  if not rel then
    vim.notify("Buffer has no file path", vim.log.levels.WARN)
    return
  end

  -- Get visual selection line range (marks persist after <Esc>)
  local start_line = vim.fn.line("'<")
  local end_line = vim.fn.line("'>")
  local msg
  if start_line > 0 and end_line > 0 then
    if start_line == end_line then
      msg = "@" .. rel .. " L" .. start_line
    else
      msg = "@" .. rel .. " L" .. start_line .. " - L" .. end_line
    end
  else
    msg = "@" .. rel .. " L" .. vim.fn.line(".")
  end

  local term = ensure_pi_open()
  if not term then return end

  local channel = vim.bo[term.buf].channel
  if channel and channel > 0 then
    vim.fn.chansend(channel, msg)
  end
end

--- List Pi terminals in a picker
function M.list()
  local all = Snacks.terminal.list()
  local pi_terms = {}
  for _, term in ipairs(all) do
    if utils.is_pi_terminal(term) then
      table.insert(pi_terms, term)
    end
  end

  if #pi_terms == 0 then
    vim.notify("No Pi terminals", vim.log.levels.INFO)
    return
  end

  local items = {}
  for _, term in ipairs(pi_terms) do
    local name = vim.b[term.buf].pi_name or ("Pi " .. term.id)
    table.insert(items, {
      label = name,
      value = term,
    })
  end

  Snacks.picker.pick({
    title = "Pi Terminals",
    items = items,
    refresh = true,
    multi = false,
    layout = {
      preset = "select",
      preview = false,
    },
    actions = {
      open_terminal = function(picker, item)
        local term = item.value
        picker:close()
        last_pi_id = term.id
        if term:valid() then
          term:focus()
        else
          term:show()
        end
      end,
      close_terminal = function(picker, item)
        local term = item.value
        term:close()
        table.remove(items, item.idx)
        if #items == 0 then
          picker:close()
          vim.schedule(function()
            vim.notify("All Pi terminals closed", vim.log.levels.INFO)
          end)
        else
          picker:find()
        end
      end,
    },
    win = {
      input = {
        keys = {
          ['<cr>'] = { 'open_terminal', mode = { "n", "i" }, desc = "Open terminal" },
          ["<c-x>"] = { "close_terminal", mode = { "n", "i" }, desc = "Close terminal" },
        },
      },
    },
    format_item = function(item)
      return item.label
    end,
  })
end

--- Helper: create new Pi and toggle it (for menu use)
function M.new_and_toggle()
  local term = M.new()
  if term then
    last_pi_id = term.id
  end
end

--- Menu items definition
local menu_items = {
  { label = "Toggle Pi",      action = M.toggle },
  { label = "List Pi",        action = M.list },
  { label = "Send @this",     action = M.send_selection },
  { label = "Send @file",     action = M.send_file },
  { label = "New Pi",         action = M.new_and_toggle },
}

--- Show the Pi actions menu (<A-i>)
function M.show_actions_menu()
  -- Capture the currently focused/visible Pi terminal BEFORE hiding floats,
  -- so toggle/send actions can still find it after the menu hides everything.
  local focused = find_pi(function(term)
    return term:win_valid() and vim.api.nvim_get_current_win() == term.win
  end)
  local visible = focused or find_pi(function(term) return term:valid() end)
  if visible then
    last_pi_id = visible.id
  end

  utils.hide_all_floats_in_current_tab()

  local labels = {}
  for _, item in ipairs(menu_items) do
    table.insert(labels, item.label)
  end
  local preserve = utils.preserve_mode_for_selection()
  vim.ui.select(labels, { prompt = "Pi Actions" }, function(choice)
    preserve()
    for _, item in ipairs(menu_items) do
      if item.label == choice then
        item.action()
        break
      end
    end
  end)
end

-- Register keymap
vim.keymap.set({ "n", "t", "x" }, "<A-i>", M.show_actions_menu, { desc = "Pi actions menu" })

return M

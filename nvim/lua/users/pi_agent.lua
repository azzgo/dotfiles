local utils = require('users.lib.utils')

local M = {}

--- Track the last toggled Pi terminal id for toggle resolution
local last_pi_id = nil

--- Resume a Pi terminal by sending SIGCONT (harmless if already running).
--- Fixes the Ctrl+Z suspend issue: when you press Ctrl+Z inside the Pi terminal,
--- the pi process gets SIGTSTP and stops responding. This sends SIGCONT to wake it up.
---@param term snacks.win
local function resume_pi(term)
  if not term or not term.buf then return end
  local channel = vim.bo[term.buf].channel
  if not channel or channel <= 0 then return end
  local pid = vim.fn.jobpid(channel)
  if not pid or pid <= 0 then return end
  vim.fn.system("kill -CONT " .. pid)
end

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
        resume_pi(term)
        term:toggle()
        return
      end
    end
  end
  last_pi_id = nil

  -- 2. any visible Pi? hide it
  local visible = find_pi(function(term) return term:valid() end)
  if visible then
    resume_pi(visible)
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
    resume_pi(term)
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
      text = name,
      label = name,
      value = term.id,
    })
  end

  Snacks.picker.pick({
    title = "Pi Terminals  (<c-r>rename  <c-n>new)",
    items = items,
    refresh = true,
    multi = false,
    layout = {
      preset = "default",
    },
    actions = {
      open_terminal = function(picker, item)
        local term = find_pi(function(t) return t.id == item.value end)
        picker:close()
        if term then
          resume_pi(term)
          last_pi_id = term.id
          if term:valid() then
            term:focus()
          else
            term:show()
          end
        end
      end,
      close_terminal = function(picker, item)
        local term = find_pi(function(t) return t.id == item.value end)
        if term then
          term:close()
        end
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
      rename_terminal = function(picker, item)
        local term = find_pi(function(t) return t.id == item.value end)
        if not term then return end
        picker:close()
        local current = vim.b[term.buf].pi_name or ""
        vim.ui.input({ prompt = "Rename Pi terminal: ", default = current }, function(input)
          if input and input ~= "" then
            vim.b[term.buf].pi_name = input
            if term:win_valid() then
              term:set_title(" " .. input .. " ", "center")
            end
            vim.notify('Pi terminal renamed to "' .. input .. '"', vim.log.levels.INFO)
          else
            vim.notify("Rename cancelled", vim.log.levels.INFO)
          end
        end)
      end,
      new_terminal = function(picker, _item)
        picker:close()
        M.new()
      end,
    },
    win = {
      input = {
        keys = {
          ['<cr>'] = { 'open_terminal', mode = { "n", "i" }, desc = "Open terminal" },
          ["<c-x>"] = { "close_terminal", mode = { "n", "i" }, desc = "Close terminal" },
          ["<c-r>"] = { "rename_terminal", mode = { "n", "i" }, desc = "Rename terminal" },
          ["<c-n>"] = { "new_terminal", mode = { "n", "i" }, desc = "New Pi terminal" },
        },
      },
    },
    preview = function(ctx)
      local term_id = ctx.item.value
      local term = find_pi(function(t) return t.id == term_id end)
      if not term then
        ctx.preview:set_lines({ "[Pi terminal no longer exists]" })
        return true
      end

      local buf = term.buf
      if not buf or not vim.api.nvim_buf_is_valid(buf) then
        ctx.preview:set_lines({ "[Pi terminal buffer no longer exists]" })
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

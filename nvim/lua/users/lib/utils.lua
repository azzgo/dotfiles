local M = {}

--- @param name string
--- @return boolean
function M.executable(name)
  if vim.fn.executable(name) > 0 then
    return true
  end

  return false
end

---comment
---@param ... table
---@return table
function M.merge_list(...)
  local result = {}
  for _, t in ipairs({ ... }) do
    for _, v in pairs(t) do
      table.insert(result, v)
    end
  end
  return result
end

function M.copy_to_clipboard(text)
  vim.fn.setreg('+', text)
  vim.fn.setreg('*', text)
  vim.fn.setreg('"', text)
end

function M.get_selected_text(only_first_line)
  if vim.fn.mode() == "v" or vim.fn.mode() == "V" then
    vim.cmd([[execute "normal! \<ESC>"]])
  end
  local start_pos = vim.fn.getpos("'<")
  local end_pos = vim.fn.getpos("'>")
  local start_line, start_col = start_pos[2], start_pos[3]
  local end_line, end_col = end_pos[2], end_pos[3]

  local lines = vim.fn.getline(start_line, end_line)
  if #lines == 0 then return "" end

  if #lines == 1 then
    lines[1] = string.sub(lines[1], start_col, end_col)
  else
    lines[1] = string.sub(lines[1], start_col)
    lines[#lines] = string.sub(lines[#lines], 1, end_col)
  end
  local text = only_first_line == true and lines[1] or table.concat(lines, '\n')

  return text, function(new_text)
    M.copy_to_clipboard(new_text)
  end
end

function M.to_camel_case(str)
  str = vim.trim(str)
  return str:gsub("-(%a)", string.upper):gsub("_(%a)", string.upper):gsub("^%l", string.upper)
end

function M.to_kabab_case(str)
  str = vim.trim(str)
  return str:gsub("%u", "-%1"):gsub("^-", ""):gsub("_", "-"):lower()
end

function M.to_snack_case(str)
  str = vim.trim(str)
  return str:gsub("%u", "_%1"):gsub("^_", ""):gsub("-", "_"):lower()
end

function M.get_current_line()
  return vim.fn.getline('.')
end

function M.path_shorten(path, max_length)
  return string.len(path) > max_length and vim.fn.pathshorten(path) or path
end

local comment_ft_ok, comment_ft = pcall(require, 'Comment.ft')
local comment_utils_ok, comment_utils = pcall(require, 'Comment.utils')

--- Get the comment string {beg,end} table
---@param ctype integer 1 for `line`-comment and 2 for `block`-comment
---@return table comment_strings {begcstring, endcstring}
function M.get_cstring(ctype)
  if not comment_ft_ok or not comment_utils_ok then
    return { '', '' }
  end
  local calculate_comment_string = comment_ft.calculate
  local utils = comment_utils
  -- use the `Comments.nvim` API to fetch the comment string for the region (eq. '--%s' or '--[[%s]]' for `lua`)
  local cstring = calculate_comment_string { ctype = ctype, range = utils.get_region() } or vim.bo.commentstring
  -- as we want only the strings themselves and not strings ready for using `format` we want to split the left and right side
  local left, right = utils.unwrap_cstr(cstring)
  -- create a `{left, right}` table for it
  return { left, right }
end

function M.check_buffer_is_a_file(bufnr)
  if not bufnr then
    bufnr = vim.api.nvim_get_current_buf()
  end
  local bufname = vim.api.nvim_buf_get_name(bufnr)
  local is_file = vim.fn.filereadable(bufname) == 1
  return is_file
end

function M.make_sure_dir(dir)
  if vim.fn.isdirectory(dir) == 0 then
    vim.fn.mkdir(dir, "p")
  end
end

function M.get_buffer_shortened_path(max_length)
  local fname = vim.fn.expand('%:t')
  if fname == "" then
    return "untitled"
  end
  local maxlen = max_length or 20
  if #fname > maxlen then
    return fname:sub(1, maxlen) .. "..."
  else
    return fname
  end
end

function M.get_python_cmd()
  local python_cmd = vim.fn.exepath("python3")
  if python_cmd == "" then
    python_cmd = vim.fn.exepath("python")
  end
  return python_cmd
end

function M.get_node_cmd()
  local node_cmd = vim.fn.exepath("node")
  return node_cmd
end

function M.run_code_with_cmd(cmd, content, file_ext)
  if cmd == "" then
    vim.notify("Executable not found. Please install the required runtime.", vim.log.levels.ERROR)
    return
  end

  if content == "" then
    return
  end

  local temp_file = vim.fn.tempname() .. "." .. file_ext
  local file = io.open(temp_file, "w")
  if not file then
    vim.notify("Failed to create temporary file", vim.log.levels.ERROR)
    return
  end

  file:write(content)
  file:close()

  local result = ''
  local error = ''

  vim.fn.jobstart(cmd .. " " .. temp_file, {
    on_stdout = function(_, data)
      if data and #data > 0 then
        result = result .. table.concat(data, "\n")
      end
    end,
    on_stderr = function(_, data)
      if data and #data > 0 then
        error = error .. table.concat(data, "\n")
      end
    end,
    on_exit = function(_, code)
      vim.fn.delete(temp_file)
      if code == 0 then
        if result ~= "" then
          vim.notify(vim.fn.trim(result), vim.log.levels.INFO)
        end
      else
        vim.notify("Error: " .. vim.fn.trim(error), vim.log.levels.ERROR)
      end
    end,
  })
end

return M

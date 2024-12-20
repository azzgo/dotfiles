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
  for _, t in ipairs({...}) do
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

function M.convertKababCaseToCamelCase(str)
  return str:gsub("-(%a)", string.upper):gsub("^%l", string.upper)
end

function M.convertCamelCaseToKababCase(str)
  return str:gsub("%u", "-%1"):gsub("^-", ""):lower()
end

function M.get_current_line()
  return vim.fn.getline('.')
end

function M.path_shorten(path, max_length)
  return string.len(path) > max_length and vim.fn.pathshorten(path) or path
end

return M

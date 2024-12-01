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

return M

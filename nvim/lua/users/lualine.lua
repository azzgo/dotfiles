local ok, lualine = pcall(require, "lualine")
local utils       = require("users.lib.utils")

if not ok then
  return
end

local function ai_statusline()
  local ok_status, status = pcall(require, "sidekick.status")
  if not ok_status then
    return ""
  end
  local cli = status.cli()
  if #cli > 0 then
    return " " .. (#cli > 1 and #cli or "")
  end
  local copilot = status.get()
  if copilot then
    return " "
  end
  return ""
end

function BufPath()
  local bufPath = vim.fn.expand('%f')
  local relativePath = vim.fn.fnamemodify(bufPath, ':.')
  return utils.path_shorten(relativePath, 100)
end

lualine.setup({
  sections = {
    lualine_b = { 'branch' },
    lualine_c = { BufPath },
    lualine_x = { ai_statusline, 'searchcount', 'encoding', 'fileformat', 'filetype' },
  },
  options = { theme = "auto", section_separators = "", component_separators = "" },
  extensions = { 'oil' },
})

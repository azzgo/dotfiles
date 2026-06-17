local ok, lualine = pcall(require, "lualine")
local utils       = require("users.lib.utils")

if not ok then
  return
end

local function ai_statusline()
  local utils = require('users.lib.utils')
  local ok, snacks = pcall(require, "snacks")
  if not ok then
    return ""
  end
  local all = snacks.terminal.list()
  local pi_count = 0
  for _, term in ipairs(all) do
    if utils.is_pi_terminal(term) then
      pi_count = pi_count + 1
    end
  end
  if pi_count > 0 then
    return " " .. (pi_count > 1 and pi_count or "")
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

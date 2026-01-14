local ok, lualine = pcall(require, "lualine")
local utils       = require("users.lib.utils")

if not ok then
  return
end

local codecompompanion = require('users.lib.lualine-codecompanion')
local opencode = require("opencode").statusline

function BufPath()
  local bufPath = vim.fn.expand('%f')
  local relativePath = vim.fn.fnamemodify(bufPath, ':.')
  return utils.path_shorten(relativePath, 100)
end

lualine.setup({
  sections = {
    lualine_b = { 'branch' },
    lualine_c = { BufPath },
    lualine_x = { opencode,codecompompanion, 'searchcount', 'encoding', 'fileformat', 'filetype' },
  },
  options = { theme = "auto", section_separators = "", component_separators = "" },
  extensions = { 'oil' },
})

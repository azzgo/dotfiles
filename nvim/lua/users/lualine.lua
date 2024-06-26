local ok, lualine = pcall(require, "lualine")

if not ok then
  return
end

function BufPath()
  local bufPath = vim.fn.expand('%f')
  local relativePath = vim.fn.fnamemodify(bufPath, ':.')
  return string.len(relativePath) > 100 and vim.fn.pathshorten(relativePath) or relativePath
end

lualine.setup({
  sections = {
    lualine_b = { 'g:coc_status' },
    lualine_c = { BufPath },
    lualine_x = { 'tabnine' }
  },
  options = { theme = "auto", section_separators = "", component_separators = "" },
  extensions = { 'oil' },
})

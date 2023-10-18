local ok, lualine = pcall(require, "lualine")

if not ok then
	return
end

function BufPath()
  local bufPath = vim.fn.expand('%f')
  return string.len(bufPath) > 100 and vim.fn.pathshorten(bufPath) or bufPath
end

lualine.setup({
	sections = {
    lualine_b = {},
		lualine_c = {
      BufPath
    },
    lualine_x = {'tabnine'}
	},
  options = { theme = "auto", section_separators = "", component_separators = "" }
})

local ok, lualine = pcall(require, "lualine")

if not ok then
	return
end

lualine.setup({
	options = { theme = "auto" },
	sections = {
		lualine_b = {},
	},
  options = { section_separators = "", component_separators = "" }
})

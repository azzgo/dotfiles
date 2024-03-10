local ok, tabline = pcall(require, "tabby.tabline")

if not ok then
  return
end

vim.o.showtabline = 2

local theme = {
	fill = "TabLineFill",
	-- Also you can do this: fill = { fg='#f2e9de', bg='#907aa9', style='italic' }
	head = "TabLine",
	current_tab = "TabLineSel",
	tab = "TabLine",
	win = "TabLine",
	tail = "TabLine",
}

tabline.set(function(line)
	return {
    {
      {
        line.sep(" ", theme.head, theme.tab),
        vim.fn.fnamemodify(vim.fn.getcwd(), ':t'),
        line.sep(" ", theme.head, theme.tab),
        hl = theme.fill,
      },
      line.tabs().foreach(function(tab)
        local hl = tab.is_current() and theme.current_tab or theme.tab
        return {
          line.sep("", hl, theme.fill),
          tab.is_current() and "" or "",
          line.sep("", hl, theme.fill),
          tab.number(),
          tab.name(),
          line.sep("", hl, theme.fill),
          hl = hl,
          margin = " ",
        }
      end),
    },
		line.spacer(),
		hl = theme.fill,
	}
end)

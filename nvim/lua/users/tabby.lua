local ok, tabline = pcall(require, "tabby.tabline")

if not ok then
  return
end

vim.o.showtabline = 2

local modified_symbol = "~"

local function tab_modified(tab)
  local wins = require("tabby.module.api").get_tab_wins(tab)
  for _, x in pairs(wins) do
    if vim.bo[vim.api.nvim_win_get_buf(x)].modified then
      return modified_symbol
    end
  end
  return ""
end

local theme = {
  fill = "TabLineFill",
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
          tab.is_current() and "" or "",
          line.sep("", hl, theme.fill),
          tab.number(),
          tab.name(),
          tab_modified(tab.id),
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

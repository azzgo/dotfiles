local luasnip_ok, ls = pcall(require, "luasnip")
local utils = require('users.lib.utils')
local M = {}

function M.buffer_delete_others()
  local filter = function(b)
    return b ~= vim.api.nvim_get_current_buf()
  end
  for _, b in ipairs(vim.tbl_filter(filter, vim.api.nvim_list_bufs())) do
    if vim.bo[b].buflisted then
      vim.api.nvim_buf_delete(b, { force = true })
    end
  end
end

function M.list_snippets()
  if luasnip_ok == false then
    print("luasnip is not installed")
    return
  end
  -- list all snippets
  local snippets = {}
  local snippetMap = {}
  for _, snippet in ipairs(ls.get_snippets(vim.bo.filetype)) do
    local action = '[' .. snippet.name .. '] trigger by: ' .. snippet.trigger
    table.insert(snippets, action)
    snippetMap[action] = snippet
  end
  -- append common for all filetype snippets
  for _, snippet in ipairs(ls.get_snippets('all')) do
    local action = '[' .. snippet.name .. '] trigger by: ' .. snippet.trigger
    table.insert(snippets, action)
    snippetMap[action] = snippet
  end
  vim.ui.select(snippets, {
    prompt = 'luasnip',
  }, function(action)
    ls.snip_expand(snippetMap[action])
  end
  )
end

return M

local luasnip_ok, ls = pcall(require, "luasnip")
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
    if snippetMap[action] == nil then
      return
    end
    ls.snip_expand(snippetMap[action])
  end
  )
end

function M.assemble_harsoon_files()
  local harpoon_ok, harpoon = pcall(require, "harpoon")
  if not harpoon_ok then
    return {}
  end
  local harpoon_files = harpoon:list()
  local source = {}
  local length = harpoon_files._length;
  for i = 1, length do
    local item = harpoon_files.items[i]
    if item ~= nil then
      table.insert(source, {
        pos = { item.context.row, item.context.col },
        file = item.value,
        text = item.value,
      })
    end
  end
  return source
end

return M

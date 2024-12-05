local ok, ls = pcall(require, "luasnip")

if not ok then
  return
end


-- define vim function coc#source#luasnip#init(), like this:
--   return {
--     \ 'priority': 9,
--     \ 'shortcut': 'Email',
--     \ 'triggerCharacters': ['@']
--     \}
-- endfunction
function _G.coc_source_luasnip_init()
  return {
    shortcut = 'luasnip',
    isSnippet = true,
  }
end

-- define vim function coc#source#luasnip#complete(option, cb), like this
-- function! coc#source#email#complete(option, cb) abort
--   let items = ['foo@gmail.com', 'bar@yahoo.com']
--   call a:cb(items)
-- endfunction
function _G.coc_source_luasnip_complete(option)
  local snippets = ls.get_snippets(option.filetype)
  local items = {}
  for _, snippet in ipairs(ls.get_snippets('all')) do
    table.insert(items, {
      word = snippet.trigger,
      kind = 'Snippet',
      user_data = snippet.id,
      info = string.format('[%s]\n%s', snippet.name, table.concat(snippet:get_docstring(), "\n")),
    })
  end
  for _, snippet in ipairs(snippets) do
    table.insert(items, {
      word = snippet.trigger,
      kind = 'Snippet',
      user_data = snippet.id,
      info = string.format('[%s]\n%s', snippet.name, table.concat(snippet:get_docstring(), "\n")),
    })
  end
  return items
end

-- define vim function coc#source#{name}#on_complete(items), like this:
-- function! coc#source#email#on_complete(item) abort
function _G.coc_source_luasnip_on_complete(item)
  ls.expand()
  -- ls.snip_expand(ls.get_id_snippet(item.user_data))
end

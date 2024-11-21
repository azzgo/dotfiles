local persistence_ok, persistence = pcall(require, "persistence")
local luasnip_ok, ls = pcall(require, "luasnip")
local todo_ok = pcall(require, "todo-comments")


local function buffer_delete_others()
  local filter = function(b)
    return b ~= vim.api.nvim_get_current_buf()
  end
  for _, b in ipairs(vim.tbl_filter(filter, vim.api.nvim_list_bufs())) do
    if vim.bo[b].buflisted then
      vim.api.nvim_buf_delete(b, { force = true })
    end
  end
end

local function list_snipets()
  -- list all snippets
  local snippets = {}
  for _, snippet in ipairs(ls.get_snippets(vim.bo.filetype)) do
    table.insert(snippets, '[' .. snippet.name .. '] trigger by: ' .. snippet.trigger)
  end
  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = snippets,
    options = { '--prompt', 'luasnip: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      print(action)
    end
  })
end

local function self_use_case_popup()
  local menu = {}
  if persistence_ok == true then
    table.insert(menu, 'save session')
    table.insert(menu, 'load session')
    table.insert(menu, 'select session')
  end
  if luasnip_ok == true then
    table.insert(menu, 'luasnip')
  end

  if todo_ok == true then
    table.insert(menu, 'todo list')
  end

  table.insert(menu, 'buffer delete others')

  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = menu,
    options = { '--prompt', 'sessions menu: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      if action == 'load session' then
        persistence.load({ last = true })
      elseif action == 'select session' then
        persistence.select()
      elseif action == 'save session' then
        persistence.save()
      elseif action == 'buffer delete others' then
        buffer_delete_others()
      elseif action == 'luasnip' then
        list_snipets();
      elseif action == 'todo list' then
        vim.cmd.TodoQuickFix();
      end
    end
  })
end

vim.keymap.set("n", "<Leader>p", function() self_use_case_popup() end)

local persistence_ok, persistence = pcall(require, "persistence")
local luasnip_ok, ls = pcall(require, "luasnip")
local todo_ok = pcall(require, "todo-comments")
local curl_ok, curl = pcall(require, 'curl');
local utils = require('users.utils')

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

local MENU_ENUM = {
  SAVE_SESSION = 'save session',
  LOAD_SESSION = 'load session',
  SELECT_SESSION = 'select session',
  LUASNIP = 'luasnip',
  TODO_LIST = 'todo list',
  BUFFER_DELETE_OTHERS = 'buffer delete others',
  COPY_BUFFER_RELATIVE_PATH = 'copy buffer relative path',
  COPY_BUFFER_ABSOLUTE_PATH = 'copy buffer absolute path',
  CURL_OPEN_GLOBAL = 'curl open global',
  CURL_OPEN_COLLECTION = 'curl open collection',
  CURL_PICK_COLLECTION = 'curl pick collection',
  JQ_FILTER_BUFFER = 'jq filter buffer',
}

local function self_use_case_popup()
  local menu = {}
  if persistence_ok == true then
    table.insert(menu, MENU_ENUM.SAVE_SESSION)
    table.insert(menu, MENU_ENUM.LOAD_SESSION)
    table.insert(menu, MENU_ENUM.SELECT_SESSION)
  end
  if luasnip_ok == true then
    table.insert(menu, MENU_ENUM.LUASNIP)
  end

  if todo_ok == true then
    table.insert(menu, MENU_ENUM.TODO_LIST)
  end
  if curl_ok == true then
    table.insert(menu, MENU_ENUM.CURL_OPEN_GLOBAL)
    table.insert(menu, MENU_ENUM.CURL_OPEN_COLLECTION)
    table.insert(menu, MENU_ENUM.CURL_PICK_COLLECTION)
  end

  table.insert(menu, MENU_ENUM.BUFFER_DELETE_OTHERS)
  table.insert(menu, MENU_ENUM.COPY_BUFFER_RELATIVE_PATH)
  table.insert(menu, MENU_ENUM.COPY_BUFFER_ABSOLUTE_PATH)
  table.insert(menu, MENU_ENUM.JQ_FILTER_BUFFER)

  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = menu,
    options = { '--prompt', 'sessions menu: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      if action == MENU_ENUM.LOAD_SESSION then
        persistence.load({ last = true })
      elseif action == MENU_ENUM.SAVE_SESSION then
        persistence.select()
      elseif action == MENU_ENUM.SELECT_SESSION then
        persistence.save()
      elseif action == MENU_ENUM.BUFFER_DELETE_OTHERS then
        buffer_delete_others()
      elseif action == MENU_ENUM.LUASNIP then
        list_snipets();
      elseif action == MENU_ENUM.TODO_LIST then
        vim.cmd.TodoQuickFix();
      elseif action == MENU_ENUM.COPY_BUFFER_RELATIVE_PATH then
        local bufPath = vim.fn.expand('%f')
        local relativePath = vim.fn.fnamemodify(bufPath, ':.')
        vim.fn.setreg('+', relativePath)
        vim.fn.setreg('*', relativePath)
      elseif action == MENU_ENUM.COPY_BUFFER_ABSOLUTE_PATH then
        local bufPath = vim.fn.expand('%f')
        vim.fn.setreg('+', bufPath)
        vim.fn.setreg('*', bufPath)
      elseif action == MENU_ENUM.CURL_OPEN_GLOBAL then
        curl.open_global_tab()
      elseif action == MENU_ENUM.CURL_OPEN_COLLECTION then
        curl.open_curl_tab();
      elseif action == MENU_ENUM.CURL_PICK_COLLECTION then
        curl.pick_scoped_collection();
      elseif action == MENU_ENUM.JQ_FILTER_BUFFER then
        utils.jq_filter_buffer()
      end
    end
  })
end

vim.keymap.set("n", "<Leader>p", function() self_use_case_popup() end)

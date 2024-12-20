local persistence_ok, persistence = pcall(require, "persistence")
local luasnip_ok = pcall(require, "luasnip")
local todo_ok = pcall(require, "todo-comments")
local curl_ok, curl = pcall(require, 'curl');
local helper = require('users.lib.self-helper')
local utils = require('users.lib.utils')

local MENU_ENUM = {
  SAVE_SESSION = 'save session',
  LOAD_SESSION = 'load session',
  SELECT_SESSION = 'select session',
  LUASNIP = 'luasnip',
  LIST_TODOS = 'list todos',
  BUFFER_DELETE_OTHERS = 'buffer delete others',
  COPY_BUFFER_RELATIVE_PATH = 'copy buffer relative path',
  COPY_BUFFER_ABSOLUTE_PATH = 'copy buffer absolute path',
  CURL_OPEN_GLOBAL = 'curl open global',
  CURL_OPEN_COLLECTION = 'curl open collection',
  CURL_PICK_COLLECTION = 'curl pick collection',
  JQ_FILTER_BUFFER = 'jq filter buffer',
  KABAB_TO_CAMEL = 'yank kabab-case to CamelCase',
  CAMEL_TO_KABAB = 'yank CamelCase to kabab-case',
  TOGGLE_COLORIZER = 'toggle colorizer',
  LIST_MARKS = 'list marks',
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
    table.insert(menu, MENU_ENUM.LIST_TODOS)
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
  table.insert(menu, MENU_ENUM.KABAB_TO_CAMEL)
  table.insert(menu, MENU_ENUM.CAMEL_TO_KABAB)
  table.insert(menu, MENU_ENUM.LIST_MARKS)
  if vim.g.loaded_colorizer == 1 then
    table.insert(menu, MENU_ENUM.TOGGLE_COLORIZER)
  end

  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = menu,
    options = { '--prompt', 'sessions menu: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      if action == MENU_ENUM.LOAD_SESSION then
        persistence.load({ last = true })
      elseif action == MENU_ENUM.SELECT_SESSION then
        persistence.select()
      elseif action == MENU_ENUM.SAVE_SESSION then
        persistence.save()
        vim.notify('Session saved')
      elseif action == MENU_ENUM.BUFFER_DELETE_OTHERS then
        helper.buffer_delete_others()
        vim.notify('Other buffers deleted')
      elseif action == MENU_ENUM.LUASNIP then
        helper.list_snippets();
      elseif action == MENU_ENUM.LIST_TODOS then
        vim.cmd.TodoQuickFix();
      elseif action == MENU_ENUM.COPY_BUFFER_RELATIVE_PATH then
        local bufPath = vim.fn.expand('%f')
        local relativePath = vim.fn.fnamemodify(bufPath, ':.')
        utils.copy_to_clipboard(relativePath)
      elseif action == MENU_ENUM.COPY_BUFFER_ABSOLUTE_PATH then
        local bufPath = vim.fn.expand('%f')
        utils.copy_to_clipboard(bufPath)
      elseif action == MENU_ENUM.CURL_OPEN_GLOBAL then
        curl.open_global_tab()
      elseif action == MENU_ENUM.CURL_OPEN_COLLECTION then
        curl.open_curl_tab();
      elseif action == MENU_ENUM.CURL_PICK_COLLECTION then
        curl.pick_scoped_collection();
      elseif action == MENU_ENUM.JQ_FILTER_BUFFER then
        helper.jq_filter_buffer()
      elseif action == MENU_ENUM.TOGGLE_COLORIZER then
        vim.fn['colorizer#ColorToggle']()
      elseif action == MENU_ENUM.KABAB_TO_CAMEL then
        local camelCase = utils.convertKababCaseToCamelCase(vim.fn.getreg('"'))
        utils.copy_to_clipboard(camelCase)
        vim.notify('Copied to clipboard: ' .. camelCase)
      elseif action == MENU_ENUM.CAMEL_TO_KABAB then
        local kababCase = utils.convertCamelCaseToKababCase(vim.fn.getreg('"'))
        utils.copy_to_clipboard(kababCase)
        vim.notify('Copied to clipboard: ' .. kababCase)
      elseif action == MENU_ENUM.LIST_MARKS then
        helper.list_marks()
      end
    end
  })
end

vim.keymap.set("n", "<Leader>p", function() self_use_case_popup() end)

local luasnip_ok, ls = pcall(require, "luasnip")
local utils = require('users.lib.utils')
local M = {}

local function read_buffer_content()
  local bufnr = vim.api.nvim_get_current_buf()
  local content = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  return table.concat(content, "\n")
end

local function get_filter_from_input()
  local filter = vim.fn.input("Enter jq filter: ")
  return filter
end

local function run_jq(content, filter)
  local handle = io.popen("echo '" .. content:gsub("'", "'\\''") .. "' | jq '" .. filter .. "'")
  if handle == nil then
    return "jq failed"
  end
  local result = handle:read("*a")
  handle:close()
  return result
end

local function show_result_in_popup(result)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(buf, 'filetype', 'json')
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.split(result, "\n"))
  local width = math.floor(vim.o.columns * 0.8)
  local height = math.floor(vim.o.lines * 0.8)
  local row = math.floor((vim.o.lines - height) / 2)
  local col = math.floor((vim.o.columns - width) / 2)
  local opts = {
    style = 'minimal',
    relative = 'editor',
    width = width,
    height = height,
    row = row,
    col = col,
    border = 'single'
  }
  vim.api.nvim_open_win(buf, true, opts)
end

local function process_with_jq()
  if utils.executable("jq") == false then
    print("jq is not installed")
    return
  end
  local content = read_buffer_content()
  local filter = get_filter_from_input()
  local result = run_jq(content, filter)
  show_result_in_popup(result)
end


function M.jq_filter_buffer()
  process_with_jq()
end

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

return M

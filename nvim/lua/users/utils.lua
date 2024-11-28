local M = {}

function M.executable(name)
  if vim.fn.executable(name) > 0 then
    return true
  end

  return false
end

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
  local result = handle:read("*a")
  handle:close()
  return result
end

local function show_result_in_new_buffer(result)
  vim.cmd("vnew")
  local new_bufnr = vim.api.nvim_get_current_buf()
  vim.api.nvim_buf_set_lines(new_bufnr, 0, -1, false, vim.split(result, "\n"))
  vim.cmd("set ft=json")
end

local function process_with_jq()
  if M.executable("jq") == false then
    print("jq is not installed")
    return
  end
  local content = read_buffer_content()
  local filter = get_filter_from_input()
  local result = run_jq(content, filter)
  show_result_in_new_buffer(result)
end

function M.jq_filter_buffer()
  process_with_jq()
end

return M

local utils = require('users.lib.utils')

local M = {}

-- Get the prompts directory path
-- Respects AI_PROMPTS_DIR environment variable for custom locations
local function get_prompts_dir()
  -- Check environment variable first
  local env_dir = vim.env.AI_PROMPTS_DIR
  if env_dir and env_dir ~= '' then
    -- Expand ~ to home directory if needed
    if env_dir:sub(1, 1) == '~' then
      env_dir = vim.env.HOME .. env_dir:sub(2)
    end
    return env_dir
  end
  
  -- Fallback to default: dotfiles_root/prompt-library-example
  local dotfiles_root = vim.g.dot_config_path
  if not dotfiles_root then
    vim.notify("Cannot find dotfiles root path and AI_PROMPTS_DIR not set", vim.log.levels.ERROR, { title = "AI Prompts" })
    return nil
  end
  return dotfiles_root .. '/prompt-library-example'
end

-- Check if a file is a markdown file
local function is_markdown_file(filepath)
  return vim.fn.fnamemodify(filepath, ':e') == 'md'
end

-- Recursively scan directory for .md files
local function scan_prompts_dir(dir)
  local prompts = {}
  
  -- Check if directory exists
  if vim.fn.isdirectory(dir) == 0 then
    return prompts
  end
  
  -- Use vim.fn.globpath to recursively find all .md files
  local files = vim.fn.globpath(dir, '**/*.md', false, true)
  
  for _, filepath in ipairs(files) do
    if vim.fn.filereadable(filepath) == 1 then
      table.insert(prompts, filepath)
    end
  end
  
  return prompts
end

-- Parse YAML front-matter from file content
-- Returns: front_matter (table or nil), content (string)
local function parse_front_matter(filepath)
  local lines = vim.fn.readfile(filepath)
  if #lines == 0 then
    return nil, ""
  end
  
  -- Check if file starts with front-matter delimiter
  if lines[1] ~= '---' then
    -- No front-matter, return all content
    return nil, table.concat(lines, '\n')
  end
  
  -- Find closing delimiter
  local front_matter_end = nil
  for i = 2, #lines do
    if lines[i] == '---' then
      front_matter_end = i
      break
    end
  end
  
  if not front_matter_end then
    -- No closing delimiter found, treat as regular content
    return nil, table.concat(lines, '\n')
  end
  
  -- Extract front-matter YAML (simple parsing)
  local front_matter = {}
  for i = 2, front_matter_end - 1 do
    local line = lines[i]
    -- Parse simple key: value pairs
    local key, value = line:match('^(%w+):%s*(.*)$')
    if key and value then
      value = value:gsub('^"(.*)"$', '%1'):gsub("^'(.*)'$", '%1')
      front_matter[key] = value
    elseif line:match('^%s*-%s+') then
      -- Handle list items (for tags)
      local item = line:match('^%s*-%s+(.+)$')
      if item then
        -- If we just parsed a key without list, initialize it
        local last_key = nil
        for k, v in pairs(front_matter) do
          if type(v) == 'string' and v == '' then
            last_key = k
            break
          end
        end
        if last_key then
          front_matter[last_key] = { item }
        else
          -- Try to append to tags array if it exists
          if front_matter.tags and type(front_matter.tags) == 'table' then
            table.insert(front_matter.tags, item)
          end
        end
      end
    elseif line:match('^%w+:%s*$') then
      -- Key without value (likely followed by list)
      local key = line:match('^(%w+):%s*$')
      if key then
        front_matter[key] = {}
      end
    end
  end
  
  -- Handle array continuation for tags
  local current_array_key = nil
  for i = 2, front_matter_end - 1 do
    local line = lines[i]
    if line:match('^%w+:%s*$') then
      current_array_key = line:match('^(%w+):%s*$')
    elseif current_array_key and line:match('^%s*-%s+') then
      local item = line:match('^%s*-%s+(.+)$')
      if item and front_matter[current_array_key] then
        if type(front_matter[current_array_key]) ~= 'table' then
          front_matter[current_array_key] = {}
        end
        table.insert(front_matter[current_array_key], item)
      end
    end
  end
  
  -- Extract content (everything after front-matter)
  local content_lines = {}
  for i = front_matter_end + 1, #lines do
    table.insert(content_lines, lines[i])
  end
  local content = table.concat(content_lines, '\n')
  
  -- Trim leading/trailing whitespace from content
  content = content:match('^%s*(.-)%s*$') or content
  
  return front_matter, content
end

-- Get display name for a prompt file
local function get_display_name(filepath, front_matter)
  if front_matter and front_matter.title and front_matter.title ~= '' then
    return front_matter.title
  end
  
  -- Fallback to filename without extension
  return vim.fn.fnamemodify(filepath, ':t:r')
end

-- Build picker items from prompts directory
local function build_picker_items()
  local prompts_dir = get_prompts_dir()
  if not prompts_dir then
    return {}
  end
  
  local prompt_files = scan_prompts_dir(prompts_dir)
  if #prompt_files == 0 then
    return {}
  end
  
  local items = {}
  for _, filepath in ipairs(prompt_files) do
    local front_matter, content = parse_front_matter(filepath)
    local display_name = get_display_name(filepath, front_matter)
    
    table.insert(items, {
      text = display_name,
      file = filepath,
      front_matter = front_matter,
    })
  end
  
  return items
end

-- Insert prompt content at cursor position
local function insert_at_cursor(content)
  if not content or content == '' then
    vim.notify("No content to insert", vim.log.levels.WARN, { title = "AI Prompts" })
    return
  end
  
  local lines = vim.split(content, '\n', { plain = true })
  local cursor = vim.api.nvim_win_get_cursor(0)
  local row = cursor[1] - 1  -- 0-indexed
  
  vim.api.nvim_buf_set_lines(0, row, row, false, lines)
  vim.notify("Prompt inserted at cursor", vim.log.levels.INFO, { title = "AI Prompts" })
end

-- Open the AI Prompt Picker
function M.open_picker()
  local snacks_ok, snacks = pcall(require, "snacks")
  if not snacks_ok then
    vim.notify("Snacks.nvim is not available", vim.log.levels.ERROR, { title = "AI Prompts" })
    return
  end
  
  local prompts_dir = get_prompts_dir()
  if not prompts_dir then
    return
  end
  
  -- Check if directory exists
  if vim.fn.isdirectory(prompts_dir) == 0 then
    vim.notify(
      string.format("Prompts directory not found: %s\nPlease create it and add .md prompt files.", prompts_dir),
      vim.log.levels.WARN,
      { title = "AI Prompts" }
    )
    return
  end
  
  local items = build_picker_items()
  if #items == 0 then
    vim.notify(
      string.format("No .md prompt files found in: %s", prompts_dir),
      vim.log.levels.WARN,
      { title = "AI Prompts" }
    )
    return
  end
  
  snacks.picker.pick('ai_prompts', {
    title = "AI Prompt Templates",
    items = items,
    refresh = true,
    multi = false,
    format_item = function(item)
      return item.text
    end,
    actions = {
      -- Default action: open in current window
      edit = function(picker, item)
        picker:close()
        vim.cmd('edit ' .. vim.fn.fnameescape(item.file))
      end,
      -- Open in vertical split
      vsplit = function(picker, item)
        picker:close()
        vim.cmd('vsplit ' .. vim.fn.fnameescape(item.file))
      end,
      -- Open in horizontal split
      split = function(picker, item)
        picker:close()
        vim.cmd('split ' .. vim.fn.fnameescape(item.file))
      end,
      -- Open in new tab
      tab = function(picker, item)
        picker:close()
        vim.cmd('tabnew ' .. vim.fn.fnameescape(item.file))
      end,
      -- Copy content to clipboard
      yank = function(picker, item)
        utils.copy_to_clipboard(item.content)
        vim.notify("Prompt copied to clipboard", vim.log.levels.INFO, { title = "AI Prompts" })
      end,
      -- Insert content at cursor position
      insert = function(picker, item)
        picker:close()
        vim.schedule(function()
          insert_at_cursor(item.content)
        end)
      end,
    },
    win = {
      input = {
        keys = {
          ['<cr>'] = { 'edit', mode = { "n", "i" }, desc = "Open prompt file" },
          ['<c-v>'] = { 'vsplit', mode = { "n", "i" }, desc = "Open in vsplit" },
          ['<c-s>'] = { 'split', mode = { "n", "i" }, desc = "Open in split" },
          ['<c-t>'] = { 'tab', mode = { "n", "i" }, desc = "Open in new tab" },
          ['<c-y>'] = { 'yank', mode = { "n", "i" }, desc = "Copy to clipboard" },
          ['<c-i>'] = { 'insert', mode = { "n", "i" }, desc = "Insert at cursor" },
        },
      },
    },
  })
end

vim.api.nvim_create_user_command('AIPromptPicker', function()
  M.open_picker()
end, {
  desc = 'Open AI Prompt Picker (AI_PROMPTS_DIR or {dotfiles}/prompt-library-example)',
})

return M

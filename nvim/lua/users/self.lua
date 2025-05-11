local persistence_ok, persistence = pcall(require, "persistence")
local luasnip_ok = pcall(require, "luasnip")
local todo_ok = pcall(require, "todo-comments")
local helper = require('users.lib.self-helper')
local utils = require('users.lib.utils')
local flash_ok, flash = pcall(require, 'flash')

local last_run = nil

local MENU_LABEL_ENUM = {
  LAST_RUN = 'last run',
  SAVE_SESSION = 'save session',
  LOAD_SESSION = 'load session',
  SELECT_SESSION = 'select session',
  LUASNIP = 'luasnip',
  LIST_TODOS = 'list todos',
  BUFFER_DELETE_OTHERS = 'delete other buffers',
  COPY_BUFFER_RELATIVE_PATH = 'yank relative path',
  COPY_BUFFER_ABSOLUTE_PATH = 'yank absolute path',
  COPY_BUFFER_FILE_NAME = 'yank filename',
  TO_CAMEL = 'To CamelCase',
  TO_KABAB = 'To kabab-case',
  TO_SNACK = 'To snack_case',
  TOGGLE_COLORIZER = 'toggle colorizer',
  PROJECTS = 'projects',
  FLASH_TREESITTER = 'flash treesitter',
  FLASH_JUMP_CWORD = 'flash jump cword',
  OPEN_QUICKFIX = 'open quickfix',
  OPEN_LOCATION = 'open location',
  SNACKS_PICKER = 'snacks picker',
}

local MENU = {
  [MENU_LABEL_ENUM.LOAD_SESSION] = function()
    persistence.load({ last = true })
  end,
  [MENU_LABEL_ENUM.SELECT_SESSION] = function()
    persistence.select()
  end,
  [MENU_LABEL_ENUM.SAVE_SESSION] = function()
    persistence.save()
    vim.notify('Session saved')
  end,
  [MENU_LABEL_ENUM.LIST_TODOS] = function()
    Snacks.picker.todo_comments()
  end,
  [MENU_LABEL_ENUM.BUFFER_DELETE_OTHERS] = function()
    helper.buffer_delete_others()
    vim.notify('Other buffers deleted')
  end,
  [MENU_LABEL_ENUM.TOGGLE_COLORIZER] = function()
    vim.fn['colorizer#ColorToggle']()
    if vim.fn.exists('#Colorizer') == 1 then
      Snacks.notify('Colorizer enabled', { title = 'Colorizer' })
    else
      Snacks.notify.warn('Colorizer disabled', { title = 'Colorizer' })
    end
  end,
  [MENU_LABEL_ENUM.LUASNIP] = function()
    helper.list_snippets()
  end,
  [MENU_LABEL_ENUM.COPY_BUFFER_RELATIVE_PATH] = function()
    local bufPath = vim.fn.expand('%f')
    local relativePath = vim.fn.fnamemodify(bufPath, ':.')
    utils.copy_to_clipboard(relativePath)
  end,
  [MENU_LABEL_ENUM.COPY_BUFFER_FILE_NAME] = function()
    local bufPath = vim.fn.expand('%f')
    local fileName = vim.fn.fnamemodify(bufPath, ':t')
    utils.copy_to_clipboard(fileName)
  end,
  [MENU_LABEL_ENUM.COPY_BUFFER_ABSOLUTE_PATH] = function()
    local bufPath = vim.fn.expand('%f')
    utils.copy_to_clipboard(bufPath)
  end,
  [MENU_LABEL_ENUM.TO_CAMEL] = function()
    local lines, set_text = utils.get_selected_text()
    local camel_case = utils.to_camel_case(table.concat(lines, '\n'))
    set_text(camel_case)
  end,
  [MENU_LABEL_ENUM.TO_KABAB] = function()
    local lines, set_text = utils.get_selected_text()
    local kabab_case = utils.to_kabab_case(table.concat(lines, '\n'))
    set_text(kabab_case)
  end,
  [MENU_LABEL_ENUM.TO_SNACK] = function()
    local lines, set_text = utils.get_selected_text()
    local snack_case = utils.to_snack_case(table.concat(lines, '\n'))
    set_text(snack_case)
  end,
  [MENU_LABEL_ENUM.PROJECTS] = function()
    Snacks.picker.projects()
  end,
  [MENU_LABEL_ENUM.OPEN_LOCATION] = function()
    Snacks.picker.loclist()
  end,
  [MENU_LABEL_ENUM.SNACKS_PICKER] = function()
    Snacks.picker()
  end,
  [MENU_LABEL_ENUM.FLASH_TREESITTER] = function()
    flash.treesitter()
  end,
  [MENU_LABEL_ENUM.FLASH_JUMP_CWORD] = function()
    flash.jump({
      pattern = vim.fn.expand("<cword>"),
    })
  end,
  [MENU_LABEL_ENUM.OPEN_QUICKFIX] = function()
    vim.cmd.copen()
  end,
}

local function self_use_case_popup()
  local menu = {
    MENU_LABEL_ENUM.LAST_RUN,
    MENU_LABEL_ENUM.COPY_BUFFER_FILE_NAME,
    MENU_LABEL_ENUM.COPY_BUFFER_RELATIVE_PATH,
    MENU_LABEL_ENUM.COPY_BUFFER_ABSOLUTE_PATH,
    MENU_LABEL_ENUM.PROJECTS,
    MENU_LABEL_ENUM.OPEN_QUICKFIX,
    MENU_LABEL_ENUM.OPEN_LOCATION,
    MENU_LABEL_ENUM.SNACKS_PICKER,
    MENU_LABEL_ENUM.BUFFER_DELETE_OTHERS,
  }
  if persistence_ok == true then
    vim.list_extend(menu, {
      MENU_LABEL_ENUM.SAVE_SESSION,
      MENU_LABEL_ENUM.LOAD_SESSION,
      MENU_LABEL_ENUM.SELECT_SESSION,
    })
  end
  if luasnip_ok == true then
    table.insert(menu, MENU_LABEL_ENUM.LUASNIP)
  end

  if todo_ok == true then
    table.insert(menu, MENU_LABEL_ENUM.LIST_TODOS)
  end
  if flash_ok == true then
    vim.list_extend(menu, {
      MENU_LABEL_ENUM.FLASH_TREESITTER,
      MENU_LABEL_ENUM.FLASH_JUMP_CWORD,
    })
  end

  if vim.g.loaded_colorizer == 1 then
    table.insert(menu, MENU_LABEL_ENUM.TOGGLE_COLORIZER)
  end

  vim.ui.select(menu, { prompt = 'quick actions: ' }, function(action)
    if action == nil then
      return
    end
    if action == MENU_LABEL_ENUM.LAST_RUN then
      if last_run ~= nil then
        action = last_run
      else
        Snacks.notify.warn('Last Action not found')
        return
      end
    end

    if MENU[action] then
      MENU[action]()
      last_run = action
    end
  end
  )
end

local function name_style_convert()
  local menu = {
    MENU_LABEL_ENUM.TO_CAMEL,
    MENU_LABEL_ENUM.TO_KABAB,
    MENU_LABEL_ENUM.TO_SNACK,
  }
  vim.ui.select(menu, { prompt = 'convert style: ' }, function(action)
    if action == nil then
      return
    end

    if vim.fn.mode() == "v" or vim.fn.mode() == "V" then
      vim.cmd([[execute "normal! \<ESC>"]])
    end
    if MENU[action] then
      MENU[action]()
    end
  end)
end

local function git_resolve_conflicts()
  local menu = {
    'use left',
    'use right',
    'diffget',
    'diffput',
  }
  vim.ui.select(menu, { prompt = 'git resolve conflicts: ' }, function(action)
    if action == nil then
      return
    end
    if action == 'use left' then
      vim.cmd('diffget //2 | diffupdate')
    elseif action == 'use right' then
      vim.cmd('diffget //3 | diffupdate')
    elseif action == 'diffget' then
      vim.cmd('diffget | diffupdate')
    elseif action == 'diffput' then
      vim.cmd('diffput | diffupdate')
    end
  end)
end

vim.keymap.set("n", "<A-.>", function() self_use_case_popup() end)
vim.keymap.set("i", "<A-.>", function() self_use_case_popup() end)
vim.keymap.set({ "n", "v" }, "<A-u>", function() name_style_convert() end)
vim.keymap.set({ "n", "v" }, "<A-g>", function()
  if vim.wo.diff then
    git_resolve_conflicts()
  end
end)

-- add font size increase and decrease to neovide
if vim.g.neovide then
  vim.keymap.set({ "n", "v" }, "<C-=>", ":lua vim.g.neovide_scale_factor = vim.g.neovide_scale_factor + 0.1<CR>",
    { silent = true })
  vim.keymap.set({ "n", "v" }, "<C-->", ":lua vim.g.neovide_scale_factor = vim.g.neovide_scale_factor - 0.1<CR>",
    { silent = true })
  vim.keymap.set({ "n", "v" }, "<C-0>", ":lua vim.g.neovide_scale_factor = 1<CR>",
    { silent = true })

  vim.keymap.set({ "i" }, "<C-S-V>", function()
    vim.cmd("normal! \"+p")
  end, { silent = true })
  vim.keymap.set({ "c" }, "<C-S-V>", function()
    vim.fn.feedkeys("+")
  end, { silent = true })
end


local function run_command_on_range()
  -- Get the range of lines
  local start_line, end_line
  if vim.fn.mode() == "v" or vim.fn.mode() == "V" then
    vim.cmd([[execute "normal! \<ESC>"]])
    start_line = vim.fn.getpos("'<")[2] - 1
    end_line = vim.fn.getpos("'>")[2]
  else
    start_line = 0
    end_line = vim.fn.line("$")
  end

  -- Get the lines in the range
  local lines = vim.api.nvim_buf_get_lines(0, start_line, end_line, false)
  local input_text = table.concat(lines, "\n")

  -- Prompt the user for a command
  Snacks.input({ prompt = "Shell Command" }, function(command)
    if command == nil then
      return
    end

    -- Run the command using jobstart
    local output = {}
    local job_id = vim.fn.jobstart(command, {
      stdout_buffered = true,
      stderr_buffered = true,
      on_stdout = function(_, data)
        if data then
          vim.list_extend(output, data)
        end
      end,
      on_stderr = function(_, data)
        if data then
          vim.list_extend(output, data)
        end
      end,
      on_exit = function(job_id, code)
        if code ~= 0 then
          Snacks.notify.error(string.format("[%s](%d) exited with code %d", command, job_id, code),
            { title = "Shell Command" })
          return
        end

        -- Show the output in a new window
        local win = Snacks.win({
          width = 0.6,
          height = 0.6,
          border = 'rounded',
          wo = {
            spell = false,
            wrap = false,
            signcolumn = "yes",
            statuscolumn = " ",
            conceallevel = 3,
          },
          on_buf = function(win)
            local buf = win.buf
            vim.api.nvim_buf_set_lines(buf, 0, -1, false, output)
          end,
        })
        win:set_title("Command Output", 'center')
      end,
    })

    -- Delay sending input to ensure the job is ready
    vim.defer_fn(function()
      vim.fn.chansend(job_id, input_text)
      vim.fn.chanclose(job_id, "stdin")
    end, 10) -- Delay by 10ms
  end)
end

vim.keymap.set({ "n", "v" }, "<A-r>", run_command_on_range, { silent = true })

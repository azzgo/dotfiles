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
  BUFFER_DELETE_OTHERS = 'buffer delete others',
  COPY_BUFFER_RELATIVE_PATH = 'copy buffer relative path',
  COPY_BUFFER_ABSOLUTE_PATH = 'copy buffer absolute path',
  COPY_BUFFER_FILE_NAME = 'copy buffer file name',
  KABAB_TO_CAMEL = 'yank kabab-case to CamelCase',
  CAMEL_TO_KABAB = 'yank CamelCase to kabab-case',
  TOGGLE_COLORIZER = 'toggle colorizer',
  LIST_MARKS = 'list marks',
  PROJECTS = 'projects',
  EXPLORER = 'explorer',
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
  [MENU_LABEL_ENUM.KABAB_TO_CAMEL] = function()
    local camelCase = utils.convertKababCaseToCamelCase(vim.fn.getreg('"'))
    utils.copy_to_clipboard(camelCase)
    Snacks.notify('Copied to clipboard: ' .. camelCase, { title = 'kabab to camel' })
  end,
  [MENU_LABEL_ENUM.CAMEL_TO_KABAB] = function()
    local kababCase = utils.convertCamelCaseToKababCase(vim.fn.getreg('"'))
    utils.copy_to_clipboard(kababCase)
    Snacks.notify('Copied to clipboard: ' .. kababCase, { title = 'camel to kabab' })
  end,
  [MENU_LABEL_ENUM.PROJECTS] = function()
    Snacks.picker.projects()
  end,
  [MENU_LABEL_ENUM.OPEN_LOCATION] = function()
    Snacks.picker.location()
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
  [MENU_LABEL_ENUM.LIST_MARKS] = function()
    Snacks.picker.marks()
  end,
  [MENU_LABEL_ENUM.EXPLORER] = function()
    Snacks.explorer()
  end,
}


local function self_use_case_popup()
  local menu = {}
  table.insert(menu, MENU_LABEL_ENUM.LAST_RUN)
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

  vim.list_extend(menu, {
    MENU_LABEL_ENUM.BUFFER_DELETE_OTHERS,
    MENU_LABEL_ENUM.COPY_BUFFER_RELATIVE_PATH,
    MENU_LABEL_ENUM.COPY_BUFFER_ABSOLUTE_PATH,
    MENU_LABEL_ENUM.COPY_BUFFER_FILE_NAME,
    MENU_LABEL_ENUM.KABAB_TO_CAMEL,
    MENU_LABEL_ENUM.CAMEL_TO_KABAB,
    MENU_LABEL_ENUM.LIST_MARKS,
    MENU_LABEL_ENUM.EXPLORER,
    MENU_LABEL_ENUM.PROJECTS,
    MENU_LABEL_ENUM.OPEN_QUICKFIX,
    MENU_LABEL_ENUM.OPEN_LOCATION,
    MENU_LABEL_ENUM.SNACKS_PICKER,
  })
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

vim.keymap.set("n", "<A-.>", function() self_use_case_popup() end)
vim.keymap.set("i", "<A-.>", function() self_use_case_popup() end)

-- add font size increase and decrease to neovide
if vim.g.neovide then
  vim.keymap.set({ "n", "v" }, "<C-=>", ":lua vim.g.neovide_scale_factor = vim.g.neovide_scale_factor + 0.1<CR>",
    { silent = true })
  vim.keymap.set({ "n", "v" }, "<C-->", ":lua vim.g.neovide_scale_factor = vim.g.neovide_scale_factor - 0.1<CR>",
    { silent = true })
  vim.keymap.set({ "n", "v" }, "<C-0>", ":lua vim.g.neovide_scale_factor = 1<CR>", { silent = true })

  vim.keymap.set({ "i" }, "<C-S-V>", function()
    vim.cmd("normal! \"+p")
  end, { silent = true })
end

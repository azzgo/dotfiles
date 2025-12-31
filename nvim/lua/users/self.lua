local persistence_ok, persistence = pcall(require, "persistence")
local luasnip_ok = pcall(require, "luasnip")
local todo_ok = pcall(require, "todo-comments")
local ai_prompts_ok, ai_prompts = pcall(require, "users.ai_prompts")
local helper = require('users.lib.self-helper')
local utils = require('users.lib.utils')
local flash_ok, flash = pcall(require, 'flash')

local MENU_LABEL_ENUM = {
    SAVE_SESSION = '[Session] - save',
    LOAD_SESSION = '[Session] - load',
    SELECT_SESSION = '[Session] - select',
    LUASNIP = '[Luasnip] - snippets',
    LIST_TODOS = '[Todos] - lists',
    AI_PROMPTS = '[AI] - prompt picker',
    BUFFER_DELETE_OTHERS = '[Buffer] - delete others',
    RELOAD_BUFFER_FORCE = '[Buffer] - force reload from disk',
    COPY_BUFFER_RELATIVE_PATH = '[Yank] - RelativePath',
    COPY_BUFFER_ABSOLUTE_PATH = '[Yank] - AbsolutePath',
    COPY_BUFFER_FILE_NAME = '[Yank] - Filename',
    TO_CAMEL = 'To CamelCase',
    TO_KABAB = 'To kabab-case',
    TO_SNACK = 'To snack_case',
    TOGGLE_COLORIZER = '[Colorizer] - toggle',
    FLASH_TREESITTER = '[Flash] - treesitter',
    FLASH_JUMP_CWORD = '[Flash] - jump cword',
    TOGGLE_WRAP = '[View] - toggle wrap',
    OPEN_QUICKFIX = '[Quickfix] - list',
    OPEN_LOCATION = '[Location] - list',
    SNACKS_PICKER = '[Snacks] - picker',
    QUIT_ALL = '[Quit] - force quit all',
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
    [MENU_LABEL_ENUM.RELOAD_BUFFER_FORCE] = function()
        vim.cmd('edit!')
        vim.notify('Buffer force reloaded from disk', vim.log.levels.WARN, { title = 'Buffer' })
    end,
    [MENU_LABEL_ENUM.TOGGLE_COLORIZER] = function()
        vim.fn['colorizer#ColorToggle']()
        if vim.fn.exists('#Colorizer') == 1 then
            Snacks.notify('Colorizer enabled', { title = 'Colorizer' })
        else
            Snacks.notify.warn('Colorizer disabled', { title = 'Colorizer' })
        end
    end,

    [MENU_LABEL_ENUM.TOGGLE_WRAP] = function()
        vim.wo.wrap = not vim.wo.wrap
        if vim.wo.wrap then
            vim.notify('Wrap enabled', vim.log.levels.INFO, { title = 'Wrap' })
        else
            vim.notify('Wrap disabled', vim.log.levels.INFO, { title = 'Wrap' })
        end
    end,
    [MENU_LABEL_ENUM.LUASNIP] = function()
        helper.list_snippets()
    end,
    [MENU_LABEL_ENUM.AI_PROMPTS] = function()
        ai_prompts.open_picker()
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
        local bufPath = vim.fn.expand('%:p')
        utils.copy_to_clipboard(bufPath)
    end,
    [MENU_LABEL_ENUM.TO_CAMEL] = function()
        local text, set_text = utils.get_selected_text()
        local camel_case = utils.to_camel_case(text)
        set_text(camel_case)
    end,
    [MENU_LABEL_ENUM.TO_KABAB] = function()
        local text, set_text = utils.get_selected_text()
        local kabab_case = utils.to_kabab_case(text)
        set_text(kabab_case)
    end,
    [MENU_LABEL_ENUM.TO_SNACK] = function()
        local text, set_text = utils.get_selected_text()
        local snack_case = utils.to_snack_case(text)
        set_text(snack_case)
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
    [MENU_LABEL_ENUM.QUIT_ALL] = function()
        vim.cmd.quitall({ bang = true })
    end,
}

local function self_use_case_popup()
    local menu = {
        MENU_LABEL_ENUM.QUIT_ALL,
        MENU_LABEL_ENUM.COPY_BUFFER_FILE_NAME,
        MENU_LABEL_ENUM.COPY_BUFFER_RELATIVE_PATH,
        MENU_LABEL_ENUM.COPY_BUFFER_ABSOLUTE_PATH,
        MENU_LABEL_ENUM.OPEN_QUICKFIX,
        MENU_LABEL_ENUM.OPEN_LOCATION,
        MENU_LABEL_ENUM.SNACKS_PICKER,
        MENU_LABEL_ENUM.BUFFER_DELETE_OTHERS,
        MENU_LABEL_ENUM.RELOAD_BUFFER_FORCE,
        MENU_LABEL_ENUM.TOGGLE_WRAP,
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
    
    if ai_prompts_ok == true then
        table.insert(menu, MENU_LABEL_ENUM.AI_PROMPTS)
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

    vim.ui.select(menu, { prompt = 'Quick Actions: ' }, function(action)
        if action == nil then
            return
        end

        if MENU[action] then
            MENU[action]()
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
    vim.ui.select(menu, { prompt = 'Convert Style: ' }, function(action)
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

    vim.g.neovide_input_macos_option_key_is_meta = 'only_left'
end


local ok, snacks = pcall(require, "snacks")
local har_ok, harpoon = pcall(require, "harpoon")
if not ok then
  return
end

local dashboard_sections = {
  { section = "header" },
}

local dashboard_config = {
    preset = {
      -- Defaults to a picker that supports `fzf-lua`, `telescope.nvim` and `mini.pick`
      ---@type fun(cmd:string, opts:table)|nil
      pick = nil,
      keys = {
        { icon = " ", key = "e", desc = "New File", action = ":ene | startinsert" },
        { icon = "󰒲 ", key = "l", desc = "Lazy", action = ":Lazy", enabled = package.loaded.lazy ~= nil },
        { icon = "", key = "h", desc = "Mcphub", action = ":MCPHub" },
        { icon = " ", key = "q", desc = "Quit", action = ":qa" },
      },
      header = [[
███████╗███████╗███╗   ██╗     ██████╗ ███╗   ██╗    ██╗     ██╗███████╗███████╗
╚══███╔╝██╔════╝████╗  ██║    ██╔═══██╗████╗  ██║    ██║     ██║██╔════╝██╔════╝
  ███╔╝ █████╗  ██╔██╗ ██║    ██║   ██║██╔██╗ ██║    ██║     ██║█████╗  █████╗
 ███╔╝  ██╔══╝  ██║╚██╗██║    ██║   ██║██║╚██╗██║    ██║     ██║██╔══╝  ██╔══╝
███████╗███████╗██║ ╚████║    ╚██████╔╝██║ ╚████║    ███████╗██║██║     ███████╗
╚══════╝╚══════╝╚═╝  ╚═══╝     ╚═════╝ ╚═╝  ╚═══╝    ╚══════╝╚═╝╚═╝     ╚══════╝]],
    },
    -- item field formatters
    sections = dashboard_sections,
  }

if har_ok then
  local harpoon_files = harpoon:list()
  if #harpoon_files.items > 0 then
    table.insert(dashboard_sections, {
      title = "Harpoon",
    })
    for _, item in ipairs(harpoon_files.items) do
      table.insert(dashboard_sections, {
        file = vim.fn.fnamemodify(item.value, ":t"),
        action = function()
          vim.cmd("e " .. item.value)
        end,
        autokey = true,
      })
    end
  end
  table.insert(dashboard_sections, { padding = { 0, 0 } })
end

table.insert(dashboard_sections, { section = "keys", gap = 1, padding = 1 })
table.insert(dashboard_sections, { section = "startup" })

snacks.setup({
  bigfile = {
    enabled = true,
    notify = true,
    size = 0.5 * 1024 * 1024,
  },
  dashboard = dashboard_config,
  indent = { enabled = true },
  input = { enabled = false },
  picker = {
    enabled = true,
    ui_select = true,
    win = {
      input = {
        keys = {
          ["<a-s>"] = { "flash", mode = { "n", "i" } },
          ["s"] = { "flash" },
        },
      },
    },
    actions = {
      flash = function(picker)
        require("flash").jump({
          pattern = "^",
          label = { after = { 0, 0 } },
          search = {
            mode = "search",
            exclude = {
              function(win)
                return vim.bo[vim.api.nvim_win_get_buf(win)].filetype ~= "snacks_picker_list"
              end,
            },
          },
          action = function(match)
            local idx = picker.list:row2idx(match.pos[1])
            picker.list:_move(idx, true, true)
          end,
        })
      end,
    },
  },
  notifier = {
    enabled = true,
    timeout = 3000,
  },
  quickfile = { enabled = true },
  scroll = { enabled = false },
  statuscolumn = { enabled = false },
  words = { enabled = false },
})

vim.keymap.set("n", "<A-z>", function()
  Snacks.zen()
end, { desc = "Zen mode" })
vim.keymap.set("n", "<A-f>", function()
  Snacks.zen.zoom()
end, { desc = "Dim focus" })

vim.keymap.set("n", "<A-s>", function()
  Snacks.scratch()
end, { desc = "Dim focus" })

vim.keymap.set("n", "<leader>ne", function()
  Snacks.picker.explorer()
end, { desc = "Open Explorer" })

vim.keymap.set("n", "<leader>r", function()
  Snacks.picker.registers()
end, { desc = "Open Registers" })

vim.keymap.set("n", "<leader>k", function()
  Snacks.picker.keymaps()
end, { desc = "List Keymaps" })

vim.keymap.set("n", "<leader>b", function()
  Snacks.picker.buffers()
end, { desc = "List Buffers" })

vim.keymap.set("n", "<leader>m", function()
  Snacks.picker.marks()
end, { desc = "List Marks" })

vim.keymap.set("n", "<leader>r", function()
  Snacks.picker.recent()
end, { desc = "recent files" })

vim.keymap.set("n", "<leader>:", function()
  Snacks.picker.commands()
end, { desc = "Commands" })

vim.keymap.set({"n", "i", "v" }, "<A-x>", function()
  Snacks.picker.commands()
end, { desc = "Commands" })

if vim.fn.has('python3') ~= 1 then
  vim.keymap.set('n', '<leader>/', function() 
    Snacks.picker.grep()
  end, { silent = true, noremap = true })
  vim.keymap.set('n', '<leader>f', function()
    Snacks.picker.files()
  end, { silent = true, noremap = true })
end

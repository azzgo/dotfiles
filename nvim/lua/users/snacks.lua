local ok, snacks = pcall(require, "snacks")
local har_ok, harpoon = pcall(require, "harpoon")
if not ok then
  return
end

local dashboard_sections = {
  { section = "header" },
  { title = "Sessions" },
  {
    section = "projects",
    padding = 1,
    action = function(dir)
      -- modified default implementation to load session first then use oil
      -- https://github.com/folke/snacks.nvim/blob/f65a2c82f3fea24bc3c7450c5612e2f5976cabd5/lua/snacks/dashboard.lua#L875
      local session_loaded = false
      vim.api.nvim_create_autocmd("SessionLoadPost", { once = true, callback = function() session_loaded = true end })
      vim.defer_fn(function() if not session_loaded then vim.cmd.Oil() end end, 100)
      -- load sessoin first then use oil
      vim.fn.chdir(dir)
      local session = Snacks.dashboard.sections.session()
      if session then
        vim.cmd(session.action:sub(2))
      else
        vim.cmd.Oil()
      end

      vim.cmd.Oil()
    end
  },
}

if har_ok then
  table.insert(dashboard_sections, {
    title = "Harpoon",
  })
  local harpoon_files = harpoon:list()
  for _, item in ipairs(harpoon_files.items) do
    table.insert(dashboard_sections, {
      file = vim.fn.fnamemodify(item.value, ":t"),
      action = function()
        vim.cmd("e " .. item.value)
      end,
      autokey = true,
    })
  end
  table.insert(dashboard_sections, { padding = { 0, 0 } })
end

table.insert(dashboard_sections, { section = "keys", gap = 1, padding = 1 })
table.insert(dashboard_sections, { section = "startup" })

snacks.setup({
  bigfile = { enabled = false },
  dashboard = {
    preset = {
      -- Defaults to a picker that supports `fzf-lua`, `telescope.nvim` and `mini.pick`
      ---@type fun(cmd:string, opts:table)|nil
      pick = nil,
      keys = {
        { icon = " ", key = "e", desc = "New File", action = ":ene | startinsert" },
        { icon = "󰒲 ", key = "l", desc = "Lazy", action = ":Lazy", enabled = package.loaded.lazy ~= nil },
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
  },
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

vim.keymap.set("n", "<A-c>", function() Snacks.picker.commands() end, { desc = "List Commands" })

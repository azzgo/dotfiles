local ok, gitsigns = pcall(require, "gitsigns")

if not ok then
  return
end

local function hunks_popup_menu()
  local menu = {
    '[hunk] stage',
    '[hunk] reset',
    '[hunk] preview',
    '[hunk] undo stage',
    '[buffer] stage',
    '[buffer] reset',
    '[toggle] current line blame',
    'blame line',
    'diff this',
  }
  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = menu,
    options = { '--prompt', 'Gitsigns actions: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      if action == '[hunk] stage' then
        return gitsigns.stage_hunk()
      elseif action == '[hunk] reset' then
        return gitsigns.reset_hunk()
      elseif action == '[hunk] preview' then
        return gitsigns.preview_hunk()
      elseif action == '[hunk] undo stage' then
        return gitsigns.undo_stage_hunk()
      elseif action == '[buffer] stage' then
        return gitsigns.stage_buffer()
      elseif action == '[buffer] reset' then
        return gitsigns.reset_buffer()
      elseif action == '[toggle] current line blame' then
        return gitsigns.toggle_current_line_blame()
      elseif action == 'blame line' then
        return gitsigns.blame_line { full = true }
      elseif action == 'diff this' then
        return gitsigns.diffthis()
      end
    end
  })
end

gitsigns.setup({
  current_line_blame = false,
  on_attach = function(bufnr)
    local function map(mode, l, r, opts)
      opts = opts or {}
      opts.buffer = bufnr
      vim.keymap.set(mode, l, r, opts)
    end

    vim.keymap.set("n", "]h", ":Gitsigns next_hunk<CR>", { noremap = true, silent = true })
    vim.keymap.set("n", "[h", ":Gitsigns prev_hunk<CR>", { noremap = true, silent = true })

    map({ "n", "v" }, "<leader>h", function()
      hunks_popup_menu()
    end)
  end
})

local ok, gitsigns = pcall(require, "gitsigns")

if not ok then
  return
end

gitsigns.setup({
  current_line_blame = true,
  on_attach = function(bufnr)
    local function map(mode, l, r, opts)
      opts = opts or {}
      opts.buffer = bufnr
      vim.keymap.set(mode, l, r, opts)
    end

    vim.api.nvim_set_keymap("n", "]h", ":Gitsigns next_hunk<CR>", { noremap = true, silent = true })
    vim.api.nvim_set_keymap("n", "[h", ":Gitsigns prev_hunk<CR>", { noremap = true, silent = true })

    map({ "n", "v" }, "<leader>hs", ":Gitsigns stage_hunk<CR>")
    map({ "n", "v" }, "<leader>hr", ":Gitsigns reset_hunk<CR>")
    map('n', '<leader>hu', gitsigns.undo_stage_hunk)
    map('n', '<leader>hp', gitsigns.preview_hunk)
    map('n', '<leader>hb', function() gitsigns.blame_line { full = true } end)

    map('n', '<leader>hd', gitsigns.diffthis)
    map('n', '<leader>hD', function() gitsigns.diffthis('~') end)
  end
})

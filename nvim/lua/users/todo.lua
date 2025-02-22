local ok, todo = pcall(require, "todo-comments")
if not ok then
  return
end

todo.setup {
  signs = false,
  keywords = {
    FIX = {
      icon = " ", -- icon used for the sign, and in search results
      color = "error", -- can be a hex color, or a named color (see below)
      alt = { "FIXME", "BUG", "FIXIT", "ISSUE" }, -- a set of other keywords that all map to this FIX keywords
      -- signs = false, -- configure signs for some keywords individually
    },
    TODO = { icon = " ", color = "info" },
    DOING = { icon = " ", color = "warning", alt = { "DOING", "WORKING" } },
    DONE = { icon = " ", color = "success", alt = { "DONE", "COMPLETED" } },
    HACK = { icon = " ", color = "warning" },
    WARN = { icon = " ", color = "warning", alt = { "WARNING", "XXX" } },
    PERF = { icon = " ", alt = { "OPTIM", "PERFORMANCE", "OPTIMIZE" } },
    NOTE = { icon = " ", color = "hint", alt = { "INFO" } },
    TEST = { icon = "⏲ ", color = "test", alt = { "TESTING", "PASSED", "FAILED" } },
  },
  colors = {
    error = { "DiagnosticError", "ErrorMsg", "#DC2626" },
    warning = { "DiagnosticWarn", "WarningMsg", "#FBBF24" },
    info = { "DiagnosticInfo", "#2563EB" },
    hint = { "DiagnosticHint", "#10B981" },
    default = { "Identifier", "#7C3AED" },
    test = { "Identifier", "#FF00FF" },
    success = { "DiagnosticSuccess", "#22C55E" },
  },
  highlight = {
    before = "",
    keyword = "bg",
    after = "",
    comments_only = true,
  },
}

vim.keymap.set("n", "]t", function()
  require("todo-comments").jump_next()
end, { desc = "Next todo comment" })

vim.keymap.set("n", "[t", function()
  require("todo-comments").jump_prev()
end, { desc = "Previous todo comment" })

local ok, ls = pcall(require, "luasnip")

if not ok then
  return
end

local s = ls.snippet
local t = ls.text_node
local i = ls.insert_node
-- local sn = ls.snippet_node
-- local isn = ls.indent_snippet_node
-- local f = ls.function_node
-- local c = ls.choice_node
-- local d = ls.dynamic_node
-- local r = ls.restore_node
-- local events = require "luasnip.util.events"
-- local ai = require "luasnip.nodes.absolute_indexer"
-- local extras = require "luasnip.extras"
-- local fmt = extras.fmt
-- local m = extras.m
-- local l = extras.l
-- local postfix = require "luasnip.extras.postfix".postfix

-- keymap
vim.keymap.set({"i"}, "<C-s>", function() ls.expand() end, {silent = true})
vim.keymap.set({"i", "s"}, "<C-j>", function() ls.jump(1) end, {silent = true})


--- snippets
local jsLogSnnipet = s("log", {
  t("console.log("), i(1, "message"), t(");")
})

ls.add_snippets("typescript", {
  jsLogSnnipet,
})

ls.add_snippets("javascript", {
  jsLogSnnipet,
})

ls.add_snippets("javascriptreact", {
  jsLogSnnipet,
})

ls.add_snippets("typescriptreact", {
  jsLogSnnipet,
})

ls.add_snippets('gitcommit', {
  s("msg", {
    i(1, "feat"), t("("), i(2, "card_no"), t("): "), i(3, "messages")
  })
})

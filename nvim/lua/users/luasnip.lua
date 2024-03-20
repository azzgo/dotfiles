local ok, ls = pcall(require, "luasnip")

if not ok then
  return
end

local s = ls.snippet
local t = ls.text_node
local i = ls.insert_node
-- local sn = ls.snippet_node
-- local isn = ls.indent_snippet_node
local f = ls.function_node
-- local c = ls.choice_node
-- local d = ls.dynamic_node
-- local r = ls.restore_node
-- local events = require "luasnip.util.events"
-- local ai = require "luasnip.nodes.absolute_indexer"
local fmt = require("luasnip.extras.fmt").fmt
-- local l = extras.l
-- local m = extras.m
local postfix = require "luasnip.extras.postfix".postfix

-- keymap
vim.keymap.set({ "i" }, "<C-s>", function() ls.expand() end, { silent = true })
vim.keymap.set({ "i", "s" }, "<C-j>", function() ls.jump(1) end, { silent = true })


--- snippets
local jsLogSnipet = s("log", {
  t("console.log("), i(1, "message"), t(");")
})
local jsLetPrefixSnipet = postfix('.let', {
  t('let '),
  i(1, 'variable'),
  f(function(_, parent)
    return " = " .. parent.snippet.env.POSTFIX_MATCH .. ";"
  end, {}),
})
local jsConstPrefixSnipet = postfix('.const', {
  t('const '),
  i(1, 'variable'),
  f(function(_, parent)
    return " = " .. parent.snippet.env.POSTFIX_MATCH .. ";"
  end, {}),
})

ls.add_snippets("typescript", {
  jsLogSnipet,
  jsLetPrefixSnipet,
  jsConstPrefixSnipet,
})

ls.add_snippets("javascript", {
  jsLogSnipet,
  jsLetPrefixSnipet,
  jsConstPrefixSnipet,
})

ls.add_snippets("javascriptreact", {
  jsLogSnipet,
  jsLetPrefixSnipet,
  jsConstPrefixSnipet,
})

ls.add_snippets("typescriptreact", {
  jsLogSnipet,
  jsLetPrefixSnipet,
  jsConstPrefixSnipet,
})

local formatString4GitMessage = [[{1}({2}): {3}

{4}]]
ls.add_snippets('gitcommit', {
  s("msg", fmt(formatString4GitMessage, {
      i(1, "feat"), i(2, "card_no"), i(3, "messages"), i(4, 'body')
    }))
})

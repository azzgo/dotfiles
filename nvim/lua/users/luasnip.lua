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
local jsLogSnippet = s("log", {
  t("console.log("), i(1, "message"), t(");")
})
local jsLogDebugSnippet = s("logd", {
  t("console.log(\"[DEBUG] \", "), i(1, "message"), t(");")
})
local jsLetPrefixSnippet = postfix('.let', {
  t('let '),
  i(1, 'variable'),
  f(function(_, parent)
    return " = " .. parent.snippet.env.POSTFIX_MATCH .. ";"
  end, {}),
})
local jsConstPrefixSnippet = postfix('.const', {
  t('const '),
  i(1, 'variable'),
  f(function(_, parent)
    return " = " .. parent.snippet.env.POSTFIX_MATCH .. ";"
  end, {}),
})


local jsArrayFunction = s('af', fmt([[({1}) => {{
  {2}
}}
]], { i(1), i(2) }, {}))

local jsxReactFunctionComponentSnippet = s('rfc', fmt([[
const {1} = ({2}) => {{
  return <{3}>{4}</{3}>;
}}

export default {1};
]], { i(1, "Component"), i(2, "props"), i(3), i(4) }, { repeat_duplicates = true }))

local tsInterface = s('i', fmt([[
interface {1} {{
  {2}
}}
]], {i(1, 'name'), i(2) }, {}))

local nextUseClient = s('nuc', { t('"use client";') })

ls.add_snippets("typescript", {
  jsLogSnippet,
  jsLogDebugSnippet,
  jsLetPrefixSnippet,
  jsConstPrefixSnippet,
  jsArrayFunction,
  tsInterface,
})

ls.add_snippets("vue", {
  jsLogSnippet,
  jsLogDebugSnippet,
  jsArrayFunction,
})

ls.add_snippets("javascript", {
  jsLogSnippet,
  jsLogDebugSnippet,
  jsLetPrefixSnippet,
  jsConstPrefixSnippet,
  jsArrayFunction,
})

ls.add_snippets("javascriptreact", {
  jsLogSnippet,
  jsLogDebugSnippet,
  jsLetPrefixSnippet,
  jsConstPrefixSnippet,
  jsArrayFunction,
  jsxReactFunctionComponentSnippet,
  nextUseClient,
})

ls.add_snippets("typescriptreact", {
  jsLogSnippet,
  jsLogDebugSnippet,
  jsLetPrefixSnippet,
  jsConstPrefixSnippet,
  jsArrayFunction,
  jsxReactFunctionComponentSnippet,
  nextUseClient,
  tsInterface,
})

ls.add_snippets('gitcommit', {
  s("msg", fmt("[{scope}][{type}] {description}", {
    scope = i(1, 'scope'),
    type = i(2, 'feat'),
    description = i(3),
  }))
})
--- markdown
local function generate_table_header(cols)
  local header = ""
  local separator = ""

  for j = 1, cols do
    header = header .. "| H" .. j .. " "
    separator = separator .. "| --- "
  end

  header = header .. "|"
  separator = separator .. "|"

  return header .. "\n" .. separator
end

-- Helper function to generate the table rows
local function generate_table_rows(rows, cols)
  local rows_text = ""
  for _ = 1, rows do
    local row = ""
    for _ = 1, cols do
      row = row .. "|   "
    end

    row = row .. "|"
    rows_text = rows_text .. row .. "\n"
  end

  return rows_text
end

ls.add_snippets('markdown', {
  s({ trig = "table(%d+)x(%d+)", regTrig = true }, {
    f(function(_, snip)
      local rows = tonumber(snip.captures[1])
      local cols = tonumber(snip.captures[2])

      if rows and cols then
        local header = generate_table_header(cols)
        local body = generate_table_rows(rows, cols)
        return vim.split(header .. "\n" .. body, '\n', { trimempty = false })
      else
        return "Invalid number of rows or columns"
      end
    end)
  })

});

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
local jsLogSnippet = s({ trig = "log", name = 'console.log()' }, {
  t("console.log("), i(1, "message"), t(");")
})
local jsLogDebugSnippet = s({ trig = "logd", name = 'log debug' }, {
  t("console.log(\"[DEBUG] \", "), i(1, "message"), t(");")
})

local jsLetPrefixSnippet = postfix({ trig = '.let', name = 'let variable' }, {
  t('let '),
  i(1, 'variable'),
  f(function(_, parent)
    return " = " .. parent.snippet.env.POSTFIX_MATCH .. ";"
  end, {}),
})
local jsConstPrefixSnippet = postfix({ trig = '.const', name = 'const variable' }, {
  t('const '),
  i(1, 'variable'),
  f(function(_, parent)
    return " = " .. parent.snippet.env.POSTFIX_MATCH .. ";"
  end, {}),
})


local jsArrayFunction = s({ trig = 'af', name = 'arrow functoin' }, fmt([[({1}) => {{
  {2}
}}
]], { i(1), i(2) }, {}))

local jsxReactFunctionComponentSnippet = s({ trig = 'rfc', name = 'react function component' }, fmt([[
const {1} = ({2}) => {{
  return <{3}>{4}</{3}>;
}}

export default {1};
]], { i(1, "Component"), i(2, "props"), i(3), i(4) }, { repeat_duplicates = true }))

local tsInterface = s({ trig = 'i', name = 'interface'}, fmt([[
interface {1} {{
  {2}
}}
]], { i(1, 'name'), i(2) }, {}))

local nextUseClient = s({ trig = 'nuc', name = 'use client in nextjs' }, { t('"use client";') })

local htmlTagCollection = {
  s("div", { t("<div>"), i(1), t("</div>") }),
  s("span", { t("<span>"), i(1), t("</span>") }),
  s("h1", { t("<h1>"), i(1), t("</h1>") }),
  s("h2", { t("<h2>"), i(1), t("</h2>") }),
  s("h3", { t("<h3>"), i(1), t("</h3>") }),
  s("h4", { t("<h4>"), i(1), t("</h4>") }),
  s("h5", { t("<h5>"), i(1), t("</h5>") }),
  s("h6", { t("<h6>"), i(1), t("</h6>") }),
  s('form', { t('<form>'), i(1), t('</form>') }),
  s('input', { t('<input type="text" name="'), i(1), t('">') }),
  s('textarea', { t('<textarea name="'), i(1), t('">'), i(2), t('</textarea>') }),
  s('button', { t('<button>'), i(1), t('</button>') }),
  s("img", { t('<img src="'), i(1), t('" alt="'), i(2), t('">') }),
  s('a', { t('<a href="'), i(1), t('">'), i(2), t('</a>') }),
  s('p', { t('<p>'), i(1), t('</p>') }),
  s('ul', { t('<ul>'), i(1), t('</ul>') }),
  s('ol', { t('<ol>'), i(1), t('</ol>') }),
  s('li', { t('<li>'), i(1), t('</li>') }),
  s('table', { t('<table>'), i(1), t('</table>') }),
  s('tr', { t('<tr>'), i(1), t('</tr>') }),
  s('td', { t('<td>'), i(1), t('</td>') }),
  s('th', { t('<th>'), i(1), t('</th>') }),
  s('section', { t('<section>'), i(1), t('</section>') }),
  s('article', { t('<article>'), i(1), t('</article>') }),
  s('footer', { t('<footer>'), i(1), t('</footer>') }),
  s('header', { t('<header>'), i(1), t('</header>') }),
  s('main', { t('<main>'), i(1), t('</main>') }),
  s('aside', { t('<aside>'), i(1), t('</aside>') }),
  s('nav', { t('<nav>'), i(1), t('</nav>') }),
  s('link', { t('<link rel="stylesheet" href="'), i(1), t('">') }),
  s('style', { t('<style>'), i(1), t('</style>') }),
  s('head', { t('<head>'), i(1), t('</head>') }),
  s('body', { t('<body>'), i(1), t('</body>') }),
  s('script', { t('<script>'), i(1), t('</script>') }),
  s('html5', fmt([[<!DOCTYPE html>
<html lang="{1}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{2}</title>
  </head>
  <body>
  {3}
  </body>
</html>]], { i(1), i(2), i(3) })),
}

local loremText = s({ trig = 'lorem', name = 'lorem ipsum' },
  { t('Lorem ipsum dolor sit amet, qui minim labore adipisicing minim sint cillum sint consectetur cupidatat.') })
local date = s('date', { t(os.date('%Y-%m-%d')) })
local time = s('time', { t(os.date('%H:%M:%S')) })
local datetime = s('datetime', { t(os.date('%Y-%m-%d %H:%M:%S')) })
local uuid = s('uuid', { t(vim.fn.system('uuidgen | tr -d "\n"')) })


ls.add_snippets('all', {
  loremText,
  date,
  time,
  datetime,
  uuid,
});

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
  unpack(htmlTagCollection),
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
  unpack(htmlTagCollection),
  nextUseClient,
})

ls.add_snippets("typescriptreact", {
  jsLogSnippet,
  jsLogDebugSnippet,
  jsLetPrefixSnippet,
  jsConstPrefixSnippet,
  jsArrayFunction,
  jsxReactFunctionComponentSnippet,
  unpack(htmlTagCollection),
  nextUseClient,
  tsInterface,
})

ls.add_snippets("html", {
  unpack(htmlTagCollection),
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

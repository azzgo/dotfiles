local ok, ls = pcall(require, "luasnip")

if not ok then
  return
end
local utils = require('users.lib.utils')
local s = ls.snippet
local sn = ls.snippet_node
local d = ls.dynamic_node
local t = ls.text_node
local i = ls.insert_node
local f = ls.function_node
local c = ls.choice_node
local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta

-- keymap
vim.keymap.set({ "i" }, "<C-s>", function() ls.expand() end, { silent = true })
vim.keymap.set({ "i", "s" }, "<C-j>", function() ls.jump(1) end, { silent = true })
vim.keymap.set({ "i", "s" }, "<A-e>", function()
  if ls.choice_active() then
    require("luasnip.extras.select_choice")()
    -- NOTE: this is a workaround to make navigation work on snacks.pick.select on the first time
    vim.cmd [[ call feedkeys("\<Backspace>") ]]
  end
end, { silent = true })

local todo_snippet_nodes = function(aliases, opts)
  local aliases_nodes = vim.tbl_map(function(alias)
    return i(nil, alias)
  end, aliases)
  local comment_node = fmta('<> <>: <><><>', {
    f(function()
      return utils.get_cstring(opts.ctype)[1]
    end),
    c(1, aliases_nodes),                      -- [name-of-comment]
    i(2),                                     -- {comment-text}
    f(function()
      return utils.get_cstring(opts.ctype)[2] -- get <comment-string[2]>
    end),
    i(0),
  })
  return comment_node
end

---@param context table merged with the generated context table `trig` must be specified
---@param aliases string[]|string of aliases for the todo comment (ex.: {FIX, ISSUE, FIXIT, BUG})
---@param opts table merged with the snippet opts table
---
local todo_snippet = function(context, aliases, opts)
  opts = opts or {}
  aliases = type(aliases) == 'string' and { aliases } or
      aliases -- if we do not have aliases, be smart about the function parameters
  context = context or {}
  if not context.trig then
    return error("context doesn't include a `trig` key which is mandatory", 2) -- all we need from the context is the trigger
  end
  opts.ctype = opts.ctype or
      1                                                   -- comment type can be passed in the `opts` table, but if it is not, we have to ensure, it is defined
  if type(aliases) == 'string' then
    aliases = { aliases }                                 -- if the aliases are a string, we have to convert it to a table
  end
  local alias_string = table.concat(aliases, '|')         -- `choice_node` documentation
  context.name = context.name or
      (alias_string .. ' comment')                        -- generate the `name` of the snippet if not defined
  context.dscr = context.dscr or
      (alias_string .. ' comment with a signature-mark')  -- generate the `dscr` if not defined
  context.docstring = context.docstring or
      (' {1:' .. alias_string .. '}: {3} <{2:mark}>{0} ') -- generate the `docstring` if not defined
  local comment_node = todo_snippet_nodes(aliases, opts)  -- nodes from the previously defined function for their generation
  return s(context, comment_node, opts)                   -- the final todo-snippet constructed from our parameters
end


--- snippets
local jsLogDebugSnippet = s({ trig = "logd", name = 'log for debug' }, fmt(
  'console.log("🚀 file:{1}-line:{2} ", {3});',
  {
    f(function()
      return utils.get_buffer_shortened_path(20)
    end),
    f(function() return tostring(vim.fn.line('.')) end), -- line number
    i(1, "message"),
  }
))

local jsExportArrowFunction = s({ trig = 'eaf', name = 'export function' }, fmt([[
export const = {1}({2}) => {{
  {3}
}}
]], { i(1, 'name'), i(2, 'params'), i(3) }, {}))

local jsExportFunction = s({ trig = 'ef', name = 'export function' }, fmt([[
export function {1}({2}) {{
  {3}
}}
]], { i(1, 'name'), i(2, 'params'), i(3) }, {}))

local jsFunction = s({ trig = 'f', name = 'function' }, fmt([[
function {1}({2}) {{
  {3}
}}
]], { i(1, 'name'), i(2, 'params'), i(3) }, {}))

local jsArrayFunction = s({ trig = 'af', name = 'arrow functoin' }, fmt([[({1}) => {{
  {2}
}}
]], { i(1), i(2) }, {}))

local vitest = s({ trig = 'vitest', name = 'vite test' },
  fmt([[import {{ describe, expect, test }} from "vitest";

describe("{1}", () => {{
  test("{2}", () => {{
    {3}
  }});
}});
]], { i(1, 'name'), i(2, 'description'), i(3, '') }, {}))

local jsxReactFunctionComponentSnippet = s({ trig = 'rfc', name = 'react function component' }, fmt([[
const {1} = ({2}) => {{
  return <{3}>{4}</{3}>;
}}

export default {1};
]], { i(1, "Component"), i(2, "props"), i(3), i(4) }, { repeat_duplicates = true }))

local tsInterface = s({ trig = 'i', name = 'interface' }, fmt([[
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
local tbi = s('tbi', { t('to be implement') })
local time = s('time', { t(os.date('%H:%M:%S')) })
local datetime = s('datetime', { t(os.date('%Y-%m-%d %H:%M:%S')) })
local uuid = s('uuid', { t(vim.fn.system('uuidgen | tr -d "\n"')) })
local code_location = s({ trig = 'code_loc', name = 'code location' }, fmt(
  '🚀 file:{1}-line:{2}',
  {
    f(function()
      return utils.get_buffer_shortened_path(20)
    end),
    f(function() return tostring(vim.fn.line('.')) end), -- line number
  }
))


ls.add_snippets('all', {
  loremText,
  date,
  tbi,
  time,
  datetime,
  code_location,
  uuid,
  todo_snippet({ trig = 'todo' }, { 'TODO', 'DOING', 'DONE' }, { ctype = 1 }),
  todo_snippet({ trig = 'note' }, { 'NOTE', 'INFO' }, { ctype = 1 }),
  todo_snippet({ trig = 'warn' }, { 'WARN', 'WARNING' }, { ctype = 1 }),
  todo_snippet({ trig = 'iss' }, { 'ISSUE', 'BUG', 'FIXME', 'FIXIT' }, { ctype = 1 }),
  todo_snippet({ trig = 'fail' }, { 'FAIL', 'FAILED' }, { ctype = 1 }),
  todo_snippet({ trig = 'fix' }, { 'FIX', 'BUG', 'FIXME', 'FIXIT' }, { ctype = 1 }),
  todo_snippet({ trig = 'test' }, { 'TEST', 'TESTING', 'PASSED', 'FAILED' }, { ctype = 1 }),
  todo_snippet({ trig = 'perf' }, { 'PERF', 'PERFORMANCE', 'OPTIM', 'OPTIMIZE' }, { ctype = 1 }),
});

local javascriptCommonSnippets = {
  jsLogSnippet,
  jsCountSnippet,
  jsTableSnippet,
  jsLogDebugSnippet,
  jsExportFunction,
  jsExportArrowFunction,
  jsFunction,
  jsArrayFunction,
  vitest,
}

ls.add_snippets("typescript", utils.merge_list(
  javascriptCommonSnippets, {
    tsInterface,
  }))

ls.add_snippets("javascript",
  javascriptCommonSnippets
)

ls.add_snippets("javascriptreact",
  utils.merge_list(
    javascriptCommonSnippets,
    htmlTagCollection,
    {
      jsxReactFunctionComponentSnippet,
      nextUseClient,
    })
)

ls.add_snippets("typescriptreact", utils.merge_list(
  javascriptCommonSnippets,
  htmlTagCollection,
  {
    jsxReactFunctionComponentSnippet,
    nextUseClient,
    tsInterface,
  }))

ls.add_snippets("vue", utils.merge_list(
  javascriptCommonSnippets,
  htmlTagCollection
))

ls.add_snippets("html",
  htmlTagCollection
)

ls.add_snippets('gitcommit', {
  s("msg", fmt("[{scope}][{type}] {description}", {
    scope = i(1, 'scope'),
    type = i(2, 'feat'),
    description = i(3),
  }))
})

--- markdown
local function generate_table_header(cols)
  local header = {}
  local separatorLine = ""

  for j = 1, cols do
    table.insert(header, t("| "))
    table.insert(header, i(j, "Header " .. j .. " "))
    separatorLine = separatorLine .. "| --- "
  end

  table.insert(header, t({ "|", "" }))
  separatorLine = separatorLine .. "|"

  table.insert(header, t(separatorLine))
  return header
end


ls.add_snippets('markdown', {
  s({ trig = "table(%d+)", regTrig = true, desc = 'Generate table with columns' }, {
    d(1, function(_, snip)
      local cols = tonumber(snip.captures[1])

      if cols and cols > 0 then
        local headers = generate_table_header(cols)
        return sn(nil, headers)
      else
        vim.notify("Invalid number of columns")
        return sn(nil, { t(snip.trigger) })
      end
    end)
  }),
  s("h1", { t("# ") }),
  s("h2", { t("## ") }),
  s("h3", { t("### ") }),
  s("h4", { t("#### ") }),
  s("h5", { t("##### ") }),
  s("h6", { t("###### ") }),
  s('b', { t('**'), i(1), t('**') }),
  s('i', { t('*'), i(1), t('*') }),
  s('s', { t('~~'), i(1), t('~~') }),
  s('c', { t('```'), i(1), t('\n'), i(2), t('\n'), t('```') }),
  s('l', { t('['), i(1), t(']('), i(2), t(')') }),
});

require('users.lib.coc-luasnip-adapter');

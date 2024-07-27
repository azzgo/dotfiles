local ok, comment = pcall(require, "Comment")

if not ok then
  return
end

comment.setup({
  mappings = {
    basic = true,
    extro = false,
  }
})

local ft = require('Comment.ft')

ft.set('vue', {'//%s', '/*%s*/'});

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

-- .env 类文件使用 shell 风格 (#) 注释
ft.set('dotenv', '#%s')
ft.set('env', '#%s')

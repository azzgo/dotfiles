local ok, todo = pcall(require, "todo-comments")
if not ok then
	return
end

-- TODO: 123123123 
todo.setup {
  signs = false, 
  highlight = {
    keyword = "fg",
    after="fg"
  }
}

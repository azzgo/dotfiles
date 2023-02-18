local ok, todo = pcall(require, "todo-comments")
if not ok then
	return
end

todo.setup {
  signs = false,
  highlight = {
    keyword = "fg",
    after="fg"
  }
}

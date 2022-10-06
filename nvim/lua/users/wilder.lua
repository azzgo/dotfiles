local ok, wilder = pcall(require, "wilder")
if not ok then
	return
end
wilder.setup({
	modes = { ":", "/", "?" },
	previous_key = "<m-p>",
	next_key = "<m-n>",
})
wilder.set_option(
	"renderer",
	wilder.popupmenu_renderer({
		-- highlighter applies highlighting to the candidates
		highlighter = wilder.basic_highlighter(),
	})
)

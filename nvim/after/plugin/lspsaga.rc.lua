if vim.g.loaded_lspsaga == nil then
	return
end

local saga = require("lspsaga")

saga.init_lsp_saga({
	border_style = "round",
  code_action_prompt = {
    sign = false,
  }
})


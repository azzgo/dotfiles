local ok, saga = pcall(require,"lspsaga")

if not ok then
  return
end

saga.init_lsp_saga({
	border_style = "round",
  code_action_prompt = {
    sign = false,
  },
  rename_prompt_prefix = "",
})


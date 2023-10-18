local ok, tabnine = pcall(require, "tabnine")

if not ok then
  return
end

tabnine.setup({
  disable_auto_comment=true,
  accept_keymap="<Tab>",
  dismiss_keymap = "<C-]>",
  debounce_ms = 800,
  suggestion_color = {gui = "#808080", cterm = 244},
  exclude_filetypes = {"leaderf", "oil"},
  log_file_path = nil, -- absolute path to Tabnine log file
})

local ok, gen = pcall(require, "gen")

if not ok then
  return
end
gen.setup({
  model = 'codellama:7b',
  host = "localhost",         -- The host running the Ollama service.
  port = "11434",             -- The port on which the Ollama service is listening.
  display_mode = "float",     -- The display mode. Can be "float" or "split".
  debug = true,
})

vim.keymap.set({ 'n', 'v' }, '<leader>]', ':Gen<CR>')

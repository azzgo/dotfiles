local ok, persistence = pcall(require, "persistence")

if not ok then
  return
end

persistence.setup({
  dir = vim.g.dot_config_path .. "/.local" .. "/sessions/",
  need = 1,
})

persistence.stop()

local function session_popup()
  local menu = {
    'save',
    'load',
    'select',
  }
  vim.fn['_L_FZF_WRAPPER_RUN_']({
    source = menu,
    options = { '--prompt', 'sessions menu: ', '--layout=reverse-list', '--cycle' },
    sink = function(action)
      if action == 'load' then
        persistence.load({ last = true })
      elseif action == 'select' then
        persistence.select()
      elseif action == 'save' then
        persistence.save()
      end
    end
  })
end

vim.keymap.set("n", "<C-p>", function() session_popup() end)

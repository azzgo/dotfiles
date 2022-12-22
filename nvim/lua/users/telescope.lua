local ok, telescope = pcall(require, "telescope")

if not ok then
	return
end

local actions = require("telescope.actions")
telescope.setup({
  defaults = {
    path_display = {
      shorten = { len = 1, exclude = { -1, -2 } }, 
      truncate = 3
    }
  },
	extensions = {
		fzf = {
			fuzzy = true, -- false will only do exact matching
			override_generic_sorter = true, -- override the generic sorter
			override_file_sorter = true, -- override the file sorter
			case_mode = "smart_case", -- or "ignore_case" or "respect_case"
			-- the default case_mode is "smart_case"
		},
		defaults = {
			mappings = {
				i = {
					["<esc>"] = actions.close,
				},
			},
		},
	},
})
-- To get fzf loaded and working with telescope, you need to call
-- load_extension, somewhere after setup function:
telescope.load_extension("fzf")
local buildin = require("telescope.builtin")
local opts = { noremap = true, silent = true }
-- nvim_set_keymap
vim.keymap.set("n", "<leader>f", function()
	buildin.find_files({ debounce = 150 })
end, opts)
vim.keymap.set("n", "<leader>/", function()
	buildin.live_grep({ debounce = 150 })
end, opts)
vim.keymap.set("n", "<leader>b", function()
	buildin.buffers()
end, opts)
vim.keymap.set("n", "<leader>to", function()
	buildin.oldfiles()
end, opts)
vim.keymap.set("n", "<leader>tq", function()
	buildin.quickfix()
end, opts)

-- resume
vim.keymap.set("n", "<leader>tr", function()
	buildin.resume()
end, opts)

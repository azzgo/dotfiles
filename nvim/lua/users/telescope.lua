local ok, telescope = pcall(require, "telescope")

if not ok then
	return
end

local actions = require("telescope.actions")
telescope.setup({
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
					["<esc>"] = actions.close
				},
			},
		},
	},
})
-- To get fzf loaded and working with telescope, you need to call
-- load_extension, somewhere after setup function:
telescope.load_extension("fzf")

-- nvim_set_keymap
vim.api.nvim_set_keymap(
	"n",
	"<leader>f",
	"<cmd>lua require('telescope.builtin').find_files({ debounce = 150 })<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>/",
	"<cmd>lua require('telescope.builtin').live_grep({ debounce = 150 })<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>b",
	"<cmd>lua require('telescope.builtin').buffers()<cr>",
	{ noremap = true, silent = true }
)

-- resume
vim.api.nvim_set_keymap(
	"n",
	"ggr",
	"<cmd>lua require('telescope.builtin').resume()<cr>",
	{ noremap = true, silent = true }
)

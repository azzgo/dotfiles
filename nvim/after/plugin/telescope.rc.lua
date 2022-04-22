if vim.g.loaded_telescope == nill then
	return
end

require("telescope").setup({
	defaults = {
		preview = {
			filesize_limit = 5,
			filesize_hook = function(filepath, bufnr, opts)
				local max_bytes = 10000
				local cmd = { "head", "-c", max_bytes, filepath }
				require("telescope.previewers.utils").job_maker(cmd, bufnr, opts)
			end,
		},
		file_ignore_patterns = {
			-- ignore minilized file
			"min.js$",
			"chunk.js$",
			"chunk.css$",
			"js.map$",
			"css.map$",
			"min.css$",
		},
	},
	extensions = {
		fzf = {
			fuzzy = true, -- false will only do exact matching
			override_generic_sorter = true, -- override the generic sorter
			override_file_sorter = true, -- override the file sorter
			case_mode = "ignore_case", -- or "ignore_case" or "respect_case"
			-- the default case_mode is "smart_case"
		},
	},
})
-- To get fzf loaded and working with telescope, you need to call
-- load_extension, somewhere after setup function:
require("telescope").load_extension("fzf")

-- nvim_set_keymap
vim.api.nvim_set_keymap(
	"n",
	"<leader>ff",
	"<cmd>lua require('telescope.builtin').find_files { previewer = false, find_command={ 'fd', '--type', 'f', '--ignore', '--hidden' , '--strip-cwd-prefix' } }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fg",
	"<cmd>lua require('telescope.builtin').live_grep { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fc",
	"<cmd>lua require('telescope.builtin').find_files( { previewer = false, cwd = vim.fn.expand('%:p:h') })<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fq",
	"<cmd>lua require('telescope.builtin').quickfix { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fb",
	"<cmd>lua require('telescope.builtin').buffers { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"<leader>fh",
	"<cmd>lua require('telescope.builtin').help_tags { previewer = false }<cr>",
	{ noremap = true, silent = true }
)

vim.api.nvim_set_keymap(
	"n",
	"gr",
	"<cmd>lua require('telescope.builtin').lsp_references { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gd",
	"<cmd>lua require('telescope.builtin').lsp_definitions { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gi",
	"<cmd>lua require('telescope.builtin').lsp_implementations { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gD",
	"<cmd>lua require('telescope.builtin').lsp_type_definitions { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"gK",
	"<cmd>lua require('telescope.builtin').diagnostics { previewer = false }<cr>",
	{ noremap = true, silent = true }
)
vim.api.nvim_set_keymap(
	"n",
	"ca",
	"<cmd>lua require('telescope.builtin').lsp_code_actions { previewer = false }<cr>",
	{ noremap = true, silent = true }
)

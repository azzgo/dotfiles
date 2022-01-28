if !exists('g:loaded_telescope') | finish | endif

lua << EOF

require('telescope').setup {
  defaults = {
    preview = {
      filesize_limit = 5,
      filesize_hook = function(filepath, bufnr, opts)
           local max_bytes = 10000
           local cmd = {"head", "-c", max_bytes, filepath}
           require('telescope.previewers.utils').job_maker(cmd, bufnr, opts)
       end
    },
    file_ignore_patterns = {
       -- ignore minilized file
       "min.js$",
       "chunk.js$",
       "chunk.css$",
       "js.map$",
       "css.map$",
       "min.css$",
    }
  },
  extensions = {
    fzf = {
      fuzzy = true,                    -- false will only do exact matching
      override_generic_sorter = true,  -- override the generic sorter
      override_file_sorter = true,     -- override the file sorter
      case_mode = "ignore_case",        -- or "ignore_case" or "respect_case"
                                       -- the default case_mode is "smart_case"
    }
  }
}
-- To get fzf loaded and working with telescope, you need to call
-- load_extension, somewhere after setup function:
require('telescope').load_extension('fzf')

EOF

nnoremap <leader>ff <cmd>lua require('telescope.builtin').find_files { previewer = false }<cr>
nnoremap <leader>fg <cmd>lua require('telescope.builtin').live_grep()<cr>
nnoremap <leader>fb <cmd>lua require('telescope.builtin').buffers()<cr>
nnoremap <leader>fh <cmd>lua require('telescope.builtin').help_tags()<cr>
nnoremap gr <cmd>lua require('telescope.builtin').lsp_references()<cr>
nnoremap gd <cmd>lua require('telescope.builtin').lsp_definitions()<cr>
nnoremap gi <cmd>lua require('telescope.builtin').lsp_implementations()<cr>
nnoremap gD <cmd>lua require('telescope.builtin').lsp_type_definitions()<cr>
nnoremap gK <cmd>lua require('telescope.builtin').diagnostics()<cr>
nnoremap <leader>o <cmd>lua require('telescope.builtin').lsp_document_symbols()<cr>
nnoremap <leader>ca <cmd>lua require('telescope.builtin').lsp_code_actions()<cr>

if !exists('g:loaded_telescope') | finish | endif


nnoremap <leader>ff <cmd>lua require('telescope.builtin').find_files()<cr>
nnoremap <leader>fg <cmd>lua require('telescope.builtin').live_grep()<cr>
nnoremap <leader>fb <cmd>lua require('telescope.builtin').buffers()<cr>
nnoremap <leader>fh <cmd>lua require('telescope.builtin').help_tags()<cr>
nnoremap gr <cmd>lua require('telescope.builtin').lsp_references()<cr>
nnoremap <leader>o <cmd>lua require('telescope.builtin').lsp_document_symbols()<cr>

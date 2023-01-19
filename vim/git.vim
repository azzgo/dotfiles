nnoremap <silent><leader>hp :SignifyHunkDiff<cr>
nnoremap <silent><leader>hr :SignifyHunkUndo<cr>

nnoremap ]h <plug>(signify-next-hunk)
nnoremap [h <plug>(signify-prev-hunk)

nnoremap <leader>gg :<c-u>G 
nnoremap <leader>gs :<c-u>G<CR>
nnoremap <leader>gb :<c-u>G blame<CR>
nnoremap <leader>gh :<c-u>G rev-parse HEAD<CR>

" customized command
command! -nargs=0 Gprp :G pull -r | :G push

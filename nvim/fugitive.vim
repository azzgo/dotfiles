nnoremap <leader>gg :<c-u>G<CR>
nnoremap <leader>gb :<c-u>G blame<CR>
nnoremap <leader>gh :<c-u>G rev-parse HEAD<CR>

" customized command
command! -nargs=0 Gprp :G pull -r | :G push

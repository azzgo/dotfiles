nnoremap <leader>gg :<c-u>G<CR>
nnoremap <leader>ga :<c-u>G add
nnoremap <leader>gp :<c-u>G push<CR>
nnoremap <leader>gup :<c-u>G pull --rebase<CR>
nnoremap <leader>gc :<c-u>G commit -v<CR>
nnoremap <leader>gb :<c-u>G blame<CR>

command! -nargs=0 Gprp :G pull -r<CR> | : G push


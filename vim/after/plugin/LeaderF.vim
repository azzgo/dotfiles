let g:Lf_WindowPosition = 'popup'
let g:Lf_PopupAutoAdjustHeight = 0

function! s:GREP_STRING()
  let s:search = input("Grep> ")
  execute 'Leaderf rg --input "' . s:search . '"'
endfunction

nnoremap <leader>tr :Leaderf --recall<CR>
nnoremap <leader>to :Leaderf mru<CR>
nnoremap <leader>tq :Leaderf quickfix<CR>
nnoremap <leader>/  :call <SID>GREP_STRING()<CR>
nnoremap <leader>f  :Leaderf file<CR>
nnoremap <leader>m  :Leaderf marks<CR>
nnoremap <leader>gf :Leaderf bcommit<CR>

nnoremap <silent> <leader>b :Leaderf buffer<cr>


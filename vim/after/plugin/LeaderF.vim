let g:Lf_WindowPosition = 'popup'

function! s:GREP_STRING()
  let s:search = input("Grep> ")
  execute 'Leaderf rg --input "' . s:search . '"'
endfunction

nnoremap <leader>/ :call <SID>GREP_STRING()<CR>
nnoremap <leader>f :Leaderf file<CR>

nnoremap <silent> <leader>b :Leaderf buffer<cr>


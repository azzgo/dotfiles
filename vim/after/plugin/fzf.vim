let g:fzf_preview_window = ['right,50%', 'ctrl-/']
let g:fzf_layout = { 'window': { 'width': 0.9, 'height': 0.6 } }

nnoremap <silent><leader>f :Files<cr>

function! s:FZF_GREP_STRING()
  let s:search = input("Grep> ")
  call fzf#vim#grep("rg --column --line-number --no-heading --color=always --smart-case -- ".shellescape(s:search), 1, fzf#vim#with_preview())
endfunction

" nnoremap <leader>/ :Rg 
nnoremap <leader>/ :call <SID>FZF_GREP_STRING()<CR>

nnoremap <silent> <leader>b :Buffers<cr>

nnoremap <silent> <leader>tc :Commands<cr>
nnoremap <silent> <leader>tg :BCommits<cr>


let g:Lf_PreviewResult = {
        \ 'File': 0,
        \ 'Buffer': 0,
        \ 'Mru': 0,
        \ 'Tag': 1,
        \ 'BufTag': 0,
        \ 'Function': 1,
        \ 'Line': 1,
        \ 'Colorscheme': 1,
        \ 'Rg': 1,
        \ 'Gtags': 1
        \}

function! s:GREP_STRING()
  let s:search = input("Grep> ")
  execute 'Leaderf rg --input "' . s:search . '"'
endfunction

function! s:FIND_FILES()
  let s:search = input("File> ")
  execute 'Leaderf file --input "' . s:search . '"'
endfunction

nnoremap <leader>tr :Leaderf --recall<CR>
nnoremap <leader>to :Leaderf mru<CR>
nnoremap <leader>tq :Leaderf quickfix<CR>
nnoremap <leader>/  :call <SID>GREP_STRING()<CR>
nnoremap <leader>f  :Leaderf file<CR>
nnoremap <leader><s-f>  :call <SID>FIND_FILES()<CR>
nnoremap <leader>m  :Leaderf marks<CR>
nnoremap <leader>gl :Leaderf git log --explorer --left<CR>
nnoremap <leader>gf :Leaderf git log --current --left<CR>

nnoremap <silent> <leader>b :Leaderf buffer<cr>


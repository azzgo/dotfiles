let g:coc_config_home=g:dot_config_path . '/coc'
exe 'source' (g:dot_config_path . '/coc/coc.vim')

nnoremap <silent> K :call ShowDocumentation()<CR>

function! ShowDocumentation()
 if CocAction('hasProvider', 'hover')
   call CocActionAsync('doHover')
 else
   call feedkeys('K', 'in')
 endif
endfunction


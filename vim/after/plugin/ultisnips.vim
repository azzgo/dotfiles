let g:UltiSnipsSnippetDirectories = [g:dot_config_path  . '/ultisnips']
let g:UltiSnipsExpandTrigger="<c-s>"
inoremap <C-s> <C-R>=UltiSnips#ExpandSnippet()<cr>
let g:UltiSnipsJumpForwardTrigger="<c-j>"
let g:UltiSnipsJumpBackwardTrigger="<c-k>"

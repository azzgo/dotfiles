" mappings
nmap <leader>s <Plug>(easymotion-sn)
xmap <leader>s <Plug>(easymotion-sn)
omap <leader>s <Plug>(easymotion-sn)
nmap <leader>a <Plug>(easymotion-jumptoanywhere)
xmap <leader>a <Plug>(easymotion-jumptoanywhere)
omap <leader>a <Plug>(easymotion-jumptoanywhere)
nmap <leader>S <Plug>(easymotion-s)
xmap <leader>S <Plug>(easymotion-s)
omap <leader>S <Plug>(easymotion-s)

" https://github.com/neoclide/coc.nvim/issues/110#issuecomment-768264638
autocmd User EasyMotionPromptBegin silent! CocDisable
autocmd User EasyMotionPromptEnd silent! CocEnable

let g:EasyMotion_re_anywhere = '\v' .
    \       '(\s\zs\S)' . '|' . '(^\S)'

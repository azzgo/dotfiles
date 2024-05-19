" mappings
nmap s <Plug>(easymotion-sn)
nmap S <Plug>(easymotion-s)

" https://github.com/neoclide/coc.nvim/issues/110#issuecomment-768264638
autocmd User EasyMotionPromptBegin silent! CocDisable
autocmd User EasyMotionPromptEnd silent! CocEnable

let g:EasyMotion_re_anywhere = '\v' .
    \       '(\s\zs\S)' . '|' . '(^\S)'

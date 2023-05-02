" mappings
nmap s <Plug>(easymotion-s)
xmap s <Plug>(easymotion-s)
omap <leader>s <Plug>(easymotion-s)
nmap S <Plug>(easymotion-sn)
xmap S <Plug>(easymotion-sn)
omap <leader>S <Plug>(easymotion-sn)

" https://github.com/neoclide/coc.nvim/issues/110#issuecomment-768264638
autocmd User EasyMotionPromptBegin silent! CocDisable
autocmd User EasyMotionPromptEnd silent! CocEnable

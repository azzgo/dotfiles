" mappings
nmap <leader>s <Plug>(easymotion-sn)
xmap <leader>s <Plug>(easymotion-sn)
omap <leader>s <Plug>(easymotion-sn)
nmap <leader>S <Plug>(easymotion-s)
xmap <leader>S <Plug>(easymotion-s)
omap <leader>S <Plug>(easymotion-s)

" https://github.com/neoclide/coc.nvim/issues/110#issuecomment-768264638
autocmd User EasyMotionPromptBegin silent! CocDisable
autocmd User EasyMotionPromptEnd silent! CocEnable

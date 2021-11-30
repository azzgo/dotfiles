if !exists('g:loaded_symbols_outline') | finish | endif

lua << EOF
-- issue here: https://github.com/simrat39/symbols-outline.nvim/issues/62
local symbols_outline = require("symbols-outline")
symbols_outline.setup {
  position = 'left',
  relative_width = true,
  width = 50,
  auto_preview = false,
}
EOF

nnoremap <silent> <leader>o :SymbolsOutline<CR>

if !exists('g:loaded_nvim_treesitter')
  echom "Not loaded treesitter"
  finish
endif

lua << EOF
require'nvim-treesitter.configs'.setup {
  ensure_installed = {
    "tsx",
    "json",
    "yaml",
    "html",
    "scss",
    "vue",
    "go",
    "fish",
    "lua",
  },
  highlight = {
    enable = false,
  }
}

local ft_to_parser = require "nvim-treesitter.parsers".filetype_to_parsername
ft_to_parser.javascript = 'tsx'
ft_to_parser["typescript.tsx"] = 'tsx'
EOF

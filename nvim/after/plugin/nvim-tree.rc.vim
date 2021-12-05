lua << EOF
local nvim_tree = require('nvim-tree')

nvim_tree.setup {
  disable_netrw       = true,
  hijack_netrw        = true,
  open_on_setup       = false,
  ignore_ft_on_setup  = {},
  update_to_buf_dir   = {
    enable = true,
    auto_open = true,
  },
  auto_close          = false,
  open_on_tab         = false,
  hijack_cursor       = false,
  update_cwd          = false,
  diagnostics         = {
    enable = false,
    icons = {
      hint = "",
      info = "",
      warning = "",
      error = "",
    }
  },
  update_focused_file = {
    enable      = false,
    update_cwd  = false,
    ignore_list = {}
  },
  system_open = {
    cmd  = nil,
    args = {}
  },
  git = {
    enable = true,
    ignore = true,
  },
  view = {
    width = 30,
    height = 30,
    side = 'left',
    auto_resize = false,
    number = false,
    relativenumber = false,
    mappings = {
      custom_only = false,
      list = {}
    }
  },
  filters = {
    dotfiles = false,
    custom = {}
  },
  trash = {
    cmd = "trash",
    require_confirm = true,
  }
}
EOF

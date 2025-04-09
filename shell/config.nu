$env.config = {
  show_banner: false,
}

if (which nvim | length) != 0 {
  $env.config.buffer_editor = "nvim"
} else if (which vim | length) != 0 {
  $env.config.buffer_editor = "vim"
}

alias ll = ls -l
alias g = git
alias ga = git add
alias gc = git commit -v
alias gcn = git commit -v --no-verify
alias gca = git commit -v --amend --no-edit
alias gup = git pull --rebase
alias gp = git push
alias gpn = git push --no-verify
alias gst = git status
alias gco = git checkout
alias grb = git rebase
alias grbc = git rebase --continue
alias grba = git rebase --abort
alias gscf = git diff-tree --no-commit-id --name-only -r
def gprp [] { git pull --rebase; git push }

def v [...x] {
  if (which nvim | length) != 0 {
    if ($x | length) == 0 {
      nvim
    } else {
      nvim ($x | str join)
    }
  } else if (which vim | length) != 0 {
    if ($x |length) == 0 {
      vim
    } else {
      vim ($x | str join)
    }
  }
}

def vi [...x] {
  # if nvim if v is nvim; else if vim v is vim
  if (which vim | length) != 0 {
    if ($x | length) == 0 {
      vim
    } else {
      vim ($x | str join)
    }
  } 
}

def --env --wrapped lfc [...args: string] { 
  cd (lf -print-last-dir ...$args)
}

$env.config = {
  show_banner: false,
}

if (which nvim) != nil {
  $env.config.buffer_editor = "nvim"
} else if (which vim) != nil {
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

def v [] {
  if (which nvim) != nil {
    nvim
  } else if (which vim) != nil {
    vim
  }
}

def vi [] {
  # if nvim if v is nvim; else if vim v is vim
  if (which vim) != nil {
    vim
  } 
}

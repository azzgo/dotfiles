
" customized command
command! -bang -bar -nargs=0 Gprp execute 'AsyncRun<bang> -cwd=' .
          \ fnamemodify(FugitiveGitDir(), ":h:S") 'git pull --rebase && git push' <q-args>

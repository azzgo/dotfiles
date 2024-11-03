let g:Lf_PreviewResult = {
        \ 'File': 0,
        \ 'Buffer': 0,
        \ 'Mru': 0,
        \ 'Tag': 1,
        \ 'BufTag': 0,
        \ 'Function': 1,
        \ 'Line': 1,
        \ 'Colorscheme': 1,
        \ 'Rg': 1,
        \ 'Gtags': 1
        \}

let g:Lf_WildIgnore = {
      \ 'dir': ['.svn','.git','.hg', 'node_modules'],
      \ 'file': ['*.sw?','~$*','*.bak','*.exe','*.o','*.so','*.py[co]', '*.DS_store']
      \}

function! s:GREP_STRING()
  let s:search = input("Grep> ")
  execute 'Leaderf rg --nameOnly --input "' . s:search . '"'
endfunction

function! s:FIND_FILES()
  let s:search = input("File> ")
  execute 'Leaderf file --input "' . s:search . '"'
endfunction

function! s:GREP_WORD()
  let s:word = input("Grep Word> ")
  execute 'Leaderf rg --regexMode --input "\<' . s:word . '\>"'
endfunction



function! s:LEADERF_COMMANDS_ACTIONS(what)
  if a:what == 'recall'
    Leaderf --recall
  elseif a:what == 'mru'
    Leaderf mru
  elseif a:what == 'marks'
    Leaderf marks
  elseif a:what == 'quickfix'
    Leaderf quickfix
  elseif a:what == 'git'
    Leaderf git
  endif
endfunction

function! s:LEADERF_COMMANDS()
  let source = ['mru', 'recall', 'marks', 'quickfix', 'git']
	let opts = { 'source': source, 'sink': function('s:LEADERF_COMMANDS_ACTIONS') }
	if exists('g:fzf_layout')
		for key in keys(g:fzf_layout)
			let opts[key] = deepcopy(g:fzf_layout[key])
		endfor
	endif
	call fzf#run(fzf#wrap(opts))
endfunction

nnoremap <leader>t :call <SID>LEADERF_COMMANDS()<CR>

nnoremap <leader>/  :call <SID>GREP_STRING()<CR>
nnoremap <leader>\  :call <SID>GREP_WORD()<CR>
nnoremap <leader>f  :call <SID>FIND_FILES()<CR>

nnoremap <silent> <leader>b :Leaderf buffer<cr>


let g:Lf_WindowPosition = 'popup'
let g:Lf_PopupAutoAdjustHeight = 0
let g:Lf_PopupWidth = 0.45
let g:Lf_PopupHeight = 0.6

let g:Lf_PreviewResult = {
        \ 'File': 0,
        \ 'Buffer': 0,
        \ 'Mru': 0,
        \ 'Tag': 0,
        \ 'BufTag': 0,
        \ 'Function': 1,
        \ 'Line': 1,
        \ 'Colorscheme': 1,
        \ 'Rg': 0,
        \ 'Gtags': 0
        \}

let g:Lf_WildIgnore = {
      \ 'dir': ['.svn','.git','.hg', 'node_modules'],
      \ 'file': ['*.sw?','~$*','*.bak','*.exe','*.o','*.so','*.py[co]', '*.DS_store']
      \}

function! s:GREP_STRING(str)
  if a:str == v:null
    let s:search = input("Grep> ")
  else
    let s:search = trim(escape(substitute(a:str, '\n', ' ', 'g'), '"'), '"')
  endif
  execute 'Leaderf rg --nameOnly --input "' . s:search . '"'
endfunction

function! s:FIND_FILES()
  let s:search = input("File> ")
  let s:search = trim(s:search)
  execute 'Leaderf file --input "' . s:search . '"'
endfunction


function! s:LEADERF_COMMANDS_ACTIONS(what)
  if a:what == 'recall'
    Leaderf --recall
  elseif a:what == 'mru'
    Leaderf mru
  elseif a:what == 'window'
    Leaderf window
  elseif a:what == 'quickfix'
    Leaderf quickfix
  elseif a:what == 'cword'
    Leaderf rg --cword
  elseif a:what == 'syank'
    execute <SID>GREP_STRING(@")
  endif
endfunction

function! s:LEADERF_COMMANDS()
  let source = ['mru', 'recall', 'window', 'quickfix', 'cword', 'syank']
	let opts = { 'source': source, 'sink': function('s:LEADERF_COMMANDS_ACTIONS') }
	if exists('g:fzf_layout')
		for key in keys(g:fzf_layout)
			let opts[key] = deepcopy(g:fzf_layout[key])
		endfor
	endif
	call fzf#run(fzf#wrap(opts))
endfunction

nnoremap <leader>l :call <SID>LEADERF_COMMANDS()<CR>

nnoremap <leader>/  :call <SID>GREP_STRING(v:null)<CR>
nnoremap <leader>f  :call <SID>FIND_FILES()<CR>
nnoremap <leader>c  :Leaderf command<CR>

nnoremap <silent> <leader>b :Leaderf buffer<cr>


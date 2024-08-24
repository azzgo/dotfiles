function! coc#source#mermaid#init() abort
  return {
        \ 'shortcut': 'keyword',
        \ 'filetype': ['marmaid'],
    \}
endfunction

function! coc#source#mermaid#complete(option, cb) abort
  let items = ['subgraph','loop','alt','else','opt','par','and','rect','end',
        \'classDiagram', 'classDiagram-v2', 'erDiagram', 'gantt', 'graph', 
        \'flowchart', 'pie', 'sequenceDiagram', 'stateDiagram', 'stateDiagram-v2', 'gitGraph',
        \'note', 'left of', 'right of', 'over', 'class', 'options', 'commit', 'branch', 'merge', 'reset', 'checkout',
        \'participant','activate','deactivate',
        \'journey', 'title', 'section',
        \'quadrantChart', 'x-axis', 'y-axis', 'quadrant-1', 'quadrant-2', 'quadrant-3', 'quadrant-4',
        \]
  call a:cb(items)
endfunction

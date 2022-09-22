syn match   ysDelimiter   /%%/
syn match   ysComment   /^#.*/

hi def link ysDelimiter SpecialChar
hi def link ysComment Comment

let b:current_syntax = 'ys'

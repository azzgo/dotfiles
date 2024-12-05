  function! coc#source#luasnip#init() abort
    return luaeval('coc_source_luasnip_init()')
  endfunction

  function! coc#source#luasnip#complete(option, cb) abort
    let items = luaeval('coc_source_luasnip_complete(_A[1])', [a:option])
    call a:cb(items)
  endfunction

  function! coc#source#luasnip#on_complete(item) abort
    call luaeval('coc_source_luasnip_on_complete(_A[1])', [a:item])
  endfunction

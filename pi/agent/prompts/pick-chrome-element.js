/*
 * pick-chrome-element.js — 元素拾取悬浮按钮注入器
 *
 * 使用方式：由 prompt 通过 chrome-devtools MCP 的 evaluate_script 注入。
 * 整个文件就是一个函数表达式，原样作为 function 参数传入，执行后返回 true。
 *
 * 交互：
 *   - 悬浮按钮（fab）可拖动，点击进入拾取模式（无热键）
 *   - 拾取模式：hover 高亮 · [ ] 切层 · 1-9 跳层 · Enter / 点击 选中
 *   - 选中后弹备注框（可留空直接回车）· Esc 取消选中 / 退出拾取
 *   - 选中结果写入 sessionStorage['pi.picks']（同 selector 去重，替换更新）
 *   - React fiber / Vue 组件源码位置提取（仅 dev 构建有 _debugSource / __file）
 *
 * 存储契约：
 *   - sessionStorage['pi.picks'] : 批次数组 [{selector, xpath, tagName, textPreview,
 *     rect, note, ts, url, source}]
 *   - sessionStorage['pi.fabPos'] : fab 位置 {x, y}
 *   - window.__PI_PICKER__   : 注入标记（幂等判断）
 *   - window.__PI_PICKS_API__ : { refresh() } 供外部（agent 清空存储后）刷新角标
 */
() => {
  'use strict';

  if (window.__PI_PICKER__) return true;
  window.__PI_PICKER__ = true;

  const KEY_PICKS = 'pi.picks';
  const KEY_POS = 'pi.fabPos';
  const HOST_FLAG = 'data-pi-pick-host';
  const MAX_DEPTH = 8;

  // ---------- 批次存储 ----------
  function loadBatch() {
    try {
      const s = sessionStorage.getItem(KEY_PICKS);
      return s ? JSON.parse(s) : [];
    } catch (e) { return []; }
  }
  function saveBatch(b) {
    try { sessionStorage.setItem(KEY_PICKS, JSON.stringify(b)); }
    catch (e) { /* 隐私模式/配额：忽略 */ }
  }
  function addPick(rec) {
    const b = loadBatch();
    const i = b.findIndex((x) => x.selector === rec.selector);
    if (i >= 0) { b[i] = rec; toast('已更新 ' + rec.selector); }
    else { b.push(rec); toast('已选中 ' + rec.selector); }
    saveBatch(b);
    refreshCount();
  }

  // ---------- DOM 工具 ----------
  const cssEscape = (s) => (window.CSS && CSS.escape)
    ? CSS.escape(s)
    : String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);

  function cssPath(el) {
    if (el.id) return '#' + cssEscape(el.id);
    const parts = [];
    let cur = el, depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement && depth < MAX_DEPTH) {
      let sel = cur.nodeName.toLowerCase();
      if (cur.id) { parts.unshift('#' + cssEscape(cur.id)); break; }
      const stable = ['data-testid', 'data-test', 'data-component', 'data-cy', 'name']
        .find((a) => cur.getAttribute && cur.getAttribute(a));
      if (stable) {
        parts.unshift(sel + '[' + stable + '="' + cssEscape(String(cur.getAttribute(stable))) + '"]');
      } else {
        const cls = Array.from(cur.classList || []).filter((c) => c.length > 1).slice(0, 2);
        if (cls.length) {
          parts.unshift(sel + '.' + cls.map(cssEscape).join('.'));
        } else {
          const sibs = cur.parentElement
            ? Array.from(cur.parentElement.children).filter((s) => s.nodeName === cur.nodeName)
            : [cur];
          if (sibs.length > 1) sel += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
          parts.unshift(sel);
        }
      }
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ') || el.nodeName.toLowerCase();
  }

  function xPath(el) {
    if (el.id) return '//*[@id="' + el.id + '"]';
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let i = 1, sib = cur;
      while ((sib = sib.previousElementSibling)) { if (sib.nodeName === cur.nodeName) i++; }
      parts.unshift(cur.nodeName.toLowerCase() + '[' + i + ']');
      cur = cur.parentElement;
    }
    return '/' + parts.join('/');
  }

  function selectorPreview(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) s += '.' + Array.from(el.classList).slice(0, 2).join('.');
    return s;
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 框架源码提取（dev 构建） ----------
  function reactSource(el) {
    // fiber key 是 Object.defineProperty 附加的不可枚举属性，必须用 getOwnPropertyNames
    const keys = Object.getOwnPropertyNames(el);
    for (const k of keys) {
      if (!k.startsWith('__reactFiber$') && !k.startsWith('__reactInternalInstance$')) continue;
      let f = el[k], guard = 0;
      while (f && guard++ < 200) {
        const t = f.type;
        const src = f._debugSource;
        if (t && (t.name || t.displayName) && src && src.fileName) {
          return {
            framework: 'react',
            component: t.displayName || t.name || '',
            file: src.fileName,
            line: src.lineNumber || 0,
            column: src.columnNumber || 0,
          };
        }
        f = f.return;
      }
    }
    return null;
  }
  function vueSource(el) {
    let vm = el.__vueParentComponent || el.__vue__ || null;
    let guard = 0;
    while (vm && guard++ < 200) {
      const opts = vm.$options || {};
      if (opts.__file) {
        const name = (vm.type && (vm.type.name || vm.type.__name)) || opts.name || opts.__name || '';
        return { framework: 'vue', component: name, file: opts.__file, line: 0, column: 0 };
      }
      vm = vm.$parent || null;
    }
    return null;
  }
  function sourceInfo(el) { return reactSource(el) || vueSource(el) || null; }

  // ---------- UI（Shadow DOM 隔离） ----------
  const host = document.createElement('div');
  host.setAttribute(HOST_FLAG, '');
  Object.assign(host.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none',
  });
  document.documentElement.appendChild(host);

  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      #hl {
        position: fixed; margin: 0; padding: 0;
        border: 2px solid #4f8cff; background: rgba(79,140,255,.12);
        border-radius: 3px; pointer-events: none;
        transition: all .04s linear; display: none;
      }
      #hl.pin { border-color: #ff5a5a; background: rgba(255,90,90,.14); }
      #badge {
        position: fixed; top: 0; left: 0; transform: translate(-50%, -150%);
        background: #111827; color: #fff; font: 600 11px/1.4 -apple-system, system-ui, sans-serif;
        padding: 4px 8px; border-radius: 5px; white-space: nowrap;
        pointer-events: none; display: none;
      }
      #info {
        position: fixed; top: 0; left: 0; transform: translate(0, 100%);
        background: rgba(17,24,39,.92); color: #e5e7eb; font: 11px/1.4 ui-monospace, Menlo, monospace;
        padding: 4px 8px; border-radius: 4px; max-width: 80vw; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; pointer-events: none; display: none;
      }
      #info .pv { color: #60a5fa; }
      #info .dim { color: #9ca3af; }
      #bar {
        position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
        background: #111827; color: #d1d5db; font: 12px/1 -apple-system, system-ui, sans-serif;
        padding: 8px 14px; border-radius: 8px; display: none; gap: 12px; align-items: center;
        box-shadow: 0 6px 20px rgba(0,0,0,.25); user-select: none; pointer-events: none;
      }
      #bar b { color: #fff; }
      #bar kbd {
        background: #1f2937; border: 1px solid #374151; border-bottom-width: 2px;
        border-radius: 4px; padding: 1px 5px; font: 11px ui-monospace, monospace; color: #d1d5db;
      }
      #bar .muted { color: #9ca3af; }
      #fab {
        position: fixed; width: 46px; height: 46px; border-radius: 13px;
        border: 1px solid rgba(255,255,255,.14); background: #161a21; color: #fff;
        padding: 0; outline: none; cursor: grab;
        box-shadow: 0 10px 26px rgba(10,14,25,.4), inset 0 1px 0 rgba(255,255,255,.08);
        user-select: none; pointer-events: auto; z-index: 2147483647;
        transition: transform .15s ease, box-shadow .15s ease;
      }
      #fab:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 30px rgba(10,14,25,.5), 0 0 0 3px rgba(79,109,245,.35), inset 0 1px 0 rgba(255,255,255,.1);
      }
      #fab:active { cursor: grabbing; transform: scale(.96); }
      #fab svg {
        width: 20px; height: 20px; position: absolute;
        inset: 50% auto auto 50%; transform: translate(-50%, -50%);
        transition: transform .2s ease; pointer-events: none;
      }
      #fab:hover svg { transform: translate(-50%, -50%) rotate(45deg) scale(1.08); }
      #cnt {
        position: absolute; bottom: -5px; right: -5px; min-width: 18px; height: 18px;
        border-radius: 9px; background: #ef4444; color: #fff; font: 700 11px/18px sans-serif;
        text-align: center; padding: 0 4px; display: none;
        box-shadow: 0 0 0 2px #161a21;
      }
      #card {
        position: fixed; width: 300px; background: #fff; border-radius: 10px;
        padding: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.3);
        font: 13px/1.4 -apple-system, system-ui, sans-serif; color: #111827;
        display: none; z-index: 2147483647; pointer-events: auto;
      }
      #card .sel {
        font: 11px/1.4 ui-monospace, Menlo, monospace; color: #374151;
        background: #f3f4f6; padding: 5px 7px; border-radius: 5px;
        word-break: break-all; margin-bottom: 8px; max-height: 70px; overflow: auto;
      }
      #card textarea {
        width: 100%; min-height: 58px; border: 1px solid #d1d5db; border-radius: 6px;
        padding: 7px; font: inherit; resize: vertical; outline: none;
      }
      #card textarea:focus { border-color: #4f8cff; }
      #card .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
      #card .row button {
        border: none; border-radius: 6px; padding: 6px 14px; font: inherit; cursor: pointer;
      }
      #card .ok { background: #111827; color: #fff; }
      #card .no { background: #f3f4f6; color: #6b7280; }
      #toast {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: #111827; color: #fff; font: 13px -apple-system, system-ui, sans-serif;
        padding: 8px 16px; border-radius: 6px; opacity: 0; transition: opacity .2s;
        pointer-events: none; max-width: 80vw; white-space: nowrap; overflow: hidden;
        text-overflow: ellipsis; z-index: 2147483647;
      }
      #toast.show { opacity: 1; }
    </style>
    <div id="hl"></div>
    <div id="badge"></div>
    <div id="info"></div>
    <div id="bar"><b>PICK</b>
      <span class="muted"><kbd>[</kbd><kbd>]</kbd>切层</span>
      <span class="muted"><kbd>1</kbd>-<kbd>9</kbd>跳层</span>
      <span class="muted"><kbd>Enter</kbd>选中</span>
      <span class="muted"><kbd>Esc</kbd>退出</span>
    </div>
    <div id="card">
      <div class="sel" id="sel"></div>
      <textarea id="txt" placeholder="备注（可选，留空直接回车提交）"></textarea>
      <div class="row">
        <button class="no" id="cancel">取消 Esc</button>
        <button class="ok" id="ok">✓ 确认 Enter</button>
      </div>
    </div>
    <button id="fab" title="元素拾取">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">
        <circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
      <span id="cnt">0</span>
    </button>
    <div id="toast"></div>
  `;

  const $ = (id) => root.getElementById(id);
  const elHL = $('hl'), elBadge = $('badge'), elInfo = $('info'), elBar = $('bar'),
        elFab = $('fab'), elCnt = $('cnt'), elCard = $('card'), elSel = $('sel'),
        elTxt = $('txt'), elOk = $('ok'), elCancel = $('cancel'), elToast = $('toast');

  // ---------- 状态 ----------
  let pickMode = false;
  let stack = [];
  let idx = 0;
  let pinned = null;
  let pos = { x: window.innerWidth - 68, y: window.innerHeight - 96 };
  try {
    const saved = sessionStorage.getItem(KEY_POS);
    if (saved) {
      const p = JSON.parse(saved);
      if (typeof p.x === 'number' && typeof p.y === 'number') pos = p;
    }
  } catch (e) { /* ignore */ }
  elFab.style.left = pos.x + 'px';
  elFab.style.top = pos.y + 'px';

  // ---------- 工具 ----------
  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => elToast.classList.remove('show'), 1800);
  }
  function refreshCount() {
    const n = loadBatch().length;
    elCnt.textContent = n;
    elCnt.style.display = n > 0 ? 'block' : 'none';
  }

  function stackAt(clientX, clientY) {
    const prev = host.style.pointerEvents;
    host.style.pointerEvents = 'none';
    const all = document.elementsFromPoint(clientX, clientY) || [];
    host.style.pointerEvents = prev;
    return all.filter((el) => {
      if (!el || el.nodeType !== 1) return false;
      if (el.getAttribute && el.getAttribute(HOST_FLAG) !== null) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      return true;
    });
  }

  function currentEl() { return stack[idx] || null; }

  function applyHighlight(el, pin) {
    if (!el) { elHL.style.display = 'none'; elBadge.style.display = 'none'; elInfo.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(elHL.style, {
      left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px', display: 'block',
    });
    elHL.classList.toggle('pin', !!pin);
    elBadge.style.display = 'block';
    elBadge.style.left = (r.left + r.width / 2) + 'px';
    elBadge.style.top = r.top + 'px';
    elBadge.innerHTML = (idx + 1) + '<small>/' + stack.length + '层 · ' + Math.round(r.width) + '×' + Math.round(r.height) + '</small>';
    elInfo.style.display = 'block';
    elInfo.style.left = r.left + 'px';
    elInfo.style.top = r.top + 'px';
    elInfo.innerHTML = '<span class="pv">' + escapeHtml(selectorPreview(el)) + '</span> <span class="dim">' +
      Math.round(r.width) + '×' + Math.round(r.height) + ' · ' + escapeHtml(cssPath(el)) + '</span>';
  }

  function refresh() { applyHighlight(currentEl(), !!pinned); }

  // ---------- 拾取模式开关 ----------
  function setActive(on) {
    pickMode = on;
    host.style.pointerEvents = on ? 'auto' : 'none';
    elBar.style.display = on ? 'flex' : 'none';
    elFab.style.display = on ? 'none' : 'block';
    document.body.style.cursor = on ? 'crosshair' : '';
    if (!on) { pinned = null; elCard.style.display = 'none'; elHL.style.display = 'none'; elBadge.style.display = 'none'; elInfo.style.display = 'none'; refreshCount(); }
  }

  // ---------- fab：拖动 + 点击进入拾取 ----------
  let drag = null;
  elFab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    try { elFab.setPointerCapture(e.pointerId); } catch (err) {}
  });
  elFab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    pos.x = Math.max(4, Math.min(window.innerWidth - 50, drag.ox + dx));
    pos.y = Math.max(4, Math.min(window.innerHeight - 50, drag.oy + dy));
    elFab.style.left = pos.x + 'px';
    elFab.style.top = pos.y + 'px';
  });
  elFab.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const wasMoved = drag.moved;
    drag = null;
    try { sessionStorage.setItem(KEY_POS, JSON.stringify(pos)); } catch (err) {}
    if (!wasMoved) setActive(true);
  });

  // ---------- 拾取交互（host 覆盖层） ----------
  host.addEventListener('mousemove', (e) => {
    if (!pickMode || pinned) return;
    stack = stackAt(e.clientX, e.clientY);
    idx = 0;
    refresh();
  });
  host.addEventListener('mouseleave', () => {
    if (!pinned) { elHL.style.display = 'none'; elBadge.style.display = 'none'; elInfo.style.display = 'none'; }
  });
  host.addEventListener('mousedown', (e) => {
    if (pickMode && !pinned && e.button === 0) pin();
  });
  host.addEventListener('wheel', (e) => {
    if (!pickMode) return;
    e.preventDefault();
    if (!pinned) window.scrollBy(0, e.deltaY);
  }, { passive: false });

  function shiftLayer(delta) {
    if (!stack.length) return;
    idx = Math.max(0, Math.min(stack.length - 1, idx + delta));
    refresh();
  }

  // ---------- 选中 → 备注 ----------
  function pin() {
    const el = currentEl();
    if (!el) return;
    pinned = el;
    applyHighlight(el, true);
    const sel = cssPath(el);
    const r = el.getBoundingClientRect();
    let left = r.right + 10;
    if (left + 300 > window.innerWidth) left = Math.max(8, r.left - 310);
    let top = r.top;
    if (top + 240 > window.innerHeight) top = Math.max(8, window.innerHeight - 250);
    Object.assign(elCard.style, { display: 'block', left: left + 'px', top: top + 'px' });
    elSel.textContent = sel;
    elTxt.value = '';
    setTimeout(() => elTxt.focus(), 0);
  }
  function unpin() { pinned = null; elCard.style.display = 'none'; refresh(); }

  function payloadFor(el, note) {
    const r = el.getBoundingClientRect();
    return {
      selector: cssPath(el),
      xpath: xPath(el),
      tagName: el.tagName.toLowerCase(),
      textPreview: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      note: note || '',
      ts: Date.now(),
      url: location.href,
      source: sourceInfo(el),
    };
  }
  function submit() {
    if (!pinned) return;
    addPick(payloadFor(pinned, elTxt.value.trim()));
    unpin();
  }

  elOk.addEventListener('click', submit);
  elCancel.addEventListener('click', unpin);

  // ---------- 全局键盘（仅拾取模式生效，无激活热键） ----------
  document.addEventListener('keydown', (e) => {
    if (!pickMode) return;
    if (pinned) {
      const firstTarget = (e.composedPath && e.composedPath()[0]) || e.target;
      if (e.key === 'Enter' && firstTarget === elTxt && !e.shiftKey) {
        e.preventDefault(); submit();
      } else if (e.key === 'Escape') {
        unpin();
      }
      return;
    }
    switch (e.key) {
      case ']': case 'ArrowDown': e.preventDefault(); shiftLayer(1); break;
      case '[': case 'ArrowUp': e.preventDefault(); shiftLayer(-1); break;
      case 'Enter': case ' ': e.preventDefault(); pin(); break;
      case 'Escape': e.preventDefault(); setActive(false); break;
      default:
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); idx = Math.min(stack.length - 1, +e.key - 1); refresh(); }
    }
  }, true);

  window.addEventListener('scroll', () => { if (pickMode) refresh(); }, true);
  window.addEventListener('resize', () => { if (pickMode) refresh(); }, true);

  refreshCount();
  window.__PI_PICKS_API__ = { refresh: refreshCount };
  console.log('%c[PICKER] ready', 'color:#4f8cff', '点击准星按钮进入拾取模式');
  return true;
}

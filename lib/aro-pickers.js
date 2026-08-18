/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — LONG LISTS AND LONG MANUALS  (window.AROPICK)
   ---------------------------------------------------------------------------
   Two complaints about getting to the work:

     "Dropdown lists are too long, a search option could be added where lists
      like these are given"
     "User manual is too long to read and scroll down for the first input box.
      It can be done in a small scrolling section or with user manual help
      icon instead"

   SEARCH. The fluid and material lists run to a hundred entries, and a native
   <select> only offers first-letter matching — useless for finding "Sodium
   hydroxide" when you know it as caustic. Any select past a threshold gets a
   type-to-filter box at the top of its own list. The underlying <select> is
   untouched: it keeps its id, its value, its change event and its place in
   every calculation that reads it. Only the way a value is CHOSEN changes,
   so nothing downstream can tell the difference.

   THE MANUAL. Each module opens with its user manual, and the first input box
   sits below it — so every visit to a sheet starts with a scroll past
   something the engineer read weeks ago. The manual is now closed by default
   with a help control to open it, and it remembers being opened: someone
   learning the module keeps it open, someone using it never sees it again.
   Nothing is removed; the same text is one click away.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var MIN_OPTIONS = 12;          /* below this a plain select is quicker */
  var LSKEY = 'aro_manual_open_v1';

  var CSSID = 'aro-pick-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '.aro-pick{position:relative;}',
      '.aro-pick-pop{position:absolute;z-index:100040;left:0;right:0;top:100%;margin-top:2px;',
      '  background:#0f172a;border:1px solid #334155;border-radius:5px;box-shadow:0 14px 40px rgba(0,0,0,0.5);',
      '  max-height:280px;display:flex;flex-direction:column;overflow:hidden;}',
      '.aro-pick-pop input{width:100%;box-sizing:border-box;background:rgba(2,6,18,0.6);border:none;',
      '  border-bottom:1px solid #334155;color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:7px 9px;}',
      '.aro-pick-list{overflow:auto;}',
      '.aro-pick-opt{font-family:var(--font-mono);font-size:11px;color:#cbd5e1;padding:6px 9px;cursor:pointer;',
      '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.aro-pick-opt:hover,.aro-pick-opt.on{background:rgba(255,117,56,0.16);color:#fdba74;}',
      '.aro-pick-none{font-family:var(--font-mono);font-size:10.5px;color:#94a3b8;padding:9px;}',
      'body.theme-day .aro-pick-pop{background:#ffffff;border-color:#cbd5e1;box-shadow:0 14px 40px rgba(15,23,42,0.2);}',
      'body.theme-day .aro-pick-pop input{background:#f7f8fa;border-bottom-color:#e2e8f0;color:#1e293b;}',
      'body.theme-day .aro-pick-opt{color:#334155;}',
      'body.theme-day .aro-pick-opt:hover,body.theme-day .aro-pick-opt.on{background:rgba(255,117,56,0.14);color:#b45309;}',
      /* the little magnifier hint on a searchable select */
      'select.aro-pick-on{background-image:none;}',

      /* the manual, closed by default */
      '.aro-doc-toggle{display:inline-flex;align-items:center;gap:6px;background:transparent;',
      '  border:1px solid var(--border-muted);color:var(--text-muted);font-family:var(--font-mono);',
      '  font-size:10px;font-weight:700;letter-spacing:0.05em;padding:5px 10px;border-radius:4px;',
      '  cursor:pointer;margin:0 0 8px;}',
      '.aro-doc-toggle:hover{border-color:var(--color-saffron);color:var(--color-saffron);}',
      '.aro-doc-wrap{max-height:340px;overflow:auto;border:1px solid var(--border-muted);',
      '  border-radius:5px;padding:10px 12px;margin-bottom:10px;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── searchable select ─────────────────────────────────────────────── */
  function enhance(sel) {
    if (!sel || sel.__aroPick) return false;
    if (sel.multiple || sel.disabled) return false;
    if (sel.options.length < MIN_OPTIONS) return false;
    sel.__aroPick = true;
    css();
    sel.classList.add('aro-pick-on');
    sel.title = 'Click to search this list';

    var wrap = sel.parentNode;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.classList.add('aro-pick');

    var pop = null;
    function close() { if (pop) { pop.remove(); pop = null; } }
    function open() {
      if (pop) return;
      close();
      pop = document.createElement('div');
      pop.className = 'aro-pick-pop';
      var q = document.createElement('input');
      q.type = 'text'; q.placeholder = 'Type to filter ' + sel.options.length + ' entries…';
      var list = document.createElement('div');
      list.className = 'aro-pick-list';
      pop.appendChild(q); pop.appendChild(list);
      (sel.parentNode || document.body).appendChild(pop);

      var opts = [].map.call(sel.options, function (o, i) { return { i: i, v: o.value, t: o.textContent }; });
      var shown = [];
      function draw(filter) {
        var f = String(filter || '').toLowerCase().trim();
        shown = opts.filter(function (o) { return !f || o.t.toLowerCase().indexOf(f) >= 0; });
        if (!shown.length) { list.innerHTML = '<div class="aro-pick-none">Nothing matches “' + f + '”.</div>'; return; }
        list.innerHTML = shown.map(function (o) {
          return '<div class="aro-pick-opt' + (o.i === sel.selectedIndex ? ' on' : '') + '" data-i="' + o.i + '">'
            + o.t.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</div>';
        }).join('');
      }
      draw('');
      q.addEventListener('input', function () { draw(q.value); });
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { close(); sel.focus(); }
        if (e.key === 'Enter' && shown.length) { e.preventDefault(); pick(shown[0].i); }
      });
      list.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('.aro-pick-opt') : null;
        if (t) pick(parseInt(t.getAttribute('data-i'), 10));
      });
      setTimeout(function () { q.focus(); }, 10);
    }
    function pick(i) {
      if (!(i >= 0)) return;
      sel.selectedIndex = i;
      /* the select is the source of truth; fire what a real choice fires so
         every listener downstream behaves identically */
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      close();
      sel.focus();
    }

    sel.addEventListener('mousedown', function (e) {
      e.preventDefault();          /* the native list would cover ours */
      if (pop) { close(); return; }
      open();
    });
    sel.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    document.addEventListener('mousedown', function (e) {
      if (!pop) return;
      if (pop.contains(e.target) || e.target === sel) return;
      close();
    });
    return true;
  }

  function scanSelects() {
    var n = 0;
    var list = document.querySelectorAll('select');
    for (var i = 0; i < list.length; i++) if (enhance(list[i])) n++;
    return n;
  }

  /* ── the manual, folded away ───────────────────────────────────────── */
  function openState() {
    try { return JSON.parse(localStorage.getItem(LSKEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function remember(k, on) {
    var s = openState(); s[k] = !!on;
    try { localStorage.setItem(LSKEY, JSON.stringify(s)); } catch (e) {}
  }

  /* A module's manual is a <details> whose summary says USER MANUAL, or a
     block carrying the aro-doc class the modules already use. */
  function foldManuals() {
    var n = 0;
    var dets = document.querySelectorAll('details');
    for (var i = 0; i < dets.length; i++) {
      var d = dets[i];
      if (d.__aroFold) continue;
      var sum = d.querySelector('summary');
      if (!sum || !/USER MANUAL|HOW TO SIZE|HOW TO DESIGN/i.test(sum.textContent || '')) continue;
      d.__aroFold = true;
      var key = (d.id || sum.textContent.replace(/\s+/g, ' ').trim()).slice(0, 60);
      var st = openState();
      /* closed unless this engineer opened it before */
      d.open = !!st[key];
      /* keep a long manual inside its own scroller rather than pushing the
         whole sheet down */
      if (!d.querySelector('.aro-doc-wrap')) {
        var body = document.createElement('div');
        body.className = 'aro-doc-wrap';
        while (d.children.length > 1) body.appendChild(d.children[1]);
        d.appendChild(body);
      }
      d.addEventListener('toggle', function (k) {
        return function (e) { remember(k, e.target.open); };
      }(key));
      n++;
    }
    return n;
  }

  window.AROPICK = {
    scan: function () { css(); return { selects: scanSelects(), manuals: foldManuals() }; },
    enhance: enhance, foldManuals: foldManuals, MIN_OPTIONS: MIN_OPTIONS
  };

  function boot() {
    css(); scanSelects(); foldManuals();
    var n = 0;
    var iv = setInterval(function () { scanSelects(); foldManuals(); if (++n > 40) clearInterval(iv); }, 800);
    document.addEventListener('click', function () {
      setTimeout(function () { scanSelects(); foldManuals(); }, 300);
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

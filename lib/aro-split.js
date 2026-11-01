/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — ADJUSTABLE PANELS  (window.AROSPLIT)
   ---------------------------------------------------------------------------
   Every design module is an input column beside an output column, and the
   split between them was fixed in the stylesheet: 460 px for line sizing,
   480 px for the pump and the exchangers. That is one editor's guess at what
   every engineer on every screen wants, and it is wrong at both ends — a
   long fitting schedule needs a wider input column, and reading a drawing
   wants the input column out of the way.

   This makes the divider draggable, everywhere the pattern occurs:

       PUMP HYDRAULICS      .pump-layout-grid
       LINE SIZING          .sizing-grid      (all five services)
       HEAT EXCHANGERS      .sthe-grid        (shell & tube, double pipe, plate)
       TANK DESIGN          .sthe-grid

   ARO Workbench already had its own resizer and keeps it.

   THE WIDTH IS REMEMBERED, PER MODULE. An engineer who widens the exchanger
   inputs has not asked for the pump to change, so each grid stores its own
   width and they are independent.

   IT GETS OUT OF THE WAY ON A NARROW SCREEN. Below the breakpoint the
   stylesheet stacks the two columns, and a divider between stacked panels is
   meaningless — so the inline width is dropped and the divider hidden, and
   both come back when there is room for them again.

   DOUBLE-CLICK RESTORES THE DEFAULT, because a panel dragged somewhere
   unusable needs a way back that is not "guess the original number".
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* selector → default first-column width in px, and the label used for
     storage so the pump and the exchangers do not share a setting */
  var TARGETS = [
    ['.pump-layout-grid', 480, 'pump'],
    ['.sizing-grid', 460, 'line'],
    ['.sthe-grid', 480, 'hx']
  ];
  var MIN = 280, MAX_FRAC = 0.72;
  var STACK_BELOW = 1150;               /* matches the stylesheet breakpoint */
  var KEY = 'aro_split_v1';

  function widths() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveWidth(k, w) {
    var all = widths();
    all[k] = Math.round(w);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }

  var CSSID = 'aro-split-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '.aro-split-bar{align-self:stretch;min-height:120px;cursor:col-resize;position:relative;',
      '  border-radius:3px;background:transparent;transition:background .12s;}',
      '.aro-split-bar:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:1px;',
      '  transform:translateX(-50%);background:var(--border-muted,#334155);opacity:.8;}',
      '.aro-split-bar:after{content:"";position:absolute;left:50%;top:50%;width:4px;height:34px;',
      '  transform:translate(-50%,-50%);border-radius:2px;background:var(--border-muted,#334155);}',
      '.aro-split-bar:hover:after,.aro-split-bar.drag:after{background:var(--color-saffron,#38bdf8);}',
      '.aro-split-bar:hover:before,.aro-split-bar.drag:before{background:var(--color-saffron,#38bdf8);}',
      /* while dragging, nothing else should take the pointer or select text */
      'body.aro-split-dragging{cursor:col-resize !important;user-select:none;}',
      'body.aro-split-dragging iframe,body.aro-split-dragging canvas{pointer-events:none;}',
      '@media(max-width:' + STACK_BELOW + 'px){.aro-split-bar{display:none;}}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function stacked() { return window.innerWidth <= STACK_BELOW; }

  /* Two element children means the input/output pair this is meant for. Once
     the divider is inserted there are three, and the marker says so. */
  function prepare(grid, dflt, label, idx) {
    if (grid.__aroSplit) return;
    var kids = [].filter.call(grid.children, function (n) { return n.nodeType === 1; });
    if (kids.length !== 2) return;
    grid.__aroSplit = { dflt: dflt, key: label + ':' + idx };

    var bar = document.createElement('div');
    bar.className = 'aro-split-bar';
    bar.setAttribute('role', 'separator');
    bar.setAttribute('aria-orientation', 'vertical');
    bar.title = 'Drag to resize · double-click to restore the default width';
    grid.insertBefore(bar, kids[1]);
    grid.__aroSplit.bar = bar;

    var stored = widths()[grid.__aroSplit.key];
    apply(grid, isFinite(stored) ? stored : dflt);

    bar.addEventListener('mousedown', function (e) { start(e, grid, e.clientX); });
    bar.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches[0]) start(e, grid, e.touches[0].clientX);
    }, { passive: false });
    bar.addEventListener('dblclick', function () {
      apply(grid, grid.__aroSplit.dflt);
      saveWidth(grid.__aroSplit.key, grid.__aroSplit.dflt);
    });
  }

  function clamp(grid, w) {
    var total = grid.getBoundingClientRect().width || 1200;
    return Math.max(MIN, Math.min(w, Math.max(MIN, total * MAX_FRAC)));
  }

  function apply(grid, w) {
    if (!grid.__aroSplit) return;
    if (stacked()) {
      /* Below the breakpoint the stylesheet stacks the columns. An inline
         three-track template would fight it and win, which is how a phone
         ends up with a 480 px column it cannot scroll out of. */
      grid.style.gridTemplateColumns = '';
      return;
    }
    var v = clamp(grid, w);
    grid.style.gridTemplateColumns = v + 'px 10px minmax(0,1fr)';
    grid.__aroSplit.w = v;
  }

  function start(e, grid, clientX) {
    if (stacked()) return;
    e.preventDefault();
    var st = grid.__aroSplit;
    var startX = clientX;
    var startW = st.w || grid.children[0].getBoundingClientRect().width;
    st.bar.classList.add('drag');
    document.body.classList.add('aro-split-dragging');

    function move(ev) {
      var x = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
      apply(grid, startW + (x - startX));
    }
    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
      st.bar.classList.remove('drag');
      document.body.classList.remove('aro-split-dragging');
      saveWidth(st.key, st.w || startW);
      /* A 3D viewport sized to the old column is now the wrong shape. */
      try { if (window.ARO3DI && window.ARO3DI.refresh) window.ARO3DI.refresh(); } catch (er) {}
      try { window.dispatchEvent(new Event('resize')); } catch (er) {}
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  }

  /* Pump Reference is a three-pane reader rather than the normal two-column
     calculator layout. Give its navigation and notes their own remembered
     dividers, without changing the narrow-screen reading layout. */
  function refClamp(body, side, width, st) {
    var total = body.getBoundingClientRect().width || 1200;
    var min = side === 'left' ? 165 : 190;
    var hardMax = side === 'left' ? 420 : 460;
    var other = side === 'left' ? st.right : st.left;
    return Math.max(min, Math.min(width, hardMax, Math.max(min, total - other - 340)));
  }
  function refApply(body, left, right) {
    var st = body.__aroRefSplit;
    if (!st) return;
    if (stacked()) {
      body.style.display = 'flex';
      body.style.gridTemplateColumns = '';
      return;
    }
    st.left = refClamp(body, 'left', left, st);
    st.right = refClamp(body, 'right', right, st);
    body.style.display = 'grid';
    body.style.gridTemplateColumns = st.left + 'px 10px minmax(340px,1fr) 10px ' + st.right + 'px';
    st.nav.style.gridColumn = '1'; st.leftBar.style.gridColumn = '2';
    st.center.style.gridColumn = '3'; st.rightBar.style.gridColumn = '4'; st.notes.style.gridColumn = '5';
  }
  function refStart(e, body, side, clientX) {
    if (stacked()) return;
    e.preventDefault();
    var st = body.__aroRefSplit, bar = side === 'left' ? st.leftBar : st.rightBar;
    var startX = clientX, startLeft = st.left, startRight = st.right;
    bar.classList.add('drag'); document.body.classList.add('aro-split-dragging');
    function move(ev) {
      var x = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
      if (side === 'left') refApply(body, startLeft + (x - startX), st.right);
      else refApply(body, st.left, startRight - (x - startX));
    }
    function up() {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
      bar.classList.remove('drag'); document.body.classList.remove('aro-split-dragging');
      saveWidth('reference:left', st.left); saveWidth('reference:right', st.right);
    }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
  }
  function prepareReference(body) {
    if (!body || body.__aroRefSplit) return;
    var nav = body.querySelector('#pref-nav'), center = body.querySelector('#pref-center'), notes = body.querySelector('#pref-notes');
    if (!nav || !center || !notes) return;
    var saved = widths(), leftBar = document.createElement('div'), rightBar = document.createElement('div');
    [leftBar, rightBar].forEach(function (bar) {
      bar.className = 'aro-split-bar'; bar.setAttribute('role', 'separator'); bar.setAttribute('aria-orientation', 'vertical');
      bar.title = 'Drag to resize · double-click to restore the default width';
    });
    body.insertBefore(leftBar, center); body.insertBefore(rightBar, notes);
    body.__aroRefSplit = { nav: nav, center: center, notes: notes, leftBar: leftBar, rightBar: rightBar,
      left: isFinite(saved['reference:left']) ? saved['reference:left'] : 220,
      right: isFinite(saved['reference:right']) ? saved['reference:right'] : 260 };
    refApply(body, body.__aroRefSplit.left, body.__aroRefSplit.right);
    [['left', leftBar], ['right', rightBar]].forEach(function (pair) {
      pair[1].addEventListener('mousedown', function (e) { refStart(e, body, pair[0], e.clientX); });
      pair[1].addEventListener('touchstart', function (e) { if (e.touches && e.touches[0]) refStart(e, body, pair[0], e.touches[0].clientX); }, { passive: false });
      pair[1].addEventListener('dblclick', function () {
        var st = body.__aroRefSplit;
        if (pair[0] === 'left') st.left = 220; else st.right = 260;
        refApply(body, st.left, st.right); saveWidth('reference:' + pair[0], pair[0] === 'left' ? 220 : 260);
      });
    });
  }

  function scan() {
    css();
    TARGETS.forEach(function (t) {
      var list;
      try { list = document.querySelectorAll(t[0]); } catch (e) { return; }
      [].forEach.call(list, function (g, i) { prepare(g, t[1], t[2], i); });
    });
    [].forEach.call(document.querySelectorAll('#pref-modal-body'), prepareReference);
  }

  /* Re-apply on resize so crossing the breakpoint in either direction lands
     in the right layout. */
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      TARGETS.forEach(function (t) {
        [].forEach.call(document.querySelectorAll(t[0]), function (g) {
          if (!g.__aroSplit) return;
          var stored = widths()[g.__aroSplit.key];
          apply(g, isFinite(stored) ? stored : g.__aroSplit.dflt);
        });
      });
      [].forEach.call(document.querySelectorAll('#pref-modal-body'), function (body) {
        if (body.__aroRefSplit) refApply(body, body.__aroRefSplit.left, body.__aroRefSplit.right);
      });
    }, 120);
  });

  window.AROSPLIT = {
    scan: scan,
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      TARGETS.forEach(function (t) {
        [].forEach.call(document.querySelectorAll(t[0]), function (g) {
          if (g.__aroSplit) apply(g, g.__aroSplit.dflt);
        });
      });
      [].forEach.call(document.querySelectorAll('#pref-modal-body'), function (body) {
        if (!body.__aroRefSplit) return;
        body.__aroRefSplit.left = 220; body.__aroRefSplit.right = 260;
        refApply(body, 220, 260);
      });
    },
    widths: widths
  };

  function boot() {
    scan();
    /* Panels arrive as their tabs are built, so keep looking for a while and
       then whenever a tab is opened. */
    var n = 0;
    var iv = setInterval(function () { scan(); if (++n > 40) clearInterval(iv); }, 500);
    document.addEventListener('click', function () { setTimeout(scan, 200); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

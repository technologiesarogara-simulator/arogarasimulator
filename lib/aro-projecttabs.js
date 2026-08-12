/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — PROJECT WORKSPACE TABS  (window.AROPTABS)
   ---------------------------------------------------------------------------
   Phase 29, which asked for the project page to be organised into tabs and
   said plainly: do not show everything on one page. I did not do it, and each
   new panel was appended to the bottom of the project tab instead.

   Eight panels later that page was five and a half thousand pixels of
   continuous scroll, and the Engineering Data Library — the largest thing
   built for it — opened from a button 3,981 px down, roughly four screens
   below the fold. Everything had shipped and nothing appeared to have
   changed, which is a fair description of not having shipped it at all.

   This moves the panels into sub-tabs and shows one at a time. It changes no
   panel's contents and no panel's code: each host element is relocated, and
   the panel is asked to redraw when its tab is opened, because every one of
   them declines to render while it is off screen.

   The chosen tab is remembered, so returning to the project lands where the
   engineer left it rather than at the top of a list.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* Panel host id → tab. Order is the order an engineer meets them: what the
     library holds, what the project has selected from it, then the governing
     data behind both. */
  var TABS = [
    { key: 'library', label: 'ENGINEERING DATA',
      hosts: ['aro-dl-launch', 'aro-englib-host'],
      redraw: ['ARODATAUI', 'AROENGLIB'],
      hint: 'The materials, fluids and properties database — domains, conditions, units, sources.' },
    { key: 'basis', label: 'DESIGN BASIS',
      hosts: ['aro-engdata-host'], redraw: ['AROENGDATA'],
      hint: 'The project-level record the modules can adopt, and what each module is using now.' },
    { key: 'registers', label: 'REGISTERS',
      hosts: ['aro-reg-host'], redraw: ['AROREG'],
      hint: 'Equipment, lines, fluids, materials, valves, instruments, drawings and reports.' },
    { key: 'components', label: 'COMPONENTS',
      hosts: ['aro-comp-host'], redraw: ['AROCOMP'],
      hint: 'One record per component — P&ID symbol, 2D icon, 3D casting, ports, K, take-off.' },
    { key: 'criteria', label: 'CRITERIA & STANDARDS',
      hosts: ['aro-crit-host'], redraw: ['AROCRIT'],
      hint: 'The design rules the verdicts are measured against, and the documents behind them.' },
    { key: 'userdata', label: 'USER DATA',
      hosts: ['aro-ul-host'], redraw: ['AROUSERLIB'],
      hint: 'Records entered on this project, and the project package import / export.' },
    { key: 'revisions', label: 'REVISIONS',
      hosts: ['aro-imp-host'], redraw: ['AROIMPACT'],
      hint: 'Every applied change to a shared property, with its impact and its reason.' }
  ];

  var KEY = 'aro_project_tab_v1';
  function current() {
    try { return localStorage.getItem(KEY) || 'library'; } catch (e) { return 'library'; }
  }
  function setCurrent(k) { try { localStorage.setItem(KEY, k); } catch (e) {} }

  var CSSID = 'aro-ptabs-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      /* The bar is sticky, so it needs a background of its own — and it must
         be the application's, not a hardcoded dark one. Guessing a colour put
         a navy strip across the light theme. */
      '#aro-ptabs{margin:14px 0 0;border-bottom:1px solid var(--border-muted);',
      '  display:flex;gap:2px;flex-wrap:wrap;position:sticky;top:0;z-index:20;',
      '  background:var(--bg-app);padding-top:4px;}',
      '.pt-tab{background:none;border:none;border-bottom:2px solid transparent;',
      '  color:var(--text-muted);padding:9px 13px;cursor:pointer;font-family:var(--font-mono);',
      '  font-size:10px;font-weight:700;letter-spacing:.06em;white-space:nowrap;}',
      '.pt-tab:hover{color:var(--text-main,inherit);}',
      '.pt-tab.on{color:#38bdf8;border-bottom-color:#38bdf8;}',
      '.pt-hint{font-size:10.5px;color:var(--text-muted);padding:9px 2px 0;line-height:1.55;}',
      '.pt-pane{display:none;}',
      '.pt-pane.on{display:block;}'
    ].join('');
    document.head.appendChild(s);
  }

  var built = false;

  function build() {
    var tab = document.getElementById('project-tab');
    if (!tab || built) return false;
    /* Wait until the panels that exist have arrived — building around half of
       them would strand the rest at the bottom of the page. */
    var present = TABS.reduce(function (n, t) {
      return n + t.hosts.filter(function (h) { return document.getElementById(h); }).length;
    }, 0);
    if (present < 5) return false;

    css();
    var bar = document.createElement('div');
    bar.id = 'aro-ptabs';
    var hint = document.createElement('div');
    hint.className = 'pt-hint';
    hint.id = 'aro-ptabs-hint';

    var panes = {};
    TABS.forEach(function (t) {
      var pane = document.createElement('div');
      pane.className = 'pt-pane';
      pane.id = 'pt-pane-' + t.key;
      panes[t.key] = pane;
    });

    /* The bar goes above everything the panels added; the panes go below it,
       and each host is moved into its pane in the order it was declared. */
    tab.appendChild(bar);
    tab.appendChild(hint);
    TABS.forEach(function (t) {
      tab.appendChild(panes[t.key]);
      t.hosts.forEach(function (h) {
        var el = document.getElementById(h);
        if (el) panes[t.key].appendChild(el);
      });
    });

    bar.innerHTML = TABS.map(function (t) {
      return '<button class="pt-tab" data-pt="' + t.key + '">' + t.label + '</button>';
    }).join('');

    built = true;
    show(current());
    return true;
  }

  function show(key) {
    var t = null;
    TABS.forEach(function (x) { if (x.key === key) t = x; });
    if (!t) { t = TABS[0]; key = t.key; }
    setCurrent(key);
    TABS.forEach(function (x) {
      var pane = document.getElementById('pt-pane-' + x.key);
      if (pane) pane.classList.toggle('on', x.key === key);
    });
    var bar = document.getElementById('aro-ptabs');
    if (bar) {
      [].forEach.call(bar.querySelectorAll('[data-pt]'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-pt') === key);
      });
    }
    var hint = document.getElementById('aro-ptabs-hint');
    if (hint) hint.textContent = t.hint;

    /* Every panel refuses to draw while it is off screen, so the one being
       opened is asked to redraw now that it is not. */
    (t.redraw || []).forEach(function (g) {
      try {
        var api = window[g];
        if (api && typeof api.render === 'function') api.render();
      } catch (e) {}
    });

    /* A panel that creates its host lazily appends it to the project tab, not
       to a pane it knows nothing about — the design basis did exactly that and
       its tab came up empty while the panel sat at the bottom of the page
       outside every pane. Any host that is not where it belongs is moved back
       after the redraw, which also covers a panel that replaces its host
       wholesale later on. */
    var pane = document.getElementById('pt-pane-' + key);
    if (pane) {
      (t.hosts || []).forEach(function (h) {
        var el = document.getElementById(h);
        if (el && el.parentNode !== pane) pane.appendChild(el);
      });
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-pt]') : null;
    if (t) { e.preventDefault(); show(t.getAttribute('data-pt')); return; }
    /* Panels arrive asynchronously; keep trying until they are all in. */
    if (!built) setTimeout(build, 150);
  }, true);

  window.AROPTABS = {
    show: show,
    tabs: function () { return TABS.map(function (t) { return t.key; }); },
    built: function () { return built; },
    rebuild: function () { built = false; build(); }
  };

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      if (build() || ++tries > 60) clearInterval(iv);
    }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

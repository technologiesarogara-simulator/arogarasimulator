/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — DO NOT SILENTLY OVERWRITE  (window.AROOVR)
   ---------------------------------------------------------------------------
   "Do not silently overwrite user input values. It must tell the user what
    other things get changed on changing a value … Changing fluid will replace
    the current density, viscosity or vapour-pressure values. Show a pop-up
    like continue or keep entered value."

   Picking a fluid from the library wrote density and viscosity straight over
   whatever was in those boxes. If an engineer had typed a measured density
   for their actual stream — 1009 kg/m³ rather than the library's 998 — and
   then changed the fluid to check something, their number was gone, with no
   notice and no undo prompt. That is the one thing the project rules say must
   never happen.

   The guard is deliberately quiet when there is nothing to lose. It remembers
   the value the LIBRARY last wrote into each field; if the box still holds
   that value, or is empty, the engineer never typed anything there and the
   replacement happens with no dialog at all. It asks only when the box holds
   something the engineer put there themselves — and then it says exactly
   which fields, and exactly which numbers, are about to be replaced.

   KEEP MY VALUES is the safe choice and is offered first. The engineer's
   number is theirs; the library is a convenience.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var CSSID = 'aro-ovr-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-ovr{position:fixed;inset:0;z-index:100050;display:flex;align-items:center;',
      '  justify-content:center;padding:20px;background:rgba(2,6,18,0.72);}',
      '#aro-ovr .ovr-card{background:#0f172a;border:2px solid #f59e0b;border-radius:9px;max-width:560px;',
      '  width:100%;padding:20px 22px;box-shadow:0 24px 70px rgba(0,0,0,0.55);font-family:var(--font-mono);}',
      '#aro-ovr h4{margin:0 0 10px;font-size:14px;font-weight:800;color:#f59e0b;letter-spacing:0.04em;}',
      '#aro-ovr .ovr-why{font-size:11.5px;color:#cbd5e1;line-height:1.6;margin-bottom:12px;}',
      '#aro-ovr table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;}',
      '#aro-ovr th{text-align:left;color:#94a3b8;font-weight:700;padding:4px 6px;border-bottom:1px solid #334155;}',
      '#aro-ovr td{padding:5px 6px;border-bottom:1px dashed #1e293b;color:#e2e8f0;}',
      '#aro-ovr td.was{color:#86efac;}',
      '#aro-ovr td.now{color:#fbbf24;}',
      '#aro-ovr .ovr-btns{display:flex;gap:10px;}',
      '#aro-ovr button{flex:1;font-family:var(--font-mono);font-size:11.5px;font-weight:800;',
      '  padding:11px;border-radius:5px;cursor:pointer;border:1px solid transparent;letter-spacing:0.03em;}',
      '#aro-ovr .ovr-keep{background:transparent;border-color:#22c55e;color:#22c55e;}',
      '#aro-ovr .ovr-keep:hover{background:rgba(34,197,94,0.12);}',
      '#aro-ovr .ovr-go{background:linear-gradient(135deg,#b45309,#f59e0b);color:#111827;}',
      /* light mode */
      'body.theme-day #aro-ovr{background:rgba(15,23,42,0.35);}',
      'body.theme-day #aro-ovr .ovr-card{background:#ffffff;box-shadow:0 24px 70px rgba(15,23,42,0.28);}',
      'body.theme-day #aro-ovr .ovr-why{color:#334155;}',
      'body.theme-day #aro-ovr th{color:#64748b;border-bottom-color:#e2e8f0;}',
      'body.theme-day #aro-ovr td{color:#1e293b;border-bottom-color:#eef1f4;}',
      'body.theme-day #aro-ovr td.was{color:#15803d;}',
      'body.theme-day #aro-ovr td.now{color:#b45309;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Record what the library wrote, so a later edit by the engineer is
     distinguishable from the library's own value. */
  function setFromLibrary(el, value) {
    if (!el) return;
    el.value = value;
    el.__aroLibValue = String(value);
    el.__aroUserTyped = false;         /* this value is the library's again */
  }
  /* Whether the engineer typed in this box, tracked as it happens rather than
     inferred by comparing strings. Comparing was wrong on the very first
     change: the panel's own default is written at build time, not through
     setFromLibrary, so a pristine 997 looked "user-entered" and the dialog
     interrupted a change that would have destroyed nothing. */
  function watch(el) {
    if (!el || el.__aroOvrWatched) return;
    el.__aroOvrWatched = true;
    var mark = function () { el.__aroUserTyped = true; };
    el.addEventListener('input', mark);
    el.addEventListener('change', mark);
  }
  function isUserEdited(el) {
    if (!el) return false;
    var v = String(el.value == null ? '' : el.value);
    if (v === '') return false;                        /* nothing to lose */
    return !!el.__aroUserTyped;
  }

  /* changes: [{el, label, next, unit}] — next is the value about to be written.
     Only the ones that would actually destroy a typed value are shown. */
  function guard(o) {
    o = o || {};
    var all = (o.changes || []).filter(function (c) { return c && c.el; });
    all.forEach(function (c) { watch(c.el); });
    var apply = function () {
      all.forEach(function (c) { setFromLibrary(c.el, c.next); });
      if (typeof o.onApply === 'function') o.onApply();
    };
    var risky = all.filter(function (c) {
      return isUserEdited(c.el) && String(c.el.value) !== String(c.next);
    });
    if (!risky.length) { apply(); return false; }      /* nothing typed — just do it */

    css();
    var old = document.getElementById('aro-ovr'); if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'aro-ovr';
    var rows = risky.map(function (c) {
      return '<tr><td>' + esc(c.label || c.el.id) + '</td>'
        + '<td class="was">' + esc(c.el.value) + (c.unit ? ' ' + esc(c.unit) : '') + '</td>'
        + '<td class="now">' + esc(c.next) + (c.unit ? ' ' + esc(c.unit) : '') + '</td></tr>';
    }).join('');
    m.innerHTML = '<div class="ovr-card">'
      + '<h4>&#9888; THIS WILL REPLACE VALUES YOU ENTERED</h4>'
      + '<div class="ovr-why">' + esc(o.because || 'This change carries its own property values.')
      + ' The figures below are yours; replacing them cannot be undone from here.</div>'
      + '<table><tr><th>Field</th><th>Your value</th><th>Would become</th></tr>' + rows + '</table>'
      + '<div class="ovr-btns">'
      + '<button type="button" class="ovr-keep">KEEP MY VALUES</button>'
      + '<button type="button" class="ovr-go">REPLACE THEM</button>'
      + '</div></div>';
    document.body.appendChild(m);
    var done = function () { if (m.parentNode) m.remove(); };
    m.querySelector('.ovr-go').onclick = function () { done(); apply(); };
    m.querySelector('.ovr-keep').onclick = function () {
      done();
      /* the fields the engineer never touched still take the new fluid's
         values — only their own numbers are protected */
      all.forEach(function (c) { if (risky.indexOf(c) < 0) setFromLibrary(c.el, c.next); });
      if (typeof o.onKeep === 'function') o.onKeep();
    };
    m.addEventListener('click', function (e) { if (e.target === m) { done(); if (typeof o.onKeep === 'function') o.onKeep(); } });
    return true;
  }

  /* The listener has to be on the field BEFORE the engineer types, not from
     the moment a guard first runs — otherwise a density typed before the
     first fluid change is still lost silently. These are the boxes a library
     pick writes into. */
  var WATCH = ['lq-rho', 'lq-mu', 'gs-mw', 'gs-mu', 'st-rho', 'st-mu',
               'sl-rhos', 'sl-rhol', 'sl-mul', 'tp2-rhol', 'tp2-rhog', 'tp2-mul', 'tp2-mug'];
  function watchAll() { WATCH.forEach(function (id) { watch(document.getElementById(id)); }); }

  window.AROOVR = { guard: guard, setFromLibrary: setFromLibrary, isUserEdited: isUserEdited,
                    watch: watch, watchAll: watchAll };

  function boot() {
    watchAll();
    /* panels build as their tabs open */
    var n = 0;
    var iv = setInterval(function () { watchAll(); if (++n > 40) clearInterval(iv); }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

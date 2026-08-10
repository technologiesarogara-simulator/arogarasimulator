/* ══════════════════════════════════════════════════════════════════════
   AROGARA — RESET GATE  (window.ARORESET)

   A reset must leave nothing behind. Clearing the input boxes is not
   enough on its own: every module recalculates on the next tick, so the
   panel immediately refills with results, validation verdicts, correction
   suggestions, charts and report data derived from empty fields — which
   reads as stale output from the previous design.

   So a reset also raises a gate. While a module is gated its calculation
   renders an "awaiting inputs" placeholder instead of results, and the
   gate lifts the moment the engineer types anything or presses RUN.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var GATED = {};

  /* Empty every output container the module owns, then gate it. */
  function wipe(key, ids) {
    (ids || []).forEach(function (id) {
      var e = document.getElementById(id);
      if (!e) return;
      if (e.tagName === 'CANVAS') {
        var c = e.getContext && e.getContext('2d');
        if (c) c.clearRect(0, 0, e.width, e.height);
      } else if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') {
        e.value = '';
      } else {
        e.innerHTML = '';
        e.style.display = 'none';
      }
    });
    GATED[key] = true;
  }

  /* Clear a panel WITHOUT destroying it.

     wipe() empties a container outright, which is right for a panel the
     module re-renders from scratch on every run — its markup is disposable.
     It is destructive for a panel whose markup is STATIC and whose values
     are written by id: emptying it deletes the very elements the next run
     needs, and since nothing rebuilds them, that run writes into null and
     throws. The module then looks dead for the rest of the session, with
     one reset as the only cause.

     blank() is for those panels: it hides the container and returns every
     value cell to a dash, so the sheet reads as cleared while the structure
     the engine writes into survives. */
  function blank(id) {
    var e = typeof id === 'string' ? document.getElementById(id) : id;
    if (!e) return;
    var cells = e.querySelectorAll('.card-value, .res-value, .result-value, .analysis-value');
    for (var i = 0; i < cells.length; i++) cells[i].textContent = '-';
    e.style.display = 'none';
  }

  function mark(key) { GATED[key] = true; }
  function lift(key) { delete GATED[key]; }
  function is(key) { return !!GATED[key]; }

  /* The standard placeholder, so every module says the same thing. */
  function placeholder(el, what) {
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = '<div style="font-family:var(--font-mono);font-size:10.5px;color:#94a3b8;line-height:1.6;'
      + 'background:rgba(56,189,248,0.06);border-left:3px solid #38bdf8;padding:10px 12px;border-radius:4px;">'
      + '↺ RESET — the sheet is clear. Enter the design inputs' + (what ? ' for ' + what : '')
      + ', then press RUN. Nothing from the previous design is carried over.</div>';
  }

  /* Any real interaction lifts the gate, so live calculation resumes as
     soon as the engineer starts working again. */
  function watch(key, root) {
    var host = typeof root === 'string' ? document.getElementById(root) : (root || document);
    if (!host || host.__aroResetWatch) return;
    host.__aroResetWatch = true;
    ['input', 'change'].forEach(function (ev) {
      host.addEventListener(ev, function (e) {
        var t = e.target;
        if (!t || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
        if (t.readOnly) return;
        lift(key);
      }, true);
    });
  }

  window.ARORESET = { wipe: wipe, blank: blank, mark: mark, lift: lift, is: is, placeholder: placeholder, watch: watch };
})();

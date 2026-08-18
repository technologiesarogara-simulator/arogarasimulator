/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — RESET ASKS FIRST  (window.ARORESETGUARD)
   ---------------------------------------------------------------------------
   "Before Reset should ask a confirmation so that if user accidently clicks
    then data should not wipe out before final confirmation."

   Every design module carries a RESET beside UNDO and REDO. Those three sit
   together, RESET is the one on the end, and it wiped the whole data sheet on
   a single click with nothing between the click and the loss. An hour of
   entered process data has no undo once the fields are blank — the module's
   own undo stack is cleared by the reset it is meant to protect against.

   The button is intercepted before its own handler runs, and the module's
   reset happens only if the engineer says so. It reports how much is at
   stake, because "reset?" is a different question when two boxes are filled
   than when forty are.

   The SYSTEM RESET on the engineering bar already asks, and its dialog is
   left alone — this is only for the per-module buttons that did not.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var CSSID = 'aro-rg-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-rg{position:fixed;inset:0;z-index:100060;display:flex;align-items:center;',
      '  justify-content:center;padding:20px;background:rgba(2,6,18,0.72);}',
      '#aro-rg .rg-card{background:#0f172a;border:2px solid #ef4444;border-radius:9px;max-width:480px;',
      '  width:100%;padding:20px 22px;box-shadow:0 24px 70px rgba(0,0,0,0.55);font-family:var(--font-mono);}',
      '#aro-rg h4{margin:0 0 10px;font-size:14px;font-weight:800;color:#ef4444;letter-spacing:0.04em;}',
      '#aro-rg p{font-size:11.5px;color:#cbd5e1;line-height:1.6;margin:0 0 14px;}',
      '#aro-rg b{color:#fbbf24;}',
      '#aro-rg .rg-btns{display:flex;gap:10px;}',
      '#aro-rg button{flex:1;font-family:var(--font-mono);font-size:11.5px;font-weight:800;',
      '  padding:11px;border-radius:5px;cursor:pointer;border:1px solid transparent;letter-spacing:0.03em;}',
      '#aro-rg .rg-keep{background:transparent;border-color:#22c55e;color:#22c55e;}',
      '#aro-rg .rg-keep:hover{background:rgba(34,197,94,0.12);}',
      '#aro-rg .rg-go{background:linear-gradient(135deg,#b91c1c,#ef4444);color:#fff;}',
      'body.theme-day #aro-rg{background:rgba(15,23,42,0.35);}',
      'body.theme-day #aro-rg .rg-card{background:#fff;box-shadow:0 24px 70px rgba(15,23,42,0.28);}',
      'body.theme-day #aro-rg p{color:#334155;}',
      'body.theme-day #aro-rg b{color:#b45309;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  /* Is this the per-module RESET? The system-wide one runs its own dialog. */
  function isModuleReset(b) {
    if (!b || b.tagName !== 'BUTTON') return false;
    /* The dialog's own confirm button is labelled RESET too, so without this
       clicking it was read as another module reset: the guard intercepted
       itself, threw up a fresh dialog and the reset never happened. Anything
       inside a dialog belongs to that dialog. */
    if (b.closest && b.closest('#aro-rg,#aro-ovr,[id$="-reqinput-modal"],#aro-mod')) return false;
    if (b.id === 'aro-eng-reset' || /RESET SYSTEM/i.test(b.textContent || '')) return false;
    var txt = (b.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^↺?\s*RESET$/i.test(txt) && !/^↻?\s*RESET$/i.test(txt)) return false;
    return true;
  }

  /* How much would be lost — counted from the panel the button sits in. */
  function stakes(btn) {
    var panel = btn.closest ? btn.closest('[id$="-content"],[id$="-sub"],form,section,div') : null;
    var scope = panel || document;
    var filled = 0, total = 0;
    var list = scope.querySelectorAll('input,select,textarea');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.type === 'button' || el.type === 'submit' || el.type === 'hidden') continue;
      if (!el.offsetParent) continue;
      total++;
      var v = String(el.value == null ? '' : el.value).trim();
      if (v !== '' && v !== '0') filled++;
    }
    return { filled: filled, total: total };
  }

  function ask(btn, go) {
    css();
    var old = document.getElementById('aro-rg'); if (old) old.remove();
    var s = stakes(btn);
    var m = document.createElement('div');
    m.id = 'aro-rg';
    m.innerHTML = '<div class="rg-card">'
      + '<h4>&#8635; RESET THIS DESIGN?</h4>'
      + '<p>Every input on this sheet goes back to its default and the results are cleared. '
      + '<b>' + s.filled + '</b> of ' + s.total + ' fields currently hold a value.<br><br>'
      + 'This cannot be undone — a reset clears the undo history along with the data.</p>'
      + '<div class="rg-btns">'
      + '<button type="button" class="rg-keep">CANCEL &mdash; KEEP MY DATA</button>'
      + '<button type="button" class="rg-go">RESET</button>'
      + '</div></div>';
    document.body.appendChild(m);
    var done = function () { if (m.parentNode) m.remove(); };
    m.querySelector('.rg-keep').onclick = done;
    m.querySelector('.rg-go').onclick = function () { done(); go(); };
    m.addEventListener('click', function (e) { if (e.target === m) done(); });
    setTimeout(function () { var k = m.querySelector('.rg-keep'); if (k) k.focus(); }, 20);
  }

  /* Capture phase, so this runs before the module's own click handler and can
     stop it. The module's handler is re-reached by replaying the click with a
     flag set, rather than by trying to find and call its function. */
  document.addEventListener('click', function (e) {
    /* Only a human click needs confirming. SYSTEM RESET drives every module's
       reset programmatically, and it has already asked its own question — so
       a second dialog per module would either stack up or, as it did, stop
       the cascade dead and leave the design half-cleared. A click the app
       makes on its own behalf is the result of something already confirmed.
       This also lets the replay below through without a special case. */
    if (e.isTrusted === false) return;
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!isModuleReset(b)) return;
    if (b.__aroResetOk) { b.__aroResetOk = false; return; }   /* the replay */
    e.preventDefault();
    e.stopPropagation();
    ask(b, function () {
      b.__aroResetOk = true;
      b.click();
    });
  }, true);

  window.ARORESETGUARD = { isModuleReset: isModuleReset, stakes: stakes };
})();

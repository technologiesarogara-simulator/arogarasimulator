/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — WHERE DID THIS NUMBER COME FROM  (window.AROPROV)
   ---------------------------------------------------------------------------
   "No clear distinction between calculated, default, user-entered and
    recommended values. There must be some differentiating colour or something,
    so that user can differentiate between default value and user input value
    without any extra effort of reading small label of default and input."

   The information existed — it was in a small grey word beside the box. On a
   sheet of forty fields that is forty small grey words to read, which is the
   same as not knowing. The box itself now carries it:

     DEFAULT      the value the module opened with. Quiet: no accent, muted
                  text. Nobody has said anything about this number yet.
     YOURS        the engineer typed it. A blue left edge, ink at full
                  strength. This is the one that must never be lost, and it
                  is the one that should be findable at a glance.
     CALCULATED   the engine solved for it and wrote it back — a shell
                  diameter, a baffle spacing, a tube count. An amber left
                  edge, so it is obvious that typing over it is arguing with
                  the calculation rather than supplying an input.

   Nothing is guessed. A value is CALCULATED because it arrived through
   setInputFromSI, which is the single function every module uses to write a
   solved value back into the form; it is YOURS because an input event came
   from the field. Whichever happened last wins, which is exactly the truth
   about the number currently in the box.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var CSSID = 'aro-prov-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      /* the accent is a left edge — it cannot collide with the validation
         border, the unit chip or the required asterisk */
      'input.aro-prov-user,select.aro-prov-user{box-shadow:inset 3px 0 0 #38bdf8;}',
      'input.aro-prov-calc,select.aro-prov-calc{box-shadow:inset 3px 0 0 #f59e0b;}',
      'body.theme-day input.aro-prov-user,body.theme-day select.aro-prov-user{box-shadow:inset 3px 0 0 #0284c7;}',
      'body.theme-day input.aro-prov-calc,body.theme-day select.aro-prov-calc{box-shadow:inset 3px 0 0 #b45309;}',
      /* a default reads a shade quieter than something someone chose */
      'input.aro-prov-default,select.aro-prov-default{opacity:0.86;}',

      /* the key, so the colours mean something the first time they are seen */
      '.aro-prov-key{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:6px 0 10px;',
      '  font-family:var(--font-mono);font-size:9px;letter-spacing:0.05em;color:var(--text-muted);}',
      '.aro-prov-key i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;',
      '  vertical-align:-1px;font-style:normal;}',
      '.aro-prov-key .k-def i{background:#64748b;}',
      '.aro-prov-key .k-user i{background:#38bdf8;}',
      '.aro-prov-key .k-calc i{background:#f59e0b;}',
      'body.theme-day .aro-prov-key .k-user i{background:#0284c7;}',
      'body.theme-day .aro-prov-key .k-calc i{background:#b45309;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function editable(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') return false;
    if (el.type === 'button' || el.type === 'submit' || el.type === 'checkbox'
        || el.type === 'radio' || el.type === 'file' || el.type === 'color') return false;
    return true;
  }

  function set(el, kind) {
    if (!editable(el)) return;
    css();
    el.classList.toggle('aro-prov-user', kind === 'user');
    el.classList.toggle('aro-prov-calc', kind === 'calc');
    el.classList.toggle('aro-prov-default', kind === 'default');
    el.setAttribute('data-aro-prov', kind);
    el.title = kind === 'user' ? 'Your entry'
      : kind === 'calc' ? 'Solved by the calculation and written back — typing here overrides it'
      : 'Module default — not yet set by anyone';
  }

  /* Every value that arrives through setInputFromSI was solved for. That is
     the one function the modules share for writing a result back, so hooking
     it is the whole of the CALCULATED case — no module needs changing and
     none can forget to declare it. */
  function hookWriteBack() {
    var orig = window.setInputFromSI;
    if (typeof orig !== 'function' || orig.__aroProv) return false;
    var wrapped = function (id, v, dec) {
      var r = orig.apply(this, arguments);
      try {
        var el = (typeof id === 'string') ? document.getElementById(id) : id;
        if (el) set(el, 'calc');
      } catch (e) {}
      return r;
    };
    wrapped.__aroProv = true;
    window.setInputFromSI = wrapped;
    return true;
  }

  /* And a value the engineer types is theirs, whatever it was a moment ago. */
  function watch() {
    document.addEventListener('input', function (e) {
      if (editable(e.target)) set(e.target, 'user');
    }, true);
    document.addEventListener('change', function (e) {
      if (editable(e.target)) set(e.target, 'user');
    }, true);
  }

  /* Anything never spoken for is a default. Marked lazily so a field that has
     already been claimed is left alone. */
  function paint(root) {
    css();
    var scope = root || document;
    var list = scope.querySelectorAll('input,select');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!editable(el)) continue;
      if (el.getAttribute('data-aro-prov')) continue;
      set(el, 'default');
    }
  }

  /* One key per design panel, so the colours are explained where they appear. */
  function key(container) {
    if (!container || container.querySelector('.aro-prov-key')) return;
    var d = document.createElement('div');
    d.className = 'aro-prov-key';
    d.innerHTML = '<span class="k-def"><i></i>DEFAULT</span>'
      + '<span class="k-user"><i></i>YOUR ENTRY</span>'
      + '<span class="k-calc"><i></i>CALCULATED &mdash; WRITTEN BACK</span>';
    container.insertBefore(d, container.firstChild);
  }
  function keys() {
    ['#pump-form', '#sthe-form', '#dphe-form'].forEach(function (sel) {
      var f = document.querySelector(sel);
      if (f) key(f);
    });
  }

  window.AROPROV = { set: set, paint: paint, keys: keys,
    of: function (el) { return el ? el.getAttribute('data-aro-prov') : null; } };

  function boot() {
    css(); watch(); paint(); keys();
    if (!hookWriteBack()) {
      var t = 0;
      var iv0 = setInterval(function () { if (hookWriteBack() || ++t > 40) clearInterval(iv0); }, 250);
    }
    var n = 0;
    var iv = setInterval(function () { paint(); keys(); if (++n > 40) clearInterval(iv); }, 800);
    document.addEventListener('click', function () { setTimeout(function () { paint(); keys(); }, 300); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

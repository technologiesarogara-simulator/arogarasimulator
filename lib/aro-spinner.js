/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — CONVENIENT STEP CONTROLS FOR NUMBER INPUTS
   ---------------------------------------------------------------------------
   The browser's own spinner arrows were removed everywhere (they fought the
   scroll-wheel-changes-the-value bug fixed earlier) and never replaced, so
   every number field became type-only. This adds a single floating ▲▼
   control that appears beside whichever number field the engineer is
   working in — on focus, or on hover so it can be found without clicking
   in first — click-or-press-and-hold to step, release-and-it's-done.

   One global, delegated listener. No existing input is touched or rewired:
   the control reads step/min/max straight off the DOM and writes the value
   back the same way a real keystroke would (input + change events), so unit
   conversion, undo, live recalc and range validation all fire exactly as
   they already do for typed input.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var SEL = 'input[type="number"]';
  var ctl = null, upBtn = null, dnBtn = null;
  var active = null;          // the input currently paired with the control
  var hideTimer = null;
  var repeatTimer = null;
  var pos = { raf: 0 };

  function eligible(el) {
    return el && el.tagName === 'INPUT' && el.type === 'number'
      && !el.readOnly && !el.disabled
      && el.offsetParent !== null;   // not hidden
  }

  function build() {
    if (ctl) return;
    ctl = document.createElement('div');
    ctl.id = 'aro-spin-ctl';
    ctl.setAttribute('aria-hidden', 'true');
    ctl.style.cssText = 'position:fixed;display:none;flex-direction:column;width:17px;height:24px;'
      + 'z-index:99999;border:1px solid var(--border-active,#c8804a);border-radius:4px;overflow:hidden;'
      + 'box-shadow:0 2px 8px rgba(0,0,0,0.35);background:var(--bg-input,#12161d);';
    function makeBtn(dir, glyph) {
      var b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.textContent = glyph;
      b.dataset.dir = dir;
      b.style.cssText = 'flex:1;min-height:0;border:none;padding:0;margin:0;cursor:pointer;'
        + 'display:flex;align-items:center;justify-content:center;'
        + 'font-size:8px;line-height:1;color:var(--color-saffron,#c8804a);'
        + 'background:transparent;font-family:var(--font-mono,monospace);';
      b.addEventListener('mouseenter', function () { b.style.background = 'rgba(200,128,74,0.18)'; });
      b.addEventListener('mouseleave', function () { b.style.background = 'transparent'; });
      return b;
    }
    upBtn = makeBtn(1, '▲');
    dnBtn = makeBtn(-1, '▼');
    var rule = document.createElement('div');
    rule.style.cssText = 'height:1px;background:var(--border-muted,rgba(163,178,199,0.25));flex:none;';
    ctl.appendChild(upBtn);
    ctl.appendChild(rule);
    ctl.appendChild(dnBtn);
    document.body.appendChild(ctl);

    [upBtn, dnBtn].forEach(function (b) {
      b.addEventListener('mousedown', function (e) {
        e.preventDefault();          // never steal focus from the input
        if (!active) return;
        stepDirty = active;
        step(+b.dataset.dir);
        clearTimeout(repeatTimer);
        repeatTimer = setTimeout(function repeat() {
          if (!active) return;
          step(+b.dataset.dir);
          repeatTimer = setTimeout(repeat, 70);
        }, 380);
      });
    });
    document.addEventListener('mouseup', endStepSequence);
    ctl.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
    ctl.addEventListener('mouseleave', scheduleHide);
  }

  function decimals(step) {
    var s = String(step);
    var i = s.indexOf('.');
    return i < 0 ? 0 : (s.length - i - 1);
  }

  function bounds(el) {
    var lo = -Infinity, hi = Infinity;
    var nMin = parseFloat(el.getAttribute('min'));
    var nMax = parseFloat(el.getAttribute('max'));
    var sMin = parseFloat(el.getAttribute('data-aro-min'));
    var sMax = parseFloat(el.getAttribute('data-aro-max'));
    if (isFinite(nMin)) lo = Math.max(lo, nMin);
    if (isFinite(sMin)) lo = Math.max(lo, sMin);
    if (isFinite(nMax)) hi = Math.min(hi, nMax);
    if (isFinite(sMax)) hi = Math.min(hi, sMax);
    return { lo: lo, hi: hi };
  }

  /* The element mid a click-or-hold step sequence, still owed its one
     'change' event once the mouse comes back up. A held button was firing
     both 'input' AND 'change' on every ~70ms repeat tick — 'change' is what
     several modules key a full recalculation off, so a one-second hold sent
     a dozen full recalcs (each visibly costing 90-200ms of main-thread time,
     per profiling) queuing up behind each other. Real typing never does
     this: 'input' fires per keystroke, 'change' fires once on commit. Steps
     now follow the same shape — 'input' every tick for live feedback,
     'change' exactly once when the interaction actually ends. */
  var stepDirty = null;

  function step(dir) {
    var el = active;
    if (!eligible(el)) { hide(); return; }
    var raw = el.getAttribute('step');
    var st = parseFloat(raw);
    if (!isFinite(st) || raw === 'any' || st <= 0) st = 1;
    var cur = parseFloat(el.value);
    if (!isFinite(cur)) cur = 0;
    var b = bounds(el);
    var next = cur + dir * st;
    var dp = Math.max(decimals(st), decimals(cur));
    next = Math.round(next * Math.pow(10, dp)) / Math.pow(10, dp);
    next = Math.min(b.hi, Math.max(b.lo, next));
    el.value = String(next);
    el.__aroUserTyped = true;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function endStepSequence() {
    clearTimeout(repeatTimer);
    if (stepDirty) {
      var el = stepDirty;
      stepDirty = null;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function place() {
    if (!active || !ctl) return;
    var r = active.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { hide(); return; }
    var w = 17, h = 24, gap = 3;
    var left = r.right + gap;
    if (left + w > window.innerWidth - 2) left = Math.max(2, r.right - w - 1);  // overlap the field's own edge rather than run off-screen
    var top = r.top + r.height / 2 - h / 2;
    top = Math.min(Math.max(2, top), window.innerHeight - h - 2);
    ctl.style.left = left + 'px';
    ctl.style.top = top + 'px';
  }

  function show(el) {
    if (!eligible(el)) return;
    build();
    active = el;
    clearTimeout(hideTimer);
    ctl.style.display = 'flex';
    place();
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (document.activeElement === active) return;   // still typing — keep it up
      hide();
    }, 250);
  }

  function hide() {
    endStepSequence();   // never leave a step's 'change' permanently unfired
    active = null;
    if (ctl) ctl.style.display = 'none';
  }

  document.addEventListener('focusin', function (e) {
    if (e.target && e.target.matches && e.target.matches(SEL)) show(e.target);
  });
  document.addEventListener('focusout', function (e) {
    if (e.target === active) scheduleHide();
  });
  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(SEL)) show(t);
  });
  document.addEventListener('mouseout', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(SEL) && t === active) scheduleHide();
  });
  document.addEventListener('scroll', function () { if (active) place(); }, true);
  window.addEventListener('resize', function () { if (active) place(); });

  /* the value may change out from under the field (unit switch, reset,
     preset load) while the control is still parked on it — nothing to do
     here, place() just re-reads the live rect on the next scroll/resize,
     and step() always re-reads el.value fresh, never a cached number */
})();

/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — ACCESSIBILITY & READING COMFORT

   The suite is a dense engineering console: most of its type sits between
   8 and 13 px, which is legible on a 24" desk monitor and genuinely hard
   work on a laptop, on a projector, or for anyone whose eyes are not
   twenty years old. This adds a text-size control to the header that
   scales the whole interface — type, controls, spacing and hit targets
   together — in five steps from 90 % to 150 %.

   It is done with CSS `zoom` on the app shell rather than by rewriting
   font sizes. The interface declares its sizes in pixels in several
   thousand places, including inline styles, so nothing short of `zoom`
   scales all of it consistently; `zoom` also grows the click targets with
   the text, which a font-size-only approach does not. Layout reflows
   properly because the shell is sized in percentages (a `100vw` shell
   would keep its pixel width under zoom and push a horizontal scrollbar
   across the page).

   The choice is remembered, and the browser's own zoom keeps working on
   top of it.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'aro_text_scale_v1';
  var STEPS = [
    { v: 0.9,  label: 'Compact',    hint: '90 % — more on screen' },
    { v: 1,    label: 'Standard',   hint: '100 % — default' },
    { v: 1.15, label: 'Large',      hint: '115 %' },
    { v: 1.3,  label: 'Larger',     hint: '130 %' },
    { v: 1.5,  label: 'Largest',    hint: '150 % — maximum readability' }
  ];
  var DEFAULT_IDX = 1;

  function idxOf(v) {
    for (var i = 0; i < STEPS.length; i++) if (Math.abs(STEPS[i].v - v) < 0.001) return i;
    return DEFAULT_IDX;
  }

  function readSaved() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null) return DEFAULT_IDX;
      return idxOf(parseFloat(raw));
    } catch (e) { return DEFAULT_IDX; }
  }

  var current = DEFAULT_IDX;

  /* The shell is what gets zoomed. Zooming <body> would take the fixed
     overlays (modals, the assistant launcher, the workbench canvas chrome)
     with it, and those are positioned against the viewport. */
  function shell() {
    return document.querySelector('.terminal-container') || document.body;
  }

  function apply(i, announce) {
    current = Math.max(0, Math.min(STEPS.length - 1, i));
    var step = STEPS[current];
    var el = shell();
    if (el) el.style.zoom = step.v === 1 ? '' : String(step.v);
    document.documentElement.setAttribute('data-aro-text-scale', String(step.v));
    try { localStorage.setItem(KEY, String(step.v)); } catch (e) {}
    paint();
    /* Charts and the 3D canvases size themselves from their container, and
       a zoom change resizes that container without firing a resize event. */
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    if (announce) say('Text size ' + step.label + ', ' + Math.round(step.v * 100) + ' per cent');
  }

  /* Screen-reader announcement for a change made with the keyboard. */
  var live = null;
  function say(msg) {
    if (!live) {
      live = document.createElement('div');
      live.setAttribute('aria-live', 'polite');
      live.className = 'aro-sr-only';
      document.body.appendChild(live);
    }
    live.textContent = msg;
  }

  var wrap = null, out = null, minus = null, plus = null;
  function paint() {
    if (!out) return;
    var step = STEPS[current];
    out.textContent = Math.round(step.v * 100) + '%';
    wrap.setAttribute('aria-valuenow', String(Math.round(step.v * 100)));
    wrap.setAttribute('aria-valuetext', step.label + ', ' + Math.round(step.v * 100) + ' per cent');
    wrap.title = 'Interface text size — ' + step.hint;
    minus.disabled = current === 0;
    plus.disabled = current === STEPS.length - 1;
  }

  var CSS = ''
    + '.aro-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;'
    + 'clip:rect(0 0 0 0);white-space:nowrap;border:0;}'
    + '.aro-textsize{display:flex;align-items:center;gap:2px;height:26px;padding:0 4px;border-radius:var(--radius-sm,4px);'
    + 'border:1px solid var(--border-muted,#233152);background:var(--bg-input,rgba(2,6,18,0.5));}'
    + '.aro-textsize button{width:22px;height:20px;display:flex;align-items:center;justify-content:center;'
    + 'background:transparent;border:none;cursor:pointer;border-radius:3px;color:var(--text-header,#cbd5e1);'
    + 'font-family:var(--font-mono,monospace);font-weight:700;line-height:1;padding:0;}'
    + '.aro-textsize button:hover:not(:disabled){background:rgba(255,117,56,0.16);color:#ff9d63;}'
    + '.aro-textsize button:focus-visible{outline:2px solid #ff7538;outline-offset:1px;}'
    + '.aro-textsize button:disabled{opacity:0.3;cursor:default;}'
    + '.aro-textsize .aro-ts-sm{font-size:10px;}'
    + '.aro-textsize .aro-ts-lg{font-size:15px;}'
    + '.aro-textsize .aro-ts-val{min-width:34px;text-align:center;font-family:var(--font-mono,monospace);'
    + 'font-size:10px;color:var(--text-muted,#94a3b8);letter-spacing:0.02em;}'
    /* The shell must be sized in percentages or `zoom` cannot reflow it —
       a viewport-unit width keeps its pixel value and overflows sideways. */
    + 'html,body{height:100%;}'
    + '.terminal-container{width:100% !important;height:100% !important;}'

    /* ── Empty results read as "not run yet", not as "broken" ──────────────
       Before a calculation the result cards render as a label, a unit and a
       gap where the number should be, which looks like a panel that has
       failed rather than one that is waiting. An em dash in the empty slot
       says the same thing every datasheet says: no value yet. */
    + '.res-value>span[id]:empty::before,.card-value:empty::before,'
    + '.card-value>span[id]:empty::before{content:"\\2014";opacity:0.32;font-weight:400;}'
    /* Cards holding no result at all are dimmed a little so the eye goes to
       the ones that do carry numbers. */
    + '.pump-res-card:has(.res-value>span[id]:empty),.result-card:has(.card-value:empty){opacity:0.72;}'

    /* ── Focus is visible everywhere ───────────────────────────────────────
       Keyboard users had no reliable focus ring: several controls clear the
       browser default and never draw their own. */
    + 'input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible,'
    + 'summary:focus-visible,[tabindex]:focus-visible{outline:2px solid #ff7538;outline-offset:1px;}'

    /* ── A readable floor on the smallest type ─────────────────────────────
       Roughly 600 labels were set at 8 – 9 px, which is below what most
       people can read comfortably on a laptop even with good eyesight. */
    + '.terminal-container [style*="font-size:8px"],.terminal-container [style*="font-size: 8px"],'
    + '.terminal-container [style*="font-size:8.5px"],.terminal-container [style*="font-size: 8.5px"],'
    + '.terminal-container [style*="font-size:9px"],.terminal-container [style*="font-size: 9px"]'
    + '{font-size:10px !important;}'

    /* The header is a single non-wrapping row of fixed-width widgets; at the
       larger text sizes (and on a narrow laptop) its items collided. */
    + '.terminal-header{flex-wrap:wrap;row-gap:6px;}'
    + '.header-status{flex-wrap:wrap;row-gap:6px;}'
    + '.logo-accent{white-space:nowrap;}'
    /* The only text run in the app that failed WCAG AA on a pixel-accurate
       sweep: the DIGITAL SUITE badge at 3.81:1 against the header. A pixel
       audit of 74 visible runs found nothing else below the line — an
       earlier heuristic pass reported seventeen, and sixteen of those were
       the audit walking to the wrong background, not real failures. */
    + '.logo-accent{color:#7a9dd6;border-color:rgba(122,157,214,0.45);}'

    /* ── Narrow screens ────────────────────────────────────────────────────
       On a phone the five navigation tabs measure 734 px against a 390 px
       screen, and the tab strip had no overflow rule — so the tabs pushed
       the whole PAGE 344 px wide and every screen slid sideways under the
       thumb. (The assistant button then followed the widened layout
       viewport out to the right, which looked like a second bug and was
       really the same one.) The strip scrolls its own tabs now, and the
       page stays put. This is a desktop engineering tool and a phone will
       never be the place to size a pump, but it should not arrive broken. */
    + '.terminal-nav{overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;'
    + '-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;}'
    + '.terminal-nav::-webkit-scrollbar{height:3px;}'
    + '.nav-tab{flex:0 0 auto;white-space:nowrap;}'
    /* Anything that genuinely cannot shrink scrolls inside its own box
       rather than widening the document. */
    + '.terminal-container,.tab-content,.panel,.sizing-panel{max-width:100%;}'
    + '@media (max-width:1100px){'
    + '  .sim-container,.viz-wrap,.report-viewport,.pump-output-section{overflow-x:auto;}'
    + '  table{display:block;overflow-x:auto;white-space:nowrap;}'
    + '}'
    /* Three input columns on a phone leaves each field 65 px wide — narrower
       than the numbers going into it. Fold them down instead. */
    + '@media (max-width:760px){.input-grid-3{grid-template-columns:1fr 1fr;}}'
    + '@media (max-width:520px){.input-grid-3,.input-grid-2{grid-template-columns:1fr;}}'

    + '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:0.01ms !important;'
    + 'animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important;}}';

  function build() {
    var st = document.createElement('style');
    st.id = 'aro-ux-css';
    st.textContent = CSS;
    document.head.appendChild(st);

    var host = document.querySelector('.header-status');
    if (!host) return;

    wrap = document.createElement('div');
    wrap.className = 'aro-textsize';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Interface text size');
    wrap.innerHTML =
      '<button type="button" class="aro-ts-sm" data-ts="-1" aria-label="Decrease text size">A</button>'
      + '<span class="aro-ts-val" aria-hidden="true">100%</span>'
      + '<button type="button" class="aro-ts-lg" data-ts="1" aria-label="Increase text size">A</button>';

    var sep = document.createElement('div');
    sep.className = 'header-divider';

    // sit beside the theme toggle, before the unit selector
    var unit = document.getElementById('unit-selector-container');
    if (unit && unit.parentNode === host) {
      host.insertBefore(wrap, unit);
      host.insertBefore(sep, wrap);
    } else {
      host.appendChild(sep); host.appendChild(wrap);
    }

    out = wrap.querySelector('.aro-ts-val');
    minus = wrap.querySelector('[data-ts="-1"]');
    plus = wrap.querySelector('[data-ts="1"]');
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-ts]') : null;
      if (!b || b.disabled) return;
      apply(current + parseInt(b.getAttribute('data-ts'), 10), true);
    });
  }

  /* The PDF engine no longer blocks first paint. Warm it once the page has
     settled so the first Download is still instant, without any visitor who
     never exports paying for it before the app is usable. */
  function warmPdfEngine() {
    var go = function () {
      if (typeof window.AROPDF_PRELOAD === 'function') window.AROPDF_PRELOAD();
    };
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 2500); };
    if (document.readyState === 'complete') idle(go, { timeout: 6000 });
    else window.addEventListener('load', function () { idle(go, { timeout: 6000 }); });
  }

  function init() {
    build();
    apply(readSaved(), false);
    warmPdfEngine();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AROUX = {
    scale: function () { return STEPS[current].v; },
    set: function (v) { apply(idxOf(v), false); },
    steps: STEPS.map(function (s) { return s.v; })
  };
})();

/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — UI POLISH
   1. Styled, exclusive accordions for forms built with
      <details class="pump-accordion"> (pump, DPHE): only one section
      open at a time, smooth scroll to the opened section.
   2. Line-sizing forms (liquid/gas/steam/slurry/two-phase): every
      <fieldset class="form-group"> becomes a collapsible segment —
      click a heading to open it, the previous one closes.
   Collapsing uses display:none only, so all inputs keep their values
   and calculations read them exactly as before.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var css = ''
    /* — details-based accordions (pump / dphe) — */
    + '.pump-accordion{border:1px solid rgba(43,89,195,0.22);border-radius:10px;margin:0 0 10px;background:rgba(13,22,47,0.35);overflow:hidden;}'
    + '.pump-accordion summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;padding:11px 14px;font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:0.08em;color:var(--color-saffron);text-transform:uppercase;user-select:none;transition:background .15s;}'
    + '.pump-accordion summary::-webkit-details-marker{display:none;}'
    + '.pump-accordion summary:hover{background:rgba(255,117,56,0.08);}'
    + '.pump-accordion[open]{border-color:rgba(255,117,56,0.45);box-shadow:0 4px 18px rgba(0,0,0,0.25);}'
    + '.pump-accordion[open]>summary{border-bottom:1px solid rgba(255,117,56,0.25);background:rgba(255,117,56,0.07);}'
    + '.pump-accordion summary .chevron{transition:transform .2s;font-size:9px;opacity:.8;}'
    + '.pump-accordion[open]>summary .chevron{transform:rotate(180deg);}'
    + '.pump-accordion .acc-content{padding:12px 14px;}'
    /* — collapsible fieldsets (line sizing) — */
    + 'fieldset.form-group.aro-acc{border:1px solid rgba(43,89,195,0.22);border-radius:10px;margin:0 0 10px;padding:0 12px 12px;background:rgba(13,22,47,0.35);transition:border-color .15s;}'
    + 'fieldset.form-group.aro-acc>legend{cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px;padding:4px 10px;transition:color .15s;}'
    + 'fieldset.form-group.aro-acc>legend:hover{color:#ffb28a;}'
    + 'fieldset.form-group.aro-acc>legend .aro-acc-ch{display:inline-block;transition:transform .2s;font-size:9px;opacity:.85;}'
    + 'fieldset.form-group.aro-acc.aro-open{border-color:rgba(255,117,56,0.45);box-shadow:0 4px 18px rgba(0,0,0,0.22);}'
    + 'fieldset.form-group.aro-acc.aro-open>legend .aro-acc-ch{transform:rotate(180deg);}'
    + 'fieldset.form-group.aro-acc:not(.aro-open){padding-bottom:2px;}'
    + 'fieldset.form-group.aro-acc:not(.aro-open)>*:not(legend){display:none !important;}'
    /* — fast, jank-free wheel scrolling in the tall input panels —
       smooth scroll-behavior made every wheel tick animate and felt
       laggy; momentum + contained overscroll is what users expect — */
    + '.sizing-panel.pump-left-panel,.panel.panel-input,.pump-right-panel,.results-column-data,.pump-output-section{-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}'
    + '.pump-sticky-header{box-shadow:0 6px 16px rgba(0,0,0,0.45);}';

  function inject() {
    var st = document.createElement('style');
    st.id = 'aro-ui-polish-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* A reference section — the long "how to size a ..." write-up that sits at
     the top of each design form. It is documentation, not a step of the job. */
  function isManual(d) {
    if (/-manual$/.test(d.id || '')) return true;
    var s = d.querySelector('summary');
    return !!s && /USER MANUAL/i.test(s.textContent || '');
  }

  /* Collapsible sections for <details class="pump-accordion"> forms.

     This used to force exactly one section open — the first one — on every
     load. On the pump form the first section is the user manual, so landing
     on the tab put 3,500 px of documentation on screen with every input
     section shut underneath it: the engineer had to scroll past the manual
     and then re-open each section to enter a single number. One-at-a-time
     also fought the way the form is meant to be used, since the sections
     feed each other and the panel recalculates as you type — you could not
     see the suction data while filling in the discharge side.

     Sections now keep the state the markup asks for (input sections open,
     the manual closed) and each one opens and closes on its own. */
  function setupAccordions() {
    /* Every accordion in the document, not only those inside a <form> — the
       line-sizing and tank panels put theirs outside one. */
    document.querySelectorAll('details.pump-accordion').forEach(function (d) {
      if (d.hasAttribute('data-acc-init')) return;
      d.setAttribute('data-acc-init', '1');
      if (isManual(d)) { d.open = false; return; }
      // honour the authored state; default an untagged section to open
      if (!d.hasAttribute('open') && !d.hasAttribute('data-start-closed')) d.open = true;
    });
  }

  /* Collapsible fieldsets for the line-sizing forms */
  var LINE_FORMS = ['line-form', 'line-gas-form', 'steam-form', 'slurry-form', 'tp-form'];
  function collapsibleFieldsets() {
    LINE_FORMS.forEach(function (fid) {
      var form = document.getElementById(fid);
      if (!form) return;
      var sets = Array.prototype.slice.call(form.querySelectorAll(':scope fieldset.form-group'));
      // only direct descendants (skip nested fieldsets, if any)
      sets = sets.filter(function (fs) { return fs.querySelector('legend'); });
      if (sets.length < 2) return;
      sets.forEach(function (fs, i) {
        fs.classList.add('aro-acc');
        // Open by default. Collapsing all but the first meant every line-sizing
        // run started with three clicks before a value could be typed.
        fs.classList.add('aro-open');
        var leg = fs.querySelector('legend');
        if (!leg.querySelector('.aro-acc-ch')) {
          var ch = document.createElement('span');
          ch.className = 'aro-acc-ch';
          ch.textContent = '▼';
          leg.appendChild(ch);
        }
        leg.addEventListener('click', function (e) {
          e.preventDefault();
          fs.classList.toggle('aro-open');
        });
      });
    });
  }

  function init() {
    inject();
    setupAccordions();
    collapsibleFieldsets();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

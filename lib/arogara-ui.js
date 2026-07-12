/* ═══════════════════════════════════════════════════════════════════════
   BHARAT FLOWSIZE — UI POLISH
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
    /* — smooth, uninterrupted scrolling in the tall input panels — */
    + '.sizing-panel.pump-left-panel,.panel.panel-input{scroll-behavior:smooth;}'
    + '.pump-sticky-header{box-shadow:0 6px 16px rgba(0,0,0,0.45);}';

  function inject() {
    var st = document.createElement('style');
    st.id = 'aro-ui-polish-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* One-at-a-time behaviour for <details class="pump-accordion"> forms */
  function exclusiveDetails() {
    document.querySelectorAll('form').forEach(function (form) {
      var all = form.querySelectorAll(':scope details.pump-accordion, :scope .acc-scope details.pump-accordion');
      var list = Array.prototype.slice.call(form.querySelectorAll('details.pump-accordion'));
      if (!list.length) return;
      // default state: only the first section open
      list.forEach(function (d, i) { d.open = i === 0; });
      list.forEach(function (d) {
        d.addEventListener('toggle', function () {
          if (!d.open) return;
          list.forEach(function (o) { if (o !== d && o.open) o.open = false; });
          // keep the opened section heading in view
          var sum = d.querySelector('summary');
          if (sum && sum.scrollIntoView) setTimeout(function () { sum.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 40);
        });
      });
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
        if (i === 0) fs.classList.add('aro-open');
        var leg = fs.querySelector('legend');
        if (!leg.querySelector('.aro-acc-ch')) {
          var ch = document.createElement('span');
          ch.className = 'aro-acc-ch';
          ch.textContent = '▼';
          leg.appendChild(ch);
        }
        leg.addEventListener('click', function (e) {
          e.preventDefault();
          var isOpen = fs.classList.contains('aro-open');
          if (isOpen) { fs.classList.remove('aro-open'); return; }
          sets.forEach(function (o) { o.classList.remove('aro-open'); });
          fs.classList.add('aro-open');
          if (leg.scrollIntoView) setTimeout(function () { leg.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 40);
        });
      });
    });
  }

  function init() {
    inject();
    exclusiveDetails();
    collapsibleFieldsets();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

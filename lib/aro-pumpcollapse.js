/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Collapsible detail sections for the Pump Hydraulics results
   window.AROPUMPCOLLAPSE

   The pump results column is ~19,000px of genuine, non-duplicate
   engineering content spanning 26 phases — nothing in it is padding or
   an oversized empty wrapper. The concrete way to shorten the DEFAULT
   view without deleting any information is to show the ranked/detail
   sections compact-first: top pick + anything that needs attention,
   with the complete existing list one click away, unchanged.

   This file owns only the UI mechanics — state, the <details> wrapper,
   the global Expand All / Collapse Details controls, and the print
   safety net. It never recomputes a ranking or drops a candidate; each
   caller still builds its own full list exactly as before and hands it
   to pumpWrap() to wrap, not replace.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  /* key -> true (user left it open) / false|undefined (collapsed).
     Cleared on every new RUN CALCULATION so a fresh result always opens
     compact, never inheriting a previous run's expanded state. */
  var state = {};
  var registry = [];

  function esc(x) {
    return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* compactHtml is always visible. fullHtml is the section's existing,
     unmodified list/table markup, shown on expand. moreLabel names what
     is being expanded ("15 ranked options", "14 checks", ...) so the
     control reads as a specific engineering disclosure, not a generic
     "show more" link. */
  function pumpWrap(key, compactHtml, fullHtml, moreLabel) {
    if (registry.indexOf(key) === -1) registry.push(key);
    var isOpen = !!state[key];
    return '<div class="pump-collapsible" data-pump-collapse-key="' + esc(key) + '">'
      + compactHtml
      + '<details class="pump-accordion pump-detail-acc"' + (isOpen ? ' open' : '') + '>'
      + '<summary><span class="chevron">&#9656;</span> ' + esc(moreLabel || 'Show full list') + '</summary>'
      + '<div class="acc-content">' + fullHtml + '</div>'
      + '</details>'
      + '</div>';
  }

  /* <details>'s own 'toggle' event does not bubble, but it can still be
     caught during the capture phase on an ancestor — which is what lets
     one delegated listener survive every innerHTML re-render of these
     sections without being individually re-attached each time. */
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS' || !d.classList.contains('pump-detail-acc')) return;
    var wrap = d.closest('[data-pump-collapse-key]');
    if (!wrap) return;
    state[wrap.getAttribute('data-pump-collapse-key')] = d.open;
  }, true);

  function setAll(open) {
    document.querySelectorAll('#pump-results [data-pump-collapse-key]').forEach(function (wrap) {
      var key = wrap.getAttribute('data-pump-collapse-key');
      state[key] = open;
      var det = wrap.querySelector(':scope > details.pump-detail-acc');
      if (det) det.open = open;
    });
  }

  /* Called once at the start of a fresh RUN CALCULATION — not on every
     re-render of the same result, which would otherwise slam shut a
     section the engineer just opened to read. */
  function resetToCompact() {
    state = {};
    registry = [];
  }

  /* Printing (or a plain browser Ctrl+P without opening the separate
     REPORT modal, which builds its own always-complete HTML from the
     calculation directly and is untouched by any of this) must not
     silently omit a collapsed section. <details> without [open] removes
     its content from the render tree entirely in every browser, which
     no print stylesheet can override — only forcing the attribute open
     actually works, so that is what beforeprint/afterprint do here. */
  var openedForPrint = null;
  window.addEventListener('beforeprint', function () {
    openedForPrint = [];
    document.querySelectorAll('#pump-results details.pump-detail-acc').forEach(function (d) {
      if (!d.open) { openedForPrint.push(d); d.open = true; }
    });
  });
  window.addEventListener('afterprint', function () {
    if (!openedForPrint) return;
    openedForPrint.forEach(function (d) { d.open = false; });
    openedForPrint = null;
  });

  window.AROPUMPCOLLAPSE = { wrap: pumpWrap, expandAll: function () { setAll(true); }, collapseAll: function () { setAll(false); }, reset: resetToCompact };
  window.pumpExpandAll = window.AROPUMPCOLLAPSE.expandAll;
  window.pumpCollapseDetails = window.AROPUMPCOLLAPSE.collapseAll;
})();

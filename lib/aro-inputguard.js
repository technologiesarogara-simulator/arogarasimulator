/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — INPUT GUARD  (window.AROGUARD)
   ---------------------------------------------------------------------------
   "Any value which user is entering is getting increased or decreased by
    scroll up and down which is an inconvenient or can create an error while
    scrolling up or down to move on another input."

   A focused <input type="number"> treats the mouse wheel as a spinner. On a
   data sheet that is forty fields long the engineer scrolls constantly, and
   every scroll that begins over the field they have just filled in silently
   edits it. A design pressure of 12 becomes 9 on the way down the page, the
   change looks like nothing at all, and it is carried into the calculation.

   Wheel over a number field no longer edits it. The field gives up focus and
   the page scrolls, which is what the gesture was for — the pointer was on
   its way somewhere else. Arrow keys and the spinner buttons still step the
   value, because those are deliberate.

   Two things stay untouched: the value, and the page's own scrolling. This
   does not preventDefault on the wheel, so scrolling never feels sticky over
   a form.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function isNumber(el) {
    return !!(el && el.tagName === 'INPUT' && String(el.type).toLowerCase() === 'number');
  }

  /* The wheel only edits a number field while it HAS focus, so dropping focus
     is enough — and it is the honest thing to do, since the pointer has left
     for another part of the sheet. Registered in the capture phase so it
     lands before the browser applies the increment, and passive so the page
     keeps scrolling normally. */
  document.addEventListener('wheel', function (e) {
    var el = document.activeElement;
    if (!isNumber(el)) return;
    /* only when the pointer is actually over that field — a wheel elsewhere
       on the page never reaches it anyway, but this keeps it explicit */
    if (e.target !== el && !(el.contains && el.contains(e.target))) { el.blur(); return; }
    el.blur();
  }, { capture: true, passive: true });

  /* Belt and braces for browsers that deliver the wheel to the element
     itself: refuse the increment outright without touching page scroll. */
  document.addEventListener('wheel', function (e) {
    if (isNumber(e.target) && e.target === document.activeElement) e.target.blur();
  }, { capture: true, passive: true });

  window.AROGUARD = { isNumberField: isNumber };
})();

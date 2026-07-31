/* ══════════════════════════════════════════════════════════════════════
   AROGARA — RENDER GATE  (window.AROVIS)

   Each module owns a Three.js render loop driven by requestAnimationFrame,
   and every one of them kept drawing whether or not its canvas was on
   screen. With a module open, scrolling the results panel measured 120 long
   frames out of 121: the browser was spending its whole budget redrawing a
   scene nobody could see, and the page shuddered as a result.

   A loop asks this gate whether it is worth drawing. The answer is no when
   the tab is in the background, or when the canvas is not intersecting the
   viewport. Visibility is answered from an IntersectionObserver record
   rather than by measuring on the spot, so asking costs nothing.

     if (!AROVIS.visible(renderer.domElement)) return;   // still queued, just idle

   The loop keeps requesting frames, so it resumes the instant the canvas
   comes back into view — nothing has to be restarted.

   Where IntersectionObserver is missing, visible() answers true and
   behaviour is exactly as it was.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var supported = typeof IntersectionObserver === 'function';
  var seen = typeof WeakMap === 'function' ? new WeakMap() : null;
  var io = null;

  if (supported && seen) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen.set(e.target, e.isIntersecting); });
    }, { root: null, rootMargin: '120px', threshold: 0 });
  }

  /* True when the element is worth drawing into. An element the gate has not
     met yet is observed and treated as visible for that first frame, so a
     canvas is never blank on the frame it appears. */
  function visible(el) {
    if (!el || !io || !seen) return true;
    if (document.hidden) return false;
    if (!seen.has(el)) { seen.set(el, true); try { io.observe(el); } catch (e) {} return true; }
    return seen.get(el) !== false;
  }

  /* Let a loop opt out entirely — used by the report exporter, which wants
     the scene rendered once into a canvas without the loop competing. */
  var forced = false;
  function forceAll(on) { forced = !!on; }
  function isForced() { return forced; }

  window.AROVIS = {
    visible: function (el) { return forced ? true : visible(el); },
    forceAll: forceAll,
    isForced: isForced,
    supported: supported
  };
})();

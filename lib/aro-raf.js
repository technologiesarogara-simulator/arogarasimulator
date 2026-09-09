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

  /* A cached "not intersecting" can go stale. A results panel that reveals
     several canvases at once (display:none -> block, right after a
     calculation) can register them with the observer a moment before the
     reveal actually lands — because the run that triggers the reveal is
     itself the same long stretch of synchronous work that keeps the main
     thread too busy to schedule the observer's own callback promptly. The
     callback that eventually does fire can end up judging the pre-reveal
     layout (genuinely not intersecting, at zero height) and never gets a
     reason to fire again on its own — IntersectionObserver re-evaluates on
     layout/scroll changes, not because a caller wishes it would, and a
     display:none removed from an ancestor is not guaranteed to count as
     one. The reported symptom this produced was exact: the panel stayed
     blank indefinitely, and only scrolling — which does force a fresh
     intersection computation — brought it back.
     A cached "false" is therefore re-verified with a real measurement
     every RECHECK_MS at most (cheap: one getBoundingClientRect() on an
     already-hidden element, not the "ten forced layouts a frame" this file
     exists to avoid), so a canvas that only *looked* hidden to the observer
     self-corrects within a fraction of a second instead of waiting on the
     visitor to happen to scroll it back into view. */
  var staleCheck = typeof WeakMap === 'function' ? new WeakMap() : null;
  var RECHECK_MS = 350;
  function recheckStale(el) {
    if (!staleCheck) return false;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var last = staleCheck.get(el) || 0;
    if (now - last < RECHECK_MS) return false;
    staleCheck.set(el, now);
    if (!el.offsetParent) return false;
    var r = el.getBoundingClientRect();
    var ok = r.width > 8 && r.height > 0 && r.bottom > -120 && r.top < (window.innerHeight || 800) + 120;
    if (ok) seen.set(el, true);
    return ok;
  }

  /* True when the element is worth drawing into. An element the gate has not
     met yet is observed and treated as visible for that first frame, so a
     canvas is never blank on the frame it appears. */
  function visible(el) {
    if (!el || !io || !seen) return true;
    if (document.hidden) return false;
    if (!seen.has(el)) { seen.set(el, true); try { io.observe(el); } catch (e) {} return true; }
    if (seen.get(el) !== false) return true;
    return recheckStale(el);
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

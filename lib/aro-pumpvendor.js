/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Vendor Pump Curve engine
   window.AROPUMPVENDOR

   Phase 12 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Lets the engineer enter a handful of literal Q-H points off an
   actual vendor curve and treats them as VENDOR DATA — connected by
   straight lines only, never smoothed or fitted to a polynomial, so
   nothing here invents a shape the vendor didn't publish. The result
   exposes exactly the {head(Q), Qbep} interface
   AROPUMPCURVE.operatingPoint() already expects, so the existing
   intersection-finding code runs unmodified against a vendor curve
   instead of the predicted one — no duplicated root-finding logic.

   WHAT THIS IS NOT
   - Not a curve fit. Between two entered points the curve is a
     straight line; outside the entered range it is held flat at the
     nearest entered point rather than extrapolated — both are stated
     explicitly by the result, and the caller should flag when the
     current query point had to be extrapolated (`atOrPastRange`).
   - Not a substitute for the vendor's own certified data sheet — this
     is what the engineer chooses to type in from it.

   API
     AROPUMPVENDOR.interpolate(points, Q)
     AROPUMPVENDOR.buildVendorCurve(rawPoints, bepQ)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* points must already be sorted ascending by q, with >= 1 entry. */
  function interpolate(points, Q) {
    if (points.length === 1) return points[0].h;
    if (Q <= points[0].q) return points[0].h;
    if (Q >= points[points.length - 1].q) return points[points.length - 1].h;
    for (var i = 1; i < points.length; i++) {
      if (Q <= points[i].q) {
        var a = points[i - 1], b = points[i];
        var frac = (b.q === a.q) ? 0 : (Q - a.q) / (b.q - a.q);
        return a.h + frac * (b.h - a.h);
      }
    }
    return points[points.length - 1].h;
  }

  /* ── buildVendorCurve: literal points -> an AROPUMPCURVE-shaped object
     rawPoints = [{q,h}, ...] (unsorted, may include incomplete/invalid
     rows the caller hasn't filtered yet); bepQ = the rated/BEP flow to
     report %BEP against (defaults to the middle entered point when not
     supplied, since a vendor curve alone doesn't say which point is BEP
     unless the engineer names one). */
  function buildVendorCurve(rawPoints, bepQ) {
    var pts = (rawPoints || [])
      .filter(function (p) { return p && isFinite(p.q) && isFinite(p.h) && p.q >= 0 && p.h >= 0; })
      .sort(function (a, b) { return a.q - b.q; });

    if (pts.length < 2) {
      return { valid: false, reason: 'Enter at least two vendor flow/head points to draw a vendor curve.' };
    }

    var Qbep = (isFinite(bepQ) && bepQ > 0) ? bepQ : pts[Math.floor((pts.length - 1) / 2)].q;
    var Qmin = pts[0].q, Qmax = pts[pts.length - 1].q;

    return {
      valid: true, points: pts, Qbep: Qbep, Qmin: Qmin, Qmax: Qmax,
      head: function (Q) { return interpolate(pts, Q); },
      // Vendor points here are flow/head only — AROPUMPCURVE.operatingPoint()
      // also reads .eff()/.npshr() to build its return object, so both are
      // exposed as NaN (never entered) rather than omitted, which would
      // throw inside that shared function instead of just reading empty.
      eff: function () { return NaN; },
      npshr: function () { return NaN; },
      atOrPastRange: function (Q) { return Q < Qmin || Q > Qmax; },
    };
  }

  window.AROPUMPVENDOR = {
    interpolate: interpolate,
    buildVendorCurve: buildVendorCurve,
  };
})();

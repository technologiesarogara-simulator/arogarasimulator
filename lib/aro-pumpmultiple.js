/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Multiple Pump Operation engine
   window.AROPUMPMULTIPLE

   Phase 13 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Builds a combined-curve object for N identical pumps run in
   parallel, in series, or as duty/standby, exposing exactly the same
   {head(Q), eff(Q), npshr(Q), Qbep} shape AROPUMPCURVE.make() already
   returns — so the caller feeds it straight into the existing
   AROPUMPCURVE.operatingPoint()/region() functions instead of
   reimplementing curve-intersection math for the multi-pump case.

   METHOD
     - Parallel (N identical units sharing a common header): at any
       combined flow Q, each unit carries Q/N at the SAME head, so
       combinedHead(Q) = singleHead(Q/N) and the combined BEP flow is
       N times the single unit's.
     - Series (N identical units, same flow through each): each unit
       adds its own head at the shared flow, so
       combinedHead(Q) = N · singleHead(Q), and BEP flow is unchanged.
     - Duty/standby (1 running, N-1 idle spares): hydraulically
       identical to a single unit — the combined curve is the base
       curve unchanged. The screening value here is not curve math,
       it's the reminder that only one unit is assumed running.

   WHAT THIS IS NOT
   - Not a check of the shared piping. Parallel operation increases the
     flow (and so the velocity and friction loss) through any common
     suction/discharge header upstream of where the units split — the
     single-pump NPSHa and line-loss figures the base calculation
     already produced do NOT account for that, and this module always
     says so for a parallel arrangement rather than silently reusing
     them.
   - Not a check that the pumps are actually identical, or that a
     shared header is even sized for combined flow — those are the
     engineer's inputs, not something derived here.

   API
     AROPUMPMULTIPLE.buildCombinedCurve(basePumpCurve, n, arrangement)
     AROPUMPMULTIPLE.unitsRunning(n, arrangement)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function unitsRunning(n, arrangement) {
    if (arrangement === 'duty-standby') return 1;
    return n; // parallel and series both run all n units
  }

  /* ── buildCombinedCurve: N identical units -> one AROPUMPCURVE-shaped
     object. basePumpCurve must expose head(Q), eff(Q), npshr(Q), Qbep —
     exactly what AROPUMPCURVE.make() already returns. */
  function buildCombinedCurve(basePumpCurve, n, arrangement) {
    if (!basePumpCurve || typeof basePumpCurve.head !== 'function' || !isFinite(basePumpCurve.Qbep)) {
      return { valid: false, reason: 'A base pump curve (from the predicted-curve engine) is needed first — run the pump hydraulic calculation with curve prediction on.' };
    }
    if (!isFinite(n) || n < 1 || Math.round(n) !== n) {
      return { valid: false, reason: 'Number of units must be a whole number of 1 or more.' };
    }
    if (arrangement !== 'parallel' && arrangement !== 'series' && arrangement !== 'duty-standby') {
      return { valid: false, reason: 'Arrangement must be "parallel", "series" or "duty-standby".' };
    }
    if (arrangement !== 'duty-standby' && n < 2) {
      return { valid: false, reason: 'Parallel and series arrangements need at least 2 units — use duty/standby to describe a single running unit with a spare.' };
    }

    var warnings = [];
    var curve;
    if (arrangement === 'parallel') {
      curve = {
        Qbep: basePumpCurve.Qbep * n,
        head: function (Q) { return basePumpCurve.head(Q / n); },
        eff: function (Q) { return basePumpCurve.eff(Q / n); },
        npshr: function (Q) { return basePumpCurve.npshr(Q / n); },
      };
      warnings.push('Parallel operation increases the flow — and so the velocity and friction loss — through any shared suction/discharge header upstream of where the units split. The NPSHa and line-loss figures the base calculation produced are for a single unit\'s flow and do not account for this; the shared header needs its own line-loss check at the combined flow.');
    } else if (arrangement === 'series') {
      curve = {
        Qbep: basePumpCurve.Qbep,
        head: function (Q) { return n * basePumpCurve.head(Q); },
        eff: function (Q) { return basePumpCurve.eff(Q); },
        npshr: function (Q) { return basePumpCurve.npshr(Q); },
      };
      warnings.push('NPSHr for a series arrangement is governed by the first (upstream) unit alone — the units behind it see the previous unit\'s discharge pressure as their suction pressure, not the original suction condition, so their NPSH margin is normally very large.');
    } else {
      curve = { Qbep: basePumpCurve.Qbep, head: basePumpCurve.head, eff: basePumpCurve.eff, npshr: basePumpCurve.npshr };
      warnings.push('Duty/standby describes redundancy, not added hydraulic capacity — one unit alone is assumed to carry the full duty, exactly as the base calculation already sized it. Confirm the changeover valves/procedure rather than expecting more flow or head than a single unit gives.');
    }

    return { valid: true, arrangement: arrangement, n: n, unitsRunning: unitsRunning(n, arrangement), curve: curve, warnings: warnings };
  }

  window.AROPUMPMULTIPLE = {
    buildCombinedCurve: buildCombinedCurve,
    unitsRunning: unitsRunning,
  };
})();

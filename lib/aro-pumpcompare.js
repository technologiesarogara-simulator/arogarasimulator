/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Pump Comparison
   window.AROPUMPCOMPARE

   Phase 25 of the Pump Hydraulics Advanced Upgrade.

   The app already has an undo/redo stack (pushUndo/performUndo in
   app.js) that snapshots FORM INPUTS so an edit can be stepped back —
   investigated before writing this file. It is a different job: it
   walks backward through edits, it does not hold two calculated results
   side by side for comparison. So this phase adds its own lightweight,
   in-memory snapshot pair (Snapshot A / Snapshot B) that captures the
   CALCULATED RESULTS at the moment the user clicks "save," rather than
   duplicating or rewiring the existing input-history mechanism.

   buildComparison(...) is pure — no DOM, no snapshot-taking logic itself
   (that lives in app.js, reading whatever the last calculation already
   produced). It only compares two already-computed metric bundles,
   metric by metric — no engineering formula is recomputed here, only
   subtraction and percentage change on numbers Phases 1/24 already
   produced.

   Loadable/unit-testable in Node like every other engine here.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var METRICS = [
    { id: 'Q_m3h', label: 'Design Flow', unit: 'm³/h', better: null },
    { id: 'H_m', label: 'Differential Head', unit: 'm', better: null },
    { id: 'bhp_kW', label: 'Brake Power', unit: 'kW', better: 'lower' },
    { id: 'pumpEffPct', label: 'Pump Efficiency', unit: '%', better: 'higher' },
    { id: 'npshMargin_m', label: 'NPSH Margin', unit: 'm', better: 'higher' },
    { id: 'motorLoadingPct', label: 'Motor Loading', unit: '%', better: null },
    { id: 'annualEnergyCost', label: 'Annual Energy Cost', unit: '/yr', better: 'lower' },
  ];

  function compareOne(metric, a, b) {
    var va = a[metric.id], vb = b[metric.id];
    if (!isFinite(va) || !isFinite(vb)) {
      return { id: metric.id, label: metric.label, unit: metric.unit, status: 'DATA REQUIRED', a: va, b: vb, delta: null, pctChange: null, verdict: null };
    }
    var delta = vb - va;
    var pctChange = (va !== 0) ? (delta / Math.abs(va)) * 100 : null;
    var verdict = 'NEUTRAL';
    if (metric.better === 'higher') verdict = vb > va ? 'B BETTER' : (vb < va ? 'A BETTER' : 'TIE');
    else if (metric.better === 'lower') verdict = vb < va ? 'B BETTER' : (vb > va ? 'A BETTER' : 'TIE');
    return { id: metric.id, label: metric.label, unit: metric.unit, status: 'CALCULATED', a: va, b: vb, delta: delta, pctChange: pctChange, verdict: verdict };
  }

  /* a, b = snapshot bundles, each { label, Q_m3h, H_m, bhp_kW,
     pumpEffPct, npshMargin_m, motorLoadingPct, annualEnergyCost } —
     whichever fields the caller actually captured; a missing field on
     either side reports that row DATA REQUIRED rather than comparing
     against a placeholder. */
  function buildComparison(a, b) {
    if (!a || !b) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Save two snapshots (A and B) to compare them.' };
    }
    var rows = METRICS.map(function (m) { return compareOne(m, a, b); });
    return { applicable: true, status: 'CALCULATED', labelA: a.label || 'Snapshot A', labelB: b.label || 'Snapshot B', rows: rows };
  }

  window.AROPUMPCOMPARE = { METRICS: METRICS, buildComparison: buildComparison };
})();

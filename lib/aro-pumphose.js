/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Peristaltic (Hose) Pump Mechanical Design (screening) engine
   window.AROPUMPHOSE

   Pump build Step 6. Pure calculation module — no DOM access — same
   "one IIFE, one namespace" pattern as the other pump engines, loadable
   and unit-testable in Node with nothing but `global.window = global`.

   PURPOSE
   Full-track mechanical design for the "Peristaltic (Hose) Pump" row of
   PUMP_SELECTION_STANDARD — the one full-track family with NO shaft
   seal at all, because the pumped fluid never touches a bearing, seal
   or rotor: it is fully contained inside the hose, which rollers or
   shoes compress against the casing track as the rotor turns.
     1. screenElastomer() — ranks the five common peristaltic hose
        elastomers (NR, NBR, EPDM, Silicone, Hypalon/CSM) against the
        fluid's corrosivity, temperature and any hygienic requirement —
        the same SUITABLE/CHECK/NOT RECOMMENDED style Phase 9's seal-
        material screening uses, but for the hose itself rather than a
        mechanical seal face.
     2. checkPressureCeiling() — a HARD ceiling, not a soft preference:
        the row's own keyLimitations text says so explicitly. Exceeding
        the selected hose's burst-derived rated pressure is always NOT
        RECOMMENDED, never just a warning.
     3. estimateHoseLife() — a representative service-life estimate
        (hours) from the elastomer's baseline life, then derated for
        how hard the duty pushes it: pressure as a fraction of the
        hose's rated ceiling, roller speed (more compression cycles per
        hour at the same total-cycle life means fewer calendar hours),
        and abrasive service.
     4. selectRollerConfig() — 2-roller (lower hose wear, more
        pulsation) vs 3-roller/dual-head (smoother flow, more contact
        cycles per revolution) from whether the duty is pulsation-
        sensitive.
     5. bearingIsolationNote() — the construction fact that makes this
        family sealless: the rotor's own bearings sit behind the roller
        assembly, entirely isolated from the process fluid by the hose
        itself, with no shaft penetration into the wetted path at all.
     6. selectHoseBore() — an independent hose-bore sizing table (down
        to 1/4"-1/2"), deliberately separate from the pipe-NPS nozzle
        table the rest of the report uses, because a peristaltic hose
        bore is not a pipe size and the family's typical flows run far
        smaller than the pipe table's own low end.

   WHAT THIS IS NOT
   - Not a vendor hose selection. Elastomer temperature/pressure ratings
     and hose-life figures are representative published orders of
     magnitude for screening, not a specific manufacturer's hose data
     sheet.
   - Not a fatigue/finite-element hose-wall analysis. The life estimate
     is a named, derated baseline — the same spirit as Phase 8's L10
     bearing screening — not a certified service-life guarantee.

   STANDARDS BASIS: no single standard applies — the same citation
   PUMP_SELECTION_STANDARD carries for this row.

   API
     AROPUMPHOSE.HOSE_ELASTOMERS
     AROPUMPHOSE.HOSE_BORES
     AROPUMPHOSE.screenElastomer(input)
     AROPUMPHOSE.checkPressureCeiling(diffPressureBar, elastomerId)
     AROPUMPHOSE.estimateHoseLife(input)
     AROPUMPHOSE.selectRollerConfig(pulsationSensitive)
     AROPUMPHOSE.bearingIsolationNote()
     AROPUMPHOSE.selectHoseBore(Q_m3h)
     AROPUMPHOSE.design(input) — full orchestration of all of the above
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  function worse(a, b) { return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b; }
  var CLASS_RANK = { mild: 1, moderate: 2, severe: 3 };

  var HOSE_ELASTOMERS = [
    { id: 'nr', name: 'Natural Rubber (NR)', tempRangeC: [-20, 80], maxPressureBar: 15, corrosivityTolerance: 'mild', hygienicCapable: false, baseLifeHours: 3500,
      note: 'Best flex life and pressure capability of the common hose elastomers, and the default general-purpose choice — moderate chemical resistance only.' },
    { id: 'nbr', name: 'Nitrile (NBR)', tempRangeC: [-20, 100], maxPressureBar: 12, corrosivityTolerance: 'moderate', hygienicCapable: false, baseLifeHours: 2500,
      note: 'Good oil/hydrocarbon resistance where natural rubber would swell — the choice for oily or fuel-adjacent duty.' },
    { id: 'epdm', name: 'EPDM', tempRangeC: [-30, 120], maxPressureBar: 10, corrosivityTolerance: 'moderate', hygienicCapable: true, baseLifeHours: 2800,
      note: 'Good water, steam and general chemical resistance and commonly available in a food-grade formulation — poor resistance to oils and most hydrocarbons.' },
    { id: 'silicone', name: 'Silicone', tempRangeC: [-50, 150], maxPressureBar: 6, corrosivityTolerance: 'mild', hygienicCapable: true, baseLifeHours: 1500,
      note: 'The hygienic/pharma-grade choice with the widest temperature range, but the lowest pressure and flex-life capability of the five — a low-pressure dosing hose, not a high-pressure transfer one.' },
    { id: 'hypalon', name: 'Hypalon / Chlorosulfonated Polyethylene (CSM)', tempRangeC: [-20, 90], maxPressureBar: 12, corrosivityTolerance: 'severe', hygienicCapable: false, baseLifeHours: 3000,
      note: 'The best chemical, ozone and weathering resistance of the five — the choice for aggressive chemical dosing rather than general transfer.' },
  ];

  // A deliberately independent bore table, not the pipe-NPS nozzle table
  // the rest of the report uses — peristaltic hose bores run far smaller
  // and are sized as discrete hose products, not pipe schedule sizes.
  var HOSE_BORES = [
    { bore: '1/4"', bore_mm: 6.35, maxFlowM3h: 0.5 },
    { bore: '3/8"', bore_mm: 9.5, maxFlowM3h: 1.2 },
    { bore: '1/2"', bore_mm: 12.7, maxFlowM3h: 2.5 },
    { bore: '3/4"', bore_mm: 19.05, maxFlowM3h: 6 },
    { bore: '1"', bore_mm: 25.4, maxFlowM3h: 12 },
    { bore: '1.5"', bore_mm: 38.1, maxFlowM3h: 30 },
    { bore: '2"', bore_mm: 50.8, maxFlowM3h: 55 },
    { bore: '3"', bore_mm: 76.2, maxFlowM3h: 100 },
  ];

  /* ── screenElastomer ──────────────────────────────────────────────
     input = { corrosivityClass, tempC, hygienicRequired (bool) } */
  function screenElastomer(input) {
    input = input || {};
    var corrosivityClass = input.corrosivityClass, tempC = input.tempC, hygienicRequired = !!input.hygienicRequired;
    if (!corrosivityClass) return { applicable: false, status: 'DATA REQUIRED', reason: 'Fluid corrosivity classification is not available — select a listed service fluid.' };
    if (!isFinite(tempC)) return { applicable: false, status: 'DATA REQUIRED', reason: 'Operating temperature is needed — run the pump hydraulic calculation first.' };

    var ranked = HOSE_ELASTOMERS.map(function (e) {
      var verdict = 'SUITABLE';
      var reasons = [];
      var warnings = [];

      var fluidRank = CLASS_RANK[corrosivityClass];
      var matRank = CLASS_RANK[e.corrosivityTolerance];
      if (fluidRank > matRank) {
        verdict = worse(verdict, 'NOT RECOMMENDED');
        reasons.push('Fluid corrosivity (' + corrosivityClass + ') exceeds this elastomer\'s typical tolerance (' + e.corrosivityTolerance + ').');
      } else {
        reasons.push('Fluid corrosivity (' + corrosivityClass + ') is within this elastomer\'s typical tolerance (' + e.corrosivityTolerance + ').');
      }

      if (tempC > e.tempRangeC[1]) {
        verdict = worse(verdict, 'NOT RECOMMENDED');
        warnings.push('Operating temperature ' + tempC.toFixed(0) + '°C exceeds this elastomer\'s ' + e.tempRangeC[1] + '°C limit.');
      } else if (tempC > 0.9 * e.tempRangeC[1]) {
        verdict = worse(verdict, 'CHECK');
        warnings.push('Operating temperature ' + tempC.toFixed(0) + '°C is close to this elastomer\'s ' + e.tempRangeC[1] + '°C limit.');
      } else if (tempC < e.tempRangeC[0]) {
        verdict = worse(verdict, 'NOT RECOMMENDED');
        warnings.push('Operating temperature ' + tempC.toFixed(0) + '°C is below this elastomer\'s ' + e.tempRangeC[0] + '°C limit.');
      }

      if (hygienicRequired && !e.hygienicCapable) {
        verdict = worse(verdict, 'NOT RECOMMENDED');
        warnings.push('Hygienic/sanitary duty was specified — this elastomer is not commonly available in a food/pharma-grade formulation.');
      } else if (hygienicRequired) {
        reasons.push('Commonly available in a food/pharma-grade formulation, suiting the hygienic/sanitary duty specified.');
      }

      return { id: e.id, name: e.name, verdict: verdict, reasons: reasons, warnings: warnings, maxPressureBar: e.maxPressureBar, tempRangeC: e.tempRangeC, note: e.note };
    }).sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || b.maxPressureBar - a.maxPressureBar; });

    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', ranked: ranked, top: ranked[0] };
  }

  function checkPressureCeiling(diffPressureBar, elastomerId) {
    var e = HOSE_ELASTOMERS.filter(function (x) { return x.id === elastomerId; })[0];
    if (!e || !isFinite(diffPressureBar)) return { applicable: false, status: 'DATA REQUIRED', reason: 'A selected elastomer and a calculated differential pressure are both needed.' };
    var verdict, message;
    if (diffPressureBar > e.maxPressureBar) {
      verdict = 'NOT RECOMMENDED';
      message = 'Required differential pressure ' + diffPressureBar.toFixed(1) + ' bar exceeds this hose\'s ' + e.maxPressureBar + ' bar rated ceiling — a hard limit set by the hose\'s own burst rating, not a soft preference. This duty is not achievable on this hose regardless of any other consideration.';
    } else if (diffPressureBar > 0.8 * e.maxPressureBar) {
      verdict = 'CHECK';
      message = 'Required differential pressure ' + diffPressureBar.toFixed(1) + ' bar is within the ' + e.maxPressureBar + ' bar rated ceiling but close to it — expect a shorter hose service life at this margin.';
    } else {
      verdict = 'SUITABLE';
      message = 'Required differential pressure ' + diffPressureBar.toFixed(1) + ' bar is comfortably within the ' + e.maxPressureBar + ' bar rated ceiling.';
    }
    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', verdict: verdict, message: message, maxPressureBar: e.maxPressureBar, marginFraction: diffPressureBar / e.maxPressureBar };
  }

  var REFERENCE_RPM = 80; // a representative baseline peristaltic pump roller speed, for the speed-derating factor

  /* ── estimateHoseLife ─────────────────────────────────────────────
     input = { elastomerId, diffPressureBar, N_rpm, abrasives } */
  function estimateHoseLife(input) {
    input = input || {};
    var e = HOSE_ELASTOMERS.filter(function (x) { return x.id === input.elastomerId; })[0];
    if (!e || !isFinite(input.diffPressureBar) || !isFinite(input.N_rpm)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'A selected elastomer, differential pressure and pump speed are all needed.' };
    }
    var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
    var pressureRatio = clamp(e.maxPressureBar / Math.max(0.1, input.diffPressureBar), 0.3, 3);
    var pressureFactor = Math.pow(pressureRatio, 1.5);
    var speedFactor = clamp(REFERENCE_RPM / Math.max(1, input.N_rpm), 0.3, 3);
    var abrasiveFactor = input.abrasives ? 0.5 : 1.0;
    var estimatedHours = e.baseLifeHours * pressureFactor * speedFactor * abrasiveFactor;
    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', elastomerId: e.id, elastomerName: e.name,
      baseLifeHours: e.baseLifeHours, pressureFactor: pressureFactor, speedFactor: speedFactor, abrasiveFactor: abrasiveFactor,
      estimatedHours: estimatedHours,
      note: 'A representative published order of magnitude for this elastomer, derated for how hard this duty pushes it (pressure margin, roller speed, abrasives) — not a vendor-certified service-life guarantee. The hose is a wear/replacement item on every peristaltic pump regardless of the estimate.',
    };
  }

  function selectRollerConfig(pulsationSensitive) {
    if (pulsationSensitive) {
      return {
        applicable: true, config: '3-roller / dual-head', rollerCount: 3,
        note: 'More contact points per revolution smooth the flow at the cost of more compression cycles (faster hose wear) per revolution — worth it when the duty is pulsation-sensitive.',
      };
    }
    return {
      applicable: true, config: '2-roller', rollerCount: 2,
      note: 'Fewer compression cycles per revolution means longer hose life for the same duty — the default choice absent a pulsation-sensitivity requirement.',
    };
  }

  function bearingIsolationNote() {
    return 'The rotor\'s own bearings sit behind the roller/shoe assembly, entirely isolated from the process fluid by the hose itself — there is no shaft penetration into the wetted path at all, which is why this family needs no mechanical seal or packed gland where every other full-track family does.';
  }

  function selectHoseBore(Q_m3h) {
    if (!(Q_m3h > 0)) return { applicable: false, status: 'DATA REQUIRED', reason: 'Flow is needed first.' };
    for (var i = 0; i < HOSE_BORES.length; i++) {
      if (HOSE_BORES[i].maxFlowM3h >= Q_m3h) {
        return { applicable: true, status: 'PRELIMINARY ASSUMPTION', bore: HOSE_BORES[i].bore, bore_mm: HOSE_BORES[i].bore_mm, maxFlowM3h: HOSE_BORES[i].maxFlowM3h };
      }
    }
    var last = HOSE_BORES[HOSE_BORES.length - 1];
    return { applicable: true, status: 'CHECK', bore: last.bore, bore_mm: last.bore_mm, maxFlowM3h: last.maxFlowM3h,
      warning: 'Required flow exceeds this table\'s largest listed hose bore (' + last.bore + ') — likely needs a multi-head arrangement or a larger vendor-specific hose than this screening table lists.' };
  }

  /* ── design: full orchestration ─────────────────────────────────────
     input = { corrosivityClass, tempC, hygienicRequired, diffPressureBar,
     N_rpm, abrasives, pulsationSensitive, Q_m3h } */
  function design(input) {
    input = input || {};
    var elastomer = screenElastomer({ corrosivityClass: input.corrosivityClass, tempC: input.tempC, hygienicRequired: input.hygienicRequired });
    var topElastomerId = elastomer.applicable ? elastomer.top.id : null;
    var pressureCeiling = topElastomerId ? checkPressureCeiling(input.diffPressureBar, topElastomerId) : { applicable: false, status: elastomer.status, reason: elastomer.reason };
    var hoseLife = topElastomerId ? estimateHoseLife({ elastomerId: topElastomerId, diffPressureBar: input.diffPressureBar, N_rpm: input.N_rpm, abrasives: input.abrasives }) : { applicable: false, status: elastomer.status, reason: elastomer.reason };
    var rollerConfig = selectRollerConfig(input.pulsationSensitive);
    var hoseBore = selectHoseBore(input.Q_m3h);

    return {
      applicable: !!(elastomer.applicable && pressureCeiling.applicable && hoseLife.applicable),
      status: 'PRELIMINARY ASSUMPTION',
      standardsBasis: 'No single standard applies — manufacturer-specific',
      elastomer: elastomer, pressureCeiling: pressureCeiling, hoseLife: hoseLife,
      rollerConfig: rollerConfig, bearingIsolation: bearingIsolationNote(), hoseBore: hoseBore,
    };
  }

  window.AROPUMPHOSE = {
    HOSE_ELASTOMERS: HOSE_ELASTOMERS,
    HOSE_BORES: HOSE_BORES,
    screenElastomer: screenElastomer,
    checkPressureCeiling: checkPressureCeiling,
    estimateHoseLife: estimateHoseLife,
    selectRollerConfig: selectRollerConfig,
    bearingIsolationNote: bearingIsolationNote,
    selectHoseBore: selectHoseBore,
    design: design,
  };
})();

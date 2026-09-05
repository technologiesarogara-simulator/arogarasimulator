/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Bearing Design (L10 life) screening engine
   window.AROPUMPBEARING

   Phase 8 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Screens L10 bearing life (ISO 281 / ABMA) for a small set of bearing
   types at the standard bore nearest the shaft diameter Phase 7 already
   sized, from the radial load Phase 7 already computed (impeller weight
   + hydraulic radial thrust) plus an estimated axial thrust from the
   differential pressure and eye diameter Phase 4/5 already established.
   No new required input.

   METHOD
     - Dynamic/static capacity: a smooth capacity-vs-bore curve
       calibrated to a representative medium-series ball bearing
       (C ≈ 14.8 kN, C0 ≈ 6.95 kN at a 25 mm bore) — a representative
       catalogue-shaped scaling relation for screening, explicitly NOT
       one manufacturer's published rating.
     - Equivalent dynamic load: P = X·Fr + Y·Fa (ISO 281 form), with a
       load-ratio threshold e per bearing type — below e, axial load is
       carried without penalty (X=1, Y=0); above it, the published
       typical X/Y factors for that bearing type apply.
     - L10 life: L10 (million rev) = (C/P)^p, p=3 for ball bearings,
       10/3 for roller bearings — the standard ISO 281 form.
     - L10 hours: L10h = L10·10⁶ / (60·N), verdicted against API 610
       cl. 6.10.1.4's own two thresholds — 25,000 h at rated conditions,
       16,000 h at the maximum radial/axial load.
     - Axial thrust: the classical single-suction unbalanced-impeller
       estimate, Fa ≈ K·ΔP·Aeye with K ≈ 0.675 (Karassik's Pump
       Handbook range), Aeye from the eye diameter Phase 4 estimated.

   WHAT THIS IS NOT
   - Not a vendor bearing selection. Capacities are a representative
     scaling relation, not a specific manufacturer's catalogue number.
   - Not a full thrust-balance analysis — a balanced/balancing-drum
     impeller, a double-suction impeller, or a multistage back-to-back
     arrangement would all carry materially different axial loads than
     this single-suction estimate.

   API
     AROPUMPBEARING.BEARING_TYPES
     AROPUMPBEARING.standardBore(shaftDiameter_mm)
     AROPUMPBEARING.dynamicRating(bore_mm, bearingTypeId)
     AROPUMPBEARING.estimateAxialThrust(input)
     AROPUMPBEARING.screenBearing(input)
     AROPUMPBEARING.screenAllBearingTypes(input)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BEARING_TYPES = [
    { id: 'deep-groove-ball', name: 'Deep Groove Ball Bearing', p: 3, e: 0.24, Y: 1.2, capacityMultiplier: 1.0, axialCapable: true,
      note: 'General-purpose radial bearing with modest axial capacity — the default choice absent a strong thrust load.' },
    { id: 'angular-contact-ball', name: 'Angular Contact Ball Bearing', p: 3, e: 0.68, Y: 0.87, capacityMultiplier: 1.05, axialCapable: true,
      note: 'Contact angle gives it materially better thrust capacity than a deep-groove ball bearing of the same bore.' },
    { id: 'cylindrical-roller', name: 'Cylindrical Roller Bearing', p: 10 / 3, e: null, Y: null, capacityMultiplier: 1.6, axialCapable: false,
      note: 'Highest radial capacity of the three, but line contact carries essentially no axial thrust — pair with a separate thrust bearing if Fa is significant.' },
  ];

  var STANDARD_BORES_MM = [10, 12, 15, 17, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150];

  function standardBore(shaftDiameter_mm) {
    for (var i = 0; i < STANDARD_BORES_MM.length; i++) {
      if (STANDARD_BORES_MM[i] >= shaftDiameter_mm) return STANDARD_BORES_MM[i];
    }
    return STANDARD_BORES_MM[STANDARD_BORES_MM.length - 1];
  }

  // Calibrated so a 25 mm bore, deep-groove multiplier, lands near a
  // representative medium-series ball bearing (C~14.8kN, C0~6.95kN).
  var K1 = 14.8 / Math.pow(25, 1.8);
  var K0 = 6.95 / Math.pow(25, 1.9);

  function dynamicRating(bore_mm, bearingTypeId) {
    var bt = BEARING_TYPES.filter(function (b) { return b.id === bearingTypeId; })[0];
    if (!bt) return null;
    var C_kN = K1 * Math.pow(bore_mm, 1.8) * bt.capacityMultiplier;
    var C0_kN = K0 * Math.pow(bore_mm, 1.9) * bt.capacityMultiplier;
    return { C_kN: C_kN, C0_kN: C0_kN, C_N: C_kN * 1000, C0_N: C0_kN * 1000 };
  }

  function equivalentLoad(Fr_N, Fa_N, bearingTypeId) {
    var bt = BEARING_TYPES.filter(function (b) { return b.id === bearingTypeId; })[0];
    if (!bt) return null;
    if (!bt.axialCapable) {
      var warn = (Fa_N > 0) ? ['This bearing type carries essentially no axial thrust — the ' + Fa_N.toFixed(0) + ' N axial load estimated here needs a separate thrust bearing.'] : [];
      return { P_N: Fr_N, X: 1, Y: 0, exceedsE: false, warnings: warn };
    }
    var ratio = Fr_N > 0 ? Fa_N / Fr_N : Infinity;
    if (ratio <= bt.e) {
      return { P_N: Fr_N, X: 1, Y: 0, exceedsE: false, warnings: [] };
    }
    var P_N = 0.56 * Fr_N + bt.Y * Fa_N;
    return { P_N: P_N, X: 0.56, Y: bt.Y, exceedsE: true, warnings: [] };
  }

  function l10Life(C_N, P_N, p) {
    if (!(C_N > 0) || !(P_N > 0)) return NaN;
    return Math.pow(C_N / P_N, p);
  }

  function l10Hours(L10_millionRev, N_rpm) {
    if (!(N_rpm > 0) || !isFinite(L10_millionRev)) return NaN;
    return (L10_millionRev * 1e6) / (60 * N_rpm);
  }

  var K_AXIAL_THRUST = 0.675; // Karassik's Pump Handbook range (0.6-0.75) for a single-suction unbalanced impeller

  function estimateAxialThrust(input) {
    var D1_m = input.D1_m, deltaP_Pa = input.deltaP_Pa;
    if (!(D1_m > 0) || !isFinite(deltaP_Pa)) return { Fa_N: NaN };
    var Aeye_m2 = (Math.PI / 4) * D1_m * D1_m;
    var Fa_N = K_AXIAL_THRUST * Math.abs(deltaP_Pa) * Aeye_m2;
    return { Fa_N: Fa_N, Aeye_m2: Aeye_m2, K: K_AXIAL_THRUST };
  }

  /* ── screenBearing: full orchestration for one bearing type ────────
     input = { shaftDiameter_mm, N_rpm, Fr_N, Fa_N, bearingTypeId } */
  function screenBearing(input) {
    input = input || {};
    var shaftDiameter_mm = input.shaftDiameter_mm, N_rpm = input.N_rpm, Fr_N = input.Fr_N, Fa_N = input.Fa_N || 0;
    if (!(shaftDiameter_mm > 0) || !(N_rpm > 0) || !(Fr_N > 0)) {
      return { applicable: false, status: 'DATA REQUIRED',
        reason: 'Shaft diameter, pump speed and radial load all have to be known first — run the pump hydraulic calculation and let the shaft screening (Phase 7) finish.' };
    }
    var bt = BEARING_TYPES.filter(function (b) { return b.id === input.bearingTypeId; })[0];
    if (!bt) return { applicable: false, status: 'DATA REQUIRED', reason: 'Unknown bearing type "' + input.bearingTypeId + '".' };

    var bore_mm = standardBore(shaftDiameter_mm);
    var rating = dynamicRating(bore_mm, bt.id);
    var eq = equivalentLoad(Fr_N, Fa_N, bt.id);
    var L10_millionRev = l10Life(rating.C_N, eq.P_N, bt.p);
    var L10h = l10Hours(L10_millionRev, N_rpm);

    var warnings = eq.warnings.slice();
    var EPS = 1e-6; // guards against floating-point noise landing a value a hair below its own threshold
    var verdict;
    if (L10h >= 25000 - EPS) { verdict = 'SUITABLE'; }
    else if (L10h >= 16000 - EPS) { verdict = 'CHECK'; warnings.push('L10 life ' + Math.round(L10h).toLocaleString() + ' h meets API 610 cl. 6.10.1.4\'s 16,000 h maximum-load minimum but not its 25,000 h rated-condition minimum.'); }
    else { verdict = 'NOT RECOMMENDED'; warnings.push('L10 life ' + Math.round(L10h).toLocaleString() + ' h is below API 610 cl. 6.10.1.4\'s 16,000 h minimum at maximum radial/axial load.'); }

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', bearingTypeId: bt.id, bearingName: bt.name,
      bore_mm: bore_mm, C_kN: rating.C_kN, C0_kN: rating.C0_kN,
      Fr_N: Fr_N, Fa_N: Fa_N, P_N: eq.P_N, X: eq.X, Y: eq.Y, exceedsE: eq.exceedsE,
      L10_millionRev: L10_millionRev, L10h: L10h, verdict: verdict, warnings: warnings, note: bt.note,
    };
  }

  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };

  function screenAllBearingTypes(input) {
    var results = BEARING_TYPES.map(function (bt) {
      return screenBearing(Object.assign({}, input, { bearingTypeId: bt.id }));
    });
    if (!results[0].applicable) return { applicable: false, status: results[0].status, reason: results[0].reason };
    results.sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || b.L10h - a.L10h; });
    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', ranked: results, top: results[0] };
  }

  window.AROPUMPBEARING = {
    BEARING_TYPES: BEARING_TYPES,
    STANDARD_BORES_MM: STANDARD_BORES_MM,
    standardBore: standardBore,
    dynamicRating: dynamicRating,
    equivalentLoad: equivalentLoad,
    l10Life: l10Life,
    l10Hours: l10Hours,
    estimateAxialThrust: estimateAxialThrust,
    screenBearing: screenBearing,
    screenAllBearingTypes: screenAllBearingTypes,
  };
})();

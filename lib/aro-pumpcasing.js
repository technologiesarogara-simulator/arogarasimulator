/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Centrifugal Pump Casing Design (screening) engine
   window.AROPUMPCASING

   Phase 5a of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Takes the impeller tip speed and OD Phase 4 (AROPUMPIMPELLER) already
   estimated and screens three casing-level quantities from it:
     - volute throat area / equivalent throat diameter, sized from a
       fraction of the impeller tip speed (a "volute velocity constant")
     - cutwater (tongue) radial clearance, banded by the same
       specific-speed shape family Phase 4 classified
     - a first-pass ASME B16.5 pressure class for the casing pressure
       boundary, from the suction pressure plus an assumed shutoff
       differential

   WHAT THIS IS NOT
   - Not a wall-thickness or stress calculation. Choosing a pressure
     class here only screens which nominal rating is in play — the
     actual mechanical casing design (material, corrosion allowance,
     temperature derating) is a later phase.
   - Not vendor-specific. The volute constant and clearance bands are
     typical published screening ranges, not one manufacturer's design.

   API
     AROPUMPCASING.PRESSURE_CLASSES     — the ASME B16.5 class table
     AROPUMPCASING.SHAPE_BANDS          — volute-constant / clearance bands
     AROPUMPCASING.screenCasing(input)  — the combined screening result
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function band(lo, hi) { return { min: lo, max: hi, mid: (lo + hi) / 2 }; }

  // Shape-family bands, keyed the same way as AROPUMPIMPELLER.SHAPE_BANDS
  // (same 1500/4200/9000 US-Ns thresholds) but holding casing-level
  // quantities: the volute throat velocity as a fraction of impeller tip
  // speed, and the cutwater-to-impeller radial clearance as a fraction of
  // the impeller radius. Both are typical published screening ranges —
  // a narrow gap raises vane-passing pressure pulsation, a wide one
  // trades a little efficiency for quieter running.
  var SHAPE_BANDS = [
    { maxNs: 1500, shapeFamily: 'radial', voluteVelocityFraction: band(0.35, 0.45), cutwaterClearancePct: band(4, 6) },
    { maxNs: 4200, shapeFamily: 'Francis / mixed flow', voluteVelocityFraction: band(0.30, 0.40), cutwaterClearancePct: band(5, 7) },
    { maxNs: 9000, shapeFamily: 'mixed flow', voluteVelocityFraction: band(0.28, 0.35), cutwaterClearancePct: band(6, 9) },
    { maxNs: Infinity, shapeFamily: 'axial flow', voluteVelocityFraction: band(0.22, 0.30), cutwaterClearancePct: band(8, 12) },
  ];

  function bandFor(shapeFamily) {
    return SHAPE_BANDS.filter(function (b) { return b.shapeFamily === shapeFamily; })[0] || SHAPE_BANDS[0];
  }

  // Approximate ASME B16.5 class ratings, carbon steel, ambient-to-moderate
  // temperature (barg) — the same kind of well-known standard lookup table
  // AROPUMPSTD already uses for ASME B36.10M bores. A real class selection
  // also depends on material and design temperature; this screens the
  // nominal rating only.
  var PRESSURE_CLASSES = [
    { cls: '150#', maxBarG: 19.6 },
    { cls: '300#', maxBarG: 51.1 },
    { cls: '600#', maxBarG: 102.1 },
    { cls: '900#', maxBarG: 153.2 },
    { cls: '1500#', maxBarG: 255.3 },
    { cls: '2500#', maxBarG: 425.5 },
  ];

  function classifyPressure(designPressBarG) {
    if (!isFinite(designPressBarG)) return null;
    var EPS = 1e-6; // guards against floating-point noise landing a value a hair above its own class boundary
    for (var i = 0; i < PRESSURE_CLASSES.length; i++) {
      if (designPressBarG <= PRESSURE_CLASSES[i].maxBarG + EPS) return PRESSURE_CLASSES[i];
    }
    return null; // beyond the table — a special/forged design, not a standard flange class
  }

  var G = 9.81;

  /* ── screenCasing: volute throat + cutwater clearance + pressure class ─
     input = {
       Q_m3h, H_m, shapeFamily, U2_ms, D2_m,     // from AROPUMPFAMILY/IMPELLER
       pSucBarG (optional, default 0),            // suction pressure at the casing
       rho (optional, default 1000),
       shutoffHeadM (optional — falls back to 1.2 * H_m, a typical
         screening shutoff-to-rated ratio, clearly flagged as an
         assumption when not supplied)
     } */
  function screenCasing(input) {
    input = input || {};
    var Q = input.Q_m3h, H = input.H_m, shapeFamily = input.shapeFamily, U2 = input.U2_ms, D2 = input.D2_m;
    if (!isFinite(Q) || Q <= 0 || !isFinite(H) || H <= 0 || !isFinite(U2) || U2 <= 0 || !isFinite(D2) || D2 <= 0 || !shapeFamily) {
      return { applicable: false, status: 'DATA REQUIRED',
        reason: 'Run the pump hydraulic calculation and let the impeller classification (Phase 4) finish first — flow, head, tip speed and impeller OD are all needed.' };
    }
    var b = bandFor(shapeFamily);
    var rho = (input.rho == null || !isFinite(input.rho) || input.rho <= 0) ? 1000 : input.rho;
    var pSucBarG = (input.pSucBarG == null || !isFinite(input.pSucBarG)) ? 0 : input.pSucBarG;
    var shutoffAssumed = (input.shutoffHeadM == null || !isFinite(input.shutoffHeadM) || input.shutoffHeadM <= 0);
    var shutoffHeadM = shutoffAssumed ? 1.2 * H : input.shutoffHeadM;

    // ── volute throat ──
    var kVolute = b.voluteVelocityFraction.mid;
    var VthMs = kVolute * U2;
    var Qm3s = Q / 3600;
    var A3_m2 = Qm3s / VthMs;
    var D3eq_mm = Math.sqrt(4 * A3_m2 / Math.PI) * 1000;

    // ── cutwater clearance ──
    var gapPct = b.cutwaterClearancePct.mid;
    var gapRadial_mm = (gapPct / 100) * (D2 * 1000 / 2);
    var casingID_mm = D2 * 1000 + 2 * gapRadial_mm;

    // ── pressure class ──
    var shutoffDpBar = (rho * G * shutoffHeadM) / 1e5;
    var designPressBarG = pSucBarG + shutoffDpBar;
    var pressureClass = classifyPressure(designPressBarG);

    var warnings = [];
    if (!pressureClass) {
      warnings.push('Design pressure ' + designPressBarG.toFixed(1) + ' barg exceeds the standard ASME B16.5 class table (up to 2500# / 425.5 barg) — this duty needs a special or forged casing design, not a catalogue flange rating.');
    }

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', shapeFamily: shapeFamily,
      volute: { kVolute: kVolute, Vth_ms: VthMs, A3_m2: A3_m2, D3eq_mm: D3eq_mm },
      cutwater: { gapPct: gapPct, gapRadial_mm: gapRadial_mm, casingID_mm: casingID_mm },
      pressureClass: {
        designPressBarG: designPressBarG, shutoffDpBar: shutoffDpBar, shutoffHeadM: shutoffHeadM,
        shutoffAssumed: shutoffAssumed, cls: pressureClass ? pressureClass.cls : 'BEYOND TABLE',
        classMaxBarG: pressureClass ? pressureClass.maxBarG : null,
      },
      warnings: warnings,
      assumptions: [
        'Volute throat velocity taken as ' + kVolute.toFixed(2) + ' × impeller tip speed (typical published range for a ' + shapeFamily + ' impeller), not a vendor volute design.',
        'Cutwater radial clearance taken as ' + gapPct.toFixed(1) + '% of the impeller radius (typical published range for this shape family).',
        shutoffAssumed
          ? 'Shutoff head assumed at 1.2 × rated head (typical screening ratio) — supply the pump curve’s actual shutoff head once a vendor curve is available.'
          : 'Shutoff head used as entered.',
      ],
    };
  }

  window.AROPUMPCASING = {
    PRESSURE_CLASSES: PRESSURE_CLASSES,
    SHAPE_BANDS: SHAPE_BANDS,
    screenCasing: screenCasing,
  };
})();

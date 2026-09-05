/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Positive-Displacement Mode / Reciprocating Pulsation engine
   window.AROPUMPPD

   Phase 14 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Activates only when Phase 2's top-ranked family is a genuine
   positive-displacement machine (pd-rotary or pd-reciprocating — not
   'special', which in this app's family database is still centrifugal
   construction: slurry, hygienic, mag-drive, submersible). A PD pump
   is a fundamentally different hazard than a centrifugal one: its
   flow is set by displacement and speed, essentially independent of
   discharge pressure, so a blocked or closed discharge does not stall
   it the way it would a centrifugal — it keeps building pressure until
   something in the system fails. Three screenings follow from that:

     1. screenOverpressureProtection() — MANDATORY. Unlike every other
        screening in this suite, "no data entered" here does NOT mean
        DATA REQUIRED (a neutral gap) — it means NOT RECOMMENDED,
        because the absence of a relief device is itself the unsafe
        condition, not merely unknown information. A relief device
        that IS specified is checked on two ordinary criteria: its set
        pressure must not exceed the piping's design pressure, and its
        rated capacity must be able to pass the full pump flow (a
        relief valve too small still lets pressure climb).
     2. screenPulsationDampening() — reciprocating families pulse; a
        rotary PD family (gear/screw/lobe/PC/vane) does not in the
        same way. Dampening is always required on both suction and
        discharge for a reciprocating machine (API 674/675 practice);
        the severity note softens as more cylinders phase-shift the
        pulsation, when that count is known.
     3. estimateVolumetricEfficiency() — the opposite trend from a
        centrifugal impeller: less internal slip at higher viscosity,
        so volumetric efficiency generally RISES with viscosity rather
        than falling. Typical published bands, not a manufacturer's
        slip curve.

   API
     AROPUMPPD.screenOverpressureProtection(input)
     AROPUMPPD.screenPulsationDampening(input)
     AROPUMPPD.estimateVolumetricEfficiency(viscosityCst)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── screenOverpressureProtection: MANDATORY, fails closed ──────────
     input = { ratedFlow_m3h, pipingDesignPress_barG,
               reliefSetPress_barG (optional), reliefRatedCapacity_m3h (optional) } */
  function screenOverpressureProtection(input) {
    input = input || {};
    var ratedFlow = input.ratedFlow_m3h, designPress = input.pipingDesignPress_barG;
    var setPress = input.reliefSetPress_barG, reliefCap = input.reliefRatedCapacity_m3h;

    if (!isFinite(ratedFlow) || ratedFlow <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Rated flow is not available yet — run the pump hydraulic calculation first.' };
    }

    var reliefSpecified = isFinite(setPress) && isFinite(reliefCap);
    if (!reliefSpecified) {
      return {
        applicable: true, status: 'NOT RECOMMENDED', mandatory: true,
        verdict: 'NOT RECOMMENDED',
        message: 'MANDATORY: no relief device has been specified. A positive-displacement pump must never be started or operated without overpressure protection fitted directly on its discharge, upstream of the first block valve — its flow is essentially independent of discharge pressure, so a blocked line does not stall it, it keeps building pressure until something fails.',
        warnings: ['No relief set pressure or rated capacity entered — this is not a missing number to fill in later, it is an unsafe condition today.'],
      };
    }

    var warnings = [];
    var verdict = 'SUITABLE';
    if (isFinite(designPress) && setPress > designPress) {
      verdict = 'NOT RECOMMENDED';
      warnings.push('Relief set pressure ' + setPress.toFixed(1) + ' barg exceeds the piping design pressure ' + designPress.toFixed(1) + ' barg — the relief device would not protect the weakest downstream component.');
    }
    if (reliefCap < ratedFlow) {
      verdict = 'NOT RECOMMENDED';
      warnings.push('Relief rated capacity ' + reliefCap.toFixed(1) + ' m³/h is below the pump\'s rated flow ' + ratedFlow.toFixed(1) + ' m³/h — the relief path cannot pass the full pump output, so pressure would keep climbing even with the valve open.');
    }

    return {
      applicable: true, status: 'PREDICTED', mandatory: true, verdict: verdict,
      message: verdict === 'SUITABLE'
        ? 'Relief device specified and sized to pass the full rated flow at or below the piping design pressure.'
        : 'Relief device specified, but does not fully protect this duty — see the warnings.',
      warnings: warnings,
      ratedFlow_m3h: ratedFlow, reliefSetPress_barG: setPress, reliefRatedCapacity_m3h: reliefCap,
    };
  }

  /* ── screenPulsationDampening: mandatory for reciprocating, N/A for
     rotary PD ──
     input = { pumpType: 'reciprocating'|'rotary', numCylinders (optional) } */
  var CYLINDER_SEVERITY = [
    { max: 1, severity: 'severe', note: 'A single-cylinder (simplex) pump produces the most severe pulsation of any plunger/piston arrangement — dampening on both suction and discharge is essential, not optional.' },
    { max: 2, severity: 'significant', note: 'A duplex (two-cylinder) arrangement still produces significant pulsation — dampening is required on both suction and discharge.' },
    { max: 3, severity: 'moderate', note: 'A triplex (three-cylinder) arrangement phase-shifts the strokes and smooths the flow considerably, but API 674 practice still calls for dampening on both suction and discharge.' },
    { max: Infinity, severity: 'reduced', note: 'A multi-plex arrangement of four or more cylinders is inherently smoother, but dampeners are still standard practice — sizing may be reduced relative to a simplex/duplex machine.' },
  ];

  function screenPulsationDampening(input) {
    input = input || {};
    if (input.pumpType !== 'reciprocating') {
      return { applicable: false, status: 'NOT APPLICABLE', reason: 'Pulsation dampening is a reciprocating-pump requirement — this family is a rotary positive-displacement machine, which does not pulse the same way.' };
    }
    var n = input.numCylinders;
    var band = isFinite(n) ? CYLINDER_SEVERITY.filter(function (b) { return n <= b.max; })[0] : null;
    return {
      applicable: true, status: 'PREDICTED', mandatory: true,
      verdict: 'SUITABLE', // "suitable" here means "correctly identified as required", not "no action needed"
      message: 'Dampening is required on BOTH suction and discharge for a reciprocating pump — pulsation excites acoustic resonance in the piping (API 674/675) regardless of cylinder count.',
      cylinderKnown: !!band,
      severity: band ? band.severity : null,
      note: band ? band.note : 'Cylinder count not entered — the categorical requirement for dampening on both sides still applies; enter the cylinder count for a severity estimate.',
    };
  }

  /* ── estimateVolumetricEfficiency: PD's opposite trend from centrifugal */
  var VISC_EFF_BANDS = [
    { max: 10, min: 85, maxEff: 90, label: 'thin liquid — internal slip past clearances is at its most significant' },
    { max: 1000, min: 90, maxEff: 97, label: 'moderate viscosity — slip drops off quickly as viscosity rises' },
    { max: Infinity, min: 95, maxEff: 99, label: 'thick liquid — minimal internal slip' },
  ];
  function estimateVolumetricEfficiency(viscosityCst) {
    if (!isFinite(viscosityCst) || viscosityCst <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Viscosity is needed to screen volumetric efficiency.' };
    }
    var band = VISC_EFF_BANDS.filter(function (b) { return viscosityCst <= b.max; })[0] || VISC_EFF_BANDS[VISC_EFF_BANDS.length - 1];
    return {
      applicable: true, status: 'PREDICTED', viscosityCst: viscosityCst,
      etaVolMinPct: band.min, etaVolMaxPct: band.maxEff, label: band.label,
    };
  }

  window.AROPUMPPD = {
    screenOverpressureProtection: screenOverpressureProtection,
    screenPulsationDampening: screenPulsationDampening,
    estimateVolumetricEfficiency: estimateVolumetricEfficiency,
  };
})();

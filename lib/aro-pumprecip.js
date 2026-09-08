/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Reciprocating (Plunger/Piston) Pump Mechanical Design engine
   window.AROPUMPRECIP

   Pump build Step 7. Pure calculation module — no DOM access — same
   "one IIFE, one namespace" pattern as the other pump engines, loadable
   and unit-testable in Node with nothing but `global.window = global`.

   PURPOSE
   Full-track mechanical design for PUMP_SELECTION_STANDARD's two
   full-track reciprocating rows — Plunger Pump and Piston Pump, both
   API 674, sharing the same power-end/crankshaft architecture and
   differing only in how the fluid end seals against the plunger/piston:
     1. sealConstruction() — packing (plunger, replaceable without
        removing the cylinder) vs piston ring/cup (travels with the
        piston, wears against the cylinder bore) — a fixed lookup by
        which of the two rows Section 10 picked, not a ranked choice.
     2. estimatePlungerGeometry() — bore and stroke from flow, speed and
        cylinder count, at a representative stroke/bore ratio.
     3. estimateRodLoad() — plunger/piston force from differential
        pressure x bore area, plus a representative crank-pin diameter;
        the caller feeds both into AROPUMPBEARING.screenAllBearingTypes()
        directly as the crankshaft/rod/crosshead bearing's radial load
        and bore, reusing Phase 8's own L10-life engine rather than
        re-deriving bearing life here.
     4. accelerationHead() — the Hydraulic Institute acceleration-head
        NPSH correction, the real formula (not a qualitative note):
        ha = L*V*N*C / (K*g), published in US customary units and
        computed that way here internally (converting SI inputs in and
        the result back out) to avoid introducing an SI re-derivation
        error, with C the published plunger-configuration constant, K a
        liquid-compressibility factor, and g standard gravity in ft/s²
        (the published form of this formula carries g explicitly in the
        denominator alongside K — omitting it overstates ha by a factor
        of ~32, which was caught here by sanity-checking the formula
        against a known-plausible triplex example before shipping it).
        This is the correction Section 10's generic PD screening does
        not apply — a reciprocating pump's real available NPSH is
        npsha - ha, not npsha alone.
     5. sizePulsationDampener() — an actual chamber-volume and gas-
        precharge-pressure estimate, replacing Phase 14's qualitative
        "dampening is required, severity varies with cylinder count"
        note with a sized number for these two families specifically.
     6. checkDriveTrain() — direct-couple vs gear-reducer screening
        against standard motor synchronous speeds (same table the
        screw/gear-lobe modules use) — a reciprocating pump's crank
        speed is almost always well below any motor synchronous speed,
        so a reducer is the normal expectation here, not an edge case.
     7. checkSpeedPlausibility() — the app's generic pump-speed input
        defaults to a centrifugal-appropriate ~2900 rpm; a real crank-
        driven reciprocating pump runs nowhere near that (typically
        50-500 rpm). Silently accepting an unrealistic speed here would
        produce a tiny, meaningless bore/bearing/dampener result rather
        than flagging the real problem, so design() surfaces this as an
        explicit warning instead of a quiet wrong answer.

   WHAT THIS IS NOT
   - Not a full API 674 Appendix acoustic/mechanical resonance analysis.
     The acceleration-head formula and dampener sizing are the named,
     published simplified methods — not a full pulsation study.
   - Not a vendor pump selection. Bore/stroke geometry is a
     representative capacity-to-geometry scaling relation, and the
     dampener sizing constants are a widely used simplified rule of
     thumb, not a manufacturer's sizing program.
   - The acceleration-head C constants above 3 cylinders are not all
     confidently known published values here, so 3-or-more cylinders
     conservatively reuses the triplex constant (the smallest ha this
     module will report), rather than guessing a more favorable number
     for a higher-plex arrangement this module cannot cite precisely.

   STANDARDS BASIS: API 674 — the same citation PUMP_SELECTION_STANDARD
   carries for both rows.

   API
     AROPUMPRECIP.sealConstruction(pumpTypeId)
     AROPUMPRECIP.estimatePlungerGeometry(input)
     AROPUMPRECIP.estimateRodLoad(input)
     AROPUMPRECIP.accelerationHead(input)
     AROPUMPRECIP.correctedNpshMargin(npsha_m, ha_m, npshr_m)
     AROPUMPRECIP.sizePulsationDampener(input)
     AROPUMPRECIP.checkDriveTrain(N_rpm)
     AROPUMPRECIP.design(input) — full orchestration of all of the above
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SEAL_CONSTRUCTION = {
    'plunger-pump': { type: 'packing', name: 'Plunger Packing (Stuffing Box)',
      note: 'A fixed stuffing box with replaceable chevron/V-ring packing sets around a fixed-diameter plunger rod — packing can be replaced without removing the cylinder, the reason a plunger design is chosen over a piston at high pressure.' },
    'piston-pump': { type: 'ring-cup', name: 'Piston Ring / Cup Seal',
      note: 'A ring or cup seal that travels with the piston, wearing against the cylinder bore — a different maintenance/spares item than plunger packing, and the cylinder itself typically has to come apart to replace it.' },
  };

  function sealConstruction(pumpTypeId) {
    var s = SEAL_CONSTRUCTION[pumpTypeId];
    if (!s) return { applicable: false, status: 'DATA REQUIRED', reason: 'Unknown reciprocating pump type "' + pumpTypeId + '".' };
    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', type: s.type, name: s.name, note: s.note };
  }

  var STROKE_TO_BORE_RATIO = 1.2; // typical published range 1.0-1.5 for a process reciprocating pump

  function estimatePlungerGeometry(input) {
    input = input || {};
    var Q_m3h = input.Q_m3h, N_rpm = input.N_rpm, numCylinders = input.numCylinders;
    if (!(Q_m3h > 0) || !(N_rpm > 0) || !(numCylinders > 0)) return { applicable: false, status: 'DATA REQUIRED', reason: 'Flow, pump speed and cylinder count all have to be known first.' };
    var volPerStroke_m3 = (Q_m3h / 3600) / (numCylinders * N_rpm / 60);
    var bore_m = Math.cbrt(volPerStroke_m3 / ((Math.PI / 4) * STROKE_TO_BORE_RATIO));
    var stroke_m = STROKE_TO_BORE_RATIO * bore_m;
    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', bore_mm: bore_m * 1000, stroke_mm: stroke_m * 1000, strokeToBoreRatio: STROKE_TO_BORE_RATIO, volPerStroke_L: volPerStroke_m3 * 1000 };
  }

  function estimateRodLoad(input) {
    input = input || {};
    var geom = estimatePlungerGeometry(input);
    if (!geom.applicable) return geom;
    var deltaP_Pa = isFinite(input.diffPressureBar) ? Math.max(0, input.diffPressureBar) * 1e5 : 0;
    var bore_m = geom.bore_mm / 1000;
    var area_m2 = (Math.PI / 4) * bore_m * bore_m;
    var Frod_N = deltaP_Pa * area_m2;
    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', bore_mm: geom.bore_mm, stroke_mm: geom.stroke_mm, area_m2: area_m2, Frod_N: Frod_N };
  }

  function torque(bhpKw, N_rpm) {
    if (!isFinite(bhpKw) || bhpKw <= 0 || !isFinite(N_rpm) || N_rpm <= 0) return NaN;
    return 9549 * bhpKw / N_rpm; // same T = 9549·P(kW)/N(rpm) relation Phase 7's shaft module uses
  }

  var CRANKSHAFT_MATERIAL = { Sy_MPa: 420, Sut_MPa: 700 }; // typical forged alloy-steel crankshaft, screening only

  /* ── screenCrankShaft: the same ASME combined bending+torsion equation
     the screw/gear-lobe modules use, sized here for the crank pin/main
     bearing journal — NOT a fixed fraction of the plunger bore, which
     conflates two unrelated scales (a high-pressure plunger can have a
     small bore and area while still generating a large rod load that
     needs a much bigger crankshaft journal than that small bore would
     suggest). Bending span is taken as the stroke length — a
     representative order-of-magnitude proxy for the crank-web/bearing
     spacing, not a modelled crankshaft geometry.
     input = { bhpKw, N_rpm, Frod_N, stroke_mm } */
  function screenCrankShaft(input) {
    input = input || {};
    var bhpKw = input.bhpKw, N_rpm = input.N_rpm, Frod_N = input.Frod_N, stroke_mm = input.stroke_mm;
    if (!(bhpKw > 0) || !(N_rpm > 0) || !(Frod_N > 0) || !(stroke_mm > 0)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Brake power, pump speed, rod load and stroke all have to be known first.' };
    }
    var span_m = stroke_mm / 1000;
    var T_Nm = torque(bhpKw, N_rpm);
    var M_Nm = Frod_N * span_m / 4; // simply-supported beam, center load
    var Kb = 1.75, Kt = 1.25;
    var keywayDerate = 0.75;
    var tauAllowMPa = Math.min(0.18 * CRANKSHAFT_MATERIAL.Sut_MPa, 0.30 * CRANKSHAFT_MATERIAL.Sy_MPa) * keywayDerate;
    var tauAllowPa = tauAllowMPa * 1e6;
    var d3 = (16 / (Math.PI * tauAllowPa)) * Math.sqrt(Math.pow(Kb * M_Nm, 2) + Math.pow(Kt * T_Nm, 2));
    var d_m = Math.cbrt(d3);
    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', torque_Nm: T_Nm, bendingMoment_Nm: M_Nm,
      crankPinDiameter_mm: d_m * 1000,
      assumptions: [
        'Bending span taken as the stroke length — a representative order-of-magnitude proxy for the crank-web/bearing spacing, not a modelled crankshaft geometry.',
        'Sized to a typical forged alloy-steel crankshaft (Sy≈' + CRANKSHAFT_MATERIAL.Sy_MPa + ' MPa, Sut≈' + CRANKSHAFT_MATERIAL.Sut_MPa + ' MPa) with a 25% keyway derating and the same published shock/fatigue factors (Kb=' + Kb + ', Kt=' + Kt + ') the screw/gear-lobe modules use — not a vendor-certified analysis.',
      ],
    };
  }

  // Hydraulic Institute single/double-acting plunger-configuration
  // constants (as reproduced in standard reciprocating-pump references)
  // — 3-or-more cylinders conservatively reuses the triplex value rather
  // than a higher-plex constant this module cannot cite with confidence.
  var C_SINGLE_ACTING = [{ max: 1, C: 0.400 }, { max: 2, C: 0.200 }, { max: Infinity, C: 0.066 }];
  var C_DOUBLE_ACTING = [{ max: 1, C: 0.200 }, { max: 2, C: 0.115 }, { max: Infinity, C: 0.040 }];
  var FT_PER_M = 1 / 0.3048;
  var G_FT_S2 = 32.174; // standard gravity, ft/s^2 — carried explicitly in the published formula's denominator alongside K

  function accelerationHeadConstant(numCylinders, actingType) {
    var table = (actingType === 'double') ? C_DOUBLE_ACTING : C_SINGLE_ACTING;
    var band = table.filter(function (b) { return numCylinders <= b.max; })[0] || table[table.length - 1];
    return band.C;
  }

  /* ── accelerationHead: ha = L*V*N*C/(K*g), the published Hydraulic
     Institute formula in US customary units (feet, ft/s, ft/s²),
     computed that way internally and converted back to metres — not
     re-derived in SI, to avoid an SI-conversion error against the
     published constants.
     input = { L_m, V_ms, N_rpm, numCylinders, actingType ('single'|
     'double', default 'single'), K (default 1.4) } */
  function accelerationHead(input) {
    input = input || {};
    var L_m = input.L_m, V_ms = input.V_ms, N_rpm = input.N_rpm, numCylinders = input.numCylinders;
    if (!(L_m > 0) || !isFinite(V_ms) || V_ms < 0 || !(N_rpm > 0) || !(numCylinders > 0)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Suction line length, suction velocity, pump speed and cylinder count all have to be known first.' };
    }
    var actingType = (input.actingType === 'double') ? 'double' : 'single';
    var K = isFinite(input.K) && input.K > 0 ? input.K : 1.4;
    var C = accelerationHeadConstant(numCylinders, actingType);

    var L_ft = L_m * FT_PER_M;
    var V_fps = V_ms * FT_PER_M;
    var ha_ft = (L_ft * V_fps * N_rpm * C) / (K * G_FT_S2);
    var ha_m = ha_ft / FT_PER_M;

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', ha_m: ha_m, C: C, K: K, actingType: actingType,
      conservativeConstant: numCylinders >= 3,
      note: 'Hydraulic Institute acceleration-head formula (L·V·N·C/(K·g)), ' + actingType + '-acting, C=' + C + ', K=' + K
        + (numCylinders >= 3 ? ' — 3+ cylinders conservatively reuses the triplex constant.' : '.'),
    };
  }

  function correctedNpshMargin(npsha_m, ha_m, npshr_m) {
    if (!isFinite(npsha_m) || !isFinite(ha_m) || !isFinite(npshr_m)) return { applicable: false };
    var npshaCorrected_m = npsha_m - ha_m;
    var marginCorrected_m = npshaCorrected_m - npshr_m;
    return {
      applicable: true, npshaCorrected_m: npshaCorrected_m, marginCorrected_m: marginCorrected_m,
      verdict: marginCorrected_m >= 1 ? 'SUITABLE' : (marginCorrected_m >= 0 ? 'CHECK' : 'NOT RECOMMENDED'),
      note: 'Available NPSH corrected for the acceleration head this generic screening does not otherwise apply: NPSHa(corrected) = NPSHa - ha = ' + npsha_m.toFixed(2) + ' - ' + ha_m.toFixed(2) + ' = ' + npshaCorrected_m.toFixed(2) + ' m.',
    };
  }

  // Dampener sizing multiplier by cylinder count — a different,
  // independent tier from Phase 14's qualitative pulsation-severity
  // note (same physical direction: more phase-shifted cylinders need a
  // smaller dampener for the same target residual pulsation).
  var DAMPENER_K = [{ max: 1, k: 6 }, { max: 2, k: 4 }, { max: 3, k: 2 }, { max: Infinity, k: 1 }];
  var DEFAULT_ALLOWABLE_PULSATION_PCT = 5;
  var PRECHARGE_FRACTION = 0.7; // typical published 60-80% of minimum operating pressure

  function sizePulsationDampener(input) {
    input = input || {};
    var Q_m3h = input.Q_m3h, N_rpm = input.N_rpm, numCylinders = input.numCylinders;
    if (!(Q_m3h > 0) || !(N_rpm > 0) || !(numCylinders > 0)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Flow, pump speed and cylinder count all have to be known first.' };
    }
    var allowablePct = isFinite(input.allowablePulsationPct) && input.allowablePulsationPct > 0 ? input.allowablePulsationPct : DEFAULT_ALLOWABLE_PULSATION_PCT;
    var kBand = DAMPENER_K.filter(function (b) { return numCylinders <= b.max; })[0] || DAMPENER_K[DAMPENER_K.length - 1];
    var volPerRev_L = (Q_m3h * 1000) / (60 * N_rpm);
    var chamberVolume_L = kBand.k * volPerRev_L * (DEFAULT_ALLOWABLE_PULSATION_PCT / allowablePct);
    var operatingPressureBarG = isFinite(input.operatingPressureBarG) ? Math.max(0, input.operatingPressureBarG) : NaN;
    var prechargeBarG = isFinite(operatingPressureBarG) ? PRECHARGE_FRACTION * operatingPressureBarG : NaN;

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', side: input.side || 'discharge',
      kFactor: kBand.k, allowablePulsationPct: allowablePct, volPerRev_L: volPerRev_L, chamberVolume_L: chamberVolume_L,
      prechargeBarG: prechargeBarG, prechargeFraction: PRECHARGE_FRACTION,
      note: 'A widely used simplified rule-of-thumb sizing (chamber volume as a cylinder-count-derated multiple of the per-revolution displaced volume, gas precharge at ' + (PRECHARGE_FRACTION * 100) + '% of minimum operating pressure) — not a full API 674 Appendix acoustic resonance analysis.',
    };
  }

  // Typical 50 Hz induction-motor synchronous speeds (2/4/6/8/10/12-pole)
  // less ~3% typical full-load slip — same table the screw/gear-lobe
  // modules use. A reciprocating pump's crank speed is almost always
  // well below all of these, so a reducer is the normal outcome here.
  var MOTOR_SPEEDS_RPM = [2910, 1455, 970, 728, 582, 485];
  var DIRECT_COUPLE_TOLERANCE = 0.08;

  function checkDriveTrain(N_rpm) {
    if (!(N_rpm > 0)) return { applicable: false, status: 'DATA REQUIRED', reason: 'Pump (crank) speed is needed first.' };
    var best = null, bestDiff = Infinity;
    MOTOR_SPEEDS_RPM.forEach(function (s) {
      var diff = Math.abs(s - N_rpm) / N_rpm;
      if (diff < bestDiff) { bestDiff = diff; best = s; }
    });
    var directDrivePossible = bestDiff <= DIRECT_COUPLE_TOLERANCE;
    var ratio = best / N_rpm;
    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', N_rpm: N_rpm,
      nearestMotorSpeed_rpm: best, directDrivePossible: directDrivePossible,
      reducerNeeded: !directDrivePossible, ratio: ratio,
      note: directDrivePossible
        ? 'Required crank speed is within ' + (bestDiff * 100).toFixed(1) + '% of a standard ' + best + ' rpm motor speed — direct coupling is workable without a reducer.'
        : 'Required crank speed sits well below standard motor speeds, as is normal for a reciprocating pump — a gear reducer is needed; the nearest standard motor speed (' + best + ' rpm) implies an approximate ' + ratio.toFixed(2) + ':1 reducer ratio.',
    };
  }

  var TYPICAL_MAX_CRANK_RPM = 600; // real process reciprocating pumps typically run 50-500 rpm; above this the app's generic centrifugal-appropriate speed default is almost certainly still in effect

  function checkSpeedPlausibility(N_rpm) {
    if (!(N_rpm > 0)) return { applicable: false };
    if (N_rpm > TYPICAL_MAX_CRANK_RPM) {
      return {
        applicable: true, plausible: false,
        warning: 'Pump speed ' + N_rpm.toFixed(0) + ' rpm is well above the ~50-500 rpm typical crank speed of a real process reciprocating pump — this looks like the app\'s generic (centrifugal-appropriate) speed default rather than an actual crank speed. Re-enter the intended crank speed for a meaningful bore/bearing/dampener result; the numbers below are only as good as this input.',
      };
    }
    return { applicable: true, plausible: true };
  }

  /* ── design: full orchestration ─────────────────────────────────────
     input = { pumpTypeId, Q_m3h, N_rpm, diffPressureBar, numCylinders,
     L_m, V_ms, npsha_m, npshr_m, operatingPressureBarG,
     allowablePulsationPct, actingType, K } */
  function design(input) {
    input = input || {};
    var seal = sealConstruction(input.pumpTypeId);
    var rodLoad = estimateRodLoad(input);
    var crankShaft = rodLoad.applicable
      ? screenCrankShaft({ bhpKw: input.bhpKw, N_rpm: input.N_rpm, Frod_N: rodLoad.Frod_N, stroke_mm: rodLoad.stroke_mm })
      : { applicable: false, status: rodLoad.status, reason: rodLoad.reason };
    var haResult = accelerationHead({ L_m: input.L_m, V_ms: input.V_ms, N_rpm: input.N_rpm, numCylinders: input.numCylinders, actingType: input.actingType, K: input.K });
    var npshCorrection = haResult.applicable ? correctedNpshMargin(input.npsha_m, haResult.ha_m, input.npshr_m) : { applicable: false };
    var dampener = sizePulsationDampener({ Q_m3h: input.Q_m3h, N_rpm: input.N_rpm, numCylinders: input.numCylinders, allowablePulsationPct: input.allowablePulsationPct, operatingPressureBarG: input.operatingPressureBarG, side: 'discharge' });
    var driveTrain = checkDriveTrain(input.N_rpm);
    var speedPlausibility = checkSpeedPlausibility(input.N_rpm);

    return {
      applicable: !!(seal.applicable && rodLoad.applicable && crankShaft.applicable && haResult.applicable),
      status: 'PRELIMINARY ASSUMPTION',
      standardsBasis: 'API 674',
      seal: seal, rodLoad: rodLoad, crankShaft: crankShaft, accelerationHead: haResult, npshCorrection: npshCorrection,
      dampener: dampener, driveTrain: driveTrain, speedPlausibility: speedPlausibility,
    };
  }

  window.AROPUMPRECIP = {
    sealConstruction: sealConstruction,
    estimatePlungerGeometry: estimatePlungerGeometry,
    estimateRodLoad: estimateRodLoad,
    torque: torque,
    screenCrankShaft: screenCrankShaft,
    accelerationHead: accelerationHead,
    correctedNpshMargin: correctedNpshMargin,
    sizePulsationDampener: sizePulsationDampener,
    checkDriveTrain: checkDriveTrain,
    checkSpeedPlausibility: checkSpeedPlausibility,
    design: design,
  };
})();

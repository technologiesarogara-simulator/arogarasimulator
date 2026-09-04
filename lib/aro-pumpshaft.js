/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Shaft Mechanical Design (screening) engine
   window.AROPUMPSHAFT

   Phase 7 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Sizes a minimum overhung-shaft diameter from the torque and lateral
   loads the existing calculation and Phase 4/5 already established
   (BHP, speed, impeller OD/shape, %BEP, stage head), for each shaft-
   capable material Phase 6 (AROPUMPMOC) already lists — then screens
   the resulting shaft for static deflection and first critical speed.

   METHOD (each step a named, standard turbomachinery/mechanical-design
   approach, not an invented shortcut):
     - Torque:            T = 9549 · P(kW) / N(rpm)
     - Impeller mass:     a disc-of-revolution estimate from D2, a
                          typical impeller-width/D2 ratio for the shape
                          family, an assumed solidity, and a density —
                          every one of those four factors is named in
                          the `assumptions` array, not hidden
     - Radial hydraulic thrust: Stepanoff/Karassik single-volute
                          empirical model, F = Kr·ρ·g·H·D2·b2, with
                          Kr = 0.36·(1 − (Q/Qbep)²) (floored at 0.05 —
                          even at BEP a single volute carries a small
                          residual radial load)
     - Shaft sizing:      the ASME combined bending+torsion shaft
                          equation, d³ = 16/(π·τallow)·√((Kb·M)² + (Kt·T)²),
                          τallow = min(0.18·Sut, 0.30·Sy), with a 25%
                          keyway derating applied by default
     - Deflection:        cantilever end-load beam deflection,
                          y = F·L³/(3·E·I)
     - First critical speed: cantilever/point-mass Rayleigh estimate,
                          ωn = √(3EI / (L³·m)) — shaft self-mass
                          neglected, a stated first-pass simplification

   WHAT THIS IS NOT
   - Not a certified rotordynamic or FEA analysis. Every geometric input
     beyond D2 (impeller width, overhang length, impeller mass) is a
     typical published ratio, and the critical-speed model is a single-
     mass cantilever approximation, not a full shaft/bearing model.
   - Not vendor-specific. Material strengths are typical published
     values for the named specification, not a certified mill cert.

   API
     AROPUMPSHAFT.SHAFT_MATERIALS        — shaft-capable material properties
     AROPUMPSHAFT.torque(bhpKw, N_rpm)
     AROPUMPSHAFT.radialThrustFactor(pctBep)
     AROPUMPSHAFT.screenShaft(input)          — one material candidate
     AROPUMPSHAFT.screenAllShaftMaterials(input) — every shaft-capable material, ranked
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Keyed by the same material ids AROPUMPMOC (Phase 6) uses, so a shaft
  // material verdict and an MOC verdict for "carbon-steel" always mean the
  // same alloy — but this file does not require AROPUMPMOC to be loaded;
  // it carries its own small strength table for the five materials MOC
  // already lists as shaft-capable.
  var SHAFT_MATERIALS = {
    'carbon-steel': { name: 'Carbon Steel (ASTM A216 WCB)', Sy_MPa: 250, Sut_MPa: 485, E_GPa: 200 },
    '316-stainless': { name: '316 Stainless Steel (CF8M)', Sy_MPa: 205, Sut_MPa: 485, E_GPa: 193 },
    'duplex-stainless': { name: 'Duplex Stainless Steel (CD4MCu / 2205)', Sy_MPa: 450, Sut_MPa: 620, E_GPa: 200 },
    'super-duplex': { name: 'Super Duplex Stainless Steel (2507)', Sy_MPa: 550, Sut_MPa: 750, E_GPa: 205 },
    'hastelloy-c': { name: 'Hastelloy C-276', Sy_MPa: 283, Sut_MPa: 690, E_GPa: 205 },
  };

  // Impeller width / OD ratio, by the same shape-family bands as
  // AROPUMPIMPELLER — a radial impeller is narrow relative to its OD, an
  // axial one is much wider.
  var B2_RATIO_BAND = {
    'radial': { min: 0.05, max: 0.08 },
    'Francis / mixed flow': { min: 0.08, max: 0.15 },
    'mixed flow': { min: 0.15, max: 0.30 },
    'axial flow': { min: 0.30, max: 0.50 },
  };
  var IMPELLER_SOLIDITY = 0.4; // fraction of the swept disc volume actually occupied by vanes+shrouds

  function mid(range) { return (range.min + range.max) / 2; }

  var G = 9.81;

  function torque(bhpKw, N_rpm) {
    if (!isFinite(bhpKw) || bhpKw <= 0 || !isFinite(N_rpm) || N_rpm <= 0) return NaN;
    return 9549 * bhpKw / N_rpm;
  }

  function radialThrustFactor(pctBep) {
    if (!isFinite(pctBep)) return 0.36;
    var q = Math.max(0, pctBep) / 100;
    var kr = 0.36 * (1 - q * q);
    return Math.max(0.05, Math.min(0.36, kr));
  }

  function estimateImpellerMass(input) {
    var shapeFamily = input.shapeFamily;
    var D2_m = input.D2_m;
    var band = B2_RATIO_BAND[shapeFamily] || B2_RATIO_BAND['Francis / mixed flow'];
    var b2Ratio = mid(band);
    var b2_m = b2Ratio * D2_m;
    var density = (input.densityKgM3 == null || !isFinite(input.densityKgM3) || input.densityKgM3 <= 0) ? 7200 : input.densityKgM3;
    var volume_m3 = (Math.PI / 4) * D2_m * D2_m * b2_m * IMPELLER_SOLIDITY;
    var mass_kg = density * volume_m3;
    return {
      mass_kg: mass_kg, b2_m: b2_m, b2Ratio: b2Ratio, solidity: IMPELLER_SOLIDITY, densityUsed: density,
      densityAssumed: input.densityKgM3 == null,
    };
  }

  function radialThrust(input) {
    var Kr = radialThrustFactor(input.pctBep);
    var F_N = Kr * input.rho * G * input.H_stage_m * input.D2_m * input.b2_m;
    return { Kr: Kr, F_N: F_N };
  }

  function combinedStressDiameter(input) {
    var mat = SHAFT_MATERIALS[input.materialId];
    if (!mat) return null;
    var keywayDerate = input.keywayDerate !== false; // defaults to true
    var Kb = (input.Kb == null || !isFinite(input.Kb)) ? 1.75 : input.Kb;
    var Kt = (input.Kt == null || !isFinite(input.Kt)) ? 1.25 : input.Kt;
    var tauAllowMPa = Math.min(0.18 * mat.Sut_MPa, 0.30 * mat.Sy_MPa) * (keywayDerate ? 0.75 : 1);
    var tauAllowPa = tauAllowMPa * 1e6;
    var d3 = (16 / (Math.PI * tauAllowPa)) * Math.sqrt(Math.pow(Kb * input.bendingMoment_Nm, 2) + Math.pow(Kt * input.torque_Nm, 2));
    var d_m = Math.cbrt(d3);
    return { d_m: d_m, tauAllowMPa: tauAllowMPa, Kb: Kb, Kt: Kt, keywayDerate: keywayDerate };
  }

  function staticDeflection(input) {
    var I_m4 = Math.PI * Math.pow(input.d_m, 4) / 64;
    var y_m = (input.F_N * Math.pow(input.L_m, 3)) / (3 * input.E_GPa * 1e9 * I_m4);
    return { y_m: y_m, I_m4: I_m4 };
  }

  function firstCriticalSpeed(input) {
    var I_m4 = Math.PI * Math.pow(input.d_m, 4) / 64;
    var k_Npm = 3 * input.E_GPa * 1e9 * I_m4 / Math.pow(input.L_m, 3);
    var omega = Math.sqrt(k_Npm / input.mass_kg);
    var Nc_rpm = omega * 60 / (2 * Math.PI);
    return { Nc_rpm: Nc_rpm, stiffness_Npm: k_Npm, I_m4: I_m4 };
  }

  /* ── screenShaft: the full orchestration for one material candidate ─ */
  function screenShaft(input) {
    input = input || {};
    var bhpKw = input.bhpKw, N_rpm = input.N_rpm, D2_m = input.D2_m, shapeFamily = input.shapeFamily;
    var pctBep = input.pctBep, H_stage_m = input.H_stage_m;
    var rho = (input.rho == null || !isFinite(input.rho) || input.rho <= 0) ? 1000 : input.rho;
    var overhangRatio = (input.overhangRatio == null || !isFinite(input.overhangRatio)) ? 0.8 : input.overhangRatio;

    if (!isFinite(bhpKw) || bhpKw <= 0 || !isFinite(N_rpm) || N_rpm <= 0 || !isFinite(D2_m) || D2_m <= 0
      || !shapeFamily || !isFinite(pctBep) || !isFinite(H_stage_m) || H_stage_m <= 0) {
      return { applicable: false, status: 'DATA REQUIRED',
        reason: 'Brake power, pump speed, impeller OD/shape and the operating point all have to be known first — run the pump hydraulic calculation and let Phase 4 (impeller classification) finish.' };
    }
    var mat = SHAFT_MATERIALS[input.materialId];
    if (!mat) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Unknown or unsupported shaft material "' + input.materialId + '".' };
    }

    var T = torque(bhpKw, N_rpm);
    var imp = estimateImpellerMass({ D2_m: D2_m, shapeFamily: shapeFamily, densityKgM3: input.impellerDensityKgM3 });
    var Loh = overhangRatio * D2_m;
    var thrust = radialThrust({ rho: rho, H_stage_m: H_stage_m, D2_m: D2_m, b2_m: imp.b2_m, pctBep: pctBep });
    var Fweight = imp.mass_kg * G;
    var Ftotal = Fweight + thrust.F_N;
    var M = Ftotal * Loh;

    var sizing = combinedStressDiameter({ torque_Nm: T, bendingMoment_Nm: M, materialId: input.materialId, Kb: input.Kb, Kt: input.Kt, keywayDerate: input.keywayDerate });
    var defl = staticDeflection({ F_N: Ftotal, L_m: Loh, d_m: sizing.d_m, E_GPa: mat.E_GPa });
    var crit = firstCriticalSpeed({ mass_kg: imp.mass_kg, L_m: Loh, d_m: sizing.d_m, E_GPa: mat.E_GPa });
    var criticalRatio = crit.Nc_rpm / N_rpm;

    var warnings = [];
    var deflectionMm = defl.y_m * 1000;
    var deflectionVerdict;
    if (deflectionMm > 0.10) { deflectionVerdict = 'NOT RECOMMENDED'; warnings.push('Estimated shaft deflection ' + deflectionMm.toFixed(3) + ' mm exceeds the typical 0.10 mm pump screening guideline — wear-ring/seal clearances would likely be compromised.'); }
    else if (deflectionMm > 0.05) { deflectionVerdict = 'CHECK'; warnings.push('Estimated shaft deflection ' + deflectionMm.toFixed(3) + ' mm is above the conservative 0.05 mm guideline — verify against the actual bearing span and running clearances.'); }
    else { deflectionVerdict = 'SUITABLE'; }

    var criticalVerdict;
    if (criticalRatio >= 1.2) { criticalVerdict = 'SUITABLE'; }
    else { criticalVerdict = 'CHECK'; warnings.push('First critical speed is only ' + (criticalRatio * 100).toFixed(0) + '% of operating speed — API 610 practice wants at least 20% separation margin; this needs a full rotordynamic analysis, not just this screening estimate.'); }

    var verdict = (deflectionVerdict === 'NOT RECOMMENDED' || criticalVerdict === 'NOT RECOMMENDED') ? 'NOT RECOMMENDED'
      : (deflectionVerdict === 'CHECK' || criticalVerdict === 'CHECK') ? 'CHECK' : 'SUITABLE';

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', materialId: input.materialId, materialName: mat.name,
      torque_Nm: T, impellerMass_kg: imp.mass_kg, overhang_m: Loh,
      weightForce_N: Fweight, radialThrust_N: thrust.F_N, radialThrustKr: thrust.Kr, totalLateralForce_N: Ftotal,
      bendingMoment_Nm: M, tauAllowMPa: sizing.tauAllowMPa,
      shaftDiameter_mm: sizing.d_m * 1000,
      deflection_mm: deflectionMm, deflectionVerdict: deflectionVerdict,
      firstCriticalSpeed_rpm: crit.Nc_rpm, criticalSpeedRatio: criticalRatio, criticalVerdict: criticalVerdict,
      verdict: verdict, warnings: warnings,
      assumptions: [
        'Impeller mass from an assumed width/OD ratio of ' + imp.b2Ratio.toFixed(2) + ' for a ' + shapeFamily + ' impeller, ' + (imp.solidity * 100).toFixed(0)
          + '% disc solidity, and ' + (imp.densityAssumed ? 'a default ' : 'a supplied ') + imp.densityUsed + ' kg/m³ density — not a modelled impeller.',
        'Overhang length taken as ' + overhangRatio.toFixed(2) + ' × impeller OD (typical published ratio for an overhung OH-class pump).',
        'Radial hydraulic thrust from the Stepanoff/Karassik single-volute model (Kr = ' + thrust.Kr.toFixed(3) + ' at ' + pctBep.toFixed(0) + '% of BEP) — a different casing (diffuser, double volute) would carry materially less radial load.',
        'Shaft sized to the ASME combined bending+torsion equation with a 25% keyway derating and typical published shock/fatigue factors (Kb=' + sizing.Kb.toFixed(2) + ', Kt=' + sizing.Kt.toFixed(2) + ') — not a fatigue or vendor-certified analysis.',
        'First critical speed from a single-mass cantilever (Rayleigh) estimate, neglecting the shaft\'s own mass — a full rotordynamic model would include the shaft, coupling and bearing stiffness.',
      ],
    };
  }

  var SHAFT_MATERIAL_IDS = Object.keys(SHAFT_MATERIALS);
  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };

  function screenAllShaftMaterials(input) {
    var results = SHAFT_MATERIAL_IDS.map(function (id) {
      return screenShaft(Object.assign({}, input, { materialId: id }));
    });
    if (!results[0].applicable) return { applicable: false, status: results[0].status, reason: results[0].reason };
    results.sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.shaftDiameter_mm - b.shaftDiameter_mm; });
    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', ranked: results, top: results[0] };
  }

  window.AROPUMPSHAFT = {
    SHAFT_MATERIALS: SHAFT_MATERIALS,
    torque: torque,
    radialThrustFactor: radialThrustFactor,
    estimateImpellerMass: estimateImpellerMass,
    radialThrust: radialThrust,
    combinedStressDiameter: combinedStressDiameter,
    staticDeflection: staticDeflection,
    firstCriticalSpeed: firstCriticalSpeed,
    screenShaft: screenShaft,
    screenAllShaftMaterials: screenAllShaftMaterials,
  };
})();

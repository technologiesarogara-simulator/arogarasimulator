/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Screw Pump Mechanical Design (screening) engine
   window.AROPUMPSCREW

   Pump build Step 3. Pure calculation module — no DOM access — same
   "one IIFE, one namespace" pattern as the other pump engines, loadable
   and unit-testable in Node with nothing but `global.window = global`.

   PURPOSE
   Full-track mechanical design for the "Screw Pump (Single/Twin/Triple)"
   row of PUMP_SELECTION_STANDARD, once Section 10 (or a user override)
   has picked it:
     1. selectRotorConfig() — single (progressive-cavity style rotor in
        an elastomer/hard stator), twin (non-contacting, externally
        timed) or triple (one power rotor + two hydrodynamically driven
        idler rotors) screw, from duty (abrasives, viscosity, shear-
        sensitivity, temperature).
     2. estimateRotorGeometry() — a representative capacity-to-rotor-
        size scaling relation (same spirit as Phase 8's bore-vs-load
        curve) giving a rotor OD and effective meshing length.
     3. estimateBearingLoads() — axial thrust from differential pressure
        acting on the rotor's projected (frontal) area, the same named
        approach Phase 8 (AROPUMPBEARING) already uses for an impeller
        eye, plus a radial load from rotor self-weight; the caller feeds
        these into AROPUMPBEARING.screenAllBearingTypes() directly
        rather than this module duplicating L10 life math.
     4. screenRotorShaft() — the same ASME combined bending+torsion
        equation Phase 7 (AROPUMPSHAFT) uses, sized here for a simply-
        supported (not overhung) rotor span, to get the bearing-journal
        diameter AROPUMPBEARING.standardBore() needs.
     5. checkDriveTrain() — whether the required speed is close enough
        to a standard induction-motor synchronous speed for direct
        coupling, or needs a gear reducer, and at what ratio.
     6. nozzleViscosityCaveat() — a flagged caveat (not a recalculation)
        when the fluid is viscous enough that the generic nozzle-sizing
        velocity assumption elsewhere in the report needs a second look.

   WHAT THIS IS NOT
   - Not a vendor screw-pump selection. Rotor sizing is a representative
     capacity-to-geometry scaling relation for screening, calibrated to
     typical industrial twin-screw pump proportions — not a specific
     manufacturer's rotor geometry.
   - Not a full thrust-balance analysis. Many industrial screw pumps use
     an opposed-thread or balance-piston arrangement that substantially
     cancels axial thrust; the axial load estimated here is the
     unbalanced single-direction upper bound, the same caveat Phase 8
     already carries for a single-suction impeller.
   - Not a certified rotordynamic or gearbox-selection tool. Drive-train
     screening is standard synchronous-speed matching, not a vendor
     gearbox catalogue lookup.

   STANDARDS BASIS: API 676 (Positive Displacement Pumps — Rotary),
   the same citation PUMP_SELECTION_STANDARD carries for this row.

   API
     AROPUMPSCREW.ROTOR_CONFIGS
     AROPUMPSCREW.selectRotorConfig(input)
     AROPUMPSCREW.estimateRotorGeometry(input)
     AROPUMPSCREW.estimateBearingLoads(input)
     AROPUMPSCREW.screenRotorShaft(input)
     AROPUMPSCREW.checkDriveTrain(N_rpm)
     AROPUMPSCREW.nozzleViscosityCaveat(viscosityCst)
     AROPUMPSCREW.design(input) — full orchestration of all of the above
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  function worse(a, b) { return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b; }

  var ROTOR_CONFIGS = [
    { id: 'single-screw', name: 'Single Screw (Progressive Cavity)', rotors: 1, timingGears: false,
      note: 'A helical metal rotor turning inside a resilient (or hard) stator — the only one of the three that tolerates fine abrasives and solids well, via the stator flexing around them.' },
    { id: 'twin-screw', name: 'Twin Screw', rotors: 2, timingGears: true,
      note: 'Two non-contacting rotors held in time by an external timing-gear set — the general-purpose choice, including multiphase/two-phase duty, since it does not depend on the pumped fluid to lubricate the mesh.' },
    { id: 'triple-screw', name: 'Triple Screw', rotors: 3, timingGears: false,
      note: 'One power rotor drives two idler rotors hydrodynamically, through a film of the pumped fluid itself — no timing gears, quieter and simpler, but the fluid has to be clean and viscous/lubricating enough to sustain that film.' },
  ];

  /* ── selectRotorConfig ───────────────────────────────────────────────
     input = { viscosityCst, abrasives (bool), abrasivesSizeMicron,
     shearSensitive (bool), tempC } */
  function selectRotorConfig(input) {
    input = input || {};
    var nu = input.viscosityCst, abrasives = !!input.abrasives, shearSensitive = !!input.shearSensitive, tempC = input.tempC;

    var ranked = ROTOR_CONFIGS.map(function (cfg) {
      var reasons = [];
      var warnings = [];
      var verdict = 'SUITABLE';

      if (cfg.id === 'single-screw') {
        if (abrasives) {
          reasons.push('Elastomer/hard stator design is the most abrasive-tolerant of the three screw configurations — flexes around entrained solids rather than running tight metal-to-metal clearances against them.');
          if (isFinite(input.abrasivesSizeMicron) && input.abrasivesSizeMicron > 1000) {
            verdict = worse(verdict, 'CHECK');
            warnings.push('Particle size above ~1 mm starts to exceed typical stator interference-fit tolerance — confirm against the vendor\'s abrasive-size limit for the specific stator elastomer.');
          }
        } else {
          verdict = worse(verdict, 'CHECK');
          warnings.push('Capable on clean service too, but twin/triple-screw designs are usually more efficient and lower-maintenance when abrasives are not the driver.');
        }
        if (shearSensitive) reasons.push('Low internal shear (single sealed cavity progressing along the rotor) suits shear-sensitive fluids well.');
        if (isFinite(tempC) && tempC > 150) {
          verdict = worse(verdict, 'CHECK');
          warnings.push('Operating temperature ' + tempC.toFixed(0) + '°C is above the typical ~150°C limit for an elastomer stator — a hard (metal) stator variant would be needed above that, a distinct construction not screened here.');
        }
      }

      if (cfg.id === 'twin-screw') {
        reasons.push('Externally timed, non-contacting rotors do not rely on the pumped fluid for lubrication — the safest default across a wide viscosity and cleanliness range.');
        if (abrasives) {
          verdict = worse(verdict, 'NOT RECOMMENDED');
          warnings.push('Close non-contacting running clearances are intolerant of hard abrasives — single-screw (progressive cavity) handles solids far better.');
        }
        if (isFinite(nu) && nu < 5 && !abrasives) {
          warnings.push('At this low a viscosity the timing gears carry essentially all of the anti-rotation duty (little help from fluid film) — standard duty for this configuration, not a concern.');
        }
        if (isFinite(nu) && nu >= 8 && !abrasives) {
          verdict = worse(verdict, 'CHECK');
          warnings.push('Fluid is clean and viscous/lubricating enough for triple-screw\'s hydrodynamic idler rotors — the external timing-gear set here adds cost and complexity that duty may not need.');
        }
      }

      if (cfg.id === 'triple-screw') {
        if (abrasives) {
          verdict = worse(verdict, 'NOT RECOMMENDED');
          warnings.push('Idler rotors depend on a clean fluid film for hydrodynamic lubrication — abrasives would score the rotors and bore with no timing gears to fall back on.');
        } else if (isFinite(nu) && nu >= 8) {
          reasons.push('Fluid is viscous/lubricating enough (' + nu.toFixed(1) + ' cSt) to sustain the idler-rotor fluid film — the quietest, lowest-cost-of-the-three option (no timing-gear set) for clean lubricating duty like fuel or lube oil.');
        } else if (isFinite(nu) && nu < 8) {
          verdict = worse(verdict, 'CHECK');
          warnings.push('Viscosity (' + nu.toFixed(1) + ' cSt) is on the thin side for reliable hydrodynamic idler-rotor lubrication — twin-screw\'s externally timed rotors are the safer default below roughly 8 cSt.');
        } else {
          verdict = worse(verdict, 'CHECK');
          warnings.push('Viscosity was not available to confirm the idler rotors would get an adequate fluid film — twin-screw is the safer default absent that check.');
        }
        if (shearSensitive) warnings.push('Three meshing rotors add slightly more shear exposure than a single-screw design — check against the fluid\'s actual shear sensitivity.');
      }

      return { id: cfg.id, name: cfg.name, rotors: cfg.rotors, timingGears: cfg.timingGears, verdict: verdict, reasons: reasons, warnings: warnings, note: cfg.note };
    }).sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]; });

    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', ranked: ranked, top: ranked[0] };
  }

  // Calibrated so a 50 m³/h, 1450 rpm twin-screw duty (a common medium
  // industrial size) lands near a 63 mm rotor OD — a representative
  // capacity-to-geometry scaling relation for screening, not a specific
  // manufacturer's rotor geometry.
  var K_ROTOR = 195;

  function estimateRotorGeometry(input) {
    input = input || {};
    var Q_m3h = input.Q_m3h, N_rpm = input.N_rpm, diffPressureBar = input.diffPressureBar;
    if (!(Q_m3h > 0) || !(N_rpm > 0)) return { applicable: false };
    var rotorOD_mm = K_ROTOR * Math.cbrt(Q_m3h / N_rpm);
    var dP = isFinite(diffPressureBar) ? Math.max(0, diffPressureBar) : 0;
    // More differential pressure needs more thread engagement (more
    // sealing "stages" along the rotor) to hold it — L/D grows from a
    // typical 4:1 at low pressure toward 12:1 approaching the family's
    // 100 bar ceiling.
    var lengthToOdRatio = 4 + 8 * Math.min(1, dP / 100);
    var effectiveLength_mm = rotorOD_mm * lengthToOdRatio;
    return { applicable: true, rotorOD_mm: rotorOD_mm, effectiveLength_mm: effectiveLength_mm, lengthToOdRatio: lengthToOdRatio, K_ROTOR: K_ROTOR };
  }

  var K_AXIAL = 0.7; // same Karassik's Pump Handbook order of magnitude as Phase 8's impeller-eye estimate
  var ROTOR_DENSITY_KGM3 = 7850; // typical alloy/hardened steel rotor
  var ROTOR_SOLIDITY = 0.55; // fraction of the swept cylindrical volume the helical thread actually occupies

  function estimateBearingLoads(input) {
    input = input || {};
    var geom = estimateRotorGeometry(input);
    if (!geom.applicable) return { applicable: false, status: 'DATA REQUIRED', reason: 'Flow and pump speed both have to be known first — run the pump hydraulic calculation.' };
    var D_m = geom.rotorOD_mm / 1000, L_m = geom.effectiveLength_mm / 1000;
    var deltaP_Pa = isFinite(input.diffPressureBar) ? Math.max(0, input.diffPressureBar) * 1e5 : 0;
    var Aproj_m2 = (Math.PI / 4) * D_m * D_m;
    var Fa_N = K_AXIAL * deltaP_Pa * Aproj_m2;
    var rotorVolume_m3 = Aproj_m2 * L_m * ROTOR_SOLIDITY;
    var rotorMass_kg = ROTOR_DENSITY_KGM3 * rotorVolume_m3;
    var Fweight_N = rotorMass_kg * 9.81;
    var Fr_N = Fweight_N + 0.1 * Fa_N; // small allowance for meshing reaction load
    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION',
      rotorOD_mm: geom.rotorOD_mm, effectiveLength_mm: geom.effectiveLength_mm,
      Aproj_m2: Aproj_m2, K_AXIAL: K_AXIAL, Fa_N: Fa_N, rotorMass_kg: rotorMass_kg, Fr_N: Fr_N,
      warnings: (Fa_N > 0) ? ['Axial thrust is the unbalanced single-direction upper bound — an opposed-thread or balance-piston arrangement, common on larger industrial screw pumps, would substantially cancel this before it ever reaches the thrust bearing.'] : [],
    };
  }

  var ROTOR_MATERIAL = { Sy_MPa: 420, Sut_MPa: 700 }; // typical nitrided/hardened alloy-steel rotor shaft, screening only

  function torque(bhpKw, N_rpm) {
    if (!isFinite(bhpKw) || bhpKw <= 0 || !isFinite(N_rpm) || N_rpm <= 0) return NaN;
    return 9549 * bhpKw / N_rpm; // same T = 9549·P(kW)/N(rpm) relation Phase 7's shaft module uses
  }

  /* ── screenRotorShaft: ASME combined bending+torsion, simply-supported
     span (the rotor is carried in bearings at both ends inside the
     casing, not overhung like a centrifugal impeller) ────────────── */
  function screenRotorShaft(input) {
    input = input || {};
    var bhpKw = input.bhpKw, N_rpm = input.N_rpm, Fr_N = input.Fr_N, span_m = input.span_m;
    if (!(bhpKw > 0) || !(N_rpm > 0) || !(Fr_N > 0) || !(span_m > 0)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Brake power, pump speed, bearing loads and rotor span all have to be known first.' };
    }
    var T_Nm = torque(bhpKw, N_rpm);
    var M_Nm = Fr_N * span_m / 4; // simply-supported beam, center load
    var Kb = 1.75, Kt = 1.25; // same typical published shock/fatigue factors Phase 7 uses
    var keywayDerate = 0.75;
    var tauAllowMPa = Math.min(0.18 * ROTOR_MATERIAL.Sut_MPa, 0.30 * ROTOR_MATERIAL.Sy_MPa) * keywayDerate;
    var tauAllowPa = tauAllowMPa * 1e6;
    var d3 = (16 / (Math.PI * tauAllowPa)) * Math.sqrt(Math.pow(Kb * M_Nm, 2) + Math.pow(Kt * T_Nm, 2));
    var d_m = Math.cbrt(d3);
    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', torque_Nm: T_Nm, bendingMoment_Nm: M_Nm,
      tauAllowMPa: tauAllowMPa, shaftDiameter_mm: d_m * 1000,
      assumptions: [
        'Bending moment from a simply-supported (both-ends-in-bearings) span under a center point load — a screw-pump rotor is not overhung like a centrifugal impeller.',
        'Sized to a typical nitrided/hardened alloy-steel rotor shaft (Sy≈' + ROTOR_MATERIAL.Sy_MPa + ' MPa, Sut≈' + ROTOR_MATERIAL.Sut_MPa + ' MPa) with the same 25% keyway derating and published shock/fatigue factors (Kb=' + Kb + ', Kt=' + Kt + ') Phase 7 uses — not a vendor-certified analysis.',
      ],
    };
  }

  // Typical 50 Hz induction-motor synchronous speeds (2/4/6/8/10/12-pole)
  // less ~3% typical full-load slip.
  var MOTOR_SPEEDS_RPM = [2910, 1455, 970, 728, 582, 485];
  var DIRECT_COUPLE_TOLERANCE = 0.08;

  function checkDriveTrain(N_rpm) {
    if (!(N_rpm > 0)) return { applicable: false, status: 'DATA REQUIRED', reason: 'Pump speed is needed first.' };
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
        ? 'Required speed is within ' + (bestDiff * 100).toFixed(1) + '% of a standard ' + best + ' rpm motor speed — direct coupling is workable without a reducer.'
        : 'Required speed sits between standard motor speeds — a gear reducer (or a VFD-driven motor run off-speed) is needed; the nearest standard motor speed (' + best + ' rpm) implies an approximate ' + ratio.toFixed(2) + ':1 reducer ratio.',
    };
  }

  function nozzleViscosityCaveat(viscosityCst) {
    if (!isFinite(viscosityCst)) return null;
    if (viscosityCst > 500) {
      return 'Fluid viscosity (' + viscosityCst.toFixed(0) + ' cSt) is well above the typical 1-2 m/s liquid-velocity assumption behind the nozzle sizing shown elsewhere in this report — halve the assumed allowable velocity and re-check the suction/discharge nozzle size and friction loss for a duty this viscous rather than using the generic sizing as-is.';
    }
    if (viscosityCst > 100) {
      return 'Fluid viscosity (' + viscosityCst.toFixed(0) + ' cSt) is high enough that the nozzle sizing shown elsewhere in this report, sized on a lower-viscosity velocity assumption, is worth a second check for friction loss.';
    }
    return null;
  }

  /* ── design: full orchestration ─────────────────────────────────────
     input = { Q_m3h, N_rpm, diffPressureBar, viscosityCst, tempC,
     bhpKw, abrasives, abrasivesSizeMicron, shearSensitive } */
  function design(input) {
    input = input || {};
    var rotorConfig = selectRotorConfig(input);
    var loads = estimateBearingLoads(input);
    var span_m = loads.applicable ? (loads.effectiveLength_mm / 1000) * 1.3 : NaN; // bearings sit slightly beyond the meshing length
    var shaft = loads.applicable
      ? screenRotorShaft({ bhpKw: input.bhpKw, N_rpm: input.N_rpm, Fr_N: loads.Fr_N, span_m: span_m })
      : { applicable: false, status: loads.status, reason: loads.reason };
    var driveTrain = checkDriveTrain(input.N_rpm);
    var nozzleCaveat = nozzleViscosityCaveat(input.viscosityCst);

    return {
      applicable: !!(loads.applicable && shaft.applicable),
      status: 'PRELIMINARY ASSUMPTION',
      standardsBasis: 'API 676',
      rotorConfig: rotorConfig,
      geometry: loads.applicable ? { rotorOD_mm: loads.rotorOD_mm, effectiveLength_mm: loads.effectiveLength_mm } : null,
      loads: loads,
      shaft: shaft,
      driveTrain: driveTrain,
      nozzleCaveat: nozzleCaveat,
    };
  }

  window.AROPUMPSCREW = {
    ROTOR_CONFIGS: ROTOR_CONFIGS,
    selectRotorConfig: selectRotorConfig,
    estimateRotorGeometry: estimateRotorGeometry,
    estimateBearingLoads: estimateBearingLoads,
    torque: torque,
    screenRotorShaft: screenRotorShaft,
    checkDriveTrain: checkDriveTrain,
    nozzleViscosityCaveat: nozzleViscosityCaveat,
    design: design,
  };
})();

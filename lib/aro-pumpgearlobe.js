/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Gear / Lobe Pump Mechanical Design (screening) engine
   window.AROPUMPGEARLOBE

   Pump build Step 4. Pure calculation module — no DOM access — same
   "one IIFE, one namespace" pattern as the other pump engines, loadable
   and unit-testable in Node with nothing but `global.window = global`.

   PURPOSE
   Full-track mechanical design for whichever of PUMP_SELECTION_STANDARD's
   three meshing-rotor rows Section 10 (or a user override) actually
   picked — 'gear-external', 'gear-internal' or 'lobe-rotary'. Unlike the
   screw pump (one row, three internal rotor-count variants), these are
   three SEPARATE rows already ranked against each other by Section 10;
   this module does not re-choose between them, it designs whichever one
   was chosen:
     1. estimateGeometry() — a representative capacity-to-gear/lobe-OD
        scaling relation, sized differently per type (same spirit as the
        screw pump's rotor-OD curve).
     2. estimateBearingLoads() — two load mechanisms combined, both
        named: (a) hydraulic side-load from the pressure differential
        acting on the gear/lobe's projected area (the same
        differential-pressure x projected-area approach the screw pump
        and Phase 8's impeller-eye thrust estimate use, applied
        radially here rather than axially, because gear/lobe pump
        bearing life is dominated by this pressure-unbalance side load,
        not by axial thrust — spur gears/lobes carry essentially no
        axial thrust, unlike a screw pump's helically threaded rotor);
        (b) the tooth/lobe mesh tangential force from torque
        transmission, F = 2T/D, the standard gear-force relation.
     3. screenShaft() — the same ASME combined bending+torsion equation
        the screw pump module uses, for a simply-supported (not
        overhung) shaft span.
     4. checkDriveTrain() — direct-couple vs gear-reducer screening
        against standard motor synchronous speeds (shared logic with
        the screw pump module).
     5. screenSeallessOption() — a magnetic-drive (sealless) screening,
        the option gear pumps in particular are very commonly built
        with for zero-leakage toxic/hazardous/flammable duty, weighed
        against its own real limitations (abrasives foul the magnet
        gap and product-lubricated bearings, dry running starves those
        same bearings, and high viscosity raises drag torque toward the
        coupling's breakaway limit).

   WHAT THIS IS NOT
   - Not a vendor gear/lobe pump selection. Geometry is a representative
     capacity-to-size scaling relation for screening, calibrated to
     typical industrial proportions per type — not a manufacturer's
     rotor geometry.
   - Not a full gear-tooth stress (AGMA/ISO 6336) analysis. The mesh
     force here is the torque-derived tangential force only, used as a
     bearing-load input — not a tooth bending/contact-stress check.

   STANDARDS BASIS: API 676 for external/internal gear; API 676 plus
   3-A / EHEDG for a hygienic-execution lobe pump — the same citations
   PUMP_SELECTION_STANDARD carries for these three rows.

   API
     AROPUMPGEARLOBE.PUMP_TYPES
     AROPUMPGEARLOBE.estimateGeometry(input)
     AROPUMPGEARLOBE.estimateBearingLoads(input)
     AROPUMPGEARLOBE.torque(bhpKw, N_rpm)
     AROPUMPGEARLOBE.screenShaft(input)
     AROPUMPGEARLOBE.checkDriveTrain(N_rpm)
     AROPUMPGEARLOBE.screenSeallessOption(input)
     AROPUMPGEARLOBE.design(input) — full orchestration of all of the above
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  function worse(a, b) { return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b; }

  // Per-type geometry calibration — a representative capacity-to-size
  // scaling relation for screening, not a manufacturer's geometry.
  // D_mm = K * cbrt(Q_m3h / N_rpm); widthRatio = face width / D.
  var PUMP_TYPES = {
    'gear-external': { name: 'External Gear Pump', K: 150, widthRatio: 0.6, hasTimingGears: false, meshDriven: true,
      note: 'Two identical meshing gears, both shaft-supported at each end — the driving gear meshes directly with the driven gear (no separate timing-gear set).' },
    'gear-internal': { name: 'Internal Gear Pump', K: 170, widthRatio: 0.5, hasTimingGears: false, meshDriven: true,
      note: 'One rotor turning inside another (gerotor-style) — a single driven shaft, the outer rotor is carried on its own bore rather than a second shaft.' },
    'lobe-rotary': { name: 'Rotary Lobe Pump', K: 230, widthRatio: 0.7, hasTimingGears: true, meshDriven: false,
      note: 'Two non-contacting lobes held in time by an external timing-gear set, the same construction principle as a twin-screw pump — the lobes themselves never touch or transmit torque to each other.' },
  };

  function estimateGeometry(input) {
    input = input || {};
    var pumpTypeId = input.pumpTypeId, Q_m3h = input.Q_m3h, N_rpm = input.N_rpm;
    var t = PUMP_TYPES[pumpTypeId];
    if (!t || !(Q_m3h > 0) || !(N_rpm > 0)) return { applicable: false };
    var OD_mm = t.K * Math.cbrt(Q_m3h / N_rpm);
    var faceWidth_mm = OD_mm * t.widthRatio;
    return { applicable: true, pumpTypeId: pumpTypeId, pumpTypeName: t.name, OD_mm: OD_mm, faceWidth_mm: faceWidth_mm, widthRatio: t.widthRatio };
  }

  var K_SIDE = 0.5; // representative hydraulic-side-load fraction for a gear/lobe pump's pressure unbalance — same order of magnitude as Phase 8's single-suction axial-thrust factor, applied radially here

  function estimateBearingLoads(input) {
    input = input || {};
    var geom = estimateGeometry(input);
    if (!geom.applicable) return { applicable: false, status: 'DATA REQUIRED', reason: 'Pump type, flow and speed all have to be known first — run the pump hydraulic calculation and let Section 10 pick a family.' };
    var t = PUMP_TYPES[geom.pumpTypeId];
    var D_m = geom.OD_mm / 1000, width_m = geom.faceWidth_mm / 1000;
    var deltaP_Pa = isFinite(input.diffPressureBar) ? Math.max(0, input.diffPressureBar) * 1e5 : 0;
    var Aproj_m2 = D_m * width_m;
    var Fpressure_N = K_SIDE * deltaP_Pa * Aproj_m2;

    var T_Nm = torque(input.bhpKw, input.N_rpm);
    var Fmesh_N = (isFinite(T_Nm) && T_Nm > 0) ? (2 * T_Nm / D_m) : 0;

    // Spur gears and lobes carry essentially no axial thrust — materially
    // different from the screw pump's helically-threaded rotor, where
    // differential pressure IS the dominant axial load.
    var Fa_N = 0;
    var Fr_N = Fpressure_N + Fmesh_N; // conservative direct sum, not a vector resolution of the two load directions

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', pumpTypeId: geom.pumpTypeId, pumpTypeName: geom.pumpTypeName,
      OD_mm: geom.OD_mm, faceWidth_mm: geom.faceWidth_mm, Aproj_m2: Aproj_m2,
      Fpressure_N: Fpressure_N, Fmesh_N: Fmesh_N, Fa_N: Fa_N, Fr_N: Fr_N,
      warnings: t.meshDriven ? ['Radial load combines the pressure-unbalance side load with the torque-derived tooth-mesh force as a direct (conservative) sum, not a vector resolution — the true resultant depends on mesh phasing, which this screening does not model.'] : [],
    };
  }

  var ROTOR_MATERIAL = { Sy_MPa: 420, Sut_MPa: 700 }; // typical hardened alloy-steel gear/lobe shaft, screening only

  function torque(bhpKw, N_rpm) {
    if (!isFinite(bhpKw) || bhpKw <= 0 || !isFinite(N_rpm) || N_rpm <= 0) return NaN;
    return 9549 * bhpKw / N_rpm; // same T = 9549·P(kW)/N(rpm) relation Phase 7's shaft module uses
  }

  /* ── screenShaft: ASME combined bending+torsion, simply-supported span
     (both gear/lobe shafts are carried in bearings at both ends inside
     the casing, not overhung) ─────────────────────────────────────── */
  function screenShaft(input) {
    input = input || {};
    var bhpKw = input.bhpKw, N_rpm = input.N_rpm, Fr_N = input.Fr_N, span_m = input.span_m;
    if (!(bhpKw > 0) || !(N_rpm > 0) || !(Fr_N > 0) || !(span_m > 0)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Brake power, pump speed, bearing loads and shaft span all have to be known first.' };
    }
    var T_Nm = torque(bhpKw, N_rpm);
    var M_Nm = Fr_N * span_m / 4; // simply-supported beam, center load
    var Kb = 1.75, Kt = 1.25;
    var keywayDerate = 0.75;
    var tauAllowMPa = Math.min(0.18 * ROTOR_MATERIAL.Sut_MPa, 0.30 * ROTOR_MATERIAL.Sy_MPa) * keywayDerate;
    var tauAllowPa = tauAllowMPa * 1e6;
    var d3 = (16 / (Math.PI * tauAllowPa)) * Math.sqrt(Math.pow(Kb * M_Nm, 2) + Math.pow(Kt * T_Nm, 2));
    var d_m = Math.cbrt(d3);
    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION', torque_Nm: T_Nm, bendingMoment_Nm: M_Nm,
      tauAllowMPa: tauAllowMPa, shaftDiameter_mm: d_m * 1000,
      assumptions: [
        'Bending moment from a simply-supported (both-ends-in-bearings) span under a center point load.',
        'Sized to a typical hardened alloy-steel gear/lobe shaft (Sy≈' + ROTOR_MATERIAL.Sy_MPa + ' MPa, Sut≈' + ROTOR_MATERIAL.Sut_MPa + ' MPa) with a 25% keyway derating and the same published shock/fatigue factors (Kb=' + Kb + ', Kt=' + Kt + ') Phase 7 uses — not a vendor-certified analysis.',
      ],
    };
  }

  // Typical 50 Hz induction-motor synchronous speeds (2/4/6/8/10/12-pole)
  // less ~3% typical full-load slip — same table the screw pump module uses.
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

  /* ── screenSeallessOption: magnetic-drive (sealless) screening ──────
     input = { hazard ('benign'|'flammable'|'toxic'|'toxic-corrosive'
     — the same tags AROPUMPSEAL.FLUID_SEAL_HAZARD uses, passed in as a
     plain string so this module stays independently loadable/testable),
     abrasives (bool), dryRunRequired (bool), viscosityCst } */
  var VISCOSITY_SLIP_CHECK_CST = 5000;

  function screenSeallessOption(input) {
    input = input || {};
    var hazard = input.hazard, abrasives = !!input.abrasives, dryRunRequired = !!input.dryRunRequired, nu = input.viscosityCst;
    var verdict = 'SUITABLE';
    var reasons = [];
    var warnings = [];

    if (hazard === 'toxic-corrosive' || hazard === 'toxic') {
      reasons.push('Eliminates the dynamic shaft seal entirely — the standard choice for zero-leakage toxic/hazardous transfer.');
    } else if (hazard === 'flammable') {
      reasons.push('Removes the shaft-seal leak path on flammable duty — a common choice alongside (or instead of) a dual mechanical seal.');
    } else {
      verdict = worse(verdict, 'CHECK');
      warnings.push('Works on a benign fluid too, but a conventional shaft-seal design is usually more economical when containment is not the driver.');
    }

    if (abrasives) {
      verdict = 'NOT RECOMMENDED';
      warnings.push('Abrasives foul the magnet gap and the product-lubricated sleeve bearings a sealless design relies on — a conventional shaft seal (or single-screw progressive-cavity family instead) handles abrasive duty far better.');
    }
    if (dryRunRequired) {
      verdict = worse(verdict, 'NOT RECOMMENDED');
      warnings.push('The inner/outer magnet bearings are product-lubricated — they need continuous fluid film and cannot tolerate the dry-running duty specified.');
    }
    if (isFinite(nu) && nu > VISCOSITY_SLIP_CHECK_CST) {
      verdict = worse(verdict, 'CHECK');
      warnings.push('Viscosity (' + nu.toFixed(0) + ' cSt) is high enough to raise drag torque materially — verify against the magnetic coupling\'s rated breakaway/running torque before relying on this option.');
    }

    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', verdict: verdict, reasons: reasons, warnings: warnings };
  }

  /* ── design: full orchestration ─────────────────────────────────────
     input = { pumpTypeId, Q_m3h, N_rpm, diffPressureBar, bhpKw,
     hazard, abrasives, dryRunRequired, viscosityCst } */
  function design(input) {
    input = input || {};
    var t = PUMP_TYPES[input.pumpTypeId];
    var loads = estimateBearingLoads(input);
    var span_m = loads.applicable ? (loads.faceWidth_mm / 1000) * 2.5 : NaN; // bearings sit beyond the gear/lobe face on each side
    var shaft = loads.applicable
      ? screenShaft({ bhpKw: input.bhpKw, N_rpm: input.N_rpm, Fr_N: loads.Fr_N, span_m: span_m })
      : { applicable: false, status: loads.status, reason: loads.reason };
    var driveTrain = checkDriveTrain(input.N_rpm);
    var sealless = screenSeallessOption({ hazard: input.hazard, abrasives: input.abrasives, dryRunRequired: input.dryRunRequired, viscosityCst: input.viscosityCst });
    var standardsBasis = (input.pumpTypeId === 'lobe-rotary') ? 'API 676; 3-A / EHEDG (hygienic execution)' : 'API 676';

    return {
      applicable: !!(t && loads.applicable && shaft.applicable),
      status: 'PRELIMINARY ASSUMPTION',
      pumpTypeId: input.pumpTypeId, pumpTypeName: t ? t.name : null, pumpTypeNote: t ? t.note : null,
      standardsBasis: standardsBasis,
      geometry: loads.applicable ? { OD_mm: loads.OD_mm, faceWidth_mm: loads.faceWidth_mm } : null,
      loads: loads,
      shaft: shaft,
      driveTrain: driveTrain,
      sealless: sealless,
    };
  }

  window.AROPUMPGEARLOBE = {
    PUMP_TYPES: PUMP_TYPES,
    estimateGeometry: estimateGeometry,
    estimateBearingLoads: estimateBearingLoads,
    torque: torque,
    screenShaft: screenShaft,
    checkDriveTrain: checkDriveTrain,
    screenSeallessOption: screenSeallessOption,
    design: design,
  };
})();

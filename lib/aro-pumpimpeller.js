/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Specific Speed / Impeller Family engine
   window.AROPUMPIMPELLER

   Phase 4 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Takes the specific speed the existing calculation already computes
   (AROPUMPSTD.specificSpeed, published in window.state.pump.results.Ns)
   and classifies the impeller shape family it implies, with the typical
   published design-coefficient ranges (head coefficient ψ, flow
   coefficient φ, vane count, vane exit angle, eye ratio) for that band —
   then, from those typical coefficients, solves the classical Euler
   turbomachinery velocity triangle at the impeller exit (tip speed U2,
   impeller OD estimate, Cu2/Cm2/W2, blade exit angle β2).

   This module intentionally does not re-derive Ns itself and does not
   depend on AROPUMPSTD at load time — the caller passes the Ns value
   the existing engine already produced, so there is exactly one place
   in the app that computes specific speed. classify()'s own shape-family
   thresholds (1500 / 4200 / 9000, US customary Ns) are kept identical to
   AROPUMPSTD.impellerType's for consistency, not duplicated math.

   WHAT THIS IS NOT
   - Not a finished impeller design. ψ and φ are typical PUBLISHED ranges
     for the specific-speed band, not a specific vendor's design point —
     every result here is explicitly status PRELIMINARY ASSUMPTION.
   - Not a 3D model. D2 here is a single estimated number (impeller OD),
     not a parametric geometry — a parametric 3D viewer is a deliberately
     separate follow-up.
   - Not casing design (Phase 5) or shaft/bearing design (later phases).

   API
     AROPUMPIMPELLER.SHAPE_BANDS         — the Ns-band coefficient database
     AROPUMPIMPELLER.classify(Ns)        — shape family + typical coefficients
     AROPUMPIMPELLER.eulerHead(input)    — velocity triangle + Euler head
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Boundaries intentionally identical to AROPUMPSTD.impellerType (US
  // customary Ns) so the two engines never disagree about which band a
  // duty falls in. Coefficient ranges are typical published values
  // (Stepanoff/Karassik-style pump design charts): head coefficient
  // ψ = g·H/U2², flow coefficient φ = Q/(U2·D2²), both falling as Ns
  // rises while vane exit angle and eye ratio climb.
  function band(lo, hi, mid) { return { min: lo, max: hi, mid: (mid == null ? (lo + hi) / 2 : mid) }; }
  var SHAPE_BANDS = [
    { maxNs: 1500, shapeFamily: 'radial',
      headCoefficient: band(0.45, 0.65), flowCoefficient: band(0.02, 0.06),
      vaneCount: band(6, 8), vaneExitAngleDeg: band(20, 28), eyeRatio: band(0.35, 0.50),
      note: 'Narrow, deep radial-flow passages — high head per stage at low flow.' },
    { maxNs: 4200, shapeFamily: 'Francis / mixed flow',
      headCoefficient: band(0.30, 0.45), flowCoefficient: band(0.05, 0.12),
      vaneCount: band(5, 7), vaneExitAngleDeg: band(24, 34), eyeRatio: band(0.50, 0.65),
      note: 'The general-purpose process shape — balanced head and flow.' },
    { maxNs: 9000, shapeFamily: 'mixed flow',
      headCoefficient: band(0.15, 0.30), flowCoefficient: band(0.10, 0.25),
      vaneCount: band(4, 6), vaneExitAngleDeg: band(28, 45), eyeRatio: band(0.60, 0.80),
      note: 'Flow leaves at an angle to the shaft — moderate head at high flow.' },
    { maxNs: Infinity, shapeFamily: 'axial flow',
      headCoefficient: band(0.05, 0.15), flowCoefficient: band(0.25, 0.55),
      vaneCount: band(3, 5), vaneExitAngleDeg: band(35, 60), eyeRatio: band(0.80, 0.95),
      note: 'A propeller, not a bladed impeller in the usual sense — very high flow at low head.' },
  ];

  function classify(Ns) {
    if (!isFinite(Ns) || Ns <= 0) {
      return { valid: false, status: 'DATA REQUIRED', reason: 'Specific speed is not available yet — run the pump hydraulic calculation first.' };
    }
    var b = SHAPE_BANDS.filter(function (x) { return Ns < x.maxNs; })[0] || SHAPE_BANDS[SHAPE_BANDS.length - 1];
    return {
      valid: true, status: 'PREDICTED', Ns: Ns, shapeFamily: b.shapeFamily,
      headCoefficient: b.headCoefficient, flowCoefficient: b.flowCoefficient,
      vaneCount: b.vaneCount, vaneExitAngleDeg: b.vaneExitAngleDeg, eyeRatio: b.eyeRatio,
      note: b.note,
    };
  }

  var G = 9.81;

  /* ── eulerHead: the exit velocity triangle from the classified band ──
     input = { H_m, N_rpm, stages (default 1), Ns, hydraulicEff (default
     0.80), psiOverride, phiOverride (optional — override the band's
     midpoint coefficient with a value the engineer has actually chosen) }

     Euler turbomachinery equation with zero inlet pre-rotation (Cu1=0):
         H_euler = U2 · Cu2 / g            (per stage, theoretical head)
         H_actual = ηh · H_euler           (hydraulic efficiency lumps
                                             friction + shock + slip loss)
     so, working backwards from the duty's actual stage head:
         U2  = √(g · H_stage / ψ)                     [head coefficient]
         D2  = U2 · 60 / (π · N)                        [impeller OD]
         H_euler_stage = H_stage / ηh
         Cu2 = g · H_euler_stage / U2
         Cm2 = φ · U2                                  [flow coefficient]
     and the exit relative velocity closes the triangle:
         W2u = U2 − Cu2 ,  β2 = atan2(Cm2, W2u) ,  W2 = √(Cm2² + W2u²)  */
  function eulerHead(input) {
    input = input || {};
    var H = input.H_m, N = input.N_rpm, Ns = input.Ns;
    var stages = (input.stages == null || !isFinite(input.stages) || input.stages < 1) ? 1 : input.stages;
    var eta = (input.hydraulicEff == null || !isFinite(input.hydraulicEff) || input.hydraulicEff <= 0 || input.hydraulicEff > 1)
      ? 0.80 : input.hydraulicEff;

    if (!isFinite(H) || H <= 0 || !isFinite(N) || N <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Head and pump speed are not available yet — run the pump hydraulic calculation first.' };
    }
    var cls = classify(Ns);
    if (!cls.valid) return { applicable: false, status: 'DATA REQUIRED', reason: cls.reason };

    var psi = (input.psiOverride != null && isFinite(input.psiOverride) && input.psiOverride > 0) ? input.psiOverride : cls.headCoefficient.mid;
    var phi = (input.phiOverride != null && isFinite(input.phiOverride) && input.phiOverride > 0) ? input.phiOverride : cls.flowCoefficient.mid;

    var Hstage = H / stages;
    var U2 = Math.sqrt(G * Hstage / psi);
    var D2_m = U2 * 60 / (Math.PI * N);
    var HeulerStage = Hstage / eta;
    var Cu2 = G * HeulerStage / U2;
    var Cm2 = phi * U2;
    var W2u = U2 - Cu2;
    var beta2Deg = Math.atan2(Cm2, W2u) * 180 / Math.PI;
    var W2 = Math.sqrt(Cm2 * Cm2 + W2u * W2u);
    var slipFactor = Cu2 / U2;

    var warnings = [];
    if (slipFactor > 0.95 || slipFactor < 0) {
      warnings.push('Cu2/U2 = ' + slipFactor.toFixed(2) + ' is outside the physically typical 0.4–0.85 band — the assumed head coefficient and hydraulic efficiency are not mutually consistent for this duty. Treat D2/β2 as order-of-magnitude only, not a design point.');
    }
    if (beta2Deg < 0 || beta2Deg > 90) {
      warnings.push('Resulting blade exit angle ' + beta2Deg.toFixed(1) + '° falls outside a normal 0–90° impeller blade range — the coefficient assumptions do not close into a physical triangle here.');
    }

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION',
      shapeFamily: cls.shapeFamily, Ns: Ns,
      psiUsed: psi, phiUsed: phi, hydraulicEff: eta,
      Hstage_m: Hstage, U2_ms: U2, D2_m: D2_m,
      Cu2_ms: Cu2, Cm2_ms: Cm2, W2_ms: W2, beta2Deg: beta2Deg, slipFactor: slipFactor,
      warnings: warnings,
      assumptions: [
        'Head coefficient ψ = ' + psi.toFixed(3) + ' and flow coefficient φ = ' + phi.toFixed(3)
          + ' are the typical published mid-range values for a ' + cls.shapeFamily + ' impeller (Ns ' + Math.round(Ns) + ', US), not a vendor design point.',
        'Hydraulic efficiency ηh = ' + (eta * 100).toFixed(0) + '% is ' + (input.hydraulicEff == null ? 'a default assumption' : 'as entered') + ' — it sets how much the Euler (theoretical) head exceeds the actual delivered head.',
        'Zero inlet pre-rotation (Cu1 = 0) assumed, as is standard for a first-pass screening estimate.',
      ],
    };
  }

  window.AROPUMPIMPELLER = {
    SHAPE_BANDS: SHAPE_BANDS,
    classify: classify,
    eulerHead: eulerHead,
  };
})();

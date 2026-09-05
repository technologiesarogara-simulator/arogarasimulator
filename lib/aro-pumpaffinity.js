/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Affinity Laws (VFD speed / impeller trim) engine
   window.AROPUMPAFFINITY

   Phase 11 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Scales the predicted BEP curve AROPUMPCURVE already builds (Phase 0
   work, not touched here) by a speed ratio (a VFD slider) or a trim
   ratio (an impeller-diameter slider), using the standard affinity
   laws:
       Q₂/Q₁ = r          H₂/H₁ = r²          P₂/P₁ = r³
   This module does not rebuild the curve itself — it returns the
   scaled Qbep/Hbep/npshrBep AROPUMPCURVE.make() already accepts, so
   the caller feeds the result straight back into the existing curve
   engine (AROPUMPCURVE.make → .operatingPoint → .region) rather than
   duplicating any of that math.

   A key, deliberately-tested identity: specific speed Ns is INVARIANT
   under this scaling (Ns = N·√Q / H^0.75; substituting Q₂=Qr, H₂=Hr²
   cancels r exactly). That is not a simplification — it is the
   mathematical reason a speed change reuses the same dimensionless
   curve shape (shut-off ratio, efficiency-vs-flow shape) just moved to
   a new BEP anchor, and it is also the standard textbook trim
   approximation: the trim model assumes the curve *shape* is
   unchanged and only the BEP point moves, which is exactly what
   holding Ns fixed does with AROPUMPCURVE.make().

   WHAT THIS IS NOT
   - Not exact for a trim. The affinity laws are a first-pass screening
     approximation for impeller trimming — the real vane geometry
     doesn't scale perfectly, and accuracy degrades with trim depth.
     This module warns rather than silently trusting a large trim.
   - Not a mechanical-loss model. A speed change assumes efficiency is
     unchanged, which is the standard practical assumption in the
     comfortable 50-100% speed range a VFD normally operates in — this
     module warns rather than silently trusting a very low speed too.

   API
     AROPUMPAFFINITY.quickScale(baseQ, baseH, basePowerKw, ratio)
     AROPUMPAFFINITY.trimEfficiencyPenalty(ratio)
     AROPUMPAFFINITY.scaleBEP(input)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── quickScale: the bare affinity laws at a single point ──────────── */
  function quickScale(baseQ, baseH, basePowerKw, ratio) {
    return {
      Q: (baseQ == null || !isFinite(baseQ)) ? NaN : baseQ * ratio,
      H: (baseH == null || !isFinite(baseH)) ? NaN : baseH * ratio * ratio,
      powerKw: (basePowerKw == null || !isFinite(basePowerKw)) ? NaN : basePowerKw * ratio * ratio * ratio,
    };
  }

  /* ── trimEfficiencyPenalty: a documented screening penalty ───────────
     Trimming loses a little efficiency beyond a small cut — flat below
     5% trim, then a published-typical 0.3 percentage points per 1% of
     additional trim, capped at 10 points so the estimate never runs
     away for an unrealistically deep cut. */
  function trimEfficiencyPenalty(ratio) {
    if (!isFinite(ratio) || ratio >= 0.95) return 0;
    var trimPct = (0.95 - ratio) * 100;
    return Math.min(10, trimPct * 0.3);
  }

  /* ── scaleBEP: the scaled BEP parameters for AROPUMPCURVE.make() ────
     input = { Qbep, Hbep, etaBep, npshrBep, Ns, ratio, mode: 'speed'|'trim' } */
  function scaleBEP(input) {
    input = input || {};
    var Qbep = input.Qbep, Hbep = input.Hbep, etaBep = input.etaBep, npshrBep = input.npshrBep, Ns = input.Ns;
    var ratio = input.ratio, mode = input.mode;

    if (!isFinite(Qbep) || !isFinite(Hbep) || !isFinite(etaBep) || !isFinite(npshrBep) || !isFinite(Ns)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'The predicted BEP curve is not available yet — run the pump hydraulic calculation first.' };
    }
    if (!isFinite(ratio) || ratio <= 0 || ratio > 1.5) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Ratio must be a positive number, typically no more than 1.5 (150%).' };
    }
    if (mode !== 'speed' && mode !== 'trim') {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Mode must be "speed" or "trim".' };
    }

    var warnings = [];
    var etaPenalty = 0;
    if (mode === 'trim') {
      etaPenalty = trimEfficiencyPenalty(ratio);
      if (ratio < 0.85) {
        warnings.push('A trim beyond ~15% (ratio ' + (ratio * 100).toFixed(0) + '%) is outside where the affinity-law approximation is generally considered reliable — a vendor-trimmed curve is needed to confirm this point.');
      } else if (ratio < 0.95) {
        warnings.push('A moderate trim (ratio ' + (ratio * 100).toFixed(0) + '%) — affinity-law accuracy is reduced from a full-diameter curve; treat this as a screening estimate.');
      }
    } else {
      if (ratio < 0.5) {
        warnings.push('Below about 50% speed, mechanical losses (bearing/seal friction) stop scaling with the affinity laws, so actual efficiency will run below this estimate.');
      }
      if (ratio > 1.0) {
        warnings.push('Running above rated speed needs the driver, bearings, coupling and NPSHr margin all re-verified for overspeed — this is not just a hydraulic question.');
      }
    }

    return {
      applicable: true, status: 'PREDICTED', mode: mode, ratio: ratio,
      scaled: {
        Qbep: Qbep * ratio,
        Hbep: Hbep * ratio * ratio,
        npshrBep: npshrBep * ratio * ratio,
        etaBep: Math.max(0, etaBep - etaPenalty),
        Ns: Ns, // invariant under this scaling — see module header
      },
      etaPenalty: etaPenalty,
      warnings: warnings,
      assumptions: [
        'Q scales with the ratio, H and NPSHr with its square, power with its cube — the standard affinity laws.',
        mode === 'trim'
          ? 'Efficiency reduced by ' + etaPenalty.toFixed(1) + ' percentage points for this trim depth (a published-typical screening penalty, not a vendor-trimmed curve).'
          : 'Efficiency held unchanged across the speed change, the standard assumption within a VFD\'s normal operating range.',
        'Specific speed Ns is held fixed, which keeps the dimensionless curve shape (shut-off ratio, efficiency-vs-flow shape) the same and only moves the BEP anchor point — the standard basis for both a speed-change and a trim-affinity-law curve family.',
      ],
    };
  }

  window.AROPUMPAFFINITY = {
    quickScale: quickScale,
    trimEfficiencyPenalty: trimEfficiencyPenalty,
    scaleBEP: scaleBEP,
  };
})();

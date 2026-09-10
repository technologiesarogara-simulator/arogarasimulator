/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Automatic Pump Family Selection engine
   window.AROPUMPFAMILY

   Phase 2 of the Pump Hydraulics Advanced Upgrade; rebuilt for the Pump
   Selection Standard build (Step 2) to read its 23-row reference table
   instead of carrying its own smaller seed database. Pure calculation
   module — no DOM access — following the same "one IIFE, one namespace"
   pattern as AROPUMPSTD / AROPUMPCURVE / AROVP, so it can be loaded and
   unit-tested in Node with nothing but `global.window = global`.

   PURPOSE
   Screens a duty point already established by the existing Pump
   Hydraulics workflow (flow, head, viscosity, NPSH margin) plus four new
   duty-character flags (abrasives, shear-sensitivity, dry-run/self-
   priming requirement, pulsation/smooth-flow requirement) against every
   row in window.PUMP_SELECTION_STANDARD (lib/aro-pumpstandard.js —
   load that file first), and returns a ranked, reasoned comparison of
   all 23 pump types plus a held user override, the same "TEMA MODEL
   pick" behaviour the STHE module already gives a heat-exchanger
   configuration.

   WHAT THIS IS NOT
   - Not a vendor selection. Every result carries status "PREDICTED" —
     see the `status` field on the return value.
   - Not a mechanical design. No geometry, no impeller sizing — that is
     the six full-track families' own build steps (Phase 3+).
   - Does not gate or hide reference-only rows from the comparison — the
     spec is explicit that every row gets full scoring; only its
     fabrication depth differs, and the UI states that plainly per row
     via the `fullTrack` flag carried through from the reference table.

   API
     AROPUMPFAMILY.fitScore(value, [lo,hi]) — 0..1 continuous range fit
     AROPUMPFAMILY.scoreToVerdict(score)    — 'SUITABLE'|'CHECK'|'NOT RECOMMENDED'
     AROPUMPFAMILY.viscosityDecision(cSt)   — banding + guidance text
     AROPUMPFAMILY.selectFamilies(duty)     — the ranked shortlist
     AROPUMPFAMILY.FAMILIES                 — back-compat alias for
       window.PUMP_SELECTION_STANDARD, so any code still reading the old
       name keeps working
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function standardRows() {
    return (typeof window !== 'undefined' && Array.isArray(window.PUMP_SELECTION_STANDARD))
      ? window.PUMP_SELECTION_STANDARD : [];
  }

  /* ── fitScore: continuous 0..1 range fit ──────────────────────────
     1.0 inside [lo,hi]. Decays on a log scale outside it so a factor
     of ~20x beyond the edge reaches 0 — gentle enough that a duty just
     outside a family's stated envelope still shows up as CHECK rather
     than being discarded outright, since these are guide ranges, not
     hard cutoffs. */
  function fitScore(value, range) {
    if (value == null || !isFinite(value)) return 0.5; // unknown -> neutral, never silently excludes
    var lo = range[0], hi = range[1];
    if (value >= lo && value <= hi) return 1;
    var edge = value < lo ? lo : hi;
    var v = Math.max(value, 1e-9);
    var ratio = value < lo ? edge / v : v / Math.max(edge, 1e-9);
    var decay = 1 - Math.log10(ratio) / 1.3;
    return Math.max(0, Math.min(1, decay));
  }

  function scoreToVerdict(score) {
    if (score >= 70) return 'SUITABLE';
    if (score >= 40) return 'CHECK';
    return 'NOT RECOMMENDED';
  }

  function fmt(v, digits) {
    if (v == null || !isFinite(v)) return '—';
    return Number(v).toFixed(digits == null ? 1 : digits);
  }

  function describeFit(label, value, range, unit) {
    if (value == null || !isFinite(value)) return label + ' not available.';
    var lo = range[0], hi = range[1];
    if (value >= lo && value <= hi) {
      return 'Duty ' + label + ' ' + fmt(value) + ' ' + unit + ' sits within the family\'s typical ' + fmt(lo) + '–' + fmt(hi) + ' ' + unit + ' band.';
    }
    if (value < lo) {
      return 'Duty ' + label + ' ' + fmt(value) + ' ' + unit + ' is below the family\'s typical ' + fmt(lo) + '–' + fmt(hi) + ' ' + unit + ' band.';
    }
    return 'Duty ' + label + ' ' + fmt(value) + ' ' + unit + ' is above the family\'s typical ' + fmt(lo) + '–' + fmt(hi) + ' ' + unit + ' band.';
  }

  /* pass / marginal / fail per criterion — the app's existing standards-
     compliance vocabulary (see AROPUMPSTD checks), reused here rather
     than inventing a fourth status word for the same three states. */
  function criterionVerdict(fit) {
    if (fit >= 0.85) return 'pass';
    if (fit >= 0.4) return 'marginal';
    return 'fail';
  }

  /* ── viscosityDecision: the "viscosity-decision engine" the spec asks
     for. Bands drawn from where centrifugal-pump behaviour is known to
     change: ANSI/HI 9.6.7 correction becomes material above ~20 cSt,
     and centrifugal efficiency is generally considered impractical
     above roughly 3000 cSt. */
  function viscosityDecision(cSt) {
    if (cSt == null || !isFinite(cSt)) {
      return { band: 'unknown', correctionRequired: false,
        guidance: 'Viscosity not entered — DATA REQUIRED before a viscosity-aware family screening can run.' };
    }
    if (cSt <= 20) {
      return { band: 'low', correctionRequired: false,
        guidance: 'Close to water (' + fmt(cSt) + ' cSt) — negligible viscous correction; standard centrifugal hydraulic design applies directly.' };
    }
    if (cSt <= 1000) {
      return { band: 'moderate', correctionRequired: true,
        guidance: fmt(cSt) + ' cSt is above the ~20 cSt threshold where viscosity matters. Apply the ANSI/HI 9.6.7 viscous correction (AROPUMPSTD.viscousCorrection) before trusting the head/flow/efficiency figures for a centrifugal selection.' };
    }
    if (cSt <= 3000) {
      return { band: 'high', correctionRequired: true,
        guidance: fmt(cSt) + ' cSt is high enough that centrifugal efficiency degrades sharply even after correction — screen positive-displacement families alongside any centrifugal candidate.' };
    }
    return { band: 'very-high', correctionRequired: true,
      guidance: fmt(cSt) + ' cSt is beyond where centrifugal (impeller) pumps are practical. Positive-displacement families (gear / screw / lobe / progressive-cavity) should be treated as the primary candidates.' };
  }

  /* ── selectFamilies: the ranked comparison across all 23 reference rows
     duty = { Q_m3h, H_m, viscosityCst, npshMarginM (optional),
              abrasives (bool), abrasivesSizeMicron (optional),
              shearSensitive (bool), dryRunRequired (bool),
              pulsationSensitive (bool) }
     Only Q_m3h/H_m are required — everything else already has a
     conservative default (false / not entered) so no existing caller
     that predates the new duty-character flags breaks. */
  function selectFamilies(duty) {
    duty = duty || {};
    var Q = duty.Q_m3h, H = duty.H_m, visc = duty.viscosityCst;
    var npshMargin = (duty.npshMarginM == null) ? null : duty.npshMarginM;
    var abrasives = !!duty.abrasives, shearSensitive = !!duty.shearSensitive;
    var dryRunRequired = !!duty.dryRunRequired, pulsationSensitive = !!duty.pulsationSensitive;

    if (Q == null || !isFinite(Q) || H == null || !isFinite(H)) {
      return { ready: false, status: 'DATA REQUIRED',
        reason: 'Run the pump hydraulic calculation first — flow and head are not available yet.' };
    }

    var rows = standardRows();
    if (!rows.length) {
      return { ready: false, status: 'DATA REQUIRED',
        reason: 'PUMP_SELECTION_STANDARD is not loaded — include lib/aro-pumpstandard.js before lib/aro-pumpfamily.js.' };
    }

    var visco = viscosityDecision(visc);

    var ranked = rows.map(function (fam) {
      var reasons = [];
      var warnings = [];

      var flowFit = fitScore(Q, fam.flowRangeM3h);
      var headFit = fitScore(H, fam.headRangeM);
      var viscFit = fitScore(visc, fam.viscosityRangeCst);

      reasons.push(describeFit('flow', Q, fam.flowRangeM3h, 'm³/h'));
      reasons.push(describeFit('head', H, fam.headRangeM, 'm'));
      if (visc != null && isFinite(visc)) reasons.push(describeFit('viscosity', visc, fam.viscosityRangeCst, 'cSt'));

      var score = flowFit * 35 + headFit * 30 + viscFit * 25;

      var criteria = {
        flow: criterionVerdict(flowFit),
        head: criterionVerdict(headFit),
        viscosity: (visc != null && isFinite(visc)) ? criterionVerdict(viscFit) : 'marginal'
      };

      // Hard engineering rule: centrifugal (impeller) pumps are not a
      // credible choice once viscosity is well beyond the correction's
      // useful range, regardless of how the flow/head numbers land.
      if (fam.category === 'centrifugal' && visc != null && isFinite(visc) && visc > 3000) {
        score = Math.min(score, 30);
        criteria.viscosity = 'fail';
        warnings.push('Centrifugal impeller efficiency collapses above ~3000 cSt (ANSI/HI 9.6.7 correction range exceeded) — not credible at this viscosity regardless of flow/head fit.');
      }

      // NPSH-sensitivity adjustment: only applied when a margin has
      // actually been calculated (never invents one).
      var npshLow = fam.npshCharacteristic === 'low-npshr' || fam.npshCharacteristic === 'self-priming-dry-run-capable';
      var npshHigh = fam.npshCharacteristic === 'npsh-sensitive' || fam.npshCharacteristic === 'npsh-sensitive-acceleration-head';
      criteria.npsh = 'pass';
      if (npshMargin != null && isFinite(npshMargin)) {
        if (npshMargin < 1) {
          if (npshHigh) {
            score -= 10;
            criteria.npsh = 'fail';
            warnings.push('Calculated NPSH margin is only ' + fmt(npshMargin) + ' m and this family\'s NPSHr tends to run high for its class — treat with caution.');
          } else if (npshLow) {
            score += 5;
            reasons.push('Calculated NPSH margin is tight (' + fmt(npshMargin) + ' m); this family\'s NPSH characteristics are usually the most tolerant of the options screened.');
          } else {
            criteria.npsh = 'marginal';
          }
        }
      }

      // Dry-run / self-priming requirement.
      var dryRunOk = !!fam.dryRunCapable || /self-priming/.test(fam.npshCharacteristic || '');
      criteria.dryRun = dryRunRequired ? (dryRunOk ? 'pass' : 'fail') : 'pass';
      if (dryRunRequired) {
        if (dryRunOk) {
          score += 5;
          reasons.push('Dry-run / self-priming was required, and this family is rated for it (' + fam.selfPriming + ').');
        } else {
          score -= 15;
          warnings.push('Dry-run / self-priming was required, but this family (' + fam.selfPriming + ') is not built for it.');
        }
      }

      // Shear-sensitive fluid.
      criteria.shear = 'pass';
      if (shearSensitive) {
        if (fam.fluidSuitability.shearSensitive) {
          score += 5;
          reasons.push('Fluid was flagged shear-sensitive, and this family is a known low-shear choice.');
        } else if (fam.category === 'centrifugal') {
          score -= 10;
          criteria.shear = 'fail';
          warnings.push('Fluid was flagged shear-sensitive — a centrifugal impeller\'s high-shear action is a poor match regardless of the flow/head fit.');
        } else {
          criteria.shear = 'marginal';
        }
      }

      // Abrasives / solids.
      criteria.abrasives = 'pass';
      if (abrasives) {
        if (fam.fluidSuitability.abrasiveSlurry) {
          score += 5;
          reasons.push('Abrasive solids were flagged, and this family is built to tolerate them.');
        } else if (fam.category === 'pd-rotary' || fam.category === 'centrifugal') {
          score -= 15;
          criteria.abrasives = 'fail';
          warnings.push('Abrasive solids were flagged — this family\'s close internal clearances / impeller wet-end wear quickly on abrasives.');
        } else {
          criteria.abrasives = 'marginal';
        }
      }

      // Pulsation / smooth-flow requirement.
      criteria.pulsation = 'pass';
      if (pulsationSensitive) {
        if (fam.category === 'pd-reciprocating') {
          score -= 15;
          criteria.pulsation = 'fail';
          warnings.push('Smooth, low-pulsation flow was required — reciprocating pumps are inherently pulsating without a sized dampener.');
        } else if (fam.category === 'pd-rotary') {
          score += 3;
          reasons.push('Smooth, low-pulsation flow was required, and rotary PD types are inherently low-pulsation.');
        }
      }

      score = Math.max(0, Math.min(100, score));

      return {
        id: fam.id, name: fam.name, category: fam.category, apiClass: fam.apiClass || null,
        flowRangeM3h: fam.flowRangeM3h, headRangeM: fam.headRangeM, viscosityRangeCst: fam.viscosityRangeCst,
        tempRangeC: fam.tempRangeC, maxDiffPressureBar: fam.maxDiffPressureBar,
        efficiencyBandPct: fam.efficiencyBandPct, standardsBasis: fam.standardsBasis,
        selfPriming: fam.selfPriming, dryRunCapable: !!fam.dryRunCapable,
        application: fam.application, keyLimitations: fam.keyLimitations,
        fluidSuitability: fam.fluidSuitability,
        fullTrack: !!fam.fullTrack,
        hygienicCapable: !!fam.hygienicCapable, sealless: !!fam.sealless,
        noRotatingShaft: !!fam.noRotatingShaft,
        note: fam.note,
        score: Math.round(score * 10) / 10,
        verdict: scoreToVerdict(score),
        criteria: criteria,
        reasons: reasons, warnings: warnings,
      };
    }).sort(function (a, b) { return b.score - a.score; });

    var top = ranked[0];
    var alternatives = ranked.slice(1, 6).map(function (f) {
      var why = [];
      if (f.score < top.score) why.push((top.score - f.score).toFixed(0) + ' points behind the top pick on the screened criteria.');
      if (!f.fullTrack && top.fullTrack) why.push('no fabrication package built yet for this type; the top pick has one.');
      Object.keys(f.criteria).forEach(function (k) {
        if (f.criteria[k] === 'fail' && top.criteria[k] !== 'fail') why.push('fails the ' + k + ' criterion where the top pick does not.');
      });
      return { id: f.id, name: f.name, score: f.score, verdict: f.verdict, fullTrack: f.fullTrack, whyBehindTopPick: why };
    });

    return {
      ready: true, status: 'PREDICTED',
      duty: { Q_m3h: Q, H_m: H, viscosityCst: visc, npshMarginM: npshMargin,
        abrasives: abrasives, abrasivesSizeMicron: duty.abrasivesSizeMicron || null,
        shearSensitive: shearSensitive, dryRunRequired: dryRunRequired, pulsationSensitive: pulsationSensitive },
      viscosity: visco,
      ranked: ranked,
      top: top,
      alternatives: alternatives,
      note: 'Screening comparison from typical published pump-selection envelopes across the full 23-type Pump Selection Standard, not a vendor-certified curve. Confirm any candidate against a manufacturer\'s performance curve before purchase.',
    };
  }

  window.AROPUMPFAMILY = {
    get FAMILIES() { return standardRows(); }, // back-compat alias
    fitScore: fitScore,
    scoreToVerdict: scoreToVerdict,
    viscosityDecision: viscosityDecision,
    selectFamilies: selectFamilies,
  };
})();

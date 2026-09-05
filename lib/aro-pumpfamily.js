/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Automatic Pump Family Selection engine
   window.AROPUMPFAMILY

   Phase 2 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — following the same "one IIFE, one namespace"
   pattern as AROPUMPSTD / AROPUMPCURVE / AROVP, so it can be loaded and
   unit-tested in Node with nothing but `global.window = global`.

   PURPOSE
   Screens a duty point already established by the existing Pump
   Hydraulics workflow (flow, head, viscosity, NPSH margin — no new
   required inputs) against a seed database of pump families spanning
   centrifugal, positive-displacement-rotary, positive-displacement-
   reciprocating and special/service-specific categories, and returns a
   ranked, reasoned shortlist.

   WHAT THIS IS NOT
   - Not a vendor selection. The flow/head/viscosity envelopes below are
     order-of-magnitude screening ranges drawn from common pump-selection
     engineering guides, not a manufacturer's certified performance
     curve. Every result carries status "PREDICTED" for exactly this
     reason — see the `status` field on the return value.
   - Not exhaustive. This is a representative seed set (Phase 2). Later
     phases may extend FAMILIES without changing the scoring API.
   - Not a mechanical design. No geometry, no impeller sizing — that is
     Phase 3+.

   API
     AROPUMPFAMILY.FAMILIES                 — the family database (array)
     AROPUMPFAMILY.fitScore(value, [lo,hi]) — 0..1 continuous range fit
     AROPUMPFAMILY.scoreToVerdict(score)    — 'SUITABLE'|'CHECK'|'NOT RECOMMENDED'
     AROPUMPFAMILY.viscosityDecision(cSt)   — banding + guidance text
     AROPUMPFAMILY.selectFamilies(duty)     — the ranked shortlist
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Each range is expressed in the same units the rest of the Pump
  // Hydraulics module already uses throughout (m3/h, m of head, cSt) so
  // a single duty object plugs in directly from window.state.pump —
  // including for positive-displacement families, where "head" is used
  // as a head-equivalent of the pump's rated differential pressure
  // rather than a literal impeller head. That reuse is deliberate (one
  // process-condition entry, reused everywhere) and is called out in
  // the UI copy so it is never mistaken for vendor pressure ratings.
  var FAMILIES = [
    // ── Centrifugal ──────────────────────────────────────────────────
    { id: 'esc-oh2', name: 'End Suction Centrifugal (ANSI/ISO, OH2)', category: 'centrifugal', apiClass: 'OH2',
      flowRangeM3h: [5, 500], headRangeM: [5, 120], viscosityRangeCst: [1, 200], npshSensitivity: 'medium',
      note: 'General-purpose process duty; the default screening candidate for most water-like services.' },
    { id: 'bb-split', name: 'Axially/Radially Split Multistage (BB1/BB3)', category: 'centrifugal', apiClass: 'BB1/BB3',
      flowRangeM3h: [100, 5000], headRangeM: [20, 250], viscosityRangeCst: [1, 100], npshSensitivity: 'medium',
      note: 'High-flow process and pipeline duty beyond single-stage capability.' },
    { id: 'vs-multistage', name: 'Vertical In-Line Multistage (Ring-Section)', category: 'centrifugal', apiClass: 'VS4/VS5',
      flowRangeM3h: [1, 500], headRangeM: [50, 800], viscosityRangeCst: [1, 100], npshSensitivity: 'high',
      note: 'High head at moderate flow via staging; small footprint, but NPSHr climbs with stage speed.' },
    { id: 'vs-turbine-can', name: 'Vertical Turbine / Can Pump (VS1/VS6)', category: 'centrifugal', apiClass: 'VS1/VS6',
      flowRangeM3h: [20, 2000], headRangeM: [20, 300], viscosityRangeCst: [1, 50], npshSensitivity: 'low',
      note: 'Long submerged suction column tolerates a poor available NPSH better than any other centrifugal family.' },
    { id: 'regen-turbine', name: 'Regenerative Turbine Pump', category: 'centrifugal', apiClass: null,
      flowRangeM3h: [0.1, 20], headRangeM: [20, 250], viscosityRangeCst: [1, 20], npshSensitivity: 'high',
      note: 'Low flow, high head, clean thin liquids only — efficiency collapses with any solids or viscosity.' },

    // ── Positive displacement — rotary ───────────────────────────────
    { id: 'gear-external', name: 'External Gear Pump', category: 'pd-rotary', apiClass: null,
      flowRangeM3h: [0.1, 100], headRangeM: [20, 2000], viscosityRangeCst: [10, 200000], npshSensitivity: 'medium',
      note: 'Precise, self-priming, high pressure on viscous liquids; close clearances leak on thin fluids and wear on abrasives.' },
    { id: 'screw-twin', name: 'Twin/Triple Screw Pump', category: 'pd-rotary', apiClass: null,
      flowRangeM3h: [1, 1500], headRangeM: [10, 1500], viscosityRangeCst: [5, 1000000], npshSensitivity: 'medium',
      note: 'Very wide viscosity range, low pulsation, gentle on the fluid — the default heavy-viscosity high-flow candidate.' },
    { id: 'lobe-rotary', name: 'Rotary Lobe Pump', category: 'pd-rotary', apiClass: null,
      flowRangeM3h: [0.5, 500], headRangeM: [5, 150], viscosityRangeCst: [2, 100000], npshSensitivity: 'medium',
      hygienicCapable: true,
      note: 'CIP/SIP-capable, gentle non-shearing action; the standard hygienic/sanitary positive-displacement choice.' },
    { id: 'pc-pump', name: 'Progressive Cavity (PC) Pump', category: 'pd-rotary', apiClass: null,
      flowRangeM3h: [0.1, 500], headRangeM: [5, 200], viscosityRangeCst: [20, 1000000], npshSensitivity: 'medium',
      note: 'Handles high solids loading and shear-sensitive slurries at steady, low-pulsation flow.' },
    { id: 'vane-pump', name: 'Vane Pump', category: 'pd-rotary', apiClass: null,
      flowRangeM3h: [0.5, 200], headRangeM: [10, 200], viscosityRangeCst: [1, 500], npshSensitivity: 'medium',
      note: 'Thin, clean, lubricating liquids (fuels, solvents); vanes wear quickly on abrasive or dry-running service.' },

    // ── Positive displacement — reciprocating ────────────────────────
    { id: 'plunger-piston', name: 'Plunger / Piston Pump', category: 'pd-reciprocating', apiClass: null,
      flowRangeM3h: [0.01, 50], headRangeM: [100, 5000], viscosityRangeCst: [0.3, 2000], npshSensitivity: 'high',
      note: 'Very high pressure at low, precisely controllable flow. Pulsation dampening and overpressure protection are mandatory.' },
    { id: 'diaphragm-metering', name: 'Diaphragm Metering Pump', category: 'pd-reciprocating', apiClass: null,
      flowRangeM3h: [0.001, 5], headRangeM: [10, 2000], viscosityRangeCst: [0.3, 5000], npshSensitivity: 'high',
      note: 'Precision chemical dosing/injection; leak-free process-side diaphragm isolates the fluid from the drive.' },
    { id: 'aodd', name: 'Air-Operated Double Diaphragm (AODD)', category: 'pd-reciprocating', apiClass: null,
      flowRangeM3h: [0.5, 100], headRangeM: [3, 70], viscosityRangeCst: [1, 50000], npshSensitivity: 'low',
      note: 'Self-priming, dry-run tolerant, handles abrasives and entrained solids at modest head — utility/transfer duty.' },

    // ── Special / service-specific ────────────────────────────────────
    { id: 'slurry-heavy-duty', name: 'Heavy-Duty Slurry Centrifugal', category: 'special', apiClass: null,
      flowRangeM3h: [10, 2000], headRangeM: [5, 100], viscosityRangeCst: [1, 500], npshSensitivity: 'medium',
      note: 'Thick-walled, replaceable wet-end centrifugal for high-solids abrasive service.' },
    { id: 'hygienic-centrifugal', name: 'Hygienic Centrifugal (Sanitary)', category: 'special', apiClass: null,
      flowRangeM3h: [1, 300], headRangeM: [5, 100], viscosityRangeCst: [1, 500], npshSensitivity: 'medium',
      hygienicCapable: true,
      note: 'EHEDG/3-A-style crevice-free wetted parts for food/pharma CIP/SIP service.' },
    { id: 'mag-drive', name: 'Magnetic-Drive Sealless Centrifugal', category: 'special', apiClass: null,
      flowRangeM3h: [1, 500], headRangeM: [5, 150], viscosityRangeCst: [1, 200], npshSensitivity: 'medium',
      sealless: true,
      note: 'No mechanical seal — zero-leakage containment for hazardous or toxic fluids, at the cost of dry-run sensitivity.' },
    { id: 'submersible', name: 'Submersible Pump', category: 'special', apiClass: null,
      flowRangeM3h: [1, 1000], headRangeM: [5, 150], viscosityRangeCst: [1, 100], npshSensitivity: 'low',
      note: 'Fully flooded suction eliminates NPSH/priming concerns; sump, wastewater and wet-well service.' },
  ];

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

  /* ── selectFamilies: the ranked shortlist ──────────────────────────
     duty = { Q_m3h, H_m, viscosityCst, npshMarginM (optional) }
     Only fields the existing Pump Hydraulics workflow already produces
     — no new required input is introduced by this engine. */
  function selectFamilies(duty) {
    duty = duty || {};
    var Q = duty.Q_m3h, H = duty.H_m, visc = duty.viscosityCst;
    var npshMargin = (duty.npshMarginM == null) ? null : duty.npshMarginM;

    if (Q == null || !isFinite(Q) || H == null || !isFinite(H)) {
      return { ready: false, status: 'DATA REQUIRED',
        reason: 'Run the pump hydraulic calculation first — flow and head are not available yet.' };
    }

    var visco = viscosityDecision(visc);

    var ranked = FAMILIES.map(function (fam) {
      var reasons = [];
      var warnings = [];

      var flowFit = fitScore(Q, fam.flowRangeM3h);
      var headFit = fitScore(H, fam.headRangeM);
      var viscFit = fitScore(visc, fam.viscosityRangeCst);

      reasons.push(describeFit('flow', Q, fam.flowRangeM3h, 'm³/h'));
      reasons.push(describeFit('head', H, fam.headRangeM, 'm'));
      if (visc != null && isFinite(visc)) reasons.push(describeFit('viscosity', visc, fam.viscosityRangeCst, 'cSt'));

      var score = flowFit * 35 + headFit * 30 + viscFit * 25;

      // Hard engineering rule: centrifugal (impeller) pumps are not a
      // credible choice once viscosity is well beyond the correction's
      // useful range, regardless of how the flow/head numbers land.
      if (fam.category === 'centrifugal' && visc != null && isFinite(visc) && visc > 3000) {
        score = Math.min(score, 30);
        warnings.push('Centrifugal impeller efficiency collapses above ~3000 cSt (ANSI/HI 9.6.7 correction range exceeded) — not credible at this viscosity regardless of flow/head fit.');
      }

      // NPSH-sensitivity adjustment: only applied when a margin has
      // actually been calculated (never invents one).
      if (npshMargin != null && isFinite(npshMargin)) {
        if (npshMargin < 1) {
          if (fam.npshSensitivity === 'high') {
            score -= 10;
            warnings.push('Calculated NPSH margin is only ' + fmt(npshMargin) + ' m and this family\'s NPSHr tends to run high for its class — treat with caution.');
          } else if (fam.npshSensitivity === 'low') {
            score += 5;
            reasons.push('Calculated NPSH margin is tight (' + fmt(npshMargin) + ' m); this family\'s NPSH characteristics are usually the most tolerant of the options screened.');
          }
        }
      }

      score = Math.max(0, Math.min(100, score));

      return {
        id: fam.id, name: fam.name, category: fam.category, apiClass: fam.apiClass || null,
        flowRangeM3h: fam.flowRangeM3h, headRangeM: fam.headRangeM, viscosityRangeCst: fam.viscosityRangeCst,
        hygienicCapable: !!fam.hygienicCapable, sealless: !!fam.sealless,
        note: fam.note,
        score: Math.round(score * 10) / 10,
        verdict: scoreToVerdict(score),
        reasons: reasons, warnings: warnings,
      };
    }).sort(function (a, b) { return b.score - a.score; });

    return {
      ready: true, status: 'PREDICTED',
      duty: { Q_m3h: Q, H_m: H, viscosityCst: visc, npshMarginM: npshMargin },
      viscosity: visco,
      ranked: ranked,
      top: ranked[0],
      note: 'Screening shortlist from typical published pump-selection envelopes, not a vendor-certified curve. Confirm any candidate against a manufacturer\'s performance curve before purchase.',
    };
  }

  window.AROPUMPFAMILY = {
    FAMILIES: FAMILIES,
    fitScore: fitScore,
    scoreToVerdict: scoreToVerdict,
    viscosityDecision: viscosityDecision,
    selectFamilies: selectFamilies,
  };
})();

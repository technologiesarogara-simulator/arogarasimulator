/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Service-Specific Modes: Slurry / Hygienic
   window.AROPUMPSERVICE

   Phase 15 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Two small, independent screenings, each activating only when Phase
   2's top-ranked family calls for it:

     1. screenSlurryTransport() — a Durand-type minimum transport
        velocity check against the actual velocity the already-sized
        nozzle bore gives at the duty flow. Below the transport
        velocity, solids settle and the line plugs; well above it,
        erosive wear accelerates — both directions are flagged, not
        just the low side.
     2. screenHygienicMaterials() — FDA/3-A-grade material screening.
        A hygienic duty has a categorical requirement (crevice-free,
        cleanable, food/pharma-contact-rated construction) layered on
        top of the ordinary corrosivity ladder Phase 6 already uses —
        a material can be perfectly corrosion-resistant and still be
        wrong here if it isn't a hygienic-grade material or finish.
        CIP_SIP_CHECKLIST and the surface-finish reference are kept
        as plain informational lists — there is no numeric input in
        this app to check a "hygienic score" against, so this module
        does not invent one.

   WHAT THIS IS NOT
   - Not a wear-rate or corrosion-rate prediction. The Durand F_L
     factor is a typical published band by particle-size class, not a
     fitted vendor curve, and wear/settling verdicts are qualitative
     bands off the velocity ratio, not a mm/year erosion estimate.
   - Not a 3-A/EHEDG certification. The surface-finish figure and
     checklist are standard published reference points to design
     against, not a substitute for actual certification.

   API
     AROPUMPSERVICE.screenSlurryTransport(input)
     AROPUMPSERVICE.HYGIENIC_MATERIALS
     AROPUMPSERVICE.screenHygienicMaterials(input)
     AROPUMPSERVICE.CIP_SIP_CHECKLIST
     AROPUMPSERVICE.HYGIENIC_SURFACE_FINISH_NOTE
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CLASS_RANK = { mild: 1, moderate: 2, severe: 3 };
  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  function worse(a, b) { return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b; }
  var G = 9.81;

  // Durand-type F_L bands by particle-size class — published typical
  // ranges, not a fitted vendor chart. Fine particles are the hardest to
  // keep suspended (need more relative velocity), coarse ones settle at a
  // lower relative velocity but need more absolute energy to lift at all;
  // the mid-band value is the one long used as a screening default.
  var PARTICLE_FL_BANDS = [
    { maxMicron: 75, FL: 0.85, label: 'fine (<75 µm, e.g. silt)' },
    { maxMicron: 500, FL: 1.10, label: 'medium (75–500 µm, e.g. sand)' },
    { maxMicron: Infinity, FL: 1.30, label: 'coarse (>500 µm, e.g. gravel)' },
  ];

  /* ── screenSlurryTransport ────────────────────────────────────────
     input = { Q_m3h, pipeBore_mm, SG_solids, particleSizeMicron (optional) } */
  function screenSlurryTransport(input) {
    input = input || {};
    var Q = input.Q_m3h, boreMm = input.pipeBore_mm, SG = input.SG_solids;
    if (!isFinite(Q) || Q <= 0 || !isFinite(boreMm) || boreMm <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Flow and pipe bore are needed first — run the pump hydraulic calculation so the nozzle is sized.' };
    }
    if (!isFinite(SG) || SG <= 1) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Solids specific gravity (must be greater than 1) is needed to screen the transport velocity.' };
    }
    var particleAssumed = !isFinite(input.particleSizeMicron) || input.particleSizeMicron <= 0;
    var particleSizeMicron = particleAssumed ? 150 : input.particleSizeMicron;
    var band = PARTICLE_FL_BANDS.filter(function (b) { return particleSizeMicron <= b.maxMicron; })[0];

    var D_m = boreMm / 1000;
    var area_m2 = (Math.PI / 4) * D_m * D_m;
    var vActual_ms = (Q / 3600) / area_m2;
    var vCritical_ms = band.FL * Math.sqrt(2 * G * D_m * (SG - 1));
    var ratio = vActual_ms / vCritical_ms;

    var verdict, message;
    if (ratio < 1.0) {
      verdict = 'NOT RECOMMENDED';
      message = 'Actual velocity is below the estimated critical transport velocity — solids will settle, especially at low points and low-flow upsets, risking a plugged line.';
    } else if (ratio < 1.3) {
      verdict = 'CHECK';
      message = 'Actual velocity is only marginally above the estimated critical transport velocity — little margin for a turndown or low-flow upset before solids start to settle.';
    } else if (ratio <= 2.0) {
      verdict = 'SUITABLE';
      message = 'Actual velocity comfortably exceeds the estimated critical transport velocity without being excessive — a reasonable balance of transport margin and erosive wear.';
    } else {
      verdict = 'CHECK';
      message = 'Actual velocity is well above the estimated critical transport velocity — solids stay suspended, but erosive wear on the casing/impeller/piping accelerates sharply with velocity.';
    }

    return {
      applicable: true, status: 'PREDICTED', verdict: verdict, message: message,
      vActual_ms: vActual_ms, vCritical_ms: vCritical_ms, ratio: ratio,
      particleSizeMicron: particleSizeMicron, particleAssumed: particleAssumed, particleLabel: band.label, FL: band.FL,
      assumptions: [
        'Critical transport velocity from a Durand-type correlation, Vc = F_L·√(2·g·D·(SG_solids−1)), with F_L a typical published band by particle-size class (' + band.label + ' → F_L=' + band.FL + ')' + (particleAssumed ? ', particle size assumed at 150 µm (typical fine sand) since none was entered' : '') + '.',
        'A screening estimate, not a site-specific slurry test loop result — real F_L also depends on concentration and particle-size distribution this model does not have as input.',
      ],
    };
  }

  // Hygienic-grade material library. hygienicGrade=true means the surface
  // and alloy are the kind actually specified for CIP/SIP food/pharma
  // contact (crevice-free polish achievable, no zinc/cadmium/lead), not
  // merely "stainless" — 316/316L is, a generic carbon steel or bronze
  // fitting is not, regardless of how corrosion-resistant it otherwise is.
  var HYGIENIC_MATERIALS = [
    { id: '316l-hygienic', name: '316L Stainless Steel (hygienic-polished)', hygienicGrade: true, corrosivityTolerance: 'moderate', maxTempC: 150,
      note: 'The standard hygienic wetted-part material — electropolished to a crevice-free finish.' },
    { id: 'duplex-hygienic', name: 'Duplex Stainless Steel (hygienic-polished)', hygienicGrade: true, corrosivityTolerance: 'severe', maxTempC: 150,
      note: 'Used where 316L\'s corrosion resistance is not enough (e.g. higher-chloride CIP chemistry), still finished to a hygienic standard.' },
    { id: 'ptfe-hygienic', name: 'PTFE (FDA/USP Class VI grade)', hygienicGrade: true, corrosivityTolerance: 'severe', maxTempC: 200,
      note: 'For seals/gaskets in hygienic service — confirm the specific compound carries FDA and USP Class VI certification.' },
    { id: 'epdm-hygienic', name: 'EPDM (FDA/USP Class VI grade)', hygienicGrade: true, corrosivityTolerance: 'moderate', maxTempC: 150,
      note: 'The common hygienic elastomer for CIP/SIP steam service — confirm the specific compound carries FDA and USP Class VI certification.' },
    { id: 'carbon-steel', name: 'Carbon Steel (non-hygienic)', hygienicGrade: false, corrosivityTolerance: 'moderate', maxTempC: 425,
      note: 'Not a hygienic material regardless of corrosion resistance — cannot be finished crevice-free or certified for product contact.' },
    { id: 'cast-iron', name: 'Cast Iron (non-hygienic)', hygienicGrade: false, corrosivityTolerance: 'mild', maxTempC: 230,
      note: 'Porous, cannot be cleaned to a hygienic standard, and is not a food/pharma-contact material.' },
    { id: 'bronze', name: 'Bronze (non-hygienic)', hygienicGrade: false, corrosivityTolerance: 'moderate', maxTempC: 200,
      note: 'Copper-alloy wetted parts are not specified for hygienic product contact.' },
  ];

  function evaluateHygienicMaterial(material, ctx) {
    var reasons = [];
    var warnings = [];
    var verdict = 'SUITABLE';

    if (!material.hygienicGrade) {
      verdict = 'NOT RECOMMENDED';
      reasons.push('Not a hygienic-grade material — a hygienic duty needs crevice-free, cleanable, product-contact-rated construction regardless of how corrosion-resistant this material otherwise is.');
    } else {
      var fluidRank = CLASS_RANK[ctx.corrosivityClass];
      var matRank = CLASS_RANK[material.corrosivityTolerance];
      if (fluidRank > matRank) {
        verdict = worse(verdict, 'NOT RECOMMENDED');
        reasons.push('Fluid corrosivity (' + ctx.corrosivityClass + ') exceeds this material\'s typical tolerance (' + material.corrosivityTolerance + ').');
      } else {
        reasons.push('Fluid corrosivity (' + ctx.corrosivityClass + ') is within this material\'s typical tolerance (' + material.corrosivityTolerance + ') and it is a recognised hygienic-grade material.');
      }
    }

    if (ctx.tempC > material.maxTempC) {
      verdict = worse(verdict, 'NOT RECOMMENDED');
      reasons.push('Operating temperature ' + ctx.tempC.toFixed(0) + '°C exceeds this material\'s ' + material.maxTempC + '°C limit.');
    } else if (ctx.tempC > 0.9 * material.maxTempC) {
      verdict = worse(verdict, 'CHECK');
      warnings.push('Operating temperature ' + ctx.tempC.toFixed(0) + '°C is close to this material\'s ' + material.maxTempC + '°C limit — SIP steam cycles run hotter than the process fluid; check against the actual sterilisation temperature too.');
    }

    return { id: material.id, name: material.name, verdict: verdict, reasons: reasons, warnings: warnings, note: material.note, hygienicGrade: material.hygienicGrade };
  }

  function screenHygienicMaterials(input) {
    input = input || {};
    var corrosivityClass = input.corrosivityClass, tempC = input.tempC;
    if (!corrosivityClass) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Fluid corrosivity classification is not available — select a listed service fluid.' };
    }
    if (!isFinite(tempC)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Operating temperature is needed — run the pump hydraulic calculation first.' };
    }
    var ctx = { corrosivityClass: corrosivityClass, tempC: tempC };
    var ranked = HYGIENIC_MATERIALS.map(function (m) { return evaluateHygienicMaterial(m, ctx); })
      .sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.name.localeCompare(b.name); });
    return { applicable: true, status: 'PREDICTED', corrosivityClass: corrosivityClass, tempC: tempC, ranked: ranked, top: ranked[0] };
  }

  var CIP_SIP_CHECKLIST = [
    'Crevice-free wetted-part design — no threaded connections, gaskets set flush, minimal dead-leg piping.',
    'Self-draining orientation with no low points that a CIP/SIP cycle cannot sweep.',
    'Tri-clamp or other hygienic (not threaded/flanged-gasketed) process connections.',
    'FDA/USP Class VI-certified elastomers on every wetted secondary seal.',
    '3-A Sanitary Standards or EHEDG certification for the pump itself, not just its materials.',
  ];
  var HYGIENIC_SURFACE_FINISH_NOTE = 'Typical 3-A/EHEDG practice calls for internal wetted surfaces at Ra ≤ 0.8 µm (32 µin) — a reference to design and specify against, not something this calculation measures.';

  window.AROPUMPSERVICE = {
    screenSlurryTransport: screenSlurryTransport,
    HYGIENIC_MATERIALS: HYGIENIC_MATERIALS,
    screenHygienicMaterials: screenHygienicMaterials,
    CIP_SIP_CHECKLIST: CIP_SIP_CHECKLIST,
    HYGIENIC_SURFACE_FINISH_NOTE: HYGIENIC_SURFACE_FINISH_NOTE,
  };
})();

/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Centrifugal Pump Configuration engine
   window.AROPUMPCONFIG

   Phase 3 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   AROPUMPSTD / AROPUMPCURVE / AROVP / AROPUMPFAMILY, loadable and
   unit-testable in Node with nothing but `global.window = global`.

   PURPOSE
   Takes the family Phase 2 (AROPUMPFAMILY) already picked — a category
   like "End Suction Centrifugal" — and, when that family is centrifugal,
   narrows it to a specific API 610 construction class (OH1-6, BB1-5,
   VS1-7) with its typical mechanical construction attributes (mounting,
   casing split, bearing frame, coupling type, baseplate style).

   WHAT THIS IS NOT
   - Not a mechanical design. No shaft sizing, no bearing L10 life, no
     seal selection — those are later phases. This engine only narrows
     *which construction class* is being discussed.
   - Not vendor-specific. The construction attributes are the class
     definitions API 610 itself uses, not one manufacturer's catalogue.
   - Deliberately declines to run for anything that is not a centrifugal
     family — a gear pump does not have an API 610 OH/BB/VS class.

   This module does not depend on AROPUMPFAMILY at load time (no script
   order requirement, and it stays independently unit-testable) — the
   caller passes the family id and category it already has from Phase 2.

   API
     AROPUMPCONFIG.API_CLASSES              — the construction-class database
     AROPUMPCONFIG.scoreToVerdict(score)    — 'SUITABLE'|'CHECK'|'NOT RECOMMENDED'
     AROPUMPCONFIG.configure(input)         — the ranked construction-class shortlist
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Ranges are head-equivalent m and m3/h, matching the rest of the
  // Pump Hydraulics module. compatibleFamilyIds lists which AROPUMPFAMILY
  // family ids (Phase 2) typically map to this construction class — the
  // engineering correspondence a real selection would draw, not an
  // arbitrary tag.
  var API_CLASSES = [
    // ── OH — Overhung impeller ───────────────────────────────────────
    { id: 'OH1', name: 'Foot-Mounted, Flexibly Coupled', mounting: 'horizontal, foot-mounted casing',
      casingSplit: 'n/a (overhung, single volute)', bearingFrame: 'separate bearing housing', couplingType: 'flexible',
      baseplateStyle: 'common fabricated baseplate', stageType: 'single', orientation: 'horizontal',
      flowRangeM3h: [5, 350], headRangeM: [5, 90], compatibleFamilyIds: ['esc-oh2'],
      note: 'General utility duty; the lightest-frame OH class.' },
    { id: 'OH2', name: 'Centerline-Mounted, Flexibly Coupled', mounting: 'horizontal, centerline-mounted casing',
      casingSplit: 'n/a (overhung, single volute)', bearingFrame: 'separate bearing housing', couplingType: 'flexible',
      baseplateStyle: 'common fabricated baseplate', stageType: 'single', orientation: 'horizontal',
      flowRangeM3h: [5, 500], headRangeM: [5, 120], compatibleFamilyIds: ['esc-oh2'],
      note: 'Centerline support accommodates thermal casing growth — the default API process class for end-suction service.' },
    { id: 'OH3', name: 'Vertically Mounted, In-Line, Flexibly Coupled', mounting: 'vertical in-line, pipe-supported',
      casingSplit: 'n/a (overhung, single volute)', bearingFrame: 'separate bearing housing', couplingType: 'flexible with spacer',
      baseplateStyle: 'none — pipe-mounted', stageType: 'single', orientation: 'vertical',
      flowRangeM3h: [5, 300], headRangeM: [5, 100], compatibleFamilyIds: ['esc-oh2'],
      note: 'Drops into a pipe run without a baseplate footprint — space-constrained process piping.' },
    { id: 'OH4', name: 'Rigidly Coupled, In-Line', mounting: 'vertical in-line, pipe-supported',
      casingSplit: 'n/a (overhung, single volute)', bearingFrame: 'integral with driver', couplingType: 'rigid',
      baseplateStyle: 'none — pipe-mounted', stageType: 'single', orientation: 'vertical',
      flowRangeM3h: [5, 200], headRangeM: [5, 80], compatibleFamilyIds: ['esc-oh2'],
      note: 'Lighter utility variant of OH3 with a rigid rather than flexible coupling.' },
    { id: 'OH5', name: 'Close-Coupled, Motor Shaft-Mounted', mounting: 'horizontal or vertical, motor-mounted',
      casingSplit: 'n/a (overhung, single volute)', bearingFrame: 'none — impeller on motor shaft extension', couplingType: 'none (close-coupled)',
      baseplateStyle: 'motor-integral or small skid', stageType: 'single', orientation: 'horizontal',
      flowRangeM3h: [1, 100], headRangeM: [5, 60], compatibleFamilyIds: ['esc-oh2'],
      note: 'No separate bearing frame or coupling — smallest footprint, small utility/transfer duty.' },
    { id: 'OH6', name: 'Vertical High-Speed, Integral Gear', mounting: 'vertical, gearbox-mounted',
      casingSplit: 'n/a (overhung, single volute)', bearingFrame: 'integral with speed-increasing gearbox', couplingType: 'rigid to gearbox',
      baseplateStyle: 'common fabricated baseplate', stageType: 'single', orientation: 'vertical',
      flowRangeM3h: [1, 50], headRangeM: [200, 1500], compatibleFamilyIds: [],
      note: 'Speed-increasing gear reaches high head at low flow from a standard-speed driver — a specialty class.' },

    // ── BB — Between bearings ────────────────────────────────────────
    { id: 'BB1', name: 'Axially Split, Single-Stage, Between Bearings', mounting: 'horizontal, between-bearings',
      casingSplit: 'axially split', bearingFrame: 'between-bearings, both ends supported', couplingType: 'flexible',
      baseplateStyle: 'common fabricated baseplate', stageType: 'single', orientation: 'horizontal',
      flowRangeM3h: [100, 3000], headRangeM: [20, 150], compatibleFamilyIds: ['bb-split'],
      note: 'Large flow beyond overhung capability; axially split casing simplifies maintenance access.' },
    { id: 'BB2', name: 'Radially Split, Single-Stage, Between Bearings', mounting: 'horizontal, between-bearings',
      casingSplit: 'radially split', bearingFrame: 'between-bearings, both ends supported', couplingType: 'flexible',
      baseplateStyle: 'common fabricated baseplate', stageType: 'single', orientation: 'horizontal',
      flowRangeM3h: [50, 2000], headRangeM: [30, 250], compatibleFamilyIds: ['bb-split'],
      note: 'Radial split holds pressure better than an axial joint — higher-pressure single-stage process duty.' },
    { id: 'BB3', name: 'Axially Split, Multistage, Between Bearings', mounting: 'horizontal, between-bearings',
      casingSplit: 'axially split', bearingFrame: 'between-bearings, both ends supported', couplingType: 'flexible',
      baseplateStyle: 'common fabricated baseplate', stageType: 'multistage', orientation: 'horizontal',
      flowRangeM3h: [50, 2000], headRangeM: [100, 1000], compatibleFamilyIds: ['bb-split', 'vs-multistage'],
      note: 'Staged impellers in an axially split casing for high head at moderate-to-large flow.' },
    { id: 'BB4', name: 'Radially Split, Multistage, Ring-Section, Between Bearings', mounting: 'horizontal, between-bearings',
      casingSplit: 'radially split (ring-section)', bearingFrame: 'between-bearings, both ends supported', couplingType: 'flexible',
      baseplateStyle: 'common fabricated baseplate', stageType: 'multistage', orientation: 'horizontal',
      flowRangeM3h: [20, 1000], headRangeM: [150, 2000], compatibleFamilyIds: ['vs-multistage'],
      note: 'Ring-section radial joints tolerate higher pressure than an axial split — boiler feed and high-pressure transfer.' },
    { id: 'BB5', name: 'Radially Split, Multistage, Double-Casing (Barrel), Between Bearings', mounting: 'horizontal, between-bearings',
      casingSplit: 'radially split, double casing (barrel)', bearingFrame: 'between-bearings, both ends supported', couplingType: 'flexible',
      baseplateStyle: 'heavy fabricated baseplate', stageType: 'multistage', orientation: 'horizontal',
      flowRangeM3h: [20, 1000], headRangeM: [300, 3500], compatibleFamilyIds: ['vs-multistage'],
      note: 'An outer barrel contains the inner casing joint entirely — the class for the most extreme pressures.' },

    // ── VS — Vertically suspended ────────────────────────────────────
    { id: 'VS1', name: 'Vertically Suspended, Single Casing, Diffuser (Wet Pit)', mounting: 'vertical, wet-pit/sump-mounted',
      casingSplit: 'n/a (bowl assembly)', bearingFrame: 'line-shaft bearings in the column', couplingType: 'rigid line-shaft',
      baseplateStyle: 'discharge head / sole plate', stageType: 'multistage', orientation: 'vertical',
      flowRangeM3h: [50, 5000], headRangeM: [10, 150], compatibleFamilyIds: ['vs-turbine-can'],
      note: 'Diffuser bowls stacked on a line shaft in a wet pit — deep-well and intake service.' },
    { id: 'VS2', name: 'Vertically Suspended, Single Casing, Volute (Wet Pit)', mounting: 'vertical, wet-pit/sump-mounted',
      casingSplit: 'n/a (volute)', bearingFrame: 'line-shaft bearings in the column', couplingType: 'rigid line-shaft',
      baseplateStyle: 'discharge head / sole plate', stageType: 'single', orientation: 'vertical',
      flowRangeM3h: [20, 3000], headRangeM: [10, 120], compatibleFamilyIds: ['vs-turbine-can'],
      note: 'Volute rather than diffuser bowls — wet-pit circulating/process duty.' },
    { id: 'VS3', name: 'Vertically Suspended, Single Casing, Axial/Mixed Flow (Wet Pit)', mounting: 'vertical, wet-pit/sump-mounted',
      casingSplit: 'n/a (propeller bowl)', bearingFrame: 'line-shaft bearings in the column', couplingType: 'rigid line-shaft',
      baseplateStyle: 'discharge head / sole plate', stageType: 'single', orientation: 'vertical',
      flowRangeM3h: [500, 20000], headRangeM: [2, 20], compatibleFamilyIds: [],
      note: 'Propeller-type impeller for very high flow at very low head — large circulating-water service.' },
    { id: 'VS4', name: 'Vertically Suspended, Line-Shaft, Sump-Mounted', mounting: 'vertical, sump-mounted',
      casingSplit: 'n/a', bearingFrame: 'line-shaft bearings, driver mounted above grade', couplingType: 'rigid line-shaft',
      baseplateStyle: 'sump cover plate', stageType: 'single', orientation: 'vertical',
      flowRangeM3h: [10, 1000], headRangeM: [5, 100], compatibleFamilyIds: ['submersible'],
      note: 'Driver stays above grade with the shaft running down into the sump — serviceable without pulling a wet motor.' },
    { id: 'VS5', name: 'Vertically Suspended, Can-Type (Barrel)', mounting: 'vertical, can/barrel-mounted',
      casingSplit: 'n/a (can-mounted bowl assembly)', bearingFrame: 'line-shaft bearings in the column', couplingType: 'rigid line-shaft',
      baseplateStyle: 'can flange / sole plate', stageType: 'multistage', orientation: 'vertical',
      flowRangeM3h: [20, 2000], headRangeM: [20, 300], compatibleFamilyIds: ['vs-turbine-can'],
      note: 'The can lowers the first-stage impeller below grade to raise the available NPSH — the class for tight-NPSH services.' },
    { id: 'VS6', name: 'Vertically Suspended, Double Casing, Diffuser, Submerged Motor', mounting: 'vertical, fully submersible',
      casingSplit: 'double casing', bearingFrame: 'sealed submersible bearings', couplingType: 'none (wet submerged motor)',
      baseplateStyle: 'none — freestanding submerged', stageType: 'multistage', orientation: 'vertical',
      flowRangeM3h: [20, 2000], headRangeM: [20, 300], compatibleFamilyIds: ['submersible'],
      note: 'No line shaft at all — the motor itself is submerged; deep-well and borehole service.' },
    { id: 'VS7', name: 'Vertically Suspended, Double Casing, Volute, Submerged Motor', mounting: 'vertical, fully submersible',
      casingSplit: 'double casing', bearingFrame: 'sealed submersible bearings', couplingType: 'none (wet submerged motor)',
      baseplateStyle: 'none — freestanding submerged', stageType: 'single', orientation: 'vertical',
      flowRangeM3h: [10, 1000], headRangeM: [10, 150], compatibleFamilyIds: ['submersible'],
      note: 'Volute submersible variant of VS6 — sump and wastewater process duty.' },
  ];

  function fitScore(value, range) {
    if (value == null || !isFinite(value)) return 0.5;
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
      return 'Duty ' + label + ' ' + fmt(value) + ' ' + unit + ' sits within the class\'s typical ' + fmt(lo) + '–' + fmt(hi) + ' ' + unit + ' band.';
    }
    if (value < lo) return 'Duty ' + label + ' ' + fmt(value) + ' ' + unit + ' is below the class\'s typical ' + fmt(lo) + '–' + fmt(hi) + ' ' + unit + ' band.';
    return 'Duty ' + label + ' ' + fmt(value) + ' ' + unit + ' is above the class\'s typical ' + fmt(lo) + '–' + fmt(hi) + ' ' + unit + ' band.';
  }

  /* ── configure: the ranked API 610 construction-class shortlist ────
     input = { familyId, category, Q_m3h, H_m, stages (default 1), npshMarginM (optional) }
     `familyId`/`category` are exactly what AROPUMPFAMILY.selectFamilies()
     already returned on `top` (or whichever entry the engineer picked) —
     this module never re-derives them. */
  function configure(input) {
    input = input || {};
    var category = input.category;
    var familyId = input.familyId;
    var Q = input.Q_m3h, H = input.H_m;
    var stages = (input.stages == null || !isFinite(input.stages) || input.stages < 1) ? 1 : input.stages;

    if (category !== 'centrifugal') {
      return { applicable: false, status: 'NOT APPLICABLE',
        reason: 'Automatic API 610 construction-class configuration only applies to centrifugal families; the family in hand is ' + (category || 'unknown') + '.' };
    }
    if (Q == null || !isFinite(Q) || H == null || !isFinite(H)) {
      return { applicable: false, status: 'DATA REQUIRED',
        reason: 'Run the pump hydraulic calculation first — flow and head are not available yet.' };
    }

    var wantMultistage = stages > 1;
    var candidates = API_CLASSES.filter(function (c) { return c.compatibleFamilyIds.indexOf(familyId) !== -1; });
    var usedFallback = candidates.length === 0;
    if (usedFallback) candidates = API_CLASSES.slice();

    var ranked = candidates.map(function (c) {
      var reasons = [];
      var flowFit = fitScore(Q, c.flowRangeM3h);
      var headFit = fitScore(H, c.headRangeM);
      var stageMatch = (wantMultistage === (c.stageType === 'multistage'));
      var stageFit = stageMatch ? 1 : 0.3;

      reasons.push(describeFit('flow', Q, c.flowRangeM3h, 'm³/h'));
      reasons.push(describeFit('head', H, c.headRangeM, 'm'));
      reasons.push(stageMatch
        ? 'Stage count (' + stages + ') matches this class\'s ' + c.stageType + ' construction.'
        : 'Stage count (' + stages + ') does not match this class\'s ' + c.stageType + ' construction.');

      var score = flowFit * 45 + headFit * 35 + stageFit * 20;
      score = Math.max(0, Math.min(100, score));

      return {
        id: c.id, name: c.name, mounting: c.mounting, casingSplit: c.casingSplit,
        bearingFrame: c.bearingFrame, couplingType: c.couplingType, baseplateStyle: c.baseplateStyle,
        stageType: c.stageType, orientation: c.orientation,
        flowRangeM3h: c.flowRangeM3h, headRangeM: c.headRangeM, note: c.note,
        score: Math.round(score * 10) / 10, verdict: scoreToVerdict(score), reasons: reasons,
      };
    }).sort(function (a, b) { return b.score - a.score; });

    return {
      applicable: true, status: 'PREDICTED', usedFallback: usedFallback, familyId: familyId,
      duty: { Q_m3h: Q, H_m: H, stages: stages },
      ranked: ranked, top: ranked[0],
      note: usedFallback
        ? 'No construction class is directly associated with this family in the seed mapping — every API 610 class was screened on flow/head/stage fit alone.'
        : 'Screened against the construction classes typically associated with this family, then ranked by flow/head/stage fit.',
    };
  }

  window.AROPUMPCONFIG = {
    API_CLASSES: API_CLASSES,
    scoreToVerdict: scoreToVerdict,
    configure: configure,
  };
})();

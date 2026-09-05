/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Mechanical Seal Selection engine
   window.AROPUMPSEAL

   Phase 9 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Two related screenings, both driven by the fluid the engineer already
   selected and the operating temperature the existing calculation
   already produces — no new required input:
     1. selectSealPlan(): an API 682-style piping-plan recommendation
        (Plans 11/13/21/23/32/52/53A), following the same hazard- and
        temperature-driven decision tree API 682 itself is structured
        as, rather than a generic weighted score.
     2. screenSealFaces() / screenSecondarySeals(): a material-tolerance
        screening for the seal faces and the elastomer, in the same
        SUITABLE/CHECK/NOT RECOMMENDED/DATA REQUIRED style as Phase 6's
        material-of-construction engine (this module keeps its own
        small hazard/material tables rather than depending on
        AROPUMPMOC at load time — the corrosivity class it needs is
        passed in as a plain parameter, so both stay independently
        loadable and testable).

   WHAT THIS IS NOT
   - Not an API 682 substitute. The real standard's own selection
     flowchart weighs site practice, fugitive-emission regulations and
     process criticality that this screening tool has no input for —
     every result is explicitly PRELIMINARY ASSUMPTION / CHECK where
     judgement genuinely varies (e.g. a single seal on flammable
     service is common practice in many plants and prohibited in
     others; this engine flags it for review rather than picking a
     side).
   - Not a vendor seal selection. Face/elastomer material limits are
     typical published chemical-compatibility behaviour, not a
     specific manufacturer's data sheet.

   API
     AROPUMPSEAL.FLUID_SEAL_HAZARD
     AROPUMPSEAL.SEAL_PLANS
     AROPUMPSEAL.FACE_MATERIALS / ELASTOMER_MATERIALS
     AROPUMPSEAL.selectSealPlan(input)
     AROPUMPSEAL.screenSealFaces(input)
     AROPUMPSEAL.screenSecondarySeals(input)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CLASS_RANK = { mild: 1, moderate: 2, severe: 3 };
  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  function worse(a, b) { return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b; }

  // Hazard classification for API 682 plan selection — keyed the same as
  // the Pump Hydraulics module's own fluid list (and AROPUMPMOC's), but
  // this is a seal-specific tag (containment need), not a corrosivity
  // class, so it lives in its own small table here.
  var FLUID_SEAL_HAZARD = {
    water: 'benign', condensate: 'benign', glycol: 'benign', brine: 'benign',
    diesel: 'flammable', ethanol: 'flammable', methanol: 'flammable', toluene: 'flammable',
    acetone: 'flammable', light_hc: 'flammable', heavy_hc: 'flammable', crude_oil: 'flammable',
    ammonia: 'toxic',
    caustic_50: 'toxic-corrosive', sulfuric_acid: 'toxic-corrosive', hydrochloric_acid: 'toxic-corrosive',
  };

  var SEAL_PLANS = [
    { id: '11', name: 'Plan 11 — Discharge Recirculation', category: 'single',
      note: 'Recirculates discharge fluid back to the seal chamber through a restriction orifice — the baseline single-seal plan for clean, moderate-temperature service.' },
    { id: '13', name: 'Plan 13 — Seal Chamber to Suction', category: 'single',
      note: 'Routes seal-chamber flow back to suction instead of drawing from discharge — the standard variant for vertical pumps that need continuous chamber venting.' },
    { id: '21', name: 'Plan 21 — Cooled Discharge Recirculation', category: 'single',
      note: 'Plan 11 with a cooler in the recirculation line, extending the usable temperature range without an independent loop.' },
    { id: '23', name: 'Plan 23 — Recirculating Cooled Loop', category: 'single',
      note: 'A closed loop with its own pumping ring and cooler, independent of process pressure — the standard choice for the hottest single-seal services (e.g. boiler feedwater).' },
    { id: '32', name: 'Plan 32 — External Clean Flush', category: 'single',
      note: 'Injects a clean external fluid into the seal chamber — needed whenever the pumped fluid itself is not clean enough to run across the seal faces.' },
    { id: '52', name: 'Plan 52 — Dual Seal, Unpressurized Buffer', category: 'dual-unpressurized',
      note: 'A buffer fluid at less than process pressure between two seals — containment and leak detection without a fully pressurized barrier system.' },
    { id: '53A', name: 'Plan 53A — Dual Seal, Pressurized Barrier', category: 'dual-pressurized',
      note: 'A barrier fluid kept above process pressure — any leakage path runs barrier fluid into the process, not process fluid to atmosphere. The plan for zero-leakage/most-hazardous duty.' },
  ];

  /* ── selectSealPlan: the API 682-style decision tree ────────────────
     input = { fluidKey, tempC, npshMarginM (optional), orientation
     (optional 'horizontal'|'vertical'), dirtyService (optional bool) } */
  function selectSealPlan(input) {
    input = input || {};
    var fluidKey = input.fluidKey, tempC = input.tempC;
    var hazard = FLUID_SEAL_HAZARD[fluidKey];

    if (!fluidKey || !hazard) {
      return { applicable: false, status: 'DATA REQUIRED',
        reason: 'This fluid ("' + (fluidKey || 'not selected') + '") has no seal-hazard classification — select a listed service fluid, or choose a seal plan manually.' };
    }
    if (!isFinite(tempC)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Operating temperature is needed to screen seal plans — run the pump hydraulic calculation first.' };
    }

    var ranked = SEAL_PLANS.map(function (plan) {
      var reasons = [];
      var warnings = [];
      var verdict = 'SUITABLE';

      if (input.dirtyService) {
        if (plan.id === '32') {
          reasons.push('Recommended whenever the pumped fluid is not clean enough to run across the seal faces directly.');
        } else {
          verdict = worse(verdict, 'CHECK');
          warnings.push('Solids in the pumped fluid can damage the seal faces without an external clean flush (Plan 32) — this plan alone is not usually sufficient for dirty service.');
        }
      }

      if (hazard === 'toxic-corrosive') {
        if (plan.id === '53A') reasons.push('Pressurized barrier gives zero product leakage to atmosphere — the standard choice for a toxic, corrosive fluid.');
        else if (plan.id === '52') { verdict = worse(verdict, 'CHECK'); warnings.push('An unpressurized buffer still allows a small process leak into the buffer fluid — confirm this is acceptable for a toxic/corrosive duty before choosing this over Plan 53A.'); }
        else { verdict = worse(verdict, 'NOT RECOMMENDED'); warnings.push('A single seal leaks process fluid to atmosphere on failure — not acceptable for a toxic, corrosive fluid.'); }
      } else if (hazard === 'toxic') {
        if (plan.id === '52') reasons.push('An unpressurized dual seal with buffer/leak detection is standard practice for a toxic fluid.');
        else if (plan.id === '53A') { verdict = worse(verdict, 'CHECK'); reasons.push('Also suitable, and gives zero product leakage — check whether your site or regulations require this over Plan 52.'); }
        else { verdict = worse(verdict, 'NOT RECOMMENDED'); warnings.push('A single seal leaks process fluid to atmosphere on failure — review before using on a toxic fluid.'); }
      } else if (hazard === 'flammable') {
        if (plan.id === '52') reasons.push('Common practice for flammable hydrocarbon service, containing any leakage rather than releasing it to atmosphere.');
        else if (plan.id === '53A') { warnings.push('Available, but often over-specified for ordinary flammable hydrocarbon duty — Plan 52 is the more common choice.'); }
        else if (plan.category === 'single') { verdict = worse(verdict, 'CHECK'); warnings.push('Single seals are widely used on flammable service too — confirm against your site\'s fugitive-emission practice and HAZOP before ruling this in or out.'); }
      }

      // Temperature banding only meaningfully distinguishes the single-seal plans.
      if (plan.category === 'single') {
        if (tempC <= 150) {
          if (plan.id === '23') { verdict = worse(verdict, 'CHECK'); warnings.push('An independent cooled loop is usually reserved for hotter service than this — likely over-specified here.'); }
          else if (plan.id === '32' && !input.dirtyService) { verdict = worse(verdict, 'NOT RECOMMENDED'); warnings.push('An external flush is for a dirty or unsuitable process fluid, not a temperature driver — not indicated here.'); }
        } else if (tempC <= 220) {
          if (plan.id === '11' || plan.id === '13') { verdict = worse(verdict, 'NOT RECOMMENDED'); warnings.push('Operating temperature ' + tempC.toFixed(0) + '°C is above the typical uncooled-recirculation limit (~150°C).'); }
          else if (plan.id === '21') reasons.push('A cooler in the recirculation line handles this temperature range without a fully independent loop.');
        } else {
          if (plan.id === '11' || plan.id === '13' || plan.id === '21') { verdict = worse(verdict, 'NOT RECOMMENDED'); warnings.push('Operating temperature ' + tempC.toFixed(0) + '°C is above what a recirculation-line cooler can reliably manage — the process-side flush is still drawn from the hot fluid itself.'); }
          else if (plan.id === '23') reasons.push('An independent, fully cooled loop is the standard choice at this temperature.');
        }
      }

      if (input.orientation === 'vertical' && plan.id === '13') {
        reasons.push('Plan 13\'s suction-side routing is the standard choice for a vertical pump\'s continuous seal-chamber venting.');
      }
      if (input.orientation === 'vertical' && plan.id === '11') {
        warnings.push('A vertical pump usually wants Plan 13 (venting to suction) over Plan 11 (recirculation from discharge) for this reason alone.');
      }

      return { id: plan.id, name: plan.name, category: plan.category, verdict: verdict, reasons: reasons, warnings: warnings, note: plan.note };
    }).sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]; });

    var quenchRecommended = (fluidKey === 'caustic_50');
    var flashingWarning = null;
    if (isFinite(input.npshMarginM) && input.npshMarginM < 1) {
      flashingWarning = 'NPSH margin is tight (' + input.npshMarginM.toFixed(1) + ' m) — this raises the risk of the fluid flashing at the seal faces regardless of which plan is chosen; a throat bushing or an external clean quench (Plan 62) is worth reviewing alongside the plan above.';
    }

    return {
      applicable: true, status: 'PREDICTED', fluidKey: fluidKey, hazard: hazard, tempC: tempC,
      ranked: ranked, top: ranked[0],
      quenchRecommended: quenchRecommended,
      quenchReason: quenchRecommended ? 'Caustic solution can crystallize on the atmospheric side as it cools and dries — an external quench (Plan 62) keeps the seal from hanging up.' : null,
      flashingWarning: flashingWarning,
    };
  }

  // ── Face and secondary (elastomer) seal material screening ──────────
  // Same evaluation shape as Phase 6's material screening: corrosivity
  // tolerance ladder + known hard incompatibilities + temperature limit.
  var FACE_MATERIALS = [
    { id: 'carbon-vs-ceramic', name: 'Carbon-Graphite vs Ceramic (Al₂O₃)', corrosivityTolerance: 'mild', maxTempC: 120, avoidFluids: [],
      note: 'Lowest cost, general-purpose pairing — not for abrasive service or aggressive chemicals.' },
    { id: 'carbon-vs-sic', name: 'Carbon-Graphite vs Silicon Carbide', corrosivityTolerance: 'moderate', maxTempC: 200, avoidFluids: [],
      note: 'A step up in chemical and thermal capability at a modest cost increase — a common general-service choice.' },
    { id: 'sic-vs-sic', name: 'Silicon Carbide vs Silicon Carbide', corrosivityTolerance: 'severe', maxTempC: 300, avoidFluids: [],
      note: 'Hard-vs-hard pairing for abrasive or severely corrosive service — the most robust, and the most expensive, option here.' },
    { id: 'tungsten-carbide-vs-sic', name: 'Tungsten Carbide vs Silicon Carbide', corrosivityTolerance: 'moderate', maxTempC: 250, avoidFluids: ['sulfuric_acid', 'hydrochloric_acid'],
      note: 'Good for hydrocarbon and general service — the cobalt binder in tungsten carbide is attacked by strong mineral acids.' },
  ];

  var ELASTOMER_MATERIALS = [
    { id: 'viton', name: 'Viton (FKM)', corrosivityTolerance: 'severe', maxTempC: 200, avoidFluids: ['caustic_50', 'acetone'],
      note: 'Broad chemical and temperature resistance, the general-purpose secondary seal — attacked by ketones and hot caustic.' },
    { id: 'epdm', name: 'EPDM', corrosivityTolerance: 'moderate', maxTempC: 150, avoidFluids: ['diesel', 'light_hc', 'heavy_hc', 'crude_oil', 'toluene'],
      note: 'The standard choice for hot water, steam and caustic service — swells and degrades in petroleum oils and most hydrocarbons.' },
    { id: 'ptfe', name: 'PTFE (encapsulated/spring-energized)', corrosivityTolerance: 'severe', maxTempC: 200, avoidFluids: [],
      note: 'Near-universal chemical resistance; less resilient than an elastomer, so it is usually reserved for services nothing else tolerates.' },
    { id: 'kalrez', name: 'Kalrez (FFKM)', corrosivityTolerance: 'severe', maxTempC: 275, avoidFluids: [],
      note: 'Perfluoroelastomer with near-universal chemical resistance including hot caustic and most solvents — the highest-cost option here.' },
  ];

  function evaluateSealMaterial(material, ctx) {
    var reasons = [];
    var warnings = [];
    var verdict = 'SUITABLE';

    if (material.avoidFluids.indexOf(ctx.fluidKey) !== -1) {
      verdict = worse(verdict, 'NOT RECOMMENDED');
      reasons.push('Known incompatibility with this fluid regardless of concentration or temperature.');
    } else {
      var fluidRank = CLASS_RANK[ctx.corrosivityClass];
      var matRank = CLASS_RANK[material.corrosivityTolerance];
      if (fluidRank > matRank) {
        verdict = worse(verdict, 'NOT RECOMMENDED');
        reasons.push('Fluid corrosivity (' + ctx.corrosivityClass + ') exceeds this material\'s typical tolerance (' + material.corrosivityTolerance + ').');
      } else {
        reasons.push('Fluid corrosivity (' + ctx.corrosivityClass + ') is within this material\'s typical tolerance (' + material.corrosivityTolerance + ').');
      }
    }

    if (ctx.tempC > material.maxTempC) {
      verdict = worse(verdict, 'NOT RECOMMENDED');
      reasons.push('Operating temperature ' + ctx.tempC.toFixed(0) + '°C exceeds this material\'s ' + material.maxTempC + '°C limit.');
    } else if (ctx.tempC > 0.9 * material.maxTempC) {
      verdict = worse(verdict, 'CHECK');
      warnings.push('Operating temperature ' + ctx.tempC.toFixed(0) + '°C is close to this material\'s ' + material.maxTempC + '°C limit.');
    }

    return { id: material.id, name: material.name, verdict: verdict, reasons: reasons, warnings: warnings, maxTempC: material.maxTempC, note: material.note };
  }

  function screenSealMaterials(list, input) {
    input = input || {};
    var fluidKey = input.fluidKey, corrosivityClass = input.corrosivityClass, tempC = input.tempC;
    if (!fluidKey || !corrosivityClass) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Fluid corrosivity classification is not available — select a listed service fluid.' };
    }
    if (!isFinite(tempC)) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Operating temperature is needed — run the pump hydraulic calculation first.' };
    }
    var ctx = { fluidKey: fluidKey, corrosivityClass: corrosivityClass, tempC: tempC };
    var ranked = list.map(function (m) { return evaluateSealMaterial(m, ctx); })
      .sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.name.localeCompare(b.name); });
    return { applicable: true, status: 'PREDICTED', fluidKey: fluidKey, corrosivityClass: corrosivityClass, tempC: tempC, ranked: ranked, top: ranked[0] };
  }

  function screenSealFaces(input) { return screenSealMaterials(FACE_MATERIALS, input); }
  function screenSecondarySeals(input) { return screenSealMaterials(ELASTOMER_MATERIALS, input); }

  window.AROPUMPSEAL = {
    FLUID_SEAL_HAZARD: FLUID_SEAL_HAZARD,
    SEAL_PLANS: SEAL_PLANS,
    FACE_MATERIALS: FACE_MATERIALS,
    ELASTOMER_MATERIALS: ELASTOMER_MATERIALS,
    selectSealPlan: selectSealPlan,
    screenSealFaces: screenSealFaces,
    screenSecondarySeals: screenSecondarySeals,
  };
})();

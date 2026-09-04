/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Material of Construction (MOC) engine
   window.AROPUMPMOC

   Phase 6 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Screens a small material library against the duty already entered
   (the selected service fluid, operating temperature, and a design
   pressure — reusing Phase 5's casing pressure-class inputs rather than
   asking for anything new) for four wetted/rotating components: casing,
   impeller, shaft, wear rings. Every material gets a verdict from the
   spec's own vocabulary — SUITABLE / CHECK / NOT RECOMMENDED / DATA
   REQUIRED — never a bare PASS/FAIL, and never a guess when the fluid's
   corrosivity isn't classified.

   WHAT THIS IS NOT
   - Not a NACE/vendor corrosion table. Corrosivity classes and the
     pressure-temperature envelopes below are typical published
     screening behaviour for common pump materials, not a certified
     material data sheet — every result says PREDICTED for that reason.
   - Not exhaustive. Ten materials, four components — a seed library,
     the same scale as Phase 2's family database, meant to be extended
     rather than treated as a complete materials standard.
   - Does not invent a corrosivity class for a fluid it doesn't
     recognise (e.g. "custom") — it reports DATA REQUIRED instead.

   API
     AROPUMPMOC.MATERIALS             — the material library
     AROPUMPMOC.FLUID_CORROSIVITY     — fluid -> corrosivity classification
     AROPUMPMOC.envelopeRatingAt(m,T) — pressure-temperature envelope lookup
     AROPUMPMOC.screenMaterials(input)     — ranked verdicts for one component
     AROPUMPMOC.screenAllComponents(input) — the same, for all four components
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CLASS_RANK = { mild: 1, moderate: 2, severe: 3 };
  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };

  // Fluid keys match the Pump Hydraulics module's own FLUID_DB (app.js) —
  // reusing the fluid the engineer already selected rather than asking for
  // a second, separate "corrosivity" input. "custom" and anything not
  // listed here has no classification and reports DATA REQUIRED.
  var FLUID_CORROSIVITY = {
    water: { corrosivityClass: 'mild', chlorideRisk: false },
    caustic_50: { corrosivityClass: 'moderate', chlorideRisk: false, causticService: true },
    diesel: { corrosivityClass: 'mild', chlorideRisk: false },
    ethanol: { corrosivityClass: 'mild', chlorideRisk: false },
    methanol: { corrosivityClass: 'mild', chlorideRisk: false },
    glycol: { corrosivityClass: 'mild', chlorideRisk: false },
    toluene: { corrosivityClass: 'mild', chlorideRisk: false },
    acetone: { corrosivityClass: 'mild', chlorideRisk: false },
    sulfuric_acid: { corrosivityClass: 'severe', chlorideRisk: false },
    hydrochloric_acid: { corrosivityClass: 'severe', chlorideRisk: true },
    light_hc: { corrosivityClass: 'mild', chlorideRisk: false },
    heavy_hc: { corrosivityClass: 'mild', chlorideRisk: false },
    ammonia: { corrosivityClass: 'moderate', chlorideRisk: false },
    brine: { corrosivityClass: 'moderate', chlorideRisk: true },
    crude_oil: { corrosivityClass: 'moderate', chlorideRisk: false },
    condensate: { corrosivityClass: 'mild', chlorideRisk: false },
  };

  // Pressure-temperature envelopes are simplified, monotonically
  // de-rating breakpoint tables (barg vs degC) in the shape of a typical
  // flanged-casing rating curve — not a specific flange class.
  var MATERIALS = [
    { id: 'cast-iron', name: 'Grey Cast Iron (ASTM A48)', applicableComponents: ['casing', 'impeller', 'wearRings'],
      corrosivityTolerance: 'mild', maxTempC: 230, avoidFluids: ['sulfuric_acid', 'hydrochloric_acid', 'ammonia'],
      envelope: [{ t: 0, p: 20 }, { t: 100, p: 17 }, { t: 200, p: 12 }, { t: 230, p: 8 }],
      note: 'Lowest cost, but brittle and the most limited chemically — mild, non-shock service only.' },
    { id: 'ductile-iron', name: 'Ductile Iron (ASTM A536)', applicableComponents: ['casing', 'impeller', 'wearRings'],
      corrosivityTolerance: 'mild', maxTempC: 230, avoidFluids: ['sulfuric_acid', 'hydrochloric_acid'],
      envelope: [{ t: 0, p: 25 }, { t: 100, p: 22 }, { t: 200, p: 16 }, { t: 230, p: 12 }],
      note: 'Tougher than grey cast iron at a similar chemical resistance — the common general-purpose casing material.' },
    { id: 'carbon-steel', name: 'Carbon Steel (ASTM A216 WCB)', applicableComponents: ['casing', 'impeller', 'shaft'],
      corrosivityTolerance: 'moderate', maxTempC: 425, avoidFluids: ['hydrochloric_acid'],
      causticEmbrittlementAboveC: 50,
      envelope: [{ t: 0, p: 50 }, { t: 100, p: 46 }, { t: 200, p: 41 }, { t: 300, p: 36 }, { t: 400, p: 30 }, { t: 425, p: 28 }],
      note: 'The default process casing/shaft material for hydrocarbon and mild-chemical duty.' },
    { id: 'bronze', name: 'Bronze (ASTM B584)', applicableComponents: ['impeller', 'wearRings'],
      corrosivityTolerance: 'moderate', maxTempC: 200, avoidFluids: ['ammonia'],
      envelope: [{ t: 0, p: 20 }, { t: 100, p: 17 }, { t: 150, p: 14 }, { t: 200, p: 10 }],
      note: 'Good bearing/wear properties and seawater resistance; ammonia attacks copper alloys — avoid.' },
    { id: 'ni-resist', name: 'Ni-Resist Austenitic Cast Iron', applicableComponents: ['casing', 'impeller', 'wearRings'],
      corrosivityTolerance: 'moderate', maxTempC: 300, avoidFluids: ['hydrochloric_acid'],
      envelope: [{ t: 0, p: 20 }, { t: 100, p: 18 }, { t: 200, p: 14 }, { t: 300, p: 10 }],
      note: 'A step up from plain cast iron in corrosion resistance, often paired with a bronze or 316 impeller as a galvanically compatible wear-ring set.' },
    { id: '316-stainless', name: '316 Stainless Steel (CF8M)', applicableComponents: ['casing', 'impeller', 'shaft', 'wearRings'],
      corrosivityTolerance: 'moderate', maxTempC: 425, avoidFluids: ['hydrochloric_acid'],
      chlorideSCCRiskAboveC: 60,
      envelope: [{ t: 0, p: 50 }, { t: 100, p: 44 }, { t: 200, p: 38 }, { t: 300, p: 32 }, { t: 400, p: 27 }, { t: 425, p: 25 }],
      note: 'The general-purpose corrosion-resistant choice — susceptible to chloride stress-corrosion cracking once hot.' },
    { id: 'duplex-stainless', name: 'Duplex Stainless Steel (CD4MCu / 2205)', applicableComponents: ['casing', 'impeller', 'shaft', 'wearRings'],
      corrosivityTolerance: 'severe', maxTempC: 300, avoidFluids: [],
      chlorideSCCRiskAboveC: 150,
      envelope: [{ t: 0, p: 55 }, { t: 100, p: 50 }, { t: 200, p: 44 }, { t: 300, p: 38 }],
      note: 'Much better chloride resistance and higher strength than 316, at a moderate cost premium.' },
    { id: 'super-duplex', name: 'Super Duplex Stainless Steel (2507)', applicableComponents: ['casing', 'impeller', 'shaft', 'wearRings'],
      corrosivityTolerance: 'severe', maxTempC: 300, avoidFluids: [],
      chlorideSCCRiskAboveC: 200,
      envelope: [{ t: 0, p: 60 }, { t: 100, p: 55 }, { t: 200, p: 49 }, { t: 300, p: 42 }],
      note: 'The premium chloride-resistant alloy for aggressive brine/seawater service.' },
    { id: 'hastelloy-c', name: 'Hastelloy C-276', applicableComponents: ['casing', 'impeller', 'shaft', 'wearRings'],
      corrosivityTolerance: 'severe', maxTempC: 450, avoidFluids: [],
      envelope: [{ t: 0, p: 60 }, { t: 100, p: 57 }, { t: 200, p: 52 }, { t: 300, p: 47 }, { t: 400, p: 41 }, { t: 450, p: 38 }],
      note: 'Excellent resistance to strong mineral acids (sulfuric, hydrochloric) across a wide temperature range — high cost.' },
    { id: 'titanium', name: 'Titanium Grade 2', applicableComponents: ['casing', 'impeller', 'wearRings'],
      corrosivityTolerance: 'severe', maxTempC: 300, avoidFluids: ['hydrochloric_acid', 'sulfuric_acid'],
      envelope: [{ t: 0, p: 40 }, { t: 100, p: 37 }, { t: 200, p: 32 }, { t: 300, p: 26 }],
      note: 'Essentially immune to chloride pitting/SCC and excellent in oxidizing acids — but attacked by reducing acids (HCl, dilute sulfuric).' },
  ];

  function envelopeRatingAt(material, tempC) {
    var pts = material.envelope;
    if (tempC <= pts[0].t) return pts[0].p;
    if (tempC >= pts[pts.length - 1].t) return pts[pts.length - 1].p;
    for (var i = 1; i < pts.length; i++) {
      if (tempC <= pts[i].t) {
        var a = pts[i - 1], b = pts[i];
        var frac = (tempC - a.t) / (b.t - a.t);
        return a.p + frac * (b.p - a.p);
      }
    }
    return pts[pts.length - 1].p;
  }

  function worseVerdict(a, b) { return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b; }

  function evaluateMaterial(material, ctx) {
    var reasons = [];
    var warnings = [];
    var verdict = 'SUITABLE';

    if (material.avoidFluids.indexOf(ctx.fluidKey) !== -1) {
      verdict = worseVerdict(verdict, 'NOT RECOMMENDED');
      reasons.push('Known incompatibility with this fluid regardless of concentration or temperature.');
    } else {
      var fluidRank = CLASS_RANK[ctx.fluidClass];
      var matRank = CLASS_RANK[material.corrosivityTolerance];
      if (fluidRank > matRank) {
        verdict = worseVerdict(verdict, 'NOT RECOMMENDED');
        reasons.push('Fluid corrosivity (' + ctx.fluidClass + ') exceeds this material\'s typical tolerance (' + material.corrosivityTolerance + ').');
      } else {
        reasons.push('Fluid corrosivity (' + ctx.fluidClass + ') is within this material\'s typical tolerance (' + material.corrosivityTolerance + ').');
      }
    }

    if (ctx.tempC > material.maxTempC) {
      verdict = worseVerdict(verdict, 'NOT RECOMMENDED');
      reasons.push('Operating temperature ' + ctx.tempC.toFixed(0) + '°C exceeds this material\'s ' + material.maxTempC + '°C limit.');
    } else if (ctx.tempC > 0.9 * material.maxTempC) {
      verdict = worseVerdict(verdict, 'CHECK');
      warnings.push('Operating temperature ' + ctx.tempC.toFixed(0) + '°C is close to this material\'s ' + material.maxTempC + '°C limit — verify against a full material data sheet.');
    }

    if (material.causticEmbrittlementAboveC != null && ctx.fluidCorrosivity.causticService && ctx.tempC > material.causticEmbrittlementAboveC) {
      verdict = worseVerdict(verdict, 'CHECK');
      warnings.push('Caustic service above ' + material.causticEmbrittlementAboveC + '°C carries a caustic-embrittlement risk for carbon steel per NACE guidance — consider post-weld heat treatment or an alternative material.');
    }

    if (material.chlorideSCCRiskAboveC != null && ctx.fluidClass !== undefined && ctx.chlorideRisk && ctx.tempC > material.chlorideSCCRiskAboveC) {
      verdict = worseVerdict(verdict, 'CHECK');
      warnings.push('Chloride-bearing fluid above ' + material.chlorideSCCRiskAboveC + '°C carries a chloride stress-corrosion-cracking risk for this alloy — review stress level and consider a higher-alloy material.');
    }

    var ratedBarG = envelopeRatingAt(material, ctx.tempC);
    if (ctx.designPressBarG > ratedBarG) {
      verdict = worseVerdict(verdict, 'NOT RECOMMENDED');
      reasons.push('Design pressure ' + ctx.designPressBarG.toFixed(1) + ' barg exceeds this material\'s screened rating of ' + ratedBarG.toFixed(1) + ' barg at ' + ctx.tempC.toFixed(0) + '°C.');
    } else if (ctx.designPressBarG > 0.9 * ratedBarG) {
      verdict = worseVerdict(verdict, 'CHECK');
      warnings.push('Design pressure ' + ctx.designPressBarG.toFixed(1) + ' barg is close to this material\'s screened rating of ' + ratedBarG.toFixed(1) + ' barg at this temperature.');
    } else {
      reasons.push('Design pressure ' + ctx.designPressBarG.toFixed(1) + ' barg is within the screened ' + ratedBarG.toFixed(1) + ' barg rating at ' + ctx.tempC.toFixed(0) + '°C.');
    }

    return {
      id: material.id, name: material.name, verdict: verdict, reasons: reasons, warnings: warnings,
      maxTempC: material.maxTempC, ratedBarG: Math.round(ratedBarG * 10) / 10, note: material.note,
    };
  }

  /* ── screenMaterials: ranked verdicts for one component ────────────
     input = { component: 'casing'|'impeller'|'shaft'|'wearRings',
               fluidKey, tempC, designPressBarG } */
  function screenMaterials(input) {
    input = input || {};
    var component = input.component;
    var fluidKey = input.fluidKey;
    var tempC = input.tempC, designPressBarG = input.designPressBarG;

    if (!fluidKey || !FLUID_CORROSIVITY[fluidKey]) {
      return { applicable: false, status: 'DATA REQUIRED', component: component,
        reason: 'This fluid ("' + (fluidKey || 'not selected') + '") is not in the corrosivity classification table — select a listed service fluid, or choose a material manually rather than relying on the screening verdict.' };
    }
    if (!isFinite(tempC) || !isFinite(designPressBarG)) {
      return { applicable: false, status: 'DATA REQUIRED', component: component,
        reason: 'Operating temperature and design pressure are both needed to screen materials — run the pump hydraulic calculation first.' };
    }
    var candidates = MATERIALS.filter(function (m) { return m.applicableComponents.indexOf(component) !== -1; });
    if (!candidates.length) {
      return { applicable: false, status: 'DATA REQUIRED', component: component, reason: 'Unknown component "' + component + '".' };
    }

    var fluidCorrosivity = FLUID_CORROSIVITY[fluidKey];
    var ctx = {
      fluidKey: fluidKey, fluidClass: fluidCorrosivity.corrosivityClass, chlorideRisk: fluidCorrosivity.chlorideRisk,
      fluidCorrosivity: fluidCorrosivity, tempC: tempC, designPressBarG: designPressBarG,
    };

    var ranked = candidates.map(function (m) { return evaluateMaterial(m, ctx); })
      .sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.name.localeCompare(b.name); });

    return {
      applicable: true, status: 'PREDICTED', component: component, fluidKey: fluidKey,
      fluidClass: ctx.fluidClass, chlorideRisk: ctx.chlorideRisk, tempC: tempC, designPressBarG: designPressBarG,
      ranked: ranked, top: ranked[0],
    };
  }

  function screenAllComponents(input) {
    var out = {};
    ['casing', 'impeller', 'shaft', 'wearRings'].forEach(function (component) {
      out[component] = screenMaterials(Object.assign({}, input, { component: component }));
    });
    return out;
  }

  window.AROPUMPMOC = {
    MATERIALS: MATERIALS,
    FLUID_CORROSIVITY: FLUID_CORROSIVITY,
    envelopeRatingAt: envelopeRatingAt,
    screenMaterials: screenMaterials,
    screenAllComponents: screenAllComponents,
  };
})();

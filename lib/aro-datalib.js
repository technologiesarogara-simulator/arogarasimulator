/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA ENGINEERING DATA LIBRARY — CORE  (window.ARODATA)
   ---------------------------------------------------------------------------
   The data architecture. The interface that sits on it is aro-datalib-ui.js.

   WHAT THIS IS. A property dictionary, an identity model for chemicals and for
   material grades, a condition model, a canonical-unit system, a source
   registry, property sets, and a map from properties to the design modules
   that can legitimately use them. The framework, built first and deliberately,
   because a library whose schema is an afterthought cannot be corrected later
   without invalidating everything already entered.

   WHAT THIS IS NOT, AND WILL NOT BECOME BY ITSELF. It is not a filled
   database. Every value it holds today comes from one place: the property
   tables already inside this application, carried across with the provenance
   they actually have — REFERENCE ONLY, sourced to the module table that holds
   them. Nothing has been added from anywhere else.

   That is a deliberate refusal, and it is the most important line in this
   file. A language model can produce a plausible density for almost any
   substance. Plausible is not sourced, and a number with no source in an
   engineering library is worse than an empty field, because an empty field
   stops an engineer and a plausible number does not. So:

       A property with no traceable value reads NOT AVAILABLE.
       A value whose condition is unknown reads CONDITION NOT STATED.
       Sources that disagree read CONFLICT and both are kept.

   Nothing is estimated, interpolated from a neighbouring grade, or carried
   over from a similar material. The library grows through the ingestion path
   — a controlled import with a template, unit normalisation, identity
   matching, duplicate and conflict checks, and an engineering review — from
   sources the project is entitled to use.

   IDENTITY BEFORE PROPERTIES. A substance is a CAS number and a formula
   before it is a name; a material is a grade and a designation before it is
   "stainless steel". Spelling is not identity, and two records that merely
   share a display name are not the same substance. Where this library does
   not know a designation, it says NOT STATED rather than guessing that
   316L and S31603 are the same thing — even where an engineer knows they are.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* ══ 1 · STATUS VOCABULARY ══════════════════════════════════════════════
     Which statuses may feed a calculation is a data-governance decision, not
     a display choice, so it lives with the status rather than in the UI. */
  var STATUS = {
    'VERIFIED AUTHORITATIVE': { rank: 0, calc: true,
      note: 'Primary reference data, checked against the cited source.' },
    'VERIFIED SECONDARY': { rank: 1, calc: true,
      note: 'Reputable secondary source, checked.' },
    'REFERENCE ONLY': { rank: 2, calc: false,
      note: 'Carries a value and a table it came from, but has not been checked '
          + 'against a primary source. Usable for screening; not for a committed design.' },
    'USER SUPPLIED': { rank: 3, calc: false,
      note: 'Entered by an engineer on this project. Never treated as reference data.' },
    'CONDITION INCOMPLETE': { rank: 4, calc: false,
      note: 'The value exists but the condition it applies at is not recorded.' },
    'CONFLICT': { rank: 5, calc: false,
      note: 'Two sources disagree. Both are kept; neither is used until one is chosen.' },
    'UNVERIFIED': { rank: 6, calc: false, note: 'No source recorded.' },
    'DEPRECATED': { rank: 7, calc: false, note: 'Superseded. Kept for traceability.' },
    'NOT AVAILABLE': { rank: 8, calc: false,
      note: 'No traceable value is held. Deliberately empty rather than estimated.' }
  };
  function canCalculate(status) { return !!(STATUS[status] && STATUS[status].calc); }

  /* ══ 2 · DATA FORMS ═════════════════════════════════════════════════════ */
  var FORM = {
    CONSTANT: 'CONSTANT',
    TABULAR: 'TABULAR',
    CORRELATION: 'CORRELATION',
    RANGE: 'RANGE',
    CATEGORICAL: 'CATEGORICAL'
  };

  /* Categorical scales, so a compatibility rating is a controlled value and
     not free text that cannot be sorted or compared. */
  var SCALE = {
    compatibility: ['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'LIMITED', 'POOR', 'NOT RECOMMENDED'],
    workability: ['EXCELLENT', 'GOOD', 'MODERATE', 'DIFFICULT', 'NOT RECOMMENDED']
  };

  /* ══ 3 · CANONICAL UNITS ════════════════════════════════════════════════
     One canonical SI unit per quantity, and the display units an engineer
     actually asks for. Conversion is display-only: the stored quantity never
     changes, and the unit it was originally published in is never discarded. */
  var QTY = {
    density: { si: 'kg/m³', units: [['kg/m³', 1], ['g/cm³', 1e-3], ['kg/L', 1e-3], ['lb/ft³', 0.0624280]] },
    dimensionless: { si: '—', units: [['—', 1]] },
    fraction: { si: '—', units: [['—', 1], ['%', 100]] },
    length: { si: 'm', units: [['m', 1], ['mm', 1e3], ['µm', 1e6], ['in', 39.37008]] },
    area_mass: { si: 'm²/kg', units: [['m²/kg', 1], ['m²/g', 1e-3]] },
    molar_mass: { si: 'kg/mol', units: [['kg/mol', 1], ['g/mol', 1e3]] },
    temperature: { si: 'K', units: [['K', 1], ['°C', 1, -273.15]] },
    pressure: { si: 'Pa', units: [['Pa', 1], ['kPa', 1e-3], ['MPa', 1e-6], ['bar', 1e-5], ['psi', 1.450377e-4]] },
    stress: { si: 'Pa', units: [['Pa', 1], ['MPa', 1e-6], ['GPa', 1e-9], ['psi', 1.450377e-4], ['ksi', 1.450377e-7]] },
    thermal_cond: { si: 'W/m·K', units: [['W/m·K', 1], ['W/cm·K', 1e-2], ['Btu/hr·ft·°F', 0.5777893]] },
    elec_cond: { si: 'S/m', units: [['S/m', 1], ['MS/m', 1e-6], ['%IACS', 1 / 580000]] },
    resistivity: { si: 'Ω·m', units: [['Ω·m', 1], ['µΩ·m', 1e6], ['nΩ·m', 1e9]] },
    specific_heat: { si: 'J/kg·K', units: [['J/kg·K', 1], ['kJ/kg·K', 1e-3], ['Btu/lb·°F', 2.388459e-4]] },
    diffusivity: { si: 'm²/s', units: [['m²/s', 1], ['mm²/s', 1e6], ['cSt', 1e6]] },
    dyn_visc: { si: 'Pa·s', units: [['Pa·s', 1], ['mPa·s', 1e3], ['cP', 1e3]] },
    cte: { si: '1/K', units: [['1/K', 1], ['1/°C', 1], ['µm/m·K', 1e6], ['µin/in·°F', 5.5556e5]] },
    surface_tension: { si: 'N/m', units: [['N/m', 1], ['mN/m', 1e3], ['dyn/cm', 1e3]] },
    surface_energy: { si: 'J/m²', units: [['J/m²', 1], ['mJ/m²', 1e3]] },
    enthalpy: { si: 'J/kg', units: [['J/kg', 1], ['kJ/kg', 1e-3]] },
    entropy: { si: 'J/kg·K', units: [['J/kg·K', 1], ['kJ/kg·K', 1e-3]] },
    velocity: { si: 'm/s', units: [['m/s', 1], ['ft/s', 3.28084]] },
    angle: { si: '°', units: [['°', 1]] },
    permeability: { si: 'H/m', units: [['H/m', 1]] },
    dielectric: { si: 'V/m', units: [['V/m', 1], ['kV/mm', 1e-6]] },
    categorical: { si: '—', units: [['—', 1]] },
    text: { si: '', units: [['', 1]] }
  };

  function convert(siValue, qty, unit) {
    var q = QTY[qty];
    if (!q || !isFinite(siValue)) return NaN;
    for (var i = 0; i < q.units.length; i++) {
      if (q.units[i][0] === unit) {
        var f = q.units[i][1], off = q.units[i][2] || 0;
        return siValue * f + off;
      }
    }
    return siValue;
  }
  function toSI(value, qty, unit) {
    var q = QTY[qty];
    if (!q || !isFinite(value)) return NaN;
    for (var i = 0; i < q.units.length; i++) {
      if (q.units[i][0] === unit) {
        var f = q.units[i][1], off = q.units[i][2] || 0;
        return (value - off) / f;
      }
    }
    return value;
  }
  function unitsFor(qty) { return (QTY[qty] || QTY.dimensionless).units.map(function (u) { return u[0]; }); }
  function siUnit(qty) { return (QTY[qty] || QTY.dimensionless).si; }

  /* ══ 4 · PROPERTY DICTIONARY ════════════════════════════════════════════
     Domain, quantity, and which subject kinds the property applies to. A
     property that is listed here but holds no traceable value shows
     NOT AVAILABLE — the dictionary describes what CAN be recorded, never
     what is assumed to be true. */
  var DOMAINS = [
    ['PHYSICAL', 'Physical', true],
    ['MECHANICAL', 'Mechanical', true],
    ['THERMAL', 'Thermal', true],
    ['TRANSPORT', 'Transport', true],
    ['THERMODYNAMIC', 'Thermodynamic', true],
    ['CHEMICAL', 'Chemical', true],
    ['SURFACE', 'Surface', true],
    ['MANUFACTURING', 'Manufacturing', true],
    ['ELECTRICAL', 'Electrical', false],
    ['MAGNETIC', 'Magnetic', false],
    ['OPTICAL', 'Optical', false],
    ['SAFETY', 'Safety', false],
    ['CODE', 'Code / design', true],
    ['IDENTITY', 'Identity', false],
    ['USER', 'User defined', true]
  ];

  /* key, label, domain, quantity, applies-to, [flags] */
  var P = [
    /* PHYSICAL */
    ['density', 'Density', 'PHYSICAL', 'density', 'both'],
    ['sg', 'Specific gravity', 'PHYSICAL', 'dimensionless', 'both'],
    ['porosity', 'Porosity', 'PHYSICAL', 'fraction', 'material'],
    ['voidFraction', 'Void fraction', 'PHYSICAL', 'fraction', 'both'],
    ['moisture', 'Moisture content', 'PHYSICAL', 'fraction', 'material'],
    ['meltRange', 'Melting point / range', 'PHYSICAL', 'temperature', 'material'],
    ['boilingPoint', 'Boiling point', 'PHYSICAL', 'temperature', 'fluid'],
    ['specificSurface', 'Specific surface area', 'PHYSICAL', 'area_mass', 'material'],
    ['particleSize', 'Particle size', 'PHYSICAL', 'length', 'both'],
    ['phase', 'State / phase', 'PHYSICAL', 'text', 'both'],

    /* MECHANICAL */
    ['E', "Young's modulus", 'MECHANICAL', 'stress', 'material'],
    ['nu', "Poisson's ratio", 'MECHANICAL', 'dimensionless', 'material'],
    ['G', 'Shear modulus', 'MECHANICAL', 'stress', 'material'],
    ['K_bulk', 'Bulk modulus', 'MECHANICAL', 'stress', 'material'],
    ['yield', 'Yield strength', 'MECHANICAL', 'stress', 'material'],
    ['tensile', 'Tensile strength', 'MECHANICAL', 'stress', 'material'],
    ['compressive', 'Compressive strength', 'MECHANICAL', 'stress', 'material'],
    ['shearStrength', 'Shear strength', 'MECHANICAL', 'stress', 'material'],
    ['elongation', 'Elongation', 'MECHANICAL', 'fraction', 'material'],
    ['hardness', 'Hardness', 'MECHANICAL', 'text', 'material'],
    ['toughness', 'Toughness', 'MECHANICAL', 'text', 'material'],
    ['impact', 'Impact strength', 'MECHANICAL', 'text', 'material'],
    ['fatigue', 'Fatigue strength', 'MECHANICAL', 'stress', 'material'],
    ['sn', 'Fatigue S-N data', 'MECHANICAL', 'stress', 'material'],
    ['creep', 'Creep', 'MECHANICAL', 'text', 'material'],
    ['fracture', 'Fracture toughness', 'MECHANICAL', 'text', 'material'],
    ['wear', 'Wear resistance', 'MECHANICAL', 'categorical', 'material'],

    /* THERMAL */
    ['k', 'Thermal conductivity', 'THERMAL', 'thermal_cond', 'both'],
    ['cp', 'Specific heat capacity', 'THERMAL', 'specific_heat', 'both'],
    ['alphaTh', 'Thermal diffusivity', 'THERMAL', 'diffusivity', 'both'],
    ['cte', 'Coefficient of thermal expansion', 'THERMAL', 'cte', 'material'],
    ['emissivity', 'Emissivity', 'THERMAL', 'dimensionless', 'material'],
    ['absorptivity', 'Absorptivity', 'THERMAL', 'dimensionless', 'material'],
    ['maxService', 'Maximum service temperature', 'THERMAL', 'temperature', 'material'],
    ['thermalShock', 'Thermal shock resistance', 'THERMAL', 'categorical', 'material'],
    ['thermalStability', 'Thermal stability', 'THERMAL', 'text', 'both'],

    /* TRANSPORT — fluids */
    ['mu', 'Dynamic viscosity', 'TRANSPORT', 'dyn_visc', 'fluid'],
    ['nuKin', 'Kinematic viscosity', 'TRANSPORT', 'diffusivity', 'fluid'],
    ['sigma', 'Surface tension', 'TRANSPORT', 'surface_tension', 'fluid'],
    ['pr', 'Prandtl number', 'TRANSPORT', 'dimensionless', 'fluid'],
    ['diffusivity', 'Diffusion coefficient', 'TRANSPORT', 'diffusivity', 'fluid'],
    ['sound', 'Speed of sound', 'TRANSPORT', 'velocity', 'fluid'],

    /* THERMODYNAMIC — fluids */
    ['mw', 'Molecular weight', 'THERMODYNAMIC', 'molar_mass', 'fluid'],
    ['specificVolume', 'Specific volume', 'THERMODYNAMIC', 'density', 'fluid'],
    ['cv', 'Cv', 'THERMODYNAMIC', 'specific_heat', 'fluid'],
    ['gamma', 'Cp/Cv', 'THERMODYNAMIC', 'dimensionless', 'fluid'],
    ['enthalpy', 'Enthalpy', 'THERMODYNAMIC', 'enthalpy', 'fluid'],
    ['entropy', 'Entropy', 'THERMODYNAMIC', 'entropy', 'fluid'],
    ['z', 'Compressibility factor', 'THERMODYNAMIC', 'dimensionless', 'fluid'],
    ['pvap', 'Vapour pressure', 'THERMODYNAMIC', 'pressure', 'fluid'],
    ['tsat', 'Saturation temperature', 'THERMODYNAMIC', 'temperature', 'fluid'],
    ['tcrit', 'Critical temperature', 'THERMODYNAMIC', 'temperature', 'fluid'],
    ['pcrit', 'Critical pressure', 'THERMODYNAMIC', 'pressure', 'fluid'],
    ['vcrit', 'Critical volume', 'THERMODYNAMIC', 'density', 'fluid'],
    ['acentric', 'Acentric factor', 'THERMODYNAMIC', 'dimensionless', 'fluid'],
    ['latent', 'Latent heat', 'THERMODYNAMIC', 'enthalpy', 'fluid'],
    ['triplePoint', 'Triple point', 'THERMODYNAMIC', 'temperature', 'fluid'],

    /* CHEMICAL */
    ['corrosion', 'Corrosion resistance', 'CHEMICAL', 'categorical', 'material'],
    ['oxidation', 'Oxidation resistance', 'CHEMICAL', 'categorical', 'material'],
    ['compatibility', 'Chemical compatibility', 'CHEMICAL', 'categorical', 'both'],
    ['acidRes', 'Acid resistance', 'CHEMICAL', 'categorical', 'material'],
    ['alkaliRes', 'Alkali resistance', 'CHEMICAL', 'categorical', 'material'],
    ['solventRes', 'Solvent resistance', 'CHEMICAL', 'categorical', 'material'],
    ['ph', 'pH', 'CHEMICAL', 'dimensionless', 'fluid'],
    ['corrosionRate', 'Corrosion rate', 'CHEMICAL', 'length', 'material'],
    ['reactivity', 'Reactivity', 'CHEMICAL', 'text', 'both'],

    /* SURFACE — kept apart precisely because these get confused */
    ['epsHyd', 'Hydraulic absolute roughness ε', 'SURFACE', 'length', 'material'],
    ['ra', 'Surface roughness Ra', 'SURFACE', 'length', 'material'],
    ['rz', 'Surface roughness Rz', 'SURFACE', 'length', 'material'],
    ['surfaceEnergy', 'Surface energy', 'SURFACE', 'surface_energy', 'material'],
    ['contactAngle', 'Contact angle', 'SURFACE', 'angle', 'material'],
    ['wettability', 'Wettability', 'SURFACE', 'categorical', 'material'],
    ['friction', 'Friction coefficient', 'SURFACE', 'dimensionless', 'material'],
    ['surfaceFinish', 'Surface finish', 'SURFACE', 'text', 'material'],

    /* MANUFACTURING */
    ['weldability', 'Weldability', 'MANUFACTURING', 'categorical', 'material'],
    ['machinability', 'Machinability', 'MANUFACTURING', 'categorical', 'material'],
    ['castability', 'Castability', 'MANUFACTURING', 'categorical', 'material'],
    ['formability', 'Formability', 'MANUFACTURING', 'categorical', 'material'],
    ['forgeability', 'Forgeability', 'MANUFACTURING', 'categorical', 'material'],
    ['solderability', 'Solderability', 'MANUFACTURING', 'categorical', 'material'],
    ['brazability', 'Brazability', 'MANUFACTURING', 'categorical', 'material'],
    ['heatTreatable', 'Heat treatability', 'MANUFACTURING', 'categorical', 'material'],

    /* ELECTRICAL — labelled explicitly so it cannot be read as thermal */
    ['elecCond', 'Electrical conductivity', 'ELECTRICAL', 'elec_cond', 'material'],
    ['elecRes', 'Electrical resistivity', 'ELECTRICAL', 'resistivity', 'material'],
    ['dielStrength', 'Dielectric strength', 'ELECTRICAL', 'dielectric', 'material'],
    ['dielConst', 'Dielectric constant', 'ELECTRICAL', 'dimensionless', 'material'],
    ['tcr', 'Temperature coefficient of resistance', 'ELECTRICAL', 'cte', 'material'],

    /* MAGNETIC */
    ['permeability', 'Magnetic permeability', 'MAGNETIC', 'permeability', 'material'],
    ['relPermeability', 'Relative permeability', 'MAGNETIC', 'dimensionless', 'material'],
    ['coercivity', 'Coercivity', 'MAGNETIC', 'text', 'material'],
    ['remanence', 'Remanence', 'MAGNETIC', 'text', 'material'],
    ['saturation', 'Saturation magnetisation', 'MAGNETIC', 'text', 'material'],

    /* OPTICAL */
    ['refractive', 'Refractive index', 'OPTICAL', 'dimensionless', 'both'],
    ['reflectivity', 'Reflectivity', 'OPTICAL', 'dimensionless', 'material'],
    ['transmissivity', 'Transmissivity', 'OPTICAL', 'dimensionless', 'material'],
    ['bandGap', 'Optical band gap', 'OPTICAL', 'text', 'material'],

    /* SAFETY */
    ['flashPoint', 'Flash point', 'SAFETY', 'temperature', 'fluid'],
    ['autoignition', 'Autoignition temperature', 'SAFETY', 'temperature', 'fluid'],
    ['lel', 'Lower explosive limit', 'SAFETY', 'fraction', 'fluid'],
    ['uel', 'Upper explosive limit', 'SAFETY', 'fraction', 'fluid'],
    ['hazard', 'Hazard notes', 'SAFETY', 'text', 'fluid'],

    /* CODE / DESIGN — never a physical constant, always code + edition + T */
    ['S', 'Allowable stress', 'CODE', 'stress', 'material'],
    ['jointEff', 'Joint efficiency', 'CODE', 'dimensionless', 'material'],
    ['designStress', 'Design stress', 'CODE', 'stress', 'material'],
    ['corrAllow', 'Corrosion allowance', 'CODE', 'length', 'material']
  ];

  var PROPS = {};
  P.forEach(function (r) {
    PROPS[r[0]] = { key: r[0], label: r[1], domain: r[2], qty: r[3], applies: r[4] };
  });

  function propsInDomain(domain, kind) {
    return P.filter(function (r) {
      return r[2] === domain && (r[4] === 'both' || r[4] === kind);
    }).map(function (r) { return PROPS[r[0]]; });
  }
  function domainsFor(kind) {
    return DOMAINS.filter(function (d) {
      return propsInDomain(d[0], kind).length > 0;
    }).map(function (d) { return { key: d[0], label: d[1], defaultOn: d[2] }; });
  }

  /* ══ 5 · IDENTITY ═══════════════════════════════════════════════════════
     A chemical is a CAS number; a material is a grade and a designation.
     Fields that are not known are NOT STATED. This library does not assert
     that "316L" and "UNS S31603" are the same record unless a verified
     mapping has been imported, however obvious that equivalence is to an
     engineer — an unverified alias is how two different grades quietly merge. */
  var NOT_STATED = 'NOT STATED';

  function chemicalIdentity(o) {
    o = o || {};
    return {
      chemicalId: o.chemicalId || null,
      preferredName: o.preferredName || o.name || null,
      synonyms: o.synonyms || [],
      cas: o.cas || NOT_STATED,
      formula: o.formula || NOT_STATED,
      molecularWeight: isFinite(o.molecularWeight) ? o.molecularWeight : null,
      inchi: o.inchi || NOT_STATED,
      smiles: o.smiles || NOT_STATED,
      family: o.family || NOT_STATED,
      phaseReference: o.phaseReference || NOT_STATED
    };
  }
  function materialIdentity(o) {
    o = o || {};
    return {
      materialId: o.materialId || null,
      preferredName: o.preferredName || o.name || null,
      grade: o.grade || NOT_STATED,
      family: o.family || NOT_STATED,
      designations: {
        UNS: (o.designations && o.designations.UNS) || NOT_STATED,
        ASTM: (o.designations && o.designations.ASTM) || NOT_STATED,
        ASME: (o.designations && o.designations.ASME) || NOT_STATED,
        EN: (o.designations && o.designations.EN) || NOT_STATED,
        DIN: (o.designations && o.designations.DIN) || NOT_STATED,
        JIS: (o.designations && o.designations.JIS) || NOT_STATED,
        IS: (o.designations && o.designations.IS) || NOT_STATED
      },
      aliases: o.aliases || []
    };
  }

  /* ══ 6 · CONDITION MODEL ════════════════════════════════════════════════ */
  function condition(o) {
    o = o || {};
    function f(v) { return (v === 0 || v) ? v : NOT_STATED; }
    return {
      temperature: f(o.temperature), temperatureUnit: o.temperatureUnit || '°C',
      pressure: f(o.pressure), pressureUnit: o.pressureUnit || 'bar',
      phase: f(o.phase),
      composition: f(o.composition),
      concentration: f(o.concentration),
      materialCondition: f(o.materialCondition),
      productForm: f(o.productForm),
      heatTreatment: f(o.heatTreatment),
      surfaceCondition: f(o.surfaceCondition),
      testMethod: f(o.testMethod)
    };
  }
  function conditionSummary(c) {
    if (!c) return NOT_STATED;
    var bits = [];
    if (c.temperature !== NOT_STATED) bits.push(c.temperature + ' ' + (c.temperatureUnit || '°C'));
    if (c.pressure !== NOT_STATED) bits.push(c.pressure + ' ' + (c.pressureUnit || 'bar'));
    if (c.phase !== NOT_STATED) bits.push(String(c.phase));
    if (c.concentration !== NOT_STATED) bits.push(String(c.concentration));
    if (c.productForm !== NOT_STATED) bits.push(String(c.productForm));
    return bits.length ? bits.join(' · ') : NOT_STATED;
  }

  /* ══ 7 · SOURCE REGISTRY ════════════════════════════════════════════════ */
  var SOURCE_TYPES = ['PRIMARY AUTHORITATIVE', 'GOVERNMENT REFERENCE', 'MANUFACTURER DATASHEET',
    'LICENSED STANDARD', 'LICENSED HANDBOOK', 'PEER-REVIEWED LITERATURE',
    'SECONDARY REFERENCE', 'PROJECT DATASHEET', 'USER SUPPLIED', 'SOFTWARE TABLE'];

  function source(o) {
    o = o || {};
    return {
      engineeringSource: o.engineeringSource || NOT_STATED,
      sourceType: o.sourceType || 'SECONDARY REFERENCE',
      sourceTitle: o.sourceTitle || NOT_STATED,
      edition: o.edition || NOT_STATED,
      section: o.section || NOT_STATED,
      reference: o.reference || NOT_STATED,
      licensing: o.licensing || NOT_STATED,
      dateChecked: o.dateChecked || NOT_STATED,
      /* Where the number physically lives in this codebase. Never the
         engineering source — a file path says nothing about provenance. */
      softwareSource: o.softwareSource || NOT_STATED
    };
  }

  /* ══ 8 · A PROPERTY VALUE ═══════════════════════════════════════════════ */
  function value(o) {
    o = o || {};
    var qty = (PROPS[o.property] || {}).qty || 'dimensionless';
    var rec = {
      id: o.id || null,
      subjectId: o.subjectId || null,
      property: o.property,
      domain: (PROPS[o.property] || {}).domain || 'USER',
      qty: qty,
      form: o.form || FORM.CONSTANT,
      /* CONSTANT / RANGE */
      si: isFinite(o.si) ? o.si : null,
      siUnit: siUnit(qty),
      siMin: isFinite(o.siMin) ? o.siMin : null,
      siMax: isFinite(o.siMax) ? o.siMax : null,
      /* the published figure, never discarded */
      original: (o.original === 0 || o.original) ? o.original : null,
      originalUnit: o.originalUnit || null,
      /* TABULAR: [[x, y], …] with x in xUnit, y in canonical SI */
      table: o.table || null,
      xProperty: o.xProperty || 'temperature',
      xUnit: o.xUnit || '°C',
      /* CORRELATION — a named, cited expression, never one invented here */
      correlation: o.correlation || null,
      /* CATEGORICAL */
      categorical: o.categorical || null,
      scale: o.scale || null,
      condition: condition(o.condition),
      source: source(o.source),
      status: o.status || 'UNVERIFIED',
      note: o.note || null
    };
    if (!rec.status || !STATUS[rec.status]) rec.status = 'UNVERIFIED';
    return rec;
  }

  /* ══ 9 · STORE ══════════════════════════════════════════════════════════ */
  var SUBJECTS = null;      /* id -> subject */
  var VALUES = null;        /* subjectId -> { property -> [value, …] } */

  function subject(o) {
    return {
      id: o.id,
      kind: o.kind,                     /* 'material' | 'fluid' */
      name: o.name,
      family: o.family || NOT_STATED,
      identity: o.kind === 'fluid' ? chemicalIdentity(o.identity) : materialIdentity(o.identity),
      origin: o.origin || 'MIGRATED'
    };
  }

  /* ── Families, from what the application already distinguishes ─────────── */
  var MATERIAL_FAMILIES = ['Carbon Steels', 'Stainless Steels', 'Alloy Steels', 'Duplex & Super Duplex',
    'Aluminium Alloys', 'Copper Alloys', 'Nickel Alloys', 'Titanium Alloys', 'Cast Iron',
    'Polymers', 'Elastomers', 'Ceramics', 'Composites', 'Insulation Materials',
    'Refractory Materials', 'User Defined Materials', 'Unclassified'];
  var FLUID_FAMILIES = ['Water', 'Steam', 'Air', 'Industrial Gases', 'Hydrocarbons',
    'Petroleum Fractions', 'Oils', 'Solvents', 'Acids', 'Alkalis', 'Glycols',
    'Refrigerants', 'Heat Transfer Fluids', 'Slurries', 'User Defined Fluids', 'Unclassified'];

  /* Family is inferred from the name the application already uses, which is
     reading what is there rather than asserting something new. A name that
     does not match any pattern is Unclassified — not guessed into a family. */
  var MAT_FAM = [
    [/duplex|2205|2507/i, 'Duplex & Super Duplex'],
    [/^ss|stainless|3\d\d[lL]?\b|31[06]|321|347|317/i, 'Stainless Steels'],
    [/hastelloy|inconel|monel|incoloy|nickel|alloy 20|smo/i, 'Nickel Alloys'],
    [/titanium|^ti[- ]|gr\.?\s*2\b/i, 'Titanium Alloys'],
    [/alumini?um|^al\b|\b3003\b|\b5083\b|\b6061\b/i, 'Aluminium Alloys'],
    [/copper|brass|bronze|cupro|^cu\b/i, 'Copper Alloys'],
    [/cast iron|ductile iron|^ci\b/i, 'Cast Iron'],
    [/alloy steel|chrome[- ]moly|p\d{1,2}\b|a335/i, 'Alloy Steels'],
    [/carbon steel|^cs\b|^ms\b|a106|a53|a516|a105|a36|commercial|riveted|galvani|^gi$/i, 'Carbon Steels'],
    [/ptfe|pvc|cpvc|hdpe|\bpp\b|pvdf|peek|polymer|plastic/i, 'Polymers'],
    [/rubber|epdm|viton|nitrile|elastomer|neoprene/i, 'Elastomers'],
    [/ceramic|alumina|zirconia|sic\b/i, 'Ceramics'],
    [/frp|cfrp|composite|glass fib/i, 'Composites'],
    [/insulat|mineral wool|calcium silicate|perlite/i, 'Insulation Materials'],
    [/refract|firebrick|castable/i, 'Refractory Materials']
  ];
  var FLUID_FAM = [
    [/^steam|superheat|saturated steam/i, 'Steam'],
    [/^air\b|^air /i, 'Air'],
    [/nitrogen|oxygen|hydrogen|carbon dioxide|\bco2\b|argon|helium|methane|ethane|propane|butane|natural gas|ammonia/i, 'Industrial Gases'],
    [/water|seawater|condensate|brine/i, 'Water'],
    [/glycol/i, 'Glycols'],
    [/crude|diesel|gasoline|kerosene|naphtha|fuel oil|petroleum|bitumen|lpg/i, 'Petroleum Fractions'],
    [/benzene|toluene|xylene|hexane|heptane|octane|hydrocarbon/i, 'Hydrocarbons'],
    [/acetone|methanol|ethanol|isopropyl|ipa\b|solvent|alcohol/i, 'Solvents'],
    [/acid/i, 'Acids'],
    [/caustic|hydroxide|alkali|soda/i, 'Alkalis'],
    [/refrigerant|\br\d{2,3}\b|freon/i, 'Refrigerants'],
    [/thermal oil|therminol|dowtherm|heat transfer/i, 'Heat Transfer Fluids'],
    [/oil\b|lubricant/i, 'Oils'],
    [/slurry|sludge|pulp/i, 'Slurries']
  ];
  function familyOf(name, kind) {
    var list = kind === 'fluid' ? FLUID_FAM : MAT_FAM;
    for (var i = 0; i < list.length; i++) if (list[i][0].test(name)) return list[i][1];
    return 'Unclassified';
  }

  /* ══ 10 · MIGRATION FROM THE EXISTING LIBRARY ═══════════════════════════
     The only data this library ships with. Each record keeps the provenance
     it genuinely has: a value, the module table it came from, the unit it was
     published in, and the condition where the table stated one. Status is
     REFERENCE ONLY, because that is what an unchecked value carried across
     from a software table is — screening data, not design data. */
  var LEGACY_QTY = {
    rho: ['density', 'density'], mu: ['mu', 'dyn_visc'], cp: ['cp', 'specific_heat'],
    k: ['k', 'thermal_cond'], S: ['S', 'stress'],
    epsHyd: ['epsHyd', 'length'], finishRa: ['ra', 'length'],
    corr: ['corrosionRate', 'length'], fouling: null
  };

  function build() {
    SUBJECTS = {}; VALUES = {};
    var L = window.AROENGLIB;
    if (!L) return;
    var recs = [];
    try { recs = L.records(); } catch (e) { return; }

    recs.forEach(function (r) {
      var map = LEGACY_QTY[r.prop];
      if (!map) return;                       /* nothing to map it onto yet */
      var propKey = map[0];
      if (!PROPS[propKey]) return;

      var sid = r.kind + ':' + r.subjectKey;
      if (!SUBJECTS[sid]) {
        SUBJECTS[sid] = subject({
          id: sid, kind: r.kind, name: r.subject,
          family: familyOf(r.subject, r.kind),
          identity: r.kind === 'fluid'
            ? { preferredName: r.subject, family: familyOf(r.subject, 'fluid') }
            : { preferredName: r.subject, grade: r.grade || r.subject,
                family: familyOf(r.subject, 'material') },
          origin: 'MIGRATED FROM MODULE TABLE'
        });
        VALUES[sid] = {};
      }

      var v = value({
        id: r.id, subjectId: sid, property: propKey,
        form: FORM.CONSTANT,
        si: r.si,
        original: r.raw, originalUnit: r.rawUnit,
        condition: { temperature: r.condition ? String(r.condition).replace(/[^0-9.\-]/g, '') || r.condition : undefined },
        source: {
          engineeringSource: r.engSource,
          sourceType: r.engType === 'CODE' ? 'LICENSED STANDARD'
            : (r.engType === 'STANDARD' ? 'LICENSED STANDARD'
              : (r.engType === 'MANUFACTURER TYPICAL' ? 'MANUFACTURER DATASHEET' : 'SECONDARY REFERENCE')),
          sourceTitle: r.engSource,
          softwareSource: r.softSource + ' · ' + r.module
        },
        status: r.status === 'CONFLICT' ? 'CONFLICT'
          : (r.condition ? 'REFERENCE ONLY' : 'CONDITION INCOMPLETE'),
        note: null
      });
      (VALUES[sid][propKey] = VALUES[sid][propKey] || []).push(v);
    });

    /* User records join as USER SUPPLIED, never as reference data. */
    try {
      var U = window.AROUSERLIB ? window.AROUSERLIB.all() : [];
      U.forEach(function (u) {
        if (u.kind !== 'fluid' && u.kind !== 'material') return;
        var sid = u.kind + ':user:' + u.name.toLowerCase();
        if (!SUBJECTS[sid]) {
          SUBJECTS[sid] = subject({
            id: sid, kind: u.kind, name: u.name,
            family: u.kind === 'fluid' ? 'User Defined Fluids' : 'User Defined Materials',
            identity: { preferredName: u.name, grade: u.grade || undefined },
            origin: 'USER DEFINED'
          });
          VALUES[sid] = {};
        }
        Object.keys(u.props).forEach(function (pk) {
          var m = LEGACY_QTY[pk];
          if (!m || !PROPS[m[0]]) return;
          var unit = null;
          (window.AROUSERLIB.FIELDS[u.kind] || []).forEach(function (f) { if (f[0] === pk) unit = f[2]; });
          var si = window.AROENGLIB ? window.AROENGLIB.toSI(u.props[pk], unit) : u.props[pk];
          var v2 = value({
            id: u.id + ':' + pk, subjectId: sid, property: m[0], form: FORM.CONSTANT,
            si: si, original: u.props[pk], originalUnit: unit,
            condition: { temperature: u.condition || undefined },
            source: { engineeringSource: u.source || NOT_STATED, sourceType: 'USER SUPPLIED',
              softwareSource: 'User-defined library' },
            status: 'USER SUPPLIED'
          });
          (VALUES[sid][m[0]] = VALUES[sid][m[0]] || []).push(v2);
        });
      });
    } catch (e) {}
  }

  function ensure() { if (!SUBJECTS) build(); }

  /* ══ 11 · READ API ══════════════════════════════════════════════════════ */
  function subjects(kind, family) {
    ensure();
    return Object.keys(SUBJECTS).map(function (k) { return SUBJECTS[k]; })
      .filter(function (s) {
        if (kind && s.kind !== kind) return false;
        if (family && s.family !== family) return false;
        return true;
      })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function get(id) { ensure(); return SUBJECTS[id] || null; }

  /* Every property the dictionary allows for this subject kind, with its
     values where any are held — and NOT AVAILABLE where none are. The empty
     ones are the point: a field an engineer can see is empty is a field they
     will not accidentally trust. */
  function propertiesOf(id, domain) {
    ensure();
    var s = SUBJECTS[id];
    if (!s) return [];
    var bag = VALUES[id] || {};
    var list = domain ? propsInDomain(domain, s.kind)
      : P.filter(function (r) { return r[4] === 'both' || r[4] === s.kind; })
        .map(function (r) { return PROPS[r[0]]; });
    return list.map(function (p) {
      var vs = bag[p.key] || [];
      return {
        prop: p,
        values: vs,
        available: vs.length > 0,
        status: vs.length ? worstStatus(vs) : 'NOT AVAILABLE',
        primary: vs.length ? pick(vs) : null
      };
    });
  }
  function worstStatus(vs) {
    var w = vs[0].status;
    vs.forEach(function (v) {
      if ((STATUS[v.status] || {}).rank > (STATUS[w] || {}).rank) w = v.status;
    });
    return w;
  }
  /* Canonical selection: best-ranked status wins, ties keep the first. Values
     are never averaged and the losers are never deleted. */
  function pick(vs) {
    var best = vs[0];
    vs.forEach(function (v) {
      if ((STATUS[v.status] || {}).rank < (STATUS[best.status] || {}).rank) best = v;
    });
    return best;
  }

  function domainCounts(id) {
    ensure();
    var s = SUBJECTS[id];
    if (!s) return [];
    return domainsFor(s.kind).map(function (d) {
      var rows = propertiesOf(id, d.key);
      return { key: d.key, label: d.label, defaultOn: d.defaultOn,
        total: rows.length, held: rows.filter(function (r) { return r.available; }).length };
    });
  }

  /* ══ 12 · PROPERTY SETS ═════════════════════════════════════════════════ */
  var SETS = {
    'PROCESS PIPING': ['density', 'mu', 'nuKin', 'sg', 'pvap', 'epsHyd', 'yield', 'S', 'corrosion'],
    'HEAT EXCHANGER THERMAL': ['density', 'cp', 'mu', 'k', 'pr', 'cte'],
    'PRESSURE EQUIPMENT MECHANICAL': ['density', 'E', 'nu', 'yield', 'tensile', 'S', 'cte'],
    'THERMAL VISUALISATION': ['density', 'mu', 'cp', 'k', 'emissivity'],
    'FULL CHARACTERISATION': null                   /* null = every property */
  };

  /* ══ 13 · MODULE MAPPING ════════════════════════════════════════════════
     Which properties a module can legitimately consume. A property outside
     this list is not blocked from being selected — it simply is not offered
     to that module, because sending a magnetic permeability to a pump
     hydraulic calculation is noise, not data. */
  var MODULES = {
    pump: { label: 'Pump Hydraulics',
      fluid: ['density', 'sg', 'mu', 'nuKin', 'pvap'],
      material: ['epsHyd'] },
    line: { label: 'Line Sizing',
      fluid: ['density', 'sg', 'mu', 'nuKin', 'pvap', 'z', 'sigma'],
      material: ['epsHyd'] },
    hx: { label: 'Heat Exchanger',
      fluid: ['density', 'mu', 'cp', 'k', 'pr'],
      material: ['k', 'density', 'cte', 'S', 'corrosion'] },
    tank: { label: 'Tank Design',
      fluid: ['density', 'sg'],
      material: ['density', 'yield', 'S', 'E', 'cte', 'corrosion', 'corrosionRate'] },
    workbench: { label: 'ARO Workbench',
      fluid: ['density', 'mu'],
      material: ['density', 'epsHyd'] },
    general: { label: 'General project', fluid: null, material: null }
  };
  function relevantFor(moduleKey, kind) {
    var m = MODULES[moduleKey];
    if (!m) return null;
    return m[kind] || null;
  }

  /* ══ 14 · PROJECT SELECTION ═════════════════════════════════════════════ */
  var SEL_KEY = 'aro_datalib_selection_v1';
  var FAV_KEY = 'aro_datalib_favourites_v1';

  function selection() {
    try {
      var a = JSON.parse(localStorage.getItem(SEL_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function saveSelection(list) {
    try { localStorage.setItem(SEL_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function addToProject(entry) {
    var list = selection();
    list = list.filter(function (x) {
      return !(x.subjectId === entry.subjectId && x.module === entry.module);
    });
    list.push({
      subjectId: entry.subjectId, subjectName: entry.subjectName, kind: entry.kind,
      module: entry.module, moduleLabel: (MODULES[entry.module] || {}).label || entry.module,
      properties: entry.properties || [], at: Date.now(),
      by: entry.by || null
    });
    saveSelection(list);
    return list;
  }
  function removeSelection(subjectId, module) {
    saveSelection(selection().filter(function (x) {
      return !(x.subjectId === subjectId && x.module === module);
    }));
  }

  function favourites() {
    try {
      var a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function toggleFavourite(id) {
    var f = favourites();
    var i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch (e) {}
    return f;
  }
  function isFavourite(id) { return favourites().indexOf(id) >= 0; }

  /* ══ 15 · SEARCH ════════════════════════════════════════════════════════
     Name, grade, designation, family, CAS, formula and property name. The two
     conductivities are deliberately distinguishable: searching "conductivity"
     returns both and each says which it is. */
  var SYN = {
    visc: 'viscosity', cond: 'conductivity', temp: 'temperature',
    ss: 'stainless', cs: 'carbon steel', ipa: 'isopropyl',
    modulus: 'modulus', rough: 'roughness'
  };
  function expand(q) {
    return String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
      .map(function (w) { return SYN[w] || w; });
  }
  function searchSubjects(q, o) {
    ensure();
    o = o || {};
    var terms = expand(q);
    var list = subjects(o.kind, o.family);
    if (o.favouritesOnly) {
      var f = favourites();
      list = list.filter(function (s) { return f.indexOf(s.id) >= 0; });
    }
    if (!terms.length) return list;
    return list.filter(function (s) {
      var id = s.identity || {};
      var hay = [s.name, s.family, id.grade, id.cas, id.formula,
        (id.aliases || []).join(' '), (id.synonyms || []).join(' '),
        id.designations ? Object.keys(id.designations).map(function (k) {
          return id.designations[k];
        }).join(' ') : ''].join(' ').toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) >= 0; });
    });
  }
  function searchProperties(q) {
    var terms = expand(q);
    if (!terms.length) return [];
    return P.map(function (r) { return PROPS[r[0]]; }).filter(function (p) {
      var hay = (p.label + ' ' + p.domain + ' ' + p.key).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) >= 0; });
    });
  }

  /* ══ 16 · IMPORT TEMPLATE ═══════════════════════════════════════════════
     The controlled shape an external dataset must take before it can enter
     the library. Published as a downloadable CSV so a data source can be
     prepared outside the application and reviewed before it is committed. */
  var IMPORT_COLUMNS = ['subject_kind', 'subject_name', 'material_grade', 'cas', 'formula',
    'property_key', 'data_form', 'value', 'unit', 'value_min', 'value_max',
    'x_property', 'x_values', 'y_values',
    'temperature', 'temperature_unit', 'pressure', 'pressure_unit', 'phase',
    'composition', 'concentration', 'product_form', 'heat_treatment',
    'surface_condition', 'test_method',
    'engineering_source', 'source_type', 'source_title', 'edition', 'section',
    'reference', 'licensing', 'date_checked', 'status', 'notes'];

  function importTemplateCsv() {
    var example = {
      subject_kind: 'material', subject_name: 'EXAMPLE — delete this row',
      material_grade: '', property_key: 'k', data_form: 'TABULAR',
      x_property: 'temperature', x_values: '20;100;200', y_values: '16.2;17.5;19.0',
      unit: 'W/m·K', temperature_unit: '°C',
      engineering_source: 'name the document the numbers came from',
      source_type: 'PRIMARY AUTHORITATIVE', status: 'VERIFIED AUTHORITATIVE'
    };
    var rows = [IMPORT_COLUMNS, IMPORT_COLUMNS.map(function (c) { return example[c] || ''; })];
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
  }

  /* Property keys, so whoever prepares a dataset knows exactly what the
     library will accept rather than guessing at column names. */
  function dictionaryCsv() {
    var rows = [['property_key', 'label', 'domain', 'quantity', 'canonical_si_unit',
      'display_units', 'applies_to']];
    P.forEach(function (r) {
      rows.push([r[0], r[1], r[2], r[3], siUnit(r[3]), unitsFor(r[3]).join(' | '), r[4]]);
    });
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
  }

  /* ══ 17 · EXPORTS ═══════════════════════════════════════════════════════ */
  window.ARODATA = {
    NOT_STATED: NOT_STATED,
    STATUS: STATUS, FORM: FORM, SCALE: SCALE,
    DOMAINS: DOMAINS, PROPS: PROPS,
    MATERIAL_FAMILIES: MATERIAL_FAMILIES, FLUID_FAMILIES: FLUID_FAMILIES,
    SOURCE_TYPES: SOURCE_TYPES, SETS: SETS, MODULES: MODULES,
    IMPORT_COLUMNS: IMPORT_COLUMNS,

    canCalculate: canCalculate,
    convert: convert, toSI: toSI, unitsFor: unitsFor, siUnit: siUnit,
    propsInDomain: propsInDomain, domainsFor: domainsFor,
    chemicalIdentity: chemicalIdentity, materialIdentity: materialIdentity,
    condition: condition, conditionSummary: conditionSummary,
    source: source, value: value,

    subjects: subjects, get: get, propertiesOf: propertiesOf,
    domainCounts: domainCounts, relevantFor: relevantFor,
    searchSubjects: searchSubjects, searchProperties: searchProperties,

    selection: selection, addToProject: addToProject, removeSelection: removeSelection,
    favourites: favourites, toggleFavourite: toggleFavourite, isFavourite: isFavourite,

    importTemplateCsv: importTemplateCsv, dictionaryCsv: dictionaryCsv,

    stats: function () {
      ensure();
      var subs = Object.keys(SUBJECTS).length, vals = 0, byStatus = {};
      Object.keys(VALUES).forEach(function (sid) {
        Object.keys(VALUES[sid]).forEach(function (pk) {
          VALUES[sid][pk].forEach(function (v) {
            vals++; byStatus[v.status] = (byStatus[v.status] || 0) + 1;
          });
        });
      });
      return { subjects: subs, values: vals, byStatus: byStatus,
        properties: P.length, domains: DOMAINS.length };
    },
    rebuild: function () { SUBJECTS = null; ensure(); }
  };
})();

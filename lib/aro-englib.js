/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — COMMON ENGINEERING LIBRARY  (window.AROENGLIB)
   ---------------------------------------------------------------------------
   The registry that came before this indexed the module tables and compared
   them. It was right that they disagree. It was wrong about why, and the
   reason matters more than the finding.

   Its worst report was a 333× disagreement on the surface roughness of the
   stainless steels — 0.0015 mm in the tank table against 0.5 in the plate
   exchanger table. Both numbers are correct. Neither is the same quantity:

     · The tank table holds ABSOLUTE HYDRAULIC ROUGHNESS ε, in millimetres.
       0.045 commercial steel, 0.9 riveted steel, 0.0015 drawn stainless —
       the Moody values, and they are what a friction factor is read from.

     · The plate exchanger table holds PLATE SURFACE FINISH, in MICROMETRES,
       which its own header says: "surface roughness ε (µm)". It describes a
       manufactured finish, not a pipe wall.

   So the registry made two mistakes at once: it read micrometres as
   millimetres, and it compared a surface finish against a hydraulic
   roughness. Averaging them, or picking a winner, would have put a plate
   finish into a Moody chart. This library exists so that cannot happen:

     A PROPERTY IS IDENTIFIED BY WHAT IT PHYSICALLY IS, NOT BY ITS NAME.

   Everything else follows from that. Each record carries the quantity it
   measures, its canonical SI value, the condition it was stated at, the
   engineering source it came from and — kept separately, because they are
   not the same thing — the software file that holds it. A record whose
   condition or source is unknown says so and is not allowed to propagate
   into a calculation on its own.

   WHAT THIS DOES NOT DO. It does not replace the module tables and it does
   not touch a calculation. The plate exchanger keeps reading its own plate
   finish in micrometres, which is right for a plate exchanger; the tank
   keeps reading its own Moody roughness in millimetres, which is right for a
   tank. This layer governs, compares and explains them. Migration comes
   after verification, group by group, and never before.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* ══ 1 · PROPERTY TAXONOMY ══════════════════════════════════════════════
     A quantity, not a word. Two entries that measure different physical
     things are different properties even where a module calls them the same,
     and they are never compared with each other. */
  var PROPS = {
    rho: {
      label: 'Density', quantity: 'density', si: 'kg/m³', cat: 'PHYSICAL',
      display: [['kg/m³', 1], ['g/cm³', 0.001], ['lb/ft³', 0.062428]]
    },
    mu: {
      label: 'Dynamic viscosity', quantity: 'dynamic-viscosity', si: 'Pa·s', cat: 'TRANSPORT',
      display: [['Pa·s', 1], ['cP', 1000], ['mPa·s', 1000]]
    },
    cp: {
      label: 'Specific heat capacity', quantity: 'specific-heat', si: 'J/kg·K', cat: 'THERMAL',
      display: [['J/kg·K', 1], ['kJ/kg·K', 0.001]]
    },
    k: {
      label: 'Thermal conductivity', quantity: 'thermal-conductivity', si: 'W/m·K', cat: 'THERMAL',
      display: [['W/m·K', 1]]
    },
    S: {
      label: 'Allowable stress', quantity: 'allowable-stress', si: 'Pa', cat: 'MECHANICAL',
      display: [['MPa', 1e-6], ['Pa', 1], ['ksi', 1.4504e-7]],
      /* Phase 08: an allowable is meaningless without grade, temperature,
         product form and the code it was taken from. */
      needs: ['grade', 'temperature', 'code']
    },
    epsHyd: {
      label: 'Absolute hydraulic roughness ε', quantity: 'hydraulic-roughness', si: 'm',
      cat: 'PHYSICAL', display: [['mm', 1000], ['µm', 1e6], ['in', 39.3701]],
      note: 'The wall roughness a friction factor is read from — Moody / Colebrook. '
          + 'Not a manufactured surface finish.'
    },
    finishRa: {
      label: 'Surface finish Ra', quantity: 'surface-finish', si: 'm',
      cat: 'MANUFACTURING', display: [['µm', 1e6], ['mm', 1000]],
      note: 'Arithmetic mean manufactured finish. Describes how a surface was '
          + 'made, not how a pipe resists flow. Never use in a friction factor.'
    },
    corr: {
      label: 'Corrosion rate', quantity: 'corrosion-rate', si: 'm/s', cat: 'CHEMICAL',
      display: [['mm/yr', 3.1536e10]]
    },
    fouling: {
      label: 'Fouling resistance', quantity: 'fouling-resistance', si: 'm²·K/W',
      cat: 'THERMAL', display: [['m²·K/W', 1]]
    }
  };

  /* Properties that measure different quantities are never compared. */
  function comparable(a, b) {
    return PROPS[a] && PROPS[b] && PROPS[a].quantity === PROPS[b].quantity;
  }

  /* ══ 2 · UNIT NORMALISATION ═════════════════════════════════════════════
     Declared per table, never guessed from magnitude. Everything is held in
     the canonical SI unit of its property and converted only for display. */
  var UNITS = {
    'kg/m³': 1, 'Pa·s': 1, 'cP': 1e-3, 'mPa·s': 1e-3,
    'J/kg·K': 1, 'kJ/kg·K': 1e3, 'W/m·K': 1,
    'MPa': 1e6, 'Pa': 1,
    'm': 1, 'mm': 1e-3, 'µm': 1e-6,
    'mm/yr': 1 / 3.1536e10, 'm²·K/W': 1
  };
  function toSI(v, unit) {
    var f = UNITS[unit];
    return (typeof f === 'number' && isFinite(v)) ? v * f : NaN;
  }
  function fromSI(v, prop, unit) {
    var p = PROPS[prop];
    if (!p) return v;
    for (var i = 0; i < p.display.length; i++) {
      if (p.display[i][0] === (unit || p.display[0][0])) return v * p.display[i][1];
    }
    return v;
  }
  function bestUnit(prop) { return PROPS[prop] ? PROPS[prop].display[0][0] : ''; }

  /* ══ 3 · SOURCES ════════════════════════════════════════════════════════
     An engineering source and a software source are different claims. A file
     path says where a number is stored. It says nothing about where the
     number came from, and printing it under "source" implied a provenance
     the application never had. */
  var ENG = {
    MOODY: { name: 'Moody / Colebrook pipe roughness data', type: 'REFERENCE HANDBOOK' },
    PLATE: { name: 'Chevron-plate manufacturer finish data', type: 'MANUFACTURER TYPICAL' },
    ASME2: { name: 'ASME BPVC Section II Part D — allowable stress', type: 'CODE' },
    HXREF: { name: 'Heat-exchanger design reference property tables', type: 'REFERENCE HANDBOOK' },
    TEMA: { name: 'TEMA fouling resistance tables', type: 'STANDARD' },
    MATREF: { name: 'Material property reference tables', type: 'REFERENCE HANDBOOK' },
    NONE: { name: 'Not verified', type: 'UNVERIFIED' }
  };

  /* ══ 4 · STATUS AND PROPAGATION POLICY ══════════════════════════════════ */
  var STATUS = {
    'VERIFIED REFERENCE': { auto: 'ALLOWED', rank: 0 },
    'REFERENCE': { auto: 'CAUTION', rank: 1 },
    'PROJECT DEFAULT': { auto: 'ALLOWED', rank: 1 },
    'CALCULATED': { auto: 'ALLOWED', rank: 1 },
    'USER VALUE': { auto: 'CAUTION', rank: 2 },
    'USER OVERRIDE': { auto: 'CAUTION', rank: 2 },
    'MODULE OVERRIDE': { auto: 'CAUTION', rank: 2 },
    'CONDITION UNKNOWN': { auto: 'BLOCKED', rank: 3 },
    'SOURCE MISSING': { auto: 'BLOCKED', rank: 3 },
    'CONFLICT': { auto: 'BLOCKED', rank: 4 },
    'DEPRECATED': { auto: 'BLOCKED', rank: 5 },
    'NOT VERIFIED': { auto: 'BLOCKED', rank: 3 }
  };
  function autoApply(status) { return (STATUS[status] || {}).auto || 'BLOCKED'; }

  /* ══ 5 · WHERE THE DATA LIVES TODAY ═════════════════════════════════════
     Each table declares the unit and the property type of every column it
     contributes, so nothing downstream has to infer either. Where a table's
     own header states the unit, that is what is recorded here — the plate
     table says micrometres, so it is read as micrometres. */
  function TABLES() {
    var T = [];
    function add(o) { if (o.table) T.push(o); }

    add({
      id: 'phe-fluids', kind: 'fluid', module: 'Plate Heat Exchanger',
      soft: 'lib/aro-phe.js', eng: ENG.HXREF,
      cols: { rho: ['rho', 'kg/m³'], mu: ['mu', 'Pa·s'], cp: ['cp', 'J/kg·K'], k: ['k', 'W/m·K'] },
      table: window.AROPHE && window.AROPHE.fluids
    });
    add({
      id: 'sthe-fluids', kind: 'fluid', module: 'Shell & Tube Exchanger',
      soft: 'app.js', eng: ENG.HXREF,
      cols: { rho: ['rho', 'kg/m³'], mu: ['mu', 'cP'], cp: ['cp', 'kJ/kg·K'], k: ['k', 'W/m·K'] },
      table: window.STHE_FLUIDS
    });
    add({
      id: 'dphe-fluids', kind: 'fluid', module: 'Double Pipe Exchanger',
      soft: 'app.js', eng: ENG.HXREF,
      cols: { rho: ['rho', 'kg/m³'], mu: ['mu', 'cP'], cp: ['cp', 'kJ/kg·K'], k: ['k', 'W/m·K'] },
      table: window.DPHE_FLUIDS
    });

    add({
      id: 'phe-materials', kind: 'material', module: 'Plate Heat Exchanger',
      soft: 'lib/aro-phe.js', eng: ENG.MATREF,
      /* The header of that table reads: "surface roughness ε (µm)". It is a
         plate finish in micrometres, and it is recorded as one — with the
         finish datasheet named as the source of the finish alone. A table
         default applied to every column would have credited the density and
         the conductivity of stainless steel to a plate finish datasheet. */
      cols: {
        k: ['k', 'W/m·K'], rho: ['rho', 'kg/m³'],
        S: ['S', 'MPa', ENG.ASME2], finishRa: ['rough', 'µm', ENG.PLATE],
        corr: ['corr', 'mm/yr']
      },
      table: window.AROPHE && window.AROPHE.materials
    });
    add({
      id: 'tank-materials', kind: 'material', module: 'Storage Tank',
      soft: 'lib/aro-tank.js', eng: ENG.MATREF,
      /* 0.045 commercial steel, 0.9 riveted, 0.0015 drawn stainless, in
         millimetres — the Moody absolute roughnesses. */
      cols: {
        rho: ['rho', 'kg/m³'], S: ['S', 'MPa', ENG.ASME2], epsHyd: ['rough', 'mm', ENG.MOODY]
      },
      table: window.AROTANK && window.AROTANK.materials
    });
    add({
      id: 'dphe-materials', kind: 'material', module: 'Double Pipe Exchanger',
      soft: 'app.js', eng: ENG.HXREF,
      cols: { k: ['kw', 'W/m·K'], fouling: ['fouling', 'm²·K/W', ENG.TEMA] },
      table: window.DPHE_MATERIALS
    });
    return T;
  }

  /* ══ 6 · IDENTITY ═══════════════════════════════════════════════════════
     A parenthetical is not always decoration. "(80°C)" is a condition and
     "(Light)" is a grade, and folding either away merges two different
     records. Crude Oil (Light) at 5 cP and Crude Oil (Heavy) at 50 cP were
     being reported as one substance disagreeing with itself tenfold. */
  /* "liq" and "Liquid" are the same qualifier written two ways, and left
     alone they split one substance into two entries that then look like two
     independent sources agreeing. Normalise the wording; keep the meaning. */
  var QUAL_ALIAS = {
    liq: 'liquid', liquid: 'liquid', l: 'liquid',
    vap: 'vapour', vapor: 'vapour', vapour: 'vapour', gas: 'vapour', g: 'vapour',
    sol: 'solid', solid: 'solid',
    lt: 'light', light: 'light', hvy: 'heavy', heavy: 'heavy', med: 'medium',
    medium: 'medium', sat: 'saturated', saturated: 'saturated'
  };
  function normQual(t) {
    var w = String(t).toLowerCase().trim();
    return QUAL_ALIAS[w] || w;
  }

  var CONDITION_RE = /^[^a-z]*[0-9]/i;
  function parse(name) {
    var s = String(name), qual = [], cond = null;
    s = s.replace(/\(([^)]*)\)/g, function (all, inner) {
      var t = String(inner).trim();
      if (!t) return ' ';
      if (CONDITION_RE.test(t) && /°|deg|c\b|k\b|bar|kpa|mpa/i.test(t)) { cond = t; return ' '; }
      if (/^[0-9.\s°cCkKfF-]+$/.test(t)) { cond = t; return ' '; }
      qual.push(normQual(t));
      return ' ' + normQual(t) + ' ';
    });
    var base = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return { key: base, condition: cond, grade: qual.join(' ') || null };
  }

  /* ══ 7 · BUILD ══════════════════════════════════════════════════════════ */
  var REC = null, INDEX = null, QA = null;

  function build() {
    REC = []; INDEX = { fluid: {}, material: {} };
    var seq = 0;

    TABLES().forEach(function (t) {
      Object.keys(t.table).forEach(function (rowKey) {
        var row = t.table[rowKey];
        if (!row || typeof row !== 'object') return;
        var disp = (typeof row.name === 'string' && row.name) ? row.name : rowKey;
        var p = parse(disp);
        if (!p.key) return;

        var bag = INDEX[t.kind];
        var ent = bag[p.key] || (bag[p.key] = {
          key: p.key, kind: t.kind, name: disp, aliases: [], grades: [], props: {}
        });
        if (ent.aliases.indexOf(disp) < 0) ent.aliases.push(disp);
        if (p.grade && ent.grades.indexOf(p.grade) < 0) ent.grades.push(p.grade);
        if (disp.length < ent.name.length && !p.grade) ent.name = disp;

        Object.keys(t.cols).forEach(function (prop) {
          var spec = t.cols[prop];
          var field = spec[0], unit = spec[1], eng = spec[2] || t.eng;
          var raw = row[field];
          if (typeof raw !== 'number' || !isFinite(raw)) return;
          var si = toSI(raw, unit);
          if (!isFinite(si)) return;

          var status = 'REFERENCE';
          if (eng === ENG.NONE) status = 'NOT VERIFIED';
          else if (PROPS[prop] && PROPS[prop].needs && !p.condition) status = 'CONDITION UNKNOWN';

          var r = {
            id: 'R' + (++seq),
            subject: ent.name, subjectKey: p.key, kind: t.kind,
            grade: p.grade, prop: prop, label: PROPS[prop].label,
            quantity: PROPS[prop].quantity, category: PROPS[prop].cat,
            si: si, siUnit: PROPS[prop].si,
            raw: raw, rawUnit: unit,
            condition: p.condition,
            engSource: eng.name, engType: eng.type,
            softSource: t.soft, module: t.module, tableId: t.id,
            status: status, verdict: null, note: PROPS[prop].note || null
          };
          REC.push(r);
          (ent.props[prop] = ent.props[prop] || []).push(r);
        });
      });
    });

    runQA();
  }

  /* ══ 8 · LIBRARY DATA QA ════════════════════════════════════════════════
     Every verdict names a cause. "These two numbers differ" is not a
     finding an engineer can act on; "these two numbers measure different
     quantities" is. */
  function runQA() {
    QA = { verdicts: [], counts: {}, total: REC.length };

    function flag(v) {
      QA.verdicts.push(v);
      QA.counts[v.verdict] = (QA.counts[v.verdict] || 0) + 1;
    }

    /* per-record hygiene */
    REC.forEach(function (r) {
      if (!r.condition && PROPS[r.prop].needs) {
        flag({ verdict: 'MISSING CONDITION', subject: r.subject, prop: r.prop,
          label: r.label, detail: 'Stated with no temperature. An allowable stress '
            + 'without a temperature and a code is not a design value.', recs: [r] });
      }
      if (r.engType === 'UNVERIFIED') {
        flag({ verdict: 'MISSING SOURCE', subject: r.subject, prop: r.prop,
          label: r.label, detail: 'No engineering source recorded.', recs: [r] });
      }
    });

    /* cross-table comparison, within one quantity only */
    ['fluid', 'material'].forEach(function (kind) {
      var bag = INDEX[kind];
      Object.keys(bag).forEach(function (key) {
        var ent = bag[key];

        /* Different quantities that a module happened to call the same thing.
           Reported so the engineer can see the two tables are not in
           disagreement — they are describing different physics. */
        var byQuantity = {};
        Object.keys(ent.props).forEach(function (prop) {
          var q = PROPS[prop].quantity;
          (byQuantity[q] = byQuantity[q] || []).push(prop);
        });
        if (ent.props.epsHyd && ent.props.finishRa) {
          flag({
            verdict: 'DIFFERENT PROPERTY TYPE', subject: ent.name, prop: 'epsHyd',
            label: 'Roughness',
            detail: 'Two tables state a "roughness" for this material and they are not '
              + 'the same quantity. ' + ent.props.epsHyd[0].module + ' holds absolute '
              + 'hydraulic roughness ε (' + fmt(fromSI(ent.props.epsHyd[0].si, 'epsHyd'), 4)
              + ' mm), which is what a friction factor is read from. '
              + ent.props.finishRa[0].module + ' holds a plate surface finish ('
              + fmt(fromSI(ent.props.finishRa[0].si, 'finishRa'), 3)
              + ' µm), which describes manufacture. They must not be reconciled.',
            recs: ent.props.epsHyd.concat(ent.props.finishRa)
          });
        }

        Object.keys(ent.props).forEach(function (prop) {
          var list = ent.props[prop];
          if (list.length < 2) return;

          /* Records carrying different grades are different substances. */
          var grades = {};
          list.forEach(function (r) { grades[r.grade || ''] = true; });
          if (Object.keys(grades).length > 1) {
            flag({
              verdict: 'DIFFERENT GRADE', subject: ent.name, prop: prop, label: PROPS[prop].label,
              detail: 'These records describe different grades — '
                + list.map(function (r) { return (r.grade || 'unqualified') + ' '
                  + fmt(fromSI(r.si, prop), 4) + ' ' + bestUnit(prop); }).join(', ')
                + '. A difference between grades is not a conflict.',
              recs: list.slice()
            });
            return;
          }

          /* Records stated at different conditions are not in conflict either. */
          var conds = {};
          list.forEach(function (r) { conds[r.condition || ''] = true; });

          var vals = list.map(function (r) { return r.si; });
          var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
          var ratio = lo > 0 ? hi / lo : Infinity;
          if (ratio <= 1.02) return;                       /* rounding between tables */

          if (Object.keys(conds).length > 1) {
            flag({
              verdict: 'DIFFERENT CONDITION', subject: ent.name, prop: prop,
              label: PROPS[prop].label,
              detail: 'Stated at different conditions — '
                + list.map(function (r) { return (r.condition || 'condition not stated') + ': '
                  + fmt(fromSI(r.si, prop), 4) + ' ' + bestUnit(prop); }).join(', ') + '.',
              recs: list.slice(), ratio: ratio
            });
            return;
          }

          flag({
            verdict: 'CONFLICT', subject: ent.name, prop: prop, label: PROPS[prop].label,
            detail: list.map(function (r) {
              return r.module + ' ' + fmt(fromSI(r.si, prop), 4) + ' ' + bestUnit(prop);
            }).join('  vs  ') + '  ·  ' + fmt(ratio, 1) + '× apart, same quantity, '
              + 'same condition, same grade.',
            recs: list.slice(), ratio: ratio
          });
          list.forEach(function (r) { r.status = 'CONFLICT'; });
        });
      });
    });

    QA.verdicts.sort(function (a, b) {
      var w = { 'CONFLICT': 0, 'UNIT MISMATCH': 1, 'DIFFERENT PROPERTY TYPE': 2,
        'DIFFERENT GRADE': 3, 'DIFFERENT CONDITION': 4, 'MISSING SOURCE': 5,
        'MISSING CONDITION': 6 };
      var d = (w[a.verdict] == null ? 9 : w[a.verdict]) - (w[b.verdict] == null ? 9 : w[b.verdict]);
      if (d) return d;
      return (b.ratio || 0) - (a.ratio || 0);
    });

    QA.matching = REC.length - REC.filter(function (r) { return r.status === 'CONFLICT'; }).length;
  }

  function ensure() { if (!REC) build(); }

  /* ══ 9 · WHERE USED ═════════════════════════════════════════════════════
     Which live module controls currently name this subject. Read from the
     DOM, so a control that has been renamed shows up as absent rather than
     as a silent gap. */
  var LINKS = [
    { id: 'pump-fluid', label: 'Pump Hydraulics', kind: 'fluid' },
    { id: 'lq-fluid', label: 'Liquid Line Sizing', kind: 'fluid' },
    { id: 'gs-fluid', label: 'Gas Line Sizing', kind: 'fluid' },
    { id: 'st-fluid', label: 'Steam Line Sizing', kind: 'fluid' },
    { id: 'sl-fluid', label: 'Slurry Line Sizing', kind: 'fluid' },
    { id: 'sthe-fluid-tube-select', label: 'Shell & Tube — tube side', kind: 'fluid' },
    { id: 'sthe-fluid-shell-select', label: 'Shell & Tube — shell side', kind: 'fluid' },
    { id: 'dphe-fluid-hot-select', label: 'Double Pipe — hot side', kind: 'fluid' },
    { id: 'dphe-fluid-cold-select', label: 'Double Pipe — cold side', kind: 'fluid' },
    { id: 'phe-hf-name', label: 'Plate Exchanger — hot side', kind: 'fluid' },
    { id: 'phe-cf-name', label: 'Plate Exchanger — cold side', kind: 'fluid' },
    { id: 'tk-mat', label: 'Storage Tank', kind: 'material' },
    { id: 'phe-mat', label: 'Plate Exchanger', kind: 'material' },
    { id: 'dphe-mat-hot', label: 'Double Pipe — hot material', kind: 'material' }
  ];

  function whereUsed(subjectKey, kind) {
    var out = [];
    LINKS.forEach(function (lk) {
      if (lk.kind !== kind) return;
      var el = document.getElementById(lk.id);
      if (!el) return;
      var shown = el.value;
      if (el.tagName === 'SELECT' && el.selectedIndex >= 0 && el.options[el.selectedIndex]) {
        shown = el.options[el.selectedIndex].text;
      }
      if (!shown) return;
      if (parse(shown).key === subjectKey) out.push({ module: lk.label, value: String(shown).trim() });
    });
    return out;
  }

  /* ══ 10 · SEARCH AND FILTER ═════════════════════════════════════════════ */
  var SYNONYM = {
    'sthe': 'shell tube', 'dphe': 'double pipe', 'phe': 'plate',
    'ss': 'stainless', 'cs': 'carbon steel', 'visc': 'viscosity',
    'rough': 'roughness', 'cond': 'conductivity', 'centrif': 'centrifugal'
  };
  function expand(q) {
    var t = String(q || '').toLowerCase().trim();
    if (!t) return [];
    return t.split(/\s+/).map(function (w) { return SYNONYM[w] || w; });
  }

  function subjects(kind) {
    ensure();
    var bag = INDEX[kind] || {};
    return Object.keys(bag).map(function (k) { return bag[k]; });
  }

  function search(q, o) {
    o = o || {};
    var terms = expand(q);
    var list = [];
    ['fluid', 'material'].forEach(function (kind) {
      if (o.kind && o.kind !== kind) return;
      subjects(kind).forEach(function (e) { list.push(e); });
    });
    if (terms.length) {
      list = list.filter(function (e) {
        var hay = (e.name + ' ' + e.aliases.join(' ') + ' ' + e.grades.join(' ') + ' '
          + Object.keys(e.props).map(function (p) { return PROPS[p].label; }).join(' ')).toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) >= 0; });
      });
    }
    if (o.status) {
      list = list.filter(function (e) {
        return Object.keys(e.props).some(function (p) {
          return e.props[p].some(function (r) { return r.status === o.status; });
        });
      });
    }
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return list;
  }

  function fmt(v, d) {
    if (!isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e6)) return Number(v).toExponential(2);
    return Number(v).toFixed(d == null ? 3 : d).replace(/\.?0+$/, '');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ══ 11 · UI ════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-englib-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-englib{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;}',
      '.el-h{background:rgba(56,189,248,.08);border-bottom:1px solid var(--border-muted);padding:10px 12px;}',
      '.el-h b{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#38bdf8;}',
      '.el-sub{font-size:10.5px;color:var(--text-muted);margin-top:3px;line-height:1.5;}',
      '.el-qa{display:flex;flex-wrap:wrap;gap:6px;padding:9px 12px;border-bottom:1px solid var(--border-muted);}',
      '.el-chip{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.05em;padding:4px 8px;',
      '  border-radius:3px;border:1px solid var(--border-muted);cursor:pointer;background:transparent;color:var(--text-muted);}',
      '.el-chip.on{background:#38bdf8;border-color:#38bdf8;color:#04121e;font-weight:800;}',
      '.el-chip b{color:inherit;}',
      '.el-chip.bad{border-color:#f87171;color:#f87171;}',
      '.el-chip.bad.on{background:#f87171;color:#180606;}',
      '.el-chip.warn{border-color:#fbbf24;color:#fbbf24;}',
      '.el-chip.warn.on{background:#fbbf24;color:#1a1204;}',
      '.el-chip.ok{border-color:#4ade80;color:#4ade80;}',
      '.el-chip.ok.on{background:#4ade80;border-color:#4ade80;color:#04180b;}',
      '.el-search{display:flex;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border-muted);}',
      '.el-search input{flex:1;background:var(--surface-2,rgba(148,163,184,.08));border:1px solid var(--border-muted);',
      '  border-radius:4px;padding:7px 9px;color:inherit;font-family:var(--font-mono);font-size:11px;}',
      '.el-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);min-height:0;}',
      '@media(max-width:900px){.el-body{grid-template-columns:1fr;}}',
      '.el-list{max-height:460px;overflow-y:auto;border-right:1px solid var(--border-muted);}',
      '.el-row{padding:7px 12px;border-bottom:1px dashed var(--border-muted);cursor:pointer;}',
      '.el-row:hover{background:rgba(56,189,248,.07);}',
      '.el-row.sel{background:rgba(56,189,248,.13);}',
      '.el-rn{font-family:var(--font-mono);font-size:11px;font-weight:700;}',
      '.el-rm{font-size:9.5px;color:var(--text-muted);margin-top:2px;}',
      '.el-det{padding:12px;max-height:460px;overflow-y:auto;}',
      '.el-det h4{font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;color:#38bdf8;margin:0 0 8px;}',
      '.el-pr{border:1px solid var(--border-muted);border-radius:5px;padding:9px 10px;margin-bottom:8px;}',
      '.el-pt{font-family:var(--font-mono);font-size:10.5px;font-weight:800;}',
      '.el-pv{font-family:var(--font-mono);font-size:14px;font-weight:800;margin:3px 0;color:inherit;}',
      '.el-kv{display:grid;grid-template-columns:118px 1fr;gap:2px 8px;font-size:10px;margin-top:5px;}',
      '.el-kv span:nth-child(odd){color:var(--text-muted);letter-spacing:.04em;}',
      '.el-note{font-size:10px;line-height:1.55;color:#93c5fd;margin-top:6px;',
      '  border-left:2px solid #38bdf8;padding-left:7px;}',
      '.el-v{border:1px solid var(--border-muted);border-left-width:3px;border-radius:4px;',
      '  padding:8px 10px;margin-bottom:7px;font-size:10.5px;line-height:1.55;}',
      '.el-v.CONFLICT{border-left-color:#f87171;}',
      '.el-v.UNITMISMATCH{border-left-color:#f87171;}',
      '.el-v.DIFFERENTPROPERTYTYPE{border-left-color:#38bdf8;}',
      '.el-v.DIFFERENTGRADE{border-left-color:#a78bfa;}',
      '.el-v.DIFFERENTCONDITION{border-left-color:#fbbf24;}',
      '.el-v.MISSINGCONDITION{border-left-color:#fbbf24;}',
      '.el-v.MISSINGSOURCE{border-left-color:#fbbf24;}',
      '.el-vt{font-family:var(--font-mono);font-size:9.5px;font-weight:800;letter-spacing:.07em;}',
      '.el-auto{font-family:var(--font-mono);font-size:9px;letter-spacing:.05em;padding:2px 6px;',
      '  border-radius:3px;display:inline-block;}',
      '.el-auto.ALLOWED{background:rgba(74,222,128,.15);color:#4ade80;}',
      '.el-auto.CAUTION{background:rgba(251,191,36,.15);color:#fbbf24;}',
      '.el-auto.BLOCKED{background:rgba(248,113,113,.15);color:#f87171;}',
      '.el-empty{padding:22px 12px;text-align:center;font-size:11px;color:var(--text-muted);}'
    ].join('');
    document.head.appendChild(s);
  }

  var UI = { q: '', kind: '', verdict: '', sel: null, tab: 'library' };

  function qaBar() {
    var c = QA.counts;
    function chip(key, label, cls) {
      var n = key === '__all' ? QA.total : (c[key] || 0);
      if (key !== '__all' && !n) return '';
      var on = (key === '__all' ? !UI.verdict : UI.verdict === key) ? ' on' : '';
      return '<button class="el-chip ' + cls + on + '" data-el-verdict="'
        + esc(key === '__all' ? '' : key) + '"><b>' + n + '</b> ' + esc(label) + '</button>';
    }
    return '<div class="el-qa">'
      + chip('__all', 'records', 'ok')
      + chip('CONFLICT', 'conflicts', 'bad')
      + chip('DIFFERENT PROPERTY TYPE', 'different property', '')
      + chip('DIFFERENT GRADE', 'different grade', '')
      + chip('DIFFERENT CONDITION', 'different condition', 'warn')
      + chip('MISSING CONDITION', 'missing condition', 'warn')
      + chip('MISSING SOURCE', 'missing source', 'warn')
      + '</div>';
  }

  function listFor() {
    if (UI.verdict) {
      var seen = {}, out = [];
      QA.verdicts.forEach(function (v) {
        if (v.verdict !== UI.verdict) return;
        v.recs.forEach(function (r) {
          var bag = INDEX[r.kind], e = bag[r.subjectKey];
          if (e && !seen[r.kind + '|' + r.subjectKey]) { seen[r.kind + '|' + r.subjectKey] = 1; out.push(e); }
        });
      });
      return out;
    }
    return search(UI.q, { kind: UI.kind });
  }

  function detailHtml(e) {
    if (!e) return '<div class="el-empty">Select an entry to see its properties, '
      + 'where each value came from and where it is used.</div>';
    var h = '<h4>' + esc(e.name.toUpperCase()) + '</h4>';
    if (e.grades.length) {
      h += '<div class="el-rm" style="margin-bottom:8px;">GRADES · ' + esc(e.grades.join(' · ')) + '</div>';
    }

    var used = whereUsed(e.key, e.kind);
    h += '<div class="el-pr"><div class="el-pt">WHERE USED</div>'
      + (used.length
        ? '<div class="el-kv">' + used.map(function (u) {
          return '<span>' + esc(u.module) + '</span><span>' + esc(u.value) + '</span>';
        }).join('') + '</div>'
        : '<div class="el-rm">No module is currently set to this entry.</div>')
      + '</div>';

    Object.keys(e.props).forEach(function (prop) {
      var list = e.props[prop], P = PROPS[prop];
      h += '<div class="el-pr"><div class="el-pt">' + esc(P.label.toUpperCase())
        + '  <span style="color:var(--text-muted);font-weight:400;">· ' + esc(P.cat) + '</span></div>';
      list.forEach(function (r) {
        var u = bestUnit(prop);
        h += '<div class="el-pv">' + esc(fmt(fromSI(r.si, prop), 4)) + ' ' + esc(u) + '</div>';
        h += '<div class="el-kv">'
          + '<span>CANONICAL SI</span><span>' + esc(fmt(r.si, 6)) + ' ' + esc(r.siUnit) + '</span>'
          + '<span>AS TABULATED</span><span>' + esc(fmt(r.raw, 4)) + ' ' + esc(r.rawUnit) + '</span>'
          + '<span>CONDITION</span><span>' + esc(r.condition || 'NOT STATED') + '</span>'
          + (r.grade ? '<span>GRADE</span><span>' + esc(r.grade) + '</span>' : '')
          + '<span>ENGINEERING SOURCE</span><span>' + esc(r.engSource)
          + ' <span style="color:var(--text-muted);">(' + esc(r.engType) + ')</span></span>'
          + '<span>SOFTWARE SOURCE</span><span>' + esc(r.softSource)
          + ' <span style="color:var(--text-muted);">· ' + esc(r.module) + '</span></span>'
          + '<span>STATUS</span><span>' + esc(r.status)
          + ' <span class="el-auto ' + esc(autoApply(r.status)) + '">AUTO-APPLY '
          + esc(autoApply(r.status)) + '</span></span>'
          + '</div>';
      });
      if (P.note) h += '<div class="el-note">' + esc(P.note) + '</div>';
      h += '</div>';
    });

    var mine = QA.verdicts.filter(function (v) {
      return v.recs.some(function (r) { return r.subjectKey === e.key && r.kind === e.kind; });
    });
    if (mine.length) {
      h += '<h4 style="margin-top:12px;">DATA QA</h4>';
      mine.forEach(function (v) {
        h += '<div class="el-v ' + esc(v.verdict.replace(/\s+/g, '')) + '">'
          + '<div class="el-vt">' + esc(v.verdict) + ' · ' + esc(v.label) + '</div>'
          + '<div style="margin-top:4px;">' + esc(v.detail) + '</div></div>';
      });
    }
    return h;
  }

  function html() {
    ensure();
    var list = listFor();
    return '<div id="aro-englib">'
      + '<div class="el-h"><b>AROGARA COMMON ENGINEERING LIBRARY</b>'
      + '<div class="el-sub">One governed record per property. Each carries the quantity it '
      + 'measures, its canonical SI value, the condition it was stated at, the engineering '
      + 'source it came from and — separately — the software file that holds it. '
      + 'The module tables are indexed here, not replaced: no calculation reads through '
      + 'this layer yet.</div></div>'
      + qaBar()
      + '<div class="el-search">'
      + '<input id="el-q" type="search" placeholder="Search fluids, materials, properties, grades…" '
      + 'value="' + esc(UI.q) + '" autocomplete="off">'
      + '<button class="el-chip' + (UI.kind === '' ? ' on' : '') + '" data-el-kind="">ALL</button>'
      + '<button class="el-chip' + (UI.kind === 'fluid' ? ' on' : '') + '" data-el-kind="fluid">FLUIDS</button>'
      + '<button class="el-chip' + (UI.kind === 'material' ? ' on' : '') + '" data-el-kind="material">MATERIALS</button>'
      + '</div>'
      + '<div class="el-body"><div class="el-list">'
      + (list.length ? list.map(function (e) {
        var sel = UI.sel === (e.kind + '|' + e.key) ? ' sel' : '';
        var props = Object.keys(e.props).map(function (p) { return PROPS[p].label; });
        return '<div class="el-row' + sel + '" data-el-pick="' + esc(e.kind + '|' + e.key) + '">'
          + '<div class="el-rn">' + esc(e.name) + '</div>'
          + '<div class="el-rm">' + esc(e.kind.toUpperCase()) + ' · '
          + props.length + ' propert' + (props.length === 1 ? 'y' : 'ies') + ' · '
          + esc(props.slice(0, 3).join(', ')) + '</div></div>';
      }).join('') : '<div class="el-empty">Nothing matches that search.</div>')
      + '</div><div class="el-det">' + detailHtml(current()) + '</div></div></div>';
  }

  function current() {
    if (!UI.sel) return null;
    var p = UI.sel.split('|');
    return (INDEX[p[0]] || {})[p[1]] || null;
  }

  function render(force) {
    var tab = document.getElementById('project-tab');
    if (!tab || !tab.offsetParent) return;
    css();
    var host = document.getElementById('aro-englib-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-englib-host';
      tab.appendChild(host);
    } else if (!force && host.getAttribute('data-sig') === sig()) {
      return;
    }
    host.setAttribute('data-sig', sig());
    try { host.innerHTML = html(); } catch (e) { host.innerHTML = ''; }
  }
  function sig() { return [UI.q, UI.kind, UI.verdict, UI.sel].join(''); }

  /* ── events ───────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-el-pick],[data-el-kind],[data-el-verdict]') : null;
    if (!t) return;
    if (t.hasAttribute('data-el-pick')) { UI.sel = t.getAttribute('data-el-pick'); }
    else if (t.hasAttribute('data-el-kind')) { UI.kind = t.getAttribute('data-el-kind'); UI.sel = null; }
    else { UI.verdict = t.getAttribute('data-el-verdict'); UI.sel = null; }
    e.preventDefault();
    render(true);
  }, true);

  var typing = null;
  document.addEventListener('input', function (e) {
    if (!e.target || e.target.id !== 'el-q') return;
    UI.q = e.target.value;
    UI.verdict = '';
    if (typing) clearTimeout(typing);
    typing = setTimeout(function () {
      typing = null;
      render(true);
      var el = document.getElementById('el-q');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 180);
  }, true);

  /* ══ 12 · EXPORTS ═══════════════════════════════════════════════════════ */
  window.AROENGLIB = {
    props: function () { return PROPS; },
    records: function () { ensure(); return REC.slice(); },
    subjects: subjects,
    search: search,
    qa: function () { ensure(); return QA; },
    whereUsed: whereUsed,
    autoApply: autoApply,
    toSI: toSI, fromSI: fromSI,
    comparable: comparable,
    parse: parse,
    rebuild: function () { REC = null; ensure(); render(true); },
    render: function () { render(true); }
  };

  function boot() {
    var iv = setInterval(function () {
      var tab = document.getElementById('project-tab');
      if (tab && tab.offsetParent) { render(true); clearInterval(iv); }
    }, 700);
    setTimeout(function () { clearInterval(iv); }, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ══════════════════════════════════════════════════════════════════════
   ARO — STORAGE TANK DESIGN MODULE  (window.AROTANK)
   Implements the client's Tank_design workbook exactly:
     L/D              = H / D
     Geometric cap.   = π/4 · D² · H
     LLLL             = MAX(nozzleCL + nozzleRadius + liqAboveNozzle, specReq)
     LLLL→LLL         = MAX(residence-time height, API 650 minimum)
     HHLL from curb   = MAX(overflowNozzle" · 1.5 · 25.4, project minimum)
     HHLL→HLL         = MAX(residence-time height, API 650 minimum)
     Working height   = H − (LLLL + LLLL→LLL + HHLLcurb + HHLL→HLL)
     Working capacity = π/4 · D² · workingHeight     → PASS if ≥ required
   plus API 650 shell thickness (1-Foot Method), a material library with
   densities for weight take-off, live 3D, GA drawing + BOM and a report.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── Material library: density for weight, allowable stress, roughness ─── */
  var MATERIALS = {
    'CS (A36 / IS 2062)':      { rho: 7850, S: 137, rough: 0.045 },
    'MS':                      { rho: 7850, S: 130, rough: 0.045 },
    'GI':                      { rho: 7870, S: 130, rough: 0.150 },
    'Commercial / welded steel':{ rho: 7850, S: 137, rough: 0.045 },
    'Alloy Steel':             { rho: 7850, S: 160, rough: 0.045 },
    'Riveted steel':           { rho: 7850, S: 120, rough: 0.900 },
    'SS304':                   { rho: 8000, S: 138, rough: 0.0015 },
    'SS304L':                  { rho: 8000, S: 115, rough: 0.0015 },
    'SS316':                   { rho: 8000, S: 138, rough: 0.0015 },
    'SS316L':                  { rho: 8000, S: 115, rough: 0.0015 },
    'SS321':                   { rho: 8030, S: 138, rough: 0.0015 },
    'SS310':                   { rho: 7980, S: 130, rough: 0.0015 },
    'Duplex SS (2205)':        { rho: 7800, S: 240, rough: 0.0015 },
    'Super Duplex SS (2507)':  { rho: 7810, S: 270, rough: 0.0015 },
    'Cast iron':               { rho: 7200, S: 90,  rough: 0.260 },
    'Asphalted cast iron':     { rho: 7200, S: 90,  rough: 0.120 },
    'Wrought iron':            { rho: 7750, S: 100, rough: 0.045 },
    'Concrete':                { rho: 2400, S: 12,  rough: 0.300 },
    'Copper':                  { rho: 8960, S: 62,  rough: 0.0015 },
    'Brass':                   { rho: 8500, S: 70,  rough: 0.0015 },
    'PVC':                     { rho: 1400, S: 14,  rough: 0.0015 },
    'CPVC':                    { rho: 1550, S: 16,  rough: 0.0015 },
    'HDPE':                    { rho: 950,  S: 8,   rough: 0.007 },
    'FRP':                     { rho: 1800, S: 70,  rough: 0.005 },
    'PTFE Lined (CS base)':    { rho: 7850, S: 137, rough: 0.001 },
    'Rubber Lined (CS base)':  { rho: 7850, S: 137, rough: 0.010 },
    'Hastelloy C276':          { rho: 8890, S: 200, rough: 0.0015 },
    'Monel 400':               { rho: 8800, S: 160, rough: 0.0015 },
    'Inconel 600/625':         { rho: 8470, S: 200, rough: 0.0015 },
    'User defined':            { rho: null, S: null, rough: null }
  };

  /* Standard pipe NPS and outer diameters (inches) from ASME B36.10.
     For nozzle sizing suggestions based on outlet/overflow flow rates. */
  var PIPE_NPS = {
    0.5: { od: 0.840, label: '1/2"' },
    0.75: { od: 1.050, label: '3/4"' },
    1: { od: 1.315, label: '1"' },
    1.5: { od: 1.900, label: '1.5"' },
    2: { od: 2.375, label: '2"' },
    3: { od: 3.500, label: '3"' },
    4: { od: 4.500, label: '4"' },
    6: { od: 6.625, label: '6"' },
    8: { od: 8.625, label: '8"' },
    10: { od: 10.750, label: '10"' },
    12: { od: 12.750, label: '12"' }
  };
  var SCHEDULES = ['5', '10', '40', '80', '160'];

  /* Roof selection guidance by service fluid (from the design workbook). */
  var ROOF_GUIDE = {
    'Water': 'Cone Roof', 'Diesel': 'Cone Roof', 'Crude Oil': 'Internal / External Floating Roof',
    'LPG': 'Bullet / Sphere (API 620 — not API 650)', 'Food': 'Cone Roof', 'Chemical': 'Cone or Dome Roof',
    'Methanol': 'Cone Roof', 'Ethanol': 'Cone Roof', 'Benzene': 'Floating Roof or Cone + vapour recovery',
    'Toluene': 'Floating Roof or Cone + vapour recovery', 'Glycerol': 'Cone Roof',
    'Acetic Acid': 'Cone Roof (corrosion: use SS or lined steel)', 'Acetone': 'Cone Roof + vapour recovery',
    'Butanol': 'Cone Roof', 'Chloroform': 'Cone Roof', 'Ether (Diethyl)': 'Cone Roof + vapour recovery',
    'Hexane': 'Floating Roof or Cone + vapour recovery', 'Kerosene': 'Cone Roof',
    'Linseed Oil': 'Cone Roof', 'Olive Oil': 'Cone Roof', 'Phenol': 'Cone Roof (elevated temp)',
    'Sulfuric Acid': 'Cone Roof (rubber or epoxy lined)', 'Hydrochloric Acid': 'Cone Roof (rubber or epoxy lined)',
    'Nitric Acid': 'Cone Roof (SS or epoxy lined)', 'Sodium Hydroxide': 'Cone Roof',
    'Ammonia': 'Bullet / Sphere (API 620 — cryogenic)', 'Isopropanol': 'Cone Roof + vapour recovery',
    'Other': 'Cone Roof (verify with manufacturer)'
  };
  /* Typical fluid properties (SI units @ 20–25°C unless noted) from Perry's Handbook.
     Density (rho) in kg/m³, Specific Gravity (SG) @ 4°C/4°C, Viscosity (mu) in mPa·s,
     Surface Tension (sigma) in mN/m, Thermal Conductivity (lambda) in W/m·K,
     Specific Heat (cp) in kJ/kg·K, Flash Point (fp) in °C, Boiling Point (bp) in °C.
     Fluids too variable (Food, Chemical, Other) are left null for safety. */
  var FLUID_PROPS = {
    'Water': {
      rho: 1000, SG: 1.000, mu: 1.002, sigma: 72.8, lambda: 0.598, cp: 4.18,
      fp: null, bp: 100, alpha: 0.0002, note: 'Pure water @ 20°C'
    },
    'Diesel': {
      rho: 840, SG: 0.840, mu: 2.4, sigma: 31.6, lambda: 0.135, cp: 1.95,
      fp: 52, bp: 360, alpha: 0.00088, note: 'Diesel fuel (EN 590) @ 15°C'
    },
    'Crude Oil': {
      rho: 870, SG: 0.870, mu: 15, sigma: 30, lambda: 0.128, cp: 1.88,
      fp: 93, bp: 380, alpha: 0.0008, note: 'Medium crude @ 15°C, K=11 API'
    },
    'LPG': {
      rho: 540, SG: 0.540, mu: 0.14, sigma: 15, lambda: 0.090, cp: 2.27,
      fp: -104, bp: -42, alpha: 0.0016, note: 'Propane @ 20°C'
    },
    'Methanol': {
      rho: 792, SG: 0.792, mu: 0.544, sigma: 22.1, lambda: 0.202, cp: 2.53,
      fp: 11, bp: 64.7, alpha: 0.00118, note: 'Methanol @ 20°C'
    },
    'Ethanol': {
      rho: 789, SG: 0.789, mu: 1.074, sigma: 22.1, lambda: 0.168, cp: 2.44,
      fp: 13, bp: 78.3, alpha: 0.00112, note: 'Ethanol @ 20°C'
    },
    'Benzene': {
      rho: 879, SG: 0.879, mu: 0.604, sigma: 28.9, lambda: 0.139, cp: 1.72,
      fp: -11, bp: 80.1, alpha: 0.00124, note: 'Benzene @ 20°C'
    },
    'Toluene': {
      rho: 867, SG: 0.867, mu: 0.560, sigma: 27.4, lambda: 0.131, cp: 1.67,
      fp: 4, bp: 110.6, alpha: 0.00111, note: 'Toluene @ 20°C'
    },
    'Glycerol': {
      rho: 1261, SG: 1.261, mu: 934, sigma: 63.3, lambda: 0.285, cp: 2.43,
      fp: 176, bp: 290, alpha: 0.00047, note: 'Glycerol (100%) @ 20°C'
    },
    'Acetic Acid': {
      rho: 1049, SG: 1.049, mu: 1.056, sigma: 27.6, lambda: 0.171, cp: 2.05,
      fp: 39, bp: 118.1, alpha: 0.00089, note: 'Glacial acetic acid @ 20°C'
    },
    'Acetone': {
      rho: 791, SG: 0.791, mu: 0.306, sigma: 23.7, lambda: 0.153, cp: 2.15,
      fp: -20, bp: 56.0, alpha: 0.00151, note: 'Acetone @ 20°C'
    },
    'Butanol': {
      rho: 809, SG: 0.809, mu: 2.544, sigma: 24.6, lambda: 0.158, cp: 2.31,
      fp: 29, bp: 117.7, alpha: 0.000972, note: 'n-Butanol @ 20°C'
    },
    'Chloroform': {
      rho: 1489, SG: 1.489, mu: 0.537, sigma: 27.1, lambda: 0.122, cp: 0.96,
      fp: null, bp: 61.2, alpha: 0.00121, note: 'Chloroform @ 20°C'
    },
    'Ether (Diethyl)': {
      rho: 714, SG: 0.714, mu: 0.224, sigma: 17.0, lambda: 0.121, cp: 2.18,
      fp: -45, bp: 34.6, alpha: 0.00152, note: 'Diethyl ether @ 20°C'
    },
    'Hexane': {
      rho: 660, SG: 0.660, mu: 0.297, sigma: 18.4, lambda: 0.125, cp: 2.25,
      fp: -22, bp: 68.7, alpha: 0.00143, note: 'n-Hexane @ 20°C'
    },
    'Kerosene': {
      rho: 806, SG: 0.806, mu: 1.9, sigma: 29.0, lambda: 0.141, cp: 1.99,
      fp: 38, bp: 300, alpha: 0.000868, note: 'Kerosene (jet fuel) @ 20°C'
    },
    'Linseed Oil': {
      rho: 930, SG: 0.930, mu: 27, sigma: 32.5, lambda: 0.174, cp: 1.97,
      fp: 343, bp: 630, alpha: 0.00078, note: 'Linseed oil @ 20°C'
    },
    'Olive Oil': {
      rho: 915, SG: 0.915, mu: 81, sigma: 32.0, lambda: 0.170, cp: 1.97,
      fp: 321, bp: 470, alpha: 0.00078, note: 'Olive oil @ 20°C'
    },
    'Phenol': {
      rho: 1070, SG: 1.070, mu: 9.28, sigma: 36.0, lambda: 0.161, cp: 2.05,
      fp: 20, bp: 181.8, alpha: 0.00078, note: 'Phenol @ 20°C'
    },
    'Sulfuric Acid': {
      rho: 1840, SG: 1.840, mu: 26.7, sigma: 55.0, lambda: 0.235, cp: 1.38,
      fp: null, bp: 337, alpha: 0.00057, note: 'H₂SO₄ (98%) @ 20°C'
    },
    'Hydrochloric Acid': {
      rho: 1190, SG: 1.190, mu: 1.865, sigma: 65.0, lambda: 0.452, cp: 2.84,
      fp: null, bp: 110, alpha: 0.000632, note: 'HCl (37%) @ 20°C'
    },
    'Nitric Acid': {
      rho: 1410, SG: 1.410, mu: 0.797, sigma: 42.2, lambda: 0.213, cp: 1.66,
      fp: null, bp: 83, alpha: 0.000743, note: 'HNO₃ (68%) @ 20°C'
    },
    'Sodium Hydroxide': {
      rho: 1200, SG: 1.200, mu: 4.88, sigma: 73.5, lambda: 0.640, cp: 3.47,
      fp: null, bp: 1388, alpha: 0.000421, note: 'NaOH (30% aq) @ 20°C'
    },
    'Ammonia': {
      rho: 683, SG: 0.683, mu: 0.254, sigma: 23.2, lambda: 0.488, cp: 4.69,
      fp: null, bp: -33, alpha: 0.00267, note: 'Ammonia (aq 25%) @ 20°C'
    },
    'Isopropanol': {
      rho: 786, SG: 0.786, mu: 1.956, sigma: 21.7, lambda: 0.142, cp: 2.61,
      fp: 12, bp: 82.4, alpha: 0.00107, note: 'Isopropyl alcohol @ 20°C'
    },
    'Food': {
      rho: null, SG: null, mu: null, sigma: null, lambda: null, cp: null,
      fp: null, bp: null, alpha: null, note: 'Food-grade (manual entry required)'
    },
    'Chemical': {
      rho: null, SG: null, mu: null, sigma: null, lambda: null, cp: null,
      fp: null, bp: null, alpha: null, note: 'Custom chemical (manual entry required)'
    },
    'Other': {
      rho: null, SG: null, mu: null, sigma: null, lambda: null, cp: null,
      fp: null, bp: null, alpha: null, note: 'Unknown fluid (manual entry required)'
    }
  };
  /* Corrosivity guidance used by the material-recommendation hint — how
     aggressively the fluid attacks plain carbon steel in atmospheric
     storage, independent of temperature. */
  var FLUID_CORROSIVITY = {
    'Water': 'benign', 'Diesel': 'benign', 'Crude Oil': 'mild', 'LPG': 'benign',
    'Methanol': 'benign', 'Ethanol': 'benign', 'Benzene': 'benign', 'Toluene': 'benign',
    'Glycerol': 'benign', 'Acetic Acid': 'corrosive', 'Acetone': 'benign', 'Butanol': 'benign',
    'Chloroform': 'corrosive', 'Ether (Diethyl)': 'benign', 'Hexane': 'benign',
    'Kerosene': 'benign', 'Linseed Oil': 'benign', 'Olive Oil': 'benign', 'Phenol': 'corrosive',
    'Sulfuric Acid': 'highly-corrosive', 'Hydrochloric Acid': 'highly-corrosive', 'Nitric Acid': 'highly-corrosive',
    'Sodium Hydroxide': 'caustic', 'Ammonia': 'mild', 'Isopropanol': 'benign',
    'Food': 'hygienic', 'Chemical': 'corrosive', 'Other': 'unknown'
  };
  // L/D reference bands by service (workbook)
  var LD_BANDS = {
    'Storage tank': [0.5, 1.5], 'Process vessel': [1.5, 3], 'Agitated vessel': [1, 2], 'Horizontal vessel': [3, 5]
  };
  /* Overall H/D sanity band regardless of service category — a design
     outside this range (API 650 field practice) is worth a second look even
     if it happens to sit inside its own service band. */
  var LD_SANITY = [0.8, 2.5];
  // Tank-size class by geometric capacity, and the H/D ratio typical of each —
  // used only for the design-assistant suggestion, not the calculation itself.
  var SIZE_CLASS = [
    { max: 100, name: 'Small tank', ld: [1.0, 1.0] },
    { max: 1000, name: 'Medium tank', ld: [1.2, 1.5] },
    { max: 10000, name: 'Large tank', ld: [1.5, 2.0] },
    { max: Infinity, name: 'Tall tank', ld: [2.0, 2.5] }
  ];
  function sizeClass(volM3) { for (var i = 0; i < SIZE_CLASS.length; i++) if (volM3 <= SIZE_CLASS[i].max) return SIZE_CLASS[i]; return SIZE_CLASS[SIZE_CLASS.length - 1]; }
  // Practical minimum shell thickness by diameter — an industry rule of thumb
  // laid alongside the governing API 650 1-Foot Method calculation, not a
  // replacement for it.
  var SHELL_MIN_THUMB = [
    { max: 2, min: 5 }, { max: 5, min: 6 }, { max: 15, min: 6 }, { max: Infinity, min: 8 }
  ];
  function shellMinThumb(Dm) { for (var i = 0; i < SHELL_MIN_THUMB.length; i++) if (Dm <= SHELL_MIN_THUMB[i].max) return SHELL_MIN_THUMB[i].min; return 8; }
  var JOINT_EFF = [['Full Radiography (E = 1.00)', 1.0], ['Spot RT (E = 0.85)', 0.85], ['Ordinary Fabrication (E = 0.80)', 0.80]];

  var built = false, three = null, LAST = null;

  /* ─── helpers (unit-aware, mirroring the PHE module) ─── */
  function $(id) { return document.getElementById(id); }
  function activeSys() { return window.activeUnitSystem || 'SI'; }
  function toSIval(v, t) { var C = window.UNIT_CONVERSIONS; if (t && C && C[t]) { try { return C[t].toSI(v, activeSys()); } catch (e) {} } return v; }
  function fromSIval(v, t) { var C = window.UNIT_CONVERSIONS; if (t && C && C[t]) { try { return C[t].fromSI(v, activeSys()); } catch (e) {} } return v; }
  function unitSym(t, f) { var C = window.UNIT_CONVERSIONS; if (t && C && C[t]) { try { return C[t].symbol(activeSys()); } catch (e) {} } return f || ''; }
  function num(id, d) {
    var e = $(id); if (!e) return d;
    var v = parseFloat(e.value); if (!isFinite(v)) return d;
    var t = e.getAttribute && e.getAttribute('data-unit-type');
    return t ? toSIval(v, t) : v;
  }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ─── markup helpers ─── */
  function unitSpan(u, t) {
    if (!u && !t) return '';
    return '<span class="unit"' + (t ? ' data-unit-type="' + t + '"' : '') + ' style="font-size:9px;color:#64748b;min-width:40px;text-transform:none;">' + (t ? unitSym(t, u) : u) + '</span>';
  }
  /* Results were written with the unit spelled into the string, so a tank
     designed in US customary still reported "4185.7 mm" and "50.00 m³".
     U() converts an SI figure into the active system and appends its symbol;
     CV() gives the bare converted number for a pair printed with one symbol. */
  function U(si, type, dp) {
    if (!isFinite(si)) return '—';
    if (typeof window.fromSIDisplay === 'function') return window.fromSIDisplay(type, si, dp == null ? 2 : dp);
    return si.toFixed(dp == null ? 2 : dp);
  }
  function CV(si, type) {
    var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type];
    return C ? C.fromSI(si, window.activeUnitSystem || 'SI') : si;
  }
  function SYM(type) {
    var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type];
    return C ? C.symbol(window.activeUnitSystem || 'SI') : '';
  }

  function fld(label, id, unit, v, step, utype) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '"' + (utype ? ' data-unit-type="' + utype + '"' : '') + ' type="number" step="' + (step || 'any') + '" value="' + (v === undefined ? '' : v) + '" '
      + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + unitSpan(unit, utype) + '</span></label>';
  }
  function txtf(label, id, v) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<input id="' + id + '" type="text" value="' + esc(v || '') + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;"/></label>';
  }
  function sel(label, id, opts, cur) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<select id="' + id + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;">'
      + opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
  }
  /* Same as sel(), but each option carries an explicit numeric value distinct
     from its label (e.g. "Spot RT (E = 0.85)" → value 0.85) so num() can read
     it straight off the element the same way it reads a plain number input. */
  function selv(label, id, pairs, curValue) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<select id="' + id + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;">'
      + pairs.map(function (p) { return '<option value="' + p[1] + '"' + (p[1] === curValue ? ' selected' : '') + '>' + esc(p[0]) + '</option>'; }).join('') + '</select></label>';
  }
  function hdr(t) { return '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin:14px 0 4px;border-bottom:1px solid var(--border-muted);padding-bottom:3px;">' + t + '</div>'; }
  function two(a, b) { return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div>' + a + '</div><div>' + b + '</div></div>'; }

  /* ─────────── panel ─────────── */
  function panelHTML() {
    var h = '<div class="sthe-grid">';
    /* LEFT — inputs */
    h += '<div class="panel panel-input" style="max-height:calc(100vh - 120px);overflow-y:auto;overflow-x:hidden;">'
      + '<div class="panel-header" style="display:flex;align-items:center;gap:6px;"><span class="panel-title" style="flex:1;">STORAGE TANK — DESIGN INPUTS</span>'
      + '<button id="tk-undo" class="tk-hbtn" title="Undo last change"><span style="font-size:13px;">↩</span><span>UNDO</span></button>'
      + '<button id="tk-redo" class="tk-hbtn" title="Redo"><span style="font-size:13px;">↪</span><span>REDO</span></button>'
      + '<button id="tk-reset" class="tk-hbtn tk-hbtn-red" title="Reset to defaults"><span style="font-size:13px;">↺</span><span>RESET</span></button></div>'
      + '<div class="panel-body">';

    /* Section 00, one accordion above the data sheet — same document classes
       and depth as the pump / DPHE / STHE / PHE user manuals, so the whole
       suite reads as one manual set. */
    h += '<details class="pump-accordion" id="tk-manual">'
      + '<summary>00 &middot; USER MANUAL &mdash; HOW TO SIZE A STORAGE TANK <span class="chevron">&#9660;</span></summary>'
      + '<div class="acc-content" style="display:block;"><div class="aro-doc">'

      + '<p class="aro-doc-lead">Work down the sections in order &mdash; the panel recalculates as you type, so you '
      + 'see results before you finish. This module sizes an atmospheric/low-pressure vertical tank to API 650: it '
      + 'builds up the four operating levels (LLLL/LLL/HLL/HHLL) from your nozzle and residence-time data, checks the '
      + 'working capacity between them against what you actually need, and sizes the shell by the 1-Foot Method.</p>'

      + '<div class="aro-doc-callout aro-doc-callout--warn"><b>Starting a new tank? Press RESET first.</b> The panel '
      + 'keeps the previous design\'s inputs &mdash; service, geometry, levels, results and 3D view &mdash; sitting '
      + 'in every field until you clear them. RESET blanks every field (dropdowns fall back to their first entry) '
      + 'and clears the results, chart and report to their untouched starting state. <b>UNDO</b>/<b>REDO</b> step '
      + 'back and forward through changes one at a time, if you only need to back out the last edit.</div>'

      + '<div class="aro-doc-callout aro-doc-callout--info"><b>Set your units first.</b> The <b>unit system '
      + 'selector</b> in the top bar drives this tank and the whole suite together &mdash; SI (m, bar, kg/hr), US '
      + 'customary (ft, psi, GPM, &deg;F) or mixed metric (cm, kg/cm&sup2;, L/min, g/s). You may switch at any time, '
      + 'including after a run: every input, output, 3D model, drawing and report converts together. Switching '
      + 'units never changes the answer, only how it is written &mdash; the calculation itself always runs in SI '
      + 'underneath.</div>'

      + '<h4 class="aro-doc-h">Step 1 &mdash; 1 &middot; Design data sheet</h4>'
      + '<p>Tag number, location, project, client, engineer and revision. None of it affects the calculation; all '
      + 'of it is printed on the report and the GA drawing\'s title block, so fill it in if the output is going '
      + 'into a document package.</p>'

      + '<h4 class="aro-doc-h">Step 2 &mdash; 2 &middot; Service fluid</h4>'
      + '<ol class="aro-doc-ol">'
      + '<li><b>Service Fluid</b> &mdash; drives the recommended-roof note beneath the fields (for example, a '
      + 'floating roof for crude oil, a bulleted/spherical vessel note for LPG since that falls under API 620 rather '
      + 'than API 650). The recommendation is guidance, not an input the software applies for you &mdash; set '
      + '<b>Type of Roof</b> yourself in Step 3.</li>'
      + '<li><b>Density &rho;</b>, <b>Design Temperature</b>, <b>Design Pressure</b> &mdash; the stored liquid\'s '
      + 'properties; density sets the specific gravity used in the shell-thickness formula and every weight in the '
      + 'take-off. Picking Water, Diesel, Crude Oil or LPG fills in a typical density for you (Food/Chemical/Other '
      + 'vary too much to guess safely, so the field clears instead &mdash; enter the actual product\'s figure).</li>'
      + '<li><b>Corrosion Allowance</b> &mdash; added straight onto the calculated shell thickness before rounding '
      + 'up to the plate you select.</li>'
      + '</ol>'

      + '<h4 class="aro-doc-h">Step 3 &mdash; 3 &middot; Tank configuration</h4>'
      + '<ol class="aro-doc-ol">'
      + '<li><b>Tank Material</b> &mdash; fills density (for weight take-off), allowable stress (for the shell '
      + 'formula) and surface roughness for you. Choose <i>User defined</i> to open the three fields beneath the '
      + 'select and enter your own figures &mdash; the shell thickness cannot be calculated until an allowable '
      + 'stress is entered for a user-defined material. The amber box beneath it is guidance, not an input the '
      + 'software applies for you: it recommends a material family from the service fluid\'s corrosivity and the '
      + 'design temperature (flagging above ~90&nbsp;&deg;C, and strongly above ~200&nbsp;&deg;C where an '
      + 'atmospheric tank may not even be the right vessel type), and flags when your selection is a different '
      + 'family from what it suggests.</li>'
      + '<li><b>Orientation</b> &mdash; Vertical is what the rest of this module sizes; Horizontal is offered for '
      + 'record-keeping on the datasheet but does not change the vertical-cylinder capacity/level/shell formulas.</li>'
      + '<li><b>Type of Roof</b> &mdash; cone, dome, flat, internal/external floating, or open top. This sets the '
      + 'roof geometry in the 3D view, its weight in the take-off, and (for a floating roof) draws the deck sitting '
      + 'on the liquid at the HLL elevation instead of a fixed roof at the top.</li>'
      + '<li><b>Service Category</b> &mdash; picks which L/D band your design is checked against (storage tank, '
      + 'process vessel, agitated vessel, horizontal vessel each have their own conventional range).</li>'
      + '</ol>'

      + '<h4 class="aro-doc-h">Step 4 &mdash; 4 &middot; Geometry</h4>'
      + '<ol class="aro-doc-ol">'
      + '<li><b>Required Working Capacity</b> &mdash; the volume the tank must hold between its low and high alarm '
      + 'levels; this is what the calculated working capacity is checked against.</li>'
      + '<li><b>Tank Height (shell)</b> and <b>Tank Dia. ID</b> &mdash; set the vessel size directly; there is no '
      + 'auto-sizing loop, so adjust these and re-run until the capacity check passes and the L/D ratio sits in '
      + 'band.</li>'
      + '<li><b>Shell Thickness</b> &mdash; leave at 0 to let the software calculate it by the API 650 1-Foot '
      + 'Method and round up to the nearest 0.5&nbsp;mm/in; enter your own figure to check a specific plate against '
      + 'the calculated requirement instead.</li>'
      + '<li><b>Bottom Plate Thickness</b> and <b>Joint Efficiency E</b> &mdash; the bottom plate is not calculated '
      + '(API 650 sets a flat minimum, noted on the drawing); E is picked from the standard construction-type table '
      + '(Full Radiography E&nbsp;=&nbsp;1.00, Spot RT E&nbsp;=&nbsp;0.85, Ordinary Fabrication E&nbsp;=&nbsp;0.80) '
      + 'and used directly in the shell formula.</li>'
      + '</ol>'

      + '<h4 class="aro-doc-h">Step 5 &mdash; 5&ndash;8 &middot; Liquid levels</h4>'
      + '<p>The four operating levels are each built up from two candidate figures, and the software adopts '
      + 'whichever is larger &mdash; so a level never comes out under a code minimum even if your process figures '
      + 'would otherwise put it there:</p>'
      + '<ul class="aro-doc-ul">'
      + '<li><b>LLLL (low&#8209;low, trip)</b> = MAX(outlet nozzle centreline + nozzle radius + liquid above '
      + 'nozzle, a specific requirement height you enter directly).</li>'
      + '<li><b>LLL (low, alarm)</b>, above LLLL, = MAX(the height swept by the outlet/pump-suction flow over its '
      + 'residence time, the API 650 minimum you enter).</li>'
      + '<li><b>HHLL (high&#8209;high, trip)</b>, below the top curb angle, = MAX(1.5 &times; the overflow nozzle '
      + 'size, a project-specific minimum).</li>'
      + '<li><b>HLL (high, alarm)</b>, below HHLL, = MAX(the height swept by the inlet/pump-discharge flow over its '
      + 'residence time, the API 650 minimum you enter).</li>'
      + '</ul>'
      + '<p class="aro-doc-note">Working height is the shell height less all four level build-ups; working '
      + 'capacity is that height times the tank\'s cross-sectional area, and is what Step 4\'s required capacity is '
      + 'checked against.</p>'

      + '<h4 class="aro-doc-h">Step 6 &mdash; Run</h4>'
      + '<p>Press <b>&#9654; RUN TANK DESIGN</b>. The 3D tank, the results panel and the run-status banner populate '
      + 'together. A <b>EXTERNAL VIEW / CUT-AWAY &amp; LEVELS</b> toggle above the 3D view switches between the '
      + 'assembled tank and a cutaway showing the liquid fill and coloured rings at each of the four levels.</p>'

      + '<h4 class="aro-doc-h">Reading the results</h4>'
      + '<ul class="aro-doc-ul">'
      + '<li><b>Capacity &amp; Geometry</b> &mdash; L/D ratio against the service band, geometric and working '
      + 'capacity, and the capacity PASS/FAIL against what you need.</li>'
      + '<li><b>Liquid Levels</b> and <b>Level Build-up</b> &mdash; every level\'s elevation from the bottom, and '
      + 'underneath it, which of the two candidate figures (the calculated one or the code/spec minimum) was '
      + 'actually adopted at each level.</li>'
      + '<li><b>Shell Design — API 650 (1-Foot Method)</b> &mdash; the formula, its calculated result, the API 650 '
      + 'absolute minimum for this diameter, the larger of the two (required), and the plate you actually selected '
      + '&mdash; flagged if it falls short.</li>'
      + '<li><b>Weight Take-off</b> &mdash; shell, bottom and roof plate weight from the selected material\'s '
      + 'density, plus a 12% allowance for nozzles/ladders/stairs/curb angle, giving empty (erection), operating '
      + 'and hydrotest (water-full) weights.</li>'
      + '<li><b>Design Checks</b> &mdash; capacity, L/D band, shell thickness, freeboard above HLL, and the API 650 '
      + 'diameter/height ceilings (60&nbsp;m / 25&nbsp;m), each a straight PASS/REVIEW/FAIL.</li>'
      + '<li><b>Design Assistant &mdash; Industry Thumb-Rule Check</b> &mdash; a second, independent pass against '
      + 'field-practice bands rather than the code calculation above: H/D against both a general sanity range and '
      + 'the typical ratio for your tank\'s size class (with a suggested diameter/height pair when it\'s out of '
      + 'band), the practical shell-thickness minimum for your diameter, the bottom plate\'s normal 6&ndash;10&nbsp;mm '
      + 'range, and whether the LLLL&rarr;LLL and HHLL&rarr;HLL gaps leave enough instrumentation margin '
      + '(&ge;300&nbsp;mm, 400&nbsp;mm recommended). It never changes the governing API 650 result &mdash; it only '
      + 'tells you when that result is worth a second look.</li>'
      + '</ul>'

      + '<h4 class="aro-doc-h">Report &amp; drawing</h4>'
      + '<p>Under <b>FINAL DELIVERABLES</b>: <b>REPORT</b> produces the engineering design report &mdash; design '
      + 'data sheet, service &amp; material, geometry &amp; capacity, liquid levels, the shell-design formula with '
      + 'its substitution, the weight take-off, every design check, the bill of material, the design-assistant '
      + 'thumb-rule check and material guidance, in whichever unit system is active. <b>DRAWING / BOM</b> produces '
      + 'the general-arrangement drawing &mdash; elevation with every level dimensioned and called out, a ladder '
      + '(with safety cage above ~6&nbsp;m) and top platform/handrail shown against the shell and roof, plan view '
      + 'with nozzle positions and anchor bolts on the foundation ring, the design-data and level-schedule tables, '
      + 'a dedicated nozzle schedule, the title block and the bill of material.</p>'

      + '<div class="aro-doc-callout aro-doc-callout--warn">'
      + '<b>Nozzle sizes stay in inches.</b> Outlet, overflow and the other nozzle/manhole call-outs are quoted as '
      + 'NPS (nominal pipe size) in inches regardless of the active unit system, the same way ASME B16.5 flanges and '
      + 'fittings are always specified &mdash; every process dimension elsewhere in the results, drawing and report '
      + 'converts with the rest of the datasheet.'
      + '</div>'

      + '</div></div></details>';

    h += hdr('1 · DESIGN DATA SHEET');
    h += two(txtf('TAG No.', 'tk-tag', 'TK-101'), txtf('TANK LOCATION', 'tk-loc', ''));
    h += two(txtf('PROJECT', 'tk-project', 'Untitled'), txtf('CLIENT', 'tk-client', ''));
    h += two(txtf('ENGINEER', 'tk-engineer', ''), txtf('REV', 'tk-rev', '0'));

    h += hdr('2 · SERVICE FLUID');
    h += sel('SERVICE FLUID', 'tk-fluid', ['Water', 'Diesel', 'Crude Oil', 'LPG', 'Methanol', 'Ethanol', 'Benzene', 'Toluene', 'Glycerol', 'Acetic Acid', 'Acetone', 'Butanol', 'Chloroform', 'Ether (Diethyl)', 'Hexane', 'Kerosene', 'Linseed Oil', 'Olive Oil', 'Phenol', 'Sulfuric Acid', 'Hydrochloric Acid', 'Nitric Acid', 'Sodium Hydroxide', 'Ammonia', 'Isopropanol', 'Food', 'Chemical', 'Other'], 'Water');
    h += two(fld('Density ρ', 'tk-rho', 'kg/m³', 1000, '1', 'density'),
             fld('Design temperature', 'tk-tdes', '°C', 45, '1', 'temperature'));
    h += two(fld('Design pressure', 'tk-pdes', 'barg', 0, '0.1', 'pressure'),
             fld('Corrosion allowance', 'tk-ca', 'mm', 2, '0.5', 'length-mm'));
    h += '<div id="tk-roofhint" style="font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.5;margin:3px 0;background:rgba(56,189,248,0.06);border-left:2px solid #38bdf8;padding:5px 7px;border-radius:3px;"></div>';
    h += '<div id="tk-fluidprops" style="display:none;font-family:var(--font-mono);font-size:8.5px;color:#cbd5e1;margin:6px 0;background:rgba(51,65,85,0.4);border:1px solid var(--border-muted);border-radius:3px;padding:6px;"><div style="font-weight:700;color:#e2e8f0;margin-bottom:4px;font-size:9px;">Fluid Properties (Perry\'s Handbook @ 20–25°C)</div><table style="width:100%;border-collapse:collapse;"><tr style="border-bottom:1px solid var(--border-muted);"><td style="padding:2px 4px;text-align:left;width:35%;">Property</td><td style="padding:2px 4px;text-align:right;width:30%;">Value</td><td style="padding:2px 4px;text-align:left;width:35%;">Unit</td></tr><tbody id="tk-fluidtable"></tbody></table></div>';

    h += hdr('3 · TANK CONFIGURATION');
    h += sel('TANK MATERIAL', 'tk-mat', Object.keys(MATERIALS), 'CS (A36 / IS 2062)');
    h += '<div id="tk-matinfo" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-top:2px;"></div>';
    h += '<div id="tk-mathint" style="font-family:var(--font-mono);font-size:9px;color:#fbbf24;line-height:1.5;margin:3px 0;background:rgba(251,191,36,0.06);border-left:2px solid #fbbf24;padding:5px 7px;border-radius:3px;"></div>';
    h += '<div id="tk-matuser" style="display:none;">'
      + two(fld('Material density ρ', 'tk-matrho', 'kg/m³', '', '1', 'density'),
            fld('Allowable stress S', 'tk-matS', 'MPa', '', '1', 'stress'))
      + fld('Material roughness ε', 'tk-matrough', 'mm', '', '0.001', 'length-mm') + '</div>';
    h += two(sel('ORIENTATION', 'tk-orient', ['Vertical', 'Horizontal'], 'Vertical'),
             sel('TYPE OF ROOF', 'tk-roof', ['Cone Roof', 'Dome Roof', 'Flat (Fixed) Roof', 'Internal Floating Roof', 'External Floating Roof', 'Open Top'], 'Cone Roof'));
    h += sel('SERVICE CATEGORY (L/D band)', 'tk-service', Object.keys(LD_BANDS), 'Storage tank');

    h += hdr('4 · GEOMETRY');
    h += fld('Required working capacity', 'tk-reqcap', 'm³', 50, '1', 'volume');
    h += two(fld('Tank height (shell)', 'tk-H', 'mm', 5000, '10', 'length-mm'),
             fld('Tank dia. ID', 'tk-D', 'mm', 3900, '10', 'length-mm'));
    h += two(fld('Shell thickness (0=auto)', 'tk-t', 'mm', 0, '0.5', 'length-mm'),
             fld('Bottom plate thk.', 'tk-tb', 'mm', 6, '0.5', 'length-mm'));
    h += selv('Joint efficiency E', 'tk-E', JOINT_EFF, 1.0);

    h += hdr('5 · LLLL — LOW LOW LIQUID LEVEL');
    h += two(fld('Min. bottom→nozzle CL (API 650)', 'tk-noz-cl', 'mm', 200, '10', 'length-mm'),
             fld('Outlet nozzle dia. (legacy)', 'tk-noz-out', 'inch', 4, '0.5'));
    h += '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">OUTLET NOZZLE (STANDARDIZED)<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<select id="tk-noz-nps" style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"><option>— Select NPS —</option>'
      + Object.keys(PIPE_NPS).sort(function(a,b){return parseFloat(a)-parseFloat(b);}).map(function(k){return '<option value="'+k+'">'+PIPE_NPS[k].label+' ('+PIPE_NPS[k].od.toFixed(2)+'")</option>';}).join('')
      + '</select><span style="font-size:9px;color:#64748b;min-width:52px;">NPS</span></span></label>'
      + '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">SCHEDULE<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<select id="tk-noz-sch" style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"><option>— Select SCH —</option>'
      + SCHEDULES.map(function(s){return '<option value="'+s+'">SCH '+s+'</option>';}).join('')
      + '</select><span style="font-size:9px;color:#64748b;min-width:52px;"></span></span></label>'
      + '<div id="tk-noz-suggest" style="font-family:var(--font-mono);font-size:8.5px;color:#38bdf8;background:rgba(56,189,248,0.08);border-left:2px solid #38bdf8;padding:5px 7px;margin:4px 0;border-radius:3px;display:none;"></div>';
    h += two(fld('Liquid level above nozzle', 'tk-liq-above', 'mm', 125, '10', 'length-mm'),
             fld('Specific requirement height', 'tk-lll-spec', 'mm', 500, '10', 'length-mm'));

    h += hdr('6 · LLL — LOW LIQUID LEVEL');
    h += two(fld('Outlet / pump suction flow', 'tk-q-out', 'm³/hr', 20, '1', 'vol-flow'),
             fld('Residence time', 'tk-res-out', 'min', 3, '0.5'));
    h += fld('LLLL→LLL min. (API 650)', 'tk-lll-min', 'mm', 400, '10', 'length-mm');
    h += '<div id="tk-lll-auto" style="font-family:var(--font-mono);font-size:8.5px;color:#22c55e;background:rgba(34,197,94,0.08);border-left:2px solid #22c55e;padding:5px 7px;margin:4px 0;border-radius:3px;display:none;"></div>';

    h += hdr('7 · HHLL — HIGH HIGH LIQUID LEVEL');
    h += '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">OVERFLOW NOZZLE (STANDARDIZED)<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<select id="tk-ovf-nps" style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"><option>— Select NPS —</option>'
      + Object.keys(PIPE_NPS).sort(function(a,b){return parseFloat(a)-parseFloat(b);}).map(function(k){return '<option value="'+k+'">'+PIPE_NPS[k].label+' ('+PIPE_NPS[k].od.toFixed(2)+'")</option>';}).join('')
      + '</select><span style="font-size:9px;color:#64748b;min-width:52px;">NPS</span></span></label>'
      + '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">SCHEDULE<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<select id="tk-ovf-sch" style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"><option>— Select SCH —</option>'
      + SCHEDULES.map(function(s){return '<option value="'+s+'">SCH '+s+'</option>';}).join('')
      + '</select><span style="font-size:9px;color:#64748b;min-width:52px;"></span></span></label>'
      + '<div id="tk-ovf-suggest" style="font-family:var(--font-mono);font-size:8.5px;color:#38bdf8;background:rgba(56,189,248,0.08);border-left:2px solid #38bdf8;padding:5px 7px;margin:4px 0;border-radius:3px;display:none;"></div>';
    h += two(fld('Project min. from curb angle', 'tk-hhll-spec', 'mm', 150, '10', 'length-mm'),
             fld('(legacy nozzle size)', 'tk-noz-ovf', 'inch', 3, '0.5'));

    h += hdr('8 · HLL — HIGH LIQUID LEVEL');
    h += two(fld('Inlet / pump discharge flow', 'tk-q-in', 'm³/hr', 20, '1', 'vol-flow'),
             fld('Residence time', 'tk-res-in', 'min', 3, '0.5'));
    h += fld('HHLL→HLL min. (API 650)', 'tk-hll-min', 'mm', 400, '10', 'length-mm');
    h += '<div id="tk-hll-auto" style="font-family:var(--font-mono);font-size:8.5px;color:#22c55e;background:rgba(34,197,94,0.08);border-left:2px solid #22c55e;padding:5px 7px;margin:4px 0;border-radius:3px;display:none;"></div>';

    h += '<button id="tk-calc" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ RUN TANK DESIGN</button>';
    h += '<div id="tk-run-status" style="display:none;margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#052e16;background:linear-gradient(135deg,#22c55e,#4ade80);border:1px solid #16a34a;border-radius:5px;padding:8px 10px;text-align:center;line-height:1.4;"></div>';
    h += tankCSS();
    h += '</div></div>';

    /* RIGHT — 3D + results */
    h += '<div class="panel" style="max-height:calc(100vh - 120px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">TECHNICAL EVALUATIONS — STORAGE TANK</span></div>'
      + '<div class="panel-body">'
      + '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:5px;">'
      + '<button id="tk-view-out" class="tk-viewbtn tk-viewon" data-view="outside">🛢 EXTERNAL VIEW</button>'
      + '<button id="tk-view-cut" class="tk-viewbtn" data-view="cutaway">🌊 CUT-AWAY / LEVELS</button></div>'
      + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#94a3b8;text-align:center;margin-bottom:4px;">3D TANK — LIVE VIEW · DRAG TO ROTATE · SCROLL TO ZOOM</div>'
      + '<div id="tk-3dwrap" style="position:relative;width:100%;height:360px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;">'
      + '<canvas id="tk-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>'
      + '<div id="tk-3dtag" style="position:absolute;left:8px;top:8px;font-family:var(--font-mono);font-size:10px;color:#38bdf8;"></div></div>'
      + '<div id="tk-results" style="margin-top:12px;"></div>'
      + '<div style="margin-top:14px;border-top:1px solid var(--border-muted);padding-top:10px;">'
      + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin-bottom:6px;">FINAL DELIVERABLES</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button id="tk-report" class="tk-act">📄 REPORT</button>'
      + '<button id="tk-draw" class="tk-act">📐 DRAWING / BOM</button></div></div>'
      + '</div></div>';

    return h + '</div>';
  }

  function tankCSS() {
    return '<style>'
      + '.tk-act{flex:1;background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:8px;border-radius:4px;cursor:pointer;}'
      + '.tk-act:hover{background:rgba(255,117,56,0.12);}'
      + '.tk-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
      + '.tk-rr span{color:var(--text-muted);}.tk-rr b{color:var(--text-header);}.tk-rr.ok b{color:#22c55e;}.tk-rr.warn b{color:#ef4444;}'
      + '.tk-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}'
      + '.tk-hbtn{display:inline-flex;flex-direction:column;align-items:center;gap:1px;min-width:42px;padding:4px 8px;background:rgba(59,130,246,0.06);border:1px solid #3b82f6;color:#3b82f6;border-radius:5px;font-size:8px;font-weight:700;cursor:pointer;line-height:1.1;font-family:var(--font-mono);}'
      + '.tk-hbtn-red{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,0.06);}'
      + '.tk-viewbtn{font-family:var(--font-mono);font-size:9.5px;font-weight:700;padding:5px 12px;border-radius:5px;cursor:pointer;background:rgba(56,189,248,0.06);border:1px solid #334155;color:#94a3b8;}'
      + '.tk-viewbtn.tk-viewon{background:linear-gradient(135deg,#0ea5e9,#38bdf8);border-color:#38bdf8;color:#04263a;}'
      + '</style>';
  }

  /* ─────────── CORE CALCULATION (exactly per the design workbook) ─────────── */
  function compute() {
    var D = num('tk-D', 3900), H = num('tk-H', 5000);           // mm
    var Dm = D / 1000, Hm = H / 1000;                            // m
    var reqCap = num('tk-reqcap', 50);                           // m³
    var rho = num('tk-rho', 1000), CA = num('tk-ca', 1.5);
    var matName = val('tk-mat', 'CS (A36 / IS 2062)');
    var mat = resolveMat(matName);
    var E = num('tk-E', 0.85) || 0.85;

    var area = Math.PI / 4 * Dm * Dm;                            // m²
    var LD = H / D;
    var geoCap = area * Hm;                                      // m³  (π/4·D²·H)

    // ── LLLL: nozzle centreline + nozzle radius + liquid above nozzle ──
    var nozCL = num('tk-noz-cl', 240);
    var dOut = num('tk-noz-out', 4);
    var rOut = (dOut * 25.4) / 2;                                // mm
    var liqAbove = num('tk-liq-above', 150);
    var lllCalc = nozCL + rOut + liqAbove;
    var lllSpec = num('tk-lll-spec', 500);
    var hLLLL = Math.max(lllCalc, lllSpec);                      // MAX()

    // ── LLLL → LLL from outlet residence time ──
    var qOut = num('tk-q-out', 20), tOut = num('tk-res-out', 3);
    var hResOut = ((qOut * tOut / 60) / area) * 1000;            // mm
    var lllMin = num('tk-lll-min', 100);
    var hLLL = Math.max(hResOut, lllMin);

    // ── HHLL below top curb angle: 1.5 × overflow nozzle ──
    var dOvf = num('tk-noz-ovf', 3);
    var hCurbApi = dOvf * 1.5 * 25.4;                            // mm
    var hCurbSpec = num('tk-hhll-spec', 100);
    var hHHLLcurb = Math.max(hCurbApi, hCurbSpec);

    // ── HHLL → HLL from inlet residence time ──
    var qIn = num('tk-q-in', 20), tIn = num('tk-res-in', 3);
    var hResIn = ((qIn * tIn / 60) / area) * 1000;               // mm
    var hllMin = num('tk-hll-min', 100);
    var hHLL = Math.max(hResIn, hllMin);

    // ── Working height & capacity ──
    var workH = H - (hLLLL + hLLL + hHHLLcurb + hHLL);           // mm
    var workCap = area * (workH / 1000);                         // m³
    var capOk = workCap >= reqCap;

    // ── Level elevations from bottom (mm) ──
    var elBTL = 0;
    var elLLLL = hLLLL;
    var elLLL = elLLLL + hLLL;
    var elTTL = H;
    var elHHLL = H - hHHLLcurb;
    var elHLL = elHHLL - hHLL;
    var elOverflow = H - 300;                                    // 300 mm below TTL

    // ── API 650 shell thickness, 1-Foot Method ──
    //   t = 4.9·D(m)·(H(m) − 0.3)·G / (S·E) + CA      [mm]
    var G = rho / 1000;                                          // specific gravity
    // With a user-defined material and no allowable stress yet entered the
    // thickness is undefined rather than infinite — reported as '—'.
    var tCalc = mat.S > 0 ? (4.9 * Dm * Math.max(0, Hm - 0.3) * G) / (mat.S * E) + CA : NaN;
    var tMinApi = Dm < 15 ? 5 : Dm < 36 ? 6 : Dm < 60 ? 8 : 10;  // API 650 minimum shell
    var tReq = isFinite(tCalc) ? Math.max(tCalc, tMinApi) : tMinApi;
    var tUser = num('tk-t', 0);
    var t = tUser > 0 ? tUser : Math.ceil(tReq * 2) / 2;         // round up to 0.5 mm
    var tOk = t >= tReq - 1e-6;
    var tb = num('tk-tb', 6);

    // ── Roof geometry & weights (material density drives the take-off) ──
    var roof = val('tk-roof', 'Cone Roof');
    var roofSlope = 1 / 5;                                       // 1:5 typical cone
    var roofRise = /Cone/.test(roof) ? (Dm / 2) * roofSlope : /Dome/.test(roof) ? Dm * 0.1 : 0;
    var roofArea = /Cone/.test(roof) ? Math.PI * (Dm / 2) * Math.sqrt(Math.pow(Dm / 2, 2) + roofRise * roofRise)
                 : /Dome/.test(roof) ? 2 * Math.PI * (Dm / 2) * (roofRise || Dm * 0.1)
                 : /Open Top/.test(roof) ? 0 : area;
    var tRoof = /Floating/.test(roof) ? Math.max(5, t * 0.8) : Math.max(5, t * 0.6);

    var shellArea = Math.PI * Dm * Hm;                           // m²
    var wShell = shellArea * (t / 1000) * mat.rho;               // kg
    var wBottom = area * (tb / 1000) * mat.rho;
    var wRoof = roofArea * (tRoof / 1000) * mat.rho;
    var wSteel = wShell + wBottom + wRoof;
    var wAppurt = wSteel * 0.12;                                 // nozzles, ladder, curb angle, stairs
    var wEmpty = wSteel + wAppurt;
    var wLiquid = workCap * rho;                                 // kg at working level
    var wFull = geoCap * rho;
    var wOper = wEmpty + wLiquid;
    var wTest = wEmpty + geoCap * 1000;                          // hydrotest with water

    // ── Checks ──
    var svc = val('tk-service', 'Storage tank');
    var band = LD_BANDS[svc] || [0.5, 1.5];
    var ldOk = LD >= band[0] && LD <= band[1];
    var freeboard = H - elHLL;                                   // mm above HLL
    var fbOk = freeboard >= 300;
    var dOk = Dm <= 60, hOk = Hm <= 25;

    var fluid = val('tk-fluid', 'Water');
    var roofSuggest = ROOF_GUIDE[fluid] || 'Cone or Dome Roof';

    return {
      D: D, H: H, Dm: Dm, Hm: Hm, area: area, LD: LD, geoCap: geoCap, reqCap: reqCap,
      rho: rho, CA: CA, matName: matName, mat: mat, E: E, G: G,
      rOut: rOut, dOut: dOut, dOvf: dOvf,
      lllCalc: lllCalc, hLLLL: hLLLL, hResOut: hResOut, hLLL: hLLL,
      hCurbApi: hCurbApi, hHHLLcurb: hHHLLcurb, hResIn: hResIn, hHLL: hHLL,
      workH: workH, workCap: workCap, capOk: capOk,
      elBTL: elBTL, elLLLL: elLLLL, elLLL: elLLL, elHLL: elHLL, elHHLL: elHHLL, elTTL: elTTL, elOverflow: elOverflow,
      tCalc: tCalc, tMinApi: tMinApi, tReq: tReq, t: t, tOk: tOk, tb: tb, tRoof: tRoof,
      roof: roof, roofRise: roofRise, roofArea: roofArea, shellArea: shellArea,
      wShell: wShell, wBottom: wBottom, wRoof: wRoof, wSteel: wSteel, wAppurt: wAppurt,
      wEmpty: wEmpty, wLiquid: wLiquid, wFull: wFull, wOper: wOper, wTest: wTest,
      svc: svc, band: band, ldOk: ldOk, freeboard: freeboard, fbOk: fbOk, dOk: dOk, hOk: hOk,
      fluid: fluid, roofSuggest: roofSuggest, orient: val('tk-orient', 'Vertical'),
      tdes: num('tk-tdes', 45), pdes: num('tk-pdes', 0)
    };
  }

  /* ─────────── design assistant: industry thumb-rule cross-checks ───────────
     Advisory only — none of this feeds back into compute(); it just checks
     the workbook-exact result against the rule-of-thumb bands/tables the
     user's own reference gave, and prints a suggested value when a check
     doesn't pass. The governing numbers stay the API 650 calc + the client
     workbook's level build-up. */
  /* Nozzle sizing recommendation based on flow rate and velocity guidelines.
     Returns NPS (key in PIPE_NPS) that gives velocity between 2–3 m/s (discharge nozzles)
     or 0.6–1.5 m/s (suction nozzles). For empty input, returns null (user must pick). */
  function suggestNozzleNPS(Q_m3hr, flowType) {
    if (!Q_m3hr || Q_m3hr <= 0) return null;
    flowType = flowType || 'discharge';                       // 'discharge' or 'suction'
    var Q_m3s = Q_m3hr / 3600;                                // m³/s
    var targetVmin = flowType === 'suction' ? 0.6 : 2.0;      // m/s
    var targetVmax = flowType === 'suction' ? 1.5 : 3.0;      // m/s
    var bestNps = null, bestErr = Infinity;
    Object.keys(PIPE_NPS).forEach(function(nps) {
      var od = PIPE_NPS[nps].od * 0.0254;                    // convert inch → m
      var id = od - 0.005;                                    // rough estimate (use nominal bore for actual)
      var A = Math.PI * id * id / 4;
      var v = Q_m3s / A;
      if (v >= targetVmin && v <= targetVmax) {
        var midV = (targetVmin + targetVmax) / 2;
        var err = Math.abs(v - midV);
        if (err < bestErr) { bestErr = err; bestNps = nps; }
      }
    });
    return bestNps;
  }

  function designAssistant(r) {
    var out = [];
    var cls = sizeClass(r.geoCap);
    var midRatio = (cls.ld[0] + cls.ld[1]) / 2;
    var Dsugg = Math.cbrt((4 * (r.reqCap || r.geoCap)) / (Math.PI * midRatio));   // m
    var Hsugg = midRatio * Dsugg;                                                // m
    var ldSaneOk = r.LD >= LD_SANITY[0] && r.LD <= LD_SANITY[1];
    var ldClassOk = r.LD >= cls.ld[0] - 0.15 && r.LD <= cls.ld[1] + 0.15;
    out.push({
      label: 'H/D — general sanity band ' + LD_SANITY[0] + '–' + LD_SANITY[1],
      ok: ldSaneOk, value: r.LD.toFixed(2),
      note: ldSaneOk ? 'within range' : 'outside the general field-practice range for any atmospheric tank'
    });
    out.push({
      label: 'H/D — ' + cls.name + ' (' + U(r.geoCap, 'volume', 0) + ') typical ' + cls.ld[0] + '–' + cls.ld[1],
      ok: ldClassOk, value: r.LD.toFixed(2),
      note: ldClassOk ? 'typical for this size class' : 'suggested Ø ' + U(Dsugg * 1000, 'length-mm', 0) + ' × H ' + U(Hsugg * 1000, 'length-mm', 0) + ' would centre the band at the required capacity'
    });
    var thumbMin = shellMinThumb(r.Dm);
    var shellFloorOk = r.t >= 5 - 1e-9;
    out.push({
      label: 'Shell — practical minimum by diameter (Ø ' + U(r.Dm, 'length-m', 1) + ' → ' + thumbMin + ' mm typical, never below 5 mm)',
      ok: r.t >= thumbMin && shellFloorOk, value: U(r.t, 'length-mm', 1),
      note: !shellFloorOk ? 'below the absolute 5 mm floor — increase immediately' : (r.t >= thumbMin ? 'meets the practical minimum' : 'thinner than field practice for this diameter, though the API 650 calc above governs')
    });
    var bomTbOk = r.tb >= 6 && r.tb <= 10;
    out.push({
      label: 'Bottom plate — normally 6–10 mm (shell t + CA)',
      ok: bomTbOk, value: U(r.tb, 'length-mm', 1),
      note: bomTbOk ? 'within the normal range' : 'suggest ' + U(Math.min(10, Math.max(6, r.tb)), 'length-mm', 1)
    });
    var jointLabel = (JOINT_EFF.filter(function (p) { return Math.abs(p[1] - r.E) < 1e-6; })[0] || ['custom'])[0];
    out.push({ label: 'Joint efficiency', ok: true, value: 'E = ' + r.E + '  (' + jointLabel + ')', note: 'from the construction-type table' });
    var lllGapOk = r.hLLL >= 300;
    out.push({
      label: 'LLLL → LLL gap (recommend 300–500 mm, default 400)',
      ok: lllGapOk, value: U(r.hLLL, 'length-mm', 0),
      note: lllGapOk ? 'adequate separation' : 'too tight — instrumentation/alarm response margin is thin; suggest ≥ ' + U(400, 'length-mm', 0)
    });
    var hllGapOk = r.hHLL >= 300;
    out.push({
      label: 'HHLL → HLL gap (recommend 300–500 mm, default 400)',
      ok: hllGapOk, value: U(r.hHLL, 'length-mm', 0),
      note: hllGapOk ? 'adequate separation' : 'too tight — overflow response margin is thin; suggest ≥ ' + U(400, 'length-mm', 0)
    });
    /* Capacity check — working capacity must meet required */
    var capOk = r.workCap >= (r.reqCap - 1e-6);
    out.push({
      label: 'Capacity check — working ≥ required',
      ok: capOk, value: U(r.workCap, 'volume', 2) + ' vs ' + U(r.reqCap, 'volume', 2),
      note: capOk ? 'design meets requirement' : 'FAIL — increase D/H or reduce LLLL/HHLL gaps',
      priority: !capOk ? 'critical' : undefined
    });
    /* Freeboard check */
    var freeboardOk = r.H - r.hHHLL >= 0.3;
    out.push({
      label: 'Freeboard above HHLL (API 650 min ≥ 0.3 m)',
      ok: freeboardOk, value: U((r.H - r.hHHLL), 'length-m', 2),
      note: freeboardOk ? 'adequate freeboard' : 'below minimum — increase tank height',
      priority: !freeboardOk ? 'critical' : undefined
    });
    return out;
  }

  /* ─────────── results ─────────── */
  function calc() {
    if (!$('tk-results')) return;
    if (window.ARORESET && window.ARORESET.is('tk')) {
      window.ARORESET.placeholder($('tk-results'), 'the tank');
      var st0 = $('tk-status'); if (st0) { st0.style.display = 'none'; st0.textContent = ''; }
      if (three && three.group) { while (three.group.children.length) { var c0 = three.group.children.pop(); if (c0.geometry) c0.geometry.dispose(); } }
      return;
    }
    var r = LAST = compute();
    var f0 = function (x) { return isFinite(x) ? Math.round(x).toLocaleString() : '—'; };
    var f1 = function (x) { return isFinite(x) ? x.toFixed(1) : '—'; };
    var f2 = function (x) { return isFinite(x) ? x.toFixed(2) : '—'; };
    var row = function (l, v, c) { return '<div class="tk-rr ' + (c || '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
    var h = '';

    h += '<div class="tk-cardh">CAPACITY &amp; GEOMETRY</div>';
    h += row('L/D ratio', f2(r.LD) + '  (' + r.svc + ' band ' + r.band[0] + '–' + r.band[1] + ')', r.ldOk ? 'ok' : 'warn');
    h += row('Total geometric capacity', U(r.geoCap, 'volume', 2));
    h += row('Total working height', U(r.workH, 'length-mm', 1));
    h += row('Total working capacity', U(r.workCap, 'volume', 2));
    h += row('Required working capacity', U(r.reqCap, 'volume', 2));
    h += row('Capacity check', r.capOk ? 'PASS — capacity adequate' : 'FAIL — increase tank size', r.capOk ? 'ok' : 'warn');

    h += '<div class="tk-cardh">LIQUID LEVELS (from bottom)</div>';
    h += row('BTL', U(0, 'length-mm', 0));
    h += row('LLLL  (low low — trip)', U(r.elLLLL, 'length-mm', 1));
    h += row('LLL  (low — alarm)', U(r.elLLL, 'length-mm', 1));
    h += row('HLL  (high — alarm)', U(r.elHLL, 'length-mm', 1));
    h += row('HHLL  (high high — trip)', U(r.elHHLL, 'length-mm', 1));
    h += row('Overflow nozzle', U(r.elOverflow, 'length-mm', 1) + '  (' + U(300, 'length-mm', 0) + ' below TTL)');
    h += row('TTL', U(r.elTTL, 'length-mm', 1));
    h += row('Freeboard above HLL', U(r.freeboard, 'length-mm', 1) + '  (min ' + U(300, 'length-mm', 0) + ')', r.fbOk ? 'ok' : 'warn');

    h += '<div class="tk-cardh">LEVEL BUILD-UP</div>';
    h += row('LLLL: nozzle CL + r + liquid', U(r.lllCalc, 'length-mm', 1) + ' → used ' + U(r.hLLLL, 'length-mm', 1));
    h += row('LLLL→LLL (residence)', U(r.hResOut, 'length-mm', 1) + ' → used ' + U(r.hLLL, 'length-mm', 1));
    h += row('HHLL below curb (1.5×ovf)', U(r.hCurbApi, 'length-mm', 1) + ' → used ' + U(r.hHHLLcurb, 'length-mm', 1));
    h += row('HHLL→HLL (residence)', U(r.hResIn, 'length-mm', 1) + ' → used ' + U(r.hHLL, 'length-mm', 1));

    h += '<div class="tk-cardh">SHELL DESIGN — API 650 (1-FOOT METHOD)</div>';
    h += row('Specific gravity G', f2(r.G));
    h += row('Allowable stress S', U(r.mat.S, 'stress', 0) + '  ·  E = ' + r.E);
    h += row('t = 4.9·D·(H−0.3)·G/(S·E) + CA', U(r.tCalc, 'length-mm', 2));
    h += row('API 650 minimum shell', U(r.tMinApi, 'length-mm', 2));
    h += row('Required thickness', U(r.tReq, 'length-mm', 2));
    h += row('Selected thickness', U(r.t, 'length-mm', 1), r.tOk ? 'ok' : 'warn');
    if (!r.tOk) h += row('⚠ Thickness check', 'BELOW required — increase', 'warn');

    h += '<div class="tk-cardh">WEIGHT TAKE-OFF (' + esc(r.matName) + ', ρ ' + U(r.mat.rho, 'density', 0) + ')</div>';
    h += row('Shell plate', U(r.wShell, 'mass', 0));
    h += row('Bottom plate', U(r.wBottom, 'mass', 0));
    h += row('Roof plate', U(r.wRoof, 'mass', 0));
    h += row('Appurtenances (12 %)', U(r.wAppurt, 'mass', 0));
    h += row('Empty (erection) weight', U(r.wEmpty, 'mass', 0), 'ok');
    h += row('Operating weight', U(r.wOper, 'mass', 0));
    h += row('Hydrotest weight (water full)', U(r.wTest, 'mass', 0));

    /* ═════════════════════════════════════════════════════════════════════
       DESIGN CORRECTION WINDOW — comprehensive validation & fixes
       Shows critical/warning/pass status with actionable corrections ═════════════════════════════════════════════════════════════════════ */
    var checks = designAssistant(r);
    var critical = checks.filter(function(c) { return c.priority === 'critical' || !c.ok; });
    var passes = checks.filter(function(c) { return c.ok; });

    h += '<div style="background:linear-gradient(135deg,rgba(15,23,42,0.6),rgba(30,41,59,0.6));border:1px solid var(--border-muted);border-radius:6px;padding:12px;margin-bottom:12px;">'
      + '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:#e2e8f0;letter-spacing:0.06em;margin-bottom:8px;">🔍 DESIGN CORRECTION WINDOW</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">'
      + '<div style="background:rgba(34,197,94,0.1);border:1px solid #22c55e;border-radius:4px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#22c55e;">' + passes.length + '</div><div style="font-size:8px;color:#86efac;">PASS</div></div>'
      + '<div style="background:rgba(251,191,36,0.1);border:1px solid #fbbf24;border-radius:4px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#fbbf24;">' + checks.filter(function(c){return !c.ok && !c.priority;}).length + '</div><div style="font-size:8px;color:#fcd34d;">REVIEW</div></div>'
      + '<div style="background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:4px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#ef4444;">' + critical.length + '</div><div style="font-size:8px;color:#fca5a5;">CRITICAL</div></div>'
      + '</div>';

    if (critical.length > 0) {
      h += '<div style="background:rgba(239,68,68,0.08);border-left:3px solid #ef4444;padding:8px;margin-bottom:10px;border-radius:3px;">'
        + '<div style="font-family:var(--font-mono);font-size:9px;font-weight:700;color:#fca5a5;margin-bottom:6px;">⚠ CRITICAL FAILURES — DESIGN WILL NOT WORK</div>';
      critical.forEach(function(c) {
        h += '<div style="font-family:var(--font-mono);font-size:8.5px;color:#cbd5e1;margin:4px 0;line-height:1.4;">'
          + '<span style="color:#ef4444;font-weight:600;">✕</span> <b>' + c.label + '</b> [' + c.value + ']<br/>'
          + '<span style="color:#94a3b8;margin-left:16px;">→ ' + c.note + '</span></div>';
      });
      h += '</div>';
    }

    h += '<div style="max-height:200px;overflow-y:auto;">';
    checks.forEach(function(c) {
      if (c.ok) {
        h += '<div style="font-family:var(--font-mono);font-size:8.5px;color:#86efac;margin:3px 0;"><span style="color:#22c55e;font-weight:600;">✓</span> ' + c.label + ' <span style="color:#64748b;">[' + c.value + ']</span></div>';
      }
    });
    h += '</div></div>';

    h += '<div class="tk-cardh">DESIGN ASSISTANT — INDUSTRY THUMB-RULE CHECK</div>';
    h += '<div style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-bottom:4px;">Advisory only — cross-checked against field-practice bands, not the governing API 650 calculation above.</div>';
    checks.forEach(function (c) {
      h += row(c.label, c.value + '  — ' + c.note, c.ok ? 'ok' : 'warn');
    });

    $('tk-results').innerHTML = h;
    var tag = $('tk-3dtag');
    if (tag) tag.textContent = U(r.Dm, 'length-m', 1) + ' Ø × ' + U(r.Hm, 'length-m', 1) + ' · ' + r.roof + ' · ' + U(r.workCap, 'volume', 2) + ' working';
    update3D(r);
    updateMatInfo();
    updateMatHint(r);
    updateRoofHint(r);
  }

  /* "User defined" carries no library numbers — the engineer types them,
     so the fields start blank and only these values are used. */
  function resolveMat(name) {
    var m = MATERIALS[name];
    if (m && m.rho != null) return m;
    return { rho: num('tk-matrho', 0), S: num('tk-matS', 0), rough: num('tk-matrough', 0) };
  }

  function updateMatInfo() {
    var el = $('tk-matinfo'); if (!el) return;
    var name = val('tk-mat', 'CS (A36 / IS 2062)');
    var lib = MATERIALS[name];
    var box = $('tk-matuser');
    var userDef = !lib || lib.rho == null;
    if (box) box.style.display = userDef ? 'block' : 'none';
    if (userDef) { el.textContent = 'Enter density, allowable stress and roughness for this material.'; return; }
    el.textContent = 'ρ ' + U(lib.rho, 'density', 0) + ' · allowable stress S ' + U(lib.S, 'stress', 0) + ' · roughness ' + U(lib.rough, 'length-mm', 3);
  }
  function materialFamily(name) {
    if (/SS\d|Duplex|Inconel|Monel|Hastelloy/.test(name)) return 'stainless / high-alloy';
    if (/PVC|CPVC|HDPE|FRP/.test(name)) return 'polymer / lined';
    if (/Copper|Brass/.test(name)) return 'copper alloy';
    if (/Concrete/.test(name)) return 'concrete';
    return 'carbon / low-alloy steel';
  }
  /* Material guidance from two independent drivers — the fluid's corrosivity
     (from FLUID_CORROSIVITY) and how hot the design runs — taking whichever
     one calls for the more demanding material. This is advisory only: it
     never changes TANK MATERIAL itself, only flags when the current choice's
     family doesn't match what the guidance would pick. */
  function recommendMaterial(fluid, tdes) {
    var corr = FLUID_CORROSIVITY[fluid] || 'unknown';
    var rec = 'CS (A36 / IS 2062)', reasons = [], severity = 'info';
    if (corr === 'hygienic') { rec = 'SS304'; reasons.push('food-grade service — stainless for hygiene and cleanability'); severity = 'warn'; }
    else if (corr === 'corrosive') { rec = 'SS316'; reasons.push('chemical service — verify actual chemical compatibility; consider SS316/Duplex or a lined CS tank'); severity = 'warn'; }
    else if (corr === 'unknown') { reasons.push('fluid not identified from a preset — confirm corrosion compatibility before fixing the material'); severity = 'warn'; }
    else if (corr === 'mild') { reasons.push('mildly corrosive — carbon steel is normally fine with the corrosion allowance provided'); }
    else { reasons.push('non-corrosive service — plain carbon steel is standard'); }

    if (isFinite(tdes) && tdes > 200) {
      if (!/SS\d|Duplex|Inconel|Hastelloy|Monel/.test(rec)) rec = 'SS321';
      reasons.push('design temperature exceeds the typical atmospheric-tank range — verify API 620 / ASME VIII applicability and use a high-temperature-rated material');
      severity = 'warn';
    } else if (isFinite(tdes) && tdes > 90) {
      reasons.push('above ~90 °C — verify low-temperature/creep data for the selected plate and consider stress-relieving a carbon-steel shell');
      if (severity === 'info') severity = 'review';
    }
    return { material: rec, reason: reasons.join('; '), severity: severity };
  }
  function updateMatHint(r) {
    var el = $('tk-mathint'); if (!el) return;
    var rec = recommendMaterial(r.fluid, r.tdes);
    var mismatch = severityWeight(rec.severity) > 0 && materialFamily(rec.material) !== materialFamily(r.matName);
    el.innerHTML = '⚗ <b>Material guidance for ' + esc(r.fluid) + ' at ' + U(r.tdes, 'temperature', 0) + ':</b> '
      + esc(rec.material) + ' — ' + esc(rec.reason)
      + (mismatch ? '  <b style="color:#f87171;">— selected material (' + esc(r.matName) + ') is a different family; review.</b>' : '');
  }
  function severityWeight(s) { return s === 'warn' ? 2 : s === 'review' ? 1 : 0; }
  function updateRoofHint(r) {
    var el = $('tk-roofhint'); if (!el) return;
    var sug = ROOF_GUIDE[val('tk-fluid', 'Water')] || 'Cone or Dome Roof';
    el.innerHTML = '🛢 <b>Recommended roof for ' + esc(val('tk-fluid', 'Water')) + ':</b> ' + esc(sug)
      + ' · API 650 limits: Ø ≤ ' + U(60, 'length-m', 0) + ', height ≤ ' + U(25, 'length-m', 0)
      + ', freeboard ≥ ' + U(300, 'length-mm', 0) + ' (agitated ≥ ' + U(750, 'length-mm', 0) + ').';
  }

  /* ─────────── 3D ─────────── */
  var tkView = 'outside';
  function init3D() {
    if (typeof THREE === 'undefined') return;
    var canvas = $('tk-canvas'); if (!canvas) return;
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1220);
    var cam = new THREE.PerspectiveCamera(45, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 900);
    var rn = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    rn.setPixelRatio(window.devicePixelRatio || 1);
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2b3242, 0.9));
    var dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(20, 30, 20); scene.add(dir);
    scene.add(new THREE.GridHelper(140, 28, 0x224, 0x1a2740));
    var group = new THREE.Group(); scene.add(group);
    var sph = { r: 46, theta: 0.9, phi: 1.15, tx: 0, ty: 6, tz: 0 };
    function place() {
      var x = sph.r * Math.sin(sph.phi) * Math.sin(sph.theta), y = sph.r * Math.cos(sph.phi), z = sph.r * Math.sin(sph.phi) * Math.cos(sph.theta);
      cam.position.set(sph.tx + x, sph.ty + y, sph.tz + z); cam.lookAt(sph.tx, sph.ty, sph.tz);
    }
    three = { scene: scene, cam: cam, rn: rn, group: group, sph: sph, place: place, canvas: canvas };
    place();
    var down = null;
    canvas.addEventListener('mousedown', function (e) { down = { x: e.clientX, y: e.clientY, th: sph.theta, ph: sph.phi }; });
    window.addEventListener('mousemove', function (e) {
      if (!down) return;
      sph.theta = down.th - (e.clientX - down.x) * 0.01;
      sph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, down.ph - (e.clientY - down.y) * 0.01));
      place();
    });
    window.addEventListener('mouseup', function () { down = null; });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(10, Math.min(240, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); place(); }, { passive: false });
    (function loop() { requestAnimationFrame(loop); rn.render(scene, cam); })();
    window.addEventListener('resize', resize3D);
  }
  function resize3D() {
    if (!three) return; var c = three.canvas; if (!c || !c.clientWidth) return;
    three.cam.aspect = c.clientWidth / c.clientHeight; three.cam.updateProjectionMatrix();
    three.rn.setSize(c.clientWidth, c.clientHeight, false);
  }

  function update3D(r) {
    if (!three) return;
    var g = three.group;
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var cut = tkView === 'cutaway';
    // scale: model units ≈ metres, exaggerate thin plate so it reads
    var R = Math.max(0.6, r.Dm / 2), H = Math.max(0.8, r.Hm);
    var matCol = /SS|Duplex|Inconel|Monel|Hastelloy/.test(r.matName) ? 0xc9d3dd
               : /Copper/.test(r.matName) ? 0xb87333 : /Brass/.test(r.matName) ? 0xc8a748
               : /PVC|CPVC|HDPE|FRP/.test(r.matName) ? 0xe2e8f0 : 0x9aa6b4;
    var shellMat = new THREE.MeshStandardMaterial({
      color: matCol, metalness: /PVC|CPVC|HDPE|FRP|Concrete/.test(r.matName) ? 0.1 : 0.85,
      roughness: 0.35, side: THREE.DoubleSide, transparent: cut, opacity: cut ? 0.22 : 1
    });
    var deck = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide, transparent: cut, opacity: cut ? 0.3 : 1 });

    // shell
    var shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 56, 1, true), shellMat);
    shell.position.y = H / 2; g.add(shell);
    // bottom
    var bot = new THREE.Mesh(new THREE.CircleGeometry(R, 56), deck);
    bot.rotation.x = -Math.PI / 2; bot.position.y = 0.01; g.add(bot);
    // foundation ring
    var pad = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.12, R * 1.18, 0.25, 48), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 }));
    pad.position.y = -0.13; g.add(pad);

    // roof by selection
    if (/Cone/.test(r.roof)) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(R * 1.02, Math.max(0.25, r.roofRise), 56, 1, true), shellMat);
      cone.position.y = H + Math.max(0.25, r.roofRise) / 2; g.add(cone);
    } else if (/Dome/.test(r.roof)) {
      var dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2.6), shellMat);
      dome.position.y = H; g.add(dome);
    } else if (/Flat/.test(r.roof)) {
      var flat = new THREE.Mesh(new THREE.CircleGeometry(R * 1.02, 56), shellMat);
      flat.rotation.x = -Math.PI / 2; flat.position.y = H; g.add(flat);
    } else if (/Floating/.test(r.roof)) {
      // floating deck sits ON the liquid
      var lvl = (r.elHLL / 1000);
      var fl = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.22, 48), deck);
      fl.position.y = Math.min(H - 0.2, Math.max(0.3, lvl)); g.add(fl);
      if (/External/.test(r.roof)) {
        var rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.97, 0.06, 8, 48), deck);
        rim.rotation.x = Math.PI / 2; rim.position.y = fl.position.y + 0.12; g.add(rim);
      }
    }
    // curb / wind girder
    var curb = new THREE.Mesh(new THREE.TorusGeometry(R * 1.005, 0.05, 8, 56), deck);
    curb.rotation.x = Math.PI / 2; curb.position.y = H; g.add(curb);

    // liquid + level planes (cut-away)
    var liqH = Math.max(0.05, r.elHLL / 1000);
    var liq = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.985, R * 0.985, liqH, 48),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, transparent: true, opacity: cut ? 0.55 : 0.28, roughness: 0.25 }));
    liq.position.y = liqH / 2; g.add(liq);

    if (cut) {
      var lv = [[r.elLLLL, 0x8b5cf6], [r.elLLL, 0x22c55e], [r.elHLL, 0xf59e0b], [r.elHHLL, 0xef4444]];
      lv.forEach(function (L) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.99, 0.035, 6, 48), new THREE.MeshBasicMaterial({ color: L[1] }));
        ring.rotation.x = Math.PI / 2; ring.position.y = L[0] / 1000; g.add(ring);
      });
    }

    // nozzles: outlet (bottom), inlet (top), overflow
    var nz = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.7, roughness: 0.4 });
    var nzb = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.7, roughness: 0.4 });
    function nozzle(y, mtl, rad) {
      var n = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, R * 0.5, 16), mtl);
      n.rotation.z = Math.PI / 2; n.position.set(R + R * 0.22, y, 0); g.add(n);
    }
    nozzle(Math.max(0.15, r.elLLLL / 1000 * 0.4), nzb, Math.max(0.06, r.dOut * 0.0254 / 2));
    nozzle(H * 0.92, nz, Math.max(0.06, r.dOut * 0.0254 / 2));
    nozzle(r.elOverflow / 1000, nz, Math.max(0.05, r.dOvf * 0.0254 / 2));

    // ladder — two rails + rungs, with a safety cage above ~6 m (the usual
    // field-practice threshold for a fixed ladder needing one)
    var ladderMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.45 });
    var railGap = 0.42, ladderX = -R - 0.35;
    [-railGap / 2, railGap / 2].forEach(function (dz) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, H, 0.035), ladderMat);
      rail.position.set(ladderX, H / 2, dz); g.add(rail);
    });
    var rungGap = 0.3;
    for (var ry = 0.3; ry < H; ry += rungGap) {
      var rung = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, railGap), ladderMat);
      rung.position.set(ladderX, ry, 0); g.add(rung);
    }
    var CAGE_H = 6;   // m — OSHA/API field practice: fixed ladders over ~20 ft get a cage
    if (H > CAGE_H) {
      var cageMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.5 });
      var cageR = 0.42, hoopGap = 1.5, cageTop = H - 0.2;
      for (var cy = 2.2; cy < cageTop; cy += hoopGap) {
        // half-hoop, open on the tank side so the climber can step in/out
        var hoop = new THREE.Mesh(new THREE.TorusGeometry(cageR, 0.018, 6, 20, Math.PI), cageMat);
        hoop.rotation.x = Math.PI / 2; hoop.rotation.z = Math.PI / 2;
        hoop.position.set(ladderX, cy, 0); g.add(hoop);
      }
      // three vertical stringers tracing the hoop profile on the outward half
      [-Math.PI / 2, 0, Math.PI / 2].forEach(function (ang) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(0.018, cageTop - 2.2, 0.018), cageMat);
        bar.position.set(ladderX - Math.cos(ang) * cageR, (cageTop + 2.2) / 2, Math.sin(ang) * cageR); g.add(bar);
      });
    }

    three.sph.tx = 0; three.sph.ty = H * 0.45;
    three.sph.r = Math.max(12, Math.max(R * 2.6, H * 2.4) + 6);
    three.place();
  }

  /* ─────────── wiring ─────────── */
  var INPUT_IDS = ['tk-tag', 'tk-loc', 'tk-project', 'tk-client', 'tk-engineer', 'tk-rev', 'tk-fluid', 'tk-rho', 'tk-tdes',
    'tk-pdes', 'tk-ca', 'tk-mat', 'tk-matrho', 'tk-matS', 'tk-matrough', 'tk-orient', 'tk-roof', 'tk-service', 'tk-reqcap', 'tk-H', 'tk-D', 'tk-t', 'tk-tb', 'tk-E',
    'tk-noz-cl', 'tk-noz-out', 'tk-liq-above', 'tk-lll-spec', 'tk-q-out', 'tk-res-out', 'tk-lll-min',
    'tk-noz-ovf', 'tk-hhll-spec', 'tk-q-in', 'tk-res-in', 'tk-hll-min'];
  var DEFAULTS = null, UNDO = [], REDO = [], lastSnap = null;
  function snapshot() { var s = {}; INPUT_IDS.forEach(function (id) { var e = $(id); if (e) s[id] = e.value; }); return s; }
  function restore(s) { if (!s) return; INPUT_IDS.forEach(function (id) { var e = $(id); if (e && s[id] !== undefined) e.value = s[id]; }); calc(); }
  /* RESET clears the sheet so every value is entered by hand — dropdowns fall
     back to their first entry, all typed fields go blank. */
  function blankAll() {
    INPUT_IDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = '';
    });
    /* A reset must leave no result behind — and no recalculation may refill
       the panel from the blanks until the engineer starts entering again. */
    if (window.ARORESET) {
      window.ARORESET.wipe('tk', ['tk-results', 'tk-status']);
      window.ARORESET.watch('tk', 'tab-tank');
    }
    LAST = null;
    updateMatInfo(); calc();
  }
  function pushUndo() { if (lastSnap) UNDO.push(lastSnap); if (UNDO.length > 60) UNDO.shift(); REDO = []; lastSnap = snapshot(); }
  function updHistBtns() {
    var u = $('tk-undo'), r = $('tk-redo');
    if (u) { u.disabled = !UNDO.length; u.style.opacity = UNDO.length ? '1' : '0.4'; }
    if (r) { r.disabled = !REDO.length; r.style.opacity = REDO.length ? '1' : '0.4'; }
  }

  /* Update nozzle sizing suggestion zones based on current flow rate */
  function updateNozzleSuggestion(nozzleType) {
    if (nozzleType === 'outlet') {
      var Q = num('tk-q-out', 0);
      var sugDiv = $('tk-noz-suggest'), nps = $('tk-noz-nps');
      if (sugDiv) {
        if (Q > 0) {
          var suggested = suggestNozzleNPS(Q, 'discharge');
          if (suggested && nps && nps.value !== suggested) {
            sugDiv.style.display = 'block';
            sugDiv.innerHTML = '💡 Outlet flow ' + Q.toFixed(1) + ' m³/hr → suggested NPS ' + PIPE_NPS[suggested].label + ' (OD ' + PIPE_NPS[suggested].od.toFixed(2) + '")';
          } else {
            sugDiv.style.display = 'none';
          }
        } else {
          sugDiv.style.display = 'none';
        }
      }
      var lllDiv = $('tk-lll-auto');
      if (lllDiv && Q > 0) {
        var tres = num('tk-res-out', 3);
        var lllCalc = Q * tres * 1000 / 60 / Math.PI;  // rough estimate
        lllDiv.style.display = 'block';
        lllDiv.innerHTML = '→ LLL (from ' + tres + ' min residence) ≈ ' + Math.round(lllCalc) + ' mm above LLLL';
      }
    } else if (nozzleType === 'overflow') {
      var Q2 = num('tk-q-in', 0);
      var sugDiv2 = $('tk-ovf-suggest'), nps2 = $('tk-ovf-nps');
      if (sugDiv2) {
        if (Q2 > 0) {
          var suggested2 = suggestNozzleNPS(Q2, 'discharge');
          if (suggested2 && nps2 && nps2.value !== suggested2) {
            sugDiv2.style.display = 'block';
            sugDiv2.innerHTML = '💡 Inlet flow ' + Q2.toFixed(1) + ' m³/hr → suggested NPS ' + PIPE_NPS[suggested2].label + ' (OD ' + PIPE_NPS[suggested2].od.toFixed(2) + '")';
          } else {
            sugDiv2.style.display = 'none';
          }
        } else {
          sugDiv2.style.display = 'none';
        }
      }
      var hllDiv = $('tk-hll-auto');
      if (hllDiv && Q2 > 0) {
        var tres2 = num('tk-res-in', 3);
        var hllCalc = Q2 * tres2 * 1000 / 60 / Math.PI;
        hllDiv.style.display = 'block';
        hllDiv.innerHTML = '→ HLL (from ' + tres2 + ' min residence) ≈ ' + Math.round(hllCalc) + ' mm below HHLL';
      }
    }
  }

  function wire() {
    /* Picking a Service Fluid should fill in its density the same way the
       line-sizing fluid pickers do — registered before the generic INPUT_IDS
       loop below so this runs first and calc() (fired by that loop's own
       'change' listener on the same element) sees the freshly-written value
       rather than whatever was left in the field a moment ago. */
    var flSel = $('tk-fluid');
    if (flSel) flSel.addEventListener('change', function () {
      var p = FLUID_PROPS[flSel.value];
      var rhoEl = $('tk-rho');
      if (rhoEl) rhoEl.value = (p && p.rho != null) ? Number(CV(p.rho, 'density').toFixed(6)).toString() : '';
      /* Update fluid properties table */
      var propsDiv = $('tk-fluidprops'), tbl = $('tk-fluidtable');
      if (propsDiv && tbl && p) {
        var hasData = p.rho != null || p.mu != null || p.sigma != null;
        propsDiv.style.display = hasData ? 'block' : 'none';
        if (hasData) {
          var rows = [];
          if (p.rho != null) rows.push(['Density ρ', p.rho.toFixed(0), 'kg/m³']);
          if (p.SG != null) rows.push(['Specific Gravity (SG)', p.SG.toFixed(3), '—']);
          if (p.mu != null) rows.push(['Dynamic Viscosity μ', p.mu.toFixed(3), 'mPa·s']);
          if (p.sigma != null) rows.push(['Surface Tension σ', p.sigma.toFixed(1), 'mN/m']);
          if (p.lambda != null) rows.push(['Thermal Conductivity λ', p.lambda.toFixed(3), 'W/m·K']);
          if (p.cp != null) rows.push(['Specific Heat cₚ', p.cp.toFixed(2), 'kJ/kg·K']);
          if (p.alpha != null) rows.push(['Thermal Expansion α', (p.alpha * 10000).toFixed(1), '×10⁻⁴ K⁻¹']);
          if (p.fp != null) rows.push(['Flash Point', p.fp, '°C']);
          if (p.bp != null) rows.push(['Boiling Point', p.bp.toFixed(0), '°C']);
          tbl.innerHTML = rows.map(function(r) { return '<tr style="border-bottom:1px solid rgba(51,65,85,0.6);"><td style="padding:2px 4px;text-align:left;">' + r[0] + '</td><td style="padding:2px 4px;text-align:right;font-weight:600;color:#38bdf8;">' + r[1] + '</td><td style="padding:2px 4px;text-align:left;">' + r[2] + '</td></tr>'; }).join('');
          if (p.note) tbl.innerHTML += '<tr><td colspan="3" style="padding:3px 4px;color:#94a3b8;font-size:8px;margin-top:2px;border-top:1px solid rgba(51,65,85,0.6);padding-top:3px;">' + p.note + '</td></tr>';
        }
      }
    });
    /* Outlet nozzle (LLLL) NPS/Schedule selector with synced legacy field */
    var nozNps = $('tk-noz-nps'), nozSch = $('tk-noz-sch');
    if (nozNps) nozNps.addEventListener('change', function() {
      if (nozNps.value && PIPE_NPS[nozNps.value]) {
        var od = PIPE_NPS[nozNps.value].od;
        $('tk-noz-out').value = od.toFixed(2);
        updateNozzleSuggestion('outlet');
        pushUndo(); calc(); updHistBtns();
      }
    });
    if (nozSch) nozSch.addEventListener('change', function() {
      updateNozzleSuggestion('outlet');
      pushUndo(); calc(); updHistBtns();
    });
    /* Overflow nozzle (HHLL) NPS/Schedule selector with synced legacy field */
    var ovfNps = $('tk-ovf-nps'), ovfSch = $('tk-ovf-sch');
    if (ovfNps) ovfNps.addEventListener('change', function() {
      if (ovfNps.value && PIPE_NPS[ovfNps.value]) {
        var od = PIPE_NPS[ovfNps.value].od;
        $('tk-noz-ovf').value = od.toFixed(2);
        updateNozzleSuggestion('overflow');
        pushUndo(); calc(); updHistBtns();
      }
    });
    if (ovfSch) ovfSch.addEventListener('change', function() {
      updateNozzleSuggestion('overflow');
      pushUndo(); calc(); updHistBtns();
    });
    INPUT_IDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      e.addEventListener('input', function () { pushUndo(); calc(); updHistBtns(); });
      e.addEventListener('change', function () {
        /* Update nozzle suggestions when flow rates change */
        if (id === 'tk-q-out' || id === 'tk-q-in') updateNozzleSuggestion(id === 'tk-q-out' ? 'outlet' : 'overflow');
        pushUndo(); calc(); updHistBtns();
      });
    });
    var cb = $('tk-calc'); if (cb) cb.addEventListener('click', function () { if (window.ARORESET) window.ARORESET.lift('tk'); calc(); runStatus(); });
    var rb = $('tk-report'); if (rb) rb.addEventListener('click', report);
    var db = $('tk-draw'); if (db) db.addEventListener('click', drawing);
    var ub = $('tk-undo'); if (ub) ub.addEventListener('click', function () {
      if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); lastSnap = snapshot(); updHistBtns();
    });
    var rdb = $('tk-redo'); if (rdb) rdb.addEventListener('click', function () {
      if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); lastSnap = snapshot(); updHistBtns();
    });
    var rs = $('tk-reset'); if (rs) rs.addEventListener('click', function () {
      pushUndo(); blankAll(); updHistBtns();
    });
    function setView(v) {
      tkView = v;
      var a = $('tk-view-out'), b = $('tk-view-cut');
      if (a) a.classList.toggle('tk-viewon', v === 'outside');
      if (b) b.classList.toggle('tk-viewon', v === 'cutaway');
      if (LAST) update3D(LAST);
    }
    var va = $('tk-view-out'); if (va) va.addEventListener('click', function () { setView('outside'); });
    var vc = $('tk-view-cut'); if (vc) vc.addEventListener('click', function () { setView('cutaway'); });
    var usel = document.getElementById('global-unit-system');
    if (usel && !usel._tkBound) { usel._tkBound = true; usel.addEventListener('change', function () { setTimeout(calc, 0); }); }
    lastSnap = snapshot(); if (!DEFAULTS) DEFAULTS = snapshot();
    updHistBtns();
  }

  function runStatus() {
    var el = $('tk-run-status'); if (!el || !LAST) return;
    var r = LAST;
    el.style.display = 'block';
    el.style.background = r.capOk && r.tOk ? 'linear-gradient(135deg,#22c55e,#4ade80)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)';
    el.innerHTML = (r.capOk && r.tOk ? '✓ DESIGN COMPLETE' : '⚠ REVIEW REQUIRED')
      + ' · Ø' + U(r.Dm, 'length-m', 1) + ' × ' + U(r.Hm, 'length-m', 1) + ' · ' + U(r.workCap, 'volume', 1) + ' working · shell '
      + U(r.t, 'length-mm', 1) + ' · ' + U(r.wEmpty, 'mass', 0) + ' empty';
  }

  /* ─────────── GA drawing + BOM ─────────── */
  function bomRows(r) {
    // Column index 4 is the "Unit Wt" column — every entry is an SI kg figure
    // converted to the active unit system through f0(), so the BOM reads
    // correctly in US/CGS the same way the top-level weight take-off does.
    var f0 = function (x) { return U(x, 'mass', 0); };
    return [
      ['Shell plate', r.matName, 1, 'API 650 · t ' + U(r.t, 'length-mm', 1), f0(r.wShell), 'Ø' + U(r.D, 'length-mm', 0) + ' × ' + U(r.H, 'length-mm', 0)],
      ['Bottom plate', r.matName, 1, 'API 650 · t ' + U(r.tb, 'length-mm', 1), f0(r.wBottom), '≥' + U(6, 'length-mm', 0) + ' + CA'],
      ['Roof plate (' + r.roof + ')', r.matName, 1, 't ' + U(r.tRoof, 'length-mm', 1), f0(r.wRoof), r.roofRise ? 'rise ' + U(r.roofRise * 1000, 'length-mm', 0) : 'flat / floating'],
      ['Top curb angle', r.matName, 1, 'API 650', f0(r.wSteel * 0.02), 'Wind girder'],
      ['Inlet nozzle', r.matName, 1, 'ASME B16.5 · ' + r.dOut + '"', f0(r.dOut * 4), 'Top entry'],
      ['Outlet nozzle', r.matName, 1, 'ASME B16.5 · ' + r.dOut + '"', f0(r.dOut * 4), 'CL ' + U(num('tk-noz-cl', 240), 'length-mm', 0) + ' from bottom'],
      ['Overflow nozzle', r.matName, 1, 'ASME B16.5 · ' + r.dOvf + '"', f0(r.dOvf * 4), U(300, 'length-mm', 0) + ' below TTL'],
      ['Drain nozzle', r.matName, 1, 'ASME B16.5 · 2"', f0(8), 'Bottom, sloped'],
      ['Vent / breather', r.matName, 1, 'API 2000', f0(12), 'Thermal in/out breathing'],
      ['Manhole (shell)', r.matName, 1, 'API 650 · 24"', f0(85), 'Shell access'],
      ['Manhole (roof)', r.matName, 1, 'API 650 · 20"', f0(60), 'Roof access'],
      ['Level instrument set', 'SS316', 1, 'LLLL/LLL/HLL/HHLL', f0(25), 'Alarms + trips'],
      ['Spiral stairway', 'CS galvanised', 1, 'IS 3844', f0(r.Hm * 55), 'With handrail'],
      ['Handrail / platform', 'CS galvanised', 1, '—', f0(r.Dm * 28), 'Roof perimeter'],
      ['Earthing lug', 'CS', 2, 'IS 3043', f0(3), 'Static bonding'],
      ['Name plate', 'SS304', 1, 'API 650', f0(1), 'Laser etched']
    ];
  }

  function drawing() {
    var r = LAST || compute();
    var W = 1540, Hh = 1420;
    var line = function (x1, y1, x2, y2, w, c, d) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (c || '#0f172a') + '" stroke-width="' + (w || 1) + '"' + (d ? ' stroke-dasharray="' + d + '"' : '') + '/>'; };
    var txt = function (x, y, t, s, c, a, w) { return '<text x="' + x + '" y="' + y + '" font-size="' + (s || 9) + '" fill="' + (c || '#0f172a') + '"' + (a ? ' text-anchor="' + a + '"' : '') + (w ? ' font-weight="' + w + '"' : '') + ' font-family="Arial">' + esc(t) + '</text>'; };
    var rect = function (x, y, w, h, f, s, sw) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (f || 'none') + '"' + (s ? ' stroke="' + s + '" stroke-width="' + (sw || 1) + '"' : '') + '/>'; };
    function table(x, y, cw, rows, hd) {
      var out = '', rh = 16, tw = cw.reduce(function (a, b) { return a + b; }, 0);
      rows.forEach(function (row, ri) {
        var cy = y + ri * rh, cx = x;
        if (hd && ri === 0) out += rect(x, cy, tw, rh, '#e2e8f0');
        row.forEach(function (cell, ci) {
          out += rect(cx, cy, cw[ci], rh, 'none', '#334155', 0.7);
          out += txt(cx + 4, cy + 11, cell, 8.5, '#0f172a', 'start', (hd && ri === 0) ? '700' : '400');
          cx += cw[ci];
        });
      });
      return out;
    }
    function dim(x1, y1, x2, y2, lbl) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return line(x1, y1, x2, y2, 0.7, '#dc2626')
        + '<polygon points="' + x1 + ',' + y1 + ' ' + (x1 + 5) + ',' + (y1 - 2.5) + ' ' + (x1 + 5) + ',' + (y1 + 2.5) + '" fill="#dc2626"/>'
        + '<polygon points="' + x2 + ',' + y2 + ' ' + (x2 - 5) + ',' + (y2 - 2.5) + ' ' + (x2 - 5) + ',' + (y2 + 2.5) + '" fill="#dc2626"/>'
        + txt(mx, (y1 === y2 ? y1 - 3 : my), lbl, 8, '#dc2626', 'middle', '700');
    }

    var s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" style="width:100%;background:#fff;font-family:Arial;">';
    s += rect(0, 0, W, Hh, '#fff', '#0f172a', 2);

    /* 1 · ELEVATION with levels */
    s += rect(16, 16, 700, 720, '#fff', '#0f172a', 1.2) + txt(24, 34, '1 · GENERAL ARRANGEMENT — ELEVATION', 10.5, '#0f172a', 'start', '800');
    var tx = 250, ty = 110, tw2 = 260, th = 470;                  // tank box on paper
    var scale = th / r.H;                                          // mm → px
    s += txt(tx + tw2 / 2, 92, 'ELEVATION', 9.5, '#0f172a', 'middle', '700');
    // roof
    if (/Cone/.test(r.roof)) s += '<polygon points="' + tx + ',' + ty + ' ' + (tx + tw2 / 2) + ',' + (ty - 46) + ' ' + (tx + tw2) + ',' + ty + '" fill="#f1f5f9" stroke="#0f172a" stroke-width="1.3"/>';
    else if (/Dome/.test(r.roof)) s += '<path d="M ' + tx + ' ' + ty + ' A ' + (tw2 / 2) + ' 52 0 0 1 ' + (tx + tw2) + ' ' + ty + '" fill="#f1f5f9" stroke="#0f172a" stroke-width="1.3"/>';
    else s += rect(tx, ty - 10, tw2, 10, '#f1f5f9', '#0f172a', 1.3);
    // shell + bottom + foundation
    s += rect(tx, ty, tw2, th, '#f8fafc', '#0f172a', 1.5);
    s += rect(tx - 14, ty + th, tw2 + 28, 14, '#e2e8f0', '#0f172a', 1.2);
    s += rect(tx - 26, ty + th + 14, tw2 + 52, 12, '#cbd5e1', '#0f172a', 1);
    // liquid to HLL
    var yOf = function (mm) { return ty + th - mm * scale; };
    s += rect(tx + 2, yOf(r.elHLL), tw2 - 4, (r.elHLL) * scale, 'rgba(37,99,235,0.16)', 'none');
    // level lines
    // Level callouts. Tall tanks push TTL/HHLL/HLL within a few pixels of each
    // other, so labels are de-collided vertically and joined to the true level
    // by a short leader — the dashed line still marks the exact elevation.
    var lvls = [['TTL', r.elTTL, '#0f172a'], ['HHLL (trip)', r.elHHLL, '#dc2626'], ['HLL (alarm)', r.elHLL, '#ea580c'],
      ['LLL (alarm)', r.elLLL, '#16a34a'], ['LLLL (trip)', r.elLLLL, '#7c3aed'], ['BTL', 0, '#0f172a']];
    var MINGAP = 13, prevY = -1e9;
    lvls.forEach(function (L) {
      var y = yOf(L[1]);
      var ly = y;
      if (ly - prevY < MINGAP) ly = prevY + MINGAP;   // list runs top→bottom
      prevY = ly;
      s += line(tx, y, tx + tw2 + 70, y, 0.8, L[2], '5 3');
      if (Math.abs(ly - y) > 0.5) s += line(tx + tw2 + 70, y, tx + tw2 + 86, ly, 0.6, L[2]);
      s += txt(tx + tw2 + 90, ly + 3, L[0] + '  ' + U(L[1], 'length-mm', 0), 8, L[2], 'start', '700');
    });
    // ladder — two rails + rungs against the shell's left edge, in the strip
    // left clear by the dashed level lines (which now start at the shell
    // itself rather than overhanging past it). A safety cage above ~6 m
    // (same field-practice threshold as the 3D model) is shown as a dashed
    // bracket around the caged portion.
    var railXo = tx - 18, railXi = tx - 6;
    s += line(railXo, ty, railXo, ty + th, 1, '#f59e0b') + line(railXi, ty, railXi, ty + th, 1, '#f59e0b');
    for (var lry = ty + 6; lry < ty + th; lry += 14) s += line(railXo, lry, railXi, lry, 0.8, '#f59e0b');
    var CAGE_MM = 6000;
    if (r.H > CAGE_MM) {
      var cageTopY = ty, cageBotY = yOf(2200);
      s += line(railXo - 4, cageTopY, railXo - 4, cageBotY, 0.8, '#dc2626', '4 2') + line(railXi + 4, cageTopY, railXi + 4, cageBotY, 0.8, '#dc2626', '4 2');
      s += txt(railXo - 8, (cageTopY + cageBotY) / 2, 'SAFETY CAGE', 6.5, '#dc2626', 'end', '700');
    }
    s += txt((railXo + railXi) / 2, ty + th + 12, 'LADDER', 6.5, '#92400e', 'middle', '700');
    // overflow nozzle — leader kept clear of the ladder/dimension by sitting
    // further left again
    s += line(tx - 95, yOf(r.elOverflow), tx - 58, yOf(r.elOverflow), 2, '#dc2626');
    s += txt(tx - 99, yOf(r.elOverflow) - 5, 'OVF ' + r.dOvf + '"', 7.5, '#dc2626', 'end', '700');
    // top platform & handrail — a short rail with posts astride the roof apex
    var phY = ty - (/Cone/.test(r.roof) ? 46 : /Dome/.test(r.roof) ? 40 : 8) - 10;
    s += line(tx + tw2 / 2 - 34, phY, tx + tw2 / 2 + 34, phY, 1.3, '#0369a1');
    [-34, -12, 12, 34].forEach(function (px) { s += line(tx + tw2 / 2 + px, phY, tx + tw2 / 2 + px, phY + 8, 1, '#0369a1'); });
    s += txt(tx + tw2 / 2, phY - 5, 'TOP PLATFORM & HANDRAIL', 6.5, '#0369a1', 'middle', '700');
    // dims
    s += dim(tx - 46, ty, tx - 46, ty + th, U(r.H, 'length-mm', 0));
    s += dim(tx, ty + th + 46, tx + tw2, ty + th + 46, 'Ø ' + U(r.D, 'length-mm', 0) + ' ID');
    s += txt(tx + tw2 / 2, ty + th + 74, r.roof + ' · ' + esc(r.matName) + ' · shell t ' + U(r.t, 'length-mm', 1), 8.5, '#64748b', 'middle');

    /* 2 · PLAN */
    s += rect(16, 748, 700, 240, '#fff', '#0f172a', 1.2) + txt(24, 766, '2 · PLAN VIEW', 10.5, '#0f172a', 'start', '800');
    var cx0 = 360, cy0 = 872, pr = 88;
    s += '<circle cx="' + cx0 + '" cy="' + cy0 + '" r="' + pr + '" fill="#f8fafc" stroke="#0f172a" stroke-width="1.5"/>';
    s += '<circle cx="' + cx0 + '" cy="' + cy0 + '" r="' + (pr - 6) + '" fill="none" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="3 3"/>';
    [['INLET', -90], ['OUTLET', 20], ['OVERFLOW', 90], ['MANHOLE', 170], ['DRAIN', 250]].forEach(function (N) {
      var a = N[1] * Math.PI / 180, x = cx0 + Math.cos(a) * pr, y = cy0 + Math.sin(a) * pr;
      s += '<circle cx="' + x + '" cy="' + y + '" r="6" fill="#fff" stroke="#dc2626" stroke-width="1.4"/>';
      s += txt(cx0 + Math.cos(a) * (pr + 26), cy0 + Math.sin(a) * (pr + 26) + 3, N[0], 7.5, '#0f172a', 'middle', '700');
    });
    // anchor bolts on the foundation ring — spacing ≈1.2 m, rounded to a
    // multiple of 4 so the pattern is symmetric; size steps with diameter.
    // Note sits clear to the right of the nozzle call-outs, not below the
    // circle, so it never crowds the Ø dimension under the plan.
    var nBolts = Math.max(8, Math.round((Math.PI * r.Dm) / 1.2 / 4) * 4);
    var boltSz = r.Dm < 10 ? 'M20' : r.Dm < 20 ? 'M24' : 'M30';
    var pbR = pr + 13;
    for (var bi = 0; bi < nBolts; bi++) {
      var ba = (bi / nBolts) * Math.PI * 2;
      s += '<circle cx="' + (cx0 + Math.cos(ba) * pbR) + '" cy="' + (cy0 + Math.sin(ba) * pbR) + '" r="1.6" fill="#0f172a"/>';
    }
    s += txt(510, 800, 'ANCHOR BOLTS', 7.5, '#475569', 'start', '700');
    s += txt(510, 812, nBolts + ' × ' + boltSz, 7.5, '#475569', 'start');
    s += txt(510, 824, '(TYP., per foundation /', 6.8, '#475569', 'start');
    s += txt(510, 834, 'wind-uplift design)', 6.8, '#475569', 'start');
    s += dim(cx0 - pr, cy0 + pr + 34, cx0 + pr, cy0 + pr + 34, 'Ø ' + U(r.D, 'length-mm', 0));

    /* 3 · DESIGN DATA */
    var dx = 736, dy = 30;
    s += txt(dx + 190, dy, 'DESIGN DATA', 11, '#0f172a', 'middle', '800');
    s += table(dx, dy + 10, [190, 190], [
      ['TAG No.', val('tk-tag', 'TK-101')],
      ['Service fluid', r.fluid],
      ['Location', val('tk-loc', '—')],
      ['Orientation / roof', r.orient + ' / ' + r.roof],
      ['Material', r.matName],
      ['Density ρ', U(r.rho, 'density', 0) + '  (G ' + r.G.toFixed(2) + ')'],
      ['Design temperature', U(r.tdes, 'temperature', 0)],
      ['Design pressure', U(r.pdes, 'pressure', 2)],
      ['Corrosion allowance', U(r.CA, 'length-mm', 1)],
      ['Tank ID × height', U(r.D, 'length-mm', 0) + ' × ' + U(r.H, 'length-mm', 0)],
      ['L/D ratio', r.LD.toFixed(2) + '  (' + r.svc + ')'],
      ['Geometric capacity', U(r.geoCap, 'volume', 2)],
      ['Working capacity', U(r.workCap, 'volume', 2)],
      ['Required capacity', U(r.reqCap, 'volume', 2)],
      ['Capacity check', r.capOk ? 'PASS' : 'FAIL'],
      ['Shell thickness (API 650)', U(r.t, 'length-mm', 1) + '  (req ' + U(r.tReq, 'length-mm', 2) + ')'],
      ['Bottom plate', U(r.tb, 'length-mm', 1)],
      ['Empty weight', U(r.wEmpty, 'mass', 0)],
      ['Operating weight', U(r.wOper, 'mass', 0)],
      ['Hydrotest weight', U(r.wTest, 'mass', 0)]
    ], false);

    /* 4 · LEVEL SCHEDULE */
    var lx = 736, ly = 380;
    s += txt(lx + 190, ly, 'LEVEL SCHEDULE', 11, '#0f172a', 'middle', '800');
    s += table(lx, ly + 10, [120, 120, 140], [
      ['LEVEL', 'ELEV. (' + SYM('length-mm') + ')', 'BASIS'],
      ['TTL', U(r.elTTL, 'length-mm', 0), 'Top tangent line'],
      ['Overflow', U(r.elOverflow, 'length-mm', 0), U(300, 'length-mm', 0) + ' below TTL'],
      ['HHLL (trip)', U(r.elHHLL, 'length-mm', 0), '1.5 × ' + r.dOvf + '" ovf = ' + U(r.hCurbApi, 'length-mm', 0)],
      ['HLL (alarm)', U(r.elHLL, 'length-mm', 0), 'residence ' + U(r.hHLL, 'length-mm', 0)],
      ['LLL (alarm)', U(r.elLLL, 'length-mm', 0), 'residence ' + U(r.hLLL, 'length-mm', 0)],
      ['LLLL (trip)', U(r.elLLLL, 'length-mm', 0), 'nozzle CL + r + ' + U(150, 'length-mm', 0)],
      ['BTL', U(0, 'length-mm', 0), 'Bottom tangent line']
    ], true);

    /* 5 · BOM */
    var bx = 736, by = 542;
    s += txt(bx + 380, by, 'BILL OF MATERIAL (BOM)', 11, '#0f172a', 'middle', '800');
    var bom = bomRows(r);
    s += table(bx, by + 10, [26, 190, 150, 34, 150, 210], [['NO', 'DESCRIPTION', 'MATERIAL', 'QTY', 'STANDARD / SIZE', 'REMARKS']]
      .concat(bom.map(function (b, i) { return [String(i + 1), b[0], b[1], String(b[2]), b[3], b[5]]; })), true);

    /* 6 · NOZZLE SCHEDULE — a dedicated schedule (tag/service/size/rating/
       elevation), distinct from the BOM's quantity-and-weight take-off */
    var nx = 736, ny = 850;
    s += txt(nx + 290, ny, 'NOZZLE SCHEDULE', 11, '#0f172a', 'middle', '800');
    var nozCLmm = num('tk-noz-cl', 200);
    var nozSched = [
      ['N1', 'INLET', r.dOut + '"', 'ASME B16.5', U(r.H * 0.92, 'length-mm', 0) + '  (near top)'],
      ['N2', 'OUTLET', r.dOut + '"', 'ASME B16.5', 'CL ' + U(nozCLmm, 'length-mm', 0) + ' from bottom'],
      ['N3', 'OVERFLOW', r.dOvf + '"', 'ASME B16.5', U(r.elOverflow, 'length-mm', 0)],
      ['N4', 'DRAIN', '2"', 'ASME B16.5', 'Bottom, sloped to low point'],
      ['N5', 'VENT / BREATHER', '—', 'API 2000', 'Roof, high point'],
      ['M1', 'MANHOLE (SHELL)', '24"', 'API 650', U(600, 'length-mm', 0) + ' from bottom'],
      ['M2', 'MANHOLE (ROOF)', '20"', 'API 650', 'Roof centre'],
      ['LG1–4', 'LEVEL GAUGE CONN.', '2"', 'API 650', 'At LLLL / LLL / HLL / HHLL']
    ];
    s += table(nx, ny + 10, [40, 160, 60, 100, 220], [['TAG', 'SERVICE', 'SIZE', 'RATING / STD', 'ELEVATION / LOCATION']].concat(nozSched), true);

    /* Title block */
    var tbx = 736, tby = Hh - 176, tbw = 780;
    s += rect(tbx, tby, tbw, 132, '#fff', '#0f172a', 1.4);
    s += txt(tbx + tbw / 2, tby + 24, 'VERTICAL STORAGE TANK', 12, '#0f172a', 'middle', '800');
    s += txt(tbx + tbw / 2, tby + 40, 'GENERAL ARRANGEMENT DRAWING — API 650', 11, '#0f172a', 'middle', '700');
    s += line(tbx, tby + 52, tbx + tbw, tby + 52, 0.8);
    [['DRAWN BY', val('tk-engineer', '—') || '—', 'DATE', new Date().toISOString().slice(0, 10)],
     ['CLIENT', val('tk-client', '—') || '—', 'PROJECT', val('tk-project', '—') || '—'],
     ['SCALE', 'NTS', 'DRG. No.', (val('tk-tag', 'TK') || 'TK') + '-GA-001']].forEach(function (row, ri) {
      var yy = tby + 52 + ri * 22;
      s += line(tbx, yy + 22, tbx + tbw, yy + 22, 0.6);
      s += line(tbx + 110, yy, tbx + 110, yy + 22, 0.6) + line(tbx + 420, yy, tbx + 420, yy + 22, 0.6) + line(tbx + 540, yy, tbx + 540, yy + 22, 0.6);
      s += txt(tbx + 6, yy + 15, row[0], 7.5, '#64748b', 'start', '700') + txt(tbx + 116, yy + 15, row[1], 8.5, '#0f172a');
      s += txt(tbx + 426, yy + 15, row[2], 7.5, '#64748b', 'start', '700') + txt(tbx + 546, yy + 15, row[3], 8.5, '#0f172a');
    });

    /* Notes */
    s += txt(24, 1012, 'NOTES :', 10, '#0f172a', 'start', '800');
    ['1. Design and construction to API 650. All dimensions in ' + SYM('length-mm') + ' unless noted.',
     '2. Shell thickness by 1-Foot Method: t = 4.9·D·(H−0.3)·G/(S·E) + CA = ' + U(r.tCalc, 'length-mm', 2) + '; API 650 minimum ' + U(r.tMinApi, 'length-mm', 2) + '.',
     '3. Bottom plate ≥ ' + U(6, 'length-mm', 0) + ' + corrosion allowance. Annular plate sized on shell loading.',
     '4. Freeboard above HLL = ' + U(r.freeboard, 'length-mm', 0) + ' (min ' + U(300, 'length-mm', 0) + '; agitated ' + U(750, 'length-mm', 0) + ').',
     '5. Hydrotest with water: ' + U(r.wTest, 'mass', 0) + ' total. Foundation to be designed for this load.'
    ].forEach(function (n, i) { s += txt(24, 1032 + i * 16, n, 8.5, '#334155', 'start'); });

    /* 7 · LADDER, PLATFORM & ANCHOR BOLTS — the remaining standard GA items
       (access + hold-down) gathered in one place since they're call-outs
       rather than dimensioned geometry */
    var apy = 1120;
    s += txt(24, apy, '7 · LADDER, PLATFORM & ANCHOR BOLTS', 10, '#0f172a', 'start', '800');
    [
      'Ladder: fixed rung ladder on the shell' + (r.H > 6000 ? ', with safety cage above 2.2 m (required over ~6 m per field practice).' : ' (no cage required — shell height under ~6 m).'),
      'Top platform & handrail: perimeter platform at the roof with a standard handrail, shown at the roof apex in the elevation.',
      'Manways: 24" shell manway near grade, 20" roof manway — see the nozzle schedule (M1/M2) for size and standard.',
      'Anchor bolts: ' + nBolts + ' × ' + boltSz + ' typical, evenly spaced on the foundation ring — confirm against the wind/seismic uplift check.'
    ].forEach(function (n, i) { s += txt(24, apy + 20 + i * 16, n, 8.5, '#334155', 'start'); });

    s += '</svg>';

    var bomHtml = '<div style="margin-top:14px;"><div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin-bottom:6px;">BILL OF MATERIAL — LIST OF MATERIALS</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Arial;"><tr style="background:#f1f5f9;">'
      + ['#', 'Item / Component', 'Material', 'Qty', 'Unit Wt (' + SYM('mass') + ')', 'Standard / Size', 'Remarks'].map(function (x) { return '<th style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;">' + x + '</th>'; }).join('') + '</tr>';
    bom.forEach(function (b, i) {
      bomHtml += '<tr>' + [i + 1, b[0], b[1], b[2], b[4], b[3], b[5]].map(function (x) { return '<td style="padding:4px 6px;border:1px solid #e2e8f0;">' + x + '</td>'; }).join('') + '</tr>';
    });
    bomHtml += '</table><div style="font-size:10px;color:#64748b;margin-top:6px;">Weights computed from the selected material density (' + esc(r.matName) + ', ρ ' + U(r.mat.rho, 'density', 0) + '). Total erection weight ≈ ' + U(r.wEmpty, 'mass', 0) + '. Confirm against fabricator drawings.</div></div>';

    modal('TANK — GA DRAWING + BOM', s + bomHtml, true, true);
  }

  /* ─────────── report ─────────── */
  function report() {
    var r = LAST || compute();
    var f1 = function (x) { return isFinite(x) ? x.toFixed(1) : '—'; };
    var f2 = function (x) { return isFinite(x) ? x.toFixed(2) : '—'; };
    var f0 = function (x) { return isFinite(x) ? Math.round(x).toLocaleString() : '—'; };
    var sec = function (t) { return '<div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin:16px 0 8px;">' + t + '</div>'; };
    var T = function (rows) {
      return '<table style="width:100%;border-collapse:collapse;font-size:11.5px;">'
        + rows.map(function (x) {
          return '<tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#475569;width:52%;">' + x[0] + '</td>'
            + '<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;">' + x[1] + '</td></tr>';
        }).join('') + '</table>';
    };
    var b = '<div style="font-family:Arial;color:#0f172a;">';
    b += '<div style="text-align:center;margin-bottom:14px;"><div style="font-size:18px;font-weight:800;color:#ea580c;">AROGARA FLOWSIZE — STORAGE TANK DESIGN REPORT</div><div style="font-size:10px;color:#64748b;">AROGARA TECHNOLOGIES | API 650 DESIGN BASIS</div></div>';
    b += sec('1 · DESIGN DATA SHEET');
    b += T([['Tag No.', esc(val('tk-tag', '—'))], ['Location', esc(val('tk-loc', '—'))], ['Project / Client', esc(val('tk-project', '—')) + ' / ' + esc(val('tk-client', '—'))],
      ['Engineer / Rev', esc(val('tk-engineer', '—')) + ' / ' + esc(val('tk-rev', '0'))], ['Date', new Date().toISOString().slice(0, 10)]]);
    b += sec('2 · SERVICE & MATERIAL');
    b += T([['Service fluid', esc(r.fluid)], ['Density / SG', U(r.rho, 'density', 0) + '  /  ' + f2(r.G)],
      ['Design temperature', U(r.tdes, 'temperature', 1)], ['Design pressure', U(r.pdes, 'pressure', 2)],
      ['Material', esc(r.matName) + '  (ρ ' + U(r.mat.rho, 'density', 0) + ', S ' + U(r.mat.S, 'stress', 0) + ')'],
      ['Corrosion allowance', U(r.CA, 'length-mm', 1)], ['Orientation / roof', r.orient + ' / ' + r.roof],
      ['Recommended roof for service', r.roofSuggest]]);
    b += sec('3 · GEOMETRY & CAPACITY');
    b += T([['Tank ID × shell height', U(r.D, 'length-mm', 0) + ' × ' + U(r.H, 'length-mm', 0)],
      ['L/D ratio', f2(r.LD) + '  (' + r.svc + ' band ' + r.band[0] + '–' + r.band[1] + ')'],
      ['Total geometric capacity  π/4·D²·H', U(r.geoCap, 'volume', 2)],
      ['Total working height', U(r.workH, 'length-mm', 1)],
      ['Total working capacity', U(r.workCap, 'volume', 2)],
      ['Required working capacity', U(r.reqCap, 'volume', 2)],
      ['Capacity check', r.capOk ? 'PASS — capacity adequate' : 'FAIL — increase tank size']]);
    b += sec('4 · LIQUID LEVELS');
    b += T([['LLLL — nozzle CL + radius + liquid', U(r.lllCalc, 'length-mm', 1) + '  → adopted ' + U(r.hLLLL, 'length-mm', 1)],
      ['LLLL → LLL (residence ' + f1(num('tk-res-out', 3)) + ' min)', U(r.hResOut, 'length-mm', 1) + '  → adopted ' + U(r.hLLL, 'length-mm', 1)],
      ['HHLL below curb (1.5 × ' + r.dOvf + '")', U(r.hCurbApi, 'length-mm', 1) + '  → adopted ' + U(r.hHHLLcurb, 'length-mm', 1)],
      ['HHLL → HLL (residence ' + f1(num('tk-res-in', 3)) + ' min)', U(r.hResIn, 'length-mm', 1) + '  → adopted ' + U(r.hHLL, 'length-mm', 1)],
      ['Elevations (BTL/LLLL/LLL/HLL/HHLL/TTL)', U(0, 'length-mm', 1) + ' / ' + U(r.elLLLL, 'length-mm', 1) + ' / ' + U(r.elLLL, 'length-mm', 1) + ' / ' + U(r.elHLL, 'length-mm', 1) + ' / ' + U(r.elHHLL, 'length-mm', 1) + ' / ' + U(r.elTTL, 'length-mm', 1)],
      ['Overflow nozzle elevation', U(r.elOverflow, 'length-mm', 1) + ' (' + U(300, 'length-mm', 0) + ' below TTL)'],
      ['Freeboard above HLL', U(r.freeboard, 'length-mm', 1) + '  (' + (r.fbOk ? 'PASS' : 'FAIL') + ', min ' + U(300, 'length-mm', 0) + ')']]);
    b += sec('5 · SHELL DESIGN — API 650 (1-FOOT METHOD)');
    b += T([['Formula', 't = 4.9·D·(H−0.3)·G / (S·E) + CA  (D, H in metres; S in MPa — API 650 basis)'],
      ['Substitution', '4.9 × ' + f2(r.Dm) + ' × ' + f2(Math.max(0, r.Hm - 0.3)) + ' × ' + f2(r.G) + ' / (' + r.mat.S + ' × ' + r.E + ') + ' + f1(r.CA) + ' mm'],
      ['Calculated thickness', U(r.tCalc, 'length-mm', 2)], ['API 650 minimum', U(r.tMinApi, 'length-mm', 2)],
      ['Required thickness', U(r.tReq, 'length-mm', 2)], ['Selected thickness', U(r.t, 'length-mm', 1) + '  (' + (r.tOk ? 'PASS' : 'FAIL') + ')'],
      ['Bottom plate', U(r.tb, 'length-mm', 1) + '  (≥' + U(6, 'length-mm', 0) + ' + CA)'], ['Roof plate', U(r.tRoof, 'length-mm', 1)]]);
    b += sec('6 · WEIGHT TAKE-OFF');
    b += T([['Shell plate', U(r.wShell, 'mass', 0)], ['Bottom plate', U(r.wBottom, 'mass', 0)], ['Roof plate', U(r.wRoof, 'mass', 0)],
      ['Appurtenances (12 %)', U(r.wAppurt, 'mass', 0)], ['Empty (erection) weight', U(r.wEmpty, 'mass', 0)],
      ['Liquid at working level', U(r.wLiquid, 'mass', 0)], ['Operating weight', U(r.wOper, 'mass', 0)],
      ['Hydrotest weight (water full)', U(r.wTest, 'mass', 0)]]);
    b += sec('7 · DESIGN CHECKS');
    b += T([['Capacity ≥ required', r.capOk ? 'PASS' : 'FAIL'], ['L/D within service band', r.ldOk ? 'PASS' : 'REVIEW'],
      ['Shell thickness ≥ required', r.tOk ? 'PASS' : 'FAIL'], ['Freeboard ≥ ' + U(300, 'length-mm', 0), r.fbOk ? 'PASS' : 'FAIL'],
      ['Diameter ≤ ' + U(60, 'length-m', 0), r.dOk ? 'PASS' : 'REVIEW'], ['Shell height ≤ ' + U(25, 'length-m', 0), r.hOk ? 'PASS' : 'REVIEW']]);
    b += sec('8 · BILL OF MATERIAL');
    b += '<table style="width:100%;border-collapse:collapse;font-size:10.5px;"><tr style="background:#f1f5f9;">'
      + ['#', 'Item', 'Material', 'Qty', 'Unit Wt (' + SYM('mass') + ')', 'Standard / Size'].map(function (x) { return '<th style="padding:4px;border:1px solid #e2e8f0;text-align:left;">' + x + '</th>'; }).join('') + '</tr>';
    bomRows(r).forEach(function (x, i) {
      b += '<tr>' + [i + 1, x[0], x[1], x[2], x[4], x[3]].map(function (y) { return '<td style="padding:4px;border:1px solid #e2e8f0;">' + y + '</td>'; }).join('') + '</tr>';
    });
    b += '</table>';
    b += sec('9 · DESIGN ASSISTANT — INDUSTRY THUMB-RULE CHECK (advisory)');
    b += T(designAssistant(r).map(function (c) { return [c.label, c.value + '  — ' + c.note + '  (' + (c.ok ? 'PASS' : 'REVIEW') + ')']; }));
    b += sec('10 · MATERIAL GUIDANCE');
    b += '<div style="font-size:10.5px;color:#475569;line-height:1.6;">' + esc($('tk-mathint') ? $('tk-mathint').textContent : '') + '</div>';
    b += sec('11 · BASIS & REFERENCES');
    b += '<div style="font-size:10px;color:#475569;line-height:1.6;">Capacity π/4·D²·H. Levels per the project design workbook: LLLL = MAX(nozzle CL + nozzle radius + liquid above nozzle, specific requirement); LLLL→LLL = MAX(residence-time height, API 650 minimum); HHLL = MAX(1.5 × overflow nozzle, project minimum) below top curb angle; HHLL→HLL = MAX(residence-time height, API 650 minimum). Shell thickness by API 650 1-Foot Method. Codes: API 650 (welded steel tanks for oil storage), API 620 (low-pressure), API 653 (inspection/repair), API 2000 (venting). Weights from the selected material density. The Design Assistant section is an advisory cross-check against field-practice thumb rules, separate from the governing API 650 calculation above. This is a design-screening report — confirm against detailed fabrication drawings and foundation design before construction.</div>';
    b += '</div>';
    modal('TANK — ENGINEERING DESIGN REPORT', b, true);
  }

  /* ─────────── modal (reuses the shared AROPDF exporter) ─────────── */
  function modal(title, inner, pdf, landscape) {
    var old = $('tk-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'tk-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(2,6,18,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;max-width:1000px;width:100%;max-height:92vh;display:flex;flex-direction:column;">'
      + '<div style="display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #334155;">'
      + '<span style="font-family:monospace;font-size:13px;font-weight:800;color:#ff7538;flex:1;">' + title + '</span>'
      + (pdf ? '<button id="tk-pdf" style="margin-right:8px;background:#16a34a;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">⬇ PDF</button>' : '')
      + '<button id="tk-mclose" style="background:#ef4444;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">✕ CLOSE</button></div>'
      + '<div id="tk-mbody" style="overflow:auto;padding:18px;background:#fff;border-radius:0 0 10px 10px;">' + inner + '</div></div>';
    document.body.appendChild(m);
    $('tk-mclose').onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    var pb = $('tk-pdf');
    if (pb) pb.onclick = function () {
      var fn = title.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') + '.pdf';
      pb.textContent = '⏳ GENERATING…'; pb.disabled = true;
      var done = function () { pb.textContent = '⬇ PDF'; pb.disabled = false; };
      if (!window.AROPDF) { try { window.print(); } catch (e) {} done(); return; }
      var p = window.AROPDF($('tk-mbody'), fn, { landscape: !!landscape });
      if (p && p.then) p.then(done, done); else setTimeout(done, 1600);
    };
  }

  /* ─────────── boot ─────────── */
  function build() {
    if (built) return;
    var host = $('tank-tab'); if (!host) return;
    host.innerHTML = panelHTML();
    built = true;
    wire();
    init3D();
    setTimeout(function () { resize3D(); calc(); }, 60);
    // recalc/resize when the tab becomes visible
    var nav = document.querySelector('[data-tab="tank-tab"]');
    if (nav) nav.addEventListener('click', function () { setTimeout(function () { resize3D(); calc(); }, 80); });
  }

  function boot() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  else setTimeout(boot, 500);
  var tries = 0;
  var iv = setInterval(function () { if (built || tries++ > 20) { clearInterval(iv); return; } build(); }, 500);

  window.AROTANK = { calc: calc, compute: compute, report: report, drawing: drawing, MATERIALS: MATERIALS };
})();

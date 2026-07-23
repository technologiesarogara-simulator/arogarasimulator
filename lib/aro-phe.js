/* ══════════════════════════════════════════════════════════════════════
   ARO — PLATE HEAT EXCHANGER (PHE) DESIGN MODULE
   Third heat-exchanger sub-tab alongside DPHE and STHE. Follows the same
   philosophy: live design datasheet → fluid allocation → process inputs →
   auto thermal / hydraulic / mechanical calculations → live auto-updating
   3D plate-pack (Three.js) → manufacturing drawing → engineering report.

   Engineering basis (per user spec): AHRI, API 662, ASME Sec VIII Div 1,
   EN 13445, TEMA (where applicable) and standard chevron-plate correlations
   used by major PHE makers (Alfa Laval / GEA / Kelvion / SWEP). Chevron
   Nusselt/friction after Martin / Wanniarachchi / Muley-Manglik; ε-NTU per
   counter-current plate arrangement.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─────────── engineering property libraries ───────────
  // plate metals — k (W/m·K), surface roughness ε (µm), corrosion rate (mm/yr in
  // typical service), ASME allowable stress S (MPa), density (kg/m³)
  var MATERIALS = {
    'SS304':            { k: 16.2, rough: 0.5, corr: 0.05, S: 138, rho: 7900 },
    'SS304L':           { k: 16.2, rough: 0.5, corr: 0.04, S: 115, rho: 7900 },
    'SS316':            { k: 16.3, rough: 0.5, corr: 0.03, S: 138, rho: 8000 },
    'SS316L':           { k: 16.3, rough: 0.4, corr: 0.02, S: 115, rho: 8000 },
    'SS317L':           { k: 14.4, rough: 0.4, corr: 0.02, S: 120, rho: 8000 },
    'Titanium Gr2':     { k: 21.9, rough: 0.3, corr: 0.00, S: 90,  rho: 4510 },
    'Ti-Pd Gr7':        { k: 20.0, rough: 0.3, corr: 0.00, S: 90,  rho: 4510 },
    'SMO 254':          { k: 13.5, rough: 0.4, corr: 0.00, S: 170, rho: 8000 },
    'Hastelloy C276':   { k: 10.1, rough: 0.4, corr: 0.00, S: 180, rho: 8890 },
    'Hastelloy C22':    { k: 10.1, rough: 0.4, corr: 0.00, S: 190, rho: 8690 },
    'Nickel 200':       { k: 70.2, rough: 0.5, corr: 0.02, S: 90,  rho: 8890 },
    'Monel 400':        { k: 21.8, rough: 0.5, corr: 0.02, S: 120, rho: 8800 },
    'Inconel 625':      { k: 9.8,  rough: 0.4, corr: 0.00, S: 240, rho: 8440 },
    'Duplex 2205':      { k: 19.0, rough: 0.4, corr: 0.01, S: 240, rho: 7800 },
    'Super Duplex 2507':{ k: 17.0, rough: 0.4, corr: 0.00, S: 280, rho: 7800 },
    'Cupronickel 90/10':{ k: 50.0, rough: 0.5, corr: 0.05, S: 70,  rho: 8900 },
    'Aluminium 3003':   { k: 160,  rough: 0.5, corr: 0.05, S: 40,  rho: 2730 }
  };
  function matK(name) { return (MATERIALS[name] || MATERIALS['SS316']).k; }
  // Fluid library — representative properties at a typical service temperature
  // (ρ kg/m³, μ Pa·s, cp J/kg·K, k W/m·K, sg). User can override any value.
  var FLUIDS = {
    'Water (25°C)':          { rho: 997,  mu: 0.00089,  cp: 4180, k: 0.606, sg: 1.00 },
    'Hot Water (80°C)':      { rho: 972,  mu: 0.000355, cp: 4197, k: 0.670, sg: 0.972 },
    'Cooling Water (32°C)':  { rho: 995,  mu: 0.000765, cp: 4180, k: 0.618, sg: 0.995 },
    'Sea Water (25°C)':      { rho: 1025, mu: 0.00096,  cp: 3993, k: 0.596, sg: 1.025 },
    'Steam Condensate':      { rho: 958,  mu: 0.000282, cp: 4216, k: 0.679, sg: 0.958 },
    'Ethylene Glycol 30%':   { rho: 1035, mu: 0.0021,   cp: 3700, k: 0.47,  sg: 1.035 },
    'Ethylene Glycol 50%':   { rho: 1075, mu: 0.0038,   cp: 3300, k: 0.38,  sg: 1.075 },
    'Propylene Glycol 30%':  { rho: 1020, mu: 0.0030,   cp: 3900, k: 0.44,  sg: 1.020 },
    'Brine CaCl₂ 20%':       { rho: 1180, mu: 0.0025,   cp: 3060, k: 0.55,  sg: 1.18 },
    'Thermal Oil (150°C)':   { rho: 830,  mu: 0.0009,   cp: 2200, k: 0.12,  sg: 0.83 },
    'Crude Oil':             { rho: 850,  mu: 0.010,    cp: 2000, k: 0.13,  sg: 0.85 },
    'Diesel':                { rho: 840,  mu: 0.0035,   cp: 2050, k: 0.135, sg: 0.84 },
    'Kerosene':              { rho: 800,  mu: 0.0016,   cp: 2010, k: 0.132, sg: 0.80 },
    'Gasoline':              { rho: 730,  mu: 0.0006,   cp: 2200, k: 0.12,  sg: 0.73 },
    'Methanol':              { rho: 792,  mu: 0.00059,  cp: 2510, k: 0.20,  sg: 0.792 },
    'Ethanol':               { rho: 789,  mu: 0.0012,   cp: 2440, k: 0.171, sg: 0.789 },
    'Glycerin':              { rho: 1260, mu: 1.0,      cp: 2430, k: 0.285, sg: 1.26 },
    'Ammonia (liq)':         { rho: 610,  mu: 0.00013,  cp: 4700, k: 0.50,  sg: 0.61 },
    'Milk':                  { rho: 1030, mu: 0.0021,   cp: 3930, k: 0.56,  sg: 1.03 },
    'Vegetable Oil':         { rho: 915,  mu: 0.05,     cp: 1900, k: 0.17,  sg: 0.915 },
    'Custom (manual)':       null
  };
  // gasket max continuous temperature (°C) — for a quick suitability note
  var GASKET_TMAX = { 'NBR': 110, 'EPDM': 160, 'Viton': 180, 'HNBR': 140, 'Silicone': 200, 'PTFE': 260 };
  // chevron-angle effect on heat transfer / friction (calibrated so water-water
  // film coefficients land in the industrial 6–9 kW/m²K band and U ≈ 3–4 kW/m²K,
  // consistent with Alfa Laval / GEA / Kelvion gasketed-plate rating data)
  var CHEVRON = { 30: { c: 0.065, n: 0.66, f: 0.8 }, 45: { c: 0.090, n: 0.66, f: 1.0 },
    60: { c: 0.110, n: 0.66, f: 1.35 }, 65: { c: 0.120, n: 0.67, f: 1.5 } };
  // chevron heat-transfer / friction constants for ANY angle 20–75° — exact at
  // the four tabulated standards, linearly interpolated (and clamped) between them.
  function chevronConst(beta) {
    if (CHEVRON[beta]) return CHEVRON[beta];
    var pts = [30, 45, 60, 65];
    if (beta <= 30) return CHEVRON[30];
    if (beta >= 65) return CHEVRON[65];
    var lo = 30, hi = 45;
    for (var i = 0; i < pts.length - 1; i++) { if (beta >= pts[i] && beta <= pts[i + 1]) { lo = pts[i]; hi = pts[i + 1]; break; } }
    var t = (beta - lo) / (hi - lo), A = CHEVRON[lo], B = CHEVRON[hi];
    return { c: A.c + (B.c - A.c) * t, n: A.n + (B.n - A.n) * t, f: A.f + (B.f - A.f) * t };
  }
  // default water properties at ~60 °C (auto-fill)
  var WATER = { rho: 983, mu: 0.000467, cp: 4185, k: 0.654 };

  var THREE_OK = typeof THREE !== 'undefined';
  var built = false, three = null;

  function $(id) { return document.getElementById(id); }
  function num(id, d) { var e = $(id); if (!e) return d; var v = parseFloat(e.value); return isFinite(v) ? v : d; }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }

  /* ─────────── UI: inject third sub-tab + panel ─────────── */
  function inject() {
    if (built) return;
    var tab = $('sthe-tab'); if (!tab) return;
    var nav = tab.querySelector('div'); // the sub-tab nav row (first div)
    var dphe = $('dphe-sub'), sthe = $('sthe-sub');
    if (!nav || !dphe || !sthe) return;

    // third tab button
    var btn = document.createElement('button');
    btn.className = 'hex-subtab'; btn.setAttribute('data-subtab', 'phe-sub');
    btn.textContent = 'PLATE HEx DESIGN';
    btn.style.cssText = 'flex:1;padding:10px 16px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:0.08em;cursor:pointer;margin-bottom:-2px;';
    nav.appendChild(btn);

    // panel
    var sub = document.createElement('div');
    sub.id = 'phe-sub'; sub.style.display = 'none';
    sub.innerHTML = panelHTML();
    sthe.parentNode.insertBefore(sub, sthe.nextSibling);

    // unified tab switching across all three (existing inline onclicks only
    // toggle two, so drive all three ourselves)
    var buttons = nav.querySelectorAll('.hex-subtab');
    function show(which) {
      [dphe, sthe, sub].forEach(function (p) { p.style.display = 'none'; });
      var t = $(which); if (t) t.style.display = 'block';
      buttons.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-subtab') === which); });
      if (which === 'phe-sub') { setTimeout(function () { init3D(); calc(); pheResize(); }, 40); setTimeout(pheResize, 250); }
    }
    buttons.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-subtab')); }); });

    built = true;
    wire();
    fillDefaults();
  }

  /* ─────────── panel markup ─────────── */
  function fld(label, id, unit, v, step) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '" type="number" step="' + (step || 'any') + '" value="' + (v === undefined ? '' : v) + '" '
      + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + (unit ? '<span style="font-size:9px;color:#64748b;min-width:36px;">' + unit + '</span>' : '') + '</span></label>';
  }
  // number field with an editable list of industrial-standard values.
  // Suggestions render in a custom DARK dropdown (native datalist popups are
  // OS-styled white and cannot be themed) — see wireCombo().
  function fldStd(label, id, unit, v, step, std) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + ' <span style="color:#38bdf8;font-size:8px;">▾ standard</span>'
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '" autocomplete="off" data-suggest="' + std.join('|') + '" type="number" step="' + (step || 'any') + '" value="' + (v === undefined ? '' : v) + '" '
      + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + (unit ? '<span style="font-size:9px;color:#64748b;min-width:36px;">' + unit + '</span>' : '') + '</span></label>';
  }
  function dateFld(label, id) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<input id="' + id + '" type="date" value="' + new Date().toISOString().slice(0, 10) + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;color-scheme:dark;"/></label>';
  }
  function txt(label, id, v) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<input id="' + id + '" type="text" value="' + (v || '') + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;"/></label>';
  }
  function sel(label, id, opts, cur) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<select id="' + id + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;">'
      + opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>';
  }
  // editable text field with standard choices in a custom DARK dropdown
  // (custom entry allowed) — see wireCombo().
  function selStd(label, id, opts, cur) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + ' <span style="color:#38bdf8;font-size:8px;">▾ standard / custom</span>'
      + '<input id="' + id + '" autocomplete="off" data-suggest="' + opts.join('|') + '" type="text" value="' + (cur || '') + '" '
      + 'style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;"/></label>';
  }
  function hdr(t) { return '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin:14px 0 4px;border-bottom:1px solid var(--border-muted);padding-bottom:3px;">' + t + '</div>'; }
  function twoCol(a, b) { return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div>' + a + '</div><div>' + b + '</div></div>'; }

  function panelHTML() {
    var h = '<div class="sthe-grid">';
    // ---- LEFT: inputs ----
    h += '<div class="panel panel-input" style="max-height:calc(100vh - 120px);overflow-y:auto;overflow-x:hidden;">'
      + '<div class="panel-header" style="display:flex;align-items:center;gap:6px;"><span class="panel-title" style="flex:1;">PLATE HEAT EXCHANGER — DESIGN INPUTS</span>'
      + '<button id="phe-undo" class="phe-hbtn" title="Undo last change"><span style="font-size:13px;">↩</span><span>UNDO</span></button>'
      + '<button id="phe-redo" class="phe-hbtn" title="Redo"><span style="font-size:13px;">↪</span><span>REDO</span></button>'
      + '<button id="phe-reset" class="phe-hbtn phe-hbtn-red" title="Reset to defaults"><span style="font-size:13px;">↺</span><span>RESET</span></button></div>'
      + '<div class="panel-body">'
      + '<div class="digital-badge">Atmanirbhar Bharat Digitalization</div>';

    h += hdr('1 · DESIGN DATA SHEET');
    h += twoCol(txt('PROJECT', 'phe-project', 'Untitled'), txt('CLIENT', 'phe-client', ''));
    h += twoCol(txt('TAG No.', 'phe-tag', 'PHE-101'), txt('SERVICE', 'phe-service', 'Duty Cooler'));
    h += twoCol(txt('ENGINEER', 'phe-engineer', ''), dateFld('DATE', 'phe-date'));
    h += txt('REV', 'phe-rev', '0');

    h += hdr('2 · FLUID ALLOCATION');
    var fl = Object.keys(FLUIDS);
    h += twoCol(sel('HOT FLUID (library)', 'phe-hf-name', fl, 'Hot Water (80°C)'),
                sel('COLD FLUID (library)', 'phe-cf-name', fl, 'Cooling Water (32°C)'));
    h += twoCol(sel('HOT PHASE', 'phe-hf-phase', ['Liquid', 'Gas', 'Condensing', 'Two-Phase'], 'Liquid'),
                sel('COLD PHASE', 'phe-cf-phase', ['Liquid', 'Gas', 'Evaporating', 'Two-Phase'], 'Liquid'));
    h += '<div style="font-family:var(--font-mono);font-size:9px;color:#22c55e;margin:2px 0 4px;">⚡ Fluid properties auto-fill from the library below · flow arrangement is auto-compared (counter vs co-current) and the best is recommended.</div>';

    // SMART INPUT — pick which variable the software calculates from the energy
    // balance; the rest are user inputs (same idea as the STHE module).
    h += hdr('SMART INPUT — choose the calculated variable');
    h += sel('CALCULATE', 'phe-smart', ['— all user inputs —', 'Cold Mass Flow', 'Hot Mass Flow', 'Hot Outlet Temp', 'Cold Outlet Temp'], '— all user inputs —');
    h += '<div style="font-family:var(--font-mono);font-size:9px;color:#f59e0b;margin:2px 0 4px;">⚡ The selected field is auto-calculated from Q = m·Cp·ΔT (energy balance); it locks and highlights green.</div>';

    h += hdr('3 · PROCESS INPUTS');
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 2px;">'
      + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:#ef4444;letter-spacing:0.04em;">HOT SIDE</div>'
      + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:#22c55e;letter-spacing:0.04em;">COLD SIDE</div></div>';
    // process inputs start blank — the user enters them per requirement
    h += twoCol(fld('Mass flow', 'phe-hf-m', 'kg/s', ''), fld('Mass flow', 'phe-cf-m', 'kg/s', ''));
    h += twoCol(fld('Temperature IN', 'phe-hf-tin', '°C', ''), fld('Temperature IN', 'phe-cf-tin', '°C', ''));
    h += twoCol(fld('Temperature OUT', 'phe-hf-tout', '°C', ''), fld('Temperature OUT', 'phe-cf-tout', '°C', ''));
    h += twoCol(fld('Op. Pressure (0=auto)', 'phe-hf-pdes', 'barg', ''), fld('Op. Pressure (0=auto)', 'phe-cf-pdes', 'barg', ''));
    h += twoCol(fld('Specific heat Cp', 'phe-hf-cp', 'J/kg·K', 4198), fld('Specific heat Cp', 'phe-cf-cp', 'J/kg·K', 4180));
    h += twoCol(fld('Thermal cond. k', 'phe-hf-k', 'W/m·K', 0.668, '0.001'), fld('Thermal cond. k', 'phe-cf-k', 'W/m·K', 0.628, '0.001'));
    h += twoCol(fld('Density ρ', 'phe-hf-rho', 'kg/m³', 965), fld('Density ρ', 'phe-cf-rho', 'kg/m³', 992));
    h += twoCol(fld('Viscosity μ', 'phe-hf-mu', 'Pa·s', 0.00032, '0.00001'), fld('Viscosity μ', 'phe-cf-mu', 'Pa·s', 0.00065, '0.00001'));
    h += twoCol(fld('Visc. at wall μw', 'phe-hf-muw', 'Pa·s', 0.00032, '0.00001'), fld('Visc. at wall μw', 'phe-cf-muw', 'Pa·s', 0.00065, '0.00001'));
    h += twoCol(fld('Specific gravity', 'phe-hf-sg', '–', 0.972, '0.001'), fld('Specific gravity', 'phe-cf-sg', '–', 0.995, '0.001'));
    h += twoCol(fld('Fouling Rf', 'phe-hf-rf', 'm²K/W', 0.000018, '0.000001'), fld('Fouling Rf', 'phe-cf-rf', 'm²K/W', 0.000018, '0.000001'));
    h += twoCol(fld('Allow ΔP', 'phe-hf-dpa', 'kPa', 50), fld('Allow ΔP', 'phe-cf-dpa', 'kPa', 50));

    h += hdr('5–7 · PLATE / MATERIAL / GASKET');
    h += sel('PLATE TYPE', 'phe-ptype', ['Chevron (Herringbone)', 'Wide-Gap', 'Double-Wall', 'Free-Flow', 'Semi-Welded', 'Fully-Welded', 'Brazed', 'Gasketed'], 'Chevron (Herringbone)');
    h += twoCol(sel('PLATE MATERIAL', 'phe-pmat', Object.keys(MATERIALS), 'SS316'),
                sel('GASKET', 'phe-gasket', Object.keys(GASKET_TMAX), 'EPDM'));
    h += '<div id="phe-matinfo" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-top:2px;"></div>';

    h += hdr('8 · PLATE GEOMETRY');
    h += twoCol(fldStd('Plate length Lp', 'phe-L', 'mm', 1200, '10', [400, 600, 800, 1000, 1200, 1500, 1800, 2000, 2500]),
                fldStd('Plate width Wp', 'phe-W', 'mm', 500, '10', [100, 150, 200, 300, 400, 500, 650, 800, 1000]));
    h += twoCol(fldStd('Plate thick. t', 'phe-t', 'mm', 0.5, '0.05', [0.4, 0.5, 0.6, 0.7, 0.8, 1.0]),
                fldStd('Corrug. depth b', 'phe-b', 'mm', 2.5, '0.1', [2.0, 2.5, 3.0, 3.5, 4.0]));
    h += twoCol(fldStd('Chevron angle β', 'phe-beta', '°', 60, '1', [30, 45, 50, 55, 60, 65]),
                fldStd('Port dia Dp', 'phe-dp', 'mm', 150, '5', [50, 100, 150, 200, 250, 300, 350, 400]));
    h += '<div style="font-family:var(--font-mono);font-size:8.5px;color:#94a3b8;line-height:1.45;margin:1px 0 3px;">↳ <b>β 30–65° (custom or standard):</b> 30°=lowest ΔP · 45°=balanced · 60°=industrial standard · 65°=highest heat transfer. Values between the standards are interpolated.</div>';
    h += twoCol(fldStd('Enlargement φ', 'phe-phi', '–', 1.18, '0.01', [1.15, 1.17, 1.18, 1.20, 1.22, 1.25]),
                fldStd('Plate pitch p', 'phe-pitch', 'mm', 3.0, '0.1', [2.0, 2.5, 3.0, 3.5, 4.0, 5.0]));
    // industrial-standard suggestions (editable — these are guidance ranges)
    h += '<div id="phe-geosug" style="font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.5;margin-top:3px;background:rgba(56,189,248,0.06);border-left:2px solid #38bdf8;padding:5px 7px;border-radius:3px;">'
      + '📐 <b>Industrial standard (editable):</b> Length 0.4–2.5 m · Width 0.1–1.0 m · Thickness 0.4–1.0 mm · Chevron 30–65° · Enlargement φ 1.15–1.25 · Pitch 2.0–5.0 mm · Port Ø ≈ 0.2–0.35 × width. Values auto-suggest from duty when you press Suggest.'
      + '<button id="phe-suggest-geo" style="display:block;margin-top:5px;background:#0ea5e9;border:none;color:#fff;font-family:var(--font-mono);font-size:9px;font-weight:700;padding:4px 8px;border-radius:3px;cursor:pointer;">⚡ SUGGEST GEOMETRY FROM DUTY</button></div>';
    h += '<div id="phe-suggest-note" style="display:none;font-family:var(--font-mono);font-size:9px;color:#22c55e;line-height:1.5;margin-top:5px;background:rgba(34,197,94,0.07);border-left:2px solid #22c55e;padding:5px 7px;border-radius:3px;"></div>';

    h += hdr('10 · CHANNEL / PASS DESIGN');
    h += selStd('PASS ARRANGEMENT', 'phe-pass', ['1 Pass / 1 Pass', '2 Pass / 2 Pass', '3 Pass / 3 Pass', '4 Pass / 4 Pass', '2 Pass / 1 Pass', '3 Pass / 1 Pass', '4 Pass / 2 Pass'], '1 Pass / 1 Pass');
    h += '<div style="font-family:var(--font-mono);font-size:8.5px;color:#94a3b8;line-height:1.45;margin:1px 0 3px;">↳ <b>Hot pass / Cold pass (custom allowed):</b> single-pass = lowest ΔP &amp; easy cleaning · multi-pass raises velocity, U and ΔP for tight approaches. Type your own e.g. <i>5 Pass / 5 Pass</i>.</div>';
    h += fld('Design margin', 'phe-margin', '%', 10);

    h += '<button id="phe-calc" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ RUN PHE DESIGN</button>';
    h += '<div id="phe-run-status" style="display:none;margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#052e16;background:linear-gradient(135deg,#22c55e,#4ade80);border:1px solid #16a34a;border-radius:5px;padding:8px 10px;box-shadow:0 0 0 0 rgba(34,197,94,0.5);text-align:center;line-height:1.4;"></div>';
    h += '<style>.phe-act{flex:1;background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:8px;border-radius:4px;cursor:pointer;}.phe-act:hover{background:rgba(255,117,56,0.12);}'
      + '.phe-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
      + '.phe-rr span{color:var(--text-muted);}.phe-rr b{color:#e2e8f0;}.phe-rr.warn b{color:#ef4444;}.phe-rr.ok b{color:#22c55e;}'
      + '.phe-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}'
      + '.phe-hbtn{display:inline-flex;flex-direction:column;align-items:center;gap:1px;min-width:42px;padding:4px 8px;background:rgba(59,130,246,0.06);border:1px solid #3b82f6;color:#3b82f6;border-radius:5px;font-size:8px;font-weight:700;letter-spacing:0.05em;cursor:pointer;line-height:1.1;font-family:var(--font-mono);}.phe-hbtn:hover{background:rgba(59,130,246,0.2);}.phe-hbtn:active{transform:scale(0.94);}'
      + '.phe-hbtn-red{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,0.06);}.phe-hbtn-red:hover{background:rgba(239,68,68,0.2);}'
      + '.phe-auto{outline:2px solid #22c55e !important;background:rgba(34,197,94,0.08) !important;}'
      + '.phe-noz{position:absolute;font-family:var(--font-mono);font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;pointer-events:none;white-space:nowrap;}'
      + '.sthe-grid input:-webkit-autofill,.sthe-grid input:-webkit-autofill:hover,.sthe-grid input:-webkit-autofill:focus,.sthe-grid input:-webkit-autofill:active{-webkit-box-shadow:0 0 0 40px #0b1220 inset !important;-webkit-text-fill-color:#e2e8f0 !important;caret-color:#e2e8f0;transition:background-color 9999s ease-in-out 0s;}'
      + '@keyframes pheToast{0%{opacity:0;transform:translateY(8px)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}'
      + '@keyframes pheRunPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.7)}100%{box-shadow:0 0 0 14px rgba(34,197,94,0)}}</style>';
    h += '</div></div>';

    // ---- RIGHT: 3D + results ----
    h += '<div class="panel" style="max-height:calc(100vh - 120px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">TECHNICAL EVALUATIONS DATASHEET — PLATE HEx</span></div>'
      + '<div class="panel-body">'
      + '<div style="font-family:var(--font-mono);font-size:10px;color:#94a3b8;text-align:center;margin-bottom:4px;">3D PLATE-PACK — LIVE VIEW &nbsp;·&nbsp; DRAG TO ROTATE · SCROLL TO ZOOM</div>'
      + '<div id="phe-3dwrap" style="position:relative;width:100%;height:340px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;">'
      + '<canvas id="phe-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>'
      + '<svg id="phe-noz-svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></svg>'
      + '<div id="phe-3dtag" style="position:absolute;left:8px;top:8px;font-family:var(--font-mono);font-size:10px;color:#38bdf8;"></div>'
      + '<div id="phe-noz-hin" class="phe-noz" style="left:8px;top:60px;background:rgba(220,38,38,0.9);color:#fff;transform:translate(-50%,-50%);"></div>'
      + '<div id="phe-noz-hout" class="phe-noz" style="left:8px;top:120px;background:rgba(220,38,38,0.9);color:#fff;transform:translate(-50%,-50%);"></div>'
      + '<div id="phe-noz-cin" class="phe-noz" style="left:80%;top:60px;background:rgba(37,99,235,0.9);color:#fff;transform:translate(-50%,-50%);"></div>'
      + '<div id="phe-noz-cout" class="phe-noz" style="left:80%;top:120px;background:rgba(37,99,235,0.9);color:#fff;transform:translate(-50%,-50%);"></div></div>'
      + '<div id="phe-results" style="margin-top:12px;"></div>'
      // final deliverables live on the OUTPUTS side, under the results
      + '<div style="margin-top:14px;border-top:1px solid var(--border-muted);padding-top:10px;">'
      + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin-bottom:6px;">FINAL DELIVERABLES</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button id="phe-report" class="phe-act">📄 REPORT</button>'
      + '<button id="phe-draw" class="phe-act">📐 DRAWING / MANUFACTURING</button>'
      + '<button id="phe-graph" class="phe-act">📊 GRAPH</button></div></div>'
      + '</div></div>';

    h += '</div>';
    return h;
  }

  /* ─────────── auto-assumption defaults ─────────── */
  function fillDefaults() { /* values already seeded in markup; hook for future presets */ }

  // blank a side's physical property fields (used when the user picks Custom/manual)
  function blankProps(side) {
    ['rho', 'mu', 'muw', 'cp', 'k', 'sg'].forEach(function (p) { var e = $('phe-' + side + '-' + p); if (e) e.value = ''; });
  }
  // auto-fill a side's physical properties from the fluid library
  function applyFluid(side) {
    var f = FLUIDS[val('phe-' + side + '-name', '')];
    if (!f) return;                                  // "Custom (manual)" — leave user values
    var set = function (id, v) { var e = $(id); if (e) e.value = v; };
    set('phe-' + side + '-rho', f.rho); set('phe-' + side + '-mu', f.mu);
    set('phe-' + side + '-cp', f.cp); set('phe-' + side + '-k', f.k); set('phe-' + side + '-sg', f.sg);
    set('phe-' + side + '-muw', f.mu);   // wall viscosity defaults to bulk μ
  }
  function updateMatInfo() {
    var el = $('phe-matinfo'); if (!el) return;
    var m = MATERIALS[val('phe-pmat', 'SS316')] || MATERIALS['SS316'];
    el.innerHTML = 'k ' + m.k + ' W/m·K · roughness ' + m.rough + ' µm · corrosion ' + m.corr.toFixed(2) + ' mm/yr · allow. stress ' + m.S + ' MPa · ρ ' + m.rho + ' kg/m³';
  }

  // "✓ UPDATED SUCCESSFULLY" banner (+ optional chime on an explicit RUN).
  var _toastEl = null, _toastT = 0;
  function updatedFeedback(sound) {
    if (sound) try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { var ac = new AC(); [880, 1320].forEach(function (f, i) { var o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination); var t = ac.currentTime + i * 0.12; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); o.start(t); o.stop(t + 0.16); }); }
    } catch (e) {}
    // reuse one banner element; on rapid input updates it just refreshes
    if (!_toastEl) {
      _toastEl = document.createElement('div');
      _toastEl.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:100050;background:linear-gradient(135deg,#0f5132,#16a34a);color:#d1fae5;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px 26px;border:1px solid #22c55e;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.45);';
      document.body.appendChild(_toastEl);
    }
    _toastEl.textContent = '✓ UPDATED SUCCESSFULLY';
    _toastEl.style.opacity = '1';
    clearTimeout(_toastT); _toastT = setTimeout(function () { if (_toastEl) { _toastEl.style.transition = 'opacity 0.4s'; _toastEl.style.opacity = '0'; } }, 1100);
  }
  // persistent highlighted "design complete" sign shown under the RUN button
  function runStatus() {
    var el = $('phe-run-status'); if (!el) return;
    var r = LAST;
    if (!r || !isFinite(r.N)) {
      el.style.display = 'block';
      el.style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)';
      el.innerHTML = '⚠ ENTER THE PROCESS INPUTS, THEN RUN';
      return;
    }
    el.style.display = 'block';
    el.style.background = 'linear-gradient(135deg,#22c55e,#4ade80)';
    el.innerHTML = '✓ DESIGN COMPLETE &nbsp;·&nbsp; ' + r.N + ' plates &nbsp;·&nbsp; U ' + Math.round(r.Ud)
      + ' W/m²K &nbsp;·&nbsp; area ' + r.Aprov.toFixed(1) + ' m² &nbsp;·&nbsp; ' + Math.round(r.Q / 1000) + ' kW'
      + '<div style="font-weight:400;font-size:8.5px;margin-top:2px;">3D view, report &amp; fabrication drawing updated below</div>';
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'pheRunPulse 0.9s ease-out';
  }

  // debounced "any update" feedback (no sound) so live edits confirm without spam
  var _updDeb = 0;
  function updateNotify() { clearTimeout(_updDeb); _updDeb = setTimeout(function () { updatedFeedback(false); }, 260); }

  var UNDO = [], REDO = [], INPUT_IDS = ['phe-project', 'phe-client', 'phe-tag', 'phe-service', 'phe-engineer', 'phe-rev',
    'phe-hf-name', 'phe-cf-name', 'phe-hf-phase', 'phe-cf-phase', 'phe-smart',
    'phe-hf-m', 'phe-hf-tin', 'phe-hf-tout', 'phe-hf-rho', 'phe-hf-mu', 'phe-hf-muw', 'phe-hf-cp', 'phe-hf-k', 'phe-hf-sg', 'phe-hf-rf', 'phe-hf-dpa', 'phe-hf-pdes',
    'phe-cf-m', 'phe-cf-tin', 'phe-cf-tout', 'phe-cf-rho', 'phe-cf-mu', 'phe-cf-muw', 'phe-cf-cp', 'phe-cf-k', 'phe-cf-sg', 'phe-cf-rf', 'phe-cf-dpa', 'phe-cf-pdes',
    'phe-ptype', 'phe-pmat', 'phe-gasket', 'phe-L', 'phe-W', 'phe-t', 'phe-b', 'phe-beta', 'phe-dp', 'phe-phi', 'phe-pitch', 'phe-pass', 'phe-margin'];
  function snapshot() { var s = {}; INPUT_IDS.forEach(function (id) { var e = $(id); if (e) s[id] = e.value; }); return s; }
  function restore(s) { if (!s) return; INPUT_IDS.forEach(function (id) { var e = $(id); if (e && s[id] !== undefined) e.value = s[id]; }); updateMatInfo(); calc(); }
  var lastSnap = null;
  function pushUndo() { if (lastSnap) UNDO.push(lastSnap); if (UNDO.length > 60) UNDO.shift(); REDO = []; lastSnap = snapshot(); }

  // industrial-standard geometry suggestion from the current duty.
  // Implements the classical gasketed-PHE thumb-rule chain:
  //   L = 1.6–2.5·√A  →  W = 0.42·L  →  t from design pressure  →  b = 5t
  //   → Dp = 0.30·W  →  β from allowable ΔP  →  pitch = b + 0.5  →  φ from β,
  // then a port-velocity check that widens the plate if the port runs too fast.
  function suggestGeometry() {
    var r = compute();
    var set = function (id, v) { var e = $(id); if (e) e.value = v; };
    var snap = function (v, s) { return Math.round(v / s) * s; };

    // ── 1 · plate length from required area (bounded 400–2500 mm) ──
    var A = Math.max(0.05, r.Areq || 1);
    var Lm = Math.min(2.5, Math.max(0.4, 2.0 * Math.sqrt(A)));       // m
    var Lp = snap(Lm * 1000, 50);                                    // mm

    // ── 2 · plate width = 0.42 × length (bounded 100–1000 mm) ──
    var Wp = Math.min(1000, Math.max(100, snap(Lp * 0.42, 10)));

    // ── 3 · plate thickness from design pressure ──
    var P = Math.max(r.Pdes || 0, 1);                                // bar
    var t = P < 10 ? 0.4 : P < 16 ? 0.5 : P < 25 ? 0.6 : P < 30 ? 0.8 : 1.0;

    // ── 4 · corrugation depth b = 5·t (bounded 2–5 mm) ──
    var b = Math.min(5, Math.max(2, +(5 * t).toFixed(1)));

    // ── 5 · chevron angle from the tighter allowable ΔP of the two sides ──
    var dpa = Math.min(num('phe-hf-dpa', 50), num('phe-cf-dpa', 50)); // kPa
    var beta = dpa < 20 ? 30 : dpa < 50 ? 45 : dpa < 100 ? 60 : 65;

    // ── 6 · enlargement factor from chevron angle ──
    var phi = +(1.15 + 0.0017 * (beta - 30)).toFixed(2);

    // ── 7 · plate pitch = corrugation depth + 0.5 mm (bounded 2–5 mm) ──
    var pitch = Math.min(5, Math.max(2, +(b + 0.5).toFixed(1)));

    // ── 8 · port diameter = 0.30 × width, then port-velocity check ──
    var Dp = snap(Wp * 0.30, 5);                                     // mm
    // largest side flow → port velocity; widen plate/port if > 3 m/s
    var q = Math.max(r.hot.m / r.hot.rho, r.cold.m / r.cold.rho);    // m³/s
    var vPort = q / (Math.PI * Math.pow(Dp / 1000, 2) / 4);
    var guard = 0;
    while (vPort > 3 && Wp < 1000 && guard++ < 8) {
      Wp = Math.min(1000, Wp + 30);
      Dp = snap(Wp * 0.30, 5);
      vPort = q / (Math.PI * Math.pow(Dp / 1000, 2) / 4);
    }

    set('phe-L', Lp); set('phe-W', Wp);
    set('phe-t', t); set('phe-b', b); set('phe-beta', String(beta));
    set('phe-phi', phi); set('phe-pitch', pitch); set('phe-dp', Dp);
    calc();
    suggestFeedback({ Lp: Lp, Wp: Wp, t: t, b: b, beta: beta, phi: phi, pitch: pitch, Dp: Dp, vPort: vPort, A: A });
  }

  // small note describing what the thumb-rule engine just applied
  function suggestFeedback(g) {
    var el = $('phe-suggest-note'); if (!el) return;
    el.style.display = 'block';
    el.innerHTML = '⚡ <b>Geometry suggested from duty</b> (required area ≈ ' + g.A.toFixed(1) + ' m²): '
      + 'Lp ' + g.Lp + ' · Wp ' + g.Wp + ' · t ' + g.t + ' · b ' + g.b + ' · β ' + g.beta + '° · φ ' + g.phi
      + ' · pitch ' + g.pitch + ' · port Ø ' + g.Dp + ' mm  →  port velocity ' + g.vPort.toFixed(2) + ' m/s '
      + (g.vPort <= 3 ? '✓' : '⚠ high') + '. All fields remain editable.';
  }

  /* ─────────── wiring ─────────── */
  function wire() {
    var ids = ['phe-hf-m', 'phe-hf-tin', 'phe-hf-tout', 'phe-hf-rho', 'phe-hf-mu', 'phe-hf-muw', 'phe-hf-cp', 'phe-hf-k', 'phe-hf-rf', 'phe-hf-sg', 'phe-hf-pdes',
      'phe-cf-m', 'phe-cf-tin', 'phe-cf-tout', 'phe-cf-rho', 'phe-cf-mu', 'phe-cf-muw', 'phe-cf-cp', 'phe-cf-k', 'phe-cf-rf', 'phe-cf-sg', 'phe-cf-pdes',
      'phe-L', 'phe-W', 'phe-t', 'phe-b', 'phe-beta', 'phe-dp', 'phe-phi', 'phe-pitch', 'phe-gasket',
      'phe-pass', 'phe-margin', 'phe-ptype', 'phe-hf-dpa', 'phe-cf-dpa', 'phe-smart', 'phe-hf-phase', 'phe-cf-phase'];
    // live recalc on edits — but NO "updated" banner (that only fires on RUN)
    ids.forEach(function (id) { var e = $(id); if (e) { e.addEventListener('input', function () { pushUndo(); calc(); }); e.addEventListener('change', function () { pushUndo(); calc(); }); } });
    // fluid-library selectors auto-fill properties then recalc
    var hn = $('phe-hf-name'); if (hn) hn.addEventListener('change', function () { pushUndo(); if (FLUIDS[val('phe-hf-name', '')]) applyFluid('hf'); else blankProps('hf'); calc(); });
    var cn = $('phe-cf-name'); if (cn) cn.addEventListener('change', function () { pushUndo(); if (FLUIDS[val('phe-cf-name', '')]) applyFluid('cf'); else blankProps('cf'); calc(); });
    var pm = $('phe-pmat'); if (pm) pm.addEventListener('change', function () { pushUndo(); updateMatInfo(); calc(); });
    var cb = $('phe-calc'); if (cb) cb.addEventListener('click', function () {
      applyFluid('hf'); applyFluid('cf'); calc();
      updatedFeedback(true);   // banner only on RUN
      runStatus();             // persistent highlighted sign under the button
    });
    var rb = $('phe-report'); if (rb) rb.addEventListener('click', report);
    var db = $('phe-draw'); if (db) db.addEventListener('click', drawing);
    var gb = $('phe-graph'); if (gb) gb.addEventListener('click', graph);
    var sg = $('phe-suggest-geo'); if (sg) sg.addEventListener('click', function () { pushUndo(); suggestGeometry(); });
    // undo / redo / reset
    var ub = $('phe-undo'); if (ub) ub.addEventListener('click', function () { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); lastSnap = snapshot(); });
    var rdb = $('phe-redo'); if (rdb) rdb.addEventListener('click', function () { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); lastSnap = snapshot(); });
    var rsb = $('phe-reset'); if (rsb) rsb.addEventListener('click', function () { if (DEFAULTS) { pushUndo(); restore(DEFAULTS); } });
    wireCombo();
    // seed
    applyFluid('hf'); applyFluid('cf'); updateMatInfo();
    lastSnap = snapshot(); if (!DEFAULTS) DEFAULTS = snapshot();
  }
  var DEFAULTS = null;

  // Custom DARK suggestion dropdown for every input[data-suggest]. Native
  // <datalist> popups are rendered white by the OS and can't be themed, so we
  // build our own themed list positioned under the field. One shared panel.
  function wireCombo() {
    var panel = $('phe-combo-pop');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'phe-combo-pop';
      panel.style.cssText = 'position:fixed;z-index:100060;display:none;background:#0b1220;border:1px solid #334155;border-radius:6px;box-shadow:0 10px 28px rgba(0,0,0,0.55);max-height:200px;overflow-y:auto;font-family:var(--font-mono);font-size:11px;';
      document.body.appendChild(panel);
    }
    var current = null;
    function hide() { panel.style.display = 'none'; current = null; }
    function open(inp) {
      current = inp;
      var opts = (inp.getAttribute('data-suggest') || '').split('|').filter(Boolean);
      var q = String(inp.value).trim().toLowerCase();
      var filtered = opts.filter(function (o) { return !q || String(o).toLowerCase().indexOf(q) === 0; });
      if (!filtered.length) filtered = opts;                 // show all if nothing matches
      if (!filtered.length) { hide(); return; }
      panel.innerHTML = filtered.map(function (o) {
        return '<div class="phe-combo-item" data-v="' + o + '" style="padding:6px 10px;color:#e2e8f0;cursor:pointer;border-bottom:1px solid rgba(51,65,85,0.4);">' + o + '</div>';
      }).join('');
      var r = inp.getBoundingClientRect();
      panel.style.left = r.left + 'px';
      panel.style.top = (r.bottom + 2) + 'px';
      panel.style.width = r.width + 'px';
      panel.style.display = 'block';
      panel.querySelectorAll('.phe-combo-item').forEach(function (it) {
        it.addEventListener('mousedown', function (e) {
          e.preventDefault();
          inp.value = it.getAttribute('data-v');
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          hide();
        });
        it.addEventListener('mouseenter', function () { it.style.background = 'rgba(56,189,248,0.18)'; });
        it.addEventListener('mouseleave', function () { it.style.background = 'transparent'; });
      });
    }
    document.querySelectorAll('.sthe-grid input[data-suggest]').forEach(function (inp) {
      inp.addEventListener('focus', function () { open(inp); });
      inp.addEventListener('input', function () { if (current === inp) open(inp); });
      inp.addEventListener('blur', function () { setTimeout(hide, 120); });
    });
    document.addEventListener('scroll', function () { if (current) hide(); }, true);
    window.addEventListener('resize', hide);
  }

  /* ─────────── core calculation engine ─────────── */
  function compute() {
    var hot = { m: num('phe-hf-m', 10), tin: num('phe-hf-tin', 90), tout: num('phe-hf-tout', 55),
      rho: num('phe-hf-rho', 965), mu: num('phe-hf-mu', 0.00032), cp: num('phe-hf-cp', 4198), k: num('phe-hf-k', 0.668), rf: num('phe-hf-rf', 0.000018) };
    var cold = { m: num('phe-cf-m', 12), tin: num('phe-cf-tin', 30), tout: num('phe-cf-tout', 50),
      rho: num('phe-cf-rho', 992), mu: num('phe-cf-mu', 0.00065), cp: num('phe-cf-cp', 4180), k: num('phe-cf-k', 0.628), rf: num('phe-cf-rf', 0.000018) };

    // SMART INPUT — solve the chosen unknown from the energy balance Q = m·Cp·ΔT
    var smart = val('phe-smart', '— all user inputs —');
    var auto = null;   // {id, value} to reflect into the locked field
    if (smart === 'Cold Mass Flow') { var q = hot.m * hot.cp * (hot.tin - hot.tout); cold.m = (cold.cp * (cold.tout - cold.tin)) ? q / (cold.cp * (cold.tout - cold.tin)) : cold.m; auto = { id: 'phe-cf-m', v: cold.m }; }
    else if (smart === 'Hot Mass Flow') { var q2 = cold.m * cold.cp * (cold.tout - cold.tin); hot.m = (hot.cp * (hot.tin - hot.tout)) ? q2 / (hot.cp * (hot.tin - hot.tout)) : hot.m; auto = { id: 'phe-hf-m', v: hot.m }; }
    else if (smart === 'Hot Outlet Temp') { var q3 = cold.m * cold.cp * (cold.tout - cold.tin); hot.tout = hot.tin - (hot.m * hot.cp ? q3 / (hot.m * hot.cp) : 0); auto = { id: 'phe-hf-tout', v: hot.tout }; }
    else if (smart === 'Cold Outlet Temp') { var q4 = hot.m * hot.cp * (hot.tin - hot.tout); cold.tout = cold.tin + (cold.m * cold.cp ? q4 / (cold.m * cold.cp) : 0); auto = { id: 'phe-cf-tout', v: cold.tout }; }
    // reflect the solved value into its (locked, green) field
    applyAutoLock(smart, auto);

    // duty & energy balance
    var Qh = hot.m * hot.cp * (hot.tin - hot.tout);
    var Qc = cold.m * cold.cp * (cold.tout - cold.tin);
    var Q = (Qh + Qc) / 2;                      // W (mean of both sides)
    var Qbal = Qc !== 0 ? (Qh / Qc) : 1;         // energy-balance ratio

    // LMTD — compute BOTH arrangements and auto-recommend the better one
    // (no user selection: counter-current gives the higher ΔTm → smaller area).
    function lmtdOf(cc) {
      var a = cc ? (hot.tin - cold.tout) : (hot.tin - cold.tin);
      var b = cc ? (hot.tout - cold.tin) : (hot.tout - cold.tout);
      if (a <= 0 || b <= 0) return { lmtd: 0, ok: false };   // temperature cross / infeasible
      return { lmtd: (Math.abs(a - b) < 1e-6) ? a : (a - b) / Math.log(a / b), ok: true };
    }
    var lmCounter = lmtdOf(true), lmCo = lmtdOf(false);
    var Fc = 0.99, Fp = 0.90;                      // plate HE ≈ true counter-current
    var dTmCounter = lmCounter.lmtd * Fc, dTmCo = lmCo.lmtd * Fp;
    // recommend counter-current unless it is infeasible (cross) and co-current is
    var counter = lmCounter.ok && (dTmCounter >= dTmCo || !lmCo.ok);
    var lmtd = counter ? lmCounter.lmtd : lmCo.lmtd;
    var F = counter ? Fc : Fp;
    var dTm = lmtd * F;
    var flowCmp = {
      counterLMTD: lmCounter.lmtd, coLMTD: lmCo.lmtd,
      counterDTm: dTmCounter, coDTm: dTmCo,
      counterOk: lmCounter.ok, coOk: lmCo.ok,
      best: counter ? 'Counter-current' : 'Co-current',
      gain: (dTmCo > 0 ? (dTmCounter / dTmCo - 1) * 100 : 0)   // % smaller area with counter
    };

    // ε-NTU
    var Ch = hot.m * hot.cp, Cc = cold.m * cold.cp;
    var Cmin = Math.min(Ch, Cc), Cmax = Math.max(Ch, Cc), Cr = Cmin / Cmax;
    var Qmax = Cmin * (hot.tin - cold.tin);
    var eff = Qmax > 0 ? Q / Qmax : 0;
    var approach = Math.min(hot.tin - cold.tout, hot.tout - cold.tin);

    // geometry (m)
    var Lp = num('phe-L', 1200) / 1000, Wp = num('phe-W', 500) / 1000, t = num('phe-t', 0.5) / 1000;
    var b = num('phe-b', 2.5) / 1000, phi = num('phe-phi', 1.18), beta = Math.max(20, Math.min(75, num('phe-beta', 60)));
    var Dp = num('phe-dp', 150) / 1000, pitch = num('phe-pitch', 3.0) / 1000;
    var ch = chevronConst(beta);
    var Dh = 2 * b / phi;                          // hydraulic diameter
    var Ach = b * Wp;                              // single-channel flow area
    var Ap = Lp * Wp * phi;                        // developed area per plate
    var matName = val('phe-pmat', 'SS316');
    var mat = MATERIALS[matName] || MATERIALS['SS316'];
    var kw = mat.k;

    // passes → channels per pass estimate (iterate plate count)
    var passStr = val('phe-pass', '1 Pass / 1 Pass');
    var npass = parseInt(passStr) || 1;   // first number = passes per side (hot)

    // first pass: assume a channel count, converge on U & N
    function sideCoef(s, Ncp) {
      var mch = s.m / Math.max(1, Ncp);           // per-channel mass flow
      var G = mch / Ach;                           // mass velocity kg/m²s
      var Re = G * Dh / s.mu;
      var Pr = s.cp * s.mu / s.k;
      var Nu = ch.c * Math.pow(Math.max(Re, 1), ch.n) * Math.pow(Pr, 1 / 3);
      var h = Nu * s.k / Dh;
      var vel = G / s.rho;                          // channel velocity m/s
      // Fanning friction (chevron): f = Kp * Re^-0.25 scaled by chevron factor
      var f = ch.f * (0.8 * Math.pow(Math.max(Re, 1), -0.25) + 0.02);
      return { G: G, Re: Re, Pr: Pr, Nu: Nu, h: h, vel: vel, f: f, mch: mch };
    }

    var Rw = t / kw;
    // pressure drop (per side): channel (Fanning) + port (1.4 velocity heads)
    function dP(s, side) {
      var Lflow = Lp * npass;
      var dpCh = 4 * side.f * (Lflow / Dh) * (side.G * side.G / (2 * s.rho));   // Pa
      var Aport = Math.PI * Dp * Dp / 4;
      var Gp = s.m / Aport;                          // port mass velocity
      var vport = Gp / s.rho;
      var dpPort = 1.4 * npass * (Gp * Gp / (2 * s.rho));
      return { dp: (dpCh + dpPort) / 1000, ch: dpCh / 1000, port: dpPort / 1000, vport: vport };   // kPa
    }
    // full state for a given plate count
    function state(N) {
      var Ncp = Math.max(1, Math.round((N - 1) / (2 * npass)));   // channels/pass/side
      var H = sideCoef(hot, Ncp), C = sideCoef(cold, Ncp);
      var Uclean = 1 / (1 / H.h + 1 / C.h + Rw);
      var Ud = 1 / (1 / Uclean + hot.rf + cold.rf);
      var Aprov = (N - 1) * Ap;
      var Areq = Q / (Ud * dTm) * margin;
      return { N: N, Ncp: Ncp, H: H, C: C, Uclean: Uclean, Ud: Ud, Aprov: Aprov, Areq: Areq,
        dpH: dP(hot, H), dpC: dP(cold, C) };
    }
    // Size the pack to satisfy BOTH the thermal area AND the allowable pressure
    // drop / velocity. Grow the plate count (more channels → lower velocity →
    // lower ΔP and more realistic U) until both are met, capped for sanity.
    var margin = 1 + num('phe-margin', 10) / 100;
    var dpHallow = num('phe-hf-dpa', 50), dpCallow = num('phe-cf-dpa', 50);
    var st, N = 7;
    for (var it2 = 0; it2 < 400; it2++) {
      st = state(N);
      var thermalOk = st.Aprov >= st.Areq;
      var hydraulicOk = st.dpH.dp <= dpHallow * 1.02 && st.dpC.dp <= dpCallow * 1.02;
      if (thermalOk && hydraulicOk) break;
      N += 2;                                        // keep total odd (even channels)
      if (N > 601) break;                            // safety cap
    }
    var Ncp = st.Ncp, H = st.H, C = st.C, Uclean = st.Uclean, Ud = st.Ud;
    N = st.N;
    var Aprov = st.Aprov, Areq = st.Areq;
    var Ureq = Q / (Aprov * dTm);
    var overSurf = (Aprov / Areq - 1) * 100;
    var dpH = st.dpH, dpC = st.dpC;

    // mechanical (simplified ASME/EN screening)
    var Pdes = Math.max(num('phe-hf-pdes', 10), num('phe-cf-pdes', 10));   // barg
    var Phydro = 1.43 * Pdes;                       // ASME VIII hydrotest
    var packLen = N * pitch * 1000;                 // mm compressed
    var frameLen = packLen + 250;                   // + frame allowance mm
    // rough tie-bolt sizing: compression force = Pdes on plate projected area
    var Fcomp = Pdes * 1e5 * (Lp * Wp);             // N
    var nBolts = Math.max(4, Math.ceil(Fcomp / 90000) * 2);   // pairs
    var boltStress = 140e6;                          // allowable Pa
    var boltA = Fcomp / (nBolts * boltStress);
    var boltDia = Math.max(16, Math.ceil(Math.sqrt(4 * boltA / Math.PI) * 1000 / 2) * 2);   // mm, even
    var plateMass = Ap * t * 7900;                  // kg per plate (SS density)
    var wEmpty = plateMass * N + 0.35 * frameLen;   // rough
    var wOper = wEmpty + (N - 1) * Ach * Lp * ((hot.rho + cold.rho) / 2);

    var gasket = val('phe-gasket', 'EPDM');
    var gasketOk = Math.max(hot.tin, cold.tout) <= (GASKET_TMAX[gasket] || 150);

    // U0 assumption band from service-fluid pair (industrial rule-of-thumb, W/m²K)
    var hPhase = val('phe-hf-phase', 'Liquid'), cPhase = val('phe-cf-phase', 'Liquid');
    function sideClass(s, phase) {
      if (phase === 'Gas') return 'gas';
      if (phase === 'Condensing' || phase === 'Evaporating' || phase === 'Two-Phase') return 'phase';
      if (s.cp < 2600 && s.k < 0.2) return 'oil';       // hydrocarbon / oil
      return 'water';                                    // aqueous
    }
    var hc = sideClass(hot, hPhase), cc = sideClass(cold, cPhase);
    function uBand() {
      if (hc === 'phase' || cc === 'phase') return { lo: 3500, hi: 7000, basis: 'Phase-change / steam service' };
      if (hc === 'gas' || cc === 'gas') return { lo: 100, hi: 500, basis: 'Gas–liquid service' };
      if (hc === 'oil' || cc === 'oil') return { lo: 300, hi: 1000, basis: 'Oil / hydrocarbon–liquid service' };
      return { lo: 2500, hi: 6000, basis: 'Water–water / aqueous service' };
    }
    var uSug = uBand();
    var uInBand = Ud >= uSug.lo && Ud <= uSug.hi;

    // nozzle / port hydraulics for hot & cold, inlet & outlet (mass flow constant;
    // density differs in vs out with temperature — use side property as estimate)
    var Aport = Math.PI * Dp * Dp / 4;
    function noz(m, rho) { var v = m / (rho * Aport); return { v: v, dp: 1.4 * (rho * v * v / 2) / 1000 }; }  // dp kPa
    var nozzles = {
      hotIn: noz(hot.m, hot.rho), hotOut: noz(hot.m, hot.rho),
      coldIn: noz(cold.m, cold.rho), coldOut: noz(cold.m, cold.rho),
      hotName: val('phe-hf-name', 'Hot'), coldName: val('phe-cf-name', 'Cold')
    };

    return {
      hot: hot, cold: cold, Q: Q, Qh: Qh, Qc: Qc, Qbal: Qbal, lmtd: lmtd, F: F, dTm: dTm,
      Cr: Cr, Cmin: Cmin, Cmax: Cmax, Qmax: Qmax, eff: eff, NTU: Ud * Aprov / Cmin, approach: approach,
      Dh: Dh, Ap: Ap, N: N, Ncp: Ncp, npass: npass, Areq: Areq, Aprov: Aprov, Ureq: Ureq,
      Uclean: Uclean, Ud: Ud, overSurf: overSurf, H: H, C: C, Rw: Rw,
      dpH: dpH, dpC: dpC, dpHa: num('phe-hf-dpa', 50), dpCa: num('phe-cf-dpa', 50),
      Pdes: Pdes, Phydro: Phydro, packLen: packLen, frameLen: frameLen, nBolts: nBolts, boltDia: boltDia,
      wEmpty: wEmpty, wOper: wOper, gasket: gasket, gasketOk: gasketOk,
      Lp: Lp, Wp: Wp, t: t, b: b, phi: phi, beta: beta, Dp: Dp, pitch: pitch, kw: kw,
      counter: counter, flowCmp: flowCmp, matName: matName, mat: mat,
      uSug: uSug, uInBand: uInBand, nozzles: nozzles, smart: smart, auto: auto
    };
  }

  var LAST = null;
  // which process field each CALCULATE choice solves for (locked & auto-filled)
  var SMART_FIELD = {
    'Cold Mass Flow': 'phe-cf-m', 'Hot Mass Flow': 'phe-hf-m',
    'Hot Outlet Temp': 'phe-hf-tout', 'Cold Outlet Temp': 'phe-cf-tout'
  };

  // Lock / unlock the process field driven by the CALCULATE selection. The
  // auto-calculated entity is read-only (green, badged) and cannot be typed
  // into; all other fields are freed for user entry. Runs immediately on
  // dropdown change (auto == null → just lock, value filled later by compute).
  function applyAutoLock(smart, auto) {
    var autoId = auto ? auto.id : SMART_FIELD[smart] || null;
    ['phe-cf-m', 'phe-hf-m', 'phe-hf-tout', 'phe-cf-tout'].forEach(function (id) {
      var e = $(id); if (!e) return;
      var lbl = e.closest('label');
      if (id === autoId) {
        if (auto) e.value = (Math.round(auto.v * 1000) / 1000);
        e.readOnly = true; e.classList.add('phe-auto');
        e.style.background = 'rgba(34,197,94,0.10)'; e.style.borderColor = '#22c55e'; e.style.color = '#22c55e';
        e.setAttribute('title', 'Auto-calculated from the energy balance — no entry needed');
        if (lbl && !lbl.querySelector('.phe-auto-badge')) {
          var badge = document.createElement('span');
          badge.className = 'phe-auto-badge';
          badge.style.cssText = 'color:#22c55e;font-weight:700;margin-left:5px;font-size:8.5px;';
          badge.textContent = '⚡ AUTO-CALCULATED';
          lbl.querySelector('span') ? lbl.insertBefore(badge, lbl.querySelector('span')) : lbl.appendChild(badge);
        }
      } else {
        e.readOnly = false; e.classList.remove('phe-auto'); e.removeAttribute('title');
        e.style.background = ''; e.style.borderColor = ''; e.style.color = '';
        if (lbl) { var b = lbl.querySelector('.phe-auto-badge'); if (b) b.remove(); }
      }
    });
  }

  function calc() {
    if (!$('phe-results')) return;
    // require the core process inputs before showing a design — EXCEPT the field
    // that the CALCULATE selection auto-solves (it is derived, not entered).
    applyAutoLock(val('phe-smart', '— all user inputs —'), null);
    var autoId = SMART_FIELD[val('phe-smart', '— all user inputs —')] || null;
    var essential = ['phe-hf-m', 'phe-cf-m', 'phe-hf-tin', 'phe-cf-tin', 'phe-hf-tout', 'phe-cf-tout']
      .filter(function (id) { return id !== autoId; });
    var missing = essential.some(function (id) { var e = $(id); return !e || String(e.value).trim() === ''; });
    if (missing) {
      $('phe-results').innerHTML = '<div style="font-family:var(--font-mono);font-size:11px;color:#f59e0b;background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;padding:10px 12px;border-radius:4px;line-height:1.5;">▸ Enter the process inputs (mass flow &amp; temperatures for both sides), then press <b>RUN PHE DESIGN</b>. Fluid properties auto-fill from the library.</div>';
      var tg = $('phe-3dtag'); if (tg) tg.textContent = 'Awaiting process inputs…';
      return;
    }
    var r = LAST = compute();
    var f1 = function (x) { return isFinite(x) ? x.toFixed(1) : '—'; };
    var f0 = function (x) { return isFinite(x) ? Math.round(x).toLocaleString() : '—'; };
    var row = function (l, v, cls) { return '<div class="phe-rr ' + (cls || '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
    var h = '';
    // flow-arrangement comparison (auto-recommended, no user input)
    var fc = r.flowCmp;
    h += '<div class="phe-cardh">FLOW ARRANGEMENT — AUTO COMPARISON</div>';
    h += row('Counter-current ΔTm', f1(fc.counterDTm) + ' °C' + (fc.counterOk ? '' : ' (infeasible)'), r.counter ? 'ok' : '');
    h += row('Co-current ΔTm', f1(fc.coDTm) + ' °C' + (fc.coOk ? '' : ' (infeasible)'), !r.counter ? 'ok' : '');
    h += row('★ Recommended', fc.best + (fc.gain > 0.5 ? ' (−' + f1(fc.gain) + '% area)' : ''), 'ok');
    h += '<div class="phe-cardh">4 · AUTO-CALCULATED THERMAL</div>';
    h += row('Heat duty Q', f0(r.Q / 1000) + ' kW');
    h += row('Energy balance', (r.Qbal).toFixed(3) + ' (Qh/Qc)', Math.abs(r.Qbal - 1) > 0.05 ? 'warn' : 'ok');
    h += row('LMTD', f1(r.lmtd) + ' °C');
    h += row('Correction F', r.F.toFixed(2));
    h += row('True ΔTm', f1(r.dTm) + ' °C');
    h += row('Capacity ratio Cr', r.Cr.toFixed(3));
    h += row('Effectiveness ε', (r.eff * 100).toFixed(1) + ' %');
    h += row('NTU', r.NTU.toFixed(2));
    h += row('Approach', f1(r.approach) + ' °C');

    h += '<div class="phe-cardh">13 · THERMAL DESIGN</div>';
    h += row('Reynolds (hot / cold)', f0(r.H.Re) + ' / ' + f0(r.C.Re));
    h += row('Prandtl (hot / cold)', r.H.Pr.toFixed(1) + ' / ' + r.C.Pr.toFixed(1));
    h += row('Nusselt (hot / cold)', f0(r.H.Nu) + ' / ' + f0(r.C.Nu));
    h += row('Film h hot', f0(r.H.h) + ' W/m²K');
    h += row('Film h cold', f0(r.C.h) + ' W/m²K');
    h += row('Wall resistance', (r.Rw * 1e4).toFixed(2) + '×10⁻⁴');
    h += row('Clean U', f0(r.Uclean) + ' W/m²K');
    h += row('Dirty U (service)', f0(r.Ud) + ' W/m²K');
    h += row('Required U', f0(r.Ureq) + ' W/m²K');

    h += '<div class="phe-cardh">16 · PLATE-PACK DESIGN</div>';
    h += row('Area required', f1(r.Areq) + ' m²');
    h += row('Area provided', f1(r.Aprov) + ' m²');
    h += row('Over-surface', f1(r.overSurf) + ' %', r.overSurf < 0 ? 'warn' : 'ok');
    h += row('Total plates', r.N + ' (' + (r.N - 1) + ' channels)');
    h += row('Channels/pass/side', r.Ncp);
    h += row('Passes', r.npass + ' / ' + r.npass);
    h += row('Area per plate', r.Ap.toFixed(3) + ' m²');
    h += row('Hydraulic dia Dh', (r.Dh * 1000).toFixed(2) + ' mm');
    h += row('Compressed pack', f0(r.packLen) + ' mm');

    h += '<div class="phe-cardh">15 · PRESSURE DROP</div>';
    h += row('ΔP hot (ch+port)', f1(r.dpH.dp) + ' kPa', r.dpH.dp > r.dpHa ? 'warn' : 'ok');
    h += row('ΔP cold (ch+port)', f1(r.dpC.dp) + ' kPa', r.dpC.dp > r.dpCa ? 'warn' : 'ok');
    h += row('Channel vel (hot/cold)', r.H.vel.toFixed(2) + ' / ' + r.C.vel.toFixed(2) + ' m/s');
    h += row('Port vel (hot/cold)', r.dpH.vport.toFixed(2) + ' / ' + r.dpC.vport.toFixed(2) + ' m/s',
      (r.dpH.vport > 6 || r.dpC.vport > 6) ? 'warn' : 'ok');

    h += '<div class="phe-cardh">U₀ ASSUMPTION — SERVICE-FLUID DESIGN CRITERIA</div>';
    h += row('Suggested U₀ band', f0(r.uSug.lo) + '–' + f0(r.uSug.hi) + ' W/m²K');
    h += row('Basis', r.uSug.basis);
    h += row('Design (dirty) U', f0(r.Ud) + ' W/m²K', r.uInBand ? 'ok' : 'warn');
    h += row('Within design band', r.uInBand ? 'YES ✓' : 'REVIEW — outside typical band', r.uInBand ? 'ok' : 'warn');

    h += '<div class="phe-cardh">11 · NOZZLE / PORT SIZING</div>';
    h += row(r.nozzles.hotName + ' — HOT IN', r.nozzles.hotIn.v.toFixed(2) + ' m/s · ΔP ' + r.nozzles.hotIn.dp.toFixed(1) + ' kPa', r.nozzles.hotIn.v > 6 ? 'warn' : 'ok');
    h += row(r.nozzles.hotName + ' — HOT OUT', r.nozzles.hotOut.v.toFixed(2) + ' m/s · ΔP ' + r.nozzles.hotOut.dp.toFixed(1) + ' kPa', r.nozzles.hotOut.v > 6 ? 'warn' : 'ok');
    h += row(r.nozzles.coldName + ' — COLD IN', r.nozzles.coldIn.v.toFixed(2) + ' m/s · ΔP ' + r.nozzles.coldIn.dp.toFixed(1) + ' kPa', r.nozzles.coldIn.v > 6 ? 'warn' : 'ok');
    h += row(r.nozzles.coldName + ' — COLD OUT', r.nozzles.coldOut.v.toFixed(2) + ' m/s · ΔP ' + r.nozzles.coldOut.dp.toFixed(1) + ' kPa', r.nozzles.coldOut.v > 6 ? 'warn' : 'ok');
    h += row('Port diameter', f0(r.Dp * 1000) + ' mm');

    h += '<div class="phe-cardh">6 · PLATE MATERIAL — ' + r.matName + '</div>';
    h += row('Thermal conductivity', r.mat.k + ' W/m·K');
    h += row('Surface roughness', r.mat.rough + ' µm');
    h += row('Corrosion rate', r.mat.corr.toFixed(2) + ' mm/yr');
    h += row('Allowable stress', r.mat.S + ' MPa');
    h += row('Density', r.mat.rho + ' kg/m³');

    h += '<div class="phe-cardh">12 · MECHANICAL DESIGN</div>';
    h += row('Design pressure', r.Pdes.toFixed(1) + ' barg');
    h += row('Hydrotest (1.43×)', r.Phydro.toFixed(1) + ' barg');
    h += row('Frame length', f0(r.frameLen) + ' mm');
    h += row('Tie-bolts', r.nBolts + ' × M' + r.boltDia);
    h += row('Weight empty', f0(r.wEmpty) + ' kg');
    h += row('Weight operating', f0(r.wOper) + ' kg');
    h += row('Gasket ' + r.gasket, r.gasketOk ? 'OK for temp' : 'CHECK Tmax', r.gasketOk ? 'ok' : 'warn');

    $('phe-results').innerHTML = h;
    var tag = $('phe-3dtag'); if (tag) tag.textContent = r.N + ' plates · ' + (r.N - 1) + ' channels · ' + f0(r.Q / 1000) + ' kW · ' + (val('phe-ptype', 'Chevron') );
    // 3D nozzle labels reflect the user's hot/cold fluid names live
    var nl = function (id, t) { var e = $(id); if (e) e.innerHTML = t; };
    var hn = r.nozzles.hotName.split(' (')[0], cn = r.nozzles.coldName.split(' (')[0];
    var dpmm = Math.round(r.Dp * 1000);
    nl('phe-noz-hin', '▸ HOT IN · ' + hn + '<br><span style="font-weight:400;">' + r.hot.tin.toFixed(0) + '°C · DN' + dpmm + '</span>');
    nl('phe-noz-hout', '◂ HOT OUT · ' + hn + '<br><span style="font-weight:400;">' + r.hot.tout.toFixed(0) + '°C · DN' + dpmm + '</span>');
    nl('phe-noz-cin', 'COLD IN · ' + cn + ' ◂<br><span style="font-weight:400;">' + r.cold.tin.toFixed(0) + '°C · DN' + dpmm + '</span>');
    nl('phe-noz-cout', 'COLD OUT · ' + cn + ' ▸<br><span style="font-weight:400;">' + r.cold.tout.toFixed(0) + '°C · DN' + dpmm + '</span>');
    update3D(r);
  }

  /* ─────────── live 3D plate-pack (Three.js) ─────────── */
  // fix a zero-size canvas when the tab was hidden at init time
  function pheResize() {
    if (!three) return; var c = three.canvas; if (!c || !c.clientWidth) return;
    three.cam.aspect = c.clientWidth / c.clientHeight; three.cam.updateProjectionMatrix();
    three.rn.setSize(c.clientWidth, c.clientHeight, false);
  }
  function init3D() {
    if (!THREE_OK || three) return;
    var canvas = $('phe-canvas'); if (!canvas) return;
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1220);
    var cam = new THREE.PerspectiveCamera(45, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 500);
    var rn = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    rn.setSize(canvas.clientWidth, canvas.clientHeight, false);
    rn.shadowMap.enabled = true;
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2b3242, 0.85));
    var dir = new THREE.DirectionalLight(0xffffff, 0.85); dir.position.set(8, 14, 10); dir.castShadow = true; scene.add(dir);
    var grid = new THREE.GridHelper(60, 30, 0x224, 0x1a2740); grid.position.y = -0.01; scene.add(grid);
    var group = new THREE.Group(); scene.add(group);
    var sph = { r: 24, theta: 0.9, phi: 1.05, tx: 0, ty: 3, tz: 0 };
    function place() {
      var x = sph.r * Math.sin(sph.phi) * Math.sin(sph.theta), y = sph.r * Math.cos(sph.phi), z = sph.r * Math.sin(sph.phi) * Math.cos(sph.theta);
      cam.position.set(sph.tx + x, sph.ty + y, sph.tz + z); cam.lookAt(sph.tx, sph.ty, sph.tz);
    }
    three = { scene: scene, cam: cam, rn: rn, group: group, sph: sph, place: place, canvas: canvas };
    place();
    // orbit
    var down = null;
    canvas.addEventListener('mousedown', function (e) { down = { x: e.clientX, y: e.clientY, th: sph.theta, ph: sph.phi }; });
    window.addEventListener('mousemove', function (e) {
      if (!down) return; sph.theta = down.th - (e.clientX - down.x) * 0.01; sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, down.ph - (e.clientY - down.y) * 0.01)); place();
    });
    window.addEventListener('mouseup', function () { down = null; });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(6, Math.min(80, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); place(); }, { passive: false });
    (function loop() { requestAnimationFrame(loop); rn.render(scene, cam); updateNozzleLabels(); })();
    window.addEventListener('resize', function () {
      if (!canvas.clientWidth) return; cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.updateProjectionMatrix(); rn.setSize(canvas.clientWidth, canvas.clientHeight, false);
    });
  }

  // Pin each hot/cold callout to its nozzle end and draw a leader line to it,
  // so the labels are "mounted" on the plate pack at the actual nozzles.
  function updateNozzleLabels() {
    if (!three || !three.nozWorld) return;
    var canvas = three.canvas, cam = three.cam;
    var W = canvas.clientWidth, H = canvas.clientHeight; if (!W) return;
    var svg = document.getElementById('phe-noz-svg');
    var map = { hin: 'phe-noz-hin', hout: 'phe-noz-hout', cin: 'phe-noz-cin', cout: 'phe-noz-cout' };
    var lines = '';
    Object.keys(map).forEach(function (k) {
      var lbl = document.getElementById(map[k]); if (!lbl) return;
      var v = three.nozWorld[k].clone().project(cam);
      var sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      var behind = v.z > 1;                                   // behind camera
      // push the label a little outward (left nozzles → left, right → right)
      var isLeft = (k === 'hin' || k === 'hout');
      var lx = Math.max(46, Math.min(W - 46, sx + (isLeft ? -40 : 40)));
      var ly = Math.max(16, Math.min(H - 16, sy));
      lbl.style.display = behind ? 'none' : 'block';
      lbl.style.left = lx + 'px'; lbl.style.top = ly + 'px';
      if (!behind) lines += '<line x1="' + lx + '" y1="' + ly + '" x2="' + sx + '" y2="' + sy + '" stroke="' + (isLeft ? '#f87171' : '#60a5fa') + '" stroke-width="1.4" stroke-dasharray="3 2"/>'
        + '<circle cx="' + sx + '" cy="' + sy + '" r="3" fill="' + (isLeft ? '#dc2626' : '#2563eb') + '"/>';
    });
    if (svg) svg.innerHTML = lines;
  }

  function update3D(r) {
    if (!three) return;
    var g = three.group;
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var N = Math.min(r.N, 80);                       // cap visual plate count for perf
    var ptype = val('phe-ptype', 'Chevron (Herringbone)');
    // plate type visibly changes the model: wide-gap → bigger pitch, brazed/
    // welded → no bolted frame (compact block), free-flow → wider channels
    var pitchMul = /Wide-Gap|Free-Flow/.test(ptype) ? 1.7 : 1.0;
    var brazed = /Brazed|Fully-Welded/.test(ptype);
    var pitch = Math.max(0.18, r.pitch * 90) * pitchMul;
    var PW = 5.2, PH = 8.5, PT = 0.09;
    var packW = N * pitch;
    var x0 = -packW / 2;
    var steel = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.9, roughness: 0.35 });
    var frameMat = new THREE.MeshStandardMaterial({ color: brazed ? 0x64748b : 0x1e3a8a, metalness: 0.7, roughness: 0.4 });
    var hotMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.92 });
    var coldMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.92 });
    function box(w, h, d, m, x, y, z) { var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; }
    // fixed frame plate + pressure plate
    box(0.6, PH + 1.2, PW + 1.2, frameMat, x0 - 0.5, PH / 2 + 0.6, 0);
    box(0.6, PH + 1.2, PW + 1.2, frameMat, x0 + packW + 0.5, PH / 2 + 0.6, 0);
    // plate pack — thin plates alternating hot/cold channel tint
    for (var i = 0; i < N; i++) {
      var m = i % 2 ? hotMat : coldMat;
      box(PT, PH, PW, i % 2 === 0 && i > 0 ? steel : m, x0 + i * pitch, PH / 2 + 0.6, 0);
    }
    // carrying bar (top) + guide bar (bottom)
    box(packW + 2, 0.35, 0.35, steel, x0 + packW / 2, PH + 1.4, 0);
    box(packW + 2, 0.3, 0.3, steel, x0 + packW / 2, 0.35, 0);
    // tie bolts (top & bottom rails) — omitted for brazed / fully-welded units
    if (!brazed) for (var tb = 0; tb < Math.min(6, r.nBolts); tb++) {
      var bz = -PW / 2 + 0.4 + tb * (PW - 0.8) / Math.max(1, Math.min(6, r.nBolts) - 1);
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, packW + 2, 10), steel);
      rod.rotation.z = Math.PI / 2; rod.position.set(x0 + packW / 2, PH + 1.4, bz); g.add(rod);
    }
    // nozzles on the fixed frame (4 corners) — hot in/out, cold in/out
    var dp = Math.max(0.5, r.Dp * 3);
    function nozzle(y, z, mat) {
      var n = new THREE.Mesh(new THREE.CylinderGeometry(dp / 2, dp / 2, 1.4, 16), mat); n.rotation.z = Math.PI / 2; n.position.set(x0 - 1.2, y, z); g.add(n);
      var f = new THREE.Mesh(new THREE.CylinderGeometry(dp / 2 + 0.25, dp / 2 + 0.25, 0.2, 16), steel); f.rotation.z = Math.PI / 2; f.position.set(x0 - 1.9, y, z); g.add(f);
      // connecting pipe stub (highlights the hot/cold line into the port)
      var pipe = new THREE.Mesh(new THREE.CylinderGeometry(dp / 2 * 0.8, dp / 2 * 0.8, 2.6, 16), mat); pipe.rotation.z = Math.PI / 2; pipe.position.set(x0 - 3.3, y, z); g.add(pipe);
      var f2 = new THREE.Mesh(new THREE.CylinderGeometry(dp / 2 + 0.25, dp / 2 + 0.25, 0.2, 16), steel); f2.rotation.z = Math.PI / 2; f2.position.set(x0 - 4.5, y, z); g.add(f2);
    }
    nozzle(PH - 0.5, PW / 2 - 0.8, hotMat);      // hot in (top)
    nozzle(1.3, PW / 2 - 0.8, hotMat);           // hot out (bottom)
    nozzle(PH - 0.5, -PW / 2 + 0.8, coldMat);    // cold in (top)
    nozzle(1.3, -PW / 2 + 0.8, coldMat);         // cold out (bottom)
    // world positions of the nozzle flange ENDS — labels are pinned to these
    // with a leader line so the hot/cold callouts sit on the actual nozzles.
    three.nozWorld = {
      hin:  new THREE.Vector3(x0 - 4.5, PH - 0.5, PW / 2 - 0.8),
      hout: new THREE.Vector3(x0 - 4.5, 1.3, PW / 2 - 0.8),
      cin:  new THREE.Vector3(x0 - 4.5, PH - 0.5, -PW / 2 + 0.8),
      cout: new THREE.Vector3(x0 - 4.5, 1.3, -PW / 2 + 0.8)
    };
    // feet
    box(1.2, 0.4, PW + 1.6, frameMat, x0 - 0.5, 0.2, 0);
    box(1.2, 0.4, PW + 1.6, frameMat, x0 + packW + 0.5, 0.2, 0);
    three.sph.tx = x0 + packW / 2; three.sph.r = Math.max(18, packW * 1.7 + 12); three.place();
  }

  /* ─────────── temperature-profile graph ─────────── */
  function graph() {
    var r = LAST || compute();
    var W = 720, H = 420, pad = 60;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:#0b1220;border-radius:8px;font-family:monospace;">';
    s += '<text x="' + (W / 2) + '" y="26" fill="#38bdf8" font-size="15" font-weight="800" text-anchor="middle">TEMPERATURE PROFILE — ' + val('phe-tag', 'PHE-101') + '</text>';
    var tmax = Math.max(r.hot.tin, r.cold.tout) + 8, tmin = Math.min(r.hot.tout, r.cold.tin) - 8;
    function X(f) { return pad + f * (W - 2 * pad); }
    function Y(T) { return (H - pad) - (T - tmin) / (tmax - tmin) * (H - 2 * pad); }
    // axes
    s += '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" stroke="#334155"/>';
    s += '<line x1="' + pad + '" y1="' + pad + '" x2="' + pad + '" y2="' + (H - pad) + '" stroke="#334155"/>';
    for (var g5 = 0; g5 <= 5; g5++) { var T = tmin + g5 / 5 * (tmax - tmin); s += '<line x1="' + pad + '" y1="' + Y(T) + '" x2="' + (W - pad) + '" y2="' + Y(T) + '" stroke="#1e293b"/><text x="' + (pad - 6) + '" y="' + (Y(T) + 3) + '" fill="#64748b" font-size="10" text-anchor="end">' + T.toFixed(0) + '</text>'; }
    var counter = r.counter;
    // hot: left→right high→low; cold: counter = right→left low→high (drawn left→right as in→out)
    s += '<polyline points="' + X(0) + ',' + Y(r.hot.tin) + ' ' + X(1) + ',' + Y(r.hot.tout) + '" fill="none" stroke="#ef4444" stroke-width="3"/>';
    if (counter) s += '<polyline points="' + X(0) + ',' + Y(r.cold.tout) + ' ' + X(1) + ',' + Y(r.cold.tin) + '" fill="none" stroke="#3b82f6" stroke-width="3"/>';
    else s += '<polyline points="' + X(0) + ',' + Y(r.cold.tin) + ' ' + X(1) + ',' + Y(r.cold.tout) + '" fill="none" stroke="#3b82f6" stroke-width="3"/>';
    s += '<text x="' + X(0.5) + '" y="' + (H - 20) + '" fill="#94a3b8" font-size="11" text-anchor="middle">Length fraction →</text>';
    s += '<text x="' + (X(0.02)) + '" y="' + (Y(r.hot.tin) - 6) + '" fill="#ef4444" font-size="11">HOT ' + r.hot.tin.toFixed(0) + '→' + r.hot.tout.toFixed(0) + '°C</text>';
    s += '<text x="' + (X(0.55)) + '" y="' + (Y(r.cold.tin) + 16) + '" fill="#3b82f6" font-size="11">COLD ' + r.cold.tin.toFixed(0) + '→' + r.cold.tout.toFixed(0) + '°C</text>';
    // dP bars inset
    s += '<text x="' + (W - pad) + '" y="' + (pad + 4) + '" fill="#22c55e" font-size="11" text-anchor="end">LMTD ' + r.lmtd.toFixed(1) + '°C · U ' + Math.round(r.Ud) + ' W/m²K</text>';
    s += '</svg>';

    // ── U0 assumption / design-criteria bar (assumed band vs achieved U) ──
    var W2 = 720, H2 = 260, p2 = 60, uMax = Math.max(r.uSug.hi, r.Ud, r.Uclean) * 1.15;
    var UX = function (u) { return p2 + u / uMax * (W2 - 2 * p2); };
    var s2 = '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" style="width:100%;background:#0b1220;border-radius:8px;font-family:monospace;margin-top:12px;">';
    s2 += '<text x="' + (W2 / 2) + '" y="24" fill="#f59e0b" font-size="14" font-weight="800" text-anchor="middle">U₀ ASSUMPTION — DESIGN CRITERIA (' + r.uSug.basis + ')</text>';
    // suggested band shaded
    s2 += '<rect x="' + UX(r.uSug.lo) + '" y="60" width="' + (UX(r.uSug.hi) - UX(r.uSug.lo)) + '" height="120" fill="rgba(34,197,94,0.18)" stroke="#22c55e" stroke-dasharray="4 3"/>';
    s2 += '<text x="' + ((UX(r.uSug.lo) + UX(r.uSug.hi)) / 2) + '" y="52" fill="#22c55e" font-size="10" text-anchor="middle">typical ' + Math.round(r.uSug.lo) + '–' + Math.round(r.uSug.hi) + '</text>';
    // bars: clean U and dirty U
    var bar = function (u, y, col, lbl) { return '<rect x="' + p2 + '" y="' + y + '" width="' + (UX(u) - p2) + '" height="34" fill="' + col + '"/><text x="' + (UX(u) + 6) + '" y="' + (y + 22) + '" fill="#e2e8f0" font-size="11">' + lbl + ' ' + Math.round(u) + '</text>'; };
    s2 += bar(r.Uclean, 78, '#38bdf8', 'Clean U');
    s2 += bar(r.Ud, 126, r.uInBand ? '#22c55e' : '#ef4444', 'Dirty U');
    // axis
    s2 += '<line x1="' + p2 + '" y1="196" x2="' + (W2 - p2) + '" y2="196" stroke="#334155"/>';
    for (var gu = 0; gu <= 5; gu++) { var uu = gu / 5 * uMax; s2 += '<line x1="' + UX(uu) + '" y1="60" x2="' + UX(uu) + '" y2="196" stroke="#1e293b"/><text x="' + UX(uu) + '" y="210" fill="#64748b" font-size="9" text-anchor="middle">' + Math.round(uu) + '</text>'; }
    s2 += '<text x="' + (W2 / 2) + '" y="232" fill="#94a3b8" font-size="10" text-anchor="middle">Overall U (W/m²K) — design U ' + (r.uInBand ? 'is within' : 'is OUTSIDE') + ' the industrial band</text>';
    s2 += '</svg>';
    modal('PHE — TEMPERATURE, PERFORMANCE & U₀ DESIGN CRITERIA', s + s2);
  }

  /* ─────────── manufacturing drawing (SVG) ─────────── */
  function drawing() {
    var r = LAST || compute();
    var mm = function (m) { return Math.round(m * 1000); };
    var Lp = mm(r.Lp), Wp = mm(r.Wp), Dp = mm(r.Dp), tmm = (r.t * 1000).toFixed(2), pmm = (r.pitch * 1000).toFixed(1);
    var pmat = val('phe-pmat', 'SS316'), gsk = val('phe-gasket', 'EPDM');
    var hName = r.nozzles.hotName.split(' (')[0], cName = r.nozzles.coldName.split(' (')[0];
    var q_h = r.hot.m / r.hot.rho * 3600, q_c = r.cold.m / r.cold.rho * 3600;   // m³/h
    // frame envelope (mm) — pack + fixed/pressure plates + feet
    var totLen = Math.round(r.frameLen), totWid = Wp + 110, totHt = Lp + 690;
    var svgW = 1180, svgH = 860;
    var esc = function (t) { return String(t == null ? '' : t); };
    var line = function (x1, y1, x2, y2, w, col, dash) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (col || '#0f172a') + '" stroke-width="' + (w || 1) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; };
    var txt = function (x, y, t, sz, col, anc, wt) { return '<text x="' + x + '" y="' + y + '" font-size="' + (sz || 9) + '" fill="' + (col || '#0f172a') + '"' + (anc ? ' text-anchor="' + anc + '"' : '') + (wt ? ' font-weight="' + wt + '"' : '') + ' font-family="Arial">' + esc(t) + '</text>'; };
    var rect = function (x, y, w, h, fill, stroke, sw) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (fill || 'none') + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' : '') + '/>'; };
    // generic bordered table
    function table(x, y, colW, rows, hdr) {
      var out = '', rowH = 16, tw = colW.reduce(function (a, b) { return a + b; }, 0);
      rows.forEach(function (row, ri) {
        var cy = y + ri * rowH, cx = x;
        if (hdr && ri === 0) out += rect(x, cy, tw, rowH, '#e2e8f0');
        row.forEach(function (cell, ci) {
          out += rect(cx, cy, colW[ci], rowH, 'none', '#334155', 0.7);
          out += txt(cx + 4, cy + 11, cell, 8.5, '#0f172a', 'start', (hdr && ri === 0) ? '700' : '400');
          cx += colW[ci];
        });
      });
      return out;
    }
    // dimension line with arrows + label
    function dim(x1, y1, x2, y2, label) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return line(x1, y1, x2, y2, 0.7, '#dc2626') +
        '<polygon points="' + x1 + ',' + y1 + ' ' + (x1 + 5) + ',' + (y1 - 2.5) + ' ' + (x1 + 5) + ',' + (y1 + 2.5) + '" fill="#dc2626"/>' +
        '<polygon points="' + x2 + ',' + y2 + ' ' + (x2 - 5) + ',' + (y2 - 2.5) + ' ' + (x2 - 5) + ',' + (y2 + 2.5) + '" fill="#dc2626"/>' +
        txt(mx, (y1 === y2 ? y1 - 3 : my), label, 8, '#dc2626', 'middle', '700');
    }

    var s = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%;background:#fff;font-family:Arial;">';
    s += rect(0, 0, svgW, svgH, '#fff', '#0f172a', 1.5);
    s += txt(svgW / 2, 24, 'PLATE HEAT EXCHANGER — GENERAL ARRANGEMENT / FABRICATION DRAWING', 15, '#0f172a', 'middle', '800');
    s += txt(svgW / 2, 40, 'ALL DIMENSIONS IN MILLIMETRES · Do not use this drawing for foundation bolting or piping layout', 9, '#64748b', 'middle');

    // ── FRONT ELEVATION (fixed frame + plate pack + movable pressure plate + tie-bolts) ──
    var fx = 60, fy = 90, fh = 300, packW = Math.min(300, Math.max(90, r.N * 4));
    s += txt(fx, fy - 8, 'FRONT ELEVATION', 11, '#0f172a', 'start', '700');
    s += rect(fx, fy, 16, fh, '#cbd5e1', '#0f172a', 1);                          // fixed frame plate
    s += txt(fx + 8, fy + fh + 28, 'FRAME', 8, '#0f172a', 'middle');
    s += rect(fx + 20 + packW, fy, 16, fh, '#cbd5e1', '#0f172a', 1);             // movable pressure plate
    s += txt(fx + 28 + packW, fy + fh + 28, 'PRESSURE', 8, '#0f172a', 'middle');
    for (var i = 0; i < Math.min(80, r.N); i++) { var px = fx + 20 + i * (packW / Math.min(80, r.N)); s += line(px, fy, px, fy + fh, 0.8, i % 2 ? '#ef4444' : '#2563eb'); }
    // carrying bar (top) + guide bar (bottom) + tie bolts
    s += rect(fx - 8, fy - 14, packW + 52, 6, '#64748b', '#0f172a', 0.7);        // carrying bar
    s += rect(fx - 8, fy + fh + 8, packW + 52, 6, '#64748b', '#0f172a', 0.7);    // guide bar
    for (var tb = 0; tb < Math.min(4, Math.ceil(r.nBolts / 2)); tb++) { var by = fy + 30 + tb * (fh - 60) / 3; s += line(fx - 6, by, fx + 42 + packW, by, 2, '#334155'); }
    // support feet
    s += rect(fx - 6, fy + fh + 14, 30, 12, '#334155'); s += rect(fx + packW + 12, fy + fh + 14, 30, 12, '#334155');
    // nozzles S1..S4 on the fixed frame (hot top-left in, hot bottom-left out, cold top/bottom)
    var noz = [['S1', fy + 26, '#dc2626'], ['S3', fy + 56, '#2563eb'], ['S2', fy + fh - 56, '#dc2626'], ['S4', fy + fh - 26, '#2563eb']];
    noz.forEach(function (n) { s += rect(fx - 26, n[1] - 7, 26, 14, '#fff', n[2], 1.4); s += txt(fx - 30, n[1] + 3, n[0], 8, n[2], 'end', '700'); });
    // dimensions
    s += dim(fx, fy + fh + 44, fx + 36 + packW, fy + fh + 44, 'L = ' + totLen);
    s += dim(fx - 44, fy, fx - 44, fy + fh, String(Lp + 40));
    s += dim(fx + 20, fy - 26, fx + 20 + packW, fy - 26, 'PACK ' + Math.round(r.packLen));

    // ── FRAME PLATE (fixed) plan view with 4 ports ──
    var gx = 430, gy = 90, gw = 150, gh = 300;
    s += txt(gx, gy - 8, 'FRAME PLATE (FIXED)', 11, '#0f172a', 'start', '700');
    s += rect(gx, gy, gw, gh, '#f1f5f9', '#0f172a', 1.2);
    var portR = Math.max(12, Math.min(26, Dp / 12));
    var ports = [[gx + 34, gy + 40, 'S1', '#dc2626'], [gx + gw - 34, gy + 40, 'S2', '#dc2626'], [gx + 34, gy + gh - 40, 'S4', '#2563eb'], [gx + gw - 34, gy + gh - 40, 'S3', '#2563eb']];
    ports.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + portR + '" fill="#fff" stroke="' + p[3] + '" stroke-width="1.6"/>'; s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (portR + 5) + '" fill="none" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="2 2"/>'; s += txt(p[0], p[1] + 3, p[2], 8, p[3], 'middle', '700'); });
    // foundation bolt holes (corners)
    [[gx + 12, gy + 12], [gx + gw - 12, gy + 12], [gx + 12, gy + gh - 12], [gx + gw - 12, gy + gh - 12]].forEach(function (h) { s += '<circle cx="' + h[0] + '" cy="' + h[1] + '" r="3" fill="none" stroke="#0f172a"/>'; });
    s += dim(gx, gy + gh + 20, gx + gw, gy + gh + 20, String(Wp));
    s += dim(gx + gw + 20, gy, gx + gw + 20, gy + gh, String(Lp));
    s += txt(gx + gw / 2, gy + gh + 44, '2 × Ø' + Dp + ' ports (top) · 2 × Ø' + Dp + ' ports (bottom) · M' + r.boltDia + ' foundation bolts', 8, '#64748b', 'middle');

    // ── PLATE LAYOUT with chevron + ports ──
    var lx = 640, ly = 90, lw = 130, lh = 300;
    s += txt(lx, ly - 8, 'HEAT-TRANSFER PLATE', 11, '#0f172a', 'start', '700');
    s += '<rect x="' + lx + '" y="' + ly + '" width="' + lw + '" height="' + lh + '" rx="16" fill="#eef2f7" stroke="#0f172a" stroke-width="1.1"/>';
    for (var c = 0; c < 16; c++) { var yy = ly + 34 + c * (lh - 68) / 16; s += '<polyline points="' + lx + ',' + yy + ' ' + (lx + lw / 2) + ',' + (yy + 8) + ' ' + (lx + lw) + ',' + yy + '" fill="none" stroke="#94a3b8" stroke-width="1"/>'; }
    [[lx + 26, ly + 26, '#dc2626'], [lx + lw - 26, ly + 26, '#2563eb'], [lx + 26, ly + lh - 26, '#dc2626'], [lx + lw - 26, ly + lh - 26, '#2563eb']].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="14" fill="#fff" stroke="' + p[2] + '" stroke-width="1.6"/>'; });
    s += dim(lx, ly + lh + 18, lx + lw, ly + lh + 18, String(Wp));
    s += dim(lx + lw + 16, ly, lx + lw + 16, ly + lh, String(Lp));
    s += txt(lx + lw / 2, ly + lh + 42, 'β ' + r.beta + '° chevron · t ' + tmm + ' mm · φ ' + r.phi.toFixed(2), 8, '#64748b', 'middle');

    // ── DESIGN DATA table (SIDE 1 / SIDE 2) ──
    var dx = 810, dy = 82;
    s += txt(dx, dy - 4, 'DESIGN DATA', 11, '#0f172a', 'start', '700');
    s += table(dx, dy, [150, 100, 100], [
      ['', 'SIDE 1 (HOT)', 'SIDE 2 (COLD)'],
      ['Test pressure', r.Phydro.toFixed(1) + ' bar', r.Phydro.toFixed(1) + ' bar'],
      ['Design pressure', r.Pdes.toFixed(1) + ' bar', r.Pdes.toFixed(1) + ' bar'],
      ['Max temperature', r.hot.tin.toFixed(1) + ' °C', r.cold.tout.toFixed(1) + ' °C'],
      ['Min temperature', '0.0 °C', '0.0 °C'],
      ['Gasket', gsk, gsk],
      ['Plate material', pmat, pmat],
      ['Plate thickness', tmm + ' mm', tmm + ' mm'],
      ['Heat load', Math.round(r.Q / 1000) + ' kW', Math.round(r.Q / 1000) + ' kW']
    ], true);

    // ── CONNECTIONS table ──
    var cx0 = 810, cy0 = 248;
    s += txt(cx0, cy0 - 4, 'CONNECTIONS', 11, '#0f172a', 'start', '700');
    s += table(cx0, cy0, [34, 44, 60, 60, 62, 30], [
      ['POS', 'I/O', 'MEDIA', 'TEMP', 'FLOW', 'DN'],
      ['S1', 'IN', hName, r.hot.tin.toFixed(0) + ' °C', q_h.toFixed(1) + ' m³/h', String(Dp)],
      ['S2', 'OUT', hName, r.hot.tout.toFixed(0) + ' °C', q_h.toFixed(1) + ' m³/h', String(Dp)],
      ['S3', 'IN', cName, r.cold.tin.toFixed(0) + ' °C', q_c.toFixed(1) + ' m³/h', String(Dp)],
      ['S4', 'OUT', cName, r.cold.tout.toFixed(0) + ' °C', q_c.toFixed(1) + ' m³/h', String(Dp)]
    ], true);
    // pressure drop row
    s += txt(cx0, cy0 + 5 * 16 + 14, 'ΔP  Side 1 = ' + r.dpH.dp.toFixed(1) + ' kPa   ·   Side 2 = ' + r.dpC.dp.toFixed(1) + ' kPa', 9, '#0f172a', 'start', '700');

    // ── PRESSURE PLATE (movable) SECTION A-A ──
    var px2 = 60, py2 = 470, pw2 = 300, ph2 = 90;
    s += txt(px2, py2 - 8, 'PRESSURE PLATE (MOVABLE) — SECTION A-A', 11, '#0f172a', 'start', '700');
    s += rect(px2, py2, pw2, ph2, '#f8fafc', '#0f172a', 1.1);
    for (var b = 0; b < 6; b++) { var bx = px2 + 26 + b * (pw2 - 52) / 5; s += '<circle cx="' + bx + '" cy="' + (py2 + ph2 / 2) + '" r="5" fill="none" stroke="#0f172a"/>'; }
    s += txt(px2 + pw2 / 2, py2 + ph2 + 16, 'CS painted · ' + Math.max(25, Math.round(r.Pdes * 3 + 20)) + ' mm thk · ' + r.nBolts + ' × M' + r.boltDia + ' tie-bolt holes', 8, '#64748b', 'middle');

    // ── BILL OF MATERIAL (on drawing) ──
    var bx0 = 430, by0 = 470;
    s += txt(bx0, by0 - 8, 'BILL OF MATERIAL', 11, '#0f172a', 'start', '700');
    var bom = bomRows(r, pmat, gsk, Dp);
    s += table(bx0, by0, [26, 200, 130, 46, 90], [['#', 'ITEM', 'MATERIAL', 'QTY', 'STANDARD']].concat(bom.map(function (b2, i2) { return [String(i2 + 1), b2[0], b2[1], String(b2[2]), b2[3]]; })), true);

    // ── TITLE BLOCK ──
    var tbx = 60, tby = svgH - 108, tbw = svgW - 120;
    s += rect(tbx, tby, tbw, 90, 'none', '#0f172a', 1.2);
    s += line(tbx, tby + 30, tbx + tbw, tby + 30, 0.8);
    s += line(tbx, tby + 60, tbx + tbw, tby + 60, 0.8);
    var col = [tbx, tbx + 300, tbx + 640, tbx + 900];
    col.forEach(function (c2) { if (c2 > tbx) s += line(c2, tby, c2, tby + 90, 0.8); });
    var tb = [
      ['CUSTOMER / REF.', val('phe-client', '—'), 'TOTAL LENGTH', totLen + ' mm', 'DESIGN CODE', val('phe-code', 'ASME VIII'), 'DATE', val('phe-date', '')],
      ['COMPANY', val('phe-project', '—'), 'TOTAL WIDTH', totWid + ' mm', 'HEAT LOAD', Math.round(r.Q / 1000) + ' kW', 'REV', val('phe-rev', '0')],
      ['TAG / SERVICE', val('phe-tag', '') + ' / ' + val('phe-service', ''), 'TOTAL HEIGHT', totHt + ' mm', 'WEIGHT (WET)', Math.round(r.wOper) + ' kg', 'ENGR', val('phe-engineer', '')]
    ];
    tb.forEach(function (row, ri) {
      var yy = tby + 20 + ri * 30;
      s += txt(col[0] + 6, yy, row[0], 7.5, '#64748b', 'start', '700') + txt(col[0] + 6, yy + 10, row[1], 9, '#0f172a');
      s += txt(col[1] + 6, yy, row[2], 7.5, '#64748b', 'start', '700') + txt(col[1] + 6, yy + 10, row[3], 9, '#0f172a');
      s += txt(col[2] + 6, yy, row[4], 7.5, '#64748b', 'start', '700') + txt(col[2] + 6, yy + 10, row[5], 9, '#0f172a');
      s += txt(col[3] + 6, yy, row[6], 7.5, '#64748b', 'start', '700') + txt(col[3] + 6, yy + 10, row[7], 9, '#0f172a');
    });
    s += txt(svgW / 2, svgH - 6, 'BHARAT FLOWSIZE — PLATE HEAT EXCHANGER · ANOVIX TECHNOLOGIES · Model ' + val('phe-tag', 'PHE') + ' · ' + r.N + ' plates · ' + pmat, 8, '#94a3b8', 'middle');
    s += '</svg>';

    // ── full BOM / list of materials as an HTML table under the drawing ──
    var bomHtml = '<div style="margin-top:14px;"><div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin-bottom:6px;">BILL OF MATERIAL — LIST OF MATERIALS</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Arial;"><tr style="background:#f1f5f9;">'
      + ['#', 'Item / Component', 'Material', 'Qty', 'Unit Wt (kg)', 'Standard / Spec', 'Remarks'].map(function (h) { return '<th style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;">' + h + '</th>'; }).join('') + '</tr>';
    bomRows(r, pmat, gsk, Dp).forEach(function (b2, i2) {
      bomHtml += '<tr>' + [i2 + 1, b2[0], b2[1], b2[2], b2[4], b2[3], b2[5]].map(function (x) { return '<td style="padding:4px 6px;border:1px solid #e2e8f0;">' + x + '</td>'; }).join('') + '</tr>';
    });
    bomHtml += '</table><div style="font-size:10px;color:#64748b;margin-top:6px;">Quantities and weights are computed from the current design inputs (N = ' + r.N + ' plates, ' + Math.round(r.Aprov) + ' m² area). Confirm against the plate maker\'s rating before fabrication.</div></div>';

    modal('PHE — FABRICATION / GA DRAWING + BOM', s + bomHtml, true);
  }

  // Bill of material rows: [item, material, qty, standard, unitWt, remarks]
  function bomRows(r, pmat, gsk, Dp) {
    var plateWt = (r.Ap * r.t * (r.mat ? r.mat.rho : 8000)).toFixed(2);
    var nBolt = r.nBolts;
    return [
      ['Fixed frame plate', 'CS painted (S275)', 1, 'EN 13445', Math.round(r.Wp * r.Lp * 0.06 * 7850), 'Carbon steel, epoxy coated'],
      ['Movable pressure plate', 'CS painted (S275)', 1, 'EN 13445', Math.round(r.Wp * r.Lp * 0.05 * 7850), 'Drilled for tie-bolts'],
      ['Heat-transfer plate', pmat, r.N, 'AHRI / maker', plateWt, 'β ' + r.beta + '° chevron, t ' + (r.t * 1000).toFixed(2) + ' mm'],
      ['Gasket', gsk, r.N - 1, 'Clip-on', 0.08, 'Field-replaceable'],
      ['Tie-bolt', 'A193 Gr.B7', nBolt, 'M' + r.boltDia, +(r.boltDia * r.boltDia * 0.0062 * r.frameLen / 1000).toFixed(2), 'With thrust washer'],
      ['Hex nut', 'A194 Gr.2H', nBolt * 2, 'M' + r.boltDia, 0.05, 'Heavy hex'],
      ['Carrying bar', 'CS galvanised', 1, '—', Math.round(r.frameLen * 0.9), 'Top guide rail'],
      ['Guide bar', 'CS galvanised', 1, '—', Math.round(r.frameLen * 0.7), 'Bottom rail'],
      ['Support column', 'CS painted', 1, '—', Math.round(r.Lp * 8), 'End support'],
      ['Nozzle + flange', pmat, 4, 'ASME B16.5 · DN' + Dp, Math.round(Dp * 0.12), 'RF flanged, ' + Dp + ' mm bore'],
      ['Foot support', 'CS painted', 2, '—', 6, 'Bolt-down feet'],
      ['Name plate', 'SS304', 1, 'PED', 0.2, 'Laser etched']
    ];
  }

  /* ─────────── engineering report ─────────── */
  function report() {
    var r = LAST || compute();
    var f0 = function (x) { return isFinite(x) ? Math.round(x).toLocaleString() : '—'; };
    var f1 = function (x) { return isFinite(x) ? x.toFixed(1) : '—'; };
    function T(rows) { return '<table style="width:100%;border-collapse:collapse;font-size:11px;margin:6px 0;">' + rows.map(function (r2) { return '<tr><td style="padding:3px 8px;border:1px solid #e2e8f0;color:#475569;">' + r2[0] + '</td><td style="padding:3px 8px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;">' + r2[1] + '</td></tr>'; }).join('') + '</table>'; }
    function sec(t) { return '<h3 style="color:#ea580c;font-size:13px;margin:16px 0 4px;border-bottom:2px solid #ea580c;padding-bottom:3px;">' + t + '</h3>'; }
    var b = '<div style="font-family:Arial;color:#0f172a;">';
    b += '<div style="text-align:center;margin-bottom:14px;"><div style="font-size:18px;font-weight:800;color:#ea580c;">BHARAT FLOWSIZE — PLATE HEAT EXCHANGER DESIGN REPORT</div><div style="font-size:10px;color:#64748b;">ANOVIX TECHNOLOGIES | DIGITAL INDIA INITIATIVE</div></div>';
    b += sec('1 · DESIGN DATA SHEET');
    b += T([['Project', val('phe-project', '')], ['Client', val('phe-client', '')], ['Tag', val('phe-tag', '')], ['Service', val('phe-service', '')], ['Design code', val('phe-code', '')], ['Engineer', val('phe-engineer', '')], ['Date / Rev', val('phe-date', '') + ' / ' + val('phe-rev', '0')]]);
    b += sec('2–3 · FLUIDS & PROCESS');
    b += T([['Hot fluid', val('phe-hf-name', '') + ' — ' + f1(r.hot.tin) + '→' + f1(r.hot.tout) + ' °C, ' + f1(r.hot.m) + ' kg/s'],
    ['Cold fluid', val('phe-cf-name', '') + ' — ' + f1(r.cold.tin) + '→' + f1(r.cold.tout) + ' °C, ' + f1(r.cold.m) + ' kg/s'],
    ['Flow arrangement', r.flowCmp.best + ' (auto — counter ΔTm ' + f1(r.flowCmp.counterDTm) + ' °C vs co-current ' + f1(r.flowCmp.coDTm) + ' °C)'],
    ['Plate material', r.matName + ' (k ' + r.mat.k + ' W/m·K, S ' + r.mat.S + ' MPa)']]);
    b += sec('4 · THERMAL RESULTS');
    b += T([['Heat duty Q', f0(r.Q / 1000) + ' kW'], ['Energy balance Qh/Qc', r.Qbal.toFixed(3)], ['LMTD × F', f1(r.lmtd) + ' × ' + r.F.toFixed(2) + ' = ' + f1(r.dTm) + ' °C'], ['Effectiveness ε / NTU', (r.eff * 100).toFixed(1) + ' % / ' + r.NTU.toFixed(2)], ['Clean / Dirty U', f0(r.Uclean) + ' / ' + f0(r.Ud) + ' W/m²K'], ['Film h hot / cold', f0(r.H.h) + ' / ' + f0(r.C.h) + ' W/m²K'], ['Re hot / cold', f0(r.H.Re) + ' / ' + f0(r.C.Re)]]);
    b += sec('8 · PLATE & PACK');
    b += T([['Plate size', f0(r.Lp * 1000) + ' × ' + f0(r.Wp * 1000) + ' × ' + (r.t * 1000).toFixed(1) + ' mm'], ['Chevron / φ / Dh', r.beta + '° / ' + r.phi.toFixed(2) + ' / ' + (r.Dh * 1000).toFixed(2) + ' mm'], ['Material / gasket', val('phe-pmat', '') + ' / ' + val('phe-gasket', '')], ['Total plates', r.N + ' (' + (r.N - 1) + ' channels, ' + r.npass + ' pass)'], ['Area req / prov', f1(r.Areq) + ' / ' + f1(r.Aprov) + ' m² (' + f1(r.overSurf) + ' % over)']]);
    b += sec('15 · PRESSURE DROP');
    b += T([['ΔP hot', f1(r.dpH.dp) + ' kPa (allow ' + f1(r.dpHa) + ')'], ['ΔP cold', f1(r.dpC.dp) + ' kPa (allow ' + f1(r.dpCa) + ')'], ['Port velocity hot / cold', r.dpH.vport.toFixed(2) + ' / ' + r.dpC.vport.toFixed(2) + ' m/s']]);
    b += sec('12 · MECHANICAL');
    b += T([['Design / hydrotest P', r.Pdes.toFixed(1) + ' / ' + r.Phydro.toFixed(1) + ' barg'], ['Frame / pack length', f0(r.frameLen) + ' / ' + f0(r.packLen) + ' mm'], ['Tie-bolts', r.nBolts + ' × M' + r.boltDia], ['Weight empty / operating', f0(r.wEmpty) + ' / ' + f0(r.wOper) + ' kg']]);
    b += sec('18 · BILL OF MATERIAL (summary)');
    b += '<table style="width:100%;border-collapse:collapse;font-size:10px;"><tr style="background:#f1f5f9;">' + ['Item', 'Material', 'Qty', 'Std'].map(function (x) { return '<th style="padding:4px;border:1px solid #e2e8f0;text-align:left;">' + x + '</th>'; }).join('') + '</tr>';
    [['Heat transfer plate', val('phe-pmat', 'SS316'), r.N, 'AHRI/maker'], ['Gasket', val('phe-gasket', 'EPDM'), r.N - 1, 'clip-on'], ['Fixed frame plate', 'CS painted', 1, 'ASME VIII'], ['Pressure plate', 'CS painted', 1, 'ASME VIII'], ['Tie-bolt', 'A193 B7', r.nBolts, 'M' + r.boltDia], ['Carrying/guide bar', 'CS galv.', 2, '—'], ['Nozzle + flange', val('phe-pmat', 'SS316'), 4, 'ASME B16.5']].forEach(function (row) { b += '<tr>' + row.map(function (x) { return '<td style="padding:4px;border:1px solid #e2e8f0;">' + x + '</td>'; }).join('') + '</tr>'; });
    b += '</table>';
    b += sec('23 · ASSUMPTIONS & REFERENCES');
    b += '<div style="font-size:10px;color:#475569;line-height:1.6;">Counter-current F≈0.99; chevron Nu = C·Re<sup>n</sup>·Pr<sup>1/3</sup> (Martin / Wanniarachchi / Muley-Manglik, C,n by β); Dh = 2b/φ; U from series film + wall + fouling; ε-NTU per plate counter-flow; ΔP = channel (Fanning) + port (1.4 velocity heads); hydrotest 1.43× design (ASME VIII Div 1). Codes: ASME Sec VIII, EN 13445, API 662, AHRI. Property data from user inputs (auto-filled water defaults). This is a design-screening report — confirm against the maker\'s rating (Alfa Laval / GEA / Kelvion / SWEP) before purchase.</div>';
    b += '</div>';
    modal('PHE — ENGINEERING DESIGN REPORT', b, true);
  }

  /* ─────────── modal helper ─────────── */
  function modal(title, inner, pdf) {
    var old = $('phe-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'phe-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(2,6,18,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;max-width:960px;width:100%;max-height:92vh;display:flex;flex-direction:column;">'
      + '<div style="display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #334155;">'
      + '<span style="font-family:monospace;font-size:13px;font-weight:800;color:#ff7538;flex:1;">' + title + '</span>'
      + (pdf ? '<button id="phe-pdf" style="margin-right:8px;background:#16a34a;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">⬇ PDF</button>' : '')
      + '<button id="phe-mclose" style="background:#ef4444;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">✕ CLOSE</button></div>'
      + '<div id="phe-mbody" style="overflow:auto;padding:18px;background:#fff;margin:0;border-radius:0 0 10px 10px;">' + inner + '</div></div>';
    document.body.appendChild(m);
    $('phe-mclose').onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    var pb = $('phe-pdf');
    if (pb) pb.onclick = function () {
      if (typeof html2pdf === 'undefined') { window.print(); return; }
      html2pdf().set({ margin: 8, filename: (title.split('—')[0].trim() || 'PHE') + '.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from($('phe-mbody')).save();
    };
  }

  /* ─────────── boot ─────────── */
  function boot() { inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
  // re-attempt in case the HX tab is built lazily
  var tries = 0; var iv = setInterval(function () { if (built || tries++ > 20) { clearInterval(iv); return; } inject(); }, 500);

  window.AROPHE = { calc: calc, compute: compute, report: report, drawing: drawing, graph: graph };
})();

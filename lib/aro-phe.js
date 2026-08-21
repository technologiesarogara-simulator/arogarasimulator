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
  var built = false, three = null, pheView = 'assembly';

  function $(id) { return document.getElementById(id); }
  // active unit system + converter (shared with the main app)
  function activeSys() { return window.activeUnitSystem || 'SI'; }
  function toSIval(v, type) {
    var C = window.UNIT_CONVERSIONS;
    if (type && C && C[type]) { try { return C[type].toSI(v, activeSys()); } catch (e) {} }
    return v;
  }
  function fromSIval(v, type) {
    var C = window.UNIT_CONVERSIONS;
    if (type && C && C[type]) { try { return C[type].fromSI(v, activeSys()); } catch (e) {} }
    return v;
  }
  function unitSym(type, fallback) {
    var C = window.UNIT_CONVERSIONS;
    if (type && C && C[type]) { try { return C[type].symbol(activeSys()); } catch (e) {} }
    return fallback || '';
  }
  // num() is UNIT-AWARE: it reads the field's displayed value and converts it
  // back to SI (using the element's data-unit-type) so compute() always works
  // in SI regardless of the selected unit system.
  function num(id, d) {
    var e = $(id); if (!e) return d;
    var v = parseFloat(e.value); if (!isFinite(v)) return d;
    var t = e.getAttribute && e.getAttribute('data-unit-type');
    return t ? toSIval(v, t) : v;
  }
  // write an SI value into a field, converting to the field's display unit
  function setSI(id, siVal) {
    var e = $(id); if (!e) return;
    var t = e.getAttribute && e.getAttribute('data-unit-type');
    var v = t ? fromSIval(siVal, t) : siVal;
    e.value = (typeof v === 'number' && isFinite(v)) ? +(v.toFixed(4)) : v;
  }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }
  // Display-side counterpart to num()/setSI() — every result line, the report,
  // the drawing and the graphs used to be built from a raw SI number with the
  // unit spelled directly into the string, so switching units relabelled the
  // inputs but never the outputs. U() converts an SI figure to the active
  // system and appends that system's symbol.
  function U(si, type, dp) {
    if (!isFinite(si)) return '—';
    var d = dp == null ? 2 : dp;
    return fromSIval(si, type).toFixed(d) + ' ' + unitSym(type);
  }
  // Pressure carries a "g" (gauge) suffix in this module's convention — but
  // only when the resolved symbol is literally "bar"; psi and kg/cm² never
  // take it (they are never ambiguous about gauge vs absolute the way a bare
  // "bar" figure is on an Excel-style datasheet).
  function UG(si, dp) {
    if (!isFinite(si)) return '—';
    var sym = unitSym('pressure');
    return fromSIval(si, 'pressure').toFixed(dp == null ? 1 : dp) + ' ' + sym + (sym === 'bar' ? 'g' : '');
  }

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
      /* This is the unified switcher for all three sub-tabs — the older
         two-button click handler in app.js was wired before this button
         existed, so it never restores the footer ticker for Plate HEx (and
         its own binary dphe/sthe guess got the other two wrong once a
         third tab existed). Driving the restore from here, for all three,
         is what actually keeps the footer honest about which engine the
         panel on screen belongs to. */
      try {
        if (window.restoreEngineTicker) {
          window.restoreEngineTicker(which === 'dphe-sub' ? 'dphe' : which === 'phe-sub' ? 'phe' : 'sthe');
        }
      } catch (e) {}
      if (which === 'phe-sub') { setTimeout(function () { init3D(); calc(); pheResize(); }, 40); setTimeout(pheResize, 250); }
    }
    buttons.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-subtab')); }); });

    built = true;
    wire();
    fillDefaults();
  }

  /* NPS → OD, mm (ASME B36.10M) — same reference table the industrial 3D
     layer uses for its own nozzle labels (lib/aro-industrial3d.js), kept
     here too since that file's copy sits in a separate closure. Used only
     to LABEL the port size already set by the user (phe-dp), nearest
     table entry, not to select one. */
  var NPS_OD_LOCAL = {
    0.5: 21.3, 0.75: 26.7, 1: 33.4, 1.25: 42.2, 1.5: 48.3, 2: 60.3, 2.5: 73.0,
    3: 88.9, 3.5: 101.6, 4: 114.3, 5: 141.3, 6: 168.3, 8: 219.1, 10: 273.1,
    12: 323.9, 14: 355.6, 16: 406.4, 18: 457.2, 20: 508.0, 22: 559.0,
    24: 610.0, 26: 660.0, 30: 762.0, 36: 914.0
  };
  function npsOfOdLocal(odM) {
    if (!isFinite(odM) || odM <= 0) return null;
    var odMm = odM * 1000, best = null, bestDiff = Infinity;
    for (var k in NPS_OD_LOCAL) {
      var diff = Math.abs(NPS_OD_LOCAL[k] - odMm);
      if (diff < bestDiff) { bestDiff = diff; best = k; }
    }
    return best;
  }

  /* ─────────── panel markup ─────────── */
  // a unit <span> that tracks the active unit system when `utype` is given
  function unitSpan(unit, utype, extra) {
    if (!unit && !utype) return '';
    var sym = utype ? unitSym(utype, unit) : unit;
    return '<span class="unit"' + (utype ? ' data-unit-type="' + utype + '"' : '') + ' style="font-size:9px;color:#64748b;min-width:36px;text-transform:none;' + (extra || '') + '">' + sym + '</span>';
  }
  function fld(label, id, unit, v, step, utype) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '"' + (utype ? ' data-unit-type="' + utype + '"' : '') + ' type="number" step="' + (step || 'any') + '" value="' + (v === undefined ? '' : v) + '" '
      + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + unitSpan(unit, utype) + '</span></label>';
  }
  // number field with an editable list of industrial-standard values.
  // Suggestions render in a custom DARK dropdown (native datalist popups are
  // OS-styled white and cannot be themed) — see wireCombo().
  function fldStd(label, id, unit, v, step, std, utype) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + ' <span style="color:#38bdf8;font-size:8px;">▾ standard</span>'
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '"' + (utype ? ' data-unit-type="' + utype + '"' : '') + ' autocomplete="off" data-suggest="' + std.join('|') + '" type="number" step="' + (step || 'any') + '" value="' + (v === undefined ? '' : v) + '" '
      + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + unitSpan(unit, utype) + '</span></label>';
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
  // collapsible industry thumb-rule reference for the plate geometry inputs
  function geoThumbRules() {
    var rows = [
      ['Plate length Lp', '500–2500 mm', '1000 / 1500 / 2000', 'standard lengths'],
      ['Plate width Wp', '200–1000 mm', '0.35–0.45 × Lp', 'depends on L/D'],
      ['Port dia Dp', '50–200 mm', '0.20–0.35 × Wp', 'standard nozzle'],
      ['Plate thick. t', '0.4–1.0 mm', '0.5–0.7 mm', 'SS304 / SS316'],
      ['Corrug. depth b', '2–5 mm', '≈ 5 × t (2.5–3)', 'peak to valley'],
      ['Chevron angle β', '30–65°', '30° H.T. / 60° L.ΔP', 'lower β → more heat'],
      ['Enlargement φ', '1.15–1.30', '1.15–1.25', 'developed / projected'],
      ['Plate pitch p', '2–5 mm', '≈ b + 0.5', 'peak-to-peak'],
      ['No. of plates N', '10–200+', 'as per duty', 'even for 2-pass'],
      ['Reserve area', '10–30 %', '15–20 %', 'fouling / margin']
    ];
    var tbl = '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:8.5px;margin-top:5px;">'
      + '<tr style="color:#38bdf8;text-align:left;"><th style="padding:2px 4px;">Parameter</th><th style="padding:2px 4px;">Range</th><th style="padding:2px 4px;">Preferred</th><th style="padding:2px 4px;">Remark</th></tr>'
      + rows.map(function (r) { return '<tr style="border-top:1px solid rgba(148,163,184,0.18);color:#cbd5e1;"><td style="padding:2px 4px;">' + r[0] + '</td><td style="padding:2px 4px;">' + r[1] + '</td><td style="padding:2px 4px;color:#22c55e;">' + r[2] + '</td><td style="padding:2px 4px;color:#94a3b8;">' + r[3] + '</td></tr>'; }).join('')
      + '</table>';
    return '<details style="margin-top:6px;border:1px solid var(--border-muted);border-radius:5px;background:rgba(2,6,18,0.35);">'
      + '<summary style="cursor:pointer;font-family:var(--font-mono);font-size:9px;font-weight:700;color:var(--color-saffron);padding:6px 8px;letter-spacing:0.04em;">📐 GEOMETRY THUMB RULES (industry practice) — tap to expand</summary>'
      + '<div style="padding:2px 8px 8px;">' + tbl
      + '<div style="font-family:var(--font-mono);font-size:8px;color:#94a3b8;line-height:1.5;margin-top:5px;">All fields above are fully editable / customisable — type any value or pick a standard from the ▾ dropdown. Quick relations: A = Q / (U·LMTD) · N = A / (Ap·φ) · Ap = (Lp−2·bₗ)(Wp−2·bₗ) − Aport · counter-current preferred · keep channel velocity 0.3–1.2 m/s and ΔP 20–100 kPa. Always verify against the maker\'s datasheet & code (ASME / PED).</div></div></details>';
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
      + '<button id="phe-reset" class="phe-hbtn phe-hbtn-red" title="Reset to defaults"><span style="font-size:13px;">↻</span><span>RESET</span></button></div>'
      + '<div class="panel-body">'
      + '<div class="digital-badge">Atmanirbhar Bharat Digitalization</div>';

    /* Section 00, one accordion above the data sheet — same document classes
       and depth as the pump / DPHE / STHE user manuals, so the heat-exchanger
       suite reads as one manual set. */
    h += '<details class="pump-accordion" id="phe-manual">'
      + '<summary>00 &middot; USER MANUAL &mdash; HOW TO SIZE A PLATE HEAT EXCHANGER <span class="chevron">&#9660;</span></summary>'
      + '<div class="acc-content" style="display:block;"><div class="aro-doc">'

      + '<p class="aro-doc-lead">Work down the sections in order &mdash; each input is validated as you enter it, and the engineering results are produced when you press RUN CALCULATION, so you '
      + 'see results before you finish. A gasketed plate exchanger packs far more area into far less volume than a '
      + 'shell &amp; tube for a clean, moderate-pressure duty, and the plate pack can be opened and re-plated as the '
      + 'duty changes &mdash; this module sizes the pack, checks it against an industrial over-surface band, and can '
      + 'suggest and apply a geometry correction in one click.</p>'

      + '<div class="aro-doc-callout aro-doc-callout--warn"><b>Starting a new exchanger? Press RESET first.</b> The '
      + 'panel keeps the previous design\'s inputs &mdash; fluids, geometry, plate/gasket choice, results and 3D view '
      + '&mdash; sitting in every field until you clear them. RESET returns every field, chart and report to its '
      + 'untouched starting state before you enter a single value. <b>UNDO</b>/<b>REDO</b> step back and forward '
      + 'through changes one at a time, if you only need to back out the last edit rather than the whole design.</div>'

      + '<div class="aro-doc-callout aro-doc-callout--info"><b>Set your units first.</b> The <b>unit system '
      + 'selector</b> in the top bar drives this exchanger and the whole suite together &mdash; SI (m, bar, kg/hr), '
      + 'US customary (ft, psi, GPM, &deg;F) or mixed metric (cm, kg/cm&sup2;, L/min, g/s). You may switch at any '
      + 'time, including after a run: every input, output, chart, 3D model and report converts together. Switching '
      + 'units never changes the answer, only how it is written &mdash; the calculation itself always runs in SI '
      + 'underneath.</div>'

      + '<h4 class="aro-doc-h">Step 1 &mdash; 1 &middot; Design data sheet</h4>'
      + '<p>Project, client, tag number, service description, engineer, date and revision. None of it affects the '
      + 'calculation; all of it is printed on the report and the drawing, so fill it in if the output is going into '
      + 'a document package.</p>'

      + '<h4 class="aro-doc-h">Step 2 &mdash; 2 &middot; Fluid allocation</h4>'
      + '<ol class="aro-doc-ol">'
      + '<li><b>Hot Fluid / Cold Fluid (library)</b> &mdash; pick from the list to auto-fill density, viscosity, '
      + 'specific heat and thermal conductivity for both streams below.</li>'
      + '<li><b>Hot Phase / Cold Phase</b> &mdash; Liquid, Gas, Condensing or Evaporating, or Two-Phase. These flag '
      + 'which correlation basis applies and are carried through to the report.</li>'
      + '</ol>'
      + '<p class="aro-doc-note">Flow arrangement is not chosen here &mdash; counter-current versus co-current is '
      + 'auto-compared and the better one is recommended with the results.</p>'

      + '<h4 class="aro-doc-h">Step 3 &mdash; Smart Input</h4>'
      + '<p>Pick the <b>one</b> quantity the software should calculate from the energy balance '
      + '<code>Q = m&middot;Cp&middot;&Delta;T</code> &mdash; Cold Mass Flow, Hot Mass Flow, Hot Outlet Temp or Cold '
      + 'Outlet Temp &mdash; or leave it on <i>&mdash; all user inputs &mdash;</i> if you already know every process '
      + 'value. The selected field locks and highlights green once you run the calculation.</p>'

      + '<h4 class="aro-doc-h">Step 4 &mdash; 3 &middot; Process inputs</h4>'
      + '<p>Mass flow, inlet/outlet temperature, operating pressure (0 = auto), specific heat, thermal conductivity, '
      + 'density, viscosity (and viscosity at the wall, for the wall-correction term), specific gravity, fouling '
      + 'resistance and allowable pressure drop &mdash; entered per side, hot and cold in their own column. Whichever '
      + 'field Smart Input is calculating is skipped; every other field here is a required input.</p>'

      + '<h4 class="aro-doc-h">Step 5 &mdash; 5&ndash;7 &middot; Plate / material / gasket</h4>'
      + '<ol class="aro-doc-ol">'
      + '<li><b>Plate Type</b> &mdash; Chevron (Herringbone) is the general-purpose default; Wide-Gap suits fibrous '
      + 'or particulate duties, Double-Wall isolates the two fluids with a second plate for cross-contamination risk, '
      + 'Free-Flow widens the channel for viscous or slurried fluids, and Semi-/Fully-Welded or Brazed remove the '
      + 'gasket for higher temperature and pressure at the cost of serviceability.</li>'
      + '<li><b>Plate Material</b> and <b>Gasket</b> &mdash; sets the wall conductivity, corrosion allowance and the '
      + 'gasket&rsquo;s maximum temperature; the note beneath the selects states the numbers actually in force.</li>'
      + '</ol>'

      + '<h4 class="aro-doc-h">Step 6 &mdash; 8 &middot; Plate geometry</h4>'
      + '<p><b>Plate Length</b>, <b>Plate Width</b>, <b>Plate Thickness</b>, <b>Corrugation Depth</b>, <b>Chevron '
      + 'Angle &beta;</b>, <b>Port Diameter</b>, <b>Area Enlargement Factor &phi;</b> and <b>Plate Pitch</b> define '
      + 'one plate and the channel it forms with its neighbour. Each carries a dropdown of common manufacturer sizes '
      + 'next to the editable field &mdash; pick one or type a custom value. The <b>industrial-standard band</b> '
      + 'shown beneath the fields is guidance, not a hard limit; press <b>&#9889; SUGGEST GEOMETRY FROM DUTY</b> to '
      + 'have the software propose a starting plate size from the heat duty and flows already entered, which you can '
      + 'then fine-tune by hand.</p>'

      + '<h4 class="aro-doc-h">Step 7 &mdash; 10 &middot; Channel / pass design</h4>'
      + '<p><b>Pass Arrangement</b> &mdash; single-pass (1/1) gives the lowest pressure drop and the easiest '
      + 'cleaning; a multi-pass arrangement (for example 2/1) raises velocity and U for a close temperature approach '
      + 'at the cost of pressure drop. Type a custom arrangement (for example <i>5 Pass / 5 Pass</i>) if your duty '
      + 'needs more passes than the list offers. <b>Design Margin</b> is the area allowance added on top of the '
      + 'bare calculated requirement.</p>'

      + '<h4 class="aro-doc-h">Step 8 &mdash; Run</h4>'
      + '<p>Press <b>RUN PHE CALCULATION</b>. The 3D plate-pack, the results panel, the design optimiser and every '
      + 'chart populate together. A <b>WHOLE ASSEMBLY / INTERNAL FLOW</b> toggle above the 3D view switches between '
      + 'the assembled plate pack and a cutaway showing the hot/cold flow paths through alternating channels.</p>'

      + '<h4 class="aro-doc-h">Reading the results</h4>'
      + '<ul class="aro-doc-ul">'
      + '<li><b>Results panel</b> &mdash; heat duty, LMTD, both film coefficients, overall U (clean and dirty), plate '
      + 'count, area provided against area required, both-side pressure drop and velocity, and the over-surface '
      + 'percentage the design landed on.</li>'
      + '<li><b>Design Optimiser</b> &mdash; compares the over-surface percentage against the 10&ndash;30% '
      + 'industrial band. Inside the band it confirms the design is optimised; outside it, each suggestion (fewer/'
      + 'more plates, a different pass arrangement, a wider or narrower chevron angle) is listed with its reasoning '
      + 'and the over-surface it would land on, each with its own <b>APPLY</b> button, or press '
      + '<b>&#9881; AUTO-OPTIMISE &mdash; APPLY ALL</b> to let the software apply every correction toward the '
      + 'industrial norm in one step.</li>'
      + '<li><b>Charts</b> &mdash; the temperature profile along the plate pack, both film/overall coefficients '
      + 'against the operating point, and a pressure-drop sweep across a flow range, so a marginal &Delta;P shows '
      + 'how much headroom (or how little) the design actually has.</li>'
      + '</ul>'

      + '<h4 class="aro-doc-h">Report, drawing &amp; graph</h4>'
      + '<p>Under <b>FINAL DELIVERABLES</b>: <b>REPORT</b> produces the technical datasheet in whichever unit system '
      + 'is active; <b>DRAWING / MANUFACTURING</b> produces the plate/frame envelope, port and nozzle schedule and '
      + 'bill of materials; <b>GRAPH</b> exports the performance charts. The manufacturing drawing prints its plate '
      + 'and frame envelope, DN nozzle call-outs and M-series bolt sizes in millimetres regardless of the active unit '
      + 'system, the same way a real fabrication drawing quotes standard hardware in its catalogue size &mdash; every '
      + 'process value elsewhere in the report converts with the rest of the datasheet.</p>'

      + '</div></div></details>';

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
    h += twoCol(fld('Mass flow', 'phe-hf-m', 'kg/s', '', undefined, 'mass-flow-s'), fld('Mass flow', 'phe-cf-m', 'kg/s', '', undefined, 'mass-flow-s'));
    h += twoCol(fld('Temperature IN', 'phe-hf-tin', '°C', '', undefined, 'temperature'), fld('Temperature IN', 'phe-cf-tin', '°C', '', undefined, 'temperature'));
    h += twoCol(fld('Temperature OUT', 'phe-hf-tout', '°C', '', undefined, 'temperature'), fld('Temperature OUT', 'phe-cf-tout', '°C', '', undefined, 'temperature'));
    h += twoCol(fld('Op. Pressure (0=auto)', 'phe-hf-pdes', 'barg', '', undefined, 'pressure'), fld('Op. Pressure (0=auto)', 'phe-cf-pdes', 'barg', '', undefined, 'pressure'));
    h += twoCol(fld('Specific heat Cp', 'phe-hf-cp', 'kJ/kg·°C', 4.198, '0.001', 'cp'), fld('Specific heat Cp', 'phe-cf-cp', 'kJ/kg·°C', 4.180, '0.001', 'cp'));
    h += twoCol(fld('Thermal cond. k', 'phe-hf-k', 'W/m·K', 0.668, '0.001', 'thermal-cond'), fld('Thermal cond. k', 'phe-cf-k', 'W/m·K', 0.628, '0.001', 'thermal-cond'));
    h += twoCol(fld('Density ρ', 'phe-hf-rho', 'kg/m³', 965, undefined, 'density'), fld('Density ρ', 'phe-cf-rho', 'kg/m³', 992, undefined, 'density'));
    h += twoCol(fld('Viscosity μ', 'phe-hf-mu', 'Pa·s', 0.00032, '0.00001'), fld('Viscosity μ', 'phe-cf-mu', 'Pa·s', 0.00065, '0.00001'));
    h += twoCol(fld('Visc. at wall μw', 'phe-hf-muw', 'Pa·s', 0.00032, '0.00001'), fld('Visc. at wall μw', 'phe-cf-muw', 'Pa·s', 0.00065, '0.00001'));
    h += twoCol(fld('Specific gravity', 'phe-hf-sg', '–', 0.972, '0.001'), fld('Specific gravity', 'phe-cf-sg', '–', 0.995, '0.001'));
    h += twoCol(fld('Fouling Rf', 'phe-hf-rf', 'm²K/W', 0.000018, '0.000001', 'fouling'), fld('Fouling Rf', 'phe-cf-rf', 'm²K/W', 0.000018, '0.000001', 'fouling'));
    h += twoCol(fld('Allow ΔP', 'phe-hf-dpa', 'kPa', 50, undefined, 'press-drop-kpa'), fld('Allow ΔP', 'phe-cf-dpa', 'kPa', 50, undefined, 'press-drop-kpa'));

    h += hdr('5–7 · PLATE / MATERIAL / GASKET');
    h += sel('PLATE TYPE', 'phe-ptype', ['Chevron (Herringbone)', 'Wide-Gap', 'Double-Wall', 'Free-Flow', 'Semi-Welded', 'Fully-Welded', 'Brazed', 'Gasketed'], 'Chevron (Herringbone)');
    h += twoCol(sel('PLATE MATERIAL', 'phe-pmat', Object.keys(MATERIALS), 'SS316'),
                sel('GASKET', 'phe-gasket', Object.keys(GASKET_TMAX), 'EPDM'));
    h += '<div id="phe-matinfo" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-top:2px;"></div>';

    h += hdr('8 · PLATE GEOMETRY');
    h += twoCol(fldStd('Plate length Lp', 'phe-L', 'mm', 1200, '10', [400, 600, 800, 1000, 1200, 1500, 1800, 2000, 2500], 'length-mm'),
                fldStd('Plate width Wp', 'phe-W', 'mm', 500, '10', [100, 150, 200, 300, 400, 500, 650, 800, 1000], 'length-mm'));
    h += twoCol(fldStd('Plate thick. t', 'phe-t', 'mm', 0.5, '0.05', [0.4, 0.5, 0.6, 0.7, 0.8, 1.0], 'length-mm'),
                fldStd('Corrug. depth b', 'phe-b', 'mm', 2.5, '0.1', [2.0, 2.5, 3.0, 3.5, 4.0], 'length-mm'));
    h += twoCol(fldStd('Chevron angle β', 'phe-beta', '°', 60, '1', [30, 45, 50, 55, 60, 65]),
                fldStd('Port dia Dp', 'phe-dp', 'mm', 150, '5', [50, 100, 150, 200, 250, 300, 350, 400], 'length-mm'));
    h += '<div style="font-family:var(--font-mono);font-size:8.5px;color:#94a3b8;line-height:1.45;margin:1px 0 3px;">↳ <b>β 30–65° (custom or standard):</b> 30°=lowest ΔP · 45°=balanced · 60°=industrial standard · 65°=highest heat transfer. Values between the standards are interpolated.</div>';
    h += twoCol(fldStd('Enlargement φ', 'phe-phi', '–', 1.18, '0.01', [1.15, 1.17, 1.18, 1.20, 1.22, 1.25]),
                fldStd('Plate pitch p', 'phe-pitch', 'mm', 3.0, '0.1', [2.0, 2.5, 3.0, 3.5, 4.0, 5.0], 'length-mm'));
    // industrial-standard suggestions (editable — these are guidance ranges)
    h += '<div id="phe-geosug" style="font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.5;margin-top:3px;background:rgba(56,189,248,0.06);border-left:2px solid #38bdf8;padding:5px 7px;border-radius:3px;">'
      + '📐 <b>Industrial standard (editable):</b> Length 0.4–2.5 m · Width 0.1–1.0 m · Thickness 0.4–1.0 mm · Chevron 30–65° · Enlargement φ 1.15–1.25 · Pitch 2.0–5.0 mm · Port Ø ≈ 0.2–0.35 × width. Values auto-suggest from duty when you press Suggest.'
      + '<button id="phe-suggest-geo" style="display:block;margin-top:5px;background:#0ea5e9;border:none;color:#fff;font-family:var(--font-mono);font-size:9px;font-weight:700;padding:4px 8px;border-radius:3px;cursor:pointer;">⚡ SUGGEST GEOMETRY FROM DUTY</button></div>';
    h += '<div id="phe-suggest-note" style="display:none;font-family:var(--font-mono);font-size:9px;color:#22c55e;line-height:1.5;margin-top:5px;background:rgba(34,197,94,0.07);border-left:2px solid #22c55e;padding:5px 7px;border-radius:3px;"></div>';
    h += geoThumbRules();

    h += hdr('10 · CHANNEL / PASS DESIGN');
    h += selStd('PASS ARRANGEMENT', 'phe-pass', ['1 Pass / 1 Pass', '2 Pass / 2 Pass', '3 Pass / 3 Pass', '4 Pass / 4 Pass', '2 Pass / 1 Pass', '3 Pass / 1 Pass', '4 Pass / 2 Pass'], '1 Pass / 1 Pass');
    h += '<div style="font-family:var(--font-mono);font-size:8.5px;color:#94a3b8;line-height:1.45;margin:1px 0 3px;">↳ <b>Hot pass / Cold pass (custom allowed):</b> single-pass = lowest ΔP &amp; easy cleaning · multi-pass raises velocity, U and ΔP for tight approaches. Type your own e.g. <i>5 Pass / 5 Pass</i>.</div>';
    h += fld('Design margin', 'phe-margin', '%', 10);

    h += '<button id="phe-calc" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">RUN PHE CALCULATION &#9889;</button>';
    h += '<div id="phe-run-status" style="display:none;margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#052e16;background:linear-gradient(135deg,#22c55e,#4ade80);border:1px solid #16a34a;border-radius:5px;padding:8px 10px;box-shadow:0 0 0 0 rgba(34,197,94,0.5);text-align:center;line-height:1.4;"></div>';
    h += '<style>.phe-act{flex:1;background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:8px;border-radius:4px;cursor:pointer;}.phe-act:hover{background:rgba(255,117,56,0.12);}'
      + '.phe-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
      + '.phe-rr span{color:var(--text-muted);}.phe-rr b{color:var(--text-header);}.phe-rr.warn b{color:#ef4444;}.phe-rr.ok b{color:#22c55e;}'
      + '.phe-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}'
      + '.phe-hbtn{display:inline-flex;flex-direction:column;align-items:center;gap:1px;min-width:42px;padding:4px 8px;background:rgba(59,130,246,0.06);border:1px solid #3b82f6;color:#3b82f6;border-radius:5px;font-size:8px;font-weight:700;letter-spacing:0.05em;cursor:pointer;line-height:1.1;font-family:var(--font-mono);}.phe-hbtn:hover{background:rgba(59,130,246,0.2);}.phe-hbtn:active{transform:scale(0.94);}'
      + '.phe-hbtn-red{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,0.06);}.phe-hbtn-red:hover{background:rgba(239,68,68,0.2);}'
      + '.phe-auto{outline:2px solid #22c55e !important;background:rgba(34,197,94,0.08) !important;}'
      + '.phe-viewbtn{font-family:var(--font-mono);font-size:9.5px;font-weight:700;letter-spacing:0.04em;padding:5px 12px;border-radius:5px;cursor:pointer;background:rgba(56,189,248,0.06);border:1px solid #334155;color:#94a3b8;}'
      + '.phe-viewbtn.phe-viewon{background:linear-gradient(135deg,#0ea5e9,#38bdf8);border-color:#38bdf8;color:#04263a;}'
      + '.phe-noz{position:absolute;font-family:var(--font-mono);font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;pointer-events:none;white-space:nowrap;}'
      + '.sthe-grid input:-webkit-autofill,.sthe-grid input:-webkit-autofill:hover,.sthe-grid input:-webkit-autofill:focus,.sthe-grid input:-webkit-autofill:active{-webkit-box-shadow:0 0 0 40px #0b1220 inset !important;-webkit-text-fill-color:#e2e8f0 !important;caret-color:#e2e8f0;transition:background-color 9999s ease-in-out 0s;}'
      + '@keyframes pheToast{0%{opacity:0;transform:translateY(8px)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}'
      + '@keyframes pheRunPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.7)}100%{box-shadow:0 0 0 14px rgba(34,197,94,0)}}</style>';
    h += '</div></div>';

    // ---- RIGHT: 3D + results ----
    h += '<div class="panel" style="max-height:calc(100vh - 120px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">TECHNICAL EVALUATIONS DATASHEET — PLATE HEx</span></div>'
      + '<div class="panel-body">'
      + '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:5px;">'
      + '<button id="phe-view-asm" class="phe-viewbtn phe-viewon" data-view="assembly">🔧 WHOLE ASSEMBLY</button>'
      + '<button id="phe-view-flow" class="phe-viewbtn" data-view="flow">🌊 INTERNAL FLOW</button></div>'
      + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#94a3b8;text-align:center;margin-bottom:4px;">3D PLATE-PACK — LIVE VIEW &nbsp;·&nbsp; DRAG TO ROTATE · SCROLL TO ZOOM</div>'
      + '<div id="phe-3dwrap" style="position:relative;width:100%;height:480px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;">'
      + '<canvas id="phe-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>'
      + '<svg id="phe-noz-svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></svg>'
      + '<div id="phe-3dtag" style="position:absolute;left:8px;top:8px;font-family:var(--font-mono);font-size:10px;color:#38bdf8;"></div>'
      + '<div id="phe-noz-hin" class="phe-noz" style="left:8px;top:60px;background:rgba(220,38,38,0.9);color:#fff;transform:translate(-50%,-50%);"></div>'
      + '<div id="phe-noz-hout" class="phe-noz" style="left:8px;top:120px;background:rgba(220,38,38,0.9);color:#fff;transform:translate(-50%,-50%);"></div>'
      + '<div id="phe-noz-cin" class="phe-noz" style="left:80%;top:60px;background:rgba(37,99,235,0.9);color:#fff;transform:translate(-50%,-50%);"></div>'
      + '<div id="phe-noz-cout" class="phe-noz" style="left:80%;top:120px;background:rgba(37,99,235,0.9);color:#fff;transform:translate(-50%,-50%);"></div></div>'
      + '<div id="phe-key-summary" style="margin-bottom:12px; display:none; border:1px solid rgba(0,184,117,0.35); border-radius:var(--radius-md); padding:10px 12px; background:rgba(0,184,117,0.04);">'
      + '<div style="font-weight:700; color:#6ee7b7; font-family:var(--font-mono); font-size:11px; letter-spacing:0.06em; margin-bottom:8px;">&#9733; IMPORTANT OUTPUT RESULTS &mdash; AUTO-CALCULATED vs USER-ENTERED</div>'
      + '<div id="phe-key-summary-content" style="font-size:10.5px;"></div></div>'
      + '<div id="phe-results" style="margin-top:12px;"></div>'
      + '<div id="phe-optimize" style="margin-top:12px;"></div>'
      + '<div id="phe-graphs" style="margin-top:14px;"></div>'
      // final deliverables live on the OUTPUTS side, under the results
      + '<div style="margin-top:14px;border-top:1px solid var(--border-muted);padding-top:10px;">'
      + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin-bottom:6px;">FINAL DELIVERABLES</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button id="phe-report" class="phe-act">📄 VIEW PHE REPORT</button>'
      + '<button id="phe-draw" class="phe-act">&#9998; 2D MFG DRAWING + BOM</button>'
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
    /* FLUIDS is SI-basis (rho kg/m³, cp J/kg·K, k W/m·K) — writing it straight
       into a field labelled in whatever unit system is active is the same
       wrong-unit-substitution bug fixed in Pump/Line Sizing's fluid presets.
       mu/muw carry no data-unit-type (viscosity in Pa·s doesn't change with
       the unit system, so a raw write there is not a bug), and cp's field
       displays in the shared 'cp' type's kJ/kg·°C basis, so the SI table's
       J/kg·K value is divided by 1000 before the SI→display conversion. */
    var e = function (id) { return $(id); };
    setSI('phe-' + side + '-rho', f.rho); e('phe-' + side + '-mu') && (e('phe-' + side + '-mu').value = f.mu);
    setSI('phe-' + side + '-cp', f.cp / 1000); setSI('phe-' + side + '-k', f.k);
    var sgEl = e('phe-' + side + '-sg'); if (sgEl) sgEl.value = f.sg;
    var muwEl = e('phe-' + side + '-muw'); if (muwEl) muwEl.value = f.mu;   // wall viscosity defaults to bulk μ
  }
  function updateMatInfo() {
    var el = $('phe-matinfo'); if (!el) return;
    var m = MATERIALS[val('phe-pmat', 'SS316')] || MATERIALS['SS316'];
    el.innerHTML = 'k ' + fromSIval(m.k, 'thermal-cond').toFixed(2) + ' ' + unitSym('thermal-cond', 'W/m·K')
      + ' · roughness ' + m.rough + ' µm · corrosion ' + m.corr.toFixed(2) + ' mm/yr'
      + ' · allow. stress ' + fromSIval(m.S, 'stress').toFixed(1) + ' ' + unitSym('stress', 'MPa')
      + ' · ρ ' + fromSIval(m.rho, 'density').toFixed(1) + ' ' + unitSym('density', 'kg/m³');
  }

  // "✓ UPDATED SUCCESSFULLY" banner (+ optional chime on an explicit RUN).
  var _toastEl = null, _toastT = 0;
  function updatedFeedback(sound) {
    /* The two-tone chime that used to play here is gone. It was the last
       sound left in the suite, and sound has now been reported as unwanted
       twice. The banner below says the same thing, visibly, and does not
       carry across an open-plan office. The `sound` argument is kept so the
       call sites still read as they did. */
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
    el.innerHTML = '✓ DESIGN COMPLETE &nbsp;·&nbsp; ' + r.N + ' plates &nbsp;·&nbsp; U ' + U(r.Ud, 'htc', 0)
      + ' &nbsp;·&nbsp; area ' + U(r.Aprov, 'area', 1) + ' &nbsp;·&nbsp; ' + U(r.Q / 1000, 'heat-duty', 0)
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
  /* RESET clears the sheet so every value is entered by hand — dropdowns fall
     back to their first entry, all typed fields go blank. */
  function blankAll() {
    INPUT_IDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = '';
    });
    /* Results, graphs and status all go, and nothing repopulates them until
       the engineer enters inputs again. */
    if (window.ARORESET) {
      window.ARORESET.wipe('phe', ['phe-results', 'phe-graphs', 'phe-status']);
      window.ARORESET.watch('phe', 'tab-phe');
    }
    LAST = null;
    updateMatInfo(); calc();
  }

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

    // Lp/Wp/t/b/pitch/Dp are all SI-basis mm — setSI() converts each into
    // whatever unit the field is currently displaying (beta/phi are
    // dimensionless/degrees, unaffected by the unit system, so a raw write
    // is correct for them).
    setSI('phe-L', Lp); setSI('phe-W', Wp);
    setSI('phe-t', t); setSI('phe-b', b); set('phe-beta', String(beta));
    set('phe-phi', phi); setSI('phe-pitch', pitch); setSI('phe-dp', Dp);
    calc();
    suggestFeedback({ Lp: Lp, Wp: Wp, t: t, b: b, beta: beta, phi: phi, pitch: pitch, Dp: Dp, vPort: vPort, A: A });
  }

  // small note describing what the thumb-rule engine just applied
  function suggestFeedback(g) {
    var el = $('phe-suggest-note'); if (!el) return;
    el.style.display = 'block';
    var mm = unitSym('length-mm', 'mm'), m2 = unitSym('area', 'm²'), ms = unitSym('velocity', 'm/s');
    // Lp/Wp/Dp are large enough that one decimal reads fine in either mm or
    // inches; t/b/pitch are a couple of millimetres, which rounds to "0.0 in"
    // at the same precision — those three get an extra decimal place.
    var f = function (siMm) { return fromSIval(siMm, 'length-mm').toFixed(1); };
    var fThin = function (siMm) { return fromSIval(siMm, 'length-mm').toFixed(mm === 'in' ? 3 : 2); };
    el.innerHTML = '⚡ <b>Geometry suggested from duty</b> (required area ≈ ' + fromSIval(g.A, 'area').toFixed(2) + ' ' + m2 + '): '
      + 'Lp ' + f(g.Lp) + ' · Wp ' + f(g.Wp) + ' · t ' + fThin(g.t) + ' · b ' + fThin(g.b) + ' · β ' + g.beta + '° · φ ' + g.phi
      + ' · pitch ' + fThin(g.pitch) + ' · port Ø ' + f(g.Dp) + ' ' + mm + '  →  port velocity ' + fromSIval(g.vPort, 'velocity').toFixed(2) + ' ' + ms + ' '
      + (g.vPort <= 3 ? '✓' : '⚠ high') + '. All fields remain editable.';
  }

  /* ─────────── DESIGN OPTIMISER (over-surface → industrial 10–30 % band) ─────────── */
  // Over-surface = provided area vs required. Industry keeps it 10–30 %:
  //   < 10 %  → under-surfaced (no fouling / uncertainty allowance) — risky
  //   10–30 % → optimum
  //   > 30 %  → oversized → extra plates → higher material & BOM cost
  var OPT_BAND = { lo: 10, hi: 30, target: 20 };
  var STD_B = [30, 45, 60, 65], STD_L = [400, 600, 800, 1000, 1200, 1500, 1800, 2000, 2500];
  function phiFor(b) { return (1.15 + 0.0017 * (b - 30)).toFixed(2); }
  function wFor(L) { return Math.min(1000, Math.max(100, Math.round(L * 0.42 / 10) * 10)); }
  function dpFor(W) { return Math.round(W * 0.30 / 5) * 5; }
  // run compute() with a set of temporary input overrides, then restore inputs.
  // Overrides are always SI-basis numbers (e.g. STD_L's plate lengths in mm),
  // so they go through setSI() — a raw write would be read back through num()
  // as if it were already in the active display unit, silently mis-scaling
  // the override the moment a tagged field is used in US/CGS mode.
  function withInputs(ov, fn) {
    var saved = {}, id;
    for (id in ov) { var e = $(id); saved[id] = e ? e.value : null; if (e) setSI(id, ov[id]); }
    var out; try { out = fn(); } finally { for (id in saved) { var e2 = $(id); if (e2 && saved[id] !== null) e2.value = saved[id]; } }
    return out;
  }
  function projOS(ov) { var rr = withInputs(ov, compute); return (rr && isFinite(rr.N)) ? rr : null; }
  function nearHigher(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i] > v + 0.5) return arr[i]; return null; }
  function nearLower(arr, v) { for (var i = arr.length - 1; i >= 0; i--) if (arr[i] < v - 0.5) return arr[i]; return null; }

  // build up to 3 single-lever suggestions with reasons + projected over-surface
  function buildSuggestions(r, status) {
    var out = [], beta = Math.round(num('phe-beta', 60)), L = num('phe-L', 1200);
    function add(title, reason, ov) { var rr = projOS(ov); if (rr) out.push({ title: title, reason: reason, ov: ov, proj: rr.overSurf, N: rr.N }); }
    if (status === 'OVER') {
      var bU = nearHigher(STD_B, beta);
      if (bU) add('Raise chevron β to ' + bU + '°', 'a higher chevron angle lifts the overall U, so fewer plates are needed', { 'phe-beta': String(bU), 'phe-phi': phiFor(bU) });
      var lL = nearLower(STD_L, L);
      if (lL) add('Reduce plate length to ' + U(lL, 'length-mm', 0), 'smaller plates trim the surplus area left by discrete plate stepping', { 'phe-L': String(lL), 'phe-W': String(wFor(lL)), 'phe-dp': String(dpFor(wFor(lL))) });
      var dpa = Math.round(Math.max(num('phe-hf-dpa', 50), num('phe-cf-dpa', 50)) * 1.4);
      add('Allow ΔP up to ' + U(dpa, 'press-drop-kpa', 0), 'the pack was grown to meet the ΔP limit; a higher ΔP budget removes surplus plates', { 'phe-hf-dpa': String(dpa), 'phe-cf-dpa': String(dpa) });
    } else { // UNDER
      add('Raise design margin to 15 %', 'the current surface is too tight — this adds fouling & process-uncertainty allowance', { 'phe-margin': '15' });
      var hL = nearHigher(STD_L, L);
      if (hL) add('Increase plate length to ' + U(hL, 'length-mm', 0), 'adds heat-transfer area for a safer over-surface margin', { 'phe-L': String(hL), 'phe-W': String(wFor(hL)), 'phe-dp': String(dpFor(wFor(hL))) });
      var bL = nearLower(STD_B, beta);
      if (bL) add('Lower chevron β to ' + bL + '°', 'a lower chevron reduces U, adding heat-transfer surface as margin', { 'phe-beta': String(bL), 'phe-phi': phiFor(bL) });
    }
    // keep only levers that actually move over-surface the RIGHT way
    // (OVER → must reduce it; UNDER → must raise it) and not wildly past the band
    var os0 = r.overSurf;
    out = out.filter(function (su) {
      if (status === 'OVER') return su.proj < os0 - 1 && su.proj > OPT_BAND.lo - 6;
      return su.proj > os0 + 1 && su.proj < OPT_BAND.hi + 8;
    });
    // prefer changes that land closest to the mid-band target
    out.sort(function (a, b) { return Math.abs(a.proj - OPT_BAND.target) - Math.abs(b.proj - OPT_BAND.target); });
    return out.slice(0, 3);
  }

  // full search over β × plate length for the best in-band, hydraulically-OK config
  function optimizeSearch() {
    var dpHa = num('phe-hf-dpa', 50), dpCa = num('phe-cf-dpa', 50), best = null;
    STD_B.forEach(function (beta) {
      STD_L.forEach(function (L) {
        var W = wFor(L), Dp = dpFor(W);
        var r = withInputs({ 'phe-beta': String(beta), 'phe-phi': phiFor(beta), 'phe-L': String(L), 'phe-W': String(W), 'phe-dp': String(Dp) }, compute);
        if (!r || !isFinite(r.N)) return;
        var os = r.overSurf, dpOk = r.dpH.dp <= dpHa * 1.05 && r.dpC.dp <= dpCa * 1.05;
        var inBand = os >= OPT_BAND.lo && os <= OPT_BAND.hi, score;
        if (inBand && dpOk) score = 2000 - Math.abs(os - OPT_BAND.target) - r.N * 0.05;   // best: in band, fewer plates
        else if (dpOk) score = 1000 - Math.abs(os - OPT_BAND.target);
        else score = 200 - Math.abs(os - OPT_BAND.target);
        if (!best || score > best.score) best = { score: score, beta: beta, L: L, W: W, Dp: Dp, os: os, N: r.N, dpOk: dpOk };
      });
    });
    return best;
  }

  function applyOptimize() {
    var b = optimizeSearch(); if (!b) return;
    pushUndo();
    $('phe-beta').value = String(b.beta); $('phe-phi').value = phiFor(b.beta);
    setSI('phe-L', b.L); setSI('phe-W', b.W); setSI('phe-dp', b.Dp);
    calc();
    updatedFeedback(true);
  }

  // render the optimiser panel on the OUTPUT side (auto-refreshes each run)
  function designAdvisor(r) {
    var box = $('phe-optimize'); if (!box) return;
    if (!r || !isFinite(r.N)) { box.innerHTML = ''; return; }
    var os = r.overSurf, status = os < OPT_BAND.lo ? 'UNDER' : os > OPT_BAND.hi ? 'OVER' : 'GOOD';
    var col = status === 'GOOD' ? '#22c55e' : status === 'OVER' ? '#f59e0b' : '#ef4444';
    var head = status === 'GOOD'
      ? '✓ OPTIMISED — over-surface ' + os.toFixed(1) + ' % is within the industrial 10–30 % band. ' + r.N + ' plates · ' + U(r.Aprov, 'area', 1) + '.'
      : status === 'OVER'
        ? '▲ OVERSIZED — over-surface ' + os.toFixed(1) + ' % (> 30 %). ' + r.N + ' plates → more material & BOM cost than the duty needs.'
        : '▼ UNDER-SURFACED — over-surface ' + os.toFixed(1) + ' % (< 10 %). Too little allowance for fouling / uncertainty.';
    var h = '<div style="border:1px solid ' + col + ';border-left:3px solid ' + col + ';background:rgba(2,6,18,0.35);border-radius:5px;padding:9px 11px;">';
    h += '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:' + col + ';line-height:1.4;margin-bottom:' + (status === 'GOOD' ? '0' : '7') + 'px;">⚙ DESIGN OPTIMISER — ' + head + '</div>';
    if (status !== 'GOOD') {
      buildSuggestions(r, status).forEach(function (su) {
        var band = su.proj >= OPT_BAND.lo && su.proj <= OPT_BAND.hi;
        h += '<div style="display:flex;align-items:center;gap:8px;margin:6px 0;font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;line-height:1.45;">'
          + '<div style="flex:1;"><b style="color:var(--text-header);">' + su.title + '</b> — ' + su.reason
          + ' <span style="color:' + (band ? '#22c55e' : col) + ';font-weight:700;">(→ ' + su.proj.toFixed(0) + ' % surface, ' + su.N + ' plates' + (band ? ' ✓' : '') + ')</span></div>'
          + '<button class="phe-opt-apply phe-hbtn" data-ov=\'' + JSON.stringify(su.ov).replace(/'/g, '&#39;') + '\' style="min-width:54px;flex-direction:row;">APPLY</button></div>';
      });
      h += '<button id="phe-opt-all" style="width:100%;margin-top:7px;background:linear-gradient(135deg,#0ea5e9,#38bdf8);border:none;color:#04263a;font-family:var(--font-mono);font-size:10px;font-weight:800;letter-spacing:0.04em;padding:8px;border-radius:5px;cursor:pointer;">⚙ AUTO-OPTIMISE — APPLY ALL (industrial norms)</button>';
    }
    box.innerHTML = h + '</div>';
  }
  var _optWired = false;
  function wireOptimizer() {
    if (_optWired) return; _optWired = true;
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var ap = e.target.closest('.phe-opt-apply');
      if (ap) { var ov; try { ov = JSON.parse(ap.getAttribute('data-ov')); } catch (_) { return; } pushUndo(); for (var id in ov) setSI(id, ov[id]); calc(); updatedFeedback(false); return; }
      if (e.target.closest('#phe-opt-all')) applyOptimize();
    });
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
      var missing = validatePHEInputs();
      if (missing.length > 0) {
        showPHEInputsDialog(missing);
        return;
      }
      if (window.ARORESET) window.ARORESET.lift('phe');
      applyFluid('hf'); applyFluid('cf'); calc();
      updatedFeedback(true);   // banner only on RUN
      runStatus();             // persistent highlighted sign under the button
    });
    var rb = $('phe-report'); if (rb) rb.addEventListener('click', report);
    var db = $('phe-draw'); if (db) db.addEventListener('click', drawing);
    var gb = $('phe-graph'); if (gb) gb.addEventListener('click', graph);
    // 3D view-mode toggle (whole assembly ↔ internal flow)
    function setView(v) {
      pheView = v;
      var ba = $('phe-view-asm'), bf = $('phe-view-flow');
      if (ba) ba.classList.toggle('phe-viewon', v === 'assembly');
      if (bf) bf.classList.toggle('phe-viewon', v === 'flow');
      if (LAST) update3D(LAST);
      var tg = $('phe-3dtag'); if (tg && LAST) tg.textContent = (v === 'flow' ? 'INTERNAL FLOW · ' : '') + tg.textContent.replace(/^INTERNAL FLOW · /, '');
    }
    var va = $('phe-view-asm'); if (va) va.addEventListener('click', function () { setView('assembly'); });
    var vf = $('phe-view-flow'); if (vf) vf.addEventListener('click', function () { setView('flow'); });
    var sg = $('phe-suggest-geo'); if (sg) sg.addEventListener('click', function () { pushUndo(); suggestGeometry(); });
    // undo / redo / reset
    var ub = $('phe-undo'); if (ub) ub.addEventListener('click', function () { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); lastSnap = snapshot(); });
    var rdb = $('phe-redo'); if (rdb) rdb.addEventListener('click', function () { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); lastSnap = snapshot(); });
    var rsb = $('phe-reset'); if (rsb) rsb.addEventListener('click', function () { pushUndo(); blankAll(); });
    wireCombo();
    // re-run when the global unit system changes (the main app converts the
    // tagged input values first; we recompute from the new displayed values)
    var usel = document.getElementById('global-unit-system');
    if (usel && !usel._pheBound) { usel._pheBound = true; usel.addEventListener('change', function () { setTimeout(function () { calc(); }, 0); }); }
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
    /* cp fields display in the shared 'cp' unit type, whose SI basis is
       kJ/kg·°C (matching DPHE/STHE) — every formula below (Prandtl number,
       the oil/water classification threshold) needs J/kg·K, so the ×1000 is
       applied once, right here at the read boundary. */
    var hot = { m: num('phe-hf-m', 10), tin: num('phe-hf-tin', 90), tout: num('phe-hf-tout', 55),
      rho: num('phe-hf-rho', 965), mu: num('phe-hf-mu', 0.00032), cp: num('phe-hf-cp', 4.198) * 1000, k: num('phe-hf-k', 0.668), rf: num('phe-hf-rf', 0.000018) };
    var cold = { m: num('phe-cf-m', 12), tin: num('phe-cf-tin', 30), tout: num('phe-cf-tout', 50),
      rho: num('phe-cf-rho', 992), mu: num('phe-cf-mu', 0.00065), cp: num('phe-cf-cp', 4.180) * 1000, k: num('phe-cf-k', 0.628), rf: num('phe-cf-rf', 0.000018) };

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
        if (auto) setSI(id, auto.v);
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
        // restore the dark input theme (clearing to '' falls back to the UA
        // default white background, which is what we must avoid)
        e.style.background = 'rgba(2,6,18,0.6)'; e.style.borderColor = 'var(--border-muted)'; e.style.color = '#e2e8f0';
        if (lbl) { var b = lbl.querySelector('.phe-auto-badge'); if (b) b.remove(); }
      }
    });
  }

  /* Which process input Smart Input is solving for, by the same names the
     calc() branch uses — one map so the validator and the solver cannot
     disagree about who owns a field. */
  var PHE_SMART_FIELD = {
    'Cold Mass Flow':   'phe-cf-m',
    'Hot Mass Flow':    'phe-hf-m',
    'Hot Outlet Temp':  'phe-hf-tout',
    'Cold Outlet Temp': 'phe-cf-tout'
  };
  function smartTargetId() {
    return PHE_SMART_FIELD[val('phe-smart', '— all user inputs —')] || null;
  }

  /* Validate required inputs — prevent calculation with missing values */
  function validatePHEInputs() {
    var missing = [];
    var checkInputs = [
      { id: 'phe-hf-m', label: 'Hot fluid mass flow' },
      { id: 'phe-cf-m', label: 'Cold fluid mass flow' },
      { id: 'phe-hf-tin', label: 'Hot fluid inlet temperature' },
      { id: 'phe-cf-tin', label: 'Cold fluid inlet temperature' },
      { id: 'phe-hf-tout', label: 'Hot fluid outlet temperature' },
      { id: 'phe-cf-tout', label: 'Cold fluid outlet temperature' }
    ];
    /* Smart Input solves one of these from Q = m·Cp·ΔT and locks the field.
       Asking the engineer to fill in the very number the module is about to
       compute is a contradiction, and it blocked RUN outright. */
    var solved = smartTargetId();
    checkInputs.forEach(function(inp) {
      if (inp.id === solved) return;
      var el = $(inp.id);
      if (!el) return;
      if (window.AROVALID ? window.AROVALID.missing(el)
                          : !isFinite(parseFloat(el.value)) || parseFloat(el.value) === 0) missing.push(inp.label);
    });
    return missing;
  }

  /* Show required inputs dialog — every time RUN is pressed while inputs
     are still missing, not gated to once per session. */
  function showPHEInputsDialog(missing) {
    if (window.__aroBackgroundRun) return;   // a re-run is not a request to design
    var old = $('phe-reqinput-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'phe-reqinput-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100003;background:rgba(2,6,18,0.92);display:flex;align-items:center;justify-content:center;';
    var inner = '<div style="background:#0f172a;border:2px solid #ef4444;border-radius:8px;max-width:520px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.8);">'
      + '<div style="font-size:20px;font-weight:800;color:#ef4444;margin-bottom:16px;display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">⚠</span> REQUIRED INPUTS MISSING</div>'
      + '<div style="font-size:13px;color:#cbd5e1;margin-bottom:16px;line-height:1.6;">Enter values for the following before running PHE design — the calculation depends on real inputs:</div>'
      + '<ul style="list-style:none;padding:0;margin:0 0 16px 0;">';
    missing.forEach(function(m) {
      inner += '<li style="font-family:var(--font-mono);font-size:12px;color:#f87171;margin:6px 0;padding-left:24px;">• ' + m + '</li>';
    });
    inner += '</ul>'
      + '<button id="phe-reqinput-ok" style="width:100%;background:linear-gradient(135deg,#ea580c,#f97316);border:none;color:#fff;font-family:var(--font-mono);font-size:14px;font-weight:800;padding:14px;border-radius:5px;cursor:pointer;">OK, I\'LL FILL THEM IN</button>'
      + '</div>';
    m.innerHTML = inner;
    document.body.appendChild(m);
    var okBtn = $('phe-reqinput-ok');
    if (okBtn) okBtn.onclick = function() { m.remove(); };
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  }

  function calc() {
    if (!$('phe-results')) return;
    if (window.ARORESET && window.ARORESET.is('phe')) {
      window.ARORESET.placeholder($('phe-results'), 'the plate heat exchanger');
      var gb0 = $('phe-graphs'); if (gb0) gb0.innerHTML = '';
      var st0 = $('phe-status'); if (st0) { st0.style.display = 'none'; st0.textContent = ''; }
      return;
    }
    // require the core process inputs before showing a design — EXCEPT the field
    // that the CALCULATE selection auto-solves (it is derived, not entered).
    applyAutoLock(val('phe-smart', '— all user inputs —'), null);
    var autoId = SMART_FIELD[val('phe-smart', '— all user inputs —')] || null;
    var essential = ['phe-hf-m', 'phe-cf-m', 'phe-hf-tin', 'phe-cf-tin', 'phe-hf-tout', 'phe-cf-tout']
      .filter(function (id) { return id !== autoId; });
    var missing = essential.some(function (id) { var e = $(id); return !e || String(e.value).trim() === ''; });
    if (missing) {
      $('phe-results').innerHTML = '<div style="font-family:var(--font-mono);font-size:11px;color:#f59e0b;background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;padding:10px 12px;border-radius:4px;line-height:1.5;">▸ Enter the process inputs (mass flow &amp; temperatures for both sides), then press <b>RUN PHE CALCULATION</b>. Fluid properties auto-fill from the library.</div>';
      var tg = $('phe-3dtag'); if (tg) tg.textContent = 'Awaiting process inputs…';
      var gb = $('phe-graphs'); if (gb) gb.innerHTML = '';
      var ob = $('phe-optimize'); if (ob) ob.innerHTML = '';
      return;
    }
    var r = LAST = compute();
    var f1 = function (x) { return isFinite(x) ? x.toFixed(1) : '—'; };
    var f0 = function (x) { return isFinite(x) ? Math.round(x).toLocaleString() : '—'; };
    var row = function (l, v, cls) { return '<div class="phe-rr ' + (cls || '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };

    /* The plate pack is judged on five things: does the energy balance
       close, is there surface margin over the fouled duty, do both pressure
       drops sit inside their allowances, is U in the band a plate exchanger
       actually achieves, and is the F correction high enough that the
       arrangement is the right one. Those five go to the status bar. */
    if (window.AROENG) {
      try {
        window.AROENG.publish('phe', {
          checks: [
            { key: 'bal', label: 'Energy balance', clause: 'Q_hot = Q_cold',
              status: Math.abs(r.Qbal - 1) > 0.05 ? 'warn' : 'pass',
              detail: 'Qh/Qc = ' + r.Qbal.toFixed(3) + '. A closure worse than ±5 % means the two duties '
                    + 'as entered describe different exchangers.' },
            { key: 'surf', label: 'Over-surface', clause: 'Fouled duty',
              status: r.overSurf < 0 ? 'fail' : (r.overSurf > 30 ? 'warn' : 'pass'),
              detail: r.overSurf.toFixed(1) + ' % surface above the fouled requirement.' },
            { key: 'dph', label: 'Hot-side pressure drop', clause: 'Stated allowance',
              status: r.dpH.dp > r.dpHa ? 'fail' : 'pass',
              detail: r.dpH.dp.toFixed(1) + ' kPa against ' + r.dpHa.toFixed(1) + ' kPa allowable (channels + ports).' },
            { key: 'dpc', label: 'Cold-side pressure drop', clause: 'Stated allowance',
              status: r.dpC.dp > r.dpCa ? 'fail' : 'pass',
              detail: r.dpC.dp.toFixed(1) + ' kPa against ' + r.dpCa.toFixed(1) + ' kPa allowable (channels + ports).' },
            { key: 'u', label: 'Design coefficient in band', clause: 'Plate-exchanger practice',
              status: r.uInBand ? 'pass' : 'warn',
              detail: 'Dirty U = ' + Math.round(r.Ud) + ' W/m²·K. Outside the typical band the plate/'
                    + 'chevron selection or the fouling allowance should be revisited.' },
            { key: 'f', label: 'LMTD correction F', clause: 'Multipass arrangement',
              status: (isFinite(r.F) && r.F < 0.75) ? 'warn' : 'pass',
              detail: 'F = ' + (isFinite(r.F) ? r.F.toFixed(3) : '—') + '. Below 0.75 the arrangement is '
                    + 'working against a temperature cross and should be re-passed rather than accepted.' }
          ],
          values: r
        });
      } catch (e) {}
    }

    /* Footer ticker — same PASS/OVERSIZED/UNDERSIZED status line the pump,
       DPHE and STHE engines already print, so the Plate HEx panel is no
       longer the one module that leaves the footer showing whatever the
       last-run engine said (or "STHE ENGINE" outright, before the sub-tab
       fix above). */
    try {
      if (window.setEngineTicker) {
        var pheSt = r.overSurf < 0 ? 'UNDERSIZED' : (r.overSurf > 30 ? 'OVERSIZED' : 'ACCEPTABLE');
        var pheMsg = 'PHE CALCULATED // over-surface ' + f1(r.overSurf) + '% // ' + pheSt;
        window.setEngineTicker('phe', pheMsg,
          pheSt === 'ACCEPTABLE' ? '#00b875' : (pheSt === 'OVERSIZED' ? '#f59e0b' : '#ef4444'));
      }
    } catch (e) {}

    var h = '';
    // flow-arrangement comparison (auto-recommended, no user input)
    var fc = r.flowCmp;
    h += '<div class="phe-cardh">FLOW ARRANGEMENT — AUTO COMPARISON</div>';
    h += row('Counter-current ΔTm', U(fc.counterDTm, 'temp-diff', 1) + (fc.counterOk ? '' : ' (infeasible)'), r.counter ? 'ok' : '');
    h += row('Co-current ΔTm', U(fc.coDTm, 'temp-diff', 1) + (fc.coOk ? '' : ' (infeasible)'), !r.counter ? 'ok' : '');
    h += row('★ Recommended', fc.best + (fc.gain > 0.5 ? ' (−' + f1(fc.gain) + '% area)' : ''), 'ok');
    h += '<div class="phe-cardh">4 · AUTO-CALCULATED THERMAL</div>';
    h += row('Heat duty Q', U(r.Q / 1000, 'heat-duty', 0));
    h += row('Energy balance', (r.Qbal).toFixed(3) + ' (Qh/Qc)', Math.abs(r.Qbal - 1) > 0.05 ? 'warn' : 'ok');
    h += row('LMTD', U(r.lmtd, 'temp-diff', 1));
    h += row('Correction F', r.F.toFixed(2));
    h += row('True ΔTm', U(r.dTm, 'temp-diff', 1));
    h += row('Capacity ratio Cr', r.Cr.toFixed(3));
    h += row('Effectiveness ε', (r.eff * 100).toFixed(1) + ' %');
    h += row('NTU', r.NTU.toFixed(2));
    h += row('Approach', U(r.approach, 'temp-diff', 1));

    h += '<div class="phe-cardh">13 · THERMAL DESIGN</div>';
    h += row('Reynolds (hot / cold)', f0(r.H.Re) + ' / ' + f0(r.C.Re));
    h += row('Prandtl (hot / cold)', r.H.Pr.toFixed(1) + ' / ' + r.C.Pr.toFixed(1));
    h += row('Nusselt (hot / cold)', f0(r.H.Nu) + ' / ' + f0(r.C.Nu));
    h += row('Film h hot', U(r.H.h, 'htc', 0));
    h += row('Film h cold', U(r.C.h, 'htc', 0));
    h += row('Wall resistance', (r.Rw * 1e4).toFixed(2) + '×10⁻⁴');
    h += row('Clean U', U(r.Uclean, 'htc', 0));
    h += row('Dirty U (service)', U(r.Ud, 'htc', 0));
    h += row('Required U', U(r.Ureq, 'htc', 0));

    h += '<div class="phe-cardh">16 · PLATE-PACK DESIGN</div>';
    h += row('Area required', U(r.Areq, 'area', 1));
    h += row('Area provided', U(r.Aprov, 'area', 1));
    h += row('Over-surface', f1(r.overSurf) + ' %', r.overSurf < 0 ? 'warn' : 'ok');
    h += row('Total plates', r.N + ' (' + (r.N - 1) + ' channels)');
    h += row('Channels/pass/side', r.Ncp);
    h += row('Passes', r.npass + ' / ' + r.npass);
    h += row('Area per plate', U(r.Ap, 'area', 3));
    h += row('Hydraulic dia Dh', U(r.Dh * 1000, 'length-mm', 2));
    h += row('Compressed pack', U(r.packLen, 'length-mm', 0));

    h += '<div class="phe-cardh">15 · PRESSURE DROP</div>';
    h += row('ΔP hot (ch+port)', U(r.dpH.dp, 'press-drop-kpa', 1), r.dpH.dp > r.dpHa ? 'warn' : 'ok');
    h += row('ΔP cold (ch+port)', U(r.dpC.dp, 'press-drop-kpa', 1), r.dpC.dp > r.dpCa ? 'warn' : 'ok');
    h += row('Channel vel (hot/cold)', U(r.H.vel, 'velocity', 2) + ' / ' + U(r.C.vel, 'velocity', 2));
    h += row('Port vel (hot/cold)', U(r.dpH.vport, 'velocity', 2) + ' / ' + U(r.dpC.vport, 'velocity', 2),
      (r.dpH.vport > 6 || r.dpC.vport > 6) ? 'warn' : 'ok');

    h += '<div class="phe-cardh">U₀ ASSUMPTION — SERVICE-FLUID DESIGN CRITERIA</div>';
    h += row('Suggested U₀ band', U(r.uSug.lo, 'htc', 0) + '–' + U(r.uSug.hi, 'htc', 0));
    h += row('Basis', r.uSug.basis);
    h += row('Design (dirty) U', U(r.Ud, 'htc', 0), r.uInBand ? 'ok' : 'warn');
    h += row('Within design band', r.uInBand ? 'YES ✓' : 'REVIEW — outside typical band', r.uInBand ? 'ok' : 'warn');

    h += '<div class="phe-cardh">11 · NOZZLE / PORT SIZING</div>';
    h += row(r.nozzles.hotName + ' — HOT IN', U(r.nozzles.hotIn.v, 'velocity', 2) + ' · ΔP ' + U(r.nozzles.hotIn.dp, 'press-drop-kpa', 1), r.nozzles.hotIn.v > 6 ? 'warn' : 'ok');
    h += row(r.nozzles.hotName + ' — HOT OUT', U(r.nozzles.hotOut.v, 'velocity', 2) + ' · ΔP ' + U(r.nozzles.hotOut.dp, 'press-drop-kpa', 1), r.nozzles.hotOut.v > 6 ? 'warn' : 'ok');
    h += row(r.nozzles.coldName + ' — COLD IN', U(r.nozzles.coldIn.v, 'velocity', 2) + ' · ΔP ' + U(r.nozzles.coldIn.dp, 'press-drop-kpa', 1), r.nozzles.coldIn.v > 6 ? 'warn' : 'ok');
    h += row(r.nozzles.coldName + ' — COLD OUT', U(r.nozzles.coldOut.v, 'velocity', 2) + ' · ΔP ' + U(r.nozzles.coldOut.dp, 'press-drop-kpa', 1), r.nozzles.coldOut.v > 6 ? 'warn' : 'ok');
    h += row('Port diameter', U(r.Dp * 1000, 'length-mm', 0));

    h += '<div class="phe-cardh">6 · PLATE MATERIAL — ' + r.matName + '</div>';
    h += row('Thermal conductivity', U(r.mat.k, 'thermal-cond', 2));
    h += row('Surface roughness', r.mat.rough + ' µm');
    h += row('Corrosion rate', r.mat.corr.toFixed(2) + ' mm/yr');
    h += row('Allowable stress', U(r.mat.S, 'stress', 1));
    h += row('Density', U(r.mat.rho, 'density', 1));

    h += '<div class="phe-cardh">12 · MECHANICAL DESIGN</div>';
    h += row('Design pressure', UG(r.Pdes, 1));
    h += row('Hydrotest (1.43×)', UG(r.Phydro, 1));
    h += row('Frame length', U(r.frameLen, 'length-mm', 0));
    h += row('Tie-bolts', r.nBolts + ' × M' + r.boltDia);
    h += row('Weight empty', U(r.wEmpty, 'mass', 0));
    h += row('Weight operating', U(r.wOper, 'mass', 0));
    h += row('Gasket ' + r.gasket, r.gasketOk ? 'OK for temp' : 'CHECK Tmax', r.gasketOk ? 'ok' : 'warn');

    $('phe-results').innerHTML = h;
    /* ★ Key results panel — same auto/user badge pattern DPHE and STHE
       already show at the top of their own results (kr() there, row()
       here is the same idea for a different rendering path) — PHE had
       every number the other two do, just never the quick-glance summary
       up front. Port size is one shared Dp for all four nozzles, so one
       NPS row covers the whole set instead of four identical ones. */
    try {
      var ksP2 = $('phe-key-summary'), ksC2 = $('phe-key-summary-content');
      if (ksP2 && ksC2) {
        var AUTO3 = '<span style="background:rgba(255,117,56,0.18);color:#ffb28a;border:1px solid rgba(255,117,56,0.4);padding:1px 7px;border-radius:999px;font-size:8.5px;font-weight:700;letter-spacing:0.05em;">AUTO-CALCULATED</span>';
        var USER3 = '<span style="background:rgba(0,184,117,0.15);color:#6ee7b7;border:1px solid rgba(0,184,117,0.4);padding:1px 7px;border-radius:999px;font-size:8.5px;font-weight:700;letter-spacing:0.05em;">USER INPUT</span>';
        var kr2 = function (l3, v3, b3) { return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid rgba(0,184,117,0.12);"><span style="color:#94a3b8;">' + l3 + '</span><span style="display:flex;align-items:center;gap:8px;"><b style="color:var(--text-header);font-family:var(--font-mono);">' + v3 + '</b>' + b3 + '</span></div>'; };
        var mK2 = r.smart;
        var portNps2 = npsOfOdLocal(r.Dp);
        ksC2.innerHTML =
            kr2('Heat Duty Q', U(r.Q / 1000, 'heat-duty', 2), AUTO3)
          + kr2('Hot Mass Flow', U(r.hot.m, 'mass-flow-s', 3), mK2 === 'Hot Mass Flow' ? AUTO3 : USER3)
          + kr2('Cold Mass Flow', U(r.cold.m, 'mass-flow-s', 3), mK2 === 'Cold Mass Flow' ? AUTO3 : USER3)
          + kr2('Hot Outlet Temperature', U(r.hot.tout, 'temperature', 2), mK2 === 'Hot Outlet Temp' ? AUTO3 : USER3)
          + kr2('Cold Outlet Temperature', U(r.cold.tout, 'temperature', 2), mK2 === 'Cold Outlet Temp' ? AUTO3 : USER3)
          + kr2('Flow Arrangement (auto-selected)', r.counter ? 'COUNTER-CURRENT' : 'CO-CURRENT', AUTO3)
          + kr2('LMTD / Corrected ΔTm', U(r.lmtd, 'temp-diff', 2) + ' / ' + U(r.dTm, 'temp-diff', 2), AUTO3)
          + kr2('Plate Count', r.N + ' (' + (r.N - 1) + ' channels)', AUTO3)
          + kr2('Ud / Uclean (dirty / clean)', U(r.Ud, 'htc', 1) + ' / ' + U(r.Uclean, 'htc', 1), AUTO3)
          + kr2('Over-surface', f1(r.overSurf) + ' %', AUTO3)
          + kr2('ΔP Hot / Cold', U(r.dpH.dp, 'press-drop-kpa', 2) + ' / ' + U(r.dpC.dp, 'press-drop-kpa', 2), AUTO3)
          + kr2('Plate Size (L × W)', U(r.Lp * 1000, 'length-mm', 0) + ' × ' + U(r.Wp * 1000, 'length-mm', 0), USER3)
          + kr2('Port / Nozzle Size (all 4)', (portNps2 ? 'NPS ' + portNps2 + '″ · ' : '') + U(r.Dp * 1000, 'length-mm', 0), USER3);
        ksP2.style.display = 'block';
      }
    } catch (eks3) { console.error(eks3); }
    /* Same fold problem as DPHE — the results sit below the 3D preview, so a
       successful run changes nothing the engineer can see. */
    if (typeof window.aroRevealResults === 'function') window.aroRevealResults('phe-results');
    var tag = $('phe-3dtag'); if (tag) tag.textContent = r.N + ' plates · ' + (r.N - 1) + ' channels · ' + U(r.Q / 1000, 'heat-duty', 0) + ' · ' + (val('phe-ptype', 'Chevron') );
    // 3D nozzle labels reflect the user's hot/cold fluid names live
    var nl = function (id, t) { var e = $(id); if (e) e.innerHTML = t; };
    var hn = r.nozzles.hotName.split(' (')[0], cn = r.nozzles.coldName.split(' (')[0];
    var dpmm = Math.round(r.Dp * 1000);
    var tC = function (siT) { return U(siT, 'temperature', 0); };
    nl('phe-noz-hin', '▸ HOT IN · ' + hn + '<br><span style="font-weight:400;">' + tC(r.hot.tin) + ' · DN' + dpmm + '</span>');
    nl('phe-noz-hout', '◂ HOT OUT · ' + hn + '<br><span style="font-weight:400;">' + tC(r.hot.tout) + ' · DN' + dpmm + '</span>');
    nl('phe-noz-cin', 'COLD IN · ' + cn + ' ◂<br><span style="font-weight:400;">' + tC(r.cold.tin) + ' · DN' + dpmm + '</span>');
    nl('phe-noz-cout', 'COLD OUT · ' + cn + ' ▸<br><span style="font-weight:400;">' + tC(r.cold.tout) + ' · DN' + dpmm + '</span>');
    update3D(r);
    renderGraphs(r);
    designAdvisor(r); wireOptimizer();
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
    /* Hand the scene to the 3D panel so its VIEW bar turns THIS
       picture when ANALYTICAL is the one on screen. */
    try { if (window.ARO3DI && window.ARO3DI.registerLegacy)
      window.ARO3DI.registerLegacy('phe', function () { return three; }); } catch (e) {}
    place();
    // orbit
    var down = null;
    canvas.addEventListener('mousedown', function (e) { down = { x: e.clientX, y: e.clientY, th: sph.theta, ph: sph.phi }; });
    window.addEventListener('mousemove', function (e) {
      if (!down) return; sph.theta = down.th - (e.clientX - down.x) * 0.01; sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, down.ph - (e.clientY - down.y) * 0.01)); place();
    });
    window.addEventListener('mouseup', function () { down = null; });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(6, Math.min(80, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); place(); }, { passive: false });
    /* This loop drew, and re-measured every nozzle label, on every frame of
       every tab — including the ones where the plate pack is not on screen.
       updateNozzleLabels() reads element boxes, so the cost was a forced
       layout sixty times a second for a canvas nobody was looking at, which
       is felt across the whole page rather than just here. The render gate
       answers from an IntersectionObserver record and costs nothing to ask;
       the loop keeps requesting frames, so it resumes the instant the
       exchanger is back in view. */
    (function loop() {
      requestAnimationFrame(loop);
      if (window.AROVIS && window.AROVIS.supported) { if (!window.AROVIS.visible(canvas)) return; }
      else if (!canvas.offsetParent) return;
      if (three && three.animFlow) three.animFlow();
      rn.render(scene, cam);
      updateNozzleLabels();
    })();
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
    three.animFlow = null;                           // stop any previous flow animation
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var flow = pheView === 'flow';                   // internal-flow visibility mode
    var N = Math.min(r.N, flow ? 24 : 80);           // cap visual plate count for perf
    var ptype = val('phe-ptype', 'Chevron (Herringbone)');
    // plate type visibly changes the model: wide-gap → bigger pitch, brazed/
    // welded → no bolted frame (compact block), free-flow → wider channels
    var pitchMul = /Wide-Gap|Free-Flow/.test(ptype) ? 1.7 : 1.0;
    var brazed = /Brazed|Fully-Welded/.test(ptype);
    var pitch = Math.max(0.18, r.pitch * 90) * pitchMul * (flow ? 1.9 : 1.0);
    var PW = 5.2, PH = 8.5, PT = 0.09;
    var packW = N * pitch;
    var x0 = -packW / 2;
    var plOp = flow ? 0.14 : 0.92, frOp = flow ? 0.22 : 1.0;
    var steel = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.9, roughness: 0.35, transparent: flow, opacity: flow ? 0.35 : 1 });
    var frameMat = new THREE.MeshStandardMaterial({ color: brazed ? 0x64748b : 0x1e3a8a, metalness: 0.7, roughness: 0.4, transparent: flow, opacity: frOp });
    var hotMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.5, transparent: true, opacity: plOp });
    var coldMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4, roughness: 0.5, transparent: true, opacity: plOp });
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

    // ── INTERNAL FLOW: animated hot/cold streams weaving through the channels ──
    if (flow) {
      var counter = r.counter, yBot = 1.2, yTop = PH + 0.2;
      var chans = Math.min(10, Math.max(4, Math.floor(N / 2)));
      var sphGeo = new THREE.SphereGeometry(0.17, 8, 8);
      var hotDot = new THREE.MeshBasicMaterial({ color: 0xff5a5a });
      var coldDot = new THREE.MeshBasicMaterial({ color: 0x5b9dff });
      var parts = [];
      for (var cc = 0; cc < chans; cc++) {
        var cx = x0 + (cc + 0.6) / chans * packW;
        var isHot = cc % 2 === 0;
        // hot: top→bottom; cold: bottom→top (counter) or top→bottom (co-current)
        var dir = isHot ? -1 : (counter ? 1 : -1);
        for (var kk = 0; kk < 5; kk++) {
          var mesh = new THREE.Mesh(sphGeo, isHot ? hotDot : coldDot);
          g.add(mesh);
          parts.push({ mesh: mesh, cx: cx, dir: dir, isHot: isHot, t: kk / 5 });
        }
        // static direction arrow on each channel (up = cold, down = hot) so the
        // counter-current pattern reads like the industrial working diagram
        var ac = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), new THREE.MeshBasicMaterial({ color: isHot ? 0xff5a5a : 0x5b9dff }));
        ac.position.set(cx, PH / 2 + 0.6, 0); ac.rotation.x = dir > 0 ? 0 : Math.PI; g.add(ac);
      }
      // direction arrows at the four ports (cones) — show IN / OUT
      function arrow(y, z, col, up) {
        var a = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 12), new THREE.MeshBasicMaterial({ color: col }));
        a.position.set(x0 - 1.0, y, z); a.rotation.x = up ? 0 : Math.PI; g.add(a);
      }
      arrow(PH + 0.6, PW / 2 - 0.8, 0xff5a5a, false);   // hot in (down)
      arrow(0.7, PW / 2 - 0.8, 0xff5a5a, false);        // hot out
      arrow(0.7, -PW / 2 + 0.8, 0x5b9dff, true);        // cold in (up)
      arrow(PH + 0.6, -PW / 2 + 0.8, 0x5b9dff, true);   // cold out
      three.animFlow = function () {
        for (var i2 = 0; i2 < parts.length; i2++) {
          var p = parts[i2];
          p.t += 0.007 * (p.isHot ? 1.0 : 0.9);
          if (p.t > 1) p.t -= 1;
          var yy = p.dir > 0 ? (yBot + p.t * (yTop - yBot)) : (yTop - p.t * (yTop - yBot));
          var cz = Math.sin(p.t * Math.PI * 5 + (p.isHot ? 0 : 1.6)) * (PW * 0.32);
          p.mesh.position.set(p.cx, yy, cz);
        }
      };
    }
    three.sph.tx = x0 + packW / 2; three.sph.r = Math.max(18, packW * 1.7 + 12); three.place();
  }

  /* ─────────── temperature-profile graph ─────────── */
  // series toggle state (shared by every PHE graph); clicking a legend chip
  // hides/shows that series — single or multiple, live across re-renders.
  var GHIDE = {};
  // clickable SVG legend chip bound to a series key
  function legChip(x, y, key, label, color, dashed) {
    return '<g class="phe-legchip" data-ser="' + key + '" style="cursor:pointer;">'
      + '<rect x="' + x + '" y="' + (y - 8) + '" width="16" height="5" rx="1" fill="' + color + '"' + (dashed ? ' stroke="' + color + '" stroke-dasharray="3 2"' : '') + '/>'
      + '<text x="' + (x + 21) + '" y="' + (y - 2) + '" fill="#cbd5e1" font-size="10">' + label + '</text></g>';
  }
  // apply hide/show state to every rendered graph (panel + modal + report)
  function applyGraphToggles(root) {
    (root || document).querySelectorAll('[data-ser]').forEach(function (el) {
      var k = el.getAttribute('data-ser'), hidden = !!GHIDE[k];
      if (el.classList.contains('phe-legchip')) {
        el.style.opacity = hidden ? '0.35' : '1';
        el.querySelectorAll('text').forEach(function (t) { t.style.textDecoration = hidden ? 'line-through' : 'none'; });
      } else {
        el.style.display = hidden ? 'none' : '';
      }
    });
  }
  var _ghWired = false;
  function wireGraphToggles() {
    if (_ghWired) return; _ghWired = true;
    document.addEventListener('click', function (e) {
      var g = e.target.closest ? e.target.closest('.phe-legchip') : null;
      if (!g) return;
      var k = g.getAttribute('data-ser'); GHIDE[k] = !GHIDE[k];
      applyGraphToggles();
    });
  }

  // ── temperature profile SVG ──
  function gTempProfile(r) {
    var W = 720, H = 380, pad = 58;
    // Converted once here, not just in the labels — the axis scale itself has
    // to be built from display-unit values, or a US/CGS reader gets a
    // correctly-labelled axis with the SI-scaled plot underneath it.
    var hTin = fromSIval(r.hot.tin, 'temperature'), hTout = fromSIval(r.hot.tout, 'temperature');
    var cTin = fromSIval(r.cold.tin, 'temperature'), cTout = fromSIval(r.cold.tout, 'temperature');
    var tsym = unitSym('temperature', '°C');
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:#0b1220;border-radius:8px;font-family:monospace;">';
    s += '<text x="' + (W / 2) + '" y="24" fill="#38bdf8" font-size="14" font-weight="800" text-anchor="middle">TEMPERATURE PROFILE — ' + val('phe-tag', 'PHE-101') + '</text>';
    var tmax = Math.max(hTin, cTout) + 8, tmin = Math.min(hTout, cTin) - 8;
    function X(f) { return pad + f * (W - 2 * pad); }
    function Y(T) { return (H - pad) - (T - tmin) / (tmax - tmin) * (H - 2 * pad); }
    s += '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" stroke="#334155"/>';
    s += '<line x1="' + pad + '" y1="' + pad + '" x2="' + pad + '" y2="' + (H - pad) + '" stroke="#334155"/>';
    for (var g5 = 0; g5 <= 5; g5++) { var T = tmin + g5 / 5 * (tmax - tmin); s += '<line x1="' + pad + '" y1="' + Y(T) + '" x2="' + (W - pad) + '" y2="' + Y(T) + '" stroke="#1e293b"/><text x="' + (pad - 6) + '" y="' + (Y(T) + 3) + '" fill="#64748b" font-size="10" text-anchor="end">' + T.toFixed(0) + '</text>'; }
    s += '<g data-ser="t_hot"><polyline points="' + X(0) + ',' + Y(hTin) + ' ' + X(1) + ',' + Y(hTout) + '" fill="none" stroke="#ef4444" stroke-width="3"/>';
    s += '<text x="' + (X(0.02)) + '" y="' + (Y(hTin) - 6) + '" fill="#ef4444" font-size="11">HOT ' + hTin.toFixed(0) + '→' + hTout.toFixed(0) + tsym + '</text></g>';
    s += '<g data-ser="t_cold">';
    if (r.counter) s += '<polyline points="' + X(0) + ',' + Y(cTout) + ' ' + X(1) + ',' + Y(cTin) + '" fill="none" stroke="#3b82f6" stroke-width="3"/>';
    else s += '<polyline points="' + X(0) + ',' + Y(cTin) + ' ' + X(1) + ',' + Y(cTout) + '" fill="none" stroke="#3b82f6" stroke-width="3"/>';
    s += '<text x="' + (X(0.55)) + '" y="' + (Y(cTin) + 16) + '" fill="#3b82f6" font-size="11">COLD ' + cTin.toFixed(0) + '→' + cTout.toFixed(0) + tsym + '</text></g>';
    s += '<text x="' + X(0.5) + '" y="' + (H - 18) + '" fill="#94a3b8" font-size="11" text-anchor="middle">Length fraction →</text>';
    /* Was y=pad+2 — the top gridline drawn just above (g5 loop, T=tmax)
       sits at exactly y=pad, so this text's own ~11px height straddled
       it: a line struck through "LMTD ... ΔTm ...", not beside it.
       pad-10 clears the plot area entirely, in the same margin the
       title already uses. */
    s += '<text x="' + (W - pad) + '" y="' + (pad - 10) + '" fill="#22c55e" font-size="11" text-anchor="end">LMTD ' + U(r.lmtd, 'temp-diff', 1) + ' · ΔTm ' + U(r.dTm, 'temp-diff', 1) + '</text>';
    // clickable legend
    s += legChip(pad, 42, 't_hot', 'HOT stream', '#ef4444') + legChip(pad + 130, 42, 't_cold', 'COLD stream', '#3b82f6');
    s += '</svg>';
    return s;
  }

  // ── heat-transfer coefficient bar chart (h hot / h cold / clean U / design U vs assumed band) ──
  function gCoeffs(r) {
    var W = 720, H = 300, padL = 60, padB = 46, padT = 44;
    var uLo = fromSIval(r.uSug.lo, 'htc'), uHi = fromSIval(r.uSug.hi, 'htc');
    var items = [
      { l: 'U₀ assumed', v: (uLo + uHi) / 2, c: '#64748b', k: 'c_uassm' },
      { l: 'h hot film', v: fromSIval(r.H.h, 'htc'), c: '#ef4444', k: 'c_hhot' },
      { l: 'h cold film', v: fromSIval(r.C.h, 'htc'), c: '#3b82f6', k: 'c_hcold' },
      { l: 'Clean U', v: fromSIval(r.Uclean, 'htc'), c: '#38bdf8', k: 'c_uclean' },
      { l: 'Design U', v: fromSIval(r.Ud, 'htc'), c: r.uInBand ? '#22c55e' : '#f59e0b', k: 'c_udesign' }
    ];
    var vmax = Math.max.apply(null, items.map(function (i) { return i.v; }).concat([uHi])) * 1.15;
    var plotW = W - padL - 20, plotH = H - padT - padB, x0 = padL, y0 = H - padB;
    function BY(v) { return y0 - v / vmax * plotH; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:#0b1220;border-radius:8px;font-family:monospace;margin-top:12px;">';
    s += '<text x="' + (W / 2) + '" y="22" fill="#f59e0b" font-size="14" font-weight="800" text-anchor="middle">HEAT-TRANSFER COEFFICIENTS (' + unitSym('htc', 'W/m²·°C') + ')</text>';
    for (var g = 0; g <= 4; g++) { var vv = g / 4 * vmax; var yy = BY(vv); s += '<line x1="' + x0 + '" y1="' + yy + '" x2="' + (W - 20) + '" y2="' + yy + '" stroke="#1e293b"/><text x="' + (x0 - 6) + '" y="' + (yy + 3) + '" fill="#64748b" font-size="9" text-anchor="end">' + Math.round(vv).toLocaleString() + '</text>'; }
    // assumed U band shaded across the plot
    s += '<rect x="' + x0 + '" y="' + BY(uHi) + '" width="' + plotW + '" height="' + (BY(uLo) - BY(uHi)) + '" fill="rgba(34,197,94,0.12)" stroke="#22c55e" stroke-dasharray="4 3"/>';
    s += '<text x="' + (W - 24) + '" y="' + (BY(uHi) - 4) + '" fill="#22c55e" font-size="9" text-anchor="end">assumed band ' + Math.round(uLo) + '–' + Math.round(uHi) + '</text>';
    var bw = plotW / items.length * 0.55, gap = plotW / items.length;
    items.forEach(function (it, i) {
      var cx = x0 + gap * i + gap * 0.22;
      s += '<g data-ser="' + it.k + '"><rect x="' + cx + '" y="' + BY(it.v) + '" width="' + bw + '" height="' + (y0 - BY(it.v)) + '" fill="' + it.c + '" rx="2"/>';
      s += '<text x="' + (cx + bw / 2) + '" y="' + (BY(it.v) - 5) + '" fill="#e2e8f0" font-size="10" text-anchor="middle" font-weight="700">' + Math.round(it.v).toLocaleString() + '</text>';
      s += '<text x="' + (cx + bw / 2) + '" y="' + (y0 + 15) + '" fill="#94a3b8" font-size="9.5" text-anchor="middle">' + it.l + '</text></g>';
    });
    s += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + (W - 20) + '" y2="' + y0 + '" stroke="#334155"/>';
    // clickable legend (toggle any bar on/off)
    items.forEach(function (it, i) { s += legChip(x0 + i * 132, 38, it.k, it.l, it.c); });
    s += '<text x="' + (W / 2) + '" y="' + (H - 6) + '" fill="#64748b" font-size="9.5" text-anchor="middle">Design U ' + (r.uInBand ? 'within' : 'OUTSIDE') + ' the ' + r.uSug.basis.toLowerCase() + ' band · fouling allowance ' + Math.round((1 - r.Ud / r.Uclean) * 100) + '%</text>';
    return s + '</svg>';
  }

  // ── ΔP & velocity vs % of design flow (both streams sweep 50–150%) ──
  function gDpSweep(r) {
    var W = 720, H = 320, padL = 58, padR = 58, padB = 46, padT = 44;
    var plotW = W - padL - padR, plotH = H - padT - padB, x0 = padL, y0 = H - padB;
    var fracs = []; for (var f = 50; f <= 150; f += 10) fracs.push(f);
    var dpsym = unitSym('press-drop-kpa', 'kPa'), vsym = unitSym('velocity', 'm/s');
    var dpH0 = fromSIval(r.dpH.dp, 'press-drop-kpa'), dpC0 = fromSIval(r.dpC.dp, 'press-drop-kpa');
    var lim = fromSIval(Math.max(r.dpHa, r.dpCa), 'press-drop-kpa');
    var vHot0 = fromSIval(r.nozzles.hotIn.v, 'velocity'), vCold0 = fromSIval(r.nozzles.coldIn.v, 'velocity');
    var dpMax = Math.max(dpH0, dpC0) * Math.pow(1.5, 1.75) * 1.15; dpMax = Math.max(dpMax, lim * 1.1);
    var vMax = Math.max(vHot0, vCold0) * 1.6 * 1.15 || 3;
    function PX(fr) { return x0 + (fr - 50) / 100 * plotW; }
    function DY(dp) { return y0 - dp / dpMax * plotH; }
    function VY(v) { return y0 - v / vMax * plotH; }
    function dpAt(dp0, fr) { return dp0 * Math.pow(fr / 100, 1.75); }
    function vAt(v0, fr) { return v0 * (fr / 100); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:#0b1220;border-radius:8px;font-family:monospace;margin-top:12px;">';
    s += '<text x="' + (W / 2) + '" y="22" fill="#38bdf8" font-size="14" font-weight="800" text-anchor="middle">ΔP &amp; PORT VELOCITY vs % OF DESIGN FLOW</text>';
    for (var g = 0; g <= 4; g++) { var dv = g / 4 * dpMax; var yy = DY(dv); s += '<line x1="' + x0 + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="#1e293b"/><text x="' + (x0 - 6) + '" y="' + (yy + 3) + '" fill="#64748b" font-size="9" text-anchor="end">' + Math.round(dv) + '</text><text x="' + (W - padR + 6) + '" y="' + (yy + 3) + '" fill="#64748b" font-size="9">' + (g / 4 * vMax).toFixed(1) + '</text>'; }
    for (var gx = 50; gx <= 150; gx += 25) { s += '<text x="' + PX(gx) + '" y="' + (y0 + 16) + '" fill="#64748b" font-size="9" text-anchor="middle">' + gx + '%</text><line x1="' + PX(gx) + '" y1="' + padT + '" x2="' + PX(gx) + '" y2="' + y0 + '" stroke="#111c30"/>'; }
    // allowable ΔP limit line
    s += '<line x1="' + x0 + '" y1="' + DY(lim) + '" x2="' + (W - padR) + '" y2="' + DY(lim) + '" stroke="#f43f5e" stroke-width="1.4" stroke-dasharray="6 4"/><text x="' + (x0 + 6) + '" y="' + (DY(lim) - 4) + '" fill="#f43f5e" font-size="9">allowable ΔP ' + Math.round(lim) + ' ' + dpsym + '</text>';
    function poly(fn, col, w, dash) { var pts = fracs.map(function (fr) { return PX(fr) + ',' + fn(fr); }).join(' '); return '<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; }
    s += '<g data-ser="d_dphot">' + poly(function (fr) { return DY(dpAt(dpH0, fr)); }, '#ef4444', 2.4) + '<circle cx="' + PX(100) + '" cy="' + DY(dpH0) + '" r="4" fill="#ef4444"/></g>';
    s += '<g data-ser="d_dpcold">' + poly(function (fr) { return DY(dpAt(dpC0, fr)); }, '#3b82f6', 2.4) + '<circle cx="' + PX(100) + '" cy="' + DY(dpC0) + '" r="4" fill="#3b82f6"/></g>';
    s += '<g data-ser="d_velhot">' + poly(function (fr) { return VY(vAt(vHot0, fr)); }, '#f59e0b', 1.8, '5 3') + '</g>';
    s += '<g data-ser="d_velcold">' + poly(function (fr) { return VY(vAt(vCold0, fr)); }, '#a855f7', 1.8, '5 3') + '</g>';
    s += '<text x="' + (W / 2) + '" y="' + (H - 6) + '" fill="#94a3b8" font-size="9.5" text-anchor="middle">% of design flow (both streams) · left axis ΔP (' + dpsym + ') · right axis velocity (' + vsym + ')</text>';
    // clickable legend
    var lg = [['ΔP hot', '#ef4444', 'd_dphot', 0], ['ΔP cold', '#3b82f6', 'd_dpcold', 0], ['Vel hot', '#f59e0b', 'd_velhot', 1], ['Vel cold', '#a855f7', 'd_velcold', 1]];
    lg.forEach(function (L, i) { s += legChip(x0 + i * 128, 38, L[2], L[0], L[1], L[3]); });
    return s + '</svg>';
  }

  // full graph pack (coupled to the current design) — used in output panel, modal & report
  function buildGraphs(r) { return gTempProfile(r) + gCoeffs(r) + gDpSweep(r); }

  // render the live graphs into the output panel (auto-updates on every calc)
  function renderGraphs(r) {
    var box = $('phe-graphs'); if (!box) return;
    if (!r || !isFinite(r.N)) { box.innerHTML = ''; return; }
    box.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:4px 0 6px;border-top:1px solid var(--border-muted);padding-top:10px;">PERFORMANCE GRAPHS — LIVE (auto-updates · click a legend to hide/show series)</div>' + buildGraphs(r);
    wireGraphToggles(); applyGraphToggles(box);
  }

  function graph() {
    var r = LAST || compute();
    /* modal()'s third argument turns on its own "⬇ PDF" button — already
       built and already wired (AROPDF against #phe-mbody), just never
       passed true from here, so DPHE/STHE's report modals could export
       and this graph modal quietly couldn't. */
    modal('PHE — PERFORMANCE, ΔP &amp; U₀ DESIGN CRITERIA', '<div style="font-family:monospace;font-size:10px;color:#94a3b8;margin-bottom:6px;">Click any legend chip to hide/show that series (single or multiple).</div>' + buildGraphs(r), true, false);
    wireGraphToggles(); applyGraphToggles();
  }

  /* ─────────── manufacturing drawing (SVG) ─────────── */
  /* The sheet builder. It used to be the whole of drawing(), which opened its
     own modal and returned nothing — so the platform's 2D DRAWING control had
     no way to reach it and reported NO DRAWING FOR THIS MODULE YET while a
     complete fabrication sheet sat one button away. Split so both callers can
     have it: this builds, drawing() presents. */
  function buildDrawing() {
    var r = LAST || compute();
    if (!r) return null;
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

    svgW = 1540; svgH = 1120;
    // derived envelope (mm) coupled to the design
    var Wframe = Wp + 60, Hframe = Lp + 140, Ltot = totLen, Ctie = Math.max(1, Ltot - 40);
    var DN = Dp, flOD = Math.round(DN * 1.8 + 30), flID = +(DN * 1.2 + 6).toFixed(1);
    // balloon (item bubble) with leader line
    function bln(cx, cy, n, lx0, ly0) {
      var o = '';
      if (lx0 !== undefined) o += line(lx0, ly0, cx, cy, 0.6, '#0f172a');
      o += '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="#fff" stroke="#0f172a" stroke-width="1"/>' + txt(cx, cy + 3, n, 8.5, '#0f172a', 'middle', '700');
      return o;
    }
    // framed panel with a header strip
    function panel(x, y, w, h, title) {
      return rect(x, y, w, h, '#fff', '#0f172a', 1.2) + txt(x + 8, y + 15, title, 10.5, '#0f172a', 'start', '800');
    }
    function ctr(x, y, rr) { return '<circle cx="' + x + '" cy="' + y + '" r="' + rr + '" fill="#fff" stroke="#0f172a" stroke-width="1.2"/><line x1="' + (x - rr - 3) + '" y1="' + y + '" x2="' + (x + rr + 3) + '" y2="' + y + '" stroke="#0f172a" stroke-width="0.4"/><line x1="' + x + '" y1="' + (y - rr - 3) + '" x2="' + x + '" y2="' + (y + rr + 3) + '" stroke="#0f172a" stroke-width="0.4"/>'; }

    var s = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%;background:#fff;font-family:Arial;">';
    s += rect(0, 0, svgW, svgH, '#fff', '#0f172a', 2);

    /* ═════ 1 · GENERAL ARRANGEMENT (front + side views) ═════ */
    s += panel(16, 16, 1080, 540, '1 · GENERAL ARRANGEMENT');

    // ---- FRONT VIEW ----
    var fx = 90, fy = 150, fw = 160, fh = 340;
    s += txt(fx + fw / 2, 100, 'FRONT VIEW', 10, '#0f172a', 'middle', '700');
    s += rect(fx, fy, fw, fh, '#f8fafc', '#0f172a', 1.4);
    s += rect(fx + 12, fy + 12, fw - 24, fh - 24, 'none', '#94a3b8', 0.5);
    // 4 nozzles: H1 IN (hot in) TL, H2 OUT (cold out) TR, H2 IN (cold in) BL, H1 OUT (hot out) BR
    var nfr = [[fx + 46, fy + 62, '#dc2626'], [fx + fw - 46, fy + 62, '#2563eb'], [fx + 46, fy + fh - 62, '#2563eb'], [fx + fw - 46, fy + fh - 62, '#dc2626']];
    nfr.forEach(function (n) { s += '<circle cx="' + n[0] + '" cy="' + n[1] + '" r="18" fill="#fff" stroke="' + n[2] + '" stroke-width="1.6"/><circle cx="' + n[0] + '" cy="' + n[1] + '" r="10" fill="none" stroke="' + n[2] + '" stroke-width="1"/>';
      [[-12, 0], [12, 0], [0, -12], [0, 12]].forEach(function (d) { s += '<circle cx="' + (n[0] + d[0]) + '" cy="' + (n[1] + d[1]) + '" r="2" fill="none" stroke="' + n[2] + '"/>'; });
    });
    s += txt(nfr[0][0], nfr[0][1] + 34, 'H1 IN', 8.5, '#dc2626', 'middle', '700');
    s += txt(nfr[1][0], nfr[1][1] + 34, 'H2 OUT', 8.5, '#2563eb', 'middle', '700');
    s += txt(nfr[2][0], nfr[2][1] - 28, 'H2 IN', 8.5, '#2563eb', 'middle', '700');
    s += txt(nfr[3][0], nfr[3][1] - 28, 'H1 OUT', 8.5, '#dc2626', 'middle', '700');
    // feet
    s += rect(fx + 14, fy + fh, 36, 14, '#e2e8f0', '#0f172a', 1) + rect(fx + fw - 50, fy + fh, 36, 14, '#e2e8f0', '#0f172a', 1);
    // dims: width (top), height (left), inner span (bottom)
    s += dim(fx, 128, fx + fw, 128, String(Wframe));
    s += dim(fx - 42, fy, fx - 42, fy + fh, String(Hframe));
    s += dim(fx + 14, fy + fh + 34, fx + fw - 14, fy + fh + 34, String(Wframe - 60));
    // balloons
    s += bln(fx - 8, fy + 8, '1', fx + 6, fy + 16);
    s += bln(fx + fw / 2, fy + 34, '5', nfr[1][0] - 14, nfr[1][1]);

    // ---- SIDE VIEW ----
    var sx = 350, sy = 150, sh = 340, packW = Math.min(240, Math.max(120, r.N * 3));
    var pkx = sx + 26, ppx = pkx + packW + 6;
    s += txt(sx + (60 + packW) / 2, 100, 'SIDE VIEW', 10, '#0f172a', 'middle', '700');
    s += rect(sx - 12, sy - 14, packW + 96, 8, '#e2e8f0', '#0f172a', 1);      // top carry bar (3)
    s += rect(sx - 12, sy + sh + 6, packW + 96, 8, '#e2e8f0', '#0f172a', 1);  // bottom carry bar (4)
    s += rect(sx, sy, 18, sh, '#cbd5e1', '#0f172a', 1.4);                     // fixed frame
    s += rect(pkx, sy + 8, packW, sh - 16, '#f1f5f9', '#0f172a', 1);          // plate pack
    var nlines = Math.min(52, Math.max(10, r.N));
    for (var i = 0; i < nlines; i++) { var px = pkx + 3 + i * ((packW - 6) / nlines); s += line(px, sy + 8, px, sy + sh - 8, 0.7, '#94a3b8'); }
    s += rect(ppx, sy, 18, sh, '#cbd5e1', '#0f172a', 1.4);                    // pressure plate
    var nTie = Math.min(4, Math.max(2, Math.ceil(r.nBolts / 4)));
    for (var tb = 0; tb < nTie; tb++) { var by = sy + 54 + tb * (sh - 108) / (nTie - 1 || 1); s += line(sx - 16, by, ppx + 32, by, 2.2, '#334155'); s += '<circle cx="' + (ppx + 32) + '" cy="' + by + '" r="4" fill="none" stroke="#0f172a"/>'; }
    [[sy + 62, '#dc2626'], [sy + sh - 62, '#2563eb']].forEach(function (n) { s += rect(sx - 34, n[0] - 10, 18, 20, '#fff', n[1], 1.4) + '<circle cx="' + (sx - 40) + '" cy="' + n[0] + '" r="3" fill="none" stroke="' + n[1] + '"/>'; });
    s += rect(sx + 4, sy + sh + 16, 30, 14, '#e2e8f0', '#0f172a', 1) + rect(ppx - 8, sy + sh + 16, 30, 14, '#e2e8f0', '#0f172a', 1);
    // dims: L (top) ±5, C (bottom) ±5, height (right)
    s += dim(sx, 128, ppx + 18, 128, 'L ±5 = ' + Ltot);
    s += dim(sx - 16, sy + sh + 44, ppx + 32, sy + sh + 44, 'C ±5 = ' + Ctie);
    s += dim(ppx + 48, sy, ppx + 48, sy + sh, String(Hframe - 140));
    // balloons (kept off the title/dimension zones)
    s += bln(sx - 28, sy - 10, '3', sx - 14, sy - 10);
    s += bln(sx - 28, sy + sh + 10, '4', sx - 14, sy + sh + 10);
    s += bln(pkx + 22, sy + 26, '6', pkx + 8, sy + 12);
    s += bln(ppx + 9, sy + sh - 30, '2', ppx + 9, sy + sh - 42);
    s += bln(ppx + 50, sy + 54, '10', ppx + 36, sy + 54);

    /* ═════ 4 · TOP VIEW ═════ */
    s += panel(16, 568, 528, 156, '4 · TOP VIEW');
    var tx = 96, ty = 624, tw = 400, th = 66;
    s += rect(tx, ty, 16, th, '#cbd5e1', '#0f172a', 1.2);
    s += rect(tx + 22, ty + 8, tw - 60, th - 16, '#f1f5f9', '#0f172a', 1);
    for (var it = 0; it < 34; it++) { var ix = tx + 26 + it * ((tw - 68) / 34); s += line(ix, ty + 8, ix, ty + th - 8, 0.6, '#94a3b8'); }
    s += rect(tx + tw - 34, ty, 16, th, '#cbd5e1', '#0f172a', 1.2);
    s += rect(tx - 24, ty + 20, 24, 14, '#fff', '#dc2626', 1.3) + rect(tx - 24, ty + th - 34, 24, 14, '#fff', '#2563eb', 1.3);
    s += dim(tx + tw + 16, ty, tx + tw + 16, ty + th, String(Wframe - 60));

    /* ═════ DESIGN DATA ═════ */
    var dx = 566, dy = 574;
    s += txt(dx + 175, dy + 4, 'DESIGN DATA', 11, '#0f172a', 'middle', '800');
    s += table(dx, dy + 14, [150, 100, 100], [
      ['SERVICE', hName, cName],
      ['Fluid (H1 / H2)', 'HOT', 'COLD'],
      ['Inlet temperature', U(r.hot.tin, 'temperature', 0), U(r.cold.tin, 'temperature', 0)],
      ['Outlet temperature', U(r.hot.tout, 'temperature', 0), U(r.cold.tout, 'temperature', 0)],
      ['Flow rate', U(q_h, 'vol-flow', 1), U(q_c, 'vol-flow', 1)],
      ['Design pressure', UG(r.Pdes, 1), UG(r.Pdes, 1)],
      ['Test pressure', UG(r.Phydro, 1), UG(r.Phydro, 1)],
      ['ΔP (hot / cold)', U(r.dpH.dp, 'press-drop-kpa', 1), U(r.dpC.dp, 'press-drop-kpa', 1)],
      ['Design temperature', U(Math.max(r.hot.tin, r.cold.tout) + 20, 'temperature', 0), ''],
      ['Plate material', pmat, ''],
      ['Gasket material', gsk, ''],
      ['No. of plates (N)', String(r.N), ''],
      ['Heat transfer area', U(r.Aprov, 'area', 1), ''],
      ['Heat load', U(r.Q / 1000, 'heat-duty', 0), '']
    ], true);

    /* ═════ NOZZLE SIZE & RATING + OPERATING DATA (left column, below top view) ═════ */
    // DN is a metric nominal-diameter standard, kept in mm regardless of unit
    // system (the drawing's own note 2 states "all dimensions are in
    // millimetres" — an equipment fabrication standard, not a process value).
    var nzx = 40, nzy = 748;
    s += txt(nzx + 210, nzy + 2, 'NOZZLE SIZE & RATING', 11, '#0f172a', 'middle', '800');
    s += table(nzx, nzy + 12, [130, 150, 140], [
      ['SERVICE', 'NOZZLE SIZE', 'RATING'],
      ['H1 IN / OUT', 'DN ' + DN, 'ANSI B16.5 CL 150'],
      ['H2 IN / OUT', 'DN ' + DN, 'ANSI B16.5 CL 150']
    ], true);
    s += txt(nzx + 210, nzy + 86, 'OPERATING DATA', 11, '#0f172a', 'middle', '800');
    s += table(nzx, nzy + 96, [280, 140], [
      ['MAX. OPERATING PRESSURE', UG(r.Pdes, 1)],
      ['MAX. OPERATING TEMPERATURE', U(Math.max(r.hot.tin, r.cold.tout), 'temperature', 0)],
      ['OPERATING WEIGHT (WET)', U(r.wOper, 'mass', 0)]
    ], false);

    /* ═════ 2 · PLATE DETAIL (TYP.) ═════ */
    s += panel(1112, 16, 412, 360, '2 · PLATE DETAIL (TYP.)');
    var plx = 1156, ply = 92, plw = 150, plh = 228;
    s += '<rect x="' + plx + '" y="' + ply + '" width="' + plw + '" height="' + plh + '" rx="18" fill="#eef2f7" stroke="#0f172a" stroke-width="1.3"/>';
    for (var c = 0; c < 16; c++) { var yy = ply + 22 + c * (plh - 44) / 16; s += '<polyline points="' + plx + ',' + yy + ' ' + (plx + plw / 2) + ',' + (yy + 9) + ' ' + (plx + plw) + ',' + yy + '" fill="none" stroke="#94a3b8" stroke-width="1"/>'; }
    [[plx + 30, ply + 30], [plx + plw - 30, ply + 30], [plx + 30, ply + plh - 30], [plx + plw - 30, ply + plh - 30]].forEach(function (p) { s += ctr(p[0], p[1], 15); });
    s += dim(plx, ply - 20, plx + plw, ply - 20, String(Wp));
    s += dim(plx - 26, ply, plx - 26, ply + plh, String(Lp));
    s += dim(plx + 30, ply + plh + 18, plx + plw - 30, ply + plh + 18, String(Math.round(Wp * 0.78)));
    // thickness strip to the right
    var thx = plx + plw + 54;
    s += rect(thx, ply, 10, plh, '#cbd5e1', '#0f172a', 1);
    s += txt(thx + 5, ply - 8, tmm, 8, '#dc2626', 'middle', '700');
    s += txt(thx + 5, ply + plh + 14, (r.b * 1000).toFixed(1), 8, '#dc2626', 'middle', '700');
    s += txt(plx + plw / 2 + 20, ply + plh + 44, 'β ' + r.beta + '° CHEVRON · t ' + tmm + ' mm · φ ' + r.phi.toFixed(2), 8, '#64748b', 'middle');

    /* ═════ 3 · PORT / NOZZLE DETAIL (TYP.) ═════ */
    s += panel(1112, 392, 412, 200, '3 · PORT / NOZZLE DETAIL (TYP.)');
    var ndx = 1250, ndy = 486;
    s += '<circle cx="' + ndx + '" cy="' + ndy + '" r="42" fill="#fff" stroke="#0f172a" stroke-width="1.4"/>';
    s += '<circle cx="' + ndx + '" cy="' + ndy + '" r="20" fill="#eef2f7" stroke="#0f172a" stroke-width="1.2"/>';
    for (var bh = 0; bh < 4; bh++) { var a = Math.PI / 4 + bh * Math.PI / 2; s += '<circle cx="' + (ndx + 31 * Math.cos(a)) + '" cy="' + (ndy + 31 * Math.sin(a)) + '" r="4" fill="none" stroke="#0f172a"/>'; }
    s += dim(ndx - 20, ndy - 58, ndx + 20, ndy - 58, 'Ø' + flID + ' ID');
    s += dim(ndx - 42, ndy + 58, ndx + 42, ndy + 58, 'Ø' + flOD + ' OD');
    s += txt(ndx, ndy + 84, 'DN ' + DN + ' · ANSI B16.5 CL 150 (RF / SERRATED)', 8, '#64748b', 'middle');

    /* ═════ BILL OF MATERIAL ═════ */
    var bx0 = 1112, by0 = 608;
    s += txt(bx0 + 206, by0 + 2, 'BILL OF MATERIAL (BOM)', 11, '#0f172a', 'middle', '800');
    var bom = bomRows(r, pmat, gsk, Dp);
    s += table(bx0, by0 + 12, [30, 178, 128, 32, 44], [['NO', 'DESCRIPTION', 'MATERIAL', 'QTY', 'REMARK']].concat(bom.map(function (b2, i2) { return [String(i2 + 1), b2[0], b2[1], String(b2[2]), (b2[5] || '').slice(0, 8)]; })), true);

    /* ═════ TITLE BLOCK ═════ */
    var tbx = 1112, tby = svgH - 176, tbw = 412;
    s += rect(tbx, tby, tbw, 132, '#fff', '#0f172a', 1.4);
    s += txt(tbx + tbw / 2, tby + 24, 'PLATE TYPE HEAT EXCHANGER', 12, '#0f172a', 'middle', '800');
    s += txt(tbx + tbw / 2, tby + 40, 'GENERAL ARRANGEMENT DRAWING', 11, '#0f172a', 'middle', '700');
    s += line(tbx, tby + 52, tbx + tbw, tby + 52, 0.8);
    var trows = [
      ['DRAWN BY', (val('phe-engineer', '') || '—'), 'DATE', val('phe-date', '')],
      ['CHECKED BY', '—', 'DATE', ''],
      ['SCALE', 'NTS', 'DRG. No.', (val('phe-tag', 'PHE') || 'PHE') + '-GA-001']
    ];
    trows.forEach(function (row, ri) {
      var yy = tby + 52 + ri * 22;
      s += line(tbx, yy + 22, tbx + tbw, yy + 22, 0.6);
      s += line(tbx + 96, yy, tbx + 96, yy + 22, 0.6) + line(tbx + 250, yy, tbx + 250, yy + 22, 0.6) + line(tbx + 336, yy, tbx + 336, yy + 22, 0.6);
      s += txt(tbx + 6, yy + 15, row[0], 7.5, '#64748b', 'start', '700') + txt(tbx + 102, yy + 15, row[1], 8.5, '#0f172a');
      s += txt(tbx + 256, yy + 15, row[2], 7.5, '#64748b', 'start', '700') + txt(tbx + 342, yy + 15, row[3], 8.5, '#0f172a');
    });

    /* ═════ NOTES ═════ */
    var noy = 900;
    s += txt(40, noy, 'NOTES :', 10, '#0f172a', 'start', '800');
    ['1. Number of plates (N), heat-transfer area (A) and L / C dimensions shall be as per duty (see design data).',
     '2. All dimensions are in millimetres unless otherwise specified.',
     '3. All welds to be continuous and leak-tight; gaskets clip-on and field-replaceable.',
     '4. Hydrotest at ' + UG(r.Phydro, 1) + ' (1.5 × design) as per design code (ASME Sec VIII / EN 13445).',
     '5. Property of ' + (val('phe-project', 'AROGARA FLOWSIZE') || 'AROGARA FLOWSIZE') + ' · REV. ' + (val('phe-rev', '0') || '0') + ' · not to be copied without permission.'
    ].forEach(function (nt, ni) { s += txt(40, noy + 20 + ni * 16, nt, 8.5, '#334155', 'start'); });

    s += '</svg>';

    // ── full BOM / list of materials as an HTML table under the drawing ──
    var bomHtml = '<div style="margin-top:14px;"><div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin-bottom:6px;">BILL OF MATERIAL — LIST OF MATERIALS</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Arial;"><tr style="background:#f1f5f9;">'
      + ['#', 'Item / Component', 'Material', 'Qty', 'Unit Wt (kg)', 'Standard / Spec', 'Remarks'].map(function (h) { return '<th style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;">' + h + '</th>'; }).join('') + '</tr>';
    bomRows(r, pmat, gsk, Dp).forEach(function (b2, i2) {
      bomHtml += '<tr>' + [i2 + 1, b2[0], b2[1], b2[2], b2[4], b2[3], b2[5]].map(function (x) { return '<td style="padding:4px 6px;border:1px solid #e2e8f0;">' + x + '</td>'; }).join('') + '</tr>';
    });
    bomHtml += '</table><div style="font-size:10px;color:#64748b;margin-top:6px;">Quantities and weights are computed from the current design inputs (N = ' + r.N + ' plates, ' + Math.round(r.Aprov) + ' m² area). Confirm against the plate maker\'s rating before fabrication.</div></div>';

    return { svg: s, bom: bomHtml };
  }

  function drawing() {
    var d = buildDrawing();
    if (!d) return null;
    modal('PHE — FABRICATION / GA DRAWING + BOM', d.svg + d.bom, true, true);
    return d;
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
      ['Lock washer', 'SS304', nBolt, 'DIN 127', 0.02, 'Under each nut'],
      ['Spring washer', 'SS304', nBolt, 'DIN 127', 0.02, 'Anti-loosening'],
      ['Rolling nut', 'SS304', 2, '—', 0.3, 'Rolls along guide bar'],
      ['Shroud (optional)', 'SS304', 2, '—', Math.round(r.Lp * 2), 'Protective cover'],
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
    b += '<div style="text-align:center;margin-bottom:14px;"><div style="font-size:18px;font-weight:800;color:#ea580c;">AROGARA FLOWSIZE — PLATE HEAT EXCHANGER DESIGN REPORT</div><div style="font-size:10px;color:#64748b;">AROGARA FLOWSIZE · Digital Engineering Design Platform</div></div>';
    b += sec('1 · DESIGN DATA SHEET');
    b += T([['Project', val('phe-project', '')], ['Client', val('phe-client', '')], ['Tag', val('phe-tag', '')], ['Service', val('phe-service', '')], ['Design code', val('phe-code', '')], ['Engineer', val('phe-engineer', '')], ['Date / Rev', val('phe-date', '') + ' / ' + val('phe-rev', '0')]]);
    b += sec('2–3 · FLUIDS & PROCESS');
    b += T([['Hot fluid', val('phe-hf-name', '') + ' — ' + U(r.hot.tin, 'temperature', 1) + '→' + U(r.hot.tout, 'temperature', 1) + ', ' + U(r.hot.m, 'mass-flow-s', 1)],
    ['Cold fluid', val('phe-cf-name', '') + ' — ' + U(r.cold.tin, 'temperature', 1) + '→' + U(r.cold.tout, 'temperature', 1) + ', ' + U(r.cold.m, 'mass-flow-s', 1)],
    ['Flow arrangement', r.flowCmp.best + ' (auto — counter ΔTm ' + U(r.flowCmp.counterDTm, 'temp-diff', 1) + ' vs co-current ' + U(r.flowCmp.coDTm, 'temp-diff', 1) + ')'],
    ['Plate material', r.matName + ' (k ' + U(r.mat.k, 'thermal-cond', 2) + ', S ' + U(r.mat.S, 'stress', 1) + ')']]);
    b += sec('4 · THERMAL RESULTS');
    b += T([['Heat duty Q', U(r.Q / 1000, 'heat-duty', 0)], ['Energy balance Qh/Qc', r.Qbal.toFixed(3)], ['LMTD × F', U(r.lmtd, 'temp-diff', 1) + ' × ' + r.F.toFixed(2) + ' = ' + U(r.dTm, 'temp-diff', 1)], ['Effectiveness ε / NTU', (r.eff * 100).toFixed(1) + ' % / ' + r.NTU.toFixed(2)], ['Clean / Dirty U', U(r.Uclean, 'htc', 0) + ' / ' + U(r.Ud, 'htc', 0)], ['Film h hot / cold', U(r.H.h, 'htc', 0) + ' / ' + U(r.C.h, 'htc', 0)], ['Re hot / cold', f0(r.H.Re) + ' / ' + f0(r.C.Re)]]);
    b += sec('8 · PLATE & PACK');
    b += T([['Plate size', U(r.Lp * 1000, 'length-mm', 0) + ' × ' + U(r.Wp * 1000, 'length-mm', 0) + ' × ' + U(r.t * 1000, 'length-mm', 1)], ['Chevron / φ / Dh', r.beta + '° / ' + r.phi.toFixed(2) + ' / ' + U(r.Dh * 1000, 'length-mm', 2)], ['Material / gasket', val('phe-pmat', '') + ' / ' + val('phe-gasket', '')], ['Total plates', r.N + ' (' + (r.N - 1) + ' channels, ' + r.npass + ' pass)'], ['Area req / prov', U(r.Areq, 'area', 1) + ' / ' + U(r.Aprov, 'area', 1) + ' (' + f1(r.overSurf) + ' % over)']]);
    b += sec('15 · PRESSURE DROP');
    b += T([['ΔP hot', U(r.dpH.dp, 'press-drop-kpa', 1) + ' (allow ' + U(r.dpHa, 'press-drop-kpa', 1) + ')'], ['ΔP cold', U(r.dpC.dp, 'press-drop-kpa', 1) + ' (allow ' + U(r.dpCa, 'press-drop-kpa', 1) + ')'], ['Port velocity hot / cold', U(r.dpH.vport, 'velocity', 2) + ' / ' + U(r.dpC.vport, 'velocity', 2)]]);
    b += sec('12 · MECHANICAL');
    b += T([['Design / hydrotest P', UG(r.Pdes, 1) + ' / ' + UG(r.Phydro, 1)], ['Frame / pack length', U(r.frameLen, 'length-mm', 0) + ' / ' + U(r.packLen, 'length-mm', 0)], ['Tie-bolts', r.nBolts + ' × M' + r.boltDia], ['Weight empty / operating', U(r.wEmpty, 'mass', 0) + ' / ' + U(r.wOper, 'mass', 0)]]);
    b += sec('18 · BILL OF MATERIAL (summary)');
    b += '<table style="width:100%;border-collapse:collapse;font-size:10px;"><tr style="background:#f1f5f9;">' + ['Item', 'Material', 'Qty', 'Std'].map(function (x) { return '<th style="padding:4px;border:1px solid #e2e8f0;text-align:left;">' + x + '</th>'; }).join('') + '</tr>';
    [['Heat transfer plate', val('phe-pmat', 'SS316'), r.N, 'AHRI/maker'], ['Gasket', val('phe-gasket', 'EPDM'), r.N - 1, 'clip-on'], ['Fixed frame plate', 'CS painted', 1, 'ASME VIII'], ['Pressure plate', 'CS painted', 1, 'ASME VIII'], ['Tie-bolt', 'A193 B7', r.nBolts, 'M' + r.boltDia], ['Carrying/guide bar', 'CS galv.', 2, '—'], ['Nozzle + flange', val('phe-pmat', 'SS316'), 4, 'ASME B16.5']].forEach(function (row) { b += '<tr>' + row.map(function (x) { return '<td style="padding:4px;border:1px solid #e2e8f0;">' + x + '</td>'; }).join('') + '</tr>'; });
    b += '</table>';
    b += sec('20 · PERFORMANCE GRAPHS');
    b += '<div style="background:#0b1220;border-radius:8px;padding:8px;">' + buildGraphs(r) + '</div>';
    b += sec('23 · ASSUMPTIONS & REFERENCES');
    b += '<div style="font-size:10px;color:#475569;line-height:1.6;">Counter-current F≈0.99; chevron Nu = C·Re<sup>n</sup>·Pr<sup>1/3</sup> (Martin / Wanniarachchi / Muley-Manglik, C,n by β); Dh = 2b/φ; U from series film + wall + fouling; ε-NTU per plate counter-flow; ΔP = channel (Fanning) + port (1.4 velocity heads); hydrotest 1.43× design (ASME VIII Div 1). Codes: ASME Sec VIII, EN 13445, API 662, AHRI. Property data from user inputs (auto-filled water defaults). This is a design-screening report — confirm against the maker\'s rating (Alfa Laval / GEA / Kelvion / SWEP) before purchase.</div>';
    b += '</div>';
    modal('PHE — ENGINEERING DESIGN REPORT', b, true);
  }

  /* ─────────── modal helper ─────────── */
  // Shared, reliable PDF exporter for EVERY module (pump / line / STHE / DPHE /
  // PHE). html2pdf's internal .save() does not trigger a download in this
  // runtime, so we render to a blob and download it via an anchor. Settings fit
  // the content to the page (landscape for wide drawings), avoid splitting
  // images/tables across page breaks, and force a white background.
  /* ── where to cut a page ──────────────────────────────────────────────
     Pure, so it can be tested without a browser: given the running offset y,
     the ideal slice height, the total canvas height, the protected spans (in
     CSS px) and the canvas-px-per-CSS-px scale, return the cut position.

     A cut is pulled back to the top of the highest span it would have split.
     Pulling back can land inside an earlier span, so it repeats. Below a
     floor the split is accepted: an almost empty page is worse than a split
     row, though a heading pair is allowed to push further than a row because
     an orphaned heading reads as a fault in the document.                    */
  function chooseCut(y, sliceH, canvasH, blocks, k) {
    var cut = Math.min(y + sliceH, canvasH);
    if (cut >= canvasH) return canvasH;
    var best = cut, pass = 0;
    while (pass++ < 6) {
      var cutCss = best / k, moved = false;
      for (var i = 0; i < blocks.length; i++) {
        var bk = blocks[i];
        if (cutCss > bk.t + 0.5 && cutCss < bk.b - 0.5) {
          var floor = y + sliceH * (bk.kind === 'keep' ? 0.14 : 0.25);
          var alt = Math.floor(bk.t * k);
          if (alt > floor && alt < best) { best = alt; moved = true; }
        }
      }
      if (!moved) break;
    }
    return best;
  }

  /* Selectors used by collectSpans. Kept out here so the collector can be
     tested on a synthetic document without running an export. */
  var ATOMIC_SEL = 'tr, img, canvas, .pdf-atomic, .pdf-figure, .aln-rr, .tp2-rr, .pid-rr, .res-value, .pump-res-card';
  var HEADING_SEL = 'h1, h2, h3, h4, h5, .pdf-keep-next, [data-pdf-keep-next],'
    + '.rep-h, .rep-title, .panel-title, .aln-cardh, .tk-cardh, .tp-cardh,'
    + '.pid-cardh, .sthe-cardh, .phe-cardh, .rep-section-title, .aro-doc-h';

  /* ── what must not be cut ─────────────────────────────────────────────
     Three kinds of span, in rising order of how hard they push back:

       atomic   a table row, a drawing, a small card — must not be severed
       figure   a picture together with the caption sitting above it. This is
                found by structure, not by class name: report figures are a
                plain <div> holding a title <div> and an <img>, and no naming
                convention covers every module. Naming was the reason the
                first attempt at this missed the nozzle charts — their titles
                are unclassed divs, so no selector matched them.
       keep     a heading bound to the block it introduces

     Everything is measured relative to padTop and returned in CSS px.        */
  function collectSpans(root, padTop, pageHpx) {
    var blocks = [];
    var add = function (el, kind, cap) {
      var r = el.getBoundingClientRect();
      var t = r.top - padTop, b = r.bottom - padTop;
      if (!(b - t > 2)) return;
      if (cap && b - t > cap) b = t + cap;
      blocks.push({ t: t, b: b, kind: kind });
    };

    [].slice.call(root.querySelectorAll(ATOMIC_SEL)).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.height > 2 && r.height <= pageHpx * 0.5) add(el, 'atomic');
    });

    /* A picture and its caption travel together. Climb from the picture to
       the smallest ancestor that is taller than the picture itself — that is
       the cell holding the caption — and stop before the ancestor grows past
       most of a page or starts holding a second picture. */
    [].slice.call(root.querySelectorAll('img, canvas')).forEach(function (im) {
      var ir = im.getBoundingClientRect();
      if (!(ir.height > 8)) return;
      var best = im, node = im.parentElement, guard = 0;
      while (node && node !== root && guard++ < 6) {
        var nr = node.getBoundingClientRect();
        if (nr.height > pageHpx * 0.92) break;
        if (node.querySelectorAll('img, canvas').length > 1) break;
        if (nr.height > ir.height + 2) best = node;
        node = node.parentElement;
      }
      if (best !== im) add(best, 'figure', pageHpx * 0.92);
    });

    /* A heading is a promise about what follows. Bind it to the next block
       that occupies space, and always demand a couple of lines of it, so the
       heading can never sit alone at the foot of a page. */
    [].slice.call(root.querySelectorAll(HEADING_SEL)).forEach(function (hd) {
      var hr = hd.getBoundingClientRect();
      if (!(hr.height > 1)) return;
      var nb = nextBlockOf(hd, root);
      var t = hr.top - padTop, b = hr.bottom - padTop;
      if (nb) {
        var nr = nb.getBoundingClientRect();
        if (nr.top - padTop >= t - 1) b = nr.bottom - padTop;
      }
      b = Math.max(b, t + hr.height + 46);
      if (b - t > pageHpx * 0.86) b = t + pageHpx * 0.86;
      blocks.push({ t: t, b: b, kind: 'keep' });
    });

    return blocks;
  }

  function nextBlockOf(el, root) {
    var n = el.nextElementSibling;
    while (n) {
      if (n.getBoundingClientRect().height > 2) return n;
      n = n.nextElementSibling;
    }
    var p = el.parentElement;
    if (p && p !== root) return nextBlockOf(p, root);
    return null;
  }

  /* html2pdf is 885 kB — a quarter of everything the app downloads — and it
     is only ever needed when someone exports a report. Loading it up front
     delayed the first screen for every visitor who never pressed Download.
     It is fetched on the first export instead; the button reports that it is
     preparing while that happens. */
  var _pdfLoad = null;
  function ensureHtml2Pdf() {
    if (typeof html2pdf !== 'undefined') return Promise.resolve(true);
    if (_pdfLoad) return _pdfLoad;
    _pdfLoad = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'lib/html2pdf.bundle.min.js?v=1';
      s.onload = function () { resolve(typeof html2pdf !== 'undefined'); };
      s.onerror = function () { _pdfLoad = null; resolve(false); };
      document.head.appendChild(s);
    });
    return _pdfLoad;
  }
  window.AROPDF_PRELOAD = ensureHtml2Pdf;

  window.AROPDF = function (element, filename, opts) {
    opts = opts || {};
    if (!element) return;
    filename = filename || 'report.pdf';
    if (typeof html2pdf === 'undefined') {
      // first export of the session — fetch the engine, then carry on
      return ensureHtml2Pdf().then(function (ok) {
        if (!ok) { try { window.print(); } catch (e) {} return; }
        return window.AROPDF(element, filename, opts);
      });
    }

    /* ── Fit-to-page export ────────────────────────────────────────────────
       Reports used to print with the schematic blown up and sliced across
       pages, and tables running off the right edge. Three things fix that,
       and all three have to happen before anything is rasterised:

         1 · The report is laid out in an off-screen clone whose width is
             EXACTLY the printable page width. The layout that is measured is
             the layout that prints, so nothing can overflow sideways.
         2 · Every inline <svg> is rasterised to an <img> carrying its true
             viewBox aspect ratio. html2canvas cannot measure an <svg> sized
             with width:100% and no height — it guessed, which is why drawings
             came out magnified and cropped.
         3 · Pagination is ours, not the library's: the page image is cut only
             where it would not split a table row, a drawing or a card, and
             each slice is placed at exactly the printable width.
       ─────────────────────────────────────────────────────────────────── */
    var landscape = (opts.landscape != null) ? !!opts.landscape : (element.scrollWidth > 980);
    var margin = opts.margin != null ? opts.margin : 8;
    var PW = landscape ? 297 : 210, PH = landscape ? 210 : 297;      // A4, mm
    var cW = PW - 2 * margin, cH = PH - 2 * margin;                  // printable, mm
    var PX_PER_MM = 96 / 25.4;
    var hostW = Math.round(cW * PX_PER_MM);
    var pageHpx = Math.round(cH * PX_PER_MM);
    var bg = opts.bg || '#ffffff';

    /* Zero-size, overflow-hidden wrapper: the clone inside keeps its full
       geometry for measurement but nothing shows on screen. A large negative
       offset does not work — html2canvas then captures empty space. */
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;z-index:-1;pointer-events:none;';
    var pad = document.createElement('div');
    pad.style.cssText = 'width:' + hostW + 'px;background:' + bg + ';box-sizing:border-box;';
    var clone = element.cloneNode(true);
    clone.style.width = '100%';
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.boxShadow = 'none';
    /* Controls are screen furniture — a printed report must not carry a
       DOWNLOAD button. Callers used to hide them by hand and often missed. */
    [].slice.call(clone.querySelectorAll('button, input[type="button"], input[type="submit"], .no-print, [data-no-print]'))
      .forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });

    pad.appendChild(clone);
    host.appendChild(pad);
    document.body.appendChild(host);

    var cleanup = function () { try { host.remove(); } catch (e) {} };
    var save = function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1500);
    };
    /* If anything at all goes wrong, still deliver a PDF the old way. */
    var fallback = function (err) {
      if (err) { try { console.error('PDF fit export failed, using the plain path', err); } catch (e) {} }
      cleanup();
      return html2pdf().set({
        margin: margin, filename: filename, image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: bg },
        jsPDF: { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(element).output('blob').then(save)
        .catch(function (e) { try { console.error(e); window.print(); } catch (_) {} });
    };

    /* Blocks that must never be cut in half. */
    /* A whole table is NOT atomic — treating it so pushed a long table onto the
       next page and left a page-tall gap behind it. Rows are what must not be
       split, along with drawings and small cards, and nothing counts as atomic
       once it is over half a page. */
    var ATOMIC = 'tr, img, canvas, .pdf-atomic, .aln-rr, .tp2-rr, .pid-rr, .res-value, .pump-res-card';


    function paginate() {
      /* Nothing wider than the page, nothing taller than one page. */
      [].slice.call(clone.querySelectorAll('img, canvas')).forEach(function (im) {
        im.style.maxWidth = '100%';
        im.style.maxHeight = (pageHpx - 16) + 'px';
        im.style.height = 'auto';
        im.style.display = 'block';
        im.style.margin = '0 auto';
      });
      [].slice.call(clone.querySelectorAll('table')).forEach(function (tb) {
        tb.style.width = '100%';
        if (!tb.style.tableLayout) tb.style.tableLayout = 'fixed';
        tb.style.wordBreak = 'break-word';
      });

      setTimeout(function () {
        var contentH = Math.max(clone.scrollHeight, pad.scrollHeight);
        if (!(contentH > 0)) return fallback();
        var padTop = pad.getBoundingClientRect().top;
        var blocks = collectSpans(clone, padTop, pageHpx);

        /* The page setup has to go to THIS call too, not only to the one that
           emits the document. html2pdf wraps whatever it is given in its own
           container sized to the jsPDF page width, and with no jsPDF option
           it assumes A4 PORTRAIT — so a landscape report laid out at 1062 px
           was forced into a 210 mm (794 px) container and everything past
           that was cut off, then the clipped canvas was stretched back across
           the landscape page. That is why the DPHE fabrication drawing lost
           its right-hand third: the title ended at "DRAWIN", the D2 callout
           and the "+N MORE HAIRPINS" note vanished, and the BOM lost its last
           column. Landscape exports everywhere shared the fault.
           windowWidth pins html2canvas's viewport to the same width, so the
           layout it measures is the layout we built. */
        html2pdf().set({
            margin: margin,
            jsPDF: { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' },
            html2canvas: { scale: opts.scale || 2, useCORS: true, backgroundColor: bg }
          })
          .from(pad).toCanvas().get('canvas')
          .then(function (canvas) {
            if (!canvas || !canvas.width || !canvas.height) return fallback();
            var k = canvas.height / contentH;                 // canvas px per CSS px
            var sliceH = Math.max(40, Math.floor(pageHpx * k));
            return html2pdf().set({ jsPDF: { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' } })
              .from('<span></span>', 'string').toPdf().get('pdf')
              .then(function (pdf) {
                var y = 0, guard = 0, added = 0;
                while (y < canvas.height - 1 && guard++ < 300) {
                  var cut = chooseCut(y, sliceH, canvas.height, blocks, k);
                  /* A sliver left over is trailing whitespace, not content —
                     absorb it rather than emitting a near-empty last page. */
                  if (canvas.height - cut < sliceH * 0.06) cut = canvas.height;
                  var h = cut - y;
                  if (h < 1) break;
                  var pageCv = document.createElement('canvas');
                  pageCv.width = canvas.width; pageCv.height = h;
                  var cx = pageCv.getContext('2d');
                  cx.fillStyle = bg; cx.fillRect(0, 0, pageCv.width, pageCv.height);
                  cx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
                  pdf.addPage();
                  pdf.setPage(pdf.internal.getNumberOfPages());
                  pdf.addImage(pageCv.toDataURL('image/jpeg', 0.95), 'JPEG',
                               margin, margin, cW, (h / k) / PX_PER_MM);
                  /* Drawing-office frame around every sheet. */
                  pdf.setDrawColor(148, 163, 184);
                  pdf.setLineWidth(0.4);
                  pdf.rect(margin - 3, margin - 3, cW + 6, cH + 6);
                  added++;
                  y = cut;
                }
                if (!added) return fallback();
                pdf.deletePage(1);                            // the dummy source page
                save(pdf.output('blob'));
                cleanup();
              });
          })
          .catch(fallback);
      }, 80);
    }

    var svgs = [].slice.call(clone.querySelectorAll('svg'));
    var pending = svgs.length;
    if (!pending) return paginate();
    svgs.forEach(function (sv) {
      var vb = sv.viewBox && sv.viewBox.baseVal;
      var w = (vb && vb.width) || sv.clientWidth || 800;
      var h = (vb && vb.height) || sv.clientHeight || 500;
      svgToImg(sv, 2, function (dataUrl) {
        if (dataUrl && sv.parentNode) {
          var im = document.createElement('img');
          im.src = dataUrl;
          im.setAttribute('width', Math.round(w));            // the size html2canvas was guessing
          im.setAttribute('height', Math.round(h));
          im.style.cssText = 'display:block;margin:0 auto;width:100%;max-width:' + Math.round(w) + 'px;'
            + 'height:auto;max-height:' + (pageHpx - 16) + 'px;';
          sv.parentNode.replaceChild(im, sv);
        }
        if (--pending === 0) paginate();
      });
    });
  };

  // rasterise an <svg> to a JPEG data-URL (html2canvas struggles with a very
  // large inline SVG, but handles a plain <img> reliably)
  function svgToImg(svgEl, scale, cb) {
    try {
      var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
      var w = vb && vb.width ? vb.width : (svgEl.clientWidth || 1540);
      var h = vb && vb.height ? vb.height : (svgEl.clientHeight || 1120);
      var clone = svgEl.cloneNode(true);
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      var xml = new XMLSerializer().serializeToString(clone);
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
        var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        try { cb(cv.toDataURL('image/jpeg', 0.95)); } catch (e) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = url;
    } catch (e) { cb(null); }
  }
  // rasterise an HTML element to a JPEG data-URL via an SVG <foreignObject>
  // (fast, no html2canvas). Works because our BOM table uses inline styles.
  function htmlToImg(el, width, cb) {
    try {
      var h = Math.max(200, el.scrollHeight + 20);
      var xhtml = '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + width + 'px;background:#fff;color:#0f172a;font-family:Arial;">' + el.innerHTML + '</div>';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + h + '"><foreignObject width="100%" height="100%">' + xhtml + '</foreignObject></svg>';
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas'); cv.width = width * 2; cv.height = h * 2;
        var c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
        try { cb(cv.toDataURL('image/jpeg', 0.92), width, h); } catch (e) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = url;
    } catch (e) { cb(null); }
  }
  // export a drawing modal (big SVG GA sheet + the detailed HTML BOM list) as a
  // fitted landscape PDF — rasterise the SVG then addImage it directly to a jsPDF
  // page (html2canvas is unreliable on a huge SVG / injected image); the HTML BOM
  // list below is added as a second page.
  function exportDrawingPdf(body, filename, done) {
    // the engine is loaded on demand — get it before choosing a path, or the
    // first export of a session would fall back to the html2canvas route
    if (typeof html2pdf === 'undefined') {
      ensureHtml2Pdf().then(function () { exportDrawingPdf(body, filename, done); });
      return;
    }
    var svg = body.querySelector('svg');
    if (!svg) { var r = window.AROPDF(body, filename, { landscape: true }); if (r && r.then) r.then(done, done); else setTimeout(done, 1500); return; }
    var vb = svg.viewBox && svg.viewBox.baseVal, sw = vb && vb.width ? vb.width : 1540, sh = vb && vb.height ? vb.height : 1120;
    var bomEl = svg.nextElementSibling;
    svgToImg(svg, 2, function (png) {
      if (!png) { var r2 = window.AROPDF(body, filename, { landscape: true }); if (r2 && r2.then) r2.then(done, done); else setTimeout(done, 1500); return; }
      var dummy = document.createElement('div'); dummy.innerHTML = '<span>.</span>'; dummy.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(dummy);
      html2pdf().set({ jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }, html2canvas: { scale: 1 } }).from(dummy).toPdf().get('pdf').then(function (pdf) {
        var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        try {
          var ar = sw / sh, iw = pw - 8, ih = iw / ar; if (ih > ph - 8) { ih = ph - 8; iw = ih * ar; }
          pdf.addImage(png, 'JPEG', (pw - iw) / 2, (ph - ih) / 2, iw, ih);
        } catch (e) { try { console.error('drawing PDF failed', e); } catch (_) {} }
        var finish = function () {
          try {
            var blob = pdf.output('blob'), url = URL.createObjectURL(blob);
            var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
            setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1500);
          } catch (e) { try { console.error('drawing PDF failed', e); } catch (_) {} }
          dummy.remove(); done();
        };
        // add the detailed HTML BOM list as a second page (best-effort)
        if (bomEl) {
          htmlToImg(bomEl, 1080, function (bpng, bw, bh) {
            if (bpng) { try { pdf.addPage(); var bar = bw / bh, biw = pw - 16, bih = biw / bar; if (bih > ph - 16) { bih = ph - 16; biw = bih * bar; } pdf.addImage(bpng, 'JPEG', (pw - biw) / 2, 8, biw, bih); } catch (e) {} }
            finish();
          });
        } else finish();
      }).catch(function (e) { try { console.error('drawing PDF failed', e); } catch (_) {} dummy.remove(); done(); });
    });
  }

  function modal(title, inner, pdf, landscape) {
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
      var fn = (title.replace(/&amp;/g, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'PHE').slice(0, 60) + '.pdf';
      pb.textContent = '⏳ GENERATING…'; pb.disabled = true;
      var done = function () { pb.textContent = '⬇ PDF'; pb.disabled = false; };
      if (landscape) { exportDrawingPdf($('phe-mbody'), fn, done); }
      else { var r = window.AROPDF($('phe-mbody'), fn, { landscape: false }); if (r && r.then) r.then(done, done); else setTimeout(done, 1500); }
    };
  }

  /* ─────────── boot ─────────── */
  function boot() { inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
  // re-attempt in case the HX tab is built lazily
  var tries = 0; var iv = setInterval(function () { if (built || tries++ > 20) { clearInterval(iv); return; } inject(); }, 500);

  window.AROPHE = { calc: calc, compute: compute, report: report, drawing: drawing,
    buildDrawing: buildDrawing, graph: graph,
    /* exposed read-only so the engineering data registry can index this
       module's tables. The tables themselves are untouched. */
    fluids: FLUIDS, materials: MATERIALS };

  /* Exposed so the cut rule can be tested directly, without rasterising
     anything: tools/pdf_pagination_test.js drives it with synthetic spans. */
  window.AROPDF.chooseCut = chooseCut;
  window.AROPDF.collectSpans = collectSpans;

})();

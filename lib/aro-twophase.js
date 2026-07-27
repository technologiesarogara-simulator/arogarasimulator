/* ══════════════════════════════════════════════════════════════════════
   ARO — TWO-PHASE LINE SIZING  (window.AROTP)
   Implements the client's "Two phase flow updated" workbook exactly:
     x        = Wg / (Wg + Wl)                      → flow regime by quality
     ρmix     = [ x/ρg + (1−x)/ρl ]⁻¹
     μmix     = x·μl + (1−x)·μg
     G        = (Wl+Wg) / (0.785·D²·3600)
     Vsl,Vsg  = Ql,Qg / (0.785·D²·3600)
     Vmix     = G / ρmix
     Fr       = Vs / √(g·D)          We = ρmix·V²·D / σ
     Momentum = ρmix·V²
     Ve (API 14E) = C/√(ρmix·0.06248) ft/s → allowable = Ve·%/100
     Re       = ρmix·V·D / (0.001·μmix)
     f        = 64/Re (lam) | 1.3255/[ln(ε/3.7D + 5.74/Re^0.9)]²
     ΔP       = friction + static + equipment + fittings(ΣK)
   plus a live 3D flow-regime animation driven by the computed regime.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ASME B36.10M — OD and ID (inch) by NPS and schedule */
  var PIPE = {
    0.5:  { od: 0.840, s: { '5': 0.710, '10': 0.674, '40': 0.622, '80': 0.546, '160': 0.466 } },
    0.75: { od: 1.050, s: { '5': 0.920, '10': 0.884, '40': 0.824, '80': 0.742, '160': 0.614 } },
    1:    { od: 1.315, s: { '5': 1.185, '10': 1.097, '40': 1.049, '80': 0.957, '160': 0.815 } },
    1.5:  { od: 1.900, s: { '5': 1.770, '10': 1.682, '40': 1.610, '80': 1.500, '160': 1.338 } },
    2:    { od: 2.375, s: { '5': 2.245, '10': 2.157, '40': 2.067, '80': 1.939, '160': 1.687 } },
    3:    { od: 3.500, s: { '5': 3.334, '10': 3.260, '40': 3.068, '80': 2.900, '160': 2.624 } },
    4:    { od: 4.500, s: { '5': 4.334, '10': 4.260, '40': 4.026, '80': 3.826, '160': 3.438 } },
    6:    { od: 6.625, s: { '5': 6.407, '10': 6.357, '40': 6.065, '80': 5.761, '160': 5.187 } },
    8:    { od: 8.625, s: { '5': 8.407, '10': 8.329, '40': 7.981, '80': 7.625, '160': 6.813 } },
    10:   { od: 10.750, s: { '5': 10.482, '10': 10.420, '40': 10.020, '80': 9.750, '160': 8.500 } },
    12:   { od: 12.750, s: { '5': 12.438, '10': 12.390, '40': 11.938, '80': 11.376, '160': 10.126 } },
    14:   { od: 14.000, s: { '10': 13.500, '40': 13.124, '80': 12.500, '160': 11.188 } },
    16:   { od: 16.000, s: { '10': 15.500, '40': 15.000, '80': 14.312, '160': 12.812 } },
    18:   { od: 18.000, s: { '10': 17.500, '40': 16.876, '80': 16.124, '160': 14.438 } },
    20:   { od: 20.000, s: { '10': 19.500, '40': 18.812, '80': 17.938, '160': 16.062 } },
    24:   { od: 24.000, s: { '10': 23.500, '40': 22.624, '80': 21.562, '160': 19.312 } }
  };
  var SCHEDULES = ['5', '10', '40', '80', '160'];

  /* Fitting K values by NPS band (from the workbook table) */
  var FIT_NAMES = ['Gate Valve', 'Globe Valve', 'Angle Valve', 'Ball Valve', 'Plug Valve Straightway',
    'Plug Valve 3-Way Through', 'Plug Valve Branch Flow', 'Swing Check Valve', 'Lift Check Valve',
    'Std Elbow 90°', 'Std Elbow 45°', 'Long Radius 90°', 'Tee Through Flow', 'Tee Through Branch',
    'Mitre α=0°', 'Mitre α=30°', 'Mitre α=60°', 'Mitre α=90°'];
  var FIT_K = {
    0.5:  [0.22, 9.2, 1.48, 0.08, 0.49, 0.81, 2.43, 1.40, 16.2, 0.81, 0.43, 0.43, 0.54, 1.62, 0.05, 0.22, 0.68, 1.62],
    0.75: [0.20, 8.5, 1.38, 0.08, 0.45, 0.75, 2.25, 1.30, 15.0, 0.75, 0.40, 0.40, 0.50, 1.50, 0.05, 0.20, 0.63, 1.50],
    1:    [0.18, 7.8, 1.27, 0.07, 0.41, 0.69, 2.07, 1.20, 13.8, 0.69, 0.37, 0.37, 0.46, 1.38, 0.05, 0.18, 0.58, 1.38],
    1.5:  [0.15, 7.1, 1.16, 0.06, 0.38, 0.63, 1.89, 1.10, 12.6, 0.63, 0.34, 0.34, 0.42, 1.26, 0.04, 0.17, 0.53, 1.26],
    2:    [0.15, 6.5, 1.05, 0.06, 0.34, 0.57, 1.71, 1.00, 11.4, 0.57, 0.30, 0.30, 0.38, 1.14, 0.04, 0.15, 0.48, 1.14],
    3:    [0.14, 6.1, 0.99, 0.05, 0.32, 0.54, 1.62, 0.90, 10.8, 0.54, 0.29, 0.29, 0.36, 1.08, 0.04, 0.14, 0.45, 1.08],
    4:    [0.14, 5.8, 0.94, 0.05, 0.31, 0.51, 1.53, 0.90, 10.2, 0.51, 0.27, 0.27, 0.34, 1.02, 0.03, 0.14, 0.43, 1.02],
    6:    [0.12, 5.1, 0.83, 0.05, 0.27, 0.45, 1.35, 0.75, 9.00, 0.45, 0.24, 0.24, 0.30, 0.90, 0.03, 0.12, 0.38, 0.90],
    8:    [0.11, 4.8, 0.77, 0.04, 0.25, 0.42, 1.26, 0.70, 8.40, 0.42, 0.22, 0.22, 0.28, 0.84, 0.03, 0.11, 0.35, 0.84],
    12:   [0.10, 4.4, 0.72, 0.04, 0.23, 0.39, 1.17, 0.65, 7.80, 0.39, 0.21, 0.21, 0.26, 0.78, 0.03, 0.10, 0.33, 0.78],
    16:   [0.10, 4.1, 0.66, 0.04, 0.22, 0.36, 1.08, 0.60, 7.22, 0.36, 0.19, 0.19, 0.24, 0.72, 0.02, 0.10, 0.30, 0.72]
  };
  function kSet(nps) {
    var keys = Object.keys(FIT_K).map(Number).sort(function (a, b) { return a - b; });
    var pick = keys[0];
    for (var i = 0; i < keys.length; i++) if (nps >= keys[i]) pick = keys[i];
    return FIT_K[pick];
  }

  /* Absolute roughness (mm) */
  var ROUGH = {
    'CS': 0.045, 'MS': 0.045, 'GI': 0.15, 'SS304': 0.0015, 'SS304L': 0.0015, 'SS316': 0.0015,
    'SS316L': 0.0015, 'SS321': 0.0015, 'SS310': 0.0015, 'Duplex SS': 0.0015, 'Cast iron': 0.26,
    'Asphalted cast iron': 0.12, 'Wrought iron': 0.045, 'Concrete': 0.30, 'Riveted steel': 0.90,
    'Commercial steel / welded steel': 0.045, 'Super Duplex SS': 0.0015, 'Alloy Steel': 0.045,
    'Copper': 0.0015, 'Brass': 0.0015, 'PVC': 0.0015, 'CPVC': 0.0015, 'HDPE': 0.007, 'FRP': 0.005,
    'PTFE Lined': 0.001, 'Rubber Lined': 0.01, 'Hastelloy C276': 0.0015, 'Monel 400': 0.0015,
    'Inconel 600/625': 0.0015
  };
  /* Interfacial surface tension σLG (N/m) */
  var SIGMA = {
    'Water – Air (20 °C)': 0.0728, 'Water – Nitrogen (20 °C)': 0.072, 'Water – Oxygen (20 °C)': 0.072,
    'Water – Steam (100 °C)': 0.0589, 'Water – Steam (150 °C)': 0.048, 'Water – Steam (200 °C)': 0.037,
    'Water – Steam (250 °C)': 0.023, 'Water – Steam (300 °C)': 0.0089, 'Condensate – Steam (100 °C)': 0.059,
    'Light Hydrocarbon – Natural Gas': 0.025, 'Crude Oil – Natural Gas': 0.025, 'LPG Liquid – Vapor': 0.008,
    'Ammonia Liquid – Vapor': 0.021, 'R134a Liquid – Vapor': 0.008, 'R22 Liquid – Vapor': 0.010,
    'LNG – Natural Gas': 0.011
  };
  /* API 14E C-factor by service */
  var CFACTOR = { 'Clean Liquid': 100, 'Continuous Service': 125, 'General Hydrocarbon': 150, 'Corrosive Fluid': 100, 'Non-corrosive Gas': 200 };

  var built = false, three = null, LAST = null;

  function $(id) { return document.getElementById(id); }
  function num(id, d) { var e = $(id); if (!e) return d; var v = parseFloat(e.value); return isFinite(v) ? v : d; }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function fld(label, id, unit, v, step) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '" type="number" step="' + (step || 'any') + '" value="' + v + '" '
      + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + (unit ? '<span style="font-size:9px;color:#64748b;min-width:52px;text-transform:none;">' + unit + '</span>' : '') + '</span></label>';
  }
  function txtf(label, id, v) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<input id="' + id + '" type="text" value="' + esc(v || '') + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;"/></label>';
  }
  function sel(label, id, opts, cur) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<select id="' + id + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;">'
      + opts.map(function (o) { return '<option' + (String(o) === String(cur) ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
  }
  function hdr(t) { return '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin:14px 0 4px;border-bottom:1px solid var(--border-muted);padding-bottom:3px;">' + t + '</div>'; }
  function two(a, b) { return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div>' + a + '</div><div>' + b + '</div></div>'; }

  function panelHTML() {
    var h = '<div class="sthe-grid">';
    h += '<div class="panel panel-input" style="max-height:calc(100vh - 190px);overflow-y:auto;overflow-x:hidden;">'
      + '<div class="panel-header" style="display:flex;align-items:center;gap:6px;"><span class="panel-title" style="flex:1;">TWO-PHASE FLOW — DESIGN INPUTS</span>'
      + '<button id="tp2-undo" class="tp2-hbtn" title="Undo"><span style="font-size:13px;">↩</span><span>UNDO</span></button>'
      + '<button id="tp2-redo" class="tp2-hbtn" title="Redo"><span style="font-size:13px;">↪</span><span>REDO</span></button>'
      + '<button id="tp2-reset" class="tp2-hbtn tp2-hbtn-red" title="Reset"><span style="font-size:13px;">↺</span><span>RESET</span></button></div>'
      + '<div class="panel-body">';

    h += hdr('1 · LINE IDENTIFICATION');
    h += two(txtf('COMPANY', 'tp2-company', ''), txtf('PROJECT LOCATION', 'tp2-loc', ''));
    h += two(txtf('P&amp;ID No.', 'tp2-pid', ''), txtf('LINE No.', 'tp2-lineno', ''));
    h += two(txtf('LINE FROM', 'tp2-from', ''), txtf('LINE TO', 'tp2-to', ''));

    h += hdr('2 · PHYSICAL PROPERTIES');
    h += sel('FLUID PAIR (σ lookup)', 'tp2-pair', Object.keys(SIGMA).concat(['User defined']), 'Water – Air (20 °C)');
    h += fld('Surface tension σ', 'tp2-sigma', 'N/m', 0.072, '0.0001');
    h += two(fld('Liquid density ρL', 'tp2-rhol', 'kg/m³', 1000, '1'), fld('Gas density ρG', 'tp2-rhog', 'kg/m³', 800, '1'));
    h += two(fld('Liquid viscosity μL', 'tp2-mul', 'cP', 1, '0.01'), fld('Gas viscosity μG', 'tp2-mug', 'cP', 1, '0.01'));
    h += two(fld('Liquid mass flow WL', 'tp2-wl', 'kg/hr', 300, '1'), fld('Gas mass flow WG', 'tp2-wg', 'kg/hr', 800, '1'));

    h += hdr('3 · OPERATING CONDITIONS');
    h += two(fld('Design temperature', 'tp2-temp', '°C', 34, '1'), fld('Operating pressure', 'tp2-pop', 'bar(G)', 1, '0.1'));
    h += fld('Upstream pressure', 'tp2-pup', 'bar(G)', 6, '0.1');

    h += hdr('4 · PIPE DATA');
    h += two(sel('NPS', 'tp2-nps', Object.keys(PIPE), '0.5'), sel('SCHEDULE', 'tp2-sch', SCHEDULES, '80'));
    h += sel('PIPE MATERIAL', 'tp2-mat', Object.keys(ROUGH), 'CS');
    h += '<div id="tp2-pipeinfo" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-top:2px;"></div>';
    h += two(fld('Line length', 'tp2-len', 'm', 4, '0.1'), fld('Static height Δz', 'tp2-dz', 'm', 0.5, '0.1'));
    h += fld('Equipment ΔP', 'tp2-dpeq', 'bar', 0.001, '0.001');

    h += hdr('5 · EROSIONAL VELOCITY (API 14E)');
    h += sel('SERVICE (C factor)', 'tp2-service', Object.keys(CFACTOR), 'Clean Liquid');
    h += fld('% of erosional velocity', 'tp2-pcterosion', '%', 75, '1');
    h += fld('Allowable ΔP', 'tp2-dpallow', 'bar', 0.45, '0.01');

    h += hdr('6 · FITTINGS &amp; VALVES (quantity)');
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    FIT_NAMES.forEach(function (n, i) { h += '<div>' + fld(n, 'tp2-fit-' + i, '', 0, '1') + '</div>'; });
    h += '</div>';

    h += '<button id="tp2-calc" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ RUN TWO-PHASE CALCULATION</button>';
    h += '<div id="tp2-status" style="display:none;margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#052e16;border-radius:5px;padding:8px 10px;text-align:center;line-height:1.4;"></div>';
    h += tpCSS();
    h += '</div></div>';

    h += '<div class="panel" style="max-height:calc(100vh - 190px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">TECHNICAL EVALUATIONS — TWO-PHASE LINE SIZING</span></div>'
      + '<div class="panel-body">'
      + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#94a3b8;text-align:center;margin-bottom:4px;">3D FLOW-REGIME SIMULATION — LIVE · DRAG TO ROTATE · SCROLL TO ZOOM</div>'
      + '<div id="tp2-3dwrap" style="position:relative;width:100%;height:300px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;">'
      + '<canvas id="tp2-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>'
      + '<div id="tp2-3dtag" style="position:absolute;left:8px;top:8px;font-family:var(--font-mono);font-size:11px;font-weight:700;color:#38bdf8;"></div>'
      + '<div id="tp2-3dsub" style="position:absolute;left:8px;top:26px;font-family:var(--font-mono);font-size:9px;color:#94a3b8;"></div></div>'
      + '<div id="tp2-results" style="margin-top:12px;"></div>'
      + '<div style="margin-top:14px;border-top:1px solid var(--border-muted);padding-top:10px;">'
      + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin-bottom:6px;">FINAL DELIVERABLES</div>'
      + '<button id="tp2-report" class="tp2-act" style="width:100%;">📄 TWO-PHASE DESIGN REPORT</button></div>'
      + '</div></div>';
    return h + '</div>';
  }

  function tpCSS() {
    return '<style>'
      + '.tp2-act{background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:8px;border-radius:4px;cursor:pointer;}'
      + '.tp2-act:hover{background:rgba(255,117,56,0.12);}'
      + '.tp2-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
      + '.tp2-rr span{color:var(--text-muted);}.tp2-rr b{color:#e2e8f0;}.tp2-rr.ok b{color:#22c55e;}.tp2-rr.warn b{color:#ef4444;}.tp2-rr.mid b{color:#f59e0b;}'
      + '.tp2-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}'
      + '.tp2-hbtn{display:inline-flex;flex-direction:column;align-items:center;gap:1px;min-width:42px;padding:4px 8px;background:rgba(59,130,246,0.06);border:1px solid #3b82f6;color:#3b82f6;border-radius:5px;font-size:8px;font-weight:700;cursor:pointer;line-height:1.1;font-family:var(--font-mono);}'
      + '.tp2-hbtn-red{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,0.06);}'
      + '</style>';
  }

  /* ─────────── CORE (workbook formulas) ─────────── */
  function compute() {
    var Wl = num('tp2-wl', 300), Wg = num('tp2-wg', 800);
    var rhoL = num('tp2-rhol', 1000), rhoG = num('tp2-rhog', 800);
    var muL = num('tp2-mul', 1), muG = num('tp2-mug', 1);
    var sigma = num('tp2-sigma', NaN);          // blank on 'User defined' — Weber stays undefined until entered

    // vapour quality & regime (workbook R24–R26)
    var x = (Wg + Wl) > 0 ? Wg / (Wg + Wl) : 0;
    var regime = x === 0 ? 'Pure Liquid' : x <= 0.1 ? 'Bubble Flow' : x <= 0.3 ? 'Bubble / Plug / Slug'
      : x <= 0.7 ? 'Slug / Churn' : x <= 0.9 ? 'Annular' : x < 1 ? 'Annular Mist' : x === 1 ? 'Pure Vapor' : 'Out of Range';
    var advice = (regime === 'Bubble Flow' || regime === 'Annular') ? 'GOOD'
      : x < 0.1 ? 'Increase gas flow or decrease liquid flow'
      : x < 0.7 ? 'Increase gas flow to move toward annular flow'
      : x > 0.9 ? 'Increase liquid flow or decrease gas flow to avoid dry-out' : 'Check conditions';

    // pipe
    var nps = parseFloat(val('tp2-nps', '0.5'));
    var sch = val('tp2-sch', '80');
    var pd = PIPE[nps] || PIPE[0.5];
    var idIn = (pd.s[sch] !== undefined) ? pd.s[sch] : pd.s['40'];
    var odIn = pd.od;
    var thkIn = (odIn - idIn) / 2;
    var Dmm = idIn * 25.4, D = Dmm / 1000;
    var matName = val('tp2-mat', 'CS');
    var eps = ROUGH[matName] !== undefined ? ROUGH[matName] : 0.045;
    var relRough = eps / Dmm;

    // mixture properties (R49–R53)
    var rhoMix = 1 / ((x / rhoG) + ((1 - x) / rhoL));
    var muMix = (x * muL) + ((1 - x) * muG);
    var Ql = Wl / rhoL, Qg = Wg / rhoG, Qt = Ql + Qg;      // m³/hr

    var A = 0.785 * D * D;                                  // workbook uses 0.785
    var G = (Wl + Wg) / (A * 3600);                         // kg/m²·s
    var Vsl = Ql / (A * 3600), Vsg = Qg / (A * 3600);       // superficial m/s
    var Vmix = G / rhoMix;

    var regimeVsg = Vsg < 1 ? 'Bubble — Good' : Vsg < 5 ? 'Slug — Review' : Vsg < 20 ? 'Annular — Good' : 'Mist — Check erosion';
    var velCheck = Vmix < 1 ? 'Reduce pipe diameter (velocity too low)' : Vmix < 5 ? 'Excellent — no change'
      : Vmix < 15 ? 'Good — no change' : Vmix < 20 ? 'Acceptable — check pressure drop'
      : Vmix < 30 ? 'High velocity — check erosion' : 'Increase pipe diameter';
    var velOk = Vmix >= 1 && Vmix < 20;

    // Froude (R62–R64)
    var FrL = Vsl / Math.sqrt(9.81 * D), FrG = Vsg / Math.sqrt(9.81 * D);
    var FrMax = Math.max(FrL, FrG);
    var frRegime = FrMax < 1 ? 'Subcritical — gravity dominates' : FrMax < 5 ? 'Transition flow' : 'Supercritical — inertia dominates';

    // Weber (R65–R66)
    var We = (rhoMix * Vmix * Vmix * D) / sigma;
    var weCheck = !isFinite(We) ? 'Enter surface tension σ' : We < 1 ? 'Surface tension dominates' : We < 10 ? 'Stable interface' : We < 100 ? 'Moderate droplet deformation'
      : We < 1000 ? 'High Weber — check flow regime' : 'Atomization / mist flow';

    // Momentum flux (R67–R68)
    var mom = rhoMix * Vmix * Vmix;
    var momCheck = mom < 6000 ? 'GOOD' : mom < 12000 ? 'REVIEW DESIGN' : 'HIGH MOMENTUM — INCREASE PIPE SIZE';
    var momOk = mom < 6000;

    // Erosional velocity API 14E (R70–R80)
    var svc = val('tp2-service', 'Clean Liquid');
    var C = CFACTOR[svc] || 100;
    var VeFt = C / Math.sqrt(rhoMix * 0.06248);
    var Ve = VeFt * 0.3048;
    var pct = num('tp2-pcterosion', 75);
    var Vallow = Ve * (pct / 100);
    var eroOk = Vmix < Vallow;
    var Areq = Qt / (3600 * Vallow);
    var Dreq = Math.sqrt((4 * Areq) / Math.PI);
    var DreqMm = Dreq * 1000, DreqIn = Dreq * 39.3701;
    var sizeOk = nps >= DreqIn;

    // Reynolds & friction (R81–R84)
    var Re = (rhoMix * Vmix * D) / (0.001 * muMix);
    var flowType = Re < 2100 ? 'LAMINAR' : Re <= 4000 ? 'TRANSITION' : 'TURBULENT';
    var f = Re < 2100 ? 64 / Re : 1.3255 / Math.pow(Math.log((eps / (3.7 * Dmm)) + (5.74 / Math.pow(Re, 0.9))), 2);
    var fCheck = f < 0.005 ? 'Very smooth' : f < 0.02 ? 'Normal' : f < 0.05 ? 'High friction' : 'Review pipe size';

    // Pressure drop (R88–R156)
    var L = num('tp2-len', 4), dz = num('tp2-dz', 0.5), dpEq = num('tp2-dpeq', 0.001);
    var dpFricPa = (f * L * rhoMix * Vmix * Vmix) / (D * 2);
    var dpFric = dpFricPa / 1e5;
    var headLoss = dpFricPa / (rhoMix * 9.81);
    var dpStatPa = rhoMix * 9.81 * dz;
    var dpStat = dpStatPa / 1e5;

    var K = kSet(nps), sumK = 0, fitList = [];
    FIT_NAMES.forEach(function (n, i) {
      var q = num('tp2-fit-' + i, 0);
      if (q > 0) { var kk = K[i] * q; sumK += kk; fitList.push({ name: n, qty: q, k: K[i], total: kk }); }
    });
    var dpFitPa = 0.5 * sumK * rhoMix * Vmix * Vmix;
    var dpFit = dpFitPa / 1e5;

    var dpTotal = dpFric + dpStat + dpEq + dpFit;
    var pUp = num('tp2-pup', 6);
    var pDown = pUp - dpTotal;
    var dpAllow = num('tp2-dpallow', 0.45);
    var dpOk = dpTotal <= dpAllow;

    var T = num('tp2-temp', 34);
    return {
      Wl: Wl, Wg: Wg, rhoL: rhoL, rhoG: rhoG, muL: muL, muG: muG, sigma: sigma,
      x: x, regime: regime, advice: advice,
      nps: nps, sch: sch, odIn: odIn, idIn: idIn, thkIn: thkIn, Dmm: Dmm, D: D,
      matName: matName, eps: eps, relRough: relRough,
      rhoMix: rhoMix, muMix: muMix, Ql: Ql, Qg: Qg, Qt: Qt,
      A: A, G: G, Vsl: Vsl, Vsg: Vsg, Vmix: Vmix, regimeVsg: regimeVsg, velCheck: velCheck, velOk: velOk,
      FrL: FrL, FrG: FrG, FrMax: FrMax, frRegime: frRegime,
      We: We, weCheck: weCheck, mom: mom, momCheck: momCheck, momOk: momOk,
      svc: svc, C: C, VeFt: VeFt, Ve: Ve, pct: pct, Vallow: Vallow, eroOk: eroOk,
      Areq: Areq, DreqMm: DreqMm, DreqIn: DreqIn, sizeOk: sizeOk,
      Re: Re, flowType: flowType, f: f, fCheck: fCheck,
      L: L, dz: dz, dpEq: dpEq, dpFricPa: dpFricPa, dpFric: dpFric, headLoss: headLoss,
      dpStatPa: dpStatPa, dpStat: dpStat, sumK: sumK, fitList: fitList, dpFitPa: dpFitPa, dpFit: dpFit,
      dpTotal: dpTotal, pUp: pUp, pDown: pDown, dpAllow: dpAllow, dpOk: dpOk, T: T
    };
  }

  function calc() {
    if (!$('tp2-results')) return;
    var r = LAST = compute();
    var f1 = function (v) { return isFinite(v) ? v.toFixed(1) : '—'; };
    var f2 = function (v) { return isFinite(v) ? v.toFixed(2) : '—'; };
    var f3 = function (v) { return isFinite(v) ? v.toFixed(3) : '—'; };
    var f0 = function (v) { return isFinite(v) ? Math.round(v).toLocaleString() : '—'; };
    var row = function (l, v, c) { return '<div class="tp2-rr ' + (c || '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
    var h = '';

    h += '<div class="tp2-cardh">FLOW REGIME (by vapour quality)</div>';
    h += row('Vapour quality  x = WG/(WG+WL)', f3(r.x));
    h += row('Predicted flow regime', r.regime, /Bubble Flow|^Annular$/.test(r.regime) ? 'ok' : 'mid');
    h += row('Recommendation', r.advice, r.advice === 'GOOD' ? 'ok' : 'mid');
    h += row('Regime by superficial gas velocity', r.regimeVsg, /Good/.test(r.regimeVsg) ? 'ok' : 'mid');

    h += '<div class="tp2-cardh">MIXTURE PROPERTIES</div>';
    h += row('Mixture density ρmix', f2(r.rhoMix) + ' kg/m³');
    h += row('Mixture viscosity μmix', f3(r.muMix) + ' cP');
    h += row('Liquid / gas volumetric flow', f3(r.Ql) + ' / ' + f3(r.Qg) + ' m³/hr');
    h += row('Total volumetric flow', f3(r.Qt) + ' m³/hr');
    h += row('Mass flux G', f2(r.G) + ' kg/m²·s');

    h += '<div class="tp2-cardh">PIPE &amp; VELOCITIES</div>';
    h += row('NPS / schedule', r.nps + '" Sch ' + r.sch);
    h += row('OD / ID / thickness', f3(r.odIn) + ' / ' + f3(r.idIn) + ' / ' + f3(r.thkIn) + ' in');
    h += row('Internal diameter', f3(r.Dmm) + ' mm');
    h += row('Roughness ε / relative', f3(r.eps) + ' mm / ' + r.relRough.toExponential(3));
    h += row('Superficial liquid velocity', f3(r.Vsl) + ' m/s');
    h += row('Superficial gas velocity', f3(r.Vsg) + ' m/s');
    h += row('Mixture velocity', f3(r.Vmix) + ' m/s', r.velOk ? 'ok' : 'mid');
    h += row('Velocity assessment', r.velCheck, r.velOk ? 'ok' : 'mid');

    h += '<div class="tp2-cardh">DIMENSIONLESS NUMBERS</div>';
    h += row('Froude — liquid / gas', f3(r.FrL) + ' / ' + f3(r.FrG));
    h += row('Froude regime', r.frRegime);
    h += row('Weber number  We = ρV²D/σ', f1(r.We));
    h += row('Weber assessment', r.weCheck, r.We < 100 ? 'ok' : 'mid');
    h += row('Momentum flux  ρV²', f1(r.mom) + ' Pa');
    h += row('Momentum assessment', r.momCheck, r.momOk ? 'ok' : 'warn');
    h += row('Reynolds number', f0(r.Re) + '  (' + r.flowType + ')');
    h += row('Friction factor f', f4(r.f) + '  — ' + r.fCheck);

    h += '<div class="tp2-cardh">EROSIONAL VELOCITY — API 14E</div>';
    h += row('Service / C factor', r.svc + '  /  C = ' + r.C);
    h += row('Erosional velocity Ve', f2(r.VeFt) + ' ft/s  =  ' + f3(r.Ve) + ' m/s');
    h += row('Allowable (' + r.pct + ' % of Ve)', f3(r.Vallow) + ' m/s');
    h += row('Vmix < allowable ?', r.eroOk ? 'YES' : 'NO', r.eroOk ? 'ok' : 'warn');
    h += row('Required area / diameter', r.Areq.toExponential(3) + ' m²  /  ' + f2(r.DreqMm) + ' mm');
    h += row('Required NPS', f3(r.DreqIn) + ' in');
    h += row('Pipe size check', r.sizeOk ? 'PASS — pipe size adequate' : 'FAIL — increase pipe size', r.sizeOk ? 'ok' : 'warn');

    h += '<div class="tp2-cardh">PRESSURE DROP</div>';
    h += row('Friction  (L = ' + f1(r.L) + ' m)', f0(r.dpFricPa) + ' Pa  =  ' + f4(r.dpFric) + ' bar');
    h += row('Head loss', f3(r.headLoss) + ' m');
    h += row('Static  (Δz = ' + f1(r.dz) + ' m)', f0(r.dpStatPa) + ' Pa  =  ' + f4(r.dpStat) + ' bar');
    h += row('Equipment', f4(r.dpEq) + ' bar');
    h += row('Fittings  (ΣK = ' + f2(r.sumK) + ')', f0(r.dpFitPa) + ' Pa  =  ' + f4(r.dpFit) + ' bar');
    h += row('TOTAL ΔP', f4(r.dpTotal) + ' bar', r.dpOk ? 'ok' : 'warn');
    h += row('Allowable ΔP', f4(r.dpAllow) + ' bar');
    h += row('Within allowable ?', r.dpOk ? 'YES' : 'NO', r.dpOk ? 'ok' : 'warn');
    h += row('Upstream → downstream', f2(r.pUp) + ' → ' + f2(r.pDown) + ' bar(G)');

    $('tp2-results').innerHTML = h;
    var pi = $('tp2-pipeinfo');
    if (pi) pi.textContent = 'OD ' + r.odIn.toFixed(3) + '" · ID ' + r.idIn.toFixed(3) + '" (' + r.Dmm.toFixed(2) + ' mm) · thk ' + r.thkIn.toFixed(3) + '" · ε ' + r.eps + ' mm';
    var tg = $('tp2-3dtag'); if (tg) tg.textContent = r.regime.toUpperCase();
    var sb = $('tp2-3dsub');
    if (sb) sb.textContent = 'x ' + r.x.toFixed(3) + ' · Vmix ' + r.Vmix.toFixed(2) + ' m/s · Vsg ' + r.Vsg.toFixed(2) + ' · ' + r.nps + '" Sch ' + r.sch;
    update3D(r);
  }
  function f4(v) { return isFinite(v) ? v.toFixed(4) : '—'; }

  function status() {
    var el = $('tp2-status'); if (!el || !LAST) return;
    var r = LAST, ok = r.dpOk && r.sizeOk && r.eroOk;
    el.style.display = 'block';
    el.style.background = ok ? 'linear-gradient(135deg,#22c55e,#4ade80)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)';
    el.innerHTML = (ok ? '✓ DESIGN OK' : '⚠ REVIEW') + ' · ' + r.regime + ' · Vmix ' + r.Vmix.toFixed(2) + ' m/s · ΔP ' + r.dpTotal.toFixed(3) + ' bar';
  }

  /* ─────────── 3D flow-regime animation ─────────── */
  function init3D() {
    if (typeof THREE === 'undefined') return;
    var canvas = $('tp2-canvas'); if (!canvas) return;
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1220);
    var cam = new THREE.PerspectiveCamera(42, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 400);
    var rn = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    rn.setPixelRatio(window.devicePixelRatio || 1);
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2b3242, 1.0));
    var dl = new THREE.DirectionalLight(0xffffff, 0.85); dl.position.set(10, 16, 12); scene.add(dl);
    var group = new THREE.Group(); scene.add(group);
    var sph = { r: 21, theta: 0.35, phi: 1.30, tx: 0, ty: 0, tz: 0 };
    function place() {
      var x = sph.r * Math.sin(sph.phi) * Math.sin(sph.theta), y = sph.r * Math.cos(sph.phi), z = sph.r * Math.sin(sph.phi) * Math.cos(sph.theta);
      cam.position.set(sph.tx + x, sph.ty + y, sph.tz + z); cam.lookAt(sph.tx, sph.ty, sph.tz);
    }
    three = { scene: scene, cam: cam, rn: rn, group: group, sph: sph, place: place, canvas: canvas, anim: null };
    place();
    var down = null;
    canvas.addEventListener('mousedown', function (e) { down = { x: e.clientX, y: e.clientY, th: sph.theta, ph: sph.phi }; });
    window.addEventListener('mousemove', function (e) {
      if (!down) return;
      sph.theta = down.th - (e.clientX - down.x) * 0.01;
      sph.phi = Math.max(0.2, Math.min(Math.PI - 0.2, down.ph - (e.clientY - down.y) * 0.01));
      place();
    });
    window.addEventListener('mouseup', function () { down = null; });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(8, Math.min(80, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); place(); }, { passive: false });
    (function loop() { requestAnimationFrame(loop); if (three && three.anim) three.anim(); rn.render(scene, cam); })();
    window.addEventListener('resize', resize3D);
  }
  function resize3D() {
    if (!three) return; var c = three.canvas; if (!c || !c.clientWidth) return;
    three.cam.aspect = c.clientWidth / c.clientHeight; three.cam.updateProjectionMatrix();
    three.rn.setSize(c.clientWidth, c.clientHeight, false);
  }

  /* Builds the flow pattern that matches the computed regime and animates it
     at a speed proportional to the mixture velocity. */
  function update3D(r) {
    if (!three) return;
    var g = three.group;
    three.anim = null;
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }

    var R = 2.0, L = 22;                                  // pipe radius / length (model units)
    var pipeMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.85, roughness: 0.3, transparent: true, opacity: 0.20, side: THREE.DoubleSide });
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 48, 1, true), pipeMat);
    pipe.rotation.z = Math.PI / 2; g.add(pipe);
    // flanges
    [-L / 2, L / 2].forEach(function (px) {
      var fl = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.25, R * 1.25, 0.35, 32), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.35 }));
      fl.rotation.z = Math.PI / 2; fl.position.x = px; g.add(fl);
    });

    var liqMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x0b3aa0, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
    var gasMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x7a4a02, emissiveIntensity: 0.65, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.8 });
    var parts = [];
    var reg = r.regime;
    var speed = Math.max(0.02, Math.min(0.5, r.Vmix * 0.03));

    function addCapsule(rad, len, m) {          // THREE r128 has no CapsuleGeometry
      var grp = new THREE.Group();
      var cyl = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 18, 1), m);
      cyl.rotation.z = Math.PI / 2; grp.add(cyl);
      [-len / 2, len / 2].forEach(function (cx) {
        var cap = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12), m);
        cap.position.x = cx; grp.add(cap);
      });
      g.add(grp); return grp;
    }

    function addSphere(rad, x, y, z, m) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(rad, 14, 12), m);
      s.position.set(x, y, z); g.add(s); return s;
    }

    if (/Pure Liquid/.test(reg)) {
      var full = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.94, L, 40), liqMat);
      full.rotation.z = Math.PI / 2; g.add(full);
    } else if (/Pure Vapor/.test(reg)) {
      var fullg = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.94, L, 40), gasMat);
      fullg.rotation.z = Math.PI / 2; g.add(fullg);
    } else if (/Bubble Flow/.test(reg)) {
      // liquid continuum with dispersed small gas bubbles
      var lq = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.94, L, 40), liqMat);
      lq.rotation.z = Math.PI / 2; g.add(lq);
      for (var i = 0; i < 70; i++) {
        var rad = 0.10 + Math.random() * 0.14;
        var ang = Math.random() * Math.PI * 2, rr = Math.random() * R * 0.72;
        var s = addSphere(rad, -L / 2 + Math.random() * L, Math.sin(ang) * rr + R * 0.15, Math.cos(ang) * rr, gasMat);
        parts.push({ m: s, sp: speed * (0.85 + Math.random() * 0.5) });
      }
    } else if (/Bubble \/ Plug \/ Slug/.test(reg)) {
      var lq2 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.94, L, 40), liqMat);
      lq2.rotation.z = Math.PI / 2; g.add(lq2);
      for (var p = 0; p < 5; p++) {                        // elongated plugs riding the top
        var plug = addCapsule(R * 0.42, 1.8, gasMat);
        plug.position.set(-L / 2 + p * (L / 5), R * 0.35, 0);
        parts.push({ m: plug, sp: speed });
      }
      for (var b2 = 0; b2 < 30; b2++) {
        var a2 = Math.random() * Math.PI * 2, r2 = Math.random() * R * 0.7;
        parts.push({ m: addSphere(0.10, -L / 2 + Math.random() * L, Math.sin(a2) * r2, Math.cos(a2) * r2, gasMat), sp: speed * 0.9 });
      }
    } else if (/Slug \/ Churn/.test(reg)) {
      // alternating liquid slugs and large Taylor bubbles
      for (var s2 = 0; s2 < 4; s2++) {
        var base = -L / 2 + s2 * (L / 4);
        var slug = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.94, 2.4, 32), liqMat);
        slug.rotation.z = Math.PI / 2; slug.position.x = base; g.add(slug);
        parts.push({ m: slug, sp: speed });
        var tay = addCapsule(R * 0.68, 1.9, gasMat);
        tay.position.set(base + L / 8, R * 0.18, 0);
        parts.push({ m: tay, sp: speed * 1.15 });
      }
      for (var c2 = 0; c2 < 24; c2++) {
        var a3 = Math.random() * Math.PI * 2, r3 = Math.random() * R * 0.7;
        parts.push({ m: addSphere(0.09 + Math.random() * 0.08, -L / 2 + Math.random() * L, Math.sin(a3) * r3, Math.cos(a3) * r3, gasMat), sp: speed * 1.2 });
      }
    } else if (/^Annular$/.test(reg) || /Annular Mist/.test(reg)) {
      // liquid film on the wall, fast gas core (+ entrained droplets for mist)
      var film = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.94, L, 48, 1, true), liqMat);
      film.rotation.z = Math.PI / 2; g.add(film);
      var inner = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, L, 48, 1, true), liqMat);
      inner.rotation.z = Math.PI / 2; g.add(inner);
      var core = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.70, R * 0.70, L, 40), gasMat);
      core.rotation.z = Math.PI / 2; g.add(core);
      var nd = /Mist/.test(reg) ? 90 : 40;
      for (var d = 0; d < nd; d++) {
        var a4 = Math.random() * Math.PI * 2, r4 = Math.random() * R * 0.62;
        parts.push({ m: addSphere(0.06 + Math.random() * 0.07, -L / 2 + Math.random() * L, Math.sin(a4) * r4, Math.cos(a4) * r4, liqMat), sp: speed * 1.5 });
      }
    } else {
      var un = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, L, 32), gasMat);
      un.rotation.z = Math.PI / 2; g.add(un);
    }

    // flow direction arrow
    var ar = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 14), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    ar.rotation.z = -Math.PI / 2; ar.position.set(L / 2 + 1.6, 0, 0); g.add(ar);

    three.anim = function () {
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.m.position.x += p.sp;
        if (p.m.position.x > L / 2) p.m.position.x = -L / 2;
      }
    };
    // Frame the pipe on the first build only — afterwards respect the user's zoom.
    three.sph.tx = 0; three.sph.ty = 0;
    if (!three.framed) { three.sph.r = 21; three.sph.theta = 0.35; three.sph.phi = 1.30; three.framed = true; }
    three.place(); resize3D();
  }

  /* ─────────── report ─────────── */
  function report() {
    var r = LAST || compute();
    var f1 = function (v) { return isFinite(v) ? v.toFixed(1) : '—'; };
    var f2 = function (v) { return isFinite(v) ? v.toFixed(2) : '—'; };
    var f3 = function (v) { return isFinite(v) ? v.toFixed(3) : '—'; };
    var f0 = function (v) { return isFinite(v) ? Math.round(v).toLocaleString() : '—'; };
    var sec = function (t) { return '<div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin:16px 0 8px;">' + t + '</div>'; };
    var T = function (rows) {
      return '<table style="width:100%;border-collapse:collapse;font-size:11.5px;">' + rows.map(function (x) {
        return '<tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#475569;width:54%;">' + x[0] + '</td>'
          + '<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;">' + x[1] + '</td></tr>';
      }).join('') + '</table>';
    };
    var b = '<div style="font-family:Arial;color:#0f172a;">';
    b += '<div style="text-align:center;margin-bottom:14px;"><div style="font-size:18px;font-weight:800;color:#ea580c;">BHARAT FLOWSIZE — TWO-PHASE LINE SIZING REPORT</div><div style="font-size:10px;color:#64748b;">AROGARA TECHNOLOGIES | DIGITAL INDIA INITIATIVE</div></div>';
    b += sec('1 · LINE IDENTIFICATION');
    b += T([['Company', esc(val('tp2-company', '—'))], ['Project location', esc(val('tp2-loc', '—'))],
      ['P&ID No.', esc(val('tp2-pid', '—'))], ['Line No.', esc(val('tp2-lineno', '—'))],
      ['From → To', esc(val('tp2-from', '—')) + ' → ' + esc(val('tp2-to', '—'))],
      ['Date', new Date().toISOString().slice(0, 10)]]);
    b += sec('2 · PHYSICAL PROPERTIES');
    b += T([['Liquid density ρL / gas ρG', f1(r.rhoL) + ' / ' + f1(r.rhoG) + ' kg/m³'],
      ['Liquid viscosity μL / gas μG', f3(r.muL) + ' / ' + f3(r.muG) + ' cP'],
      ['Surface tension σ', f3(r.sigma) + ' N/m'],
      ['Liquid flow WL / gas WG', f0(r.Wl) + ' / ' + f0(r.Wg) + ' kg/hr'],
      ['Design temperature', f1(r.T) + ' °C']]);
    b += sec('3 · FLOW REGIME');
    b += T([['Vapour quality  x = WG/(WG+WL)', f3(r.x)], ['Predicted regime', r.regime],
      ['Recommendation', r.advice], ['Regime by superficial gas velocity', r.regimeVsg]]);
    b += sec('4 · MIXTURE PROPERTIES');
    b += T([['ρmix = [x/ρG + (1−x)/ρL]⁻¹', f2(r.rhoMix) + ' kg/m³'],
      ['μmix = x·μL + (1−x)·μG', f3(r.muMix) + ' cP'],
      ['Liquid / gas volumetric flow', f3(r.Ql) + ' / ' + f3(r.Qg) + ' m³/hr'],
      ['Total volumetric flow', f3(r.Qt) + ' m³/hr'], ['Mass flux G', f2(r.G) + ' kg/m²·s']]);
    b += sec('5 · PIPE & VELOCITIES');
    b += T([['NPS / schedule', r.nps + '" Sch ' + r.sch], ['OD / ID', f3(r.odIn) + ' / ' + f3(r.idIn) + ' in'],
      ['Internal diameter', f3(r.Dmm) + ' mm'], ['Material / roughness', esc(r.matName) + ' / ' + r.eps + ' mm'],
      ['Relative roughness ε/D', r.relRough.toExponential(3)],
      ['Superficial liquid / gas velocity', f3(r.Vsl) + ' / ' + f3(r.Vsg) + ' m/s'],
      ['Mixture velocity', f3(r.Vmix) + ' m/s'], ['Velocity assessment', r.velCheck]]);
    b += sec('6 · DIMENSIONLESS NUMBERS');
    b += T([['Froude liquid / gas', f3(r.FrL) + ' / ' + f3(r.FrG)], ['Froude regime', r.frRegime],
      ['Weber  We = ρmix·V²·D/σ', f1(r.We) + '  — ' + r.weCheck],
      ['Momentum flux  ρmix·V²', f1(r.mom) + ' Pa  — ' + r.momCheck],
      ['Reynolds', f0(r.Re) + '  (' + r.flowType + ')'],
      ['Friction factor f', f4(r.f) + '  — ' + r.fCheck]]);
    b += sec('7 · EROSIONAL VELOCITY (API 14E)');
    b += T([['Service / C factor', r.svc + ' / ' + r.C],
      ['Ve = C/√(ρmix × 0.06248)', f2(r.VeFt) + ' ft/s = ' + f3(r.Ve) + ' m/s'],
      ['Allowable (' + r.pct + ' %)', f3(r.Vallow) + ' m/s'],
      ['Vmix < allowable ?', r.eroOk ? 'YES' : 'NO'],
      ['Required diameter', f2(r.DreqMm) + ' mm = ' + f3(r.DreqIn) + ' in'],
      ['Pipe size check', r.sizeOk ? 'PASS — pipe size adequate' : 'FAIL — increase pipe size']]);
    b += sec('8 · PRESSURE DROP');
    b += T([['Friction (L = ' + f1(r.L) + ' m)', f0(r.dpFricPa) + ' Pa = ' + f4(r.dpFric) + ' bar'],
      ['Head loss', f3(r.headLoss) + ' m'],
      ['Static (Δz = ' + f1(r.dz) + ' m)', f0(r.dpStatPa) + ' Pa = ' + f4(r.dpStat) + ' bar'],
      ['Equipment', f4(r.dpEq) + ' bar'],
      ['Fittings (ΣK = ' + f2(r.sumK) + ')', f0(r.dpFitPa) + ' Pa = ' + f4(r.dpFit) + ' bar'],
      ['TOTAL ΔP', f4(r.dpTotal) + ' bar'], ['Allowable ΔP', f4(r.dpAllow) + ' bar'],
      ['Within allowable ?', r.dpOk ? 'YES' : 'NO'],
      ['Upstream → downstream', f2(r.pUp) + ' → ' + f2(r.pDown) + ' bar(G)']]);
    if (r.fitList.length) {
      b += sec('9 · FITTINGS SCHEDULE');
      b += '<table style="width:100%;border-collapse:collapse;font-size:10.5px;"><tr style="background:#f1f5f9;">'
        + ['Fitting', 'Qty', 'K each', 'K total'].map(function (x) { return '<th style="padding:4px;border:1px solid #e2e8f0;text-align:left;">' + x + '</th>'; }).join('') + '</tr>';
      r.fitList.forEach(function (x) {
        b += '<tr>' + [x.name, x.qty, x.k, x.total.toFixed(2)].map(function (y) { return '<td style="padding:4px;border:1px solid #e2e8f0;">' + y + '</td>'; }).join('') + '</tr>';
      });
      b += '<tr style="background:#f8fafc;font-weight:700;"><td style="padding:4px;border:1px solid #e2e8f0;">TOTAL</td><td colspan="2" style="padding:4px;border:1px solid #e2e8f0;"></td><td style="padding:4px;border:1px solid #e2e8f0;">' + r.sumK.toFixed(2) + '</td></tr></table>';
    }
    b += sec('10 · BASIS');
    b += '<div style="font-size:10px;color:#475569;line-height:1.6;">Flow regime from vapour quality x = WG/(WG+WL). Mixture density by volumetric weighting; mixture viscosity by quality weighting. Superficial velocities from volumetric flow over 0.785·D². Froude Fr = Vs/√(gD); Weber We = ρmix·V²·D/σ; momentum flux ρmix·V². Erosional velocity per API RP 14E, Ve = C/√ρ. Friction factor: 64/Re laminar, otherwise the explicit Colebrook form 1.3255/[ln(ε/3.7D + 5.74/Re⁰·⁹)]². Pressure drop = friction (Darcy) + static + equipment + fittings (½·ΣK·ρ·V²). This is a design-screening calculation — confirm against a rigorous two-phase model (Beggs–Brill / Lockhart–Martinelli) for critical services.</div>';
    b += '</div>';
    modal('TWO-PHASE — LINE SIZING REPORT', b, true);
  }

  function modal(title, inner, pdf) {
    var old = $('tp2-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'tp2-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(2,6,18,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;max-width:980px;width:100%;max-height:92vh;display:flex;flex-direction:column;">'
      + '<div style="display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #334155;">'
      + '<span style="font-family:monospace;font-size:13px;font-weight:800;color:#ff7538;flex:1;">' + title + '</span>'
      + (pdf ? '<button id="tp2-pdf" style="margin-right:8px;background:#16a34a;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">⬇ PDF</button>' : '')
      + '<button id="tp2-mclose" style="background:#ef4444;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">✕ CLOSE</button></div>'
      + '<div id="tp2-mbody" style="overflow:auto;padding:18px;background:#fff;border-radius:0 0 10px 10px;">' + inner + '</div></div>';
    document.body.appendChild(m);
    $('tp2-mclose').onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    var pb = $('tp2-pdf');
    if (pb) pb.onclick = function () {
      pb.textContent = '⏳ GENERATING…'; pb.disabled = true;
      var done = function () { pb.textContent = '⬇ PDF'; pb.disabled = false; };
      if (!window.AROPDF) { try { window.print(); } catch (e) {} done(); return; }
      var p = window.AROPDF($('tp2-mbody'), 'Two_Phase_Line_Sizing_Report.pdf', { landscape: false });
      if (p && p.then) p.then(done, done); else setTimeout(done, 1600);
    };
  }

  /* ─────────── wiring ─────────── */
  var INPUT_IDS = ['tp2-company', 'tp2-loc', 'tp2-pid', 'tp2-lineno', 'tp2-from', 'tp2-to', 'tp2-pair', 'tp2-sigma',
    'tp2-rhol', 'tp2-rhog', 'tp2-mul', 'tp2-mug', 'tp2-wl', 'tp2-wg', 'tp2-temp', 'tp2-pop', 'tp2-pup',
    'tp2-nps', 'tp2-sch', 'tp2-mat', 'tp2-len', 'tp2-dz', 'tp2-dpeq', 'tp2-service', 'tp2-pcterosion', 'tp2-dpallow'];
  FIT_NAMES.forEach(function (n, i) { INPUT_IDS.push('tp2-fit-' + i); });
  var DEFAULTS = null, UNDO = [], REDO = [], lastSnap = null;
  function snapshot() { var s = {}; INPUT_IDS.forEach(function (id) { var e = $(id); if (e) s[id] = e.value; }); return s; }
  function restore(s) { if (!s) return; INPUT_IDS.forEach(function (id) { var e = $(id); if (e && s[id] !== undefined) e.value = s[id]; }); calc(); }
  function pushUndo() { if (lastSnap) UNDO.push(lastSnap); if (UNDO.length > 60) UNDO.shift(); REDO = []; lastSnap = snapshot(); }
  function updHist() {
    var u = $('tp2-undo'), rd = $('tp2-redo');
    if (u) { u.disabled = !UNDO.length; u.style.opacity = UNDO.length ? '1' : '0.4'; }
    if (rd) { rd.disabled = !REDO.length; rd.style.opacity = REDO.length ? '1' : '0.4'; }
  }
  function wire() {
    INPUT_IDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      e.addEventListener('input', function () { pushUndo(); calc(); updHist(); });
      e.addEventListener('change', function () { pushUndo(); calc(); updHist(); });
    });
    var pair = $('tp2-pair');
    if (pair) pair.addEventListener('change', function () {
      var v = SIGMA[pair.value];
      if (v !== undefined) { var s = $('tp2-sigma'); if (s) { s.value = v; calc(); } }
    });
    var cb = $('tp2-calc'); if (cb) cb.addEventListener('click', function () { calc(); status(); });
    var rb = $('tp2-report'); if (rb) rb.addEventListener('click', report);
    var ub = $('tp2-undo'); if (ub) ub.addEventListener('click', function () { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); lastSnap = snapshot(); updHist(); });
    var rdb = $('tp2-redo'); if (rdb) rdb.addEventListener('click', function () { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); lastSnap = snapshot(); updHist(); });
    var rs = $('tp2-reset'); if (rs) rs.addEventListener('click', function () { if (DEFAULTS) { pushUndo(); restore(DEFAULTS); updHist(); } });
    lastSnap = snapshot(); if (!DEFAULTS) DEFAULTS = snapshot();
    updHist();
  }

  function build() {
    if (built) return;
    var host = document.getElementById('line-twophase-content'); if (!host) return;
    host.innerHTML = panelHTML();
    built = true;
    wire(); init3D();
    setTimeout(function () { resize3D(); calc(); }, 80);
    var tab = document.querySelector('[data-line-type="twophase"]');
    if (tab) tab.addEventListener('click', function () { setTimeout(function () { resize3D(); calc(); }, 120); });
  }
  function boot() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  else setTimeout(boot, 600);
  var tries = 0;
  var iv = setInterval(function () { if (built || tries++ > 25) { clearInterval(iv); return; } build(); }, 500);

  window.AROTP = { calc: calc, compute: compute, report: report };
})();

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
  /* Physical properties per fluid pair — selecting a pair fills every
     property below, so the design is calculated from the pair, not typed
     twice. σ is the interfacial surface tension (N/m), ρ kg/m³, μ cP. */
  var PAIRS = {
    'Water - Air (20 °C)':             { rhoL: 998.2, rhoG: 1.204, muL: 1.002, muG: 0.0181, sigma: 0.0728 },
    'Water - Nitrogen (20 °C)':        { rhoL: 998.2, rhoG: 1.165, muL: 1.002, muG: 0.0176, sigma: 0.0720 },
    'Water - Oxygen (20 °C)':          { rhoL: 998.2, rhoG: 1.331, muL: 1.002, muG: 0.0202, sigma: 0.0720 },
    'Water - Steam (100 °C)':          { rhoL: 958.4, rhoG: 0.598, muL: 0.282, muG: 0.0122, sigma: 0.0589 },
    'Water - Steam (150 °C)':          { rhoL: 917.0, rhoG: 2.548, muL: 0.182, muG: 0.0143, sigma: 0.0480 },
    'Water - Steam (200 °C)':          { rhoL: 864.7, rhoG: 7.860, muL: 0.134, muG: 0.0161, sigma: 0.0370 },
    'Water - Steam (250 °C)':          { rhoL: 799.0, rhoG: 19.96, muL: 0.106, muG: 0.0181, sigma: 0.0230 },
    'Water - Steam (300 °C)':          { rhoL: 712.1, rhoG: 46.17, muL: 0.0859, muG: 0.0204, sigma: 0.0089 },
    'Condensate - Steam (100 °C)':     { rhoL: 958.4, rhoG: 0.598, muL: 0.282, muG: 0.0122, sigma: 0.0590 },
    'Light Hydrocarbon - Natural Gas': { rhoL: 630.0, rhoG: 8.00, muL: 0.320, muG: 0.0110, sigma: 0.0250 },
    'Crude Oil - Natural Gas':         { rhoL: 850.0, rhoG: 8.00, muL: 5.000, muG: 0.0110, sigma: 0.0250 },
    'LPG Liquid - Vapor':              { rhoL: 550.0, rhoG: 15.00, muL: 0.150, muG: 0.0085, sigma: 0.0080 },
    'Ammonia Liquid - Vapor':          { rhoL: 610.0, rhoG: 6.00, muL: 0.150, muG: 0.0098, sigma: 0.0210 },
    'R134a Liquid - Vapor':            { rhoL: 1206.0, rhoG: 14.40, muL: 0.200, muG: 0.0116, sigma: 0.0080 },
    'R22 Liquid - Vapor':              { rhoL: 1210.0, rhoG: 21.20, muL: 0.190, muG: 0.0124, sigma: 0.0100 },
    'LNG - Natural Gas':               { rhoL: 450.0, rhoG: 1.80, muL: 0.110, muG: 0.0110, sigma: 0.0110 }
  };

  /* API 14E C-factor by service */
  var CFACTOR = { 'Clean Liquid': 100, 'Continuous Service': 125, 'General Hydrocarbon': 150, 'Corrosive Fluid': 100, 'Non-corrosive Gas': 200 };

  var built = false, three = null, LAST = null, SUGG = [];

  function $(id) { return document.getElementById(id); }
  /* Every numeric field used to be read with a plain parseFloat(), so the
     module never noticed the global unit-system selector at all: switching
     to US or CGS re-labelled nothing and converted nothing, and the physics
     below kept substituting whatever raw number sat in the box (e.g. a
     "34" typed as °F) straight into formulas written for SI. num() now
     mirrors the pattern already used by the other four line-sizing
     streams (lib/aro-linesize.js's g()) — a field tagged with
     data-unit-type is read back in SI via siOf(); anything else (or if
     siOf/the tag is unavailable) falls back to the raw value, unchanged
     from before. */
  function num(id, d) {
    var e = $(id); if (!e) return d;
    if (typeof window.siOf === 'function' && e.getAttribute('data-unit-type')) {
      var s = window.siOf(id, NaN);
      return isFinite(s) ? s : d;
    }
    var v = parseFloat(e.value); return isFinite(v) ? v : d;
  }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Printed unit → the quantity it measures, same map as aro-linesize.js.
     Anything absent (N/m surface tension, cP viscosity, %, unitless C
     factor) is either not part of this suite's unit conversions or is
     identical in every system it offers, so it is left exactly as typed. */
  var UNIT_OF = {
    'm': 'length-m', 'mm': 'length-mm', 'kg/hr': 'mass-flow',
    'bar': 'press-drop', 'bar(G)': 'pressure', '°C': 'temperature', 'kg/m³': 'density'
  };
  function symbolNow(type) {
    var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type];
    return C ? C.symbol(window.activeUnitSystem || 'SI') : '';
  }
  function CV(si, type) {
    var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type];
    return C ? C.fromSI(si, window.activeUnitSystem || 'SI') : si;
  }
  /* Display-side counterpart to num()/fld() above — the results panel and
     report built every row from a raw SI number with the unit spelled into
     the string ("f2(r.rhoMix) + ' kg/m³'"), so switching units re-labelled
     nothing there either. U() converts an SI figure to the active system;
     UG() does the same and only adds the "(G)" gauge marker when the
     resolved unit is actually bar. */
  function U(si, type, dp) {
    if (!isFinite(si)) return '—';
    if (typeof window.fromSIDisplay === 'function') return window.fromSIDisplay(type, si, dp == null ? 2 : dp);
    return si.toFixed(dp == null ? 2 : dp);
  }
  function UG(si, type, dp, suffix) {
    var v = U(si, type, dp);
    return v === '—' ? v : v + (symbolNow(type) === 'bar' ? suffix : '');
  }

  function fld(label, id, unit, v, step) {
    var type = UNIT_OF[unit] || '';
    var shown = v;
    if (type && v !== '' && isFinite(parseFloat(v)) && window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[type]) {
      var conv = window.UNIT_CONVERSIONS[type].fromSI(parseFloat(v), window.activeUnitSystem || 'SI');
      shown = Number(conv.toFixed(6)).toString();
    }
    var suffix = (unit === 'bar(G)') ? '(G)' : '';
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '" type="number"' + (type ? ' data-unit-type="' + type + '"' : '')
      + ' step="' + (step || 'any') + '" value="' + shown + '" '
      + 'style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + (unit ? '<span class="unit"' + (type ? ' data-unit-type="' + type + '"' : '')
              + (suffix ? ' data-unit-suffix="' + suffix + '"' : '')
              + ' style="font-size:9px;color:#64748b;min-width:52px;text-transform:none;">'
              + (type ? symbolNow(type) + (symbolNow(type) === 'bar' ? suffix : '') : unit) + '</span>' : '') + '</span></label>';
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

  function dsCell(label, i, type, ph, v) {
    return '<div class="input-cell pump-cell"><label for="' + i + '">' + label + '</label>'
      + '<input type="' + (type || 'text') + '" id="' + i + '" class="form-control text-data pump-input"'
      + (v ? ' value="' + esc(v) + '"' : '') + (ph ? ' placeholder="' + esc(ph) + '"' : '')
      + (type === 'date' ? ' style="color-scheme:dark;"' : '') + '/></div>';
  }

  /* Section 00 — same document classes and step-by-step depth as the pump
     and single-phase line-sizing manuals, so all five read as one set. */
  function manualHTML() {
    var h = '<details class="pump-accordion" id="tp2-manual">'
      + '<summary>00 &middot; USER MANUAL &mdash; HOW TO SIZE A TWO-PHASE LINE <span class="chevron">&#9660;</span></summary>'
      + '<div class="acc-content" style="display:block;"><div class="aro-doc">';

    h += '<p class="aro-doc-lead">A two-phase line carries liquid and gas together, so it is sized on the flow '
      + '<b>regime</b> the mixture actually takes &mdash; bubble, slug, churn, annular or mist &mdash; as much as on '
      + 'velocity and pressure drop. Work down the sections in order; the panel recalculates as you type, so you see '
      + 'the regime and the checks update before you finish entering data.</p>';

    h += '<div class="aro-doc-callout aro-doc-callout--warn"><b>Starting a new line? Press RESET first.</b> '
      + 'The panel keeps the previous line\'s fluids, flows, geometry, fittings and results sitting in every field '
      + 'until you clear them. RESET returns every field, the 3D view and the report to their untouched starting '
      + 'state before you enter a single value.</div>';

    h += '<div class="aro-doc-callout aro-doc-callout--info"><b>Set your units first.</b> The <b>unit system '
      + 'selector</b> in the top bar drives this line and the whole suite together &mdash; SI (m, bar, kg/hr), US '
      + 'customary (ft, psi, GPM) or mixed metric (cm, kg/cm&sup2;, L/min). You may switch at any time, including '
      + 'after a run: every input, output, chart, 3D model and report converts together. Switching units never '
      + 'changes the answer, only how it is written &mdash; the calculation itself always runs in SI underneath.</div>';

    h += '<h4 class="aro-doc-h">Step 1 &mdash; 01 &middot; Design data sheet</h4>'
      + '<p>Company, project location, line tag number, service description, P&amp;ID number, from/to, engineer, date '
      + 'and revision. None of it affects the calculation; all of it is printed on the report, so fill it in if the '
      + 'output is going into a document package.</p>';

    h += '<h4 class="aro-doc-h">Step 2 &mdash; 02 &middot; Physical properties</h4><ol class="aro-doc-ol">'
      + '<li><b>Fluid Pair</b> &mdash; pick a common liquid/gas combination from the library; surface tension, both '
      + 'densities, both viscosities are filled in for you, converted to the active unit system. <i>User defined</i> '
      + 'leaves every field for you to enter directly.</li>'
      + '<li><b>Surface tension</b>, <b>Liquid/Gas density</b>, <b>Liquid/Gas viscosity</b> &mdash; overwrite the '
      + 'filled values whenever a datasheet or lab figure differs. Surface tension is used only for the Weber number '
      + 'shown among the diagnostics; leaving it blank does not stop the rest of the calculation.</li>'
      + '<li><b>Liquid mass flow</b> and <b>Gas mass flow</b> &mdash; entered separately. From the two, the panel '
      + 'works out the <b>vapour quality x</b> = Wg/(Wg+Wl) and, from x, the <b>flow regime</b>: Pure Liquid, Bubble '
      + 'Flow, Bubble/Plug/Slug, Slug/Churn, Annular, Annular Mist or Pure Vapor. The regime and a plain-language '
      + 'recommendation (raise gas flow, raise liquid flow, or "GOOD" if bubble or annular) are shown live.</li></ol>';

    h += '<h4 class="aro-doc-h">Step 3 &mdash; 03 &middot; Operating conditions</h4>'
      + '<p><b>Operating temperature</b> and <b>Operating pressure</b> are carried for the record; <b>Upstream '
      + 'pressure</b> feeds the downstream-pressure check described below.</p>';

    h += '<h4 class="aro-doc-h">Step 4 &mdash; 04 &middot; Pipe data</h4><ol class="aro-doc-ol">'
      + '<li><b>NPS</b> and <b>Schedule</b> &mdash; the bore under evaluation, from the ASME B36.10M table.</li>'
      + '<li><b>Pipe Material</b> &mdash; sets the Colebrook absolute roughness ε used in the friction factor. '
      + '<i>User defined</i> opens a field to enter ε yourself.</li>'
      + '<li><b>AUTO-DESIGN MODE</b> &mdash; tick it and every recalculation adopts the smallest bore and schedule '
      + 'that satisfies every check together, the moment a check fails. Off, the same size is offered inline with an '
      + 'APPLY button instead of being applied automatically.</li>'
      + '<li><b>Line length</b> and <b>static height &Delta;z</b> &mdash; the geometry the pressure-drop calculation '
      + 'runs over.</li></ol>';

    h += '<h4 class="aro-doc-h">Step 5 &mdash; 05 &middot; Erosional velocity (API 14E)</h4>'
      + '<p>Two-phase erosion follows the same API RP 14E form as a single-phase line, using the <b>mixture '
      + 'density</b> from section 2 in place of a single fluid\'s density: <b>Ve = C/&radic;&rho;m</b>. Pick the '
      + '<b>Service (C factor)</b> band or enter your own C value; <b>% of erosional velocity</b> sets how close to '
      + 'Ve the design is allowed to run, and <b>Allowable &Delta;P</b> sets the pressure-drop ceiling checked in '
      + 'section 6 below &mdash; recalculated automatically for the line you have drawn (see the note at the end of '
      + 'this manual), or overwrite it with a figure from your own line-sizing study.</p>';

    h += '<h4 class="aro-doc-h">Step 6 &mdash; 06 &middot; Fittings &amp; valves</h4>'
      + '<p>Enter a quantity against each fitting or valve actually on the run. Each one carries a resistance '
      + 'coefficient K banded by NPS; anything left at zero contributes nothing. Components the fittings list does '
      + 'not cover &mdash; a control valve, a strainer, a reducer &mdash; are picked up automatically when placed on '
      + 'the P&amp;ID workbench described next.</p>';

    h += '<h4 class="aro-doc-h">AUTO vs MANUAL &mdash; the P&amp;ID workbench</h4>'
      + '<p>The <b>DESIGN MODE</b> selector switches between two ways of describing the run:</p><ul class="aro-doc-ul">'
      + '<li><b>AUTO</b> &mdash; length, elevation and fittings are the numbers you typed in sections 4 and 6. This is '
      + 'the fast path for a single straight run or an early estimate.</li>'
      + '<li><b>MANUAL</b> &mdash; opens a P&amp;ID workbench: draw the actual route leg by leg, drop valves, bends, '
      + 'flanges and reducers from the component library onto it, and the developed length, static height and every '
      + 'fitting count are read back from the drawing instead of typed in.</li></ul>'
      + '<p>Both modes share one 3D view of the line: real bore per NPS, actual flanges with bolts and gaskets, and '
      + 'a dense stream of glowing particles running through the pipe in the direction of flow, at a speed keyed to '
      + 'the calculated mixture velocity &mdash; so the line reads as fluid actually moving in service, not a static '
      + 'rod. A <b>COLOUR: VELOCITY / MATERIAL</b> toggle in the 3D toolbar switches every uncoloured leg between the '
      + 'velocity diagnostic and the pipe\'s actual finish for the material chosen in section 4. A <b>FLUID: VISIBLE '
      + '/ HIDDEN</b> toggle beside it turns the flow animation off for a clean drawing-only view.</p>'
      + '<p>The <b>MOVE / PAN</b> tool works the same way in both views: in 2D it drags the whole drawing to a new '
      + 'spot on the canvas without touching anything on it; in the 3D view, picking it switches drag from orbiting '
      + 'the model to sliding the whole view instead. A <b>BACKGROUND</b> colour swatch on the toolbar sets the '
      + 'canvas/3D background directly.</p>';

    h += '<h4 class="aro-doc-h">Step 7 &mdash; Run</h4>'
      + '<p>Press <b>&#9654; RUN TWO-PHASE CALCULATION</b>. The banner above the button turns green for a design that '
      + 'clears every check, or amber for one that needs review, and states the regime, mixture velocity and '
      + 'pressure drop it ran with.</p>';

    h += '<h4 class="aro-doc-h">Reading the results</h4><ul class="aro-doc-ul">'
      + '<li><b>Mixture velocity</b> &mdash; against a fixed 1&ndash;20 m/s target band. Two-phase lines are not '
      + 'banded by service the way a single-phase line is: too slow and the phases separate and slug; too fast and '
      + 'erosion and noise follow.</li>'
      + '<li><b>Erosional velocity</b> &mdash; against the API 14E allowable computed in section 5, using the '
      + 'mixture density.</li>'
      + '<li><b>Momentum flux &rho;m&middot;Vmix&sup2;</b> &mdash; a slug-flow specific criterion with its own limit '
      + '(6000 Pa good, 6000&ndash;12000 Pa review, above that increase pipe size), independent of the ordinary '
      + 'velocity band &mdash; a line can pass velocity and still carry a momentum flux high enough to shake fittings '
      + 'and supports under slug flow.</li>'
      + '<li><b>Pressure drop</b> &mdash; against the Allowable &Delta;P from section 5.</li>'
      + '<li><b>Bore vs required</b> &mdash; the NPS drawn against the bore the erosional-velocity limit actually '
      + 'requires at this flow, independent of whether the drawn bore happens to pass the velocity check.</li>'
      + '<li><b>Downstream pressure</b> &mdash; the upstream pressure from section 3, less friction, static and '
      + 'fitting losses. A negative figure means the line as drawn cannot deliver flow at all against that upstream '
      + 'pressure, and is flagged rather than shown as an ordinary result.</li></ul>'
      + '<p class="aro-doc-note">Froude and Weber numbers are shown alongside the checks as regime diagnostics '
      + '(gravity- vs inertia-dominated flow, and interface stability) &mdash; they describe the flow, but are not '
      + 'pass/fail checks themselves.</p>';

    h += '<h4 class="aro-doc-h">Auto-design &amp; suggestions</h4>'
      + '<p>When a check fails, <b>DESIGN UPGRADE SUGGESTIONS</b> lists each correction with the reasoning behind it '
      + 'and, where one applies directly to an input, an <b>APPLY</b> button. <b>&#9881; AUTO-STABILISE DESIGN</b> '
      + 'sweeps every ASME B36.10M bore and schedule in one step and adopts the smallest that satisfies every check '
      + 'together. When every check already passes you get a green stabilised-design banner instead, naming the bore '
      + 'it passed at.</p>';

    h += '<h4 class="aro-doc-h">Report</h4>'
      + '<p>Download the PDF from the report button. It carries the design data sheet, physical and mixture '
      + 'properties, pipe data, the design-validation checklist and, in MANUAL mode, the P&amp;ID sketch and the 3D '
      + 'model, in whichever unit system is active.</p>';

    h += '<div class="aro-doc-callout aro-doc-callout--warn"><b>Allowable &Delta;P is recalculated for your line, not '
      + 'fixed.</b> The panel converts every fitting K on the drawn route back into an equivalent length of straight '
      + 'pipe, applies the industry two-phase allowance of 0.5 bar per 100 m, and caps the result at 10&nbsp;% of the '
      + 'upstream absolute pressure so the allowance can never exceed the driving head available. You can still type '
      + 'over the figure in section 5 with one from your own line-sizing study.</div>';

    h += '</div></div></details>';
    return h;
  }

  function panelHTML() {
    var h = '<div class="sthe-grid">';
    h += '<div class="panel panel-input" style="max-height:calc(100vh - 190px);overflow-y:auto;overflow-x:hidden;">'
      + '<div class="panel-header" style="display:flex;align-items:center;gap:6px;"><span class="panel-title" style="flex:1;">TWO-PHASE FLOW — DESIGN INPUTS</span>'
      + '<button id="tp2-undo" class="tp2-hbtn" title="Undo"><span style="font-size:13px;">↩</span><span>UNDO</span></button>'
      + '<button id="tp2-redo" class="tp2-hbtn" title="Redo"><span style="font-size:13px;">↪</span><span>REDO</span></button>'
      + '<button id="tp2-reset" class="tp2-hbtn tp2-hbtn-red" title="Reset"><span style="font-size:13px;">↺</span><span>RESET</span></button></div>'
      + '<div class="panel-body">';

    h += manualHTML();

    /* Section 1 uses the suite's design-data-sheet card, the same one pump
       sizing carries, so every data sheet in the suite reads alike. */
    h += '<details class="pump-accordion" open><summary>01 &middot; DESIGN DATA SHEET <span class="chevron">&#9660;</span></summary>'
      + '<div class="acc-content input-grid-3" style=\"grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:start;\">'
      + dsCell('Company Name', 'tp2-company', 'text', 'Company Name')
      + dsCell('Project Location', 'tp2-loc', 'text', 'Project Location')
      + dsCell('Line Tag No', 'tp2-lineno', 'text', 'L-101-A')
      + dsCell('Service Description', 'tp2-svcdesc', 'text', 'Service Description')
      + dsCell('P&ID No.', 'tp2-pid', 'text', 'PID-001')
      + dsCell('Line From', 'tp2-from', 'text', 'From')
      + dsCell('Line To', 'tp2-to', 'text', 'To')
      + dsCell('Engineer', 'tp2-engineer', 'text', 'Engineer')
      + dsCell('Date', 'tp2-dsdate', 'date', '')
      + dsCell('Revision', 'tp2-dsrev', 'text', '0', '0')
      + '</div></details>';

    h += hdr('2 · PHYSICAL PROPERTIES');
    h += sel('FLUID PAIR', 'tp2-pair', Object.keys(PAIRS).concat(['User defined']), 'Water - Air (20 °C)');
    h += fld('Surface tension', 'tp2-sigma', 'N/m', 0.0728, '0.0001');
    h += two(fld('Liquid density', 'tp2-rhol', 'kg/m³', 998.2, '0.1'), fld('Gas density', 'tp2-rhog', 'kg/m³', 1.204, '0.001'));
    h += two(fld('Liquid viscosity', 'tp2-mul', 'cP', 1.002, '0.001'), fld('Gas viscosity', 'tp2-mug', 'cP', 0.0181, '0.0001'));
    h += two(fld('Liquid mass flow', 'tp2-wl', 'kg/hr', 20000, '10'), fld('Gas mass flow', 'tp2-wg', 'kg/hr', 60, '1'));

    h += hdr('3 · OPERATING CONDITIONS');
    h += two(fld('Operating temperature', 'tp2-temp', '°C', 34, '1'), fld('Operating pressure', 'tp2-pop', 'bar(G)', 1, '0.1'));
    h += fld('Upstream pressure', 'tp2-pup', 'bar(G)', 6, '0.1');

    h += hdr('4 · PIPE DATA');
    h += two(sel('NPS', 'tp2-nps', Object.keys(PIPE), '3'), sel('SCHEDULE', 'tp2-sch', SCHEDULES, '40'));
    h += sel('PIPE MATERIAL', 'tp2-mat', Object.keys(ROUGH).concat(['User defined']), 'CS');
    h += '<div id="tp2-matuser" style="display:none;">' + fld('Absolute roughness ε', 'tp2-eps', 'mm', '', '0.001') + '</div>';
    h += '<div id="tp2-pipeinfo" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-top:2px;"></div>';
    h += '<label style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 8px;border:1px solid #22c55e;border-radius:4px;background:rgba(34,197,94,0.06);cursor:pointer;">'
      + '<input type="checkbox" id="tp2-autofix" style="accent-color:#22c55e;"/>'
      + '<span style="font-family:var(--font-mono);font-size:9.5px;font-weight:700;color:#22c55e;line-height:1.4;">AUTO-DESIGN MODE — hold the line at the smallest bore that passes every check</span></label>';
    h += two(fld('Line length', 'tp2-len', 'm', 30, '0.5'), fld('Static height Δz', 'tp2-dz', 'm', 0.5, '0.1'));

    h += hdr('5 · EROSIONAL VELOCITY (API 14E)');
    h += sel('SERVICE (C factor)', 'tp2-service', Object.keys(CFACTOR).concat(['User defined']), 'Clean Liquid');
    h += fld('C factor value (API 14E)', 'tp2-cfactor', '', CFACTOR['Clean Liquid'], '1');
    h += fld('% of erosional velocity', 'tp2-pcterosion', '%', 75, '1');
    h += fld('Allowable ΔP', 'tp2-dpallow', 'bar', 0.45, '0.01');

    h += '<div id="tp2-fithdr">' + hdr('6 · FITTINGS &amp; VALVES (quantity)') + '</div>';
    h += '<div id="tp2-fitnote" style="display:none;font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.5;background:rgba(56,189,248,0.07);border-left:2px solid #38bdf8;padding:5px 7px;border-radius:3px;margin-bottom:5px;"></div>';
    h += '<div id="tp2-fitchips" style="display:none;margin-bottom:6px;"></div>';
    h += '<div id="tp2-fitgrid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    FIT_NAMES.forEach(function (n, i) { h += '<div>' + fld(n, 'tp2-fit-' + i, '', 0, '1') + '</div>'; });
    h += '</div>';

    h += '<button id="tp2-calc" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ RUN TWO-PHASE CALCULATION</button>';
    h += '<div id="tp2-status" style="display:none;margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#052e16;border-radius:5px;padding:8px 10px;text-align:center;line-height:1.4;"></div>';
    h += tpCSS();
    h += '</div></div>';

    h += '<div class="panel" style="max-height:calc(100vh - 190px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">TECHNICAL EVALUATIONS — TWO-PHASE LINE SIZING</span></div>'
      + '<div class="panel-body">'
      + '<div id="tp2-3dblock">' + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#94a3b8;text-align:center;margin-bottom:4px;">3D FLOW-REGIME SIMULATION — LIVE · DRAG TO ROTATE · SCROLL TO ZOOM</div>'
      + '<div id="tp2-3dwrap" style="position:relative;width:100%;height:300px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;">'
      + '<canvas id="tp2-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>'
      + '<div id="tp2-3dtag" style="position:absolute;left:8px;top:8px;font-family:var(--font-mono);font-size:11px;font-weight:700;color:#38bdf8;"></div>'
      + '<div id="tp2-3dsub" style="position:absolute;left:8px;top:26px;font-family:var(--font-mono);font-size:9px;color:#94a3b8;"></div></div>'
      + '<div id="tp2-bern" class="aln-bern"></div></div>'
      + '<div id="tp2-pidblock" style="display:none;"></div>'
      + '<div id="tp2-run" style="display:none;margin-top:10px;font-family:var(--font-mono);font-size:11px;font-weight:800;border-radius:5px;padding:9px 11px;line-height:1.45;"></div>'
      + '<div id="tp2-advisor" style="margin-top:12px;"></div>'
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
      + '.tp2-rr span{color:var(--text-muted);}.tp2-rr b{color:var(--text-header);}.tp2-rr.ok b{color:#22c55e;}.tp2-rr.warn b{color:#ef4444;}.tp2-rr.mid b{color:#f59e0b;}'
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
    // "User defined" carries no library value — the engineer types ε.
    var eps = ROUGH[matName] !== undefined ? ROUGH[matName] : num('tp2-eps', NaN);
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
    var C = num('tp2-cfactor', CFACTOR[svc] !== undefined ? CFACTOR[svc] : NaN);
    var VeFt = C / Math.sqrt(rhoMix * 0.06248);
    var Ve = VeFt * 0.3048;
    var pct = num('tp2-pcterosion', 75);
    var Vallow = Ve * (pct / 100);
    var eroOk = isFinite(Vallow) && Vmix < Vallow;
    var Areq = Qt / (3600 * Vallow);
    var Dreq = Math.sqrt((4 * Areq) / Math.PI);
    var DreqMm = Dreq * 1000, DreqIn = Dreq * 39.3701;
    var sizeOk = nps >= DreqIn;

    // Reynolds & friction (R81–R84)
    var Re = (rhoMix * Vmix * D) / (0.001 * muMix);
    var flowType = Re < 2100 ? 'LAMINAR' : Re <= 4000 ? 'TRANSITION' : 'TURBULENT';
    var f = Re < 2100 ? 64 / Re : 1.3255 / Math.pow(Math.log((eps / (3.7 * Dmm)) + (5.74 / Math.pow(Re, 0.9))), 2);
    var fCheck = !isFinite(f) ? 'Enter absolute roughness ε' : f < 0.005 ? 'Very smooth' : f < 0.02 ? 'Normal' : f < 0.05 ? 'High friction' : 'Review pipe size';

    // Pressure drop (R88–R156)
    var L = num('tp2-len', 4), dz = num('tp2-dz', 0.5);
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
    /* Components the workbook table does not cover (butterfly, control,
       relief, reducer, strainer, orifice, flange) are drawn on the P&ID but
       have no box in section 6, so their K is added here rather than lost. */
    if (MODE === 'manual' && PIDSUM && PIDSUM.extraK) {
      sumK += PIDSUM.extraK;
      PIDSUM.extra.forEach(function (x) { fitList.push({ name: x.tag + ' ' + x.name, qty: 1, k: x.k, total: x.k }); });
    }
    var dpFitPa = 0.5 * sumK * rhoMix * Vmix * Vmix;
    var dpFit = dpFitPa / 1e5;

    var dpTotal = dpFric + dpStat + dpFit;
    var pUp = num('tp2-pup', 6);
    var pDown = pUp - dpTotal;
    // Same gap as the other four line-sizing streams: nothing checked whether
    // there was still pressure left to deliver at the far end.
    var pDownOk = !isFinite(pDown) || pDown >= 0;

    /* Recommended allowable ΔP — derived from the line the user actually
       drew, not a fixed number. Equivalent length converts every fitting K
       back to metres of straight pipe (Leq = K·D/f), then the industry
       two-phase allowance of 0.5 bar per 100 m applies, capped at 10 % of
       the upstream absolute pressure so the line cannot eat the driving
       head, with a 0.05 bar floor for very short runs. */
    var LeqFit = (isFinite(f) && f > 0) ? sumK * D / f : 0;
    var Leq = L + LeqFit;
    var dpRec = Math.max(0.05, Math.min(0.5 * Leq / 100, 0.10 * (pUp + 1.01325)));
    var dpUser = num('tp2-dpallow', NaN);
    var dpAllow = isFinite(dpUser) && dpUser > 0 ? dpUser : dpRec;
    var dpAuto = !(isFinite(dpUser) && dpUser > 0);
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
      /* The shared momentum engine, on the MIXTURE properties this
         correlation produced. The per-phase contributions are reported
         alongside and never merged into the mixture figure — which of the
         two a number refers to is exactly what gets lost otherwise. */
      momCk: (window.AROMOM ? window.AROMOM.calculateFlowMomentumCheck({
        flowType: val('tp2-pair', 'Two-phase'), phase: 'twophase',
        density: rhoMix, velocity: Vmix,
        C_factor: C, service: 'user', allowableVelocity: Vallow,
        limitPa: (function () { var q = num('tp2-momlimit', NaN); return isFinite(q) && q > 0 ? q * 1000 : NaN; })(),
        phases: [{ name: 'Gas', density: rhoG, velocity: Vsg },
                 { name: 'Liquid', density: rhoL, velocity: Vsl }],
        basis: 'Homogeneous mixture density and mixture velocity as used by the selected '
             + 'two-phase correlation, on the actual internal diameter (' + Dmm.toFixed(1) + ' mm). '
             + 'Gas and liquid contributions are the superficial-velocity values.'
      }) : null),
      svc: svc, C: C, VeFt: VeFt, Ve: Ve, pct: pct, Vallow: Vallow, eroOk: eroOk,
      Areq: Areq, DreqMm: DreqMm, DreqIn: DreqIn, sizeOk: sizeOk,
      Re: Re, flowType: flowType, f: f, fCheck: fCheck,
      L: L, dz: dz, dpFricPa: dpFricPa, dpFric: dpFric, headLoss: headLoss,
      dpStatPa: dpStatPa, dpStat: dpStat, sumK: sumK, fitList: fitList, dpFitPa: dpFitPa, dpFit: dpFit,
      dpTotal: dpTotal, pUp: pUp, pDown: pDown, pDownOk: pDownOk, dpAllow: dpAllow, dpOk: dpOk, T: T,
      LeqFit: LeqFit, Leq: Leq, dpRec: dpRec, dpAuto: dpAuto
    };
  }


  /* ─────────── DESIGN STABILISATION (point 5) ───────────
     Every failed check turns into a concrete, applyable change with the
     engineering reason spelled out. AUTO-STABILISE sweeps NPS × schedule
     and picks the smallest bore that satisfies every check at once, so the
     line is not oversized just to pass. */
  function checks(r) {
    return [
      { key: 'vel',    ok: r.velOk,  label: 'Mixture velocity',   detail: U(r.Vmix, 'velocity', 2) + ' (target ' + UB(1, 20, 'velocity', 0) + ')' },
      { key: 'erode',  ok: r.eroOk,  label: 'Erosional velocity', detail: U(r.Vmix, 'velocity', 2) + ' vs allowable ' + U(r.Vallow, 'velocity', 2) + ' (API 14E)' },
      { key: 'mom',    ok: r.momOk,  label: 'Momentum flux',      detail: Math.round(r.mom) + ' Pa (limit 6 000 Pa)' },
      { key: 'dp',     ok: r.dpOk,   label: 'Pressure drop',      detail: U(r.dpTotal, 'press-drop', 3) + ' vs allowable ' + U(r.dpAllow, 'press-drop', 3) },
      { key: 'size',   ok: r.sizeOk, label: 'Bore vs required',   detail: r.nps + '" vs required ' + f2n(r.DreqIn) + '"' },
      { key: 'pdown',  ok: r.pDownOk, label: 'Downstream pressure', detail: r.pDownOk
          ? UG(r.pDown, 'pressure', 2, '(G)') + ' remains, against ' + UG(r.pUp, 'pressure', 2, '(G)') + ' entered upstream'
          : 'Losses (' + U(r.dpTotal, 'press-drop', 3) + ') exceed the ' + UG(r.pUp, 'pressure', 2, '(G)') + ' entered upstream — no pressure left to deliver flow' }
    ];
  }
  function UB(lo, hi, type, dp) {
    var d = dp == null ? 2 : dp;
    return U(lo, type, d) + ' – ' + U(hi, type, d);
  }
  function f2n(v) { return isFinite(v) ? v.toFixed(2) : '—'; }
  function f3n(v) { return isFinite(v) ? v.toFixed(3) : '—'; }

  /* Recompute the whole design for a trial bore without touching the DOM. */
  function trial(nps, sch) {
    var keepN = $('tp2-nps').value, keepS = $('tp2-sch').value;
    $('tp2-nps').value = nps; $('tp2-sch').value = sch;
    var r = compute();
    $('tp2-nps').value = keepN; $('tp2-sch').value = keepS;
    return r;
  }
  function allPass(r) { return checks(r).every(function (c) { return c.ok; }); }

  var AUTOBUSY = false, AUTOMSG = '', BEST = null;
  /* The stabilised design offered inline at the pipe verdict, so the fix sits
     where the failure is read rather than far below it. */
  function fixBar(r, row) {
    if (AUTOMSG) { var m = AUTOMSG; AUTOMSG = '';
      return '<div style="margin:6px 0;font-family:var(--font-mono);font-size:9.5px;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.10);border-left:3px solid #22c55e;padding:7px 9px;border-radius:4px;line-height:1.5;">\u2699 AUTO-DESIGN &mdash; ' + esc(m) + '</div>'; }
    if (allPass(r)) return '';
    BEST = stabilise();
    var bad = checks(r).filter(function (c) { return !c.ok; }).map(function (c) { return c.label.toLowerCase(); }).join(', ');
    if (!BEST) return '<div style="margin:6px 0;font-family:var(--font-mono);font-size:9.5px;color:#fca5a5;background:rgba(239,68,68,0.10);border-left:3px solid #ef4444;padding:7px 9px;border-radius:4px;line-height:1.5;">Failing: ' + esc(bad) + '. No standard bore or schedule satisfies every check at this duty.</div>';
    if (BEST.nps === r.nps && String(BEST.sch) === String(r.sch)) return '';
    return '<div style="margin:6px 0;font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;padding:7px 9px;border-radius:4px;line-height:1.55;">'
      + '<b style="color:#f59e0b;">AUTO DESIGN &rarr; ' + BEST.nps + '\u2033 sch ' + esc(String(BEST.sch)) + '</b><br/>'
      + 'Failing now: ' + esc(bad) + '. This is the smallest size in the ASME B36.10M range that satisfies every check together.'
      + '<button id="tp2-fixnow" style="display:block;margin-top:6px;background:transparent;border:1px solid #f59e0b;color:#f59e0b;font-family:var(--font-mono);font-size:9px;font-weight:800;padding:4px 10px;border-radius:3px;cursor:pointer;">APPLY ' + BEST.nps + '\u2033 SCH ' + esc(String(BEST.sch)) + '</button></div>';
  }

  function stabilise() {
    var sizes = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
    var best = null;
    for (var i = 0; i < sizes.length; i++) {
      for (var j = 0; j < SCHEDULES.length; j++) {
        if (PIPE[sizes[i]].s[SCHEDULES[j]] === undefined) continue;
        var r = trial(sizes[i], SCHEDULES[j]);
        if (allPass(r)) { best = { nps: sizes[i], sch: SCHEDULES[j], r: r }; break; }
      }
      if (best) break;
    }
    return best;
  }

  function suggestions(r) {
    var out = [];
    var sizes = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
    var idx = sizes.indexOf(r.nps);
    var up = idx >= 0 && idx < sizes.length - 1 ? sizes[idx + 1] : null;
    var down = idx > 0 ? sizes[idx - 1] : null;

    if (!r.eroOk) out.push({ title: 'Increase bore to ' + (up ? up + '"' : 'the next size'),
      why: 'Mixture velocity ' + U(r.Vmix, 'velocity', 2) + ' exceeds the API RP 14E allowable ' + U(r.Vallow, 'velocity', 2) + ', so the line will erode at bends and tees.',
      apply: up ? function () { $('tp2-nps').value = up; } : null });
    if (!r.momOk) out.push({ title: 'Increase bore to ' + (up ? up + '"' : 'the next size'),
      why: 'Momentum flux ' + Math.round(r.mom) + ' Pa is above the 6 000 Pa screening limit — supports and fittings see impact loading.',
      apply: up ? function () { $('tp2-nps').value = up; } : null });
    if (!r.dpOk) {
      out.push({ title: 'Increase bore to ' + (up ? up + '"' : 'the next size'),
        why: 'Total ΔP ' + U(r.dpTotal, 'press-drop', 3) + ' exceeds the allowable ' + U(r.dpAllow, 'press-drop', 3) + '. ΔP falls roughly with D⁻⁵, so one size up is usually enough.',
        apply: up ? function () { $('tp2-nps').value = up; } : null });
      if (r.dpFit > r.dpFric) out.push({ title: 'Reduce fittings on the run',
        why: 'Fittings contribute ' + U(r.dpFit, 'press-drop', 3) + ' against ' + U(r.dpFric, 'press-drop', 3) + ' of straight-pipe friction (ΣK = ' + f2n(r.sumK) + '). Replacing standard elbows with long-radius bends, or deleting a redundant valve, recovers more than a size change.',
        apply: null });
    }
    if (r.Vmix < 1) out.push({ title: 'Reduce bore to ' + (down ? down + '"' : 'the next size down'),
      why: 'Mixture velocity ' + U(r.Vmix, 'velocity', 2) + ' is below ' + U(1, 'velocity', 0) + ' — liquid will drop out and slug on restart.',
      apply: down ? function () { $('tp2-nps').value = down; } : null });
    if (/Slug|Churn/.test(r.regime)) out.push({ title: 'Move the regime away from slug/churn',
      why: 'Slug and churn flow impose cyclic loads on supports and give unstable control. Raising the gas rate toward annular, or dropping a pipe size to raise velocity, stabilises the pattern.',
      apply: null });
    /* The required-bore check had no fix attached to it, so a design could
       fail on size with nothing offered. The smallest standard bore that
       clears the requirement is now proposed directly. */
    if (!r.sizeOk) {
      var need = null;
      for (var si = 0; si < sizes.length; si++) if (sizes[si] >= r.DreqIn) { need = sizes[si]; break; }
      out.push({ title: need ? 'Increase bore to ' + need + '" — the smallest size that meets the requirement'
                            : 'No standard bore meets the required diameter',
        why: 'The duty needs at least ' + U(r.DreqMm, 'length-mm', 2) + ' (' + f2n(r.DreqIn) + '") to hold the mixture at or below '
          + U(r.Vallow, 'velocity', 2) + ', and the line is drawn at ' + r.nps + '" (' + U(r.Dmm, 'length-mm', 2) + '). '
          + (need ? need + '" is the first ASME B36.10M size that clears it.'
                  : 'Split the duty across two lines, or accept a higher percentage of the erosional velocity if the service allows it.'),
        apply: need ? function () { $('tp2-nps').value = need; } : null });
    }

    /* A low erosional set point is a design choice, not a fault — but when it
       is what is failing the line, say so and offer the industry figure. */
    if (!r.eroOk && r.pct < 60) out.push({ title: 'Review the erosional set point — currently ' + f2n(r.pct) + ' % of Ve',
      why: 'The allowable velocity is only ' + U(r.Vallow, 'velocity', 2) + ' because the design is held to ' + f2n(r.pct)
        + ' % of the ' + U(r.Ve, 'velocity', 2) + ' erosional velocity. API RP 14E is normally applied at 75–100 % for a clean, non-erosive service. Raising the set point to 75 % gives ' + U(r.Ve * 0.75, 'velocity', 2) + ' without changing the pipe.',
      apply: function () { $('tp2-pcterosion').value = 75; } });

    /* Schedule is the cheaper lever when the bore is already right. */
    if ((!r.eroOk || !r.dpOk) && r.sch !== '5') {
      var lighter = { '160': '80', '80': '40', '40': '10', '10': '5' }[r.sch];
      if (lighter && PIPE[r.nps] && PIPE[r.nps].s[lighter] !== undefined) {
        out.push({ title: 'Open the bore by going to schedule ' + lighter + ' at the same NPS',
          why: 'At ' + r.nps + '" the internal diameter grows from ' + U(r.Dmm, 'length-mm', 2) + ' to '
            + U(PIPE[r.nps].s[lighter] * 25.4, 'length-mm', 2) + ' on schedule ' + lighter + '. Velocity falls with D² and friction with D⁵, so this often clears the check without moving to the next NPS — provided the pressure rating still covers the duty.',
          apply: function () { $('tp2-sch').value = lighter; } });
      }
    }

    if (r.dpAuto) out.push({ title: 'Allowable ΔP set automatically to ' + U(r.dpRec, 'press-drop', 3),
      why: 'No vendor figure was entered, so the allowance comes from this line: equivalent length ' + U(r.Leq, 'length-m', 2) + ' (straight ' + U(r.L, 'length-m', 2) + ' + ' + U(r.LeqFit, 'length-m', 2) + ' of fittings) at 0.5 bar/100 m, capped at 10 % of the upstream absolute pressure. Enter the vendor value to override.',
      apply: null });
    /* Backstop — whenever anything still fails, close with the stabilised
       design, so there is always one change that resolves the lot rather than
       a list of partial fixes. */
    var openC = checks(r).filter(function (c) { return !c.ok; });
    if (openC.length) {
      var best = stabilise();
      var already = best && best.nps === r.nps && String(best.sch) === String(r.sch);
      if (!already) out.push({ title: best ? 'Adopt ' + best.nps + '" sch ' + best.sch + ' — clears every outstanding check'
                                           : 'No standard size clears every check at this duty',
        why: (best ? 'Still failing: ' + openC.map(function (c) { return c.label.toLowerCase(); }).join(', ')
                   + '. Sweeping every ASME B36.10M bore and schedule, ' + best.nps + '" sch ' + best.sch
                   + ' is the smallest that satisfies velocity, erosion, momentum, pressure drop and required diameter together — Vmix '
                   + f2n(best.r.Vmix) + ' m/s, ΔP ' + f3n(best.r.dpTotal) + ' bar.'
                 : 'Still failing: ' + openC.map(function (c) { return c.label.toLowerCase(); }).join(', ')
                   + '. No bore in the ASME B36.10M range satisfies them all at this flow — reduce the duty, shorten the run, or relax the allowance.'),
        apply: best ? function () { $('tp2-nps').value = best.nps; $('tp2-sch').value = best.sch; } : null });
    }
    return out;
  }

  function renderAdvisor(r) {
    var el = $('tp2-advisor'); if (!el) return;
    var cs = checks(r), bad = cs.filter(function (c) { return !c.ok; });
    if (window.AROENG) {
      try {
        window.AROENG.publish('line-twophase', {
          checks: cs.map(function (c) {
            return { key: c.key, label: c.label, detail: c.detail, status: c.ok ? 'pass' : 'fail' };
          })
        });
      } catch (e) {}
    }
    var h = '<div class="tp2-cardh">DESIGN VALIDATION</div>';
    cs.forEach(function (c) {
      h += '<div class="tp2-rr ' + (c.ok ? 'ok' : 'warn') + '"><span>' + esc(c.label) + ' — ' + esc(c.detail) + '</span><b>' + (c.ok ? 'PASS' : 'FAIL') + '</b></div>';
    });
    if (!bad.length) {
      h += '<div style="margin-top:8px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.10);border-left:3px solid #22c55e;padding:7px 9px;border-radius:4px;">✓ STABILISED DESIGN — every check satisfied at ' + r.nps + '" sch ' + esc(r.sch) + '.</div>';
    }
    SUGG = suggestions(r);
    if (SUGG.length) {
      h += '<div class="tp2-cardh" style="margin-top:12px;">DESIGN UPGRADE SUGGESTIONS</div>';
      SUGG.forEach(function (sg, i) {
        h += '<div style="border:1px solid var(--border-muted);border-left:3px solid #f59e0b;border-radius:4px;padding:7px 9px;margin:6px 0;background:rgba(245,158,11,0.05);">'
          + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:#f59e0b;">' + esc(sg.title) + '</div>'
          + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;line-height:1.55;margin-top:3px;">' + esc(sg.why) + '</div>'
          + (sg.apply ? '<button class="tp2-apply" data-i="' + i + '" style="margin-top:5px;background:transparent;border:1px solid #f59e0b;color:#f59e0b;font-family:var(--font-mono);font-size:9px;font-weight:700;padding:3px 9px;border-radius:3px;cursor:pointer;">APPLY</button>' : '')
          + '</div>';
      });
    }
    h += '<button id="tp2-stabilise" style="width:100%;margin-top:8px;background:transparent;border:1px solid #22c55e;color:#22c55e;font-family:var(--font-mono);font-size:10px;font-weight:800;padding:8px;border-radius:4px;cursor:pointer;">⚙ AUTO-STABILISE DESIGN</button>';
    h += '<div id="tp2-stabmsg" style="display:none;margin-top:6px;font-family:var(--font-mono);font-size:9.5px;line-height:1.5;padding:7px 9px;border-radius:4px;"></div>';
    el.innerHTML = h;

    [].slice.call(el.querySelectorAll('.tp2-apply')).forEach(function (b) {
      b.addEventListener('click', function () {
        var sg = SUGG[parseInt(b.getAttribute('data-i'), 10)];
        if (sg && sg.apply) { pushUndo(); sg.apply(); calc(); updHist(); }
      });
    });
    var sb = $('tp2-stabilise');
    if (sb) sb.addEventListener('click', function () {
      var msg = $('tp2-stabmsg'); if (msg) msg.style.display = 'block';
      var best = stabilise();
      if (!best) {
        if (msg) { msg.style.background = 'rgba(239,68,68,0.10)'; msg.style.color = '#fca5a5';
          msg.textContent = 'No pipe size in the ASME B36.10M range satisfies every check at these flows. Reduce the flow, shorten the run, or relax the allowable ΔP.'; }
        return;
      }
      pushUndo();
      $('tp2-nps').value = best.nps; $('tp2-sch').value = best.sch;
      calc(); updHist();
      var m2 = $('tp2-stabmsg');
      if (m2) { m2.style.display = 'block'; m2.style.background = 'rgba(34,197,94,0.10)'; m2.style.color = '#86efac';
        m2.textContent = 'Stabilised at ' + best.nps + '" sch ' + best.sch + ' — smallest bore that passes velocity, erosion, momentum, ΔP and required-diameter checks together.'; }
    });
  }

  /* Validate required inputs — prevent calculation with zero/missing values */
  function validateTwoPhaseInputs() {
    var missing = [];
    var checkInputs = [
      { id: 'tp2-wl', label: 'Liquid mass flow' },
      { id: 'tp2-wg', label: 'Gas mass flow' },
      { id: 'tp2-rhol', label: 'Liquid density' },
      { id: 'tp2-rhog', label: 'Gas density' },
      { id: 'tp2-mul', label: 'Liquid viscosity' },
      { id: 'tp2-mug', label: 'Gas viscosity' }
    ];
    checkInputs.forEach(function(inp) {
      var el = $(inp.id);
      if (!el) return;
      if (window.AROVALID ? window.AROVALID.missing(el)
                          : !isFinite(parseFloat(el.value)) || parseFloat(el.value) === 0) missing.push(inp.label);
    });
    return missing;
  }

  /* Show required inputs dialog — every time RUN is pressed while inputs
     are still missing, not gated to once per session, so a second press
     always explains itself instead of quietly doing nothing. */
  function showTwoPhaseInputsDialog(missing) {
    if (window.__aroBackgroundRun) return;   // a re-run is not a request to design
    var old = $('tp2-reqinput-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'tp2-reqinput-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100003;background:rgba(2,6,18,0.92);display:flex;align-items:center;justify-content:center;';
    var inner = '<div style="background:#0f172a;border:2px solid #ef4444;border-radius:8px;max-width:520px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.8);">'
      + '<div style="font-size:20px;font-weight:800;color:#ef4444;margin-bottom:16px;display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">⚠</span> REQUIRED INPUTS MISSING</div>'
      + '<div style="font-size:13px;color:#cbd5e1;margin-bottom:16px;line-height:1.6;">Enter values for the following before running two-phase calculation — the design depends on real inputs:</div>'
      + '<ul style="list-style:none;padding:0;margin:0 0 16px 0;">';
    missing.forEach(function(m) {
      inner += '<li style="font-family:var(--font-mono);font-size:12px;color:#f87171;margin:6px 0;padding-left:24px;">• ' + m + '</li>';
    });
    inner += '</ul>'
      + '<button id="tp2-reqinput-ok" style="width:100%;background:linear-gradient(135deg,#ea580c,#f97316);border:none;color:#fff;font-family:var(--font-mono);font-size:14px;font-weight:800;padding:14px;border-radius:5px;cursor:pointer;">OK, I\'LL FILL THEM IN</button>'
      + '</div>';
    m.innerHTML = inner;
    document.body.appendChild(m);
    var okBtn = $('tp2-reqinput-ok');
    if (okBtn) okBtn.onclick = function() { m.remove(); };
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  }

  function calc() {
    if (!$('tp2-results')) return;
    /* After a reset nothing is shown until inputs are supplied — validation
       and suggestions built from defaults read as the previous design. */
    if (window.ARORESET && window.ARORESET.is('tp2')) {
      window.ARORESET.placeholder($('tp2-results'), 'the two-phase line');
      var a0 = $('tp2-advisor'); if (a0) a0.innerHTML = '';
      ['tp2-status', 'tp2-run'].forEach(function (i) { var e = $(i); if (e) { e.style.display = 'none'; e.textContent = ''; } });
      if (three) { while (three.group.children.length) { var c0 = three.group.children.pop(); if (c0.geometry) c0.geometry.dispose(); } three.anim = null; }
      var tg0 = $('tp2-3dtag'), sb0 = $('tp2-3dsub');
      if (tg0) tg0.textContent = ''; if (sb0) sb0.textContent = '';
      // the station gauges belong to the animation window and go with it
      var bn0 = $('tp2-bern'); if (bn0) bn0.innerHTML = '';
      if (window.AROFITHL) window.AROFITHL('tp2-', FIT_NAMES, 'tp2-fitchips');
      return;
    }
    var r = LAST = compute();

    /* AUTO-DESIGN MODE — a failing verdict is closed before the results are
       drawn, so what the engineer reads is already a design that passes. */
    if (!AUTOBUSY && $('tp2-autofix') && $('tp2-autofix').checked && !allPass(r)) {
      var fix = stabilise();
      if (fix && (fix.nps !== r.nps || String(fix.sch) !== String(r.sch))) {
        AUTOMSG = 'held at ' + fix.nps + '\u2033 sch ' + fix.sch + ' (was ' + r.nps + '\u2033 sch ' + r.sch
          + ') \u2014 the smallest bore that satisfies every check at this duty.';
        AUTOBUSY = true;
        $('tp2-nps').value = fix.nps; $('tp2-sch').value = fix.sch;
        AUTOBUSY = false;
        r = LAST = compute();
      }
    }
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
    h += row('Mixture density ρmix', U(r.rhoMix, 'density', 2));
    h += row('Mixture viscosity μmix', f3(r.muMix) + ' cP');
    h += row('Liquid / gas volumetric flow', U(r.Ql, 'vol-flow', 3) + ' / ' + U(r.Qg, 'vol-flow', 3));
    h += row('Total volumetric flow', U(r.Qt, 'vol-flow', 3));
    h += row('Mass flux G', f2(r.G) + ' kg/m²·s');

    h += '<div class="tp2-cardh">PIPE &amp; VELOCITIES</div>';
    h += row('NPS / schedule', r.nps + '" Sch ' + r.sch);
    h += fixBar(r, row);
    h += row('OD / ID / thickness', f3(r.odIn) + ' / ' + f3(r.idIn) + ' / ' + f3(r.thkIn) + ' in');
    h += row('Internal diameter', U(r.Dmm, 'length-mm', 2));
    h += row('Roughness ε / relative', U(r.eps, 'length-mm', 3) + ' / ' + r.relRough.toExponential(3));
    h += row('Superficial liquid velocity', U(r.Vsl, 'velocity', 3));
    h += row('Superficial gas velocity', U(r.Vsg, 'velocity', 3));
    h += row('Mixture velocity', U(r.Vmix, 'velocity', 3), r.velOk ? 'ok' : 'mid');
    h += row('Velocity assessment', r.velCheck, r.velOk ? 'ok' : 'mid');

    h += '<div class="tp2-cardh">DIMENSIONLESS NUMBERS</div>';
    h += row('Froude — liquid / gas', f3(r.FrL) + ' / ' + f3(r.FrG));
    h += row('Froude regime', r.frRegime);
    h += row('Weber number  We = ρV²D/σ', f1(r.We));
    h += row('Weber assessment', r.weCheck, r.We < 100 ? 'ok' : 'mid');
    h += row('Momentum flux  ρV²', f1(r.mom) + ' Pa');
    h += row('Momentum assessment', r.momCheck, r.momOk ? 'ok' : 'warn');

    /* The shared block, identical to the four single-phase panels. */
    if (r.momCk && window.AROMOM) {
      h += window.AROMOM.render(r.momCk, {
        num: function (v, d) { return isFinite(v) ? v.toFixed(d == null ? 2 : d) : '—'; },
        vel: function (v) { return U(v, 'velocity', 2); },
        rho: function (v) { return isFinite(v) ? f1(v) + ' kg/m³' : '—'; }
      });
    }
    h += row('Reynolds number', f0(r.Re) + '  (' + r.flowType + ')');
    h += row('Friction factor f', f4(r.f) + '  — ' + r.fCheck);

    h += '<div class="tp2-cardh">EROSIONAL VELOCITY — API 14E</div>';
    h += row('Service / C factor', r.svc + '  /  C = ' + r.C);
    h += row('Erosional velocity Ve', f2(r.VeFt) + ' ft/s  =  ' + U(r.Ve, 'velocity', 3));
    h += row('Allowable (' + r.pct + ' % of Ve)', U(r.Vallow, 'velocity', 3));
    h += row('Vmix < allowable ?', r.eroOk ? 'YES' : 'NO', r.eroOk ? 'ok' : 'warn');
    h += row('Required area / diameter', r.Areq.toExponential(3) + ' m²  /  ' + U(r.DreqMm, 'length-mm', 2));
    h += row('Required NPS', f3(r.DreqIn) + ' in');
    h += row('Pipe size check', r.sizeOk ? 'PASS — pipe size adequate' : 'FAIL — increase pipe size', r.sizeOk ? 'ok' : 'warn');

    h += '<div class="tp2-cardh">PRESSURE DROP</div>';
    h += row('Friction  (L = ' + U(r.L, 'length-m', 1) + ')', f0(r.dpFricPa) + ' Pa  =  ' + U(r.dpFric, 'press-drop', 4));
    h += row('Head loss', U(r.headLoss, 'length-m', 3));
    h += row('Static  (Δz = ' + U(r.dz, 'length-m', 1) + ')', f0(r.dpStatPa) + ' Pa  =  ' + U(r.dpStat, 'press-drop', 4));
    h += row('Fittings  (ΣK = ' + f2(r.sumK) + ')', f0(r.dpFitPa) + ' Pa  =  ' + U(r.dpFit, 'press-drop', 4));
    h += row('TOTAL ΔP', U(r.dpTotal, 'press-drop', 4), r.dpOk ? 'ok' : 'warn');
    h += row('Allowable ΔP', U(r.dpAllow, 'press-drop', 4));
    h += row('Within allowable ?', r.dpOk ? 'YES' : 'NO', r.dpOk ? 'ok' : 'warn');
    h += row('Upstream → downstream', UG(r.pUp, 'pressure', 2, '(G)') + ' → ' + UG(r.pDown, 'pressure', 2, '(G)'), r.pDownOk ? null : 'warn');

    $('tp2-results').innerHTML = h;
    var fx = $('tp2-fixnow');
    if (fx) fx.addEventListener('click', function () {
      if (!BEST) return;
      pushUndo();
      $('tp2-nps').value = BEST.nps; $('tp2-sch').value = BEST.sch;
      calc(); updHist();
    });
    var pi = $('tp2-pipeinfo');
    if (pi) pi.textContent = 'OD ' + r.odIn.toFixed(3) + '" · ID ' + r.idIn.toFixed(3) + '" (' + U(r.Dmm, 'length-mm', 2) + ') · thk ' + r.thkIn.toFixed(3) + '" · ε ' + U(r.eps, 'length-mm', 3);
    if (window.AROFITHL) window.AROFITHL('tp2-', FIT_NAMES, 'tp2-fitchips');
    update3D(r);
    renderAdvisor(r);
  }
  function f4(v) { return isFinite(v) ? v.toFixed(4) : '—'; }

  function status() {
    var el = $('tp2-status'); if (!el || !LAST) return;
    var r = LAST, ok = r.dpOk && r.sizeOk && r.eroOk;
    el.style.display = 'block';
    el.style.background = ok ? 'linear-gradient(135deg,#22c55e,#4ade80)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)';
    el.innerHTML = (ok ? '✓ DESIGN OK' : '⚠ REVIEW') + ' · ' + r.regime + ' · Vmix ' + U(r.Vmix, 'velocity', 2) + ' · ΔP ' + U(r.dpTotal, 'press-drop', 3);

    /* Repeat the verdict at the top of the output column — in MANUAL the RUN
       button sits a long way from the results. */
    var top = $('tp2-run');
    if (top) {
      top.style.display = 'block';
      top.style.background = ok ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)';
      top.style.borderLeft = '3px solid ' + (ok ? '#22c55e' : '#f59e0b');
      top.style.color = ok ? '#86efac' : '#fbbf24';
      top.textContent = (ok ? '✓ RUN COMPLETE — design OK.  ' : '⚠ RUN COMPLETE — review needed.  ')
        + r.regime + ' · ' + r.nps + '″ Sch ' + r.sch + ' · ' + U(r.L, 'length-m', 1) + ' · Vmix ' + U(r.Vmix, 'velocity', 2)
        + ' · ΔP ' + U(r.dpTotal, 'press-drop', 3) + ' of ' + U(r.dpAllow, 'press-drop', 3) + ' allowable'
        + (MODE === 'manual' ? '  ·  geometry and fitting counts from the P&ID' : '');
    }
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
    /* Skip render() while this tab is hidden (offsetParent null under
       display:none) — a page with the four line-sizing streams, PHE and Tank
       each carrying their own persistent WebGL context can run into the
       browser's live-context limit; the eviction that follows leaves a
       background tab's pipe looking frozen forever with no error anywhere.
       This alone can't undo an eviction that already happened, but it stops
       a hidden tab from spending a context slot on frames nobody sees. */
    (function loop() {
      requestAnimationFrame(loop);
      if (!canvas.offsetParent) return;
      if (three && three.anim) three.anim();
      rn.render(scene, cam);
    })();
    window.addEventListener('resize', resize3D);
  }
  function resize3D() {
    if (!three) return; var c = three.canvas; if (!c || !c.clientWidth) return;
    three.cam.aspect = c.clientWidth / c.clientHeight; three.cam.updateProjectionMatrix();
    three.rn.setSize(c.clientWidth, c.clientHeight, false);
  }

  /* Sprite text — used for the FROM / TO end markers on the 3D run. */
  function textSprite(txt, colour) {
    var c = document.createElement('canvas'), ctx = c.getContext('2d');
    ctx.font = 'bold 40px monospace';
    c.width = Math.max(64, ctx.measureText(txt).width + 24); c.height = 56;
    var x = c.getContext('2d');
    x.font = 'bold 40px monospace'; x.fillStyle = colour; x.textBaseline = 'middle';
    x.fillText(txt, 12, 28);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(c.width / 72, c.height / 72, 1);
    return sp;
  }
  function labelEnds(r, L, R) {
    var from = (val('tp2-from', '') || 'FROM').toUpperCase();
    var to = (val('tp2-to', '') || 'TO').toUpperCase();
    var a = textSprite(from, '#38bdf8'); a.position.set(-L / 2 - 1.2, R + 1.6, 0); three.group.add(a);
    var b = textSprite('\u2192 ' + to, '#22c55e'); b.position.set(L / 2 + 1.2, R + 1.6, 0); three.group.add(b);
    var size = textSprite(r.nps + '\" SCH ' + r.sch + '  \u00b7  ID ' + r.Dmm.toFixed(1) + ' mm  \u00b7  ' + r.L.toFixed(1) + ' m', '#94a3b8');
    size.position.set(0, -R - 1.9, 0); three.group.add(size);
  }

  /* Builds the flow pattern that matches the computed regime and animates it
     at a speed proportional to the mixture velocity. */
  /* ── Bernoulli at the two ends of the run ─────────────────────────────
     The same three-term energy split the single-phase panels show, on the
     MIXTURE density, so a two-phase line can be read the same way: how much
     of the energy arriving at the inlet is pressure, how much is the speed
     the mixture already has, how much went into lifting it, and what
     friction took irreversibly between the two stations.

     Written as energy per unit volume — p, ½ρV² and ρgz, all in pressure
     units — not as heads in metres. Dividing by ρg would put a low-density
     mixture into the millions of metres, which is arithmetically what the
     head form says and useless to read. */
  function renderBernoulli(r) {
    var host = $('tp2-bern'); if (!host) return;
    var rho = r && r.rhoMix, V = r && r.Vmix, G = 9.80665;
    if (!r || !isFinite(rho) || rho <= 0 || !isFinite(V)) { host.innerHTML = ''; return; }
    var eV = 0.5 * rho * V * V;
    var eP1 = (isFinite(r.pUp) ? r.pUp : 0) * 1e5;
    var eP2 = (isFinite(r.pDown) ? r.pDown : 0) * 1e5;
    var eZ1 = 0, eZ2 = rho * G * (isFinite(r.dz) ? r.dz : 0);
    /* Losses larger than the pressure available give a negative outlet
       pressure, and printing that produced a negative bar figure and a loss
       over 100 %. Hold the outlet at zero and say the line cannot deliver. */
    var starved = !isFinite(eP2) || eP2 < 0;
    if (starved) eP2 = 0;
    var H1 = eP1 + eV + eZ1, H2 = eP2 + eV + eZ2;
    if (!isFinite(H1) || H1 <= 0) { host.innerHTML = ''; return; }
    var lost = Math.max(0, Math.min(H1, H1 - H2));
    var pc = function (h) { return Math.max(0, Math.min(100, (h / H1) * 100)); };
    var mH = function (pa) {
      var bar = pa / 1e5;
      return U(bar, 'press-drop', Math.abs(bar) >= 1 ? 3 : Math.abs(bar) >= 0.01 ? 4 : 6);
    };
    function station(name, hp, hv, hz, note) {
      var rows = [['aln-bp', 'Pressure', hp], ['aln-bv', 'Velocity', hv], ['aln-bh', 'Height', hz]]
        .map(function (x) {
          var q = pc(x[2]);
          // a term that is present at all keeps a visible mark
          var w = x[2] > 0 ? Math.max(2.5, q) : 0;
          return '<div class="aln-row ' + x[0] + '"><label>' + x[1] + '</label>'
            + '<div class="aln-bar"><i style="width:' + w.toFixed(1) + '%;"></i></div>'
            + '<b>' + (q >= 9.5 ? q.toFixed(0) : q.toFixed(1)) + '%</b></div>'
            + '<div class="aln-sub">' + mH(x[2]) + '</div>';
        }).join('');
      return '<div class="aln-st"><div class="aln-st-h" style="color:#f9a8d4;">' + name
        + '<i>' + note + '</i></div>' + rows + '</div>';
    }
    host.innerHTML = station('P1 · INLET', eP1, eV, eZ1, mH(H1) + ' total')
      + '<div class="aln-mid"><div class="aln-mid-t">'
      + (starved ? 'NO PRESSURE LEFT' : 'LOST TO FRICTION') + '</div>'
      + '<div class="aln-mid-v"' + (starved ? ' style="color:#f87171;"' : '') + '>'
      + ((lost / H1) * 100).toFixed(1) + '%</div>'
      + '<div class="aln-mid-s">' + mH(lost)
      + (starved ? '<br><span style="color:#f87171;">line cannot deliver</span>' : '<br>irreversible')
      + '</div></div>'
      + station('P2 · OUTLET', eP2, eV, eZ2,
          starved ? 'runs dry before the end' : mH(H2) + ' total');
  }

  function update3D(r) {
    if (!r) return;
    renderBernoulli(r);
    /* Deferred to first paint instead of built at boot() — see the note in
       build()'s ResizeObserver for why creating a WebGL context nobody can
       see yet is worth avoiding. */
    if (!three) {
      var host = document.getElementById('line-twophase-content');
      if (!host || !host.offsetParent) return;
      init3D();
    }
    if (!three) return;
    var g = three.group;
    three.anim = null;
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }

    /* True scale: the drawn bore and run follow the selected NPS, schedule
       and line length, so a 1" line looks like a 1" line. The run is shown
       at 22 model units and the bore scaled against it by the real L/D
       ratio, clamped so a very long thin line stays visible. */
    var L = 22;
    var realLD = (r.L > 0 && r.D > 0) ? (r.L / r.D) : 40;
    var R = Math.max(0.45, Math.min(4.2, (L / 2) / Math.max(4, realLD / 2)));
    var pipeMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.72, roughness: 0.34, side: THREE.DoubleSide });
    /* Cut away the quadrant facing the camera. A translucent full tube
       let the regime show through, but everything inside was read through
       a grey film; an open section shows the slug or the annular film
       directly, the way a cutaway drawing does. */
    var pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, L, 48, 1, true, Math.PI * 0.32, Math.PI * 1.36), pipeMat);
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

    // flow direction arrow, sized against the drawn bore
    var ar = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.25, R * 0.55), Math.max(0.8, R * 1.6), 14), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    ar.rotation.z = -Math.PI / 2; ar.position.set(L / 2 + R * 2.2, 0, 0); g.add(ar);

    // FROM → TO end markers so the drawn run maps to the P&ID
    labelEnds(r, L, R);

    three.anim = function () {
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.m.position.x += p.sp;
        if (p.m.position.x > L / 2) p.m.position.x = -L / 2;
      }
    };
    // Frame the pipe on the first build only — afterwards respect the user's zoom.
    var tag = $('tp2-3dtag'), sub = $('tp2-3dsub');
    if (tag) tag.textContent = r.regime.toUpperCase();
    if (sub) sub.textContent = (val('tp2-pair', '') || 'fluid pair') + '  \u00b7  x ' + r.x.toFixed(3)
      + '  \u00b7  Vmix ' + U(r.Vmix, 'velocity', 2) + '  \u00b7  ' + r.nps + '\" Sch ' + r.sch;

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
      return '<table style="width:100%;border-collapse:collapse;font-size:11.5px;table-layout:fixed;word-break:break-word;">' + rows.map(function (x) {
        return '<tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#475569;width:54%;">' + x[0] + '</td>'
          + '<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;">' + x[1] + '</td></tr>';
      }).join('') + '</table>';
    };
    var b = '<div style="font-family:Arial;color:#0f172a;">';
    b += '<div style="text-align:center;margin-bottom:14px;"><div style="font-size:18px;font-weight:800;color:#ea580c;">AROGARA FLOWSIZE — TWO-PHASE LINE SIZING REPORT</div><div style="font-size:10px;color:#64748b;">AROGARA FLOWSIZE · Digital Engineering Design Platform</div></div>';
    b += sec('1 · DESIGN DATA SHEET');
    b += T([['Company', esc(val('tp2-company', '—'))], ['Project location', esc(val('tp2-loc', '—'))],
      ['Line tag no.', esc(val('tp2-lineno', '—'))], ['Service description', esc(val('tp2-svcdesc', '—'))],
      ['P&ID No.', esc(val('tp2-pid', '—'))],
      ['From → To', esc(val('tp2-from', '—')) + ' → ' + esc(val('tp2-to', '—'))],
      ['Engineer', esc(val('tp2-engineer', '—'))], ['Revision', esc(val('tp2-dsrev', '—'))],
      ['Data sheet date', esc(val('tp2-dsdate', '')) || new Date().toISOString().slice(0, 10)],
      ['Report date', new Date().toISOString().slice(0, 10)]]);
    b += sec('2 · PHYSICAL PROPERTIES');
    b += T([['Liquid density ρL / gas ρG', U(r.rhoL, 'density', 1) + ' / ' + U(r.rhoG, 'density', 1)],
      ['Liquid viscosity μL / gas μG', f3(r.muL) + ' / ' + f3(r.muG) + ' cP'],
      ['Surface tension σ', f3(r.sigma) + ' N/m'],
      ['Liquid flow WL / gas WG', U(r.Wl, 'mass-flow', 0) + ' / ' + U(r.Wg, 'mass-flow', 0)],
      ['Design temperature', U(r.T, 'temperature', 1)]]);
    /* In MANUAL the drawing is the design record, so both views of it go into
       the report: the P&ID schematic and the 3D model built from it. */
    if (MODE === 'manual' && window.AROPID) {
      var img2 = null, img3 = null;
      try { img2 = window.AROPID.image2D(); } catch (e) {}
      try { img3 = window.AROPID.image3D(); } catch (e) {}
      if (img2 || img3) {
        b += sec('2A · P&amp;ID SCHEMATIC AND 3D MODEL');
        if (img2) b += '<div style="text-align:center;margin:8px 0;">'
          + '<img src="' + img2 + '" style="max-width:100%;border:1px solid #cbd5e1;border-radius:4px;"/>'
          + '<div style="font-size:9.5px;color:#64748b;margin-top:3px;">2D P&amp;ID as drawn — leg lengths, sizes, tags and components</div></div>';
        if (img3) b += '<div style="text-align:center;margin:10px 0;">'
          + '<img src="' + img3 + '" style="max-width:100%;border:1px solid #cbd5e1;border-radius:4px;"/>'
          + '<div style="font-size:9.5px;color:#64748b;margin-top:3px;">3D model of the same route — pipe bore, run length and component symbols follow the sketch, colour follows velocity</div></div>';
        var sm = null; try { sm = window.AROPID.summary(); } catch (e) {}
        if (sm) b += T([['Legs drawn', String(sm.legs)], ['Developed length', f2(sm.L) + ' m'],
                        ['Rise / fall', f2(sm.rise) + ' m / ' + f2(sm.drop) + ' m'],
                        ['Net static height Δz', f2(sm.dz) + ' m'], ['Components placed', String(sm.items)]]);
      }
    }

    b += sec('3 · FLOW REGIME');
    b += T([['Vapour quality  x = WG/(WG+WL)', f3(r.x)], ['Predicted regime', r.regime],
      ['Recommendation', r.advice], ['Regime by superficial gas velocity', r.regimeVsg]]);
    b += sec('4 · MIXTURE PROPERTIES');
    b += T([['ρmix = [x/ρG + (1−x)/ρL]⁻¹', U(r.rhoMix, 'density', 2)],
      ['μmix = x·μL + (1−x)·μG', f3(r.muMix) + ' cP'],
      ['Liquid / gas volumetric flow', U(r.Ql, 'vol-flow', 3) + ' / ' + U(r.Qg, 'vol-flow', 3)],
      ['Total volumetric flow', U(r.Qt, 'vol-flow', 3)], ['Mass flux G', f2(r.G) + ' kg/m²·s']]);
    b += sec('5 · PIPE & VELOCITIES');
    b += T([['NPS / schedule', r.nps + '" Sch ' + r.sch], ['OD / ID', f3(r.odIn) + ' / ' + f3(r.idIn) + ' in'],
      ['Internal diameter', U(r.Dmm, 'length-mm', 2)], ['Material / roughness', esc(r.matName) + ' / ' + U(r.eps, 'length-mm', 3)],
      ['Relative roughness ε/D', r.relRough.toExponential(3)],
      ['Superficial liquid / gas velocity', U(r.Vsl, 'velocity', 3) + ' / ' + U(r.Vsg, 'velocity', 3)],
      ['Mixture velocity', U(r.Vmix, 'velocity', 3)], ['Velocity assessment', r.velCheck]]);
    b += sec('6 · DIMENSIONLESS NUMBERS');
    b += T([['Froude liquid / gas', f3(r.FrL) + ' / ' + f3(r.FrG)], ['Froude regime', r.frRegime],
      ['Weber  We = ρmix·V²·D/σ', f1(r.We) + '  — ' + r.weCheck],
      ['Momentum flux  ρmix·V²', f1(r.mom) + ' Pa  — ' + r.momCheck],
      ['Reynolds', f0(r.Re) + '  (' + r.flowType + ')'],
      ['Friction factor f', f4(r.f) + '  — ' + r.fCheck]]);
    b += sec('7 · EROSIONAL VELOCITY (API 14E)');
    b += T([['Service / C factor', r.svc + ' / ' + r.C],
      ['Ve = C/√(ρmix × 0.06248)', f2(r.VeFt) + ' ft/s = ' + U(r.Ve, 'velocity', 3)],
      ['Allowable (' + r.pct + ' %)', U(r.Vallow, 'velocity', 3)],
      ['Vmix < allowable ?', r.eroOk ? 'YES' : 'NO'],
      ['Required diameter', U(r.DreqMm, 'length-mm', 2) + ' = ' + f3(r.DreqIn) + ' in'],
      ['Pipe size check', r.sizeOk ? 'PASS — pipe size adequate' : 'FAIL — increase pipe size']]);
    b += sec('8 · PRESSURE DROP');
    b += T([['Friction (L = ' + U(r.L, 'length-m', 1) + ')', f0(r.dpFricPa) + ' Pa = ' + U(r.dpFric, 'press-drop', 4)],
      ['Head loss', U(r.headLoss, 'length-m', 3)],
      ['Static (Δz = ' + U(r.dz, 'length-m', 1) + ')', f0(r.dpStatPa) + ' Pa = ' + U(r.dpStat, 'press-drop', 4)],
      ['Fittings (ΣK = ' + f2(r.sumK) + ')', f0(r.dpFitPa) + ' Pa = ' + U(r.dpFit, 'press-drop', 4)],
      ['TOTAL ΔP', U(r.dpTotal, 'press-drop', 4)], ['Allowable ΔP', U(r.dpAllow, 'press-drop', 4)],
      ['Within allowable ?', r.dpOk ? 'YES' : 'NO'],
      ['Upstream → downstream', UG(r.pUp, 'pressure', 2, '(G)') + ' → ' + UG(r.pDown, 'pressure', 2, '(G)') + (r.pDownOk ? '' : ' — NO PRESSURE LEFT TO DELIVER')]]);
    if (r.fitList.length) {
      b += sec('9 · FITTINGS SCHEDULE');
      b += '<table style="width:100%;border-collapse:collapse;font-size:10.5px;table-layout:fixed;word-break:break-word;"><tr style="background:#f1f5f9;">'
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
  var INPUT_IDS = ['tp2-company', 'tp2-loc', 'tp2-pid', 'tp2-lineno', 'tp2-from', 'tp2-to',
    'tp2-svcdesc', 'tp2-engineer', 'tp2-dsdate', 'tp2-dsrev', 'tp2-pair', 'tp2-sigma',
    'tp2-rhol', 'tp2-rhog', 'tp2-mul', 'tp2-mug', 'tp2-wl', 'tp2-wg', 'tp2-temp', 'tp2-pop', 'tp2-pup',
    'tp2-nps', 'tp2-sch', 'tp2-mat', 'tp2-eps', 'tp2-cfactor', 'tp2-len', 'tp2-dz', 'tp2-service', 'tp2-pcterosion', 'tp2-dpallow'];
  FIT_NAMES.forEach(function (n, i) { INPUT_IDS.push('tp2-fit-' + i); });
  var DEFAULTS = null, UNDO = [], REDO = [], lastSnap = null;
  function snapshot() { var s = {}; INPUT_IDS.forEach(function (id) { var e = $(id); if (e) s[id] = e.value; }); return s; }
  function restore(s) { if (!s) return; INPUT_IDS.forEach(function (id) { var e = $(id); if (e && s[id] !== undefined) e.value = s[id]; }); calc(); }
  function pushUndo() { if (lastSnap) UNDO.push(lastSnap); if (UNDO.length > 60) UNDO.shift(); REDO = []; lastSnap = snapshot(); }
  /* RESET clears the sheet so every value is entered by hand — dropdowns fall
     back to their first entry, all typed fields go blank. */
  function blankAll() {
    INPUT_IDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = '';
    });
    /* A reset must clear the drawing too — leaving the P&ID behind meant the
       fitting counts and length reappeared the moment anything recalculated. */
    if (window.AROPID && window.AROPID.reset) window.AROPID.reset();
    PIDSUM = null;
    ['tp2-run', 'tp2-status'].forEach(function (id) { var e = $(id); if (e) { e.style.display = 'none'; e.textContent = ''; } });
    if (window.ARORESET) {
      window.ARORESET.wipe('tp2', ['tp2-advisor', 'tp2-results', 'tp2-run', 'tp2-status', 'tp2-fitchips']);
      window.ARORESET.watch('tp2', 'line-twophase-content');
    }
    LAST = null;
    calc();
  }
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
    var af = $('tp2-autofix');
    if (af) af.addEventListener('change', function () { pushUndo(); calc(); updHist(); });
    function toggleUser() {
      var m = $('tp2-matuser');
      if (m) m.style.display = (ROUGH[val('tp2-mat', 'CS')] === undefined) ? 'block' : 'none';
      /* The C-factor box is always on show. For a library service it mirrors
         the standard value and is locked; User defined unlocks it. */
      var cf = $('tp2-cfactor'), lib = CFACTOR[val('tp2-service', 'Clean Liquid')];
      if (cf) {
        if (lib !== undefined) {
          cf.value = lib; cf.readOnly = true;
          cf.style.background = 'rgba(34,197,94,0.08)'; cf.style.borderColor = '#22c55e'; cf.style.color = '#86efac';
        } else {
          // Coming off a library service, the box still holds that service's
          // number — clear it so the engineer types their own.
          if (cf.readOnly) cf.value = '';
          cf.readOnly = false;
          cf.style.background = 'rgba(2,6,18,0.6)'; cf.style.borderColor = 'var(--border-muted)'; cf.style.color = '#e2e8f0';
        }
      }
    }
    ['tp2-mat', 'tp2-service'].forEach(function (id) {
      var e = $(id); if (e) e.addEventListener('change', toggleUser);
    });
    toggleUser();

    var pair = $('tp2-pair');
    if (pair) pair.addEventListener('change', function () {
      var f = PAIRS[pair.value];
      if (!f) return;                                    // "User defined" — cleared elsewhere
      /* rhoL/rhoG are kg/m³ (SI) in the lookup table; writing them straight
         into the fields left a US/CGS display showing e.g. "998.2" labelled
         lb/ft³ — the same wrong-unit-substitution bug fixed on the other
         four line-sizing streams' fluid presets. sigma (N/m) and viscosity
         (cP) are unit-invariant here, so they're written as-is. */
      var set = { 'tp2-sigma': f.sigma, 'tp2-rhol': CV(f.rhoL, 'density'), 'tp2-rhog': CV(f.rhoG, 'density'), 'tp2-mul': f.muL, 'tp2-mug': f.muG };
      Object.keys(set).forEach(function (id) { var e = $(id); if (e) e.value = Number(set[id].toFixed(6)).toString(); });
      calc();
    });
    var cb = $('tp2-calc'); if (cb) cb.addEventListener('click', function () {
      var missing = validateTwoPhaseInputs();
      if (missing.length > 0) {
        showTwoPhaseInputsDialog(missing);
        return;
      }
      calc(); status();
      if (typeof window.showCalcFeedback === 'function') window.showCalcFeedback(cb);
    });
    var rb = $('tp2-report'); if (rb) rb.addEventListener('click', report);
    var ub = $('tp2-undo'); if (ub) ub.addEventListener('click', function () { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); lastSnap = snapshot(); updHist(); });
    var rdb = $('tp2-redo'); if (rdb) rdb.addEventListener('click', function () { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); lastSnap = snapshot(); updHist(); });
    var rs = $('tp2-reset'); if (rs) rs.addEventListener('click', function () { pushUndo(); blankAll(); updHist(); });
    lastSnap = snapshot(); if (!DEFAULTS) DEFAULTS = snapshot();
    updHist();
  }

  /* AUTO = type the inputs and let the engine size the line.
     MANUAL = sketch the run on the P&ID workbench and let the drawing set
     the length, elevation and fittings. */
  function modeBar() {
    return '<div style="display:flex;align-items:center;gap:10px;margin:0 0 10px;">'
      + '<span style="font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:0.06em;">DESIGN MODE</span>'
      + '<select id="tp2-mode" style="min-width:320px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:6px 8px;border-radius:3px;">'
      + '<option value="auto">AUTO — enter the inputs, the engine sizes the line</option>'
      + '<option value="manual">MANUAL — draw the line on the P&amp;ID workbench</option>'
      + '</select></div>';
  }

  var MODE = 'auto', PIDSUM = null;

  /* MANUAL puts the P&ID workbench where the flow-regime view sits and turns
     section 6 into a live read-out of what has been drawn. Sections 1-5 are
     the same fields in both modes — they are never duplicated. */
  function setMode(m) {
    MODE = m;
    var d3 = $('tp2-3dblock'), pid = $('tp2-pidblock');
    if (!d3 || !pid) return;
    d3.style.display = m === 'manual' ? 'none' : 'block';
    pid.style.display = m === 'manual' ? 'block' : 'none';

    if (m === 'manual') {
      if (window.AROPID) {
        window.AROPID.build('tp2-pidblock');
        window.AROPID.onChange(function (sum) { PIDSUM = sum; applyPid(sum); });
      }
      lockFittings(true);
    } else {
      PIDSUM = null;
      lockFittings(false);
      setTimeout(function () { resize3D(); calc(); }, 60);
    }
    calc();
  }

  /* In MANUAL the fitting boxes are an output. They stay visible so the
     engineer can see the count, but they are read-only and filled from the
     drawing. Line length and static height come from the sketch too. */
  function lockFittings(on) {
    var hdrEl = $('tp2-fithdr');
    if (hdrEl) hdrEl.innerHTML = hdr(on ? '6 · FITTINGS &amp; VALVES — COUNTED FROM THE P&amp;ID' : '6 · FITTINGS &amp; VALVES (quantity)');
    var note = $('tp2-fitnote');
    if (note) {
      note.style.display = on ? 'block' : 'none';
      note.textContent = 'Counted live from the drawing. Draw the run and drop components on it — the quantities, line length and static height below update as you go.';
    }
    FIT_NAMES.forEach(function (n, i) {
      var e = $('tp2-fit-' + i); if (!e) return;
      e.readOnly = on;
      e.style.background = on ? 'rgba(56,189,248,0.08)' : 'rgba(2,6,18,0.6)';
      e.style.borderColor = on ? '#38bdf8' : 'var(--border-muted)';
      e.style.color = on ? '#7dd3fc' : '#e2e8f0';
      if (on) e.value = 0;
    });
    ['tp2-len', 'tp2-dz'].forEach(function (id) {
      var e = $(id); if (!e) return;
      e.readOnly = on;
      e.style.background = on ? 'rgba(56,189,248,0.08)' : 'rgba(2,6,18,0.6)';
      e.style.borderColor = on ? '#38bdf8' : 'var(--border-muted)';
      e.style.color = on ? '#7dd3fc' : '#e2e8f0';
    });
  }

  /* Push the drawing into the shared inputs, then recalculate. */
  function applyPid(sum) {
    if (MODE !== 'manual' || !sum) return;
    sum.counts.forEach(function (n, i) { var e = $('tp2-fit-' + i); if (e) e.value = n; });
    var L = $('tp2-len'), dz = $('tp2-dz');
    if (L && sum.legs) L.value = sum.L.toFixed(2);
    if (dz && sum.legs) dz.value = sum.dz.toFixed(2);
    calc();
  }

  function build() {
    if (built) return;
    var host = document.getElementById('line-twophase-content'); if (!host) return;
    host.innerHTML = modeBar() + panelHTML();
    built = true;
    var md = $('tp2-mode');
    if (md) md.addEventListener('change', function () { setMode(md.value); });
    wire();
    setTimeout(function () { resize3D(); calc(); }, 80);
    var tab = document.querySelector('[data-line-type="twophase"]');
    if (tab) tab.addEventListener('click', function () { setTimeout(function () { resize3D(); calc(); }, 120); });
    /* Neither the boot-time calc() nor the sub-tab click above fires while
       this panel's own top-level LINE SIZING section is what just became
       visible — the WebGL context never got a moment where it was both
       initialised AND on screen. A ResizeObserver catches every route to
       visibility at once, the same fix applied to the other four streams
       in aro-linesize.js. */
    if (typeof ResizeObserver !== 'undefined') {
      var seenVisible = false;
      var ro = new ResizeObserver(function () {
        if (seenVisible || !host.offsetParent || !host.clientWidth) return;
        seenVisible = true; ro.disconnect(); calc();
      });
      ro.observe(host);
    }
  }
  function boot() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  else setTimeout(boot, 600);
  var tries = 0;
  var iv = setInterval(function () { if (built || tries++ > 25) { clearInterval(iv); return; } build(); }, 500);

  window.AROTP = { calc: calc, compute: compute, report: report };
})();

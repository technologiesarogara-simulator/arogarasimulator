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

  /* Roof selection guidance by service fluid (from the design workbook). */
  var ROOF_GUIDE = {
    'Water': 'Cone Roof', 'Diesel': 'Cone Roof', 'Crude Oil': 'Internal / External Floating Roof',
    'LPG': 'Bullet / Sphere (API 620 — not API 650)', 'Food': 'Cone Roof', 'Chemical': 'Cone or Dome Roof'
  };
  // L/D reference bands by service (workbook)
  var LD_BANDS = {
    'Storage tank': [0.5, 1.5], 'Process vessel': [1.5, 3], 'Agitated vessel': [1, 2], 'Horizontal vessel': [3, 5]
  };

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

    h += hdr('1 · DESIGN DATA SHEET');
    h += two(txtf('TAG No.', 'tk-tag', 'TK-101'), txtf('TANK LOCATION', 'tk-loc', ''));
    h += two(txtf('PROJECT', 'tk-project', 'Untitled'), txtf('CLIENT', 'tk-client', ''));
    h += two(txtf('ENGINEER', 'tk-engineer', ''), txtf('REV', 'tk-rev', '0'));

    h += hdr('2 · SERVICE FLUID');
    h += sel('SERVICE FLUID', 'tk-fluid', ['Water', 'Diesel', 'Crude Oil', 'LPG', 'Food', 'Chemical', 'Other'], 'Water');
    h += two(fld('Density ρ', 'tk-rho', 'kg/m³', 1000, '1', 'density'),
             fld('Design temperature', 'tk-tdes', '°C', 45, '1', 'temperature'));
    h += two(fld('Design pressure', 'tk-pdes', 'barg', 0, '0.1', 'pressure'),
             fld('Corrosion allowance', 'tk-ca', 'mm', 1.5, '0.5', 'length-mm'));
    h += '<div id="tk-roofhint" style="font-family:var(--font-mono);font-size:9px;color:#38bdf8;line-height:1.5;margin:3px 0;background:rgba(56,189,248,0.06);border-left:2px solid #38bdf8;padding:5px 7px;border-radius:3px;"></div>';

    h += hdr('3 · TANK CONFIGURATION');
    h += sel('TANK MATERIAL', 'tk-mat', Object.keys(MATERIALS), 'CS (A36 / IS 2062)');
    h += '<div id="tk-matinfo" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-top:2px;"></div>';
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
    h += fld('Joint efficiency E', 'tk-E', '–', 0.85, '0.05');

    h += hdr('5 · LLLL — LOW LOW LIQUID LEVEL');
    h += two(fld('Min. bottom→nozzle CL (API 650)', 'tk-noz-cl', 'mm', 240, '10', 'length-mm'),
             fld('Outlet nozzle dia.', 'tk-noz-out', 'inch', 4, '0.5'));
    h += two(fld('Liquid level above nozzle', 'tk-liq-above', 'mm', 150, '10', 'length-mm'),
             fld('Specific requirement height', 'tk-lll-spec', 'mm', 500, '10', 'length-mm'));

    h += hdr('6 · LLL — LOW LIQUID LEVEL');
    h += two(fld('Outlet / pump suction flow', 'tk-q-out', 'm³/hr', 20, '1', 'vol-flow'),
             fld('Residence time', 'tk-res-out', 'min', 3, '0.5'));
    h += fld('LLLL→LLL min. (API 650)', 'tk-lll-min', 'mm', 100, '10', 'length-mm');

    h += hdr('7 · HHLL — HIGH HIGH LIQUID LEVEL');
    h += two(fld('Overflow nozzle size', 'tk-noz-ovf', 'inch', 3, '0.5'),
             fld('Project min. from curb angle', 'tk-hhll-spec', 'mm', 100, '10', 'length-mm'));

    h += hdr('8 · HLL — HIGH LIQUID LEVEL');
    h += two(fld('Inlet / pump discharge flow', 'tk-q-in', 'm³/hr', 20, '1', 'vol-flow'),
             fld('Residence time', 'tk-res-in', 'min', 3, '0.5'));
    h += fld('HHLL→HLL min. (API 650)', 'tk-hll-min', 'mm', 100, '10', 'length-mm');

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
      + '.tk-rr span{color:var(--text-muted);}.tk-rr b{color:#e2e8f0;}.tk-rr.ok b{color:#22c55e;}.tk-rr.warn b{color:#ef4444;}'
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
    h += row('Allowable stress S', r.mat.S + ' MPa  ·  E = ' + r.E);
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

    h += '<div class="tk-cardh">DESIGN CHECKS</div>';
    h += row('Capacity ≥ required', r.capOk ? 'PASS' : 'FAIL', r.capOk ? 'ok' : 'warn');
    h += row('L/D within band', r.ldOk ? 'PASS' : 'REVIEW', r.ldOk ? 'ok' : 'warn');
    h += row('Shell thickness ≥ required', r.tOk ? 'PASS' : 'FAIL', r.tOk ? 'ok' : 'warn');
    h += row('Freeboard ≥ ' + U(300, 'length-mm', 0), r.fbOk ? 'PASS' : 'FAIL', r.fbOk ? 'ok' : 'warn');
    h += row('Diameter ≤ ' + U(60, 'length-m', 0) + ' (API 650)', r.dOk ? 'PASS' : 'REVIEW', r.dOk ? 'ok' : 'warn');
    h += row('Height ≤ ' + U(25, 'length-m', 0) + ' (API 650)', r.hOk ? 'PASS' : 'REVIEW', r.hOk ? 'ok' : 'warn');
    h += row('Roof suited to ' + esc(r.fluid), r.roofSuggest, '');

    $('tk-results').innerHTML = h;
    var tag = $('tk-3dtag');
    if (tag) tag.textContent = U(r.Dm, 'length-m', 1) + ' Ø × ' + U(r.Hm, 'length-m', 1) + ' · ' + r.roof + ' · ' + U(r.workCap, 'volume', 2) + ' working';
    update3D(r);
    updateMatInfo();
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

    // stair / ladder
    var st = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.5), deck);
    st.position.set(-R - 0.25, H / 2, 0); g.add(st);

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

  function wire() {
    INPUT_IDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      e.addEventListener('input', function () { pushUndo(); calc(); updHistBtns(); });
      e.addEventListener('change', function () { pushUndo(); calc(); updHistBtns(); });
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
      + ' · Ø' + r.Dm.toFixed(1) + ' m × ' + r.Hm.toFixed(1) + ' m · ' + r.workCap.toFixed(1) + ' m³ working · shell '
      + U(r.t, 'length-mm', 1) + ' · ' + U(r.wEmpty, 'mass', 0) + ' empty';
  }

  /* ─────────── GA drawing + BOM ─────────── */
  function bomRows(r) {
    var f0 = function (x) { return Math.round(x); };
    return [
      ['Shell plate', r.matName, 1, 'API 650 · t ' + U(r.t, 'length-mm', 1), f0(r.wShell), 'Ø' + Math.round(r.D) + ' × ' + U(r.H, 'length-mm', 0)],
      ['Bottom plate', r.matName, 1, 'API 650 · t ' + U(r.tb, 'length-mm', 1), f0(r.wBottom), '≥6 mm + CA'],
      ['Roof plate (' + r.roof + ')', r.matName, 1, 't ' + U(r.tRoof, 'length-mm', 1), f0(r.wRoof), r.roofRise ? 'rise ' + U(r.roofRise * 1000, 'length-mm', 0) : 'flat / floating'],
      ['Top curb angle', r.matName, 1, 'API 650', f0(r.wSteel * 0.02), 'Wind girder'],
      ['Inlet nozzle', r.matName, 1, 'ASME B16.5 · ' + r.dOut + '"', f0(r.dOut * 4), 'Top entry'],
      ['Outlet nozzle', r.matName, 1, 'ASME B16.5 · ' + r.dOut + '"', f0(r.dOut * 4), 'CL ' + Math.round(num('tk-noz-cl', 240)) + ' mm from bottom'],
      ['Overflow nozzle', r.matName, 1, 'ASME B16.5 · ' + r.dOvf + '"', f0(r.dOvf * 4), U(300, 'length-mm', 0) + ' below TTL'],
      ['Drain nozzle', r.matName, 1, 'ASME B16.5 · 2"', 8, 'Bottom, sloped'],
      ['Vent / breather', r.matName, 1, 'API 2000', 12, 'Thermal in/out breathing'],
      ['Manhole (shell)', r.matName, 1, 'API 650 · 24"', 85, 'Shell access'],
      ['Manhole (roof)', r.matName, 1, 'API 650 · 20"', 60, 'Roof access'],
      ['Level instrument set', 'SS316', 1, 'LLLL/LLL/HLL/HHLL', 25, 'Alarms + trips'],
      ['Spiral stairway', 'CS galvanised', 1, 'IS 3844', f0(r.Hm * 55), 'With handrail'],
      ['Handrail / platform', 'CS galvanised', 1, '—', f0(r.Dm * 28), 'Roof perimeter'],
      ['Earthing lug', 'CS', 2, 'IS 3043', 3, 'Static bonding'],
      ['Name plate', 'SS304', 1, 'API 650', 1, 'Laser etched']
    ];
  }

  function drawing() {
    var r = LAST || compute();
    var W = 1540, Hh = 1120;
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
      s += line(tx - 10, y, tx + tw2 + 70, y, 0.8, L[2], '5 3');
      if (Math.abs(ly - y) > 0.5) s += line(tx + tw2 + 70, y, tx + tw2 + 86, ly, 0.6, L[2]);
      s += txt(tx + tw2 + 90, ly + 3, L[0] + '  ' + U(L[1], 'length-mm', 0), 8, L[2], 'start', '700');
    });
    // overflow nozzle
    // overflow nozzle drawn on the LEFT so it never crowds the level callouts
    s += line(tx - 26, yOf(r.elOverflow), tx, yOf(r.elOverflow), 2, '#dc2626');
    s += txt(tx - 30, yOf(r.elOverflow) - 5, 'OVF ' + r.dOvf + '"', 7.5, '#dc2626', 'end', '700');
    // dims
    s += dim(tx - 46, ty, tx - 46, ty + th, U(r.H, 'length-mm', 0));
    s += dim(tx, ty + th + 46, tx + tw2, ty + th + 46, 'Ø ' + Math.round(r.D) + ' mm ID');
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
    s += dim(cx0 - pr, cy0 + pr + 34, cx0 + pr, cy0 + pr + 34, 'Ø ' + Math.round(r.D));

    /* 3 · DESIGN DATA */
    var dx = 736, dy = 30;
    s += txt(dx + 190, dy, 'DESIGN DATA', 11, '#0f172a', 'middle', '800');
    s += table(dx, dy + 10, [190, 190], [
      ['TAG No.', val('tk-tag', 'TK-101')],
      ['Service fluid', r.fluid],
      ['Location', val('tk-loc', '—')],
      ['Orientation / roof', r.orient + ' / ' + r.roof],
      ['Material', r.matName],
      ['Density ρ', r.rho.toFixed(0) + ' kg/m³  (G ' + r.G.toFixed(2) + ')'],
      ['Design temperature', U(r.tdes, 'temperature', 0)],
      ['Design pressure', U(r.pdes, 'pressure', 2)],
      ['Corrosion allowance', U(r.CA, 'length-mm', 1)],
      ['Tank ID × height', Math.round(r.D) + ' × ' + U(r.H, 'length-mm', 0)],
      ['L/D ratio', r.LD.toFixed(2) + '  (' + r.svc + ')'],
      ['Geometric capacity', U(r.geoCap, 'volume', 2)],
      ['Working capacity', U(r.workCap, 'volume', 2)],
      ['Required capacity', U(r.reqCap, 'volume', 2)],
      ['Capacity check', r.capOk ? 'PASS' : 'FAIL'],
      ['Shell thickness (API 650)', r.t.toFixed(1) + ' mm  (req ' + r.tReq.toFixed(2) + ')'],
      ['Bottom plate', U(r.tb, 'length-mm', 1)],
      ['Empty weight', Math.round(r.wEmpty).toLocaleString() + ' kg'],
      ['Operating weight', Math.round(r.wOper).toLocaleString() + ' kg'],
      ['Hydrotest weight', Math.round(r.wTest).toLocaleString() + ' kg']
    ], false);

    /* 4 · LEVEL SCHEDULE */
    var lx = 736, ly = 380;
    s += txt(lx + 190, ly, 'LEVEL SCHEDULE', 11, '#0f172a', 'middle', '800');
    s += table(lx, ly + 10, [120, 120, 140], [
      ['LEVEL', 'ELEV. (mm)', 'BASIS'],
      ['TTL', Math.round(r.elTTL), 'Top tangent line'],
      ['Overflow', Math.round(r.elOverflow), '300 below TTL'],
      ['HHLL (trip)', Math.round(r.elHHLL), '1.5 × ' + r.dOvf + '" ovf = ' + r.hCurbApi.toFixed(0)],
      ['HLL (alarm)', Math.round(r.elHLL), 'residence ' + U(r.hHLL, 'length-mm', 0)],
      ['LLL (alarm)', Math.round(r.elLLL), 'residence ' + U(r.hLLL, 'length-mm', 0)],
      ['LLLL (trip)', Math.round(r.elLLLL), 'nozzle CL + r + 150'],
      ['BTL', 0, 'Bottom tangent line']
    ], true);

    /* 5 · BOM */
    var bx = 736, by = 542;
    s += txt(bx + 380, by, 'BILL OF MATERIAL (BOM)', 11, '#0f172a', 'middle', '800');
    var bom = bomRows(r);
    s += table(bx, by + 10, [26, 190, 150, 34, 150, 210], [['NO', 'DESCRIPTION', 'MATERIAL', 'QTY', 'STANDARD / SIZE', 'REMARKS']]
      .concat(bom.map(function (b, i) { return [String(i + 1), b[0], b[1], String(b[2]), b[3], b[5]]; })), true);

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
    ['1. Design and construction to API 650. All dimensions in millimetres unless noted.',
     '2. Shell thickness by 1-Foot Method: t = 4.9·D·(H−0.3)·G/(S·E) + CA = ' + r.tCalc.toFixed(2) + ' mm; API 650 minimum ' + r.tMinApi + ' mm.',
     '3. Bottom plate ≥ 6 mm + corrosion allowance. Annular plate sized on shell loading.',
     '4. Freeboard above HLL = ' + Math.round(r.freeboard) + ' mm (min 300 mm; agitated 750 mm).',
     '5. Hydrotest with water: ' + Math.round(r.wTest).toLocaleString() + ' kg total. Foundation to be designed for this load.'
    ].forEach(function (n, i) { s += txt(24, 1032 + i * 16, n, 8.5, '#334155', 'start'); });

    s += '</svg>';

    var bomHtml = '<div style="margin-top:14px;"><div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin-bottom:6px;">BILL OF MATERIAL — LIST OF MATERIALS</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Arial;"><tr style="background:#f1f5f9;">'
      + ['#', 'Item / Component', 'Material', 'Qty', 'Unit Wt (kg)', 'Standard / Size', 'Remarks'].map(function (x) { return '<th style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;">' + x + '</th>'; }).join('') + '</tr>';
    bom.forEach(function (b, i) {
      bomHtml += '<tr>' + [i + 1, b[0], b[1], b[2], b[4], b[3], b[5]].map(function (x) { return '<td style="padding:4px 6px;border:1px solid #e2e8f0;">' + x + '</td>'; }).join('') + '</tr>';
    });
    bomHtml += '</table><div style="font-size:10px;color:#64748b;margin-top:6px;">Weights computed from the selected material density (' + esc(r.matName) + ', ρ ' + r.mat.rho + ' kg/m³). Total erection weight ≈ ' + Math.round(r.wEmpty).toLocaleString() + ' kg. Confirm against fabricator drawings.</div></div>';

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
    b += T([['Service fluid', esc(r.fluid)], ['Density / SG', r.rho.toFixed(0) + ' kg/m³  /  ' + f2(r.G)],
      ['Design temperature', U(r.tdes, 'temperature', 1)], ['Design pressure', U(r.pdes, 'pressure', 2)],
      ['Material', esc(r.matName) + '  (ρ ' + r.mat.rho + ' kg/m³, S ' + r.mat.S + ' MPa)'],
      ['Corrosion allowance', U(r.CA, 'length-mm', 1)], ['Orientation / roof', r.orient + ' / ' + r.roof],
      ['Recommended roof for service', r.roofSuggest]]);
    b += sec('3 · GEOMETRY & CAPACITY');
    b += T([['Tank ID × shell height', Math.round(r.D) + ' × ' + U(r.H, 'length-mm', 0)],
      ['L/D ratio', f2(r.LD) + '  (' + r.svc + ' band ' + r.band[0] + '–' + r.band[1] + ')'],
      ['Total geometric capacity  π/4·D²·H', U(r.geoCap, 'volume', 2)],
      ['Total working height', U(r.workH, 'length-mm', 1)],
      ['Total working capacity', U(r.workCap, 'volume', 2)],
      ['Required working capacity', U(r.reqCap, 'volume', 2)],
      ['Capacity check', r.capOk ? 'PASS — capacity adequate' : 'FAIL — increase tank size']]);
    b += sec('4 · LIQUID LEVELS');
    b += T([['LLLL — nozzle CL + radius + liquid', f1(r.lllCalc) + ' mm  → adopted ' + U(r.hLLLL, 'length-mm', 1)],
      ['LLLL → LLL (residence ' + f1(num('tk-res-out', 3)) + ' min)', f1(r.hResOut) + ' mm  → adopted ' + U(r.hLLL, 'length-mm', 1)],
      ['HHLL below curb (1.5 × ' + r.dOvf + '")', f1(r.hCurbApi) + ' mm  → adopted ' + U(r.hHHLLcurb, 'length-mm', 1)],
      ['HHLL → HLL (residence ' + f1(num('tk-res-in', 3)) + ' min)', f1(r.hResIn) + ' mm  → adopted ' + U(r.hHLL, 'length-mm', 1)],
      ['Elevations (BTL/LLLL/LLL/HLL/HHLL/TTL)', '0 / ' + f1(r.elLLLL) + ' / ' + f1(r.elLLL) + ' / ' + f1(r.elHLL) + ' / ' + f1(r.elHHLL) + ' / ' + U(r.elTTL, 'length-mm', 1)],
      ['Overflow nozzle elevation', f1(r.elOverflow) + ' mm (300 below TTL)'],
      ['Freeboard above HLL', f1(r.freeboard) + ' mm  (' + (r.fbOk ? 'PASS' : 'FAIL') + ', min 300)']]);
    b += sec('5 · SHELL DESIGN — API 650 (1-FOOT METHOD)');
    b += T([['Formula', 't = 4.9·D·(H−0.3)·G / (S·E) + CA'],
      ['Substitution', '4.9 × ' + f2(r.Dm) + ' × ' + f2(Math.max(0, r.Hm - 0.3)) + ' × ' + f2(r.G) + ' / (' + r.mat.S + ' × ' + r.E + ') + ' + f1(r.CA)],
      ['Calculated thickness', U(r.tCalc, 'length-mm', 2)], ['API 650 minimum', U(r.tMinApi, 'length-mm', 2)],
      ['Required thickness', U(r.tReq, 'length-mm', 2)], ['Selected thickness', f1(r.t) + ' mm  (' + (r.tOk ? 'PASS' : 'FAIL') + ')'],
      ['Bottom plate', f1(r.tb) + ' mm  (≥6 mm + CA)'], ['Roof plate', U(r.tRoof, 'length-mm', 1)]]);
    b += sec('6 · WEIGHT TAKE-OFF');
    b += T([['Shell plate', U(r.wShell, 'mass', 0)], ['Bottom plate', U(r.wBottom, 'mass', 0)], ['Roof plate', U(r.wRoof, 'mass', 0)],
      ['Appurtenances (12 %)', U(r.wAppurt, 'mass', 0)], ['Empty (erection) weight', U(r.wEmpty, 'mass', 0)],
      ['Liquid at working level', U(r.wLiquid, 'mass', 0)], ['Operating weight', U(r.wOper, 'mass', 0)],
      ['Hydrotest weight (water full)', U(r.wTest, 'mass', 0)]]);
    b += sec('7 · DESIGN CHECKS');
    b += T([['Capacity ≥ required', r.capOk ? 'PASS' : 'FAIL'], ['L/D within service band', r.ldOk ? 'PASS' : 'REVIEW'],
      ['Shell thickness ≥ required', r.tOk ? 'PASS' : 'FAIL'], ['Freeboard ≥ 300 mm', r.fbOk ? 'PASS' : 'FAIL'],
      ['Diameter ≤ 60 m', r.dOk ? 'PASS' : 'REVIEW'], ['Shell height ≤ 25 m', r.hOk ? 'PASS' : 'REVIEW']]);
    b += sec('8 · BILL OF MATERIAL');
    b += '<table style="width:100%;border-collapse:collapse;font-size:10.5px;"><tr style="background:#f1f5f9;">'
      + ['#', 'Item', 'Material', 'Qty', 'Unit Wt (kg)', 'Standard / Size'].map(function (x) { return '<th style="padding:4px;border:1px solid #e2e8f0;text-align:left;">' + x + '</th>'; }).join('') + '</tr>';
    bomRows(r).forEach(function (x, i) {
      b += '<tr>' + [i + 1, x[0], x[1], x[2], x[4], x[3]].map(function (y) { return '<td style="padding:4px;border:1px solid #e2e8f0;">' + y + '</td>'; }).join('') + '</tr>';
    });
    b += '</table>';
    b += sec('9 · BASIS & REFERENCES');
    b += '<div style="font-size:10px;color:#475569;line-height:1.6;">Capacity π/4·D²·H. Levels per the project design workbook: LLLL = MAX(nozzle CL + nozzle radius + liquid above nozzle, specific requirement); LLLL→LLL = MAX(residence-time height, API 650 minimum); HHLL = MAX(1.5 × overflow nozzle, project minimum) below top curb angle; HHLL→HLL = MAX(residence-time height, API 650 minimum). Shell thickness by API 650 1-Foot Method. Codes: API 650 (welded steel tanks for oil storage), API 620 (low-pressure), API 653 (inspection/repair), API 2000 (venting). Weights from the selected material density. This is a design-screening report — confirm against detailed fabrication drawings and foundation design before construction.</div>';
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

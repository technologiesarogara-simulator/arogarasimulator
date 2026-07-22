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
  // plate metal thermal conductivity (W/m·K)
  var PLATE_K = { 'SS304': 16.2, 'SS316': 16.3, 'Titanium': 21.9, 'SMO254': 13.5,
    'Hastelloy C276': 10.1, 'Nickel': 60.7, 'Duplex': 19.0, 'Super Duplex': 17.0 };
  // gasket max continuous temperature (°C) — for a quick suitability note
  var GASKET_TMAX = { 'NBR': 110, 'EPDM': 160, 'Viton': 180, 'HNBR': 140, 'Silicone': 200, 'PTFE': 260 };
  // chevron-angle effect on heat transfer / friction (calibrated so water-water
  // film coefficients land in the industrial 6–9 kW/m²K band and U ≈ 3–4 kW/m²K,
  // consistent with Alfa Laval / GEA / Kelvion gasketed-plate rating data)
  var CHEVRON = { 30: { c: 0.065, n: 0.66, f: 0.8 }, 45: { c: 0.090, n: 0.66, f: 1.0 },
    60: { c: 0.110, n: 0.66, f: 1.35 }, 65: { c: 0.120, n: 0.67, f: 1.5 } };
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
      if (which === 'phe-sub') { setTimeout(function () { init3D(); calc(); }, 30); }
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
  function txt(label, id, v) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<input id="' + id + '" type="text" value="' + (v || '') + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;"/></label>';
  }
  function sel(label, id, opts, cur) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<select id="' + id + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;">'
      + opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>';
  }
  function hdr(t) { return '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin:14px 0 4px;border-bottom:1px solid var(--border-muted);padding-bottom:3px;">' + t + '</div>'; }
  function twoCol(a, b) { return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div>' + a + '</div><div>' + b + '</div></div>'; }

  function panelHTML() {
    var h = '<div class="sthe-grid">';
    // ---- LEFT: inputs ----
    h += '<div class="panel panel-input" style="max-height:calc(100vh - 120px);overflow-y:auto;overflow-x:hidden;">'
      + '<div class="panel-header"><span class="panel-title">PLATE HEAT EXCHANGER — DESIGN INPUTS</span></div>'
      + '<div class="panel-body">'
      + '<div class="digital-badge">Atmanirbhar Bharat Digitalization</div>';

    h += hdr('1 · DESIGN DATA SHEET');
    h += twoCol(txt('PROJECT', 'phe-project', 'Untitled'), txt('CLIENT', 'phe-client', ''));
    h += twoCol(txt('TAG No.', 'phe-tag', 'PHE-101'), txt('SERVICE', 'phe-service', 'Duty Cooler'));
    h += twoCol(sel('DESIGN CODE', 'phe-code', ['ASME Sec VIII Div 1', 'EN 13445', 'PED 2014/68/EU', 'API 662'], 'ASME Sec VIII Div 1'),
                txt('ENGINEER', 'phe-engineer', ''));
    h += twoCol(txt('DATE', 'phe-date', new Date().toISOString().slice(0, 10)), txt('REV', 'phe-rev', '0'));

    h += hdr('2 · FLUID ALLOCATION');
    h += twoCol(txt('HOT FLUID', 'phe-hf-name', 'Hot Water'), txt('COLD FLUID', 'phe-cf-name', 'Cooling Water'));
    h += twoCol(sel('HOT PHASE', 'phe-hf-phase', ['Liquid', 'Gas', 'Condensing', 'Two-Phase'], 'Liquid'),
                sel('COLD PHASE', 'phe-cf-phase', ['Liquid', 'Gas', 'Evaporating', 'Two-Phase'], 'Liquid'));
    h += sel('FLOW ARRANGEMENT', 'phe-flow', ['Counter-current', 'Co-current'], 'Counter-current');

    h += hdr('3 · PROCESS INPUTS — HOT SIDE');
    h += twoCol(fld('Mass flow', 'phe-hf-m', 'kg/s', 10), fld('Design P', 'phe-hf-pdes', 'barg', 10));
    h += twoCol(fld('Temp IN', 'phe-hf-tin', '°C', 90), fld('Temp OUT', 'phe-hf-tout', '°C', 55));
    h += twoCol(fld('Density ρ', 'phe-hf-rho', 'kg/m³', 965), fld('Viscosity μ', 'phe-hf-mu', 'Pa·s', 0.00032, '0.00001'));
    h += twoCol(fld('Cp', 'phe-hf-cp', 'J/kg·K', 4198), fld('Cond. k', 'phe-hf-k', 'W/m·K', 0.668, '0.001'));
    h += twoCol(fld('Fouling Rf', 'phe-hf-rf', 'm²K/W', 0.000018, '0.000001'), fld('Allow ΔP', 'phe-hf-dpa', 'kPa', 50));

    h += hdr('3 · PROCESS INPUTS — COLD SIDE');
    h += twoCol(fld('Mass flow', 'phe-cf-m', 'kg/s', 12), fld('Design P', 'phe-cf-pdes', 'barg', 10));
    h += twoCol(fld('Temp IN', 'phe-cf-tin', '°C', 30), fld('Temp OUT', 'phe-cf-tout', '°C', 50));
    h += twoCol(fld('Density ρ', 'phe-cf-rho', 'kg/m³', 992), fld('Viscosity μ', 'phe-cf-mu', 'Pa·s', 0.00065, '0.00001'));
    h += twoCol(fld('Cp', 'phe-cf-cp', 'J/kg·K', 4180), fld('Cond. k', 'phe-cf-k', 'W/m·K', 0.628, '0.001'));
    h += twoCol(fld('Fouling Rf', 'phe-cf-rf', 'm²K/W', 0.000018, '0.000001'), fld('Allow ΔP', 'phe-cf-dpa', 'kPa', 50));

    h += hdr('5–7 · PLATE / MATERIAL / GASKET');
    h += sel('PLATE TYPE', 'phe-ptype', ['Chevron (Herringbone)', 'Wide-Gap', 'Double-Wall', 'Free-Flow', 'Semi-Welded', 'Fully-Welded', 'Brazed', 'Gasketed'], 'Chevron (Herringbone)');
    h += twoCol(sel('PLATE MATERIAL', 'phe-pmat', Object.keys(PLATE_K), 'SS316'),
                sel('GASKET', 'phe-gasket', Object.keys(GASKET_TMAX), 'EPDM'));

    h += hdr('8 · PLATE GEOMETRY');
    h += twoCol(fld('Plate length Lp', 'phe-L', 'mm', 1200), fld('Plate width Wp', 'phe-W', 'mm', 500));
    h += twoCol(fld('Plate thick. t', 'phe-t', 'mm', 0.5, '0.05'), fld('Corrug. depth b', 'phe-b', 'mm', 2.5, '0.1'));
    h += twoCol(sel('Chevron angle β', 'phe-beta', ['30', '45', '60', '65'], '60'), fld('Port dia Dp', 'phe-dp', 'mm', 150));
    h += twoCol(fld('Enlargement φ', 'phe-phi', '–', 1.18, '0.01'), fld('Plate pitch p', 'phe-pitch', 'mm', 3.0, '0.1'));

    h += hdr('10 · CHANNEL / PASS DESIGN');
    h += sel('PASS ARRANGEMENT', 'phe-pass', ['1 Pass / 1 Pass', '2 Pass / 2 Pass', '4 Pass / 4 Pass'], '1 Pass / 1 Pass');
    h += fld('Design margin', 'phe-margin', '%', 10);

    h += '<button id="phe-calc" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ RUN PHE DESIGN</button>';
    h += '<div style="display:flex;gap:6px;margin-top:8px;">'
      + '<button id="phe-report" class="phe-act">📄 REPORT</button>'
      + '<button id="phe-draw" class="phe-act">📐 DRAWING</button>'
      + '<button id="phe-graph" class="phe-act">📊 GRAPH</button></div>';
    h += '<style>.phe-act{flex:1;background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:7px;border-radius:4px;cursor:pointer;}.phe-act:hover{background:rgba(255,117,56,0.12);}'
      + '.phe-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
      + '.phe-rr span{color:var(--text-muted);}.phe-rr b{color:#e2e8f0;}.phe-rr.warn b{color:#ef4444;}.phe-rr.ok b{color:#22c55e;}'
      + '.phe-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}</style>';
    h += '</div></div>';

    // ---- RIGHT: 3D + results ----
    h += '<div class="panel" style="max-height:calc(100vh - 120px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">TECHNICAL EVALUATIONS DATASHEET — PLATE HEx</span></div>'
      + '<div class="panel-body">'
      + '<div style="font-family:var(--font-mono);font-size:10px;color:#94a3b8;text-align:center;margin-bottom:4px;">3D PLATE-PACK — LIVE VIEW &nbsp;·&nbsp; DRAG TO ROTATE · SCROLL TO ZOOM</div>'
      + '<div style="position:relative;width:100%;height:340px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;">'
      + '<canvas id="phe-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>'
      + '<div id="phe-3dtag" style="position:absolute;left:8px;top:8px;font-family:var(--font-mono);font-size:10px;color:#38bdf8;"></div></div>'
      + '<div id="phe-results" style="margin-top:12px;"></div>'
      + '</div></div>';

    h += '</div>';
    return h;
  }

  /* ─────────── auto-assumption defaults ─────────── */
  function fillDefaults() { /* values already seeded in markup; hook for future presets */ }

  /* ─────────── wiring ─────────── */
  function wire() {
    var ids = ['phe-hf-m', 'phe-hf-tin', 'phe-hf-tout', 'phe-hf-rho', 'phe-hf-mu', 'phe-hf-cp', 'phe-hf-k', 'phe-hf-rf',
      'phe-cf-m', 'phe-cf-tin', 'phe-cf-tout', 'phe-cf-rho', 'phe-cf-mu', 'phe-cf-cp', 'phe-cf-k', 'phe-cf-rf',
      'phe-L', 'phe-W', 'phe-t', 'phe-b', 'phe-beta', 'phe-dp', 'phe-phi', 'phe-pitch', 'phe-pmat', 'phe-gasket',
      'phe-pass', 'phe-margin', 'phe-ptype', 'phe-hf-dpa', 'phe-cf-dpa'];
    ids.forEach(function (id) { var e = $(id); if (e) { e.addEventListener('input', calc); e.addEventListener('change', calc); } });
    var cb = $('phe-calc'); if (cb) cb.addEventListener('click', calc);
    var rb = $('phe-report'); if (rb) rb.addEventListener('click', report);
    var db = $('phe-draw'); if (db) db.addEventListener('click', drawing);
    var gb = $('phe-graph'); if (gb) gb.addEventListener('click', graph);
  }

  /* ─────────── core calculation engine ─────────── */
  function compute() {
    var hot = { m: num('phe-hf-m', 10), tin: num('phe-hf-tin', 90), tout: num('phe-hf-tout', 55),
      rho: num('phe-hf-rho', 965), mu: num('phe-hf-mu', 0.00032), cp: num('phe-hf-cp', 4198), k: num('phe-hf-k', 0.668), rf: num('phe-hf-rf', 0.000018) };
    var cold = { m: num('phe-cf-m', 12), tin: num('phe-cf-tin', 30), tout: num('phe-cf-tout', 50),
      rho: num('phe-cf-rho', 992), mu: num('phe-cf-mu', 0.00065), cp: num('phe-cf-cp', 4180), k: num('phe-cf-k', 0.628), rf: num('phe-cf-rf', 0.000018) };

    // duty & energy balance
    var Qh = hot.m * hot.cp * (hot.tin - hot.tout);
    var Qc = cold.m * cold.cp * (cold.tout - cold.tin);
    var Q = (Qh + Qc) / 2;                      // W (mean of both sides)
    var Qbal = Qc !== 0 ? (Qh / Qc) : 1;         // energy-balance ratio

    // LMTD (arrangement)
    var counter = val('phe-flow', 'Counter-current') !== 'Co-current';
    var dt1, dt2;
    if (counter) { dt1 = hot.tin - cold.tout; dt2 = hot.tout - cold.tin; }
    else { dt1 = hot.tin - cold.tin; dt2 = hot.tout - cold.tout; }
    var lmtd = (Math.abs(dt1 - dt2) < 1e-6) ? dt1 : (dt1 - dt2) / Math.log(dt1 / dt2);
    var F = counter ? 0.99 : 0.90;               // plate HE ≈ true counter-current
    var dTm = lmtd * F;

    // ε-NTU
    var Ch = hot.m * hot.cp, Cc = cold.m * cold.cp;
    var Cmin = Math.min(Ch, Cc), Cmax = Math.max(Ch, Cc), Cr = Cmin / Cmax;
    var Qmax = Cmin * (hot.tin - cold.tin);
    var eff = Qmax > 0 ? Q / Qmax : 0;
    var approach = Math.min(hot.tin - cold.tout, hot.tout - cold.tin);

    // geometry (m)
    var Lp = num('phe-L', 1200) / 1000, Wp = num('phe-W', 500) / 1000, t = num('phe-t', 0.5) / 1000;
    var b = num('phe-b', 2.5) / 1000, phi = num('phe-phi', 1.18), beta = parseInt(val('phe-beta', '60'));
    var Dp = num('phe-dp', 150) / 1000, pitch = num('phe-pitch', 3.0) / 1000;
    var ch = CHEVRON[beta] || CHEVRON[60];
    var Dh = 2 * b / phi;                          // hydraulic diameter
    var Ach = b * Wp;                              // single-channel flow area
    var Ap = Lp * Wp * phi;                        // developed area per plate
    var kw = PLATE_K[val('phe-pmat', 'SS316')] || 16;

    // passes → channels per pass estimate (iterate plate count)
    var passStr = val('phe-pass', '1 Pass / 1 Pass');
    var npass = passStr.indexOf('4') === 0 ? 4 : (passStr.indexOf('2') === 0 ? 2 : 1);

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

    return {
      hot: hot, cold: cold, Q: Q, Qh: Qh, Qc: Qc, Qbal: Qbal, lmtd: lmtd, F: F, dTm: dTm,
      Cr: Cr, Cmin: Cmin, Cmax: Cmax, Qmax: Qmax, eff: eff, NTU: Ud * Aprov / Cmin, approach: approach,
      Dh: Dh, Ap: Ap, N: N, Ncp: Ncp, npass: npass, Areq: Areq, Aprov: Aprov, Ureq: Ureq,
      Uclean: Uclean, Ud: Ud, overSurf: overSurf, H: H, C: C, Rw: Rw,
      dpH: dpH, dpC: dpC, dpHa: num('phe-hf-dpa', 50), dpCa: num('phe-cf-dpa', 50),
      Pdes: Pdes, Phydro: Phydro, packLen: packLen, frameLen: frameLen, nBolts: nBolts, boltDia: boltDia,
      wEmpty: wEmpty, wOper: wOper, gasket: gasket, gasketOk: gasketOk,
      Lp: Lp, Wp: Wp, t: t, b: b, phi: phi, beta: beta, Dp: Dp, pitch: pitch, kw: kw
    };
  }

  var LAST = null;
  function calc() {
    if (!$('phe-results')) return;
    var r = LAST = compute();
    var f1 = function (x) { return isFinite(x) ? x.toFixed(1) : '—'; };
    var f0 = function (x) { return isFinite(x) ? Math.round(x).toLocaleString() : '—'; };
    var row = function (l, v, cls) { return '<div class="phe-rr ' + (cls || '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; };
    var h = '';
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

    h += '<div class="phe-cardh">12 · MECHANICAL DESIGN</div>';
    h += row('Design pressure', r.Pdes.toFixed(1) + ' barg');
    h += row('Hydrotest (1.43×)', r.Phydro.toFixed(1) + ' barg');
    h += row('Frame length', f0(r.frameLen) + ' mm');
    h += row('Tie-bolts', r.nBolts + ' × M' + r.boltDia);
    h += row('Weight empty', f0(r.wEmpty) + ' kg');
    h += row('Weight operating', f0(r.wOper) + ' kg');
    h += row('Gasket ' + r.gasket, r.gasketOk ? 'OK for temp' : 'CHECK Tmax', r.gasketOk ? 'ok' : 'warn');

    $('phe-results').innerHTML = h;
    var tag = $('phe-3dtag'); if (tag) tag.textContent = r.N + ' plates · ' + (r.N - 1) + ' channels · ' + f0(r.Q / 1000) + ' kW';
    update3D(r);
  }

  /* ─────────── live 3D plate-pack (Three.js) ─────────── */
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
    (function loop() { requestAnimationFrame(loop); rn.render(scene, cam); })();
    window.addEventListener('resize', function () {
      if (!canvas.clientWidth) return; cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.updateProjectionMatrix(); rn.setSize(canvas.clientWidth, canvas.clientHeight, false);
    });
  }

  function update3D(r) {
    if (!three) return;
    var g = three.group;
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var N = Math.min(r.N, 80);                       // cap visual plate count for perf
    var pitch = Math.max(0.18, r.pitch * 90);        // exaggerate spacing for visibility
    var PW = 5.2, PH = 8.5, PT = 0.09;
    var packW = N * pitch;
    var x0 = -packW / 2;
    var steel = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.9, roughness: 0.35 });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.4 });
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
    // tie bolts (top & bottom rails)
    for (var tb = 0; tb < Math.min(6, r.nBolts); tb++) {
      var bz = -PW / 2 + 0.4 + tb * (PW - 0.8) / Math.max(1, Math.min(6, r.nBolts) - 1);
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, packW + 2, 10), steel);
      rod.rotation.z = Math.PI / 2; rod.position.set(x0 + packW / 2, PH + 1.4, bz); g.add(rod);
    }
    // nozzles on the fixed frame (4 corners) — hot in/out, cold in/out
    var dp = Math.max(0.5, r.Dp * 3);
    function nozzle(y, z, mat) { var n = new THREE.Mesh(new THREE.CylinderGeometry(dp / 2, dp / 2, 1.4, 16), mat); n.rotation.z = Math.PI / 2; n.position.set(x0 - 1.2, y, z); g.add(n); var f = new THREE.Mesh(new THREE.CylinderGeometry(dp / 2 + 0.25, dp / 2 + 0.25, 0.2, 16), steel); f.rotation.z = Math.PI / 2; f.position.set(x0 - 1.9, y, z); g.add(f); }
    nozzle(PH - 0.5, PW / 2 - 0.8, hotMat);      // hot in (top)
    nozzle(1.3, PW / 2 - 0.8, hotMat);           // hot out (bottom)
    nozzle(PH - 0.5, -PW / 2 + 0.8, coldMat);    // cold in (top)
    nozzle(1.3, -PW / 2 + 0.8, coldMat);         // cold out (bottom)
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
    var counter = val('phe-flow', 'Counter-current') !== 'Co-current';
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
    modal('PHE — TEMPERATURE & PERFORMANCE GRAPH', s);
  }

  /* ─────────── manufacturing drawing (SVG) ─────────── */
  function drawing() {
    var r = LAST || compute();
    var W = 900, H = 560;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:#fff;border-radius:6px;font-family:Arial;">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff" stroke="#334155"/>';
    s += '<text x="' + (W / 2) + '" y="24" fill="#0f172a" font-size="15" font-weight="800" text-anchor="middle">PLATE HEAT EXCHANGER — GA / MANUFACTURING DRAWING</text>';
    s += '<text x="' + (W / 2) + '" y="40" fill="#64748b" font-size="10" text-anchor="middle">' + val('phe-tag', 'PHE-101') + ' · ' + val('phe-service', '') + ' · ' + val('phe-code', 'ASME VIII') + '</text>';
    // FRONT (elevation) — frame + plate pack
    var fx = 60, fy = 90, fh = 180, packW = Math.min(360, Math.max(120, r.N * 3));
    s += '<text x="' + fx + '" y="' + (fy - 8) + '" fill="#0f172a" font-size="11" font-weight="700">FRONT VIEW</text>';
    s += '<rect x="' + fx + '" y="' + fy + '" width="18" height="' + fh + '" fill="#1e3a8a"/>';              // fixed frame
    s += '<rect x="' + (fx + 20 + packW) + '" y="' + fy + '" width="18" height="' + fh + '" fill="#1e3a8a"/>'; // pressure plate
    // plate pack hatch
    for (var i = 0; i < Math.min(60, r.N); i++) { var px = fx + 22 + i * (packW / Math.min(60, r.N)); s += '<line x1="' + px + '" y1="' + fy + '" x2="' + px + '" y2="' + (fy + fh) + '" stroke="' + (i % 2 ? '#ef4444' : '#3b82f6') + '" stroke-width="1"/>'; }
    // tie bolts
    s += '<line x1="' + (fx) + '" y1="' + (fy - 6) + '" x2="' + (fx + 38 + packW) + '" y2="' + (fy - 6) + '" stroke="#475569" stroke-width="3"/>';
    s += '<line x1="' + (fx) + '" y1="' + (fy + fh + 6) + '" x2="' + (fx + 38 + packW) + '" y2="' + (fy + fh + 6) + '" stroke="#475569" stroke-width="3"/>';
    // nozzles on fixed frame
    s += '<rect x="' + (fx - 24) + '" y="' + (fy + 12) + '" width="24" height="16" fill="#dc2626"/><text x="' + (fx - 26) + '" y="' + (fy + 24) + '" fill="#dc2626" font-size="9" text-anchor="end">HOT IN</text>';
    s += '<rect x="' + (fx - 24) + '" y="' + (fy + fh - 28) + '" width="24" height="16" fill="#dc2626"/><text x="' + (fx - 26) + '" y="' + (fy + fh - 16) + '" fill="#dc2626" font-size="9" text-anchor="end">HOT OUT</text>';
    s += '<rect x="' + (fx - 24) + '" y="' + (fy + 40) + '" width="24" height="16" fill="#2563eb"/><text x="' + (fx - 26) + '" y="' + (fy + 52) + '" fill="#2563eb" font-size="9" text-anchor="end">COLD IN</text>';
    s += '<rect x="' + (fx - 24) + '" y="' + (fy + fh - 56) + '" width="24" height="16" fill="#2563eb"/><text x="' + (fx - 26) + '" y="' + (fy + fh - 44) + '" fill="#2563eb" font-size="9" text-anchor="end">COLD OUT</text>';
    // feet + dims
    s += '<rect x="' + fx + '" y="' + (fy + fh) + '" width="' + (38 + packW) + '" height="10" fill="#334155"/>';
    s += '<text x="' + (fx + (38 + packW) / 2) + '" y="' + (fy + fh + 30) + '" fill="#0f172a" font-size="10" text-anchor="middle">Frame ' + Math.round(r.frameLen) + ' mm · pack ' + Math.round(r.packLen) + ' mm · ' + r.N + ' plates</text>';

    // PLATE LAYOUT (single plate with 4 ports + chevron)
    var plx = 560, ply = 90, plw = 180, plh = 260;
    s += '<text x="' + plx + '" y="' + (ply - 8) + '" fill="#0f172a" font-size="11" font-weight="700">PLATE LAYOUT</text>';
    s += '<rect x="' + plx + '" y="' + ply + '" width="' + plw + '" height="' + plh + '" fill="#eef2f7" stroke="#334155" rx="14"/>';
    // chevron pattern
    for (var c = 0; c < 12; c++) { var yy = ply + 30 + c * (plh - 60) / 12; s += '<polyline points="' + plx + ',' + yy + ' ' + (plx + plw / 2) + ',' + (yy + 10) + ' ' + (plx + plw) + ',' + yy + '" fill="none" stroke="#94a3b8" stroke-width="1.5"/>'; }
    // ports
    var pr = 16;
    [[plx + 28, ply + 28, '#dc2626'], [plx + plw - 28, ply + 28, '#2563eb'], [plx + 28, ply + plh - 28, '#dc2626'], [plx + plw - 28, ply + plh - 28, '#2563eb']].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + pr + '" fill="#fff" stroke="' + p[2] + '" stroke-width="3"/>'; });
    s += '<text x="' + (plx + plw / 2) + '" y="' + (ply + plh + 20) + '" fill="#0f172a" font-size="10" text-anchor="middle">' + Math.round(r.Lp * 1000) + ' × ' + Math.round(r.Wp * 1000) + ' mm · β' + r.beta + '° · t ' + (r.t * 1000).toFixed(1) + ' mm</text>';
    s += '<text x="' + (plx + plw / 2) + '" y="' + (ply + plh + 34) + '" fill="#64748b" font-size="9" text-anchor="middle">' + val('phe-pmat', 'SS316') + ' plate · ' + val('phe-gasket', 'EPDM') + ' gasket · Ø' + Math.round(r.Dp * 1000) + ' mm ports</text>';

    // title block
    s += '<rect x="60" y="' + (H - 120) + '" width="' + (W - 120) + '" height="90" fill="none" stroke="#334155"/>';
    var rows = [['PROJECT', val('phe-project', ''), 'DUTY', Math.round(r.Q / 1000) + ' kW'],
    ['CLIENT', val('phe-client', ''), 'AREA', r.Aprov.toFixed(1) + ' m²'],
    ['DESIGN P', r.Pdes.toFixed(1) + ' barg', 'PLATES', r.N + ' (' + val('phe-pmat', 'SS316') + ')'],
    ['ENGINEER', val('phe-engineer', ''), 'HYDROTEST', r.Phydro.toFixed(1) + ' barg']];
    rows.forEach(function (rw, i) { var yy = H - 104 + i * 20; s += '<text x="72" y="' + yy + '" fill="#64748b" font-size="9" font-weight="700">' + rw[0] + '</text><text x="180" y="' + yy + '" fill="#0f172a" font-size="9">' + rw[1] + '</text><text x="' + (W / 2 + 20) + '" y="' + yy + '" fill="#64748b" font-size="9" font-weight="700">' + rw[2] + '</text><text x="' + (W / 2 + 120) + '" y="' + yy + '" fill="#0f172a" font-size="9">' + rw[3] + '</text>'; });
    s += '<text x="' + (W - 66) + '" y="' + (H - 12) + '" fill="#94a3b8" font-size="8" text-anchor="end">BHARAT FLOWSIZE — PLATE HEx · ANOVIX TECHNOLOGIES</text>';
    s += '</svg>';
    modal('PHE — MANUFACTURING / GA DRAWING', s, true);
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
    ['Arrangement', val('phe-flow', '')]]);
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

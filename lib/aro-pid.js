/* ══════════════════════════════════════════════════════════════════════
   AROGARA — P&ID LINE WORKBENCH  (window.AROPID)

   The engineer sketches the run the way they would on a P&ID: click FROM,
   click through the route, click TO. Every horizontal→vertical corner is a
   real change of direction, so the workbench works out which fitting the
   corner needs, adds the valves the service calls for, and hydraulically
   evaluates the result against the two-phase / single-phase limits.

   What it computes from the sketch alone:
     • developed length from the drawn geometry (scale set by the user)
     • static head from the vertical rises and drops (Δz, signed)
     • one fitting per corner, chosen by turn angle: 90° / 45° / mitre
     • ΣK from the fitting set, then Darcy ΔP = f·L/D·ρV²/2 + ΣK·ρV²/2 + ρgΔz
     • velocity, erosional velocity (API RP 14E) and Reynolds/Colebrook f
   Anything that fails comes back as a located recommendation — which node,
   which fitting, and why.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PIPE = {
    0.5: { od: 0.840, s: { '5': 0.710, '10': 0.674, '40': 0.622, '80': 0.546, '160': 0.466 } },
    0.75: { od: 1.050, s: { '5': 0.920, '10': 0.884, '40': 0.824, '80': 0.742, '160': 0.614 } },
    1: { od: 1.315, s: { '5': 1.185, '10': 1.097, '40': 1.049, '80': 0.957, '160': 0.815 } },
    1.5: { od: 1.900, s: { '5': 1.770, '10': 1.682, '40': 1.610, '80': 1.500, '160': 1.338 } },
    2: { od: 2.375, s: { '5': 2.245, '10': 2.157, '40': 2.067, '80': 1.939, '160': 1.687 } },
    3: { od: 3.500, s: { '5': 3.334, '10': 3.260, '40': 3.068, '80': 2.900, '160': 2.624 } },
    4: { od: 4.500, s: { '5': 4.334, '10': 4.260, '40': 4.026, '80': 3.826, '160': 3.438 } },
    6: { od: 6.625, s: { '5': 6.407, '10': 6.357, '40': 6.065, '80': 5.761, '160': 5.187 } },
    8: { od: 8.625, s: { '5': 8.407, '10': 8.329, '40': 7.981, '80': 7.625, '160': 6.813 } },
    10: { od: 10.750, s: { '5': 10.482, '10': 10.420, '40': 10.020, '80': 9.750, '160': 8.500 } },
    12: { od: 12.750, s: { '5': 12.438, '10': 12.390, '40': 11.938, '80': 11.376, '160': 10.126 } },
    16: { od: 16.000, s: { '10': 15.500, '40': 15.000, '80': 14.312, '160': 12.812 } },
    20: { od: 20.000, s: { '10': 19.500, '40': 18.812, '80': 17.938, '160': 16.062 } },
    24: { od: 24.000, s: { '10': 23.500, '40': 22.624, '80': 21.562, '160': 19.312 } }
  };
  var SCHEDULES = ['5', '10', '40', '80', '160'];

  /* K by turn angle — Crane TP-410 bands. A drawn corner is matched to the
     nearest standard fitting, and the reason is reported with it. */
  var BENDS = [
    { deg: 90, name: 'Std elbow 90°', k: 0.75, why: 'a square change of direction; a standard 90° elbow is the shortest fitting that makes it' },
    { deg: 90, name: 'Long-radius elbow 90°', k: 0.45, why: 'R/D = 1.5 halves the loss of a standard elbow — preferred where ΔP is tight or the line is erosive' },
    { deg: 45, name: 'Std elbow 45°', k: 0.35, why: 'a 45° offset; two of these beat one 90° when the route can be dog-legged' },
    { deg: 30, name: 'Mitre bend 30°', k: 0.20, why: 'a shallow deflection, cheapest as a cut-and-weld mitre' },
    { deg: 60, name: 'Mitre bend 60°', k: 0.55, why: 'an intermediate turn between 45° and 90°' }
  ];

  /* Valves the workbench proposes by service, with the reason. */
  var VALVE_RULES = [
    { key: 'isolation', name: 'Gate valve', k: 0.15, why: 'isolation at the battery limit so the line can be broken without draining the system' },
    { key: 'check', name: 'Swing check valve', k: 1.00, why: 'the run lifts, so backflow on trip would drain the line into the source vessel' },
    { key: 'control', name: 'Globe valve', k: 6.00, why: 'throttling duty — a globe valve gives the controllable characteristic a gate valve cannot' }
  ];

  var ROUGH = { 'CS': 0.045, 'SS316': 0.0015, 'SS304': 0.0015, 'GI': 0.15, 'HDPE': 0.007, 'Cast iron': 0.26 };

  var built = false, NODES = [], drawing = true, LASTR = null;
  var CV = null, CTX = null;

  function $(id) { return document.getElementById(id); }
  function num(id, d) { var e = $(id); if (!e) return d; var v = parseFloat(e.value); return isFinite(v) ? v : d; }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f1(v) { return isFinite(v) ? v.toFixed(1) : '—'; }
  function f2(v) { return isFinite(v) ? v.toFixed(2) : '—'; }
  function f3(v) { return isFinite(v) ? v.toFixed(3) : '—'; }

  /* ─────────── geometry from the sketch ─────────── */
  /* Canvas y grows downward; elevation grows upward, hence the sign flip. */
  function segments() {
    var out = [];
    for (var i = 1; i < NODES.length; i++) {
      var a = NODES[i - 1], b = NODES[i];
      var dxPx = b.x - a.x, dyPx = b.y - a.y;
      out.push({ a: a, b: b, dxPx: dxPx, dyPx: dyPx, lenPx: Math.sqrt(dxPx * dxPx + dyPx * dyPx),
                 horizontal: Math.abs(dxPx) >= Math.abs(dyPx) });
    }
    return out;
  }

  /* Turn angle at each interior node, and the fitting that suits it. */
  function corners(segs) {
    var out = [];
    for (var i = 1; i < segs.length; i++) {
      var p = segs[i - 1], q = segs[i];
      var a1 = Math.atan2(p.dyPx, p.dxPx), a2 = Math.atan2(q.dyPx, q.dxPx);
      var d = Math.abs(((a2 - a1) * 180 / Math.PI + 540) % 360 - 180);
      if (d < 5) continue;                                   // effectively straight
      var pick = BENDS[0], best = 1e9;
      BENDS.forEach(function (bd) { var e = Math.abs(bd.deg - d); if (e < best) { best = e; pick = bd; } });
      out.push({ node: i, deg: d, fitting: pick, vertical: !p.horizontal || !q.horizontal });
    }
    return out;
  }

  function compute() {
    var scale = num('pid-scale', 0.25);                       // m per pixel
    var segs = segments();
    if (segs.length === 0) return null;

    var Lh = 0, rise = 0, drop = 0;
    segs.forEach(function (s) {
      Lh += s.lenPx * scale;
      var dz = -s.dyPx * scale;                               // up on screen = rise
      if (dz > 0) rise += dz; else drop += -dz;
    });
    var dz = rise - drop;

    var cs = corners(segs);

    /* Valves the route implies: isolation always, a check valve when the
       run lifts, and a control valve when the user asks for throttling. */
    var valves = [VALVE_RULES[0]];
    if (rise > 0.5) valves.push(VALVE_RULES[1]);
    if ($('pid-control') && $('pid-control').checked) valves.push(VALVE_RULES[2]);

    var sumK = 0, fitList = [];
    cs.forEach(function (c) { sumK += c.fitting.k; fitList.push({ name: c.fitting.name, k: c.fitting.k, at: 'node ' + (c.node + 1) }); });
    valves.forEach(function (v) { sumK += v.k; fitList.push({ name: v.name, k: v.k, at: 'run' }); });

    /* Hydraulics */
    var nps = parseFloat(val('pid-nps', '2'));
    var sch = val('pid-sch', '40');
    var pd = PIPE[nps] || PIPE[2];
    var idIn = pd.s[sch] !== undefined ? pd.s[sch] : pd.s['40'];
    var Dmm = idIn * 25.4, D = Dmm / 1000;
    var eps = ROUGH[val('pid-mat', 'CS')];
    var rho = num('pid-rho', 998.2), mu = num('pid-mu', 1.002);
    var W = num('pid-flow', 20000);                           // kg/hr
    var Q = W / rho;                                          // m³/hr
    var A = Math.PI / 4 * D * D;
    var V = Q / (A * 3600);
    var Re = (rho * V * D) / (0.001 * mu);
    var f = Re < 2100 ? 64 / Re : 1.3255 / Math.pow(Math.log((eps / (3.7 * Dmm)) + (5.74 / Math.pow(Re, 0.9))), 2);

    var dpFricPa = (f * Lh * rho * V * V) / (D * 2);
    var dpFitPa = 0.5 * sumK * rho * V * V;
    var dpStatPa = rho * 9.81 * dz;
    var dpTotalPa = dpFricPa + dpFitPa + dpStatPa;
    var dpTotal = dpTotalPa / 1e5;

    var C = num('pid-cfactor', 100);
    var Ve = (C / Math.sqrt(rho * 0.06248)) * 0.3048;
    var Vallow = Ve * 0.75;

    var Leq = Lh + ((f > 0) ? sumK * D / f : 0);
    var dpAllow = Math.max(0.05, Math.min(0.5 * Leq / 100, 0.10 * (num('pid-pup', 6) + 1.01325)));

    return {
      scale: scale, segs: segs, corners: cs, valves: valves, fitList: fitList, sumK: sumK,
      Lh: Lh, rise: rise, drop: drop, dz: dz, nps: nps, sch: sch, idIn: idIn, Dmm: Dmm, D: D,
      eps: eps, rho: rho, mu: mu, W: W, Q: Q, V: V, Re: Re, f: f,
      dpFricPa: dpFricPa, dpFitPa: dpFitPa, dpStatPa: dpStatPa, dpTotal: dpTotal,
      Ve: Ve, Vallow: Vallow, Leq: Leq, dpAllow: dpAllow,
      velOk: V >= 0.9 && V <= 4.5, eroOk: V < Vallow, dpOk: dpTotal <= dpAllow
    };
  }

  /* ─────────── canvas ─────────── */
  function draw() {
    if (!CTX) return;
    var w = CV.width, h = CV.height;
    CTX.clearRect(0, 0, w, h);
    CTX.fillStyle = '#0b1220'; CTX.fillRect(0, 0, w, h);

    // grid
    CTX.strokeStyle = 'rgba(148,163,184,0.10)'; CTX.lineWidth = 1;
    for (var x = 0; x < w; x += 25) { CTX.beginPath(); CTX.moveTo(x, 0); CTX.lineTo(x, h); CTX.stroke(); }
    for (var y = 0; y < h; y += 25) { CTX.beginPath(); CTX.moveTo(0, y); CTX.lineTo(w, y); CTX.stroke(); }

    if (!NODES.length) {
      CTX.fillStyle = '#64748b'; CTX.font = '12px monospace';
      CTX.fillText('Click to place the FROM point, click again for each change of direction, then press FINISH.', 18, 26);
      return;
    }

    // pipe run
    CTX.strokeStyle = '#38bdf8'; CTX.lineWidth = 4; CTX.lineJoin = 'round';
    CTX.beginPath(); CTX.moveTo(NODES[0].x, NODES[0].y);
    for (var i = 1; i < NODES.length; i++) CTX.lineTo(NODES[i].x, NODES[i].y);
    CTX.stroke();

    var r = LASTR;
    // corner fittings
    if (r) r.corners.forEach(function (c) {
      var n = NODES[c.node];
      CTX.fillStyle = '#f59e0b'; CTX.beginPath(); CTX.arc(n.x, n.y, 7, 0, Math.PI * 2); CTX.fill();
      CTX.fillStyle = '#fde68a'; CTX.font = 'bold 10px monospace';
      CTX.fillText(Math.round(c.deg) + '°', n.x + 11, n.y - 8);
    });

    // endpoints
    var a = NODES[0], b = NODES[NODES.length - 1];
    CTX.fillStyle = '#22c55e'; CTX.beginPath(); CTX.arc(a.x, a.y, 6, 0, Math.PI * 2); CTX.fill();
    CTX.fillStyle = '#ef4444'; CTX.beginPath(); CTX.arc(b.x, b.y, 6, 0, Math.PI * 2); CTX.fill();
    CTX.fillStyle = '#22c55e'; CTX.font = 'bold 11px monospace';
    CTX.fillText(val('pid-from', '') || 'FROM', a.x + 10, a.y - 10);
    CTX.fillStyle = '#ef4444';
    CTX.fillText(val('pid-to', '') || 'TO', b.x + 10, b.y - 10);

    // segment lengths
    if (r) r.segs.forEach(function (s) {
      var mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2;
      CTX.fillStyle = '#94a3b8'; CTX.font = '10px monospace';
      CTX.fillText((s.lenPx * r.scale).toFixed(1) + ' m', mx + 8, my + (s.horizontal ? -8 : 4));
    });
  }

  /* ─────────── located recommendations ─────────── */
  function advise(r) {
    var out = [];
    if (!r) return out;

    r.corners.forEach(function (c) {
      var alt = c.fitting.name === 'Std elbow 90°' ? 'Long-radius elbow 90° (K 0.45)' : null;
      out.push({
        where: 'Node ' + (c.node + 1),
        what: c.fitting.name + ' (K ' + c.fitting.k + ')',
        why: 'The drawn route turns ' + Math.round(c.deg) + '° here — ' + c.fitting.why + '.'
          + (c.vertical ? ' The turn is between a horizontal and a vertical leg, so the elbow also carries the weight of the riser and needs a support below it.' : '')
          + (alt && !r.dpOk ? ' The line is over its ΔP allowance: swapping this for a ' + alt + ' recovers about ' + f3((0.75 - 0.45) * 0.5 * r.rho * r.V * r.V / 1e5) + ' bar.' : '')
      });
    });

    r.valves.forEach(function (v) {
      out.push({ where: 'Run', what: v.name + ' (K ' + v.k + ')', why: v.why.charAt(0).toUpperCase() + v.why.slice(1) + '.' });
    });

    if (r.rise > 0.5) out.push({ where: 'Riser', what: 'Static head ' + f2(r.dz) + ' m',
      why: 'The route lifts ' + f2(r.rise) + ' m and falls ' + f2(r.drop) + ' m, a net ' + f2(r.dz) + ' m. That is ' + f3(r.dpStatPa / 1e5) + ' bar of static head added to the Darcy friction loss, and it does not go away at low flow — check the pump can still deliver at turndown.' });

    if (!r.velOk) out.push({ where: 'Line size', what: r.V < 0.9 ? 'Velocity low at ' + f2(r.V) + ' m/s' : 'Velocity high at ' + f2(r.V) + ' m/s',
      why: r.V < 0.9 ? 'Below about 0.9 m/s solids and liquid settle out in the horizontal legs. Drop one pipe size.' : 'Above about 4.5 m/s the line gets noisy and erosive at the bends. Go one size up.' });
    if (!r.eroOk) out.push({ where: 'Line size', what: 'Erosional limit exceeded',
      why: 'Velocity ' + f2(r.V) + ' m/s is above the API RP 14E allowable ' + f2(r.Vallow) + ' m/s. Increase the bore before the first bend, where erosion concentrates.' });
    if (!r.dpOk) out.push({ where: 'Hydraulics', what: 'ΔP ' + f3(r.dpTotal) + ' bar over the ' + f3(r.dpAllow) + ' bar allowance',
      why: 'Friction contributes ' + f3(r.dpFricPa / 1e5) + ' bar, fittings ' + f3(r.dpFitPa / 1e5) + ' bar and static head ' + f3(r.dpStatPa / 1e5) + ' bar. '
        + (r.dpFitPa > r.dpFricPa ? 'Fittings dominate — straighten the route or use long-radius bends before changing pipe size.' : 'Friction dominates — one size up cuts it by roughly a factor of three.') });

    if (r.velOk && r.eroOk && r.dpOk) out.push({ where: 'Overall', what: 'Route is hydraulically suitable',
      why: 'Velocity ' + f2(r.V) + ' m/s, ΔP ' + f3(r.dpTotal) + ' bar against ' + f3(r.dpAllow) + ' bar allowable, and the erosional limit is respected at ' + f2(r.Vallow) + ' m/s.' });
    return out;
  }

  /* ─────────── results ─────────── */
  function render() {
    var r = LASTR = compute();
    draw();
    var el = $('pid-results'); if (!el) return;
    if (!r) { el.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:#64748b;padding:8px;">Draw at least one segment, then press EVALUATE.</div>'; return; }

    var row = function (k, v, cls) { return '<div class="pid-rr ' + (cls || '') + '"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var h = '<div class="pid-cardh">ROUTE TAKE-OFF FROM THE SKETCH</div>';
    h += row('Developed length', f2(r.Lh) + ' m');
    h += row('Rise / fall / net Δz', f2(r.rise) + ' / ' + f2(r.drop) + ' / ' + f2(r.dz) + ' m');
    h += row('Changes of direction', r.corners.length);
    h += row('Fittings + valves ΣK', f2(r.sumK));
    h += row('Equivalent length', f2(r.Leq) + ' m');

    h += '<div class="pid-cardh">HYDRAULICS</div>';
    h += row('Line size', r.nps + '" Sch ' + r.sch + '  ·  ID ' + f2(r.Dmm) + ' mm');
    h += row('Velocity', f2(r.V) + ' m/s', r.velOk ? 'ok' : 'warn');
    h += row('Reynolds / friction factor', Math.round(r.Re).toLocaleString() + ' / ' + f3(r.f));
    h += row('Friction ΔP', f3(r.dpFricPa / 1e5) + ' bar');
    h += row('Fittings ΔP', f3(r.dpFitPa / 1e5) + ' bar');
    h += row('Static ΔP', f3(r.dpStatPa / 1e5) + ' bar');
    h += row('Total ΔP', f3(r.dpTotal) + ' bar', r.dpOk ? 'ok' : 'warn');
    h += row('Allowable ΔP (auto)', f3(r.dpAllow) + ' bar');
    h += row('Erosional velocity (API 14E)', f2(r.Ve) + ' m/s  ·  allowable ' + f2(r.Vallow), r.eroOk ? 'ok' : 'warn');

    h += '<div class="pid-cardh">FITTING SCHEDULE — SELECTED FROM THE DRAWING</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10px;">'
      + '<tr style="color:#94a3b8;border-bottom:1px solid var(--border-muted);"><th style="text-align:left;padding:3px;">Item</th><th style="text-align:left;padding:3px;">Location</th><th style="text-align:right;padding:3px;">K</th></tr>';
    r.fitList.forEach(function (f) {
      h += '<tr style="border-bottom:1px dashed var(--border-muted);"><td style="padding:3px;color:#e2e8f0;">' + esc(f.name) + '</td><td style="padding:3px;color:#94a3b8;">' + esc(f.at) + '</td><td style="padding:3px;text-align:right;color:#e2e8f0;">' + f.k + '</td></tr>';
    });
    h += '</table>';

    h += '<div class="pid-cardh">RECOMMENDATIONS — WHAT, WHERE AND WHY</div>';
    advise(r).forEach(function (a) {
      var good = /suitable/.test(a.what);
      h += '<div style="border:1px solid var(--border-muted);border-left:3px solid ' + (good ? '#22c55e' : '#f59e0b') + ';border-radius:4px;padding:7px 9px;margin:6px 0;background:' + (good ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.05)') + ';">'
        + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:' + (good ? '#22c55e' : '#f59e0b') + ';">' + esc(a.where) + ' — ' + esc(a.what) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;line-height:1.55;margin-top:3px;">' + esc(a.why) + '</div></div>';
    });
    el.innerHTML = h;
  }

  /* ─────────── report ─────────── */
  function report() {
    var r = LASTR || compute();
    if (!r) { alert('Draw a route first.'); return; }
    var sec = function (t) { return '<div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin:16px 0 8px;">' + t + '</div>'; };
    var T = function (rows) {
      return '<table style="width:100%;border-collapse:collapse;font-size:11px;">' + rows.map(function (x) {
        return '<tr><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#374151;width:55%;">' + x[0] + '</td><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;">' + x[1] + '</td></tr>';
      }).join('') + '</table>';
    };
    var img = CV ? CV.toDataURL('image/png') : '';
    var h = '<div style="font-family:Arial,sans-serif;color:#111827;">'
      + '<h2 style="text-align:center;color:#ea580c;margin:0;">BHARAT FLOWSIZE — P&amp;ID LINE HYDRAULICS REPORT</h2>'
      + '<div style="text-align:center;font-size:10px;color:#6b7280;">AROGARA TECHNOLOGIES | DIGITAL INDIA INITIATIVE</div>'
      + sec('1 · LINE IDENTIFICATION')
      + T([['Line No.', esc(val('pid-lineno', '—'))], ['From', esc(val('pid-from', '—'))], ['To', esc(val('pid-to', '—'))],
           ['Line size', r.nps + '" Sch ' + r.sch + ' (ID ' + f2(r.Dmm) + ' mm)'], ['Material', esc(val('pid-mat', 'CS'))],
           ['Date', new Date().toISOString().slice(0, 10)]])
      + sec('2 · ROUTE AS DRAWN')
      + (img ? '<div style="text-align:center;margin:8px 0;"><img src="' + img + '" style="max-width:100%;border:1px solid #d1d5db;"/></div>' : '')
      + T([['Drawing scale', f2(r.scale) + ' m per pixel'], ['Developed length', f2(r.Lh) + ' m'],
           ['Rise / fall', f2(r.rise) + ' m / ' + f2(r.drop) + ' m'], ['Net static height Δz', f2(r.dz) + ' m'],
           ['Changes of direction', String(r.corners.length)], ['Equivalent length', f2(r.Leq) + ' m']])
      + sec('3 · FITTING SCHEDULE')
      + '<table style="width:100%;border-collapse:collapse;font-size:11px;"><tr style="background:#f3f4f6;"><th style="padding:4px;text-align:left;">Item</th><th style="padding:4px;text-align:left;">Location</th><th style="padding:4px;text-align:right;">K</th></tr>'
      + r.fitList.map(function (f) { return '<tr><td style="padding:4px;border-bottom:1px solid #e5e7eb;">' + esc(f.name) + '</td><td style="padding:4px;border-bottom:1px solid #e5e7eb;">' + esc(f.at) + '</td><td style="padding:4px;border-bottom:1px solid #e5e7eb;text-align:right;">' + f.k + '</td></tr>'; }).join('')
      + '<tr><td style="padding:4px;font-weight:700;">Total ΣK</td><td></td><td style="padding:4px;text-align:right;font-weight:700;">' + f2(r.sumK) + '</td></tr></table>'
      + sec('4 · HYDRAULIC RESULTS')
      + T([['Mass flow', f1(r.W) + ' kg/hr'], ['Volumetric flow', f3(r.Q) + ' m³/hr'], ['Velocity', f2(r.V) + ' m/s'],
           ['Reynolds number', Math.round(r.Re).toLocaleString()], ['Friction factor (Colebrook)', f3(r.f)],
           ['Friction ΔP (Darcy)', f3(r.dpFricPa / 1e5) + ' bar'], ['Fittings ΔP (ΣK·ρV²/2)', f3(r.dpFitPa / 1e5) + ' bar'],
           ['Static ΔP (ρgΔz)', f3(r.dpStatPa / 1e5) + ' bar'], ['Total ΔP', f3(r.dpTotal) + ' bar'],
           ['Allowable ΔP', f3(r.dpAllow) + ' bar'], ['Erosional velocity Ve', f2(r.Ve) + ' m/s'],
           ['Allowable velocity (75 % Ve)', f2(r.Vallow) + ' m/s']])
      + sec('5 · VERDICT')
      + T([['Velocity check', r.velOk ? 'PASS' : 'REVIEW'], ['Erosional check', r.eroOk ? 'PASS' : 'REVIEW'],
           ['Pressure drop check', r.dpOk ? 'PASS' : 'REVIEW']])
      + sec('6 · RECOMMENDATIONS')
      + advise(r).map(function (a) {
          return '<div style="margin:6px 0;padding:6px 8px;border-left:3px solid #ea580c;background:#fff7ed;">'
            + '<b style="font-size:11px;">' + esc(a.where) + ' — ' + esc(a.what) + '</b>'
            + '<div style="font-size:10.5px;color:#374151;margin-top:2px;line-height:1.5;">' + esc(a.why) + '</div></div>';
        }).join('')
      + '<div style="margin-top:14px;font-size:9px;color:#6b7280;">Darcy–Weisbach friction with Colebrook f, Crane TP-410 K values, API RP 14E erosional velocity. Route geometry taken from the sketch at the stated scale — confirm against the issued P&amp;ID before construction.</div>'
      + '</div>';
    modal('P&ID LINE HYDRAULICS REPORT', h);
  }

  function modal(title, inner) {
    var old = $('pid-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'pid-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(2,6,18,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;max-width:980px;width:100%;max-height:92vh;display:flex;flex-direction:column;">'
      + '<div style="display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #334155;">'
      + '<span style="font-family:monospace;font-size:13px;font-weight:800;color:#ff7538;flex:1;">' + title + '</span>'
      + '<button id="pid-pdf" style="margin-right:8px;background:#16a34a;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">⬇ PDF</button>'
      + '<button id="pid-mclose" style="background:#ef4444;border:none;color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px;cursor:pointer;">✕ CLOSE</button></div>'
      + '<div id="pid-mbody" style="overflow:auto;padding:18px;background:#fff;border-radius:0 0 10px 10px;">' + inner + '</div></div>';
    document.body.appendChild(m);
    $('pid-mclose').onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    var pb = $('pid-pdf');
    pb.onclick = function () {
      pb.textContent = '⏳ GENERATING…'; pb.disabled = true;
      var done = function () { pb.textContent = '⬇ PDF'; pb.disabled = false; };
      if (!window.AROPDF) { try { window.print(); } catch (e) {} done(); return; }
      var p = window.AROPDF($('pid-mbody'), 'PID_Line_Hydraulics_Report.pdf', { landscape: false });
      if (p && p.then) p.then(done, done); else setTimeout(done, 1600);
    };
  }

  /* ─────────── panel ─────────── */
  function fld(label, id, unit, v, step) {
    return '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + label
      + '<span style="display:flex;align-items:center;gap:4px;margin-top:2px;">'
      + '<input id="' + id + '" type="number" step="' + (step || 'any') + '" value="' + v + '" style="flex:1;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;"/>'
      + (unit ? '<span style="font-size:9px;color:#64748b;min-width:52px;">' + unit + '</span>' : '') + '</span></label>';
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
      + '<div class="panel-header"><span class="panel-title">P&amp;ID LINE WORKBENCH — DRAW THE RUN</span></div><div class="panel-body">';

    h += hdr('1 · LINE IDENTIFICATION');
    h += txtf('LINE No.', 'pid-lineno', '');
    h += two(txtf('FROM', 'pid-from', ''), txtf('TO', 'pid-to', ''));

    h += hdr('2 · DRAWING');
    h += fld('Scale (metres per pixel)', 'pid-scale', 'm/px', 0.25, '0.01');
    h += '<div style="display:flex;gap:6px;margin-top:6px;">'
      + '<button id="pid-undo" class="pid-act" style="flex:1;">↩ UNDO POINT</button>'
      + '<button id="pid-clear" class="pid-act pid-red" style="flex:1;">↺ CLEAR</button></div>';
    h += '<div style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;line-height:1.5;margin-top:6px;">Click on the canvas to place the FROM point, click again at every change of direction, and finish at the TO point. Each corner becomes a fitting; each vertical leg becomes static head.</div>';

    h += hdr('3 · PROCESS DATA');
    h += two(fld('Mass flow', 'pid-flow', 'kg/hr', 20000, '10'), fld('Density', 'pid-rho', 'kg/m³', 998.2, '0.1'));
    h += two(fld('Viscosity', 'pid-mu', 'cP', 1.002, '0.001'), fld('Upstream pressure', 'pid-pup', 'bar(G)', 6, '0.1'));

    h += hdr('4 · LINE SPECIFICATION');
    h += two(sel('NPS', 'pid-nps', Object.keys(PIPE), '2'), sel('SCHEDULE', 'pid-sch', SCHEDULES, '40'));
    h += sel('MATERIAL', 'pid-mat', Object.keys(ROUGH), 'CS');
    h += fld('C factor (API 14E)', 'pid-cfactor', '', 100, '1');
    h += '<label style="display:flex;align-items:center;gap:6px;margin:8px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);"><input type="checkbox" id="pid-control"/> Line has a throttling / control duty</label>';

    h += '<button id="pid-eval" style="width:100%;margin-top:12px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ EVALUATE DRAWN LINE</button>';
    h += '<button id="pid-report" class="pid-act" style="width:100%;margin-top:8px;">📄 P&amp;ID HYDRAULICS REPORT</button>';
    h += css();
    h += '</div></div>';

    h += '<div class="panel" style="max-height:calc(100vh - 190px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">DRAWN ROUTE &amp; EVALUATION</span></div><div class="panel-body">'
      + '<canvas id="pid-canvas" width="900" height="380" style="width:100%;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;cursor:crosshair;display:block;"></canvas>'
      + '<div id="pid-results" style="margin-top:12px;"></div>'
      + '</div></div>';
    return h + '</div>';
  }

  function css() {
    return '<style>'
      + '.pid-act{background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:7px;border-radius:4px;cursor:pointer;}'
      + '.pid-act:hover{background:rgba(255,117,56,0.12);}'
      + '.pid-red{border-color:#ef4444;color:#ef4444;}'
      + '.pid-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
      + '.pid-rr span{color:var(--text-muted);}.pid-rr b{color:#e2e8f0;}.pid-rr.ok b{color:#22c55e;}.pid-rr.warn b{color:#ef4444;}'
      + '.pid-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}'
      + '</style>';
  }

  function wire() {
    CV = $('pid-canvas'); CTX = CV.getContext('2d');
    CV.addEventListener('click', function (e) {
      var b = CV.getBoundingClientRect();
      NODES.push({ x: (e.clientX - b.left) * (CV.width / b.width), y: (e.clientY - b.top) * (CV.height / b.height) });
      render();
    });
    $('pid-undo').addEventListener('click', function () { NODES.pop(); render(); });
    $('pid-clear').addEventListener('click', function () { NODES = []; LASTR = null; render(); });
    $('pid-eval').addEventListener('click', render);
    $('pid-report').addEventListener('click', report);
    ['pid-scale', 'pid-flow', 'pid-rho', 'pid-mu', 'pid-pup', 'pid-nps', 'pid-sch', 'pid-mat', 'pid-cfactor', 'pid-control', 'pid-from', 'pid-to']
      .forEach(function (id) { var e = $(id); if (e) { e.addEventListener('change', render); e.addEventListener('input', render); } });
    draw();
  }

  function build() {
    if (built) return;
    var host = document.getElementById('line-pid-content'); if (!host) return;
    host.innerHTML = panelHTML();
    built = true;
    wire();
  }

  window.AROPID = { build: build, compute: compute, report: report, nodes: function () { return NODES; },
                    setNodes: function (n) { NODES = n; render(); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(build, 400); });
  else setTimeout(build, 400);
})();

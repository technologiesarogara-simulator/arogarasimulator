/* ══════════════════════════════════════════════════════════════════════
   AROGARA — P&ID LINE WORKBENCH  (window.AROPID)

   A drawing board that is also a hydraulic model. The engineer draws the
   run segment by segment, drops valves and fittings on it from a library,
   sizes each segment independently, and gets back the pressure drop and
   velocity of every leg plus a located, reasoned review of the layout.

   Model
     DOC.segs   [{ id, x1, y1, x2, y2, nps, sch, colour }]
     DOC.items  [{ id, key, segId, t }]     t = fraction along the segment

   Hydraulics per segment (Crane TP-410 / Darcy–Weisbach)
     V   = Q / A                       A from the segment's own bore
     Re  = ρVD/μ            f = 64/Re (laminar) | Colebrook (turbulent)
     ΔP  = f·L/D·ρV²/2  +  ΣK·ρV²/2  +  ρ·g·Δz
   Erosional velocity from API RP 14E; the review compares every leg and
   says whether one uniform size beats the per-leg selection.

   The 3D icons are built procedurally from Three.js primitives rather
   than fetched — a strict CSP blocks external assets on the published
   page, so every symbol has to be self-contained.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────── libraries ─────────── */
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
  var ROUGH = { 'CS': 0.045, 'SS316': 0.0015, 'SS304': 0.0015, 'GI': 0.15, 'HDPE': 0.007, 'Cast iron': 0.26 };

  /* Component library — K from Crane TP-410, symbol style from ISA S5.1.
     `sym` picks the 2D glyph, `ico` the 3D build, `note` the review text. */
  /* Fitting K by NPS band — the client's two-phase workbook table. K falls
     as the bore grows, so every component's loss is read from the leg it
     sits on, not from a single fixed number.
     Index order: gate, globe, angle, ball, plug-straight, plug-3way,
     plug-branch, swing check, lift check, elbow 90, elbow 45, LR 90,
     tee run, tee branch, mitre 0, mitre 30, mitre 60, mitre 90. */
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
  function kBand(nps) {
    var keys = Object.keys(FIT_K).map(Number).sort(function (a, b) { return a - b; });
    var pick = keys[0];
    for (var i = 0; i < keys.length; i++) if (nps >= keys[i]) pick = keys[i];
    return FIT_K[pick];
  }
  /* K for a component on a line of this bore. Items with a `ki` come from the
     workbook table; the rest carry a fixed value the table does not cover. */
  function kOf(key, nps) {
    var c = lib(key);
    return (c.ki != null) ? kBand(nps)[c.ki] : c.k;
  }

  var TAGP = { gate:'GV', globe:'GLV', ball:'BV', butterfly:'BFV', check:'NRV', lcheck:'NRV', plug:'PV',
              control:'FCV', psv:'PSV', e90:'EL', e90lr:'EL', e45:'EL', teeR:'TEE', teeB:'TEE',
              red:'RED', strain:'ST', orifice:'FE', flange:'FL' };
  var TAGN = {};

  var LIB = [
    { key: 'gate',    name: 'Gate valve',        ki: 0,  k: 0.15, sym: 'valve',  ico: 'wheel',  colour: '#38bdf8',
      note: 'on/off isolation — full bore when open, so it costs almost nothing in ΔP' },
    { key: 'globe',   name: 'Globe valve',       ki: 1,  k: 6.50, sym: 'globe',  ico: 'wheel',  colour: '#f59e0b',
      note: 'throttling duty — the seat turns the flow twice, which is why its K is the largest in the table' },
    { key: 'angle',   name: 'Angle valve',       ki: 2,  k: 1.05, sym: 'angle',  ico: 'angle',  colour: '#f59e0b',
      note: 'throttles like a globe but turns the line 90°, saving an elbow' },
    { key: 'ball',    name: 'Ball valve',        ki: 3,  k: 0.06, sym: 'ball',   ico: 'lever',  colour: '#22c55e',
      note: 'quarter-turn isolation, the lowest loss in the library — quick shutoff, poor for throttling' },
    { key: 'butterfly', name: 'Butterfly valve', k: 0.86, sym: 'bfly',  ico: 'bfly',   colour: '#a78bfa',
      note: 'compact isolation for large bore; the disc sits in the stream even when open' },
    { key: 'plug',    name: 'Plug valve straight', ki: 4, k: 0.34, sym: 'ball',  ico: 'lever',  colour: '#22c55e',
      note: 'quarter-turn isolation for dirty service, straight through' },
    { key: 'plug3',   name: 'Plug valve 3-way',  ki: 5,  k: 0.57, sym: 'plug3',  ico: 'lever',  colour: '#22c55e',
      note: 'three-way plug taken through the run' },
    { key: 'plugB',   name: 'Plug valve branch', ki: 6,  k: 1.71, sym: 'plug3',  ico: 'lever',  colour: '#22c55e',
      note: 'the same body with flow turned into the branch — three times the loss of the straight path' },
    { key: 'check',   name: 'Swing check valve', ki: 7,  k: 1.00, sym: 'check',  ico: 'check',  colour: '#ef4444',
      note: 'prevents reverse flow — needed wherever the line lifts or two pumps share a header' },
    { key: 'lcheck',  name: 'Lift check valve',  ki: 8,  k: 11.4, sym: 'check',  ico: 'check',  colour: '#ef4444',
      note: 'tighter shutoff than a swing check but a heavy K — use only where leak-back matters' },
    { key: 'control', name: 'Control valve',     k: 10.0, sym: 'ctrl',  ico: 'actuator', colour: '#fb7185',
      note: 'the control element — its loss is deliberate, and it must keep authority over the rest of the line' },
    { key: 'psv',     name: 'Relief valve',      k: 0.00, sym: 'psv',   ico: 'psv',    colour: '#fbbf24',
      note: 'overpressure protection; no loss in the normal flow path' },
    { key: 'e90',     name: 'Elbow 90° std',     ki: 9,  k: 0.57, sym: 'bend',   ico: 'bend',   colour: '#94a3b8',
      note: 'a square change of direction' },
    { key: 'e90lr',   name: 'Elbow 90° long rad', ki: 11, k: 0.30, sym: 'bend',  ico: 'bend',   colour: '#94a3b8',
      note: 'R/D 1.5 — roughly half the loss of a standard elbow and kinder to erosive service' },
    { key: 'e45',     name: 'Elbow 45°',         ki: 10, k: 0.30, sym: 'bend',   ico: 'bend',   colour: '#94a3b8',
      note: 'a shallow offset; two of these often beat one 90°' },
    { key: 'teeR',    name: 'Tee — through run', ki: 12, k: 0.38, sym: 'tee',    ico: 'tee',    colour: '#94a3b8',
      note: 'straight through the header' },
    { key: 'teeB',    name: 'Tee — branch',      ki: 13, k: 1.14, sym: 'tee',    ico: 'tee',    colour: '#94a3b8',
      note: 'the flow turns into the branch, costing about three times the through path' },
    { key: 'm0',      name: 'Mitre α=0°',        ki: 14, k: 0.04, sym: 'mitre',  ico: 'bend',   colour: '#94a3b8',
      note: 'a welded joint with no deflection' },
    { key: 'm30',     name: 'Mitre α=30°',       ki: 15, k: 0.15, sym: 'mitre',  ico: 'bend',   colour: '#94a3b8',
      note: 'a shallow cut-and-weld deflection, the cheapest way to turn a large line' },
    { key: 'm60',     name: 'Mitre α=60°',       ki: 16, k: 0.48, sym: 'mitre',  ico: 'bend',   colour: '#94a3b8',
      note: 'an intermediate mitred turn' },
    { key: 'm90',     name: 'Mitre α=90°',       ki: 17, k: 1.14, sym: 'mitre',  ico: 'bend',   colour: '#94a3b8',
      note: 'a square mitred turn — twice the loss of a fabricated elbow, so use it only on large cold lines' },
    { key: 'red',     name: 'Reducer',           k: 0.30, sym: 'red',    ico: 'red',    colour: '#94a3b8',
      note: 'a size change — keep it away from pump suctions unless it is eccentric and flat on top' },
    { key: 'strain',  name: 'Strainer',          k: 2.00, sym: 'strain', ico: 'strain', colour: '#fbbf24',
      note: 'protects the downstream machine; the K rises sharply as it blinds, so allow margin' },
    { key: 'orifice', name: 'Orifice plate',     k: 2.50, sym: 'orif',   ico: 'orif',   colour: '#fbbf24',
      note: 'flow measurement — the permanent loss is real and belongs in the hydraulics' },
    { key: 'flange',  name: 'Flange pair',       k: 0.00, sym: 'flange', ico: 'flange', colour: '#64748b',
      note: 'a break for maintenance; no hydraulic loss' }
  ];
  function lib(key) { for (var i = 0; i < LIB.length; i++) if (LIB[i].key === key) return LIB[i]; return LIB[0]; }

  var DOC = { segs: [], items: [] };
  var TOOL = 'line', ARMED = null, SEL = null, DRAG = null, UID = 1;
  var SNAP = 25, ORTHO = true, GHOST = null, RUNNING = false;
  var built = false, CV = null, CTX = null, LASTR = null;
  var three = null;

  function $(id) { return document.getElementById(id); }
  function num(id, d) { var e = $(id); if (!e) return d; var v = parseFloat(e.value); return isFinite(v) ? v : d; }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f1(v) { return isFinite(v) ? v.toFixed(1) : '—'; }
  function f2(v) { return isFinite(v) ? v.toFixed(2) : '—'; }
  function f3(v) { return isFinite(v) ? v.toFixed(3) : '—'; }
  function f4(v) { return isFinite(v) ? v.toFixed(4) : '—'; }

  /* ─────────── document helpers ─────────── */
  function defNps() { return parseFloat(val('pid-nps', '2')); }
  function defSch() { return val('pid-sch', '40'); }

  function addSeg(x1, y1, x2, y2, nps, sch) {
    var s = { id: UID++, x1: x1, y1: y1, x2: x2, y2: y2,
              nps: nps || defNps(), sch: sch || defSch(), colour: '#38bdf8' };
    DOC.segs.push(s); return s;
  }
  function nextTag(key) {
    var pre = TAGP[key] || 'IT';
    TAGN[pre] = (TAGN[pre] || 100) + 1;
    return pre + '-' + TAGN[pre];
  }
  function addItem(key, segId, t, tag) {
    var it = { id: UID++, key: key, segId: segId, t: t == null ? 0.5 : t, tag: tag || nextTag(key) };
    DOC.items.push(it); return it;
  }
  function segById(id) { for (var i = 0; i < DOC.segs.length; i++) if (DOC.segs[i].id === id) return DOC.segs[i]; return null; }
  function itemXY(it) {
    var s = segById(it.segId); if (!s) return { x: 0, y: 0 };
    return { x: s.x1 + (s.x2 - s.x1) * it.t, y: s.y1 + (s.y2 - s.y1) * it.t };
  }
  function lastEnd() {
    if (!DOC.segs.length) return null;
    var s = DOC.segs[DOC.segs.length - 1];
    return { x: s.x2, y: s.y2 };
  }

  /* Nearest segment to a point, with the projected fraction along it. */
  function hitSeg(x, y, tol) {
    var best = null, bd = tol == null ? 14 : tol;
    DOC.segs.forEach(function (s) {
      var dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy;
      if (L2 === 0) return;
      var t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / L2));
      var px = s.x1 + dx * t, py = s.y1 + dy * t;
      var d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = { seg: s, t: t }; }
    });
    return best;
  }
  function hitItem(x, y) {
    for (var i = DOC.items.length - 1; i >= 0; i--) {
      var p = itemXY(DOC.items[i]);
      if (Math.hypot(x - p.x, y - p.y) < 13) return DOC.items[i];
    }
    return null;
  }
  function hitEnd(x, y) {
    for (var i = 0; i < DOC.segs.length; i++) {
      var s = DOC.segs[i];
      if (Math.hypot(x - s.x1, y - s.y1) < 10) return { seg: s, end: 1 };
      if (Math.hypot(x - s.x2, y - s.y2) < 10) return { seg: s, end: 2 };
    }
    return null;
  }

  /* Grid snap keeps the sketch tidy; ortho forces each new leg square to
     the last point, which is how a P&ID is actually routed. */
  function snap(p) { return { x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP }; }
  function ortho(from, to) {
    if (!ORTHO || !from) return to;
    return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  }

  /* ─────────── hydraulics ─────────── */
  function segLen(s, scale) { return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * scale; }
  function segDz(s, scale) { return -(s.y2 - s.y1) * scale; }        // screen-down = fall

  function bore(nps, sch) {
    var pd = PIPE[nps] || PIPE[2];
    var idIn = pd.s[sch] !== undefined ? pd.s[sch] : pd.s['40'];
    return { idIn: idIn, odIn: pd.od, Dmm: idIn * 25.4, D: idIn * 25.4 / 1000 };
  }

  function legs(overrideNps, overrideSch) {
    var scale = num('pid-scale', 0.05);
    var eps = ROUGH[val('pid-mat', 'CS')];
    var rho = num('pid-rho', 998.2), mu = num('pid-mu', 1.002);
    var W = num('pid-flow', 20000);
    var Q = W / rho;

    return DOC.segs.map(function (s, i) {
      var nps = overrideNps != null ? overrideNps : s.nps;
      var sch = overrideSch != null ? overrideSch : s.sch;
      var b = bore(nps, sch);
      var A = Math.PI / 4 * b.D * b.D;
      var V = Q / (A * 3600);
      var Re = (rho * V * b.D) / (0.001 * mu);
      var f = Re < 2100 ? 64 / Re : 1.3255 / Math.pow(Math.log((eps / (3.7 * b.Dmm)) + (5.74 / Math.pow(Re, 0.9))), 2);
      var L = segLen(s, scale), dz = segDz(s, scale);

      var mine = DOC.items.filter(function (it) { return it.segId === s.id; });
      var sumK = mine.reduce(function (a, it) { return a + kOf(it.key, nps); }, 0);

      var dpFric = (f * L * rho * V * V) / (b.D * 2);
      var dpFit = 0.5 * sumK * rho * V * V;
      var dpStat = rho * 9.81 * dz;

      return { seg: s, idx: i + 1, nps: nps, sch: sch, Dmm: b.Dmm, D: b.D, L: L, dz: dz,
               V: V, Re: Re, f: f, sumK: sumK, items: mine,
               dpFricPa: dpFric, dpFitPa: dpFit, dpStatPa: dpStat,
               dpPa: dpFric + dpFit + dpStat };
    });
  }

  function totals(ls) {
    var rho = num('pid-rho', 998.2);
    var C = num('pid-cfactor', 100);
    var Ve = (C / Math.sqrt(rho * 0.06248)) * 0.3048;
    var Vallow = Ve * 0.75;
    var t = { L: 0, dz: 0, dpPa: 0, dpFricPa: 0, dpFitPa: 0, dpStatPa: 0, sumK: 0, Vmax: 0, Vmin: 1e9 };
    ls.forEach(function (l) {
      t.L += l.L; t.dz += l.dz; t.dpPa += l.dpPa; t.dpFricPa += l.dpFricPa;
      t.dpFitPa += l.dpFitPa; t.dpStatPa += l.dpStatPa; t.sumK += l.sumK;
      t.Vmax = Math.max(t.Vmax, l.V); t.Vmin = Math.min(t.Vmin, l.V);
    });
    if (!ls.length) t.Vmin = 0;
    t.dp = t.dpPa / 1e5;
    /* The allowance is a friction criterion (bar per 100 m). Static head is
       set by the route's elevation, not the bore, so a pipe-size sweep can
       never satisfy it — it is reported in the total but judged separately. */
    t.dpDyn = (t.dpFricPa + t.dpFitPa) / 1e5;
    t.Ve = Ve; t.Vallow = Vallow;
    var f = ls.length ? ls[0].f : 0.02;
    var D = ls.length ? ls[0].D : 0.05;
    t.Leq = t.L + (f > 0 ? t.sumK * D / f : 0);
    t.dpAllow = Math.max(0.05, Math.min(0.5 * t.Leq / 100, 0.10 * (num('pid-pup', 6) + 1.01325)));
    t.velOk = t.Vmin >= 0.9 && t.Vmax <= 4.5;
    t.eroOk = t.Vmax < Vallow;
    t.dpOk = t.dpDyn <= t.dpAllow;
    return t;
  }

  function compute() {
    if (!DOC.segs.length) return null;
    var ls = legs();
    var r = { legs: ls, tot: totals(ls) };

    /* Would one uniform size serve the whole drawing better? Try every bore
       and keep the smallest that passes velocity, erosion and ΔP. */
    var sizes = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
    r.uniform = null;
    for (var i = 0; i < sizes.length; i++) {
      var u = totals(legs(sizes[i], defSch()));
      if (u.velOk && u.eroOk && u.dpOk) { r.uniform = { nps: sizes[i], sch: defSch(), tot: u }; break; }
    }
    r.mixed = DOC.segs.some(function (s) { return s.nps !== DOC.segs[0].nps || s.sch !== DOC.segs[0].sch; });
    return r;
  }

  /* ─────────── 2D symbols ─────────── */
  function symbol(ctx, x, y, ang, c, selected) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    var s = 9;
    ctx.lineWidth = 2; ctx.strokeStyle = c.colour; ctx.fillStyle = c.colour;
    if (selected) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; }

    function bowtie(fill) {
      ctx.beginPath();
      ctx.moveTo(-s, -s); ctx.lineTo(-s, s); ctx.lineTo(0, 0); ctx.closePath();
      ctx.moveTo(s, -s); ctx.lineTo(s, s); ctx.lineTo(0, 0); ctx.closePath();
      if (fill) ctx.fill(); else ctx.stroke();
    }
    switch (c.sym) {
      case 'valve': bowtie(false); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s - 6); ctx.moveTo(-5, -s - 6); ctx.lineTo(5, -s - 6); ctx.stroke(); break;
      case 'globe': bowtie(false); ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -s - 6); ctx.moveTo(-5, -s - 6); ctx.lineTo(5, -s - 6); ctx.stroke(); break;
      case 'ball':  bowtie(false); ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(0, -s - 5); ctx.stroke(); break;
      case 'bfly':  bowtie(false); ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(4, -5); ctx.stroke(); break;
      case 'check': bowtie(false); ctx.beginPath(); ctx.moveTo(-s + 2, s - 2); ctx.lineTo(s - 2, -s + 2); ctx.stroke(); break;
      case 'ctrl':  bowtie(false); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s - 4);
                    ctx.arc(0, -s - 8, 4.5, 0, Math.PI * 2); ctx.stroke(); break;
      case 'psv':   ctx.beginPath(); ctx.moveTo(-s, s); ctx.lineTo(0, 0); ctx.lineTo(-s, -s); ctx.closePath(); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -10); ctx.lineTo(12, -6); ctx.stroke(); break;
      case 'bend':  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke(); break;
      case 'tee':   ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, 0); ctx.lineTo(0, s); ctx.stroke(); break;
      case 'red':   ctx.beginPath(); ctx.moveTo(-s, -s + 2); ctx.lineTo(s, -3); ctx.lineTo(s, 3); ctx.lineTo(-s, s - 2); ctx.closePath(); ctx.stroke(); break;
      case 'strain': ctx.beginPath(); ctx.moveTo(-s, -6); ctx.lineTo(s, -6); ctx.lineTo(s, 6); ctx.lineTo(-s, 6); ctx.closePath(); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-s, 6); ctx.lineTo(s, -6); ctx.stroke(); break;
      case 'orif':  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, -3); ctx.moveTo(0, 3); ctx.lineTo(0, s); ctx.stroke(); break;
      default:      ctx.beginPath(); ctx.moveTo(-2, -s); ctx.lineTo(-2, s); ctx.moveTo(2, -s); ctx.lineTo(2, s); ctx.stroke();
    }
    ctx.restore();
  }

  /* ─────────── canvas render ─────────── */
  function draw() {
    if (!CTX) return;
    var w = CV.width, h = CV.height;
    CTX.clearRect(0, 0, w, h);
    CTX.fillStyle = '#0b1220'; CTX.fillRect(0, 0, w, h);
    CTX.strokeStyle = 'rgba(148,163,184,0.10)'; CTX.lineWidth = 1;
    for (var x = 0; x < w; x += 25) { CTX.beginPath(); CTX.moveTo(x, 0); CTX.lineTo(x, h); CTX.stroke(); }
    for (var y = 0; y < h; y += 25) { CTX.beginPath(); CTX.moveTo(0, y); CTX.lineTo(w, y); CTX.stroke(); }

    if (!DOC.segs.length) {
      CTX.fillStyle = '#64748b'; CTX.font = '12px monospace';
      CTX.fillText('LINE tool — click the FROM point, then click at each change of direction. Legs snap square and to the grid.', 18, 26);
      CTX.fillText('Press FINISH RUN to end the route. Pick a component from the library, then click a line to place it.', 18, 46);
      CTX.fillText('SELECT / DRAG — drag a leg to move it, drag an endpoint to reshape, drag a component along its line.', 18, 66);
      return;
    }

    var scale = num('pid-scale', 0.05);
    DOC.segs.forEach(function (s, i) {
      var sel = SEL && SEL.kind === 'seg' && SEL.id === s.id;
      CTX.strokeStyle = s.colour; CTX.lineWidth = Math.max(3, Math.min(9, s.nps * 1.4));
      CTX.lineCap = 'round';
      if (sel) { CTX.shadowColor = '#fff'; CTX.shadowBlur = 10; }
      CTX.beginPath(); CTX.moveTo(s.x1, s.y1); CTX.lineTo(s.x2, s.y2); CTX.stroke();
      CTX.shadowBlur = 0;

      /* Leg label offset perpendicular to the run so it never sits on the
         pipe, and dropped entirely on legs too short to hold it. */
      var mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
      var dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy);
      if (len > 46) {
        var nx = len ? -dy / len : 0, ny = len ? dx / len : -1;
        var txt = 'L' + (i + 1) + '  ' + f1(segLen(s, scale)) + ' m  ' + s.nps + '" S' + s.sch;
        CTX.font = '10px monospace';
        var tw = CTX.measureText(txt).width;
        var lx = mx + nx * 16, ly = my + ny * 16;
        CTX.fillStyle = 'rgba(11,18,32,0.85)';
        CTX.fillRect(lx - tw / 2 - 3, ly - 8, tw + 6, 14);
        CTX.fillStyle = '#cbd5e1'; CTX.textAlign = 'center';
        CTX.fillText(txt, lx, ly + 3); CTX.textAlign = 'left';
      }

      [[s.x1, s.y1], [s.x2, s.y2]].forEach(function (pt) {
        CTX.fillStyle = '#0b1220'; CTX.strokeStyle = sel ? '#fff' : '#64748b'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(pt[0], pt[1], 4.5, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
      });
    });

    /* Rubber band for the leg being routed. */
    if (GHOST) {
      var from = lastEnd();
      if (from) {
        CTX.save(); CTX.setLineDash([6, 5]); CTX.strokeStyle = '#22c55e'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.moveTo(from.x, from.y); CTX.lineTo(GHOST.x, GHOST.y); CTX.stroke();
        CTX.restore();
        CTX.fillStyle = '#22c55e'; CTX.font = '10px monospace';
        CTX.fillText(f1(Math.hypot(GHOST.x - from.x, GHOST.y - from.y) * scale) + ' m', GHOST.x + 9, GHOST.y - 9);
      }
    }

    /* Components: symbol on the line, tag above, name below — staggered so a
       cluster on one leg stays readable. */
    DOC.items.forEach(function (it, n) {
      var sg = segById(it.segId); if (!sg) return;
      var pt = itemXY(it);
      var ang = Math.atan2(sg.y2 - sg.y1, sg.x2 - sg.x1);
      var c = lib(it.key);
      symbol(CTX, pt.x, pt.y, ang, c, SEL && SEL.kind === 'item' && SEL.id === it.id);
      var off = (n % 2) ? 30 : 18;
      CTX.font = 'bold 10px monospace'; CTX.textAlign = 'center';
      var tw2 = Math.max(CTX.measureText(it.tag).width, CTX.measureText(c.name).width * 0.82) + 8;
      CTX.fillStyle = 'rgba(11,18,32,0.85)';
      CTX.fillRect(pt.x - tw2 / 2, pt.y + off - 10, tw2, 22);
      CTX.fillStyle = c.colour; CTX.fillText(it.tag, pt.x, pt.y + off);
      CTX.font = '8.5px monospace'; CTX.fillStyle = '#94a3b8';
      CTX.fillText(c.name, pt.x, pt.y + off + 10);
      CTX.textAlign = 'left';
    });

    var a = DOC.segs[0], b = DOC.segs[DOC.segs.length - 1];
    CTX.fillStyle = '#22c55e'; CTX.beginPath(); CTX.arc(a.x1, a.y1, 6, 0, Math.PI * 2); CTX.fill();
    CTX.font = 'bold 11px monospace'; CTX.fillText(val('pid-from', '') || 'FROM', a.x1 + 10, a.y1 - 12);
    CTX.fillStyle = '#ef4444'; CTX.beginPath(); CTX.arc(b.x2, b.y2, 6, 0, Math.PI * 2); CTX.fill();
    CTX.fillText(val('pid-to', '') || 'TO', b.x2 + 10, b.y2 - 12);
  }

  /* ─────────── 3D of the drawn network ─────────── */
  function sprite(txt, colour) {
    var c = document.createElement('canvas'), m = c.getContext('2d');
    m.font = 'bold 34px monospace';
    c.width = Math.max(64, m.measureText(txt).width + 20); c.height = 46;
    var g = c.getContext('2d');
    g.font = 'bold 34px monospace'; g.fillStyle = colour; g.textBaseline = 'middle';
    g.fillText(txt, 10, 23);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sp.scale.set(c.width / 44, c.height / 44, 1);
    return sp;
  }

  function icon3D(c, R) {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.colour), metalness: 0.6, roughness: 0.35 });
    var steel = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.8, roughness: 0.3 });
    function flanges(rad, dx) {
      [-dx, dx].forEach(function (x) {
        var fl = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, R * 0.35, 20), steel);
        fl.rotation.z = Math.PI / 2; fl.position.x = x; g.add(fl);
      });
    }
    var ico = c.ico;

    if (ico === 'bend') {                                   // elbow / mitre — a real curve
      var curve = new THREE.TorusGeometry(R * 2.0, R, 12, 16, Math.PI / 2);
      var el = new THREE.Mesh(curve, mat); el.position.set(-R * 2.0, 0, 0); g.add(el);
      var t1 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 1.2, 16), mat);
      t1.rotation.z = Math.PI / 2; t1.position.set(-R * 2.6, R * 2.0, 0); g.add(t1);
      var t2 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 1.2, 16), mat);
      t2.position.set(0, R * 0.6, 0); g.add(t2);
      return g;
    }
    if (ico === 'tee') {                                    // a genuine T
      var run = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 4.5, 18), mat);
      run.rotation.z = Math.PI / 2; g.add(run);
      var br = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.85, R * 0.85, R * 2.4, 16), mat);
      br.position.y = -R * 1.5; g.add(br);
      return g;
    }
    if (ico === 'red') {                                    // concentric reducer
      var cone = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 1.3, R * 2.4, 20), mat);
      cone.rotation.z = Math.PI / 2; g.add(cone);
      flanges(R * 1.6, R * 1.3);
      return g;
    }
    if (ico === 'flange') {
      [-R * 0.3, R * 0.3].forEach(function (x) {
        var d = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.9, R * 1.9, R * 0.35, 22), steel);
        d.rotation.z = Math.PI / 2; d.position.x = x; g.add(d);
      });
      var stub = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 2.0, 16), mat);
      stub.rotation.z = Math.PI / 2; g.add(stub);
      return g;
    }
    if (ico === 'orif') {                                   // plate between flanges
      var pl = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.9, R * 1.9, R * 0.18, 22), mat);
      pl.rotation.z = Math.PI / 2; g.add(pl);
      var st = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 2.2, 16), steel);
      st.rotation.z = Math.PI / 2; g.add(st);
      var tap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.16, R * 0.16, R * 1.6, 8), mat);
      tap.position.y = R * 1.6; g.add(tap);
      return g;
    }

    // valve bodies share a barrel with flanges; the top works tells them apart
    var body = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.5, R * 1.5, R * 2.2, 20), mat);
    body.rotation.z = Math.PI / 2; g.add(body);
    flanges(R * 1.8, R * 1.4);

    if (ico === 'wheel') {
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, R * 2.4, 10), steel);
      stem.position.y = R * 2.0; g.add(stem);
      var wh = new THREE.Mesh(new THREE.TorusGeometry(R * 1.1, R * 0.16, 8, 20), steel);
      wh.position.y = R * 3.1; wh.rotation.x = Math.PI / 2; g.add(wh);
    } else if (ico === 'angle') {
      var out = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 2.2, 16), mat);
      out.position.y = -R * 1.6; g.add(out);
      var st4 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, R * 2.2, 10), steel);
      st4.position.y = R * 1.9; g.add(st4);
      var wh2 = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.15, 8, 18), steel);
      wh2.position.y = R * 3.0; wh2.rotation.x = Math.PI / 2; g.add(wh2);
    } else if (ico === 'lever') {
      var lv = new THREE.Mesh(new THREE.BoxGeometry(R * 0.3, R * 0.3, R * 3.0), steel);
      lv.position.y = R * 2.1; g.add(lv);
      var st2 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, R * 1.6, 10), steel);
      st2.position.y = R * 1.4; g.add(st2);
    } else if (ico === 'bfly') {
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.25, R * 1.25, R * 0.16, 20), steel);
      disc.rotation.z = Math.PI / 3; g.add(disc);
      var st5 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, R * 2.6, 10), steel);
      st5.position.y = R * 1.7; g.add(st5);
      var hand = new THREE.Mesh(new THREE.BoxGeometry(R * 0.28, R * 0.28, R * 2.4), steel);
      hand.position.y = R * 2.9; g.add(hand);
    } else if (ico === 'check') {                           // hinged flap inside
      var flap = new THREE.Mesh(new THREE.BoxGeometry(R * 0.14, R * 2.0, R * 2.0), steel);
      flap.position.set(R * 0.2, -R * 0.35, 0); flap.rotation.z = -0.5; g.add(flap);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.9, 14, 10), mat);
      cap.position.y = R * 1.2; g.add(cap);
    } else if (ico === 'actuator') {
      var act = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.5, R * 1.5, R * 1.1, 18), steel);
      act.position.y = R * 3.0; g.add(act);
      var st3 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, R * 2.2, 10), steel);
      st3.position.y = R * 1.9; g.add(st3);
    } else if (ico === 'psv') {
      var bon = new THREE.Mesh(new THREE.ConeGeometry(R * 1.2, R * 2.2, 16), mat);
      bon.position.y = R * 2.2; g.add(bon);
      var vent = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.7, R * 1.6, 14), steel);
      vent.rotation.z = Math.PI / 2; vent.position.set(R * 1.8, R * 1.6, 0); g.add(vent);
    } else if (ico === 'strain') {                          // basket hanging below
      var bask = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.1, R * 0.8, R * 2.2, 16), steel);
      bask.position.y = -R * 1.7; bask.rotation.z = 0.5; g.add(bask);
    }
    return g;
  }

  /* Palette tiles show the real 3D component, rendered once offscreen and
     cached as an image — the button and the model are then the same thing. */
  var ICO_CACHE = {};
  function icon3DImage(key) {
    if (ICO_CACHE[key]) return ICO_CACHE[key];
    if (typeof THREE === 'undefined') return null;
    try {
      var W = 104, H = 72;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var rn = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      rn.setPixelRatio(2); rn.setSize(W, H, false);
      var sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xdce8ff, 0x2b3242, 1.15));
      var dl = new THREE.DirectionalLight(0xffffff, 0.95); dl.position.set(6, 10, 8); sc.add(dl);
      var g = icon3D(lib(key), 1);
      sc.add(g);
      var box = new THREE.Box3().setFromObject(g);
      var sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      var cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
      var need = Math.max(sz.y / 2, (sz.x / 2) / (W / H)) / Math.tan(15 * Math.PI / 180);
      cam.position.set(ctr.x + need * 0.55, ctr.y + need * 0.45, need * 1.05);
      cam.lookAt(ctr);
      rn.render(sc, cam);
      var url = cv.toDataURL('image/png');
      rn.forceContextLoss(); rn.dispose();
      ICO_CACHE[key] = url;
      return url;
    } catch (e) { return null; }
  }

  function init3D() {
    if (typeof THREE === 'undefined') return;
    var cv = $('pid-3d'); if (!cv) return;
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1220);
    var cam = new THREE.PerspectiveCamera(28, cv.clientWidth / Math.max(1, cv.clientHeight), 0.1, 2000);
    var rn = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    rn.setPixelRatio(window.devicePixelRatio || 1);
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2b3242, 1.0));
    var dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(30, 60, 40); scene.add(dl);
    var group = new THREE.Group(); scene.add(group);
    var sph = { r: 90, theta: 0.7, phi: 1.1, tx: 0, ty: 0 };
    function place() {
      var x = sph.r * Math.sin(sph.phi) * Math.sin(sph.theta), y = sph.r * Math.cos(sph.phi), z = sph.r * Math.sin(sph.phi) * Math.cos(sph.theta);
      cam.position.set(sph.tx + x, sph.ty + y, z); cam.lookAt(sph.tx, sph.ty, 0);
    }
    three = { scene: scene, cam: cam, rn: rn, group: group, sph: sph, place: place, cv: cv };
    place();
    var down = null;
    cv.addEventListener('mousedown', function (e) { down = { x: e.clientX, y: e.clientY, th: sph.theta, ph: sph.phi }; });
    window.addEventListener('mousemove', function (e) {
      if (!down) return;
      sph.theta = down.th - (e.clientX - down.x) * 0.01;
      sph.phi = Math.max(0.2, Math.min(Math.PI - 0.2, down.ph - (e.clientY - down.y) * 0.01));
      place();
    });
    window.addEventListener('mouseup', function () { down = null; });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(20, Math.min(400, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); place(); }, { passive: false });
    (function loop() { requestAnimationFrame(loop); rn.render(scene, cam); })();
  }
  function resize3D() {
    if (!three) return; var c = three.cv; if (!c || !c.clientWidth) return;
    three.cam.aspect = c.clientWidth / c.clientHeight; three.cam.updateProjectionMatrix();
    three.rn.setSize(c.clientWidth, c.clientHeight, false);
  }

  /* The 3D view is a true model of the sketch: pipe radius follows each
     segment's bore, length follows the drawn geometry and scale, and the
     colour follows the velocity that the fluid properties produce. */
  function update3D(r) {
    if (!three || !r) return;
    var g = three.group;
    while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); }

    var scale = num('pid-scale', 0.05);
    var mid = { x: 0, y: 0 }, n = 0;
    DOC.segs.forEach(function (s) { mid.x += s.x1 + s.x2; mid.y += s.y1 + s.y2; n += 2; });
    if (n) { mid.x /= n; mid.y /= n; }
    var K = scale * 1.2;                                       // px → model units

    r.legs.forEach(function (l) {
      var s = l.seg;
      var ax = (s.x1 - mid.x) * K, ay = -(s.y1 - mid.y) * K;
      var bx = (s.x2 - mid.x) * K, by = -(s.y2 - mid.y) * K;
      var len = Math.hypot(bx - ax, by - ay);
      if (len < 1e-6) return;
      var R = Math.max(0.35, l.Dmm / 1000 * 3.0);              // real bore, exaggerated ×3 to stay visible
      var col = !isFinite(l.V) ? 0x64748b : l.V > r.tot.Vallow ? 0xef4444 : l.V > 4.5 ? 0xf59e0b : l.V < 0.9 ? 0x38bdf8 : 0x22c55e;
      var pipe = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 20),
        new THREE.MeshStandardMaterial({ color: col, metalness: 0.55, roughness: 0.35 }));
      pipe.position.set((ax + bx) / 2, (ay + by) / 2, 0);
      pipe.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
      g.add(pipe);

      var lab = sprite('L' + l.idx + ' ' + l.nps + '" ' + f1(l.L) + 'm ' + f2(l.V) + 'm/s', '#cbd5e1');
      lab.position.set((ax + bx) / 2, (ay + by) / 2 + R + 2.4, 0); g.add(lab);

      l.items.forEach(function (it, ii) {
        var c = lib(it.key);
        var ic = icon3D(c, R);
        ic.position.set(ax + (bx - ax) * it.t, ay + (by - ay) * it.t, 0);
        ic.rotation.z = Math.atan2(by - ay, bx - ax);
        g.add(ic);
        var nm = sprite(it.tag + '  ' + c.name, c.colour);
        nm.position.set(ic.position.x, ic.position.y - R * 4.2 - (ii % 2) * R * 3.0, 0); g.add(nm);
      });
    });

    /* Frame the whole model: size the camera distance from the bounding box
       and the viewport aspect so a wide route fills the panel instead of
       sitting small in one corner. */
    resize3D();
    var box = new THREE.Box3().setFromObject(g);
    var size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    var aspect = three.cam.aspect || 3;
    var halfFov = three.cam.fov * Math.PI / 360;
    var need = Math.max(size.y / 2, (size.x / 2) / aspect) / Math.tan(halfFov);
    three.sph.tx = ctr.x; three.sph.ty = ctr.y;
    three.sph.r = Math.max(12, need * 1.35);
    three.place();
  }

  /* ─────────── review ─────────── */
  function advise(r) {
    var out = [], t = r.tot;

    r.legs.forEach(function (l) {
      if (l.V > t.Vallow) out.push({ w: 'Leg L' + l.idx, h: 'Above the erosional limit',
        why: 'This leg runs at ' + f2(l.V) + ' m/s against an API RP 14E allowable of ' + f2(t.Vallow) + ' m/s at ' + l.nps + '". Increase this leg — erosion concentrates at the first bend downstream.' });
      else if (l.V > 4.5) out.push({ w: 'Leg L' + l.idx, h: 'Velocity high at ' + f2(l.V) + ' m/s',
        why: 'Above roughly 4.5 m/s the line becomes noisy and the fittings wear. One size up on this leg brings it back.' });
      else if (l.V < 0.9 && l.V > 0) out.push({ w: 'Leg L' + l.idx, h: 'Velocity low at ' + f2(l.V) + ' m/s',
        why: 'Below about 0.9 m/s solids and any second phase settle out in this leg. Drop one size.' });
      if (l.dz > 0.5) out.push({ w: 'Leg L' + l.idx, h: 'Riser of ' + f2(l.dz) + ' m',
        why: 'This leg lifts, adding ' + f4(l.dpStatPa / 1e5) + ' bar of static head that does not fall away at turndown. It also wants a check valve upstream so the line cannot drain back.' });
      if (l.sumK > 0 && l.dpFitPa > l.dpFricPa) out.push({ w: 'Leg L' + l.idx, h: 'Fittings dominate this leg',
        why: 'ΣK on this leg is ' + f2(l.sumK) + ', worth ' + f4(l.dpFitPa / 1e5) + ' bar against ' + f4(l.dpFricPa / 1e5) + ' bar of pipe friction. Straightening the route or swapping standard elbows for long-radius saves more than a size change.' });
    });

    /* Components actually placed, and what each is doing there. */
    var placed = {};
    DOC.items.forEach(function (it) { placed[it.key] = (placed[it.key] || 0) + 1; });
    Object.keys(placed).forEach(function (k) {
      var c = lib(k);
      var kk = kOf(k, r.legs[0].nps);
      out.push({ w: c.name + ' ×' + placed[k], h: 'K ' + kk + ' at ' + r.legs[0].nps + '" each  ·  ' + f4(placed[k] * kk * 0.5 * num('pid-rho', 998.2) * Math.pow(r.legs[0].V, 2) / 1e5) + ' bar at L1 velocity',
        why: c.note.charAt(0).toUpperCase() + c.note.slice(1) + '.' });
    });

    if (!DOC.items.some(function (i) { return lib(i.key).key === 'gate' || lib(i.key).key === 'ball' || lib(i.key).key === 'butterfly'; }))
      out.push({ w: 'Missing', h: 'No isolation valve on the run',
        why: 'The line cannot be broken for maintenance without draining the system. Add a gate or ball valve at the battery limit.' });
    if (t.dz > 0.5 && !DOC.items.some(function (i) { return /check/.test(i.key); }))
      out.push({ w: 'Missing', h: 'No check valve on a rising line',
        why: 'The route lifts a net ' + f2(t.dz) + ' m. On trip the contents run back into the source vessel — fit a swing check downstream of the pump.' });

    if (!t.dpOk) out.push({ w: 'Hydraulics', h: 'Friction + fittings ΔP ' + f3(t.dpDyn) + ' bar over the ' + f3(t.dpAllow) + ' bar allowance',
      why: 'Friction ' + f4(t.dpFricPa / 1e5) + ' bar plus fittings ' + f4(t.dpFitPa / 1e5) + ' bar is ' + f3(t.dpDyn) + ' bar of flow-dependent loss against the allowance; the further ' + f4(t.dpStatPa / 1e5) + ' bar of static head is fixed by the elevation and no pipe size will change it. ' + (t.dpFitPa > t.dpFricPa ? 'The fittings are the problem, not the pipe.' : 'The pipe is the problem — one size up cuts friction by roughly a factor of three.') });

    if (r.uniform) {
      var same = !r.mixed && r.uniform.nps === DOC.segs[0].nps;
      out.push({ w: 'Line sizing', h: same ? 'Uniform ' + r.uniform.nps + '" throughout is correct'
          : 'One uniform size of ' + r.uniform.nps + '" sch ' + r.uniform.sch + ' would serve the whole drawing',
        why: same ? 'The smallest bore that satisfies velocity, erosion and ΔP across every leg is the one already drawn.'
          : 'At ' + r.uniform.nps + '" the whole run sits at ' + f2(r.uniform.tot.Vmin) + '–' + f2(r.uniform.tot.Vmax) + ' m/s for ' + f3(r.uniform.tot.dp) + ' bar. A single size means one spec, one set of spares and no reducers — worth having unless a leg genuinely needs to differ.' });
    } else {
      out.push({ w: 'Line sizing', h: 'No single size satisfies the whole drawing',
        why: 'Every bore in the ASME B36.10M range fails at least one check at this flow. Split the duty, shorten the route, or revisit the allowable ΔP.' });
    }

    if (t.velOk && t.eroOk && t.dpOk) out.unshift({ w: 'Overall', h: 'The drawn P&ID is hydraulically suitable',
      why: 'Velocities ' + f2(t.Vmin) + '–' + f2(t.Vmax) + ' m/s, total ΔP ' + f3(t.dp) + ' bar against ' + f3(t.dpAllow) + ' bar allowable, and every leg inside the erosional limit of ' + f2(t.Vallow) + ' m/s.' });
    return out;
  }

  /* ─────────── results ─────────── */
  function render() {
    draw();
    var el = $('pid-results'); if (!el) return;
    var r = LASTR = compute();
    if (!r) { el.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:#64748b;padding:8px;">Draw at least one line, then press EVALUATE.</div>'; return; }
    update3D(r);

    var t = r.tot;
    var row = function (k, v, cls) { return '<div class="pid-rr ' + (cls || '') + '"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var h = '<div class="pid-cardh">LINE-BY-LINE HYDRAULICS</div>';
    h += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10px;white-space:nowrap;">'
      + '<tr style="color:#94a3b8;border-bottom:1px solid var(--border-muted);">'
      + ['Leg', 'Size', 'Length', 'Δz', 'Velocity', 'Re', 'ΣK', 'ΔP fric', 'ΔP fit', 'ΔP static', 'ΔP leg', 'Components']
        .map(function (x, i) { return '<th style="text-align:' + (i > 1 && i < 11 ? 'right' : 'left') + ';padding:4px;">' + x + '</th>'; }).join('') + '</tr>';
    r.legs.forEach(function (l) {
      var vcol = l.V > t.Vallow ? '#ef4444' : (l.V > 4.5 || l.V < 0.9) ? '#f59e0b' : '#22c55e';
      h += '<tr style="border-bottom:1px dashed var(--border-muted);color:#e2e8f0;">'
        + '<td style="padding:4px;">L' + l.idx + '</td>'
        + '<td style="padding:4px;">' + l.nps + '" S' + l.sch + '</td>'
        + '<td style="padding:4px;text-align:right;">' + f2(l.L) + ' m</td>'
        + '<td style="padding:4px;text-align:right;">' + f2(l.dz) + ' m</td>'
        + '<td style="padding:4px;text-align:right;color:' + vcol + ';font-weight:700;">' + f2(l.V) + ' m/s</td>'
        + '<td style="padding:4px;text-align:right;">' + Math.round(l.Re).toLocaleString() + '</td>'
        + '<td style="padding:4px;text-align:right;">' + f2(l.sumK) + '</td>'
        + '<td style="padding:4px;text-align:right;">' + f4(l.dpFricPa / 1e5) + '</td>'
        + '<td style="padding:4px;text-align:right;">' + f4(l.dpFitPa / 1e5) + '</td>'
        + '<td style="padding:4px;text-align:right;">' + f4(l.dpStatPa / 1e5) + '</td>'
        + '<td style="padding:4px;text-align:right;font-weight:700;">' + f4(l.dpPa / 1e5) + ' bar</td>'
        + '<td style="padding:4px;color:#94a3b8;">' + (l.items.length ? l.items.map(function (i) { return esc(lib(i.key).name); }).join(', ') : '—') + '</td></tr>';
    });
    h += '</table></div>';

    h += '<div class="pid-cardh">TOTALS</div>';
    h += row('Developed length', f2(t.L) + ' m');
    h += row('Net static height Δz', f2(t.dz) + ' m');
    h += row('Velocity range', f2(t.Vmin) + ' – ' + f2(t.Vmax) + ' m/s', t.velOk ? 'ok' : 'warn');
    h += row('Erosional velocity (API 14E)', f2(t.Ve) + ' m/s  ·  allowable ' + f2(t.Vallow), t.eroOk ? 'ok' : 'warn');
    h += row('Friction + fittings ΔP', f3(t.dpDyn) + ' bar', t.dpOk ? 'ok' : 'warn');
    h += row('Static head ΔP (elevation)', f4(t.dpStatPa / 1e5) + ' bar');
    h += row('Total ΔP', f3(t.dp) + ' bar');
    h += row('Allowable ΔP (auto, friction basis)', f3(t.dpAllow) + ' bar');
    h += row('Components placed', String(DOC.items.length) + '  ·  ΣK ' + f2(t.sumK));

    if (r.uniform) {
      h += '<div class="pid-cardh">UNIFORM SIZE OPTION</div>';
      h += row('Smallest size serving every leg', r.uniform.nps + '" sch ' + r.uniform.sch);
      h += row('Velocity / ΔP at that size', f2(r.uniform.tot.Vmin) + ' – ' + f2(r.uniform.tot.Vmax) + ' m/s  ·  ' + f3(r.uniform.tot.dp) + ' bar');
      h += '<button id="pid-uniform" style="width:100%;margin-top:6px;background:transparent;border:1px solid #22c55e;color:#22c55e;font-family:var(--font-mono);font-size:10px;font-weight:800;padding:8px;border-radius:4px;cursor:pointer;">APPLY ' + r.uniform.nps + '" SCH ' + r.uniform.sch + ' TO THE WHOLE DRAWING</button>';
    }

    h += '<div class="pid-cardh">REVIEW — WHAT, WHERE AND WHY</div>';
    advise(r).forEach(function (a) {
      var good = /suitable|correct/.test(a.h);
      h += '<div style="border:1px solid var(--border-muted);border-left:3px solid ' + (good ? '#22c55e' : '#f59e0b') + ';border-radius:4px;padding:7px 9px;margin:6px 0;background:' + (good ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.05)') + ';">'
        + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:' + (good ? '#22c55e' : '#f59e0b') + ';">' + esc(a.w) + ' — ' + esc(a.h) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#cbd5e1;line-height:1.55;margin-top:3px;">' + esc(a.why) + '</div></div>';
    });
    el.innerHTML = h;

    var ub = $('pid-uniform');
    if (ub) ub.addEventListener('click', function () {
      DOC.segs.forEach(function (s) { s.nps = r.uniform.nps; s.sch = r.uniform.sch; });
      render();
    });
    syncSelPanel(); refreshPaletteK();
  }

  /* ─────────── selection panel ─────────── */
  function syncSelPanel() {
    var box = $('pid-selbox'); if (!box) return;
    if (!SEL) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    if (SEL.kind === 'seg') {
      var s = segById(SEL.id);
      if (!s) { SEL = null; box.style.display = 'none'; return; }
      $('pid-sel-title').textContent = 'LINE L' + (DOC.segs.indexOf(s) + 1) + ' SELECTED';
      $('pid-selsize').style.display = 'block';
      $('pid-seltag').style.display = 'none';
      $('pid-sel-nps').value = s.nps; $('pid-sel-sch').value = s.sch; $('pid-sel-col').value = s.colour;
    } else {
      var it = DOC.items.filter(function (i) { return i.id === SEL.id; })[0];
      if (!it) { SEL = null; box.style.display = 'none'; return; }
      var sg0 = segById(it.segId);
      $('pid-sel-title').textContent = lib(it.key).name.toUpperCase() + '  ·  K ' + kOf(it.key, sg0 ? sg0.nps : 2) + (lib(it.key).ki != null ? '  (at ' + (sg0 ? sg0.nps : 2) + '\u2033)' : '  (fixed)');
      $('pid-selsize').style.display = 'none';
      $('pid-seltag').style.display = 'block';
      $('pid-sel-tag').value = it.tag;
    }
  }

  /* ─────────── palette ─────────── */
  function paletteHTML() {
    var valves = LIB.filter(function (c) { return /valve/i.test(c.name); });
    var fits = LIB.filter(function (c) { return !/valve/i.test(c.name); });
    function grp(title, list) {
      return '<div style="font-family:var(--font-mono);font-size:9px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin:8px 0 4px;">' + title + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">'
        + list.map(function (c) {
          return '<button class="pid-lib" data-key="' + c.key + '" title="' + esc(c.name) + ' — K ' + c.k + '">'
            + '<img class="pid-ico3" data-key="' + c.key + '" alt=""/>'
            + '<canvas class="pid-ico" data-key="' + c.key + '" width="52" height="34"></canvas>'
            + '<span style="display:block;color:' + c.colour + ';">' + esc(c.name.replace(/ valve$/i, '')) + '</span>'
            + '<span class="pid-k" data-key="' + c.key + '" style="display:block;color:#64748b;font-size:8px;">K ' + c.k + '</span></button>';
        }).join('') + '</div>';
    }
    return '<div id="pid-palette">' + grp('VALVES', valves) + grp('FITTINGS &amp; IN-LINE ITEMS', fits) + '</div>';
  }

  /* Each palette tile draws its own symbol, so the button and the drawing
     always show the same thing. */
  /* Tile K labels track the default bore, so the palette shows the number
     that will actually be used when the component is dropped. */
  function refreshPaletteK() {
    var n = defNps();
    [].slice.call(document.querySelectorAll('.pid-k')).forEach(function (el) {
      var key = el.getAttribute('data-key');
      el.textContent = 'K ' + kOf(key, n) + (lib(key).ki != null ? ' @' + n + '\u2033' : '');
    });
  }

  function paintPalette() {
    /* 3D thumbnail first; the flat ISA glyph stays as the fallback and is
       hidden whenever the render succeeds. */
    [].slice.call(document.querySelectorAll('.pid-ico3')).forEach(function (img) {
      var url = icon3DImage(img.getAttribute('data-key'));
      if (url) { img.src = url; var sib = img.parentNode.querySelector('.pid-ico'); if (sib) sib.style.display = 'none'; }
      else img.style.display = 'none';
    });
    [].slice.call(document.querySelectorAll('.pid-ico')).forEach(function (cv) {
      var c = lib(cv.getAttribute('data-key')), x = cv.getContext('2d');
      x.clearRect(0, 0, cv.width, cv.height);
      x.save(); x.translate(cv.width / 2, cv.height / 2); x.scale(0.85, 0.85);
      x.strokeStyle = '#475569'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(-cv.width / 2, 0); x.lineTo(cv.width / 2, 0); x.stroke();
      x.restore();
      symbol(x, cv.width / 2, cv.height / 2, 0, c, false);
    });
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
    h += '<div class="panel panel-input" style="max-height:calc(100vh - 200px);overflow-y:auto;overflow-x:hidden;">'
      + '<div class="panel-header"><span class="panel-title">P&amp;ID WORKBENCH — DRAW, PLACE, EVALUATE</span></div><div class="panel-body">';

    h += hdr('1 · LINE IDENTIFICATION');
    h += txtf('LINE No.', 'pid-lineno', '');
    h += two(txtf('FROM', 'pid-from', ''), txtf('TO', 'pid-to', ''));

    h += hdr('2 · DRAWING TOOLS');
    h += '<div style="display:flex;gap:4px;flex-wrap:wrap;">'
      + '<button class="pid-tool" data-tool="line" style="flex:1;">✏ LINE</button>'
      + '<button class="pid-tool" data-tool="select" style="flex:1;">✥ SELECT / DRAG</button>'
      + '<button class="pid-tool" data-tool="delete" style="flex:1;">✕ DELETE</button></div>';
    h += '<div style="display:flex;gap:4px;margin-top:5px;">'
      + '<button id="pid-finish" class="pid-act" style="flex:1;">⏹ FINISH RUN</button>'
      + '<button id="pid-ortho" class="pid-act" style="flex:1;">⊾ SQUARE ROUTING: ON</button></div>';
    h += '<div style="display:flex;gap:4px;margin-top:5px;">'
      + '<button id="pid-undo" class="pid-act" style="flex:1;">↩ UNDO</button>'
      + '<button id="pid-clear" class="pid-act pid-red" style="flex:1;">↺ CLEAR ALL</button></div>';
    h += fld('Scale', 'pid-scale', 'm per pixel', 0.05, '0.01');
    h += '<div id="pid-hint" style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;line-height:1.5;margin-top:6px;"></div>';

    h += hdr('3 · COMPONENT LIBRARY');
    h += '<div style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;margin-bottom:4px;">Pick a component, then click on a line to drop it there. In SELECT mode drag it along the line.</div>';
    h += paletteHTML();

    h += '<div id="pid-selbox" style="display:none;margin-top:10px;border:1px solid var(--color-saffron);border-radius:5px;padding:8px;background:rgba(255,117,56,0.06);">'
      + '<div id="pid-sel-title" style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);margin-bottom:5px;"></div>'
      + '<div id="pid-seltag" style="display:none;">'
      + txtf('TAG NUMBER', 'pid-sel-tag', '')
      + '</div>'
      + '<div id="pid-selsize">'
      + two(sel('NPS', 'pid-sel-nps', Object.keys(PIPE), '2'), sel('SCHEDULE', 'pid-sel-sch', SCHEDULES, '40'))
      + '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">LINE COLOUR'
      + '<input id="pid-sel-col" type="color" value="#38bdf8" style="width:100%;height:26px;margin-top:2px;background:transparent;border:1px solid var(--border-muted);border-radius:3px;cursor:pointer;"/></label>'
      + '<div id="pid-swatches" style="display:flex;gap:4px;margin:4px 0;">'
      + ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#e2e8f0', '#64748b']
          .map(function (col) { return '<button class="pid-sw" data-col="' + col + '" title="' + col + '" style="flex:1;height:20px;border:1px solid var(--border-muted);border-radius:3px;cursor:pointer;background:' + col + ';"></button>'; }).join('')
      + '</div>'
      + '<button id="pid-colall" class="pid-act" style="width:100%;margin-top:2px;">APPLY THIS COLOUR TO EVERY LINE</button>'
      + '</div>'
      + '<button id="pid-sel-del" class="pid-act pid-red" style="width:100%;margin-top:6px;">✕ DELETE SELECTED</button></div>';

    h += hdr('4 · PROCESS DATA');
    h += two(fld('Mass flow', 'pid-flow', 'kg/hr', 20000, '10'), fld('Density', 'pid-rho', 'kg/m³', 998.2, '0.1'));
    h += two(fld('Viscosity', 'pid-mu', 'cP', 1.002, '0.001'), fld('Upstream pressure', 'pid-pup', 'bar(G)', 6, '0.1'));

    h += hdr('5 · DEFAULT LINE SPECIFICATION');
    h += two(sel('NPS', 'pid-nps', Object.keys(PIPE), '2'), sel('SCHEDULE', 'pid-sch', SCHEDULES, '40'));
    h += sel('MATERIAL', 'pid-mat', Object.keys(ROUGH), 'CS');
    h += fld('C factor (API 14E)', 'pid-cfactor', '', 100, '1');
    h += '<button id="pid-applyall" class="pid-act" style="width:100%;margin-top:6px;">APPLY THIS SIZE TO EVERY LINE</button>';

    h += '<button id="pid-eval" style="width:100%;margin-top:12px;background:linear-gradient(135deg,#16a34a,#22c55e);border:none;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:800;letter-spacing:0.06em;padding:11px;border-radius:5px;cursor:pointer;">▶ EVALUATE P&amp;ID</button>';
    h += '<button id="pid-report" class="pid-act" style="width:100%;margin-top:8px;">📄 P&amp;ID HYDRAULICS REPORT</button>';
    h += css();
    h += '</div></div>';

    h += '<div class="panel" style="max-height:calc(100vh - 200px);overflow-y:auto;">'
      + '<div class="panel-header"><span class="panel-title">DRAWN P&amp;ID, 3D MODEL &amp; EVALUATION</span></div><div class="panel-body">'
      + '<canvas id="pid-canvas" width="980" height="420" style="width:100%;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;cursor:crosshair;display:block;"></canvas>'
      + '<div style="font-family:var(--font-mono);font-size:9.5px;color:#94a3b8;text-align:center;margin:8px 0 3px;">3D MODEL OF THE DRAWN LINE — BORE, LENGTH AND COMPONENTS FOLLOW THE SKETCH · DRAG TO ROTATE · SCROLL TO ZOOM</div>'
      + '<canvas id="pid-3d" style="width:100%;height:300px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;display:block;cursor:grab;"></canvas>'
      + '<div id="pid-results" style="margin-top:12px;"></div>'
      + '</div></div>';
    return h + '</div>';
  }

  function css() {
    return '<style>'
      + '.pid-act{background:transparent;border:1px solid var(--color-saffron);color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:700;padding:7px;border-radius:4px;cursor:pointer;}'
      + '.pid-act:hover{background:rgba(255,117,56,0.12);}'
      + '.pid-red{border-color:#ef4444;color:#ef4444;}'
      + '.pid-tool{background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#94a3b8;font-family:var(--font-mono);font-size:10px;font-weight:700;padding:7px 4px;border-radius:4px;cursor:pointer;}'
      + '.pid-tool.on{border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,0.10);}'
      + '.pid-lib{background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);border-radius:4px;padding:4px 2px;cursor:pointer;font-family:var(--font-mono);font-size:8.5px;font-weight:700;line-height:1.25;text-align:center;}'
      + '.pid-lib:hover{border-color:var(--color-saffron);}'
      + '.pid-lib.on{border-color:#22c55e !important;background:rgba(34,197,94,0.12) !important;}'
      + '.pid-ico{display:block;margin:0 auto 2px;}'
      + '.pid-ico3{display:block;margin:0 auto 1px;width:52px;height:36px;object-fit:contain;}'
      + '.pid-rr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border-muted);font-family:var(--font-mono);font-size:11px;}'
      + '.pid-rr span{color:var(--text-muted);}.pid-rr b{color:#e2e8f0;}.pid-rr.ok b{color:#22c55e;}.pid-rr.warn b{color:#ef4444;}'
      + '.pid-cardh{font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin:12px 0 4px;}'
      + '</style>';
  }

  /* ─────────── report ─────────── */
  function report() {
    var r = LASTR || compute();
    if (!r) { alert('Draw a line first.'); return; }
    var t = r.tot;
    var sec = function (x) { return '<div style="font-size:13px;font-weight:800;color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:3px;margin:16px 0 8px;">' + x + '</div>'; };
    var T = function (rows) {
      return '<table style="width:100%;border-collapse:collapse;font-size:11px;">' + rows.map(function (x) {
        return '<tr><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#374151;width:55%;">' + x[0] + '</td><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;">' + x[1] + '</td></tr>';
      }).join('') + '</table>';
    };
    var pid = CV ? CV.toDataURL('image/png') : '';
    var d3 = (three && three.rn) ? three.rn.domElement.toDataURL('image/png') : '';

    var h = '<div style="font-family:Arial,sans-serif;color:#111827;">'
      + '<h2 style="text-align:center;color:#ea580c;margin:0;">BHARAT FLOWSIZE — P&amp;ID LINE HYDRAULICS REPORT</h2>'
      + '<div style="text-align:center;font-size:10px;color:#6b7280;">AROGARA TECHNOLOGIES | DIGITAL INDIA INITIATIVE</div>'
      + sec('1 · LINE IDENTIFICATION')
      + T([['Line No.', esc(val('pid-lineno', '—'))], ['From', esc(val('pid-from', '—'))], ['To', esc(val('pid-to', '—'))],
           ['Material', esc(val('pid-mat', 'CS'))], ['Drawing scale', f3(num('pid-scale', 0.05)) + ' m per pixel'],
           ['Date', new Date().toISOString().slice(0, 10)]])
      + sec('2 · P&amp;ID AS DRAWN')
      + (pid ? '<div style="text-align:center;margin:8px 0;"><img src="' + pid + '" style="max-width:100%;border:1px solid #d1d5db;"/></div>' : '')
      + (d3 ? sec('3 · 3D MODEL') + '<div style="text-align:center;margin:8px 0;"><img src="' + d3 + '" style="max-width:100%;border:1px solid #d1d5db;"/></div>' : '')
      + sec('4 · LINE-BY-LINE HYDRAULICS')
      + '<table style="width:100%;border-collapse:collapse;font-size:10px;"><tr style="background:#f3f4f6;">'
      + ['Leg', 'Size', 'Length m', 'Δz m', 'V m/s', 'Re', 'ΣK', 'ΔP fric bar', 'ΔP fit bar', 'ΔP static bar', 'ΔP leg bar', 'Components']
        .map(function (x) { return '<th style="padding:4px;text-align:left;">' + x + '</th>'; }).join('') + '</tr>'
      + r.legs.map(function (l) {
          return '<tr>' + ['L' + l.idx, l.nps + '" S' + l.sch, f2(l.L), f2(l.dz), f2(l.V), Math.round(l.Re).toLocaleString(),
            f2(l.sumK), f4(l.dpFricPa / 1e5), f4(l.dpFitPa / 1e5), f4(l.dpStatPa / 1e5), f4(l.dpPa / 1e5),
            (l.items.length ? l.items.map(function (i) { return esc(i.tag + ' ' + lib(i.key).name); }).join(', ') : '—')]
            .map(function (c) { return '<td style="padding:4px;border-bottom:1px solid #e5e7eb;">' + c + '</td>'; }).join('') + '</tr>';
        }).join('') + '</table>'
      + sec('5 · TOTALS AND VERDICT')
      + T([['Developed length', f2(t.L) + ' m'], ['Net static height Δz', f2(t.dz) + ' m'],
           ['Velocity range', f2(t.Vmin) + ' – ' + f2(t.Vmax) + ' m/s'],
           ['Erosional velocity Ve', f2(t.Ve) + ' m/s'], ['Allowable velocity (75 % Ve)', f2(t.Vallow) + ' m/s'],
           ['Friction ΔP', f4(t.dpFricPa / 1e5) + ' bar'], ['Fittings ΔP', f4(t.dpFitPa / 1e5) + ' bar'],
           ['Static ΔP', f4(t.dpStatPa / 1e5) + ' bar'],
           ['Friction + fittings ΔP', f3(t.dpDyn) + ' bar'], ['Total ΔP', f3(t.dp) + ' bar'],
           ['Allowable ΔP (friction basis)', f3(t.dpAllow) + ' bar'],
           ['Velocity check', t.velOk ? 'PASS' : 'REVIEW'], ['Erosional check', t.eroOk ? 'PASS' : 'REVIEW'],
           ['Pressure drop check', t.dpOk ? 'PASS' : 'REVIEW'],
           ['Uniform size option', r.uniform ? r.uniform.nps + '" sch ' + r.uniform.sch : 'none satisfies every check']])
      + sec('6 · COMPONENT SCHEDULE')
      + '<table style="width:100%;border-collapse:collapse;font-size:11px;"><tr style="background:#f3f4f6;"><th style="padding:4px;text-align:left;">Component</th><th style="padding:4px;text-align:left;">Leg</th><th style="padding:4px;text-align:right;">K</th></tr>'
      + DOC.items.map(function (it) {
          var c = lib(it.key), s = segById(it.segId);
          return '<tr><td style="padding:4px;border-bottom:1px solid #e5e7eb;">' + esc(it.tag) + ' — ' + esc(c.name) + '</td><td style="padding:4px;border-bottom:1px solid #e5e7eb;">L' + (DOC.segs.indexOf(s) + 1) + ' (' + (s ? s.nps : '—') + '")</td><td style="padding:4px;border-bottom:1px solid #e5e7eb;text-align:right;">' + kOf(it.key, s ? s.nps : 2) + '</td></tr>';
        }).join('')
      + '<tr><td style="padding:4px;font-weight:700;">Total ΣK</td><td></td><td style="padding:4px;text-align:right;font-weight:700;">' + f2(t.sumK) + '</td></tr></table>'
      + sec('7 · REVIEW')
      + advise(r).map(function (a) {
          return '<div style="margin:6px 0;padding:6px 8px;border-left:3px solid #ea580c;background:#fff7ed;">'
            + '<b style="font-size:11px;">' + esc(a.w) + ' — ' + esc(a.h) + '</b>'
            + '<div style="font-size:10.5px;color:#374151;margin-top:2px;line-height:1.5;">' + esc(a.why) + '</div></div>';
        }).join('')
      + '<div style="margin-top:14px;font-size:9px;color:#6b7280;">Darcy–Weisbach friction with Colebrook f, Crane TP-410 K values, ASME B36.10M bores, API RP 14E erosional velocity, ISA S5.1 symbols. Route geometry taken from the sketch at the stated scale — confirm against the issued P&amp;ID before construction.</div>'
      + '</div>';
    modal('P&ID LINE HYDRAULICS REPORT', h);
  }

  function modal(title, inner) {
    var old = $('pid-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'pid-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(2,6,18,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;max-width:1000px;width:100%;max-height:92vh;display:flex;flex-direction:column;">'
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

  /* ─────────── interaction ─────────── */
  function setTool(t) {
    TOOL = t; ARMED = null;
    [].slice.call(document.querySelectorAll('.pid-tool')).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === t); });
    [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (b) { b.classList.remove('on'); });
    var hint = $('pid-hint');
    if (hint) hint.textContent = t === 'line' ? 'Click to start the run, then click at every change of direction. Each click closes a leg and opens the next.'
      : t === 'select' ? 'Click a line or component to select it. Drag an endpoint to move the route, or drag a component along its line.'
      : 'Click a line or component to remove it.';
    if (CV) CV.style.cursor = t === 'delete' ? 'not-allowed' : t === 'select' ? 'default' : 'crosshair';
  }

  function xy(e) {
    var b = CV.getBoundingClientRect();
    return { x: (e.clientX - b.left) * (CV.width / b.width), y: (e.clientY - b.top) * (CV.height / b.height) };
  }

  function onDown(e) {
    var p = xy(e);
    /* Dragging should just work. If the pointer goes down on something that
       already exists while the LINE tool is active and no run is open, switch
       to SELECT for the user rather than starting a stray leg. */
    if (TOOL === 'line' && !RUNNING && !ARMED && (hitItem(p.x, p.y) || hitEnd(p.x, p.y) || hitSeg(p.x, p.y, 12))) setTool('select');
    if (ARMED) {                                    // dropping a component
      var hit = hitSeg(p.x, p.y, 22);
      if (hit) { addItem(ARMED, hit.seg.id, hit.t); ARMED = null;
        [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (b) { b.classList.remove('on'); });
        render(); }
      return;
    }
    if (TOOL === 'line') {
      var q = snap(p);
      var from = lastEnd();
      if (!RUNNING || !from) { addSeg(q.x, q.y, q.x, q.y); RUNNING = true; }
      else {
        q = snap(ortho(from, p));
        if (q.x === from.x && q.y === from.y) return;      // ignore a repeat click
        var last = DOC.segs[DOC.segs.length - 1];
        if (last.x1 === last.x2 && last.y1 === last.y2) { last.x2 = q.x; last.y2 = q.y; }
        else addSeg(from.x, from.y, q.x, q.y);
      }
      GHOST = null; render(); return;
    }
    if (TOOL === 'delete') {
      var it = hitItem(p.x, p.y);
      if (it) { DOC.items = DOC.items.filter(function (i) { return i !== it; }); SEL = null; render(); return; }
      var hs = hitSeg(p.x, p.y, 12);
      if (hs) { DOC.items = DOC.items.filter(function (i) { return i.segId !== hs.seg.id; });
                DOC.segs = DOC.segs.filter(function (s) { return s !== hs.seg; }); SEL = null; render(); }
      return;
    }
    // select
    var it2 = hitItem(p.x, p.y);
    if (it2) { SEL = { kind: 'item', id: it2.id }; DRAG = { kind: 'item', it: it2 }; syncSelPanel(); draw(); return; }
    var he = hitEnd(p.x, p.y);
    if (he) { SEL = { kind: 'seg', id: he.seg.id }; DRAG = { kind: 'end', seg: he.seg, end: he.end }; syncSelPanel(); draw(); return; }
    var hs2 = hitSeg(p.x, p.y, 12);
    if (hs2) { SEL = { kind: 'seg', id: hs2.seg.id };
               DRAG = { kind: 'seg', seg: hs2.seg, dx: p.x - hs2.seg.x1, dy: p.y - hs2.seg.y1 };
               syncSelPanel(); draw(); return; }
    SEL = null; syncSelPanel(); draw();
  }

  function onMove(e) {
    var p = xy(e);
    if (!DRAG) {
      if (TOOL === 'line' && RUNNING) {
        var from = lastEnd();
        GHOST = from ? snap(ortho(from, p)) : null;
        draw();
      }
      return;
    }
    if (DRAG.kind === 'end') {
      p = snap(p);
      var s = DRAG.seg;
      var oldX = DRAG.end === 1 ? s.x1 : s.x2, oldY = DRAG.end === 1 ? s.y1 : s.y2;
      if (DRAG.end === 1) { s.x1 = p.x; s.y1 = p.y; } else { s.x2 = p.x; s.y2 = p.y; }
      // keep the run connected
      DOC.segs.forEach(function (o) {
        if (o === s) return;
        if (Math.abs(o.x1 - oldX) < 0.5 && Math.abs(o.y1 - oldY) < 0.5) { o.x1 = p.x; o.y1 = p.y; }
        if (Math.abs(o.x2 - oldX) < 0.5 && Math.abs(o.y2 - oldY) < 0.5) { o.x2 = p.x; o.y2 = p.y; }
      });
    } else if (DRAG.kind === 'seg') {
      var g = snap({ x: p.x - DRAG.dx, y: p.y - DRAG.dy });
      var s0 = DRAG.seg, ox = s0.x1, oy = s0.y1, ox2 = s0.x2, oy2 = s0.y2;
      var w = s0.x2 - s0.x1, hh = s0.y2 - s0.y1;
      s0.x1 = g.x; s0.y1 = g.y; s0.x2 = g.x + w; s0.y2 = g.y + hh;
      DOC.segs.forEach(function (o) {                       // keep neighbours attached
        if (o === s0) return;
        if (Math.abs(o.x2 - ox) < 0.5 && Math.abs(o.y2 - oy) < 0.5) { o.x2 = s0.x1; o.y2 = s0.y1; }
        if (Math.abs(o.x1 - ox2) < 0.5 && Math.abs(o.y1 - oy2) < 0.5) { o.x1 = s0.x2; o.y1 = s0.y2; }
      });
    } else if (DRAG.kind === 'item') {
      var hit = hitSeg(p.x, p.y, 60);
      if (hit) { DRAG.it.segId = hit.seg.id; DRAG.it.t = hit.t; }
    }
    draw();
  }
  function onUp() { if (DRAG) { DRAG = null; render(); } }

  function wire() {
    CV = $('pid-canvas'); CTX = CV.getContext('2d');
    CV.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    [].slice.call(document.querySelectorAll('.pid-tool')).forEach(function (b) {
      b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
    });
    [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-key');
        ARMED = (ARMED === k) ? null : k;
        [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (o) { o.classList.toggle('on', o === b && ARMED); });
        if (ARMED && CV) CV.style.cursor = 'copy';
      });
    });

    $('pid-undo').addEventListener('click', function () {
      if (DOC.items.length && DOC.segs.length && DOC.items[DOC.items.length - 1].id > DOC.segs[DOC.segs.length - 1].id) DOC.items.pop();
      else { var s = DOC.segs.pop(); if (s) DOC.items = DOC.items.filter(function (i) { return i.segId !== s.id; }); }
      SEL = null; render();
    });
    $('pid-clear').addEventListener('click', function () { DOC.segs = []; DOC.items = []; SEL = null; LASTR = null; RUNNING = false; GHOST = null; render(); });
    $('pid-finish').addEventListener('click', function () {
      // drop a zero-length leg left open by the last click, then close the run
      var l = DOC.segs[DOC.segs.length - 1];
      if (l && l.x1 === l.x2 && l.y1 === l.y2) DOC.segs.pop();
      RUNNING = false; GHOST = null; render();
    });
    $('pid-ortho').addEventListener('click', function () {
      ORTHO = !ORTHO;
      $('pid-ortho').textContent = '⊾ SQUARE ROUTING: ' + (ORTHO ? 'ON' : 'OFF');
    });
    [].slice.call(document.querySelectorAll('.pid-sw')).forEach(function (b) {
      b.addEventListener('click', function () {
        var col = b.getAttribute('data-col');
        $('pid-sel-col').value = col;
        if (SEL && SEL.kind === 'seg') { var sg = segById(SEL.id); if (sg) sg.colour = col; }
        render();
      });
    });
    $('pid-colall').addEventListener('click', function () {
      var col = val('pid-sel-col', '#38bdf8');
      DOC.segs.forEach(function (sg) { sg.colour = col; });
      render();
    });
    $('pid-sel-tag').addEventListener('input', function () {
      if (!SEL || SEL.kind !== 'item') return;
      var it = DOC.items.filter(function (i) { return i.id === SEL.id; })[0];
      if (it) { it.tag = $('pid-sel-tag').value; draw(); }
    });
    $('pid-eval').addEventListener('click', render);
    $('pid-report').addEventListener('click', report);
    $('pid-applyall').addEventListener('click', function () {
      DOC.segs.forEach(function (s) { s.nps = defNps(); s.sch = defSch(); }); render();
    });
    ['pid-nps', 'pid-sch'].forEach(function (id) {
      var e = $(id); if (e) e.addEventListener('change', refreshPaletteK);
    });
    $('pid-sel-del').addEventListener('click', function () {
      if (!SEL) return;
      if (SEL.kind === 'item') DOC.items = DOC.items.filter(function (i) { return i.id !== SEL.id; });
      else { DOC.items = DOC.items.filter(function (i) { return i.segId !== SEL.id; });
             DOC.segs = DOC.segs.filter(function (s) { return s.id !== SEL.id; }); }
      SEL = null; render();
    });
    ['pid-sel-nps', 'pid-sel-sch', 'pid-sel-col'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (!SEL || SEL.kind !== 'seg') return;
        var s = segById(SEL.id); if (!s) return;
        s.nps = parseFloat(val('pid-sel-nps', '2')); s.sch = val('pid-sel-sch', '40'); s.colour = val('pid-sel-col', '#38bdf8');
        render();
      });
    });
    ['pid-scale', 'pid-flow', 'pid-rho', 'pid-mu', 'pid-pup', 'pid-mat', 'pid-cfactor', 'pid-from', 'pid-to']
      .forEach(function (id) { var e = $(id); if (e) { e.addEventListener('change', render); e.addEventListener('input', render); } });

    setTool('line');
    paintPalette(); refreshPaletteK();
    init3D();
    setTimeout(function () { resize3D(); render(); }, 80);
    window.addEventListener('resize', resize3D);
  }

  function build(hostId) {
    if (built) return;
    var host = document.getElementById(hostId || 'line-pid-content'); if (!host) return;
    host.innerHTML = panelHTML();
    built = true;
    wire();
  }

  window.AROPID = {
    build: build, compute: compute, report: report, render: render,
    doc: DOC, lib: LIB, setTool: setTool, kOf: kOf, kBand: kBand,
    addSeg: addSeg, addItem: addItem,
    clear: function () { DOC.segs = []; DOC.items = []; SEL = null; }
  };
})();

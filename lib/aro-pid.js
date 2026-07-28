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
  /* Canvas view: world → screen is  s = w*k + o.  Every hit test converts the
     pointer back to world space, so zooming never breaks picking. */
  var VIEW = { k: 1, ox: 0, oy: 0 }, PAN = null;
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
  /* Everything that is not about the drawing itself comes from the shared
     two-phase input column, so nothing is asked for twice. */
  function shared(id, d) { var e = document.getElementById(id); if (!e) return d; var v = parseFloat(e.value); return isFinite(v) ? v : d; }
  function sharedS(id, d) { var e = document.getElementById(id); return e ? (e.value || d) : d; }
  function defNps() { return parseFloat(sharedS('tp2-nps', '3')); }
  function defSch() { return sharedS('tp2-sch', '40'); }

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
    var best = null, bd = (tol == null ? 14 : tol) / VIEW.k;
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
      if (Math.hypot(x - p.x, y - p.y) < 13 / VIEW.k) return DOC.items[i];
    }
    return null;
  }
  function hitEnd(x, y) {
    for (var i = 0; i < DOC.segs.length; i++) {
      var s = DOC.segs[i];
      if (Math.hypot(x - s.x1, y - s.y1) < 10 / VIEW.k) return { seg: s, end: 1 };
      if (Math.hypot(x - s.x2, y - s.y2) < 10 / VIEW.k) return { seg: s, end: 2 };
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

  /* With SQUARE ROUTING on, every leg must stay purely horizontal or purely
     vertical. Dragging an endpoint or typing a length used to leave diagonal
     legs behind, so the run is re-squared after any geometry edit: each leg
     is forced onto its dominant axis and the next leg is reconnected to it. */
  function squareUp() {
    if (!ORTHO || !DOC.segs.length) return;
    for (var i = 0; i < DOC.segs.length; i++) {
      var s = DOC.segs[i];
      if (i > 0) { var prev = DOC.segs[i - 1]; s.x1 = prev.x2; s.y1 = prev.y2; }
      var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      if (Math.abs(dx) >= Math.abs(dy)) s.y2 = s.y1; else s.x2 = s.x1;
      s.x1 = Math.round(s.x1 / SNAP) * SNAP; s.y1 = Math.round(s.y1 / SNAP) * SNAP;
      s.x2 = Math.round(s.x2 / SNAP) * SNAP; s.y2 = Math.round(s.y2 / SNAP) * SNAP;
    }
    /* A leg squared down to nothing is a click artefact, not a pipe. */
    DOC.segs = DOC.segs.filter(function (s, i) {
      var zero = s.x1 === s.x2 && s.y1 === s.y2;
      if (zero) DOC.items = DOC.items.filter(function (it) { return it.segId !== s.id; });
      return !zero;
    });
  }

  /* Every change of direction needs a fitting whether or not the engineer
     remembers to drop one. The corner is measured and the matching elbow is
     assumed - 90 degrees, 45 degrees or a mitre - unless a component has
     already been placed on that joint, in which case the user's choice wins.
     Assumed elbows are drawn dimmed and tagged AUTO, and they count towards
     sum-K, section 6 and the schedules exactly like a placed one. */
  var AUTOEL = true, AUTO = [];

  function autoElbows() {
    AUTO = [];
    if (!AUTOEL || DOC.segs.length < 2) return AUTO;
    for (var i = 1; i < DOC.segs.length; i++) {
      var a = DOC.segs[i - 1], b = DOC.segs[i];
      // only a genuine joint: the legs must actually meet
      if (Math.abs(a.x2 - b.x1) > 1 || Math.abs(a.y2 - b.y1) > 1) continue;
      var a1 = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), a2 = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
      var deg = Math.abs(((a2 - a1) * 180 / Math.PI + 540) % 360 - 180);
      if (deg < 5) continue;                            // straight through
      // a user component sitting on the joint takes precedence
      var taken = DOC.items.some(function (it) {
        if (it.segId === a.id && it.t > 0.88) return true;
        if (it.segId === b.id && it.t < 0.12) return true;
        return false;
      });
      if (taken) continue;
      var key = deg > 67 ? 'e90' : deg > 37 ? 'e45' : 'm30';
      AUTO.push({ id: -i, key: key, segId: a.id, t: 1, auto: true, deg: deg,
                  tag: (key === 'e45' ? 'EL45' : key === 'm30' ? 'MB' : 'EL') + '-A' + i });
    }
    return AUTO;
  }
  function allItems() { return DOC.items.concat(AUTO); }

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
    var eps = ROUGH[sharedS('tp2-mat', 'CS')] !== undefined ? ROUGH[sharedS('tp2-mat', 'CS')] : 0.045;
    /* Mixture properties from the two-phase panel — the drawing is the same
       line, so it must see the same fluid. */
    var rhoL = shared('tp2-rhol', 998.2), rhoG = shared('tp2-rhog', 1.204);
    var muL = shared('tp2-mul', 1.002), muG = shared('tp2-mug', 0.0181);
    var Wl = shared('tp2-wl', 20000), Wg = shared('tp2-wg', 60);
    var xq = (Wl + Wg) > 0 ? Wg / (Wl + Wg) : 0;
    var rho = 1 / ((xq / rhoG) + ((1 - xq) / rhoL));
    var mu = (xq * muL) + ((1 - xq) * muG);
    var W = Wl + Wg;
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

      var horiz = Math.abs(s.x2 - s.x1) >= Math.abs(s.y2 - s.y1);
      var mine = allItems().filter(function (it) { return it.segId === s.id; });
      var sumK = mine.reduce(function (a, it) { return a + kOf(it.key, nps); }, 0);

      var dpFric = (f * L * rho * V * V) / (b.D * 2);
      var dpFit = 0.5 * sumK * rho * V * V;
      var dpStat = rho * 9.81 * dz;

      return { seg: s, idx: i + 1, horiz: horiz, rho: rho, nps: nps, sch: sch, Dmm: b.Dmm, D: b.D, L: L, dz: dz,
               V: V, Re: Re, f: f, sumK: sumK, items: mine,
               dpFricPa: dpFric, dpFitPa: dpFit, dpStatPa: dpStat,
               dpPa: dpFric + dpFit + dpStat };
    });
  }

  function totals(ls) {
    var rhoL0 = shared('tp2-rhol', 998.2), rhoG0 = shared('tp2-rhog', 1.204);
    var Wl0 = shared('tp2-wl', 20000), Wg0 = shared('tp2-wg', 60);
    var x0 = (Wl0 + Wg0) > 0 ? Wg0 / (Wl0 + Wg0) : 0;
    var rho = 1 / ((x0 / rhoG0) + ((1 - x0) / rhoL0));
    var C = shared('tp2-cfactor', 100);
    var Ve = (C / Math.sqrt(rho * 0.06248)) * 0.3048;
    var Vallow = Ve * 0.75;
    var t = { L: 0, dz: 0, dpPa: 0, dpFricPa: 0, dpFitPa: 0, dpStatPa: 0, sumK: 0, Vmax: 0, Vmin: 1e9,
              Lh: 0, Lv: 0, nh: 0, nv: 0, dpH: 0, dpV: 0, rise: 0, drop: 0 };
    ls.forEach(function (l) {
      t.L += l.L; t.dz += l.dz; t.dpPa += l.dpPa; t.dpFricPa += l.dpFricPa;
      t.dpFitPa += l.dpFitPa; t.dpStatPa += l.dpStatPa; t.sumK += l.sumK;
      t.Vmax = Math.max(t.Vmax, l.V); t.Vmin = Math.min(t.Vmin, l.V);
      if (l.horiz) { t.Lh += l.L; t.nh++; t.dpH += l.dpPa; }
      else { t.Lv += l.L; t.nv++; t.dpV += l.dpPa; if (l.dz > 0) t.rise += l.dz; else t.drop += -l.dz; }
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
    t.dpAllow = Math.max(0.05, Math.min(0.5 * t.Leq / 100, 0.10 * (shared('tp2-pup', 6) + 1.01325)));
    t.velOk = t.Vmin >= 0.9 && t.Vmax <= 4.5;
    t.eroOk = t.Vmax < Vallow;
    t.dpOk = t.dpDyn <= t.dpAllow;
    return t;
  }

  function compute() {
    if (!DOC.segs.length) return null;
    autoElbows();
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
    CTX.setTransform(1, 0, 0, 1, 0, 0);
    CTX.clearRect(0, 0, w, h);
    CTX.fillStyle = '#0b1220'; CTX.fillRect(0, 0, w, h);

    /* Everything below is drawn in world space. */
    CTX.setTransform(VIEW.k, 0, 0, VIEW.k, VIEW.ox, VIEW.oy);
    var wx0 = -VIEW.ox / VIEW.k, wy0 = -VIEW.oy / VIEW.k;
    var wx1 = wx0 + w / VIEW.k, wy1 = wy0 + h / VIEW.k;
    CTX.strokeStyle = 'rgba(148,163,184,0.10)'; CTX.lineWidth = 1 / VIEW.k;
    for (var x = Math.floor(wx0 / 25) * 25; x < wx1; x += 25) { CTX.beginPath(); CTX.moveTo(x, wy0); CTX.lineTo(x, wy1); CTX.stroke(); }
    for (var y = Math.floor(wy0 / 25) * 25; y < wy1; y += 25) { CTX.beginPath(); CTX.moveTo(wx0, y); CTX.lineTo(wx1, y); CTX.stroke(); }

    if (!DOC.segs.length) {
      CTX.setTransform(1, 0, 0, 1, 0, 0);
      CTX.fillStyle = '#64748b'; CTX.font = '12px monospace';
      CTX.fillText('1 · LINE tool — click the FROM point, then click at each change of direction. Legs snap square and to the grid.', 18, 34);
      CTX.fillText('2 · Double-click, press ESC, or press FINISH RUN to end the route.', 18, 56);
      CTX.fillText('3 · Pick a component from the library, then click the line to drop it — it lands on the nearest leg.', 18, 78);
      CTX.fillText('4 · SELECT / DRAG — drag a leg to move it, an endpoint to reshape, or a component along its line.', 18, 100);
      CTX.fillText('Scroll to zoom · shift-drag or middle-drag to pan · FIT re-frames the drawing.', 18, 122);
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

    /* Status banner — screen space, so it stays put while the view moves. */
    CTX.setTransform(1, 0, 0, 1, 0, 0);
    CTX.font = 'bold 11px monospace';
    var msg = ARMED ? 'PLACING ' + lib(ARMED).name.toUpperCase() + ' — click a line to drop it  ·  ESC to cancel'
      : RUNNING ? 'ROUTING — click to add a corner  ·  double-click, ESC or FINISH RUN to end'
      : TOOL === 'select' ? 'SELECT / DRAG — drag a leg, an endpoint or a component  ·  DEL removes the selection'
      : TOOL === 'delete' ? 'DELETE — click a line or component to remove it'
      : 'LINE — click to start a new run';
    var mw = CTX.measureText(msg).width;
    CTX.fillStyle = ARMED ? 'rgba(245,158,11,0.16)' : RUNNING ? 'rgba(34,197,94,0.16)' : 'rgba(56,189,248,0.10)';
    CTX.fillRect(10, 8, mw + 16, 20);
    CTX.fillStyle = ARMED ? '#fbbf24' : RUNNING ? '#22c55e' : '#7dd3fc';
    CTX.fillText(msg, 18, 22);
    CTX.fillStyle = '#64748b'; CTX.font = '10px monospace';
    CTX.fillText('ZOOM ' + Math.round(VIEW.k * 100) + '%', w - 82, 22);
    CTX.setTransform(VIEW.k, 0, 0, VIEW.k, VIEW.ox, VIEW.oy);

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
    allItems().forEach(function (it, n) {
      var sg = segById(it.segId); if (!sg) return;
      var pt = itemXY(it);
      var ang = Math.atan2(sg.y2 - sg.y1, sg.x2 - sg.x1);
      var c = lib(it.key);
      CTX.save();
      if (it.auto) CTX.globalAlpha = 0.62;               // assumed, not placed
      symbol(CTX, pt.x, pt.y, ang, c, SEL && SEL.kind === 'item' && SEL.id === it.id);
      CTX.restore();
      var off = (n % 2) ? 30 : 18;
      CTX.font = 'bold 10px monospace'; CTX.textAlign = 'center';
      var tw2 = Math.max(CTX.measureText(it.tag).width, CTX.measureText(c.name).width * 0.82) + 8;
      CTX.fillStyle = 'rgba(11,18,32,0.85)';
      CTX.fillRect(pt.x - tw2 / 2, pt.y + off - 10, tw2, 22);
      CTX.fillStyle = it.auto ? '#7dd3fc' : c.colour;
      CTX.fillText(it.tag + (it.auto ? ' (auto)' : ''), pt.x, pt.y + off);
      CTX.font = '8.5px monospace'; CTX.fillStyle = '#94a3b8';
      CTX.fillText(c.name, pt.x, pt.y + off + 10);
      CTX.textAlign = 'left';
    });

    var a = DOC.segs[0], b = DOC.segs[DOC.segs.length - 1];
    CTX.fillStyle = '#22c55e'; CTX.beginPath(); CTX.arc(a.x1, a.y1, 6, 0, Math.PI * 2); CTX.fill();
    CTX.font = 'bold 11px monospace'; CTX.fillText(sharedS('tp2-from', '') || 'FROM', a.x1 + 10, a.y1 - 12);
    CTX.fillStyle = '#ef4444'; CTX.beginPath(); CTX.arc(b.x2, b.y2, 6, 0, Math.PI * 2); CTX.fill();
    CTX.fillText(sharedS('tp2-to', '') || 'TO', b.x2 + 10, b.y2 - 12);
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

  /* Industrial-looking bodies: a painted casting, machined steel trim and a
     brass/handwheel accent, with the geometry that actually distinguishes
     each valve type — rising stem, quarter-turn lever, wafer disc, Y-pattern
     strainer bowl, spring bonnet, diaphragm actuator on a yoke. */
  function icon3D(c, R) {
    var g = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.colour), metalness: 0.35, roughness: 0.45 });
    var steel = new THREE.MeshStandardMaterial({ color: 0xb8c2cf, metalness: 0.92, roughness: 0.22 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
    var brass = new THREE.MeshStandardMaterial({ color: 0xd4a13a, metalness: 0.85, roughness: 0.3 });
    function add(m) { g.add(m); return m; }
    function cyl(r1, r2, len, seg, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg || 20), mat); }
    /* Raised-face flanges with a ring of bolts — the detail that reads as
       "process pipework" more than anything else. */
    function flangePair(rad, dx) {
      [-dx, dx].forEach(function (x) {
        var hub = cyl(rad * 0.72, rad * 0.72, R * 0.5, 18, steel); hub.rotation.z = Math.PI / 2; hub.position.x = x * 0.82; add(hub);
        var fl = cyl(rad, rad, R * 0.3, 24, steel); fl.rotation.z = Math.PI / 2; fl.position.x = x; add(fl);
        for (var i = 0; i < 8; i++) {
          var a = i * Math.PI / 4;
          var bolt = cyl(R * 0.11, R * 0.11, R * 0.5, 6, dark);
          bolt.rotation.z = Math.PI / 2;
          bolt.position.set(x, Math.sin(a) * rad * 0.78, Math.cos(a) * rad * 0.78);
          add(bolt);
        }
      });
    }
    function stem(h) { var st = cyl(R * 0.16, R * 0.16, h, 10, steel); st.position.y = R * 1.2 + h / 2; return add(st); }
    function wheel(y, rad) {
      var w = new THREE.Mesh(new THREE.TorusGeometry(rad, R * 0.13, 8, 22), brass);
      w.position.y = y; w.rotation.x = Math.PI / 2; add(w);
      for (var i = 0; i < 4; i++) {
        var sp = new THREE.Mesh(new THREE.BoxGeometry(rad * 2, R * 0.1, R * 0.1), brass);
        sp.position.y = y; sp.rotation.y = i * Math.PI / 4; add(sp);
      }
    }
    function lever(len) {
      var boss = cyl(R * 0.34, R * 0.34, R * 0.7, 12, steel); boss.position.y = R * 1.5; add(boss);
      var lv = new THREE.Mesh(new THREE.BoxGeometry(R * 0.26, R * 0.26, len), dark);
      lv.position.set(0, R * 1.95, len * 0.32); add(lv);
      var grip = cyl(R * 0.2, R * 0.2, R * 0.9, 10, paint);
      grip.rotation.x = Math.PI / 2; grip.position.set(0, R * 1.95, len * 0.72); add(grip);
    }
    var ico = c.ico;

    if (ico === 'bend') {
      var el = new THREE.Mesh(new THREE.TorusGeometry(R * 2.0, R, 14, 20, Math.PI / 2), paint);
      el.position.set(-R * 2.0, 0, 0); add(el);
      var a1 = cyl(R, R, R * 1.0, 18, paint); a1.rotation.z = Math.PI / 2; a1.position.set(-R * 2.5, R * 2.0, 0); add(a1);
      var a2 = cyl(R, R, R * 1.0, 18, paint); a2.position.set(0, R * 0.5, 0); add(a2);
      var f1 = cyl(R * 1.6, R * 1.6, R * 0.28, 22, steel); f1.rotation.z = Math.PI / 2; f1.position.set(-R * 3.0, R * 2.0, 0); add(f1);
      var f2 = cyl(R * 1.6, R * 1.6, R * 0.28, 22, steel); f2.position.set(0, R * 1.0, 0); add(f2);
      return g;
    }
    if (ico === 'tee') {
      var run = cyl(R, R, R * 5.0, 20, paint); run.rotation.z = Math.PI / 2; add(run);
      var br = cyl(R * 0.85, R * 0.85, R * 2.6, 18, paint); br.position.y = -R * 1.6; add(br);
      flangePair(R * 1.6, R * 2.5);
      var bf = cyl(R * 1.35, R * 1.35, R * 0.28, 20, steel); bf.position.y = -R * 2.8; add(bf);
      return g;
    }
    if (ico === 'red') {
      var cone = cyl(R * 0.62, R * 1.25, R * 2.4, 22, paint); cone.rotation.z = Math.PI / 2; add(cone);
      var s1 = cyl(R * 0.62, R * 0.62, R * 0.9, 18, paint); s1.rotation.z = Math.PI / 2; s1.position.x = R * 1.6; add(s1);
      var s2 = cyl(R * 1.25, R * 1.25, R * 0.9, 18, paint); s2.rotation.z = Math.PI / 2; s2.position.x = -R * 1.6; add(s2);
      var fa = cyl(R * 1.0, R * 1.0, R * 0.3, 20, steel); fa.rotation.z = Math.PI / 2; fa.position.x = R * 2.1; add(fa);
      var fb = cyl(R * 1.75, R * 1.75, R * 0.3, 22, steel); fb.rotation.z = Math.PI / 2; fb.position.x = -R * 2.1; add(fb);
      return g;
    }
    if (ico === 'flange') {
      var stub = cyl(R, R, R * 2.4, 18, paint); stub.rotation.z = Math.PI / 2; add(stub);
      flangePair(R * 1.85, R * 0.42);
      return g;
    }
    if (ico === 'orif') {
      var st = cyl(R, R, R * 2.6, 18, paint); st.rotation.z = Math.PI / 2; add(st);
      var pl = cyl(R * 1.95, R * 1.95, R * 0.16, 24, steel); pl.rotation.z = Math.PI / 2; add(pl);
      var tab = new THREE.Mesh(new THREE.BoxGeometry(R * 0.14, R * 1.4, R * 0.9), steel);
      tab.position.y = R * 2.4; add(tab);
      [-R * 0.8, R * 0.8].forEach(function (x) {
        var tp = cyl(R * 0.15, R * 0.15, R * 1.5, 8, dark); tp.position.set(x, R * 1.4, 0); add(tp);
      });
      return g;
    }
    if (ico === 'strain') {                                 // Y-pattern with a bowl
      var body = cyl(R * 1.3, R * 1.3, R * 3.0, 20, paint); body.rotation.z = Math.PI / 2; add(body);
      flangePair(R * 1.8, R * 1.8);
      var bowl = cyl(R * 1.15, R * 0.85, R * 2.4, 18, paint);
      bowl.position.set(-R * 0.9, -R * 1.5, 0); bowl.rotation.z = 0.62; add(bowl);
      var cap = cyl(R * 0.95, R * 0.95, R * 0.5, 16, steel);
      cap.position.set(-R * 1.6, -R * 2.6, 0); cap.rotation.z = 0.62; add(cap);
      return g;
    }

    /* Valve bodies: a cast barrel with a raised bonnet flange. */
    var barrel = cyl(R * 1.45, R * 1.45, R * 2.4, 22, paint); barrel.rotation.z = Math.PI / 2; add(barrel);
    var waist = new THREE.Mesh(new THREE.SphereGeometry(R * 1.5, 18, 12), paint); add(waist);
    flangePair(R * 1.85, R * 1.5);
    if (ico !== 'bfly') {
      var bonnet = cyl(R * 0.95, R * 1.2, R * 0.9, 16, paint); bonnet.position.y = R * 1.5; add(bonnet);
      var bflange = cyl(R * 1.15, R * 1.15, R * 0.22, 18, steel); bflange.position.y = R * 1.05; add(bflange);
    }

    if (ico === 'wheel') { stem(R * 2.2); wheel(R * 3.2, R * 1.15); }
    else if (ico === 'angle') {
      var outl = cyl(R, R, R * 2.2, 18, paint); outl.position.y = -R * 1.7; add(outl);
      var of2 = cyl(R * 1.6, R * 1.6, R * 0.3, 20, steel); of2.position.y = -R * 2.9; add(of2);
      stem(R * 2.0); wheel(R * 3.0, R * 1.05);
    }
    else if (ico === 'lever') { lever(R * 3.2); }
    else if (ico === 'bfly') {                              // wafer body, canted disc
      var disc = cyl(R * 1.3, R * 1.3, R * 0.15, 22, steel); disc.rotation.z = Math.PI / 3; add(disc);
      var shaft = cyl(R * 0.16, R * 0.16, R * 3.0, 10, steel); shaft.position.y = R * 0.8; add(shaft);
      lever(R * 2.6);
    }
    else if (ico === 'check') {                             // hinged flap + access cover
      var flap = new THREE.Mesh(new THREE.BoxGeometry(R * 0.14, R * 1.9, R * 1.9), steel);
      flap.position.set(R * 0.25, -R * 0.3, 0); flap.rotation.z = -0.55; add(flap);
      var cover = cyl(R * 1.05, R * 1.05, R * 0.55, 16, steel); cover.position.y = R * 1.75; add(cover);
      for (var b = 0; b < 6; b++) {
        var ang = b * Math.PI / 3;
        var bl = cyl(R * 0.1, R * 0.1, R * 0.4, 6, dark);
        bl.position.set(Math.cos(ang) * R * 0.8, R * 2.0, Math.sin(ang) * R * 0.8); add(bl);
      }
    }
    else if (ico === 'actuator') {                          // diaphragm on a yoke
      [-R * 0.75, R * 0.75].forEach(function (z) {
        var pil = cyl(R * 0.13, R * 0.13, R * 2.0, 8, steel); pil.position.set(0, R * 2.3, z); add(pil);
      });
      var dia = cyl(R * 1.7, R * 1.7, R * 1.0, 22, steel); dia.position.y = R * 3.6; add(dia);
      var top = new THREE.Mesh(new THREE.SphereGeometry(R * 1.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel);
      top.position.y = R * 4.1; add(top);
      var st3 = cyl(R * 0.18, R * 0.18, R * 1.6, 10, steel); st3.position.y = R * 2.2; add(st3);
    }
    else if (ico === 'psv') {                               // spring bonnet + side outlet
      var spring = cyl(R * 0.85, R * 0.85, R * 2.2, 14, steel); spring.position.y = R * 2.6; add(spring);
      var cap2 = new THREE.Mesh(new THREE.ConeGeometry(R * 0.9, R * 1.0, 16), brass); cap2.position.y = R * 4.1; add(cap2);
      var vent = cyl(R * 0.95, R * 0.95, R * 2.0, 16, paint);
      vent.rotation.z = Math.PI / 2; vent.position.set(R * 2.0, R * 0.4, 0); add(vent);
      var vf = cyl(R * 1.35, R * 1.35, R * 0.28, 18, steel); vf.rotation.z = Math.PI / 2; vf.position.set(R * 3.0, R * 0.4, 0); add(vf);
      var lift = new THREE.Mesh(new THREE.BoxGeometry(R * 0.16, R * 0.16, R * 1.6), dark);
      lift.position.set(0, R * 4.3, R * 0.7); add(lift);
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
    var rn = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
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
    if (!r) return;
    if (!three) { init3D(); if (!three) return; }
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
        var nm = sprite(it.tag + (it.auto ? ' (auto)' : '') + '  ' + c.name, it.auto ? '#7dd3fc' : c.colour);
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
      out.push({ w: c.name + ' ×' + placed[k], h: 'K ' + kk + ' at ' + r.legs[0].nps + '" each  ·  ' + f4(placed[k] * kk * 0.5 * r.legs[0].rho * Math.pow(r.legs[0].V, 2) / 1e5) + ' bar at L1 velocity',
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
    if (!r) {
      el.innerHTML = '<div style="font-family:var(--font-mono);font-size:10px;color:#64748b;padding:8px;">Draw the run with the LINE tool — the evaluation appears here and the counts feed section 6.</div>';
      if (ONCHANGE) { try { ONCHANGE(summary()); } catch (e) {} }
      var v0 = $('pid-verdict');
      if (v0) { v0.style.display = 'block'; v0.style.background = 'rgba(245,158,11,0.12)';
                v0.style.borderLeft = '3px solid #f59e0b'; v0.style.color = '#fbbf24';
                v0.textContent = '\u26A0 Nothing to evaluate yet — use the LINE tool to draw the run first.'; }
      return;
    }
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
    h += row('Components placed', String(DOC.items.length) + (AUTO.length ? '  +  ' + AUTO.length + ' assumed elbow' + (AUTO.length > 1 ? 's' : '') : '') + '  ·  ΣK ' + f2(t.sumK));

    /* Output A — horizontal against vertical, because the two behave
       differently: a horizontal leg costs only friction, a vertical one
       carries static head that no pipe size will remove. */
    h += '<div class="pid-cardh">ROUTE BREAKDOWN — HORIZONTAL vs VERTICAL</div>';
    h += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10px;white-space:nowrap;">'
      + '<tr style="color:#94a3b8;border-bottom:1px solid var(--border-muted);">'
      + ['Orientation', 'Legs', 'Length', 'Friction + fittings', 'Static', 'Total ΔP', 'Share']
        .map(function (x, i) { return '<th style="text-align:' + (i ? 'right' : 'left') + ';padding:4px;">' + x + '</th>'; }).join('') + '</tr>';
    [['Horizontal', t.nh, t.Lh, t.dpH, 0], ['Vertical', t.nv, t.Lv, t.dpV - t.dpStatPa, t.dpStatPa]].forEach(function (rw) {
      var tot = rw[3] + rw[4];
      h += '<tr style="border-bottom:1px dashed var(--border-muted);color:#e2e8f0;">'
        + '<td style="padding:4px;">' + rw[0] + '</td>'
        + '<td style="padding:4px;text-align:right;">' + rw[1] + '</td>'
        + '<td style="padding:4px;text-align:right;">' + f2(rw[2]) + ' m</td>'
        + '<td style="padding:4px;text-align:right;">' + f4(rw[3] / 1e5) + ' bar</td>'
        + '<td style="padding:4px;text-align:right;">' + f4(rw[4] / 1e5) + ' bar</td>'
        + '<td style="padding:4px;text-align:right;font-weight:700;">' + f4(tot / 1e5) + ' bar</td>'
        + '<td style="padding:4px;text-align:right;">' + (t.dpPa > 0 ? f1(tot / t.dpPa * 100) : '—') + ' %</td></tr>';
    });
    h += '</table></div>';
    h += '<div style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;line-height:1.5;margin-top:4px;">'
      + 'Rise ' + f2(t.rise) + ' m, fall ' + f2(t.drop) + ' m, net Δz ' + f2(t.dz) + ' m. Static head is fixed by the elevation and does not fall away at turndown, so it is judged separately from the friction allowance.</div>';

    /* Output B — the same route priced across every schedule and the bores
       either side, so the size decision is made on numbers. */
    h += '<div class="pid-cardh">ΔP ACROSS PIPE SIZES AND SCHEDULES</div>';
    var sizesAll = Object.keys(PIPE).map(Number).sort(function (a, b) { return a - b; });
    var curNps = DOC.segs[0] ? DOC.segs[0].nps : defNps();
    var ci = sizesAll.indexOf(curNps);
    var show = sizesAll.slice(Math.max(0, ci - 2), Math.min(sizesAll.length, ci + 4));
    h += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10px;white-space:nowrap;">'
      + '<tr style="color:#94a3b8;border-bottom:1px solid var(--border-muted);"><th style="text-align:left;padding:4px;">NPS</th>'
      + SCHEDULES.map(function (sc) { return '<th colspan="2" style="text-align:center;padding:4px;border-left:1px solid var(--border-muted);">Sch ' + sc + '</th>'; }).join('') + '</tr>'
      + '<tr style="color:#64748b;border-bottom:1px solid var(--border-muted);"><th></th>'
      + SCHEDULES.map(function () { return '<th style="text-align:right;padding:3px;border-left:1px solid var(--border-muted);">V m/s</th><th style="text-align:right;padding:3px;">ΔP bar</th>'; }).join('') + '</tr>';
    show.forEach(function (n) {
      h += '<tr style="border-bottom:1px dashed var(--border-muted);color:#e2e8f0;">'
        + '<td style="padding:4px;font-weight:700;' + (n === curNps ? 'color:var(--color-saffron);' : '') + '">' + n + '"' + (n === curNps ? ' \u25C4' : '') + '</td>';
      SCHEDULES.forEach(function (sc) {
        if (PIPE[n].s[sc] === undefined) { h += '<td colspan="2" style="padding:4px;text-align:center;color:#475569;border-left:1px solid var(--border-muted);">—</td>'; return; }
        var tt = totals(legs(n, sc));
        var vcol = tt.Vmax > tt.Vallow ? '#ef4444' : (tt.Vmax > 4.5 || tt.Vmin < 0.9) ? '#f59e0b' : '#22c55e';
        var dcol = tt.dpDyn <= tt.dpAllow ? '#22c55e' : '#ef4444';
        h += '<td style="padding:4px;text-align:right;color:' + vcol + ';border-left:1px solid var(--border-muted);">' + f2(tt.Vmax) + '</td>'
          + '<td style="padding:4px;text-align:right;color:' + dcol + ';">' + f3(tt.dpDyn) + '</td>';
      });
      h += '</tr>';
    });
    h += '</table></div>';
    h += '<div style="font-family:var(--font-mono);font-size:9px;color:#94a3b8;line-height:1.5;margin-top:4px;">'
      + 'Friction plus fittings for the route exactly as drawn, with its components. Green passes every check, amber falls outside the 0.9\u20134.5 m/s velocity band, red exceeds the erosional limit or the ' + f3(t.dpAllow) + ' bar allowance. The arrow marks the size in use.</div>';

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

    if (ONCHANGE) { try { ONCHANGE(summary()); } catch (e) {} }
    if (VIEW3D) {
      update3D(r);
      var tg = $('pid-3dtag');
      if (tg) tg.textContent = r.legs.length + ' legs · ' + f2(t.L) + ' m · ' + DOC.items.length + ' components · drag to rotate, scroll to zoom';
    }

    var vb = $('pid-verdict');
    if (vb) {
      var ok = t.velOk && t.eroOk && t.dpOk;
      vb.style.display = 'block';
      vb.style.background = ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
      vb.style.borderLeft = '3px solid ' + (ok ? '#22c55e' : '#ef4444');
      vb.style.color = ok ? '#86efac' : '#fca5a5';
      vb.textContent = (ok ? '\u2713 EVALUATED — the drawn line is hydraulically suitable.  ' : '\u26A0 EVALUATED — the drawn line needs attention.  ')
        + r.legs.length + ' legs \u00b7 ' + f2(t.L) + ' m \u00b7 ' + DOC.items.length + ' components \u00b7 '
        + f2(t.Vmin) + '\u2013' + f2(t.Vmax) + ' m/s \u00b7 \u0394P ' + f3(t.dpDyn) + ' bar of ' + f3(t.dpAllow) + ' allowable.';
    }

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
      $('pid-selsize').style.display = 'grid';
      $('pid-seltag').style.display = 'none';
      $('pid-sel-nps').value = s.nps; $('pid-sel-sch').value = s.sch; $('pid-sel-col').value = s.colour;
      if (document.activeElement !== $('pid-sel-len')) $('pid-sel-len').value = segLen(s, num('pid-scale', 0.05)).toFixed(2);
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
        + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;">'
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

  /* The workbench occupies the output column, so it is laid out wide: a
     single toolbar strip, a large canvas, the component library beneath it
     and a compact bar for whatever is selected. No process or line inputs —
     those live once, in the shared column on the left. */
  function panelHTML() {
    var h = '<div>';

    h += '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px;">'
      + '<button class="pid-tool" data-tool="line">✏ LINE</button>'
      + '<button class="pid-tool" data-tool="select">✥ SELECT / DRAG</button>'
      + '<button class="pid-tool" data-tool="delete">✕ DELETE</button>'
      + '<span style="width:8px;"></span>'
      + '<button id="pid-finish" class="pid-act">⏹ FINISH RUN</button>'
      + '<button id="pid-ortho" class="pid-act">⊾ SQUARE: ON</button>'
      + '<button id="pid-autoel" class="pid-act">⌐ AUTO ELBOWS: ON</button>'
      + '<span style="width:8px;"></span>'
      + '<button id="pid-zin" class="pid-act">＋</button>'
      + '<button id="pid-zout" class="pid-act">－</button>'
      + '<button id="pid-fit" class="pid-act">⤢ FIT</button>'
      + '<span style="width:8px;"></span>'
      + '<button id="pid-v2d" class="pid-tool on">▦ 2D P&amp;ID</button>'
      + '<button id="pid-v3d" class="pid-tool">◈ 3D MODEL</button>'
      + '<span style="width:8px;"></span>'
      + '<button id="pid-undo" class="pid-act">↩ UNDO</button>'
      + '<button id="pid-clear" class="pid-act pid-red">↺ CLEAR</button>'
      + '<span style="flex:1;"></span>'
      + '<label style="display:flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">SCALE'
      + '<input id="pid-scale" type="number" step="0.01" value="0.05" style="width:62px;background:rgba(2,6,18,0.6);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:10px;padding:4px 5px;border-radius:3px;"/>'
      + '<span style="font-size:9px;color:#64748b;">m/px</span></label></div>';

    /* Canvas on the left, library docked on the right — a component is one
       short movement from the line it is going on, instead of a scroll away
       at the foot of the panel. */
    h += '<div style="display:flex;gap:10px;align-items:flex-start;">';

    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="position:relative;">'
      + '<canvas id="pid-canvas" width="1180" height="470" style="width:100%;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;cursor:crosshair;display:block;"></canvas>'
      + '<canvas id="pid-3d" style="width:100%;height:470px;background:#0b1220;border:1px solid var(--border-muted);border-radius:6px;display:none;cursor:grab;"></canvas>'
      + '<div id="pid-3dtag" style="display:none;position:absolute;left:10px;top:10px;font-family:var(--font-mono);font-size:10px;font-weight:700;color:#38bdf8;background:rgba(11,18,32,0.75);padding:5px 9px;border-radius:4px;"></div>'
      + '</div>';

    h += '<div id="pid-selbox" style="display:none;margin-top:8px;border:1px solid var(--color-saffron);border-radius:5px;padding:8px;background:rgba(255,117,56,0.06);">'
      + '<div id="pid-sel-title" style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);margin-bottom:6px;"></div>'
      + '<div id="pid-seltag" style="display:none;max-width:280px;">' + txtf('TAG NUMBER', 'pid-sel-tag', '') + '</div>'
      + '<div id="pid-selsize" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px;align-items:end;">'
      + sel('NPS', 'pid-sel-nps', Object.keys(PIPE), '3')
      + sel('SCHEDULE', 'pid-sel-sch', SCHEDULES, '40')
      + fld('LENGTH', 'pid-sel-len', 'm', '', '0.1')
      + '<label style="display:block;margin:4px 0;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">LINE COLOUR'
      + '<input id="pid-sel-col" type="color" value="#38bdf8" style="width:100%;height:26px;margin-top:2px;background:transparent;border:1px solid var(--border-muted);border-radius:3px;cursor:pointer;"/></label>'
      + '<div><div style="display:flex;gap:3px;margin-bottom:4px;">'
      + ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#e2e8f0']
          .map(function (col) { return '<button class="pid-sw" data-col="' + col + '" title="' + col + '" style="flex:1;height:18px;border:1px solid var(--border-muted);border-radius:3px;cursor:pointer;background:' + col + ';"></button>'; }).join('')
      + '</div><button id="pid-colall" class="pid-act" style="width:100%;">COLOUR ALL</button></div>'
      + '<button id="pid-applyall" class="pid-act">SIZE → ALL LINES</button>'
      + '</div>'
      + '<button id="pid-sel-del" class="pid-act pid-red" style="margin-top:6px;">✕ DELETE SELECTED</button></div>';

    h += '<div id="pid-verdict" style="display:none;margin-top:10px;font-family:var(--font-mono);font-size:10.5px;font-weight:700;border-radius:5px;padding:8px 10px;line-height:1.45;"></div>';
    h += '<div id="pid-results" style="margin-top:10px;"></div>';
    h += '</div>';

    h += '<div style="width:232px;flex:none;max-height:640px;overflow-y:auto;border:1px solid var(--border-muted);border-radius:6px;padding:8px;background:rgba(2,6,18,0.35);">'
      + '<div style="font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--color-saffron);letter-spacing:0.05em;margin-bottom:3px;">COMPONENT LIBRARY</div>'
      + '<div style="font-family:var(--font-mono);font-size:8.5px;color:#94a3b8;line-height:1.45;margin-bottom:6px;">Click a component, then click the line it goes on. Elbows at corners are assumed automatically.</div>'
      + paletteHTML()
      + '</div>';

    h += '</div>';

    h += css();
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
      + '.pid-ico3{display:block;margin:0 auto 1px;width:44px;height:30px;object-fit:contain;}'
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
      + allItems().map(function (it) {
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
  var VIEW3D = false;

  /* The 3D model is the same drawing seen in three dimensions — bore, length,
     colour and components all follow the 2D sketch, so switching views never
     shows two different designs. */
  function setView3D(on) {
    VIEW3D = on;
    var c2 = $('pid-canvas'), c3 = $('pid-3d'), tag = $('pid-3dtag');
    if (!c2 || !c3) return;
    c2.style.display = on ? 'none' : 'block';
    c3.style.display = on ? 'block' : 'none';
    if (tag) tag.style.display = on ? 'block' : 'none';
    var b2 = $('pid-v2d'), b3 = $('pid-v3d');
    if (b2) b2.classList.toggle('on', !on);
    if (b3) b3.classList.toggle('on', on);
    if (on) {
      if (!three) init3D();
      var r = LASTR || compute();
      if (r) { update3D(r); if (tag) tag.textContent = r.legs.length + ' legs · ' + f2(r.tot.L) + ' m · ' + DOC.items.length + ' components · drag to rotate, scroll to zoom'; }
      else if (tag) tag.textContent = 'Nothing drawn yet — switch to 2D and draw the run.';
      resize3D();
    }
  }

  function setTool(t) {
    TOOL = t; ARMED = null;
    [].slice.call(document.querySelectorAll('.pid-tool')).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === t); });
    [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (b) { b.classList.remove('on'); });
    var hint = $('pid-hint');
    if (hint) hint.textContent = t === 'line' ? 'Click to start the run, then click at every change of direction. Double-click, press ESC, or press FINISH RUN to end it.'
      : t === 'select' ? 'Drag a leg to move it, an endpoint to reshape the route, or a component along its line. DEL removes the selection.'
      : 'Click a line or component to remove it.';
    if (CV) CV.style.cursor = t === 'delete' ? 'not-allowed' : t === 'select' ? 'default' : 'crosshair';
  }

  function screenXY(e) {
    var b = CV.getBoundingClientRect();
    return { x: (e.clientX - b.left) * (CV.width / b.width), y: (e.clientY - b.top) * (CV.height / b.height) };
  }
  function xy(e) {
    var p = screenXY(e);
    return { x: (p.x - VIEW.ox) / VIEW.k, y: (p.y - VIEW.oy) / VIEW.k };
  }
  function zoomAt(sx, sy, factor) {
    var wx = (sx - VIEW.ox) / VIEW.k, wy = (sy - VIEW.oy) / VIEW.k;
    VIEW.k = Math.max(0.25, Math.min(4, VIEW.k * factor));
    VIEW.ox = sx - wx * VIEW.k; VIEW.oy = sy - wy * VIEW.k;
    draw();
  }
  function fitView() {
    if (!DOC.segs.length) { VIEW = { k: 1, ox: 0, oy: 0 }; draw(); return; }
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    DOC.segs.forEach(function (s) {
      x1 = Math.min(x1, s.x1, s.x2); x2 = Math.max(x2, s.x1, s.x2);
      y1 = Math.min(y1, s.y1, s.y2); y2 = Math.max(y2, s.y1, s.y2);
    });
    var pad = 70;
    var k = Math.min((CV.width - pad * 2) / Math.max(1, x2 - x1), (CV.height - pad * 2) / Math.max(1, y2 - y1));
    VIEW.k = Math.max(0.25, Math.min(3, k));
    VIEW.ox = CV.width / 2 - ((x1 + x2) / 2) * VIEW.k;
    VIEW.oy = CV.height / 2 - ((y1 + y2) / 2) * VIEW.k;
    draw();
  }

  function finishRun() {
    var l = DOC.segs[DOC.segs.length - 1];
    if (l && l.x1 === l.x2 && l.y1 === l.y2) DOC.segs.pop();   // drop an open stub
    RUNNING = false; GHOST = null;
    var fb = $('pid-finish');
    if (fb) { fb.style.borderColor = 'var(--color-saffron)'; fb.style.color = 'var(--color-saffron)'; fb.style.background = 'transparent'; }
    render();
  }
  function markRunning() {
    var fb = $('pid-finish');
    if (fb) { fb.style.borderColor = '#22c55e'; fb.style.color = '#052e16'; fb.style.background = '#22c55e'; }
  }

  function onDown(e) {
    if (PAN || e.button === 1 || e.shiftKey) return;       // panning, not drawing
    var p = xy(e);
    /* Dragging should just work. If the pointer goes down on something that
       already exists while the LINE tool is active and no run is open, switch
       to SELECT for the user rather than starting a stray leg. */
    if (TOOL === 'line' && !ARMED && !RUNNING && (hitItem(p.x, p.y) || hitEnd(p.x, p.y) || hitSeg(p.x, p.y, 12))) setTool('select');
    /* Mid-route, pressing the point you just placed closes the run rather
       than starting a zero-length leg on top of it. */
    if (TOOL === 'line' && RUNNING && !ARMED) {
      var end = lastEnd();
      if (end && Math.hypot(p.x - end.x, p.y - end.y) < 9 / VIEW.k) { finishRun(); return; }
    }
    if (ARMED) {
      /* A drop always lands: the click snaps to the nearest line whatever the
         distance, so a component can never be lost off the run. */
      var hit = hitSeg(p.x, p.y, 22) || hitSeg(p.x, p.y, 1e6);
      if (hit) {
        addItem(ARMED, hit.seg.id, hit.t);
        ARMED = null; if (CV) CV.style.cursor = TOOL === 'select' ? 'default' : 'crosshair';
        [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (b) { b.classList.remove('on'); });
        setTool('select');                          // ready to nudge it into place
        render();
      }
      return;
    }
    if (TOOL === 'line') {
      var q = snap(p);
      var from = lastEnd();
      if (!RUNNING || !from) { addSeg(q.x, q.y, q.x, q.y); RUNNING = true; markRunning(); }
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
    if (PAN) {
      var q = screenXY(e);
      VIEW.ox = PAN.ox + (q.x - PAN.x); VIEW.oy = PAN.oy + (q.y - PAN.y);
      draw(); return;
    }
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
  function onUp() {
    if (PAN) { PAN = null; CV.style.cursor = TOOL === 'select' ? 'default' : 'crosshair'; return; }
    if (DRAG) { DRAG = null; squareUp(); render(); }
  }

  function wire() {
    CV = $('pid-canvas'); CTX = CV.getContext('2d');
    CV.addEventListener('wheel', function (e) {
      e.preventDefault();
      var q = screenXY(e);
      zoomAt(q.x, q.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    CV.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    CV.addEventListener('mousedown', function (e) {
      if (e.button === 1 || e.shiftKey) {                 // middle button or shift = pan
        e.preventDefault();
        var q = screenXY(e);
        PAN = { x: q.x, y: q.y, ox: VIEW.ox, oy: VIEW.oy };
        CV.style.cursor = 'grabbing';
      }
    });
    CV.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    [].slice.call(document.querySelectorAll('.pid-tool')).forEach(function (b) {
      b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); });
    });
    [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-key');
        if (RUNNING) finishRun();                   // picking a component ends the route
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
    $('pid-zin').addEventListener('click', function () { zoomAt(CV.width / 2, CV.height / 2, 1.25); });
    $('pid-zout').addEventListener('click', function () { zoomAt(CV.width / 2, CV.height / 2, 1 / 1.25); });
    $('pid-fit').addEventListener('click', function () { if (VIEW3D) { var r = LASTR || compute(); if (r) update3D(r); } else fitView(); });
    $('pid-autoel').addEventListener('click', function () {
      AUTOEL = !AUTOEL;
      $('pid-autoel').textContent = '⌐ AUTO ELBOWS: ' + (AUTOEL ? 'ON' : 'OFF');
      if (!AUTOEL) AUTO = [];
      render();
    });
    $('pid-v2d').addEventListener('click', function () { setView3D(false); });
    $('pid-v3d').addEventListener('click', function () { setView3D(true); });
    $('pid-finish').addEventListener('click', finishRun);
    CV.addEventListener('dblclick', function (e) { e.preventDefault(); if (RUNNING) finishRun(); });
    document.addEventListener('keydown', function (e) {
      if (!$('pid-canvas')) return;                 // workbench not mounted
      if (e.key === 'Escape') { if (RUNNING) finishRun(); ARMED = null;
        [].slice.call(document.querySelectorAll('.pid-lib')).forEach(function (b) { b.classList.remove('on'); }); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && SEL && document.activeElement === document.body) {
        e.preventDefault(); $('pid-sel-del').click();
      }
    });
    $('pid-ortho').addEventListener('click', function () {
      ORTHO = !ORTHO;
      $('pid-ortho').textContent = '⊾ SQUARE: ' + (ORTHO ? 'ON' : 'OFF');
      if (ORTHO) { squareUp(); render(); }
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

    $('pid-applyall').addEventListener('click', function () {
      var n = SEL && SEL.kind === 'seg' ? (segById(SEL.id) || {}).nps : defNps();
      var c = SEL && SEL.kind === 'seg' ? (segById(SEL.id) || {}).sch : defSch();
      DOC.segs.forEach(function (s) { s.nps = n; s.sch = c; }); render();
    });
    ['tp2-nps', 'tp2-sch'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener('change', function () { refreshPaletteK(); render(); });
    });
    $('pid-sel-del').addEventListener('click', function () {
      if (!SEL) return;
      if (SEL.kind === 'item') DOC.items = DOC.items.filter(function (i) { return i.id !== SEL.id; });
      else { DOC.items = DOC.items.filter(function (i) { return i.segId !== SEL.id; });
             DOC.segs = DOC.segs.filter(function (s) { return s.id !== SEL.id; }); }
      SEL = null; render();
    });
    /* Typing a length stretches the leg along its own direction and carries
       the rest of the run with it, so the route stays connected. */
    $('pid-sel-len').addEventListener('change', function () {
      if (!SEL || SEL.kind !== 'seg') return;
      var sg = segById(SEL.id); if (!sg) return;
      var want = parseFloat($('pid-sel-len').value);
      var scale = num('pid-scale', 0.05);
      if (!isFinite(want) || want <= 0 || scale <= 0) return;
      var dx = sg.x2 - sg.x1, dy = sg.y2 - sg.y1, cur = Math.hypot(dx, dy);
      if (cur < 1e-6) return;
      var px = want / scale;                              // required pixel length
      var ux = dx / cur, uy = dy / cur;
      var nx2 = sg.x1 + ux * px, ny2 = sg.y1 + uy * px;
      var shx = nx2 - sg.x2, shy = ny2 - sg.y2;
      var i0 = DOC.segs.indexOf(sg);
      sg.x2 = nx2; sg.y2 = ny2;
      for (var i = i0 + 1; i < DOC.segs.length; i++) {     // move everything downstream
        DOC.segs[i].x1 += shx; DOC.segs[i].y1 += shy;
        DOC.segs[i].x2 += shx; DOC.segs[i].y2 += shy;
      }
      squareUp();
      render();
    });
    ['pid-sel-nps', 'pid-sel-sch', 'pid-sel-col'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (!SEL || SEL.kind !== 'seg') return;
        var s = segById(SEL.id); if (!s) return;
        s.nps = parseFloat(val('pid-sel-nps', '2')); s.sch = val('pid-sel-sch', '40'); s.colour = val('pid-sel-col', '#38bdf8');
        render();
      });
    });
    var sc = $('pid-scale');
    if (sc) { sc.addEventListener('change', render); sc.addEventListener('input', render); }

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

  /* Component counts mapped onto the two-phase fitting list, plus the
     geometry the sketch determines. Components the workbook table does not
     cover are returned as a separate sum-K so nothing is silently dropped. */
  var TP_SLOT = { gate: 0, globe: 1, angle: 2, ball: 3, plug: 4, plug3: 5, plugB: 6, check: 7, lcheck: 8,
                  e90: 9, e45: 10, e90lr: 11, teeR: 12, teeB: 13, m0: 14, m30: 15, m60: 16, m90: 17 };
  function summary() {
    var scale = num('pid-scale', 0.05);
    var counts = new Array(18).fill(0), extra = [], extraK = 0;
    var nps = DOC.segs.length ? DOC.segs[0].nps : defNps();
    autoElbows();
    allItems().forEach(function (it) {
      var slot = TP_SLOT[it.key];
      if (slot != null) counts[slot]++;
      else { extraK += kOf(it.key, nps); extra.push({ tag: it.tag, name: lib(it.key).name, k: kOf(it.key, nps) }); }
    });
    var L = 0, rise = 0, drop = 0;
    DOC.segs.forEach(function (s) {
      L += segLen(s, scale);
      var d = segDz(s, scale);
      if (d > 0) rise += d; else drop += -d;
    });
    return { counts: counts, extra: extra, extraK: extraK, legs: DOC.segs.length,
             L: L, dz: rise - drop, rise: rise, drop: drop,
             items: DOC.items.length, auto: AUTO.length };
  }

  var ONCHANGE = null;

  window.AROPID = {
    build: build, compute: compute, report: report, render: render,
    doc: DOC, lib: LIB, setTool: setTool, kOf: kOf, kBand: kBand, view: function () { return VIEW; }, fit: fitView,
    addSeg: addSeg, addItem: addItem,
    clear: function () { DOC.segs = []; DOC.items = []; SEL = null; },
    /* Full reset: drawing, selection, view, tag counters and the results. */
    reset: function () {
      DOC.segs = []; DOC.items = []; SEL = null; DRAG = null; ARMED = null;
      RUNNING = false; GHOST = null; LASTR = null;
      Object.keys(TAGN).forEach(function (k) { delete TAGN[k]; });
      VIEW = { k: 1, ox: 0, oy: 0 };
      var v = $('pid-verdict'); if (v) { v.style.display = 'none'; v.textContent = ''; }
      var rz = $('pid-results'); if (rz) rz.innerHTML = '';
      var sb = $('pid-selbox'); if (sb) sb.style.display = 'none';
      if (CV) { setTool('line'); setView3D(false); draw(); }
      if (three) { while (three.group.children.length) { var c = three.group.children.pop(); if (c.geometry) c.geometry.dispose(); } }
    },
    summary: summary,
    canvas: function () { return CV; },
    /* Images of both views for the report — the 3D is rendered on demand so a
       report is complete even if the engineer never opened that view. */
    image2D: function () { try { return CV ? CV.toDataURL('image/png') : null; } catch (e) { return null; } },
    image3D: function () {
      try {
        if (!DOC.segs.length) return null;
        if (!three) { init3D(); if (!three) return null; }
        update3D(LASTR || compute());
        three.rn.render(three.scene, three.cam);
        return three.rn.domElement.toDataURL('image/png');
      } catch (e) { return null; }
    },
    view3D: function (on) { setView3D(!!on); },
    onChange: function (fn) { ONCHANGE = fn; }
  };
})();

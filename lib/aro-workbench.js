/* ══════════════════════════════════════════════════════════════════════
   ARO WORKBENCH — CAD-like Process Flow / P&ID editor (MVP)
   Self-contained module. Namespaced under window.AROWB.
   Build-your-own drawing engine (SVG): drag-drop equipment library,
   intelligent orthogonal pipe connections, property editor, snap grid,
   zoom/pan, line-sizing + pressure-drop calc, BOM + report generation.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var WB = window.AROWB = { nodes: [], pipes: [], seq: 0, sel: null, selMulti: [], mode: 'select',
    snap: true, ortho: true, grid: 20, zoom: 1, panX: 0, panY: 0,
    pendingPort: null, undoStack: [], redoStack: [], initialized: false, backdrop: null,
    gridOn: true, bgColor: '#ffffff', viewRotate: 0, bgIdx: 0, pidMode: false };
  var BG_COLORS = ['#ffffff', '#f1f5f9', '#0f172a', '#111827', '#eef6ff', '#fef9c3'];

  /* ───────────── Equipment / component library ─────────────
     Each item: {t:type, n:name, w,h, draw:fn(g)->svg, ports:[{x,y,dir}]}
     Ports are in local unit coords (0..w, 0..h). */
  /* ───────────── Port roles (stream types) ─────────────
     Each equipment exposes only the ports that make sense for it —
     process IN/OUT, hot/cold utility, recycle, waste, vent, drain, signal.
     ANSYS-workbench style: click an equipment to reveal its named ports. */
  var ROLE = {
    'in':      { c: '#16a34a', lbl: 'IN' },
    'out':     { c: '#2563eb', lbl: 'OUT' },
    'recycle': { c: '#7c3aed', lbl: 'RCY' },
    'waste':   { c: '#b45309', lbl: 'WST' },
    'vent':    { c: '#0891b2', lbl: 'VNT' },
    'drain':   { c: '#dc2626', lbl: 'DRN' },
    'hot-in':  { c: '#dc2626', lbl: 'HOT IN' },
    'hot-out': { c: '#ea580c', lbl: 'HOT OUT' },
    'cold-in': { c: '#16a34a', lbl: 'CLD IN' },
    'cold-out':{ c: '#0d9488', lbl: 'CLD OUT' },
    'vap':     { c: '#0891b2', lbl: 'VAP' },
    'liq':     { c: '#2563eb', lbl: 'LIQ' },
    'signal':  { c: '#64748b', lbl: 'SIG' }
  };
  function P(x, y, dir, role, name) { return { x: x, y: y, dir: dir, role: role || 'io', name: name || '' }; }

  /* ───────────── Canonical port registry (Stage 1 of the 2D/3D port-sync fix) ─────────────
     2D (aro-workbench.js) and 3D (aro-workbench-3d.js) used to each keep their
     own port list per equipment type, matched up only by ROLE STRING at
     connect/build time — and those role strings didn't always agree (STHE's
     2D roles are 'cold-in'/'cold-out'/'hot-in'/'hot-out', its 3D roles are
     'in'/'out'/'in2'/'out2'), and even where they did agree, matching by role
     instead of by a real identity is how the v-vessel in/out inversion and
     the STHE shell-side silent-no-pipe bug both slipped in unnoticed.
     This is the single source of truth for what a "same port" IS, for a
     first batch of 5 equipment types. Only IDENTITY lives here — role (for
     the legend colour + the existing role-based fallbacks) and a display
     name. Each side still computes its OWN coordinates (2D screen px, 3D
     world units, P&ID anchor) — this registry never holds a coordinate.
     role2d / role3d are only here because the two sides' role strings don't
     always match (see STHE above); once a port is looked up by id that
     distinction disappears. A null role3d means the 3D model has no nozzle
     for that port yet (v-vessel/h-vessel vent+drain) — an honest gap, not a
     silent wrong connection; documented in the Stage 1 report, not hidden. */
  var AROPORTS = window.AROPORTS = {
    'pump': [
      { id: 'suction', role2d: 'in', role3d: 'in', name: 'Suction' },
      { id: 'discharge', role2d: 'out', role3d: 'out', name: 'Discharge' }
    ],
    'v-vessel': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Feed Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Liquid Outlet' },
      { id: 'vent', role2d: 'vent', role3d: null, name: 'Vent' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Drain' }
    ],
    'h-vessel': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Feed Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Product Outlet' },
      { id: 'vent', role2d: 'vent', role3d: null, name: 'Vent' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Drain' }
    ],
    'sthe': [
      { id: 'tubeIn', role2d: 'cold-in', role3d: 'in', name: 'Tube Inlet' },
      { id: 'tubeOut', role2d: 'cold-out', role3d: 'out', name: 'Tube Outlet' },
      { id: 'shellIn', role2d: 'hot-in', role3d: 'in2', name: 'Shell Inlet' },
      { id: 'shellOut', role2d: 'hot-out', role3d: 'out2', name: 'Shell Outlet' }
    ],
    'aircooler': [
      { id: 'processIn', role2d: 'in', role3d: 'in', name: 'Process Inlet' },
      { id: 'processOut', role2d: 'out', role3d: 'out', name: 'Process Outlet' }
    ],
    /* ── Stage 3: extending the registry to the next batch of equipment ──
       Every type below already had a real, hand-authored 3D portDefs array
       (not the bbox-guess fallback) AND a real 2D ports array — the same
       "both sides already model this for real, they just don't agree on a
       shared id yet" precondition Stage 1 used for the first 5. A null
       role3d is a port 2D draws that this equipment's 3D model doesn't have
       a nozzle for yet (same honest-gap convention as v-vessel/h-vessel's
       vent+drain) — not fabricated, not silently dropped either. */
    'compressor': [
      { id: 'suction', role2d: 'in', role3d: 'in', name: 'Suction' },
      { id: 'discharge', role2d: 'out', role3d: 'out', name: 'Discharge' }
    ],
    'column': [
      { id: 'feed', role2d: 'in', role3d: 'in', name: 'Feed' },
      { id: 'overhead', role2d: 'vap', role3d: 'out', name: 'Overhead' },
      { id: 'reflux', role2d: 'recycle', role3d: null, name: 'Reflux' },
      { id: 'bottoms', role2d: 'liq', role3d: null, name: 'Bottoms' }
    ],
    'cone-tank': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Fill' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'vent', role2d: 'vent', role3d: null, name: 'Vent' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Drain' }
    ],
    'bullet': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'vent', role2d: 'vent', role3d: null, name: 'PSV/Vent' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Drain' }
    ],
    /* atm-tank's 3D nozzle at role 'out' was drawn and labelled "Vent" —
       but 'out' is what buildFromModel resolves as the OUTLET connection,
       and the 2D sheet's own 'out' role is named "Outlet" for the same
       physical nozzle. The 3D label was cosmetically wrong (fixed in
       aro-workbench-3d.js alongside this); the geometry/role/position are
       untouched. */
    'atm-tank': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Fill' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'vent', role2d: 'vent', role3d: null, name: 'Vent' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Drain' }
    ],
    'reboiler': [
      { id: 'liquidIn', role2d: 'in', role3d: 'in', name: 'Liquid Feed' },
      { id: 'vaporOut', role2d: 'vap', role3d: 'out', name: 'Vapor Outlet' },
      { id: 'liquidOut', role2d: 'liq', role3d: null, name: 'Liquid Outlet' },
      { id: 'steamIn', role2d: 'hot-in', role3d: null, name: 'Steam In' }
    ],
    'dphe': [
      { id: 'innerIn', role2d: 'cold-in', role3d: 'in', name: 'Inner Pipe Inlet' },
      { id: 'annulusOut', role2d: 'hot-out', role3d: 'out', name: 'Annulus Outlet' },
      { id: 'innerOut', role2d: 'cold-out', role3d: null, name: 'Inner Pipe Outlet' },
      { id: 'annulusIn', role2d: 'hot-in', role3d: null, name: 'Annulus Inlet' }
    ],
    'pump-ms': [
      { id: 'suction', role2d: 'in', role3d: 'in', name: 'Suction' },
      { id: 'discharge', role2d: 'out', role3d: 'out', name: 'Discharge' }
    ],
    'gate': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'ball': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'globe': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'butterfly': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'check': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'control': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'signal', role2d: 'signal', role3d: null, name: 'Signal' }
    ],
    'needle': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    // 2D's relief line out of a PSV is tagged role 'vent' (so it draws/
    // colours like a vent line); 3D's own role for the same physical
    // nozzle is 'out'. Same-port, different role vocabulary — exactly the
    // STHE pattern from Stage 1.
    'psv': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'vent', role3d: 'out', name: 'Outlet (Relief)' }
    ],
    'ft': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'mixer': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'cartridge-filter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Drain' }
    ],
    'silo': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Fill' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Discharge' }
    ],
    'y-strainer': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    't-strainer': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'basket-filter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Drain' }
    ],
    'bag-filter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'duplex-filter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'self-clean-filter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'drain', role2d: 'drain', role3d: null, name: 'Purge' }
    ],
    'venturi-meter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'vortex-meter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'coriolis-meter': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'sight-glass': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'solenoid-valve': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' },
      { id: 'signal', role2d: 'signal', role3d: null, name: 'Coil' }
    ],
    'diaphragm-valve': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'pinch-valve': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'cryo-valve': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'angle-valve': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Inlet' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'Outlet' }
    ],
    'deluge-valve': [
      { id: 'inlet', role2d: 'in', role3d: 'in', name: 'Supply' },
      { id: 'outlet', role2d: 'out', role3d: 'out', name: 'System' },
      { id: 'signal', role2d: 'signal', role3d: null, name: 'Trip' }
    ],
    /* The ejector's 2D symbol (below) already defines all three real ports
       (Suction/Discharge/Motive) and its 3D factory (FAC['steam-ejector'] in
       aro-workbench-3d.js) already draws real flange/nozzle geometry for
       all three — it was just never registered here, so the 3D side fell
       to the 2-port bounding-box guess and the motive nozzle had no
       pickable 3D port at all despite being modelled. role3d 'in2' matches
       the same second-inlet convention 'sthe' above already uses. */
    'ejector': [
      { id: 'suction', role2d: 'in', role3d: 'in', name: 'Suction' },
      { id: 'discharge', role2d: 'out', role3d: 'out', name: 'Discharge' },
      { id: 'motive', role2d: 'hot-in', role3d: 'in2', name: 'Motive' }
    ]
  };

  /* ───────────── Line type — ISA/PIP piping & instrument-connection legend ─────────────
     Every connection is one physical line on the drawing, but ISA convention
     draws a different one depending on what it carries and what state it's
     in — a process line looks nothing like a pneumatic signal or a line
     due to be demolished. `ltype` on a pipe picks which of these it is;
     undefined/'existing' keeps the plain solid line every saved project
     already has. */
  var LINE_TYPES = {
    major:      { label: 'Process — Major Line',        group: 'Process Piping' },
    minor:      { label: 'Process — Minor Line',         group: 'Process Piping' },
    existing:   { label: 'Existing Pipeline',            group: 'Pipeline Modification' },
    new:        { label: 'New / Future Pipeline',        group: 'Pipeline Modification', dash: '9 6' },
    remove:     { label: 'Existing — To Be Removed',     group: 'Pipeline Modification', tick: 'hatch', tickSpace: 7 },
    heattrace:  { label: 'Pipeline — Heat Traced',       group: 'Tracing / Jacket', tick: 'perp', tickSpace: 16 },
    jacketed:   { label: 'Pipeline — Jacketed',          group: 'Tracing / Jacket', jacket: true },
    insulated:  { label: 'Pipeline — Insulated',         group: 'Tracing / Jacket', jacket: true },
    electrical: { label: 'Electrical Connection',        group: 'Instrument Connection', dash: '11 3 2 3' },
    pneumatic:  { label: 'Pneumatic Connection',         group: 'Instrument Connection', tick: 'hatch', tickSpace: 14 },
    hydraulic:  { label: 'Hydraulic Connection',         group: 'Instrument Connection', tick: 'L', tickSpace: 16 },
    mechanical: { label: 'Mechanical Connection',        group: 'Instrument Connection', tick: 'dot', tickSpace: 12 },
    capillary:  { label: 'Capillary Connection',         group: 'Instrument Connection', tick: 'x', tickSpace: 12 },
    emsignal:   { label: 'Signal — EM / Sonic / Optical', group: 'Communication Signal', wavy: true },
    digital:    { label: 'Signal — Data / Digital',      group: 'Communication Signal', tick: 'circle', tickSpace: 14 }
  };
  function ltypeOf(p) { return LINE_TYPES[p.ltype] ? p.ltype : 'existing'; }
  function polyLen(pts) {
    var t = 0;
    for (var i = 0; i < pts.length - 1; i++) t += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    return t;
  }
  function pointAtDist(pts, d) {
    var acc = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y, len = Math.hypot(dx, dy);
      if (d <= acc + len || i === pts.length - 2) {
        var t = len > 0 ? (d - acc) / len : 0; t = Math.max(0, Math.min(1, t));
        return { x: pts[i].x + dx * t, y: pts[i].y + dy * t, ang: Math.atan2(dy, dx) };
      }
      acc += len;
    }
    return { x: pts[0].x, y: pts[0].y, ang: 0 };
  }
  /* One little glyph per mark kind, stamped at (x,y) angled to the line's
     local direction — this is what turns "dashed line" into "hatched",
     "L L L" or "x x x" without hand-drawing a path for every pipe route. */
  function tickGlyph(kind, x, y, ang, colour) {
    var perp = ang + Math.PI / 2;
    function seg(a, len) {
      return '<line x1="' + (x - Math.cos(a) * len) + '" y1="' + (y - Math.sin(a) * len) + '" x2="' + (x + Math.cos(a) * len) + '" y2="' + (y + Math.sin(a) * len) + '" stroke="' + colour + '" stroke-width="1.4"/>';
    }
    if (kind === 'perp') return seg(perp, 5);
    if (kind === 'hatch') return seg(ang + Math.PI / 4, 6);
    if (kind === 'x') return seg(ang + Math.PI / 4, 4) + seg(ang - Math.PI / 4, 4);
    if (kind === 'dot') return '<circle cx="' + x + '" cy="' + y + '" r="2" fill="' + colour + '"/>';
    if (kind === 'circle') return '<circle cx="' + x + '" cy="' + y + '" r="2.8" fill="#fff" stroke="' + colour + '" stroke-width="1.3"/>';
    if (kind === 'L') {
      var bx = x - Math.cos(ang) * 3, by = y - Math.sin(ang) * 3;
      return '<path d="M' + (bx - Math.cos(perp) * 4) + ' ' + (by - Math.sin(perp) * 4) + ' L' + bx + ' ' + by + ' L' + (bx + Math.cos(ang) * 5) + ' ' + (by + Math.sin(ang) * 5) + '" fill="none" stroke="' + colour + '" stroke-width="1.4"/>';
    }
    return '';
  }
  function marksAlong(pts, spacing, kind, colour) {
    var total = polyLen(pts), s = '', d = spacing / 2;
    while (d < total - 2) { var pt = pointAtDist(pts, d); s += tickGlyph(kind, pt.x, pt.y, pt.ang, colour); d += spacing; }
    return s;
  }
  function wavyPath(pts, amp, wavelength) {
    var total = polyLen(pts), step = 4, d = 0, out = [];
    while (d <= total) {
      var pt = pointAtDist(pts, d);
      var off = Math.sin(d / wavelength * Math.PI * 2) * amp;
      out.push({ x: pt.x - Math.sin(pt.ang) * off, y: pt.y + Math.cos(pt.ang) * off });
      d += step;
    }
    return out;
  }
  /* Builds the full SVG for one pipe leg — base path (styled, or replaced
     with a wavy path for signal lines) plus whatever marks its ISA line
     type calls for, laid on top. */
  function lineDecor(p, pts, colour, width) {
    var lt = LINE_TYPES[ltypeOf(p)];
    var drawPts = lt.wavy ? wavyPath(pts, Math.max(3, width), 22) : pts;
    var d = 'M' + drawPts.map(function (pt) { return pt.x + ' ' + pt.y; }).join(' L');
    var w = lt.group === 'Process Piping' ? (ltypeOf(p) === 'major' ? Math.max(width, 5) : (ltypeOf(p) === 'minor' ? Math.min(width, 1.6) : width))
      : (lt.group === 'Pipeline Modification' ? width : Math.min(width, 1.8));
    var s = '';
    if (lt.jacket) s += '<path d="' + d + '" fill="none" stroke="#94a3b8" stroke-width="' + (w + 6) + '" stroke-linejoin="round" opacity="0.55"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + colour + '" stroke-width="' + w + '"' + (lt.dash ? ' stroke-dasharray="' + lt.dash + '"' : '') + ' stroke-linejoin="round" data-pipe="' + p.id + '" style="cursor:pointer"/>';
    if (lt.tick) s += marksAlong(pts, lt.tickSpace || 14, lt.tick, colour);
    return s;
  }

  /* ───────────── Equipment / component library ─────────────
     Industrial ISA/P&ID-style symbols (schematic but realistic), each with
     role-tagged ports so the user sees exactly which streams that piece of
     equipment accepts/produces. */
  /* ── Detailed valve part kit — photoreal-style vector components ──
     (flanged ends with bolt heads, spoked handwheels, threaded stems,
     glossy bodies) reused across every valve model. */
  function vkFlange(x, cy, h) {
    var s = '<rect x="' + x + '" y="' + (cy - h / 2) + '" width="5" height="' + h + '" rx="1.4" fill="url(#wbSteelH)" stroke="#475569" stroke-width="0.9"/>';
    [0.16, 0.5, 0.84].forEach(function (f) {
      s += '<circle cx="' + (x + 2.5) + '" cy="' + (cy - h / 2 + h * f) + '" r="1.3" fill="#334155"/>';
    });
    return s;
  }
  function vkWheel(cx, cy, r, col) {
    var ry = r * 0.42;
    var s = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r + '" ry="' + ry + '" fill="none" stroke="' + col + '" stroke-width="3"/>'
      + '<ellipse cx="' + cx + '" cy="' + (cy - 0.8) + '" rx="' + r + '" ry="' + ry + '" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.45"/>'
      + '<line x1="' + (cx - r) + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="' + col + '" stroke-width="1.6"/>'
      + '<line x1="' + cx + '" y1="' + (cy - ry) + '" x2="' + cx + '" y2="' + (cy + ry) + '" stroke="' + col + '" stroke-width="1.6"/>'
      + '<line x1="' + (cx - r * 0.7) + '" y1="' + (cy - ry * 0.7) + '" x2="' + (cx + r * 0.7) + '" y2="' + (cy + ry * 0.7) + '" stroke="' + col + '" stroke-width="1.3"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.22) + '" fill="#1e293b"/>'
      + '<circle cx="' + (cx - r * 0.08) + '" cy="' + (cy - r * 0.08) + '" r="' + (r * 0.08) + '" fill="#94a3b8"/>';
    return s;
  }
  function vkStem(cx, yTop, yBot) {
    var s = '<rect x="' + (cx - 1.6) + '" y="' + yTop + '" width="3.2" height="' + (yBot - yTop) + '" fill="url(#wbSteelH)" stroke="#475569" stroke-width="0.6"/>';
    for (var y = yTop + 2; y < yBot - 1; y += 2.6) s += '<line x1="' + (cx - 1.6) + '" y1="' + y + '" x2="' + (cx + 1.6) + '" y2="' + (y + 1.2) + '" stroke="#64748b" stroke-width="0.6"/>';
    return s;
  }
  function vkBody(cx, cy, half, grad, stroke) {
    return '<path d="M' + (cx - half) + ' ' + (cy - 12) + ' L' + (cx - half) + ' ' + (cy + 12) + ' L' + cx + ' ' + cy + ' Z'
      + ' M' + (cx + half) + ' ' + (cy - 12) + ' L' + (cx + half) + ' ' + (cy + 12) + ' L' + cx + ' ' + cy + ' Z" fill="' + grad + '" stroke="' + stroke + '" stroke-width="1.4"/>'
      + '<ellipse cx="' + (cx - half * 0.55) + '" cy="' + (cy - 6) + '" rx="' + (half * 0.3) + '" ry="2.5" fill="#fff" opacity="0.35"/>'
      + '<ellipse cx="' + (cx + half * 0.55) + '" cy="' + (cy - 6) + '" rx="' + (half * 0.3) + '" ry="2.5" fill="#fff" opacity="0.35"/>';
  }
  function vkBonnet(cx, yBase, w2, h2) {
    var s = '<path d="M' + (cx - w2) + ' ' + yBase + ' h' + (w2 * 2) + ' l-3 -' + h2 + ' h-' + (w2 * 2 - 6) + ' Z" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1"/>';
    s += '<circle cx="' + (cx - w2 + 2.5) + '" cy="' + (yBase - 2.2) + '" r="1.2" fill="#334155"/>';
    s += '<circle cx="' + (cx + w2 - 2.5) + '" cy="' + (yBase - 2.2) + '" r="1.2" fill="#334155"/>';
    return s;
  }

  /* ── Isometric 3D primitive kit — gives equipment real cylindrical /
     box volume with lit top faces, side shading and rim highlights so the
     symbols read as industrial 3D objects, not flat outlines. */
  function k3dHCyl(x, y, w2, h2, grad, stroke) {   // horizontal cylinder (barrel)
    var r = h2 / 2, cy = y + r;
    return '<rect x="' + x + '" y="' + y + '" width="' + w2 + '" height="' + h2 + '" rx="' + r + '" fill="' + grad + '" stroke="' + stroke + '" stroke-width="1.4"/>'
      + '<ellipse cx="' + (x + w2) + '" cy="' + cy + '" rx="' + (r * 0.5) + '" ry="' + (r * 0.94) + '" fill="' + grad + '" stroke="' + stroke + '" stroke-width="1.2"/>'
      + '<ellipse cx="' + (x + w2) + '" cy="' + cy + '" rx="' + (r * 0.28) + '" ry="' + (r * 0.55) + '" fill="#000" opacity="0.12"/>'
      + '<rect x="' + (x + 3) + '" y="' + (y + 2) + '" width="' + (w2 - 8) + '" height="' + (r * 0.42) + '" rx="' + (r * 0.2) + '" fill="#fff" opacity="0.32"/>';
  }
  function k3dVCyl(x, y, w2, h2, grad, stroke) {   // vertical cylinder (column/vessel)
    var r = w2 / 2, cx = x + r;
    return '<path d="M' + x + ' ' + (y + r * 0.4) + ' v' + (h2 - r * 0.4) + ' a' + r + ' ' + (r * 0.4) + ' 0 0 0 ' + w2 + ' 0 v-' + (h2 - r * 0.4) + '" fill="' + grad + '" stroke="' + stroke + '" stroke-width="1.4"/>'
      + '<ellipse cx="' + cx + '" cy="' + (y + r * 0.4) + '" rx="' + r + '" ry="' + (r * 0.4) + '" fill="' + grad + '" stroke="' + stroke + '" stroke-width="1.2"/>'
      + '<ellipse cx="' + cx + '" cy="' + (y + r * 0.4) + '" rx="' + (r * 0.62) + '" ry="' + (r * 0.24) + '" fill="#fff" opacity="0.28"/>'
      + '<rect x="' + (x + 2) + '" y="' + (y + r * 0.5) + '" width="' + (r * 0.5) + '" height="' + (h2 - r * 0.6) + '" rx="' + (r * 0.2) + '" fill="#fff" opacity="0.22"/>';
  }
  function k3dBox(x, y, w2, h2, d, grad, stroke) {  // box with top + right depth faces
    return '<path d="M' + x + ' ' + y + ' h' + w2 + ' l' + d + ' -' + d + ' h-' + w2 + ' Z" fill="' + grad + '" stroke="' + stroke + '" stroke-width="1.2" opacity="0.85"/>'
      + '<path d="M' + (x + w2) + ' ' + y + ' l' + d + ' -' + d + ' v' + h2 + ' l-' + d + ' ' + d + ' Z" fill="#000" opacity="0.18"/>'
      + '<rect x="' + x + '" y="' + y + '" width="' + w2 + '" height="' + h2 + '" fill="' + grad + '" stroke="' + stroke + '" stroke-width="1.4"/>'
      + '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (w2 - 4) + '" height="' + (h2 * 0.3) + '" fill="#fff" opacity="0.22"/>';
  }
  function k3dBase(cx, y, w2) {                     // steel skid / baseplate with depth
    return '<path d="M' + (cx - w2 / 2) + ' ' + y + ' h' + w2 + ' l4 -3 h-' + w2 + ' Z" fill="#64748b"/><rect x="' + (cx - w2 / 2) + '" y="' + y + '" width="' + w2 + '" height="4" fill="#334155"/>';
  }
  // Blue electric-motor barrel with cooling fins + end bell (illustration style)
  function k3dMotor(x, y, w2, h2) {
    var s = '<rect x="' + x + '" y="' + y + '" width="' + w2 + '" height="' + h2 + '" rx="' + (h2 * 0.28) + '" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.4"/>';
    for (var fx = x + 4; fx < x + w2 - 3; fx += 4) s += '<line x1="' + fx + '" y1="' + (y + 2) + '" x2="' + fx + '" y2="' + (y + h2 - 2) + '" stroke="#1e3a8a" stroke-width="1" opacity="0.5"/>';
    s += '<rect x="' + (x + w2 - 4) + '" y="' + (y - 1) + '" width="6" height="' + (h2 + 2) + '" rx="2" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1"/>';
    s += '<rect x="' + (x + 3) + '" y="' + (y + 2) + '" width="' + (w2 - 8) + '" height="' + (h2 * 0.26) + '" rx="2" fill="#fff" opacity="0.3"/>';
    return s;
  }

  var LIB = {
    'Equipment': [
      { t: 'pump', n: 'Centrifugal Pump', w: 68, h: 54, ports: [P(2, 32, 'w', 'in', 'Suction'), P(20, 4, 'n', 'out', 'Discharge')],
        draw: function () { return k3dBase(38, 50, 58)
          + k3dMotor(30, 20, 34, 26)
          + '<circle cx="18" cy="32" r="16" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.6"/><ellipse cx="13" cy="26" rx="6" ry="3.5" fill="#fff" opacity="0.35"/>'
          + '<circle cx="18" cy="32" r="7.5" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1.2"/><circle cx="18" cy="32" r="3" fill="#7c2d12"/>'
          + '<path d="M4 30 h6 v6 h-8 Z" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1"/>'
          + '<rect x="14" y="4" width="10" height="12" rx="2" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1"/>'; } },
      { t: 'pump-ms', n: 'Multistage Pump', w: 84, h: 50, ports: [P(6, 32, 'w', 'in', 'Suction'), P(78, 32, 'e', 'out', 'Discharge')],
        draw: function () { return k3dBase(42, 48, 68)
          + k3dMotor(6, 18, 26, 28)
          + '<rect x="30" y="22" width="48" height="22" rx="11" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.4"/><rect x="32" y="24" width="44" height="6" rx="3" fill="#fff" opacity="0.28"/>'
          + '<g stroke="#f97316" stroke-width="2.5">' + (function(){var s='';for(var i=0;i<6;i++){var x=38+i*7;s+='<line x1="'+x+'" y1="24" x2="'+x+'" y2="42"/>';}return s;})() + '</g>'
          + '<circle cx="80" cy="33" r="5" fill="url(#wbOrange)" stroke="#9a3412"/>'; } },
      { t: 'pd-pump', n: 'PD / Gear Pump', w: 62, h: 52, ports: [P(11, 40, 'w', 'in', 'Inlet'), P(51, 40, 'e', 'out', 'Outlet')],
        draw: function () { return k3dBase(31, 48, 46)
          + '<circle cx="31" cy="26" r="20" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.6"/><ellipse cx="24" cy="19" rx="7" ry="4" fill="#fff" opacity="0.35"/>'
          + '<circle cx="24" cy="26" r="8.5" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1.2"/><circle cx="38" cy="26" r="8.5" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1.2"/>'
          + '<g stroke="#7c2d12" stroke-width="1"><path d="M24 17 v18 M38 17 v18 M15 26 h18 M29 26 h18"/></g>'
          + '<path d="M2 36 h8 v8 h-10 Z" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1"/>'; } },
      { t: 'compressor', n: 'Compressor', w: 68, h: 56, ports: [P(10, 44, 'w', 'in', 'Suction'), P(58, 24, 'e', 'out', 'Discharge')],
        draw: function () { return k3dBase(34, 52, 54) + '<path d="M10 46 L10 16 L58 24 L58 46 Z" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="1.6"/><path d="M10 16 L16 12 L62 20 L58 24 Z" fill="#7dd3fc" opacity="0.7" stroke="#0369a1" stroke-width="1"/><ellipse cx="26" cy="30" rx="8" ry="5" fill="#fff" opacity="0.28"/><text x="33" y="40" font-size="12" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">C</text>'; } },
      { t: 'blower', n: 'Blower / Fan', w: 58, h: 54, ports: [P(9, 28, 'w', 'in', 'Inlet'), P(49, 28, 'e', 'out', 'Outlet')],
        draw: function () { return k3dBase(29, 50, 46) + '<circle cx="29" cy="28" r="20" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="1.6"/><ellipse cx="22" cy="21" rx="7" ry="4" fill="#fff" opacity="0.35"/>' + (function(){var s='';for(var i=0;i<7;i++){var a=i*Math.PI*2/7;s+='<line x1="29" y1="28" x2="'+(29+15*Math.cos(a))+'" y2="'+(28+15*Math.sin(a))+'" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';}return s;})() + '<circle cx="29" cy="28" r="4.5" fill="#0369a1"/>'; } },
      { t: 'sthe', n: 'Shell & Tube HX', w: 96, h: 50, ports: [P(8, 25, 'w', 'cold-in', 'Tube In'), P(88, 25, 'e', 'cold-out', 'Tube Out'), P(24, 10, 'n', 'hot-in', 'Shell In'), P(72, 40, 's', 'hot-out', 'Shell Out')],
        draw: function () { return '<path d="M8 46 l6 -5 m18 5 l6 -5 m18 5 l6 -5 m18 5 l6 -5" stroke="#64748b" stroke-width="2.5"/>' + k3dHCyl(8, 10, 80, 30, 'url(#wbSteelH)', '#334155') + '<rect x="8" y="10" width="9" height="30" rx="3" fill="#cbd5e1" stroke="#334155" stroke-width="1"/><g stroke="#94a3b8" stroke-width="1"><line x1="20" y1="18" x2="80" y2="18"/><line x1="20" y1="25" x2="80" y2="25"/><line x1="20" y1="32" x2="80" y2="32"/></g>'; } },
      { t: 'dphe', n: 'Double Pipe HX', w: 92, h: 38, ports: [P(6, 19, 'w', 'cold-in', 'Inner In'), P(86, 19, 'e', 'cold-out', 'Inner Out'), P(16, 8, 'n', 'hot-in', 'Annulus In'), P(76, 30, 's', 'hot-out', 'Annulus Out')],
        draw: function () { return k3dHCyl(6, 8, 80, 22, 'url(#wbSteelH)', '#334155') + '<line x1="10" y1="19" x2="82" y2="19" stroke="#64748b" stroke-width="3"/><path d="M16 8 v22 M76 8 v22" stroke="#cbd5e1" stroke-width="1.2"/>'; } },
      { t: 'phe', n: 'Plate HX', w: 54, h: 58, ports: [P(12, 14, 'w', 'hot-in', 'Hot In'), P(42, 44, 'e', 'hot-out', 'Hot Out'), P(12, 44, 'w', 'cold-in', 'Cold In'), P(42, 14, 'e', 'cold-out', 'Cold Out')],
        draw: function () { return k3dBox(12, 8, 30, 44, 6, 'url(#wbSteelH)', '#334155') + '<g stroke="#0369a1" stroke-width="1.3">' + (function(){var s='';for(var i=1;i<7;i++){s+='<line x1="'+(12+i*4.3)+'" y1="10" x2="'+(12+i*4.3)+'" y2="50"/>';}return s;})() + '</g><rect x="8" y="6" width="4" height="48" fill="#334155"/>'; } },
      { t: 'aircooler', n: 'Air Cooler', w: 82, h: 50, ports: [P(10, 31, 'w', 'in', 'Inlet'), P(72, 31, 'e', 'out', 'Outlet')],
        draw: function () { return k3dBase(41, 46, 66) + k3dBox(10, 22, 62, 18, 5, 'url(#wbSteelH)', '#334155') + '<circle cx="28" cy="12" r="9" fill="url(#wbGrey3)" stroke="#0369a1" stroke-width="1.4"/><circle cx="54" cy="12" r="9" fill="url(#wbGrey3)" stroke="#0369a1" stroke-width="1.4"/>' + (function(){var s='';[28,54].forEach(function(cx){for(var i=0;i<5;i++){var a=i*Math.PI*2/5;s+='<line x1="'+cx+'" y1="12" x2="'+(cx+7*Math.cos(a))+'" y2="'+(12+7*Math.sin(a))+'" stroke="#0369a1" stroke-width="1.4"/>';}});return s;})(); } },
      { t: 'reboiler', n: 'Reboiler', w: 82, h: 48, ports: [P(0, 24, 'w', 'in', 'Liquid In'), P(82, 24, 'e', 'liq', 'Liquid Out'), P(41, 0, 'n', 'vap', 'Vapor Out'), P(20, 48, 's', 'hot-in', 'Steam In')],
        draw: function () { return k3dHCyl(6, 10, 68, 30, 'url(#wbCopper)', '#7c2d12') + '<path d="M14 26 q6 -8 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.5"/><g stroke="#7c2d12" stroke-width="1.4"><line x1="16" y1="34" x2="20" y2="40"/><line x1="30" y1="34" x2="34" y2="40"/><line x1="44" y1="34" x2="48" y2="40"/></g>'; } },
      { t: 'inline-pump', n: 'Inline Centrifugal', w: 54, h: 48, ports: [P(0, 24, 'w', 'in', 'Suction'), P(54, 24, 'e', 'out', 'Discharge')],
        draw: function () { return '<line x1="0" y1="24" x2="54" y2="24" stroke="#3b82f6" stroke-width="10"/><circle cx="27" cy="24" r="14" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><path d="M27 24 L37 18 M27 24 L37 30 M27 24 L17 24" stroke="#fff" stroke-width="2" stroke-linecap="round"/><rect x="22" y="4" width="10" height="8" fill="url(#wbMotor)"/>'; } },
      { t: 'split-case', n: 'Split Case Pump', w: 68, h: 48, ports: [P(0, 34, 'w', 'in', 'Suction'), P(68, 34, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="44" width="54" height="4" fill="#334155"/><ellipse cx="35" cy="28" rx="24" ry="16" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><line x1="11" y1="28" x2="59" y2="28" stroke="#1e3a8a" stroke-width="1"/><circle cx="35" cy="28" r="8" fill="url(#wbSteel)" stroke="#1e40af"/>'; } },
      { t: 'vturbine', n: 'Vertical Turbine', w: 44, h: 66, ports: [P(22, 0, 'n', 'out', 'Discharge'), P(22, 66, 's', 'in', 'Suction')],
        draw: function () { return '<rect x="18" y="4" width="8" height="30" fill="url(#wbSteel)" stroke="#475569" stroke-width="1"/><rect x="10" y="10" width="24" height="8" rx="2" fill="url(#wbBlue3)" stroke="#1e40af"/><rect x="14" y="34" width="16" height="26" rx="6" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><path d="M22 38 v18 M16 46 h12" stroke="#fff" stroke-width="1"/>'; } },
      { t: 'self-prime', n: 'Self-Priming Pump', w: 58, h: 52, ports: [P(0, 20, 'w', 'in', 'Suction'), P(28, 0, 'n', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="48" width="46" height="4" fill="#334155"/><circle cx="30" cy="28" r="18" fill="url(#wbGreen3)" stroke="#15803d" stroke-width="1.5"/><rect x="24" y="6" width="12" height="10" fill="url(#wbGreen3)"/><path d="M30 28 L40 22 M30 28 L40 34 M30 28 L20 28" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'; } },
      { t: 'int-gear', n: 'Internal Gear Pump', w: 58, h: 50, ports: [P(0, 38, 'w', 'in', 'Inlet'), P(58, 38, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="46" width="44" height="4" fill="#334155"/><circle cx="30" cy="26" r="19" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><circle cx="30" cy="26" r="12" fill="none" stroke="#334155" stroke-width="1.5"/><circle cx="34" cy="24" r="7" fill="none" stroke="#334155" stroke-width="1.5"/>'; } },
      { t: 'lobe-pump', n: 'Lobe Pump', w: 60, h: 50, ports: [P(0, 38, 'w', 'in', 'Inlet'), P(60, 38, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="46" width="46" height="4" fill="#334155"/><rect x="8" y="10" width="44" height="30" rx="8" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M22 18 a6 6 0 0 1 0 14 a6 6 0 0 1 0 -14 M38 18 a6 6 0 0 1 0 14 a6 6 0 0 1 0 -14" fill="none" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'screw-pump', n: 'Screw Pump', w: 72, h: 42, ports: [P(0, 22, 'w', 'in', 'Suction'), P(72, 22, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="38" width="56" height="4" fill="#334155"/><rect x="8" y="12" width="56" height="20" rx="10" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><path d="M14 22 q6 -8 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'twin-screw', n: 'Twin Screw Pump', w: 74, h: 46, ports: [P(0, 24, 'w', 'in', 'Suction'), P(74, 24, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="42" width="58" height="4" fill="#334155"/><rect x="8" y="10" width="58" height="26" rx="8" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="1.5"/><path d="M14 18 q6 -6 12 0 t12 0 t12 0 t12 0 M14 28 q6 -6 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#fff" stroke-width="1" opacity="0.6"/>'; } },
      { t: 'pcp', n: 'Progressive Cavity', w: 78, h: 42, ports: [P(0, 22, 'w', 'in', 'Suction'), P(78, 22, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="38" width="62" height="4" fill="#334155"/><rect x="8" y="12" width="62" height="20" rx="10" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><path d="M14 22 q8 -9 16 0 t16 0 t16 0" fill="none" stroke="#b45309" stroke-width="3"/>'; } },
      { t: 'peristaltic', n: 'Peristaltic Pump', w: 54, h: 52, ports: [P(0, 24, 'w', 'in', 'Inlet'), P(54, 24, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="48" width="42" height="4" fill="#334155"/><circle cx="27" cy="26" r="19" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><circle cx="27" cy="26" r="19" fill="none" stroke="#0d9488" stroke-width="3"/><circle cx="27" cy="14" r="3" fill="#334155"/><circle cx="37" cy="32" r="3" fill="#334155"/><circle cx="17" cy="32" r="3" fill="#334155"/>'; } },
      { t: 'diaphragm-pump', n: 'Diaphragm Pump', w: 56, h: 50, ports: [P(0, 38, 'w', 'in', 'Inlet'), P(56, 38, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="46" width="42" height="4" fill="#334155"/><rect x="10" y="18" width="36" height="24" rx="4" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><path d="M28 18 q-10 12 0 24" fill="none" stroke="#fff" stroke-width="2"/><circle cx="28" cy="10" r="5" fill="url(#wbGrey3)"/>'; } },
      { t: 'pneu-diaphragm', n: 'Pneumatic Diaphragm', w: 62, h: 48, ports: [P(0, 34, 'w', 'in', 'Inlet'), P(62, 34, 'e', 'out', 'Outlet'), P(31, 0, 'n', 'in', 'Air')],
        draw: function () { return '<rect x="8" y="44" width="48" height="4" fill="#334155"/><circle cx="18" cy="26" r="13" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><circle cx="44" cy="26" r="13" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="27" y="20" width="8" height="12" fill="url(#wbGrey3)"/>'; } },
      { t: 'plunger-pump', n: 'Plunger Pump', w: 64, h: 46, ports: [P(0, 34, 'w', 'in', 'Inlet'), P(64, 34, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="42" width="50" height="4" fill="#334155"/><rect x="10" y="22" width="30" height="18" rx="2" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="40" y="26" width="18" height="10" fill="url(#wbGrey3)" stroke="#475569"/><circle cx="20" cy="31" r="6" fill="url(#wbSteel)" stroke="#475569"/><line x1="20" y1="31" x2="44" y2="31" stroke="#334155" stroke-width="3"/>'; } },
      { t: 'piston-pump', n: 'Piston Pump', w: 62, h: 46, ports: [P(0, 34, 'w', 'in', 'Inlet'), P(62, 34, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="42" width="48" height="4" fill="#334155"/><rect x="10" y="24" width="34" height="16" rx="2" fill="url(#wbRed3)" stroke="#991b1b" stroke-width="1.5"/><rect x="26" y="26" width="10" height="12" fill="url(#wbGrey3)" stroke="#475569"/><circle cx="18" cy="32" r="6" fill="url(#wbSteel)" stroke="#991b1b"/>'; } },
      { t: 'recip-pump', n: 'Reciprocating Pump', w: 68, h: 48, ports: [P(0, 36, 'w', 'in', 'Suction'), P(68, 36, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="44" width="52" height="4" fill="#334155"/><circle cx="22" cy="30" r="13" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><line x1="22" y1="30" x2="46" y2="24" stroke="#334155" stroke-width="3"/><rect x="44" y="18" width="18" height="14" rx="2" fill="url(#wbRed3)" stroke="#991b1b"/>'; } },
      { t: 'mag-drive', n: 'Magnetic Drive Pump', w: 62, h: 48, ports: [P(0, 22, 'w', 'in', 'Suction'), P(30, 0, 'n', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="44" width="50" height="4" fill="#334155"/><circle cx="30" cy="26" r="17" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="1.5"/><path d="M30 26 L40 20 M30 26 L40 32 M30 26 L20 26" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M22 12 a10 10 0 0 1 16 0" fill="none" stroke="#f59e0b" stroke-width="2"/>'; } },
      { t: 'metering-pump', n: 'Metering / Dosing', w: 54, h: 52, ports: [P(0, 34, 'w', 'in', 'Inlet'), P(54, 34, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="48" width="42" height="4" fill="#334155"/><rect x="10" y="24" width="24" height="18" rx="3" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="34" y="26" width="12" height="14" fill="url(#wbGrey3)" stroke="#475569"/><rect x="14" y="8" width="16" height="12" rx="2" fill="url(#wbGrey3)" stroke="#475569"/><text x="22" y="17" font-size="6" fill="#0f172a" text-anchor="middle">%</text>'; } },
      { t: 'submersible-pump', n: 'Submersible Pump', w: 34, h: 62, ports: [P(34, 46, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="10" y="8" width="14" height="36" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/><path d="M10 44 q0 8 7 8 t7 -8" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.2"/><path d="M17 8 v-4 M14 4 h6" stroke="#334155" stroke-width="1.5"/><path d="M24 20 q8 0 8 8" fill="none" stroke="url(#wbSteel)" stroke-width="5"/>'; } },
      { t: 'slurry-pump', n: 'Slurry Pump', w: 68, h: 56, ports: [P(0, 40, 'w', 'in', 'Suction'), P(30, 0, 'n', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="50" width="54" height="4" fill="#334155"/><circle cx="30" cy="32" r="19" fill="#334155" stroke="#7f1d1d" stroke-width="2.5"/><circle cx="30" cy="32" r="9" fill="url(#wbGrey3)" stroke="#475569"/><rect x="26" y="4" width="10" height="14" fill="url(#wbGrey3)" stroke="#475569"/>'; } },
      { t: 'floating-head', n: 'Floating Head HX', w: 96, h: 46, ports: [P(0, 24, 'w', 'cold-in', 'Tube In'), P(96, 24, 'e', 'cold-out', 'Tube Out'), P(22, 0, 'n', 'hot-in', 'Shell In'), P(74, 46, 's', 'hot-out', 'Shell Out')],
        draw: function () { return '<rect x="10" y="12" width="76" height="24" rx="12" fill="url(#wbSteelH)" stroke="#334155" stroke-width="2"/><rect x="10" y="12" width="9" height="24" fill="#cbd5e1" stroke="#334155"/><path d="M78 14 q10 10 0 20" fill="#e2e8f0" stroke="#334155" stroke-width="1.5"/><path d="M20 24 h56 M30 16 v16 M46 16 v16 M62 16 v16" stroke="#94a3b8" stroke-width="1"/>'; } },
      { t: 'fixed-ts', n: 'Fixed Tubesheet HX', w: 94, h: 44, ports: [P(0, 22, 'w', 'cold-in', 'Tube In'), P(94, 22, 'e', 'cold-out', 'Tube Out'), P(22, 0, 'n', 'hot-in', 'Shell In'), P(72, 44, 's', 'hot-out', 'Shell Out')],
        draw: function () { return '<rect x="8" y="10" width="78" height="24" rx="4" fill="url(#wbSteelH)" stroke="#334155" stroke-width="2"/><rect x="16" y="10" width="4" height="24" fill="#94a3b8"/><rect x="74" y="10" width="4" height="24" fill="#94a3b8"/><path d="M20 22 h54 M32 14 v16 M48 14 v16 M62 14 v16" stroke="#94a3b8" stroke-width="1"/>'; } },
      { t: 'utube-hx', n: 'U-Tube HX', w: 92, h: 44, ports: [P(0, 16, 'w', 'cold-in', 'Tube In'), P(0, 30, 'w', 'cold-out', 'Tube Out'), P(22, 0, 'n', 'hot-in', 'Shell In'), P(72, 44, 's', 'hot-out', 'Shell Out')],
        draw: function () { return '<rect x="8" y="10" width="78" height="24" rx="12" fill="url(#wbSteelH)" stroke="#334155" stroke-width="2"/><path d="M18 16 h56 q10 0 10 6 t-10 6 h-56 M18 22 h50 q4 0 4 0" fill="none" stroke="#64748b" stroke-width="1.5"/>'; } },
      { t: 'spiral-hx', n: 'Spiral HX', w: 56, h: 56, ports: [P(0, 28, 'w', 'cold-in', 'Cold In'), P(56, 28, 'e', 'cold-out', 'Cold Out'), P(28, 0, 'n', 'hot-in', 'Hot In'), P(28, 56, 's', 'hot-out', 'Hot Out')],
        draw: function () { return '<circle cx="28" cy="28" r="24" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M28 28 m0 0 a4 4 0 1 1 6 2 a8 8 0 1 1 -12 4 a12 12 0 1 1 18 6 a16 16 0 1 1 -22 8" fill="none" stroke="#0369a1" stroke-width="1.8"/>'; } },
      { t: 'condenser', n: 'Condenser', w: 88, h: 46, ports: [P(22, 0, 'n', 'vap', 'Vapor In'), P(0, 26, 'w', 'cold-in', 'CW In'), P(88, 26, 'e', 'cold-out', 'CW Out'), P(66, 46, 's', 'liq', 'Condensate')],
        draw: function () { return '<rect x="8" y="12" width="72" height="26" rx="13" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="2"/><path d="M18 20 h54 M18 30 h54" stroke="#93c5fd" stroke-width="1"/><path d="M24 24 q3 4 6 0 t6 0 t6 0" fill="none" stroke="#fff" stroke-width="1" opacity="0.6"/>'; } },
      { t: 'evaporator', n: 'Evaporator', w: 60, h: 62, ports: [P(30, 0, 'n', 'vap', 'Vapor'), P(0, 40, 'w', 'in', 'Feed'), P(30, 62, 's', 'liq', 'Concentrate'), P(60, 24, 'e', 'hot-in', 'Steam')],
        draw: function () { return '<rect x="12" y="10" width="36" height="46" rx="6" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="1.5"/><path d="M14 40 h32" stroke="#3b82f6" stroke-dasharray="3 2"/><path d="M20 46 q3 -6 6 0 t6 0" fill="none" stroke="#0369a1" stroke-width="1.5"/><path d="M22 20 l-2 -8 m8 8 l2 -8" stroke="#93c5fd" stroke-width="1.5"/>'; } },
      { t: 'economizer', n: 'Economizer', w: 78, h: 48, ports: [P(0, 34, 'w', 'in', 'Water In'), P(78, 34, 'e', 'out', 'Water Out'), P(22, 0, 'n', 'hot-in', 'Flue In'), P(60, 48, 's', 'hot-out', 'Flue Out')],
        draw: function () { return '<rect x="8" y="10" width="62" height="30" rx="3" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><path d="M16 14 v22 M24 14 v22 M32 14 v22 M40 14 v22 M48 14 v22 M56 14 v22" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'kettle', n: 'Kettle Reboiler', w: 92, h: 54, ports: [P(0, 40, 'w', 'in', 'Liquid'), P(70, 0, 'n', 'vap', 'Vapor'), P(88, 40, 'e', 'liq', 'Bottoms'), P(30, 54, 's', 'hot-in', 'Steam')],
        draw: function () { return '<path d="M6 24 h30 q6 -14 24 -14 h20 q10 0 10 14 v20 q0 6 -6 6 h-72 q-6 0 -6 -6 Z" fill="url(#wbSteelH)" stroke="#475569" stroke-width="2"/><path d="M10 40 h70" stroke="#2563eb" stroke-dasharray="3 2"/><path d="M20 34 h44" stroke="#64748b" stroke-width="1"/>'; } },
      { t: 'hairpin-hx', n: 'Hairpin HX', w: 90, h: 44, ports: [P(0, 14, 'w', 'cold-in', 'Inner In'), P(0, 30, 'w', 'cold-out', 'Inner Out'), P(20, 0, 'n', 'hot-in', 'Ann In'), P(20, 44, 's', 'hot-out', 'Ann Out')],
        draw: function () { return '<path d="M10 10 h64 q12 0 12 6 t-12 6 h-64 M10 22 h60 q8 0 8 6 t-8 6 h-60" fill="none" stroke="url(#wbSteel)" stroke-width="8"/><path d="M10 10 h64 M10 34 h60" stroke="#64748b" stroke-width="1.5"/>'; } },
      { t: 'finned-tube', n: 'Finned Tube HX', w: 84, h: 46, ports: [P(0, 24, 'w', 'in', 'In'), P(84, 24, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="6" y1="24" x2="78" y2="24" stroke="#d87c41" stroke-width="7"/><g stroke="#b45309" stroke-width="1.5">' + (function(){var s='';for(var i=0;i<14;i++){var x=12+i*5;s+='<line x1="'+x+'" y1="12" x2="'+x+'" y2="36"/>';}return s;})() + '</g>'; } }
    ],
    'Vessels & Tanks': [
      { t: 'v-vessel', n: 'Vertical Vessel', w: 50, h: 78, ports: [P(25, 0, 'n', 'in', 'Feed'), P(25, 78, 's', 'out', 'Product'), P(46, 14, 'e', 'vent', 'Vent'), P(4, 66, 'w', 'drain', 'Drain')],
        draw: function () { return '<path d="M10 20 a15 6 0 0 1 30 0 v42 a15 6 0 0 1 -30 0 Z" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.6"/><ellipse cx="25" cy="20" rx="15" ry="6" fill="#93c5fd" stroke="#1e40af" stroke-width="1.4"/><ellipse cx="25" cy="20" rx="9" ry="3.4" fill="#fff" opacity="0.35"/><rect x="12" y="26" width="6" height="40" rx="3" fill="#fff" opacity="0.22"/><rect x="19" y="70" width="12" height="8" fill="url(#wbGrey3)" stroke="#475569" stroke-width="0.8"/>'; } },
      { t: 'h-vessel', n: 'Horizontal Vessel', w: 90, h: 46, ports: [P(0, 23, 'w', 'in', 'Feed'), P(90, 23, 'e', 'out', 'Product'), P(45, 0, 'n', 'vent', 'Vent'), P(45, 46, 's', 'drain', 'Drain')],
        draw: function () { return '<path d="M20 32 v6 M64 32 v6" stroke="#64748b" stroke-width="4"/>' + k3dHCyl(10, 8, 70, 30, 'url(#wbBlue3)', '#1e40af') + '<path d="M10 23 a10 15 0 0 1 0 0" fill="none"/><ellipse cx="10" cy="23" rx="5" ry="14" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.2"/>'; } },
      { t: 'separator', n: 'Separator / KO Drum', w: 90, h: 50, ports: [P(0, 32, 'w', 'in', 'Feed'), P(90, 12, 'e', 'vap', 'Gas Out'), P(45, 50, 's', 'liq', 'Liquid Out')],
        draw: function () { return '<path d="M22 34 v6 M64 34 v6" stroke="#64748b" stroke-width="4"/>' + k3dHCyl(10, 8, 70, 32, 'url(#wbGasG)', '#0369a1') + '<ellipse cx="10" cy="24" rx="5" ry="15" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="1.2"/><line x1="18" y1="28" x2="74" y2="28" stroke="#fff" stroke-dasharray="3 2" opacity="0.6"/><rect x="40" y="14" width="10" height="8" fill="none" stroke="#0369a1"/>'; } },
      { t: 'atm-tank', n: 'Atmospheric Tank', w: 74, h: 68, ports: [P(0, 56, 'w', 'out', 'Outlet'), P(37, 0, 'n', 'in', 'Fill'), P(66, 12, 'e', 'vent', 'Vent'), P(37, 68, 's', 'drain', 'Drain')],
        draw: function () { return k3dVCyl(10, 12, 54, 50, 'url(#wbBlue3)', '#1e40af') + '<ellipse cx="37" cy="42" rx="20" ry="8" fill="none" stroke="#93c5fd" stroke-width="0.8" opacity="0.5"/>'; } },
      { t: 'cone-tank', n: 'Cone Roof Tank', w: 76, h: 70, ports: [P(0, 58, 'w', 'out', 'Outlet'), P(38, 70, 's', 'drain', 'Drain'), P(38, 2, 'n', 'in', 'Fill'), P(66, 24, 'e', 'vent', 'Vent')],
        draw: function () { return '<path d="M12 24 L38 6 L64 24 Z" fill="#93c5fd" stroke="#1e40af" stroke-width="1.6"/><path d="M12 24 L38 6 L44 9 L20 26 Z" fill="#fff" opacity="0.3"/>' + '<path d="M12 24 v34 a26 6 0 0 0 52 0 v-34 Z" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.6"/><ellipse cx="38" cy="24" rx="26" ry="6" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1"/><rect x="14" y="30" width="6" height="28" rx="3" fill="#fff" opacity="0.22"/>'; } },
      { t: 'bullet', n: 'Bullet Tank', w: 96, h: 42, ports: [P(0, 21, 'w', 'in', 'Inlet'), P(96, 21, 'e', 'out', 'Outlet'), P(48, 0, 'n', 'vent', 'PSV/Vent'), P(24, 42, 's', 'drain', 'Drain')],
        draw: function () { return '<path d="M32 38 v4 M64 38 v4" stroke="#64748b" stroke-width="4"/>' + k3dHCyl(14, 8, 68, 26, 'url(#wbBlue3)', '#1e40af') + '<ellipse cx="14" cy="21" rx="6" ry="12" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.2"/>'; } },
      { t: 'silo', n: 'Silo / Hopper', w: 62, h: 74, ports: [P(31, 0, 'n', 'in', 'Fill'), P(31, 74, 's', 'out', 'Discharge')],
        draw: function () { return k3dVCyl(12, 8, 38, 40, 'url(#wbSteel)', '#475569') + '<path d="M12 48 L31 70 L50 48 Z" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.6"/><path d="M12 48 L31 70 L34 68 L18 49 Z" fill="#fff" opacity="0.2"/>'; } },
      { t: 'flash-drum', n: 'Flash Drum', w: 50, h: 74, ports: [P(0, 40, 'w', 'in', 'Feed'), P(25, 0, 'n', 'vap', 'Vapor'), P(25, 74, 's', 'liq', 'Liquid')],
        draw: function () { return '<rect x="12" y="12" width="26" height="50" fill="url(#wbSteel)" stroke="#475569" stroke-width="2"/><path d="M12 12 q13 -10 26 0 M12 62 q13 10 26 0" fill="url(#wbSteel)" stroke="#475569" stroke-width="2"/><path d="M14 42 h22" stroke="#2563eb" stroke-dasharray="3 2"/>'; } },
      { t: 'ko-drum', n: 'Knock-Out Drum', w: 84, h: 46, ports: [P(0, 30, 'w', 'in', 'Feed'), P(84, 14, 'e', 'vap', 'Gas'), P(42, 46, 's', 'liq', 'Liquid')],
        draw: function () { return '<path d="M14 8 h60 q14 15 0 30 h-60 q-14 -15 0 -30 Z" fill="url(#wbSteelH)" stroke="#475569" stroke-width="2"/><line x1="18" y1="26" x2="72" y2="26" stroke="#2563eb" stroke-dasharray="3 2"/><rect x="38" y="12" width="12" height="8" fill="none" stroke="#64748b"/>'; } },
      { t: 'surge-drum', n: 'Surge Drum', w: 84, h: 44, ports: [P(0, 22, 'w', 'in', 'In'), P(84, 22, 'e', 'out', 'Out'), P(42, 0, 'n', 'vent', 'Vent')],
        draw: function () { return '<path d="M14 8 h60 q14 14 0 28 h-60 q-14 -14 0 -28 Z" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M18 26 h54" stroke="#2563eb" stroke-dasharray="3 2"/>'; } },
      { t: 'receiver', n: 'Receiver', w: 84, h: 42, ports: [P(0, 21, 'w', 'in', 'In'), P(84, 21, 'e', 'out', 'Out'), P(42, 42, 's', 'drain', 'Drain')],
        draw: function () { return '<path d="M18 6 h48 a12 12 0 0 1 0 30 h-48 a12 12 0 0 1 0 -30 Z" fill="url(#wbSteelH)" stroke="#475569" stroke-width="2"/><path d="M18 22 h48" stroke="#94a3b8" stroke-dasharray="3 2"/>'; } },
      { t: 'accumulator', n: 'Accumulator', w: 46, h: 68, ports: [P(23, 0, 'n', 'in', 'In'), P(23, 68, 's', 'out', 'Out')],
        draw: function () { return '<rect x="12" y="12" width="22" height="44" rx="2" fill="url(#wbSteel)" stroke="#475569" stroke-width="2"/><path d="M12 12 q11 -9 22 0 M12 56 q11 9 22 0" fill="url(#wbSteel)" stroke="#475569" stroke-width="2"/><path d="M14 30 q9 6 18 0" fill="none" stroke="#3b82f6" stroke-width="1.5"/>'; } },
      { t: 'air-receiver', n: 'Air Receiver', w: 46, h: 70, ports: [P(0, 20, 'w', 'in', 'Air In'), P(46, 20, 'e', 'out', 'Air Out'), P(23, 70, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="12" y="10" width="22" height="50" rx="2" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="2"/><path d="M12 10 q11 -8 22 0 M12 60 q11 8 22 0" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="2"/><circle cx="23" cy="8" r="3" fill="url(#wbGrey3)"/>'; } },
      { t: 'vacuum-vessel', n: 'Vacuum Vessel', w: 50, h: 70, ports: [P(0, 24, 'w', 'in', 'Process'), P(25, 0, 'n', 'vap', 'To Vacuum')],
        draw: function () { return '<rect x="12" y="12" width="26" height="46" fill="url(#wbGrey3)" stroke="#334155" stroke-width="2"/><path d="M12 12 q13 -10 26 0 M12 58 q13 10 26 0" fill="url(#wbGrey3)" stroke="#334155" stroke-width="2"/><text x="25" y="38" font-size="8" fill="#334155" text-anchor="middle" font-family="Arial">VAC</text>'; } },
      { t: 'fixed-roof', n: 'Fixed Roof Tank', w: 74, h: 62, ports: [P(0, 52, 'w', 'out', 'Outlet'), P(37, 0, 'n', 'in', 'Fill'), P(37, 62, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="10" y="14" width="52" height="46" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M10 14 q26 -10 52 0" fill="#93c5fd" stroke="#1e40af" stroke-width="2"/><path d="M12 42 h48" stroke="#3b82f6" stroke-dasharray="3 2"/>'; } },
      { t: 'floating-roof', n: 'Floating Roof Tank', w: 76, h: 60, ports: [P(0, 50, 'w', 'out', 'Outlet'), P(38, 60, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="10" y="12" width="56" height="46" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><rect x="14" y="22" width="48" height="6" rx="2" fill="url(#wbSteel)" stroke="#475569"/><path d="M14 40 h48" stroke="#3b82f6" stroke-dasharray="3 2"/>'; } },
      { t: 'spherical', n: 'Spherical Tank', w: 62, h: 66, ports: [P(31, 4, 'n', 'in', 'In'), P(31, 62, 's', 'out', 'Out')],
        draw: function () { return '<circle cx="31" cy="34" r="26" fill="url(#wbSphere)" stroke="#475569" stroke-width="2"/><path d="M5 34 h52 M31 8 v52" stroke="#94a3b8" stroke-width="0.8"/><g stroke="#334155" stroke-width="2"><line x1="14" y1="56" x2="10" y2="64"/><line x1="31" y1="60" x2="31" y2="66"/><line x1="48" y1="56" x2="52" y2="64"/></g>'; } },
      { t: 'cryo-tank', n: 'Cryogenic Tank', w: 50, h: 72, ports: [P(0, 24, 'w', 'in', 'Fill'), P(25, 72, 's', 'out', 'Out'), P(25, 0, 'n', 'vent', 'Vent')],
        draw: function () { return '<rect x="10" y="10" width="30" height="52" rx="14" fill="url(#wbSteelH)" stroke="#475569" stroke-width="2"/><rect x="15" y="16" width="20" height="40" rx="10" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1"/><text x="25" y="40" font-size="7" fill="#fff" text-anchor="middle" font-family="Arial">LNG</text>'; } },
      { t: 'api650', n: 'API 650 Tank', w: 78, h: 58, ports: [P(0, 48, 'w', 'out', 'Outlet'), P(39, 58, 's', 'drain', 'Drain'), P(66, 12, 'e', 'vent', 'Vent')],
        draw: function () { return '<rect x="10" y="14" width="58" height="42" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><ellipse cx="39" cy="14" rx="29" ry="5" fill="#93c5fd" stroke="#1e40af" stroke-width="2"/><text x="39" y="38" font-size="8" fill="#1e3a8a" text-anchor="middle" font-family="Arial">API650</text>'; } },
      { t: 'api620', n: 'API 620 Tank', w: 74, h: 60, ports: [P(0, 48, 'w', 'out', 'Outlet'), P(37, 0, 'n', 'vap', 'Vapor'), P(37, 60, 's', 'drain', 'Drain')],
        draw: function () { return '<path d="M10 24 q27 -18 54 0 v30 h-54 Z" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><ellipse cx="37" cy="54" rx="27" ry="5" fill="#60a5fa" stroke="#1e40af" stroke-width="2"/><text x="37" y="42" font-size="8" fill="#1e3a8a" text-anchor="middle" font-family="Arial">API620</text>'; } },
      { t: 'ss-tank', n: 'SS Process Tank', w: 52, h: 66, ports: [P(37, 0, 'n', 'in', 'Fill'), P(26, 66, 's', 'out', 'Out'), P(0, 24, 'w', 'in', 'Feed')],
        draw: function () { return '<rect x="12" y="12" width="28" height="44" rx="3" fill="url(#wbSteel)" stroke="#475569" stroke-width="2"/><path d="M12 12 q14 -9 28 0 M12 56 q14 9 28 0" fill="url(#wbSteel)" stroke="#475569" stroke-width="2"/><ellipse cx="20" cy="24" rx="3" ry="16" fill="#fff" opacity="0.4"/>'; } },
      { t: 'mixing-tank', n: 'Mixing Tank', w: 60, h: 66, ports: [P(30, 0, 'n', 'in', 'Feed'), P(0, 26, 'w', 'in', 'Add'), P(30, 66, 's', 'out', 'Product')],
        draw: function () { return '<rect x="12" y="14" width="36" height="42" rx="4" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M14 40 h32" stroke="#3b82f6" stroke-dasharray="3 2"/><line x1="30" y1="2" x2="30" y2="46" stroke="#475569" stroke-width="2.5"/><path d="M22 46 h16 M25 40 l10 0" stroke="#475569" stroke-width="2.5"/><rect x="26" y="0" width="8" height="6" fill="url(#wbMotor)"/>'; } }
    ],
    'Columns & Reactors': [
      { t: 'column', n: 'Distillation Column', w: 48, h: 88, ports: [P(24, 0, 'n', 'vap', 'Overhead'), P(0, 44, 'w', 'in', 'Feed'), P(48, 30, 'e', 'recycle', 'Reflux'), P(24, 88, 's', 'liq', 'Bottoms')],
        draw: function () { return '<rect x="12" y="10' + '" width="24" height="68" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M12 10 q12 -9 24 0 M12 78 q12 9 24 0" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M14 24 h20 M14 34 h20 M14 44 h20 M14 54 h20 M14 64 h20" stroke="#6d28d9" stroke-width="1"/><rect x="18" y="80" width="12" height="8" fill="#a78bda"/>'; } },
      { t: 'absorber', n: 'Absorber / Stripper', w: 48, h: 88, ports: [P(24, 0, 'n', 'vap', 'Gas Out'), P(0, 64, 'w', 'in', 'Gas In'), P(48, 18, 'e', 'in', 'Solvent In'), P(24, 88, 's', 'liq', 'Rich Out')],
        draw: function () { return '<rect x="12" y="10" width="24" height="68" fill="#f0fdfa" stroke="#0f766e" stroke-width="2"/><path d="M12 10 q12 -9 24 0 M12 78 q12 9 24 0" fill="#f0fdfa" stroke="#0f766e" stroke-width="2"/><g fill="#0f766e">' + (function(){var s='';for(var i=0;i<12;i++){s+='<circle cx="'+(17+(i%3)*7)+'" cy="'+(26+Math.floor(i/3)*12)+'" r="2"/>';}return s;})() + '</g>'; } },
      { t: 'cstr', n: 'CSTR', w: 62, h: 66, ports: [P(31, 0, 'n', 'in', 'Feed'), P(0, 32, 'w', 'recycle', 'Recycle'), P(62, 32, 'e', 'out', 'Product'), P(31, 66, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="12" y="12" width="38" height="42" rx="6" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><path d="M12 40 h38" stroke="#b45309" stroke-width="1" stroke-dasharray="3 2"/><line x1="31" y1="4" x2="31" y2="34" stroke="#78350f" stroke-width="2.5"/><path d="M20 34 h22 M23 40 l16 0" stroke="#78350f" stroke-width="2.5"/><rect x="26" y="2" width="10" height="6" fill="#78350f"/>'; } },
      { t: 'pfr', n: 'PFR / Tubular', w: 92, h: 36, ports: [P(0, 18, 'w', 'in', 'Feed'), P(92, 18, 'e', 'out', 'Product')],
        draw: function () { return '<rect x="6" y="8" width="80" height="20" rx="10" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><path d="M12 18 q10 -8 20 0 t20 0 t20 0" fill="none" stroke="#b45309" stroke-width="1.5"/>'; } },
      { t: 'pbr', n: 'Packed Bed Reactor', w: 54, h: 78, ports: [P(27, 0, 'n', 'in', 'Feed'), P(27, 78, 's', 'out', 'Product'), P(52, 20, 'e', 'recycle', 'Recycle')],
        draw: function () { return '<rect x="12" y="8" width="30" height="62" fill="#fefce8" stroke="#a16207" stroke-width="2"/><path d="M12 8 q15 -6 30 0 M12 70 q15 6 30 0" fill="#fefce8" stroke="#a16207" stroke-width="2"/><g fill="#a16207">' + (function(){var s='';for(var i=0;i<21;i++){s+='<circle cx="'+(17+(i%3)*9)+'" cy="'+(20+Math.floor(i/3)*8)+'" r="2.2"/>';}return s;})() + '</g>'; } },
      { t: 'fbr', n: 'Fluidized Bed Reactor', w: 54, h: 78, ports: [P(27, 0, 'n', 'vap', 'Gas Out'), P(27, 78, 's', 'in', 'Gas In'), P(0, 30, 'w', 'in', 'Solids')],
        draw: function () { return '<rect x="12" y="8" width="30" height="62" rx="4" fill="url(#wbRxG)" stroke="#b45309" stroke-width="1.5"/><g fill="#b45309" opacity="0.7">' + (function(){var s='';for(var i=0;i<24;i++){s+='<circle cx="'+(16+Math.random()*22)+'" cy="'+(30+Math.random()*36)+'" r="1.6"/>';}return s;})() + '</g><path d="M14 66 h26" stroke="#78350f" stroke-width="1"/>'; } },
      { t: 'batch-rx', n: 'Batch Reactor', w: 60, h: 66, ports: [P(30, 0, 'n', 'in', 'Charge'), P(30, 66, 's', 'out', 'Discharge'), P(56, 22, 'e', 'hot-in', 'Jacket')],
        draw: function () { return '<rect x="12" y="12" width="36" height="40" rx="6" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><path d="M12 12 q18 -10 36 0 M12 52 q18 10 36 0" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><line x1="30" y1="2" x2="30" y2="40" stroke="#78350f" stroke-width="2.5"/><path d="M22 40 h16" stroke="#78350f" stroke-width="2.5"/>'; } },
      { t: 'semibatch-rx', n: 'Semi-Batch Reactor', w: 60, h: 66, ports: [P(30, 0, 'n', 'in', 'Charge'), P(0, 24, 'w', 'in', 'Feed'), P(30, 66, 's', 'out', 'Product')],
        draw: function () { return '<rect x="12" y="12" width="36" height="40" rx="6" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><path d="M12 12 q18 -10 36 0 M12 52 q18 10 36 0" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><line x1="30" y1="2" x2="30" y2="40" stroke="#78350f" stroke-width="2.5"/><path d="M22 40 h16" stroke="#78350f" stroke-width="2.5"/><path d="M4 24 h10" stroke="#0369a1" stroke-width="2"/>'; } },
      { t: 'slurry-rx', n: 'Slurry Reactor', w: 56, h: 66, ports: [P(28, 0, 'n', 'vap', 'Gas'), P(0, 24, 'w', 'in', 'Feed'), P(28, 66, 's', 'out', 'Slurry')],
        draw: function () { return '<rect x="12" y="10" width="32" height="48" rx="6" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><g fill="#78350f" opacity="0.5">' + (function(){var s='';for(var i=0;i<16;i++){s+='<circle cx="'+(16+Math.random()*24)+'" cy="'+(24+Math.random()*30)+'" r="1.4"/>';}return s;})() + '</g><line x1="28" y1="2" x2="28" y2="46" stroke="#78350f" stroke-width="2"/><path d="M22 46 h12" stroke="#78350f" stroke-width="2"/>'; } },
      { t: 'bubble-col', n: 'Bubble Column', w: 44, h: 82, ports: [P(22, 0, 'n', 'vap', 'Gas Out'), P(22, 82, 's', 'in', 'Gas In'), P(0, 24, 'w', 'in', 'Liquid')],
        draw: function () { return '<rect x="12" y="8" width="20" height="66" rx="4" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="1.5"/><g fill="#fff" opacity="0.7">' + (function(){var s='';for(var i=0;i<14;i++){s+='<circle cx="'+(17+Math.random()*10)+'" cy="'+(20+i*4)+'" r="'+(1+Math.random())+'"/>';}return s;})() + '</g>'; } },
      { t: 'loop-rx', n: 'Loop Reactor', w: 58, h: 68, ports: [P(0, 20, 'w', 'in', 'Feed'), P(58, 48, 'e', 'out', 'Product')],
        draw: function () { return '<rect x="14" y="10" width="14" height="48" rx="7" fill="url(#wbRxG)" stroke="#b45309" stroke-width="1.5"/><rect x="32" y="10" width="14" height="48" rx="7" fill="url(#wbRxG)" stroke="#b45309" stroke-width="1.5"/><path d="M21 10 q9 -8 18 0 M21 58 q9 8 18 0" fill="none" stroke="#b45309" stroke-width="2"/><path d="M28 30 l6 4 -6 4" fill="#78350f"/>'; } },
      { t: 'cat-rx', n: 'Catalytic Reactor', w: 54, h: 76, ports: [P(27, 0, 'n', 'in', 'Feed'), P(27, 76, 's', 'out', 'Product')],
        draw: function () { return '<rect x="12" y="8" width="30" height="60" rx="4" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><rect x="16" y="18" width="22" height="14" fill="#d4a017" opacity="0.5"/><rect x="16" y="44" width="22" height="14" fill="#d4a017" opacity="0.5"/><g fill="#78350f">' + (function(){var s='';for(var i=0;i<12;i++){s+='<circle cx="'+(19+(i%4)*6)+'" cy="'+(22+Math.floor(i/4)*4)+'" r="1.4"/>';}return s;})() + '</g>'; } },
      { t: 'stripper', n: 'Stripper', w: 46, h: 84, ports: [P(23, 0, 'n', 'vap', 'Overhead'), P(0, 20, 'w', 'in', 'Feed'), P(23, 84, 's', 'liq', 'Stripped'), P(46, 66, 'e', 'hot-in', 'Steam')],
        draw: function () { return '<rect x="12" y="10" width="22" height="66" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M12 10 q11 -8 22 0 M12 76 q11 8 22 0" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M14 26 h18 M14 40 h18 M14 54 h18 M14 66 h18" stroke="#6d28d9" stroke-width="1"/>'; } },
      { t: 'packed-col', n: 'Packed Column', w: 46, h: 84, ports: [P(23, 0, 'n', 'vap', 'Vapor'), P(0, 60, 'w', 'in', 'Feed'), P(46, 20, 'e', 'in', 'Reflux'), P(23, 84, 's', 'liq', 'Bottoms')],
        draw: function () { return '<rect x="12" y="10" width="22" height="66" fill="#f5f3ff" stroke="#6d28d9" stroke-width="2"/><path d="M12 10 q11 -8 22 0 M12 76 q11 8 22 0" fill="#f5f3ff" stroke="#6d28d9" stroke-width="2"/><g stroke="#8b5cf6" stroke-width="1">' + (function(){var s='';for(var i=0;i<20;i++){s+='<line x1="'+(15+(i%3)*7)+'" y1="'+(24+Math.floor(i/3)*8)+'" x2="'+(19+(i%3)*7)+'" y2="'+(28+Math.floor(i/3)*8)+'"/>';}return s;})() + '</g>'; } },
      { t: 'tray-col', n: 'Tray Column', w: 46, h: 84, ports: [P(23, 0, 'n', 'vap', 'Vapor'), P(0, 44, 'w', 'in', 'Feed'), P(23, 84, 's', 'liq', 'Bottoms')],
        draw: function () { return '<rect x="12" y="10" width="22" height="66" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M12 10 q11 -8 22 0 M12 76 q11 8 22 0" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M14 22 h18 M32 22 v4 M14 34 h18 M14 34 v4 M14 46 h18 M32 46 v4 M14 58 h18 M14 58 v4" stroke="#6d28d9" stroke-width="1.2"/>'; } },
      { t: 'fractionator', n: 'Fractionator', w: 50, h: 86, ports: [P(25, 0, 'n', 'vap', 'Overhead'), P(0, 60, 'w', 'in', 'Feed'), P(50, 24, 'e', 'out', 'Side Draw'), P(25, 86, 's', 'liq', 'Bottoms')],
        draw: function () { return '<rect x="13" y="10" width="24" height="68" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M13 10 q12 -8 24 0 M13 78 q12 8 24 0" fill="url(#wbColG)" stroke="#6d28d9" stroke-width="2"/><path d="M15 22 h20 M15 34 h20 M15 46 h20 M15 58 h20 M15 68 h20" stroke="#6d28d9" stroke-width="1"/>'; } },
      { t: 'deaerator', n: 'Deaerator', w: 78, h: 54, ports: [P(0, 20, 'w', 'in', 'Water In'), P(39, 0, 'n', 'vap', 'Vent'), P(60, 4, 'n', 'hot-in', 'Steam'), P(39, 54, 's', 'out', 'BFW Out')],
        draw: function () { return '<rect x="24" y="6" width="30" height="20" rx="10" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M10 26 h58 a10 10 0 0 1 0 20 h-58 a10 10 0 0 1 0 -20 Z" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M14 40 h50" stroke="#2563eb" stroke-dasharray="3 2"/>'; } },
      { t: 'scrubber', n: 'Scrubber', w: 46, h: 82, ports: [P(23, 0, 'n', 'vap', 'Clean Gas'), P(0, 62, 'w', 'in', 'Dirty Gas'), P(46, 16, 'e', 'in', 'Water'), P(23, 82, 's', 'liq', 'Effluent')],
        draw: function () { return '<rect x="12" y="10" width="22" height="64" fill="#ecfeff" stroke="#0891b2" stroke-width="2"/><path d="M12 10 q11 -8 22 0 M12 74 q11 8 22 0" fill="#ecfeff" stroke="#0891b2" stroke-width="2"/><path d="M16 24 l4 6 m4 -6 l4 6 m4 -6 l4 6" stroke="#22d3ee" stroke-width="1.5"/><g fill="#0891b2" opacity="0.5"><circle cx="20" cy="46" r="2"/><circle cx="28" cy="52" r="2"/><circle cx="22" cy="58" r="2"/></g>'; } },
      { t: 'demister-col', n: 'Demister Column', w: 46, h: 76, ports: [P(23, 0, 'n', 'vap', 'Gas Out'), P(0, 52, 'w', 'in', 'Feed'), P(23, 76, 's', 'liq', 'Liquid')],
        draw: function () { return '<rect x="12" y="10" width="22" height="58" rx="4" fill="url(#wbSteelH)" stroke="#475569" stroke-width="2"/><rect x="14" y="18" width="18" height="7" fill="#cbd5e1" stroke="#64748b" stroke-width="0.5"/><path d="M14 18 l18 7 M14 25 l18 -7" stroke="#94a3b8" stroke-width="0.5"/>'; } },
      { t: 'extraction-col', n: 'Extraction Column', w: 46, h: 84, ports: [P(23, 0, 'n', 'out', 'Light Out'), P(0, 16, 'w', 'in', 'Heavy In'), P(46, 66, 'e', 'in', 'Solvent'), P(23, 84, 's', 'out', 'Heavy Out')],
        draw: function () { return '<rect x="12" y="10" width="22" height="66" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="2" opacity="0.85"/><path d="M12 10 q11 -8 22 0 M12 76 q11 8 22 0" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="2"/><path d="M14 28 h18 M14 42 h18 M14 56 h18" stroke="#0f766e" stroke-width="1"/>'; } }
    ],
    'Valves': [
      { t: 'gate', n: 'Gate Valve', w: 58, h: 76, ports: [P(0, 56, 'w', 'in', 'In'), P(58, 56, 'e', 'out', 'Out')],
        draw: function () { return vkWheel(29, 13, 13, '#2563eb') + vkStem(29, 18, 36) + vkBonnet(29, 44, 9, 9) + vkBody(29, 56, 21, 'url(#wbSteel)', '#475569') + vkFlange(2, 56, 28) + vkFlange(51, 56, 28); } },
      { t: 'ball', n: 'Ball Valve', w: 62, h: 54, ports: [P(0, 38, 'w', 'in', 'In'), P(62, 38, 'e', 'out', 'Out')],
        draw: function () { return vkFlange(2, 38, 26) + vkFlange(55, 38, 26) + '<rect x="9" y="29" width="44" height="18" rx="9" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.4"/><ellipse cx="22" cy="33" rx="10" ry="2.5" fill="#fff" opacity="0.5"/><rect x="25" y="20" width="12" height="9" rx="1.5" fill="url(#wbSteel)" stroke="#475569" stroke-width="0.8"/><circle cx="29" cy="24" r="1.2" fill="#334155"/><circle cx="34" cy="24" r="1.2" fill="#334155"/><path d="M31 21 L52 8" stroke="#dc2626" stroke-width="4.5" stroke-linecap="round"/><path d="M31 21 L52 8" stroke="#fca5a5" stroke-width="1.4" stroke-linecap="round"/>'; } },
      { t: 'globe', n: 'Globe Valve', w: 58, h: 78, ports: [P(0, 58, 'w', 'in', 'In'), P(58, 58, 'e', 'out', 'Out')],
        draw: function () { return vkWheel(29, 13, 13, '#1e293b') + vkStem(29, 18, 34) + vkBonnet(29, 44, 9, 9) + '<circle cx="29" cy="58" r="14" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.4"/><ellipse cx="24" cy="52" rx="5" ry="3" fill="#fff" opacity="0.4"/>' + '<rect x="7" y="52" width="9" height="12" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1"/><rect x="42" y="52" width="9" height="12" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1"/>' + vkFlange(2, 58, 28) + vkFlange(51, 58, 28); } },
      { t: 'butterfly', n: 'Butterfly Valve', w: 58, h: 68, ports: [P(0, 40, 'w', 'in', 'In'), P(58, 40, 'e', 'out', 'Out')],
        draw: function () { return '<circle cx="29" cy="40" r="21" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.6"/>' + (function(){var s='';for(var i=0;i<8;i++){var a=i*Math.PI/4+Math.PI/8;s+='<circle cx="'+(29+17*Math.cos(a))+'" cy="'+(40+17*Math.sin(a))+'" r="2.4" fill="url(#wbSteel)" stroke="#334155" stroke-width="0.7"/>';}return s;})() + '<circle cx="29" cy="40" r="11" fill="url(#wbSteelH)" stroke="#334155" stroke-width="1.2"/><line x1="21" y1="33" x2="37" y2="47" stroke="#1e293b" stroke-width="3"/><rect x="21" y="6" width="16" height="13" rx="2.5" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1"/><circle cx="25" cy="10" r="1" fill="#0f172a"/><circle cx="33" cy="10" r="1" fill="#0f172a"/>' + vkWheel(48, 12, 8, '#374151'); } },
      { t: 'check', n: 'Check Valve', w: 58, h: 50, ports: [P(0, 34, 'w', 'in', 'In'), P(58, 34, 'e', 'out', 'Out')],
        draw: function () { return vkFlange(2, 34, 26) + vkFlange(51, 34, 26) + '<rect x="9" y="26" width="40" height="16" rx="8" fill="url(#wbBrass)" stroke="#92600a" stroke-width="1.4"/><ellipse cx="22" cy="30" rx="9" ry="2" fill="#fff" opacity="0.45"/><path d="M24 14 h10 l-2 12 h-6 Z" fill="url(#wbBrass)" stroke="#92600a" stroke-width="1"/><circle cx="18" cy="34" r="2.5" fill="#78350f"/><path d="M18 34 L34 24" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>'; } },
      { t: 'control', n: 'Control Valve', w: 58, h: 80, ports: [P(0, 62, 'w', 'in', 'In'), P(58, 62, 'e', 'out', 'Out'), P(29, 0, 'n', 'signal', 'Signal')],
        draw: function () { return '<path d="M12 22 a17 11 0 0 1 34 0 Z" fill="url(#wbGreen3)" stroke="#15803d" stroke-width="1.4"/><path d="M12 22 h34 l-3 6 h-28 Z" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1"/><ellipse cx="23" cy="15" rx="7" ry="3" fill="#fff" opacity="0.4"/>' + vkStem(29, 28, 44) + vkBonnet(29, 50, 8, 7) + vkBody(29, 62, 21, 'url(#wbSteel)', '#475569') + vkFlange(2, 62, 28) + vkFlange(51, 62, 28); } },
      { t: 'psv', n: 'PSV / Relief', w: 50, h: 66, ports: [P(0, 50, 'w', 'in', 'In'), P(25, 0, 'n', 'vent', 'Vent')],
        draw: function () { return '<rect x="21" y="6" width="8" height="14" fill="url(#wbSteelH)" stroke="#475569" stroke-width="0.8"/><path d="M17 20 q8 -7 16 0" fill="none" stroke="#475569" stroke-width="2"/><path d="M15 22 h20 l-2 12 h-16 Z" fill="url(#wbRed3)" stroke="#7f1d1d" stroke-width="1.2"/><path d="M14 34 h22 v14 h-22 Z" fill="url(#wbRed3)" stroke="#7f1d1d" stroke-width="1.4"/><ellipse cx="21" cy="38" rx="5" ry="2" fill="#fff" opacity="0.35"/>' + vkFlange(2, 50, 22) + '<rect x="7" y="45" width="8" height="10" fill="url(#wbRed3)" stroke="#7f1d1d" stroke-width="1"/><line x1="38" y1="26" x2="44" y2="20" stroke="#7f1d1d" stroke-width="2"/>'; } },
      { t: '3way', n: 'Three-way Valve', w: 58, h: 66, ports: [P(0, 40, 'w', 'in', 'In'), P(58, 40, 'e', 'out', 'Out A'), P(29, 66, 's', 'out', 'Out B')],
        draw: function () { return vkWheel(29, 10, 11, '#0d9488') + vkStem(29, 15, 26) + vkBody(29, 40, 21, 'url(#wbTeal3)', '#0f766e') + '<path d="M22 62 L36 62 L29 44 Z" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="1.4"/>' + vkFlange(2, 40, 26) + vkFlange(51, 40, 26) + '<rect x="22" y="59" width="14" height="4" rx="1" fill="url(#wbSteelH)" stroke="#0f766e" stroke-width="0.8"/>'; } },
      { t: 'needle', n: 'Needle Valve', w: 54, h: 64, ports: [P(0, 46, 'w', 'in', 'In'), P(54, 46, 'e', 'out', 'Out')],
        draw: function () { return '<circle cx="27" cy="10" r="7" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.2"/><circle cx="25" cy="8" r="2" fill="#94a3b8"/>' + vkStem(27, 16, 32) + vkBonnet(27, 38, 7, 6) + vkBody(27, 46, 19, 'url(#wbGrey3)', '#334155') + '<path d="M27 38 L29.5 46 L27 46 Z" fill="#0f172a"/>' + vkFlange(2, 46, 24) + vkFlange(47, 46, 24); } },
      { t: 'plug-valve', n: 'Plug Valve', w: 40, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(40, 16, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 6 L4 26 L20 16 Z M36 6 L36 26 L20 16 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><rect x="16" y="10" width="8" height="12" fill="url(#wbBrass)" stroke="#92600a"/>'; } },
      { t: 'diaphragm-valve', n: 'Diaphragm Valve', w: 40, h: 40, ports: [P(0, 28, 'w', 'in', 'In'), P(40, 28, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="28" x2="38" y2="28" stroke="#9ca3af" stroke-width="7"/><path d="M12 28 q8 -12 16 0" fill="none" stroke="#0d9488" stroke-width="3"/><rect x="16" y="6" width="8" height="12" fill="url(#wbSteel)" stroke="#475569"/><circle cx="20" cy="6" r="4" fill="url(#wbGrey3)"/>'; } },
      { t: 'pinch-valve', n: 'Pinch Valve', w: 40, h: 36, ports: [P(0, 20, 'w', 'in', 'In'), P(40, 20, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M2 14 h14 q4 6 8 0 h14 M2 26 h14 q4 -6 8 0 h14" fill="none" stroke="url(#wbTeal3)" stroke-width="4"/><rect x="16" y="2" width="8" height="8" fill="url(#wbGrey3)"/>'; } },
      { t: 'swing-check', n: 'Swing Check Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="16" x2="40" y2="16" stroke="#9ca3af" stroke-width="7"/><circle cx="14" cy="16" r="3" fill="#334155"/><path d="M14 16 L26 6" stroke="url(#wbBrass)" stroke-width="3"/>'; } },
      { t: 'lift-check', n: 'Lift Check Valve', w: 40, h: 34, ports: [P(0, 20, 'w', 'in', 'In'), P(40, 20, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="20" x2="38" y2="20" stroke="#9ca3af" stroke-width="7"/><path d="M14 20 L20 10 L26 20 Z" fill="url(#wbBrass)" stroke="#92600a"/>'; } },
      { t: 'wafer-check', n: 'Wafer Check Valve', w: 34, h: 34, ports: [P(0, 17, 'w', 'in', 'In'), P(34, 17, 'e', 'out', 'Out')],
        draw: function () { return '<circle cx="17" cy="17" r="12" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M17 6 v22" stroke="#334155" stroke-width="1"/><path d="M17 6 L23 12 M17 28 L11 22" stroke="#0d9488" stroke-width="2"/>'; } },
      { t: 'dual-check', n: 'Dual Plate Check', w: 34, h: 34, ports: [P(0, 17, 'w', 'in', 'In'), P(34, 17, 'e', 'out', 'Out')],
        draw: function () { return '<circle cx="17" cy="17" r="12" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M17 6 v22 M17 8 L9 14 M17 8 L25 14" stroke="#0d9488" stroke-width="1.8"/>'; } },
      { t: 'prv', n: 'Pressure Reducing', w: 42, h: 46, ports: [P(0, 32, 'w', 'in', 'In'), P(42, 32, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 22 L4 42 L21 32 Z M38 22 L38 42 L21 32 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><path d="M21 22 q-8 -10 0 -18" fill="none" stroke="#475569" stroke-width="2"/><circle cx="14" cy="6" r="5" fill="url(#wbSteel)" stroke="#475569"/>'; } },
      { t: 'safety-valve', n: 'Safety Valve', w: 40, h: 48, ports: [P(0, 38, 'w', 'in', 'In'), P(20, 0, 'n', 'vent', 'Vent')],
        draw: function () { return '<path d="M8 30 L8 44 L28 44 L28 30 Z" fill="url(#wbRed3)" stroke="#7f1d1d" stroke-width="1.5"/><path d="M18 30 L18 8 M12 12 L24 12" stroke="#7f1d1d" stroke-width="2"/><path d="M14 8 q4 -6 8 0" fill="none" stroke="#475569" stroke-width="2"/>'; } },
      { t: 'solenoid-valve', n: 'Solenoid Valve', w: 40, h: 46, ports: [P(0, 34, 'w', 'in', 'In'), P(40, 34, 'e', 'out', 'Out'), P(20, 0, 'n', 'signal', 'Coil')],
        draw: function () { return '<path d="M4 24 L4 44 L21 34 Z M38 24 L38 44 L21 34 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><rect x="12" y="4" width="18" height="14" rx="2" fill="url(#wbBlue3)" stroke="#1e40af"/><text x="21" y="14" font-size="7" fill="#fff" text-anchor="middle" font-family="Arial">S</text>'; } },
      { t: 'cryo-valve', n: 'Cryogenic Valve', w: 40, h: 52, ports: [P(0, 40, 'w', 'in', 'In'), P(40, 40, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 30 L4 50 L21 40 Z M38 30 L38 50 L21 40 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><rect x="18" y="8" width="6" height="24" fill="url(#wbSteel)" stroke="#475569"/><circle cx="21" cy="6" r="6" fill="url(#wbBlue3)" stroke="#1e40af"/>'; } },
      { t: 'knife-gate', n: 'Knife Gate Valve', w: 40, h: 46, ports: [P(0, 30, 'w', 'in', 'In'), P(40, 30, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="30" x2="38" y2="30" stroke="#9ca3af" stroke-width="8"/><rect x="17" y="6" width="6" height="26" fill="url(#wbSteel)" stroke="#475569" stroke-width="1"/><path d="M17 32 L23 32 L20 38 Z" fill="#334155"/><rect x="14" y="2" width="12" height="5" fill="#334155"/>'; } },
      { t: 'foot-valve', n: 'Foot Valve', w: 36, h: 44, ports: [P(18, 0, 'n', 'out', 'Suction')],
        draw: function () { return '<rect x="10" y="8" width="16" height="20" rx="2" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><path d="M10 28 L18 40 L26 28" fill="none" stroke="#475569" stroke-width="1.5"/><path d="M12 30 h12 M14 34 h8" stroke="#64748b" stroke-width="1"/>'; } },
      { t: 'flush-bottom', n: 'Flush Bottom Valve', w: 42, h: 40, ports: [P(21, 0, 'n', 'in', 'Vessel'), P(42, 30, 'e', 'out', 'Drain')],
        draw: function () { return '<path d="M6 4 h30 l-6 14 h-18 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M12 18 L12 30 L30 30 L30 18" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><line x1="30" y1="30" x2="40" y2="30" stroke="#475569" stroke-width="3"/>'; } },
      { t: 'sampling-valve', n: 'Sampling Valve', w: 36, h: 42, ports: [P(0, 16, 'w', 'in', 'Process'), P(18, 42, 's', 'out', 'Sample')],
        draw: function () { return '<line x1="2" y1="16" x2="30" y2="16" stroke="#9ca3af" stroke-width="6"/><path d="M18 16 L18 34" stroke="url(#wbSteel)" stroke-width="5"/><circle cx="18" cy="12" r="4" fill="url(#wbBrass)" stroke="#92600a"/><path d="M14 34 h8 l-2 6 h-4 Z" fill="#94a3b8"/>'; } },
      { t: 'angle-valve', n: 'Angle Valve', w: 40, h: 42, ports: [P(0, 30, 'w', 'in', 'In'), P(28, 0, 'n', 'out', 'Out')],
        draw: function () { return '<path d="M4 20 L4 40 L21 30 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><path d="M18 28 L38 28 L28 12 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><circle cx="14" cy="8" r="5" fill="url(#wbSteel)" stroke="#475569"/>'; } }
    ],
    'Instruments': [
      { t: 'pg', n: 'Pressure Gauge', w: 30, h: 36, ports: [P(15, 36, 's', 'signal', 'Tap')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="18" font-size="9" text-anchor="middle" font-family="Arial" font-weight="bold">PI</text><line x1="15" y1="26" x2="15" y2="34" stroke="#0f172a" stroke-width="2"/>'; } },
      { t: 'ti', n: 'Temperature Ind.', w: 30, h: 36, ports: [P(15, 36, 's', 'signal', 'Tap')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="18" font-size="9" text-anchor="middle" font-family="Arial" font-weight="bold">TI</text><line x1="15" y1="26" x2="15" y2="34" stroke="#0f172a" stroke-width="2"/>'; } },
      { t: 'ft', n: 'Flow Meter', w: 34, h: 34, ports: [P(0, 22, 'w', 'in', 'In'), P(34, 22, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="0" y1="22" x2="34" y2="22" stroke="#64748b" stroke-width="4"/><circle cx="17" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="17" y="18" font-size="9" text-anchor="middle" font-family="Arial" font-weight="bold">FT</text>'; } },
      { t: 'li', n: 'Level Indicator', w: 30, h: 36, ports: [P(0, 20, 'w', 'signal', 'Tap')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="18" font-size="9" text-anchor="middle" font-family="Arial" font-weight="bold">LI</text>'; } },
      { t: 'orifice', n: 'Orifice Plate', w: 32, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(32, 16, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="0" y1="16" x2="32" y2="16" stroke="#64748b" stroke-width="4"/><line x1="16" y1="4" x2="16" y2="28" stroke="#0f172a" stroke-width="2.5"/><circle cx="16" cy="16" r="3" fill="#fff" stroke="#0f172a"/>'; } },
      { t: 'rotameter', n: 'Rotameter', w: 28, h: 42, ports: [P(14, 0, 'n', 'in', 'In'), P(14, 42, 's', 'out', 'Out')],
        draw: function () { return '<path d="M9 6 L19 6 L22 36 L6 36 Z" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.5"/><circle cx="14" cy="26" r="3" fill="#0369a1"/><line x1="10" y1="16" x2="18" y2="16" stroke="#0369a1"/>'; } },
      { t: 'pressure-transmitter', n: 'Pressure Transmitter', w: 30, h: 38, ports: [P(15, 38, 's', 'signal', 'Tap')],
        draw: function () { return '<circle cx="15" cy="15" r="13" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="9" y="11" width="12" height="8" rx="1" fill="#0f172a"/><text x="15" y="17.5" font-size="6.5" fill="#4ade80" text-anchor="middle" font-family="monospace">PT</text><line x1="15" y1="28" x2="15" y2="36" stroke="#0f172a" stroke-width="2"/>'; } },
      { t: 'pressure-indicator', n: 'Pressure Indicator', w: 32, h: 38, ports: [P(16, 38, 's', 'signal', 'Tap')],
        draw: function () { return '<rect x="3" y="4" width="26" height="18" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/><text x="16" y="17" font-size="9" fill="#4ade80" text-anchor="middle" font-family="monospace" font-weight="bold">PI</text><line x1="16" y1="26" x2="16" y2="36" stroke="#0f172a" stroke-width="2"/>'; } },
      { t: 'temp-transmitter', n: 'Temperature Transmitter', w: 30, h: 38, ports: [P(15, 38, 's', 'signal', 'Tap')],
        draw: function () { return '<circle cx="15" cy="15" r="13" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="9" y="11" width="12" height="8" rx="1" fill="#0f172a"/><text x="15" y="17.5" font-size="6.5" fill="#4ade80" text-anchor="middle" font-family="monospace">TT</text><line x1="15" y1="28" x2="15" y2="36" stroke="#0f172a" stroke-width="2"/>'; } },
      { t: 'thermowell', n: 'Thermowell', w: 34, h: 20, ports: [P(0, 10, 'w', 'in', 'Process'), P(34, 10, 'e', 'out', '')],
        draw: function () { return '<line x1="4" y1="10" x2="34" y2="10" stroke="#cbd5e1" stroke-width="6"/><path d="M4 6 L4 14" stroke="#334155" stroke-width="2"/><path d="M8 7 L8 13 M12 7 L12 13" stroke="#64748b" stroke-width="1"/>'; } },
      { t: 'venturi-meter', n: 'Venturi Meter', w: 40, h: 26, ports: [P(0, 13, 'w', 'in', 'In'), P(40, 13, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M2 6 L16 11 L16 15 L2 20 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.2"/><rect x="16" y="10" width="8" height="6" fill="#d4a017"/><path d="M38 6 L24 11 L24 15 L38 20 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.2"/>'; } },
      { t: 'vortex-meter', n: 'Vortex Flow Meter', w: 34, h: 34, ports: [P(0, 22, 'w', 'in', 'In'), P(34, 22, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="0" y1="22" x2="34" y2="22" stroke="#64748b" stroke-width="4"/><rect x="14" y="18" width="2" height="8" fill="#0f172a"/><circle cx="17" cy="13" r="11" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.4"/><text x="17" y="16.5" font-size="6" fill="#4ade80" text-anchor="middle" font-family="monospace">VTX</text>'; } },
      { t: 'coriolis-meter', n: 'Coriolis Flow Meter', w: 40, h: 30, ports: [P(0, 24, 'w', 'in', 'In'), P(40, 24, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 24 h8 M28 24 h8" stroke="#64748b" stroke-width="4"/><rect x="8" y="8" width="24" height="18" rx="3" fill="#0f766e" stroke="#0f172a" stroke-width="1.2"/><path d="M12 24 q8 -14 16 0" fill="none" stroke="#94a3b8" stroke-width="1.5"/>'; } },
      { t: 'level-transmitter', n: 'Level Transmitter', w: 34, h: 30, ports: [P(0, 20, 'w', 'in', 'Tap')],
        draw: function () { return '<circle cx="17" cy="15" r="13" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="11" y="11" width="12" height="8" rx="1" fill="#0f172a"/><text x="17" y="17.5" font-size="6.5" fill="#4ade80" text-anchor="middle" font-family="monospace">LT</text><line x1="4" y1="15" x2="0" y2="15" stroke="#0f172a" stroke-width="2"/>'; } },
      { t: 'radar-level', n: 'Radar Level Meter', w: 30, h: 40, ports: [P(15, 0, 'n', 'signal', 'Tap')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><text x="15" y="17" font-size="7" fill="#4ade80" text-anchor="middle" font-family="monospace" font-weight="bold">LT</text><path d="M9 26 L21 26 L15 38 Z" fill="#94a3b8" stroke="#475569" stroke-width="1"/>'; } },
      { t: 'dp-transmitter', n: 'DP Transmitter', w: 34, h: 30, ports: [P(0, 22, 'w', 'in', 'Hi'), P(34, 22, 'e', 'out', 'Lo')],
        draw: function () { return '<rect x="6" y="16" width="22" height="10" rx="2" fill="#0f172a"/><line x1="0" y1="22" x2="6" y2="22" stroke="#64748b" stroke-width="3"/><line x1="28" y1="22" x2="34" y2="22" stroke="#64748b" stroke-width="3"/><circle cx="17" cy="11" r="10" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.4"/><text x="17" y="14" font-size="6" fill="#4ade80" text-anchor="middle" font-family="monospace">dP</text>'; } },
      { t: 'ph-meter', n: 'pH Analyzer', w: 30, h: 38, ports: [P(15, 38, 's', 'in', 'Sample')],
        draw: function () { return '<rect x="4" y="4" width="22" height="20" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="17" font-size="9" fill="#4ade80" text-anchor="middle" font-family="monospace" font-weight="bold">pH</text><line x1="15" y1="24" x2="15" y2="30" stroke="#334155" stroke-width="2"/><circle cx="15" cy="34" r="4" fill="#bae6fd" stroke="#0369a1"/>'; } },
      { t: 'conductivity-meter', n: 'Conductivity Analyzer', w: 30, h: 38, ports: [P(15, 38, 's', 'in', 'Sample')],
        draw: function () { return '<rect x="4" y="4" width="22" height="20" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="17" font-size="7" fill="#4ade80" text-anchor="middle" font-family="monospace" font-weight="bold">CT</text><line x1="15" y1="24" x2="15" y2="36" stroke="#92600a" stroke-width="2.5"/>'; } },
      { t: 'o2-analyzer', n: 'Oxygen Analyzer', w: 30, h: 38, ports: [P(15, 38, 's', 'in', 'Sample')],
        draw: function () { return '<rect x="4" y="4" width="22" height="20" rx="3" fill="url(#wbGrey3)" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="17" font-size="7" fill="#166534" text-anchor="middle" font-family="monospace" font-weight="bold">O2</text><line x1="15" y1="24" x2="15" y2="36" stroke="#475569" stroke-width="2.5"/>'; } },
      { t: 'valve-positioner', n: 'Valve Positioner', w: 28, h: 26, ports: [P(14, 26, 's', 'signal', 'Sig')],
        draw: function () { return '<rect x="4" y="2" width="20" height="14" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.2"/><circle cx="10" cy="9" r="3.5" fill="#fff" stroke="#0f172a" stroke-width="0.8"/><circle cx="18" cy="9" r="3.5" fill="#fff" stroke="#0f172a" stroke-width="0.8"/><rect x="10" y="16" width="4" height="10" fill="#64748b"/>'; } },
      { t: 'pressure-switch', n: 'Pressure Switch', w: 24, h: 28, ports: [P(12, 28, 's', 'in', 'Tap')],
        draw: function () { return '<rect x="5" y="2" width="14" height="14" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.2"/><circle cx="12" cy="18" r="4" fill="url(#wbSteel)" stroke="#475569"/><line x1="12" y1="22" x2="12" y2="26" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'temp-switch', n: 'Temperature Switch', w: 30, h: 20, ports: [P(0, 10, 'w', 'in', 'Process')],
        draw: function () { return '<circle cx="22" cy="10" r="8" fill="#1e293b" stroke="#0f172a" stroke-width="1.2"/><line x1="0" y1="10" x2="14" y2="10" stroke="#cbd5e1" stroke-width="4"/>'; } },
      { t: 'flow-switch', n: 'Flow Switch', w: 34, h: 26, ports: [P(0, 16, 'w', 'in', 'In'), P(34, 16, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="0" y1="16" x2="34" y2="16" stroke="#64748b" stroke-width="4"/><rect x="12" y="4" width="10" height="10" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.2"/>'; } },
      { t: 'level-switch', n: 'Level Switch', w: 24, h: 32, ports: [P(0, 22, 'w', 'signal', 'Tap')],
        draw: function () { return '<rect x="4" y="2" width="16" height="14" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="1.2"/><line x1="12" y1="16" x2="12" y2="24" stroke="#334155" stroke-width="2"/><circle cx="12" cy="27" r="4.5" fill="#d4a017" stroke="#92600a"/>'; } },
      { t: 'steam-trap', n: 'Steam Trap', w: 36, h: 26, ports: [P(0, 13, 'w', 'in', 'In'), P(36, 13, 'e', 'out', 'Out')],
        draw: function () { return '<ellipse cx="18" cy="13" rx="14" ry="10" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="1" y="9" width="5" height="8" fill="#334155"/><rect x="30" y="9" width="5" height="8" fill="#334155"/>'; } },
      { t: 'sight-glass', n: 'Sight Glass', w: 30, h: 22, ports: [P(0, 11, 'w', 'in', 'In'), P(30, 11, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="0" y1="11" x2="30" y2="11" stroke="#64748b" stroke-width="4"/><rect x="6" y="4" width="5" height="14" fill="#334155"/><rect x="19" y="4" width="5" height="14" fill="#334155"/><circle cx="15" cy="11" r="6" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.2"/>'; } }
    ],
    'Utilities & Mixers': [
      { t: 'cooltower', n: 'Cooling Tower', w: 66, h: 60, ports: [P(0, 46, 'w', 'in', 'Warm In'), P(66, 46, 'e', 'out', 'Cold Out')],
        draw: function () { return '<path d="M14 52 L10 22 L56 22 L52 52 Z" fill="#e0f2fe" stroke="#0369a1" stroke-width="2"/><path d="M10 22 q23 -13 46 0" fill="#bae6fd" stroke="#0369a1" stroke-width="2"/><path d="M20 30 q6 6 12 0 t14 2" fill="none" stroke="#0369a1" stroke-width="1"/>'; } },
      { t: 'boiler', n: 'Boiler', w: 62, h: 58, ports: [P(0, 40, 'w', 'in', 'BFW In'), P(31, 0, 'n', 'vap', 'Steam Out')],
        /* Was an abstract red squiggle-in-a-box — the one icon in the library
           that didn't read as its own equipment shape, and nothing like the
           domed blue-shelled fired boiler with its visible flame that the 3D
           model builds (FAC['fired-boiler']). Drawn instead as that same
           domed cylindrical shell with a glimpse of flame at the base. */
        draw: function () { return '<path d="M16 18 Q31 4 46 18 L46 46 Q46 52 40 52 L22 52 Q16 52 16 46 Z" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.8"/>'
          + '<path d="M25 44 Q31 30 37 44 Q38 49 31 49 Q24 49 25 44 Z" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1.2"/>'
          + '<line x1="20" y1="24" x2="42" y2="24" stroke="#93c5fd" stroke-width="1.2" opacity="0.6"/>'
          + '<line x1="20" y1="30" x2="42" y2="30" stroke="#93c5fd" stroke-width="1.2" opacity="0.6"/>'; } },
      { t: 'ejector', n: 'Steam Ejector', w: 58, h: 36, ports: [P(0, 18, 'w', 'in', 'Suction'), P(58, 18, 'e', 'out', 'Discharge'), P(28, 0, 'n', 'hot-in', 'Motive')],
        draw: function () { return '<path d="M2 11 L24 11 L33 18 L56 12 L56 24 L33 18 L24 25 L2 25 Z" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'mixer', n: 'Static Mixer', w: 62, h: 28, ports: [P(0, 14, 'w', 'in', 'In'), P(62, 14, 'e', 'out', 'Out')],
        draw: function () { return '<rect x="4" y="4" width="54" height="20" rx="10" fill="#f1f5f9" stroke="#475569" stroke-width="1.5"/><path d="M10 6 L22 22 M22 6 L34 22 M34 6 L46 22 M46 6 L54 22" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'agitator', n: 'Agitated Tank', w: 62, h: 68, ports: [P(31, 0, 'n', 'in', 'Feed'), P(0, 30, 'w', 'in', 'Add'), P(31, 68, 's', 'out', 'Product')],
        draw: function () { return '<rect x="10" y="14" width="42" height="46" rx="4" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M12 40 h38" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 2"/><line x1="31" y1="2" x2="31" y2="46" stroke="#475569" stroke-width="2.5"/><path d="M22 46 h18 M25 40 l12 0" stroke="#475569" stroke-width="2.5"/><rect x="26" y="0" width="10" height="6" fill="#475569"/>'; } }
    ],
    'Filters & Strainers': [
      { t: 'y-strainer', n: 'Y-Strainer', w: 46, h: 36, ports: [P(0, 12, 'w', 'in', 'In'), P(46, 12, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="12" x2="44" y2="12" stroke="#9ca3af" stroke-width="7"/><path d="M22 12 L34 30" stroke="url(#wbSteel)" stroke-width="8" stroke-linecap="round"/><rect x="31" y="28" width="8" height="6" fill="#475569"/><ellipse cx="14" cy="10" rx="8" ry="1.5" fill="#fff" opacity="0.5"/>'; } },
      { t: 't-strainer', n: 'T-Strainer', w: 44, h: 40, ports: [P(0, 14, 'w', 'in', 'In'), P(44, 14, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="14" x2="42" y2="14" stroke="#9ca3af" stroke-width="7"/><rect x="18" y="14" width="10" height="22" rx="2" fill="url(#wbSteel)" stroke="#475569" stroke-width="1"/><path d="M20 18 h6 M20 24 h6 M20 30 h6" stroke="#64748b" stroke-width="1"/>'; } },
      { t: 'basket-filter', n: 'Basket Filter', w: 44, h: 50, ports: [P(0, 16, 'w', 'in', 'In'), P(44, 16, 'e', 'out', 'Out'), P(22, 50, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="12" y="8" width="20" height="34" rx="3" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M15 16 h14 M15 22 h14 M15 28 h14 M15 34 h14" stroke="#64748b" stroke-width="1"/><rect x="14" y="4" width="16" height="5" fill="url(#wbGrey3)"/>'; } },
      { t: 'cartridge-filter', n: 'Cartridge Filter', w: 40, h: 56, ports: [P(0, 14, 'w', 'in', 'In'), P(40, 14, 'e', 'out', 'Out'), P(20, 56, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="12" y="6" width="16" height="46" rx="8" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><path d="M16 12 v34 M20 12 v34 M24 12 v34" stroke="#94a3b8" stroke-width="1.5"/><ellipse cx="17" cy="14" rx="2" ry="16" fill="#fff" opacity="0.4"/>'; } },
      { t: 'bag-filter', n: 'Bag Filter', w: 46, h: 56, ports: [P(0, 12, 'w', 'in', 'In'), P(46, 44, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M10 8 h26 v20 q-13 22 -13 22 q-13 0 -13 -22 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><ellipse cx="23" cy="8" rx="13" ry="3" fill="url(#wbGrey3)"/>'; } },
      { t: 'duplex-filter', n: 'Duplex Filter', w: 56, h: 52, ports: [P(0, 16, 'w', 'in', 'In'), P(56, 16, 'e', 'out', 'Out')],
        draw: function () { return '<rect x="8" y="12" width="18" height="34" rx="4" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="30" y="12" width="18" height="34" rx="4" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><circle cx="28" cy="10" r="5" fill="url(#wbBrass)" stroke="#92600a"/>'; } },
      { t: 'self-clean-filter', n: 'Self-Clean Filter', w: 48, h: 54, ports: [P(0, 16, 'w', 'in', 'In'), P(48, 16, 'e', 'out', 'Out'), P(24, 54, 's', 'drain', 'Purge')],
        draw: function () { return '<rect x="12" y="8" width="24" height="38" rx="6" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><circle cx="24" cy="27" r="10" fill="none" stroke="#64748b" stroke-width="1.5"/><path d="M24 17 v20 M14 27 h20" stroke="#64748b" stroke-width="1"/><rect x="19" y="2" width="10" height="7" fill="url(#wbMotor)"/>'; } }
    ],
    'Separators & Cyclones': [
      { t: 'twophase-sep', n: '2-Phase Separator', w: 88, h: 48, ports: [P(0, 30, 'w', 'in', 'Feed'), P(88, 14, 'e', 'vap', 'Gas'), P(44, 48, 's', 'liq', 'Liquid')],
        draw: function () { return '<path d="M14 8 h60 q14 16 0 32 h-60 q-14 -16 0 -32 Z" fill="url(#wbSteelH)" stroke="#0369a1" stroke-width="2"/><line x1="18" y1="30" x2="72" y2="30" stroke="#2563eb" stroke-dasharray="3 2"/><rect x="40" y="12" width="10" height="8" fill="none" stroke="#0369a1"/>'; } },
      { t: 'threephase-sep', n: '3-Phase Separator', w: 96, h: 50, ports: [P(0, 30, 'w', 'in', 'Feed'), P(96, 12, 'e', 'vap', 'Gas'), P(70, 50, 's', 'liq', 'Oil'), P(30, 50, 's', 'liq', 'Water')],
        draw: function () { return '<path d="M14 8 h68 q14 17 0 34 h-68 q-14 -17 0 -34 Z" fill="url(#wbSteelH)" stroke="#0369a1" stroke-width="2"/><line x1="18" y1="24" x2="78" y2="24" stroke="#2563eb" stroke-dasharray="3 2"/><line x1="18" y1="34" x2="78" y2="34" stroke="#b45309" stroke-dasharray="3 2"/><rect x="58" y="14" width="8" height="24" fill="none" stroke="#0369a1"/>'; } },
      { t: 'cyclone', n: 'Cyclone Separator', w: 48, h: 66, ports: [P(0, 12, 'w', 'in', 'Feed'), P(24, 0, 'n', 'vap', 'Gas'), P(24, 66, 's', 'liq', 'Solids')],
        draw: function () { return '<path d="M10 10 h28 v18 L24 60 L10 28 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="20" y="2" width="8" height="10" fill="url(#wbGrey3)"/><path d="M12 24 L24 52 M36 24 L24 52" stroke="#94a3b8" stroke-width="0.8"/>'; } },
      { t: 'demister', n: 'Demister / KO', w: 54, h: 58, ports: [P(27, 0, 'n', 'vap', 'Gas Out'), P(0, 36, 'w', 'in', 'Feed'), P(27, 58, 's', 'liq', 'Liquid')],
        draw: function () { return '<rect x="14" y="8" width="26" height="42" rx="6" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><rect x="16" y="14" width="22" height="6" fill="#cbd5e1" stroke="#64748b" stroke-width="0.5"/><path d="M16 14 l22 6 M16 20 l22 -6" stroke="#94a3b8" stroke-width="0.5"/>'; } },
      { t: 'coalescer', n: 'Coalescer', w: 84, h: 44, ports: [P(0, 22, 'w', 'in', 'Feed'), P(84, 12, 'e', 'out', 'Clean'), P(42, 44, 's', 'liq', 'Water')],
        draw: function () { return '<path d="M12 8 h60 q12 14 0 28 h-60 q-12 -14 0 -28 Z" fill="url(#wbSteelH)" stroke="#0369a1" stroke-width="2"/><rect x="30" y="12" width="6" height="20" fill="#cbd5e1" stroke="#64748b" stroke-width="0.5"/><rect x="42" y="12" width="6" height="20" fill="#cbd5e1" stroke="#64748b" stroke-width="0.5"/>'; } },
      { t: 'hydrocyclone', n: 'Hydrocyclone', w: 40, h: 68, ports: [P(0, 10, 'w', 'in', 'Feed'), P(20, 0, 'n', 'out', 'Overflow'), P(20, 68, 's', 'liq', 'Underflow')],
        draw: function () { return '<path d="M8 8 h24 v14 L22 62 L18 62 L8 22 Z" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="16" y="2" width="8" height="8" fill="url(#wbGrey3)"/>'; } }
    ],
    'Compressors & Blowers': [
      { t: 'cent-comp', n: 'Centrifugal Compressor', w: 70, h: 54, ports: [P(0, 42, 'w', 'in', 'Suction'), P(70, 20, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="50" width="56" height="4" fill="#334155"/><path d="M10 44 L10 14 L58 22 L58 44 Z" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="2"/><circle cx="30" cy="32" r="10" fill="url(#wbSteel)" stroke="#1e40af" stroke-width="1"/><path d="M30 32 L38 27 M30 32 L38 37 M30 32 L22 32" stroke="#1e40af" stroke-width="1.5"/>'; } },
      { t: 'recip-comp', n: 'Reciprocating Compressor', w: 72, h: 52, ports: [P(0, 40, 'w', 'in', 'Suction'), P(72, 40, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="48" width="60" height="4" fill="#334155"/><rect x="10" y="24" width="40" height="22" rx="3" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="48" y="18" width="16" height="14" rx="2" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><circle cx="24" cy="35" r="7" fill="url(#wbSteel)" stroke="#1e40af"/><line x1="24" y1="35" x2="52" y2="25" stroke="#475569" stroke-width="2.5"/>'; } },
      { t: 'screw-comp', n: 'Screw Compressor', w: 68, h: 48, ports: [P(0, 34, 'w', 'in', 'Suction'), P(68, 34, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="44" width="52" height="4" fill="#334155"/><rect x="10" y="16" width="48" height="26" rx="8" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="1.5"/><path d="M16 22 l8 14 M24 22 l8 14 M32 22 l8 14 M40 22 l8 14" stroke="#fff" stroke-width="1" opacity="0.6"/>'; } },
      { t: 'axial-comp', n: 'Axial Compressor', w: 76, h: 46, ports: [P(0, 30, 'w', 'in', 'Inlet'), P(76, 30, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="42" width="60" height="4" fill="#334155"/><path d="M8 20 L68 12 L68 40 L8 40 Z" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><path d="M18 16 v22 M28 15 v24 M38 15 v24 M48 14 v25 M58 13 v26" stroke="#64748b" stroke-width="1.5"/>'; } },
      { t: 'roots-blower', n: 'Roots Blower', w: 58, h: 52, ports: [P(0, 42, 'w', 'in', 'Inlet'), P(58, 12, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="6" y="48" width="46" height="4" fill="#334155"/><rect x="10" y="14" width="40" height="30" rx="4" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><path d="M22 22 a6 6 0 1 1 -0.1 0 M36 36 a6 6 0 1 1 -0.1 0" fill="none" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'vacuum-pump', n: 'Vacuum Pump', w: 60, h: 50, ports: [P(0, 40, 'w', 'in', 'Suction'), P(60, 40, 'e', 'out', 'Exhaust')],
        draw: function () { return '<rect x="8" y="46" width="46" height="4" fill="#334155"/><circle cx="30" cy="28" r="18" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><text x="30" y="32" font-size="9" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">VAC</text>'; } },
      { t: 'turbine', n: 'Steam Turbine', w: 74, h: 50, ports: [P(0, 24, 'w', 'in', 'Steam In'), P(74, 40, 'e', 'out', 'Exhaust'), P(37, 0, 'n', 'signal', 'Shaft')],
        draw: function () { return '<rect x="8" y="46" width="60" height="4" fill="#334155"/><path d="M10 16 L58 22 L58 40 L10 40 Z" fill="url(#wbRed3)" stroke="#991b1b" stroke-width="2"/><path d="M18 20 v18 M28 20 v18 M38 21 v17 M48 21 v17" stroke="#fff" stroke-width="1" opacity="0.6"/><rect x="56" y="24" width="14" height="6" fill="url(#wbGrey3)"/>'; } },
      { t: 'scroll-comp', n: 'Scroll Compressor', w: 56, h: 50, ports: [P(0, 38, 'w', 'in', 'Suction'), P(28, 0, 'n', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="46" width="44" height="4" fill="#334155"/><circle cx="30" cy="26" r="18" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><path d="M30 26 a3 3 0 1 1 4 1 a7 7 0 1 1 -10 3 a11 11 0 1 1 16 5" fill="none" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'turbo-blower', n: 'Turbo Blower', w: 60, h: 52, ports: [P(0, 40, 'w', 'in', 'Inlet'), P(60, 20, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="48" width="46" height="4" fill="#334155"/><circle cx="30" cy="28" r="19" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><g stroke="#fff" stroke-width="2" stroke-linecap="round">' + (function(){var s='';for(var i=0;i<8;i++){var a=i*Math.PI/4;s+='<line x1="30" y1="28" x2="'+(30+13*Math.cos(a))+'" y2="'+(28+13*Math.sin(a))+'"/>';}return s;})() + '</g><circle cx="30" cy="28" r="4" fill="#1e40af"/>'; } },
      { t: 'lr-vacuum', n: 'Liquid Ring Vacuum', w: 60, h: 50, ports: [P(0, 38, 'w', 'in', 'Suction'), P(60, 38, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="46" width="46" height="4" fill="#334155"/><circle cx="30" cy="26" r="18" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="1.5"/><circle cx="30" cy="26" r="18" fill="none" stroke="#5eead4" stroke-width="3" opacity="0.6"/><circle cx="33" cy="24" r="8" fill="none" stroke="#0f766e" stroke-width="1.5"/>'; } },
      { t: 'rv-vacuum', n: 'Rotary Vane Vacuum', w: 58, h: 50, ports: [P(0, 38, 'w', 'in', 'Suction'), P(58, 38, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="46" width="44" height="4" fill="#334155"/><circle cx="30" cy="26" r="18" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><circle cx="26" cy="26" r="11" fill="none" stroke="#334155" stroke-width="1.5"/><path d="M26 15 v22 M15 26 h22" stroke="#64748b" stroke-width="1.5"/>'; } }
    ],
    'Safety Equipment': [
      { t: 'rupture-disc', n: 'Rupture Disc', w: 34, h: 40, ports: [P(17, 40, 's', 'in', 'Inlet'), P(17, 0, 'n', 'vent', 'Vent')],
        draw: function () { return '<rect x="8" y="16" width="18" height="10" fill="url(#wbSteel)" stroke="#475569" stroke-width="1"/><path d="M10 21 q7 -8 14 0" fill="none" stroke="#dc2626" stroke-width="2"/><line x1="17" y1="4" x2="17" y2="16" stroke="#475569" stroke-width="2"/>'; } },
      { t: 'flame-arrestor', n: 'Flame Arrestor', w: 40, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(40, 16, 'e', 'out', 'Out')],
        draw: function () { return '<rect x="10" y="6" width="20" height="20" rx="2" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><path d="M13 9 v14 M17 9 v14 M21 9 v14 M25 9 v14" stroke="#ea580c" stroke-width="1.5"/>'; } },
      { t: 'breather-valve', n: 'Breather Valve', w: 40, h: 44, ports: [P(20, 44, 's', 'in', 'Tank')],
        draw: function () { return '<rect x="12" y="24" width="16" height="14" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M14 12 h12 l-2 12 h-8 Z" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1"/><circle cx="20" cy="10" r="4" fill="url(#wbBrass)" stroke="#92600a"/>'; } },
      { t: 'safety-shower', n: 'Safety Shower', w: 44, h: 60, ports: [P(0, 20, 'w', 'in', 'Water')],
        draw: function () { return '<line x1="22" y1="8" x2="22" y2="52" stroke="url(#wbGreen3)" stroke-width="4"/><ellipse cx="22" cy="10" rx="12" ry="3" fill="url(#wbGreen3)"/><circle cx="34" cy="30" r="6" fill="url(#wbGreen3)"/><rect x="18" y="50" width="8" height="4" fill="#15803d"/><path d="M14 14 l4 6 M22 14 v6 M30 14 l-4 6" stroke="#3b82f6" stroke-width="1"/>'; } },
      { t: 'fire-monitor', n: 'Fire Monitor', w: 44, h: 50, ports: [P(22, 50, 's', 'in', 'Water')],
        draw: function () { return '<rect x="18" y="30" width="8" height="18" fill="url(#wbRed3)"/><circle cx="22" cy="26" r="6" fill="url(#wbRed3)" stroke="#991b1b"/><path d="M26 24 L40 16" stroke="url(#wbRed3)" stroke-width="5" stroke-linecap="round"/><path d="M38 14 l4 -1 -1 4 Z" fill="#3b82f6"/>'; } },
      { t: 'deluge-valve', n: 'Deluge Valve', w: 44, h: 40, ports: [P(0, 30, 'w', 'in', 'Supply'), P(44, 30, 'e', 'out', 'System'), P(22, 0, 'n', 'signal', 'Trip')],
        draw: function () { return '<path d="M4 20 L4 40 L21 30 Z M40 20 L40 40 L21 30 Z" fill="url(#wbRed3)" stroke="#7f1d1d" stroke-width="1.5"/><rect x="12" y="4" width="18" height="12" rx="2" fill="url(#wbGrey3)" stroke="#475569"/><line x1="21" y1="16" x2="21" y2="30" stroke="#7f1d1d" stroke-width="2"/>'; } },
      { t: 'gas-detector', n: 'Gas Detector', w: 32, h: 38, ports: [P(16, 38, 's', 'signal', 'Signal')],
        draw: function () { return '<rect x="8" y="8" width="16" height="22" rx="3" fill="url(#wbMotor)" stroke="#14532d" stroke-width="1.5"/><circle cx="16" cy="16" r="4" fill="#0f172a"/><path d="M12 24 h8" stroke="#fff" stroke-width="1"/><text x="16" y="27" font-size="4" fill="#fff" text-anchor="middle">GAS</text>'; } }
    ],
    'Electrical Equipment': [
      { t: 'motor', n: 'Electric Motor', w: 56, h: 46, ports: [P(0, 24, 'w', 'signal', 'Shaft'), P(28, 0, 'n', 'signal', 'Power')],
        draw: function () { return '<rect x="8" y="42" width="42" height="4" fill="#334155"/><rect x="12" y="14" width="34" height="24" rx="6" fill="url(#wbMotor)" stroke="#14532d" stroke-width="1.5"/><text x="29" y="30" font-size="11" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">M</text><rect x="4" y="21" width="10" height="7" fill="url(#wbGrey3)"/>'; } },
      { t: 'generator', n: 'Generator', w: 56, h: 46, ports: [P(0, 24, 'w', 'signal', 'Shaft'), P(56, 24, 'e', 'signal', 'Power')],
        draw: function () { return '<rect x="8" y="42" width="42" height="4" fill="#334155"/><rect x="12" y="14" width="34" height="24" rx="6" fill="url(#wbRed3)" stroke="#991b1b" stroke-width="1.5"/><text x="29" y="30" font-size="11" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">G</text>'; } },
      { t: 'transformer', n: 'Transformer', w: 50, h: 50, ports: [P(0, 18, 'w', 'signal', 'HV'), P(50, 18, 'e', 'signal', 'LV')],
        draw: function () { return '<circle cx="20" cy="25" r="13" fill="none" stroke="url(#wbGrey3)" stroke-width="3"/><circle cx="32" cy="25" r="13" fill="none" stroke="url(#wbBrass)" stroke-width="3"/>'; } },
      { t: 'switchgear', n: 'Switchgear', w: 44, h: 54, ports: [P(22, 0, 'n', 'signal', 'Bus'), P(22, 54, 's', 'signal', 'Load')],
        draw: function () { return '<rect x="10" y="8" width="24" height="40" rx="2" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><rect x="14" y="12" width="16" height="8" fill="#1e293b"/><circle cx="18" cy="30" r="3" fill="#22c55e"/><circle cx="26" cy="30" r="3" fill="#ef4444"/><rect x="15" y="38" width="14" height="6" fill="#475569"/>'; } },
      { t: 'vfd', n: 'VFD / Drive', w: 40, h: 52, ports: [P(20, 0, 'n', 'signal', 'Supply'), P(20, 52, 's', 'signal', 'Motor')],
        draw: function () { return '<rect x="10" y="8" width="20" height="38" rx="2" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="13" y="12" width="14" height="9" fill="#0f172a"/><path d="M14 17 q3 -4 6 0 t6 0" fill="none" stroke="#22c55e" stroke-width="1"/><text x="20" y="34" font-size="7" fill="#fff" text-anchor="middle" font-family="Arial">VFD</text>'; } },
      { t: 'mcc', n: 'MCC Panel', w: 52, h: 54, ports: [P(26, 0, 'n', 'signal', 'Incomer')],
        draw: function () { return '<rect x="8" y="8" width="36" height="42" rx="2" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><rect x="12" y="12" width="12" height="16" fill="#1e293b"/><rect x="28" y="12" width="12" height="16" fill="#1e293b"/><rect x="12" y="32" width="12" height="14" fill="#334155"/><rect x="28" y="32" width="12" height="14" fill="#334155"/>'; } },
      { t: 'junction-box', n: 'Junction Box', w: 34, h: 34, ports: [P(0, 17, 'w', 'signal', 'In'), P(34, 17, 'e', 'signal', 'Out')],
        draw: function () { return '<rect x="8" y="8" width="18" height="18" rx="2" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><text x="17" y="20" font-size="8" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">JB</text>'; } }
    ],
    'Pipe Supports': [
      { t: 'anchor', n: 'Anchor', w: 40, h: 36, ports: [P(0, 12, 'w', 'in', ''), P(40, 12, 'e', 'out', '')],
        draw: function () { return '<line x1="2" y1="12" x2="38" y2="12" stroke="#9ca3af" stroke-width="7"/><rect x="14" y="12" width="12" height="16" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="8" y="28" width="24" height="4" fill="#334155"/><path d="M10 32 l-4 4 M20 32 v4 M30 32 l4 4" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'guide-support', n: 'Guide', w: 40, h: 34, ports: [P(0, 12, 'w', 'in', ''), P(40, 12, 'e', 'out', '')],
        draw: function () { return '<line x1="2" y1="12" x2="38" y2="12" stroke="#9ca3af" stroke-width="7"/><path d="M14 6 v12 M26 6 v12" stroke="#475569" stroke-width="2"/><rect x="10" y="28" width="20" height="4" fill="#334155"/><line x1="20" y1="18" x2="20" y2="28" stroke="#475569" stroke-width="2"/>'; } },
      { t: 'spring-hanger', n: 'Spring Hanger', w: 36, h: 52, ports: [P(18, 52, 's', 'in', '')],
        draw: function () { return '<rect x="10" y="4" width="16" height="6" fill="#334155"/><path d="M18 10 q-8 4 8 8 q-8 4 8 8 q-8 4 8 8" fill="none" stroke="url(#wbGrey3)" stroke-width="2.5" transform="translate(-8,0)"/><rect x="12" y="38" width="12" height="6" fill="url(#wbSteel)" stroke="#475569"/><line x1="18" y1="44" x2="18" y2="52" stroke="#475569" stroke-width="3"/>'; } },
      { t: 'shoe-support', n: 'Pipe Shoe', w: 40, h: 32, ports: [P(0, 10, 'w', 'in', ''), P(40, 10, 'e', 'out', '')],
        draw: function () { return '<line x1="2" y1="10" x2="38" y2="10" stroke="#9ca3af" stroke-width="8"/><path d="M12 14 L28 14 L24 26 L16 26 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="8" y="26" width="24" height="4" fill="#334155"/>'; } },
      { t: 'saddle-support', n: 'Saddle Support', w: 46, h: 40, ports: [P(23, 0, 'n', 'in', '')],
        draw: function () { return '<path d="M8 16 q15 -14 30 0" fill="none" stroke="url(#wbSteel)" stroke-width="4"/><path d="M14 16 L14 32 L32 32 L32 16" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><rect x="8" y="32" width="30" height="4" fill="#334155"/>'; } },
      { t: 'trunnion', n: 'Trunnion', w: 36, h: 40, ports: [P(18, 0, 'n', 'in', '')],
        draw: function () { return '<ellipse cx="18" cy="8" rx="14" ry="5" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><rect x="13" y="12" width="10" height="22" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="6" y="34" width="24" height="4" fill="#334155"/>'; } }
    ],
    'Nozzles & Flanges': [
      { t: 'wn-flange', n: 'Weld-Neck Flange', w: 34, h: 34, ports: [P(0, 17, 'w', 'in', ''), P(34, 17, 'e', 'out', '')],
        draw: function () { return '<path d="M2 14 h10 l6 -3 v12 l-6 -3 h-10 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="18" y="4" width="6" height="26" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><circle cx="21" cy="8" r="1.5" fill="#334155"/><circle cx="21" cy="26" r="1.5" fill="#334155"/>'; } },
      { t: 'so-flange', n: 'Slip-On Flange', w: 32, h: 34, ports: [P(0, 17, 'w', 'in', ''), P(32, 17, 'e', 'out', '')],
        draw: function () { return '<line x1="2" y1="17" x2="30" y2="17" stroke="#9ca3af" stroke-width="7"/><rect x="14" y="4" width="6" height="26" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'blind-flange', n: 'Blind Flange', w: 26, h: 34, ports: [P(0, 17, 'w', 'in', '')],
        draw: function () { return '<rect x="10" y="4" width="8" height="26" rx="2" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><circle cx="14" cy="9" r="1.5" fill="#334155"/><circle cx="14" cy="25" r="1.5" fill="#334155"/>'; } },
      { t: 'manway', n: 'Manway', w: 40, h: 40, ports: [P(0, 20, 'w', 'in', 'Vessel')],
        draw: function () { return '<circle cx="24" cy="20" r="14" fill="url(#wbSteel)" stroke="#475569" stroke-width="2"/><circle cx="24" cy="20" r="9" fill="none" stroke="#64748b" stroke-width="1"/><g fill="#334155"><circle cx="24" cy="8" r="1.5"/><circle cx="36" cy="20" r="1.5"/><circle cx="24" cy="32" r="1.5"/><circle cx="12" cy="20" r="1.5"/></g>'; } },
      { t: 'inlet-nozzle', n: 'Inlet Nozzle', w: 30, h: 36, ports: [P(15, 0, 'n', 'in', 'In'), P(15, 36, 's', 'out', 'Vessel')],
        draw: function () { return '<rect x="11" y="4" width="8" height="24" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><rect x="6" y="2" width="18" height="5" fill="url(#wbSteel)" stroke="#475569"/><rect x="8" y="28" width="14" height="4" fill="#94a3b8"/>'; } },
      { t: 'vent-nozzle', n: 'Vent Nozzle', w: 30, h: 34, ports: [P(15, 0, 'n', 'vent', 'Vent'), P(15, 34, 's', 'in', 'Vessel')],
        draw: function () { return '<rect x="11" y="6" width="8" height="22" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><path d="M9 6 h12 l-2 -4 h-8 Z" fill="url(#wbSteel)" stroke="#475569"/>'; } }
    ],
    'Utilities & Package': [
      { t: 'chiller', n: 'Chiller', w: 66, h: 50, ports: [P(0, 18, 'w', 'in', 'Return'), P(0, 38, 'w', 'out', 'Supply')],
        draw: function () { return '<rect x="8" y="10" width="50" height="34" rx="4" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><path d="M16 18 q4 -5 8 0 t8 0 t8 0" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.7"/><text x="33" y="40" font-size="8" fill="#fff" text-anchor="middle" font-family="Arial">CHILLER</text>'; } },
      { t: 'heater-pkg', n: 'Fired Heater', w: 56, h: 60, ports: [P(0, 30, 'w', 'in', 'In'), P(56, 30, 'e', 'out', 'Out'), P(28, 0, 'n', 'vap', 'Flue')],
        draw: function () { return '<rect x="12" y="10" width="32" height="44" rx="3" fill="url(#wbRed3)" stroke="#991b1b" stroke-width="1.5"/><rect x="24" y="2" width="8" height="10" fill="url(#wbGrey3)"/><path d="M20 46 q4 -8 8 0 t8 0" fill="none" stroke="#fbbf24" stroke-width="2"/><path d="M18 28 h20 M18 34 h20" stroke="#fca5a5" stroke-width="1"/>'; } },
      { t: 'dryer', n: 'Air Dryer', w: 46, h: 56, ports: [P(0, 16, 'w', 'in', 'Wet'), P(46, 16, 'e', 'out', 'Dry'), P(23, 56, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="10" y="8" width="12" height="42" rx="6" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="24" y="8" width="12" height="42" rx="6" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><g fill="#cbd5e1"><circle cx="16" cy="20" r="1.5"/><circle cx="16" cy="30" r="1.5"/><circle cx="30" cy="20" r="1.5"/><circle cx="30" cy="30" r="1.5"/></g>'; } },
      { t: 'steam-header', n: 'Steam Header', w: 84, h: 34, ports: [P(0, 17, 'w', 'in', 'Supply'), P(28, 0, 'n', 'vap', 'User 1'), P(56, 0, 'n', 'vap', 'User 2'), P(84, 17, 'e', 'out', 'Extend')],
        draw: function () { return '<rect x="4" y="12" width="76" height="14" rx="7" fill="url(#wbRed3)" stroke="#991b1b" stroke-width="1.5"/><ellipse cx="20" cy="16" rx="14" ry="2" fill="#fff" opacity="0.4"/>'; } },
      { t: 'water-header', n: 'Water Header', w: 84, h: 34, ports: [P(0, 17, 'w', 'in', 'Supply'), P(28, 34, 's', 'out', 'User 1'), P(56, 34, 's', 'out', 'User 2'), P(84, 17, 'e', 'out', 'Extend')],
        draw: function () { return '<rect x="4" y="12" width="76" height="14" rx="7" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><ellipse cx="20" cy="16" rx="14" ry="2" fill="#fff" opacity="0.4"/>'; } },
      { t: 'package-unit', n: 'Package Unit', w: 64, h: 50, ports: [P(0, 25, 'w', 'in', 'In'), P(64, 25, 'e', 'out', 'Out')],
        draw: function () { return '<rect x="8" y="10" width="48" height="34" rx="3" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 2"/><text x="32" y="30" font-size="8" fill="#334155" text-anchor="middle" font-family="Arial">PACKAGE</text>'; } }
    ]
  };

  /* ── Piping & Fittings ──────────────────────────────────────────────────
     This section used to be hidden. The type keys stayed indexed so that old
     flowsheets would still render, but nothing could place a new one — a
     workbench that draws vessels, pumps and valves but cannot put a bend, a
     reducer or a spec blind between them is not drawing piping.

     It is visible again, with the same type keys as before so every saved
     project keeps loading, drawn from the shared industrial symbol set and
     backed by real 3D castings (see aro-workbench-3d.js). The eight added
     keys — long-radius bend, eccentric reducer, spool, weld-neck flange,
     blind, spec blind, union and cap — are new; the seven original ones are
     unchanged in key and in port count. */
  function fitDraw(key) {
    return function () {
      return (window.AROSYM && window.AROSYM.glyph) ? window.AROSYM.glyph(key)
        : '<rect x="4" y="10" width="36" height="10" rx="3" fill="#94a3b8" stroke="#475569" stroke-width="1.4"/>';
    };
  }
  /* Every symbol in the shared set is drawn in a 44 × 30 box on a centreline
     at y = 15, so one port pair serves all the in-line components. */
  var FW = 44, FH = 30, FCY = 15;
  function inline2(key, t, n) {
    return { t: t, n: n, w: FW, h: FH,
      ports: [P(0, FCY, 'w', 'in', ''), P(FW, FCY, 'e', 'out', '')], draw: fitDraw(key) };
  }
  var LIB_FITTINGS = {
    'Piping & Fittings': [
      inline2('spool', 'spool', 'Pipe Spool'),
      { t: 'elbow90', n: '90° Elbow', w: FW, h: FH,
        ports: [P(2, 8, 'w', 'in', ''), P(34, FH, 's', 'out', '')], draw: fitDraw('elbow90') },
      { t: 'elbowlr', n: 'Long Radius 90°', w: FW, h: FH,
        ports: [P(1, 6, 'w', 'in', ''), P(33, FH, 's', 'out', '')], draw: fitDraw('elbowlr') },
      { t: 'elbow45', n: '45° Elbow', w: FW, h: FH,
        ports: [P(1, 22, 'w', 'in', ''), P(36, 5, 'e', 'out', '')], draw: fitDraw('elbow45') },
      { t: 'tee', n: 'Equal Tee', w: FW, h: FH,
        ports: [P(0, 11, 'w', 'in', ''), P(FW, 11, 'e', 'out', ''), P(22, FH, 's', 'out', '')], draw: fitDraw('tee') },
      { t: 'cross', n: 'Cross', w: FW, h: FH,
        ports: [P(0, FCY, 'w', 'in', ''), P(FW, FCY, 'e', 'out', ''), P(22, 2, 'n', 'out', ''), P(22, FH, 's', 'out', '')],
        draw: fitDraw('cross') },
      inline2('reducer', 'reducer', 'Conc. Reducer'),
      inline2('eccreducer', 'ecc-reducer', 'Ecc. Reducer'),
      inline2('expander', 'expander', 'Expander'),
      inline2('flange', 'flange', 'Flange Pair'),
      inline2('wnflange', 'wnflange', 'Weld-Neck Flange'),
      { t: 'blind', n: 'Blind Flange', w: FW, h: FH,
        ports: [P(0, FCY, 'w', 'in', '')], draw: fitDraw('blind') },
      inline2('spectacle', 'spectacle', 'Spectacle Blind'),
      inline2('union', 'union', 'Union'),
      { t: 'pcap', n: 'Pipe Cap', w: FW, h: FH,
        ports: [P(0, FCY, 'w', 'in', '')], draw: fitDraw('cap') }
    ]
  };
  LIB['Piping & Fittings'] = LIB_FITTINGS['Piping & Fittings'];
  /* Sidebar order follows key order, and a new key would otherwise land at the
     bottom under the package units. Piping belongs next to the valves. */
  LIB = (function (src) {
    var want = ['Equipment', 'Vessels & Tanks', 'Columns & Reactors',
      'Piping & Fittings', 'Valves', 'Instruments'], out = {};
    want.forEach(function (k) { if (src[k]) out[k] = src[k]; });
    Object.keys(src).forEach(function (k) { if (!out[k]) out[k] = src[k]; });
    return out;
  })(LIB);

  /* Nothing is indexed only as legacy any more — every old key above is a
     live palette entry. The object is kept (empty) so the indexing loop and
     anything that reads it keep working. */
  var LIB_LEGACY = {};

  var LIB_INDEX = {};
  Object.keys(LIB).forEach(function (cat) { LIB[cat].forEach(function (it) { it.cat = cat; LIB_INDEX[it.t] = it; }); });
  Object.keys(LIB_LEGACY).forEach(function (cat) { LIB_LEGACY[cat].forEach(function (it) { it.cat = cat; LIB_INDEX[it.t] = it; }); });
  /* Tag each of the 5 registry equipment types' own 2D ports with the
     canonical id from AROPORTS, matched by the 2D role string it already
     carries (role2d). The port's x/y/dir/role/name — every visual thing 2D
     itself owns — are untouched; this only adds an identity 3D and P&ID can
     both be found by. A type not yet in AROPORTS (everything outside this
     first batch of 5) is left exactly as it was. */
  Object.keys(AROPORTS).forEach(function (t) {
    var lib = LIB_INDEX[t]; if (!lib || !lib.ports) return;
    AROPORTS[t].forEach(function (cp) {
      var port = lib.ports.filter(function (p) { return p.role === cp.role2d; })[0];
      if (port) port.id = cp.id;
    });
  });
  /* Read-only for the common component layer, which resolves one component's
     P&ID symbol, 2D icon, 3D casting and take-off metadata from a single key.
     It reads this index; it does not modify it. */
  WB.libIndex = function () { return LIB_INDEX; };
  WB.libCategories = function () { return Object.keys(LIB); };

  /* ───────────── P&ID schematic symbol mode ─────────────
     A real P&ID draws every valve as the same bowtie, every pump as the
     same circle-and-triangle, every vessel as the same capsule — the TAG
     (P-101, XV-201…) is what distinguishes one from another, not custom
     geometry per sub-type. That's a deliberate ISA/PIP convention, not
     the kind of repetition the detailed 2D/3D libraries were audited
     for. This maps each palette category to one shared line-art symbol,
     drawn in place of lib.draw() when WB.pidMode is on — same ports,
     same tag label underneath, so pipe routing/connections/reports all
     keep working unchanged; only the equipment glyph itself swaps. */
  // The "Equipment" / "Utilities & Mixers" / "Utilities & Package" categories
  // are grab-bags (pumps, compressors and heat exchangers all live under
  // "Equipment" together) with no consistent "pump"/"hx" substring in every
  // key or name, so those three get an explicit lookup instead of a guess.
  var PID_PUMP_KEYS = { pump: 1, 'pump-ms': 1, 'pd-pump': 1, compressor: 1, blower: 1, 'inline-pump': 1, 'split-case': 1, vturbine: 1, 'self-prime': 1, 'int-gear': 1, 'lobe-pump': 1, 'screw-pump': 1, 'twin-screw': 1, pcp: 1, peristaltic: 1, 'diaphragm-pump': 1, 'pneu-diaphragm': 1, 'plunger-pump': 1, 'piston-pump': 1, 'recip-pump': 1, 'mag-drive': 1, 'metering-pump': 1, 'submersible-pump': 1, 'slurry-pump': 1, ejector: 1 };
  var PID_HX_KEYS = { sthe: 1, dphe: 1, phe: 1, aircooler: 1, reboiler: 1, 'floating-head': 1, 'fixed-ts': 1, 'utube-hx': 1, 'spiral-hx': 1, condenser: 1, evaporator: 1, economizer: 1, kettle: 1, 'hairpin-hx': 1, 'finned-tube': 1, cooltower: 1, boiler: 1, chiller: 1, 'heater-pkg': 1 };
  var PID_VESSEL_KEYS = { mixer: 1, agitator: 1, dryer: 1 };
  WB.pidCatOf = function (t) { return pidCatOf(t); };
  function pidCatOf(t) {
    var lib = LIB_INDEX[t]; if (!lib) return 'other';
    var c = lib.cat || '';
    /* A spherical vessel is the one shape in this vessel/tank family real
       P&IDs do NOT flatten into the generic capsule — a pressure sphere
       (LPG/butane storage) is drawn as a circle specifically because its
       shape, not its tag, is what a reader needs to recognise at a glance.
       Both the 2D icon and the 3D model already draw a sphere; the P&ID
       symbol was the one place still falling through to the shared vessel
       capsule, so the equipment stopped looking like the same tank across
       views. Checked ahead of the generic vessel rule below. */
    if (t === 'spherical') return 'sphere';
    if (/^Valves?/.test(c)) return 'valve';
    if (c === 'Instruments') return 'instrument';
    if (c === 'Safety Equipment') return 'safety';
    if (c === 'Electrical Equipment') return 'electrical';
    if (c === 'Pipe Supports') return 'support';
    if (c === 'Nozzles & Flanges') return 'flange';
    if (c === 'Piping & Fittings') return 'fitting';
    if (c === 'Filters & Strainers') return 'filter';
    if (c === 'Separators & Cyclones') return 'separator';
    if (/^Compressors/.test(c)) return 'compressor';
    if (/^Columns/.test(c)) return 'column';
    if (/^Vessels/.test(c)) return 'vessel';
    if (PID_PUMP_KEYS[t]) return 'pump';
    if (PID_HX_KEYS[t]) return 'heatexchanger';
    if (PID_VESSEL_KEYS[t]) return 'vessel';
    return 'utility'; // steam-header/water-header/package-unit and anything unforeseen
  }
  function pidBowtie(w, h) {
    var cy = h / 2, r = Math.min(w, h) * 0.42;
    return '<path d="M' + (w / 2 - r) + ' ' + (cy - r * 0.8) + ' L' + (w / 2) + ' ' + cy + ' L' + (w / 2 - r) + ' ' + (cy + r * 0.8) + ' Z '
      + 'M' + (w / 2 + r) + ' ' + (cy - r * 0.8) + ' L' + (w / 2) + ' ' + cy + ' L' + (w / 2 + r) + ' ' + (cy + r * 0.8) + ' Z" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="0" y1="' + cy + '" x2="' + (w / 2 - r) + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + (w / 2 + r) + '" y1="' + cy + '" x2="' + w + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>';
  }
  function pidSymbol(cat, w, h, node) {
    var cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.4;
    if (cat === 'valve') return pidBowtie(w, h);
    if (cat === 'pump') return '<line x1="0" y1="' + cy + '" x2="' + (cx - r) + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + (cx + r) + '" y1="' + cy + '" x2="' + w + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>'
      + '<path d="M' + (cx - r * 0.45) + ' ' + (cy - r * 0.55) + ' L' + (cx + r * 0.55) + ' ' + cy + ' L' + (cx - r * 0.45) + ' ' + (cy + r * 0.55) + ' Z" fill="#0f172a"/>';
    if (cat === 'compressor') return '<line x1="0" y1="' + cy + '" x2="' + (cx - r) + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + (cx + r) + '" y1="' + cy + '" x2="' + w + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>'
      + '<path d="M' + cx + ' ' + (cy - r * 0.6) + ' A' + (r * 0.6) + ' ' + (r * 0.6) + ' 0 1 1 ' + (cx - r * 0.4) + ' ' + (cy + r * 0.45) + '" fill="none" stroke="#0f172a" stroke-width="1.4"/>';
    if (cat === 'heatexchanger') return '<rect x="6" y="' + (cy - h * 0.28) + '" width="' + (w - 12) + '" height="' + (h * 0.56) + '" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>'
      + (function () { var s = '', n = 4; for (var i = 0; i < n; i++) { var yy = cy - h * 0.2 + i * (h * 0.4 / (n - 1)); s += '<line x1="10" y1="' + yy + '" x2="' + (w - 10) + '" y2="' + yy + '" stroke="#0f172a" stroke-width="1"/>'; } return s; })()
      + '<line x1="0" y1="' + cy + '" x2="6" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + (w - 6) + '" y1="' + cy + '" x2="' + w + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>';
    if (cat === 'column') return '<rect x="' + (cx - w * 0.22) + '" y="4" width="' + (w * 0.44) + '" height="' + (h - 8) + '" rx="' + (w * 0.2) + '" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>'
      + (function () { var s = '', n = 6; for (var i = 1; i < n; i++) { var yy = 4 + i * (h - 8) / n; s += '<line x1="' + (cx - w * 0.2) + '" y1="' + yy + '" x2="' + (cx + w * 0.2) + '" y2="' + yy + '" stroke="#0f172a" stroke-width="1" stroke-dasharray="3 2"/>'; } return s; })();
    /* This used to pick a tall-narrow or short-wide capsule purely from
       h>=w on the icon's own pixel box — a visual guess, not an engineering
       one. A real vessel's actual ports can sit on all four sides (a tank
       is commonly filled from the top and drawn off low on a SIDE nozzle,
       not just top/bottom), so nothing about an icon's raw w/h ratio
       reliably says "this is really a horizontal vessel". Worse, the
       chosen branch only spanned 56% of the box's cross-axis, so any port
       positioned in the other ~44% (e.g. cone-tank's Outlet at 83% height,
       Fill at the very top, Drain at the very bottom) was left stranded
       outside the drawn shape — the pipe then visibly detached from the
       P&ID symbol even though the underlying connection was correct. One
       symbol, filling nearly the whole box in BOTH axes regardless of
       orientation, with rx sized off its own drawn rect rather than the
       raw box: every port, on any side, now lands on or right at its
       edge — a normal short nozzle stub, not a gap. */
    if (cat === 'vessel') {
      var vmg = 0.06, vw = w * (1 - 2 * vmg), vh = h * (1 - 2 * vmg);
      return '<rect x="' + (w * vmg) + '" y="' + (h * vmg) + '" width="' + vw + '" height="' + vh + '" rx="' + (Math.min(vw, vh) / 2) + '" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>';
    }
    if (cat === 'sphere') return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + (cx - r) + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1"/>'
      + '<line x1="' + cx + '" y1="' + (cy - r) + '" x2="' + cx + '" y2="' + (cy + r) + '" stroke="#0f172a" stroke-width="1"/>';
    if (cat === 'instrument') return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>'
      + '<text x="' + cx + '" y="' + (cy + 3) + '" font-size="' + Math.max(8, r * 0.55) + '" font-weight="700" fill="#0f172a" text-anchor="middle" font-family="Arial">' + ((node && (node.tag || '').replace(/[-0-9].*$/, '')) || 'I') + '</text>';
    if (cat === 'filter' || cat === 'separator') return '<path d="M6 6 H' + (w - 6) + ' L' + (cx + w * 0.12) + ' ' + (h - 6) + ' H' + (cx - w * 0.12) + ' Z" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>';
    if (cat === 'safety') return '<path d="M' + cx + ' 4 L' + (w - 6) + ' ' + (h - 6) + ' H6 Z" fill="#fff" stroke="#0f172a" stroke-width="1.6"/>';
    if (cat === 'electrical') return '<rect x="6" y="6" width="' + (w - 12) + '" height="' + (h - 12) + '" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="4 2"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.5) + '" fill="none" stroke="#0f172a" stroke-width="1.3"/>';
    /* On a P&ID a bend or a reducer is line geometry, not a symbol. Drawn as
       the run itself with a single tick, so the node is selectable and
       taggable without pretending to be a piece of equipment. */
    if (cat === 'fitting') return '<line x1="0" y1="' + cy + '" x2="' + w + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + cx + '" y1="' + (cy - h * 0.22) + '" x2="' + cx + '" y2="' + (cy + h * 0.22) + '" stroke="#0f172a" stroke-width="1.2"/>';
    if (cat === 'flange') return '<line x1="0" y1="' + cy + '" x2="' + w + '" y2="' + cy + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + (cx - 3) + '" y1="' + (cy - h * 0.3) + '" x2="' + (cx - 3) + '" y2="' + (cy + h * 0.3) + '" stroke="#0f172a" stroke-width="2"/>'
      + '<line x1="' + (cx + 3) + '" y1="' + (cy - h * 0.3) + '" x2="' + (cx + 3) + '" y2="' + (cy + h * 0.3) + '" stroke="#0f172a" stroke-width="2"/>';
    if (cat === 'support') return '<line x1="' + cx + '" y1="0" x2="' + cx + '" y2="' + h + '" stroke="#0f172a" stroke-width="1.6"/>'
      + '<line x1="' + (cx - w * 0.3) + '" y1="' + h + '" x2="' + (cx + w * 0.3) + '" y2="' + h + '" stroke="#0f172a" stroke-width="1.6"/>';
    // utility / fallback — plain rectangle with dashed border (package unit style)
    return '<rect x="6" y="6" width="' + (w - 12) + '" height="' + (h - 12) + '" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="5 2"/>';
  }

  /* ───────────── Refinery / petrochemical FLOWSHEET library ─────────────
     ONE integrated plant — not a library of separate unit templates to pick
     between. Every piece of equipment below is wired in series, crude in
     one end and finished streams out the other, matching the actual
     process sequence of the reference refinery walkthrough this was built
     against: crude receiving → desalting → atmospheric distillation →
     vacuum distillation → fluid catalytic cracking → gas concentration →
     amine/sulfur recovery → naphtha upgrading → products.

     Laid out as named plant areas, not one continuous line: each entry is
     an array of { name, recipe } blocks. A block's own equipment is a
     compact recipe 't:Label; t:Label; ...' — the loader instantiates it
     left→right and wires each real outlet nozzle to the next real inlet
     nozzle, exactly as before; WB.loadFlowsheet then also wires the last
     unit of one block to the first unit of the next, so the whole plant
     stays one connected crude-to-products train across every block, and
     lays each block out as its own labelled cluster on the sheet (real 3D
     geometry, real flanged pipe connections — the same industrial
     equipment library used everywhere else in the workbench, not one-off
     custom models). A column currently exposes only one real 3D process
     outlet (overhead) alongside its feed inlet, so a true multi-product
     branching P&ID (several simultaneous side draws in one 3D view) needs
     more nozzles modelled on the shared equipment library first; this
     plant is the real crude-to-products path as one continuous train
     instead. */
  var FLOWSHEETS = {
    'AROGARA Refinery Plant': {
      'Crude to Products — Full Process Train': [
        { name: 'CRUDE RECEIVING & DESALTING', recipe: 'cone-tank:Crude Storage Tank TK-101; pump:Crude Charge Pump P-101; sthe:Crude Preheat Train E-101; mixer:Wash Water Mixer MX-101; h-vessel:1st Stage Desalter V-101; pump:Interstage Pump P-102; h-vessel:2nd Stage Desalter V-102' },
        { name: 'ATMOSPHERIC DISTILLATION (ADU)', recipe: 'boiler:Crude Furnace F-101; column:Atmospheric Column C-101; aircooler:ADU OVHD Condenser E-102; v-vessel:ADU Reflux Drum V-103; pump:ADU Reflux Pump P-103' },
        { name: 'VACUUM DISTILLATION (VDU)', recipe: 'boiler:Vacuum Furnace F-201; column:Vacuum Column C-201; ejector:1st Stage Ejector EJ-201; ejector:2nd Stage Ejector EJ-202; ejector:3rd Stage Ejector EJ-203; vacuum-vessel:Hotwell V-201; pump:VGO Pump P-201' },
        { name: 'FLUID CATALYTIC CRACKING (FCCU)', recipe: 'boiler:FCC Feed Preheater F-401; fbr:FCC Riser Reactor R-401; cyclone:Disengager/Cyclones V-401; v-vessel:Catalyst Regenerator RG-401; blower:Regenerator Air Blower B-401; column:FCC Main Fractionator C-401; aircooler:FCC OVHD Condenser E-401; v-vessel:FCC Reflux Drum V-402; recip-comp:Wet Gas Compressor K-401' },
        { name: 'GAS CONCENTRATION & SULFUR RECOVERY', recipe: 'separator:High Pressure Separator D-401; column:Gas Concentration Column C-402; absorber:Amine Absorber C-403; column:Amine Regenerator C-404; boiler:Sulfur Reaction Furnace F-501; sthe:Waste Heat Boiler E-501; v-vessel:Sulfur Pit V-501' },
        { name: 'NAPHTHA UPGRADING & PRODUCTS', recipe: 'column:Naphtha Stabilizer C-601; pbr:Reformer Reactor R-601; pbr:Isomerization Reactor R-602; cone-tank:Products Storage Tank TK-901' }
      ]
    }
  };

  /* Fluid presets for quick property fill */
  var FLUIDS = {
    'Water': { rho: 998, mu: 1.0, name: 'Water' },
    'Hot Oil': { rho: 850, mu: 15, name: 'Hot Oil' },
    'Crude Oil': { rho: 870, mu: 10, name: 'Crude Oil' },
    'Steam': { rho: 0.6, mu: 0.013, name: 'Steam' },
    'Air/Gas': { rho: 1.2, mu: 0.018, name: 'Air/Gas' },
    'Diesel': { rho: 840, mu: 3.5, name: 'Diesel' }
  };

  /* ───────────── Undo / redo ───────────── */
  function snapshot() {
    return JSON.stringify({ nodes: WB.nodes, pipes: WB.pipes, seq: WB.seq });
  }
  function pushUndo() { pushUndoBefore(snapshot()); }
  /* Record a state captured earlier — a drag has to bank the position it
     started from, because by the time the first movement is noticed the node
     has already moved. */
  function pushUndoBefore(s) {
    if (!s) return;
    WB.undoStack.push(s);
    if (WB.undoStack.length > 60) WB.undoStack.shift();
    WB.redoStack = [];
  }
  function restore(s) { var o = JSON.parse(s); WB.nodes = o.nodes; WB.pipes = o.pipes; WB.seq = o.seq; WB.sel = null; WB.selMulti = []; migratePipePortIds(WB.pipes); render(); renderProps(); sync3D(); }
  WB.undo = function () { if (!WB.undoStack.length) return; WB.redoStack.push(snapshot()); restore(WB.undoStack.pop()); };
  WB.redo = function () { if (!WB.redoStack.length) return; WB.undoStack.push(snapshot()); restore(WB.redoStack.pop()); };

  /* ───────────── Geometry helpers ───────────── */
  function snapV(v) { return WB.snap ? Math.round(v / WB.grid) * WB.grid : v; }
  function nodeById(id) { for (var i = 0; i < WB.nodes.length; i++) if (WB.nodes[i].id === id) return WB.nodes[i]; return null; }
  // first outlet-ish / inlet-ish port index for a node type — last-resort
  // fallback for portIndexFor3D below, when the specific port truly can't
  // be identified (a type outside the AROPORTS registry)
  function outPortIndex(t) { var ps = (LIB_INDEX[t] || {}).ports || []; for (var i = 0; i < ps.length; i++) if (/out|liq|vap/.test(ps[i].role)) return i; return ps.length ? ps.length - 1 : 0; }
  function inPortIndex(t) { var ps = (LIB_INDEX[t] || {}).ports || []; for (var i = 0; i < ps.length; i++) if (/in/.test(ps[i].role)) return i; return 0; }
  // Which 2D port on type t is the SAME physical nozzle as the 3D port the
  // user just clicked (identified by its AROPORTS canonical id, or failing
  // that its 3D role string bridged through AROPORTS' role3d). Returns -1
  // when the type isn't registered — outPortIndex/inPortIndex are the
  // caller's fallback for that case, same as before this existed.
  function portIndexFor3D(t, role3d, portId) {
    var lib = LIB_INDEX[t]; if (!lib || !lib.ports) return -1;
    if (portId) {
      for (var i = 0; i < lib.ports.length; i++) if (lib.ports[i].id === portId) return i;
    }
    var reg = AROPORTS[t];
    if (reg && role3d) {
      var cp = reg.filter(function (r) { return r.role3d === role3d; })[0];
      if (cp) {
        for (var j = 0; j < lib.ports.length; j++) if (lib.ports[j].role === cp.role2d) return j;
      }
    }
    return -1;
  }
  // Rebuild the 3D scene from the shared model whenever the 2D model changes while in 3D mode
  // (so loading a flowsheet, deleting, undo/redo etc. all convert live to 3D).
  function sync3D() {
    if (WB.mode3d && window.ARO3D && window.ARO3D.buildFromModel)
      window.ARO3D.buildFromModel(WB.nodes, WB.pipes, function (t) { var l = LIB_INDEX[t]; return l ? l.n : t; });
  }
  WB.sync3D = sync3D;
  /* A port's facing direction, rotated the same way its (x,y) is below.
     Equipment can be rotated to any 15°-snapped angle (see the rotate-handle
     drag in onMove), but the ortho router only ever leads out in one of 4
     compass directions — so the rotated angle is requantized to the nearest
     one. e/s/w/n = 0/90/180/270 matches the sense of the dx/dy rotation two
     lines down (a positive r turns 'e' toward 's', not 'n'). */
  var DIR_ANGLE = { e: 0, s: 90, w: 180, n: 270 };
  var DIR_AT_ANGLE = ['e', 's', 'w', 'n'];
  function rotateDir(dir, rotDeg) {
    var base = DIR_ANGLE[dir];
    if (base == null) return dir;
    var a = ((base + (rotDeg || 0)) % 360 + 360) % 360;
    return DIR_AT_ANGLE[Math.round(a / 90) % 4];
  }
  // Port position in world coords — honours the node's own rotation & scale
  function portWorld(node, pi) {
    var lib = LIB_INDEX[node.t];
    /* A node whose type isn't in the library (a bad import, a stale
       migration, a save from a future version with a type this build
       doesn't know) used to throw here and abort the ENTIRE 2D render —
       one bad node made the whole flowsheet disappear. Fall back to the
       node's own raw x/y instead of crashing the render loop. */
    if (!lib || !lib.ports || !lib.ports[pi]) return { x: node.x, y: node.y, dir: 'e' };
    var p = lib.ports[pi];
    var s = node.scale || 1, r = (node.rot || 0) * Math.PI / 180;
    var cx = lib.w / 2, cy = lib.h / 2;
    var dx = (p.x - cx) * s, dy = (p.y - cy) * s;
    /* The (x,y) below is rotated for display, but p.dir used to be handed
       back raw — the port dot itself landed in the correct rotated spot,
       but routePipe's lead-out (which reads .dir) then exited toward the
       PRE-rotation compass direction, producing a wire that visibly looped
       away from the port before heading back to it instead of leaving
       cleanly along the equipment's actual current facing. */
    return { x: node.x + cx + dx * Math.cos(r) - dy * Math.sin(r),
             y: node.y + cy + dx * Math.sin(r) + dy * Math.cos(r), dir: rotateDir(p.dir, node.rot || 0) };
  }

  /* Per-equipment transform controls (only the CLICKED equipment changes) */
  WB.nodeScale = function (f) {
    if (!WB.sel || WB.sel.kind !== 'node') return;
    var n = nodeById(WB.sel.id); if (!n) return;
    pushUndo(); n.scale = Math.max(0.5, Math.min(2.5, (n.scale || 1) * f)); render(); renderProps();
  };
  WB.nodeRotate = function (deg) {
    if (!WB.sel || WB.sel.kind !== 'node') return;
    var n = nodeById(WB.sel.id); if (!n) return;
    pushUndo(); n.rot = (((n.rot || 0) + deg) % 360 + 360) % 360; render(); renderProps();
  };
  WB.nodeReset = function () {
    if (!WB.sel || WB.sel.kind !== 'node') return;
    var n = nodeById(WB.sel.id); if (!n) return;
    pushUndo(); n.rot = 0; n.scale = 1; render(); renderProps();
  };

  /* ───────────── Add / delete ───────────── */
  function addNode(t, x, y) {
    var lib = LIB_INDEX[t]; if (!lib) return;
    pushUndo();
    var n = { id: 'N' + (++WB.seq), t: t, x: snapV(x - lib.w / 2), y: snapV(y - lib.h / 2),
      tag: defaultTag(t), fluid: 'Water', flow: 10, temp: 30, press: 3, nps: 3 };
    WB.nodes.push(n); WB.sel = { kind: 'node', id: n.id }; render(); renderProps();
  }
  var TAGCNT = {};
  function defaultTag(t) {
    var pfx = { pump: 'P', 'pump-ms': 'P', 'pd-pump': 'P', compressor: 'K', blower: 'B',
      sthe: 'E', dphe: 'E', phe: 'E', aircooler: 'E', reboiler: 'E',
      'v-vessel': 'V', 'h-vessel': 'V', separator: 'D', 'atm-tank': 'TK', 'cone-tank': 'TK',
      bullet: 'TK', silo: 'SL', column: 'C', absorber: 'C', cstr: 'R', pfr: 'R', pbr: 'R',
      cooltower: 'CT', boiler: 'BL', ejector: 'EJ', mixer: 'MX', agitator: 'AG',
      'y-strainer': 'ST', 't-strainer': 'ST', 'basket-filter': 'F', 'cartridge-filter': 'F',
      'bag-filter': 'F', 'duplex-filter': 'F', 'self-clean-filter': 'F',
      'twophase-sep': 'D', 'threephase-sep': 'D', cyclone: 'CY', demister: 'D', coalescer: 'CO', hydrocyclone: 'CY',
      'cent-comp': 'K', 'recip-comp': 'K', 'screw-comp': 'K', 'axial-comp': 'K', 'roots-blower': 'B', 'vacuum-pump': 'VP', turbine: 'ST',
      'rupture-disc': 'RD', 'flame-arrestor': 'FA', 'breather-valve': 'BV', 'safety-shower': 'SS', 'fire-monitor': 'FM', 'deluge-valve': 'DV', 'gas-detector': 'GD',
      motor: 'MTR', generator: 'GEN', transformer: 'TR', switchgear: 'SWG', vfd: 'VFD', mcc: 'MCC', 'junction-box': 'JB',
      anchor: 'AS', 'guide-support': 'GS', 'spring-hanger': 'SH', 'shoe-support': 'PS', 'saddle-support': 'SD', trunnion: 'TN',
      'wn-flange': 'FL', 'so-flange': 'FL', 'blind-flange': 'FL', manway: 'MW', 'inlet-nozzle': 'N', 'vent-nozzle': 'N',
      chiller: 'CH', 'heater-pkg': 'H', dryer: 'DR', 'steam-header': 'HDR', 'water-header': 'HDR', 'package-unit': 'PKG',
      'inline-pump': 'P', 'split-case': 'P', vturbine: 'P', 'self-prime': 'P', 'int-gear': 'P', 'lobe-pump': 'P',
      'screw-pump': 'P', 'twin-screw': 'P', pcp: 'P', peristaltic: 'P', 'diaphragm-pump': 'P', 'pneu-diaphragm': 'P',
      'plunger-pump': 'P', 'piston-pump': 'P', 'recip-pump': 'P', 'mag-drive': 'P', 'metering-pump': 'P',
      'plug-valve': 'V', 'diaphragm-valve': 'V', 'pinch-valve': 'V', 'swing-check': 'V', 'lift-check': 'V',
      'wafer-check': 'V', 'dual-check': 'V', prv: 'PCV', 'safety-valve': 'PSV', 'solenoid-valve': 'SV',
      'cryo-valve': 'V', 'knife-gate': 'V', 'foot-valve': 'V', 'flush-bottom': 'V', 'sampling-valve': 'V', 'angle-valve': 'V',
      'floating-head': 'E', 'fixed-ts': 'E', 'utube-hx': 'E', 'spiral-hx': 'E', condenser: 'E', evaporator: 'E',
      economizer: 'E', kettle: 'E', 'hairpin-hx': 'E', 'finned-tube': 'E',
      fbr: 'R', 'batch-rx': 'R', 'semibatch-rx': 'R', 'slurry-rx': 'R', 'bubble-col': 'R', 'loop-rx': 'R', 'cat-rx': 'R',
      'flash-drum': 'D', 'ko-drum': 'D', 'surge-drum': 'D', receiver: 'V', accumulator: 'V', 'air-receiver': 'V', 'vacuum-vessel': 'V',
      'fixed-roof': 'TK', 'floating-roof': 'TK', spherical: 'TK', 'cryo-tank': 'TK', api650: 'TK', api620: 'TK', 'ss-tank': 'TK', 'mixing-tank': 'TK',
      stripper: 'C', 'packed-col': 'C', 'tray-col': 'C', fractionator: 'C', deaerator: 'DA', scrubber: 'C', 'demister-col': 'C', 'extraction-col': 'C',
      'scroll-comp': 'K', 'turbo-blower': 'B', 'lr-vacuum': 'VP', 'rv-vacuum': 'VP' }[t] || 'X';
    TAGCNT[pfx] = (TAGCNT[pfx] || 0) + 1;
    return pfx + '-' + (100 + TAGCNT[pfx]);
  }
  // Find the first port on a node matching any of the given roles
  function firstPortByRole(t, roles) {
    var ports = LIB_INDEX[t].ports;
    for (var i = 0; i < ports.length; i++) if (roles.indexOf(ports[i].role) >= 0) return i;
    return 0;
  }
  var OUT_ROLES = ['out', 'liq', 'vap', 'cold-out', 'hot-out'];
  var IN_ROLES = ['in', 'cold-in', 'hot-in'];
  // Canonical id of node type t's port at index pi — undefined for a type
  // not yet in AROPORTS, or a port that predates the registry tagging.
  function portIdAt(t, pi) {
    var lib = LIB_INDEX[t];
    return lib && lib.ports && lib.ports[pi] ? lib.ports[pi].id : undefined;
  }
  /* Backfill p.from.portId / p.to.portId on pipes loaded from a save made
     before this registry existed. pi (the port's array index) stays the
     source of truth for those old pipes — nothing here can invent an id
     for a type outside the first 5, so it's left absent rather than guessed,
     exactly like every other "not modelled yet" gap in this codebase. */
  function migratePipePortIds(pipes) {
    (pipes || []).forEach(function (p) {
      if (!p.from || !p.to) return;
      var a = nodeById(p.from.id), b = nodeById(p.to.id);
      if (a && p.from.portId === undefined) { var fid = portIdAt(a.t, p.from.pi); if (fid) p.from.portId = fid; }
      if (b && p.to.portId === undefined) { var tid = portIdAt(b.t, p.to.pi); if (tid) p.to.portId = tid; }
    });
    return pipes;
  }
  /* ───────────── Stage 2: node/port is the connection identity, not pi ─────────────
     A pipe's from/to still carry a stored pi (array index) for equipment
     outside the 5-type registry and for old saves — but wherever a portId is
     present it is now what's trusted. resolvePipeEnd() is the one place that
     turns a saved {id, pi, portId} reference into the CURRENT port index on
     that node's CURRENT type, every time it's needed (render, 3D build,
     occupancy check, debug output) — never a value read once and cached.
     That's what makes rule 6 (move/rotate/type-change can't silently break a
     connection) hold: there is nowhere else a stale index could survive. */
  function resolvePipeEnd(node, ref) {
    if (!node || !ref) return { pi: -1, ok: false, portId: null };
    var lib = LIB_INDEX[node.t];
    if (!lib || !lib.ports) return { pi: -1, ok: false, portId: ref.portId || null };
    if (ref.portId) {
      for (var i = 0; i < lib.ports.length; i++) {
        if (lib.ports[i].id === ref.portId) return { pi: i, ok: true, portId: ref.portId };
      }
      // A portId was recorded but this node's CURRENT type no longer has it
      // (equipment type changed, or the id came from a different library
      // version) — this is exactly the "invalid connection" rule 14 asks to
      // be detected rather than silently re-guessed onto some other nozzle.
      return { pi: -1, ok: false, portId: ref.portId };
    }
    // No portId recorded at all (equipment type outside the first 5, or a
    // pre-Stage-1 save that migratePipePortIds() couldn't resolve either) —
    // fall back to the stored index, same behaviour as before this stage.
    var pi = ref.pi;
    return { pi: pi, ok: typeof pi === 'number' && pi >= 0 && pi < lib.ports.length, portId: null };
  }
  /* Is nodeId:portId already the endpoint of an existing pipe? Ordinary
     process nozzles take exactly one line — this is what rule 5 (port
     occupancy) uses to reject an accidental duplicate connection before it's
     created, rather than silently drawing two lines on top of one another.
     Only enforced where a real portId exists (the 5 registry types); a type
     outside the registry keeps the old, permissive behaviour. */
  function findPortOccupant(nodeId, portId, excludePipeId) {
    if (!portId) return null;
    for (var i = 0; i < WB.pipes.length; i++) {
      var p = WB.pipes[i];
      if (excludePipeId && p.id === excludePipeId) continue;
      if ((p.from.id === nodeId && p.from.portId === portId) ||
          (p.to.id === nodeId && p.to.portId === portId)) return p;
    }
    return null;
  }

  /* Wire one straight-line series of already-placed nodes: each unit's real
     outlet port to the next one's real inlet port. Shared by both the
     within-block wiring and the block-to-block connector below, so a plant
     built from several blocks is exactly as fully connected as one flat
     recipe always was — only the layout changed, not the wiring rule. */
  function wireSeries(a, b, tagNum) {
    var fp = firstPortByRole(a.t, OUT_ROLES), tp = firstPortByRole(b.t, IN_ROLES);
    var role = LIB_INDEX[a.t].ports[fp].role;
    WB.pipes.push({ id: 'L' + (++WB.seq), from: { id: a.id, pi: fp, portId: portIdAt(a.t, fp) }, to: { id: b.id, pi: tp, portId: portIdAt(b.t, tp) },
      role: role, tag: 'L-' + tagNum, fluid: 'Crude Oil', flow: 50, nps: 6, length: 12, dz: 0 });
  }

  /* Load a flowsheet recipe as an editable starting P&ID. A recipe is
     either a plain 't:Label; t:Label; ...' string (one unlabelled block —
     the original shape) or an array of { name, recipe } blocks, each laid
     out as its own labelled cluster (a real plant reads as named process
     areas — ADU, VDU, FCCU — not one continuous line) and wired straight
     across from the last unit of one block to the first unit of the next,
     so the whole plant stays one connected train regardless of how the
     blocks are arranged on the sheet. */
  WB.loadFlowsheet = function (section, name) {
    var recipe = FLOWSHEETS[section] && FLOWSHEETS[section][name];
    if (!recipe) return;
    if (WB.nodes.length && !confirm('Load the "' + name + '" flowsheet? This replaces the current drawing.')) return;
    pushUndo();
    WB.nodes = []; WB.pipes = []; WB.blockLabels = []; WB.seq = 0; WB.sel = null; WB.selMulti = [];
    var blocks = typeof recipe === 'string' ? [{ name: null, recipe: recipe }] : recipe;

    /* BLOCKS_PER_ROW=2 (not 3) and a tall BLOCK_ROW_H: 2D→3D uses the same
       K scale on both axes (aro-workbench-3d.js's buildFromModel), so a
       shallow row gap next to a wide block reads as almost one continuous
       line in the isometric 3D view even though the 2D sheet shows two
       clearly separate rows — the row-to-row depth has to be comparable to
       a block's own width, not just enough to clear two stacked pieces of
       equipment, or the "plant site" effect only shows up in 2D.

       Rows run SERPENTINE (left-to-right, then right-to-left, alternating)
       instead of every row restarting at the left margin. A left-to-right
       row necessarily ENDS at the far right; if the next row always
       restarted at the far left, the connector from that last unit to the
       next row's first unit had to cross the entire width of the site — a
       single pipe run cutting diagonally across open ground, which is
       exactly the "not a real plant" look reported. Reversing every other
       row means a row always picks up right where the previous one left
       off, so every inter-block connector — within a row or across the
       row wrap — stays a short, local run, the way an actual pipe rack
       chains between adjacent units instead of leaping across the site. */
    var BLOCKS_PER_ROW = 2, BLOCK_GAP_X = 150, BLOCK_ROW_H = 750, MARGIN_X = 70, START_Y = 170;
    var rowX = MARGIN_X, rowTop = START_Y, colInRow = 0, dir = 1;
    var madeAll = [], blockEnds = [];

    blocks.forEach(function (block) {
      var steps = block.recipe.split(';').map(function (s) { return s.trim(); }).filter(Boolean);
      var x = rowX, made = [];
      steps.forEach(function (step, idx) {
        var parts = step.split(':'); var t = parts[0].trim(); var label = (parts[1] || '').trim();
        if (!LIB_INDEX[t]) t = 'v-vessel';
        var lib = LIB_INDEX[t];
        var w = Math.max(lib.w, 90);
        // zig-zag two rows within the block so a long unit stays compact
        var row = idx % 2 === 0 ? rowTop : rowTop + 150;
        // dir=1: icon's left edge sits at the cursor, cursor advances right.
        // dir=-1: icon's RIGHT edge sits at the cursor (icon drawn to its
        // left), cursor advances left — so within a reversed row the first
        // unit placed (the one taking the incoming connector) still lands
        // right at the row's entry point instead of w px past it.
        var n = { id: 'N' + (++WB.seq), t: t, x: dir === 1 ? x : x - w, y: row - lib.h / 2,
          tag: label || defaultTag(t), fluid: 'Crude Oil', flow: 50, temp: 120, press: 5, nps: 6 };
        WB.nodes.push(n); made.push(n); madeAll.push(n);
        x += dir * (w + 70);
      });
      // wire in series within the block
      for (var i = 0; i < made.length - 1; i++) wireSeries(made[i], made[i + 1], 100 + WB.seq);
      if (made.length) blockEnds.push({ first: made[0], last: made[made.length - 1] });

      if (block.name && made.length) {
        var xs = made.map(function (n) { return n.x; }), xe = made.map(function (n) { return n.x + (LIB_INDEX[n.t].w || 80); });
        WB.blockLabels.push({
          x: Math.min.apply(null, xs) - 30, y: rowTop - 46,
          w: Math.max.apply(null, xe) - Math.min.apply(null, xs) + 60, h: 150 + 90 + 46,
          name: block.name
        });
      }

      colInRow++;
      if (colInRow >= BLOCKS_PER_ROW) { colInRow = 0; rowTop += BLOCK_ROW_H; dir = -dir; }
      rowX = x + dir * BLOCK_GAP_X;
    });

    // connect block N's last unit to block N+1's first unit, so the plant
    // reads as one continuous crude-to-products train across every block
    for (var bi = 0; bi < blockEnds.length - 1; bi++) {
      wireSeries(blockEnds[bi].last, blockEnds[bi + 1].first, 900 + bi);
    }

    WB.zoom = blocks.length > 1 ? 0.5 : 0.9; WB.panX = 10; WB.panY = 10;
    render(); renderProps(); sync3D();
    setStatus('Loaded flowsheet: ' + name + ' — ' + madeAll.length + ' units. Edit equipment, re-route lines, then RUN ANALYSIS. (Template for learning; adjust to your real design.)', '#0369a1');
    if (window.setEngineTicker) window.setEngineTicker('system', 'ARO WORKBENCH // Loaded ' + name + ' flowsheet (' + madeAll.length + ' units)', '#00b875');
  };

  WB.deleteSel = function () {
    if (WB.selMulti.length) {
      pushUndo();
      var kill = {}; WB.selMulti.forEach(function (id) { kill[id] = true; });
      WB.nodes = WB.nodes.filter(function (n) { return !kill[n.id]; });
      WB.pipes = WB.pipes.filter(function (p) { return !kill[p.from.id] && !kill[p.to.id]; });
      WB.selMulti = []; WB.sel = null; render(); renderProps(); sync3D();
      return;
    }
    if (!WB.sel) return; pushUndo();
    if (WB.sel.kind === 'node') {
      WB.nodes = WB.nodes.filter(function (n) { return n.id !== WB.sel.id; });
      WB.pipes = WB.pipes.filter(function (p) { return p.from.id !== WB.sel.id && p.to.id !== WB.sel.id; });
    } else if (WB.sel.kind === 'pipe') {
      WB.pipes = WB.pipes.filter(function (p) { return p.id !== WB.sel.id; });
    }
    WB.sel = null; render(); renderProps(); sync3D();
  };
  /* Select every equipment node at once, so it can be moved or deleted as
     one group — the "select all" control asked for alongside group-drag. */
  WB.selectAll = function () {
    WB.selMulti = WB.nodes.map(function (n) { return n.id; }); WB.sel = null;
    render(); renderProps();
  };

  /* ───────────── Pipe routing (orthogonal L-route) ───────────── */
  var DIR_VEC = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } };
  /* Small flange-pair tick at a pipe's connection point — two short strokes
     perpendicular to the pipe run, one right at the port coordinate and one
     a few pixels further out along the pipe (the equipment-side flange face
     and the pipe-side flange face, drafting-convention shorthand for "this
     is a bolted joint, not just a line ending in space"). pt is the exact
     {x,y} from portWorld(); dirKey is that same port's outward direction —
     the connection is precise already (portWorld is exact, see routePipe's
     own note above), this only adds the visual convention on top of it. */
  function flangeTick(pt, dirKey) {
    var d = DIR_VEC[dirKey] || DIR_VEC.e;
    var px = -d.y, py = d.x, len = 5;
    var out = '';
    [0, 4].forEach(function (off) {
      var tx = pt.x + d.x * off, ty = pt.y + d.y * off;
      out += '<line x1="' + (tx - px * len) + '" y1="' + (ty - py * len) + '" x2="' + (tx + px * len) + '" y2="' + (ty + py * len)
        + '" stroke="#334155" stroke-width="1.3" style="pointer-events:none"/>';
    });
    return out;
  }
  function routePipe(a, b) {
    var pts = [{ x: a.x, y: a.y }];
    if (WB.ortho) {
      /* This used to claim "exit stub in port direction" in its comment but
         never actually read a.dir/b.dir — it always just jogged at the raw
         port coordinates, so a bend could land right on top of the
         equipment's own icon (reading as a break in the line) instead of
         stepping cleanly away from the nozzle first. Now it leads out along
         each port's REAL facing direction before routing, matching how the
         3D pipe builder already does it. When that lead alone already lines
         the two ports up (the common case — two horizontally-facing ports
         on equipment placed in a row), the result is a single straight run
         with no bend at all, rather than always forcing an L-jog. */
      var da = DIR_VEC[a.dir] || DIR_VEC.e, db = DIR_VEC[b.dir] || DIR_VEC.w;
      var lead = 22;
      var la = { x: a.x + da.x * lead, y: a.y + da.y * lead };
      var lb = { x: b.x + db.x * lead, y: b.y + db.y * lead };
      pts.push(la);
      if (Math.abs(la.x - lb.x) > 0.5 && Math.abs(la.y - lb.y) > 0.5) {
        var midX = (la.x + lb.x) / 2;
        pts.push({ x: midX, y: la.y });
        pts.push({ x: midX, y: lb.y });
      }
      pts.push(lb);
    }
    pts.push({ x: b.x, y: b.y });
    return pts;
  }
  function pipeLenPx(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }

  /* ───────────── Rendering ───────────── */
  var svg, gWorld, propEl;
  /* 0.3 used to be the floor on both the zoom-out button and the wheel
     handler — fine for a small study flowsheet, but the block-laid-out
     refinery plant is easily 10x wider than that, so 30% was nowhere near
     zoomed out enough to see it as one site and the canvas just clipped.
     0.02 (2%) lets a wide multi-block plant actually be framed by hand;
     3 stays the max-in cap, unchanged. */
  var MIN_ZOOM = 0.02;
  /* A real "fit to content" — the FIT button used to just reset to 100%
     zoom at the origin regardless of what was actually drawn, which did
     nothing useful once the sheet held more than a screenful of
     equipment. This measures the real bounding box of every node and
     picks the zoom/pan that frames all of it with a fixed screen-pixel
     margin, the way "zoom to fit" works in any real drawing tool. */
  function fitToScreen() {
    if (!WB.nodes.length) { WB.zoom = 1; WB.panX = 0; WB.panY = 0; render(); return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    WB.nodes.forEach(function (n) {
      var lib = LIB_INDEX[n.t] || { w: 80, h: 80 };
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + (lib.w || 80)); maxY = Math.max(maxY, n.y + (lib.h || 80));
    });
    var vw = (svg && svg.clientWidth) || 1000, vh = (svg && svg.clientHeight) || 700;
    var pad = 70;
    var z = Math.min((vw - pad * 2) / Math.max(1, maxX - minX), (vh - pad * 2) / Math.max(1, maxY - minY));
    z = Math.max(MIN_ZOOM, Math.min(3, z));
    WB.zoom = z;
    WB.panX = pad - minX * z;
    WB.panY = pad - minY * z;
    render();
  }
  function render() {
    if (!gWorld) return;
    var s = '';
    // grid
    if (WB.gridOn) s += '<rect x="-4000" y="-4000" width="8000" height="8000" fill="url(#wbGrid)"/>';
    // backdrop image (imported)
    if (WB.backdrop) s += '<image href="' + WB.backdrop.href + '" x="' + WB.backdrop.x + '" y="' + WB.backdrop.y + '" width="' + WB.backdrop.w + '" height="' + WB.backdrop.h + '" opacity="0.5"/>';
    // named plant-area blocks (set by WB.loadFlowsheet for a block-format
    // recipe) — a dashed boundary and a header behind the equipment, so a
    // multi-block plant reads as named process areas instead of one
    // undifferentiated train of icons.
    (WB.blockLabels || []).forEach(function (b) {
      s += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="12" fill="rgba(217,107,22,0.035)" stroke="rgba(217,107,22,0.4)" stroke-width="1.5" stroke-dasharray="7 5" style="pointer-events:none"/>';
      s += '<text x="' + (b.x + 16) + '" y="' + (b.y + 24) + '" font-size="14" font-weight="800" letter-spacing="0.05em" fill="#a8500c" font-family="monospace" style="pointer-events:none">' + b.name + '</text>';
    });
    // pipes
    WB.pipes.forEach(function (p) {
      var a = nodeById(p.from.id), b = nodeById(p.to.id);
      if (!a || !b) return;
      var ra = resolvePipeEnd(a, p.from), rb = resolvePipeEnd(b, p.to);
      p._broken = !ra.ok || !rb.ok;
      if (p._broken) {
        // A recorded portId no longer exists on that node (rule 14) — draw
        // it as an unmistakably broken connection between the two equipment
        // centers instead of either crashing or silently vanishing.
        var selcB = (WB.sel && WB.sel.kind === 'pipe' && WB.sel.id === p.id);
        s += '<line x1="' + (a.x + (LIB_INDEX[a.t] ? LIB_INDEX[a.t].w / 2 : 0)) + '" y1="' + (a.y + (LIB_INDEX[a.t] ? LIB_INDEX[a.t].h / 2 : 0))
          + '" x2="' + (b.x + (LIB_INDEX[b.t] ? LIB_INDEX[b.t].w / 2 : 0)) + '" y2="' + (b.y + (LIB_INDEX[b.t] ? LIB_INDEX[b.t].h / 2 : 0))
          + '" stroke="#dc2626" stroke-width="' + (selcB ? 4 : 2.5) + '" stroke-dasharray="3 4" opacity="0.85" data-pipe="' + p.id + '"/>';
        var midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2;
        s += '<text x="' + midx + '" y="' + (midy - 6) + '" font-size="9" font-weight="700" fill="#dc2626" text-anchor="middle" font-family="monospace" stroke="#fff" stroke-width="2.6" paint-order="stroke" style="pointer-events:none">⚠ ' + (p.tag || p.id) + ' — port not found (' + (!ra.ok ? p.from.portId : p.to.portId) + ')</text>';
        return;
      }
      var pa = portWorld(a, ra.pi), pb = portWorld(b, rb.pi);
      var pts = routePipe(pa, pb); p._pts = pts;
      var selc = (WB.sel && WB.sel.kind === 'pipe' && WB.sel.id === p.id);
      var roleCol = (p.role && ROLE[p.role]) ? ROLE[p.role].c : '#475569';
      // a user-chosen line colour always wins; otherwise fall back to status / role colour
      var col = p.color ? p.color : (p.status === 'high' ? '#dc2626' : (p.status === 'ok' ? '#16a34a' : roleCol));
      /* Selecting an EQUIPMENT node used to give no visual sign of what it's
         piped to anywhere in 2D/P&ID — you had to open the properties panel
         and read Source/Destination text to know. Every line touching the
         selected node now gets an orange halo directly on the canvas, so
         the connections are visible the instant you click, in the same
         view, before ever switching to 3D. */
      var connToSelNode = WB.sel && WB.sel.kind === 'node' && (p.from.id === WB.sel.id || p.to.id === WB.sel.id);
      if (connToSelNode) {
        var haloPts = pts, haloD = 'M' + haloPts.map(function (pt) { return pt.x + ' ' + pt.y; }).join(' L');
        s += '<path d="' + haloD + '" fill="none" stroke="#ff7538" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" style="pointer-events:none"/>';
      }
      s += lineDecor(p, pts, col, selc ? 5 : 3);
      s += flangeTick(pa, pa.dir) + flangeTick(pb, pb.dir);
      var mid = pts[Math.floor(pts.length / 2)];
      if (p.tag || p.nps) s += '<text x="' + mid.x + '" y="' + (mid.y - 6) + '" font-size="9" fill="#0f766e" text-anchor="middle" font-family="monospace" stroke="#fff" stroke-width="2.6" paint-order="stroke" style="pointer-events:none">' + (p.tag || '') + (p.nps ? ' ' + p.nps + '"' : '') + (p.dp !== undefined ? ' · ΔP ' + p.dp.toFixed(2) + ' bar' : '') + '</text>';
    });
    // nodes
    WB.nodes.forEach(function (n) {
      var lib = LIB_INDEX[n.t]; if (!lib) return;
      var inGroup = WB.selMulti.indexOf(n.id) !== -1;
      var selc = (WB.sel && WB.sel.kind === 'node' && WB.sel.id === n.id) || inGroup;
      // per-equipment rotation + scale about its own centre (only the
      // node itself transforms — labels drawn upright afterwards)
      var sc = n.scale || 1, rt = n.rot || 0, cx = lib.w / 2, cy = lib.h / 2;
      var bodyTf = 'translate(' + cx + ',' + cy + ') rotate(' + rt + ') scale(' + sc + ') translate(' + (-cx) + ',' + (-cy) + ')';
      s += '<g transform="translate(' + n.x + ',' + n.y + ')" data-node="' + n.id + '" style="cursor:move">';
      // soft ground shadow under the equipment for a 3D sit-on-floor look
      s += '<ellipse cx="' + cx + '" cy="' + (cy + lib.h * sc / 2 + 4) + '" rx="' + (lib.w * sc * 0.42) + '" ry="3.5" fill="#0f172a" opacity="0.12"/>';
      s += '<g transform="' + bodyTf + '" filter="url(#wbShadow)">';
      /* A group member (multi-select, whether from the marquee or
         SELECT ALL) gets a blue box so it reads as "part of the group about
         to move together", distinct from the orange single-item selection. */
      if (selc) s += '<rect x="-6" y="-6" width="' + (lib.w + 12) + '" height="' + (lib.h + 12) + '" fill="none" stroke="' + (inGroup ? '#2563eb' : '#ff7538') + '" stroke-width="' + (1.5 / sc) + '" stroke-dasharray="4 3" rx="4"/>';
      s += WB.pidMode ? pidSymbol(pidCatOf(n.t), lib.w, lib.h, n) : lib.draw();
      s += '</g>';
      // Hold-and-rotate handle above the selected equipment (drag it round)
      if (selc) {
        s += '<line x1="' + cx + '" y1="-6" x2="' + cx + '" y2="-18" stroke="#ff7538" stroke-width="1.4"/>'
          + '<circle cx="' + cx + '" cy="-22" r="6" fill="#ff7538" stroke="#fff" stroke-width="1.5" data-rotate="' + n.id + '" style="cursor:grab"/>'
          + '<path d="M' + (cx - 2.6) + ' -24 a3 3 0 1 0 3 -3" fill="none" stroke="#fff" stroke-width="1.2" style="pointer-events:none"/>';
      }
      // ports — coloured by stream role; labelled when the equipment is
      // selected or the Pipe tool is active (ANSYS-workbench style)
      var showLbl = selc || WB.mode === 'pipe';
      var used = {};
      WB.pipes.forEach(function (pp) {
        if (pp.from.id === n.id) { var rf = resolvePipeEnd(n, pp.from); if (rf.ok) used[rf.pi] = true; }
        if (pp.to.id === n.id) { var rt2 = resolvePipeEnd(n, pp.to); if (rt2.ok) used[rt2.pi] = true; }
      });
      var rr = rt * Math.PI / 180;
      // local (node-relative) position of a port after rotation+scale
      function locPort(pt) {
        var dx = (pt.x - cx) * sc, dy = (pt.y - cy) * sc;
        return { x: cx + dx * Math.cos(rr) - dy * Math.sin(rr), y: cy + dx * Math.sin(rr) + dy * Math.cos(rr) };
      }
      lib.ports.forEach(function (pt, pi) {
        var rl = ROLE[pt.role] || { c: '#94a3b8', lbl: '' };
        var r = showLbl ? 5 : 3;
        var connected = used[pi];
        var lp = locPort(pt);
        s += '<circle cx="' + lp.x + '" cy="' + lp.y + '" r="' + r + '" fill="' + rl.c + '" stroke="' + (connected ? '#0f172a' : '#fff') + '" stroke-width="' + (connected ? 2 : 1.5) + '" data-port="' + n.id + ':' + pi + '" style="cursor:crosshair"/>';
        if (showLbl && (pt.name || rl.lbl)) {
          var lx = lp.x + (pt.dir === 'e' ? 8 : pt.dir === 'w' ? -8 : 0);
          var ly = lp.y + (pt.dir === 's' ? 14 : pt.dir === 'n' ? -7 : 3);
          var anc = pt.dir === 'e' ? 'start' : pt.dir === 'w' ? 'end' : 'middle';
          s += '<text x="' + lx + '" y="' + ly + '" font-size="7.5" font-weight="700" fill="' + rl.c + '" text-anchor="' + anc + '" font-family="monospace" stroke="#fff" stroke-width="2.6" paint-order="stroke" style="pointer-events:none">' + (pt.name || rl.lbl) + '</text>';
        }
      });
      s += '<text x="' + (lib.w / 2) + '" y="' + (lib.h * sc / 2 + cy + 22) + '" font-size="9" font-weight="700" fill="#0f172a" text-anchor="middle" font-family="monospace" stroke="#fff" stroke-width="3" paint-order="stroke" style="pointer-events:none">' + (n.name || n.tag || '') + '</text>';
      s += '</g>';
    });
    // pending pipe rubber-band while connecting (drag or click-click)
    if (WB.pendingPort) {
      var pn = nodeById(WB.pendingPort.id);
      if (pn) {
        var pw = portWorld(pn, WB.pendingPort.pi);
        if (WB.rubberXY) s += '<line x1="' + pw.x + '" y1="' + pw.y + '" x2="' + WB.rubberXY.x + '" y2="' + WB.rubberXY.y + '" stroke="#16a34a" stroke-width="2" stroke-dasharray="6 3"/>';
        s += '<circle cx="' + pw.x + '" cy="' + pw.y + '" r="6" fill="none" stroke="#16a34a" stroke-width="2"/>';
      }
    }
    // Marquee (rubber-band) select box — drag on empty canvas in Select mode
    if (WB.marquee) {
      var mx = Math.min(WB.marquee.x0, WB.marquee.x1), my = Math.min(WB.marquee.y0, WB.marquee.y1);
      var mw = Math.abs(WB.marquee.x1 - WB.marquee.x0), mh = Math.abs(WB.marquee.y1 - WB.marquee.y0);
      s += '<rect x="' + mx + '" y="' + my + '" width="' + mw + '" height="' + mh + '" fill="rgba(37,99,235,0.10)" stroke="#2563eb" stroke-width="' + (1.5 / WB.zoom) + '" stroke-dasharray="5 3"/>';
    }
    gWorld.innerHTML = s;
    // Canvas view mode (ANSYS-style): plan / isometric / front / side.
    // Applied as an outer matrix on top of pan+zoom so the whole flowsheet
    // tilts into a pseudo-3D orientation without changing the model.
    var vm = { plan: '', iso: 'matrix(1,0.28,-0.9,0.5,0,0)', front: 'matrix(1,0,0,0.55,0,0)', side: 'matrix(0.55,0.28,0,1,0,0)' }[WB.viewMode || 'plan'] || '';
    var rot = WB.viewRotate ? ' rotate(' + WB.viewRotate + ' 400 300)' : '';
    gWorld.setAttribute('transform', 'translate(' + WB.panX + ',' + WB.panY + ') scale(' + WB.zoom + ') ' + vm + rot);
    if (svg) svg.style.background = WB.bgColor;
    updateOverlays();
    updateCount();
  }

  // Real-world scale: 1 world unit (px @100%) = 5 mm on the plant
  var MM_PER_UNIT = 5;
  // Live engineering scale bar (mm/cm/m) + 3D X/Y/Z axis gizmo
  function updateOverlays() {
    var dark = isDarkBg(WB.bgColor);
    var sb = document.getElementById('wb-scalebar');
    if (sb) sb.style.color = dark ? '#e2e8f0' : '#334155';
    // pick a "nice" round physical length whose on-screen bar is ~64 px
    var mmForTarget = (64 / WB.zoom) * MM_PER_UNIT;
    var pow = Math.pow(10, Math.floor(Math.log10(mmForTarget)));
    var frac = mmForTarget / pow;
    var niceFrac = frac >= 5 ? 5 : frac >= 2 ? 2 : 1;
    var niceMM = niceFrac * pow;
    var barPx = (niceMM / MM_PER_UNIT) * WB.zoom;
    var lbl = niceMM >= 1000 ? (niceMM / 1000).toFixed(niceMM % 1000 ? 1 : 0) + ' m'
            : niceMM >= 10 ? (niceMM / 10) + ' cm'
            : niceMM + ' mm';
    var zEl = document.getElementById('wb-scale-zoom');
    var lEl = document.getElementById('wb-scale-len');
    var lineEl = document.querySelector('.wb-scalebar-line');
    if (zEl) zEl.textContent = Math.round(WB.zoom * 100) + '%';
    if (lEl) lEl.textContent = lbl;
    if (lineEl) lineEl.style.width = Math.max(20, Math.min(160, barPx)) + 'px';

    // ── 3D coordinate gizmo (spins with the 360° view rotation) ──
    var tri = document.getElementById('wb-triad');
    if (!tri) return;
    var az = (WB.viewRotate || 0) * Math.PI / 180;      // azimuth from user rotation
    var tilt = (WB.viewMode === 'iso' ? 55 : 32) * Math.PI / 180;   // camera pitch
    var cx = 35, cy = 40, L = 20, cA = Math.cos(az), sA = Math.sin(az), cT = Math.cos(tilt), sT = Math.sin(tilt);
    function proj(vx, vy, vz) {                          // rotate about Z(up) then tilt camera
      var rx = vx * cA + vy * sA, ry = -vx * sA + vy * cA;
      return { x: cx + rx * L, y: cy + (ry * sT - vz * cT) * L, depth: ry * cT + vz * sT };
    }
    var axes = [
      { v: [1, 0, 0], c: '#dc2626', l: 'X' },
      { v: [0, 1, 0], c: '#16a34a', l: 'Y' },
      { v: [0, 0, 1], c: '#2563eb', l: 'Z' }
    ].map(function (ax) { var p = proj(ax.v[0], ax.v[1], ax.v[2]); ax.p = p; return ax; })
      .sort(function (a, b) { return a.p.depth - b.p.depth; });   // paint far→near
    var g = '<circle cx="' + cx + '" cy="' + cy + '" r="26" fill="' + (dark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.8)') + '" stroke="#94a3b8" stroke-width="0.8"/>';
    axes.forEach(function (ax) {
      g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ax.p.x.toFixed(1) + '" y2="' + ax.p.y.toFixed(1) + '" stroke="' + ax.c + '" stroke-width="2.6" stroke-linecap="round"/>'
        + '<circle cx="' + ax.p.x.toFixed(1) + '" cy="' + ax.p.y.toFixed(1) + '" r="5" fill="' + ax.c + '"/>'
        + '<text x="' + ax.p.x.toFixed(1) + '" y="' + (ax.p.y + 2.8).toFixed(1) + '" font-size="7.5" font-weight="700" fill="#fff" text-anchor="middle">' + ax.l + '</text>';
    });
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="2.4" fill="#334155"/>';
    tri.innerHTML = g;
  }
  function isDarkBg(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '#ffffff'); if (!m) return false;
    var n = parseInt(m[1], 16), r = n >> 16, gg = (n >> 8) & 255, bb = n & 255;
    return (0.299 * r + 0.587 * gg + 0.114 * bb) < 128;
  }

  function updateCount() {
    var el = document.getElementById('wb-count');
    if (el) el.textContent = WB.nodes.length + ' equipment · ' + WB.pipes.length + ' lines';
  }

  /* ───────────── Property panel ───────────── */
  function renderProps() {
    if (!propEl) return;
    if (WB.selMulti.length > 1) {
      propEl.innerHTML = '<div class="wb-prop-title">' + WB.selMulti.length + ' equipment selected</div>'
        + '<div class="wb-prop-note">Drag any one of them to move the whole group together. DELETE removes all '
        + WB.selMulti.length + '. Click empty canvas, or a single item, to go back to editing one at a time.</div>';
      return;
    }
    if (!WB.sel) { propEl.innerHTML = '<div class="wb-prop-empty">Select an item to edit its properties, or drag a component from the left library onto the canvas.</div>'; return; }
    var h = '';
    if (WB.sel.kind === 'node') {
      var n = nodeById(WB.sel.id); if (!n) { propEl.innerHTML = ''; return; }
      var lib = LIB_INDEX[n.t];
      h += '<div class="wb-prop-title">' + lib.n + '</div>';
      /* A tag on the drawing and a design in a sizing module are the same
         piece of equipment. Where this item is something the suite can
         actually size, offer to carry what the drawing knows across and go
         there, instead of typing the same duty twice. */
      if (window.AROENG && window.AROENG.canSize(pidCatOf(n.t))) {
        h += '<button class="wb-tool wb-size-link" data-size-link="1" '
          + 'style="width:100%;margin:6px 0 2px;padding:6px 8px;font-weight:800;letter-spacing:.05em;">'
          + '&#8594; SIZE THIS EQUIPMENT</button>';
      }
      /* The 2D and P&ID sheets tag equipment the way a real drawing does —
         this jumps straight to that exact item on the 3D model instead of
         making the engineer hunt for it, the way clicking a P&ID tag takes
         you to that piece of equipment on the isometric. */
      if (window.ARO3D) {
        h += '<button class="wb-tool wb-locate3d-link" data-locate3d="1" '
          + 'style="width:100%;margin:2px 0 2px;padding:6px 8px;font-weight:800;letter-spacing:.05em;">'
          + '&#9678; LOCATE IN 3D</button>';
        // Only offer this in 3D — walking is a 3D-scene concept, and jumping
        // into it from 2D/P&ID with no visible operator would be confusing.
        if (WB.mode3d) {
          h += '<button class="wb-tool wb-walkto-link" data-walkto="1" '
            + 'style="width:100%;margin:2px 0 8px;padding:6px 8px;font-weight:800;letter-spacing:.05em;">'
            + '&#128694; WALK TO EQUIPMENT</button>';
        }
      }
      // Per-equipment transform controls (only this clicked equipment)
      h += '<div class="wb-xform"><div class="wb-xform-h">VIEW · this equipment only</div>'
        + '<div class="wb-xform-row">'
        + '<button class="wb-xbtn" data-x="zoomin" title="Zoom in">＋</button>'
        + '<button class="wb-xbtn" data-x="zoomout" title="Zoom out">－</button>'
        + '<button class="wb-xbtn" data-x="rotl" title="Rotate −45°">⟲</button>'
        + '<button class="wb-xbtn" data-x="rotr" title="Rotate +45°">⟳</button>'
        + '<button class="wb-xbtn" data-x="reset" title="Reset view">⤾</button>'
        + '<span class="wb-xval">' + Math.round((n.scale || 1) * 100) + '% · ' + (n.rot || 0) + '°</span>'
        + '</div></div>';
      h += field('Name', 'name', n.name || '', 'text');
      h += field('Tag', 'tag', n.tag, 'text');
      h += field('Location', 'location', n.location || '', 'text');
      h += fluidField(n.fluid);
      h += field('Flow (m³/h)', 'flow', n.flow, 'number');
      h += field('Temp (°C)', 'temp', n.temp, 'number');
      h += field('Pressure (bar g)', 'press', n.press, 'number');
      // Stream connection list — only this equipment's own ports
      var conn = {};
      WB.pipes.forEach(function (pp) {
        if (pp.from.id === n.id) { var rf = resolvePipeEnd(n, pp.from); if (rf.ok) conn[rf.pi] = pp.tag; }
        if (pp.to.id === n.id) { var rt3 = resolvePipeEnd(n, pp.to); if (rt3.ok) conn[rt3.pi] = pp.tag; }
      });
      h += '<div class="wb-streams"><div class="wb-streams-h">STREAM CONNECTIONS</div>';
      lib.ports.forEach(function (pt, pi) {
        var rl = ROLE[pt.role] || { c: '#94a3b8', lbl: 'IO' };
        h += '<div class="wb-stream-row"><span class="wb-dot" style="background:' + rl.c + '"></span>'
          + '<span class="wb-stream-name">' + (pt.name || rl.lbl) + '</span>'
          + '<span class="wb-stream-role" style="color:' + rl.c + '">' + rl.lbl + '</span>'
          + '<span class="wb-stream-conn">' + (conn[pi] ? '→ ' + conn[pi] : '<i>open</i>') + '</span></div>';
      });
      h += '</div><div class="wb-prop-note">Use the Pipe tool, then click this equipment\'s coloured ports to connect streams. Only the ports shown above exist on this ' + lib.n + '.</div>';
    } else {
      var p = pipeById(WB.sel.id); if (!p) { propEl.innerHTML = ''; return; }
      h += '<div class="wb-prop-title">Pipe / Line</div>';
      h += field('Line Tag', 'tag', p.tag || '', 'text');
      h += fluidField(p.fluid || 'Water');
      h += field('Flow (m³/h)', 'flow', p.flow || 10, 'number');
      h += field('NPS (in)', 'nps', p.nps || 3, 'number');
      h += field('Length (m)', 'length', p.length || 5, 'number');
      h += field('Elev. change (m)', 'dz', p.dz || 0, 'number');
      h += lineTypeUI(ltypeOf(p));
      h += lineColorUI(p.color || '');
      // re-route: change which equipment this line runs between
      h += rerouteUI(p);
      if (p.result) {
        var R = p.result;
        h += '<div class="wb-prop-result"><div class="wb-streams-h">LINE SIZING RESULTS</div>'
          + row('Pipe ID / OD', R.D_mm.toFixed(1) + ' / ' + R.OD.toFixed(1) + ' mm')
          + row('Velocity', R.v.toFixed(2) + ' m/s (max ' + R.vMax + ')', R.vWarn)
          + row('Reynolds', Math.round(R.Re).toLocaleString() + ' · ' + R.regime)
          + row('Friction f', R.f.toFixed(4))
          + row('ΔP friction', R.dpF.toFixed(3) + ' bar')
          + row('ΔP static', R.dpZ.toFixed(3) + ' bar')
          + row('ΔP total', R.dp.toFixed(3) + ' bar', p.status === 'high')
          + row('Head loss', R.hL.toFixed(2) + ' m')
          + row('Pipe schedule', R.sched + ' (t ' + R.wall.toFixed(2) + ' mm)')
          + row('Wall req (B31.3)', R.tm.toFixed(2) + ' mm')
          + row('Recommended NPS', R.recNPS + '″', Math.abs(R.recNPS - (p.nps || 3)) > 0.001)
          + '</div><div class="wb-prop-note">Standards: ASME B31.3 / B36.10 · API RP 14E · Crane TP-410 · Perry\'s. Click RUN ANALYSIS for the full per-connection table.</div>';
      }
    }
    propEl.innerHTML = h;
    var sizeBtn = propEl.querySelector('[data-size-link]');
    if (sizeBtn) sizeBtn.addEventListener('click', function () {
      var n = nodeById(WB.sel && WB.sel.id);
      if (!n || !window.AROENG) return;
      var l = LIB_INDEX[n.t] || {};
      window.AROENG.sendToModule({
        category: pidCatOf(n.t),
        tag: n.tag || '', name: n.name || l.n || '',
        fluid: n.fluid || '', flow: parseFloat(n.flow),
        temp: parseFloat(n.temp), press: parseFloat(n.press)
      });
    });
    var locateBtn = propEl.querySelector('[data-locate3d]');
    if (locateBtn) locateBtn.addEventListener('click', function () {
      var nid = WB.sel && WB.sel.id;
      if (!nid || !window.ARO3D) return;
      var jump = function () { window.ARO3D.selectByNid(nid); };
      if (!WB.mode3d && typeof WB.setMode3D === 'function') { WB.setMode3D(true); setTimeout(jump, 60); }
      else jump();
    });
    var walkBtn = propEl.querySelector('[data-walkto]');
    if (walkBtn) walkBtn.addEventListener('click', function () {
      var nid = WB.sel && WB.sel.id;
      if (!nid || !window.ARO3D) return;
      window.ARO3D.walkToEquipment(nid);
    });
    propEl.querySelectorAll('[data-x]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-x');
        if (a === 'zoomin') WB.nodeScale(1.15);
        else if (a === 'zoomout') WB.nodeScale(1 / 1.15);
        else if (a === 'rotl') WB.nodeRotate(-45);
        else if (a === 'rotr') WB.nodeRotate(45);
        else if (a === 'reset') WB.nodeReset();
      });
    });
    propEl.querySelectorAll('[data-f]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        pushUndo();
        var key = inp.getAttribute('data-f'); var val = inp.type === 'number' ? parseFloat(inp.value) : inp.value;
        var obj = WB.sel.kind === 'node' ? nodeById(WB.sel.id) : pipeById(WB.sel.id);
        if (obj) obj[key] = val;
        // Equipment process conditions have to reach the lines leaving it,
        // otherwise RUN ANALYSIS and the report keep using the old stream
        // data and editing equipment appears to do nothing.
        if (obj && WB.sel.kind === 'node') {
          var n = propagateNodeToPipes(obj, key);
          if (n) setStatus('Updated ' + (obj.tag || obj.name || 'equipment') + ' — ' + key + ' applied to ' + n + ' connected line' + (n > 1 ? 's' : '') + '. Click RUN ANALYSIS to re-size.', '#0369a1');
        }
        render(); sync3D();
        renderProps();   // reflect the propagated values immediately
      });
    });
    // Line colour — this line
    function applyLineColor(c) {
      var p = pipeById(WB.sel && WB.sel.id); if (!p) return;
      pushUndo(); p.color = c || undefined; render(); renderProps();
      if (WB.mode3d && window.ARO3D) sync3D(); // recolour in 3D too
    }
    propEl.querySelectorAll('[data-linecol]').forEach(function (b) {
      b.addEventListener('click', function () { applyLineColor(b.getAttribute('data-linecol')); });
    });
    var pick = propEl.querySelector('[data-linecolpick]');
    if (pick) pick.addEventListener('input', function () { applyLineColor(pick.value); });
    var resetBtn = propEl.querySelector('[data-linereset]');
    if (resetBtn) resetBtn.addEventListener('click', function () { applyLineColor(''); });
    var allBtn = propEl.querySelector('[data-lineall]');
    if (allBtn) allBtn.addEventListener('click', function () {
      var p = pipeById(WB.sel && WB.sel.id); var c = (p && p.color) || (pick && pick.value) || '#475569';
      pushUndo(); WB.pipes.forEach(function (pp) { pp.color = c; }); render(); renderProps(); sync3D();
      setStatus('All ' + WB.pipes.length + ' lines set to ' + c + '.', '#0369a1');
    });
    // Re-route — repoint endpoints to different equipment
    propEl.querySelectorAll('[data-reroute]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var p = pipeById(WB.sel && WB.sel.id); if (!p) return;
        var which = sel.getAttribute('data-reroute'), nid = sel.value, n = nodeById(nid); if (!n) return;
        pushUndo();
        if (which === 'from') p.from = { id: nid, pi: outPortIndex(n.t) };
        else p.to = { id: nid, pi: inPortIndex(n.t) };
        render(); renderProps(); sync3D();
        setStatus('Line ' + (p.tag || p.id) + ' re-routed.', '#0369a1');
      });
    });
  }
  function field(label, key, val, type) {
    return '<label class="wb-field"><span>' + label + '</span><input data-f="' + key + '" type="' + type + '" value="' + (val === undefined ? '' : val) + '" step="any"/></label>';
  }
  // Line type editor — the ISA/PIP legend (process/modification/tracing/
  // instrument-connection/signal), grouped exactly like the reference sheet.
  function lineTypeUI(cur) {
    var groups = {};
    Object.keys(LINE_TYPES).forEach(function (k) {
      var g = LINE_TYPES[k].group;
      (groups[g] = groups[g] || []).push(k);
    });
    var opts = Object.keys(groups).map(function (g) {
      return '<optgroup label="' + g + '">' + groups[g].map(function (k) {
        return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + LINE_TYPES[k].label + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    return '<label class="wb-field"><span>Line Type</span><select data-f="ltype">' + opts + '</select></label>'
      + '<div class="wb-prop-note">Matches the plant P&amp;ID legend — existing/new/removed piping, heat-traced or jacketed lines, and instrument connections (electrical, pneumatic, hydraulic, mechanical, capillary) each draw with their own line style.</div>';
  }
  var LINE_SWATCHES = ['#475569', '#2563eb', '#16a34a', '#dc2626', '#f97316', '#a855f7', '#0891b2', '#eab308', '#ec4899', '#111827'];
  // Line colour editor — swatches + free picker, apply to THIS line or ALL lines
  function lineColorUI(cur) {
    var sw = LINE_SWATCHES.map(function (c) {
      return '<button class="wb-swatch' + (c === cur ? ' on' : '') + '" data-linecol="' + c + '" title="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    return '<div class="wb-xform"><div class="wb-xform-h">LINE COLOUR</div>'
      + '<div class="wb-swrow">' + sw + '</div>'
      + '<div class="wb-swrow" style="margin-top:6px;align-items:center;gap:8px;">'
      + '<input type="color" data-linecolpick value="' + (cur || '#475569') + '" style="width:34px;height:24px;padding:0;border:none;background:none;cursor:pointer"/>'
      + '<button class="wb-mini" data-lineall>Apply to ALL lines</button>'
      + '<button class="wb-mini" data-linereset>Reset</button>'
      + '</div></div>';
  }
  // Re-route editor — repoint this line's endpoints to different equipment
  function rerouteUI(p) {
    var opts = function (selId) {
      return WB.nodes.map(function (n) {
        var lib = LIB_INDEX[n.t];
        return '<option value="' + n.id + '"' + (n.id === selId ? ' selected' : '') + '>' + (n.tag || (lib ? lib.n : n.t)) + '</option>';
      }).join('');
    };
    return '<div class="wb-xform"><div class="wb-xform-h">RE-ROUTE · change connected equipment</div>'
      + '<label class="wb-field"><span>From</span><select data-reroute="from">' + opts(p.from.id) + '</select></label>'
      + '<label class="wb-field"><span>To</span><select data-reroute="to">' + opts(p.to.id) + '</select></label>'
      + '</div>';
  }
  function fluidField(cur) {
    var opts = Object.keys(FLUIDS).map(function (k) { return '<option' + (k === cur ? ' selected' : '') + '>' + k + '</option>'; }).join('');
    return '<label class="wb-field"><span>Fluid</span><select data-f="fluid">' + opts + '</select></label>';
  }
  function row(l, v, warn) { return '<div class="wb-rrow' + (warn ? ' warn' : '') + '"><span>' + l + '</span><b>' + v + '</b></div>'; }
  function pipeById(id) { for (var i = 0; i < WB.pipes.length; i++) if (WB.pipes[i].id === id) return WB.pipes[i]; return null; }
  /* ── Stage 2 temporary diagnostic (rule 15) — not wired into any UI, call
     from the console: window.AROWB.debugPipe('L-101'). Prints the same
     shape the 3D side's A3.debugPipe() prints its half of, so the two can
     be read side by side to confirm 2D and 3D agree on the same connection. */
  WB.debugPipe = function (id) {
    var p = pipeById(id); if (!p) { console.log('LINE ' + id + ': not found'); return null; }
    var a = nodeById(p.from.id), b = nodeById(p.to.id);
    var ra = a ? resolvePipeEnd(a, p.from) : { ok: false };
    var rb = b ? resolvePipeEnd(b, p.to) : { ok: false };
    var out = {
      line: p.id,
      source: { node: p.from.id, port: p.from.portId || null, resolved: !!(a && ra.ok) },
      target: { node: p.to.id, port: p.to.portId || null, resolved: !!(b && rb.ok) },
      anchor2D_source: a && ra.ok ? portWorld(a, ra.pi) : null,
      anchor2D_target: b && rb.ok ? portWorld(b, rb.pi) : null
    };
    console.log('LINE: ' + out.line
      + '\n\nSOURCE\nNode: ' + out.source.node + '\nPort: ' + out.source.port + '\nResolved: ' + (out.source.resolved ? 'YES' : 'NO')
      + '\n\nTARGET\nNode: ' + out.target.node + '\nPort: ' + out.target.port + '\nResolved: ' + (out.target.resolved ? 'YES' : 'NO')
      + '\n\n2D source anchor: ' + JSON.stringify(out.anchor2D_source)
      + '\n2D target anchor: ' + JSON.stringify(out.anchor2D_target));
    return out;
  };

  /* ───────────── Calculation engine (line sizing + ΔP) ───────────── */
  // ASME B36.10 — outside diameter + Sch 40/80/160 wall thickness (mm) by NPS
  var PIPE_TBL = {
    0.5:  { OD: 21.3,  s40: 2.77, s80: 3.73, s160: 4.78 },
    0.75: { OD: 26.7,  s40: 2.87, s80: 3.91, s160: 5.56 },
    1:    { OD: 33.4,  s40: 3.38, s80: 4.55, s160: 6.35 },
    1.5:  { OD: 48.3,  s40: 3.68, s80: 5.08, s160: 7.14 },
    2:    { OD: 60.3,  s40: 3.91, s80: 5.54, s160: 8.74 },
    3:    { OD: 88.9,  s40: 5.49, s80: 7.62, s160: 11.13 },
    4:    { OD: 114.3, s40: 6.02, s80: 8.56, s160: 13.49 },
    6:    { OD: 168.3, s40: 7.11, s80: 10.97, s160: 18.26 },
    8:    { OD: 219.1, s40: 8.18, s80: 12.70, s160: 23.01 },
    10:   { OD: 273.0, s40: 9.27, s80: 15.09, s160: 28.58 },
    12:   { OD: 323.8, s40: 10.31, s80: 17.48, s160: 33.32 }
  };
  function nearestNPS(nps) {
    var keys = Object.keys(PIPE_TBL).map(Number); var best = keys[0];
    for (var i = 0; i < keys.length; i++) if (Math.abs(keys[i] - nps) < Math.abs(best - nps)) best = keys[i];
    return best;
  }
  function npsID_mm(nps) {
    var k = nearestNPS(nps); var pt = PIPE_TBL[k];
    return pt.OD - 2 * pt.s40;   // default bore = Sch 40 ID
  }
  // ASME B31.3 pressure-design wall thickness (para. 304.1.2)
  //   t = P·D / (2(S·E·W + P·Y)),  tm = t + c ; then pick a commercial schedule
  function wallThickness(nps, P_barg) {
    var k = nearestNPS(nps); var pt = PIPE_TBL[k];
    var P = Math.max(P_barg, 0) * 0.1;            // barg → MPa
    var S = 137.9, E = 1.0, W = 1.0, Y = 0.4;     // A106-B allowable ~20 ksi, seamless
    var c = 1.5;                                   // corrosion/mill allowance mm
    var t = P * pt.OD / (2 * (S * E * W + P * Y));
    var tm = t + c;
    var sched = 'Sch 40', wall = pt.s40;
    if (tm > pt.s40 * 0.875) { sched = 'Sch 80'; wall = pt.s80; }   // 12.5% mill under-tolerance
    if (tm > pt.s80 * 0.875) { sched = 'Sch 160'; wall = pt.s160; }
    return { tm: tm, sched: sched, wall: wall, OD: pt.OD, nps: k };
  }
  // Recommend an NPS so velocity lands in the target band (liquid ~1-3 m/s)
  function recommendNPS(Qm3s, vTarget) {
    var Dreq = Math.sqrt(4 * Qm3s / (Math.PI * (vTarget || 2)));   // m
    var keys = Object.keys(PIPE_TBL).map(Number);
    for (var i = 0; i < keys.length; i++) { var pt = PIPE_TBL[keys[i]]; if ((pt.OD - 2 * pt.s40) / 1000 >= Dreq) return keys[i]; }
    return keys[keys.length - 1];
  }
  /* Push an equipment item's process conditions onto the lines leaving it.
     The hydraulics in WB.calculate() are driven entirely by pipe data
     (fluid / flow / NPS / pressure), so without this an engineer can edit a
     vessel's flow or fluid, hit RUN ANALYSIS, and see absolutely nothing
     change — the equipment value was never part of the calculation. Only
     the field actually edited is pushed, so a deliberately different line
     size or fluid on a specific run is not silently overwritten.
     Returns how many lines were updated. */
  var NODE_TO_PIPE = { fluid: 'fluid', flow: 'flow', press: 'press', temp: 'temp' };
  function propagateNodeToPipes(node, key) {
    var field = NODE_TO_PIPE[key];
    if (!field || !node) return 0;
    var val = node[key];
    if (val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) return 0;
    var n = 0;
    WB.pipes.forEach(function (p) {
      // outgoing lines carry this equipment's outlet conditions
      if (p.from && p.from.id === node.id) { p[field] = val; n++; }
    });
    // A terminal item (nothing downstream) still owns the line feeding it.
    if (!n) WB.pipes.forEach(function (p) {
      if (p.to && p.to.id === node.id) { p[field] = val; n++; }
    });
    return n;
  }
  WB.calculate = function () {
    pushUndo();
    var anyHigh = false, warnings = [];
    WB.pipes.forEach(function (p) {
      var fl = FLUIDS[p.fluid || 'Water'] || FLUIDS.Water;
      var Q = (p.flow || 10) / 3600;                       // m³/h → m³/s
      var gas = fl.rho < 50;                                // gas/vapour service
      var D = npsID_mm(p.nps || 3) / 1000;                 // m
      var A = Math.PI / 4 * D * D;
      var v = A > 0 ? Q / A : 0;
      var Re = fl.mu > 0 ? fl.rho * v * D / (fl.mu / 1000) : 0;
      var eps = 0.046e-3;                                   // commercial steel roughness (Crane TP-410)
      var f;
      if (Re < 2300 && Re > 0) f = 64 / Re;                 // laminar
      else { var t = eps / (3.7 * D) + 5.74 / Math.pow(Re || 1, 0.9); f = 0.25 / Math.pow(Math.log10(t), 2); } // Swamee-Jain (Colebrook)
      var L = p.length || 5;
      var dpF = f * (L / D) * fl.rho * v * v / 2;           // Pa (Darcy-Weisbach)
      var dpZ = fl.rho * 9.81 * (p.dz || 0);               // Pa (static)
      var dp = (dpF + dpZ) / 1e5;                           // bar
      var hL = fl.rho > 0 ? (dpF + dpZ) / (fl.rho * 9.81) : 0;
      var vMax = gas ? 20 : 3.0;                            // Crane/API velocity limits
      var vWarn = v > vMax;
      var wt = wallThickness(p.nps || 3, p.press !== undefined ? p.press : 5);
      var recN = recommendNPS(Q, gas ? 15 : 2);
      p.result = { v: v, Re: Re, f: f, dpF: dpF / 1e5, dpZ: dpZ / 1e5, dp: dp, hL: hL, vWarn: vWarn,
        D_mm: D * 1000, OD: wt.OD, sched: wt.sched, wall: wt.wall, tm: wt.tm, recNPS: recN, vMax: vMax, gas: gas,
        regime: Re < 2300 ? 'Laminar' : (Re < 4000 ? 'Transitional' : 'Turbulent') };
      p.dp = dp;
      p.status = (dp > 1.0 || vWarn) ? 'high' : 'ok';
      if (p.status === 'high') { anyHigh = true; warnings.push((p.tag || p.id) + ': ΔP ' + dp.toFixed(2) + ' bar' + (vWarn ? ', v ' + v.toFixed(1) + ' m/s (>' + vMax + ')' : '')); }
    });
    render(); renderProps();
    var totalDp = WB.pipes.reduce(function (s, p) { return s + (p.dp || 0); }, 0);
    var msg = WB.pipes.length ? ('SYSTEM ' + (anyHigh ? 'REVIEW NEEDED' : 'STABLE') + ' // lines ' + WB.pipes.length + ' // ΣΔP ' + totalDp.toFixed(2) + ' bar' + (anyHigh ? ' // ' + warnings.length + ' flagged' : ' // all within limits'))
      : 'Add equipment and connect lines, then RUN ANALYSIS.';
    setStatus(msg, anyHigh ? '#f59e0b' : '#16a34a');
    if (window.setEngineTicker) window.setEngineTicker('system', 'ARO WORKBENCH // ' + msg, anyHigh ? '#f59e0b' : '#00b875');
    return { totalDp: totalDp, anyHigh: anyHigh, warnings: warnings };
  };
  function setStatus(msg, col) { var el = document.getElementById('wb-status'); if (el) { el.textContent = msg; el.style.color = col || '#94a3b8'; } }

  // Human label for a line's endpoints: "TAG · PortName"
  function endLabel(ref) {
    var n = nodeById(ref.id); if (!n) return '-';
    var pt = LIB_INDEX[n.t].ports[ref.pi];
    return (n.tag || n.id) + (pt && pt.name ? ' · ' + pt.name : '');
  }

  /* ───────────── RUN ANALYSIS → per-connection line-sizing results ─────────────
     Full line sizing for every equipment-to-equipment connection, per
     ASME B31.3 / B36.10, API RP 14E, Crane TP-410 and Perry's Handbook. */
  WB.runAnalysis = function () {
    if (!WB.pipes.length) { WB.calculate(); alert('Draw at least one line between equipment, then RUN ANALYSIS.'); return; }
    var res = WB.calculate();
    var rows = WB.pipes.map(function (p, i) {
      var r = p.result || {};
      var recNote = (r.recNPS && Math.abs(r.recNPS - (p.nps || 3)) > 0.001)
        ? '<span style="color:#d97706;">NPS ' + r.recNPS + '″ suggested</span>' : '<span style="color:#16a34a;">size OK</span>';
      return '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td><b>' + (p.tag || p.id) + '</b><br><span style="color:#64748b;font-size:9.5px;">' + endLabel(p.from) + ' → ' + endLabel(p.to) + '</span></td>'
        + '<td>' + (p.fluid || '-') + '</td>'
        + '<td>' + (p.flow || '-') + '</td>'
        + '<td>NPS ' + (p.nps || '-') + '″<br><span style="color:#64748b;font-size:9.5px;">ID ' + (r.D_mm ? r.D_mm.toFixed(1) : '-') + ' · OD ' + (r.OD ? r.OD.toFixed(1) : '-') + ' mm</span></td>'
        + '<td>' + (r.v ? r.v.toFixed(2) : '-') + '<br><span style="color:#64748b;font-size:9px;">max ' + (r.vMax || '-') + '</span></td>'
        + '<td>' + (r.Re ? Math.round(r.Re).toLocaleString() : '-') + '<br><span style="color:#64748b;font-size:9px;">' + (r.regime || '') + '</span></td>'
        + '<td>' + (r.f ? r.f.toFixed(4) : '-') + '</td>'
        + '<td>' + (r.dpF !== undefined ? r.dpF.toFixed(3) : '-') + '<br><span style="color:#64748b;font-size:9px;">+stat ' + (r.dpZ !== undefined ? r.dpZ.toFixed(3) : '-') + '</span></td>'
        + '<td><b>' + (p.dp !== undefined ? p.dp.toFixed(3) : '-') + '</b></td>'
        + '<td>' + (r.hL !== undefined ? r.hL.toFixed(2) : '-') + '</td>'
        + '<td>' + (r.sched || '-') + '<br><span style="color:#64748b;font-size:9px;">t ' + (r.wall ? r.wall.toFixed(2) : '-') + ' (req ' + (r.tm ? r.tm.toFixed(2) : '-') + ')</span></td>'
        + '<td style="text-align:center;">' + recNote + '<br><span style="font-weight:700;color:' + (p.status === 'high' ? '#dc2626' : '#16a34a') + ';">' + (p.status === 'high' ? '⚠ REVIEW' : '✓ OK') + '</span></td>'
        + '</tr>';
    }).join('');
    var head = '<div class="wb-rep-head">RUN ANALYSIS — LINE SIZING &amp; HYDRAULICS</div>'
      + '<div class="wb-rep-sub">Per equipment-to-equipment connection · ' + new Date().toLocaleString() + '</div>'
      + '<div class="wb-rep-verdict" style="background:' + (res.anyHigh ? '#fef2f2' : '#f0fdf4') + ';border-color:' + (res.anyHigh ? '#dc2626' : '#16a34a') + ';color:' + (res.anyHigh ? '#991b1b' : '#166534') + ';">'
      + (res.anyHigh ? '⚠ ' + res.warnings.length + ' line(s) need review — ΔP or velocity over limit' : '✓ ALL LINES WITHIN LIMITS — velocity & ΔP acceptable')
      + ' · Total system ΔP ' + res.totalDp.toFixed(2) + ' bar</div>';
    var tbl = '<div style="overflow-x:auto;"><table class="wb-table wb-analysis"><tr>'
      + '<th>#</th><th>Line (from → to)</th><th>Fluid</th><th>Flow<br>m³/h</th><th>Size<br>(ID/OD)</th><th>Vel<br>m/s</th><th>Reynolds</th><th>Friction<br>f</th><th>ΔP fric<br>bar</th><th>ΔP tot<br>bar</th><th>Head<br>loss m</th><th>Schedule<br>& wall mm</th><th>Verdict</th>'
      + '</tr>' + rows + '</table></div>';
    var stds = '<div class="wb-std"><b>Design standards applied:</b> '
      + '<span>ASME B31.3</span> process-piping pressure-design wall thickness (t = P·D / 2(SE+PY) + c) · '
      + '<span>ASME B36.10</span> pipe OD &amp; schedule (40/80/160) · '
      + '<span>API RP 14E</span> erosional / service velocity limits · '
      + '<span>Crane TP-410</span> Darcy-Weisbach ΔP with Colebrook (Swamee-Jain) friction &amp; ε = 0.046 mm · '
      + '<span>Perry\'s Handbook</span> flow-regime (Re) &amp; head-loss correlations.'
      + '<br><span style="color:#94a3b8;">Wall thickness uses A106-B allowable S = 137.9 MPa, E = 1.0, Y = 0.4, corrosion allowance c = 1.5 mm. Values are preliminary sizing — confirm against project spec.</span></div>';
    modal('RUN ANALYSIS — RESULTS', head + tbl + stds, true);
  };

  /* ───────────── BOM + Report ───────────── */
  WB.bom = function () {
    var counts = {};
    WB.nodes.forEach(function (n) { var k = LIB_INDEX[n.t].n; counts[k] = (counts[k] || 0) + 1; });
    var pipeM = WB.pipes.reduce(function (s, p) { return s + (p.length || 5); }, 0);
    var rows = Object.keys(counts).map(function (k, i) { return '<tr><td>' + (i + 1) + '</td><td>' + k + '</td><td>EA</td><td>' + counts[k] + '</td></tr>'; }).join('');
    rows += '<tr><td>' + (Object.keys(counts).length + 1) + '</td><td>Process Piping (all lines)</td><td>m</td><td>' + pipeM.toFixed(1) + '</td></tr>';
    modal('BILL OF MATERIALS', '<table class="wb-table"><tr><th>#</th><th>Description</th><th>Unit</th><th>Qty</th></tr>' + rows + '</table>');
  };
  /* A still image of the 2D flowsheet, framed to its own content — the SVG
     serialises with its inline background colour intact. It is then
     rasterised to a plain PNG (not left as an SVG data URI) before the
     callback fires: an <img src="data:image/svg+xml..."> looks fine inline,
     but the DOWNLOAD PDF path (html2canvas, via AROPDF in aro-phe.js) does
     not reliably rasterise SVG data-URI images — it silently renders them
     blank while an ordinary PNG <img> works — so the report would show a
     correct 3D snapshot but an empty box where the 2D schematic belongs.
     Converting to PNG here, the same way the 3D snapshot already is,
     removes that whole class of renderer-dependent failure. */
  function capture2D(cb) {
    var svg = document.getElementById('wb-svg');
    if (!svg) { cb(null); return; }
    try {
      // Frame from the model's own world coordinates, not a DOM getBBox() —
      // #wb-world also carries the 8000×8000 background grid rect as a
      // child, so measuring the group itself always returns that instead
      // of the equipment. Node/pipe positions are already in that same
      // world space, so summing them directly gives the true content box.
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      WB.nodes.forEach(function (n) {
        var lib = LIB_INDEX[n.t]; if (!lib) return;
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + lib.w); maxY = Math.max(maxY, n.y + lib.h + 24);
      });
      WB.pipes.forEach(function (p) {
        (p._pts || []).forEach(function (pt) {
          minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
        });
      });
      var pad = 40;
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = svg.clientWidth || 900; maxY = svg.clientHeight || 600; pad = 0; }
      var clone = svg.cloneNode(true);
      var cloneWorld = clone.querySelector('#wb-world');
      if (cloneWorld) cloneWorld.removeAttribute('transform');   // clean top-down frame, independent of the on-screen pan/zoom/iso view
      var vx = minX - pad, vy = minY - pad, vw = (maxX - minX) + pad * 2, vh = (maxY - minY) + pad * 2;
      var pxW = Math.round(vw), pxH = Math.round(vh);
      clone.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
      clone.setAttribute('width', pxW);
      clone.setAttribute('height', pxH);
      clone.style.background = WB.bgColor || '#ffffff';
      /* 3D mode parks the live SVG at visibility:hidden (it stays in the
         render tree so its <defs> keep feeding the library thumbnails).
         cloneNode copies that inline style, and a hidden SVG rasterises to
         a perfectly blank image at the correct size — which is exactly why
         the report's 2D pane came out empty whenever it was generated from
         3D. Force the capture visible; it is off-document anyway. */
      clone.style.visibility = 'visible';
      clone.style.display = 'block';
      clone.style.opacity = '1';
      var xml = new XMLSerializer().serializeToString(clone);
      var svgUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
      var img = new Image();
      var scale = 2; // render at 2x for a crisp PDF/print rasterisation
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = pxW * scale; canvas.height = pxH * scale;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = WB.bgColor || '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          cb(canvas.toDataURL('image/png'));
        } catch (e) { cb(svgUri); } // canvas tainted or unsupported — SVG data URI still renders fine inline
      };
      img.onerror = function () { cb(svgUri); };
      img.src = svgUri;
    } catch (e) { cb(null); }
  }
  /* Capture the 2D canvas rendered in a specific symbol mode, regardless of
     which workbench the engineer is currently looking at. All three
     workbenches (2D / P&ID / 3D) are views of ONE shared model, so the
     report can show every one of them: flip the symbol mode, re-render,
     rasterise, then put the mode back exactly as it was. The user never
     sees the flip — it happens within a single frame. */
  function captureView(wantPid, cb) {
    var prev = !!WB.pidMode;
    WB.pidMode = !!wantPid;
    try { render(); } catch (e) {}
    capture2D(function (img) {
      WB.pidMode = prev;
      try { render(); } catch (e) {}
      cb(img);
    });
  }
  /* A still PNG of the 3D model, built (or refreshed) from the same nodes
     and pipes the 2D view drew — flips into 3D mode to render it if the
     engineer is currently in 2D, then flips back so nothing else changes. */
  function capture3D(cb) {
    if (!window.ARO3D || !WB.setMode3D) { cb(null); return; }
    var wasMode3D = !!WB.mode3d;
    if (!wasMode3D) WB.setMode3D(true);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (window.ARO3D.resize) window.ARO3D.resize();
        var data = window.ARO3D.snapshot ? window.ARO3D.snapshot() : null;
        if (!wasMode3D) WB.setMode3D(false);
        cb(data);
      });
    });
  }
  // "Tag — Equipment Name" for a line endpoint, e.g. "P-101 — Centrifugal Pump"
  function reportEndLabel(ref) {
    var n = nodeById(ref.id); if (!n) return '-';
    var lib = LIB_INDEX[n.t];
    return (n.tag || n.id) + (lib ? ' — ' + lib.n : '');
  }
  /* Static P&ID reference legend — standard service line-color code,
     pipe connection/junction symbols, flow-direction convention, and the
     core equipment symbol key. Shown on every report (not just the line
     types actually used) the way a real P&ID's legend sheet is fixed
     regardless of which lines a given drawing happens to use. */
  function pidLegendRow(svgBody, label) {
    return '<div class="wb-rep-legend-row"><svg width="34" height="18" viewBox="0 0 34 18" stroke="#334155" stroke-width="1.6" fill="none">' + svgBody + '</svg><span>' + label + '</span></div>';
  }
  function pidColorCodeTable() {
    var rows = [
      ['Process Line', '#0f172a', 'Fuel Gas', '#92400e'],
      ['Steam', '#dc2626', 'Vacuum', '#94a3b8'],
      ['Cooling Water', '#2563eb', 'Drain', '#16a34a'],
      ['Hot Water', '#f97316', 'Vent', '#cbd5e1'],
      ['Air', '#38bdf8', 'Sample / Chemical Line', '#ec4899'],
      ['Nitrogen', '#a855f7', 'Fire Water', '#1d4ed8'],
      ['Instrument Signal', '#0d9488', 'Slurry / Mud', '#a16207'],
      ['Electrical Signal', '#eab308', 'Future Line', '#64748b']
    ];
    function sw(hex) { return '<span style="display:inline-block;width:20px;height:8px;background:' + hex + ';border-radius:1px;vertical-align:middle;margin-right:5px;"></span>'; }
    var body = rows.map(function (r) {
      return '<tr><td>' + sw(r[1]) + r[0] + '</td><td>' + sw(r[3]) + r[2] + '</td></tr>';
    }).join('');
    return '<table class="wb-table wb-rep-cc-table">' + body + '</table>';
  }
  function pidJunctionSymbols() {
    return [
      pidLegendRow('<line x1="2" y1="9" x2="32" y2="9"/><line x1="17" y1="2" x2="17" y2="16"/><circle cx="17" cy="9" r="2.2" fill="#334155"/>', 'Connected Pipes'),
      pidLegendRow('<line x1="2" y1="9" x2="13" y2="9"/><line x1="21" y1="9" x2="32" y2="9"/><path d="M13 9 a4 5 0 0 1 8 0"/>', 'Crossing (No Connection)'),
      pidLegendRow('<line x1="2" y1="9" x2="32" y2="9"/><line x1="17" y1="9" x2="17" y2="17"/>', 'Branch / Tee Connection'),
      pidLegendRow('<path d="M2 5 h12 l8 8 h8" />', 'Reducer'),
      pidLegendRow('<line x1="2" y1="9" x2="32" y2="9"/><line x1="15" y1="3" x2="15" y2="15"/><line x1="19" y1="3" x2="19" y2="15"/>', 'Flanged Connection'),
      pidLegendRow('<path d="M2 9 h7 l3 -6 l3 12 l3 -12 l3 6 h7" />', 'Expansion Joint'),
      pidLegendRow('<line x1="2" y1="9" x2="11" y2="9"/><line x1="23" y1="9" x2="32" y2="9"/><circle cx="13.5" cy="6" r="3.2"/><circle cx="20.5" cy="12" r="3.2"/>', 'Spectacle Blind'),
      pidLegendRow('<line x1="2" y1="9" x2="20" y2="9"/><line x1="20" y1="2" x2="20" y2="16"/>', 'Blind Flange')
    ].join('');
  }
  function pidFlowDirection() {
    return [
      pidLegendRow('<line x1="2" y1="9" x2="26" y2="9"/><path d="M22 5 l6 4 l-6 4 Z" fill="#334155"/>', 'Left to Right'),
      pidLegendRow('<line x1="8" y1="9" x2="32" y2="9"/><path d="M12 5 l-6 4 l6 4 Z" fill="#334155"/>', 'Right to Left'),
      pidLegendRow('<line x1="17" y1="2" x2="17" y2="16"/><path d="M13 6 l4 -6 l4 6 Z" fill="#334155"/>', 'Upward Flow'),
      pidLegendRow('<line x1="17" y1="2" x2="17" y2="16"/><path d="M13 12 l4 6 l4 -6 Z" fill="#334155"/>', 'Downward Flow'),
      pidLegendRow('<line x1="2" y1="9" x2="22" y2="9"/><path d="M18 5 l6 4 l-6 4 Z" fill="#334155"/><circle cx="29" cy="9" r="4"/>', 'Flow In / To Equipment'),
      pidLegendRow('<circle cx="6" cy="9" r="4"/><line x1="10" y1="9" x2="30" y2="9"/><path d="M26 5 l6 4 l-6 4 Z" fill="#334155"/>', 'Flow Out / From Equipment')
    ].join('');
  }
  function pidSymbolLegend() {
    return [
      pidLegendRow('<path d="M2 3 L17 9 L2 15 Z M32 3 L17 9 L32 15 Z"/>', 'Control Valve'),
      pidLegendRow('<path d="M2 3 L17 9 L2 15 Z M32 3 L17 9 L32 15 Z" fill="#e2e8f0"/>', 'Isolation Valve'),
      pidLegendRow('<line x1="2" y1="9" x2="32" y2="9"/><path d="M10 3 L24 9 L10 15 Z"/>', 'Check Valve'),
      pidLegendRow('<circle cx="10" cy="9" r="7"/><path d="M10 9 L17 4 M10 9 L17 14"/>', 'Pump'),
      pidLegendRow('<circle cx="17" cy="9" r="7"/>', 'Instrument'),
      pidLegendRow('<rect x="10" y="2" width="14" height="14" rx="7"/>', 'Vessel / Column'),
      pidLegendRow('<rect x="4" y="4" width="26" height="10" rx="2"/><line x1="4" y1="9" x2="30" y2="9"/>', 'Heat Exchanger')
    ].join('');
  }
  /* One drawing laid out as a real A4 landscape sheet: ruled border, column
     numbers across the top/bottom, row letters down both sides, and a proper
     bottom-right title block — the layout of the reference P&ID. Each view
     (2D / P&ID / 3D) gets its own numbered sheet. */
  function a4Sheet(title, img, sheetNo, sheetTotal, alt, dark) {
    if (!img) return '<div class="wb-rep-note">' + title + ' unavailable.</div>';
    var cols = 10, rows = 8, i;
    var colBar = '';
    for (i = 1; i <= cols; i++) colBar += '<div class="wb-a4-c">' + i + '</div>';
    var rowBar = '';
    for (i = 0; i < rows; i++) rowBar += '<div class="wb-a4-r">' + String.fromCharCode(65 + i) + '</div>';
    var pno = 'PID-' + String(WB.seq || 1).padStart(3, '0');
    return ''
      + '<div class="wb-a4">'
      +   '<div class="wb-a4-top">' + colBar + '</div>'
      +   '<div class="wb-a4-mid">'
      +     '<div class="wb-a4-side">' + rowBar + '</div>'
      +     '<div class="wb-a4-field' + (dark ? ' dark' : '') + '">'
      +       '<div class="wb-a4-title">' + title + '</div>'
      +       '<img src="' + img + '" alt="' + alt + '"/>'
      +     '</div>'
      +     '<div class="wb-a4-side">' + rowBar + '</div>'
      +   '</div>'
      +   '<div class="wb-a4-top">' + colBar + '</div>'
      +   '<table class="wb-a4-tb">'
      +     '<tr>'
      +       '<td class="l"><b>PROJECT</b><br>' + (WB.projectName || 'AROGARA Process Flowsheet') + '</td>'
      +       '<td class="l"><b>CLIENT</b><br>—</td>'
      +       '<td><b>DRAWN BY</b><br>AROGARA FlowSize</td>'
      +       '<td><b>CHECKED</b><br>QA / QC</td>'
      +     '</tr>'
      +     '<tr>'
      +       '<td class="l"><b>TITLE</b><br>' + title + '</td>'
      +       '<td class="l"><b>P&amp;ID NO.</b><br>' + pno + '</td>'
      +       '<td><b>REV.</b><br>0</td>'
      +       '<td><b>DATE</b><br>' + new Date().toLocaleDateString() + '</td>'
      +     '</tr>'
      +     '<tr>'
      +       '<td class="l" colspan="2"><b>NOTE</b><br>NOT FOR CONSTRUCTION</td>'
      +       '<td colspan="2"><b>SHEET</b><br>' + sheetNo + ' OF ' + sheetTotal + '</td>'
      +     '</tr>'
      +   '</table>'
      + '</div>';
  }
  WB.report = function () {
    if (!WB.nodes.length) { setStatus('Add equipment before generating a report.', '#f59e0b'); return; }
    var res = WB.calculate();
    // Connections table: what equipment is piped to what (the core "P&ID"
    // question) — each line's tag plus its From/To equipment.
    var pr = WB.pipes.map(function (p, i) {
      var r = p.result || {};
      return '<tr><td>' + (i + 1) + '</td><td>' + (p.tag || p.id) + '</td><td>' + reportEndLabel(p.from) + '</td><td>' + reportEndLabel(p.to) + '</td><td>' + (p.fluid || '-') + '</td><td>' + (p.nps || '-') + '"</td><td>' + (p.flow || '-') + '</td><td>' + (r.v ? r.v.toFixed(2) : '-') + '</td><td>' + (r.Re ? Math.round(r.Re).toLocaleString() : '-') + '</td><td>' + (p.dp !== undefined ? p.dp.toFixed(3) : '-') + '</td><td style="color:' + (p.status === 'high' ? '#dc2626' : '#16a34a') + ';font-weight:700;">' + (p.status === 'high' ? 'REVIEW' : 'OK') + '</td></tr>';
    }).join('');
    var eq = WB.nodes.map(function (n, i) { return '<tr><td>' + (i + 1) + '</td><td>' + (n.tag || '') + '</td><td>' + (n.name || '') + '</td><td>' + LIB_INDEX[n.t].n + '</td><td>' + (n.location || '-') + '</td><td>' + (n.fluid || '-') + '</td><td>' + (n.flow || '-') + '</td><td>' + (n.temp || '-') + '</td><td>' + (n.press || '-') + '</td></tr>'; }).join('');
    // Instrument List (Tag / Description), matching a standard P&ID's
    // separate instrument index — filtered from the placed nodes.
    var instrTypes = {}; (LIB['Instruments'] || []).forEach(function (it) { instrTypes[it.t] = it.n; });
    var instrNodes = WB.nodes.filter(function (n) { return instrTypes[n.t]; });
    var instr = instrNodes.map(function (n, i) { return '<tr><td>' + (i + 1) + '</td><td><b>' + (n.tag || '') + '</b></td><td>' + instrTypes[n.t] + '</td><td>' + (n.name || '-') + '</td></tr>'; }).join('');
    // Legend — built from the line types actually used in this flowsheet.
    var ltypeColor = { major: '#0f172a', minor: '#334155', existing: '#0f172a', new: '#0f172a', remove: '#ef4444',
      heattrace: '#dc2626', jacketed: '#94a3b8', electrical: '#eab308', pneumatic: '#0891b2',
      hydraulic: '#f97316', mechanical: '#64748b', capillary: '#a855f7', emsignal: '#64748b', digital: '#0d9488' };
    var usedLtypes = {}; WB.pipes.forEach(function (p) { usedLtypes[ltypeOf(p)] = true; });
    var legendRows = Object.keys(usedLtypes).map(function (k) {
      var lt = LINE_TYPES[k]; if (!lt) return '';
      return '<div class="wb-rep-legend-row"><svg width="34" height="10"><line x1="0" y1="5" x2="34" y2="5" stroke="' + (ltypeColor[k] || '#0f172a') + '" stroke-width="2.5" stroke-dasharray="' + (lt.dash || '') + '"/></svg><span>' + lt.label + '</span></div>';
    }).join('');
    var legend = (legendRows ? '<h4>Line Types Used in This Drawing</h4><div class="wb-rep-legend">' + legendRows + '</div>' : '')
      + '<h4>P&amp;ID Symbol Legend</h4><div class="wb-rep-legend">' + pidSymbolLegend() + '</div>'
      + '<h4>Line Color Code (Standard)</h4>' + pidColorCodeTable()
      + '<h4>Pipe Connection &amp; Junction Symbols</h4><div class="wb-rep-legend">' + pidJunctionSymbols() + '</div>'
      + '<h4>Line Flow Direction</h4><div class="wb-rep-legend">' + pidFlowDirection() + '</div>';
    var verdict = '<div class="wb-rep-verdict" style="background:' + (res.anyHigh ? '#fef2f2' : '#f0fdf4') + ';border-color:' + (res.anyHigh ? '#dc2626' : '#16a34a') + ';color:' + (res.anyHigh ? '#991b1b' : '#166534') + ';">' + (res.anyHigh ? '⚠ SYSTEM REVIEW NEEDED — ' + res.warnings.length + ' line(s) exceed ΔP/velocity limits' : '✓ SYSTEM STABLE — all lines within ΔP ≤ 1.0 bar and velocity ≤ 3 m/s') + ' · Total ΔP ' + res.totalDp.toFixed(2) + ' bar</div>';
    var titleBlock = '<table class="wb-table wb-rep-titleblock"><tr><td><b>PROJECT</b><br>' + (WB.projectName || 'AROGARA Process Flowsheet') + '</td>'
      + '<td><b>P&amp;ID NO.</b><br>PID-' + String(WB.seq || 1).padStart(3, '0') + '</td>'
      + '<td><b>REV.</b><br>0</td>'
      + '<td><b>DATE</b><br>' + new Date().toLocaleDateString() + '</td>'
      + '<td><b>DRAWN BY</b><br>AROGARA FlowSize</td></tr></table>';
    var tables = '<h4>Equipment Technical Data Sheet</h4><table class="wb-table"><tr><th>#</th><th>Tag</th><th>Name</th><th>Type</th><th>Location</th><th>Fluid</th><th>Flow m³/h</th><th>T °C</th><th>P barg</th></tr>' + (eq || '<tr><td colspan="9">No equipment placed.</td></tr>') + '</table>'
      + '<h4>Connections &amp; Line List (What Connects to What)</h4><table class="wb-table"><tr><th>#</th><th>Line</th><th>From</th><th>To</th><th>Fluid</th><th>NPS</th><th>Flow</th><th>Velocity m/s</th><th>Re</th><th>ΔP bar</th><th>Status</th></tr>' + (pr || '<tr><td colspan="11">No lines drawn.</td></tr>') + '</table>'
      + (instrNodes.length ? '<h4>Instrument List</h4><table class="wb-table"><tr><th>#</th><th>Tag</th><th>Description</th><th>Notes</th></tr>' + instr + '</table>' : '')
      + legend;
    setStatus('Building 2D, P&ID and 3D views for the report…', '#38bdf8');
    // All three workbenches are views of the same model, so the report
    // carries all three: detailed 2D, ISA/PIP schematic, and the 3D model.
    // Remember which workbench the engineer is on — capturing walks through
    // every view, and we must land them back exactly where they were.
    var mode0 = { pid: !!WB.pidMode, m3: !!WB.mode3d };
    captureView(false, function (img2d) {
      captureView(true, function (imgPid) {
        capture3D(function (img3d) {
          if (WB.setWorkbench) WB.setWorkbench(mode0.pid, mode0.m3);
          var sheets =
              a4Sheet('2D FLOWSHEET — DETAILED EQUIPMENT VIEW', img2d, 1, 3, '2D flowsheet', false)
            + a4Sheet('P&ID SCHEMATIC — ISA / PIP SYMBOLS', imgPid, 2, 3, 'P&ID schematic', false)
            + a4Sheet('3D MODEL VIEW', img3d, 3, 3, '3D model', true);
          var html = '<div class="wb-rep-head">ARO WORKBENCH — P&amp;ID PROCESS SYSTEM REPORT</div>'
            + '<div class="wb-rep-sub">AROGARA FlowSize · ' + new Date().toLocaleString() + ' · (NOT FOR CONSTRUCTION)</div>'
            + titleBlock + verdict + sheets + tables;
          modal('SYSTEM REPORT — 2D + P&ID + 3D · TECHNICAL DATA SHEET', html, true);
          setStatus('Report ready — 2D, P&ID and 3D sheets. View inline or use DOWNLOAD PDF.', '#16a34a');
        });
      });
    });
  };

  /* ───────────── Project save / open / import ───────────── */
  WB.newProject = function () { if (WB.nodes.length && !confirm('Start a new project? Unsaved work will be lost.')) return; pushUndo(); WB.nodes = []; WB.pipes = []; WB.blockLabels = []; WB.seq = 0; WB.sel = null; WB.selMulti = []; WB.backdrop = null; render(); renderProps(); sync3D(); setStatus('New project.', '#94a3b8'); };
  WB.save = function () {
    var payload = { v: 1, nodes: WB.nodes, pipes: WB.pipes, seq: WB.seq };
    var data = JSON.stringify(payload, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aro-workbench-project.json'; a.click();
    try { localStorage.setItem('aroWorkbenchProject', data); } catch (e) {}
    // also save to the engineer's cloud account (Firestore) when signed in
    if (window.AROCLOUD) {
      var nm = (window.prompt('Save to your AROGARA account as:', WB.projectName || 'Workbench project') || '').trim();
      if (nm) {
        WB.projectName = nm;
        setStatus('Saving “' + nm + '” to your account…', '#38bdf8');
        window.AROCLOUD.saveProject('workbench', nm, payload, WB.cloudId).then(function (rec) {
          WB.cloudId = rec.id || WB.cloudId;
          setStatus('Saved to your account: ' + nm, '#16a34a');
        }).catch(function () {
          setStatus('Saved locally — cloud save unavailable (offline?).', '#f59e0b');
        });
        return;
      }
    }
    setStatus('Project saved (download + browser storage).', '#16a34a');
  };

  /* Open a project previously saved to the engineer's cloud account. */
  WB.cloudOpen = function () {
    if (!window.AROCLOUD) { alert('Cloud storage is not available.'); return; }
    setStatus('Loading your saved projects…', '#38bdf8');
    window.AROCLOUD.listProjects('workbench').then(function (list) {
      if (!list.length) { setStatus('No cloud projects saved yet.', '#f59e0b'); return; }
      var msg = 'Your saved workbench projects:\n\n' + list.map(function (r, i) {
        return (i + 1) + '. ' + r.name + '  (' + String(r.updatedAt || '').slice(0, 10) + ')';
      }).join('\n') + '\n\nEnter a number to open:';
      var pick = parseInt(window.prompt(msg, '1'), 10);
      var rec = list[pick - 1];
      if (!rec) { setStatus('Open cancelled.', '#94a3b8'); return; }
      var o = rec.payload || {};
      pushUndo();
      WB.nodes = o.nodes || []; WB.pipes = o.pipes || []; WB.seq = o.seq || 0; WB.sel = null; WB.selMulti = [];
      migratePipePortIds(WB.pipes);
      WB.cloudId = rec.id; WB.projectName = rec.name;
      render(); renderProps(); sync3D();
      setStatus('Opened from your account: ' + rec.name, '#16a34a');
    }).catch(function () { setStatus('Could not reach your cloud projects.', '#ef4444'); });
  };
  WB.open = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { try { var o = JSON.parse(r.result); pushUndo(); WB.nodes = o.nodes || []; WB.pipes = o.pipes || []; WB.seq = o.seq || 0; WB.sel = null; WB.selMulti = []; migratePipePortIds(WB.pipes); render(); renderProps(); sync3D(); setStatus('Project loaded: ' + f.name, '#16a34a'); } catch (e) { alert('Could not read project file.'); } }; r.readAsText(f); };
    inp.click();
  };
  /* Drop an imported drawing behind the flowsheet, scaled to a sensible
     working size, so it can be traced over in any of the three workbenches. */
  function setBackdrop(href, w, h, msg) {
    var scale = Math.min(1100 / w, 750 / h, 1);
    WB.backdrop = { href: href, x: 40, y: 40, w: w * scale, h: h * scale };
    render();
    setStatus(msg + ' — trace over it, then “Remove Backdrop” from the Import menu when done.', '#16a34a');
  }
  /* Load a script once, on demand. pdf.js is ~1.5 MB with its worker, so it
     is fetched only when someone actually imports a PDF rather than on
     every page load. */
  var _scriptCache = {};
  function loadScript(src, cb) {
    if (_scriptCache[src] === 'ready') { cb(true); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { _scriptCache[src] = 'ready'; cb(true); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }
  /* ---- DXF → SVG ------------------------------------------------------
     DXF is a plain-text tag/value format, so the common 2D entities can be
     read directly with no external library. Handles LINE, LWPOLYLINE,
     POLYLINE/VERTEX, CIRCLE, ARC, SOLID and TEXT/MTEXT — which covers what
     a P&ID or plot-plan export actually contains. DXF's Y axis points up
     and SVG's points down, so the whole drawing is flipped in the viewBox
     rather than per-entity. */
  function dxfToSvg(text) {
    var lines = text.split(/\r\n|\r|\n/), pairs = [], i;
    for (i = 0; i + 1 < lines.length; i += 2) pairs.push([parseInt(lines[i], 10), lines[i + 1]]);
    var ents = [], cur = null, inEnt = false;
    function flush() { if (cur && cur.type) ents.push(cur); cur = null; }
    for (i = 0; i < pairs.length; i++) {
      var code = pairs[i][0], val = (pairs[i][1] || '').trim();
      if (isNaN(code)) continue;
      if (code === 0) {
        flush();
        if (val === 'SECTION' || val === 'ENDSEC' || val === 'EOF') { inEnt = (val === 'SECTION'); cur = null; continue; }
        cur = { type: val, x: [], y: [], v: [] };
        continue;
      }
      if (!cur) continue;
      var num = parseFloat(val);
      if (code === 10) { cur.x.push(num); if (cur.type === 'LWPOLYLINE' || cur.type === 'VERTEX') cur.v.push({ x: num, y: null }); }
      else if (code === 20) { cur.y.push(num); if (cur.v.length && cur.v[cur.v.length - 1].y === null) cur.v[cur.v.length - 1].y = num; }
      else if (code === 11) cur.x2 = num;
      else if (code === 21) cur.y2 = num;
      else if (code === 40) cur.r = num;
      else if (code === 50) cur.a1 = num;
      else if (code === 51) cur.a2 = num;
      else if (code === 70) cur.flag = parseInt(val, 10);
      else if (code === 1) cur.text = val;
    }
    flush();
    var out = [], texts = [], minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function pt(x, y) {
      if (!isFinite(x) || !isFinite(y)) return;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    var poly = null;
    for (i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.type === 'LINE' && e.x.length && e.y.length && isFinite(e.x2) && isFinite(e.y2)) {
        pt(e.x[0], e.y[0]); pt(e.x2, e.y2);
        out.push('<line x1="' + e.x[0] + '" y1="' + e.y[0] + '" x2="' + e.x2 + '" y2="' + e.y2 + '"/>');
      } else if (e.type === 'CIRCLE' && isFinite(e.r)) {
        pt(e.x[0] - e.r, e.y[0] - e.r); pt(e.x[0] + e.r, e.y[0] + e.r);
        out.push('<circle cx="' + e.x[0] + '" cy="' + e.y[0] + '" r="' + e.r + '"/>');
      } else if (e.type === 'ARC' && isFinite(e.r)) {
        var a1 = (e.a1 || 0) * Math.PI / 180, a2 = (e.a2 || 0) * Math.PI / 180;
        var x1 = e.x[0] + e.r * Math.cos(a1), y1 = e.y[0] + e.r * Math.sin(a1);
        var x2 = e.x[0] + e.r * Math.cos(a2), y2 = e.y[0] + e.r * Math.sin(a2);
        var sweep = ((e.a2 - e.a1 + 360) % 360) > 180 ? 1 : 0;
        pt(e.x[0] - e.r, e.y[0] - e.r); pt(e.x[0] + e.r, e.y[0] + e.r);
        out.push('<path d="M' + x1 + ' ' + y1 + ' A' + e.r + ' ' + e.r + ' 0 ' + sweep + ' 1 ' + x2 + ' ' + y2 + '"/>');
      } else if (e.type === 'LWPOLYLINE') {
        var vs = e.v.filter(function (p) { return isFinite(p.x) && isFinite(p.y); });
        if (vs.length > 1) {
          vs.forEach(function (p) { pt(p.x, p.y); });
          out.push('<polyline points="' + vs.map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"' + ((e.flag & 1) ? ' class="cl"' : '') + '/>');
        }
      } else if (e.type === 'POLYLINE') { poly = []; }
      else if (e.type === 'VERTEX' && poly && e.x.length && e.y.length) { poly.push({ x: e.x[0], y: e.y[0] }); }
      else if (e.type === 'SEQEND' && poly) {
        if (poly.length > 1) { poly.forEach(function (p) { pt(p.x, p.y); });
          out.push('<polyline points="' + poly.map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>'); }
        poly = null;
      } else if ((e.type === 'TEXT' || e.type === 'MTEXT') && e.text && e.x.length && e.y.length) {
        pt(e.x[0], e.y[0]);
        var esc = e.text.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
        // counter-flip so text is not mirrored by the global Y flip
        out.push('<text x="' + e.x[0] + '" y="' + e.y[0] + '" font-size="' + (e.r || 8) + '" transform="scale(1,-1) translate(0,' + (-2 * e.y[0]) + ')">' + esc + '</text>');
        texts.push({ text: e.text, x: e.x[0], y: e.y[0] });
      }
    }
    if (!out.length || !isFinite(minX)) return null;
    var pad = (maxX - minX + maxY - minY) * 0.02 + 5;
    var vbW = (maxX - minX) + pad * 2, vbH = (maxY - minY) + pad * 2;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(vbW) + '" height="' + Math.round(vbH) + '"'
      + ' viewBox="' + (minX - pad) + ' ' + (minY - pad) + ' ' + vbW + ' ' + vbH + '">'
      + '<rect x="' + (minX - pad) + '" y="' + (minY - pad) + '" width="' + vbW + '" height="' + vbH + '" fill="#ffffff"/>'
      + '<g transform="translate(0,' + (2 * minY - pad + vbH - pad) + ') scale(1,-1)"'
      + ' fill="none" stroke="#0f172a" stroke-width="' + Math.max(0.6, vbW / 900) + '" stroke-linecap="round" stroke-linejoin="round">'
      + '<style>.cl{}text{fill:#0f172a;stroke:none;font-family:Arial,sans-serif}</style>'
      + out.join('') + '</g></svg>';
    return { svg: svg, w: Math.round(vbW), h: Math.round(vbH), entities: out.length,
      texts: texts, minX: minX, minY: minY, maxX: maxX, maxY: maxY, flipY: true };
  }
  /* ───────── Imported drawing → runnable model ─────────
     An imported P&ID lands as a backdrop, which is a picture: 0 equipment,
     0 lines, so RUN ANALYSIS has nothing to solve. But both DXF and PDF
     carry their TEXT with coordinates, and P&ID tags follow a strong
     convention (P-101 pump, E-101 exchanger, V-101 vessel…). Reading those
     tags back gives real, positioned, editable equipment that simulates —
     without any image recognition.

     The tag prefix drives the equipment type. Instrument prefixes are
     checked before single letters so PIC-101 is not mistaken for a pump. */
  var TAG_RULES = [
    [/^(PIC|TIC|FIC|LIC|PDIC|AIC)/i, 'pressure-indicator'],
    [/^(PT|TT|FT|LT|DPT|AT)/i, 'pressure-transmitter'],
    [/^(PI|TI|FI|LI|PG|TG)/i, 'pg'],
    [/^(PSV|PRV|RV)/i, 'psv'],
    [/^(XV|HV|SDV|BV)/i, 'gate'],
    [/^(FV|PV|LV|TV|CV|PCV|TCV|FCV|LCV)/i, 'control'],
    [/^(TK|ST)/i, 'cone-tank'],
    [/^(HX|EX)/i, 'sthe'],
    [/^E/i, 'sthe'],
    [/^P/i, 'pump'],
    [/^(K|C)/i, 'compressor'],
    [/^(T|CL)/i, 'column'],
    [/^(V|D|KO)/i, 'v-vessel'],
    [/^R/i, 'cstr'],
    [/^(F|S)/i, 'y-strainer'],
    [/^B/i, 'boiler'],
    [/^M/i, 'motor']
  ];
  /* A real equipment tag: letters then digits, e.g. P-101 / E101 / XV-201.
     CAD and PDF text extraction is messy — the same label comes back as
     "P-101", "P -101", "P - 101" or "P–101" depending on how the sheet was
     produced, so the separator has to tolerate spaces and en/em dashes. */
  var TAG_RE = /^([A-Za-z]{1,4})\s*[-–—]?\s*(\d{2,4}[A-Za-z]?)$/;
  // The same tag sitting inside a longer label, e.g. "FEED PUMP P-101".
  var TAG_SCAN = /(?:^|[^A-Za-z0-9])([A-Za-z]{1,4})\s*[-–—]\s*(\d{2,4}[A-Za-z]?)(?![A-Za-z0-9])/;
  /* Title-block and annotation words that look like tags but are not
     equipment — without this a sheet's "REV 01" or "DWG-1234" would be
     placed on the canvas as a vessel. */
  var TAG_STOP = new RegExp('^(' + [
    // drawing identity — "P&ID NO. PID-001" was being placed on the canvas
    'PID', 'PFD', 'PNID', 'DWG', 'DRG', 'DOC', 'REV', 'SHT', 'SH', 'SHEET', 'PG', 'PAGE',
    // standards and issue data
    'ISO', 'ANSI', 'ASME', 'API', 'DIN', 'BS', 'EN', 'IS', 'IEC', 'NFPA', 'TEMA',
    'DATE', 'SCALE', 'NTS', 'PROJ', 'JOB', 'CLIENT', 'CH', 'CHK', 'APP', 'APPD', 'DR', 'DRN',
    // table headers and generic annotation
    'NO', 'OF', 'FIG', 'TYP', 'NOTE', 'DET', 'SECT', 'ITEM', 'QTY', 'TAG', 'SPEC',
    'MOC', 'LINE', 'SIZE', 'AREA', 'UNIT', 'LOOP', 'REF', 'PO', 'WO', 'ECN',
    // units that appear next to a number
    'MM', 'CM', 'IN', 'KG', 'LB', 'PSI', 'BAR', 'KPA', 'DEG', 'HR', 'MIN', 'SEC'
  ].join('|') + ')$', 'i');
  /* Single source of truth for "does this piece of text name equipment?".
     Returns the normalised tag, or null. */
  function tagFromText(s) {
    var raw = String(s == null ? '' : s).replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 40) return null;
    var m = raw.match(TAG_RE) || raw.match(TAG_SCAN);
    if (!m) return null;
    if (TAG_STOP.test(m[1])) return null;
    return (m[1] + '-' + m[2]).toUpperCase();
  }
  /* Valve families whose letters would otherwise be read as an ISA loop —
     PSV is a relief valve, not a "pressure switch valve", and SDV is a
     shutdown valve, not a speed loop. These are settled by name first. */
  var TAG_EXPLICIT = [
    [/^(PSV|PRV|RV|TSV|VRV)$/i, 'psv'],
    [/^(XV|HV|SDV|BV|ESDV|ESV|ZV)$/i, 'gate'],
    [/^(FV|PV|LV|TV|CV|PCV|TCV|FCV|LCV|AICV|PICV)$/i, 'control']
  ];

  /* ── ISA-5.1 instrument tags ───────────────────────────────────────────
     An instrument tag is not an opaque prefix: its first letter is the
     MEASURED VARIABLE and the letters after it are the FUNCTION. FIC is a
     flow indicating controller, TT a temperature transmitter, LG a level
     gauge glass. The old table matched only a handful of literal prefixes
     and sent every controller to "pressure-indicator" and every
     transmitter to "pressure-transmitter", so an imported sheet came back
     claiming pressure instruments on the temperature and level loops.
     That was survivable while instrument balloons were never recognised;
     now that they are, it would put a wrong symbol on most of the page.

     Decode the letters instead, and use the symbol the library already
     carries for that variable and function. */
  var ISA_VAR = { F: 'flow', T: 'temp', P: 'press', L: 'level', D: 'dp', A: 'analysis' };
  var ISA_XMTR = { flow: 'ft', temp: 'temp-transmitter', press: 'pressure-transmitter',
                   level: 'level-transmitter', dp: 'dp-transmitter' };
  var ISA_SWITCH = { flow: 'flow-switch', temp: 'temp-switch', press: 'pressure-switch',
                     level: 'level-switch' };
  var ISA_IND = { temp: 'ti', press: 'pg', level: 'li' };
  function isaType(prefix) {
    var L = String(prefix).toUpperCase();
    if (L.length < 2) return null;             // one letter is equipment (P-101), not a loop
    var v = ISA_VAR[L.charAt(0)];
    if (!v) return null;
    var fn = L.slice(1);
    if (fn.indexOf('V') >= 0) return 'control';                     // the loop's control valve
    if (fn.indexOf('S') >= 0) return ISA_SWITCH[v] || 'pressure-switch';
    if (fn.indexOf('T') >= 0) return ISA_XMTR[v] || 'pressure-transmitter';
    if (fn.indexOf('E') >= 0) return v === 'temp' ? 'thermowell' : 'orifice';   // primary element
    if (fn.indexOf('G') >= 0) return v === 'level' ? 'sight-glass' : (ISA_IND[v] || 'pg');
    // indicate / control / record — all drawn as a plain balloon
    return ISA_IND[v] || 'pressure-indicator';
  }

  function typeForTag(tag) {
    var i;
    for (i = 0; i < TAG_EXPLICIT.length; i++) if (TAG_EXPLICIT[i][0].test(tag)) return TAG_EXPLICIT[i][1];
    var isa = isaType(tag);
    if (isa) return isa;
    for (i = 0; i < TAG_RULES.length; i++) if (TAG_RULES[i][0].test(tag)) return TAG_RULES[i][1];
    return 'v-vessel';
  }
  /* Turn positioned text into equipment laid out the way the source drawing
     had it, then wire consecutive items together so there are lines to
     solve. The connection order is INFERRED (left-to-right, top-to-bottom) —
     it gives a runnable starting model, not a claim about the real process,
     and every node and line stays fully editable afterwards. */
  function buildModelFromTexts(texts, box, opts) {
    opts = opts || {};
    if (!texts || !texts.length) return { equipment: 0, lines: 0 };
    var seen = {}, found = [];
    texts.forEach(function (t) {
      var tag = tagFromText(t.text);
      if (!tag) return;
      if (seen[tag]) return;                 // same tag repeated on the sheet
      seen[tag] = 1;
      found.push({ tag: tag, type: typeForTag(tag.split('-')[0]), x: t.x, y: t.y });
    });
    if (!found.length) return { equipment: 0, lines: 0 };

    // map drawing coordinates into canvas space, preserving the layout
    var spanX = (box.maxX - box.minX) || 1, spanY = (box.maxY - box.minY) || 1;
    var CW = 1400, CH = 820, PAD = 70;
    found.forEach(function (f) {
      var nx = (f.x - box.minX) / spanX;
      var ny = (f.y - box.minY) / spanY;
      if (opts.flipY) ny = 1 - ny;            // DXF Y is up, canvas Y is down
      f.cx = PAD + nx * (CW - 2 * PAD);
      f.cy = PAD + ny * (CH - 2 * PAD);
    });
    // reading order across the sheet, so the inferred chain follows the flow
    found.sort(function (a, b) {
      var band = 90;
      var ra = Math.round(a.cy / band), rb = Math.round(b.cy / band);
      return ra !== rb ? ra - rb : a.cx - b.cx;
    });

    pushUndo();
    WB.nodes = []; WB.pipes = []; WB.blockLabels = []; WB.seq = 0; WB.sel = null; WB.selMulti = [];
    found.forEach(function (f) {
      var lib = LIB_INDEX[f.type] || LIB_INDEX['v-vessel'];
      WB.nodes.push({ id: 'N' + (++WB.seq), t: lib === LIB_INDEX[f.type] ? f.type : 'v-vessel',
        x: snapV(Math.round(f.cx)), y: snapV(Math.round(f.cy)),
        tag: f.tag, name: f.tag, fluid: 'Water', flow: 50, temp: 30, press: 3 });
    });
    // Chain them so the hydraulics have lines to solve. Instruments are not
    // process equipment, so they are placed but never put in the line-up.
    var instr = {}; (LIB['Instruments'] || []).forEach(function (it) { instr[it.t] = 1; });
    var chain = WB.nodes.filter(function (n) { return !instr[n.t]; });
    for (var i = 0; i + 1 < chain.length; i++) {
      var a = chain[i], b = chain[i + 1];
      WB.pipes.push({ id: 'L' + (++WB.seq),
        from: { id: a.id, pi: outPortIndex(a.t), portId: portIdAt(a.t, outPortIndex(a.t)) },
        to: { id: b.id, pi: inPortIndex(b.t), portId: portIdAt(b.t, inPortIndex(b.t)) },
        role: 'process', tag: 'L-' + (100 + i + 1),
        fluid: 'Water', flow: 50, nps: 3, length: 5, dz: 0 });
    }
    render(); renderProps(); sync3D();
    return { equipment: WB.nodes.length, lines: WB.pipes.length };
  }
  /* ---- Staged import ------------------------------------------------
     An imported drawing is NOT dropped straight onto the workbench any
     more. It is converted first and shown in a review step: what was
     recognised, a preview, and an explicit choice of what to launch into
     the workbench. That way an engineer never ends up with a picture that
     silently cannot simulate, and can see up front whether the drawing
     carried usable tags. */
  function showImportReview(o) {
    var tags = buildModelProbe(o.texts);
    var canModel = tags > 0;
    /* When a sheet yields nothing the engineer needs to know WHICH of the two
       reasons applies — the drawing carried no text at all, or it carried
       text that did not look like tags. Reporting only "nothing found" is
       what made a failed import feel like the button had done nothing. */
    var nText = (o.texts || []).length;
    var sample = (o.texts || []).slice(0, 8).map(function (t) {
      return String(t.text || '').trim().slice(0, 18);
    }).filter(Boolean).join(' · ');
    var detail;
    if (canModel) {
      detail = '<div class="wb-imp-ok"><b>' + tags + '</b> equipment tag' + (tags > 1 ? 's' : '')
        + ' recognised from <b>' + nText + '</b> text labels — this drawing can be converted into a '
        + 'live, editable model.</div>';
    } else if (!nText) {
      detail = '<div class="wb-imp-warn"><b>This ' + o.label + ' carries no text layer.</b> '
        + 'It is a scanned or image-only sheet — the tags on it are pixels, not characters, so there '
        + 'is nothing to read directly. <b>Read the tags from the image</b> below to recover them, or '
        + 're-export the sheet from its CAD original as a text PDF or DXF, which is always more '
        + 'accurate. It can still be placed as a backdrop and traced over with the library.</div>';
    } else {
      detail = '<div class="wb-imp-warn"><b>' + nText + ' text labels were read, but none look like '
        + 'equipment tags.</b> A tag is letters then digits — P-101, E-102, XV-201, FIC-101. '
        + (sample ? 'What was found: <i>' + sample + '</i>. ' : '')
        + 'It can still be placed as a backdrop and traced over with the library.</div>';
    }
    var body = ''
      + '<div class="wb-imp-prev"><img src="' + o.preview + '" alt="imported drawing"/></div>'
      + '<div class="wb-imp-meta"><b>' + o.fileName + '</b> · ' + o.label
      + (o.entities ? ' · ' + o.entities + ' drawing entities' : '') + '</div>'
      + detail
      + '<div class="wb-imp-note">Converting places equipment where its tag sits on the sheet and types it from the tag '
      + '(P- pump, E- exchanger, V- vessel, T- column, XV- valve, PIC- controller…). '
      + 'Connections are <b>inferred in reading order</b> so the hydraulics have lines to solve — '
      + 'check the routing against the real process before relying on it. '
      + 'Everything stays editable in the 2D, P&amp;ID and 3D workbenches.'
      + (o.ocrDone && canModel
        ? ' <b>These tags were read off the picture</b>, so check them against the sheet — process '
          + 'equipment and valves come back reliably, while instrument balloons often do not survive, '
          + 'because the circle drawn around the text defeats the reader.'
        : '')
      + '</div>'
    /* A raster sheet has no characters to read, so offer to read them off the
       pixels. Only worth showing when nothing was found by other means and
       there is actually an image to look at. */
    var canOcr = !canModel && !o.ocrDone && !!o.preview && typeof window.AROOCR !== 'undefined';
    if (o.ocrDone && !canModel) {
      detail = '<div class="wb-imp-warn"><b>The tag reader found no equipment tags on this sheet.</b> '
        + (nText ? 'It read ' + nText + ' words' + (sample ? ' (' + sample + ')' : '') + ', but none of '
          + 'them are shaped like a tag. ' : '')
        + 'Reading a picture is a best effort — a sheet re-exported from its CAD original as a text PDF '
        + 'or DXF will always recognise properly. It can still be traced over as a backdrop.</div>';
    }
    body += '<div class="wb-imp-btns">'
      + (canModel ? '<button class="wb-btn" data-imp="model">Convert to editable model &amp; open</button>' : '')
      + (canOcr ? '<button class="wb-btn" data-imp="ocr">🔍 Read the tags from the image</button>' : '')
      + '<button class="wb-btn' + ((canModel || canOcr) ? ' wb-btn-mut' : '') + '" data-imp="backdrop">Open as trace-over backdrop</button>'
      + '<button class="wb-btn wb-btn-mut" data-imp="cancel">Cancel</button>'
      + '</div>';

    var d = document.createElement('div');
    d.className = 'wb-modal';
    d.innerHTML = '<div class="wb-modal-box" style="max-width:760px;">'
      + '<div class="wb-modal-head"><span>IMPORT DRAWING — REVIEW &amp; CONVERT</span><button class="wb-modal-x">✕</button></div>'
      + '<div class="wb-modal-body">' + body + '</div></div>';
    document.body.appendChild(d);
    function close() { if (d.parentNode) d.parentNode.removeChild(d); }
    d.querySelector('.wb-modal-x').onclick = function () { close(); setStatus('Import cancelled.', '#94a3b8'); };
    d.querySelectorAll('[data-imp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-imp');
        if (act === 'ocr') {
          /* Read the characters off the picture, then come straight back into
             this same review step with the recovered labels — nothing reaches
             the workbench until the engineer has seen what was found. */
          var btns = d.querySelector('.wb-imp-btns');
          btns.innerHTML = '<div class="wb-imp-prog"><div class="wb-imp-prog-bar"><i></i></div>'
            + '<span>Starting the tag reader…</span></div>';
          var bar = btns.querySelector('i'), lbl = btns.querySelector('span');
          window.AROOCR.read(o.preview, function (p, msg) {
            if (bar) bar.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
            if (lbl && msg) lbl.textContent = msg;
          }).then(function (r) {
            close();
            var joined = joinTextFragments(r.texts);
            showImportReview(Object.assign({}, o, {
              texts: joined, ocrDone: true,
              // OCR coordinates are returned in original image space, y up
              box: { minX: 0, minY: 0, maxX: r.w, maxY: r.h },
              opts: { flipY: true }
            }));
          }, function (err) {
            close();
            setStatus('The tag reader could not run (' + (err && err.message ? err.message : 'unknown error')
              + '). Import the sheet again and open it as a backdrop, or re-export it as a text PDF or DXF.', '#dc2626');
          });
          return;
        }
        close();
        if (act === 'cancel') { setStatus('Import cancelled — nothing was added.', '#94a3b8'); return; }
        // only now does anything reach the workbench
        setBackdrop(o.preview, o.w, o.h, 'Imported ' + o.label);
        if (act === 'model') {
          var res = buildModelFromTexts(o.texts, o.box, o.opts);
          setStatus('Built ' + res.equipment + ' equipment and ' + res.lines + ' inferred lines from the ' + o.label
            + ' — editable in 2D, P&ID and 3D. Check the routing, then RUN ANALYSIS.', '#16a34a');
        }
      });
    });
  }
  /* PDF generators (AutoCAD, Visio, Bluebeam…) rarely emit a label as one
     string — "P-101" typically arrives as "P" then "-101", sometimes glyph
     by glyph. Matching tags against raw fragments therefore finds almost
     nothing on a real drawing. Re-join fragments that sit on the same
     baseline with only a normal inter-character gap between them, so the
     logical label is reconstructed before any tag matching happens. */
  function joinTextFragments(items) {
    if (!items || !items.length) return [];
    var its = items.filter(function (t) { return t.text !== undefined && String(t.text).length; })
      .map(function (t) {
        var h = t.h || 8;
        return { s: String(t.text), x: t.x, y: t.y, w: (t.w !== undefined ? t.w : String(t.text).length * h * 0.5), h: h };
      });
    // reading order: down the page, then across
    its.sort(function (a, b) { return Math.abs(a.y - b.y) > (Math.min(a.h, b.h) * 0.6) ? b.y - a.y : a.x - b.x; });
    var out = [], cur = null;
    its.forEach(function (t) {
      if (cur) {
        var sameLine = Math.abs(t.y - cur.y) <= Math.max(cur.h, t.h) * 0.6;
        var gap = t.x - (cur.x + cur.w);
        if (sameLine && gap <= Math.max(cur.h, t.h) * 1.1 && gap > -Math.max(cur.h, t.h) * 2) {
          cur.s += (gap > Math.max(cur.h, t.h) * 0.35 ? ' ' : '') + t.s;
          cur.w = (t.x + t.w) - cur.x;
          return;
        }
        out.push(cur);
      }
      cur = { s: t.s, x: t.x, y: t.y, w: t.w, h: t.h };
    });
    if (cur) out.push(cur);
    out = joinStackedTags(out);
    return out.map(function (c) { return { text: c.s, x: c.x, y: c.y }; });
  }

  /* ── ISA instrument balloons ───────────────────────────────────────────
     A P&ID writes an instrument tag inside a circle on TWO lines: the
     function letters on top, the loop number underneath — FIC over 101, TT
     over 101, LIC over 101. Every one of those is a separate text baseline,
     so the horizontal joiner above never sees them as one label and neither
     half matches a tag on its own. On a realistic sheet that silently loses
     every instrument: 10 of 30 tags on the test drawing, a third of the
     page, with no indication anything was skipped.

     Pair a short run of letters with the digits sitting directly beneath
     it. The test is deliberately narrow, because a caption above a number
     ("STEAM" over "150 L/HR") must not be swept up as equipment: the two
     halves have to be about the same size, nearly centred on one another
     the way circled text is, and close enough vertically to be consecutive
     lines. Anything left-aligned or further apart is left alone. */
  function joinStackedTags(items) {
    var LETTERS = /^[A-Za-z]{1,4}$/;
    var DIGITS = /^\d{2,4}[A-Za-z]?$/;
    var used = {}, out = [];
    items.forEach(function (a, i) {
      if (used[i] || !LETTERS.test(a.s.trim())) return;
      var best = -1, bestGap = 1e9;
      items.forEach(function (b, j) {
        if (i === j || used[j] || !DIGITS.test(b.s.trim())) return;
        // PDF and DXF y both increase upward, so "below" is a smaller y
        var drop = a.y - b.y;
        if (drop <= 0) return;
        var hh = Math.max(a.h, b.h);
        if (drop > hh * 1.8) return;                       // consecutive lines only
        if (Math.min(a.h, b.h) < hh * 0.6) return;         // same text size
        var ca = a.x + a.w / 2, cb = b.x + b.w / 2;
        if (Math.abs(ca - cb) > Math.max(a.w, b.w) * 0.45) return;   // centred, not left-aligned
        if (drop < bestGap) { bestGap = drop; best = j; }
      });
      if (best >= 0) {
        used[i] = used[best] = 1;
        out.push({ s: a.s.trim() + '-' + items[best].s.trim(), x: a.x, y: a.y, w: a.w, h: a.h });
      }
    });
    items.forEach(function (t, i) { if (!used[i]) out.push(t); });
    return out;
  }
  /* Pull <text>/<tspan> labels with their coordinates out of an SVG so an
     imported vector sheet can be tag-recognised the same way a DXF is. */
  function svgTexts(src) {
    var out = [];
    try {
      var doc = new DOMParser().parseFromString(src, 'image/svg+xml');
      if (doc.querySelector('parsererror')) return out;
      Array.prototype.forEach.call(doc.querySelectorAll('text,tspan'), function (el) {
        if (el.querySelector && el.querySelector('tspan')) return;   // parent of tspans
        var s = (el.textContent || '').trim();
        if (!s) return;
        var fs = parseFloat(el.getAttribute('font-size')) || 10;
        out.push({ text: s, x: parseFloat(el.getAttribute('x')) || 0,
          y: parseFloat(el.getAttribute('y')) || 0, w: s.length * fs * 0.55, h: fs });
      });
    } catch (e) { return []; }
    return joinTextFragments(out);
  }
  function buildModelProbe(texts) {
    if (!texts) return 0;
    var seen = {}, n = 0;
    texts.forEach(function (t) {
      var tag = tagFromText(t.text);
      if (tag && !seen[tag]) { seen[tag] = 1; n++; }
    });
    return n;
  }
  WB.import = function () {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.pdf,.dxf,.dwg,.step,.stp,.iges,.igs';
    // Keep the input in the document while it is open. A detached input can
    // silently fail to raise the picker in some browsers.
    inp.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;';
    document.body.appendChild(inp);
    function done() { if (inp.parentNode) inp.parentNode.removeChild(inp); }
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) { done(); return; }
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      setStatus('Importing “' + f.name + '” …', '#38bdf8');

      // ---- raster images: straight to a traceable backdrop
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].indexOf(ext) >= 0) {
        var r = new FileReader();
        r.onload = function () {
          var img = new Image();
          img.onload = function () {
            done();
            showImportReview({ preview: r.result, w: img.width, h: img.height,
              label: ext.toUpperCase() + ' image', fileName: f.name, texts: [],
              box: { minX: 0, minY: 0, maxX: img.width, maxY: img.height }, opts: {} });
          };
          img.onerror = function () { setStatus('Could not decode that image file.', '#dc2626'); done(); };
          img.src = r.result;
        };
        r.onerror = function () { setStatus('Could not read that file.', '#dc2626'); done(); };
        r.readAsDataURL(f);
        return;
      }

      // ---- SVG: already vector, use it directly
      if (ext === 'svg') {
        var rs = new FileReader();
        rs.onload = function () {
          var img = new Image();
          img.onload = function () {
            done();
            var sw = img.naturalWidth || 900, sh = img.naturalHeight || 600;
            showImportReview({ preview: img.src, w: sw, h: sh, label: 'SVG drawing',
              fileName: f.name, texts: svgTexts(rs.result),
              box: { minX: 0, minY: 0, maxX: sw, maxY: sh }, opts: {} });
          };
          img.onerror = function () { setStatus('Could not render that SVG.', '#dc2626'); done(); };
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(rs.result)));
        };
        rs.readAsText(f);
        return;
      }

      // ---- DXF: parsed natively into vector geometry
      if (ext === 'dxf') {
        var rd = new FileReader();
        rd.onload = function () {
          var res = null;
          try { res = dxfToSvg(rd.result); } catch (e) { res = null; }
          if (!res) { setStatus('That DXF had no readable 2D geometry (LINE/POLYLINE/CIRCLE/ARC/TEXT).', '#f59e0b'); done(); return; }
          done();
          showImportReview({
            preview: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(res.svg))),
            w: res.w, h: res.h, label: 'DXF', fileName: f.name, entities: res.entities,
            texts: joinTextFragments(res.texts),
            box: { minX: res.minX, minY: res.minY, maxX: res.maxX, maxY: res.maxY },
            opts: { flipY: true }
          });
        };
        rd.onerror = function () { setStatus('Could not read that DXF.', '#dc2626'); done(); };
        rd.readAsText(f);
        return;
      }

      // ---- PDF: first page rendered with pdf.js (loaded on demand)
      if (ext === 'pdf') {
        setStatus('Loading PDF engine…', '#38bdf8');
        loadScript('lib/pdf.min.js?v=1', function (ok) {
          if (!ok || typeof pdfjsLib === 'undefined') {
            setStatus('PDF engine failed to load. Export the sheet to PNG and import that instead.', '#dc2626'); done(); return;
          }
          try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js?v=1'; } catch (e) {}
          var rp = new FileReader();
          rp.onload = function () {
            pdfjsLib.getDocument({ data: new Uint8Array(rp.result) }).promise.then(function (doc) {
              return doc.getPage(1).then(function (page) {
                var vp = page.getViewport({ scale: 2 });   // 2x for a crisp trace
                var cv = document.createElement('canvas');
                cv.width = vp.width; cv.height = vp.height;
                var cx = cv.getContext('2d');
                cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);
                return page.render({ canvasContext: cx, viewport: vp }).promise.then(function () {
                  done();
                  /* A PDF P&ID keeps its labels as real text, so tags can be
                     read back with coordinates — no image recognition needed.
                     Fragments are re-joined first (see joinTextFragments). */
                  var png = cv.toDataURL('image/png');
                  return page.getTextContent().then(function (tc) {
                    var items = (tc.items || []).map(function (it) {
                      var tr = it.transform || [1, 0, 0, 1, 0, 0];
                      return { text: it.str, x: tr[4], y: tr[5], w: it.width, h: it.height || Math.abs(tr[3]) || 8 };
                    }).filter(function (t) { return t.text && t.text.trim(); });
                    var pv = page.getViewport({ scale: 1 });
                    showImportReview({
                      preview: png, w: vp.width, h: vp.height,
                      label: 'PDF (page 1 of ' + doc.numPages + ')', fileName: f.name,
                      texts: joinTextFragments(items),
                      box: { minX: 0, minY: 0, maxX: pv.width, maxY: pv.height },
                      opts: { flipY: true }
                    });
                  }).catch(function () {
                    showImportReview({ preview: png, w: vp.width, h: vp.height, label: 'PDF',
                      fileName: f.name, texts: [], box: { minX: 0, minY: 0, maxX: vp.width, maxY: vp.height }, opts: {} });
                  });
                });
              });
            }).catch(function (err) {
              setStatus('Could not read that PDF (' + (err && err.message ? err.message : 'unknown error') + ').', '#dc2626'); done();
            });
          };
          rp.onerror = function () { setStatus('Could not read that PDF.', '#dc2626'); done(); };
          rp.readAsArrayBuffer(f);
        });
        return;
      }

      // ---- DWG / STEP / IGES: binary or solid-model formats that genuinely
      //      cannot be parsed in-browser. Say so plainly, with the way out.
      var how = (ext === 'dwg')
        ? 'DWG is a closed binary format. Save it as DXF (AutoCAD: Save As → DXF) and import that — DXF geometry is read natively.'
        : 'STEP/IGES are 3D solid-model formats. Export a 2D drawing sheet to DXF or PDF and import that.';
      setStatus(ext.toUpperCase() + ' cannot be read directly — ' + how, '#f59e0b');
      alert(ext.toUpperCase() + ' is not supported directly.\n\n' + how
        + '\n\nImports that work today: DXF (native vector), PDF (page rendered), SVG, and PNG/JPG/GIF/WEBP/BMP.');
      done();
    };
    // If the picker is dismissed the change event never fires; clean up later.
    inp.oncancel = done;
    inp.click();
  };
  WB.clearBackdrop = function () { WB.backdrop = null; render(); setStatus('Backdrop removed.', '#94a3b8'); };

  /* ───────────── Flowsheet library browser ───────────── */
  // A recipe is either a plain string (one block) or an array of
  // { name, recipe } blocks — see WB.loadFlowsheet's own note. Unit count
  // has to handle both shapes the same way loading itself does.
  function flowsheetUnitCount(recipe) {
    var blocks = typeof recipe === 'string' ? [recipe] : recipe.map(function (b) { return b.recipe; });
    return blocks.reduce(function (n, r) { return n + r.split(';').filter(function (s) { return s.trim(); }).length; }, 0);
  }
  WB.flowsheetBrowser = function () {
    // total equipment count across every recipe — not "number of named
    // templates" (which is what this used to count, back when the library
    // held 60 separate pick-one templates instead of one connected plant).
    var total = 0;
    Object.keys(FLOWSHEETS).forEach(function (sec) {
      Object.keys(FLOWSHEETS[sec]).forEach(function (name) { total += flowsheetUnitCount(FLOWSHEETS[sec][name]); });
    });
    var body = '<div class="wb-fs-intro">The AROGARA reference refinery — one connected plant, crude storage through desalting, atmospheric and vacuum distillation, fluid catalytic cracking, gas concentration, amine/sulfur recovery and naphtha upgrading, wired in series as real equipment with real piping, laid out as named plant areas. Load it as an editable P&amp;ID, then re-route or extend it to build your own. <b>' + total + ' units</b> in the plant.</div>';
    body += '<div class="wb-fs-grid">';
    Object.keys(FLOWSHEETS).forEach(function (sec) {
      body += '<div class="wb-fs-sec"><div class="wb-fs-sec-h">' + sec + '</div>';
      Object.keys(FLOWSHEETS[sec]).forEach(function (name) {
        var n = flowsheetUnitCount(FLOWSHEETS[sec][name]);
        body += '<a class="wb-fs-item" data-sec="' + sec.replace(/"/g, '') + '" data-name="' + name.replace(/"/g, '&quot;') + '">' + name + ' <span>· ' + n + ' units</span></a>';
      });
      body += '</div>';
    });
    body += '</div>';
    var d = document.createElement('div'); d.className = 'wb-modal';
    d.innerHTML = '<div class="wb-modal-box" style="max-width:1000px;"><div class="wb-modal-head"><span>AROGARA REFINERY PLANT</span><button class="wb-modal-x">✕</button></div><div class="wb-modal-body">' + body + '</div><div class="wb-modal-foot"><button class="wb-btn wb-btn-mut wb-modal-close">CLOSE</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('.wb-modal-x').onclick = d.querySelector('.wb-modal-close').onclick = function () { d.remove(); };
    d.querySelectorAll('.wb-fs-item').forEach(function (a) {
      a.addEventListener('click', function () {
        d.remove();
        WB.loadFlowsheet(a.getAttribute('data-sec'), a.getAttribute('data-name'));
      });
    });
  };

  /* ───────────── Modal ───────────── */
  function modal(title, body, wide) {
    var d = document.createElement('div'); d.className = 'wb-modal';
    d.innerHTML = '<div class="wb-modal-box" style="max-width:' + (wide ? 860 : 560) + 'px;"><div class="wb-modal-head"><span>' + title + '</span><button class="wb-modal-x">✕</button></div><div class="wb-modal-body">' + body + '</div><div class="wb-modal-foot"><button class="wb-btn" id="wb-modal-print">⬇ DOWNLOAD PDF</button><button class="wb-btn wb-btn-mut wb-modal-close">CLOSE</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('.wb-modal-x').onclick = d.querySelector('.wb-modal-close').onclick = function () { d.remove(); };
    d.querySelector('#wb-modal-print').onclick = function () {
      var slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
      if (window.AROPDF) { window.AROPDF(d.querySelector('.wb-modal-body'), 'aro-workbench-' + slug + '.pdf', { landscape: !!wide }); return; }
      var w = window.open('', '_blank'); w.document.write('<html><head><title>' + title + '</title><style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #cbd5e1;padding:5px 8px;font-size:12px;text-align:left;}h4{margin:14px 0 6px;}</style></head><body>' + d.querySelector('.wb-modal-body').innerHTML + '</body></html>'); w.document.close(); w.print();
    };
  }

  /* ───────────── UI construction ─────────────
     The library thumbnails follow whichever workbench is active: the
     detailed 2D/3D workbenches show the rich equipment icons, while the
     P&ID workbench shows the same catalogue drawn as flat ISA/PIP
     schematic symbols, so what you drag is what you get on the sheet. */
  function buildPaletteHTML() {
    var pid = !!WB.pidMode, palette = '';
    Object.keys(LIB).forEach(function (cat) {
      palette += '<div class="wb-cat">' + cat + '</div><div class="wb-cat-items">';
      LIB[cat].forEach(function (it) {
        var glyph = pid ? pidSymbol(pidCatOf(it.t), it.w, it.h, null) : it.draw();
        // data-n carries the searchable name in lower case, kept separate
        // from the title attribute (which stays the real display casing)
        // so the search box below can match without re-parsing anything.
        palette += '<div class="wb-lib' + (pid ? ' wb-lib-pid' : '') + '" draggable="true" data-t="' + it.t + '" data-n="' + it.n.toLowerCase() + '" title="' + it.n + '">'
          + '<svg viewBox="0 0 ' + it.w + ' ' + (it.h + 16) + '" style="overflow:visible">'
          + (pid ? '' : '<ellipse cx="' + (it.w / 2) + '" cy="' + (it.h + 5) + '" rx="' + (it.w * 0.4) + '" ry="3" fill="#0f172a" opacity="0.14"/>')
          + (pid ? '<g>' + glyph + '</g>' : '<g filter="url(#wbShadow)">' + glyph + '</g>')
          + '</svg><span>' + it.n + '</span></div>';
      });
      palette += '</div>';
    });
    return palette;
  }
  // Sticky search bar prepended to the library panel — a separate small
  // template (not part of buildPaletteHTML) so 2D/P&ID palette refreshes
  // can drop it in without re-wiring anything; its own listener is
  // delegated on a container that's never replaced (see buildUI).
  function paletteSearchHTML() {
    return '<div class="wb-pal-search"><input type="text" id="wb-eq-search" placeholder="Search equipment…" autocomplete="off" spellcheck="false"></div>';
  }
  // Hides any .wb-lib tile whose name doesn't contain the query, then hides
  // a category's own header + grid together when none of its tiles matched
  // — an empty "PUMPS" heading with nothing under it read as broken, not
  // as "no results here".
  function filterPalette(q) {
    q = String(q || '').trim().toLowerCase();
    var pal = document.querySelector('.wb-palette');
    if (!pal) return;
    pal.querySelectorAll('.wb-lib').forEach(function (el) {
      el.style.display = (!q || (el.getAttribute('data-n') || '').indexOf(q) !== -1) ? '' : 'none';
    });
    pal.querySelectorAll('.wb-cat').forEach(function (cat) {
      var items = cat.nextElementSibling;
      var anyVisible = !!items && Array.prototype.some.call(items.children, function (c) { return c.style.display !== 'none'; });
      cat.style.display = anyVisible ? '' : 'none';
      if (items) items.style.display = anyVisible ? '' : 'none';
    });
  }
  /* Swap the library thumbnails when the workbench changes. Drag binding is
     delegated on the container (see buildUI), so re-rendering the HTML here
     never leaves dead, undraggable tiles behind. The search box is rebuilt
     too (its own listener is delegated elsewhere, so this never leaves it
     unwired) — whatever the engineer had already typed carries over, so
     switching to P&ID view doesn't quietly reset an active search. */
  function refreshPalette() {
    var el = document.querySelector('.wb-palette');
    if (!el) return;
    var prevQuery = el.querySelector('#wb-eq-search');
    prevQuery = prevQuery ? prevQuery.value : '';
    el.innerHTML = paletteSearchHTML() + buildPaletteHTML();
    if (prevQuery) { el.querySelector('#wb-eq-search').value = prevQuery; filterPalette(prevQuery); }
  }
  function buildUI(root) {
    var palette = buildPaletteHTML();

    root.innerHTML =
      '<div class="wb-shell">'
      + '<div class="wb-menubar">'
      + '  <span class="wb-brand">⬡ ARO WORKBENCH</span>'
      + '  <div class="wb-menu"><button>Project ▾</button><div class="wb-drop"><a data-a="new">New Project</a><a data-a="open">Open Project…</a><a data-a="cloudopen">☁ Open from my account…</a><a data-a="save">Save Project</a></div></div>'
      + '  <div class="wb-menu"><button>Import ▾</button><div class="wb-drop"><a data-a="import">Import Drawing (DXF / PDF / SVG / Image)…</a><a data-a="clearbd">Remove Backdrop</a></div></div>'
      + '  <div class="wb-menu"><button>Flowsheets ▾</button><div class="wb-drop"><a data-a="flowsheets">📋 AROGARA Refinery Plant (39 units)…</a></div></div>'
      + '  <div class="wb-menu"><button>Generate ▾</button><div class="wb-drop"><a data-a="calc">Run Analysis</a><a data-a="bom">BOM Generator</a><a data-a="report">Report Generator</a></div></div>'
      + '  <span class="wb-menu-spacer"></span>'
      + '  <span id="wb-count" class="wb-count">0 equipment · 0 lines</span>'
      + '</div>'
      + '<div class="wb-toolbar">'
      + grp('SELECT', toolBtn('select', 'cursor', 'Select / Move') + toolBtn('pipe', 'connect', 'Draw Pipe (connect ports)')
          + toolBtn('pan', 'pan', 'Move / Pan — drag anywhere to move the whole canvas (Space or middle-click do this in any tool)')
          + toolBtn('marquee', 'marquee', 'Marquee Select — drag a box over the equipment you want; Ctrl/Cmd+A selects everything'))
      + grp('EDIT', actBtn('undo', 'undo', 'Undo') + actBtn('redo', 'redo', 'Redo') + actBtn('delete', 'trash', 'Delete selected'))
      + grp('ZOOM', actBtn('zoomin', 'zoomin', 'Zoom in') + actBtn('zoomout', 'zoomout', 'Zoom out') + actBtn('fit', 'fit', 'Fit / reset view'))
      + grp('CONSTRAIN', toggleBtn('snap', 'snap', 'Snap to grid', true) + toggleBtn('ortho', 'ortho', 'Ortho pipe routing', true))
      + grp('VIEW',
          '<button class="wb-tool wb-view active" data-view="plan" title="Plan / 2D view">' + icon('viewplan') + '</button>'
          + '<button class="wb-tool wb-view" data-view="iso" title="Isometric 3D view">' + icon('viewiso') + '</button>'
          + '<button class="wb-tool wb-view" data-view="front" title="Front elevation">' + icon('viewfront') + '</button>'
          + '<button class="wb-tool wb-view" data-view="side" title="Side elevation">' + icon('viewside') + '</button>'
          + '<button class="wb-tool wb-view" data-mode2="rotate360" title="360° free rotate (drag empty canvas)">' + icon('orbit') + '</button>')
      + grp('DISPLAY',
          '<button class="wb-tool wb-toggle on" data-toggle="gridOn" title="Grid on / off">' + icon('grid') + '</button>'
          + '<label class="wb-tool" id="wb-bg-btn" title="Pick background colour" style="padding:0;overflow:hidden;position:relative;">' + icon('palette') + '<input type="color" id="wb-bg-input" value="#ffffff" style="position:absolute;inset:0;opacity:0;cursor:pointer;"></label>')
      + grp('MODE', '<div class="wb-seg">'
          + '<button class="wb-seg-btn active" id="wb-mode2d" title="2D flowsheet mode — detailed equipment icons">2D</button>'
          + '<button class="wb-seg-btn" id="wb-modepid" title="P&amp;ID schematic mode — standard ISA/PIP line-art symbols (bowtie valves, capsule vessels, tube-bank exchangers…)">P&amp;ID</button>'
          + '<button class="wb-seg-btn" id="wb-mode3d" title="Real 3D CAD mode — drop equipment as real 3D meshes">3D</button>'
          + '</div>')
      + '<span class="wb-3d-only" style="display:none;">'
      + grp('3D EDIT',
          '<button class="wb-tool wb-vtxt" id="wb-3dpipe" title="Pipe tool — drag one equipment to another to connect them in 3D">' + icon('link') + ' PIPE</button>'
          + '<button class="wb-tool" id="wb-3drotl" title="Rotate selected equipment −45°">' + icon('rotleft') + '</button>'
          + '<button class="wb-tool" id="wb-3drotr" title="Rotate selected equipment +45°">' + icon('rotright') + '</button>')
      + grp('FIND', '<input type="text" class="wb-tool wb-vtxt" id="wb-3d-find" placeholder="Find equipment…" list="wb-3d-find-list" style="width:170px;" title="Type a tag or name, press Enter to jump the 3D camera to it"><datalist id="wb-3d-find-list"></datalist>')
      + grp('OPERATOR', '<button class="wb-tool wb-vtxt" id="wb-3d-operator" title="Enter Operator Mode — walk through the plant as a correctly-scaled (1.73m) person. Click the ground to walk there, or WASD to move and drag the mouse to look around. Shift runs, R resets your position, Esc exits. You can\'t walk through equipment or low piping.">OPERATOR</button>'
          + '<div class="wb-seg" id="wb-3d-opcam" style="display:none;">'
          + '<button class="wb-seg-btn active" data-opcam="third" title="Third-person — camera follows behind the operator">3RD</button>'
          + '<button class="wb-seg-btn" data-opcam="first" title="First-person — camera at the operator\'s own eye level">1ST</button>'
          + '</div>'
          + '<button class="wb-tool wb-vtxt" id="wb-3d-walkway" title="Show the plant access network — the same routes the operator can actually walk (computed from real footprints, not a decorative overlay), painted from a hub point out to every piece of equipment">ACCESS</button>')
      + grp('3D VIEW', '<button class="wb-tool wb-vtxt" data-3dview="iso" title="Isometric view">ISO</button><button class="wb-tool wb-vtxt" data-3dview="top" title="Top view">Top</button><button class="wb-tool wb-vtxt" data-3dview="front" title="Front view">Fr</button><button class="wb-tool wb-vtxt" data-3dview="left" title="Left view">Lf</button><button class="wb-tool wb-vtxt" data-3dview="perspective" title="Perspective view">Psp</button><button class="wb-tool wb-vtxt wb-toggle" id="wb-3d-autorotate" title="Spin the model a continuous 360° — drag to take the camera back">360°</button>')
      + grp('3D DISPLAY', '<button class="wb-tool" data-3dmode="wire" title="Wireframe on/off">' + icon('wireframe') + '</button><button class="wb-tool" data-3dmode="xray" title="Transparent / X-ray on/off">' + icon('xray') + '</button><button class="wb-tool" data-3dmode="section" title="Section clip on/off">' + icon('section') + '</button><button class="wb-tool wb-vtxt" id="wb-3d-showports" title="Debug: label every equipment nozzle/port with its name and direction, whether or not a pipe is attached">PORTS</button><button class="wb-tool wb-vtxt on" id="wb-3d-cladding" title="Show/hide the insulation and jacket sleeve on \'Pipeline — Insulated\' / \'Pipeline — Jacketed\' lines">CLAD</button><button class="wb-tool wb-vtxt" id="wb-3d-gaps" title="QC check: flag every equipment item whose 3D nozzle position is a bounding-box guess rather than a real, hand-modelled flange — verify these before finalizing a layout">GAPS</button><button class="wb-tool wb-vtxt on" id="wb-3d-foundations" title="Show/hide the concrete foundation modelled under every big/medium equipment item (pad, ring wall, saddle foundation or footing — shape depends on equipment type)">FOUND</button>')
      + grp('FLOW VIZ', '<div class="wb-seg">'
          + '<button class="wb-seg-btn" id="wb-3d-flow" data-vizmode="flow" title="Animate the real fluid moving inside every pipe, coloured by line — speed reflects RUN ANALYSIS velocity where available">FLOW</button>'
          + '<button class="wb-seg-btn" id="wb-3d-velocity" data-vizmode="velocity" title="Colour every pipe by its own RUN ANALYSIS velocity (blue &lt;1, green 1&#8211;2.5, amber 2.5&#8211;4, red &gt;4 m/s)">VELOCITY</button>'
          + '<button class="wb-seg-btn" id="wb-3d-pressure" data-vizmode="pressure" title="Colour every pipe by its own RUN ANALYSIS pressure drop (green low loss through red high loss) &#8212; each line\'s own ΔP, not an absolute system pressure profile">PRESSURE</button>'
          + '</div>')
      + grp('EXPORT', '<button class="wb-tool wb-vtxt" data-3dexp="obj" title="Export 3D model as OBJ">' + icon('download') + ' OBJ</button>')
      + grp('LINE COLOUR',
          '<label class="wb-tool wb-vtxt" title="Line colour — click a 3D line first for one line, or use ALL" style="gap:5px;">' + icon('palette') + '<input type="color" id="wb-3dline-col" value="#c2917a" style="width:24px;height:18px;padding:0;border:none;background:none;cursor:pointer"/></label>'
          + '<button class="wb-tool wb-vtxt" id="wb-3dline-all" title="Apply colour to ALL lines">ALL</button>')
      + grp('LINE SIZE',
          '<label class="wb-tool wb-vtxt" title="Line size (NPS, inches) — click a 3D line first, then set the pipe diameter" style="gap:5px;">⌀'
          + '<select id="wb-3dline-nps" style="border:none;background:transparent;font-weight:700;font-family:var(--font-mono,monospace);cursor:pointer;">'
          + ['0.5','0.75','1','1.5','2','3','4','6','8','10','12','16','20','24'].map(function (v) { return '<option value="' + v + '"' + (v === '3' ? ' selected' : '') + '>' + v + '&quot;</option>'; }).join('')
          + '</select></label>'
          + '<button class="wb-tool wb-vtxt" id="wb-3dline-sizeall" title="Apply this size to ALL pipes">ALL</button>')
      + '</span>'
      + '<button class="wb-run" data-a="calc">▶ RUN ANALYSIS</button>'
      + '</div>'
      + '<div class="wb-body">'
      + '  <div class="wb-palette">' + paletteSearchHTML() + palette + '</div>'
      + '  <div class="wb-resizer" id="wb-resizer" title="Drag to resize the library panel"></div>'
      + '  <div class="wb-canvas-wrap">'
      + '    <svg id="wb-svg" class="wb-canvas"><defs>'
      + '      <pattern id="wbGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 L0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="1"/></pattern>'
      + '      <linearGradient id="wbPumpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4338ca"/></linearGradient>'
      + '      <linearGradient id="wbGasG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>'
      + '      <linearGradient id="wbLiqG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#bfdbfe"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient>'
      + '      <linearGradient id="wbColG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ddd6fe"/><stop offset="100%" stop-color="#c4b5fd"/></linearGradient>'
      + '      <linearGradient id="wbRxG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#fbbf24"/></linearGradient>'
      // 3D metallic / coloured gradients for the extended icon library
      + '      <linearGradient id="wbSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="45%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>'
      + '      <linearGradient id="wbSteelH" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="50%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>'
      + '      <linearGradient id="wbBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde68a"/><stop offset="50%" stop-color="#d4a017"/><stop offset="100%" stop-color="#92600a"/></linearGradient>'
      + '      <linearGradient id="wbCopper" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fca57a"/><stop offset="100%" stop-color="#b45309"/></linearGradient>'
      + '      <linearGradient id="wbRed3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fca5a5"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>'
      + '      <linearGradient id="wbBlue3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#93c5fd"/><stop offset="50%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1e40af"/></linearGradient>'
      + '      <linearGradient id="wbGreen3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#86efac"/><stop offset="50%" stop-color="#22c55e"/><stop offset="100%" stop-color="#15803d"/></linearGradient>'
      + '      <linearGradient id="wbTeal3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5eead4"/><stop offset="50%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#0f766e"/></linearGradient>'
      + '      <linearGradient id="wbGrey3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e5e7eb"/><stop offset="50%" stop-color="#9ca3af"/><stop offset="100%" stop-color="#4b5563"/></linearGradient>'
      + '      <linearGradient id="wbMotor" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4ade80"/><stop offset="50%" stop-color="#16a34a"/><stop offset="100%" stop-color="#14532d"/></linearGradient>'
      + '      <radialGradient id="wbSphere" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="55%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/></radialGradient>'
      + '      <linearGradient id="wbOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fdba74"/><stop offset="50%" stop-color="#f97316"/><stop offset="100%" stop-color="#c2410c"/></linearGradient>'
      + '      <linearGradient id="wbPumpBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="45%" stop-color="#2563eb"/><stop offset="100%" stop-color="#1e3a8a"/></linearGradient>'
      // soft drop shadow that makes every equipment read as a 3D object
      + '      <filter id="wbShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" flood-color="#0f172a" flood-opacity="0.35"/></filter>'
      + '      <linearGradient id="wbGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="45%" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></linearGradient>'
      + '    </defs><g id="wb-world"></g></svg>'
      + '    <canvas id="wb-3d-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:none;background:#e9edf1;cursor:grab;"></canvas>'
      + '    <div class="wb-scalebar" id="wb-scalebar"><div class="wb-scalebar-line"><span id="wb-scale-len">1.0 m</span></div><span id="wb-scale-zoom" class="wb-scale-zoom">100%</span></div>'
      + '    <svg class="wb-triad" id="wb-triad" viewBox="0 0 70 70" width="70" height="70"></svg>'
      + '  </div>'
      + '  <div class="wb-props"><div class="wb-props-head">PROPERTIES</div><div id="wb-prop-body"></div></div>'
      + '</div>'
      + '<div class="wb-vizlegend" id="wb-vizlegend" style="display:none;"></div>'
      + '<div class="wb-legend">'
      + '<b style="color:#334155;">STREAM PORTS:</b>'
      + '<span><i style="background:#16a34a"></i>Inlet / Cold-in</span>'
      + '<span><i style="background:#2563eb"></i>Outlet / Liquid</span>'
      + '<span><i style="background:#dc2626"></i>Hot-in / Drain</span>'
      + '<span><i style="background:#ea580c"></i>Hot-out</span>'
      + '<span><i style="background:#0d9488"></i>Cold-out</span>'
      + '<span><i style="background:#0891b2"></i>Vapor / Vent</span>'
      + '<span><i style="background:#7c3aed"></i>Recycle</span>'
      + '<span><i style="background:#b45309"></i>Waste</span>'
      + '<span><i style="background:#64748b"></i>Signal</span>'
      + '</div>'
      + '<div class="wb-statusbar"><span id="wb-status">Ready — build your process, then RUN ANALYSIS.</span></div>'
      + '</div>';

    svg = document.getElementById('wb-svg');
    gWorld = document.getElementById('wb-world');
    propEl = document.getElementById('wb-prop-body');
    wireUI(root);
    render(); renderProps();
  }
  /* Professional CAD-style line icons (Feather/Tabler-family strokes) for
     the toolbar, replacing the old mix of bare unicode glyphs (▲ ✋ ⤢ …)
     that read as arbitrary rather than as an actual tool set. One shared
     stroke style keeps every icon visually consistent. */
  var ICONS = {
    cursor: '<path d="M5 3 L5 19.5 L9.3 15.6 L12.2 21.3 L15 19.9 L12.1 14.3 L18 14.1 Z" fill="currentColor" stroke="currentColor" stroke-width="1"/>',
    connect: '<circle cx="5" cy="19" r="2.1" fill="currentColor" stroke="none"/><line x1="7" y1="17" x2="17" y2="7"/><circle cx="19" cy="5" r="2.1" fill="currentColor" stroke="none"/>',
    pan: '<path d="M12 2 L12 22 M2 12 L22 12 M12 3 L9.2 6 M12 3 L14.8 6 M12 21 L9.2 18 M12 21 L14.8 18 M3 12 L6 9.2 M3 12 L6 14.8 M21 12 L18 9.2 M21 12 L18 14.8"/>',
    marquee: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" stroke-dasharray="3 2.5"/>',
    undo: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    redo: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
    trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V7"/><path d="M6.5 7l1 12.2a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8L17.5 7"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    zoomin: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.2" y2="15.2"/><line x1="10.5" y1="7.5" x2="10.5" y2="13.5"/><line x1="7.5" y1="10.5" x2="13.5" y2="10.5"/>',
    zoomout: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.2" y2="15.2"/><line x1="7.5" y1="10.5" x2="13.5" y2="10.5"/>',
    fit: '<path d="M8 3H5.5A2.5 2.5 0 0 0 3 5.5V8"/><path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8"/><path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16"/><path d="M3 16v2.5A2.5 2.5 0 0 0 5.5 21H8"/>',
    snap: '<circle cx="6" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
    ortho: '<path d="M5 4v13h13"/><rect x="5" y="12" width="5" height="5"/>',
    viewplan: '<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><line x1="3.5" y1="12" x2="20.5" y2="12"/><line x1="12" y1="3.5" x2="12" y2="20.5"/>',
    viewiso: '<path d="M12 2.5 L20.5 7.2 V16.8 L12 21.5 L3.5 16.8 V7.2 Z"/><path d="M12 2.5 V21.5"/><path d="M3.5 7.2 L12 12 L20.5 7.2"/>',
    viewfront: '<rect x="6.5" y="3.5" width="11" height="17" rx="1"/>',
    viewside: '<rect x="3.5" y="6.5" width="17" height="11" rx="1"/>',
    orbit: '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5v5h-5"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-1 2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.5-9-6.5Z"/><circle cx="7.3" cy="10.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.6" cy="6.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.8" cy="10.2" r="1.1" fill="currentColor" stroke="none"/>',
    link: '<path d="M14.5 6.5h2.3A5 5 0 0 1 22 11.3v.4a5 5 0 0 1-5 5h-2.3"/><path d="M9.5 17.5H7.2A5 5 0 0 1 2 12.7v-.4a5 5 0 0 1 5-5h2.3"/><line x1="8" y1="12" x2="16" y2="12"/>',
    rotleft: '<rect x="8.5" y="8.5" width="9" height="9" rx="1.5"/><path d="M6.5 8.5a4.5 4.5 0 0 1 4.5-4.5"/><path d="M6.5 8.5V4.7h3.8"/>',
    rotright: '<rect x="6.5" y="8.5" width="9" height="9" rx="1.5"/><path d="M17.5 8.5a4.5 4.5 0 0 0-4.5-4.5"/><path d="M17.5 8.5V4.7h-3.8"/>',
    wireframe: '<path d="M12 2.5 L20.5 7.2 V16.8 L12 21.5 L3.5 16.8 V7.2 Z" stroke-dasharray="2.2 1.8"/><path d="M12 2.5 V21.5" stroke-dasharray="2.2 1.8"/><path d="M3.5 7.2 L12 12 L20.5 7.2" stroke-dasharray="2.2 1.8"/>',
    xray: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>',
    section: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><line x1="4" y1="14.5" x2="20" y2="14.5" stroke-dasharray="2.5 2"/>',
    download: '<path d="M12 3v11.5"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>'
  };
  function icon(key) {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[key] || '') + '</svg>';
  }
  /* One labelled cluster of tool buttons — the CommandManager/ribbon-panel
     convention (SolidWorks, Fusion 360, AutoCAD) of grouping related tools
     under a small caption, instead of one undifferentiated row of icons. */
  function grp(lab, inner) { return '<div class="wb-tgroup"><div class="wb-tgroup-row">' + inner + '</div><span class="wb-tgroup-lbl">' + lab + '</span></div>'; }
  function toolBtn(m, ic, t) { return '<button class="wb-tool" data-mode="' + m + '" title="' + t + '">' + icon(ic) + '</button>'; }
  function actBtn(a, ic, t) { return '<button class="wb-tool" data-a="' + a + '" title="' + t + '">' + icon(ic) + '</button>'; }
  function toggleBtn(k, ic, t, on) { return '<button class="wb-tool wb-toggle' + (on ? ' on' : '') + '" data-toggle="' + k + '" title="' + t + '">' + icon(ic) + '</button>'; }

  function wireUI(root) {
    // menu actions
    root.querySelectorAll('[data-a]').forEach(function (el) {
      el.addEventListener('click', function () {
        var a = el.getAttribute('data-a');
        ({ new: WB.newProject, open: WB.open, save: WB.save, cloudopen: WB.cloudOpen, import: WB.import, clearbd: WB.clearBackdrop,
          flowsheets: WB.flowsheetBrowser,
          calc: WB.runAnalysis, bom: WB.bom, report: WB.report, undo: WB.undo, redo: WB.redo, delete: WB.deleteSel,
          selectall: WB.selectAll,
          zoomin: function () { WB.zoom = Math.min(3, WB.zoom * 1.2); render(); },
          zoomout: function () { WB.zoom = Math.max(MIN_ZOOM, WB.zoom / 1.2); render(); },
          fit: fitToScreen }[a] || function () {})();
      });
    });
    // tool modes
    root.querySelectorAll('[data-mode]').forEach(function (el) {
      el.addEventListener('click', function () {
        var m = el.getAttribute('data-mode');
        // Clicking the already-active tool again drops back to SELECT rather
        // than re-applying the same mode with no visible change — otherwise
        // the only way out of PAN is to remember to pick a different button.
        WB.mode = (WB.mode === m) ? 'select' : m;
        root.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-mode') === WB.mode); });
        WB.pendingPort = null;
        if (svg) svg.style.cursor = WB.mode === 'pan' ? 'grab' : '';
        render();
      });
    });
    root.querySelector('[data-mode="select"]').classList.add('active');
    // view modes (plan / iso / front / side)
    root.querySelectorAll('[data-view]').forEach(function (el) {
      el.addEventListener('click', function () {
        WB.viewMode = el.getAttribute('data-view');
        root.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('active', b === el); });
        setStatus('View: ' + ({ plan: 'Plan / 2D', iso: 'Isometric 3D', front: 'Front elevation', side: 'Side elevation' }[WB.viewMode]) + ' — drag to pan, scroll to zoom.', '#0369a1');
        render();
      });
    });
    // 360° free-rotate mode toggle
    var rotBtn = root.querySelector('[data-mode2="rotate360"]');
    if (rotBtn) rotBtn.addEventListener('click', function () {
      WB.rotate360 = !WB.rotate360;
      rotBtn.classList.toggle('active', WB.rotate360);
      setStatus(WB.rotate360 ? '360° ROTATE — drag on empty canvas to spin the view (double-click ↻ to reset).' : 'Rotate mode off.', '#0369a1');
    });
    if (rotBtn) rotBtn.addEventListener('dblclick', function () { WB.viewRotate = 0; render(); });
    // ── Integrated real 3D mode: dropping any library icon builds a real
    //    Three.js mesh right here in the workbench canvas ──
    var svgEl = root.querySelector('#wb-svg');
    var canvas3d = root.querySelector('#wb-3d-canvas');
    var only3d = root.querySelectorAll('.wb-3d-only');
    var btn2d = root.querySelector('#wb-mode2d'), btn3d = root.querySelector('#wb-mode3d'), btnpid = root.querySelector('#wb-modepid');
    function set3D(on) {
      WB.mode3d = on;
      // 3D and P&ID are different workbenches onto the same model; entering
      // 3D drops P&ID symbol mode (and restores the detailed library icons).
      if (on) { WB.pidMode = false; if (btnpid) btnpid.classList.remove('active'); refreshPalette(); }
      // Keep the SVG in the render tree (visibility, not display:none) so its
      // <defs> gradients/filters stay available to the library thumbnails while
      // in 3D — the opaque 3D canvas sits on top and hides the 2D flowsheet.
      if (svgEl) { svgEl.style.visibility = on ? 'hidden' : 'visible'; svgEl.style.display = 'block'; }
      if (canvas3d) canvas3d.style.display = on ? 'block' : 'none';
      /* 'contents' (not 'inline') so the .wb-tgroup clusters inside this
         wrapper become direct flex items of .wb-toolbar themselves — a
         shown/hidden <span> wrapper around block-level group divs would
         otherwise break out of the toolbar's flex layout. */
      only3d.forEach(function (e) { e.style.display = on ? 'contents' : 'none'; });
      if (btn3d) btn3d.classList.toggle('active', on);
      if (btn2d) btn2d.classList.toggle('active', !on && !WB.pidMode);
      if (on && window.ARO3D) {
        window.ARO3D.onSelect = function (props, tris) {
          if (!propEl) return;
          if (!props) { propEl.innerHTML = '<div class="wb-prop-empty">Click a 3D object to see its properties, or drag equipment from the library.</div>'; return; }
          /* If this 3D mesh is a piece of equipment from the shared model,
             show the SAME editable properties panel the 2D and P&ID
             workbenches use. Previously 3D offered only a rename box and a
             read-only dump, so tag/fluid/flow/temperature could not be
             edited from 3D at all — and any change made in 2D could not be
             made here. All three workbenches now edit one model. */
          var nid3 = window.ARO3D.selectedNid ? window.ARO3D.selectedNid() : null;
          if (nid3 && nodeById(nid3)) {
            WB.sel = { kind: 'node', id: nid3 }; WB.selMulti = [];
            renderProps();
            return;
          }
          propEl.innerHTML = '<div class="wb-prop-title">' + (props.Type || '3D Equipment') + '</div>'
            + '<label class="wb-field"><span>Name</span><input id="wb-3dname" type="text" value="' + String(props.Type || '').replace(/"/g, '&quot;') + '"/></label>'
            + '<div class="wb-xform"><div class="wb-xform-h">ROTATE · this equipment</div><div class="wb-xform-row">'
            + '<button class="wb-xbtn" id="wb-3dpr-l" title="Rotate −45°">⟲</button><button class="wb-xbtn" id="wb-3dpr-r" title="Rotate +45°">⟳</button>'
            + '<span class="wb-xval">drag gizmo to orbit</span></div></div>'
            + '<button class="wb-tool wb-walkto-link" id="wb-3d-walkto-raw" style="width:100%;margin:2px 0 8px;padding:6px 8px;font-weight:800;letter-spacing:.05em;">&#128694; WALK TO EQUIPMENT</button>'
            + Object.keys(props).map(function (k) { return '<div class="wb-rrow"><span>' + k + '</span><b>' + props[k] + '</b></div>'; }).join('')
            + '<div class="wb-prop-note">Real Three.js mesh · ' + tris + ' triangles · PBR material. Left-drag orbit · wheel zoom · click select.</div>';
          // rename this equipment (writes back to the shared 2D node tag)
          var nm = propEl.querySelector('#wb-3dname');
          if (nm) nm.addEventListener('change', function () {
            var nid = window.ARO3D.renameSelected(nm.value);
            if (nid) { var n = nodeById(nid); if (n) n.name = nm.value; }
          });
          var prl = propEl.querySelector('#wb-3dpr-l'), prr = propEl.querySelector('#wb-3dpr-r');
          if (prl) prl.addEventListener('click', function () { window.ARO3D.rotateSelected(-45); });
          if (prr) prr.addEventListener('click', function () { window.ARO3D.rotateSelected(45); });
          var walkRaw = propEl.querySelector('#wb-3d-walkto-raw');
          if (walkRaw) walkRaw.addEventListener('click', function () { window.ARO3D.walkToEquipment(null); });
        };
        // 3D connections made by the user get written back into the shared 2D model.
        // fromRole/toRole/fromId/toId are the EXACT 3D port the user clicked
        // (aro-workbench-3d.js's buildPipe) — previously discarded in favour of
        // always grabbing the type's first in-ish/out-ish 2D port, so connecting
        // e.g. an STHE's shell-side nozzle in 3D silently wrote the pipe onto the
        // tube-side port in 2D/P&ID instead: the two views then disagreed about
        // which physical nozzle was connected. Resolve the real port first and
        // only fall back to the old first-match guess when it truly can't be
        // identified (an unregistered type — see portIndexFor3D below).
        window.ARO3D.onConnect = function (fromNid, toNid, fromRole, toRole, fromId, toId) {
          var a = nodeById(fromNid), b = nodeById(toNid); if (!a || !b) return;
          if (WB.pipes.some(function (p) { return p.from.id === fromNid && p.to.id === toNid; })) return;
          var fp = portIndexFor3D(a.t, fromRole, fromId); if (fp < 0) fp = outPortIndex(a.t);
          var tp = portIndexFor3D(b.t, toRole, toId); if (tp < 0) tp = inPortIndex(b.t);
          WB.pipes.push({ id: 'L' + (++WB.seq), from: { id: fromNid, pi: fp, portId: portIdAt(a.t, fp) }, to: { id: toNid, pi: tp, portId: portIdAt(b.t, tp) }, role: 'process', tag: 'L-' + WB.seq });
        };
        // Keep the engineering scale bar / zoom % live while in 3D — the 3D
        // camera has its own zoom (mouse wheel on the canvas changes camera
        // distance, not WB.zoom), so it needs its own conversion instead of
        // reusing the 2D SVG's updateOverlays() math.
        window.ARO3D.onZoom = function (pxPerUnit, r) {
          var zEl = document.getElementById('wb-scale-zoom');
          var lEl = document.getElementById('wb-scale-len');
          var lineEl = document.querySelector('.wb-scalebar-line');
          if (!zEl && !lEl && !lineEl) return;
          // pick a "nice" round length (1 Three.js unit ≈ 1 m) whose on-screen bar is ~64 px
          var mForTarget = 64 / pxPerUnit;
          var pow = Math.pow(10, Math.floor(Math.log10(mForTarget)));
          var frac = mForTarget / pow;
          var niceFrac = frac >= 5 ? 5 : frac >= 2 ? 2 : 1;
          var niceM = niceFrac * pow;
          var barPx = niceM * pxPerUnit;
          var lbl = niceM >= 1 ? (Number.isInteger(niceM) ? niceM : niceM.toFixed(1)) + ' m' : Math.round(niceM * 100) + ' cm';
          if (zEl) zEl.textContent = Math.round((16 / r) * 100) + '%';
          if (lEl) lEl.textContent = lbl;
          if (lineEl) lineEl.style.width = Math.max(20, Math.min(160, barPx)) + 'px';
        };
        window.ARO3D.embed(canvas3d, function (m) { setStatus(m, '#38bdf8'); });
        // carry the ENTIRE current flowsheet (equipment + connections) into 3D
        window.ARO3D.buildFromModel(WB.nodes, WB.pipes, function (t, n) { return (n && n.name) || (LIB_INDEX[t] ? LIB_INDEX[t].n : t); });
        setTimeout(function () { window.ARO3D.resize(); }, 30);
        setStatus('REAL 3D MODE — your full flowsheet (' + WB.nodes.length + ' equipment, ' + WB.pipes.length + ' lines) is now in 3D. Drag equipment from the library to add more; use 🔗 PIPE to connect.', '#38bdf8');
      } else {
        setStatus('2D flowsheet mode.', '#94a3b8');
        render();
      }
    }
    WB.setMode3D = set3D;
    /* Put the workbench back exactly as the engineer left it. The report has
       to walk through all three views to capture them, and capture3D briefly
       enters 3D — which clears P&ID symbol mode. Without this, generating a
       report from the P&ID workbench silently dumped you back into 2D. */
    WB.setWorkbench = function (pid, m3) {
      set3D(!!m3);                       // may clear pidMode as a side effect
      WB.pidMode = !!pid && !m3;         // 3D and P&ID are mutually exclusive
      if (btnpid) btnpid.classList.toggle('active', WB.pidMode);
      if (btn2d) btn2d.classList.toggle('active', !m3 && !WB.pidMode);
      refreshPalette();
      if (!m3) render();
    };
    if (btn3d) btn3d.addEventListener('click', function () { if (!window.ARO3D) { alert('3D engine not loaded.'); return; } set3D(true); });
    if (btn2d) btn2d.addEventListener('click', function () {
      WB.pidMode = false; if (btnpid) btnpid.classList.remove('active');
      set3D(false); refreshPalette();
      setStatus('2D FLOWSHEET WORKBENCH — detailed equipment icons. Same model as the P&ID and 3D workbenches; anything you draw here appears in all three.', '#0369a1');
    });
    if (btnpid) btnpid.addEventListener('click', function () {
      WB.pidMode = true;
      btnpid.classList.add('active');
      if (btn2d) btn2d.classList.remove('active');
      if (WB.mode3d) set3D(false); else render();
      refreshPalette();   // library now shows ISA/PIP schematic symbols to drag
      setStatus('P&ID SCHEMATIC WORKBENCH — drag the ISA/PIP symbols from the library to draw. Same model as the 2D and 3D workbenches; switch any time and your drawing carries across.', '#334155');
    });
    // 3D view / display / export controls
    root.querySelectorAll('[data-3dview]').forEach(function (b) { b.addEventListener('click', function () { window.ARO3D && window.ARO3D.view(b.getAttribute('data-3dview')); }); });
    root.querySelectorAll('[data-3dmode]').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); window.ARO3D && window.ARO3D.setMode(b.getAttribute('data-3dmode'), b.classList.contains('on')); }); });
    var showPortsBtn = root.querySelector('#wb-3d-showports');
    if (showPortsBtn) showPortsBtn.addEventListener('click', function () {
      showPortsBtn.classList.toggle('on');
      window.ARO3D && window.ARO3D.setShowPorts(showPortsBtn.classList.contains('on'));
    });
    var claddingBtn = root.querySelector('#wb-3d-cladding');
    if (claddingBtn) claddingBtn.addEventListener('click', function () {
      claddingBtn.classList.toggle('on');
      window.ARO3D && window.ARO3D.setJacketVisible(claddingBtn.classList.contains('on'));
    });
    var gapsBtn = root.querySelector('#wb-3d-gaps');
    if (gapsBtn) gapsBtn.addEventListener('click', function () {
      gapsBtn.classList.toggle('on');
      window.ARO3D && window.ARO3D.setShowGaps(gapsBtn.classList.contains('on'));
    });
    var foundBtn = root.querySelector('#wb-3d-foundations');
    if (foundBtn) foundBtn.addEventListener('click', function () {
      foundBtn.classList.toggle('on');
      window.ARO3D && window.ARO3D.setFoundationsVisible(foundBtn.classList.contains('on'));
    });
    // OPERATOR MODE — walk-through avatar (Phase 2 of the plant-operability
    // module). The button here just flips the 3D-side state; the live
    // location readout in PROPERTIES is pushed from aro-workbench-3d.js via
    // onOperatorPanel (same "engine pushes, UI just renders" pattern as
    // onZoom/onPipeSelect above) so this file never has to poll it.
    var operatorBtn = root.querySelector('#wb-3d-operator');
    var opCamWrap = root.querySelector('#wb-3d-opcam');
    var operatorPanelBuilt = false;
    // Pushed every few animation frames while walking (see opPanelTick in
    // aro-workbench-3d.js), so this rebuilds the panel's DOM once on entry
    // and thereafter only touches the 3 text nodes that actually change —
    // a full innerHTML replace on every push destroyed/recreated the RESET
    // and EXIT buttons underneath the pointer several times a second.
    function renderOperatorPanel(info) {
      if (!propEl) return;
      if (!info || !info.active) {
        operatorPanelBuilt = false;
        propEl.innerHTML = '<div class="wb-prop-empty">Click a 3D object to see its properties, or drag equipment from the library.</div>';
        return;
      }
      if (!operatorPanelBuilt || !propEl.querySelector('#wb-op-x')) {
        propEl.innerHTML = '<div class="wb-prop-title">OPERATOR MODE</div>'
          + '<div class="wb-prop-note">Click the ground to walk there. WASD to move, drag to look around, Shift to run, R resets position, Esc exits.</div>'
          + '<div class="wb-rrow"><span>Near</span><b id="wb-op-near">' + info.location + '</b></div>'
          + '<div class="wb-rrow"><span>X (m)</span><b id="wb-op-x">' + info.x.toFixed(1) + '</b></div>'
          + '<div class="wb-rrow"><span>Z (m)</span><b id="wb-op-z">' + info.z.toFixed(1) + '</b></div>'
          + '<button class="wb-xbtn" id="wb-op-reset" style="width:100%;margin-top:10px;">RESET POSITION</button>'
          + '<button class="wb-xbtn" id="wb-op-exit" style="width:100%;margin-top:6px;">EXIT OPERATOR MODE</button>';
        operatorPanelBuilt = true;
        var resetBtn2 = propEl.querySelector('#wb-op-reset');
        if (resetBtn2) resetBtn2.addEventListener('click', function () { window.ARO3D && window.ARO3D.resetOperator(); });
        var exitBtn = propEl.querySelector('#wb-op-exit');
        if (exitBtn) exitBtn.addEventListener('click', function () { operatorBtn && operatorBtn.click(); });
      } else {
        var nearEl = propEl.querySelector('#wb-op-near'), xEl = propEl.querySelector('#wb-op-x'), zEl = propEl.querySelector('#wb-op-z');
        if (nearEl) nearEl.textContent = info.location;
        if (xEl) xEl.textContent = info.x.toFixed(1);
        if (zEl) zEl.textContent = info.z.toFixed(1);
      }
    }
    function setOperatorUI(on) {
      if (operatorBtn) operatorBtn.classList.toggle('on', on);
      if (opCamWrap) opCamWrap.style.display = on ? 'flex' : 'none';
      if (!on) renderOperatorPanel(null);
    }
    if (operatorBtn) operatorBtn.addEventListener('click', function () {
      var on = !operatorBtn.classList.contains('on');
      setOperatorUI(on);
      window.ARO3D && window.ARO3D.setOperatorMode(on);
    });
    if (opCamWrap) opCamWrap.querySelectorAll('[data-opcam]').forEach(function (b) {
      b.addEventListener('click', function () {
        opCamWrap.querySelectorAll('[data-opcam]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        window.ARO3D && window.ARO3D.setOperatorCamMode(b.getAttribute('data-opcam'));
      });
    });
    if (window.ARO3D) {
      window.ARO3D.onOperatorPanel = renderOperatorPanel;
      // Esc inside the 3D module also exits — keep the toolbar button/camera
      // toggle in sync when the mode is dropped from the keyboard, not just
      // from clicking OPERATOR again.
      window.ARO3D.onOperatorModeChange = function (on) { setOperatorUI(on); };
    }
    // ACCESS / WALKWAY — Phase 4's plant access network overlay. Independent
    // of Operator Mode (an engineer reviewing accessibility doesn't have to
    // drop into the avatar to see it), off by default since it's a lot of
    // extra geometry laid over the whole plant.
    var walkwayBtn = root.querySelector('#wb-3d-walkway');
    if (walkwayBtn) walkwayBtn.addEventListener('click', function () {
      walkwayBtn.classList.toggle('on');
      window.ARO3D && window.ARO3D.setWalkwayVisible(walkwayBtn.classList.contains('on'));
    });
    // FLOW / VELOCITY / PRESSURE — mutually exclusive segmented toggle:
    // clicking the active one turns visualization off, clicking a different
    // one switches straight to it.
    function pulseRunButton() {
      var runBtn = root.querySelector('.wb-run');
      if (!runBtn) return;
      runBtn.classList.remove('wb-pulse'); void runBtn.offsetWidth; runBtn.classList.add('wb-pulse');
      setTimeout(function () { runBtn.classList.remove('wb-pulse'); }, 1800);
    }
    function fmtVizNum(v) {
      if (!isFinite(v)) return '--';
      var a = Math.abs(v);
      if (a !== 0 && (a < 0.01 || a >= 10000)) return v.toExponential(2);
      return v.toFixed(a < 10 ? 2 : 1);
    }
    function renderVizLegend(mode) {
      var el = root.querySelector('#wb-vizlegend');
      if (!el) return;
      if (mode === 'off') { el.style.display = 'none'; el.innerHTML = ''; return; }
      var grad = window.ARO3D && window.ARO3D.getVizGradient ? window.ARO3D.getVizGradient(mode) : null;
      var html = '';
      if (mode === 'velocity' || mode === 'pressure') {
        html += '<h4>' + (mode === 'velocity' ? 'Velocity' : 'Pressure Drop') + '</h4>';
        if (grad) {
          var css = 'linear-gradient(to right, ' + grad.stops.join(',') + ')';
          html += '<div class="wb-vizgrad"><span class="wb-vizgradscale">' + fmtVizNum(grad.min) + '</span>'
            + '<div class="wb-vizgradbar" style="background:' + css + '"></div>'
            + '<span class="wb-vizgradscale">' + fmtVizNum(grad.max) + '</span><span class="wb-vizgradunit">' + grad.unit + '</span></div>';
          html += '<div class="wb-vizrow"><span class="wb-vizswatch" style="background:' + grad.notCalc + '"></span>Not yet calculated</div>';
        } else {
          html += '<div class="wb-viznote">No results yet — run RUN ANALYSIS to populate this range.</div>';
        }
        html += '<div class="wb-viznote">' + (mode === 'pressure'
          ? 'Each line’s own pressure drop — not an absolute system profile (no network solve).'
          : 'Indicative, from RUN ANALYSIS steady-state results — not a transient CFD solve.') + '</div>';
      } else if (mode === 'flow') {
        html += '<h4>Flow</h4><div class="wb-viznote">Animated fluid inside every pipe. Speed reflects RUN ANALYSIS velocity where calculated — indicative, not a transient CFD solve.</div>'
          + '<div class="wb-flowctrl">'
          + '<button id="wb-flow-playpause" type="button">Pause</button>'
          + '<input type="range" id="wb-flow-speed" min="0.25" max="3" step="0.25" value="1">'
          + '<span class="wb-flowspeed" id="wb-flow-speedlbl">1.0&times;</span>'
          + '</div>';
      }
      el.innerHTML = html;
      el.style.display = 'flex';
      if (mode === 'flow' && window.ARO3D) {
        window.ARO3D.setFlowPaused(false); window.ARO3D.setFlowSpeed(1);
        var pp = el.querySelector('#wb-flow-playpause');
        if (pp) pp.addEventListener('click', function () {
          var paused = !window.ARO3D.getFlowPaused();
          window.ARO3D.setFlowPaused(paused);
          pp.textContent = paused ? 'Play' : 'Pause';
        });
        var sp = el.querySelector('#wb-flow-speed'), lbl = el.querySelector('#wb-flow-speedlbl');
        if (sp) sp.addEventListener('input', function () {
          var v = parseFloat(sp.value);
          window.ARO3D.setFlowSpeed(v);
          if (lbl) lbl.textContent = v.toFixed(2).replace(/0$/, '').replace(/\.$/, '.0') + '×';
        });
      }
    }
    var vizBtns = root.querySelectorAll('[data-vizmode]');
    vizBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-vizmode');
        var turningOff = b.classList.contains('active');
        vizBtns.forEach(function (o) { o.classList.remove('active'); });
        if (!turningOff) b.classList.add('active');
        var finalMode = turningOff ? 'off' : mode;
        window.ARO3D && window.ARO3D.setFlowVizMode(finalMode);
        renderVizLegend(finalMode);
        if (!turningOff) {
          var hasPipes = WB.pipes.length > 0;
          var hasResults = WB.pipes.some(function (p) { return !!p.result; });
          if (!hasPipes) {
            setStatus('Nothing to visualize yet — drag equipment onto the canvas and connect it with pipes, then RUN ANALYSIS.', '#d97706');
            pulseRunButton();
          } else if (!hasResults) {
            setStatus('Click RUN ANALYSIS to calculate this flowsheet — ' + mode.toUpperCase() + ' has no numbers to show yet.', '#d97706');
            pulseRunButton();
          }
        }
      });
    });
    var autoRotateBtn = root.querySelector('#wb-3d-autorotate');
    if (autoRotateBtn) autoRotateBtn.addEventListener('click', function () {
      autoRotateBtn.classList.toggle('on');
      window.ARO3D && window.ARO3D.setAutoRotate(autoRotateBtn.classList.contains('on'));
    });
    root.querySelectorAll('[data-3dexp]').forEach(function (b) { b.addEventListener('click', function () { window.ARO3D && window.ARO3D.exportOBJ(); }); });
    var pipeBtn = root.querySelector('#wb-3dpipe');
    if (pipeBtn) pipeBtn.addEventListener('click', function () { pipeBtn.classList.toggle('on'); window.ARO3D && window.ARO3D.setPipeMode(pipeBtn.classList.contains('on')); });
    // 3D per-equipment 360° rotation (rotates the clicked equipment about its axis)
    var rotL = root.querySelector('#wb-3drotl'), rotR = root.querySelector('#wb-3drotr');
    if (rotL) rotL.addEventListener('click', function () { window.ARO3D && window.ARO3D.rotateSelected(-45); });
    if (rotR) rotR.addEventListener('click', function () { window.ARO3D && window.ARO3D.rotateSelected(45); });
    // Find/jump box — a big connected plant is too many units to hunt
    // through by eye, so this searches WB.nodes by tag/label and jumps the
    // 3D camera straight to the match, same as the properties panel's own
    // "LOCATE IN 3D" but reachable without clicking the item first.
    var findBox = root.querySelector('#wb-3d-find'), findList = root.querySelector('#wb-3d-find-list');
    if (findBox) {
      findBox.addEventListener('input', function () {
        var q = findBox.value.trim().toLowerCase();
        if (!findList) return;
        findList.innerHTML = '';
        if (!q) return;
        WB.nodes.filter(function (n) { return (n.tag || '').toLowerCase().indexOf(q) >= 0; })
          .slice(0, 20)
          .forEach(function (n) { var o = document.createElement('option'); o.value = n.tag; findList.appendChild(o); });
      });
      var jumpToFind = function () {
        var q = findBox.value.trim().toLowerCase();
        if (!q) return;
        var n = WB.nodes.filter(function (nn) { return (nn.tag || '').toLowerCase() === q; })[0]
          || WB.nodes.filter(function (nn) { return (nn.tag || '').toLowerCase().indexOf(q) >= 0; })[0];
        if (!n) { setStatus('No equipment matches "' + findBox.value + '".', '#d97706'); return; }
        WB.sel = { kind: 'node', id: n.id }; WB.selMulti = []; render(); renderProps();
        if (window.ARO3D) window.ARO3D.selectByNid(n.id);
        setStatus('Located ' + n.tag + '.', '#0369a1');
      };
      findBox.addEventListener('keydown', function (e) { if (e.key === 'Enter') jumpToFind(); });
    }
    // 3D line colour — single (selected line) or all lines, kept in sync with the 2D model
    var lineCol = root.querySelector('#wb-3dline-col');
    var lineNps = root.querySelector('#wb-3dline-nps');
    if (lineCol) {
      // reflect the selected 3D line's colour + size into the controls, AND
      // populate the full pipe properties panel (Line Type, Fluid, sizing…)
      // exactly like clicking a pipe in 2D does — Line Type previously only
      // showed up when the pipe was selected in 2D mode.
      if (window.ARO3D) window.ARO3D.onPipeSelect = function (pid) {
        var p = pid && pipeById(pid); if (!p) return;
        if (p.color) lineCol.value = p.color;
        if (lineNps && p.nps) lineNps.value = String(p.nps);
        WB.sel = { kind: 'pipe', id: pid }; WB.selMulti = [];
        renderProps();
      };
      lineCol.addEventListener('input', function () {
        if (!window.ARO3D) return;
        var pid = window.ARO3D.setSelectedPipeColor(lineCol.value); // colours the picked 3D line
        if (pid) { var p = pipeById(pid); if (p) p.color = lineCol.value; } // write back to 2D model
        else setStatus('Click a 3D line first to recolour just that line — or use ALL LINES.', '#0369a1');
      });
    }
    var lineAll = root.querySelector('#wb-3dline-all');
    if (lineAll) lineAll.addEventListener('click', function () {
      if (!window.ARO3D || !lineCol) return;
      window.ARO3D.setAllPipeColor(lineCol.value);
      WB.pipes.forEach(function (p) { p.color = lineCol.value; }); // keep 2D model in sync
      setStatus('All lines set to ' + lineCol.value + ' in 3D and 2D.', '#0369a1');
    });
    // 3D line size (pipe diameter from NPS) — selected line or all pipes
    if (lineNps) lineNps.addEventListener('change', function () {
      if (!window.ARO3D) return;
      var nps = parseFloat(lineNps.value);
      var pid = window.ARO3D.setSelectedPipeSize(nps);   // thickens/thins the picked 3D pipe
      if (pid) { var p = pipeById(pid); if (p) p.nps = nps; }  // write back to 2D model
      else setStatus('Click a 3D line first to resize just that pipe — or use ALL DIA.', '#0369a1');
    });
    var sizeAll = root.querySelector('#wb-3dline-sizeall');
    if (sizeAll) sizeAll.addEventListener('click', function () {
      if (!window.ARO3D || !lineNps) return;
      var nps = parseFloat(lineNps.value);
      window.ARO3D.setAllPipeSize(nps);
      WB.pipes.forEach(function (p) { p.nps = nps; });  // keep 2D model in sync
      setStatus('All pipe diameters set to ' + nps + '″ in 3D and 2D.', '#0369a1');
    });
    btn2d && btn2d.classList.add('active');
    // background colour — free picker (any colour the user wants)
    var bgInput = root.querySelector('#wb-bg-input');
    if (bgInput) bgInput.addEventListener('input', function () {
      WB.bgColor = bgInput.value;
      /* Marks the sheet as user-customised so the light-theme remap (which
         otherwise forces #wb-svg white with !important — see aro-daylight.js)
         steps aside instead of silently overwriting an explicit user pick. */
      if (svg) svg.classList.add('wb-bg-user');
      setStatus('Background: ' + WB.bgColor, '#0369a1'); render();
    });
    // Interactive coordinate gizmo — drag it to rotate the view; double-click resets
    var triad = root.querySelector('#wb-triad');
    if (triad) {
      var triDrag = null;
      triad.addEventListener('mousedown', function (e) {
        triDrag = { x: e.clientX, y: e.clientY, start: WB.viewRotate || 0, d3: WB.mode3d }; e.preventDefault(); e.stopPropagation();
      });
      window.addEventListener('mousemove', function (e) {
        if (!triDrag) return;
        if (triDrag.d3 && window.ARO3D && window.ARO3D.orbit) {
          // 3D: horizontal drag spins azimuth, vertical drag tilts elevation
          window.ARO3D.orbit((e.clientX - triDrag.x) * 0.012, (e.clientY - triDrag.y) * 0.012);
          triDrag.x = e.clientX; triDrag.y = e.clientY;
        } else {
          WB.viewRotate = (((triDrag.start + (e.clientX - triDrag.x) * 1.2) % 360) + 360) % 360;
          render();
        }
      });
      window.addEventListener('mouseup', function () {
        if (triDrag && !triDrag.d3) { setStatus('View rotated to ' + Math.round(WB.viewRotate) + '° — drag the gizmo or use ↻ to rotate.', '#0369a1'); }
        else if (triDrag && triDrag.d3) { setStatus('3D view rotated — drag the X/Y/Z gizmo to turn the whole drawing.', '#0369a1'); }
        triDrag = null;
      });
      triad.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        if (WB.mode3d && window.ARO3D && window.ARO3D.orbitReset) { window.ARO3D.orbitReset(); return; }
        WB.viewRotate = 0; WB.viewMode = 'plan'; root.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === 'plan'); }); render();
      });
      triad.addEventListener('wheel', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (WB.mode3d && window.ARO3D && window.ARO3D.orbit) { window.ARO3D.orbit(e.deltaY < 0 ? 0.25 : -0.25, 0); return; }
        WB.viewRotate = (((WB.viewRotate || 0) + (e.deltaY < 0 ? 15 : -15)) % 360 + 360) % 360; render();
      }, { passive: false });
    }
    // toggles (snap / ortho / grid)
    root.querySelectorAll('[data-toggle]').forEach(function (el) {
      el.addEventListener('click', function () { var k = el.getAttribute('data-toggle'); WB[k] = !WB[k]; el.classList.toggle('on', WB[k]); render(); });
    });
    // Palette drag — delegated on the container, not bound per tile, so the
    // thumbnails can be re-rendered when switching workbench (2D <-> P&ID)
    // without losing draggability.
    var palEl = root.querySelector('.wb-palette');
    if (palEl) palEl.addEventListener('dragstart', function (e) {
      var tile = e.target && e.target.closest ? e.target.closest('.wb-lib') : null;
      if (!tile) return;
      e.dataTransfer.setData('text/aro-t', tile.getAttribute('data-t'));
    });
    // Same delegation pattern as the dragstart listener above — bound once
    // on the container, so it keeps working through every refreshPalette()
    // innerHTML swap (2D <-> P&ID) without needing to be re-attached.
    if (palEl) palEl.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'wb-eq-search') filterPalette(e.target.value);
    });
    // User-adjustable library panel width (drag the divider; persisted)
    var body = root.querySelector('.wb-body');
    var rz = root.querySelector('#wb-resizer');
    try { var savedW = parseInt(localStorage.getItem('wbPalW')); if (savedW >= 140 && savedW <= 420) body.style.setProperty('--wb-pal', savedW + 'px'); } catch (e) {}
    if (rz) {
      var rzDrag = null;
      rz.addEventListener('mousedown', function (e) {
        rzDrag = { x: e.clientX, w: root.querySelector('.wb-palette').getBoundingClientRect().width };
        rz.classList.add('dragging'); e.preventDefault();
      });
      window.addEventListener('mousemove', function (e) {
        if (!rzDrag) return;
        var w = Math.max(140, Math.min(420, rzDrag.w + (e.clientX - rzDrag.x)));
        body.style.setProperty('--wb-pal', w + 'px');
      });
      window.addEventListener('mouseup', function () {
        if (!rzDrag) return;
        rzDrag = null; rz.classList.remove('dragging');
        try { localStorage.setItem('wbPalW', parseInt(root.querySelector('.wb-palette').getBoundingClientRect().width)); } catch (e) {}
      });
    }

    var wrap = root.querySelector('.wb-canvas-wrap');
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); });
    wrap.addEventListener('drop', function (e) {
      e.preventDefault(); var t = e.dataTransfer.getData('text/aro-t'); if (!t) return;
      if (WB.mode3d && window.ARO3D) {
        var lib = LIB_INDEX[t];
        // also add it to the shared 2D model so it survives a 3D → 2D toggle
        var n3 = { id: 'N' + (++WB.seq), t: t, x: snapV((WB.nodes.length % 6) * 120 + 60), y: snapV(Math.floor(WB.nodes.length / 6) * 110 + 60), rot: 0, scale: 1,
          tag: defaultTag(t), fluid: 'Water', flow: 10, temp: 30, press: 3, nps: 3 };
        WB.nodes.push(n3);
        window.ARO3D.addByType(t, lib ? lib.n : t, n3.id, n3.nps);   // real 3D mesh, keyed to the node
        return;
      }
      var pt = clientToWorld(e.clientX, e.clientY); addNode(t, pt.x, pt.y);
    });
    // canvas interactions
    svg.addEventListener('mousedown', onDown);
    svg.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    svg.addEventListener('wheel', function (e) { e.preventDefault(); var f = e.deltaY < 0 ? 1.1 : 0.9; WB.zoom = Math.max(MIN_ZOOM, Math.min(3, WB.zoom * f)); render(); }, { passive: false });
    svg.addEventListener('click', onClick);
    window.addEventListener('keydown', function (e) {
      if (document.getElementById('workbench-tab') && !document.getElementById('workbench-tab').classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { WB.deleteSel(); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { WB.undo(); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { WB.redo(); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') { WB.selectAll(); e.preventDefault(); }
      else if (e.key === 'Escape' && WB.selMulti.length) { WB.selMulti = []; renderProps(); render(); }
    });
  }

  function clientToWorld(cx, cy) {
    var r = svg.getBoundingClientRect();
    return { x: (cx - r.left - WB.panX) / WB.zoom, y: (cy - r.top - WB.panY) / WB.zoom };
  }

  var drag = null, panning = null, spaceDown = false, connecting = false, justConnected = false, rotating = null, viewRot = null;
  var dragGroup = null, marqueeDown = null, justMarqueed = false;
  window.addEventListener('keydown', function (e) { if (e.code === 'Space') spaceDown = true; });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space') spaceDown = false; });

  function portRef(portEl) { var p = portEl.getAttribute('data-port').split(':'); return { id: p[0], pi: parseInt(p[1]) }; }
  // Create a line between two ports (rejects a port joined to itself)
  function connectPorts(from, to) {
    if (from.id === to.id && from.pi === to.pi) return false;
    var fromN = nodeById(from.id), toN = nodeById(to.id);
    // Tag both ends with their canonical registry id (undefined outside the
    // first 5 equipment types) so 3D can resolve this connection by real
    // port identity instead of guessing from role alone.
    var fromPortId = fromN ? portIdAt(fromN.t, from.pi) : undefined;
    var toPortId = toN ? portIdAt(toN.t, to.pi) : undefined;
    // Ordinary process nozzles take exactly one line — reject an accidental
    // duplicate rather than silently drawing two overlapping connections
    // (rule 5). Only enforced where a real portId exists; equipment outside
    // the registry keeps the old, permissive behaviour.
    var occFrom = findPortOccupant(from.id, fromPortId), occTo = findPortOccupant(to.id, toPortId);
    if (occFrom || occTo) {
      var occ = occFrom || occTo;
      setStatus('That port is already connected (' + (occ.tag || occ.id) + '). Disconnect the existing line first.', '#dc2626');
      return false;
    }
    pushUndo();
    var fromPort = fromN ? LIB_INDEX[fromN.t].ports[from.pi] : null;
    var role = fromPort ? fromPort.role : 'io';
    from.portId = fromPortId;
    to.portId = toPortId;
    var pfx = role === 'recycle' ? 'RCY' : role === 'waste' ? 'WST' : role === 'vent' || role === 'vap' ? 'VNT' : role === 'drain' ? 'DRN' : role === 'signal' ? 'SIG' : 'L';
    var p = { id: 'L' + (++WB.seq), from: from, to: to, role: role,
      tag: pfx + '-' + (100 + WB.pipes.length + 1), fluid: fromN ? fromN.fluid : 'Water',
      flow: fromN ? fromN.flow : 10, nps: fromN ? fromN.nps : 3, length: 5, dz: 0 };
    WB.pipes.push(p); WB.sel = { kind: 'pipe', id: p.id };
    return true;
  }

  function onDown(e) {
    // Hold-and-rotate handle takes priority
    var rotEl = e.target.closest('[data-rotate]');
    if (rotEl) {
      var rn = nodeById(rotEl.getAttribute('data-rotate'));
      if (rn) { var lib0 = LIB_INDEX[rn.t]; rotating = { id: rn.id, cx: rn.x + lib0.w / 2, cy: rn.y + lib0.h / 2, start: rn.rot || 0 }; pushUndo(); e.preventDefault(); return; }
    }
    var portEl = e.target.closest('[data-port]');
    // Drag-to-connect: press on ANY port (any mode) to start a wire.
    // If a DIFFERENT port is already pending (armed by an earlier click —
    // see onUp's "released on same port, pipe mode keeps it pending"
    // below), this press is the second half of a click-click connect:
    // finish it here rather than overwriting the armed port, otherwise
    // the pending port from the first click is silently lost.
    if (portEl) {
      var pr0 = portRef(portEl);
      if (WB.pendingPort && (WB.pendingPort.id !== pr0.id || WB.pendingPort.pi !== pr0.pi)) {
        if (connectPorts(WB.pendingPort, pr0)) { WB.pendingPort = null; justConnected = true; setTimeout(function () { justConnected = false; }, 50); }
        WB.rubberXY = null; connecting = false; render(); renderProps(); e.preventDefault(); return;
      }
      WB.pendingPort = pr0; connecting = true; WB.rubberXY = clientToWorld(e.clientX, e.clientY); render(); e.preventDefault(); return;
    }
    // 360° free-rotate: drag empty canvas to spin the whole view
    if (WB.rotate360 && !e.target.closest('[data-node]') && !e.target.closest('[data-pipe]')) {
      viewRot = { x: e.clientX, start: WB.viewRotate || 0 }; return;
    }
    if (spaceDown || WB.mode === 'pan' || e.button === 1) {
      panning = { x: e.clientX, y: e.clientY, px: WB.panX, py: WB.panY };
      if (svg) svg.style.cursor = 'grabbing';
      return;
    }
    var g = e.target.closest('[data-node]');
    if (g && WB.mode === 'select') {
      var n = nodeById(g.getAttribute('data-node'));
      if (!n) return;
      var w0 = clientToWorld(e.clientX, e.clientY);
      if (e.shiftKey) {
        // Shift+click a node: add/remove it from the group instead of
        // replacing the single selection — build the group up one at a
        // time as an alternative to dragging a marquee over it.
        WB.sel = null;
        var gi = WB.selMulti.indexOf(n.id);
        if (gi === -1) WB.selMulti.push(n.id); else WB.selMulti.splice(gi, 1);
        renderProps(); render(); return;
      }
      if (WB.selMulti.length > 1 && WB.selMulti.indexOf(n.id) !== -1) {
        // Pressing on a member of an existing multi-selection moves the
        // whole group together, not just the one node under the cursor.
        pushUndo();
        dragGroup = { start: w0, moved: false, nodes: WB.selMulti.map(function (id) {
          var gn = nodeById(id); return gn ? { id: id, x0: gn.x, y0: gn.y } : null;
        }).filter(Boolean) };
        return;
      }
      // Plain click on a node outside any active group — the usual single
      // selection/drag, and it drops out of group mode.
      WB.selMulti = [];
      /* the state as it stands BEFORE the drag, banked so the first movement
         can record it — taking it after the node has moved would store the
         moved position and undo would do nothing */
      WB.sel = { kind: 'node', id: n.id };
      drag = { id: n.id, dx: w0.x - n.x, dy: w0.y - n.y, moved: false, before: snapshot() };
      renderProps(); render();
      return;
    }
    // Empty canvas in Select mode: start a marquee (rubber-band) drag —
    // released with real movement it selects every node inside the box,
    // released as a plain click it falls through to onClick's deselect.
    // The dedicated Marquee tool always starts one, even if the press
    // lands on a node/pipe, so it reliably drags a fresh rectangle instead
    // of picking up that one item.
    if (WB.mode === 'marquee' || (!g && WB.mode === 'select' && !e.target.closest('[data-pipe]'))) {
      var wp = clientToWorld(e.clientX, e.clientY);
      marqueeDown = wp;
      WB.marquee = { x0: wp.x, y0: wp.y, x1: wp.x, y1: wp.y };
      e.preventDefault();
    }
  }
  function onMove(e) {
    if (viewRot) { WB.viewRotate = (((viewRot.start + (e.clientX - viewRot.x) * 0.6) % 360) + 360) % 360; render(); return; }
    if (rotating) {
      var w = clientToWorld(e.clientX, e.clientY);
      var ang = Math.atan2(w.y - rotating.cy, w.x - rotating.cx) * 180 / Math.PI + 90;
      ang = Math.round(ang / 15) * 15;   // snap to 15°
      var n = nodeById(rotating.id); if (n) { n.rot = ((ang % 360) + 360) % 360; render(); renderProps(); }
      return;
    }
    if (connecting) { WB.rubberXY = clientToWorld(e.clientX, e.clientY); render(); return; }
    if (panning) { WB.panX = panning.px + (e.clientX - panning.x); WB.panY = panning.py + (e.clientY - panning.y); render(); return; }
    if (drag) { var w = clientToWorld(e.clientX, e.clientY); var n = nodeById(drag.id); if (n) {
      /* A single-node drag never recorded an undo step — only the group drag
         did. Move three items one at a time and the next UNDO popped whatever
         snapshot was last taken, somewhere before all three, which is why one
         press appeared to jump several steps back. The snapshot is taken on
         the FIRST movement rather than on mousedown, so simply clicking an
         item to select it still costs nothing. */
      if (!drag.moved) { drag.moved = true; pushUndoBefore(drag.before); }
      n.x = snapV(w.x - drag.dx); n.y = snapV(w.y - drag.dy); render(); } }
    if (dragGroup) {
      var wg = clientToWorld(e.clientX, e.clientY);
      var ddx = wg.x - dragGroup.start.x, ddy = wg.y - dragGroup.start.y;
      dragGroup.moved = true;
      dragGroup.nodes.forEach(function (rec) {
        var gn = nodeById(rec.id); if (!gn) return;
        gn.x = snapV(rec.x0 + ddx); gn.y = snapV(rec.y0 + ddy);
      });
      render();
      return;
    }
    if (marqueeDown) {
      var wm = clientToWorld(e.clientX, e.clientY);
      WB.marquee.x1 = wm.x; WB.marquee.y1 = wm.y;
      render();
    }
  }
  // Nearest port to a world point, within tolerance (px in world units)
  function nearestPort(wx, wy, tol) {
    var best = null, bd = tol * tol;
    WB.nodes.forEach(function (n) {
      LIB_INDEX[n.t].ports.forEach(function (pt, pi) {
        var pw = portWorld(n, pi);
        var d = (pw.x - wx) * (pw.x - wx) + (pw.y - wy) * (pw.y - wy);
        if (d < bd) { bd = d; best = { id: n.id, pi: pi }; }
      });
    });
    return best;
  }
  function onUp(e) {
    if (viewRot) { viewRot = null; return; }
    if (rotating) { rotating = null; return; }
    if (connecting) {
      var to = null;
      var portEl = e.target ? (e.target.closest && e.target.closest('[data-port]')) : null;
      if (portEl) to = portRef(portEl);
      if (!to) { var w = clientToWorld(e.clientX, e.clientY); to = nearestPort(w.x, w.y, 16 / WB.zoom); }
      if (to && WB.pendingPort && (to.id !== WB.pendingPort.id || to.pi !== WB.pendingPort.pi)) {
        if (connectPorts(WB.pendingPort, to)) { WB.pendingPort = null; justConnected = true; setTimeout(function () { justConnected = false; }, 50); }
        WB.rubberXY = null; connecting = false; render(); renderProps(); drag = null; panning = null; return;
      }
      // released on same port / empty space
      if (WB.mode !== 'pipe') WB.pendingPort = null;   // Pipe mode keeps it pending for click-click
      WB.rubberXY = null; connecting = false; render();
    }
    if (dragGroup) { if (dragGroup.moved) sync3D(); dragGroup = null; }
    if (marqueeDown) {
      var box = WB.marquee;
      var moved = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) > (4 / WB.zoom);
      marqueeDown = null; WB.marquee = null;
      /* Only re-render (and only here) when the marquee actually did
         something — render() replaces gWorld's SVG children, and doing that
         between mouseup and the browser's own following click event orphans
         the element the click was about to bubble from, so a *plain* click
         on empty canvas would silently never reach onClick's deselect logic
         if this ran unconditionally on every release. */
      if (moved) {
        var mnx = Math.min(box.x0, box.x1), mxx = Math.max(box.x0, box.x1);
        var mny = Math.min(box.y0, box.y1), mxy = Math.max(box.y0, box.y1);
        var picked = [];
        WB.nodes.forEach(function (n) {
          var lib = LIB_INDEX[n.t]; if (!lib) return;
          var cx = n.x + lib.w / 2, cy = n.y + lib.h / 2;
          if (cx >= mnx && cx <= mxx && cy >= mny && cy <= mxy) picked.push(n.id);
        });
        WB.selMulti = picked; WB.sel = null;
        justMarqueed = true; setTimeout(function () { justMarqueed = false; }, 50);
        renderProps(); render();
      }
    }
    if (panning && svg) svg.style.cursor = WB.mode === 'pan' ? 'grab' : '';
    drag = null; panning = null;
  }

  function onClick(e) {
    var portEl = e.target.closest('[data-port]');
    // Click-click connect (any mode) is now fully handled by onDown/onUp:
    // the first click arms WB.pendingPort (onUp keeps it pending when the
    // press and release land on the same port), and the second click's
    // onDown sees a different port already pending and completes the
    // connection immediately. This handler used to duplicate that state
    // machine, but running both meant this block re-read pendingPort
    // *after* onUp had already resolved it and cleared it right back to
    // null on the very first click — click-click never actually connected
    // anything. Ports are now a no-op here; only fall through below.
    if (portEl) return;
    var pipeEl = e.target.closest('[data-pipe]');
    if (pipeEl && WB.mode === 'select') { WB.selMulti = []; WB.sel = { kind: 'pipe', id: pipeEl.getAttribute('data-pipe') }; renderProps(); render(); return; }
    // A plain click that just finished a marquee drag would otherwise clear
    // the selection it made a moment earlier — justMarqueed skips that.
    if (!e.target.closest('[data-node]') && !pipeEl && !portEl && !justMarqueed) { WB.sel = null; WB.selMulti = []; renderProps(); render(); }
  }

  /* ───────────── Init on first tab activation ───────────── */
  function injectCSS() {
    if (document.getElementById('wb-styles')) return;
    var css = document.createElement('style'); css.id = 'wb-styles';
    css.textContent = WB_CSS;
    document.head.appendChild(css);
  }
  WB.init = function () {
    if (WB.initialized) { render(); return; }
    injectCSS();
    var root = document.getElementById('wb-root'); if (!root) return;
    buildUI(root); WB.initialized = true;
  };

  var WB_CSS = [
    '#wb-root{width:100%;}',
    '.wb-shell{display:flex;flex-direction:column;height:calc(100vh - 190px);min-height:620px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;color:#1e293b;font-family:Arial,sans-serif;}',
    '.wb-menubar{display:flex;align-items:center;gap:4px;background:#0f172a;padding:6px 10px;}',
    '.wb-brand{color:#ff7538;font-family:monospace;font-weight:800;font-size:13px;letter-spacing:0.06em;margin-right:14px;}',
    '.wb-menu{position:relative;}',
    '.wb-menu>button{background:transparent;border:none;color:#cbd5e1;font-size:12px;padding:5px 10px;cursor:pointer;border-radius:4px;font-family:monospace;}',
    '.wb-menu>button:hover{background:rgba(255,255,255,0.1);color:#fff;}',
    '.wb-drop{display:none;position:absolute;top:100%;left:0;background:#1e293b;border:1px solid #334155;border-radius:6px;min-width:230px;z-index:50;box-shadow:0 8px 24px rgba(0,0,0,0.4);padding:4px;}',
    '.wb-menu:hover .wb-drop{display:block;}',
    '.wb-drop a{display:block;color:#cbd5e1;font-size:12px;padding:7px 10px;cursor:pointer;border-radius:4px;text-decoration:none;}',
    '.wb-drop a:hover{background:#ff7538;color:#fff;}',
    '.wb-menu-spacer{flex:1;}',
    '.wb-count{color:#64748b;font-family:monospace;font-size:11px;}',
    /* The menubar (and its Project/Import/Flowsheets/Generate dropdowns)
       was the one part of the workbench that never checked the app's
       day/night toggle at all — always the same dark bar with light text,
       so it read as "still in dark mode" the moment the rest of the page
       switched to light. Everything else in this module (toolbar, canvas,
       palette) is deliberately fixed-light regardless of the toggle — see
       the 3D scene background comment further down for why — but the
       menubar has no such reason to stay dark under a light theme, so it
       follows the toggle like the rest of the app does. */
    'body.theme-day .wb-menubar{background:#fff;border-bottom:1px solid #dfe5ea;}',
    'body.theme-day .wb-menu>button{color:#334155;}',
    'body.theme-day .wb-menu>button:hover{background:rgba(15,23,42,0.06);color:#0f172a;}',
    'body.theme-day .wb-drop{background:#fff;border-color:#dfe5ea;box-shadow:0 8px 24px rgba(15,23,42,0.12);}',
    'body.theme-day .wb-drop a{color:#334155;}',
    'body.theme-day .wb-count{color:#94a3b8;}',
    /* CommandManager/ribbon-style toolbar: buttons cluster into labelled
       groups (SELECT, EDIT, ZOOM, VIEW …) the way a CAD package's toolbar
       reads, instead of one undifferentiated row of bare glyphs. */
    '.wb-toolbar{display:flex;align-items:stretch;gap:0;background:#eef2f6;border-bottom:1px solid #cbd5e1;padding:4px 8px;flex-wrap:wrap;}',
    '.wb-tgroup{display:flex;flex-direction:column;align-items:center;gap:3px;padding:1px 8px;border-right:1px solid #d8dfe6;justify-content:center;}',
    '.wb-tgroup:last-child,.wb-tgroup:last-of-type{border-right:none;}',
    '.wb-tgroup-row{display:flex;gap:3px;}',
    '.wb-tgroup-lbl{font-size:7.5px;letter-spacing:0.09em;color:#94a3b8;font-weight:800;text-transform:uppercase;font-family:var(--font-mono,monospace);white-space:nowrap;}',
    '.wb-tool{width:27px;height:26px;border:1px solid #cbd5e1;background:#fff;border-radius:5px;cursor:pointer;color:#334155;display:inline-flex;align-items:center;justify-content:center;}',
    '.wb-tool.wb-vtxt{width:auto;padding:0 8px;font-size:10.5px;font-weight:700;font-family:var(--font-mono,monospace);gap:4px;letter-spacing:0.02em;}',
    '.wb-tool:hover{background:#fff;border-color:#94a3b8;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,0.08);}',
    '.wb-tool.active{background:#ff7538;color:#fff;border-color:#ea580c;}',
    '.wb-view.active{background:#1e3a5f;color:#fff;border-color:#0f172a;}',
    /* One accent per state instead of three permanently-tinted buttons —
       reads as an actual segmented mode switch rather than three unrelated
       coloured pills that all looked "on" regardless of which was active. */
    '.wb-seg{display:flex;border:1px solid #cbd5e1;border-radius:5px;overflow:hidden;height:26px;}',
    '.wb-seg-btn{border:none;border-right:1px solid #cbd5e1;background:#fff;color:#334155;font-size:10.5px;font-weight:800;font-family:var(--font-mono,monospace);padding:0 11px;cursor:pointer;letter-spacing:0.03em;}',
    '.wb-seg-btn:last-child{border-right:none;}',
    '.wb-seg-btn:hover{background:#f8fafc;}',
    '.wb-seg-btn.active{background:#0f172a;color:#fff;}',
    '.wb-scalebar{position:absolute;left:10px;bottom:38px;display:flex;align-items:center;gap:8px;font-family:monospace;font-size:10px;color:#334155;pointer-events:none;}',
    '.wb-scalebar-line{position:relative;width:60px;height:8px;border:1.5px solid currentColor;border-top:none;}',
    '.wb-scalebar-line span{position:absolute;top:-14px;left:0;white-space:nowrap;}',
    '.wb-scale-zoom{font-weight:700;background:rgba(148,163,184,0.2);padding:1px 5px;border-radius:3px;}',
    '.wb-triad{position:absolute;right:8px;bottom:36px;cursor:grab;z-index:6;}',
    '.wb-triad:active{cursor:grabbing;}',
    '.wb-tool.wb-toggle.on{background:#0d9488;color:#fff;border-color:#0f766e;}',
    '.wb-tsep{width:1px;height:22px;background:#cbd5e1;margin:0 4px;}',
    '.wb-run{margin-left:auto;align-self:center;background:linear-gradient(135deg,#166534,#22c55e);color:#fff;border:none;padding:7px 16px;border-radius:5px;font-weight:700;font-size:12px;cursor:pointer;font-family:monospace;letter-spacing:0.04em;}',
    '@keyframes wb-run-pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.75);}50%{box-shadow:0 0 0 9px rgba(34,197,94,0);}}',
    '.wb-run.wb-pulse{animation:wb-run-pulse 0.55s ease-out 3;}',
    '.wb-vizlegend{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:6px 12px;background:#eef2f7;border-top:1px solid #e2e8f0;font-family:var(--font-mono,monospace);font-size:10.5px;color:#334155;}',
    '.wb-vizlegend h4{margin:0;font-size:9.5px;letter-spacing:0.06em;color:#64748b;font-weight:700;text-transform:uppercase;flex:none;}',
    '.wb-vizlegend .wb-vizrow{display:flex;align-items:center;gap:6px;color:#334155;flex:none;}',
    '.wb-vizlegend .wb-vizswatch{width:11px;height:11px;border-radius:3px;flex:none;box-shadow:inset 0 0 0 1px rgba(15,23,42,0.15);}',
    '.wb-vizlegend .wb-vizgrad{display:flex;align-items:center;gap:6px;flex:none;}',
    '.wb-vizlegend .wb-vizgradbar{width:130px;height:10px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(15,23,42,0.15);flex:none;}',
    '.wb-vizlegend .wb-vizgradscale{display:flex;gap:6px;font-size:10px;color:#334155;font-variant-numeric:tabular-nums;white-space:nowrap;}',
    '.wb-vizlegend .wb-vizgradunit{font-size:9.5px;color:#94a3b8;}',
    '.wb-vizlegend .wb-viznote{color:#64748b;font-size:9.5px;line-height:1.3;flex:1 1 220px;min-width:160px;}',
    '.wb-flowctrl{display:flex;align-items:center;gap:6px;flex:none;}',
    '.wb-flowctrl button{background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:4px;padding:3px 9px;font-size:10px;cursor:pointer;font-family:inherit;}',
    '.wb-flowctrl button:hover{background:#e2e8f0;}',
    '.wb-flowctrl input[type=range]{width:64px;accent-color:#16a34a;}',
    '.wb-flowctrl .wb-flowspeed{font-size:9.5px;color:#64748b;min-width:26px;}',
    '.wb-body{flex:1;display:grid;grid-template-columns:var(--wb-pal,212px) 7px 1fr 252px;min-height:0;}',
    '.wb-resizer{cursor:col-resize;background:#cbd5e1;border-left:1px solid #94a3b8;border-right:1px solid #94a3b8;transition:background .12s;}',
    '.wb-resizer:hover,.wb-resizer.dragging{background:#ff7538;}',
    '.wb-palette{background:#f8fafc;border-right:1px solid #cbd5e1;overflow-y:auto;padding:6px;}',
    '.wb-pal-search{position:sticky;top:0;z-index:2;background:#f8fafc;padding:0 0 6px;margin:-6px -6px 0;padding-top:6px;padding-left:6px;padding-right:6px;}',
    '.wb-pal-search input{width:100%;box-sizing:border-box;padding:6px 9px;font-size:11px;font-family:var(--font-mono,monospace);border:1px solid #cbd5e1;border-radius:5px;background:#fff;color:#334155;}',
    '.wb-pal-search input:focus{outline:none;border-color:#ff7538;box-shadow:0 0 0 2px rgba(255,117,56,0.15);}',
    '.wb-pal-search input::placeholder{color:#94a3b8;}',
    '.wb-cat{font-size:10px;font-weight:800;color:#ea580c;letter-spacing:0.05em;text-transform:uppercase;margin:10px 4px 4px;}',
    '.wb-cat-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:5px;}',
    '.wb-lib{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 3px;text-align:center;cursor:grab;display:flex;flex-direction:column;align-items:center;gap:2px;}',
    '.wb-lib:hover{border-color:#ff7538;box-shadow:0 2px 6px rgba(0,0,0,0.08);}',
    '.wb-lib svg{width:100%;height:38px;}',
    '.wb-lib span{font-size:8.5px;color:#475569;line-height:1.1;}',
    '.wb-canvas-wrap{position:relative;overflow:hidden;background:#fff;}',
    '.wb-canvas{width:100%;height:100%;display:block;}',
    '.wb-hint{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.82);color:#e2e8f0;font-size:10px;padding:4px 12px;border-radius:20px;pointer-events:none;white-space:nowrap;max-width:96%;overflow:hidden;text-overflow:ellipsis;}',
    '.wb-props{background:#f8fafc;border-left:1px solid #cbd5e1;overflow-y:auto;}',
    '.wb-props-head{font-size:10px;font-weight:800;color:#334155;letter-spacing:0.08em;padding:10px;border-bottom:1px solid #e2e8f0;background:#eef2f7;}',
    '#wb-prop-body{padding:10px;}',
    '.wb-prop-empty{font-size:11px;color:#94a3b8;line-height:1.5;}',
    '.wb-prop-title{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;}',
    '.wb-prop-note{font-size:10px;color:#94a3b8;margin-top:8px;line-height:1.4;}',
    '.wb-xform{background:#eef2f7;border:1px solid #dbe3ec;border-radius:6px;padding:7px 8px;margin-bottom:10px;}',
    '.wb-xform-h{font-size:9px;font-weight:800;color:#ea580c;letter-spacing:0.05em;margin-bottom:5px;}',
    '.wb-xform-row{display:flex;align-items:center;gap:4px;}',
    '.wb-xbtn{width:26px;height:26px;border:1px solid #cbd5e1;background:#fff;border-radius:5px;cursor:pointer;font-size:13px;color:#334155;display:inline-flex;align-items:center;justify-content:center;}',
    '.wb-xbtn:hover{background:#ff7538;color:#fff;border-color:#ea580c;}',
    '.wb-xval{margin-left:auto;font-family:monospace;font-size:10px;color:#475569;}',
    '.wb-swrow{display:flex;flex-wrap:wrap;gap:5px;}',
    '.wb-swatch{width:22px;height:22px;border-radius:5px;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1;cursor:pointer;padding:0;}',
    '.wb-swatch:hover{transform:scale(1.12);}',
    '.wb-swatch.on{box-shadow:0 0 0 2px #ea580c;}',
    '.wb-mini{font-size:10px;font-weight:700;padding:4px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:5px;cursor:pointer;color:#334155;}',
    '.wb-mini:hover{background:#ff7538;color:#fff;border-color:#ea580c;}',
    '.wb-fs-intro{font-size:11.5px;color:#475569;line-height:1.5;margin-bottom:12px;}',
    '.wb-fs-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}',
    '.wb-fs-sec-h{font-size:10px;font-weight:800;color:#ea580c;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #e2e8f0;padding-bottom:3px;}',
    '.wb-fs-item{display:block;font-size:11.5px;color:#1e40af;padding:4px 6px;border-radius:4px;cursor:pointer;text-decoration:none;}',
    '.wb-fs-item:hover{background:#eff6ff;}',
    '.wb-fs-item span{color:#94a3b8;font-size:9.5px;}',
    '.wb-streams{margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px;}',
    '.wb-streams-h{font-size:9px;font-weight:800;color:#334155;letter-spacing:0.06em;margin-bottom:5px;}',
    '.wb-stream-row{display:flex;align-items:center;gap:6px;font-size:10px;padding:3px 0;color:#475569;}',
    '.wb-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;border:1px solid #fff;box-shadow:0 0 0 1px #cbd5e1;}',
    '.wb-stream-name{flex:1;color:#0f172a;font-weight:600;}',
    '.wb-stream-role{font-family:monospace;font-weight:700;font-size:9px;}',
    '.wb-stream-conn{font-family:monospace;font-size:9px;color:#64748b;min-width:52px;text-align:right;}',
    '.wb-stream-conn i{color:#94a3b8;}',
    '.wb-legend{display:flex;flex-wrap:wrap;gap:8px;padding:6px 10px;background:#eef2f7;border-top:1px solid #e2e8f0;font-size:9px;}',
    '.wb-legend span{display:inline-flex;align-items:center;gap:3px;color:#475569;}',
    '.wb-legend i{width:9px;height:9px;border-radius:50%;display:inline-block;}',
    '.wb-field{display:flex;flex-direction:column;gap:2px;margin-bottom:8px;}',
    '.wb-field span{font-size:10px;font-weight:600;color:#475569;}',
    '.wb-field input,.wb-field select{border:1px solid #cbd5e1;border-radius:4px;padding:5px 7px;font-size:12px;color:#0f172a;background:#fff;}',
    '.wb-field input:focus,.wb-field select:focus{outline:none;border-color:#ff7538;}',
    /* The app-wide dark theme carries
         body:not(.light-theme) input[type="text"]{background:var(--bg-input)}
       which out-specifies ".wb-field input" and repainted these boxes almost
       black while the workbench's own dark text colour still applied —
       black-on-black, so typed values were invisible. The properties panel is
       a light surface, so pin its fields to a light, legible pairing at ID
       specificity, which no class-level theme rule can override. */
    '#wb-prop-body input,#wb-prop-body select,#wb-prop-body textarea{background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:4px;padding:5px 7px;font-size:12px;-webkit-text-fill-color:#0f172a;opacity:1;}',
    '#wb-prop-body input::placeholder{color:#94a3b8;-webkit-text-fill-color:#94a3b8;}',
    '#wb-prop-body input:focus,#wb-prop-body select:focus{outline:none;border-color:#ff7538;background:#ffffff;color:#0f172a;}',
    '.wb-prop-result{margin-top:8px;border-top:1px dashed #cbd5e1;padding-top:6px;}',
    '.wb-rrow{display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:#475569;}',
    '.wb-rrow b{color:#0f172a;font-family:monospace;}',
    '.wb-rrow.warn b{color:#dc2626;}',
    '.wb-statusbar{background:#0f172a;color:#94a3b8;font-family:monospace;font-size:11px;padding:6px 12px;border-top:1px solid #1e293b;}',
    'body.theme-day .wb-statusbar{background:#fff;color:#64748b;border-top:1px solid #dfe5ea;}',
    '.wb-modal{position:fixed;inset:0;background:rgba(2,6,18,0.75);z-index:100002;display:flex;align-items:center;justify-content:center;padding:20px;}',
    '.wb-modal-box{background:#fff;border-radius:10px;width:96%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;}',
    '.wb-modal-head{display:flex;justify-content:space-between;align-items:center;background:#0f172a;color:#ff7538;padding:12px 16px;font-weight:800;font-size:14px;font-family:monospace;}',
    'body.theme-day .wb-modal-head{background:#fff;color:#ea580c;border-bottom:1px solid #dfe5ea;}',
    '.wb-modal-x{background:transparent;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;}',
    'body.theme-day .wb-modal-x{color:#64748b;}',
    '.wb-modal-body{padding:16px;overflow-y:auto;}',
    '.wb-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e2e8f0;}',
    '.wb-btn{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;padding:8px 18px;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer;}',
    '.wb-btn-mut{background:#64748b;}',
    /* staged import review */
    '.wb-imp-prev{border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;padding:6px;text-align:center;max-height:340px;overflow:auto;}',
    '.wb-imp-prev img{max-width:100%;max-height:320px;object-fit:contain;}',
    '.wb-imp-meta{margin-top:10px;font-size:12px;color:#334155;}',
    '.wb-imp-ok{margin-top:8px;padding:8px 10px;border-radius:5px;font-size:12px;background:#dcfce7;border:1px solid #16a34a;color:#14532d;}',
    '.wb-imp-warn{margin-top:8px;padding:8px 10px;border-radius:5px;font-size:12px;background:#fef3c7;border:1px solid #f59e0b;color:#78350f;}',
    '.wb-imp-note{margin-top:8px;font-size:11px;line-height:1.5;color:#475569;background:#f1f5f9;border-left:3px solid #94a3b8;padding:8px 10px;border-radius:0 5px 5px 0;}',
    '.wb-imp-btns{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:14px;}',
    '.wb-imp-prog{width:100%;display:flex;flex-direction:column;gap:6px;}',
    '.wb-imp-prog span{font-size:11.5px;color:#475569;font-family:var(--font-mono,monospace);}',
    '.wb-imp-prog-bar{height:6px;border-radius:3px;background:#e2e8f0;overflow:hidden;}',
    '.wb-imp-prog-bar i{display:block;height:100%;width:2%;border-radius:3px;'
      + 'background:linear-gradient(90deg,#ff8a52,#ef6a2c);transition:width .25s;}',
    '.wb-table{width:100%;border-collapse:collapse;margin:4px 0 10px;}',
    '.wb-table th,.wb-table td{border:1px solid #e2e8f0;padding:5px 8px;font-size:11.5px;text-align:left;color:#1e293b;}',
    '.wb-table th{background:#eef2f7;font-weight:700;}',
    '.wb-rep-head{font-size:16px;font-weight:800;color:#ea580c;text-align:center;}',
    '.wb-rep-sub{font-size:10px;color:#64748b;text-align:center;margin-bottom:10px;}',
    '.wb-rep-verdict{border:1.5px solid;border-radius:6px;padding:8px 12px;font-size:12px;font-weight:700;text-align:center;margin-bottom:12px;}',
    '.wb-rep-titleblock td{font-size:10px;color:#334155;vertical-align:top;}',
    '.wb-rep-titleblock td b{display:block;font-size:8.5px;letter-spacing:0.05em;color:#64748b;margin-bottom:2px;}',
    '.wb-rep-legend{display:flex;flex-wrap:wrap;gap:6px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:8px;}',
    '.wb-rep-legend-row{display:flex;align-items:center;gap:6px;font-size:10.5px;color:#334155;}',
    /* A4 landscape drawing sheet — ruled border, grid references and title
       block, so every captured view prints as a real engineering drawing. */
    '.wb-a4{background:#fff;border:2px solid #0f172a;margin:10px 0 16px;padding:0;page-break-inside:avoid;break-inside:avoid;}',
    '.wb-a4-top{display:flex;border-bottom:1px solid #0f172a;}',
    '.wb-a4-c{flex:1;text-align:center;font-size:9px;font-weight:700;color:#0f172a;padding:2px 0;border-right:1px solid #cbd5e1;font-family:Arial,sans-serif;}',
    '.wb-a4-c:last-child{border-right:none;}',
    '.wb-a4-mid{display:flex;align-items:stretch;}',
    '.wb-a4-side{display:flex;flex-direction:column;width:18px;flex:0 0 18px;}',
    '.wb-a4-r{flex:1;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#0f172a;border-bottom:1px solid #cbd5e1;font-family:Arial,sans-serif;}',
    '.wb-a4-r:last-child{border-bottom:none;}',
    '.wb-a4-field{flex:1;min-width:0;position:relative;padding:20px 8px 8px;border-left:1px solid #0f172a;border-right:1px solid #0f172a;background:#fff;}',
    '.wb-a4-field.dark{background:#0b1220;}',
    '.wb-a4-field img{display:block;margin:0 auto;max-width:100%;height:auto;}',
    '.wb-a4-title{position:absolute;top:3px;left:0;right:0;text-align:center;font-size:10px;font-weight:800;letter-spacing:0.06em;color:#0f172a;font-family:Arial,sans-serif;}',
    '.wb-a4-field.dark .wb-a4-title{color:#e2e8f0;}',
    '.wb-a4-tb{width:100%;border-collapse:collapse;border-top:1px solid #0f172a;table-layout:fixed;}',
    '.wb-a4-tb td{border:1px solid #0f172a;padding:3px 6px;font-size:9px;color:#0f172a;text-align:center;font-family:Arial,sans-serif;vertical-align:top;}',
    '.wb-a4-tb td.l{text-align:left;}',
    '.wb-a4-tb td b{display:block;font-size:7.5px;letter-spacing:0.05em;color:#64748b;margin-bottom:1px;font-weight:700;}',
    '.wb-rep-cc-table{margin-bottom:8px;}',
    '.wb-rep-cc-table td{font-size:10.5px;border:none;background:#f8fafc;padding:3px 10px;}',
    '.wb-modal-body h4{margin:14px 0 6px;font-size:12px;color:#334155;}',
    '.wb-analysis td,.wb-analysis th{font-size:10.5px;padding:5px 6px;vertical-align:top;}',
    '.wb-analysis th{white-space:nowrap;}',
    '.wb-std{margin-top:12px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10.5px;color:#475569;line-height:1.6;}',
    '.wb-std span{display:inline-block;background:#1e3a5f;color:#fff;font-weight:700;font-size:9.5px;padding:1px 6px;border-radius:3px;margin:0 1px;}',
    '@media (max-width:1100px){.wb-body{grid-template-columns:var(--wb-pal,172px) 7px 1fr 212px;}}'
  ].join('');

  // Hook tab activation
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.nav-tab[data-tab="workbench-tab"]');
    if (btn) btn.addEventListener('click', function () { setTimeout(WB.init, 30); });
    // also if it's already active
    if (document.getElementById('workbench-tab') && document.getElementById('workbench-tab').classList.contains('active')) setTimeout(WB.init, 60);
  });
})();

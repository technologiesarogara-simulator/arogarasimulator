/* ══════════════════════════════════════════════════════════════════════
   ARO WORKBENCH — CAD-like Process Flow / P&ID editor (MVP)
   Self-contained module. Namespaced under window.AROWB.
   Build-your-own drawing engine (SVG): drag-drop equipment library,
   intelligent orthogonal pipe connections, property editor, snap grid,
   zoom/pan, line-sizing + pressure-drop calc, BOM + report generation.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var WB = window.AROWB = { nodes: [], pipes: [], seq: 0, sel: null, mode: 'select',
    snap: true, ortho: true, grid: 20, zoom: 1, panX: 0, panY: 0,
    pendingPort: null, undoStack: [], redoStack: [], initialized: false, backdrop: null,
    gridOn: true, bgColor: '#ffffff', viewRotate: 0, bgIdx: 0 };
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
      { t: 'pump', n: 'Centrifugal Pump', w: 68, h: 54, ports: [P(0, 32, 'w', 'in', 'Suction'), P(20, 4, 'n', 'out', 'Discharge')],
        draw: function () { return k3dBase(38, 50, 58)
          + k3dMotor(30, 20, 34, 26)
          + '<circle cx="18" cy="32" r="16" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.6"/><ellipse cx="13" cy="26" rx="6" ry="3.5" fill="#fff" opacity="0.35"/>'
          + '<circle cx="18" cy="32" r="7.5" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1.2"/><circle cx="18" cy="32" r="3" fill="#7c2d12"/>'
          + '<path d="M4 30 h6 v6 h-8 Z" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1"/>'
          + '<rect x="14" y="4" width="10" height="12" rx="2" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1"/>'; } },
      { t: 'pump-ms', n: 'Multistage Pump', w: 84, h: 50, ports: [P(0, 32, 'w', 'in', 'Suction'), P(84, 32, 'e', 'out', 'Discharge')],
        draw: function () { return k3dBase(42, 48, 68)
          + k3dMotor(6, 18, 26, 28)
          + '<rect x="30" y="22" width="48" height="22" rx="11" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.4"/><rect x="32" y="24" width="44" height="6" rx="3" fill="#fff" opacity="0.28"/>'
          + '<g stroke="#f97316" stroke-width="2.5">' + (function(){var s='';for(var i=0;i<6;i++){var x=38+i*7;s+='<line x1="'+x+'" y1="24" x2="'+x+'" y2="42"/>';}return s;})() + '</g>'
          + '<circle cx="80" cy="33" r="5" fill="url(#wbOrange)" stroke="#9a3412"/>'; } },
      { t: 'pd-pump', n: 'PD / Gear Pump', w: 62, h: 52, ports: [P(0, 40, 'w', 'in', 'Inlet'), P(62, 40, 'e', 'out', 'Outlet')],
        draw: function () { return k3dBase(31, 48, 46)
          + '<circle cx="31" cy="26" r="20" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1.6"/><ellipse cx="24" cy="19" rx="7" ry="4" fill="#fff" opacity="0.35"/>'
          + '<circle cx="24" cy="26" r="8.5" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1.2"/><circle cx="38" cy="26" r="8.5" fill="url(#wbOrange)" stroke="#9a3412" stroke-width="1.2"/>'
          + '<g stroke="#7c2d12" stroke-width="1"><path d="M24 17 v18 M38 17 v18 M15 26 h18 M29 26 h18"/></g>'
          + '<path d="M2 36 h8 v8 h-10 Z" fill="url(#wbPumpBlue)" stroke="#1e3a8a" stroke-width="1"/>'; } },
      { t: 'compressor', n: 'Compressor', w: 68, h: 56, ports: [P(0, 44, 'w', 'in', 'Suction'), P(68, 24, 'e', 'out', 'Discharge')],
        draw: function () { return k3dBase(34, 52, 54) + '<path d="M10 46 L10 16 L58 24 L58 46 Z" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="1.6"/><path d="M10 16 L16 12 L62 20 L58 24 Z" fill="#7dd3fc" opacity="0.7" stroke="#0369a1" stroke-width="1"/><ellipse cx="26" cy="30" rx="8" ry="5" fill="#fff" opacity="0.28"/><text x="33" y="40" font-size="12" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">C</text>'; } },
      { t: 'blower', n: 'Blower / Fan', w: 58, h: 54, ports: [P(0, 42, 'w', 'in', 'Inlet'), P(58, 42, 'e', 'out', 'Outlet')],
        draw: function () { return k3dBase(29, 50, 46) + '<circle cx="29" cy="28" r="20" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="1.6"/><ellipse cx="22" cy="21" rx="7" ry="4" fill="#fff" opacity="0.35"/>' + (function(){var s='';for(var i=0;i<7;i++){var a=i*Math.PI*2/7;s+='<line x1="29" y1="28" x2="'+(29+15*Math.cos(a))+'" y2="'+(28+15*Math.sin(a))+'" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';}return s;})() + '<circle cx="29" cy="28" r="4.5" fill="#0369a1"/>'; } },
      { t: 'sthe', n: 'Shell & Tube HX', w: 96, h: 50, ports: [P(0, 25, 'w', 'cold-in', 'Tube In'), P(96, 25, 'e', 'cold-out', 'Tube Out'), P(24, 0, 'n', 'hot-in', 'Shell In'), P(72, 50, 's', 'hot-out', 'Shell Out')],
        draw: function () { return '<path d="M8 46 l6 -5 m18 5 l6 -5 m18 5 l6 -5 m18 5 l6 -5" stroke="#64748b" stroke-width="2.5"/>' + k3dHCyl(8, 10, 80, 30, 'url(#wbSteelH)', '#334155') + '<rect x="8" y="10" width="9" height="30" rx="3" fill="#cbd5e1" stroke="#334155" stroke-width="1"/><g stroke="#94a3b8" stroke-width="1"><line x1="20" y1="18" x2="80" y2="18"/><line x1="20" y1="25" x2="80" y2="25"/><line x1="20" y1="32" x2="80" y2="32"/></g>'; } },
      { t: 'dphe', n: 'Double Pipe HX', w: 92, h: 38, ports: [P(0, 19, 'w', 'cold-in', 'Inner In'), P(92, 19, 'e', 'cold-out', 'Inner Out'), P(16, 0, 'n', 'hot-in', 'Annulus In'), P(76, 38, 's', 'hot-out', 'Annulus Out')],
        draw: function () { return k3dHCyl(6, 8, 80, 22, 'url(#wbSteelH)', '#334155') + '<line x1="10" y1="19" x2="82" y2="19" stroke="#64748b" stroke-width="3"/><path d="M16 8 v22 M76 8 v22" stroke="#cbd5e1" stroke-width="1.2"/>'; } },
      { t: 'phe', n: 'Plate HX', w: 54, h: 58, ports: [P(0, 14, 'w', 'hot-in', 'Hot In'), P(54, 44, 'e', 'hot-out', 'Hot Out'), P(0, 44, 'w', 'cold-in', 'Cold In'), P(54, 14, 'e', 'cold-out', 'Cold Out')],
        draw: function () { return k3dBox(12, 8, 30, 44, 6, 'url(#wbSteelH)', '#334155') + '<g stroke="#0369a1" stroke-width="1.3">' + (function(){var s='';for(var i=1;i<7;i++){s+='<line x1="'+(12+i*4.3)+'" y1="10" x2="'+(12+i*4.3)+'" y2="50"/>';}return s;})() + '</g><rect x="8" y="6" width="4" height="48" fill="#334155"/>'; } },
      { t: 'aircooler', n: 'Air Cooler', w: 82, h: 50, ports: [P(0, 36, 'w', 'in', 'Inlet'), P(82, 36, 'e', 'out', 'Outlet')],
        draw: function () { return k3dBase(41, 46, 66) + k3dBox(10, 22, 62, 18, 5, 'url(#wbSteelH)', '#334155') + '<circle cx="28" cy="12" r="9" fill="url(#wbGrey3)" stroke="#0369a1" stroke-width="1.4"/><circle cx="54" cy="12" r="9" fill="url(#wbGrey3)" stroke="#0369a1" stroke-width="1.4"/>' + (function(){var s='';[28,54].forEach(function(cx){for(var i=0;i<5;i++){var a=i*Math.PI*2/5;s+='<line x1="'+cx+'" y1="12" x2="'+(cx+7*Math.cos(a))+'" y2="'+(12+7*Math.sin(a))+'" stroke="#0369a1" stroke-width="1.4"/>';}});return s;})(); } },
      { t: 'reboiler', n: 'Reboiler', w: 82, h: 48, ports: [P(0, 24, 'w', 'in', 'Liquid In'), P(82, 24, 'e', 'liq', 'Liquid Out'), P(41, 0, 'n', 'vap', 'Vapor Out'), P(20, 48, 's', 'hot-in', 'Steam In')],
        draw: function () { return k3dHCyl(6, 10, 68, 30, 'url(#wbCopper)', '#7c2d12') + '<path d="M14 26 q6 -8 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.5"/><g stroke="#7c2d12" stroke-width="1.4"><line x1="16" y1="34" x2="20" y2="40"/><line x1="30" y1="34" x2="34" y2="40"/><line x1="44" y1="34" x2="48" y2="40"/></g>'; } }
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
        draw: function () { return k3dVCyl(12, 8, 38, 40, 'url(#wbSteel)', '#475569') + '<path d="M12 48 L31 70 L50 48 Z" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.6"/><path d="M12 48 L31 70 L34 68 L18 49 Z" fill="#fff" opacity="0.2"/>'; } }
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
        draw: function () { return '<rect x="12" y="8" width="30" height="62" fill="#fefce8" stroke="#a16207" stroke-width="2"/><path d="M12 8 q15 -6 30 0 M12 70 q15 6 30 0" fill="#fefce8" stroke="#a16207" stroke-width="2"/><g fill="#a16207">' + (function(){var s='';for(var i=0;i<21;i++){s+='<circle cx="'+(17+(i%3)*9)+'" cy="'+(20+Math.floor(i/3)*8)+'" r="2.2"/>';}return s;})() + '</g>'; } }
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
        draw: function () { return '<circle cx="27" cy="10" r="7" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.2"/><circle cx="25" cy="8" r="2" fill="#94a3b8"/>' + vkStem(27, 16, 32) + vkBonnet(27, 38, 7, 6) + vkBody(27, 46, 19, 'url(#wbGrey3)', '#334155') + '<path d="M27 38 L29.5 46 L27 46 Z" fill="#0f172a"/>' + vkFlange(2, 46, 24) + vkFlange(47, 46, 24); } }
    ],
    'Fittings': [
      { t: 'elbow90', n: '90° Elbow', w: 36, h: 36, ports: [P(0, 18, 'w', 'in', ''), P(18, 36, 's', 'out', '')],
        draw: function () { return '<path d="M0 12 h12 a12 12 0 0 1 12 12 v12" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round"/>'; } },
      { t: 'elbow45', n: '45° Elbow', w: 36, h: 36, ports: [P(0, 20, 'w', 'in', ''), P(32, 6, 'e', 'out', '')],
        draw: function () { return '<path d="M0 20 h13 L32 6" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round"/>'; } },
      { t: 'tee', n: 'Tee', w: 42, h: 32, ports: [P(0, 9, 'w', 'in', ''), P(42, 9, 'out', 'out', ''), P(21, 32, 's', 'out', '')],
        draw: function () { return '<path d="M2 9 h38 M21 9 v21" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round"/>'; } },
      { t: 'cross', n: 'Cross', w: 38, h: 38, ports: [P(0, 19, 'w', 'in', ''), P(38, 19, 'e', 'out', ''), P(19, 0, 'n', 'out', ''), P(19, 38, 's', 'out', '')],
        draw: function () { return '<path d="M2 19 h34 M19 2 v34" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round"/>'; } },
      { t: 'reducer', n: 'Reducer', w: 42, h: 30, ports: [P(0, 15, 'w', 'in', ''), P(42, 15, 'e', 'out', '')],
        draw: function () { return '<path d="M2 6 L2 24 L40 19 L40 11 Z" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'expander', n: 'Expander', w: 42, h: 30, ports: [P(0, 15, 'w', 'in', ''), P(42, 15, 'e', 'out', '')],
        draw: function () { return '<path d="M2 11 L2 19 L40 24 L40 6 Z" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'flange', n: 'Flange Pair', w: 26, h: 32, ports: [P(0, 16, 'w', 'in', ''), P(26, 16, 'e', 'out', '')],
        draw: function () { return '<rect x="7" y="4" width="4" height="24" fill="#334155"/><rect x="15" y="4" width="4" height="24" fill="#334155"/><line x1="0" y1="16" x2="26" y2="16" stroke="#64748b" stroke-width="3"/>'; } }
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
        draw: function () { return '<path d="M9 6 L19 6 L22 36 L6 36 Z" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.5"/><circle cx="14" cy="26" r="3" fill="#0369a1"/><line x1="10" y1="16" x2="18" y2="16" stroke="#0369a1"/>'; } }
    ],
    'Utilities & Mixers': [
      { t: 'cooltower', n: 'Cooling Tower', w: 66, h: 60, ports: [P(0, 46, 'w', 'in', 'Warm In'), P(66, 46, 'e', 'out', 'Cold Out')],
        draw: function () { return '<path d="M14 52 L10 22 L56 22 L52 52 Z" fill="#e0f2fe" stroke="#0369a1" stroke-width="2"/><path d="M10 22 q23 -13 46 0" fill="#bae6fd" stroke="#0369a1" stroke-width="2"/><path d="M20 30 q6 6 12 0 t14 2" fill="none" stroke="#0369a1" stroke-width="1"/>'; } },
      { t: 'boiler', n: 'Boiler', w: 62, h: 58, ports: [P(0, 40, 'w', 'in', 'BFW In'), P(31, 0, 'n', 'vap', 'Steam Out')],
        draw: function () { return '<rect x="10" y="12" width="42" height="42" rx="6" fill="#fee2e2" stroke="#b91c1c" stroke-width="2"/><path d="M18 46 q6 -11 12 0 t12 0" fill="none" stroke="#b91c1c" stroke-width="2"/><path d="M24 26 q4 -6 8 0 t8 0" fill="none" stroke="#b91c1c" stroke-width="1.5"/>'; } },
      { t: 'ejector', n: 'Steam Ejector', w: 58, h: 36, ports: [P(0, 18, 'w', 'in', 'Suction'), P(58, 18, 'e', 'out', 'Discharge'), P(28, 0, 'n', 'hot-in', 'Motive')],
        draw: function () { return '<path d="M2 11 L24 11 L33 18 L56 12 L56 24 L33 18 L24 25 L2 25 Z" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'mixer', n: 'Static Mixer', w: 62, h: 28, ports: [P(0, 14, 'w', 'in', 'In'), P(62, 14, 'e', 'out', 'Out')],
        draw: function () { return '<rect x="4" y="4" width="54" height="20" rx="10" fill="#f1f5f9" stroke="#475569" stroke-width="1.5"/><path d="M10 6 L22 22 M22 6 L34 22 M34 6 L46 22 M46 6 L54 22" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'agitator', n: 'Agitated Tank', w: 62, h: 68, ports: [P(31, 0, 'n', 'in', 'Feed'), P(0, 30, 'w', 'in', 'Add'), P(31, 68, 's', 'out', 'Product')],
        draw: function () { return '<rect x="10" y="14" width="42" height="46" rx="4" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M12 40 h38" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 2"/><line x1="31" y1="2" x2="31" y2="46" stroke="#475569" stroke-width="2.5"/><path d="M22 46 h18 M25 40 l12 0" stroke="#475569" stroke-width="2.5"/><rect x="26" y="0" width="10" height="6" fill="#475569"/>'; } }
    ],
    'Filters & Strainers': [
      { t: 'y-strainer', n: 'Y-Strainer', w: 46, h: 36, ports: [P(0, 12, 'w', 'in', 'In'), P(46, 12, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="12" x2="44" y2="12" stroke="url(#wbGrey3)" stroke-width="7"/><path d="M22 12 L34 30" stroke="url(#wbSteel)" stroke-width="8" stroke-linecap="round"/><rect x="31" y="28" width="8" height="6" fill="#475569"/><ellipse cx="14" cy="10" rx="8" ry="1.5" fill="#fff" opacity="0.5"/>'; } },
      { t: 't-strainer', n: 'T-Strainer', w: 44, h: 40, ports: [P(0, 14, 'w', 'in', 'In'), P(44, 14, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="14" x2="42" y2="14" stroke="url(#wbGrey3)" stroke-width="7"/><rect x="18" y="14" width="10" height="22" rx="2" fill="url(#wbSteel)" stroke="#475569" stroke-width="1"/><path d="M20 18 h6 M20 24 h6 M20 30 h6" stroke="#64748b" stroke-width="1"/>'; } },
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
        draw: function () { return '<rect x="8" y="46" width="60" height="4" fill="#334155"/><path d="M10 16 L58 22 L58 40 L10 40 Z" fill="url(#wbRed3)" stroke="#991b1b" stroke-width="2"/><path d="M18 20 v18 M28 20 v18 M38 21 v17 M48 21 v17" stroke="#fff" stroke-width="1" opacity="0.6"/><rect x="56" y="24" width="14" height="6" fill="url(#wbGrey3)"/>'; } }
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
        draw: function () { return '<line x1="2" y1="12" x2="38" y2="12" stroke="url(#wbGrey3)" stroke-width="7"/><rect x="14" y="12" width="12" height="16" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="8" y="28" width="24" height="4" fill="#334155"/><path d="M10 32 l-4 4 M20 32 v4 M30 32 l4 4" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'guide-support', n: 'Guide', w: 40, h: 34, ports: [P(0, 12, 'w', 'in', ''), P(40, 12, 'e', 'out', '')],
        draw: function () { return '<line x1="2" y1="12" x2="38" y2="12" stroke="url(#wbGrey3)" stroke-width="7"/><path d="M14 6 v12 M26 6 v12" stroke="#475569" stroke-width="2"/><rect x="10" y="28" width="20" height="4" fill="#334155"/><line x1="20" y1="18" x2="20" y2="28" stroke="#475569" stroke-width="2"/>'; } },
      { t: 'spring-hanger', n: 'Spring Hanger', w: 36, h: 52, ports: [P(18, 52, 's', 'in', '')],
        draw: function () { return '<rect x="10" y="4" width="16" height="6" fill="#334155"/><path d="M18 10 q-8 4 8 8 q-8 4 8 8 q-8 4 8 8" fill="none" stroke="url(#wbGrey3)" stroke-width="2.5" transform="translate(-8,0)"/><rect x="12" y="38" width="12" height="6" fill="url(#wbSteel)" stroke="#475569"/><line x1="18" y1="44" x2="18" y2="52" stroke="#475569" stroke-width="3"/>'; } },
      { t: 'shoe-support', n: 'Pipe Shoe', w: 40, h: 32, ports: [P(0, 10, 'w', 'in', ''), P(40, 10, 'e', 'out', '')],
        draw: function () { return '<line x1="2" y1="10" x2="38" y2="10" stroke="url(#wbGrey3)" stroke-width="8"/><path d="M12 14 L28 14 L24 26 L16 26 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="8" y="26" width="24" height="4" fill="#334155"/>'; } },
      { t: 'saddle-support', n: 'Saddle Support', w: 46, h: 40, ports: [P(23, 0, 'n', 'in', '')],
        draw: function () { return '<path d="M8 16 q15 -14 30 0" fill="none" stroke="url(#wbSteel)" stroke-width="4"/><path d="M14 16 L14 32 L32 32 L32 16" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><rect x="8" y="32" width="30" height="4" fill="#334155"/>'; } },
      { t: 'trunnion', n: 'Trunnion', w: 36, h: 40, ports: [P(18, 0, 'n', 'in', '')],
        draw: function () { return '<ellipse cx="18" cy="8" rx="14" ry="5" fill="url(#wbSteelH)" stroke="#475569" stroke-width="1.5"/><rect x="13" y="12" width="10" height="22" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="6" y="34" width="24" height="4" fill="#334155"/>'; } }
    ],
    'Nozzles & Flanges': [
      { t: 'wn-flange', n: 'Weld-Neck Flange', w: 34, h: 34, ports: [P(0, 17, 'w', 'in', ''), P(34, 17, 'e', 'out', '')],
        draw: function () { return '<path d="M2 14 h10 l6 -3 v12 l-6 -3 h-10 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><rect x="18" y="4" width="6" height="26" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><circle cx="21" cy="8" r="1.5" fill="#334155"/><circle cx="21" cy="26" r="1.5" fill="#334155"/>'; } },
      { t: 'so-flange', n: 'Slip-On Flange', w: 32, h: 34, ports: [P(0, 17, 'w', 'in', ''), P(32, 17, 'e', 'out', '')],
        draw: function () { return '<line x1="2" y1="17" x2="30" y2="17" stroke="url(#wbGrey3)" stroke-width="7"/><rect x="14" y="4" width="6" height="26" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/>'; } },
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
    ],
    'Pumps (Full Set)': [
      { t: 'inline-pump', n: 'Inline Centrifugal', w: 54, h: 48, ports: [P(0, 24, 'w', 'in', 'Suction'), P(54, 24, 'e', 'out', 'Discharge')],
        draw: function () { return '<line x1="0" y1="24" x2="54" y2="24" stroke="url(#wbBlue3)" stroke-width="10"/><circle cx="27" cy="24" r="14" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><path d="M27 24 L37 18 M27 24 L37 30 M27 24 L17 24" stroke="#fff" stroke-width="2" stroke-linecap="round"/><rect x="22" y="4" width="10" height="8" fill="url(#wbMotor)"/>'; } },
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
        draw: function () { return '<rect x="8" y="48" width="42" height="4" fill="#334155"/><rect x="10" y="24" width="24" height="18" rx="3" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><rect x="34" y="26" width="12" height="14" fill="url(#wbGrey3)" stroke="#475569"/><rect x="14" y="8" width="16" height="12" rx="2" fill="url(#wbGrey3)" stroke="#475569"/><text x="22" y="17" font-size="6" fill="#0f172a" text-anchor="middle">%</text>'; } }
    ],
    'Valves (Full Set)': [
      { t: 'plug-valve', n: 'Plug Valve', w: 40, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(40, 16, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 6 L4 26 L20 16 Z M36 6 L36 26 L20 16 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><rect x="16" y="10" width="8" height="12" fill="url(#wbBrass)" stroke="#92600a"/>'; } },
      { t: 'diaphragm-valve', n: 'Diaphragm Valve', w: 40, h: 40, ports: [P(0, 28, 'w', 'in', 'In'), P(40, 28, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="28" x2="38" y2="28" stroke="url(#wbGrey3)" stroke-width="7"/><path d="M12 28 q8 -12 16 0" fill="none" stroke="#0d9488" stroke-width="3"/><rect x="16" y="6" width="8" height="12" fill="url(#wbSteel)" stroke="#475569"/><circle cx="20" cy="6" r="4" fill="url(#wbGrey3)"/>'; } },
      { t: 'pinch-valve', n: 'Pinch Valve', w: 40, h: 36, ports: [P(0, 20, 'w', 'in', 'In'), P(40, 20, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M2 14 h14 q4 6 8 0 h14 M2 26 h14 q4 -6 8 0 h14" fill="none" stroke="url(#wbTeal3)" stroke-width="4"/><rect x="16" y="2" width="8" height="8" fill="url(#wbGrey3)"/>'; } },
      { t: 'swing-check', n: 'Swing Check Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="16" x2="40" y2="16" stroke="url(#wbGrey3)" stroke-width="7"/><circle cx="14" cy="16" r="3" fill="#334155"/><path d="M14 16 L26 6" stroke="url(#wbBrass)" stroke-width="3"/>'; } },
      { t: 'lift-check', n: 'Lift Check Valve', w: 40, h: 34, ports: [P(0, 20, 'w', 'in', 'In'), P(40, 20, 'e', 'out', 'Out')],
        draw: function () { return '<line x1="2" y1="20" x2="38" y2="20" stroke="url(#wbGrey3)" stroke-width="7"/><path d="M14 20 L20 10 L26 20 Z" fill="url(#wbBrass)" stroke="#92600a"/>'; } },
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
        draw: function () { return '<line x1="2" y1="30" x2="38" y2="30" stroke="url(#wbGrey3)" stroke-width="8"/><rect x="17" y="6" width="6" height="26" fill="url(#wbSteel)" stroke="#475569" stroke-width="1"/><path d="M17 32 L23 32 L20 38 Z" fill="#334155"/><rect x="14" y="2" width="12" height="5" fill="#334155"/>'; } },
      { t: 'foot-valve', n: 'Foot Valve', w: 36, h: 44, ports: [P(18, 0, 'n', 'out', 'Suction')],
        draw: function () { return '<rect x="10" y="8" width="16" height="20" rx="2" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><path d="M10 28 L18 40 L26 28" fill="none" stroke="#475569" stroke-width="1.5"/><path d="M12 30 h12 M14 34 h8" stroke="#64748b" stroke-width="1"/>'; } },
      { t: 'flush-bottom', n: 'Flush Bottom Valve', w: 42, h: 40, ports: [P(21, 0, 'n', 'in', 'Vessel'), P(42, 30, 'e', 'out', 'Drain')],
        draw: function () { return '<path d="M6 4 h30 l-6 14 h-18 Z" fill="url(#wbSteel)" stroke="#475569" stroke-width="1.5"/><path d="M12 18 L12 30 L30 30 L30 18" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><line x1="30" y1="30" x2="40" y2="30" stroke="#475569" stroke-width="3"/>'; } },
      { t: 'sampling-valve', n: 'Sampling Valve', w: 36, h: 42, ports: [P(0, 16, 'w', 'in', 'Process'), P(18, 42, 's', 'out', 'Sample')],
        draw: function () { return '<line x1="2" y1="16" x2="30" y2="16" stroke="url(#wbGrey3)" stroke-width="6"/><path d="M18 16 L18 34" stroke="url(#wbSteel)" stroke-width="5"/><circle cx="18" cy="12" r="4" fill="url(#wbBrass)" stroke="#92600a"/><path d="M14 34 h8 l-2 6 h-4 Z" fill="#94a3b8"/>'; } },
      { t: 'angle-valve', n: 'Angle Valve', w: 40, h: 42, ports: [P(0, 30, 'w', 'in', 'In'), P(28, 0, 'n', 'out', 'Out')],
        draw: function () { return '<path d="M4 20 L4 40 L21 30 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><path d="M18 28 L38 28 L28 12 Z" fill="url(#wbGrey3)" stroke="#334155" stroke-width="1.5"/><circle cx="14" cy="8" r="5" fill="url(#wbSteel)" stroke="#475569"/>'; } }
    ],
    'Heat Exchangers (Full Set)': [
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
        draw: function () { return '<line x1="6" y1="24" x2="78" y2="24" stroke="url(#wbCopper)" stroke-width="7"/><g stroke="#b45309" stroke-width="1.5">' + (function(){var s='';for(var i=0;i<14;i++){var x=12+i*5;s+='<line x1="'+x+'" y1="12" x2="'+x+'" y2="36"/>';}return s;})() + '</g>'; } }
    ],
    'Reactors (Full Set)': [
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
        draw: function () { return '<rect x="12" y="8" width="30" height="60" rx="4" fill="url(#wbRxG)" stroke="#b45309" stroke-width="2"/><rect x="16" y="18" width="22" height="14" fill="#d4a017" opacity="0.5"/><rect x="16" y="44" width="22" height="14" fill="#d4a017" opacity="0.5"/><g fill="#78350f">' + (function(){var s='';for(var i=0;i<12;i++){s+='<circle cx="'+(19+(i%4)*6)+'" cy="'+(22+Math.floor(i/4)*4)+'" r="1.4"/>';}return s;})() + '</g>'; } }
    ],
    'Vessels (Full Set)': [
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
        draw: function () { return '<rect x="12" y="12" width="26" height="46" fill="url(#wbGrey3)" stroke="#334155" stroke-width="2"/><path d="M12 12 q13 -10 26 0 M12 58 q13 10 26 0" fill="url(#wbGrey3)" stroke="#334155" stroke-width="2"/><text x="25" y="38" font-size="8" fill="#334155" text-anchor="middle" font-family="Arial">VAC</text>'; } }
    ],
    'Tanks (Full Set)': [
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
    'Columns (Full Set)': [
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
    'Compressors (Full Set)': [
      { t: 'scroll-comp', n: 'Scroll Compressor', w: 56, h: 50, ports: [P(0, 38, 'w', 'in', 'Suction'), P(28, 0, 'n', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="46" width="44" height="4" fill="#334155"/><circle cx="30" cy="26" r="18" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><path d="M30 26 a3 3 0 1 1 4 1 a7 7 0 1 1 -10 3 a11 11 0 1 1 16 5" fill="none" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'turbo-blower', n: 'Turbo Blower', w: 60, h: 52, ports: [P(0, 40, 'w', 'in', 'Inlet'), P(60, 20, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="48" width="46" height="4" fill="#334155"/><circle cx="30" cy="28" r="19" fill="url(#wbBlue3)" stroke="#1e40af" stroke-width="1.5"/><g stroke="#fff" stroke-width="2" stroke-linecap="round">' + (function(){var s='';for(var i=0;i<8;i++){var a=i*Math.PI/4;s+='<line x1="30" y1="28" x2="'+(30+13*Math.cos(a))+'" y2="'+(28+13*Math.sin(a))+'"/>';}return s;})() + '</g><circle cx="30" cy="28" r="4" fill="#1e40af"/>'; } },
      { t: 'lr-vacuum', n: 'Liquid Ring Vacuum', w: 60, h: 50, ports: [P(0, 38, 'w', 'in', 'Suction'), P(60, 38, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="46" width="46" height="4" fill="#334155"/><circle cx="30" cy="26" r="18" fill="url(#wbTeal3)" stroke="#0f766e" stroke-width="1.5"/><circle cx="30" cy="26" r="18" fill="none" stroke="#5eead4" stroke-width="3" opacity="0.6"/><circle cx="33" cy="24" r="8" fill="none" stroke="#0f766e" stroke-width="1.5"/>'; } },
      { t: 'rv-vacuum', n: 'Rotary Vane Vacuum', w: 58, h: 50, ports: [P(0, 38, 'w', 'in', 'Suction'), P(58, 38, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="46" width="44" height="4" fill="#334155"/><circle cx="30" cy="26" r="18" fill="url(#wbGrey3)" stroke="#475569" stroke-width="1.5"/><circle cx="26" cy="26" r="11" fill="none" stroke="#334155" stroke-width="1.5"/><path d="M26 15 v22 M15 26 h22" stroke="#64748b" stroke-width="1.5"/>'; } }
    ]
  };

  var LIB_INDEX = {};
  Object.keys(LIB).forEach(function (cat) { LIB[cat].forEach(function (it) { LIB_INDEX[it.t] = it; }); });

  /* ───────────── Refinery / petrochemical FLOWSHEET library ─────────────
     60 major process units, grouped by refinery section. Each is a compact
     recipe: 't:Label; t:Label; ...' — the loader instantiates the equipment
     left→right and wires them in series as a starting P&ID the user edits.
     Reuses the industrial symbols already in the palette. */
  var FLOWSHEETS = {
    'Crude & Distillation': {
      'Crude Oil Storage': 'cone-tank:Crude Tank; pump:Transfer Pump; sthe:Preheat; v-vessel:Surge Drum',
      'Crude Oil Transfer System': 'cone-tank:Crude Tank; pump:Booster Pump; ft:Custody FT; pump-ms:Shipping Pump; bullet:Rundown',
      'Crude Oil Desalter': 'sthe:Preheat Train; mixer:Wash Mixer; h-vessel:Desalter Drum; pump:Brine Pump; v-vessel:Dehydrated Crude',
      'Atmospheric Distillation (ADU/CDU)': 'sthe:Preheat; boiler:Crude Furnace; column:Atm Column; aircooler:OVHD Condenser; v-vessel:Reflux Drum; pump:Reflux Pump; sthe:Product Cooler',
      'Naphtha Stabilizer Unit': 'sthe:Feed/Btms HX; column:Stabilizer; aircooler:Condenser; v-vessel:Reflux Drum; pump:Reflux Pump; reboiler:Reboiler',
      'Vacuum Distillation (VDU)': 'boiler:Vacuum Furnace; column:Vacuum Column; ejector:1st Ejector; ejector:2nd Ejector; v-vessel:Hotwell; pump:VGO Pump'
    },
    'Naphtha & Reforming': {
      'Light Naphtha Hydrotreater': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:HDT Reactor; separator:HP Separator; column:Stripper; pump:Reflux Pump',
      'Heavy Naphtha Hydrotreater': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:HDT Reactor; separator:HP Separator; column:Stripper; aircooler:Condenser',
      'Catalytic Reforming (CCR)': 'boiler:Charge Heater; pbr:Reactor 1; boiler:Interheater; pbr:Reactor 2; separator:Recycle Sep; compressor:Recycle Gas; column:Stabilizer',
      'Isomerization Unit': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:Isom Reactor; separator:Product Sep; column:Deisohexanizer; pump:Reflux Pump',
      'Alkylation Unit': 'cstr:Alkylation Reactor; separator:Acid Settler; pump:Acid Pump; column:Isostripper; aircooler:Condenser; v-vessel:Reflux Drum',
      'Polymerization Unit': 'sthe:Feed HX; pbr:Poly Reactor; separator:Product Sep; column:Depropanizer; pump:Reflux Pump'
    },
    'Middle Distillates': {
      'Kerosene Hydrotreater (KHT)': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:HDT Reactor; separator:HP Separator; column:Stripper; aircooler:Cooler',
      'Jet Fuel Treating Unit': 'v-vessel:Feed Drum; absorber:Clay Treater; sthe:Cooler; v-vessel:Salt Drier; bullet:Jet Rundown',
      'Diesel Hydrotreater (DHDT)': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:HDS Reactor; separator:HP Separator; absorber:Amine Absorber; column:Stripper; aircooler:Cooler',
      'VGO Hydrotreater (VGO HDT)': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:HDT Reactor; separator:HP/LP Sep; compressor:Recycle Gas; column:Stripper'
    },
    'Conversion': {
      'Fluid Catalytic Cracking (FCCU)': 'boiler:Feed Preheater; pbr:Riser Reactor; separator:Regenerator; column:Main Fractionator; aircooler:OVHD Condenser; v-vessel:Reflux Drum; compressor:Wet Gas Comp',
      'FCC Gas Concentration Unit': 'compressor:Wet Gas Comp; separator:HP Separator; absorber:Absorber; column:Stripper; column:Debutanizer; pump:Reflux Pump',
      'Hydrocracker (HCU)': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:1st Stage Reactor; pbr:2nd Stage Reactor; separator:HP Separator; compressor:Recycle Gas; column:Fractionator',
      'Residue Hydrocracker (RHCU)': 'boiler:Charge Heater; pbr:Ebullated Reactor; separator:HP Separator; compressor:Recycle H2; column:Fractionator; aircooler:Cooler',
      'Delayed Coking (DCU)': 'boiler:Coker Furnace; v-vessel:Coke Drum A; v-vessel:Coke Drum B; column:Coker Fractionator; aircooler:Condenser; pump:Reflux Pump',
      'Flexicoking Unit': 'boiler:Reactor Heater; pbr:Coking Reactor; separator:Heater Vessel; separator:Gasifier; column:Scrubber; compressor:Gas Comp',
      'Visbreaker (VBU)': 'boiler:Visbreaker Furnace; v-vessel:Soaker Drum; column:Fractionator; aircooler:Condenser; pump:Quench Pump',
      'Solvent Deasphalting (SDA)': 'mixer:Solvent Mixer; column:Extractor; column:Asphaltene Sep; sthe:Solvent Recovery; pump:Solvent Pump'
    },
    'Residue & Lube': {
      'Residue Desulfurization (RDS)': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:HDS Reactor; separator:HP Separator; compressor:Recycle Gas; column:Stripper',
      'Lube Oil Extraction Unit': 'mixer:Furfural Mixer; column:Extraction Tower; sthe:Solvent Recovery; column:Raffinate Stripper; pump:Solvent Pump',
      'Lube Oil Dewaxing Unit': 'sthe:Chiller; mixer:MEK Mixer; separator:Rotary Filter; column:Solvent Recovery; pump:Filtrate Pump',
      'Wax Processing Unit': 'sthe:Sweater HX; v-vessel:Sweat Tank; column:De-oiling; sthe:Wax Cooler; bullet:Wax Storage',
      'Base Oil Finishing Unit': 'sthe:Feed/Eff HX; boiler:Charge Heater; pbr:Hydrofinishing Reactor; separator:Flash Drum; column:Vacuum Stripper',
      'Asphalt Production Unit': 'boiler:Feed Heater; column:Vacuum Column; v-vessel:Flash Drum; sthe:Asphalt Cooler; cone-tank:Asphalt Storage',
      'Bitumen Blowing Unit': 'boiler:Feed Heater; cstr:Oxidizer Column; blower:Air Blower; separator:KO Drum; sthe:Bitumen Cooler'
    },
    'Gas & Treating': {
      'LPG Recovery Unit': 'compressor:Gas Comp; separator:HP Separator; absorber:Absorber; column:Deethanizer; column:Debutanizer; pump:Reflux Pump',
      'Merox Treating Unit': 'v-vessel:Feed Drum; absorber:Extractor; cstr:Oxidizer; separator:Disulfide Sep; sthe:Cooler',
      'Amine Treating Unit': 'absorber:Amine Absorber; sthe:Lean/Rich HX; column:Amine Regenerator; reboiler:Reboiler; pump:Lean Amine Pump; aircooler:Lean Cooler',
      'Sour Water Stripper (SWS)': 'v-vessel:Feed Drum; sthe:Feed/Btms HX; column:Stripper; reboiler:Reboiler; aircooler:OVHD Condenser; pump:Reflux Pump',
      'Sulfur Recovery (SRU)': 'boiler:Reaction Furnace; sthe:Waste Heat Boiler; pbr:Converter 1; sthe:Sulfur Condenser; pbr:Converter 2; v-vessel:Sulfur Pit',
      'Tail Gas Treating (TGTU)': 'boiler:Reducing Gas Gen; pbr:Hydrogenation Reactor; sthe:Quench Cooler; absorber:Amine Absorber; column:Regenerator'
    },
    'Hydrogen & Utilities': {
      'Hydrogen Production (HPU/SMR)': 'sthe:Feed Preheat; pbr:Desulfurizer; boiler:Reformer Furnace; pbr:Shift Converter; absorber:PSA Unit; compressor:H2 Comp',
      'Hydrogen Recovery (HRU)': 'compressor:Feed Comp; separator:KO Drum; absorber:PSA Absorber; v-vessel:H2 Product Drum; compressor:Product Comp',
      'Fuel Gas System': 'v-vessel:KO Drum; absorber:Amine Absorber; sthe:Fuel Gas Heater; v-vessel:Fuel Gas Drum; control:PC Valve',
      'Steam Generation Unit': 'atm-tank:BFW Tank; pump:BFW Pump; boiler:Boiler; v-vessel:Steam Drum; sthe:Superheater; control:Steam PCV',
      'Boiler Feed Water Treatment': 'atm-tank:Raw Water; mixer:Chemical Dosing; column:Deaerator; pump:BFW Pump; sthe:Economizer',
      'Demineralized Water Plant (DM)': 'atm-tank:Raw Water; pbr:Cation Bed; pbr:Anion Bed; pbr:Mixed Bed; atm-tank:DM Storage; pump:DM Pump',
      'Cooling Water System': 'cooltower:Cooling Tower; pump:CW Pump; sthe:Process HX; v-vessel:CW Basin; control:CW Valve',
      'Air Compressor System': 'blower:Intake Filter; compressor:Air Compressor; v-vessel:Air Receiver; sthe:Aftercooler; v-vessel:Instrument Air Drum',
      'Nitrogen Generation Unit': 'compressor:Air Compressor; pbr:PSA/Membrane; v-vessel:N2 Buffer; bullet:N2 Storage; control:N2 PCV'
    },
    'Offsites & Storage': {
      'Flare System': 'v-vessel:Flare KO Drum; v-vessel:Liquid Seal Drum; column:Flare Stack; blower:Purge Gas; pump:Knockout Pump',
      'Wastewater Treatment (WWTP)': 'v-vessel:API Separator; cstr:Aeration Basin; separator:Clarifier; pbr:Sand Filter; atm-tank:Effluent Tank',
      'Product Blending Unit': 'cone-tank:Component Tank A; cone-tank:Component Tank B; mixer:Inline Blender; ft:Blend FT; cone-tank:Product Tank',
      'Tank Farm': 'cone-tank:Tank 1; cone-tank:Tank 2; cone-tank:Tank 3; pump:Transfer Pump; ft:Manifold FT',
      'Product Loading Terminal': 'cone-tank:Product Tank; pump-ms:Loading Pump; ft:Loading FT; control:Loading Valve; bullet:Truck/Rail',
      'Marine Terminal': 'cone-tank:Storage Tank; pump-ms:Jetty Pump; ft:Custody FT; control:ESD Valve; bullet:Ship Manifold',
      'Pipeline Transfer Station': 'bullet:Receiving Drum; pump-ms:Mainline Pump; ft:Metering FT; control:Pressure Valve; v-vessel:Surge Drum',
      'Offsite Storage & Dispatch': 'cone-tank:Storage Tank; pump:Dispatch Pump; ft:Dispatch FT; control:Batch Valve; bullet:Loading Bay'
    },
    'Power & Support': {
      'Utility Distribution System': 'v-vessel:Steam Header; v-vessel:Air Header; v-vessel:N2 Header; control:Header PCV; pump:Distribution Pump',
      'Instrument Air System': 'compressor:IA Compressor; sthe:Aftercooler; v-vessel:IA Dryer; v-vessel:IA Receiver; control:IA Regulator',
      'Fire Water System': 'atm-tank:Fire Water Tank; pump-ms:Jockey Pump; pump-ms:Main Fire Pump; v-vessel:Pressure Vessel; control:Deluge Valve',
      'Cogeneration / Power Plant': 'compressor:Gas Turbine; boiler:HRSG; v-vessel:Steam Drum; column:Steam Turbine; cooltower:Condenser Cooling',
      'Control Room (DCS/ESD)': 'ti:Field TI; pg:Field PI; ft:Field FT; control:Control Valve; li:Level LI',
      'Laboratory & Quality Control': 'v-vessel:Sample Drum; sthe:Sample Cooler; ft:Analyzer FT; control:Sample Valve; bullet:Retain Storage'
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
  function pushUndo() { WB.undoStack.push(snapshot()); if (WB.undoStack.length > 60) WB.undoStack.shift(); WB.redoStack = []; }
  function restore(s) { var o = JSON.parse(s); WB.nodes = o.nodes; WB.pipes = o.pipes; WB.seq = o.seq; WB.sel = null; render(); renderProps(); sync3D(); }
  WB.undo = function () { if (!WB.undoStack.length) return; WB.redoStack.push(snapshot()); restore(WB.undoStack.pop()); };
  WB.redo = function () { if (!WB.redoStack.length) return; WB.undoStack.push(snapshot()); restore(WB.redoStack.pop()); };

  /* ───────────── Geometry helpers ───────────── */
  function snapV(v) { return WB.snap ? Math.round(v / WB.grid) * WB.grid : v; }
  function nodeById(id) { for (var i = 0; i < WB.nodes.length; i++) if (WB.nodes[i].id === id) return WB.nodes[i]; return null; }
  // first outlet-ish / inlet-ish port index for a node type (used when a 3D pipe writes back to the 2D model)
  function outPortIndex(t) { var ps = (LIB_INDEX[t] || {}).ports || []; for (var i = 0; i < ps.length; i++) if (/out|liq|vap/.test(ps[i].role)) return i; return ps.length ? ps.length - 1 : 0; }
  function inPortIndex(t) { var ps = (LIB_INDEX[t] || {}).ports || []; for (var i = 0; i < ps.length; i++) if (/in/.test(ps[i].role)) return i; return 0; }
  // Rebuild the 3D scene from the shared model whenever the 2D model changes while in 3D mode
  // (so loading a flowsheet, deleting, undo/redo etc. all convert live to 3D).
  function sync3D() {
    if (WB.mode3d && window.ARO3D && window.ARO3D.buildFromModel)
      window.ARO3D.buildFromModel(WB.nodes, WB.pipes, function (t) { var l = LIB_INDEX[t]; return l ? l.n : t; });
  }
  WB.sync3D = sync3D;
  // Port position in world coords — honours the node's own rotation & scale
  function portWorld(node, pi) {
    var lib = LIB_INDEX[node.t]; var p = lib.ports[pi];
    var s = node.scale || 1, r = (node.rot || 0) * Math.PI / 180;
    var cx = lib.w / 2, cy = lib.h / 2;
    var dx = (p.x - cx) * s, dy = (p.y - cy) * s;
    return { x: node.x + cx + dx * Math.cos(r) - dy * Math.sin(r),
             y: node.y + cy + dx * Math.sin(r) + dy * Math.cos(r), dir: p.dir };
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

  /* Load a flowsheet recipe as an editable starting P&ID (series layout) */
  WB.loadFlowsheet = function (section, name) {
    var recipe = FLOWSHEETS[section] && FLOWSHEETS[section][name];
    if (!recipe) return;
    if (WB.nodes.length && !confirm('Load the "' + name + '" flowsheet? This replaces the current drawing.')) return;
    pushUndo();
    WB.nodes = []; WB.pipes = []; WB.seq = 0; WB.sel = null;
    var steps = recipe.split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    var x = 60, rowY = 130, made = [];
    steps.forEach(function (step, idx) {
      var parts = step.split(':'); var t = parts[0].trim(); var label = (parts[1] || '').trim();
      if (!LIB_INDEX[t]) t = 'v-vessel';
      var lib = LIB_INDEX[t];
      // zig-zag two rows so long trains stay on-canvas without overlap
      var row = idx % 2 === 0 ? rowY : rowY + 150;
      var n = { id: 'N' + (++WB.seq), t: t, x: x, y: row - lib.h / 2,
        tag: label || defaultTag(t), fluid: 'Crude Oil', flow: 50, temp: 120, press: 5, nps: 6 };
      WB.nodes.push(n); made.push(n);
      x += Math.max(lib.w, 90) + 70;
    });
    // wire in series: each unit's outlet → next unit's inlet
    for (var i = 0; i < made.length - 1; i++) {
      var a = made[i], b = made[i + 1];
      var fp = firstPortByRole(a.t, OUT_ROLES), tp = firstPortByRole(b.t, IN_ROLES);
      var role = LIB_INDEX[a.t].ports[fp].role;
      WB.pipes.push({ id: 'L' + (++WB.seq), from: { id: a.id, pi: fp }, to: { id: b.id, pi: tp },
        role: role, tag: 'L-' + (100 + i + 1), fluid: 'Crude Oil', flow: 50, nps: 6, length: 12, dz: 0 });
    }
    WB.zoom = 0.9; WB.panX = 10; WB.panY = 10;
    render(); renderProps(); sync3D();
    setStatus('Loaded flowsheet: ' + name + ' — ' + made.length + ' units. Edit equipment, re-route lines, then RUN ANALYSIS. (Template for learning; adjust to your real design.)', '#0369a1');
    if (window.setEngineTicker) window.setEngineTicker('system', 'ARO WORKBENCH // Loaded ' + name + ' flowsheet (' + made.length + ' units)', '#00b875');
  };

  WB.deleteSel = function () {
    if (!WB.sel) return; pushUndo();
    if (WB.sel.kind === 'node') {
      WB.nodes = WB.nodes.filter(function (n) { return n.id !== WB.sel.id; });
      WB.pipes = WB.pipes.filter(function (p) { return p.from.id !== WB.sel.id && p.to.id !== WB.sel.id; });
    } else if (WB.sel.kind === 'pipe') {
      WB.pipes = WB.pipes.filter(function (p) { return p.id !== WB.sel.id; });
    }
    WB.sel = null; render(); renderProps(); sync3D();
  };

  /* ───────────── Pipe routing (orthogonal L-route) ───────────── */
  function routePipe(a, b) {
    var pts = [{ x: a.x, y: a.y }];
    if (WB.ortho) {
      // exit stub in port direction, then L-route
      var midX = (a.x + b.x) / 2;
      pts.push({ x: midX, y: a.y });
      pts.push({ x: midX, y: b.y });
    }
    pts.push({ x: b.x, y: b.y });
    return pts;
  }
  function pipeLenPx(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }

  /* ───────────── Rendering ───────────── */
  var svg, gWorld, propEl;
  function render() {
    if (!gWorld) return;
    var s = '';
    // grid
    if (WB.gridOn) s += '<rect x="-4000" y="-4000" width="8000" height="8000" fill="url(#wbGrid)"/>';
    // backdrop image (imported)
    if (WB.backdrop) s += '<image href="' + WB.backdrop.href + '" x="' + WB.backdrop.x + '" y="' + WB.backdrop.y + '" width="' + WB.backdrop.w + '" height="' + WB.backdrop.h + '" opacity="0.5"/>';
    // pipes
    WB.pipes.forEach(function (p) {
      var a = nodeById(p.from.id), b = nodeById(p.to.id);
      if (!a || !b) return;
      var pa = portWorld(a, p.from.pi), pb = portWorld(b, p.to.pi);
      var pts = routePipe(pa, pb); p._pts = pts;
      var d = 'M' + pts.map(function (pt) { return pt.x + ' ' + pt.y; }).join(' L');
      var selc = (WB.sel && WB.sel.kind === 'pipe' && WB.sel.id === p.id);
      var roleCol = (p.role && ROLE[p.role]) ? ROLE[p.role].c : '#475569';
      // a user-chosen line colour always wins; otherwise fall back to status / role colour
      var col = p.color ? p.color : (p.status === 'high' ? '#dc2626' : (p.status === 'ok' ? '#16a34a' : roleCol));
      var dash = (p.role === 'signal') ? ' stroke-dasharray="6 3"' : (p.role === 'recycle' ? ' stroke-dasharray="10 4"' : '');
      s += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (selc ? 5 : 3) + '"' + dash + ' stroke-linejoin="round" data-pipe="' + p.id + '" style="cursor:pointer"/>';
      var mid = pts[Math.floor(pts.length / 2)];
      if (p.tag || p.nps) s += '<text x="' + mid.x + '" y="' + (mid.y - 6) + '" font-size="9" fill="#0f766e" text-anchor="middle" font-family="monospace" stroke="#fff" stroke-width="2.6" paint-order="stroke" style="pointer-events:none">' + (p.tag || '') + (p.nps ? ' ' + p.nps + '"' : '') + (p.dp !== undefined ? ' · ΔP ' + p.dp.toFixed(2) + ' bar' : '') + '</text>';
    });
    // nodes
    WB.nodes.forEach(function (n) {
      var lib = LIB_INDEX[n.t]; if (!lib) return;
      var selc = (WB.sel && WB.sel.kind === 'node' && WB.sel.id === n.id);
      // per-equipment rotation + scale about its own centre (only the
      // node itself transforms — labels drawn upright afterwards)
      var sc = n.scale || 1, rt = n.rot || 0, cx = lib.w / 2, cy = lib.h / 2;
      var bodyTf = 'translate(' + cx + ',' + cy + ') rotate(' + rt + ') scale(' + sc + ') translate(' + (-cx) + ',' + (-cy) + ')';
      s += '<g transform="translate(' + n.x + ',' + n.y + ')" data-node="' + n.id + '" style="cursor:move">';
      // soft ground shadow under the equipment for a 3D sit-on-floor look
      s += '<ellipse cx="' + cx + '" cy="' + (cy + lib.h * sc / 2 + 4) + '" rx="' + (lib.w * sc * 0.42) + '" ry="3.5" fill="#0f172a" opacity="0.12"/>';
      s += '<g transform="' + bodyTf + '" filter="url(#wbShadow)">';
      if (selc) s += '<rect x="-6" y="-6" width="' + (lib.w + 12) + '" height="' + (lib.h + 12) + '" fill="none" stroke="#ff7538" stroke-width="' + (1.5 / sc) + '" stroke-dasharray="4 3" rx="4"/>';
      s += lib.draw();
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
        if (pp.from.id === n.id) used[pp.from.pi] = true;
        if (pp.to.id === n.id) used[pp.to.pi] = true;
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
      s += '<text x="' + (lib.w / 2) + '" y="' + (lib.h * sc / 2 + cy + 22) + '" font-size="9" font-weight="700" fill="#0f172a" text-anchor="middle" font-family="monospace" stroke="#fff" stroke-width="3" paint-order="stroke" style="pointer-events:none">' + (n.tag || '') + '</text>';
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
    if (!WB.sel) { propEl.innerHTML = '<div class="wb-prop-empty">Select an item to edit its properties, or drag a component from the left library onto the canvas.</div>'; return; }
    var h = '';
    if (WB.sel.kind === 'node') {
      var n = nodeById(WB.sel.id); if (!n) { propEl.innerHTML = ''; return; }
      var lib = LIB_INDEX[n.t];
      h += '<div class="wb-prop-title">' + lib.n + '</div>';
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
      h += field('Tag', 'tag', n.tag, 'text');
      h += fluidField(n.fluid);
      h += field('Flow (m³/h)', 'flow', n.flow, 'number');
      h += field('Temp (°C)', 'temp', n.temp, 'number');
      h += field('Pressure (bar g)', 'press', n.press, 'number');
      // Stream connection list — only this equipment's own ports
      var conn = {};
      WB.pipes.forEach(function (pp) {
        if (pp.from.id === n.id) conn[pp.from.pi] = pp.tag;
        if (pp.to.id === n.id) conn[pp.to.pi] = pp.tag;
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
        render(); sync3D();
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
  WB.report = function () {
    var res = WB.calculate();
    var pr = WB.pipes.map(function (p, i) {
      var r = p.result || {};
      return '<tr><td>' + (i + 1) + '</td><td>' + (p.tag || p.id) + '</td><td>' + (p.fluid || '-') + '</td><td>' + (p.nps || '-') + '"</td><td>' + (p.flow || '-') + '</td><td>' + (r.v ? r.v.toFixed(2) : '-') + '</td><td>' + (r.Re ? Math.round(r.Re).toLocaleString() : '-') + '</td><td>' + (p.dp !== undefined ? p.dp.toFixed(3) : '-') + '</td><td style="color:' + (p.status === 'high' ? '#dc2626' : '#16a34a') + ';font-weight:700;">' + (p.status === 'high' ? 'REVIEW' : 'OK') + '</td></tr>';
    }).join('');
    var eq = WB.nodes.map(function (n, i) { return '<tr><td>' + (i + 1) + '</td><td>' + (n.tag || '') + '</td><td>' + LIB_INDEX[n.t].n + '</td><td>' + (n.fluid || '-') + '</td><td>' + (n.flow || '-') + '</td><td>' + (n.temp || '-') + '</td><td>' + (n.press || '-') + '</td></tr>'; }).join('');
    var html = '<div class="wb-rep-head">ARO WORKBENCH — PROCESS SYSTEM REPORT</div>'
      + '<div class="wb-rep-sub">Bharat FlowSize · ' + new Date().toLocaleString() + '</div>'
      + '<div class="wb-rep-verdict" style="background:' + (res.anyHigh ? '#fef2f2' : '#f0fdf4') + ';border-color:' + (res.anyHigh ? '#dc2626' : '#16a34a') + ';color:' + (res.anyHigh ? '#991b1b' : '#166534') + ';">' + (res.anyHigh ? '⚠ SYSTEM REVIEW NEEDED — ' + res.warnings.length + ' line(s) exceed ΔP/velocity limits' : '✓ SYSTEM STABLE — all lines within ΔP ≤ 1.0 bar and velocity ≤ 3 m/s') + ' · Total ΔP ' + res.totalDp.toFixed(2) + ' bar</div>'
      + '<h4>Equipment Schedule</h4><table class="wb-table"><tr><th>#</th><th>Tag</th><th>Type</th><th>Fluid</th><th>Flow m³/h</th><th>T °C</th><th>P barg</th></tr>' + (eq || '<tr><td colspan="7">No equipment placed.</td></tr>') + '</table>'
      + '<h4>Line List &amp; Hydraulics</h4><table class="wb-table"><tr><th>#</th><th>Line</th><th>Fluid</th><th>NPS</th><th>Flow</th><th>v m/s</th><th>Re</th><th>ΔP bar</th><th>Status</th></tr>' + (pr || '<tr><td colspan="9">No lines drawn.</td></tr>') + '</table>';
    modal('SYSTEM REPORT', html, true);
  };

  /* ───────────── Project save / open / import ───────────── */
  WB.newProject = function () { if (WB.nodes.length && !confirm('Start a new project? Unsaved work will be lost.')) return; pushUndo(); WB.nodes = []; WB.pipes = []; WB.seq = 0; WB.sel = null; WB.backdrop = null; render(); renderProps(); sync3D(); setStatus('New project.', '#94a3b8'); };
  WB.save = function () {
    var data = JSON.stringify({ v: 1, nodes: WB.nodes, pipes: WB.pipes, seq: WB.seq }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aro-workbench-project.json'; a.click();
    try { localStorage.setItem('aroWorkbenchProject', data); } catch (e) {}
    setStatus('Project saved (download + browser storage).', '#16a34a');
  };
  WB.open = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { try { var o = JSON.parse(r.result); pushUndo(); WB.nodes = o.nodes || []; WB.pipes = o.pipes || []; WB.seq = o.seq || 0; WB.sel = null; render(); renderProps(); sync3D(); setStatus('Project loaded: ' + f.name, '#16a34a'); } catch (e) { alert('Could not read project file.'); } }; r.readAsText(f); };
    inp.click();
  };
  WB.import = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.png,.jpg,.jpeg,.pdf,.dwg,.dxf,.step,.stp,.iges,.igs';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      if (['png', 'jpg', 'jpeg'].indexOf(ext) >= 0) {
        var r = new FileReader(); r.onload = function () { var img = new Image(); img.onload = function () { var scale = Math.min(600 / img.width, 400 / img.height, 1); WB.backdrop = { href: r.result, x: 40, y: 40, w: img.width * scale, h: img.height * scale }; render(); setStatus('Image traced as backdrop — draw over it, then remove from Import menu.', '#0369a1'); }; img.src = r.result; }; r.readAsDataURL(f);
      } else {
        // CAD/PDF vector import is a roadmap item — acknowledged honestly
        setStatus('Imported "' + f.name + '" (' + ext.toUpperCase() + '). Native ' + ext.toUpperCase() + ' geometry parsing is on the roadmap; use it as a reference alongside the drawing. Images (PNG/JPG) import as a traceable backdrop today.', '#f59e0b');
        alert(ext.toUpperCase() + ' import registered.\n\nVector/solid parsing for DWG/DXF/STEP/IGES/PDF is on the ARO Workbench roadmap. For now, export that file to PNG/JPG and import it as a traceable backdrop to draw over.');
      }
    };
    inp.click();
  };
  WB.clearBackdrop = function () { WB.backdrop = null; render(); };

  /* ───────────── Flowsheet library browser ───────────── */
  WB.flowsheetBrowser = function () {
    var total = 0;
    Object.keys(FLOWSHEETS).forEach(function (sec) { total += Object.keys(FLOWSHEETS[sec]).length; });
    var body = '<div class="wb-fs-intro">Pick a standard petroleum / petrochemical process unit to load as an editable P&amp;ID template. Each opens as real equipment wired in series — study it, then re-route and edit to build your own flowsheet. <b>' + total + ' units</b> across ' + Object.keys(FLOWSHEETS).length + ' refinery sections.</div>';
    body += '<div class="wb-fs-grid">';
    Object.keys(FLOWSHEETS).forEach(function (sec) {
      body += '<div class="wb-fs-sec"><div class="wb-fs-sec-h">' + sec + '</div>';
      Object.keys(FLOWSHEETS[sec]).forEach(function (name) {
        var n = FLOWSHEETS[sec][name].split(';').length;
        body += '<a class="wb-fs-item" data-sec="' + sec.replace(/"/g, '') + '" data-name="' + name.replace(/"/g, '&quot;') + '">' + name + ' <span>· ' + n + ' units</span></a>';
      });
      body += '</div>';
    });
    body += '</div>';
    var d = document.createElement('div'); d.className = 'wb-modal';
    d.innerHTML = '<div class="wb-modal-box" style="max-width:1000px;"><div class="wb-modal-head"><span>REFINERY FLOWSHEET LIBRARY</span><button class="wb-modal-x">✕</button></div><div class="wb-modal-body">' + body + '</div><div class="wb-modal-foot"><button class="wb-btn wb-btn-mut wb-modal-close">CLOSE</button></div></div>';
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
    d.innerHTML = '<div class="wb-modal-box" style="max-width:' + (wide ? 860 : 560) + 'px;"><div class="wb-modal-head"><span>' + title + '</span><button class="wb-modal-x">✕</button></div><div class="wb-modal-body">' + body + '</div><div class="wb-modal-foot"><button class="wb-btn" id="wb-modal-print">PRINT / SAVE PDF</button><button class="wb-btn wb-btn-mut wb-modal-close">CLOSE</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('.wb-modal-x').onclick = d.querySelector('.wb-modal-close').onclick = function () { d.remove(); };
    d.querySelector('#wb-modal-print').onclick = function () {
      var w = window.open('', '_blank'); w.document.write('<html><head><title>' + title + '</title><style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #cbd5e1;padding:5px 8px;font-size:12px;text-align:left;}h4{margin:14px 0 6px;}</style></head><body>' + d.querySelector('.wb-modal-body').innerHTML + '</body></html>'); w.document.close(); w.print();
    };
  }

  /* ───────────── UI construction ───────────── */
  function buildUI(root) {
    var palette = '';
    Object.keys(LIB).forEach(function (cat) {
      palette += '<div class="wb-cat">' + cat + '</div><div class="wb-cat-items">';
      LIB[cat].forEach(function (it) {
        palette += '<div class="wb-lib" draggable="true" data-t="' + it.t + '" title="' + it.n + '">'
          + '<svg viewBox="0 0 ' + it.w + ' ' + (it.h + 16) + '" style="overflow:visible">'
          + '<ellipse cx="' + (it.w / 2) + '" cy="' + (it.h + 5) + '" rx="' + (it.w * 0.4) + '" ry="3" fill="#0f172a" opacity="0.14"/>'
          + '<g filter="url(#wbShadow)">' + it.draw() + '</g>'
          + '</svg><span>' + it.n + '</span></div>';
      });
      palette += '</div>';
    });

    root.innerHTML =
      '<div class="wb-shell">'
      + '<div class="wb-menubar">'
      + '  <span class="wb-brand">⬡ ARO WORKBENCH</span>'
      + '  <div class="wb-menu"><button>Project ▾</button><div class="wb-drop"><a data-a="new">New Project</a><a data-a="open">Open Project…</a><a data-a="save">Save Project</a></div></div>'
      + '  <div class="wb-menu"><button>Import ▾</button><div class="wb-drop"><a data-a="import">Import File (DWG/DXF/STEP/IGES/PDF/Image)…</a><a data-a="clearbd">Remove Backdrop</a></div></div>'
      + '  <div class="wb-menu"><button>Flowsheets ▾</button><div class="wb-drop"><a data-a="flowsheets">📋 Refinery Flowsheet Library (60 units)…</a></div></div>'
      + '  <div class="wb-menu"><button>Generate ▾</button><div class="wb-drop"><a data-a="calc">Run Analysis</a><a data-a="bom">BOM Generator</a><a data-a="report">Report Generator</a></div></div>'
      + '  <span class="wb-menu-spacer"></span>'
      + '  <span id="wb-count" class="wb-count">0 equipment · 0 lines</span>'
      + '</div>'
      + '<div class="wb-toolbar">'
      + toolBtn('select', '▲', 'Select / Move') + toolBtn('pipe', '⎯', 'Draw Pipe (connect ports)')
      + '<span class="wb-tsep"></span>'
      + actBtn('undo', '↶', 'Undo') + actBtn('redo', '↷', 'Redo') + actBtn('delete', '🗑', 'Delete selected')
      + '<span class="wb-tsep"></span>'
      + actBtn('zoomin', '＋', 'Zoom in') + actBtn('zoomout', '－', 'Zoom out') + actBtn('fit', '⤢', 'Fit / reset view')
      + '<span class="wb-tsep"></span>'
      + toggleBtn('snap', '#', 'Snap to grid', true) + toggleBtn('ortho', '∟', 'Ortho pipe routing', true)
      + '<span class="wb-tsep"></span>'
      + '<button class="wb-tool wb-view active" data-view="plan" title="Plan / 2D view">▦</button>'
      + '<button class="wb-tool wb-view" data-view="iso" title="Isometric 3D view">◈</button>'
      + '<button class="wb-tool wb-view" data-view="front" title="Front elevation">▭</button>'
      + '<button class="wb-tool wb-view" data-view="side" title="Side elevation">▯</button>'
      + '<button class="wb-tool wb-view" data-mode2="rotate360" title="360° free rotate (drag empty canvas)">↻</button>'
      + '<span class="wb-tsep"></span>'
      + '<button class="wb-tool wb-toggle on" data-toggle="gridOn" title="Grid on / off">▩</button>'
      + '<label class="wb-tool" id="wb-bg-btn" title="Pick background colour" style="padding:0;overflow:hidden;position:relative;">🎨<input type="color" id="wb-bg-input" value="#ffffff" style="position:absolute;inset:0;opacity:0;cursor:pointer;"></label>'
      + '<span class="wb-tsep"></span>'
      + '<button class="wb-tool" id="wb-mode2d" title="2D flowsheet mode" style="width:auto;padding:0 10px;font-weight:700;">2D</button>'
      + '<button class="wb-tool" id="wb-mode3d" title="Real 3D CAD mode — drop equipment as real 3D meshes" style="width:auto;padding:0 10px;font-weight:700;background:linear-gradient(135deg,#0284c7,#38bdf8);color:#fff;border-color:#0369a1;">🧊 3D</button>'
      + '<span class="wb-3d-only" style="display:none;">'
      + '<span class="wb-tsep"></span>'
      + '<button class="wb-tool" id="wb-3dpipe" title="Pipe tool — drag one equipment to another to connect them in 3D" style="width:auto;padding:0 9px;font-weight:700;">🔗 PIPE</button>'
      + '<button class="wb-tool" id="wb-3drotl" title="Rotate selected equipment −45°" style="width:auto;padding:0 7px;">⟲</button>'
      + '<button class="wb-tool" id="wb-3drotr" title="Rotate selected equipment +45°" style="width:auto;padding:0 7px;">⟳</button>'
      + '<span class="wb-tsep"></span>'
      + '<button class="wb-tool" data-3dview="iso" title="Isometric view">ISO</button><button class="wb-tool" data-3dview="top" title="Top view">Top</button><button class="wb-tool" data-3dview="front" title="Front view">Fr</button><button class="wb-tool" data-3dview="left" title="Left view">Lf</button><button class="wb-tool" data-3dview="perspective" title="Perspective view">Psp</button>'
      + '<button class="wb-tool" data-3dmode="wire" title="Wireframe on/off">▨</button><button class="wb-tool" data-3dmode="xray" title="Transparent / X-ray on/off">◑</button><button class="wb-tool" data-3dmode="section" title="Section clip on/off">▤</button>'
      + '<button class="wb-tool" data-3dexp="obj" title="Export 3D model as OBJ" style="width:auto;padding:0 8px;">OBJ</button>'
      + '<span class="wb-tsep"></span>'
      + '<label class="wb-tool" title="Line colour — click a 3D line first for one line, or use ALL" style="width:auto;padding:0 6px;gap:5px;display:inline-flex;align-items:center;font-weight:700;cursor:pointer;">🎨<input type="color" id="wb-3dline-col" value="#b8c0cc" style="width:26px;height:20px;padding:0;border:none;background:none;cursor:pointer"/></label>'
      + '<button class="wb-tool" id="wb-3dline-all" title="Apply colour to ALL lines" style="width:auto;padding:0 8px;">ALL LINES</button>'
      + '</span>'
      + '<button class="wb-run" data-a="calc">▶ RUN ANALYSIS</button>'
      + '</div>'
      + '<div class="wb-body">'
      + '  <div class="wb-palette">' + palette + '</div>'
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
      + '    <canvas id="wb-3d-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:none;background:#0b1220;cursor:grab;"></canvas>'
      + '    <div class="wb-scalebar" id="wb-scalebar"><div class="wb-scalebar-line"><span id="wb-scale-len">1.0 m</span></div><span id="wb-scale-zoom" class="wb-scale-zoom">100%</span></div>'
      + '    <svg class="wb-triad" id="wb-triad" viewBox="0 0 70 70" width="70" height="70"></svg>'
      + '  </div>'
      + '  <div class="wb-props"><div class="wb-props-head">PROPERTIES</div><div id="wb-prop-body"></div></div>'
      + '</div>'
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
  function toolBtn(m, ic, t) { return '<button class="wb-tool" data-mode="' + m + '" title="' + t + '">' + ic + '</button>'; }
  function actBtn(a, ic, t) { return '<button class="wb-tool" data-a="' + a + '" title="' + t + '">' + ic + '</button>'; }
  function toggleBtn(k, ic, t, on) { return '<button class="wb-tool wb-toggle' + (on ? ' on' : '') + '" data-toggle="' + k + '" title="' + t + '">' + ic + '</button>'; }

  function wireUI(root) {
    // menu actions
    root.querySelectorAll('[data-a]').forEach(function (el) {
      el.addEventListener('click', function () {
        var a = el.getAttribute('data-a');
        ({ new: WB.newProject, open: WB.open, save: WB.save, import: WB.import, clearbd: WB.clearBackdrop,
          flowsheets: WB.flowsheetBrowser,
          calc: WB.runAnalysis, bom: WB.bom, report: WB.report, undo: WB.undo, redo: WB.redo, delete: WB.deleteSel,
          zoomin: function () { WB.zoom = Math.min(3, WB.zoom * 1.2); render(); },
          zoomout: function () { WB.zoom = Math.max(0.3, WB.zoom / 1.2); render(); },
          fit: function () { WB.zoom = 1; WB.panX = 0; WB.panY = 0; render(); } }[a] || function () {})();
      });
    });
    // tool modes
    root.querySelectorAll('[data-mode]').forEach(function (el) {
      el.addEventListener('click', function () {
        WB.mode = el.getAttribute('data-mode');
        root.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('active', b === el); });
        WB.pendingPort = null; render();
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
    var btn2d = root.querySelector('#wb-mode2d'), btn3d = root.querySelector('#wb-mode3d');
    function set3D(on) {
      WB.mode3d = on;
      // Keep the SVG in the render tree (visibility, not display:none) so its
      // <defs> gradients/filters stay available to the library thumbnails while
      // in 3D — the opaque 3D canvas sits on top and hides the 2D flowsheet.
      if (svgEl) { svgEl.style.visibility = on ? 'hidden' : 'visible'; svgEl.style.display = 'block'; }
      if (canvas3d) canvas3d.style.display = on ? 'block' : 'none';
      only3d.forEach(function (e) { e.style.display = on ? 'inline' : 'none'; });
      if (btn3d) btn3d.classList.toggle('active', on);
      if (btn2d) btn2d.classList.toggle('active', !on);
      if (on && window.ARO3D) {
        window.ARO3D.onSelect = function (props, tris) {
          if (!propEl) return;
          if (!props) { propEl.innerHTML = '<div class="wb-prop-empty">Click a 3D object to see its properties, or drag equipment from the library.</div>'; return; }
          propEl.innerHTML = '<div class="wb-prop-title">' + (props.Type || '3D Equipment') + '</div>'
            + Object.keys(props).map(function (k) { return '<div class="wb-rrow"><span>' + k + '</span><b>' + props[k] + '</b></div>'; }).join('')
            + '<div class="wb-prop-note">Real Three.js mesh · ' + tris + ' triangles · PBR material. Left-drag orbit · wheel zoom · click select.</div>';
        };
        // 3D connections made by the user get written back into the shared 2D model
        window.ARO3D.onConnect = function (fromNid, toNid) {
          var a = nodeById(fromNid), b = nodeById(toNid); if (!a || !b) return;
          if (WB.pipes.some(function (p) { return p.from.id === fromNid && p.to.id === toNid; })) return;
          var fp = outPortIndex(a.t), tp = inPortIndex(b.t);
          WB.pipes.push({ id: 'L' + (++WB.seq), from: { id: fromNid, pi: fp }, to: { id: toNid, pi: tp }, role: 'process', tag: 'L-' + WB.seq });
        };
        window.ARO3D.embed(canvas3d, function (m) { setStatus(m, '#38bdf8'); });
        // carry the ENTIRE current flowsheet (equipment + connections) into 3D
        window.ARO3D.buildFromModel(WB.nodes, WB.pipes, function (t) { var l = LIB_INDEX[t]; return l ? l.n : t; });
        setTimeout(function () { window.ARO3D.resize(); }, 30);
        setStatus('REAL 3D MODE — your full flowsheet (' + WB.nodes.length + ' equipment, ' + WB.pipes.length + ' lines) is now in 3D. Drag equipment from the library to add more; use 🔗 PIPE to connect.', '#38bdf8');
      } else {
        setStatus('2D flowsheet mode.', '#94a3b8');
        render();
      }
    }
    if (btn3d) btn3d.addEventListener('click', function () { if (!window.ARO3D) { alert('3D engine not loaded.'); return; } set3D(true); });
    if (btn2d) btn2d.addEventListener('click', function () { set3D(false); });
    // 3D view / display / export controls
    root.querySelectorAll('[data-3dview]').forEach(function (b) { b.addEventListener('click', function () { window.ARO3D && window.ARO3D.view(b.getAttribute('data-3dview')); }); });
    root.querySelectorAll('[data-3dmode]').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); window.ARO3D && window.ARO3D.setMode(b.getAttribute('data-3dmode'), b.classList.contains('on')); }); });
    root.querySelectorAll('[data-3dexp]').forEach(function (b) { b.addEventListener('click', function () { window.ARO3D && window.ARO3D.exportOBJ(); }); });
    var pipeBtn = root.querySelector('#wb-3dpipe');
    if (pipeBtn) pipeBtn.addEventListener('click', function () { pipeBtn.classList.toggle('on'); window.ARO3D && window.ARO3D.setPipeMode(pipeBtn.classList.contains('on')); });
    // 3D per-equipment 360° rotation (rotates the clicked equipment about its axis)
    var rotL = root.querySelector('#wb-3drotl'), rotR = root.querySelector('#wb-3drotr');
    if (rotL) rotL.addEventListener('click', function () { window.ARO3D && window.ARO3D.rotateSelected(-45); });
    if (rotR) rotR.addEventListener('click', function () { window.ARO3D && window.ARO3D.rotateSelected(45); });
    // 3D line colour — single (selected line) or all lines, kept in sync with the 2D model
    var lineCol = root.querySelector('#wb-3dline-col');
    if (lineCol) {
      // reflect the selected 3D line's colour into the picker
      if (window.ARO3D) window.ARO3D.onPipeSelect = function (pid) {
        var p = pid && pipeById(pid); if (p && p.color) lineCol.value = p.color;
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
    btn2d && btn2d.classList.add('active');
    // background colour — free picker (any colour the user wants)
    var bgInput = root.querySelector('#wb-bg-input');
    if (bgInput) bgInput.addEventListener('input', function () {
      WB.bgColor = bgInput.value; setStatus('Background: ' + WB.bgColor, '#0369a1'); render();
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
    // palette drag
    root.querySelectorAll('.wb-lib').forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/aro-t', el.getAttribute('data-t')); });
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
        window.ARO3D.addByType(t, lib ? lib.n : t, n3.id);   // real 3D mesh, keyed to the node
        return;
      }
      var pt = clientToWorld(e.clientX, e.clientY); addNode(t, pt.x, pt.y);
    });
    // canvas interactions
    svg.addEventListener('mousedown', onDown);
    svg.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    svg.addEventListener('wheel', function (e) { e.preventDefault(); var f = e.deltaY < 0 ? 1.1 : 0.9; WB.zoom = Math.max(0.3, Math.min(3, WB.zoom * f)); render(); }, { passive: false });
    svg.addEventListener('click', onClick);
    window.addEventListener('keydown', function (e) {
      if (document.getElementById('workbench-tab') && !document.getElementById('workbench-tab').classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { WB.deleteSel(); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { WB.undo(); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { WB.redo(); e.preventDefault(); }
    });
  }

  function clientToWorld(cx, cy) {
    var r = svg.getBoundingClientRect();
    return { x: (cx - r.left - WB.panX) / WB.zoom, y: (cy - r.top - WB.panY) / WB.zoom };
  }

  var drag = null, panning = null, spaceDown = false, connecting = false, justConnected = false, rotating = null, viewRot = null;
  window.addEventListener('keydown', function (e) { if (e.code === 'Space') spaceDown = true; });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space') spaceDown = false; });

  function portRef(portEl) { var p = portEl.getAttribute('data-port').split(':'); return { id: p[0], pi: parseInt(p[1]) }; }
  // Create a line between two ports (rejects a port joined to itself)
  function connectPorts(from, to) {
    if (from.id === to.id && from.pi === to.pi) return false;
    pushUndo();
    var fromN = nodeById(from.id);
    var fromPort = fromN ? LIB_INDEX[fromN.t].ports[from.pi] : null;
    var role = fromPort ? fromPort.role : 'io';
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
    // Drag-to-connect: press on ANY port (any mode) to start a wire
    if (portEl) { WB.pendingPort = portRef(portEl); connecting = true; WB.rubberXY = clientToWorld(e.clientX, e.clientY); render(); e.preventDefault(); return; }
    // 360° free-rotate: drag empty canvas to spin the whole view
    if (WB.rotate360 && !e.target.closest('[data-node]') && !e.target.closest('[data-pipe]')) {
      viewRot = { x: e.clientX, start: WB.viewRotate || 0 }; return;
    }
    if (spaceDown || WB.mode === 'pan' || e.button === 1) { panning = { x: e.clientX, y: e.clientY, px: WB.panX, py: WB.panY }; return; }
    var g = e.target.closest('[data-node]');
    if (g && WB.mode === 'select') {
      var n = nodeById(g.getAttribute('data-node'));
      if (n) { WB.sel = { kind: 'node', id: n.id }; var w = clientToWorld(e.clientX, e.clientY); drag = { id: n.id, dx: w.x - n.x, dy: w.y - n.y, moved: false }; renderProps(); render(); }
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
    if (drag) { var w = clientToWorld(e.clientX, e.clientY); var n = nodeById(drag.id); if (n) { n.x = snapV(w.x - drag.dx); n.y = snapV(w.y - drag.dy); drag.moved = true; render(); } }
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
    drag = null; panning = null;
  }

  function onClick(e) {
    var portEl = e.target.closest('[data-port]');
    // click-click connect in Pipe mode (fallback to drag-to-connect elsewhere)
    if (WB.mode === 'pipe' && portEl && !justConnected) {
      var ref = portRef(portEl);
      if (!WB.pendingPort) { WB.pendingPort = ref; render(); }
      else if (WB.pendingPort.id === ref.id && WB.pendingPort.pi === ref.pi) { WB.pendingPort = null; render(); }
      else { if (connectPorts(WB.pendingPort, ref)) WB.pendingPort = null; render(); renderProps(); }
      return;
    }
    var pipeEl = e.target.closest('[data-pipe]');
    if (pipeEl && WB.mode === 'select') { WB.sel = { kind: 'pipe', id: pipeEl.getAttribute('data-pipe') }; renderProps(); render(); return; }
    if (!e.target.closest('[data-node]') && !pipeEl && !portEl) { WB.sel = null; renderProps(); render(); }
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
    '.wb-toolbar{display:flex;align-items:center;gap:4px;background:#e2e8f0;border-bottom:1px solid #cbd5e1;padding:5px 10px;flex-wrap:wrap;}',
    '.wb-tool{width:30px;height:30px;border:1px solid #cbd5e1;background:#fff;border-radius:5px;cursor:pointer;font-size:14px;color:#334155;display:inline-flex;align-items:center;justify-content:center;}',
    '.wb-tool:hover{background:#f8fafc;border-color:#94a3b8;}',
    '.wb-tool.active{background:#ff7538;color:#fff;border-color:#ea580c;}',
    '.wb-view.active{background:#1e3a5f;color:#fff;border-color:#0f172a;}',
    '.wb-scalebar{position:absolute;left:10px;bottom:38px;display:flex;align-items:center;gap:8px;font-family:monospace;font-size:10px;color:#334155;pointer-events:none;}',
    '.wb-scalebar-line{position:relative;width:60px;height:8px;border:1.5px solid currentColor;border-top:none;}',
    '.wb-scalebar-line span{position:absolute;top:-14px;left:0;white-space:nowrap;}',
    '.wb-scale-zoom{font-weight:700;background:rgba(148,163,184,0.2);padding:1px 5px;border-radius:3px;}',
    '.wb-triad{position:absolute;right:8px;bottom:36px;cursor:grab;z-index:6;}',
    '.wb-triad:active{cursor:grabbing;}',
    '.wb-tool.wb-toggle.on{background:#0d9488;color:#fff;border-color:#0f766e;}',
    '.wb-tsep{width:1px;height:22px;background:#cbd5e1;margin:0 4px;}',
    '.wb-run{margin-left:auto;background:linear-gradient(135deg,#166534,#22c55e);color:#fff;border:none;padding:7px 16px;border-radius:5px;font-weight:700;font-size:12px;cursor:pointer;font-family:monospace;letter-spacing:0.04em;}',
    '.wb-body{flex:1;display:grid;grid-template-columns:var(--wb-pal,212px) 7px 1fr 252px;min-height:0;}',
    '.wb-resizer{cursor:col-resize;background:#cbd5e1;border-left:1px solid #94a3b8;border-right:1px solid #94a3b8;transition:background .12s;}',
    '.wb-resizer:hover,.wb-resizer.dragging{background:#ff7538;}',
    '.wb-palette{background:#f8fafc;border-right:1px solid #cbd5e1;overflow-y:auto;padding:6px;}',
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
    '.wb-stream-conn i{color:#cbd5e1;}',
    '.wb-legend{display:flex;flex-wrap:wrap;gap:8px;padding:6px 10px;background:#eef2f7;border-top:1px solid #e2e8f0;font-size:9px;}',
    '.wb-legend span{display:inline-flex;align-items:center;gap:3px;color:#475569;}',
    '.wb-legend i{width:9px;height:9px;border-radius:50%;display:inline-block;}',
    '.wb-field{display:flex;flex-direction:column;gap:2px;margin-bottom:8px;}',
    '.wb-field span{font-size:10px;font-weight:600;color:#475569;}',
    '.wb-field input,.wb-field select{border:1px solid #cbd5e1;border-radius:4px;padding:5px 7px;font-size:12px;color:#0f172a;background:#fff;}',
    '.wb-field input:focus,.wb-field select:focus{outline:none;border-color:#ff7538;}',
    '.wb-prop-result{margin-top:8px;border-top:1px dashed #cbd5e1;padding-top:6px;}',
    '.wb-rrow{display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:#475569;}',
    '.wb-rrow b{color:#0f172a;font-family:monospace;}',
    '.wb-rrow.warn b{color:#dc2626;}',
    '.wb-statusbar{background:#0f172a;color:#94a3b8;font-family:monospace;font-size:11px;padding:6px 12px;border-top:1px solid #1e293b;}',
    '.wb-modal{position:fixed;inset:0;background:rgba(2,6,18,0.75);z-index:100002;display:flex;align-items:center;justify-content:center;padding:20px;}',
    '.wb-modal-box{background:#fff;border-radius:10px;width:96%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;}',
    '.wb-modal-head{display:flex;justify-content:space-between;align-items:center;background:#0f172a;color:#ff7538;padding:12px 16px;font-weight:800;font-size:14px;font-family:monospace;}',
    '.wb-modal-x{background:transparent;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;}',
    '.wb-modal-body{padding:16px;overflow-y:auto;}',
    '.wb-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e2e8f0;}',
    '.wb-btn{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;padding:8px 18px;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer;}',
    '.wb-btn-mut{background:#64748b;}',
    '.wb-table{width:100%;border-collapse:collapse;margin:4px 0 10px;}',
    '.wb-table th,.wb-table td{border:1px solid #e2e8f0;padding:5px 8px;font-size:11.5px;text-align:left;color:#1e293b;}',
    '.wb-table th{background:#eef2f7;font-weight:700;}',
    '.wb-rep-head{font-size:16px;font-weight:800;color:#ea580c;text-align:center;}',
    '.wb-rep-sub{font-size:10px;color:#64748b;text-align:center;margin-bottom:10px;}',
    '.wb-rep-verdict{border:1.5px solid;border-radius:6px;padding:8px 12px;font-size:12px;font-weight:700;text-align:center;margin-bottom:12px;}',
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

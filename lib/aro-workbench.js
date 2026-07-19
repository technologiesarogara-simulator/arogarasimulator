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
    pendingPort: null, undoStack: [], redoStack: [], initialized: false, backdrop: null };

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
  var LIB = {
    'Equipment': [
      { t: 'pump', n: 'Centrifugal Pump', w: 64, h: 54, ports: [P(0, 34, 'w', 'in', 'Suction'), P(34, 4, 'n', 'out', 'Discharge')],
        draw: function () { return '<rect x="6" y="46" width="52" height="6" rx="1" fill="#334155"/><circle cx="34" cy="34" r="19" fill="url(#wbPumpG)" stroke="#312e81" stroke-width="2"/><path d="M34 34 L34 15 M34 34 L50 44 M34 34 L18 44" stroke="#e0e7ff" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="34" cy="34" r="4" fill="#312e81"/><rect x="2" y="30" width="10" height="8" fill="#475569"/>'; } },
      { t: 'pump-ms', n: 'Multistage Pump', w: 78, h: 50, ports: [P(0, 34, 'w', 'in', 'Suction'), P(78, 34, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="48" width="62" height="4" fill="#334155"/><rect x="8" y="18" width="62" height="30" rx="6" fill="url(#wbPumpG)" stroke="#312e81" stroke-width="2"/><circle cx="24" cy="33" r="8" fill="#6366f1" stroke="#e0e7ff" stroke-width="1.5"/><circle cx="40" cy="33" r="8" fill="#6366f1" stroke="#e0e7ff" stroke-width="1.5"/><circle cx="56" cy="33" r="8" fill="#6366f1" stroke="#e0e7ff" stroke-width="1.5"/>'; } },
      { t: 'pd-pump', n: 'PD / Gear Pump', w: 62, h: 52, ports: [P(0, 40, 'w', 'in', 'Inlet'), P(62, 40, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="48" width="46" height="4" fill="#334155"/><circle cx="31" cy="28" r="20" fill="url(#wbPumpG)" stroke="#312e81" stroke-width="2"/><circle cx="24" cy="28" r="8" fill="none" stroke="#e0e7ff" stroke-width="1.5"/><circle cx="38" cy="28" r="8" fill="none" stroke="#e0e7ff" stroke-width="1.5"/><path d="M24 20 v16 M38 20 v16" stroke="#e0e7ff" stroke-width="1"/>'; } },
      { t: 'compressor', n: 'Compressor', w: 68, h: 56, ports: [P(0, 44, 'w', 'in', 'Suction'), P(68, 24, 'e', 'out', 'Discharge')],
        draw: function () { return '<rect x="8" y="50" width="52" height="4" fill="#334155"/><path d="M10 46 L10 14 L58 24 L58 46 Z" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="2"/><text x="32" y="40" font-size="11" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">C</text>'; } },
      { t: 'blower', n: 'Blower / Fan', w: 58, h: 54, ports: [P(0, 42, 'w', 'in', 'Inlet'), P(58, 42, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="6" y="50" width="46" height="4" fill="#334155"/><circle cx="29" cy="30" r="20" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="2"/><path d="M29 30 L29 11 M29 30 L46 41 M29 30 L12 41" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="29" cy="30" r="4" fill="#0369a1"/>'; } },
      { t: 'sthe', n: 'Shell & Tube HX', w: 96, h: 50, ports: [P(0, 25, 'w', 'cold-in', 'Tube In'), P(96, 25, 'e', 'cold-out', 'Tube Out'), P(24, 0, 'n', 'hot-in', 'Shell In'), P(72, 50, 's', 'hot-out', 'Shell Out')],
        draw: function () { return '<rect x="8" y="12" width="80" height="26" rx="13" fill="#eef2f7" stroke="#334155" stroke-width="2"/><rect x="8" y="12" width="10" height="26" fill="#cbd5e1" stroke="#334155" stroke-width="1"/><rect x="78" y="12" width="10" height="26" fill="#cbd5e1" stroke="#334155" stroke-width="1"/><path d="M20 25 h58 M28 16 v18 M40 16 v18 M52 16 v18 M64 16 v18" stroke="#94a3b8" stroke-width="1"/><path d="M14 44 l6 -6 m20 6 l6 -6 m20 6 l6 -6" stroke="#64748b" stroke-width="2"/>'; } },
      { t: 'dphe', n: 'Double Pipe HX', w: 92, h: 38, ports: [P(0, 19, 'w', 'cold-in', 'Inner In'), P(92, 19, 'e', 'cold-out', 'Inner Out'), P(16, 0, 'n', 'hot-in', 'Annulus In'), P(76, 38, 's', 'hot-out', 'Annulus Out')],
        draw: function () { return '<rect x="6" y="8" width="80" height="22" rx="11" fill="#eef2f7" stroke="#334155" stroke-width="2"/><line x1="10" y1="19" x2="82" y2="19" stroke="#64748b" stroke-width="3"/><path d="M16 8 v22 M76 8 v22" stroke="#cbd5e1" stroke-width="1.5"/>'; } },
      { t: 'phe', n: 'Plate HX', w: 54, h: 58, ports: [P(0, 14, 'w', 'hot-in', 'Hot In'), P(54, 44, 'e', 'hot-out', 'Hot Out'), P(0, 44, 'w', 'cold-in', 'Cold In'), P(54, 14, 'e', 'cold-out', 'Cold Out')],
        draw: function () { return '<rect x="12" y="6" width="30" height="46" rx="2" fill="#eef2f7" stroke="#334155" stroke-width="2"/><path d="M17 6 v46 M22 6 v46 M27 6 v46 M32 6 v46 M37 6 v46" stroke="#94a3b8" stroke-width="1.4"/><rect x="8" y="6" width="4" height="46" fill="#334155"/><rect x="42" y="6" width="4" height="46" fill="#334155"/>'; } },
      { t: 'aircooler', n: 'Air Cooler', w: 82, h: 50, ports: [P(0, 36, 'w', 'in', 'Inlet'), P(82, 36, 'e', 'out', 'Outlet')],
        draw: function () { return '<rect x="8" y="22" width="66" height="20" rx="4" fill="#eef2f7" stroke="#334155" stroke-width="2"/><path d="M14 32 h54" stroke="#94a3b8" stroke-width="1"/><circle cx="28" cy="12" r="9" fill="none" stroke="#0369a1" stroke-width="1.5"/><path d="M28 12 l0 -9 m0 9 l8 4 m-8 -4 l-8 4" stroke="#0369a1" stroke-width="1.5"/><circle cx="54" cy="12" r="9" fill="none" stroke="#0369a1" stroke-width="1.5"/><path d="M54 12 l0 -9 m0 9 l8 4 m-8 -4 l-8 4" stroke="#0369a1" stroke-width="1.5"/>'; } },
      { t: 'reboiler', n: 'Reboiler', w: 82, h: 48, ports: [P(0, 24, 'w', 'in', 'Liquid In'), P(82, 24, 'e', 'liq', 'Liquid Out'), P(41, 0, 'n', 'vap', 'Vapor Out'), P(20, 48, 's', 'hot-in', 'Steam In')],
        draw: function () { return '<rect x="8" y="10" width="66" height="30" rx="15" fill="#fff7ed" stroke="#9a3412" stroke-width="2"/><path d="M18 26 q6 -9 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#9a3412" stroke-width="1.5"/><path d="M14 34 l4 4 m10 -4 l4 4 m10 -4 l4 4" stroke="#9a3412" stroke-width="1.5"/>'; } }
    ],
    'Vessels & Tanks': [
      { t: 'v-vessel', n: 'Vertical Vessel', w: 50, h: 78, ports: [P(25, 0, 'n', 'in', 'Feed'), P(25, 78, 's', 'out', 'Product'), P(46, 14, 'e', 'vent', 'Vent'), P(4, 66, 'w', 'drain', 'Drain')],
        draw: function () { return '<path d="M10 16 q15 -12 30 0 v46 q-15 12 -30 0 Z" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><ellipse cx="25" cy="16" rx="15" ry="5" fill="none" stroke="#1e40af" stroke-width="1.5"/><path d="M12 46 h26" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 2"/><rect x="18" y="70" width="14" height="8" fill="#94a3b8"/>'; } },
      { t: 'h-vessel', n: 'Horizontal Vessel', w: 90, h: 46, ports: [P(0, 23, 'w', 'in', 'Feed'), P(90, 23, 'e', 'out', 'Product'), P(45, 0, 'n', 'vent', 'Vent'), P(45, 46, 's', 'drain', 'Drain')],
        draw: function () { return '<path d="M14 8 h62 q14 15 0 30 h-62 q-14 -15 0 -30 Z" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M18 30 h54" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 2"/><path d="M28 38 v6 M62 38 v6" stroke="#64748b" stroke-width="3"/>'; } },
      { t: 'separator', n: 'Separator / KO Drum', w: 90, h: 50, ports: [P(0, 32, 'w', 'in', 'Feed'), P(90, 12, 'e', 'vap', 'Gas Out'), P(45, 50, 's', 'liq', 'Liquid Out')],
        draw: function () { return '<path d="M14 8 h62 q14 17 0 34 h-62 q-14 -17 0 -34 Z" fill="url(#wbGasG)" stroke="#0369a1" stroke-width="2"/><line x1="18" y1="28" x2="72" y2="28" stroke="#0369a1" stroke-dasharray="3 2"/><path d="M30 12 q8 4 16 0 t14 2" fill="none" stroke="#0369a1" stroke-width="1"/><rect x="40" y="14" width="10" height="10" fill="none" stroke="#0369a1" stroke-width="1"/>'; } },
      { t: 'atm-tank', n: 'Atmospheric Tank', w: 74, h: 68, ports: [P(0, 56, 'w', 'out', 'Outlet'), P(37, 0, 'n', 'in', 'Fill'), P(66, 12, 'e', 'vent', 'Vent'), P(37, 68, 's', 'drain', 'Drain')],
        draw: function () { return '<rect x="10" y="12" width="52" height="50" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><ellipse cx="36" cy="12" rx="26" ry="6" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/><path d="M12 40 h48" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 2"/>'; } },
      { t: 'cone-tank', n: 'Cone Roof Tank', w: 76, h: 70, ports: [P(0, 58, 'w', 'out', 'Outlet'), P(38, 70, 's', 'drain', 'Drain'), P(38, 2, 'n', 'in', 'Fill'), P(66, 24, 'e', 'vent', 'Vent')],
        draw: function () { return '<path d="M12 22 L38 6 L64 22 Z" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/><rect x="12" y="22" width="52" height="42" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M14 44 h48" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 2"/>'; } },
      { t: 'bullet', n: 'Bullet Tank', w: 96, h: 42, ports: [P(0, 21, 'w', 'in', 'Inlet'), P(96, 21, 'e', 'out', 'Outlet'), P(48, 0, 'n', 'vent', 'PSV/Vent'), P(24, 42, 's', 'drain', 'Drain')],
        draw: function () { return '<path d="M22 8 h52 a13 13 0 0 1 0 26 h-52 a13 13 0 0 1 0 -26 Z" fill="url(#wbLiqG)" stroke="#1e40af" stroke-width="2"/><path d="M22 8 v26 M74 8 v26" stroke="#93c5fd" stroke-width="1"/><path d="M32 38 v4 M64 38 v4" stroke="#64748b" stroke-width="3"/>'; } },
      { t: 'silo', n: 'Silo / Hopper', w: 62, h: 74, ports: [P(31, 0, 'n', 'in', 'Fill'), P(31, 74, 's', 'out', 'Discharge')],
        draw: function () { return '<rect x="12" y="8" width="38" height="40" fill="#f1f5f9" stroke="#475569" stroke-width="2"/><path d="M12 48 L31 70 L50 48 Z" fill="#e2e8f0" stroke="#475569" stroke-width="2"/><path d="M14 24 h36 M14 34 h36" stroke="#cbd5e1" stroke-width="1"/>'; } }
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
      { t: 'gate', n: 'Gate Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 4 L4 28 L21 16 Z M38 4 L38 28 L21 16 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/><rect x="18" y="0 " width="6" height="6" fill="#1e293b"/>'; } },
      { t: 'ball', n: 'Ball Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 6 L4 26 L21 16 Z M38 6 L38 26 L21 16 Z" fill="#0d9488" stroke="#134e4a" stroke-width="1.5"/><circle cx="21" cy="16" r="8" fill="#14b8a6" stroke="#134e4a" stroke-width="1.5"/><line x1="21" y1="8" x2="21" y2="24" stroke="#fff" stroke-width="1.5"/>'; } },
      { t: 'globe', n: 'Globe Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 6 L4 26 L21 16 Z M38 6 L38 26 L21 16 Z" fill="#475569" stroke="#1e293b" stroke-width="1.5"/><circle cx="21" cy="16" r="7" fill="#94a3b8" stroke="#1e293b" stroke-width="1.5"/><rect x="18" y="2" width="6" height="5" fill="#1e293b"/>'; } },
      { t: 'butterfly', n: 'Butterfly Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<circle cx="21" cy="16" r="13" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.5"/><line x1="12" y1="8" x2="30" y2="24" stroke="#1e293b" stroke-width="3"/><circle cx="21" cy="16" r="2.5" fill="#1e293b"/>'; } },
      { t: 'check', n: 'Check Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 6 L4 26 L21 16 Z M38 6 L38 26 L21 16 Z" fill="#d97706" stroke="#92400e" stroke-width="1.5"/><circle cx="14" cy="16" r="3" fill="#92400e"/><path d="M6 20 L20 8" stroke="#92400e" stroke-width="1.5"/>'; } },
      { t: 'control', n: 'Control Valve', w: 42, h: 48, ports: [P(0, 34, 'w', 'in', 'In'), P(42, 34, 'e', 'out', 'Out'), P(21, 0, 'n', 'signal', 'Signal')],
        draw: function () { return '<path d="M4 24 L4 44 L21 34 Z M38 24 L38 44 L21 34 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/><rect x="11" y="6" width="20" height="12" rx="6" fill="#94a3b8" stroke="#1e293b" stroke-width="1.5"/><line x1="21" y1="18" x2="21" y2="34" stroke="#1e293b" stroke-width="2"/>'; } },
      { t: 'psv', n: 'PSV / Relief', w: 42, h: 48, ports: [P(0, 38, 'w', 'in', 'In'), P(20, 0, 'n', 'vent', 'Vent')],
        draw: function () { return '<path d="M6 30 L6 44 L26 44 L26 30 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5"/><line x1="16" y1="30" x2="16" y2="8" stroke="#7f1d1d" stroke-width="2"/><path d="M10 14 L22 14 L16 4 Z" fill="#fca5a5" stroke="#7f1d1d" stroke-width="1.5"/><path d="M8 22 h16" stroke="#7f1d1d" stroke-width="1.5"/>'; } },
      { t: '3way', n: 'Three-way Valve', w: 42, h: 42, ports: [P(0, 21, 'w', 'in', 'In'), P(42, 21, 'e', 'out', 'Out A'), P(21, 42, 's', 'out', 'Out B')],
        draw: function () { return '<path d="M4 11 L4 31 L21 21 Z M38 11 L38 31 L21 21 Z M11 38 L31 38 L21 21 Z" fill="#0d9488" stroke="#134e4a" stroke-width="1.5"/><circle cx="21" cy="21" r="3" fill="#fff"/>'; } },
      { t: 'needle', n: 'Needle Valve', w: 42, h: 32, ports: [P(0, 16, 'w', 'in', 'In'), P(42, 16, 'e', 'out', 'Out')],
        draw: function () { return '<path d="M4 6 L4 26 L21 16 Z M38 6 L38 26 L21 16 Z" fill="#334155" stroke="#0f172a" stroke-width="1.5"/><path d="M21 4 L24 16 L21 16 Z" fill="#0f172a"/><rect x="18" y="0" width="6" height="5" fill="#0f172a"/>'; } }
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
  function restore(s) { var o = JSON.parse(s); WB.nodes = o.nodes; WB.pipes = o.pipes; WB.seq = o.seq; WB.sel = null; render(); renderProps(); }
  WB.undo = function () { if (!WB.undoStack.length) return; WB.redoStack.push(snapshot()); restore(WB.undoStack.pop()); };
  WB.redo = function () { if (!WB.redoStack.length) return; WB.undoStack.push(snapshot()); restore(WB.redoStack.pop()); };

  /* ───────────── Geometry helpers ───────────── */
  function snapV(v) { return WB.snap ? Math.round(v / WB.grid) * WB.grid : v; }
  function nodeById(id) { for (var i = 0; i < WB.nodes.length; i++) if (WB.nodes[i].id === id) return WB.nodes[i]; return null; }
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
      cooltower: 'CT', boiler: 'BL', ejector: 'EJ', mixer: 'MX', agitator: 'AG' }[t] || 'X';
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
    render(); renderProps();
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
    WB.sel = null; render(); renderProps();
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
    s += '<rect x="-4000" y="-4000" width="8000" height="8000" fill="url(#wbGrid)"/>';
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
      var col = p.status === 'high' ? '#dc2626' : (p.status === 'ok' ? '#16a34a' : roleCol);
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
      s += '<g transform="' + bodyTf + '">';
      if (selc) s += '<rect x="-6" y="-6" width="' + (lib.w + 12) + '" height="' + (lib.h + 12) + '" fill="none" stroke="#ff7538" stroke-width="' + (1.5 / sc) + '" stroke-dasharray="4 3" rx="4"/>';
      s += lib.draw();
      s += '</g>';
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
    gWorld.setAttribute('transform', 'translate(' + WB.panX + ',' + WB.panY + ') scale(' + WB.zoom + ')');
    updateCount();
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
        render();
      });
    });
  }
  function field(label, key, val, type) {
    return '<label class="wb-field"><span>' + label + '</span><input data-f="' + key + '" type="' + type + '" value="' + (val === undefined ? '' : val) + '" step="any"/></label>';
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
  WB.newProject = function () { if (WB.nodes.length && !confirm('Start a new project? Unsaved work will be lost.')) return; pushUndo(); WB.nodes = []; WB.pipes = []; WB.seq = 0; WB.sel = null; WB.backdrop = null; render(); renderProps(); setStatus('New project.', '#94a3b8'); };
  WB.save = function () {
    var data = JSON.stringify({ v: 1, nodes: WB.nodes, pipes: WB.pipes, seq: WB.seq }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aro-workbench-project.json'; a.click();
    try { localStorage.setItem('aroWorkbenchProject', data); } catch (e) {}
    setStatus('Project saved (download + browser storage).', '#16a34a');
  };
  WB.open = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { try { var o = JSON.parse(r.result); pushUndo(); WB.nodes = o.nodes || []; WB.pipes = o.pipes || []; WB.seq = o.seq || 0; WB.sel = null; render(); renderProps(); setStatus('Project loaded: ' + f.name, '#16a34a'); } catch (e) { alert('Could not read project file.'); } }; r.readAsText(f); };
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
        palette += '<div class="wb-lib" draggable="true" data-t="' + it.t + '" title="' + it.n + '"><svg viewBox="0 0 ' + it.w + ' ' + (it.h + 16) + '">' + it.draw() + '</svg><span>' + it.n + '</span></div>';
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
      + '<button class="wb-run" data-a="calc">▶ RUN ANALYSIS</button>'
      + '</div>'
      + '<div class="wb-body">'
      + '  <div class="wb-palette">' + palette + '</div>'
      + '  <div class="wb-canvas-wrap">'
      + '    <svg id="wb-svg" class="wb-canvas"><defs>'
      + '      <pattern id="wbGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 L0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="1"/></pattern>'
      + '      <linearGradient id="wbPumpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4338ca"/></linearGradient>'
      + '      <linearGradient id="wbGasG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>'
      + '      <linearGradient id="wbLiqG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#bfdbfe"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient>'
      + '      <linearGradient id="wbColG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ddd6fe"/><stop offset="100%" stop-color="#c4b5fd"/></linearGradient>'
      + '      <linearGradient id="wbRxG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#fbbf24"/></linearGradient>'
      + '    </defs><g id="wb-world"></g></svg>'
      + '    <div class="wb-hint">Drag component ▸ drop on canvas · <b>drag from one port to another to connect</b> · click equipment for its zoom/rotate + streams · Flowsheets menu ▸ load a refinery template · scroll = zoom · space-drag = pan</div>'
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
    // toggles
    root.querySelectorAll('[data-toggle]').forEach(function (el) {
      el.addEventListener('click', function () { var k = el.getAttribute('data-toggle'); WB[k] = !WB[k]; el.classList.toggle('on', WB[k]); render(); });
    });
    // palette drag
    root.querySelectorAll('.wb-lib').forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/aro-t', el.getAttribute('data-t')); });
    });
    var wrap = root.querySelector('.wb-canvas-wrap');
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); });
    wrap.addEventListener('drop', function (e) {
      e.preventDefault(); var t = e.dataTransfer.getData('text/aro-t'); if (!t) return;
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

  var drag = null, panning = null, spaceDown = false, connecting = false, justConnected = false;
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
    var portEl = e.target.closest('[data-port]');
    // Drag-to-connect: press on ANY port (any mode) to start a wire
    if (portEl) { WB.pendingPort = portRef(portEl); connecting = true; WB.rubberXY = clientToWorld(e.clientX, e.clientY); render(); e.preventDefault(); return; }
    if (spaceDown || WB.mode === 'pan' || e.button === 1) { panning = { x: e.clientX, y: e.clientY, px: WB.panX, py: WB.panY }; return; }
    var g = e.target.closest('[data-node]');
    if (g && WB.mode === 'select') {
      var n = nodeById(g.getAttribute('data-node'));
      if (n) { WB.sel = { kind: 'node', id: n.id }; var w = clientToWorld(e.clientX, e.clientY); drag = { id: n.id, dx: w.x - n.x, dy: w.y - n.y, moved: false }; renderProps(); render(); }
    }
  }
  function onMove(e) {
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
    '.wb-tool.wb-toggle.on{background:#0d9488;color:#fff;border-color:#0f766e;}',
    '.wb-tsep{width:1px;height:22px;background:#cbd5e1;margin:0 4px;}',
    '.wb-run{margin-left:auto;background:linear-gradient(135deg,#166534,#22c55e);color:#fff;border:none;padding:7px 16px;border-radius:5px;font-weight:700;font-size:12px;cursor:pointer;font-family:monospace;letter-spacing:0.04em;}',
    '.wb-body{flex:1;display:grid;grid-template-columns:212px 1fr 252px;min-height:0;}',
    '.wb-palette{background:#f8fafc;border-right:1px solid #cbd5e1;overflow-y:auto;padding:6px;}',
    '.wb-cat{font-size:10px;font-weight:800;color:#ea580c;letter-spacing:0.05em;text-transform:uppercase;margin:10px 4px 4px;}',
    '.wb-cat-items{display:grid;grid-template-columns:1fr 1fr;gap:5px;}',
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
    '@media (max-width:1100px){.wb-body{grid-template-columns:172px 1fr 212px;}}'
  ].join('');

  // Hook tab activation
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.nav-tab[data-tab="workbench-tab"]');
    if (btn) btn.addEventListener('click', function () { setTimeout(WB.init, 30); });
    // also if it's already active
    if (document.getElementById('workbench-tab') && document.getElementById('workbench-tab').classList.contains('active')) setTimeout(WB.init, 60);
  });
})();

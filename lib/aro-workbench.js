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
  function P(x, y, dir) { return { x: x, y: y, dir: dir }; }

  var LIB = {
    'Equipment': [
      { t: 'pump', n: 'Centrifugal Pump', w: 60, h: 50, ports: [P(0, 40, 'w'), P(30, 5, 'n')],
        draw: function () { return '<circle cx="30" cy="30" r="20" fill="#4f46e5" stroke="#312e81" stroke-width="2"/><path d="M30 30 L46 22 M30 30 L46 38 M30 30 L18 30" stroke="#fff" stroke-width="2" fill="none"/>'; } },
      { t: 'pump-ms', n: 'Multistage Pump', w: 70, h: 46, ports: [P(0, 36, 'w'), P(70, 36, 'e')],
        draw: function () { return '<rect x="6" y="14" width="58" height="30" rx="6" fill="#4f46e5" stroke="#312e81" stroke-width="2"/><circle cx="22" cy="29" r="9" fill="#6366f1"/><circle cx="48" cy="29" r="9" fill="#6366f1"/>'; } },
      { t: 'pd-pump', n: 'PD / Gear Pump', w: 60, h: 50, ports: [P(0, 40, 'w'), P(60, 40, 'e')],
        draw: function () { return '<circle cx="30" cy="30" r="20" fill="#4338ca" stroke="#312e81" stroke-width="2"/><circle cx="24" cy="30" r="7" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="38" cy="30" r="7" fill="none" stroke="#fff" stroke-width="1.5"/>'; } },
      { t: 'compressor', n: 'Compressor', w: 64, h: 52, ports: [P(0, 42, 'w'), P(64, 26, 'e')],
        draw: function () { return '<path d="M8 44 L8 16 L56 26 L56 44 Z" fill="#0ea5e9" stroke="#0369a1" stroke-width="2"/><text x="30" y="38" font-size="9" fill="#fff" text-anchor="middle" font-family="Arial">C</text>'; } },
      { t: 'blower', n: 'Blower / Fan', w: 56, h: 52, ports: [P(0, 42, 'w'), P(56, 42, 'e')],
        draw: function () { return '<circle cx="28" cy="30" r="20" fill="#0284c7" stroke="#0369a1" stroke-width="2"/><path d="M28 30 L28 12 M28 30 L44 40 M28 30 L12 40" stroke="#fff" stroke-width="2"/>'; } },
      { t: 'sthe', n: 'Shell & Tube HX', w: 90, h: 44, ports: [P(0, 22, 'w'), P(90, 22, 'e'), P(20, 0, 'n'), P(70, 44, 's')],
        draw: function () { return '<rect x="6" y="10" width="78" height="24" rx="12" fill="#f8fafc" stroke="#334155" stroke-width="2"/><path d="M12 22 h66 M20 14 v16 M40 14 v16 M60 14 v16" stroke="#334155" stroke-width="1"/>'; } },
      { t: 'dphe', n: 'Double Pipe HX', w: 88, h: 34, ports: [P(0, 17, 'w'), P(88, 17, 'e')],
        draw: function () { return '<rect x="4" y="6" width="80" height="22" rx="11" fill="#f8fafc" stroke="#334155" stroke-width="2"/><line x1="8" y1="17" x2="80" y2="17" stroke="#334155" stroke-width="2"/>'; } },
      { t: 'phe', n: 'Plate HX', w: 50, h: 54, ports: [P(0, 14, 'w'), P(50, 14, 'e'), P(0, 42, 'w'), P(50, 42, 'e')],
        draw: function () { return '<rect x="10" y="6" width="30" height="42" fill="#f8fafc" stroke="#334155" stroke-width="2"/><path d="M16 6 v42 M23 6 v42 M30 6 v42 M37 6 v42" stroke="#334155" stroke-width="1"/>'; } },
      { t: 'aircooler', n: 'Air Cooler', w: 78, h: 48, ports: [P(0, 34, 'w'), P(78, 34, 'e')],
        draw: function () { return '<rect x="8" y="20" width="62" height="20" rx="4" fill="#f8fafc" stroke="#334155" stroke-width="2"/><circle cx="26" cy="12" r="8" fill="none" stroke="#0369a1" stroke-width="1.5"/><circle cx="52" cy="12" r="8" fill="none" stroke="#0369a1" stroke-width="1.5"/>'; } },
      { t: 'reboiler', n: 'Reboiler', w: 78, h: 46, ports: [P(0, 23, 'w'), P(78, 23, 'e'), P(40, 0, 'n')],
        draw: function () { return '<rect x="6" y="10" width="66" height="28" rx="14" fill="#fff7ed" stroke="#9a3412" stroke-width="2"/><path d="M18 24 q6 -8 12 0 t12 0 t12 0" fill="none" stroke="#9a3412" stroke-width="1.5"/>'; } }
    ],
    'Vessels & Tanks': [
      { t: 'v-vessel', n: 'Vertical Vessel', w: 46, h: 72, ports: [P(23, 0, 'n'), P(23, 72, 's'), P(0, 20, 'w'), P(46, 52, 'e')],
        draw: function () { return '<rect x="8" y="10" width="30" height="52" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/><path d="M8 10 q15 -10 30 0 M8 62 q15 10 30 0" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/>'; } },
      { t: 'h-vessel', n: 'Horizontal Vessel', w: 84, h: 44, ports: [P(0, 22, 'w'), P(84, 22, 'e'), P(42, 0, 'n'), P(42, 44, 's')],
        draw: function () { return '<rect x="12" y="8" width="60" height="28" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/><path d="M12 8 q-10 14 0 28 M72 8 q10 14 0 28" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/>'; } },
      { t: 'separator', n: 'Separator / KO Drum', w: 84, h: 46, ports: [P(0, 30, 'w'), P(84, 14, 'e'), P(42, 46, 's')],
        draw: function () { return '<rect x="12" y="8" width="60" height="30" fill="#e0f2fe" stroke="#0369a1" stroke-width="2"/><path d="M12 8 q-10 15 0 30 M72 8 q10 15 0 30" fill="#e0f2fe" stroke="#0369a1" stroke-width="2"/><line x1="16" y1="26" x2="68" y2="26" stroke="#0369a1" stroke-dasharray="3 2"/>'; } },
      { t: 'atm-tank', n: 'Atmospheric Tank', w: 70, h: 64, ports: [P(0, 54, 'w'), P(35, 64, 's')],
        draw: function () { return '<rect x="10" y="12" width="50" height="48" fill="#eff6ff" stroke="#1e40af" stroke-width="2"/><ellipse cx="35" cy="12" rx="25" ry="6" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/>'; } },
      { t: 'cone-tank', n: 'Cone Roof Tank', w: 72, h: 66, ports: [P(0, 56, 'w'), P(36, 66, 's')],
        draw: function () { return '<path d="M12 20 L36 6 L60 20 Z" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/><rect x="12" y="20" width="48" height="42" fill="#eff6ff" stroke="#1e40af" stroke-width="2"/>'; } },
      { t: 'bullet', n: 'Bullet Tank', w: 92, h: 40, ports: [P(0, 20, 'w'), P(92, 20, 'e'), P(46, 0, 'n')],
        draw: function () { return '<rect x="20" y="8" width="52" height="24" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/><path d="M20 8 a12 12 0 0 0 0 24 M72 8 a12 12 0 0 1 0 24" fill="#dbeafe" stroke="#1e40af" stroke-width="2"/>'; } },
      { t: 'silo', n: 'Silo / Hopper', w: 60, h: 70, ports: [P(30, 0, 'n'), P(30, 70, 's')],
        draw: function () { return '<rect x="12" y="8" width="36" height="40" fill="#f1f5f9" stroke="#475569" stroke-width="2"/><path d="M12 48 L30 66 L48 48 Z" fill="#e2e8f0" stroke="#475569" stroke-width="2"/>'; } }
    ],
    'Columns & Reactors': [
      { t: 'column', n: 'Distillation Column', w: 44, h: 84, ports: [P(22, 0, 'n'), P(0, 20, 'w'), P(44, 40, 'e'), P(22, 84, 's')],
        draw: function () { return '<rect x="10" y="8" width="24" height="68" fill="#ede9fe" stroke="#6d28d9" stroke-width="2"/><path d="M10 8 q12 -8 24 0 M10 76 q12 8 24 0" fill="#ede9fe" stroke="#6d28d9" stroke-width="2"/><path d="M12 24 h20 M12 36 h20 M12 48 h20 M12 60 h20" stroke="#6d28d9" stroke-width="1"/>'; } },
      { t: 'absorber', n: 'Absorber / Stripper', w: 44, h: 84, ports: [P(22, 0, 'n'), P(0, 60, 'w'), P(44, 20, 'e'), P(22, 84, 's')],
        draw: function () { return '<rect x="10" y="8" width="24" height="68" fill="#f0fdfa" stroke="#0f766e" stroke-width="2"/><path d="M10 8 q12 -8 24 0 M10 76 q12 8 24 0" fill="#f0fdfa" stroke="#0f766e" stroke-width="2"/><circle cx="18" cy="30" r="2" fill="#0f766e"/><circle cx="26" cy="40" r="2" fill="#0f766e"/><circle cx="20" cy="52" r="2" fill="#0f766e"/>'; } },
      { t: 'cstr', n: 'CSTR', w: 58, h: 62, ports: [P(29, 0, 'n'), P(0, 30, 'w'), P(58, 30, 'e'), P(29, 62, 's')],
        draw: function () { return '<rect x="10" y="10" width="38" height="42" rx="6" fill="#fef3c7" stroke="#b45309" stroke-width="2"/><line x1="29" y1="4" x2="29" y2="30" stroke="#b45309" stroke-width="2"/><path d="M20 30 h18 M22 36 l14 0" stroke="#b45309" stroke-width="2"/>'; } },
      { t: 'pfr', n: 'PFR / Tubular', w: 88, h: 34, ports: [P(0, 17, 'w'), P(88, 17, 'e')],
        draw: function () { return '<rect x="6" y="8" width="76" height="18" rx="9" fill="#fef3c7" stroke="#b45309" stroke-width="2"/><path d="M14 17 h60" stroke="#b45309" stroke-dasharray="4 3"/>'; } },
      { t: 'pbr', n: 'Packed Bed Reactor', w: 50, h: 74, ports: [P(25, 0, 'n'), P(25, 74, 's')],
        draw: function () { return '<rect x="12" y="8" width="26" height="58" fill="#fefce8" stroke="#a16207" stroke-width="2"/><g fill="#a16207">' + (function(){var s='';for(var i=0;i<18;i++){s+='<circle cx="'+(16+(i%3)*8)+'" cy="'+(18+Math.floor(i/3)*8)+'" r="2.2"/>';}return s;})() + '</g>'; } }
    ],
    'Valves': [
      { t: 'gate', n: 'Gate Valve', w: 40, h: 30, ports: [P(0, 15, 'w'), P(40, 15, 'e')],
        draw: function () { return '<path d="M4 4 L4 26 L20 15 Z M36 4 L36 26 L20 15 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/>'; } },
      { t: 'ball', n: 'Ball Valve', w: 40, h: 30, ports: [P(0, 15, 'w'), P(40, 15, 'e')],
        draw: function () { return '<path d="M4 6 L4 24 L20 15 Z M36 6 L36 24 L20 15 Z" fill="#0d9488" stroke="#134e4a" stroke-width="1.5"/><circle cx="20" cy="15" r="7" fill="#14b8a6" stroke="#134e4a" stroke-width="1.5"/>'; } },
      { t: 'globe', n: 'Globe Valve', w: 40, h: 30, ports: [P(0, 15, 'w'), P(40, 15, 'e')],
        draw: function () { return '<path d="M4 6 L4 24 L20 15 Z M36 6 L36 24 L20 15 Z" fill="#475569" stroke="#1e293b" stroke-width="1.5"/><circle cx="20" cy="15" r="6" fill="none" stroke="#1e293b" stroke-width="1.5"/>'; } },
      { t: 'butterfly', n: 'Butterfly Valve', w: 40, h: 30, ports: [P(0, 15, 'w'), P(40, 15, 'e')],
        draw: function () { return '<circle cx="20" cy="15" r="12" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.5"/><line x1="12" y1="8" x2="28" y2="22" stroke="#1e293b" stroke-width="2.5"/>'; } },
      { t: 'check', n: 'Check Valve', w: 40, h: 30, ports: [P(0, 15, 'w'), P(40, 15, 'e')],
        draw: function () { return '<path d="M4 6 L4 24 L20 15 Z M36 6 L36 24 L20 15 Z" fill="#d97706" stroke="#92400e" stroke-width="1.5"/><path d="M20 8 L20 22" stroke="#92400e" stroke-width="2"/>'; } },
      { t: 'control', n: 'Control Valve', w: 40, h: 44, ports: [P(0, 30, 'w'), P(40, 30, 'e')],
        draw: function () { return '<path d="M4 20 L4 40 L20 30 Z M36 20 L36 40 L20 30 Z" fill="#64748b" stroke="#1e293b" stroke-width="1.5"/><path d="M12 20 L28 20 L20 8 Z" fill="#94a3b8" stroke="#1e293b" stroke-width="1.5"/><line x1="20" y1="20" x2="20" y2="30" stroke="#1e293b" stroke-width="1.5"/>'; } },
      { t: 'psv', n: 'PSV / Relief Valve', w: 40, h: 46, ports: [P(0, 36, 'w'), P(20, 0, 'n')],
        draw: function () { return '<rect x="10" y="26" width="20" height="16" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5"/><path d="M20 26 L20 6 M14 12 L26 12 L20 4 Z" stroke="#7f1d1d" stroke-width="1.5" fill="#fca5a5"/>'; } },
      { t: '3way', n: 'Three-way Valve', w: 40, h: 40, ports: [P(0, 20, 'w'), P(40, 20, 'e'), P(20, 40, 's')],
        draw: function () { return '<path d="M4 10 L4 30 L20 20 Z M36 10 L36 30 L20 20 Z M10 36 L30 36 L20 20 Z" fill="#0d9488" stroke="#134e4a" stroke-width="1.5"/>'; } },
      { t: 'needle', n: 'Needle Valve', w: 40, h: 30, ports: [P(0, 15, 'w'), P(40, 15, 'e')],
        draw: function () { return '<path d="M4 6 L4 24 L20 15 Z M36 6 L36 24 L20 15 Z" fill="#334155" stroke="#0f172a" stroke-width="1.5"/><path d="M20 6 L23 15 L20 15 Z" fill="#0f172a"/>'; } }
    ],
    'Fittings': [
      { t: 'elbow90', n: '90° Elbow', w: 34, h: 34, ports: [P(0, 17, 'w'), P(17, 34, 's')],
        draw: function () { return '<path d="M0 12 h10 a12 12 0 0 1 12 12 v10" fill="none" stroke="#475569" stroke-width="6"/>'; } },
      { t: 'elbow45', n: '45° Elbow', w: 34, h: 34, ports: [P(0, 17, 'w'), P(30, 4, 'e')],
        draw: function () { return '<path d="M0 20 h12 L30 4" fill="none" stroke="#475569" stroke-width="6"/>'; } },
      { t: 'tee', n: 'Tee', w: 40, h: 30, ports: [P(0, 8, 'w'), P(40, 8, 'e'), P(20, 30, 's')],
        draw: function () { return '<path d="M2 8 h36 M20 8 v20" fill="none" stroke="#475569" stroke-width="6"/>'; } },
      { t: 'cross', n: 'Cross', w: 36, h: 36, ports: [P(0, 18, 'w'), P(36, 18, 'e'), P(18, 0, 'n'), P(18, 36, 's')],
        draw: function () { return '<path d="M2 18 h32 M18 2 v32" fill="none" stroke="#475569" stroke-width="6"/>'; } },
      { t: 'reducer', n: 'Reducer', w: 40, h: 28, ports: [P(0, 14, 'w'), P(40, 14, 'e')],
        draw: function () { return '<path d="M2 6 L2 22 L38 18 L38 10 Z" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'expander', n: 'Expander', w: 40, h: 28, ports: [P(0, 14, 'w'), P(40, 14, 'e')],
        draw: function () { return '<path d="M2 10 L2 18 L38 22 L38 6 Z" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'flange', n: 'Flange Pair', w: 24, h: 30, ports: [P(0, 15, 'w'), P(24, 15, 'e')],
        draw: function () { return '<rect x="6" y="4" width="4" height="22" fill="#334155"/><rect x="14" y="4" width="4" height="22" fill="#334155"/>'; } }
    ],
    'Instruments': [
      { t: 'pg', n: 'Pressure Gauge', w: 30, h: 34, ports: [P(15, 34, 's')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="18" font-size="9" text-anchor="middle" font-family="Arial">PI</text>'; } },
      { t: 'ti', n: 'Temperature Ind.', w: 30, h: 34, ports: [P(15, 34, 's')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="18" font-size="9" text-anchor="middle" font-family="Arial">TI</text>'; } },
      { t: 'ft', n: 'Flow Meter', w: 30, h: 34, ports: [P(0, 20, 'w'), P(30, 20, 'e')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="18" font-size="9" text-anchor="middle" font-family="Arial">FT</text><line x1="0" y1="20" x2="30" y2="20" stroke="#475569" stroke-width="3"/>'; } },
      { t: 'li', n: 'Level Indicator', w: 30, h: 34, ports: [P(0, 20, 'w')],
        draw: function () { return '<circle cx="15" cy="14" r="12" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><text x="15" y="18" font-size="9" text-anchor="middle" font-family="Arial">LI</text>'; } },
      { t: 'orifice', n: 'Orifice Plate', w: 30, h: 30, ports: [P(0, 15, 'w'), P(30, 15, 'e')],
        draw: function () { return '<line x1="0" y1="15" x2="30" y2="15" stroke="#475569" stroke-width="4"/><line x1="15" y1="4" x2="15" y2="26" stroke="#0f172a" stroke-width="2"/>'; } },
      { t: 'rotameter', n: 'Rotameter', w: 26, h: 40, ports: [P(13, 0, 'n'), P(13, 40, 's')],
        draw: function () { return '<path d="M8 6 L18 6 L21 34 L5 34 Z" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.5"/><circle cx="13" cy="24" r="3" fill="#0369a1"/>'; } }
    ],
    'Utilities & Misc': [
      { t: 'cooltower', n: 'Cooling Tower', w: 64, h: 58, ports: [P(0, 44, 'w'), P(64, 44, 'e')],
        draw: function () { return '<path d="M14 50 L10 20 L54 20 L50 50 Z" fill="#e0f2fe" stroke="#0369a1" stroke-width="2"/><path d="M10 20 q22 -12 44 0" fill="#bae6fd" stroke="#0369a1" stroke-width="2"/>'; } },
      { t: 'boiler', n: 'Boiler', w: 60, h: 56, ports: [P(0, 40, 'w'), P(30, 0, 'n')],
        draw: function () { return '<rect x="10" y="12" width="40" height="40" rx="6" fill="#fee2e2" stroke="#b91c1c" stroke-width="2"/><path d="M18 44 q6 -10 12 0 t12 0" fill="none" stroke="#b91c1c" stroke-width="2"/>'; } },
      { t: 'ejector', n: 'Ejector', w: 56, h: 34, ports: [P(0, 17, 'w'), P(56, 17, 'e'), P(28, 0, 'n')],
        draw: function () { return '<path d="M2 10 L24 10 L32 17 L54 12 L54 22 L32 17 L24 24 L2 24 Z" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'mixer', n: 'Static Mixer', w: 60, h: 26, ports: [P(0, 13, 'w'), P(60, 13, 'e')],
        draw: function () { return '<rect x="4" y="4" width="52" height="18" rx="9" fill="#f1f5f9" stroke="#475569" stroke-width="1.5"/><path d="M10 6 L20 20 M20 6 L30 20 M30 6 L40 20 M40 6 L50 20" stroke="#475569" stroke-width="1.5"/>'; } },
      { t: 'agitator', n: 'Agitated Tank', w: 60, h: 66, ports: [P(0, 30, 'w'), P(30, 66, 's')],
        draw: function () { return '<rect x="10" y="14" width="40" height="46" rx="4" fill="#eff6ff" stroke="#1e40af" stroke-width="2"/><line x1="30" y1="4" x2="30" y2="44" stroke="#475569" stroke-width="2"/><path d="M22 44 h16" stroke="#475569" stroke-width="3"/>'; } }
    ]
  };

  var LIB_INDEX = {};
  Object.keys(LIB).forEach(function (cat) { LIB[cat].forEach(function (it) { LIB_INDEX[it.t] = it; }); });

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
  function portWorld(node, pi) {
    var lib = LIB_INDEX[node.t]; var p = lib.ports[pi];
    return { x: node.x + p.x, y: node.y + p.y, dir: p.dir };
  }

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
      var col = p.status === 'high' ? '#dc2626' : (p.status === 'ok' ? '#16a34a' : '#475569');
      s += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (selc ? 5 : 3) + '" stroke-linejoin="round" data-pipe="' + p.id + '" style="cursor:pointer"/>';
      var mid = pts[Math.floor(pts.length / 2)];
      if (p.tag || p.nps) s += '<text x="' + mid.x + '" y="' + (mid.y - 6) + '" font-size="9" fill="#0f766e" text-anchor="middle" font-family="monospace" style="pointer-events:none">' + (p.tag || '') + (p.nps ? ' ' + p.nps + '"' : '') + (p.dp !== undefined ? ' · ΔP ' + p.dp.toFixed(2) + ' bar' : '') + '</text>';
    });
    // nodes
    WB.nodes.forEach(function (n) {
      var lib = LIB_INDEX[n.t]; if (!lib) return;
      var selc = (WB.sel && WB.sel.kind === 'node' && WB.sel.id === n.id);
      s += '<g transform="translate(' + n.x + ',' + n.y + ')" data-node="' + n.id + '" style="cursor:move">';
      if (selc) s += '<rect x="-6" y="-6" width="' + (lib.w + 12) + '" height="' + (lib.h + 12) + '" fill="none" stroke="#ff7538" stroke-width="1.5" stroke-dasharray="4 3" rx="4"/>';
      s += lib.draw();
      // ports
      lib.ports.forEach(function (pt, pi) {
        var active = WB.mode === 'pipe';
        s += '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="' + (active ? 5 : 3) + '" fill="' + (active ? '#16a34a' : '#94a3b8') + '" stroke="#0f172a" stroke-width="1" data-port="' + n.id + ':' + pi + '" style="cursor:crosshair"/>';
      });
      s += '<text x="' + (lib.w / 2) + '" y="' + (lib.h + 14) + '" font-size="9" fill="#1e293b" text-anchor="middle" font-family="monospace" style="pointer-events:none">' + (n.tag || '') + '</text>';
      s += '</g>';
    });
    // pending pipe rubber-band anchor marker
    if (WB.pendingPort) {
      var pn = nodeById(WB.pendingPort.id); if (pn) { var pw = portWorld(pn, WB.pendingPort.pi); s += '<circle cx="' + pw.x + '" cy="' + pw.y + '" r="6" fill="none" stroke="#16a34a" stroke-width="2"/>'; }
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
      h += field('Tag', 'tag', n.tag, 'text');
      h += fluidField(n.fluid);
      h += field('Flow (m³/h)', 'flow', n.flow, 'number');
      h += field('Temp (°C)', 'temp', n.temp, 'number');
      h += field('Pressure (bar g)', 'press', n.press, 'number');
      h += '<div class="wb-prop-note">Ports: ' + lib.ports.length + ' · drag body to move · use Pipe tool + green ports to connect.</div>';
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
        h += '<div class="wb-prop-result">'
          + row('Velocity', p.result.v.toFixed(2) + ' m/s', p.result.vWarn)
          + row('Reynolds', Math.round(p.result.Re).toLocaleString())
          + row('Friction f', p.result.f.toFixed(4))
          + row('ΔP friction', p.result.dpF.toFixed(3) + ' bar')
          + row('ΔP static', p.result.dpZ.toFixed(3) + ' bar')
          + row('ΔP total', p.result.dp.toFixed(3) + ' bar', p.status === 'high')
          + row('Head loss', p.result.hL.toFixed(2) + ' m')
          + '</div>';
      }
    }
    propEl.innerHTML = h;
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
  function npsID_mm(nps) {
    var T = { 0.5: 15.8, 0.75: 20.9, 1: 26.6, 1.5: 40.9, 2: 52.5, 3: 77.9, 4: 102.3, 6: 154.1, 8: 202.7, 10: 254.5, 12: 303.2 };
    var keys = Object.keys(T).map(Number); var best = keys[0];
    for (var i = 0; i < keys.length; i++) if (Math.abs(keys[i] - nps) < Math.abs(best - nps)) best = keys[i];
    return T[best];
  }
  WB.calculate = function () {
    pushUndo();
    var anyHigh = false, warnings = [];
    WB.pipes.forEach(function (p) {
      var fl = FLUIDS[p.fluid || 'Water'] || FLUIDS.Water;
      var Q = (p.flow || 10) / 3600;                       // m³/h → m³/s
      var D = npsID_mm(p.nps || 3) / 1000;                 // m
      var A = Math.PI / 4 * D * D;
      var v = A > 0 ? Q / A : 0;
      var Re = fl.mu > 0 ? fl.rho * v * D / (fl.mu / 1000) : 0;
      var eps = 0.046e-3;                                   // commercial steel
      var f;
      if (Re < 2300 && Re > 0) f = 64 / Re;
      else { var t = eps / (3.7 * D) + 5.74 / Math.pow(Re || 1, 0.9); f = 0.25 / Math.pow(Math.log10(t), 2); }
      var L = p.length || 5;
      var dpF = f * (L / D) * fl.rho * v * v / 2;           // Pa
      var dpZ = fl.rho * 9.81 * (p.dz || 0);               // Pa
      var dp = (dpF + dpZ) / 1e5;                           // bar
      var hL = fl.rho > 0 ? (dpF + dpZ) / (fl.rho * 9.81) : 0;
      var vWarn = v > 3.0;
      p.result = { v: v, Re: Re, f: f, dpF: dpF / 1e5, dpZ: dpZ / 1e5, dp: dp, hL: hL, vWarn: vWarn };
      p.dp = dp;
      p.status = (dp > 1.0 || vWarn) ? 'high' : 'ok';
      if (p.status === 'high') { anyHigh = true; warnings.push((p.tag || p.id) + ': ΔP ' + dp.toFixed(2) + ' bar' + (vWarn ? ', v ' + v.toFixed(1) + ' m/s (>3)' : '')); }
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
      + '    </defs><g id="wb-world"></g></svg>'
      + '    <div class="wb-hint">Drag components ▸ drop on canvas · Pipe tool ▸ click a green port, then another to connect · scroll to zoom · space-drag to pan</div>'
      + '  </div>'
      + '  <div class="wb-props"><div class="wb-props-head">PROPERTIES</div><div id="wb-prop-body"></div></div>'
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
          calc: WB.calculate, bom: WB.bom, report: WB.report, undo: WB.undo, redo: WB.redo, delete: WB.deleteSel,
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

  var drag = null, panning = null, spaceDown = false;
  window.addEventListener('keydown', function (e) { if (e.code === 'Space') spaceDown = true; });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space') spaceDown = false; });

  function onDown(e) {
    var portEl = e.target.closest('[data-port]');
    if (WB.mode === 'pipe' && portEl) return; // handled on click
    if (spaceDown || WB.mode === 'pan' || e.button === 1) { panning = { x: e.clientX, y: e.clientY, px: WB.panX, py: WB.panY }; return; }
    var g = e.target.closest('[data-node]');
    if (g && WB.mode === 'select') {
      var n = nodeById(g.getAttribute('data-node'));
      if (n) { WB.sel = { kind: 'node', id: n.id }; var w = clientToWorld(e.clientX, e.clientY); drag = { id: n.id, dx: w.x - n.x, dy: w.y - n.y, moved: false }; renderProps(); render(); }
    }
  }
  function onMove(e) {
    if (panning) { WB.panX = panning.px + (e.clientX - panning.x); WB.panY = panning.py + (e.clientY - panning.y); render(); return; }
    if (drag) { var w = clientToWorld(e.clientX, e.clientY); var n = nodeById(drag.id); if (n) { n.x = snapV(w.x - drag.dx); n.y = snapV(w.y - drag.dy); drag.moved = true; render(); } }
  }
  function onUp() { if (drag && drag.moved) { /* keep single undo pushed on select? push now */ } drag = null; panning = null; }

  function onClick(e) {
    var portEl = e.target.closest('[data-port]');
    if (WB.mode === 'pipe' && portEl) {
      var parts = portEl.getAttribute('data-port').split(':');
      var ref = { id: parts[0], pi: parseInt(parts[1]) };
      if (!WB.pendingPort) { WB.pendingPort = ref; render(); }
      else if (WB.pendingPort.id === ref.id && WB.pendingPort.pi === ref.pi) { WB.pendingPort = null; render(); }
      else {
        pushUndo();
        var fromN = nodeById(WB.pendingPort.id);
        var p = { id: 'L' + (++WB.seq), from: WB.pendingPort, to: ref,
          tag: 'L-' + (100 + WB.pipes.length + 1), fluid: fromN ? fromN.fluid : 'Water',
          flow: fromN ? fromN.flow : 10, nps: fromN ? fromN.nps : 3, length: 5, dz: 0 };
        WB.pipes.push(p); WB.pendingPort = null; WB.sel = { kind: 'pipe', id: p.id }; render(); renderProps();
      }
      return;
    }
    var pipeEl = e.target.closest('[data-pipe]');
    if (pipeEl && WB.mode === 'select') { WB.sel = { kind: 'pipe', id: pipeEl.getAttribute('data-pipe') }; renderProps(); render(); return; }
    if (!e.target.closest('[data-node]') && !pipeEl && !e.target.closest('[data-port]')) { WB.sel = null; renderProps(); render(); }
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

/* ══════════════════════════════════════════════════════════════════════
   AROGARA — PUMP ENGINEERING REFERENCE  (window.AROPUMPREF)

   A searchable reference library for pump selection and mechanical
   design, opened from the PUMP REFERENCE button in the shared engineering
   bar (lib/aro-engineering.js, pump module only). Built as a lazily-
   created overlay appended to document.body on open() and fully removed
   on close() — never left sitting in the DOM, never touching #pump-results
   height, the 3D viewport, or the results scroll position. Section 35 of
   the pump upgrade spec calls this out explicitly: this file owns none of
   that layout and reads none of it.

   Every table here reads window.PUMP_SELECTION_STANDARD (lib/aro-
   pumpstandard.js) directly — the exact 23-row database Section 10's
   ranking engine already screens against. No numbers are duplicated or
   re-typed; a change to that file's ranges is reflected here on the next
   open with no edit needed in this one.

   Only Section 01 has real content built out so far. The remaining
   sections are listed (matching the spec's own 20-item structure) so the
   library's shape is visible and navigable, but each says plainly that it
   has not been built yet rather than showing invented content — the same
   "never fake precision" rule the rest of this module follows.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  /* This is a training reference, not a second full engineering manual.
     Keep it aligned with the actual family selector: centrifugal (including
     submersible) plus reciprocating piston/plunger and rotary vane, screw,
     gear, lobe and peristaltic pumps. */
  var SECTIONS = [
    { id: 'basics', num: '01', title: 'Pump Basics — Start Here', ready: true },
    { id: 'families', num: '02', title: 'Approved Pump Families', ready: true },
    { id: 'compare', num: '03', title: 'Family Comparison', ready: true },
    { id: 'envelope', num: '04', title: 'Choose by Duty', ready: true },
    { id: 'npsh', num: '05', title: 'Tank Elevation & NPSH', ready: true },
    { id: 'equations', num: '06', title: 'Calculation Sequence', ready: true }
  ];

  var state = { section: 'envelope', query: '', category: '', sortKey: 'name', sortDir: 1, appKey: 'clean', fullscreen: false };
  var root = null;

  /* Standards numbers/titles/scopes only — never a revision/edition, since
     this file has no verified-current-edition source and a wrong year is
     worse than no year (spec Section 26's own rule). */
  var STANDARDS = [
    { no: 'API 610 / ISO 13709', title: 'Centrifugal Pumps for Petroleum, Petrochemical and Natural Gas Industries', scope: 'The default reference for refinery/process centrifugal pumps — casing, baseplate, NPSH margin, allowable nozzle loads, and more.' },
    { no: 'API 674', title: 'Positive Displacement Pumps — Reciprocating', scope: 'Plunger and piston pumps in petroleum, heavy-duty chemical, and gas-industry services.' },
    { no: 'API 675', title: 'Positive Displacement Pumps — Controlled Volume', scope: 'Metering/dosing pumps (mechanical and hydraulic diaphragm) requiring accurate, adjustable flow.' },
    { no: 'API 676', title: 'Positive Displacement Pumps — Rotary', scope: 'Gear, screw, lobe, and vane pumps for general refinery/petrochemical rotary PD service.' },
    { no: 'API 682', title: 'Pumps — Shaft Sealing Systems for Centrifugal and Rotary Pumps', scope: 'The seal-plan piping arrangements (Plans 11, 13, 21, 23, 32, 52, 53A, etc.) this app\'s own Seal Selection engine screens against.' },
    { no: 'ASME B73.1', title: 'Horizontal End Suction Centrifugal Pumps for Chemical Process', scope: 'Dimensional standard for OH2-style end-suction chemical process pumps — interchangeability between manufacturers.' },
    { no: 'ASME B73.2', title: 'Vertical In-Line Centrifugal Pumps for Chemical Process', scope: 'The vertical in-line equivalent of B73.1.' },
    { no: 'ISO 5199', title: 'Technical Specifications for Centrifugal Pumps — Class II', scope: 'A more rigorous European-practice alternative to API 610 for process centrifugal pumps below API 610\'s severity of service.' },
    { no: 'ISO 2858', title: 'End-Suction Centrifugal Pumps (Rating with 16 bar) — Designation, Nominal Duty Point and Dimensions', scope: 'Dimensional/designation reference for end-suction pumps, the ISO counterpart to ASME B73.1.' },
    { no: 'Hydraulic Institute (HI) Standards', title: 'ANSI/HI 1.1-1.6 (centrifugal), 9.6.7 (viscous liquid effects), 2.1-2.6 (rotodynamic), and related', scope: 'Broad American reference set — this app\'s own viscosity correction (Section 04) is built on ANSI/HI 9.6.7.' },
    { no: 'NFPA 20', title: 'Standard for the Installation of Stationary Pumps for Fire Protection', scope: 'Fire pump installation — applies when the selected service is a dedicated fire-water pump, not general process transfer.' }
  ];

  var GLOSSARY = [
    { term: 'BEP', def: 'Best Efficiency Point — the flow at which a centrifugal pump\'s efficiency peaks for a given impeller/speed. Operating far from BEP (outside the POR/AOR) increases vibration, seal/bearing wear, and radial thrust.' },
    { term: 'POR', def: 'Preferred Operating Region — the flow band (typically ~70-120% of BEP) a pump can run in continuously with normal reliability, per API 610.' },
    { term: 'AOR', def: 'Allowable Operating Region — the wider flow band a pump can run in for short periods without damage, but outside which vibration/thrust/NPSH risk becomes unacceptable.' },
    { term: 'TDH', def: 'Total Dynamic Head — the total head a pump must develop: static elevation change, pressure difference between suction and discharge vessels, and all friction/fitting losses, expressed in meters (or feet) of the pumped fluid.' },
    { term: 'NPSHa', def: 'Net Positive Suction Head available — the actual absolute pressure margin above the fluid\'s vapor pressure available at the pump suction, from the real suction-side conditions (elevation, pressure, losses).' },
    { term: 'NPSHr', def: 'Net Positive Suction Head required — the margin a specific pump needs at its suction to avoid cavitation, a property of that pump\'s own design (vendor test data, or Phase-1 estimated here pending one).' },
    { term: 'NPSH margin', def: 'NPSHa minus NPSHr. A small or negative margin means cavitation risk; this app flags margin status green/amber/red.' },
    { term: 'Specific speed (Ns)', def: 'A dimensionless (or unit-dependent, depending on convention) number combining speed, flow, and head that characterizes an impeller\'s shape family (radial/Francis/mixed-flow/axial) independent of its actual size.' },
    { term: 'MCSF', def: 'Minimum Continuous Stable Flow — the lowest flow at which a centrifugal pump can run continuously without unacceptable recirculation, vibration, or heating.' },
    { term: 'Shutoff head', def: 'The head a centrifugal pump develops at zero flow (valve closed) — the top of its H-Q curve, used to size the casing pressure class.' },
    { term: 'Volumetric efficiency', def: 'For a positive-displacement pump: actual delivered flow divided by theoretical displacement flow. The gap is slip — internal leakage from discharge back to suction across clearances.' },
    { term: 'Slip', def: 'The flow a PD pump loses internally to clearance leakage — rises with differential pressure and viscosity drop, falls as viscosity rises (thicker fluid leaks back more slowly).' },
    { term: 'Cavitation', def: 'Vapor bubbles forming where local pressure drops below the fluid\'s vapor pressure (typically at the impeller eye), then collapsing violently downstream — causes noise, vibration, and pitting erosion of the impeller/casing.' },
    { term: 'Affinity laws', def: 'The scaling relationships for a centrifugal pump at a fixed impeller diameter: flow ∝ speed, head ∝ speed², power ∝ speed³ — the basis for VFD trim/speed-control screening.' },
    { term: 'Seal plan', def: 'An API 682 standard piping arrangement around a mechanical seal (flush, quench, buffer/barrier fluid circuits) selected for the specific fluid/temperature/hazard combination.' }
  ];

  function esc(x) {
    return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtRange(r, unit) {
    if (!r || r[0] == null || r[1] == null) return '—';
    return r[0] + '–' + r[1] + (unit ? ' ' + unit : '');
  }
  function yn(v) {
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    if (typeof v === 'string') return v;
    return '—';
  }

  function categoryLabel(cat) {
    return { centrifugal: 'Centrifugal', submersible: 'Submersible', 'pd-rotary': 'Rotary PD', 'pd-reciprocating': 'Reciprocating PD' }[cat] || cat;
  }

  function rows() {
    return (window.PUMP_SELECTION_STANDARD || []).filter(function (r) {
      var n = String(r.name || '').toLowerCase();
      if (r.category === 'centrifugal' || r.category === 'submersible') return true;
      return /piston|plunger|vane|screw|gear|lobe|peristaltic/.test(n)
        && !/diaphragm|progressive cavity|aodd/.test(n);
    });
  }

  function filteredSortedRows() {
    var q = state.query.trim().toLowerCase();
    var list = rows().filter(function (r) {
      if (state.category && r.category !== state.category) return false;
      if (!q) return true;
      var hay = (r.name + ' ' + r.application + ' ' + categoryLabel(r.category)).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    list.sort(function (a, b) {
      var av = state.sortKey === 'name' ? a.name : (a.flowRangeM3h ? a.flowRangeM3h[0] : 0);
      var bv = state.sortKey === 'name' ? b.name : (b.flowRangeM3h ? b.flowRangeM3h[0] : 0);
      if (av < bv) return -1 * state.sortDir;
      if (av > bv) return 1 * state.sortDir;
      return 0;
    });
    return list;
  }

  /* A compact, image-led first page for users who are new to pumps. These
     diagrams are our own SVGs, so their labels always match this calculator's
     sign convention and cannot drift away from its live NPSH result. */
  function basicsHtml() {
    var card = function (title, body, color) { return '<div style="border:1px solid var(--border-muted);border-left:4px solid ' + color + ';border-radius:6px;padding:11px 12px;margin:0 0 9px;"><div style="font:800 12px var(--font-mono);color:var(--text-header);">' + title + '</div><div style="font:10.5px/1.65 var(--font-mono);color:var(--text-main);margin-top:5px;">' + body + '</div></div>'; };
    /* INTEGRATED METAL IMPELLER GEOMETRY: keep the machine illustration
       self-contained. The blades are drawn to scale inside the casing rather
       than pasting a photographic asset over the hydraulic flow path. */
    var metallicImpeller = function (cx, cy, r, metal) {
      var blades = [0, 60, 120, 180, 240, 300].map(function (angle) {
        return '<g transform="rotate(' + angle + ' ' + cx + ' ' + cy + ')"><path d="M' + cx + ' ' + (cy - r * 0.18) + ' C' + (cx + r * 0.30) + ' ' + (cy - r * 0.67) + ' ' + (cx + r * 0.82) + ' ' + (cy - r * 0.70) + ' ' + (cx + r * 0.87) + ' ' + (cy - r * 0.26) + ' C' + (cx + r * 0.58) + ' ' + (cy - r * 0.02) + ' ' + (cx + r * 0.27) + ' ' + (cy + r * 0.16) + ' ' + cx + ' ' + (cy + r * 0.20) + 'Z" fill="url(#' + metal + ')" stroke="#475569" stroke-width="1.2"/></g>';
      }).join('');
      return '<g filter="url(#pb-shadow)"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#dbeafe" stroke="#64748b" stroke-width="2"/>' + blades + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.34).toFixed(1) + '" fill="url(#' + metal + ')" stroke="#334155" stroke-width="2"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.15).toFixed(1) + '" fill="#0f172a"/><circle cx="' + (cx - r * 0.05).toFixed(1) + '" cy="' + (cy - r * 0.06).toFixed(1) + '" r="' + (r * 0.06).toFixed(1) + '" fill="#f8fafc" opacity=".8"/></g>';
    };
    /* Keep labels out of the SVG artwork. They reflow below the drawings,
       so no formula or title can be clipped when the reader narrows a panel. */
    var pumpSvg = '<svg viewBox="0 0 760 250" role="img" aria-label="cutaway centrifugal pump showing moving liquid from suction through impeller to discharge" style="display:block;width:100%;max-width:760px;height:auto;background:#edf3f8;border:1px solid #cbd5e1;border-radius:6px"><defs><linearGradient id="case-metal" x1="0" x2="1"><stop stop-color="#475569"/><stop offset=".45" stop-color="#cbd5e1"/><stop offset="1" stop-color="#334155"/></linearGradient><linearGradient id="water-fill" x1="0" x2="1"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#2563eb"/></linearGradient><filter id="pump-shadow"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".24"/></filter></defs><ellipse cx="390" cy="205" rx="288" ry="13" fill="#94a3b8" opacity=".24"/><path d="M48 126H254" stroke="url(#case-metal)" stroke-width="28" filter="url(#pump-shadow)"/><path d="M48 126H258" stroke="url(#water-fill)" stroke-width="12"/><path d="M480 88H690V126H560" fill="none" stroke="url(#case-metal)" stroke-width="28" stroke-linejoin="round" filter="url(#pump-shadow)"/><path d="M480 88H690V126H560" fill="none" stroke="#fb923c" stroke-width="11" stroke-linejoin="round"/><path d="M402 43c69 0 111 50 104 105c-6 48-47 72-95 72H300c-47 0-77-31-77-75c0-54 40-102 96-102z" fill="url(#case-metal)" stroke="#1e293b" stroke-width="5" filter="url(#pump-shadow)"/><path d="M404 62c50 0 79 36 78 78c-1 34-24 53-61 53h-98c-35 0-59-22-59-52c0-39 30-79 74-79z" fill="#dbeafe" stroke="#64748b" stroke-width="3"/><circle cx="347" cy="129" r="23" fill="#0f4c81" stroke="#1e3a8a" stroke-width="4"/><path d="M347 103c31-19 45 17 17 29c29 17 2 48-18 25c-21 24-47-8-18-25c-28-13-15-48 19-29z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="3"/><path d="M364 129c36 6 50-4 65-25" fill="none" stroke="#60a5fa" stroke-width="7"/><rect x="510" y="72" width="117" height="82" rx="8" fill="url(#case-metal)" stroke="#334155" stroke-width="4" filter="url(#pump-shadow)"/><path d="M480 129H510" stroke="#94a3b8" stroke-width="14"/><path d="M494 119v20m-8-10h16" stroke="#334155" stroke-width="3"/><text x="531" y="120" font-size="15" font-weight="700" fill="#fff">MOTOR</text><g fill="#e2e8f0">' + [0,1,2,3,4,5].map(function (i) { return '<circle cx="' + (278 + i * 35) + '" cy="43" r="4"/>'; }).join('') + '</g><g fill="#dbeafe"><circle r="5"><animate attributeName="cx" values="65;245" dur="1.6s" repeatCount="indefinite"/><animate attributeName="cy" values="126;126" dur="1.6s" repeatCount="indefinite"/></circle><circle r="4" opacity=".85"><animate attributeName="cx" values="65;245" dur="1.6s" begin="-.55s" repeatCount="indefinite"/><animate attributeName="cy" values="126;126" dur="1.6s" begin="-.55s" repeatCount="indefinite"/></circle><circle r="4" opacity=".75"><animate attributeName="cx" values="502;674" dur="1.4s" repeatCount="indefinite"/><animate attributeName="cy" values="88;88" dur="1.4s" repeatCount="indefinite"/></circle></g><text x="47" y="36" font-size="13" font-weight="700" fill="#075985">SUCTION — moving liquid enters</text><text x="277" y="242" font-size="13" font-weight="700" fill="#1e3a8a">CUTAWAY IMPELLER + VOLUTE</text><text x="529" y="36" font-size="13" font-weight="700" fill="#9a3412">DISCHARGE — head added</text></svg>';
    pumpSvg = [
      '<svg viewBox="0 0 860 275" role="img" aria-label="metal centrifugal pump cutaway with flanged piping, impeller, motor and animated liquid" style="display:block;width:100%;max-width:860px;height:auto;background:#edf3f8;border:1px solid #cbd5e1;border-radius:6px">',
      '<defs><linearGradient id="pb-steel" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8fafc"/><stop offset=".28" stop-color="#94a3b8"/><stop offset=".63" stop-color="#334155"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient><linearGradient id="pb-cast" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2e8f0"/><stop offset=".4" stop-color="#64748b"/><stop offset="1" stop-color="#1e293b"/></linearGradient><linearGradient id="pb-water" x1="0" x2="1"><stop stop-color="#a5f3fc"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#0284c7"/></linearGradient><linearGradient id="pb-motor" x1="0" x2="1"><stop stop-color="#1e293b"/><stop offset=".48" stop-color="#94a3b8"/><stop offset="1" stop-color="#334155"/></linearGradient><filter id="pb-shadow"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".26"/></filter></defs>',
      '<ellipse cx="431" cy="235" rx="342" ry="15" fill="#94a3b8" opacity=".25"/>',
      '<g filter="url(#pb-shadow)"><path d="M44 143H250" stroke="url(#pb-steel)" stroke-width="29" stroke-linecap="round"/><path d="M44 143H250" stroke="url(#pb-water)" stroke-width="10" stroke-linecap="round"/><circle cx="75" cy="143" r="19" fill="url(#pb-steel)" stroke="#334155" stroke-width="2"/><circle cx="75" cy="143" r="12" fill="#0f172a"/><circle cx="75" cy="143" r="8" fill="#e2e8f0"/><circle cx="240" cy="143" r="20" fill="url(#pb-steel)" stroke="#334155" stroke-width="2"/><circle cx="240" cy="143" r="13" fill="#111827"/><circle cx="240" cy="143" r="8" fill="#d1d5db"/></g>',
      '<g fill="#e2e8f0" stroke="#475569" stroke-width="1">' + [0,1,2,3].map(function (i) { var a = i * Math.PI / 2; return '<circle cx="' + (240 + 15 * Math.cos(a)).toFixed(1) + '" cy="' + (143 + 15 * Math.sin(a)).toFixed(1) + '" r="2.2"/>'; }).join('') + '</g>',
      '<path d="M405 77c79 0 123 52 116 111c-6 48-47 70-101 70H304c-51 0-82-31-82-79c0-58 44-102 103-102z" fill="url(#pb-cast)" stroke="#1e293b" stroke-width="5" filter="url(#pb-shadow)"/><path d="M410 98c52 0 83 33 82 76c-1 36-27 58-67 58h-105c-37 0-64-22-64-55c0-43 33-79 82-79z" fill="#dbeafe" stroke="#64748b" stroke-width="3"/>' + metallicImpeller(347, 160, 34, 'pb-steel') + '<path d="M374 165c34 7 49-4 65-26" fill="none" stroke="#60a5fa" stroke-width="8"/>',
      '<path d="M493 123H704V80H822" fill="none" stroke="url(#pb-steel)" stroke-width="29" stroke-linejoin="round" filter="url(#pb-shadow)"/><path d="M493 123H704V80H822" fill="none" stroke="#fb923c" stroke-width="10" stroke-linejoin="round"/><circle cx="704" cy="80" r="19" fill="url(#pb-steel)" stroke="#334155" stroke-width="2"/><circle cx="704" cy="80" r="12" fill="#111827"/><circle cx="704" cy="80" r="7" fill="#d1d5db"/>',
      '<rect x="536" y="139" width="155" height="72" rx="9" fill="url(#pb-motor)" stroke="#1e293b" stroke-width="4" filter="url(#pb-shadow)"/>' + [0,1,2,3,4,5,6].map(function (i) { return '<path d="M' + (550 + i * 18) + ' 145V205" stroke="#cbd5e1" stroke-width="3" opacity=".65"/>'; }).join('') + '<rect x="503" y="163" width="33" height="22" rx="3" fill="url(#pb-steel)" stroke="#334155" stroke-width="2"/><path d="M492 174H503" stroke="#64748b" stroke-width="12"/><text x="582" y="181" font-size="15" font-weight="700" fill="#fff">MOTOR</text><path d="M542 211v13m122-13v13" stroke="#334155" stroke-width="8"/><path d="M525 225H684" stroke="#475569" stroke-width="10" stroke-linecap="round"/><g fill="#e2e8f0" stroke="#475569" stroke-width="1"><circle cx="541" cy="226" r="3"/><circle cx="667" cy="226" r="3"/></g>',
      '<g fill="#e0f2fe"><circle r="5"><animate attributeName="cx" values="95;250" dur="1.5s" repeatCount="indefinite"/><animate attributeName="cy" values="143;143" dur="1.5s" repeatCount="indefinite"/></circle><circle r="4" opacity=".8"><animate attributeName="cx" values="95;250" dur="1.5s" begin="-.65s" repeatCount="indefinite"/><animate attributeName="cy" values="143;143" dur="1.5s" begin="-.65s" repeatCount="indefinite"/></circle><circle r="4" opacity=".85"><animateMotion path="M493 123H704V80H805" dur="1.65s" repeatCount="indefinite"/></circle></g>',
      '<text x="46" y="38" font-size="13" font-weight="700" fill="#075985">SUCTION — moving liquid enters</text><text x="285" y="269" font-size="13" font-weight="700" fill="#1e3a8a">METAL CUTAWAY: IMPELLER + VOLUTE</text><text x="669" y="38" font-size="13" font-weight="700" fill="#9a3412">DISCHARGE — head added</text></svg>'
    ].join('');
    var pumpLegend = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:8px 0 10px;font:700 10px/1.45 var(--font-mono);text-align:center;"><div style="padding:7px;border-radius:4px;background:#e0f2fe;color:#075985;">SUCTION<br><span style="font-weight:400">low-pressure liquid enters</span></div><div style="padding:7px;border-radius:4px;background:#dbeafe;color:#1e3a8a;">PUMP + MOTOR<br><span style="font-weight:400">shaft work raises liquid energy</span></div><div style="padding:7px;border-radius:4px;background:#ffedd5;color:#9a3412;">DISCHARGE<br><span style="font-weight:400">pressure / elevation / velocity duty</span></div></div><div style="margin:-2px 0 11px;text-align:center;font:10px/1.5 var(--font-mono);color:var(--text-muted);">The pump does not create pressure alone: it supplies total head to overcome pressure, elevation and friction losses.</div>';
    var tankSvg = '<svg viewBox="0 0 960 350" role="img" aria-label="NPSH energy balance with liquid surface pressure, static head, friction loss and vapour pressure head" style="display:block;width:100%;max-width:960px;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px"><defs><linearGradient id="tank-water" x1="0" x2="0" y2="1"><stop stop-color="#7dd3fc"/><stop offset="1" stop-color="#2563eb"/></linearGradient><filter id="tank-shadow"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity=".18"/></filter></defs><rect x="25" y="21" width="246" height="54" rx="7" fill="#eff6ff" stroke="#93c5fd"/><text x="42" y="45" font-size="14" font-weight="700" fill="#1e3a8a">Psurface (absolute)</text><text x="42" y="64" font-size="11" fill="#475569">tank pressure at liquid surface</text><path d="M174 75V106" stroke="#64748b" stroke-width="2"/><path d="M169 96l5 10 5-10" fill="#64748b"/><path d="M108 104V256H326V104" fill="none" stroke="#1d4ed8" stroke-width="7"/><path d="M112 159H322V253H112Z" fill="url(#tank-water)" filter="url(#tank-shadow)"/><path d="M112 159H322" stroke="#0ea5e9" stroke-width="6"/><text x="138" y="185" font-size="12" fill="#fff" font-weight="700">LIQUID SURFACE</text><path d="M217 159V250" stroke="#1e3a8a" stroke-width="2" stroke-dasharray="4 4"/><path d="M211 169l6-11 6 11M211 240l6 11 6-11" fill="#1e3a8a"/><text x="229" y="209" font-size="14" font-weight="700" fill="#1e3a8a">Hs</text><path d="M217 256V278H518" stroke="#475569" stroke-width="17" fill="none"/><path d="M217 256V278H518" stroke="#38bdf8" stroke-width="8" fill="none"/><circle r="4.5" fill="#e0f2fe"><animate attributeName="cx" values="244;505" dur="2.2s" repeatCount="indefinite"/><animate attributeName="cy" values="278;278" dur="2.2s" repeatCount="indefinite"/></circle><circle r="4" fill="#e0f2fe" opacity=".75"><animate attributeName="cx" values="244;505" dur="2.2s" begin="-1.1s" repeatCount="indefinite"/><animate attributeName="cy" values="278;278" dur="2.2s" begin="-1.1s" repeatCount="indefinite"/></circle><circle cx="552" cy="278" r="49" fill="#dbeafe" stroke="#1e3a8a" stroke-width="6" filter="url(#tank-shadow)"/><circle cx="552" cy="278" r="12" fill="#0f4c81"/><path d="M552 264c26-16 31 14 10 21c15 22-17 27-22 7c-20 12-29-15-7-21c-10-20 15-29 19-7" fill="#3b82f6"/><path d="M600 278H823" stroke="#475569" stroke-width="17"/><path d="M600 278H823" stroke="#fb923c" stroke-width="8"/><circle r="4" fill="#ffedd5"><animate attributeName="cx" values="615;810" dur="1.8s" repeatCount="indefinite"/><animate attributeName="cy" values="278;278" dur="1.8s" repeatCount="indefinite"/></circle><path d="M384 244l88 25" stroke="#dc2626" stroke-width="2"/><rect x="349" y="198" width="185" height="37" rx="5" fill="#fff1f2" stroke="#fca5a5"/><text x="362" y="221" font-size="12" font-weight="700" fill="#b91c1c">hf: suction pipe friction loss</text><path d="M552 211V228" stroke="#b45309" stroke-width="2"/><path d="M547 218l5 10 5-10" fill="#b45309"/><rect x="458" y="164" width="190" height="35" rx="5" fill="#fffbeb" stroke="#fcd34d"/><text x="473" y="187" font-size="12" font-weight="700" fill="#b45309">Hv = Pv/(ρg) at pump inlet</text><text x="493" y="337" font-size="12" fill="#1e3a8a" font-weight="700">PUMP SUCTION</text><rect x="677" y="60" width="255" height="105" rx="7" fill="#ecfdf5" stroke="#16a34a" stroke-width="2"/><text x="695" y="91" font-size="15" fill="#166534" font-weight="700">NPSHa = Psurface/(ρg)</text><text x="695" y="116" font-size="15" fill="#166534" font-weight="700">+ Hs − hf − Hv</text><text x="695" y="144" font-size="11" fill="#166534">All terms are liquid head.</text></svg>';
    /* A deliberately roomy energy sketch: labels occupy dedicated bands above
       the pipework so no term sits on the equipment or another callout. */
    tankSvg = [
      '<svg viewBox="0 0 960 370" role="img" aria-label="NPSH energy balance with clearly separated pressure, elevation, loss and vapour terms" style="display:block;width:100%;max-width:960px;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px">',
      '<defs><linearGradient id="tank-water-clear" x1="0" x2="0" y2="1"><stop stop-color="#7dd3fc"/><stop offset="1" stop-color="#2563eb"/></linearGradient><filter id="tank-shadow-clear"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity=".18"/></filter></defs>',
      '<rect x="24" y="18" width="250" height="58" rx="7" fill="#eff6ff" stroke="#93c5fd"/><text x="41" y="43" font-size="14" font-weight="700" fill="#1e3a8a">Psurface (absolute)</text><text x="41" y="64" font-size="11" fill="#475569">tank pressure at liquid surface</text><path d="M174 76V105" stroke="#64748b" stroke-width="2"/><path d="M169 96l5 10 5-10" fill="#64748b"/>',
      '<rect x="662" y="24" width="270" height="108" rx="7" fill="#ecfdf5" stroke="#16a34a" stroke-width="2"/><text x="681" y="57" font-size="15" fill="#166534" font-weight="700">NPSHa = Psurface/(ρg)</text><text x="681" y="82" font-size="15" fill="#166534" font-weight="700">+ Hs − hf − Hv</text><text x="681" y="111" font-size="11" fill="#166534">All terms are liquid head.</text>',
      '<path d="M108 112V273H326V112" fill="none" stroke="#1d4ed8" stroke-width="7"/><path d="M112 170H322V270H112Z" fill="url(#tank-water-clear)" filter="url(#tank-shadow-clear)"/><path d="M112 170H322" stroke="#0ea5e9" stroke-width="6"/><text x="137" y="197" font-size="12" fill="#fff" font-weight="700">LIQUID SURFACE</text>',
      '<path d="M217 170V266" stroke="#1e3a8a" stroke-width="2" stroke-dasharray="4 4"/><path d="M211 180l6-11 6 11M211 255l6 11 6-11" fill="#1e3a8a"/><text x="229" y="220" font-size="14" font-weight="700" fill="#1e3a8a">Hs</text>',
      '<path d="M217 273V294H512" stroke="#475569" stroke-width="17" fill="none"/><path d="M217 273V294H512" stroke="#38bdf8" stroke-width="8" fill="none"/><circle r="4.5" fill="#e0f2fe"><animate attributeName="cx" values="246;497" dur="2.2s" repeatCount="indefinite"/><animate attributeName="cy" values="294;294" dur="2.2s" repeatCount="indefinite"/></circle><circle r="4" fill="#e0f2fe" opacity=".75"><animate attributeName="cx" values="246;497" dur="2.2s" begin="-1.1s" repeatCount="indefinite"/><animate attributeName="cy" values="294;294" dur="2.2s" begin="-1.1s" repeatCount="indefinite"/></circle>',
      '<circle cx="552" cy="294" r="49" fill="#dbeafe" stroke="#1e3a8a" stroke-width="6" filter="url(#tank-shadow-clear)"/><circle cx="552" cy="294" r="12" fill="#0f4c81"/><path d="M552 280c26-16 31 14 10 21c15 22-17 27-22 7c-20 12-29-15-7-21c-10-20 15-29 19-7" fill="#3b82f6"/><path d="M600 294H844" stroke="#475569" stroke-width="17"/><path d="M600 294H844" stroke="#fb923c" stroke-width="8"/><circle r="4" fill="#ffedd5"><animate attributeName="cx" values="615;831" dur="1.8s" repeatCount="indefinite"/><animate attributeName="cy" values="294;294" dur="1.8s" repeatCount="indefinite"/></circle>',
      '<rect x="300" y="203" width="220" height="39" rx="5" fill="#fff1f2" stroke="#fca5a5"/><text x="314" y="227" font-size="11" font-weight="700" fill="#b91c1c">hf: suction pipe friction loss</text><path d="M402 242L468 274" stroke="#dc2626" stroke-width="2"/>',
      '<rect x="548" y="164" width="202" height="39" rx="5" fill="#fffbeb" stroke="#fcd34d"/><text x="563" y="188" font-size="11" font-weight="700" fill="#b45309">Hv = Pv/(ρg) at inlet</text><path d="M620 203V239" stroke="#b45309" stroke-width="2"/><path d="M615 229l5 10 5-10" fill="#b45309"/>',
      '<text x="491" y="354" font-size="12" fill="#1e3a8a" font-weight="700">PUMP SUCTION</text></svg>'
    ].join('');
    tankSvg = [
      '<svg viewBox="0 0 960 385" role="img" aria-label="realistic suction tank and flanged pipe NPSH energy balance" style="display:block;width:100%;max-width:960px;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px">',
      '<defs><linearGradient id="tb-steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8fafc"/><stop offset=".3" stop-color="#94a3b8"/><stop offset=".72" stop-color="#334155"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient><linearGradient id="tb-water" x1="0" x2="0" y2="1"><stop stop-color="#7dd3fc"/><stop offset="1" stop-color="#2563eb"/></linearGradient><filter id="tb-shadow"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity=".2"/></filter></defs>',
      '<rect x="24" y="18" width="250" height="58" rx="7" fill="#eff6ff" stroke="#93c5fd"/><text x="41" y="43" font-size="14" font-weight="700" fill="#1e3a8a">Psurface (absolute)</text><text x="41" y="64" font-size="11" fill="#475569">tank pressure at liquid surface</text><path d="M174 76V105" stroke="#64748b" stroke-width="2"/><path d="M169 96l5 10 5-10" fill="#64748b"/>',
      '<rect x="662" y="24" width="270" height="108" rx="7" fill="#ecfdf5" stroke="#16a34a" stroke-width="2"/><text x="681" y="57" font-size="15" fill="#166534" font-weight="700">NPSHa = Psurface/(ρg)</text><text x="681" y="82" font-size="15" fill="#166534" font-weight="700">+ Hs − hf − Hv</text><text x="681" y="111" font-size="11" fill="#166534">All terms are liquid head.</text>',
      '<g filter="url(#tb-shadow)"><ellipse cx="217" cy="123" rx="112" ry="22" fill="url(#tb-steel)" stroke="#334155" stroke-width="3"/><path d="M105 123V276C105 304 329 304 329 276V123" fill="url(#tb-steel)" stroke="#334155" stroke-width="3"/><ellipse cx="217" cy="276" rx="112" ry="22" fill="#475569" stroke="#334155" stroke-width="3"/><path d="M110 175H324V272C124 290 110 272 110 272Z" fill="url(#tb-water)" opacity=".96"/><ellipse cx="217" cy="175" rx="107" ry="18" fill="#7dd3fc" stroke="#0ea5e9" stroke-width="4"/></g><text x="137" y="182" font-size="12" fill="#fff" font-weight="700">LIQUID SURFACE</text>',
      '<path d="M217 175V270" stroke="#1e3a8a" stroke-width="2" stroke-dasharray="4 4"/><path d="M211 185l6-11 6 11M211 259l6 11 6-11" fill="#1e3a8a"/><text x="229" y="222" font-size="14" font-weight="700" fill="#1e3a8a">Hs</text>',
      '<path d="M162 293V351M272 293V351" stroke="url(#tb-steel)" stroke-width="10"/><path d="M135 351H300" stroke="#475569" stroke-width="8"/><path d="M217 290V316H510" stroke="url(#tb-steel)" stroke-width="18" fill="none"/><path d="M217 290V316H510" stroke="#38bdf8" stroke-width="8" fill="none"/><circle cx="267" cy="316" r="18" fill="url(#tb-steel)" stroke="#334155" stroke-width="2"/><circle cx="267" cy="316" r="11" fill="#111827"/><circle cx="267" cy="316" r="7" fill="#d1d5db"/><g fill="#e2e8f0" stroke="#475569"><circle cx="267" cy="302" r="2"/><circle cx="281" cy="316" r="2"/><circle cx="267" cy="330" r="2"/><circle cx="253" cy="316" r="2"/></g>',
      '<circle r="4.5" fill="#e0f2fe"><animate attributeName="cx" values="291;495" dur="2.1s" repeatCount="indefinite"/><animate attributeName="cy" values="316;316" dur="2.1s" repeatCount="indefinite"/></circle><circle r="4" fill="#e0f2fe" opacity=".75"><animate attributeName="cx" values="291;495" dur="2.1s" begin="-1.05s" repeatCount="indefinite"/><animate attributeName="cy" values="316;316" dur="2.1s" begin="-1.05s" repeatCount="indefinite"/></circle>',
      '<circle cx="552" cy="316" r="49" fill="url(#tb-steel)" stroke="#1e293b" stroke-width="6" filter="url(#tb-shadow)"/>' + metallicImpeller(552, 316, 32, 'tb-steel').replace(/pb-shadow/g, 'tb-shadow') + '<path d="M600 316H844" stroke="url(#tb-steel)" stroke-width="18"/><path d="M600 316H844" stroke="#fb923c" stroke-width="8"/><circle cx="625" cy="316" r="18" fill="url(#tb-steel)" stroke="#334155" stroke-width="2"/><circle cx="625" cy="316" r="11" fill="#111827"/><circle cx="625" cy="316" r="7" fill="#d1d5db"/><circle r="4" fill="#ffedd5"><animate attributeName="cx" values="644;829" dur="1.8s" repeatCount="indefinite"/><animate attributeName="cy" values="316;316" dur="1.8s" repeatCount="indefinite"/></circle>',
      '<rect x="300" y="214" width="220" height="39" rx="5" fill="#fff1f2" stroke="#fca5a5"/><text x="314" y="238" font-size="11" font-weight="700" fill="#b91c1c">hf: suction pipe friction loss</text><path d="M402 253L468 296" stroke="#dc2626" stroke-width="2"/><rect x="548" y="177" width="202" height="39" rx="5" fill="#fffbeb" stroke="#fcd34d"/><text x="563" y="201" font-size="11" font-weight="700" fill="#b45309">Hv = Pv/(ρg) at inlet</text><path d="M620 216V262" stroke="#b45309" stroke-width="2"/><path d="M615 252l5 10 5-10" fill="#b45309"/><text x="491" y="374" font-size="12" fill="#1e3a8a" font-weight="700">PUMP SUCTION</text></svg>'
    ].join('');
    var tankLegend = '<div style="display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:8px;margin:8px 0 10px;font:10px/1.55 var(--font-mono);"><div style="padding:9px;border:1px solid #bfdbfe;border-radius:5px;"><b style="color:#1d4ed8;">OPEN TANK — atmospheric surface</b><br><b>Psurface</b> is atmospheric absolute pressure. <b>Hs</b> is positive when the liquid surface is above the pump centreline and negative for a suction lift.</div><div style="padding:9px;border:1px solid #bbf7d0;border-radius:5px;"><b style="color:#15803d;">CLOSED TANK — pressure / vent control</b><br>Use the tank <b>absolute</b> surface pressure for Psurface. <b>hf</b> is pipe/fitting loss. <b>Hv</b> is vapour-pressure head at the liquid temperature.</div></div>';
    return '<div style="font:10.5px/1.65 var(--font-mono);color:var(--text-main);margin-bottom:10px;">Use this page before entering a duty. The calculator then applies the same sequence shown here and exposes every result in the Calculation view.</div>'
      + pumpSvg + pumpLegend
      + card('1. What a pump does', 'A pump moves liquid from suction to discharge by adding energy. The motor supplies shaft power; the pump changes that power into pressure, elevation lift and flow. The result you size is <b>Total Dynamic Head (TDH)</b> plus flow.', '#2563eb')
      + card('2. Why NPSH matters', 'Pressure at the suction must remain above the liquid vapour pressure. <b>NPSHa</b> comes from the tank pressure, liquid elevation and suction losses. <b>NPSHr</b> comes from the selected pump vendor curve. Safe operation needs NPSHa − NPSHr above the required margin.', '#16a34a')
      + tankSvg + tankLegend
      + card('3. Select the family before the detailed machine', '<b>Centrifugal / impeller:</b> best general choice for continuous, clean, low-to-medium viscosity and higher-flow service. <b>PD reciprocating (piston/plunger):</b> controlled low flow and high pressure; pulsation control is required. <b>PD rotary (vane, screw, gear, lobe, peristaltic):</b> viscosity, metering, shear-sensitive or solids service depending on type. <b>Submersible centrifugal:</b> choose when the pump must be immersed / negative suction lift makes dry installation impractical.', '#f59e0b')
      + card('4. Calculation order used by Arogara', 'Fluid temperature → vapour pressure (Antoine or entered value) → design flow → liquid level / static head → suction Bernoulli and NPSHa → discharge pressure and TDH → hydraulic / shaft / motor power → nozzle continuity sizing → pump-family and curve screening. Each displayed name is repeated in the Calculation trace.', '#7c3aed')
      + card('Practical safety rule', 'For toxic, corrosive or volatile chemicals, an open atmospheric tank is not accepted as a normal final arrangement. Select a closed containment vessel and verify vent/relief, emissions, compatible materials, sealing and site regulations. The live input panel flags this condition.', '#ef4444');
  }

  function approvedFamiliesHtml() {
    var defs = '<defs>'
      + '<linearGradient id="fluid-run" x1="0" x2="1"><stop stop-color="#a5f3fc"/><stop offset=".45" stop-color="#22d3ee"/><stop offset="1" stop-color="#0284c7"/></linearGradient>'
      + '<linearGradient id="steel-pipe" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8fafc"/><stop offset=".32" stop-color="#94a3b8"/><stop offset=".58" stop-color="#475569"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>'
      + '<linearGradient id="cast-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2e8f0"/><stop offset=".38" stop-color="#94a3b8"/><stop offset=".72" stop-color="#475569"/><stop offset="1" stop-color="#1e293b"/></linearGradient>'
      + '<linearGradient id="rotor-steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8fafc"/><stop offset=".3" stop-color="#cbd5e1"/><stop offset=".58" stop-color="#64748b"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>'
      + '<linearGradient id="hose-rubber" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#64748b"/><stop offset=".5" stop-color="#0f172a"/><stop offset="1" stop-color="#475569"/></linearGradient>'
      + '<filter id="industrial-shadow"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#0f172a" flood-opacity=".28"/></filter>'
      + '</defs>';
    /* Replaces symbolic arrows with moving liquid tracers. It makes the
       direction legible without covering the component geometry. */
    var flow = function (path, seconds, delay) {
      return '<path d="' + path + '" fill="none" stroke="url(#steel-pipe)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" filter="url(#industrial-shadow)"/>'
        + '<path d="' + path + '" fill="none" stroke="url(#fluid-run)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>'
        + '<circle r="3.8" fill="#e0f2fe" stroke="#fff" stroke-width="1"><animateMotion path="' + path + '" dur="' + seconds + 's" begin="' + (delay || '0s') + '" repeatCount="indefinite"/></circle>'
        + '<circle r="2.6" fill="#bae6fd" opacity=".9"><animateMotion path="' + path + '" dur="' + seconds + 's" begin="-' + (Number(seconds) / 2).toFixed(2) + 's" repeatCount="indefinite"/></circle>';
    };
    /* Keep the risk label outside the machine: the red marker belongs at the
       local pressure minimum, while the annotation belongs in clear space.
       This is deliberately a screening map, not a claim of an exact vendor
       pressure contour. */
    var cav = function (x, y) { return '<path d="M' + x + ' ' + (y - 14) + 'V31H104" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-dasharray="3 2"/><rect x="8" y="7" width="98" height="18" rx="3" fill="#fff1f2" stroke="#fca5a5"/><text x="14" y="20" font-size="9" fill="#991b1b" font-weight="700">LOW-P SCREENING</text><circle cx="' + x + '" cy="' + y + '" r="13" fill="#fee2e2" stroke="#dc2626" stroke-width="3"/><path d="M' + (x - 5) + ' ' + y + 'q5 -10 10 0q-5 10-10 0" fill="#fff"/>'; };
    var fittings = '<g fill="url(#steel-pipe)" stroke="#334155" stroke-width="1.4"><circle cx="22" cy="74" r="8"/><circle cx="238" cy="74" r="8"/></g><g fill="#e2e8f0" stroke="#475569" stroke-width="1"><circle cx="22" cy="68" r="1.7"/><circle cx="22" cy="80" r="1.7"/><circle cx="238" cy="68" r="1.7"/><circle cx="238" cy="80" r="1.7"/></g>';
    /* Machine-specific mechanism cards use the same engineered impeller
       geometry as the main cutaway, sized to stay inside the casing and
       behind the liquid path / low-pressure screening marker. */
    var cardImpeller = function (cx, cy, r) {
      var blades = [0, 60, 120, 180, 240, 300].map(function (angle) {
        return '<g transform="rotate(' + angle + ' ' + cx + ' ' + cy + ')"><path d="M' + cx + ' ' + (cy - r * 0.18) + ' C' + (cx + r * 0.30) + ' ' + (cy - r * 0.67) + ' ' + (cx + r * 0.82) + ' ' + (cy - r * 0.70) + ' ' + (cx + r * 0.87) + ' ' + (cy - r * 0.26) + ' C' + (cx + r * 0.58) + ' ' + (cy - r * 0.02) + ' ' + (cx + r * 0.27) + ' ' + (cy + r * 0.16) + ' ' + cx + ' ' + (cy + r * 0.20) + 'Z" fill="url(#rotor-steel)" stroke="#475569" stroke-width="1"/></g>';
      }).join('');
      return '<g filter="url(#industrial-shadow)"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#dbeafe" stroke="#64748b" stroke-width="2"/>' + blades + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.34).toFixed(1) + '" fill="url(#rotor-steel)" stroke="#334155" stroke-width="1.6"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.15).toFixed(1) + '" fill="#0f172a"/><circle cx="' + (cx - r * 0.05).toFixed(1) + '" cy="' + (cy - r * 0.06).toFixed(1) + '" r="' + (r * 0.06).toFixed(1) + '" fill="#f8fafc" opacity=".8"/></g>';
    };
    var mechanism = function (kind) {
      var draw = '';
      if (kind === 'centrifugal' || kind === 'submersible') {
        var wetWell = kind === 'submersible' ? '<path d="M50 20V128H205V20" fill="#bae6fd" opacity=".55" stroke="#0284c7" stroke-width="3"/><text x="58" y="39" font-size="10" fill="#075985" font-weight="700">WET WELL / FLOODED INLET</text>' : '';
        draw = wetWell + '<circle cx="132" cy="74" r="49" fill="url(#cast-body)" stroke="#1e293b" stroke-width="5" filter="url(#industrial-shadow)"/>' + cardImpeller(132, 74, 29) + flow('M20 74H108C108 52 124 43 139 47C160 53 166 66 177 74H240', '2.1') + cav(132, 74);
      } else if (kind === 'piston') {
        draw = '<rect x="44" y="42" width="154" height="62" rx="8" fill="url(#cast-body)" stroke="#1e293b" stroke-width="4" filter="url(#industrial-shadow)"/><rect x="126" y="48" width="31" height="50" fill="url(#rotor-steel)" stroke="#475569" stroke-width="2"><animate attributeName="x" values="120;134;120" dur="1.8s" repeatCount="indefinite"/></rect><path d="M70 62l12 12-12 12M177 62l12 12-12 12" fill="none" stroke="#f97316" stroke-width="4"/><text x="146" y="32" font-size="10" fill="#475569" font-weight="700">SUCTION / DISCHARGE VALVES</text>' + flow('M20 74H78C92 74 103 65 119 65', '1.8') + flow('M162 84H180C190 84 203 74 240 74', '1.8', '-.8s') + cav(77, 74);
      } else if (kind === 'vane') {
        draw = '<circle cx="132" cy="74" r="48" fill="url(#cast-body)" stroke="#1e293b" stroke-width="5" filter="url(#industrial-shadow)"/><g><animateTransform attributeName="transform" type="rotate" from="0 142 74" to="360 142 74" dur="3.4s" repeatCount="indefinite"/><circle cx="142" cy="74" r="22" fill="url(#rotor-steel)"/>' + [0, 60, 120, 180, 240, 300].map(function (a) { var r = a * Math.PI / 180; return '<path d="M142 74L' + (142 + 42 * Math.cos(r)).toFixed(0) + ' ' + (74 + 42 * Math.sin(r)).toFixed(0) + '" stroke="#334155" stroke-width="5"/>'; }).join('') + '</g>' + flow('M20 74H85C92 110 118 122 151 109C177 99 182 78 240 74', '2.25') + cav(92, 99);
      } else if (kind === 'gear' || kind === 'lobe') {
        var shape = kind === 'gear' ? '<g><animateTransform attributeName="transform" type="rotate" from="0 111 74" to="360 111 74" dur="3s" repeatCount="indefinite"/><path d="M93 51l8-10 8 10 12-3 4 12 12 4-4 12 4 12-12 4-4 12-12-3-8 10-8-10-12 3-4-12-12-4 4-12-4-12 12-4 4-12z" fill="url(#rotor-steel)"/></g><g><animateTransform attributeName="transform" type="rotate" from="0 169 74" to="-360 169 74" dur="3s" repeatCount="indefinite"/><path d="M151 51l8-10 8 10 12-3 4 12 12 4-4 12 4 12-12 4-4 12-12-3-8 10-8-10-12 3-4-12-12-4 4-12-4-12 12-4 4-12z" fill="url(#rotor-steel)"/></g>' : '<g><animateTransform attributeName="transform" type="rotate" from="0 112 74" to="360 112 74" dur="3.2s" repeatCount="indefinite"/><circle cx="112" cy="74" r="31" fill="url(#rotor-steel)"/><circle cx="112" cy="55" r="15" fill="url(#rotor-steel)"/><circle cx="112" cy="93" r="15" fill="url(#rotor-steel)"/></g><g><animateTransform attributeName="transform" type="rotate" from="0 157 74" to="-360 157 74" dur="3.2s" repeatCount="indefinite"/><circle cx="157" cy="74" r="31" fill="url(#rotor-steel)"/><circle cx="157" cy="55" r="15" fill="url(#rotor-steel)"/><circle cx="157" cy="93" r="15" fill="url(#rotor-steel)"/></g>';
        var pocketPath = kind === 'gear' ? 'M20 74H67C73 43 100 37 128 54C151 38 184 43 193 74H240' : 'M20 74H70C79 40 112 40 134 62C156 40 187 45 197 74H240';
        draw = '<rect x="49" y="26" width="163" height="96" rx="12" fill="url(#cast-body)" stroke="#1e293b" stroke-width="4" filter="url(#industrial-shadow)"/>' + shape + flow(pocketPath, kind === 'gear' ? '2.4' : '2.15') + cav(74, 74);
      } else if (kind === 'screw') {
        draw = '<rect x="42" y="43" width="166" height="62" rx="28" fill="url(#cast-body)" stroke="#1e293b" stroke-width="4" filter="url(#industrial-shadow)"/><g><animateTransform attributeName="transform" type="translate" values="-4 0;4 0;-4 0" dur="1.6s" repeatCount="indefinite"/><path d="M65 48c25 14 25 43 0 54m37-54c25 14 25 43 0 54m37-54c25 14 25 43 0 54m37-54c25 14 25 43 0 54" fill="none" stroke="url(#rotor-steel)" stroke-width="10"/></g>' + flow('M20 74H54C73 52 88 96 106 74C124 52 140 96 158 74C176 52 191 96 210 74H240', '2.5') + cav(56, 74);
      } else if (kind === 'peristaltic') {
        draw = '<path d="M37 74H88C88 28 180 28 180 74C180 120 88 120 88 74H236" fill="none" stroke="url(#hose-rubber)" stroke-width="20"/><path d="M37 74H88C88 28 180 28 180 74C180 120 88 120 88 74H236" fill="none" stroke="#f59e0b" stroke-width="7"/><circle cx="132" cy="74" r="45" fill="none" stroke="url(#rotor-steel)" stroke-width="5"/><g><animateTransform attributeName="transform" type="rotate" from="0 132 74" to="360 132 74" dur="3s" repeatCount="indefinite"/><circle cx="100" cy="51" r="10" fill="url(#cast-body)"/><circle cx="100" cy="98" r="10" fill="url(#cast-body)"/><circle cx="164" cy="51" r="10" fill="url(#cast-body)"/><circle cx="164" cy="98" r="10" fill="url(#cast-body)"/></g>' + flow('M20 74H83C83 31 181 31 181 74C181 117 90 117 90 74H240', '2.7') + cav(82, 74);
      }
      return '<svg viewBox="0 0 260 148" role="img" aria-label="' + kind + ' pump mechanism and cavitation screening location" style="display:block;width:100%;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:5px">' + defs + draw + fittings + '</svg>';
    };
    var cards = [
      ['Centrifugal / impeller', 'centrifugal', 'Liquid accelerates into the impeller eye, then the rotating blades and volute convert velocity to pressure.', 'Screen the <b>impeller eye / inlet</b>. This is the familiar centrifugal cavitation location; confirm with the vendor NPSH3 curve.'],
      ['Submersible centrifugal', 'submersible', 'The same impeller mechanism is immersed in the wet well. The surrounding liquid normally improves suction head.', 'Screen the <b>impeller eye / inlet</b>. Being submerged does not remove cavitation risk if level, vortexing, blockage or temperature reduces inlet pressure.'],
      ['Piston / plunger', 'piston', 'A piston increases chamber volume on suction stroke and reduces it on discharge stroke; check valves direct the flow.', 'Screen the <b>suction valve, valve seat and expanding chamber</b>, especially at high speed or with long suction piping.'],
      ['Vane', 'vane', 'Sliding vanes create expanding inlet cells and shrinking discharge cells in an eccentric rotor.', 'Screen the <b>expanding inlet cell</b> immediately after the suction port; low inlet pressure can vaporise liquid there.'],
      ['Gear', 'gear', 'Gear teeth unmesh at inlet to create volume, carry liquid around the casing, and mesh again at discharge.', 'Screen the <b>tooth unmeshing / inlet pocket</b>. High inlet loss or high speed can pull this pocket below vapour pressure.'],
      ['Screw', 'screw', 'Helical rotors form sealed cavities and move liquid axially from inlet to outlet with comparatively smooth flow.', 'Screen the <b>inlet end of the rotor cavities</b>; verify the specific vendor suction limit for the screw geometry.'],
      ['Lobe', 'lobe', 'Counter-rotating lobes carry pockets of liquid around the casing without the lobes touching.', 'Screen the <b>inlet pocket as lobes separate</b>. Product viscosity, inlet restriction and speed govern the local pressure.'],
      ['Peristaltic', 'peristaltic', 'Rollers compress a flexible hose and move a trapped liquid slug; the hose recovers behind the roller to draw liquid in.', 'Screen the <b>recovering hose immediately after the inlet roller</b>. Hose collapse, high suction lift or volatile liquid can cause inlet-side vapor formation.']
    ];
    return '<div style="font:10.5px/1.65 var(--font-mono);color:var(--text-main);margin-bottom:12px;">Mechanism diagrams below identify the <b>usual screening location</b> where pressure is lowest. They are not a claim that cavitation occurs there in every service: actual onset depends on NPSHa, temperature, piping, speed, geometry and vendor test data.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;">' + cards.map(function (c) { return '<article style="border:1px solid var(--border-muted);border-top:4px solid #2563eb;border-radius:6px;padding:10px;background:rgba(248,250,252,.55);"><h3 style="margin:0 0 7px;font:800 11px var(--font-mono);color:var(--text-header);">' + c[0] + '</h3>' + mechanism(c[1]) + '<p style="margin:8px 0 5px;font:10px/1.55 var(--font-mono);color:var(--text-main);">' + c[2] + '</p><p style="margin:0;padding-top:6px;border-top:1px dashed var(--border-muted);font:9.5px/1.5 var(--font-mono);color:#991b1b;"><b>Cavitation screening:</b> ' + c[3] + '</p></article>'; }).join('') + '</div>';
  }

  function familyComparisonHtml() {
    var entries = [
      ['Centrifugal / impeller', 'High', 'Low–medium', 'Continuous clean liquid', 'Usually needs flooded/primed suction', 'No dry run', 'Flow varies with system curve'],
      ['Piston / plunger', 'Low–medium', 'Very high', 'Accurate dosing or high-pressure transfer', 'Self-priming depends on valves and installation', 'No dry run', 'Pulsation relief required'],
      ['Rotary: vane / screw / gear', 'Low–medium', 'High', 'Viscous lubricating liquid', 'Often self-priming', 'Usually no dry run', 'Use relief valve'],
      ['Rotary: lobe / peristaltic', 'Low–medium', 'Medium–high', 'Solids, shear-sensitive or contained product', 'Depends on type', 'Peristaltic can tolerate controlled dry run', 'Hose/rotor wear is a maintenance item'],
      ['Submersible centrifugal', 'Medium–high', 'Low–medium', 'Sump, pit or immersed installation', 'Flooded by installation', 'Must remain submerged/cooled', 'Use when dry suction lift is impractical']
    ];
    var head = ['Family', 'Flow', 'Pressure', 'Best application', 'Priming / suction', 'Dry run', 'Key rule'];
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font:10px/1.55 var(--font-mono);"><thead><tr>'
      + head.map(function (x) { return '<th style="padding:7px 8px;text-align:left;color:var(--color-saffron);border-bottom:1px solid var(--border-muted);">' + x + '</th>'; }).join('')
      + '</tr></thead><tbody>' + entries.map(function (r) { return '<tr>' + r.map(function (x, i) { return '<td style="padding:8px;border-bottom:1px dashed var(--border-muted);' + (i === 0 ? 'font-weight:800;color:var(--text-header);' : '') + '">' + x + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table></div><div style="margin-top:11px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:5px;font:9.5px/1.6 var(--font-mono);color:var(--text-muted);">High flow normally points toward centrifugal; high differential pressure or accurate low flow points toward positive displacement. Actual pressure, temperature, corrosion, vapour pressure, solids and seals still govern final selection.</div>';
  }

  function envelopeTableHtml() {
    var list = filteredSortedRows();
    var cats = ['centrifugal', 'submersible', 'pd-rotary', 'pd-reciprocating'];
    var catOptions = cats.map(function (c) {
      return '<option value="' + c + '"' + (state.category === c ? ' selected' : '') + '>' + categoryLabel(c) + '</option>';
    }).join('');

    var toolbar = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">'
      + '<input id="pref-search" type="text" placeholder="Search pump type or application…" value="' + esc(state.query) + '" '
      + 'style="flex:1 1 220px;min-width:180px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '<select id="pref-cat" style="background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '<option value="">All categories</option>' + catOptions + '</select>'
      + '<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">' + list.length + ' of ' + rows().length + ' types</span>'
      + '</div>';

    var th = function (label, key) {
      var arrow = state.sortKey === key ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '';
      return '<th data-sort-key="' + key + '" style="cursor:pointer;white-space:nowrap;padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">' + esc(label) + arrow + '</th>';
    };
    var head = '<tr>'
      + th('Pump Type', 'name') + th('Principle', 'category')
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Flow (m&sup3;/h)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Head (m)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Temp (&deg;C)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Preferred Viscosity (cSt)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Solids</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Self-Priming</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Dry Run</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Notes</th>'
      + '</tr>';

    var body = list.map(function (r) {
      var solids = r.fluidSuitability && r.fluidSuitability.abrasiveSlurry ? 'Suited' : 'Limited';
      return '<tr class="pref-row" data-fam-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(categoryLabel(r.category)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(fmtRange(r.flowRangeM3h)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(fmtRange(r.headRangeM)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(fmtRange(r.tempRangeC)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(fmtRange(r.viscosityRangeCst)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(solids) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(yn(r.selfPriming)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(yn(r.dryRunCapable)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);max-width:260px;">' + esc(r.note || '') + '</td>'
        + '</tr>';
    }).join('');

    return toolbar
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="9" style="padding:14px;color:var(--text-muted);">No pump types match this search.</td></tr>') + '</tbody>'
      + '</table></div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Typical engineering screening range — verify final operating envelope against manufacturer data. Source: the same 23-type Pump Selection Standard the automatic family screening (Section 10) ranks against. Click a row to see the notes panel on the right.'
      + '</div>';
  }

  /* Bands and guidance text come straight from AROPUMPFAMILY.viscosityDecision
     — the same function Section 10's automatic screening calls on the
     entered duty viscosity. Calling it here with one representative value
     per band means the thresholds and wording can never drift out of sync
     with what the ranking engine actually applies. */
  var VISCOSITY_BAND_SAMPLES = [10, 500, 2000, 5000];
  function viscosityBandsHtml() {
    if (!window.AROPUMPFAMILY || typeof window.AROPUMPFAMILY.viscosityDecision !== 'function') {
      return '<div style="color:var(--text-muted);">Viscosity-decision engine (lib/aro-pumpfamily.js) is not loaded.</div>';
    }
    var cards = VISCOSITY_BAND_SAMPLES.map(function (sample) {
      var d = window.AROPUMPFAMILY.viscosityDecision(sample);
      var color = { low: '#22c55e', moderate: '#eab308', high: '#f97316', 'very-high': '#ef4444' }[d.band] || 'var(--text-muted)';
      return '<div style="border:1px solid var(--border-muted);border-left:3px solid ' + color + ';border-radius:5px;padding:10px 12px;margin-bottom:8px;">'
        + '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:' + color + ';text-transform:uppercase;">' + esc(d.band) + ' band' + (d.correctionRequired ? ' · viscous correction required' : '') + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;color:var(--text-main);line-height:1.6;margin-top:4px;">' + esc(d.guidance) + '</div>'
        + '</div>';
    }).join('');
    return cards;
  }

  function familyViscosityTableHtml() {
    var q = state.query.trim().toLowerCase();
    var list = rows().filter(function (r) {
      if (!q) return true;
      return (r.name + ' ' + categoryLabel(r.category)).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      var av = a.viscosityRangeCst ? a.viscosityRangeCst[1] : 0;
      var bv = b.viscosityRangeCst ? b.viscosityRangeCst[1] : 0;
      return av - bv;
    });
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Pump Type</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Principle</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Viscosity Range (cSt)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">As Viscosity Rises</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Note</th>'
      + '</tr>';
    var behaviorLabel = { degrades: 'Performance degrades', tolerant: 'Tolerant / improves' };
    var body = list.map(function (r) {
      return '<tr class="pref-row" data-fam-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(categoryLabel(r.category)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(fmtRange(r.viscosityRangeCst)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(behaviorLabel[r.viscosityBehavior] || '—') + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);max-width:280px;">' + esc(r.viscosityNote || '') + '</td>'
        + '</tr>';
    }).join('');
    return '<div style="margin-bottom:8px;">'
      + '<input id="pref-search" type="text" placeholder="Search pump type…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:320px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>'
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="5" style="padding:14px;color:var(--text-muted);">No pump types match this search.</td></tr>') + '</tbody>'
      + '</table></div>';
  }

  function viscosityHtml() {
    return '<div style="margin-bottom:14px;">'
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Viscosity bands (Section 10\'s screening engine)</div>'
      + viscosityBandsHtml()
      + '</div>'
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">How each pump family responds to rising viscosity</div>'
      + familyViscosityTableHtml()
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Bands and guidance text are read directly from AROPUMPFAMILY.viscosityDecision() — the same function the automatic family screening (Section 10) calls on the entered duty viscosity. Click a row to see that family\'s full notes on the right.'
      + '</div>';
  }

  /* Faithful transcription of the NPSHa/NPSHr calculation chain the Pump
     Hydraulics engine actually runs (app.js, Section 03 · Suction Analysis).
     Not a live call — that calculation lives inline in the main results
     function, not as an exported pure function — so these steps and
     constants are copied here as static text. Every number and threshold
     below is checked against the current app.js source at the time this
     section was written; if that calculation ever changes, this section
     needs updating alongside it. */
  var NPSH_STEPS = [
    { step: 'Low liquid level', formula: 'z_LLL = z_vessel base + H_vessel × LLL % / 100', note: 'The user enters the vessel base elevation and the real shell height. A percentage cannot be converted into an elevation without both.' },
    { step: 'Static suction head', formula: 'Hs = z_LLL − z_pump', note: 'Low liquid level and pump centerline are both grade-referenced, so a pump on a tall foundation is charged correctly for its own elevation.' },
    { step: 'Suction static pressure', formula: 'p_sucA = p_vessel,abs + ρg·Hs − Δp_suction-line − ρv²/2', note: 'This is the static pressure at the suction flange. Δp_suction-line is the calculated friction/fitting loss in the suction piping.' },
    { step: 'NPSH available', formula: 'NPSHa = p_sucA/(ρg) + v²/(2g) − p_v/(ρg)', note: 'The flange velocity head restores the dynamic term removed from static flange pressure. This equals the free-surface form: p_vessel/(ρg) + Hs − h_f − p_v/(ρg).' },
    { step: 'NPSH margin', formula: 'Margin = NPSHa − NPSHr', note: 'The absolute margin used against the fluid-category margin limit below.' }
  ];
  var NPSHR_SOURCES = [
    { rank: 1, source: 'Vendor NPSH3 entered at rated flow', detail: 'This is the preferred input and the only basis suitable for a committed pump selection.' },
    { rank: 2, source: 'Linked vendor NPSH3', detail: 'A manufacturer NPSH3 value carried in from a connected vendor data record.' },
    { rank: 3, source: 'Predicted from suction specific speed (Nss)', detail: 'Only used when curve prediction is switched on and neither vendor value exists. It is labelled as a screening estimate and must be replaced by a vendor curve.' },
    { rank: 4, source: 'Data required', detail: 'No NPSHr is invented. System elevation, friction loss and datum calculate NPSHa; they cannot calculate the pump’s NPSHr.' }
  ];
  var NPSH_RATIO_BANDS = [
    { range: '< 1.0', label: 'CRITICAL — CAVITATION', color: '#ef4444' },
    { range: '1.0 – 1.1', label: 'RISKY — Monitor closely', color: '#f97316' },
    { range: '1.1 – 1.5', label: 'ACCEPTABLE', color: '#eab308' },
    { range: '≥ 1.5', label: 'GOOD — Safe margin', color: '#22c55e' }
  ];

  function elevationNpshHtml() {
    var stepsHtml = NPSH_STEPS.map(function (s, i) {
      return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:9px 12px;margin-bottom:7px;">'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">STEP ' + (i + 1) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--text-header);margin:2px 0 4px;">' + esc(s.step) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:11px;color:var(--color-saffron);margin-bottom:4px;">' + esc(s.formula) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.6;">' + esc(s.note) + '</div>'
        + '</div>';
    }).join('');

    var srcHtml = '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead><tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);width:34px;">#</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">NPSHr source</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">How it is used</th>'
      + '</tr></thead><tbody>'
      + NPSHR_SOURCES.map(function (r) {
        return '<tr><td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);">' + r.rank + '</td>'
          + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.source) + '</td>'
          + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);">' + esc(r.detail) + '</td></tr>';
      }).join('')
      + '</tbody></table>';

    var bandsHtml = NPSH_RATIO_BANDS.map(function (b) {
      return '<div style="display:flex;gap:10px;align-items:baseline;border-left:3px solid ' + b.color + ';padding:5px 10px;margin-bottom:5px;">'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:' + b.color + ';min-width:90px;">' + esc(b.range) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;color:var(--text-main);">' + esc(b.label) + '</div>'
        + '</div>';
    }).join('');

    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">How NPSHa is calculated</div>'
      + stepsHtml
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">Where NPSHr comes from (priority order)</div>'
      + srcHtml
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">NPSHa / NPSHr ratio bands</div>'
      + bandsHtml
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Cavitation status shown alongside these numbers uses a separate absolute margin limit selected by fluid category (a water-service default of 1.0 m head, user-adjustable for other categories) — NPSHa below NPSHr always fails outright regardless of the ratio bands above; NPSHa above NPSHr but inside the margin limit reads MARGINAL rather than SAFE.'
      + '</div>';
  }

  /* The Pump Hydraulics trace is ordered by dependency: nozzle bore establishes
     suction velocity; velocity establishes its Bernoulli term; then NPSH and
     duty head can be evaluated. This is the same sequence shown to users in
     the live calculation trace, but with governing equations kept as a
     readable reference rather than a second calculation engine. */
  var EQUATIONS = [
    { name: '1 · Design flow', formula: 'Q_design = Q_normal × (1 + design margin / 100)', clause: 'Process design basis', note: 'The normal process flow is increased by the entered design margin before all hydraulic sizing begins.' },
    { name: '2 · Nozzle sizing — continuity equation', formula: 'Q = vA;  A = Q/v;  D = √(4A/π);  v_selected = 4Q/(πD_selected²)', clause: 'Continuity / nozzle velocity practice', note: 'The target velocity gives a minimum area; the next practical standard bore is selected; the actual selected suction and discharge velocities then feed the velocity-head calculation.' },
    { name: '3 · Vapour pressure at the suction condition', formula: 'P_v = user-entered vapour pressure, or Antoine(T) correlation', clause: 'Fluid property at operating temperature', note: 'P_v is absolute pressure. It is converted to vapour-pressure head Hv = P_v/(ρg) before the NPSH balance.' },
    { name: '4 · Selected tank arrangement', formula: 'P_surface = P_atm (open tank) or P_tank,absolute (closed tank)', clause: 'Pressure boundary condition', note: 'The selected arrangement defines the liquid-surface pressure used in the suction balance. Gauge pressure is converted to absolute before use.' },
    { name: '5 · Low liquid level from vessel geometry', formula: 'z_LLL = z_vessel base + H_vessel × (LLL % / 100)', clause: 'Grade-referenced vessel geometry', note: 'Shell height, vessel base elevation and LLL percentage locate the lowest liquid surface relative to the pump centreline.' },
    { name: '6 · Bernoulli suction balance — NPSHa', formula: 'P_surface/(ρg) + z_surface = P_suction/(ρg) + v_s²/(2g) + z_pump + h_f;  NPSHa = P_suction/(ρg) + v_s²/(2g) − P_v/(ρg)', clause: 'Bernoulli energy equation', note: 'Equivalent free-surface form: NPSHa = P_surface/(ρg) + Hs − hf − Hv. Hs is signed static suction head; hf and Hv always reduce the available suction margin.' },
    { name: '7 · NPSH margin and NPSHr source', formula: 'Margin = NPSHa − NPSHr;  required ≥ max(1.0 m, 0.10 × NPSHr)', clause: 'API 610 cl. 6.1.6 / vendor NPSH3', note: 'NPSHr belongs to the selected pump and must ultimately come from its vendor NPSH3 curve. A screening estimate is never a final vendor selection.' },
    { name: '7A · Vapour-pressure safety margin', formula: 'VP safety margin = NPSHa − Hv', clause: 'Screening indicator', note: 'This is the calculated distance above the vapour-pressure line. It supports the NPSH review but does not replace the NPSHa − NPSHr criterion.' },
    { name: '8 · Discharge pressure and differential head', formula: 'P_discharge,g = P_destination,g + ρg(z_destination − z_pump)/10⁵ + ΔP_discharge;  H = (P_discharge,a − P_suction,total) × 10⁵/(ρg)', clause: 'Energy balance', note: 'Destination gauge pressure, static discharge lift and route losses determine discharge pressure. Differential head uses absolute pressures at the pump suction and discharge.' },
    { name: '8A · Shut-off pressure and shut-off head', formula: 'ΔP_shut-off = ΔP_design × (1 + shut-off margin / 100);  P_shut-off,a = P_suction,total + ΔP_shut-off', clause: 'Pump curve / casing pressure screening', note: 'The shut-off calculation checks the higher pressure at zero flow. Confirm the final casing, flange, seal and relief ratings against vendor data.' },
    { name: '9 · Hydraulic power', formula: 'P_hyd (kW) = ΔP_bar × Q_m³/h / 36', clause: 'Fluid power', note: 'Hydraulic power is the energy transferred to the liquid at the calculated differential pressure and design flow.' },
    { name: '10 · Shaft power', formula: 'P_shaft = P_hyd / η_pump', clause: 'Pump efficiency', note: 'η_pump is the selected/viscosity-corrected pump efficiency. This is the mechanical power the pump shaft must receive.' },
    { name: '11 · Motor input power (MHP)', formula: 'MHP = P_shaft / η_motor', clause: 'Motor efficiency', note: 'Motor input power accounts for electrical-to-shaft losses. It is used before motor service factor and preferred motor selection.' },
    { name: '12 · Driver rating, service factor and preferred motor selection', formula: 'P_required = MHP × max(API driver margin, 1 + service factor/100);  P_selected = next preferred rating ≥ P_required;  loading = P_shaft/P_selected × 100', clause: 'API 610 Table 12 / IEC preferred ratings', note: 'The governing margin is the larger of the API driver band and entered service factor. The selected rating is rounded up, then loading is checked against the selected motor.' }
  ];

  function equationsHtml() {
    var cards = EQUATIONS.map(function (e) {
      return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:10px 12px;margin-bottom:8px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;">'
        + '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--text-header);">' + esc(e.name) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">' + esc(e.clause) + '</div>'
        + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;color:var(--color-saffron);margin:6px 0;overflow-x:auto;white-space:nowrap;">' + esc(e.formula) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.6;">' + esc(e.note) + '</div>'
        + '</div>';
    }).join('');
    return '<div style="margin:0 0 10px;padding:9px 11px;border-left:4px solid #7c3aed;background:rgba(124,58,237,.06);font:10px/1.6 var(--font-mono);color:var(--text-main);"><b>GOVERNING CALCULATION SEQUENCE</b><br>Each formula below is in the same dependency order used by the Pump Hydraulics calculation trace. Symbols match the trace and the 2D drawing.</div>' + cards
      + '<div style="margin-top:6px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'For centrifugal duty, the supplier curve still controls final NPSHr, shut-off head, efficiency and operating region. For positive-displacement duty, use the same suction and power balances but confirm relief sizing, pulsation and the vendor\'s pressure limit.'
      + '</div>';
  }

  /* The value-provenance vocabulary these results actually carry, read
     from the literal status strings across lib/aro-pump*.js and app.js's
     mechanical-applicability gating (Phase 1/2 of this upgrade). This is
     distinct from the family-selection verdicts (SUITABLE / CHECK / NOT
     RECOMMENDED, from AROPUMPFAMILY.scoreToVerdict) and from the P&ID
     item-inclusion status (RECOMMENDED / REQUIRED) — those answer "is
     this a good choice", this answers "where did this number come from". */
  var PROVENANCE = [
    { status: 'CALCULATED', color: '#22c55e', def: 'Derived directly from this duty\'s own entered inputs through a stated formula — the most common status. Re-running the same inputs always reproduces the same figure.' },
    { status: 'PREDICTED', color: '#3b82f6', def: 'A screening estimate from a correlation standing in for real vendor/curve data (e.g. NPSHr inverted from suction specific speed, a motor size band from brake power). Always labeled as a prediction, never presented as measured.' },
    { status: 'PRELIMINARY ASSUMPTION', color: '#3b82f6', def: 'A first-pass mechanical sizing (e.g. an assumed bearing type, a BOM material) made before a vendor has confirmed the actual component — reasonable for early screening, not for procurement.' },
    { status: 'VENDOR REQUIRED', color: '#f97316', def: 'This app has no generic model for the figure at all — the shaft/bearing sizing for several full-track-pending PD families, for instance. Obtain the number from a manufacturer; nothing here approximates it.' },
    { status: 'NOT APPLICABLE', color: '#a3a3a3', def: 'The component or check genuinely does not exist for this family\'s construction (a diaphragm pump has no shaft seal to screen) — not a blank left by omission. Section 09 · Mechanical Construction is the reference table this status is read from.' },
    { status: 'DATA REQUIRED', color: '#ef4444', def: 'A calculation cannot run yet because a required input has not been entered — never filled with a default or a guess to let the screen render something.' }
  ];

  function provenanceHtml() {
    var cards = PROVENANCE.map(function (p) {
      return '<div style="border:1px solid var(--border-muted);border-left:3px solid ' + p.color + ';border-radius:5px;padding:9px 12px;margin-bottom:8px;">'
        + '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:' + p.color + ';">' + esc(p.status) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;color:var(--text-main);line-height:1.6;margin-top:4px;">' + esc(p.def) + '</div>'
        + '</div>';
    }).join('');
    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Value-provenance status badges</div>'
      + cards
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Distinct from the family-selection verdicts (SUITABLE / CHECK / NOT RECOMMENDED) shown against each candidate pump type in Section 10\'s automatic screening — those judge whether a family fits the duty, these badges say where a printed number came from.'
      + '</div>';
  }

  /* Shared by Sections 02 and 03: both criteria are screened by the exact
     same AROPUMPFAMILY.fitScore()/scoreToVerdict() logic Section 10's
     automatic ranking runs — only the field and unit differ. Text below is
     transcribed from that function's own documentation comment, not a
     separate description of how it "should" work. */
  function fitScoringExplainerHtml() {
    return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:10px 12px;margin-bottom:12px;">'
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:var(--text-header);margin-bottom:6px;">How this criterion is scored (AROPUMPFAMILY.fitScore)</div>'
      + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-main);line-height:1.7;">'
      + 'A duty value inside a family\'s stated range scores 1.0. Outside it, the score decays on a log scale — roughly a factor of 20&times; beyond the edge reaches zero — gentle enough that a duty just outside a family\'s envelope still reads CHECK rather than being discarded outright, since these are guide ranges, not hard cutoffs.'
      + '</div>'
      + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.7;margin-top:8px;">'
      + 'The resulting 0&ndash;100 score (AROPUMPFAMILY.scoreToVerdict) becomes: &ge;70 <b style="color:#22c55e;">SUITABLE</b> &middot; &ge;40 <b style="color:#eab308;">CHECK</b> &middot; below 40 <b style="color:#ef4444;">NOT RECOMMENDED</b> &mdash; the same verdict band Section 10\'s automatic screening prints against every candidate.'
      + '</div>'
      + '</div>';
  }

  function rangeSelectionHtml(fieldKey, unit) {
    var list = rows().filter(function (r) {
      var q = state.query.trim().toLowerCase();
      if (!q) return true;
      return (r.name + ' ' + categoryLabel(r.category)).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      var av = a[fieldKey] ? a[fieldKey][0] : 0;
      var bv = b[fieldKey] ? b[fieldKey][0] : 0;
      return av - bv;
    });
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Pump Type</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Principle</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">' + esc(unit) + ' Range</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Application</th>'
      + '</tr>';
    var body = list.map(function (r) {
      return '<tr class="pref-row" data-fam-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(categoryLabel(r.category)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(fmtRange(r[fieldKey])) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);max-width:320px;">' + esc(r.application || '') + '</td>'
        + '</tr>';
    }).join('');
    return '<div style="margin-bottom:8px;">'
      + '<input id="pref-search" type="text" placeholder="Search pump type…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:320px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>'
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="4" style="padding:14px;color:var(--text-muted);">No pump types match this search.</td></tr>') + '</tbody>'
      + '</table></div>';
  }

  function flowSelectionHtml() {
    return fitScoringExplainerHtml()
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Pump types sorted by flow range</div>'
      + rangeSelectionHtml('flowRangeM3h', 'Flow (m³/h)');
  }
  function headSelectionHtml() {
    return fitScoringExplainerHtml()
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Pump types sorted by head range</div>'
      + rangeSelectionHtml('headRangeM', 'Head (m)');
  }

  /* Rule text transcribed verbatim from AROPUMPFAMILY.selectFamilies()'s
     own abrasives-scoring branch — the exact reasons/warnings strings the
     automatic screening prints, not a separate summary of the logic. */
  var SOLIDS_RULES = [
    { verdict: 'Suited (+5 score)', color: '#22c55e', text: 'Abrasive solids were flagged, and this family is built to tolerate them (fluidSuitability.abrasiveSlurry is true).' },
    { verdict: 'Fails (-15 score)', color: '#ef4444', text: 'Abrasive solids were flagged — this family\'s close internal clearances / impeller wet-end wear quickly on abrasives. Applies to centrifugal and rotary-PD families not built for slurry duty.' },
    { verdict: 'Marginal', color: '#eab308', text: 'Abrasive solids were flagged and the family is neither a built-for-slurry design nor a close-clearance centrifugal/rotary-PD type (e.g. reciprocating PD) — reviewed case by case rather than scored a hard pass or fail.' }
  ];

  function solidsSlurryHtml() {
    var ruleCards = SOLIDS_RULES.map(function (r) {
      return '<div style="border:1px solid var(--border-muted);border-left:3px solid ' + r.color + ';border-radius:5px;padding:9px 12px;margin-bottom:8px;">'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:' + r.color + ';">' + esc(r.verdict) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-main);line-height:1.6;margin-top:4px;">' + esc(r.text) + '</div>'
        + '</div>';
    }).join('');

    var q = state.query.trim().toLowerCase();
    var list = rows().filter(function (r) {
      if (!q) return true;
      return (r.name + ' ' + categoryLabel(r.category)).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      var av = (a.fluidSuitability && a.fluidSuitability.abrasiveSlurry) ? 0 : 1;
      var bv = (b.fluidSuitability && b.fluidSuitability.abrasiveSlurry) ? 0 : 1;
      if (av !== bv) return av - bv;
      return a.name.localeCompare(b.name);
    });
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Pump Type</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Principle</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Abrasive Slurry</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Key limitations</th>'
      + '</tr>';
    var body = list.map(function (r) {
      var suited = !!(r.fluidSuitability && r.fluidSuitability.abrasiveSlurry);
      return '<tr class="pref-row" data-fam-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(categoryLabel(r.category)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);' + (suited ? 'color:#22c55e;font-weight:700;' : 'color:var(--text-muted);') + '">' + (suited ? 'Suited' : 'Not suited') + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);max-width:320px;">' + esc(r.keyLimitations || '') + '</td>'
        + '</tr>';
    }).join('');

    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">How abrasive/solids duty is scored (Section 10\'s screening)</div>'
      + ruleCards
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">Which families are built for abrasive slurry</div>'
      + '<div style="margin-bottom:8px;">'
      + '<input id="pref-search" type="text" placeholder="Search pump type…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:320px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>'
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="4" style="padding:14px;color:var(--text-muted);">No pump types match this search.</td></tr>') + '</tbody>'
      + '</table></div>';
  }

  /* Temperature is carried by every family row (tempRangeC, tempNote) but
     is not yet screened by AROPUMPFAMILY.selectFamilies() the way
     abrasives/viscosity/shear are — so this section is a straight
     reference table rather than a scoring-rule explainer, and says so. */
  function temperatureHtml() {
    var q = state.query.trim().toLowerCase();
    var list = rows().filter(function (r) {
      if (!q) return true;
      return (r.name + ' ' + categoryLabel(r.category)).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      var av = a.tempRangeC ? a.tempRangeC[1] : 0;
      var bv = b.tempRangeC ? b.tempRangeC[1] : 0;
      return bv - av;
    });
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Pump Type</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Principle</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Temp Range (&deg;C)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">What actually sets the limit</th>'
      + '</tr>';
    var body = list.map(function (r) {
      return '<tr class="pref-row" data-fam-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(categoryLabel(r.category)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(fmtRange(r.tempRangeC)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);' + (r.tempNote ? 'color:var(--text-main);' : 'color:var(--text-muted);') + 'max-width:340px;">' + esc(r.tempNote || 'Casing/wetted-material rating — no additional caveat.') + '</td>'
        + '</tr>';
    }).join('');
    return '<div style="margin-bottom:8px;">'
      + '<input id="pref-search" type="text" placeholder="Search pump type…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:320px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>'
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="4" style="padding:14px;color:var(--text-muted);">No pump types match this search.</td></tr>') + '</tbody>'
      + '</table></div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Temperature is not yet screened by the automatic family ranking (Section 10) the way viscosity and abrasives are — these ranges are reference-only. Where a note names a specific limiting part (an elastomer, a submergence rating), that part\'s own material rating is the real ceiling, not the casing metal.'
      + '</div>';
  }

  /* The 7 API 682 seal plans this app screens against, transcribed
     verbatim from lib/aro-pumpseal.js's SEAL_PLANS array — the same
     descriptions selectSealPlan() carries through to its own verdicts. */
  var SEAL_PLANS_REF = [
    { id: '11', name: 'Plan 11 — Discharge Recirculation', category: 'Single', note: 'Recirculates discharge fluid back to the seal chamber through a restriction orifice — the baseline single-seal plan for clean, moderate-temperature service.' },
    { id: '13', name: 'Plan 13 — Seal Chamber to Suction', category: 'Single', note: 'Routes seal-chamber flow back to suction instead of drawing from discharge — the standard variant for vertical pumps that need continuous chamber venting.' },
    { id: '21', name: 'Plan 21 — Cooled Discharge Recirculation', category: 'Single', note: 'Plan 11 with a cooler in the recirculation line, extending the usable temperature range without an independent loop.' },
    { id: '23', name: 'Plan 23 — Recirculating Cooled Loop', category: 'Single', note: 'A closed loop with its own pumping ring and cooler, independent of process pressure — the standard choice for the hottest single-seal services (e.g. boiler feedwater).' },
    { id: '32', name: 'Plan 32 — External Clean Flush', category: 'Single', note: 'Injects a clean external fluid into the seal chamber — needed whenever the pumped fluid itself is not clean enough to run across the seal faces.' },
    { id: '52', name: 'Plan 52 — Dual Seal, Unpressurized Buffer', category: 'Dual (unpressurized)', note: 'A buffer fluid at less than process pressure between two seals — containment and leak detection without a fully pressurized barrier system.' },
    { id: '53A', name: 'Plan 53A — Dual Seal, Pressurized Barrier', category: 'Dual (pressurized)', note: 'A barrier fluid kept above process pressure — any leakage path runs barrier fluid into the process, not process fluid to atmosphere. The plan for zero-leakage/most-hazardous duty.' }
  ];
  /* Fluid hazard classes from the same file's FLUID_SEAL_HAZARD table —
     a seal-specific containment-need tag, not the corrosivity class used
     elsewhere in this app (Section 06 · Solids & Slurry, MOC screening). */
  var SEAL_HAZARD_DRIVERS = [
    { hazard: 'Benign (water, condensate, glycol, brine)', drives: 'No hazard-driven plan preference — the choice is temperature and cleanliness only.' },
    { hazard: 'Flammable (hydrocarbons, alcohols, ketones)', drives: 'Plan 52 is common practice, containing leakage rather than releasing it to atmosphere; single seals are still widely used too — confirm against site fugitive-emission practice and HAZOP.' },
    { hazard: 'Toxic (e.g. ammonia)', drives: 'Plan 52 (unpressurized dual seal with buffer/leak detection) is standard practice; a single seal is flagged NOT RECOMMENDED — it leaks process fluid to atmosphere on failure.' },
    { hazard: 'Toxic-corrosive (caustic, sulfuric/hydrochloric acid)', drives: 'Plan 53A (pressurized barrier, zero product leakage) is the standard choice; a single seal is flagged NOT RECOMMENDED outright.' }
  ];
  var SEAL_TEMP_DRIVERS = [
    { band: '≤ 150°C', drives: 'Plan 11/13/21 suit uncooled or lightly cooled recirculation; Plan 23\'s independent cooled loop is usually over-specified here.' },
    { band: '150–220°C', drives: 'Plan 11/13 (uncooled) are flagged NOT RECOMMENDED above the ~150°C uncooled-recirculation limit; Plan 21\'s in-line cooler handles this range.' },
    { band: '> 220°C', drives: 'Plan 11/13/21 are all flagged NOT RECOMMENDED — a recirculation-line cooler can\'t reliably manage this; Plan 23\'s independent, fully cooled loop is the standard choice.' }
  ];

  function sealSelectionHtml() {
    var planHead = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Plan</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Category</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Description</th>'
      + '</tr>';
    var planBody = SEAL_PLANS_REF.map(function (p) {
      return '<tr><td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);white-space:nowrap;">' + esc(p.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);white-space:nowrap;">' + esc(p.category) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);">' + esc(p.note) + '</td></tr>';
    }).join('');

    var hazardCards = SEAL_HAZARD_DRIVERS.map(function (h) {
      return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:8px 11px;margin-bottom:7px;">'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:var(--text-header);">' + esc(h.hazard) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:3px;">' + esc(h.drives) + '</div>'
        + '</div>';
    }).join('');
    var tempCards = SEAL_TEMP_DRIVERS.map(function (t) {
      return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:8px 11px;margin-bottom:7px;">'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:var(--color-saffron);">' + esc(t.band) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:3px;">' + esc(t.drives) + '</div>'
        + '</div>';
    }).join('');

    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">The 7 API 682 seal plans this app screens</div>'
      + '<div style="overflow-x:auto;margin-bottom:14px;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + planHead + '</thead><tbody>' + planBody + '</tbody></table></div>'
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">What the fluid\'s hazard classification drives</div>'
      + hazardCards
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">What operating temperature drives (single-seal plans only)</div>'
      + tempCards
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Two more drivers apply on top of these: dirty service (solids in the pumped fluid) always pushes toward Plan 32\'s external clean flush regardless of hazard or temperature, and a vertical orientation favors Plan 13 (suction-side venting) over Plan 11. This is the same selectSealPlan() decision tree the live Seal Selection results run — not a separate summary of it.'
      + '</div>';
  }

  /* The 10-material MOC library, transcribed verbatim from
     lib/aro-pumpmoc.js's MATERIALS array (id, applicableComponents,
     corrosivityTolerance, maxTempC, avoidFluids, note) — the same seed
     library the live Material of Construction screening ranks against
     for casing/impeller/shaft/wear-rings. That engine itself calls this
     a seed library, not a certified material data sheet, and every
     result it prints is labeled PREDICTED for that reason. */
  var MOC_MATERIALS = [
    { name: 'Grey Cast Iron (ASTM A48)', components: 'Casing, impeller, wear rings', tolerance: 'mild', maxTempC: 230, avoid: 'Sulfuric acid, hydrochloric acid, ammonia', note: 'Lowest cost, but brittle and the most limited chemically — mild, non-shock service only.' },
    { name: 'Ductile Iron (ASTM A536)', components: 'Casing, impeller, wear rings', tolerance: 'mild', maxTempC: 230, avoid: 'Sulfuric acid, hydrochloric acid', note: 'Tougher than grey cast iron at similar chemical resistance — the common general-purpose casing material.' },
    { name: 'Carbon Steel (ASTM A216 WCB)', components: 'Casing, impeller, shaft', tolerance: 'moderate', maxTempC: 425, avoid: 'Hydrochloric acid; caustic embrittlement risk above 50°C', note: 'The default process casing/shaft material for hydrocarbon and mild-chemical duty.' },
    { name: 'Bronze (ASTM B584)', components: 'Impeller, wear rings', tolerance: 'moderate', maxTempC: 200, avoid: 'Ammonia (attacks copper alloys)', note: 'Good bearing/wear properties and seawater resistance.' },
    { name: 'Ni-Resist Austenitic Cast Iron', components: 'Casing, impeller, wear rings', tolerance: 'moderate', maxTempC: 300, avoid: 'Hydrochloric acid', note: 'A step up from plain cast iron, often paired with a bronze or 316 impeller as a galvanically compatible wear-ring set.' },
    { name: '316 Stainless Steel (CF8M)', components: 'Casing, impeller, shaft, wear rings', tolerance: 'moderate', maxTempC: 425, avoid: 'Hydrochloric acid; chloride SCC risk above 60°C', note: 'The general-purpose corrosion-resistant choice — susceptible to chloride stress-corrosion cracking once hot.' },
    { name: 'Duplex Stainless Steel (CD4MCu / 2205)', components: 'Casing, impeller, shaft, wear rings', tolerance: 'severe', maxTempC: 300, avoid: 'Chloride SCC risk above 150°C', note: 'Much better chloride resistance and higher strength than 316, at a moderate cost premium.' },
    { name: 'Super Duplex Stainless Steel (2507)', components: 'Casing, impeller, shaft, wear rings', tolerance: 'severe', maxTempC: 300, avoid: 'Chloride SCC risk above 200°C', note: 'The premium chloride-resistant alloy for aggressive brine/seawater service.' },
    { name: 'Hastelloy C-276', components: 'Casing, impeller, shaft, wear rings', tolerance: 'severe', maxTempC: 450, avoid: 'None listed', note: 'Excellent resistance to strong mineral acids (sulfuric, hydrochloric) across a wide temperature range — high cost.' },
    { name: 'Titanium Grade 2', components: 'Casing, impeller, wear rings', tolerance: 'severe', maxTempC: 300, avoid: 'Hydrochloric acid, sulfuric acid (reducing acids)', note: 'Essentially immune to chloride pitting/SCC and excellent in oxidizing acids.' }
  ];
  var TOLERANCE_COLOR = { mild: '#a3a3a3', moderate: '#eab308', severe: '#22c55e' };

  function materialSelectionHtml() {
    var q = state.query.trim().toLowerCase();
    var list = MOC_MATERIALS.filter(function (m) {
      if (!q) return true;
      return (m.name + ' ' + m.components).toLowerCase().indexOf(q) !== -1;
    });
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Material</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Applicable Components</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Corrosivity Tolerance</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Max Temp</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Avoid / Watch For</th>'
      + '</tr>';
    var body = list.map(function (m) {
      var c = TOLERANCE_COLOR[m.tolerance] || 'var(--text-muted)';
      return '<tr>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);white-space:nowrap;">' + esc(m.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);white-space:nowrap;">' + esc(m.components) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:' + c + ';font-weight:700;text-transform:uppercase;">' + esc(m.tolerance) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);white-space:nowrap;">' + m.maxTempC + '&deg;C</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);max-width:260px;">' + esc(m.avoid) + '</td>'
        + '</tr>';
    }).join('');
    return '<div style="margin-bottom:8px;">'
      + '<input id="pref-search" type="text" placeholder="Search material or component…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:340px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>'
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="5" style="padding:14px;color:var(--text-muted);">No materials match this search.</td></tr>') + '</tbody>'
      + '</table></div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'This is a seed library (10 materials), the same scale as the pump family database — meant to be extended, not a certified material data sheet. Every verdict the live screening prints against these materials is labeled PREDICTED for that reason, and a fluid this app doesn\'t recognize reports DATA REQUIRED rather than guessing a corrosivity class.'
      + '</div>';
  }

  /* Transcribed verbatim from lib/aro-pumpdriver.js: the 3 motor enclosure
     ratings, 3 coupling types, and the motor-size starting-method bands
     the live Motor / Driver screening actually uses. */
  var ENCLOSURES_REF = [
    { name: 'Standard (TEFC/ODP)', note: 'Standard industrial enclosure — no ignition-protection rating, for a non-hazardous atmosphere only. NOT RECOMMENDED once the fluid is flammable, toxic, or toxic-corrosive.' },
    { name: 'Increased Safety, Ex e (IEC 60079-7)', note: 'No internal arcing/sparking parts by design — common for less severe hazardous-area zones. Suitable when hazardous; an unnecessary cost premium (CHECK) when not.' },
    { name: 'Flameproof, Ex d (IEC 60079-1)', note: 'The most conservative rating — suitable for any hazardous-area zone this fluid might require. Also an unnecessary cost premium (CHECK) for a non-hazardous fluid.' }
  ];
  var COUPLINGS_REF = [
    { name: 'Disc/Diaphragm Coupling', note: 'The modern default for API 610 process service — a non-lubricated metallic membrane with no wear parts.' },
    { name: 'Gear Coupling', note: 'Higher misalignment tolerance than a disc coupling, at the cost of periodic re-lubrication — still common on older or heavy-duty installations.' },
    { name: 'Elastomeric (Jaw/Tyre) Coupling', note: 'Simple and inexpensive, absorbs shock and minor misalignment well — the standard utility-duty choice. Flagged CHECK in an API 610 process context, which typically specifies a non-lubricated metallic coupling instead.' }
  ];
  var STARTING_BANDS_REF = [
    { band: '≤ 37 kW', recommendation: 'Direct-on-line (DOL) starting is typical at this size — the inrush current is usually well within a standard supply\'s capability.' },
    { band: '37 – 160 kW', recommendation: 'Reduced-voltage starting (star-delta, soft starter) or a VFD is typical practice at this size to limit inrush current and starting torque shock.' },
    { band: '> 160 kW', recommendation: 'A VFD or soft starter is strongly typical at this size — direct-on-line inrush current would be significant for the supply and the driven equipment.' }
  ];

  function motorDriverHtml() {
    function cardList(items, accentField) {
      return items.map(function (it) {
        return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:8px 11px;margin-bottom:7px;">'
          + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:var(--text-header);">' + esc(it.name || it.band) + '</div>'
          + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:3px;">' + esc(it.note || it.recommendation) + '</div>'
          + '</div>';
      }).join('');
    }
    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Motor enclosure ratings (hazard-driven)</div>'
      + cardList(ENCLOSURES_REF)
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">Coupling types</div>'
      + cardList(COUPLINGS_REF)
      + '<div style="margin-bottom:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Required continuous torque rating = running torque &times; 1.5 (typical service-factor margin); required peak torque rating = running torque &times; 2.5 (typical motor starting/breakaway allowance). A close-coupled configuration (impeller mounted directly on the motor shaft extension) has no separate coupling to select — NOT APPLICABLE.'
      + '</div>'
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">Starting method by motor size</div>'
      + cardList(STARTING_BANDS_REF);
  }

  /* Standard nozzle bores transcribed verbatim from app.js's STANDARD_NOZZLES
     (ASME B36.10M schedule-40 internal diameters) — copied here as a plain
     const in app.js does not attach to window, so it can't be read live.
     The flow-at-target-velocity columns are computed on the fly from these
     exact bores using Q = V * A * 3600 — the same formula
     getNozzleForTargetVelocity() inverts to size a nozzle from a flow. */
  var STANDARD_NOZZLES_REF = [
    { nps: '1/2"', id: 15.8 }, { nps: '3/4"', id: 20.9 }, { nps: '1"', id: 26.6 },
    { nps: '1½"', id: 40.9 }, { nps: '2"', id: 52.5 }, { nps: '3"', id: 77.9 },
    { nps: '4"', id: 102.3 }, { nps: '6"', id: 154.1 }, { nps: '8"', id: 202.7 },
    { nps: '10"', id: 254.5 }, { nps: '12"', id: 303.2 }, { nps: '14"', id: 333.4 },
    { nps: '16"', id: 381.0 }, { nps: '18"', id: 428.7 }, { nps: '20"', id: 477.9 },
    { nps: '24"', id: 574.6 }
  ];
  var SUCTION_TARGET_VEL_MS = 2.0;   // app.js pump-noz-vel-suc software default
  var DISCHARGE_TARGET_VEL_MS = 3.5; // app.js pump-noz-vel-dis software default

  function flowAtVelocity(id_mm, v_ms) {
    var area_m2 = (Math.PI / 4) * Math.pow(id_mm / 1000, 2);
    return v_ms * area_m2 * 3600; // m3/h
  }

  function pumpSizeCapacityHtml() {
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">NPS</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Bore ID (mm)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Flow @ ' + SUCTION_TARGET_VEL_MS.toFixed(1) + ' m/s suction target (m&sup3;/h)</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Flow @ ' + DISCHARGE_TARGET_VEL_MS.toFixed(1) + ' m/s discharge target (m&sup3;/h)</th>'
      + '</tr>';
    var body = STANDARD_NOZZLES_REF.map(function (n) {
      return '<tr>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(n.nps) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + n.id.toFixed(1) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + flowAtVelocity(n.id, SUCTION_TARGET_VEL_MS).toFixed(1) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + flowAtVelocity(n.id, DISCHARGE_TARGET_VEL_MS).toFixed(1) + '</td>'
        + '</tr>';
    }).join('');
    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Standard nozzle bores (ASME B36.10M, schedule 40) and the flow each one sizes to at the default target velocities</div>'
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'The pump sizing calculation picks the smallest listed bore that keeps velocity at or below the target (2.0 m/s suction, 3.5 m/s discharge by default — both editable per duty), then never sizes a suction nozzle smaller than the discharge it feeds. These two target velocities are user inputs, not fixed constants — this table shows the software defaults.'
      + '</div>';
  }

  /* Transcribed from lib/aro-pumpcurve.js: the API 610 cl. 6.1.11
     preferred/allowable operating region bands (region()) and the
     shut-off head rise ratio by specific speed (shutoffRatio()) — the
     exact functions the predicted pump curve and operating-point check
     use. Every number here is explicitly a PREDICTION in that file
     (dimensionless curves anchored at a Hydraulic-Institute-derived BEP),
     not a vendor curve — this section says so too. */
  var OPERATING_REGIONS_REF = [
    { band: '70 – 120% of BEP', label: 'Preferred Operating Region (POR)', color: '#22c55e', note: 'API 610 cl. 6.1.11 — continuous operation here carries normal reliability expectations.' },
    { band: '50 – 130% of BEP', label: 'Allowable Operating Region (AOR)', color: '#eab308', note: 'Outside the preferred band but still allowable — short-term or occasional operation, with increased vibration/thrust/NPSH risk.' },
    { band: 'Outside 50 – 130%', label: 'Outside the allowable operating region', color: '#ef4444', note: 'Vibration, radial thrust, recirculation, or NPSH risk is no longer bounded by the curve model — review the duty point or the pump selection.' }
  ];
  var SHUTOFF_RATIO_REF = [
    { band: 'Ns < 1000 (US)', ratio: '1.12', note: 'A low specific-speed radial impeller gives the flattest curve.' },
    { band: '1000 ≤ Ns < 2500', ratio: '1.18', note: 'Typical radial/Francis impeller shut-off rise.' },
    { band: '2500 ≤ Ns < 4500', ratio: '1.26', note: 'Mixed-flow impeller — a steeper rise to shut-off.' },
    { band: 'Ns ≥ 4500', ratio: '1.40', note: 'Axial-flow impeller — the steepest predicted rise.' }
  ];

  function pumpCurvesHtml() {
    var regionCards = OPERATING_REGIONS_REF.map(function (r) {
      return '<div style="border:1px solid var(--border-muted);border-left:3px solid ' + r.color + ';border-radius:5px;padding:8px 11px;margin-bottom:7px;">'
        + '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:' + r.color + ';">' + esc(r.label) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + esc(r.band) + '</div>'
        + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-main);line-height:1.6;margin-top:4px;">' + esc(r.note) + '</div>'
        + '</div>';
    }).join('');

    var shutoffHead = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Specific speed band</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Predicted shut-off / BEP head ratio</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Impeller shape</th>'
      + '</tr>';
    var shutoffBody = SHUTOFF_RATIO_REF.map(function (s) {
      return '<tr><td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(s.band) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(s.ratio) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);">' + esc(s.note) + '</td></tr>';
    }).join('');

    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Operating region bands (API 610 cl. 6.1.11)</div>'
      + regionCards
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">Predicted shut-off head rise, by specific speed</div>'
      + '<div style="overflow-x:auto;margin-bottom:12px;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + shutoffHead + '</thead><tbody>' + shutoffBody + '</tbody></table></div>'
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">Shape of each predicted curve (dimensionless, x = Q / Q_BEP)</div>'
      + '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:10px 12px;font-family:var(--font-mono);font-size:10px;color:var(--text-main);line-height:1.8;">'
      + '<b style="color:var(--text-header);">Head</b> — quadratic through (0, shut-off ratio &times; H_BEP) and (1, H_BEP), falling with flow.<br/>'
      + '<b style="color:var(--text-header);">Efficiency</b> — a parabola peaking at x = 1 (the BEP), read from the Hydraulic Institute attainable-efficiency curve and penalized away from the 2000&ndash;3000 (US) specific-speed plateau.<br/>'
      + '<b style="color:var(--text-header);">NPSHr</b> — rises with flow, roughly with the square.<br/>'
      + '<b style="color:var(--text-header);">Power</b> — computed directly as &rho;gQH/&eta; at each flow, not separately fitted.'
      + '</div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Every number this predicted-curve model produces is exactly that — a prediction, anchored at a Hydraulic-Institute-derived BEP, not a vendor rating. A real vendor curve always replaces it once one exists, and the live results panel says so wherever a predicted figure is used.'
      + '</div>';
  }

  /* Documents the topFamilyIsPD gating this upgrade's Phase 1/2 added to
     app.js — the reason a PD duty's pump results show NOT APPLICABLE or
     VENDOR REQUIRED for the centrifugal-only sections rather than a
     stale or wrong centrifugal computation. */
  var PD_GATING_RULES = [
    { section: 'Impeller (Euler head / velocity triangles)', rule: 'Always NOT APPLICABLE for every PD family — there is no centrifugal impeller; flow is produced by positive displacement, not impeller tip speed.' },
    { section: 'Casing (volute / cutwater screening)', rule: 'Always NOT APPLICABLE for every PD family — there is no volute casing or impeller throat to screen. See the family\'s own mechanical design section instead.' },
    { section: 'Shaft', rule: 'NOT APPLICABLE if the family has no rotating process shaft (diaphragm pumps); otherwise NOT APPLICABLE HERE with a pointer to the family\'s own full-track shaft sizing if it has one, or VENDOR REQUIRED if it doesn\'t.' },
    { section: 'Bearing', rule: 'Same three-way split as shaft: NOT APPLICABLE (no shaft), NOT APPLICABLE HERE (has its own full-track section), or VENDOR REQUIRED (no generic model exists yet).' },
    { section: 'Mechanical seal', rule: 'NOT APPLICABLE for sealless families (AODD, diaphragm) — the diaphragm itself is the process barrier. Otherwise screened normally against the same API 682 plans as centrifugal families.' }
  ];

  function pdPumpsHtml() {
    var q = state.query.trim().toLowerCase();
    var list = rows().filter(function (r) {
      return r.category === 'pd-rotary' || r.category === 'pd-reciprocating';
    }).filter(function (r) {
      if (!q) return true;
      return r.name.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      if (a.category !== b.category) return a.category === 'pd-rotary' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Pump Type</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">PD Category</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Full Mechanical Design?</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Sealless?</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">No Rotating Shaft?</th>'
      + '</tr>';
    var body = list.map(function (r) {
      return '<tr class="pref-row" data-fam-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + (r.category === 'pd-rotary' ? 'Rotary' : 'Reciprocating') + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);' + (r.fullTrack ? 'color:#22c55e;font-weight:700;' : 'color:var(--text-muted);') + '">' + (r.fullTrack ? 'Yes' : 'Reference only') + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + (r.sealless ? 'Yes' : 'No') + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + (r.noRotatingShaft ? 'Yes' : 'No') + '</td>'
        + '</tr>';
    }).join('');

    var ruleCards = PD_GATING_RULES.map(function (r) {
      return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:8px 11px;margin-bottom:7px;">'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:800;color:var(--text-header);">' + esc(r.section) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:3px;">' + esc(r.rule) + '</div>'
        + '</div>';
    }).join('');

    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">The 12 positive-displacement families (7 rotary + 5 reciprocating)</div>'
      + '<div style="margin-bottom:8px;">'
      + '<input id="pref-search" type="text" placeholder="Search pump type…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:320px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>'
      + '<div style="overflow-x:auto;margin-bottom:14px;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="5" style="padding:14px;color:var(--text-muted);">No PD pump types match this search.</td></tr>') + '</tbody>'
      + '</table></div>'
      + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:14px 0 8px;">Why centrifugal-only sections show NOT APPLICABLE / VENDOR REQUIRED for a PD duty</div>'
      + ruleCards
      + '<div style="margin-top:6px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'This is exactly the gating app.js runs once a PD family tops the automatic screening — see Section 20 · References/Provenance for what each status word means, and Section 09 · Mechanical Construction for the full per-family component table this gating is built from.'
      + '</div>';
  }

  /* Transcribed verbatim from lib/aro-pumpcompare.js's METRICS array —
     the 7 metrics and "better direction" rules the live Compare Pumps
     tool (buildComparison) actually scores two saved snapshots against.
     No engineering formula is recomputed there; it only subtracts and
     percentage-changes numbers the hydraulic/LCC calculations already
     produced — this section documents that same, deliberately narrow,
     scope. */
  var COMPARE_METRICS_REF = [
    { label: 'Design Flow', unit: 'm³/h', better: 'Neither — flow is a duty requirement, not optimized.' },
    { label: 'Differential Head', unit: 'm', better: 'Neither — head is a duty requirement, not optimized.' },
    { label: 'Brake Power', unit: 'kW', better: 'Lower is better.' },
    { label: 'Pump Efficiency', unit: '%', better: 'Higher is better.' },
    { label: 'NPSH Margin', unit: 'm', better: 'Higher is better.' },
    { label: 'Motor Loading', unit: '%', better: 'Neither — judged against a healthy loading band, not minimized or maximized.' },
    { label: 'Annual Energy Cost', unit: '/yr', better: 'Lower is better.' }
  ];

  function comparePumpsHtml() {
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Metric</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Unit</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Which direction is "better"</th>'
      + '</tr>';
    var body = COMPARE_METRICS_REF.map(function (m) {
      return '<tr><td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(m.label) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);">' + esc(m.unit) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);">' + esc(m.better) + '</td></tr>';
    }).join('');
    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">The 7 metrics Compare Pumps scores</div>'
      + '<div style="overflow-x:auto;margin-bottom:14px;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
      + '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:10px 12px;font-family:var(--font-mono);font-size:10px;color:var(--text-main);line-height:1.8;">'
      + '<b style="color:var(--text-header);">How a verdict is reached</b> — for a metric with a direction, snapshot B is marked B BETTER, A BETTER, or TIE by simple comparison against snapshot A; a metric with no direction is always NEUTRAL, never judged. A metric missing from either snapshot reports that row DATA REQUIRED rather than comparing against a placeholder value.'
      + '</div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Compare Pumps holds two in-memory snapshots (A/B) of already-calculated results, saved on demand — it is not the same mechanism as the undo/redo history, which steps back through form inputs rather than holding two calculated results side by side. No engineering value is recomputed here; only subtraction and percentage change on numbers the hydraulic and life-cycle-cost calculations already produced.'
      + '</div>';
  }

  /* Browse-by-service-character view: groups all 23 families by the same
     fluidSuitability flags (clean/viscous/abrasiveSlurry/shearSensitive/
     corrosive/hazardousToxic/cryogenic/hygienicSanitary) the automatic
     screening (Section 10) reads for its own criteria — a duty's fluid
     character, rather than raw flow/head, is often the first filter an
     engineer actually applies, and this reads the exact same field. */
  var APPLICATION_KEYS = [
    { key: 'clean', label: 'Clean Service' },
    { key: 'viscous', label: 'Viscous Fluids' },
    { key: 'abrasiveSlurry', label: 'Abrasive Slurry' },
    { key: 'shearSensitive', label: 'Shear-Sensitive Fluids' },
    { key: 'corrosive', label: 'Corrosive Fluids' },
    { key: 'hazardousToxic', label: 'Hazardous / Toxic Fluids' },
    { key: 'cryogenic', label: 'Cryogenic Service' },
    { key: 'hygienicSanitary', label: 'Hygienic / Sanitary Service' }
  ];

  function applicationSelectionHtml() {
    var activeKey = state.appKey || 'clean';
    var tabs = APPLICATION_KEYS.map(function (a) {
      var on = a.key === activeKey;
      return '<span data-app-key="' + a.key + '" style="display:inline-block;padding:5px 10px;margin:0 6px 6px 0;border-radius:4px;cursor:pointer;font-family:var(--font-mono);font-size:10px;'
        + (on ? 'background:rgba(245,158,11,0.15);color:var(--color-saffron);font-weight:800;' : 'color:var(--text-muted);border:1px solid var(--border-muted);') + '">' + esc(a.label) + '</span>';
    }).join('');

    var list = rows().filter(function (r) { return r.fluidSuitability && r.fluidSuitability[activeKey]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    var head = '<tr>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Pump Type</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Principle</th>'
      + '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);">Application</th>'
      + '</tr>';
    var body = list.map(function (r) {
      return '<tr class="pref-row" data-fam-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);">' + esc(r.name) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);white-space:nowrap;">' + esc(categoryLabel(r.category)) + '</td>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);color:var(--text-muted);max-width:400px;">' + esc(r.application || '') + '</td>'
        + '</tr>';
    }).join('');

    return '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin-bottom:8px;">Browse pump types by fluid service character</div>'
      + '<div style="margin-bottom:12px;">' + tabs + '</div>'
      + '<div style="margin-bottom:8px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);">' + list.length + ' of ' + rows().length + ' types suited to ' + esc((APPLICATION_KEYS.filter(function (a) { return a.key === activeKey; })[0] || {}).label || '') + '</div>'
      + '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10.5px;">'
      + '<thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="3" style="padding:14px;color:var(--text-muted);">No pump types are flagged suited for this service character.</td></tr>') + '</tbody>'
      + '</table></div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Reads the exact fluidSuitability flags Section 10\'s automatic screening scores against (e.g. abrasive solids flagged there scores this same abrasiveSlurry flag). A family can appear under more than one tab. Click a row to see its full notes on the right.'
      + '</div>';
  }

  function notesHtml(famId) {
    var r = famId ? (window.AROPUMPSTANDARD ? window.AROPUMPSTANDARD.byId(famId) : null) : null;
    if (!r) {
      return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Click a pump type in the table to see its application, limitations, and standards basis here.</div>';
    }
    return '<div style="font-family:var(--font-mono);font-size:10.5px;line-height:1.65;color:var(--text-main);">'
      + '<div style="font-weight:800;color:var(--color-saffron);margin-bottom:6px;">' + esc(r.name) + '</div>'
      + '<div style="margin-bottom:8px;"><b style="color:var(--text-header);">Application</b><br/>' + esc(r.application) + '</div>'
      + '<div style="margin-bottom:8px;"><b style="color:var(--text-header);">Key limitations</b><br/>' + esc(r.keyLimitations) + '</div>'
      + (r.viscosityNote ? '<div style="margin-bottom:8px;"><b style="color:var(--text-header);">Viscosity behavior</b><br/>' + esc(r.viscosityNote) + '</div>' : '')
      + (r.tempNote ? '<div style="margin-bottom:8px;"><b style="color:var(--text-header);">Temperature note</b><br/>' + esc(r.tempNote) + '</div>' : '')
      + '<div style="margin-bottom:8px;"><b style="color:var(--text-header);">Standards basis</b><br/>' + esc(r.standardsBasis) + '</div>'
      + '<div style="margin-bottom:0;"><b style="color:var(--text-header);">Efficiency band</b><br/>' + esc(fmtRange(r.efficiencyBandPct, '%')) + '</div>'
      + '</div>';
  }

  /* Which mechanical components each pump family actually has — the exact
     table this section exists to answer, and the direct reference for why
     app.js gates shaft/bearing/seal/impeller/casing the way it does
     (Phase 1/2 of this upgrade). Columns are representative pump types,
     not an exhaustive list of every row in PUMP_SELECTION_STANDARD — the
     spec's own worked table uses the same nine-type set. */
  var MECH_COLS = [
    { key: 'centrifugal', label: 'Centrifugal' },
    { key: 'twinScrew', label: 'Twin Screw' },
    { key: 'gear', label: 'Gear' },
    { key: 'pc', label: 'Progressive Cavity' },
    { key: 'lobe', label: 'Lobe' },
    { key: 'plunger', label: 'Plunger' },
    { key: 'aodd', label: 'AODD' },
    { key: 'peristaltic', label: 'Peristaltic' },
    { key: 'magDrive', label: 'Mag Drive' },
    { key: 'cannedMotor', label: 'Canned Motor' }
  ];
  var MECH_ROWS = [
    { label: 'Impeller', v: { centrifugal: '✓', magDrive: '✓', cannedMotor: '✓' } },
    { label: 'Main rotating shaft', v: { centrifugal: '✓', twinScrew: '✓', gear: '✓', pc: '✓', lobe: '✓', plunger: '✓ drive', peristaltic: '✓ drive', magDrive: '✓ internal', cannedMotor: '✓ internal' } },
    { label: 'Conventional bearings', v: { centrifugal: '✓', twinScrew: '✓', gear: '✓/bush', pc: '✓', lobe: '✓', plunger: '✓ power end', peristaltic: '✓ drive', magDrive: 'Internal', cannedMotor: 'Internal' } },
    { label: 'Mechanical shaft seal / packing', v: { centrifugal: 'Typical', twinScrew: 'Typical', gear: 'Typical', pc: 'Typical/packing', lobe: 'Typical', plunger: 'Packing', peristaltic: '— process side', magDrive: 'No', cannedMotor: 'No' } },
    { label: 'Diaphragm', v: { aodd: '✓' } },
    { label: 'Internal process check valves', v: { plunger: '✓', aodd: '✓' } },
    { label: 'Screw / gear / lobe element', v: { twinScrew: 'Screw', gear: 'Gear', pc: 'Rotor/stator', lobe: 'Lobe' } },
    { label: 'Flexible process tube', v: { peristaltic: '✓' } },
    { label: 'Coupling', v: { centrifugal: 'Typical', twinScrew: 'Typical', gear: 'Typical', pc: 'Typical', lobe: 'Typical', plunger: 'Typical', peristaltic: 'Drive-dependent', magDrive: 'Magnetic', cannedMotor: 'No external' } },
    { label: 'Electric motor', v: { centrifugal: 'Typical', twinScrew: 'Typical', gear: 'Typical', pc: 'Typical', lobe: 'Typical', plunger: 'Typical', peristaltic: 'Typical', magDrive: '✓', cannedMotor: 'Integral' } },
    { label: 'Air supply', v: { aodd: '✓' } },
    { label: 'Flange mandatory?', v: { centrifugal: 'No', twinScrew: 'No', gear: 'No', pc: 'No', lobe: 'No', plunger: 'No', aodd: 'No', peristaltic: 'No', magDrive: 'No', cannedMotor: 'No' } },
    { label: 'Flanged connection', v: { centrifugal: 'Typical large units', twinScrew: 'Typical', gear: 'Option', pc: 'Option', lobe: 'Option', plunger: 'Option', aodd: 'Option', peristaltic: 'Adapter option', magDrive: 'Typical', cannedMotor: 'Typical' } },
    { label: 'Threaded connection', v: { centrifugal: 'Small units', twinScrew: 'Option', gear: 'Common small', pc: 'Option', lobe: 'Option', plunger: 'Common small', aodd: 'Common', peristaltic: 'Adapter', magDrive: 'Small units', cannedMotor: 'Limited' } },
    { label: 'Hose connection', v: { centrifugal: 'Rare', twinScrew: 'Rare', gear: 'Possible small', pc: 'Possible', lobe: 'Possible', plunger: 'Rare', aodd: 'Common option', peristaltic: 'Typical', magDrive: 'Rare', cannedMotor: 'Rare' } },
    { label: 'Sanitary connection', v: { centrifugal: 'Special', twinScrew: 'Rare', gear: 'Special', pc: 'Possible', lobe: 'Common', plunger: 'Possible', aodd: 'Available', peristaltic: 'Available', magDrive: 'Special', cannedMotor: 'Special' } },
    { label: 'Self-priming', v: { centrifugal: 'Limited', twinScrew: 'Good', gear: 'Good', pc: 'Very good', lobe: 'Good', plunger: 'Good', aodd: 'Very good', peristaltic: 'Very good', magDrive: 'Similar to centrifugal', cannedMotor: 'Similar to centrifugal' } },
    { label: 'High viscosity', v: { centrifugal: 'Limited', twinScrew: 'Excellent', gear: 'Excellent', pc: 'Excellent', lobe: 'Good', plunger: 'Moderate', aodd: 'Good', peristaltic: 'Excellent', magDrive: 'Limited', cannedMotor: 'Limited' } },
    { label: 'Solids / slurry', v: { centrifugal: 'Limited', twinScrew: 'Conditional', gear: 'Poor', pc: 'Very good', lobe: 'Good', plunger: 'Limited', aodd: 'Very good', peristaltic: 'Excellent', magDrive: 'Poor', cannedMotor: 'Poor' } },
    { label: 'Sealless process side', v: { centrifugal: 'No*', twinScrew: 'No*', gear: 'Possible designs', pc: 'No*', lobe: 'No*', plunger: 'No', aodd: 'Yes', peristaltic: 'Yes', magDrive: 'Yes', cannedMotor: 'Yes' } },
    { label: 'Rotating parts exposed to process', v: { centrifugal: 'Yes', twinScrew: 'Yes', gear: 'Yes', pc: 'Yes', lobe: 'Yes', plunger: 'Plunger only', aodd: 'No rotating parts', peristaltic: 'Tube only separates', magDrive: 'Internal', cannedMotor: 'Internal' } }
  ];

  function mechanicalConstructionHtml() {
    var head = '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);position:sticky;left:0;background:var(--bg-panel);">Component / characteristic</th>'
      + MECH_COLS.map(function (c) { return '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border-muted);color:var(--color-saffron);white-space:nowrap;">' + esc(c.label) + '</th>'; }).join('');
    var body = MECH_ROWS.map(function (r) {
      return '<tr>'
        + '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);font-weight:700;color:var(--text-header);position:sticky;left:0;background:var(--bg-panel);">' + esc(r.label) + '</td>'
        + MECH_COLS.map(function (c) {
          var val = r.v[c.key] || '—';
          var isYes = val.indexOf('✓') !== -1 || val === 'Yes';
          return '<td style="padding:6px 8px;border-bottom:1px dashed var(--border-muted);white-space:nowrap;' + (isYes ? 'color:#22c55e;font-weight:700;' : 'color:var(--text-muted);') + '">' + esc(val) + '</td>';
        }).join('')
        + '</tr>';
    }).join('');
    return '<div style="overflow-x:auto;">'
      + '<table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:10px;">'
      + '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + '* "No" on sealless process side means this family normally DOES have a shaft penetrating the casing (needing a seal or packing), not that a sealless variant can never exist — magnetic-drive and canned-motor sealless centrifugal variants are listed separately in Section 01. '
      + 'This is exactly the table app.js\'s shaft/bearing/seal/impeller/casing screening (Sections 16-18 of the pump results) uses to decide what to show for the top-ranked family — a AODD or diaphragm pump showing NOT APPLICABLE for its seal section is this row, not an omission.'
      + '</div>';
  }

  function standardsHtml() {
    var q = state.query.trim().toLowerCase();
    var list = STANDARDS.filter(function (s) {
      if (!q) return true;
      return (s.no + ' ' + s.title + ' ' + s.scope).toLowerCase().indexOf(q) !== -1;
    });
    var toolbar = '<div style="margin-bottom:10px;">'
      + '<input id="pref-search" type="text" placeholder="Search standards…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:360px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>';
    var cards = list.map(function (s) {
      return '<div style="border:1px solid var(--border-muted);border-radius:5px;padding:10px 12px;margin-bottom:8px;">'
        + '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);">' + esc(s.no) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--text-header);margin:2px 0 4px;">' + esc(s.title) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);line-height:1.6;">' + esc(s.scope) + '</div>'
        + '</div>';
    }).join('') || '<div style="color:var(--text-muted);padding:14px;">No standards match this search.</div>';
    return toolbar + cards
      + '<div style="margin-top:6px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'Standard number, title and scope only — no edition/revision is shown here, since standards are periodically revised and this reference has no verified-current-edition source. Confirm the applicable edition against the current published standard before citing it in a deliverable.'
      + '</div>';
  }

  function glossaryHtml() {
    var q = state.query.trim().toLowerCase();
    var list = GLOSSARY.filter(function (g) {
      if (!q) return true;
      return (g.term + ' ' + g.def).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return a.term.localeCompare(b.term); });
    var toolbar = '<div style="margin-bottom:10px;">'
      + '<input id="pref-search" type="text" placeholder="Search glossary…" value="' + esc(state.query) + '" '
      + 'style="width:100%;max-width:360px;background:var(--bg-app);border:1px solid var(--border-muted);border-radius:4px;padding:6px 9px;color:var(--text-main);font-family:var(--font-mono);font-size:11px;">'
      + '</div>';
    var rows = list.map(function (g) {
      return '<div style="padding:8px 0;border-bottom:1px dashed var(--border-muted);">'
        + '<div style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);">' + esc(g.term) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:10.5px;color:var(--text-main);line-height:1.6;margin-top:2px;">' + esc(g.def) + '</div>'
        + '</div>';
    }).join('') || '<div style="color:var(--text-muted);padding:14px;">No terms match this search.</div>';
    return toolbar + rows;
  }

  function notBuiltHtml(sec) {
    return '<div style="padding:24px 10px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;line-height:1.8;">'
      + '<div style="font-size:24px;margin-bottom:8px;">&#128214;</div>'
      + '<b style="color:var(--text-header);">' + esc(sec.num + ' · ' + sec.title) + '</b> has not been built yet.'
      + '<br/>This is listed here so the reference library\'s full structure is visible, not filled with placeholder content.'
      + '</div>';
  }

  function centerHtmlFor(sec) {
    if (!sec.ready) return notBuiltHtml(sec);
    if (sec.id === 'basics') return basicsHtml();
    if (sec.id === 'families') return approvedFamiliesHtml();
    if (sec.id === 'envelope') return envelopeTableHtml();
    if (sec.id === 'flow') return flowSelectionHtml();
    if (sec.id === 'head') return headSelectionHtml();
    if (sec.id === 'viscosity') return viscosityHtml();
    if (sec.id === 'temperature') return temperatureHtml();
    if (sec.id === 'solids') return solidsSlurryHtml();
    if (sec.id === 'npsh') return elevationNpshHtml();
    if (sec.id === 'equations') return equationsHtml();
    if (sec.id === 'seal') return sealSelectionHtml();
    if (sec.id === 'material') return materialSelectionHtml();
    if (sec.id === 'driver') return motorDriverHtml();
    if (sec.id === 'capacity') return pumpSizeCapacityHtml();
    if (sec.id === 'curves') return pumpCurvesHtml();
    if (sec.id === 'pd') return pdPumpsHtml();
    if (sec.id === 'compare') return familyComparisonHtml();
    if (sec.id === 'application') return applicationSelectionHtml();
    if (sec.id === 'mechanical') return mechanicalConstructionHtml();
    if (sec.id === 'standards') return standardsHtml();
    if (sec.id === 'glossary') return glossaryHtml();
    if (sec.id === 'provenance') return provenanceHtml();
    return notBuiltHtml(sec);
  }
  function notesHtmlFor(sec) {
    if (sec.id === 'basics') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Start with the physical arrangement, then enter the hydraulic duty. This reference is educational; final equipment selection still needs vendor curves and the site process/safety review.</div>';
    if (sec.id === 'families') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">These are the only families presented in this reference. Detailed vendor selection still depends on fluid compatibility, pressure rating and the pump manufacturer’s curve.</div>';
    if (sec.id === 'envelope') return notesHtml(state.activeFamId);
    if (sec.id === 'flow') return notesHtml(state.activeFamId);
    if (sec.id === 'head') return notesHtml(state.activeFamId);
    if (sec.id === 'viscosity') return notesHtml(state.activeFamId);
    if (sec.id === 'temperature') return notesHtml(state.activeFamId);
    if (sec.id === 'solids') return notesHtml(state.activeFamId);
    if (sec.id === 'npsh') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">This is the exact calculation chain and thresholds the live NPSHa/cavitation check (Pump Hydraulics results, Suction Analysis) runs — the numbers there are not a separate model.</div>';
    if (sec.id === 'equations') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Every clause cited here (API 610, ANSI/HI) is the same one the live screening prints next to its own verdict — see lib/aro-pumpstd.js.</div>';
    if (sec.id === 'seal') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">This applies to the shaft-sealed centrifugal/rotary families. Sealless designs (mag-drive, canned-motor) and families with no rotating shaft to seal show NOT APPLICABLE instead — see Section 09 · Mechanical Construction.</div>';
    if (sec.id === 'material') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">The live screening (AROPUMPMOC.screenAllComponents) filters this same list to each of casing/impeller/shaft/wear-rings by applicable component, then ranks by the entered fluid\'s corrosivity class and operating temperature/pressure.</div>';
    if (sec.id === 'driver') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Enclosure rating reuses the same fluid hazard classification as Section 10 · Seal Selection — a flammable/toxic/toxic-corrosive fluid rules out a standard enclosure the same way it rules out a single mechanical seal.</div>';
    if (sec.id === 'capacity') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">The live pump sizing (Section 03 · Suction/Discharge Nozzles) runs this exact lookup in the other direction — from the entered flow to the smallest bore that meets the target velocity — rather than a separate model.</div>';
    if (sec.id === 'curves') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">This applies once curve prediction is switched on for a centrifugal duty. The live System/Pump Curve view plots the operating point against these exact POR/AOR bands.</div>';
    if (sec.id === 'pd') return notesHtml(state.activeFamId);
    if (sec.id === 'compare') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Use this comparison to understand the first direction. The calculated duty and the family-selection screen decide which configuration is suitable for the entered process.</div>';
    if (sec.id === 'application') return notesHtml(state.activeFamId);
    if (sec.id === 'mechanical') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">A "—" means that component genuinely does not exist in that family\'s construction, not that it was left blank. This table is why the pump results panel shows NOT APPLICABLE for shaft, bearing, seal, impeller, or casing sections on families that don\'t have them.</div>';
    if (sec.id === 'standards') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Every seal-plan recommendation this app makes (Section 10 · Seal Selection) cites the specific API 682 plan it is based on.</div>';
    if (sec.id === 'glossary') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">These are the terms used throughout the pump results and report — the same names, not a separate vocabulary.</div>';
    if (sec.id === 'provenance') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Every results panel and the generated report use exactly these six status words next to a value — never a different label for the same meaning.</div>';
    return '<div style="color:var(--text-muted);font-size:10.5px;">No notes for this section yet.</div>';
  }

  function renderBody() {
    var sec = SECTIONS.filter(function (s) { return s.id === state.section; })[0] || SECTIONS[0];
    var center = document.getElementById('pref-center');
    var notes = document.getElementById('pref-notes');
    var navEl = document.getElementById('pref-nav');
    if (!center) return;
    center.innerHTML = centerHtmlFor(sec);
    if (notes) notes.innerHTML = notesHtmlFor(sec);
    if (navEl) {
      Array.prototype.forEach.call(navEl.querySelectorAll('[data-sec-id]'), function (el) {
        var on = el.getAttribute('data-sec-id') === sec.id;
        el.style.background = on ? 'rgba(245,158,11,0.12)' : '';
        el.style.color = on ? 'var(--color-saffron)' : '';
        el.style.boxShadow = on ? 'inset 2px 0 0 var(--color-saffron)' : '';
      });
    }
    wireCenterEvents();
  }

  function wireCenterEvents() {
    var search = document.getElementById('pref-search');
    if (search) {
      search.oninput = function () { state.query = search.value; renderBody(); setTimeout(function () { var el = document.getElementById('pref-search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); };
    }
    var catSel = document.getElementById('pref-cat');
    if (catSel) catSel.onchange = function () { state.category = catSel.value; renderBody(); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-sort-key]'), function (th) {
      th.onclick = function () {
        var k = th.getAttribute('data-sort-key');
        if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = 1; }
        renderBody();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pref-row'), function (tr) {
      tr.onclick = function () { state.activeFamId = tr.getAttribute('data-fam-id'); renderBody(); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-app-key]'), function (el) {
      el.onclick = function () { state.appKey = el.getAttribute('data-app-key'); state.activeFamId = null; renderBody(); };
    });
  }

  function navHtml() {
    return SECTIONS.map(function (s) {
      return '<div data-sec-id="' + s.id + '" style="padding:7px 10px;border-radius:4px;cursor:pointer;font-family:var(--font-mono);font-size:10.5px;'
        + 'color:' + (s.ready ? 'var(--text-main)' : 'var(--text-muted)') + ';display:flex;justify-content:space-between;gap:6px;">'
        + '<span>' + esc(s.num + ' · ' + s.title) + '</span>'
        + (s.ready ? '' : '<span style="font-size:8px;opacity:0.6;">soon</span>')
        + '</div>';
    }).join('');
  }

  function close() {
    if (root) { root.remove(); root = null; }
    document.removeEventListener('keydown', onKeydown, true);
  }
  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  /* Resizes the already-open modal in place — never rebuilds it, so the
     active section, scroll position, and search text survive a toggle. */
  function applyFullscreenStyle() {
    if (!root) return;
    var box = root.querySelector('.aro-mod-box');
    var body = document.getElementById('pref-modal-body');
    var btn = document.getElementById('pref-fullscreen');
    if (!box || !body) return;
    if (state.fullscreen) {
      root.style.padding = '0';
      box.style.width = '100vw';
      box.style.maxWidth = '100vw';
      box.style.height = '100vh';
      box.style.maxHeight = '100vh';
      box.style.borderRadius = '0';
      body.style.height = 'calc(100vh - 45px)';
    } else {
      root.style.padding = '24px';
      box.style.width = 'min(1220px,97vw)';
      box.style.maxWidth = '';
      box.style.height = '';
      box.style.maxHeight = '90vh';
      box.style.borderRadius = '';
      body.style.height = '70vh';
    }
    if (btn) {
      btn.innerHTML = state.fullscreen ? '&#9974; MINIMIZE' : '&#9974; FULL SCREEN';
      btn.title = state.fullscreen ? 'Exit full screen' : 'Full screen';
    }
  }
  function toggleFullscreen() {
    state.fullscreen = !state.fullscreen;
    applyFullscreenStyle();
  }

  function open(sectionId) {
    close();
    if (sectionId) state.section = sectionId;
    state.fullscreen = false;
    root = document.createElement('div');
    root.className = 'aro-mod';
    root.id = 'aro-pumpref-mod';
    root.innerHTML =
      '<div class="aro-mod-box" style="width:min(1220px,97vw);max-height:90vh;">'
      + '<div class="aro-mod-h"><span>PUMP ENGINEERING REFERENCE</span>'
      + '<span style="display:flex;align-items:center;gap:8px;">'
      + '<button class="aro-x" id="pref-fullscreen" style="font-size:10px;font-weight:700;letter-spacing:.05em;padding:4px 9px;" title="Full screen">&#9974; FULL SCREEN</button>'
      + '<button class="aro-x" id="pref-close">&#10005;</button>'
      + '</span>'
      + '</div>'
      + '<div class="aro-mod-b" id="pref-modal-body" style="display:flex;gap:0;padding:0;overflow:hidden;height:70vh;">'
      + '<div id="pref-nav" style="flex:0 0 220px;overflow-y:auto;border-right:1px solid var(--border-muted);padding:10px 6px;">' + navHtml() + '</div>'
      + '<div id="pref-center" style="flex:1 1 auto;overflow-y:auto;padding:14px 16px;min-width:0;"></div>'
      + '<div id="pref-notes" style="flex:0 0 260px;overflow-y:auto;border-left:1px solid var(--border-muted);padding:14px 12px;"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(root);
    /* The reference is a three-panel screen; hand it to the shared splitter
       as soon as it exists instead of waiting for the periodic page scan. */
    if (window.AROSPLIT && window.AROSPLIT.scan) window.AROSPLIT.scan();
    document.getElementById('pref-close').onclick = close;
    document.getElementById('pref-fullscreen').onclick = toggleFullscreen;
    root.addEventListener('mousedown', function (e) { if (e.target === root) close(); });
    document.addEventListener('keydown', onKeydown, true);
    Array.prototype.forEach.call(root.querySelectorAll('[data-sec-id]'), function (el) {
      el.onclick = function () { state.section = el.getAttribute('data-sec-id'); state.activeFamId = null; renderBody(); };
    });
    renderBody();
  }

  window.AROPUMPREF = { open: open, close: close };
})();

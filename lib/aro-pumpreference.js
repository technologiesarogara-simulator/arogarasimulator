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

  var SECTIONS = [
    { id: 'envelope', num: '01', title: 'Pump Selection Envelope', ready: true },
    { id: 'flow', num: '02', title: 'Selection by Flow Rate', ready: false },
    { id: 'head', num: '03', title: 'Selection by Pressure / Head', ready: false },
    { id: 'viscosity', num: '04', title: 'Selection by Viscosity', ready: false },
    { id: 'temperature', num: '05', title: 'Temperature Considerations', ready: false },
    { id: 'solids', num: '06', title: 'Solids & Slurry', ready: false },
    { id: 'npsh', num: '07', title: 'Elevation & NPSH', ready: false },
    { id: 'capacity', num: '08', title: 'Pump Size & Capacity', ready: false },
    { id: 'mechanical', num: '09', title: 'Mechanical Construction', ready: false },
    { id: 'seal', num: '10', title: 'Seal Selection', ready: false },
    { id: 'material', num: '11', title: 'Material Selection', ready: false },
    { id: 'driver', num: '12', title: 'Motor / Driver', ready: false },
    { id: 'curves', num: '13', title: 'Pump & System Curves', ready: false },
    { id: 'pd', num: '14', title: 'Positive Displacement Pumps', ready: false },
    { id: 'application', num: '15', title: 'Application Selection', ready: false },
    { id: 'compare', num: '16', title: 'Compare Pumps', ready: false },
    { id: 'standards', num: '17', title: 'Standards', ready: true },
    { id: 'equations', num: '18', title: 'Equations', ready: false },
    { id: 'glossary', num: '19', title: 'Glossary', ready: true },
    { id: 'provenance', num: '20', title: 'References / Provenance', ready: false }
  ];

  var state = { section: 'envelope', query: '', category: '', sortKey: 'name', sortDir: 1 };
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
    return (window.PUMP_SELECTION_STANDARD || []).slice();
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
    if (sec.id === 'envelope') return envelopeTableHtml();
    if (sec.id === 'standards') return standardsHtml();
    if (sec.id === 'glossary') return glossaryHtml();
    return notBuiltHtml(sec);
  }
  function notesHtmlFor(sec) {
    if (sec.id === 'envelope') return notesHtml(state.activeFamId);
    if (sec.id === 'standards') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Every seal-plan recommendation this app makes (Section 10 · Seal Selection) cites the specific API 682 plan it is based on.</div>';
    if (sec.id === 'glossary') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">These are the terms used throughout the pump results and report — the same names, not a separate vocabulary.</div>';
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
  function onKeydown(e) { if (e.key === 'Escape') close(); }

  function open(sectionId) {
    close();
    if (sectionId) state.section = sectionId;
    root = document.createElement('div');
    root.className = 'aro-mod';
    root.id = 'aro-pumpref-mod';
    root.innerHTML =
      '<div class="aro-mod-box" style="width:min(1220px,97vw);max-height:90vh;">'
      + '<div class="aro-mod-h"><span>PUMP ENGINEERING REFERENCE</span><button class="aro-x" id="pref-close">&#10005;</button></div>'
      + '<div class="aro-mod-b" style="display:flex;gap:0;padding:0;overflow:hidden;height:70vh;">'
      + '<div id="pref-nav" style="flex:0 0 220px;overflow-y:auto;border-right:1px solid var(--border-muted);padding:10px 6px;">' + navHtml() + '</div>'
      + '<div id="pref-center" style="flex:1 1 auto;overflow-y:auto;padding:14px 16px;min-width:0;"></div>'
      + '<div id="pref-notes" style="flex:0 0 260px;overflow-y:auto;border-left:1px solid var(--border-muted);padding:14px 12px;"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(root);
    document.getElementById('pref-close').onclick = close;
    root.addEventListener('mousedown', function (e) { if (e.target === root) close(); });
    document.addEventListener('keydown', onKeydown, true);
    Array.prototype.forEach.call(root.querySelectorAll('[data-sec-id]'), function (el) {
      el.onclick = function () { state.section = el.getAttribute('data-sec-id'); state.activeFamId = null; renderBody(); };
    });
    renderBody();
  }

  window.AROPUMPREF = { open: open, close: close };
})();

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
    { id: 'viscosity', num: '04', title: 'Selection by Viscosity', ready: true },
    { id: 'temperature', num: '05', title: 'Temperature Considerations', ready: false },
    { id: 'solids', num: '06', title: 'Solids & Slurry', ready: false },
    { id: 'npsh', num: '07', title: 'Elevation & NPSH', ready: true },
    { id: 'capacity', num: '08', title: 'Pump Size & Capacity', ready: false },
    { id: 'mechanical', num: '09', title: 'Mechanical Construction', ready: true },
    { id: 'seal', num: '10', title: 'Seal Selection', ready: false },
    { id: 'material', num: '11', title: 'Material Selection', ready: false },
    { id: 'driver', num: '12', title: 'Motor / Driver', ready: false },
    { id: 'curves', num: '13', title: 'Pump & System Curves', ready: false },
    { id: 'pd', num: '14', title: 'Positive Displacement Pumps', ready: false },
    { id: 'application', num: '15', title: 'Application Selection', ready: false },
    { id: 'compare', num: '16', title: 'Compare Pumps', ready: false },
    { id: 'standards', num: '17', title: 'Standards', ready: true },
    { id: 'equations', num: '18', title: 'Equations', ready: true },
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
    { step: 'Static suction head', formula: 'Hs = LLL − z_pump', note: 'Low liquid level and pump centerline are both grade-referenced, so a pump on a tall foundation is charged correctly for its own elevation.' },
    { step: 'Suction absolute pressure', formula: 'p_sucA = p_vessel,abs + ρg·Hs − Δp_suction-line', note: 'Δp_suction-line is the calculated friction/fitting loss in the suction piping — a real loss, not an allowance.' },
    { step: 'Suction head of liquid', formula: 'h_suc = p_sucA × 10⁵ / (ρg)', note: 'Converts the absolute suction pressure back to a head of the actual pumped liquid at its density.' },
    { step: 'NPSH available', formula: 'NPSHa = h_suc − h_vap', note: 'h_vap is the fluid’s own vapor pressure at the pumping temperature, expressed as head of that liquid — not water’s vapor pressure substituted in.' },
    { step: 'NPSH margin', formula: 'Margin = NPSHa − NPSHr', note: 'The absolute margin used against the fluid-category margin limit below.' }
  ];
  var NPSHR_SOURCES = [
    { rank: 1, source: 'Entered by the engineer', detail: 'A typed NPSHr value always wins — it is treated as measured/known.' },
    { rank: 2, source: 'Vendor-supplied', detail: 'A manufacturer NPSH3 figure, used when no value was typed directly.' },
    { rank: 3, source: 'Predicted from suction specific speed (Nss)', detail: 'Only used when curve prediction is switched on and neither of the above exists — inverted from the design Nss target, labeled as a PREDICTED screening figure, never shown as measured.' },
    { rank: 4, source: 'Process requirement', detail: 'The ceiling the selected pump must meet, used only as a last-resort stand-in for the pump’s own NPSHr when nothing else is available.' },
    { rank: 5, source: 'Default 10 m', detail: 'No NPSHr entered anywhere — a conservative placeholder the panel labels explicitly as unentered, not a real pump figure.' }
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

  /* Every formula below is transcribed verbatim from its source function's
     own documentation comment (lib/aro-pumpstd.js and app.js) — nothing is
     re-derived or re-typed from memory. Where the source is a static
     comment rather than a callable pure function (hydraulic/brake power
     live inline in app.js's results function), the formula is checked
     against the current source at the time this section was written. */
  var EQUATIONS = [
    { name: 'Hydraulic power', formula: 'P_hyd (kW) = (Δp_bar × Q_m³/h) / 36', clause: 'app.js — Pump Hydraulics results', note: 'The fluid power the pump must impart at the differential pressure and flow of the duty point.' },
    { name: 'Brake power', formula: 'BHP (kW) = P_hyd / η', clause: 'app.js — Pump Hydraulics results', note: 'η is the viscosity-corrected efficiency (η_water × C_η) when the ANSI/HI 9.6.7 correction applies, otherwise the water-curve efficiency directly.' },
    { name: 'Specific speed', formula: 'Ns = N·√Q_gpm / H_ft^0.75', clause: 'lib/aro-pumpstd.js — specificSpeed()', note: 'US customary form, per stage (H divided by stage count first) — the form the impeller-shape and speed limits in this app are written in.' },
    { name: 'Suction specific speed', formula: 'Nss = N·√Q_gpm / NPSH3_ft^0.75', clause: 'API 610 cl. 6.1.7', note: 'Per impeller eye — a double-suction impeller takes half the flow each side. Above ~11,000 (US units), API 610 calls for review: the eye is large enough that suction recirculation sets in inside the normal operating range.' },
    { name: 'Viscous performance correction', formula: 'B = 16.5·ν^0.5·H^0.0625 / (Q^0.375·N^0.25);  C_Q = C_H = exp(−0.165·(log₁₀B)^3.15);  C_η = B^(−0.0547·B^0.69)', clause: 'ANSI/HI 9.6.7', note: 'ν in cSt, H in m per stage, Q in m³/h, N in rev/min, on the rated (best-efficiency) point. B ≤ 1 means the liquid is thin enough that no correction applies.' },
    { name: 'NPSH margin requirement', formula: 'Required margin = max(1.0 m, 0.10 × NPSHr)', clause: 'API 610 cl. 6.1.6 / HI 9.6.1', note: 'NPSHa must exceed NPSHr by at least this margin — the code floor of 1 m combined with a proportional 10% requirement for larger NPSHr values.' },
    { name: 'Minimum continuous stable flow', formula: 'MCSF = fraction(Nss) × Q_BEP', clause: 'API 610 cl. 6.1.11', note: 'Fraction steps with suction specific speed: 25% up to Nss 8,000; 35% to 9,500; 45% to 11,000; 60% above — the real figure belongs to the pump\'s own curve; this is a screening estimate, labeled as one.' },
    { name: 'Driver power margin', formula: 'Motor rating ≥ BHP × margin factor', clause: 'API 610 Table 12', note: 'Margin factor steps down as the machine gets bigger: 125% up to 22 kW, 115% from 22–55 kW, 110% above 55 kW — not a flat service factor.' }
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
    return cards
      + '<div style="margin-top:6px;padding:8px 10px;border:1px solid var(--border-muted);border-radius:4px;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);line-height:1.6;">'
      + 'These are the equations this app itself evaluates for a centrifugal duty — not a general pump-hydraulics primer. NPSHa\'s own derivation has a dedicated walkthrough in Section 07 · Elevation & NPSH.'
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
    { label: 'Flexible process hose', v: { peristaltic: '✓' } },
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
    { label: 'Rotating parts exposed to process', v: { centrifugal: 'Yes', twinScrew: 'Yes', gear: 'Yes', pc: 'Yes', lobe: 'Yes', plunger: 'Plunger only', aodd: 'No rotating parts', peristaltic: 'Hose only separates', magDrive: 'Internal', cannedMotor: 'Internal' } }
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
    if (sec.id === 'envelope') return envelopeTableHtml();
    if (sec.id === 'viscosity') return viscosityHtml();
    if (sec.id === 'npsh') return elevationNpshHtml();
    if (sec.id === 'equations') return equationsHtml();
    if (sec.id === 'mechanical') return mechanicalConstructionHtml();
    if (sec.id === 'standards') return standardsHtml();
    if (sec.id === 'glossary') return glossaryHtml();
    return notBuiltHtml(sec);
  }
  function notesHtmlFor(sec) {
    if (sec.id === 'envelope') return notesHtml(state.activeFamId);
    if (sec.id === 'viscosity') return notesHtml(state.activeFamId);
    if (sec.id === 'npsh') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">This is the exact calculation chain and thresholds the live NPSHa/cavitation check (Pump Hydraulics results, Suction Analysis) runs — the numbers there are not a separate model.</div>';
    if (sec.id === 'equations') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">Every clause cited here (API 610, ANSI/HI) is the same one the live screening prints next to its own verdict — see lib/aro-pumpstd.js.</div>';
    if (sec.id === 'mechanical') return '<div style="color:var(--text-muted);font-size:10.5px;line-height:1.6;">A "—" means that component genuinely does not exist in that family\'s construction, not that it was left blank. This table is why the pump results panel shows NOT APPLICABLE for shaft, bearing, seal, impeller, or casing sections on families that don\'t have them.</div>';
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

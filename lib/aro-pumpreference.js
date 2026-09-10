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
    { id: 'flow', num: '02', title: 'Selection by Flow Rate', ready: true },
    { id: 'head', num: '03', title: 'Selection by Pressure / Head', ready: true },
    { id: 'viscosity', num: '04', title: 'Selection by Viscosity', ready: true },
    { id: 'temperature', num: '05', title: 'Temperature Considerations', ready: true },
    { id: 'solids', num: '06', title: 'Solids & Slurry', ready: true },
    { id: 'npsh', num: '07', title: 'Elevation & NPSH', ready: true },
    { id: 'capacity', num: '08', title: 'Pump Size & Capacity', ready: true },
    { id: 'mechanical', num: '09', title: 'Mechanical Construction', ready: true },
    { id: 'seal', num: '10', title: 'Seal Selection', ready: true },
    { id: 'material', num: '11', title: 'Material Selection', ready: true },
    { id: 'driver', num: '12', title: 'Motor / Driver', ready: true },
    { id: 'curves', num: '13', title: 'Pump & System Curves', ready: true },
    { id: 'pd', num: '14', title: 'Positive Displacement Pumps', ready: true },
    { id: 'application', num: '15', title: 'Application Selection', ready: false },
    { id: 'compare', num: '16', title: 'Compare Pumps', ready: false },
    { id: 'standards', num: '17', title: 'Standards', ready: true },
    { id: 'equations', num: '18', title: 'Equations', ready: true },
    { id: 'glossary', num: '19', title: 'Glossary', ready: true },
    { id: 'provenance', num: '20', title: 'References / Provenance', ready: true }
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
    if (sec.id === 'mechanical') return mechanicalConstructionHtml();
    if (sec.id === 'standards') return standardsHtml();
    if (sec.id === 'glossary') return glossaryHtml();
    if (sec.id === 'provenance') return provenanceHtml();
    return notBuiltHtml(sec);
  }
  function notesHtmlFor(sec) {
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

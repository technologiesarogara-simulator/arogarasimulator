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
    { id: 'standards', num: '17', title: 'Standards', ready: false },
    { id: 'equations', num: '18', title: 'Equations', ready: false },
    { id: 'glossary', num: '19', title: 'Glossary', ready: false },
    { id: 'provenance', num: '20', title: 'References / Provenance', ready: false }
  ];

  var state = { section: 'envelope', query: '', category: '', sortKey: 'name', sortDir: 1 };
  var root = null;

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

  function notBuiltHtml(sec) {
    return '<div style="padding:24px 10px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;line-height:1.8;">'
      + '<div style="font-size:24px;margin-bottom:8px;">&#128214;</div>'
      + '<b style="color:var(--text-header);">' + esc(sec.num + ' · ' + sec.title) + '</b> has not been built yet.'
      + '<br/>This is listed here so the reference library\'s full structure is visible, not filled with placeholder content.'
      + '</div>';
  }

  function renderBody() {
    var sec = SECTIONS.filter(function (s) { return s.id === state.section; })[0] || SECTIONS[0];
    var center = document.getElementById('pref-center');
    var notes = document.getElementById('pref-notes');
    var navEl = document.getElementById('pref-nav');
    if (!center) return;
    center.innerHTML = sec.ready ? envelopeTableHtml() : notBuiltHtml(sec);
    if (notes) notes.innerHTML = sec.ready ? notesHtml(state.activeFamId) : '<div style="color:var(--text-muted);font-size:10.5px;">No notes for this section yet.</div>';
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

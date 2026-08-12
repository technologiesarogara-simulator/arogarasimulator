/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA ENGINEERING DATA LIBRARY — INTERFACE  (window.ARODATAUI)
   ---------------------------------------------------------------------------
   A three-panel workspace over the data core in aro-datalib.js.

       LEFT     what the library holds — families, favourites, project data
       CENTRE   the chosen material or fluid: domains, then properties
       RIGHT    one property in full — value, units, condition, table, graph,
                source, where it is used, and what may be done with it

   The workflow the panels enforce, in order:

       search → select subject → choose domains → choose properties
              → choose units → read value / table / graph
              → check source and condition → add to project
              → choose target module → compatibility check → apply

   Two rules are structural rather than cosmetic.

   NOTHING IS APPLIED SILENTLY. Sending library data into a module that
   already holds a number opens a conflict panel with three ways out — keep
   what the design has, take the library value, or record an override. There
   is no fourth path where the input changes without being seen.

   AN EMPTY FIELD STAYS EMPTY. Where the library holds no traceable value the
   property reads NOT AVAILABLE, in the same list as the ones that do. It is
   not hidden, and it is not filled with an estimate — a visible gap is
   information, and a plausible invented number is the opposite.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var D = function () { return window.ARODATA; };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-4 || a >= 1e7)) return Number(v).toExponential(3);
    var s = Number(v).toFixed(d == null ? 4 : d);
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }

  /* ══ STATE ══════════════════════════════════════════════════════════════ */
  var UI = {
    open: false,
    tab: 'materials',            /* materials | fluids | sets | user | project | qa */
    kind: 'material',
    family: null,
    q: '',
    subjectId: null,
    domains: null,               /* null = defaults for the subject kind */
    checked: {},                 /* subjectId -> { propKey: true } */
    prop: null,                  /* selected property key */
    unit: {},                    /* propKey -> display unit */
    favouritesOnly: false,
    applyFor: null               /* pending apply flow */
  };

  function defaultDomains(kind) {
    var on = {};
    D().domainsFor(kind).forEach(function (d) { if (d.defaultOn) on[d.key] = true; });
    return on;
  }
  function activeDomains() {
    var s = UI.subjectId ? D().get(UI.subjectId) : null;
    if (!s) return {};
    if (!UI.domains) UI.domains = defaultDomains(s.kind);
    return UI.domains;
  }

  /* ══ STYLE ══════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-dl-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-dl{position:fixed;inset:0;z-index:99990;background:#0b1220;color:#e2e8f0;',
      '  display:flex;flex-direction:column;font-family:var(--font-sans,system-ui,sans-serif);}',
      '#aro-dl *{box-sizing:border-box;}',
      '.dl-top{display:flex;align-items:center;gap:14px;padding:10px 16px;background:#0f172a;',
      '  border-bottom:1px solid #1e293b;flex:none;}',
      '.dl-brand{display:flex;align-items:center;gap:9px;}',
      '.dl-brand img{width:26px;height:26px;border-radius:5px;}',
      '.dl-bn{font-weight:800;font-size:13px;letter-spacing:.03em;color:#f1f5f9;line-height:1.1;}',
      '.dl-bt{font-size:9px;letter-spacing:.14em;color:#64748b;text-transform:uppercase;}',
      '.dl-title{font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;',
      '  letter-spacing:.1em;color:#38bdf8;}',
      '.dl-search{flex:1;max-width:520px;display:flex;align-items:center;gap:7px;background:#0b1220;',
      '  border:1px solid #1e293b;border-radius:6px;padding:7px 11px;}',
      '.dl-search input{flex:1;background:none;border:none;outline:none;color:#e2e8f0;font-size:12px;}',
      '.dl-x{margin-left:auto;background:#dc2626;border:none;color:#fff;padding:7px 15px;',
      '  border-radius:5px;cursor:pointer;font-weight:700;font-size:11px;}',
      '.dl-tabs{display:flex;gap:2px;padding:0 16px;background:#0f172a;border-bottom:1px solid #1e293b;flex:none;}',
      '.dl-tab{background:none;border:none;border-bottom:2px solid transparent;color:#64748b;',
      '  padding:9px 14px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.05em;}',
      '.dl-tab.on{color:#38bdf8;border-bottom-color:#38bdf8;}',
      '.dl-body{flex:1;display:grid;grid-template-columns:230px minmax(0,1fr) minmax(0,1.05fr);min-height:0;}',
      '@media(max-width:1100px){.dl-body{grid-template-columns:200px minmax(0,1fr);}',
      '  .dl-right{display:none;}}',
      '.dl-left,.dl-mid,.dl-right{overflow-y:auto;min-height:0;}',
      '.dl-left{background:#0f172a;border-right:1px solid #1e293b;padding:10px 0;}',
      '.dl-right{background:#0f172a;border-left:1px solid #1e293b;padding:12px 14px;}',
      '.dl-mid{padding:12px 14px;}',
      '.dl-sec{font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.1em;color:#475569;',
      '  padding:10px 14px 5px;text-transform:uppercase;}',
      '.dl-fam{display:flex;justify-content:space-between;align-items:center;padding:6px 14px;',
      '  cursor:pointer;font-size:11.5px;color:#cbd5e1;}',
      '.dl-fam:hover{background:rgba(56,189,248,.08);}',
      '.dl-fam.on{background:rgba(56,189,248,.15);color:#38bdf8;font-weight:700;}',
      '.dl-fam span:last-child{font-family:var(--font-mono,monospace);font-size:10px;color:#475569;}',
      '.dl-list{border:1px solid #1e293b;border-radius:6px;overflow:hidden;}',
      '.dl-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:8px;align-items:center;',
      '  padding:7px 10px;border-bottom:1px solid #16202f;cursor:pointer;}',
      '.dl-row:hover{background:rgba(56,189,248,.07);}',
      '.dl-row.on{background:rgba(56,189,248,.14);}',
      '.dl-star{background:none;border:none;color:#475569;cursor:pointer;font-size:13px;line-height:1;padding:0;}',
      '.dl-star.on{color:#f59e0b;}',
      '.dl-nm{font-family:var(--font-mono,monospace);font-size:11.5px;font-weight:700;color:#e2e8f0;}',
      '.dl-sub{font-size:9.5px;color:#64748b;margin-top:1px;}',
      '.dl-badge{font-family:var(--font-mono,monospace);font-size:8px;letter-spacing:.05em;',
      '  padding:2px 6px;border-radius:3px;white-space:nowrap;}',
      '.dl-b-ver{background:rgba(74,222,128,.16);color:#4ade80;}',
      '.dl-b-ref{background:rgba(56,189,248,.16);color:#38bdf8;}',
      '.dl-b-user{background:rgba(129,140,248,.18);color:#a5b4fc;}',
      '.dl-b-na{background:rgba(148,163,184,.14);color:#94a3b8;}',
      '.dl-b-con{background:rgba(248,113,113,.16);color:#f87171;}',
      '.dl-b-inc{background:rgba(251,191,36,.16);color:#fbbf24;}',
      '.dl-h1{font-family:var(--font-mono,monospace);font-size:16px;font-weight:800;color:#f1f5f9;}',
      '.dl-h2{font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.09em;',
      '  color:#38bdf8;margin:14px 0 7px;text-transform:uppercase;}',
      '.dl-ident{font-size:10.5px;color:#94a3b8;margin-top:3px;}',
      '.dl-dom{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:7px;}',
      '.dl-domc{border:1px solid #1e293b;border-radius:5px;padding:8px 9px;cursor:pointer;background:#0f172a;}',
      '.dl-domc.on{border-color:#38bdf8;background:rgba(56,189,248,.09);}',
      '.dl-domc b{display:block;font-size:11px;color:#e2e8f0;}',
      '.dl-domc span{font-family:var(--font-mono,monospace);font-size:9px;color:#64748b;}',
      '.dl-pt{width:100%;border-collapse:collapse;font-size:11px;}',
      '.dl-pt th{text-align:left;font-family:var(--font-mono,monospace);font-size:8.5px;',
      '  letter-spacing:.07em;color:#475569;padding:6px 8px;border-bottom:1px solid #1e293b;}',
      '.dl-pt td{padding:6px 8px;border-bottom:1px solid #16202f;}',
      '.dl-pt tr{cursor:pointer;}',
      '.dl-pt tr:hover td{background:rgba(56,189,248,.06);}',
      '.dl-pt tr.on td{background:rgba(56,189,248,.13);}',
      '.dl-na{color:#64748b;font-style:italic;}',
      '.dl-val{font-family:var(--font-mono,monospace);font-size:22px;font-weight:800;color:#f1f5f9;}',
      '.dl-kv{display:grid;grid-template-columns:130px minmax(0,1fr);gap:3px 9px;font-size:10.5px;margin-top:8px;}',
      '.dl-kv span:nth-child(odd){color:#64748b;font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.05em;}',
      '.dl-kv span:nth-child(even){color:#cbd5e1;}',
      '.dl-btn{font-family:var(--font-mono,monospace);font-size:10px;font-weight:700;letter-spacing:.04em;',
      '  padding:7px 11px;border-radius:4px;cursor:pointer;border:1px solid #334155;',
      '  background:transparent;color:#cbd5e1;}',
      '.dl-btn:hover{border-color:#38bdf8;color:#38bdf8;}',
      '.dl-btn.go{background:#38bdf8;border-color:#38bdf8;color:#04121e;}',
      '.dl-btn.go:hover{color:#04121e;}',
      '.dl-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;}',
      '.dl-sel{background:#0b1220;border:1px solid #1e293b;border-radius:4px;color:#e2e8f0;',
      '  padding:5px 7px;font-family:var(--font-mono,monospace);font-size:10.5px;}',
      '.dl-tbl{width:100%;border-collapse:collapse;font-family:var(--font-mono,monospace);font-size:10px;}',
      '.dl-tbl th,.dl-tbl td{border:1px solid #1e293b;padding:4px 7px;text-align:right;}',
      '.dl-tbl th{color:#64748b;font-weight:400;}',
      '.dl-note{font-size:10.5px;line-height:1.6;color:#93c5fd;border-left:2px solid #38bdf8;',
      '  padding-left:8px;margin-top:10px;}',
      '.dl-warn{font-size:10.5px;line-height:1.6;color:#fbbf24;border-left:2px solid #fbbf24;',
      '  padding-left:8px;margin-top:10px;}',
      '.dl-empty{padding:26px 14px;text-align:center;color:#64748b;font-size:11.5px;line-height:1.7;}',
      '.dl-chip{font-family:var(--font-mono,monospace);font-size:9.5px;padding:5px 9px;border-radius:3px;',
      '  border:1px solid #334155;background:transparent;color:#94a3b8;cursor:pointer;margin-right:5px;}',
      '.dl-chip.on{background:#38bdf8;border-color:#38bdf8;color:#04121e;font-weight:800;}',
      '.dl-launch{font-family:var(--font-mono,monospace);font-size:11px;font-weight:800;letter-spacing:.06em;',
      '  padding:11px 18px;border-radius:6px;cursor:pointer;border:none;',
      '  background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;}',
      '.dl-host{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;padding:14px;}',
      '.dl-hosth{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#38bdf8;}',
      '.dl-hostsub{font-size:10.5px;color:var(--text-muted);margin:4px 0 12px;line-height:1.55;}',
      '.dl-mod{border:1px solid #1e293b;border-radius:5px;padding:9px 10px;margin-bottom:6px;cursor:pointer;}',
      '.dl-mod:hover{border-color:#38bdf8;}',
      '.dl-mod b{font-size:11.5px;color:#e2e8f0;}',
      '.dl-mod div{font-size:10px;color:#64748b;margin-top:2px;}'
    ].join('');
    document.head.appendChild(s);
  }

  function badgeClass(status) {
    if (/VERIFIED/.test(status)) return 'dl-b-ver';
    if (status === 'REFERENCE ONLY') return 'dl-b-ref';
    if (status === 'USER SUPPLIED') return 'dl-b-user';
    if (status === 'CONFLICT') return 'dl-b-con';
    if (status === 'CONDITION INCOMPLETE') return 'dl-b-inc';
    return 'dl-b-na';
  }

  /* ══ GRAPH ══════════════════════════════════════════════════════════════
     Inline SVG, drawn only where tabular data actually exists. No chart is
     produced for a single constant, because a horizontal line through one
     point implies a temperature dependence that was never measured. */
  function graph(rows, xLabel, yLabel) {
    if (!rows || rows.length < 2) return '';
    var W = 330, H = 190, L = 46, R = 10, T = 12, B = 30;
    var xs = rows.map(function (r) { return r[0]; });
    var ys = rows.map(function (r) { return r[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (x1 === x0) x1 = x0 + 1;
    if (y1 === y0) { y0 = y0 - 1; y1 = y1 + 1; }
    var pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
    function px(x) { return L + (x - x0) / (x1 - x0) * (W - L - R); }
    function py(y) { return T + (1 - (y - y0) / (y1 - y0)) * (H - T - B); }
    var pts = rows.map(function (r) { return px(r[0]).toFixed(1) + ',' + py(r[1]).toFixed(1); }).join(' ');
    var g = '';
    for (var i = 0; i <= 4; i++) {
      var yv = y0 + (y1 - y0) * i / 4, yy = py(yv);
      g += '<line x1="' + L + '" y1="' + yy.toFixed(1) + '" x2="' + (W - R) + '" y2="' + yy.toFixed(1)
        + '" stroke="#1e293b" stroke-width="1"/>'
        + '<text x="' + (L - 5) + '" y="' + (yy + 3).toFixed(1) + '" fill="#64748b" font-size="8" '
        + 'text-anchor="end" font-family="ui-monospace,monospace">' + fmt(yv, 2) + '</text>';
    }
    for (var j = 0; j <= 4; j++) {
      var xv = x0 + (x1 - x0) * j / 4, xx = px(xv);
      g += '<text x="' + xx.toFixed(1) + '" y="' + (H - B + 13) + '" fill="#64748b" font-size="8" '
        + 'text-anchor="middle" font-family="ui-monospace,monospace">' + fmt(xv, 1) + '</text>';
    }
    g += '<polyline points="' + pts + '" fill="none" stroke="#38bdf8" stroke-width="1.8"/>';
    rows.forEach(function (r) {
      g += '<circle cx="' + px(r[0]).toFixed(1) + '" cy="' + py(r[1]).toFixed(1)
        + '" r="2.4" fill="#38bdf8"/>';
    });
    g += '<text x="' + (W / 2) + '" y="' + (H - 2) + '" fill="#94a3b8" font-size="8.5" '
      + 'text-anchor="middle" font-family="ui-monospace,monospace">' + esc(xLabel) + '</text>';
    g += '<text x="10" y="' + (H / 2) + '" fill="#94a3b8" font-size="8.5" text-anchor="middle" '
      + 'font-family="ui-monospace,monospace" transform="rotate(-90 10 ' + (H / 2) + ')">'
      + esc(yLabel) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;'
      + 'background:#0b1220;border:1px solid #1e293b;border-radius:5px;margin-top:8px;">' + g + '</svg>';
  }

  /* ══ LEFT PANEL ═════════════════════════════════════════════════════════ */
  function leftHtml() {
    var d = D();
    var fams = UI.kind === 'fluid' ? d.FLUID_FAMILIES : d.MATERIAL_FAMILIES;
    var all = d.subjects(UI.kind);
    var counts = {};
    all.forEach(function (s) { counts[s.family] = (counts[s.family] || 0) + 1; });
    var favN = d.favourites().length;
    return '<div class="dl-sec">Data library</div>'
      + '<div class="dl-fam' + (UI.kind === 'material' && !UI.family ? ' on' : '')
      + '" data-dl-kind="material"><span>Materials</span><span>'
      + d.subjects('material').length + '</span></div>'
      + '<div class="dl-fam' + (UI.kind === 'fluid' && !UI.family ? ' on' : '')
      + '" data-dl-kind="fluid"><span>Fluids</span><span>'
      + d.subjects('fluid').length + '</span></div>'
      + '<div class="dl-fam' + (UI.favouritesOnly ? ' on' : '') + '" data-dl-fav="1">'
      + '<span>★ Favourites</span><span>' + favN + '</span></div>'
      + '<div class="dl-sec">' + (UI.kind === 'fluid' ? 'Fluid families' : 'Material families') + '</div>'
      + fams.map(function (f) {
        var n = counts[f] || 0;
        return '<div class="dl-fam' + (UI.family === f ? ' on' : '') + '" data-dl-family="'
          + esc(f) + '"><span>' + esc(f) + '</span><span>' + n + '</span></div>';
      }).join('')
      + '<div class="dl-sec">Workflow</div>'
      + '<div class="dl-fam' + (UI.tab === 'project' ? ' on' : '') + '" data-dl-tab="project">'
      + '<span>Project data</span><span>' + d.selection().length + '</span></div>'
      + '<div class="dl-fam' + (UI.tab === 'sets' ? ' on' : '') + '" data-dl-tab="sets">'
      + '<span>Property sets</span><span>' + Object.keys(d.SETS).length + '</span></div>'
      + '<div class="dl-fam' + (UI.tab === 'qa' ? ' on' : '') + '" data-dl-tab="qa">'
      + '<span>Data QA</span><span>&rsaquo;</span></div>'
      + '<div class="dl-fam" data-dl-tab="ingest"><span>Import &amp; templates</span><span>&rsaquo;</span></div>';
  }

  /* ══ CENTRE PANEL ═══════════════════════════════════════════════════════ */
  function subjectListHtml() {
    var d = D();
    var list = d.searchSubjects(UI.q, { kind: UI.kind, family: UI.family,
      favouritesOnly: UI.favouritesOnly });
    if (!list.length) {
      return '<div class="dl-empty">Nothing matches. The library holds only what has been '
        + 'migrated from this application’s own property tables — use <b>Import &amp; templates</b> '
        + 'to bring in a traceable dataset.</div>';
    }
    return '<div class="dl-list">' + list.map(function (s) {
      var rows = d.propertiesOf(s.id);
      var held = rows.filter(function (r) { return r.available; }).length;
      var fav = d.isFavourite(s.id);
      return '<div class="dl-row' + (UI.subjectId === s.id ? ' on' : '') + '" data-dl-subject="'
        + esc(s.id) + '">'
        + '<button class="dl-star' + (fav ? ' on' : '') + '" data-dl-fav-id="' + esc(s.id) + '">'
        + (fav ? '★' : '☆') + '</button>'
        + '<div><div class="dl-nm">' + esc(s.name) + '</div>'
        + '<div class="dl-sub">' + esc(s.family) + ' · ' + held + ' of ' + rows.length
        + ' properties held</div></div>'
        + '<span class="dl-badge ' + (s.origin === 'USER DEFINED' ? 'dl-b-user' : 'dl-b-ref') + '">'
        + (s.origin === 'USER DEFINED' ? 'USER' : 'REFERENCE') + '</span>'
        + '</div>';
    }).join('') + '</div>';
  }

  function midHtml() {
    var d = D();
    if (UI.tab === 'project') return projectHtml();
    if (UI.tab === 'sets') return setsHtml();
    if (UI.tab === 'qa') return qaHtml();
    if (UI.tab === 'ingest') return ingestHtml();

    if (!UI.subjectId) {
      return '<div class="dl-h2">' + (UI.kind === 'fluid' ? 'Fluids' : 'Materials')
        + (UI.family ? ' — ' + esc(UI.family) : '') + '</div>' + subjectListHtml();
    }
    var s = d.get(UI.subjectId);
    if (!s) { UI.subjectId = null; return midHtml(); }

    var id = s.identity || {};
    var identLine = s.kind === 'fluid'
      ? ['CAS ' + esc(id.cas), 'Formula ' + esc(id.formula), esc(s.family)].join(' · ')
      : ['Grade ' + esc(id.grade), 'UNS ' + esc((id.designations || {}).UNS),
        'ASTM ' + esc((id.designations || {}).ASTM), esc(s.family)].join(' · ');

    var doms = d.domainCounts(UI.subjectId);
    var on = activeDomains();
    var chosen = doms.filter(function (x) { return on[x.key]; });

    var rows = [];
    chosen.forEach(function (dom) {
      d.propertiesOf(UI.subjectId, dom.key).forEach(function (r) { rows.push(r); });
    });

    var checked = UI.checked[UI.subjectId] || {};
    var nChecked = Object.keys(checked).filter(function (k) { return checked[k]; }).length;

    return '<button class="dl-btn" data-dl-back="1" style="margin-bottom:10px;">&larr; ALL '
      + (UI.kind === 'fluid' ? 'FLUIDS' : 'MATERIALS') + '</button>'
      + '<div class="dl-h1">' + esc(s.name) + '</div>'
      + '<div class="dl-ident">' + identLine + '</div>'
      + (/NOT STATED/.test(identLine)
        ? '<div class="dl-warn">Identity fields read NOT STATED because this record was migrated '
          + 'from a module table that carried only a display name. A designation is not assumed — '
          + 'import a verified identity mapping to fill them.</div>' : '')

      + '<div class="dl-h2">Property domains</div>'
      + '<div class="dl-dom">' + doms.map(function (x) {
        return '<div class="dl-domc' + (on[x.key] ? ' on' : '') + '" data-dl-domain="'
          + esc(x.key) + '"><b>' + (on[x.key] ? '☑ ' : '☐ ') + esc(x.label) + '</b>'
          + '<span>' + x.held + ' / ' + x.total + ' held</span></div>';
      }).join('') + '</div>'

      + '<div class="dl-h2">Properties (' + rows.length + ')'
      + (nChecked ? ' — ' + nChecked + ' selected' : '') + '</div>'
      + (rows.length
        ? '<table class="dl-pt"><tr><th></th><th>PROPERTY</th><th>VALUE</th><th>UNIT</th>'
          + '<th>CONDITION</th><th>FORM</th><th>STATUS</th></tr>'
          + rows.map(function (r) {
            var p = r.prop, v = r.primary;
            var unit = UI.unit[p.key] || d.siUnit(p.qty);
            var shown = v && v.si != null ? fmt(d.convert(v.si, p.qty, unit)) : null;
            return '<tr class="' + (UI.prop === p.key ? 'on' : '') + '" data-dl-prop="' + esc(p.key) + '">'
              + '<td><input type="checkbox" data-dl-check="' + esc(p.key) + '"'
              + (checked[p.key] ? ' checked' : '') + (r.available ? '' : ' disabled') + '></td>'
              + '<td>' + esc(p.label) + '</td>'
              + '<td>' + (r.available
                ? (v.form === 'CATEGORICAL' ? esc(v.categorical)
                  : (shown != null ? '<b>' + esc(shown) + '</b>' : '—'))
                : '<span class="dl-na">NOT AVAILABLE</span>') + '</td>'
              + '<td>' + (r.available && v.form !== 'CATEGORICAL' ? esc(unit) : '') + '</td>'
              + '<td>' + (r.available ? esc(d.conditionSummary(v.condition)) : '') + '</td>'
              + '<td>' + (r.available ? esc(v.form) : '') + '</td>'
              + '<td><span class="dl-badge ' + badgeClass(r.status) + '">' + esc(r.status)
              + '</span></td></tr>';
          }).join('') + '</table>'
        : '<div class="dl-empty">No domain selected. Tick a domain above to list its properties.</div>')

      + '<div class="dl-btns">'
      + '<button class="dl-btn go" data-dl-add="1">ADD TO PROJECT (' + nChecked + ')</button>'
      + '<button class="dl-btn" data-dl-checkall="1">SELECT ALL HELD</button>'
      + '<button class="dl-btn" data-dl-uncheck="1">CLEAR</button>'
      + '</div>';
  }

  /* ══ RIGHT PANEL ════════════════════════════════════════════════════════ */
  function rightHtml() {
    var d = D();
    if (!UI.subjectId || !UI.prop) {
      return '<div class="dl-empty">Select a property to see its value, the condition it applies '
        + 'at, where it came from and what may be done with it.</div>';
    }
    var s = d.get(UI.subjectId);
    var rows = d.propertiesOf(UI.subjectId).filter(function (r) { return r.prop.key === UI.prop; });
    if (!rows.length) return '<div class="dl-empty">—</div>';
    var r = rows[0], p = r.prop, v = r.primary;
    var unit = UI.unit[p.key] || d.siUnit(p.qty);

    var h = '<div class="dl-h2">' + esc(p.domain) + '</div>'
      + '<div class="dl-h1" style="font-size:14px;">' + esc(p.label) + '</div>';

    if (!r.available) {
      h += '<div class="dl-val" style="font-size:15px;color:#64748b;">NOT AVAILABLE</div>'
        + '<div class="dl-note">The library holds no traceable value for this property of '
        + esc(s.name) + '. It is shown rather than hidden so the gap is visible, and it is left '
        + 'empty rather than estimated — a plausible number with no source is the one an engineer '
        + 'would never think to question.</div>'
        + '<div class="dl-btns"><button class="dl-btn" data-dl-tab="ingest">IMPORT DATA</button>'
        + '<button class="dl-btn" data-dl-userprop="1">ADD USER VALUE</button></div>';
      return h;
    }

    var shown = v.si != null ? fmt(d.convert(v.si, p.qty, unit)) : null;
    h += '<div class="dl-val">' + (v.form === 'CATEGORICAL' ? esc(v.categorical)
      : (shown != null ? esc(shown) + ' <span style="font-size:13px;color:#64748b;">'
        + esc(unit) + '</span>' : '—')) + '</div>';

    if (v.form !== 'CATEGORICAL' && d.unitsFor(p.qty).length > 1) {
      h += '<div style="margin-top:8px;"><select class="dl-sel" data-dl-unit="' + esc(p.key) + '">'
        + d.unitsFor(p.qty).map(function (u) {
          return '<option value="' + esc(u) + '"' + (u === unit ? ' selected' : '') + '>'
            + esc(u) + '</option>';
        }).join('') + '</select>'
        + '<span style="font-size:9.5px;color:#64748b;margin-left:8px;">display only — the stored '
        + 'quantity does not change</span></div>';
    }

    h += '<div class="dl-kv">'
      + '<span>DATA FORM</span><span>' + esc(v.form) + '</span>'
      + '<span>CANONICAL SI</span><span>' + esc(fmt(v.si, 6)) + ' ' + esc(v.siUnit) + '</span>'
      + '<span>AS PUBLISHED</span><span>' + (v.original != null
        ? esc(fmt(v.original, 6)) + ' ' + esc(v.originalUnit || '') : '—') + '</span>'
      + '<span>CONDITION</span><span>' + esc(d.conditionSummary(v.condition)) + '</span>'
      + '<span>STATUS</span><span><span class="dl-badge ' + badgeClass(v.status) + '">'
      + esc(v.status) + '</span></span>'
      + '<span>USABLE IN CALC</span><span>' + (d.canCalculate(v.status)
        ? 'YES' : 'NO — screening only') + '</span>'
      + '<span>ENGINEERING SOURCE</span><span>' + esc(v.source.engineeringSource) + '</span>'
      + '<span>SOURCE TYPE</span><span>' + esc(v.source.sourceType) + '</span>'
      + '<span>EDITION</span><span>' + esc(v.source.edition) + '</span>'
      + '<span>SECTION</span><span>' + esc(v.source.section) + '</span>'
      + '<span>DATE CHECKED</span><span>' + esc(v.source.dateChecked) + '</span>'
      + '<span>SOFTWARE SOURCE</span><span>' + esc(v.source.softwareSource) + '</span>'
      + '</div>';

    if ((STATUS_NOTE(v.status))) h += '<div class="dl-note">' + esc(STATUS_NOTE(v.status)) + '</div>';

    if (v.form === 'TABULAR' && v.table && v.table.length) {
      var disp = v.table.map(function (t) { return [t[0], d.convert(t[1], p.qty, unit)]; });
      h += '<div class="dl-h2">Table</div><table class="dl-tbl"><tr><th>'
        + esc(v.xProperty) + ' (' + esc(v.xUnit) + ')</th><th>' + esc(p.label)
        + ' (' + esc(unit) + ')</th></tr>'
        + disp.map(function (t) {
          return '<tr><td>' + esc(fmt(t[0], 2)) + '</td><td>' + esc(fmt(t[1], 4)) + '</td></tr>';
        }).join('') + '</table>'
        + '<div class="dl-h2">Graph</div>'
        + graph(disp, v.xProperty + ' (' + v.xUnit + ')', p.label + ' (' + unit + ')');
    } else if (v.form === 'CONSTANT') {
      h += '<div class="dl-note">A single value with no temperature series behind it. No graph is '
        + 'drawn: a line through one point would imply a temperature dependence that was never '
        + 'measured. Import tabular data to get one.</div>';
    }

    if (r.values.length > 1) {
      h += '<div class="dl-h2">All records (' + r.values.length + ')</div>'
        + r.values.map(function (x) {
          return '<div style="font-size:10.5px;padding:5px 0;border-bottom:1px solid #16202f;">'
            + '<b style="font-family:ui-monospace,monospace;">' + esc(fmt(d.convert(x.si, p.qty, unit)))
            + ' ' + esc(unit) + '</b> · ' + esc(x.source.softwareSource)
            + ' · <span class="dl-badge ' + badgeClass(x.status) + '">' + esc(x.status)
            + '</span></div>';
        }).join('')
        + '<div class="dl-note">Every record is kept. The one shown above is the canonical '
        + 'selection — the best-ranked status, never an average of the others.</div>';
    }

    var used = whereUsed(s);
    h += '<div class="dl-h2">Where used</div>'
      + (used.length ? '<div style="font-size:10.5px;color:#cbd5e1;">' + used.map(esc).join('<br>')
        + '</div>' : '<div style="font-size:10.5px;color:#64748b;">Not currently selected in any module.</div>');

    h += '<div class="dl-btns">'
      + '<button class="dl-btn go" data-dl-add-one="' + esc(p.key) + '">ADD TO PROJECT</button>'
      + '<button class="dl-btn" data-dl-userprop="1">CREATE USER OVERRIDE</button>'
      + '</div>';
    return h;
  }
  function STATUS_NOTE(st) {
    var s = D().STATUS[st];
    return s ? s.note : '';
  }
  function whereUsed(s) {
    var out = [];
    try {
      var L = window.AROENGLIB;
      if (L && L.parse) {
        var key = s.id.split(':').slice(1).join(':');
        L.whereUsed(key, s.kind).forEach(function (u) { out.push(u.module + ' — ' + u.value); });
      }
    } catch (e) {}
    D().selection().forEach(function (x) {
      if (x.subjectId === s.id) out.push(x.moduleLabel + ' — ' + x.properties.length + ' properties');
    });
    return out;
  }

  /* ══ OTHER TABS ═════════════════════════════════════════════════════════ */
  function projectHtml() {
    var d = D();
    var sel = d.selection();
    return '<div class="dl-h2">Project data</div>'
      + (sel.length
        ? '<table class="dl-pt"><tr><th>SUBJECT</th><th>KIND</th><th>TARGET MODULE</th>'
          + '<th>PROPERTIES</th><th>ADDED</th><th></th></tr>'
          + sel.map(function (x) {
            return '<tr><td><b>' + esc(x.subjectName) + '</b></td><td>' + esc(x.kind) + '</td>'
              + '<td>' + esc(x.moduleLabel) + '</td><td>' + x.properties.length + '</td>'
              + '<td style="color:#64748b;">' + esc(new Date(x.at).toISOString().slice(0, 10)) + '</td>'
              + '<td><button class="dl-btn" data-dl-unsel="' + esc(x.subjectId + '|' + x.module)
              + '">REMOVE</button></td></tr>';
          }).join('') + '</table>'
        : '<div class="dl-empty">No engineering data selected for this project yet. Choose a '
          + 'material or fluid, tick the properties you need, and add them to a module.</div>');
  }

  function setsHtml() {
    var d = D();
    return '<div class="dl-h2">Property sets</div>'
      + '<div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-bottom:10px;">'
      + 'A preset selection of properties for a kind of work. Applying one ticks those properties '
      + 'on the current subject where the library holds them; it never invents the ones it does not.'
      + '</div>'
      + Object.keys(d.SETS).map(function (name) {
        var keys = d.SETS[name];
        return '<div class="dl-mod" data-dl-set="' + esc(name) + '"><b>' + esc(name) + '</b>'
          + '<div>' + (keys ? keys.map(function (k) {
            return (d.PROPS[k] || {}).label || k;
          }).join(' · ') : 'Every property in the dictionary') + '</div></div>';
      }).join('');
  }

  function qaHtml() {
    var d = D();
    var st = d.stats();
    var rows = Object.keys(st.byStatus).sort();
    return '<div class="dl-h2">Data QA</div>'
      + '<div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-bottom:10px;">'
      + 'The data administrator’s view. Engineers use the library; this is where its condition is '
      + 'inspected. The existing conflict and provenance checking on the project page is unchanged '
      + 'and still runs there.</div>'
      + '<table class="dl-pt"><tr><th>MEASURE</th><th>COUNT</th></tr>'
      + '<tr><td>Subjects held</td><td><b>' + st.subjects + '</b></td></tr>'
      + '<tr><td>Property values held</td><td><b>' + st.values + '</b></td></tr>'
      + '<tr><td>Properties in the dictionary</td><td><b>' + st.properties + '</b></td></tr>'
      + '<tr><td>Domains</td><td><b>' + st.domains + '</b></td></tr>'
      + rows.map(function (k) {
        return '<tr><td><span class="dl-badge ' + badgeClass(k) + '">' + esc(k) + '</span></td>'
          + '<td><b>' + st.byStatus[k] + '</b></td></tr>';
      }).join('')
      + '</table>'
      + '<div class="dl-note">Every value currently held was migrated from this application’s own '
      + 'module property tables. None has been checked against a primary source, which is why the '
      + 'status reads REFERENCE ONLY rather than VERIFIED — and why none of it is yet cleared to '
      + 'feed a calculation through this library. The modules keep using their own tables exactly '
      + 'as before.</div>';
  }

  function ingestHtml() {
    var d = D();
    return '<div class="dl-h2">Import &amp; templates</div>'
      + '<div style="font-size:11px;color:#94a3b8;line-height:1.7;">'
      + 'The library grows through a controlled import, not by generating values. Prepare a dataset '
      + 'in the template below from a source this project is entitled to use, and it passes through '
      + 'unit normalisation, identity matching, duplicate and conflict checks, and an engineering '
      + 'review before anything becomes usable.'
      + '</div>'
      + '<div class="dl-h2">Ingestion path</div>'
      + '<div style="font-family:ui-monospace,monospace;font-size:10.5px;line-height:1.9;color:#cbd5e1;">'
      + 'SOURCE → IMPORT → PARSE → UNIT NORMALISATION → IDENTITY MATCH → CONDITION MAPPING<br>'
      + '→ DUPLICATE CHECK → CONFLICT CHECK → ENGINEERING REVIEW → APPROVAL → CANONICAL LIBRARY'
      + '</div>'
      + '<div class="dl-btns">'
      + '<button class="dl-btn go" data-dl-tpl="import">DOWNLOAD IMPORT TEMPLATE (CSV)</button>'
      + '<button class="dl-btn" data-dl-tpl="dict">DOWNLOAD PROPERTY DICTIONARY (CSV)</button>'
      + '</div>'
      + '<div class="dl-h2">Columns</div>'
      + '<div style="font-family:ui-monospace,monospace;font-size:10px;color:#94a3b8;line-height:1.8;">'
      + d.IMPORT_COLUMNS.map(esc).join(' · ') + '</div>'
      + '<div class="dl-warn">A row without an engineering source is accepted only as UNVERIFIED and '
      + 'cannot feed a calculation. A row whose condition is blank becomes CONDITION INCOMPLETE. '
      + 'Neither is rejected — an incomplete record that says so is more useful than no record — '
      + 'but neither is promoted to reference data on its own.</div>';
  }

  /* ══ APPLY FLOW ═════════════════════════════════════════════════════════ */
  function applyPanel() {
    var d = D();
    var s = d.get(UI.subjectId);
    if (!s) return;
    var checked = UI.checked[UI.subjectId] || {};
    var keys = Object.keys(checked).filter(function (k) { return checked[k]; });
    if (!keys.length) { alert('Tick at least one property first.'); return; }

    var mods = Object.keys(d.MODULES).map(function (m) {
      var rel = d.relevantFor(m, s.kind);
      var usable = rel ? keys.filter(function (k) { return rel.indexOf(k) >= 0; }) : keys;
      return { key: m, label: d.MODULES[m].label, usable: usable,
        ignored: keys.filter(function (k) { return usable.indexOf(k) < 0; }) };
    });

    var back = document.createElement('div');
    back.className = 'im-back';
    back.id = 'dl-apply';
    back.innerHTML = '<div class="im-box"><div class="im-h"><b>APPLY ENGINEERING DATA</b></div>'
      + '<div class="im-b">'
      + '<div style="font-size:12.5px;line-height:1.6;">'
      + '<b>' + esc(s.name) + '</b> — ' + keys.length + ' propert'
      + (keys.length === 1 ? 'y' : 'ies') + ' selected:<br>'
      + '<span style="color:#94a3b8;font-size:11px;">'
      + keys.map(function (k) { return esc((d.PROPS[k] || {}).label || k); }).join(' · ')
      + '</span></div>'
      + '<div class="im-sec">TARGET MODULE</div>'
      + mods.map(function (m) {
        return '<div class="dl-mod" data-dl-target="' + esc(m.key) + '">'
          + '<b>' + esc(m.label) + '</b><div>'
          + m.usable.length + ' of ' + keys.length + ' selected properties are relevant here'
          + (m.ignored.length ? ' · not offered: ' + m.ignored.map(function (k) {
            return esc((d.PROPS[k] || {}).label || k);
          }).join(', ') : '')
          + '</div></div>';
      }).join('')
      + '<div class="dl-warn" style="color:#fbbf24;">Nothing is written into a module input by this '
      + 'step. The selection is recorded against the project, and every value that would replace an '
      + 'existing design input is shown as a conflict for you to resolve first.</div>'
      + '</div>'
      + '<div class="im-f"><button class="im-btn" data-dl-cancel="1">CANCEL</button></div></div>';
    document.body.appendChild(back);
    back.addEventListener('click', function (e) {
      if (e.target === back || (e.target.closest && e.target.closest('[data-dl-cancel]'))) {
        back.remove(); return;
      }
      var t = e.target.closest ? e.target.closest('[data-dl-target]') : null;
      if (!t) return;
      var mod = t.getAttribute('data-dl-target');
      back.remove();
      commitApply(s, keys, mod);
    }, true);
  }

  function commitApply(s, keys, moduleKey) {
    var d = D();
    var rel = d.relevantFor(moduleKey, s.kind);
    var usable = rel ? keys.filter(function (k) { return rel.indexOf(k) >= 0; }) : keys;
    d.addToProject({
      subjectId: s.id, subjectName: s.name, kind: s.kind,
      module: moduleKey, properties: usable
    });
    /* The revision log records it as a project change, so a data selection is
       traceable in the same place a basis change is. */
    try {
      if (window.AROIMPACT && window.AROIMPACT.log) {
        window.AROIMPACT.log({
          title: 'ENGINEERING DATA SELECTED — ' + s.name,
          source: 'Engineering Data Library',
          changes: [{ module: (d.MODULES[moduleKey] || {}).label || moduleKey,
            field: s.kind, from: '', to: s.name + ' (' + usable.length + ' properties)' }],
          superseded: []
        });
      }
    } catch (e) {}
    UI.tab = 'project';
    render();
  }

  /* ══ RENDER ═════════════════════════════════════════════════════════════ */
  var host = null;
  function render() {
    if (!host) return;
    var logo = 'icon-192.png';
    host.innerHTML =
      '<div class="dl-top">'
      + '<div class="dl-brand"><img src="' + logo + '" alt="AROGARA">'
      + '<div><div class="dl-bn">AROGARA</div><div class="dl-bt">Engineering Design Platform</div></div></div>'
      + '<div class="dl-title">ENGINEERING DATA LIBRARY</div>'
      + '<div class="dl-search">🔍<input id="dl-q" type="search" value="' + esc(UI.q)
      + '" placeholder="Search materials, fluids, grades, CAS, properties…" autocomplete="off"></div>'
      + '<button class="dl-x" data-dl-close="1">CLOSE</button>'
      + '</div>'
      + '<div class="dl-tabs">'
      + ['materials|MATERIALS', 'fluids|FLUIDS', 'sets|PROPERTY SETS', 'project|PROJECT DATA',
        'ingest|IMPORT', 'qa|DATA QA'].map(function (t) {
        var p = t.split('|');
        return '<button class="dl-tab' + (UI.tab === p[0] ? ' on' : '') + '" data-dl-tab="'
          + p[0] + '">' + p[1] + '</button>';
      }).join('')
      + '</div>'
      + '<div class="dl-body">'
      + '<div class="dl-left">' + leftHtml() + '</div>'
      + '<div class="dl-mid">' + midHtml() + '</div>'
      + '<div class="dl-right">' + rightHtml() + '</div>'
      + '</div>';
  }

  function open() {
    css();
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-dl';
      document.body.appendChild(host);
    }
    host.style.display = 'flex';
    UI.open = true;
    render();
  }
  function close() {
    if (host) host.style.display = 'none';
    UI.open = false;
  }

  /* ══ EVENTS ═════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('[data-dl-open]')) { e.preventDefault(); open(); return; }
    if (!UI.open) return;
    var d = D();

    function hit(sel) { var x = t.closest(sel); return x; }

    var x;
    if ((x = hit('[data-dl-close]'))) { e.preventDefault(); close(); return; }
    if ((x = hit('[data-dl-fav-id]'))) {
      e.preventDefault(); e.stopPropagation();
      d.toggleFavourite(x.getAttribute('data-dl-fav-id')); render(); return;
    }
    if ((x = hit('[data-dl-kind]'))) {
      UI.kind = x.getAttribute('data-dl-kind'); UI.family = null; UI.subjectId = null;
      UI.prop = null; UI.domains = null; UI.favouritesOnly = false;
      UI.tab = UI.kind === 'fluid' ? 'fluids' : 'materials'; render(); return;
    }
    if ((x = hit('[data-dl-fav="1"]'))) {
      UI.favouritesOnly = !UI.favouritesOnly; UI.subjectId = null; render(); return;
    }
    if ((x = hit('[data-dl-family]'))) {
      UI.family = x.getAttribute('data-dl-family'); UI.subjectId = null; UI.prop = null;
      UI.tab = UI.kind === 'fluid' ? 'fluids' : 'materials'; render(); return;
    }
    if ((x = hit('[data-dl-tab]'))) {
      UI.tab = x.getAttribute('data-dl-tab');
      if (UI.tab === 'materials') { UI.kind = 'material'; UI.subjectId = null; }
      if (UI.tab === 'fluids') { UI.kind = 'fluid'; UI.subjectId = null; }
      render(); return;
    }
    if ((x = hit('[data-dl-back]'))) { UI.subjectId = null; UI.prop = null; render(); return; }
    if ((x = hit('[data-dl-subject]'))) {
      UI.subjectId = x.getAttribute('data-dl-subject');
      UI.domains = null; UI.prop = null; render(); return;
    }
    if ((x = hit('[data-dl-domain]'))) {
      var k = x.getAttribute('data-dl-domain');
      var on = activeDomains();
      on[k] = !on[k]; render(); return;
    }
    if ((x = hit('[data-dl-check]'))) {
      e.stopPropagation();
      var pk = x.getAttribute('data-dl-check');
      var bag = UI.checked[UI.subjectId] = UI.checked[UI.subjectId] || {};
      bag[pk] = !bag[pk];
      setTimeout(render, 0); return;
    }
    if ((x = hit('[data-dl-prop]'))) {
      UI.prop = x.getAttribute('data-dl-prop'); render(); return;
    }
    if ((x = hit('[data-dl-checkall]'))) {
      var bag2 = UI.checked[UI.subjectId] = UI.checked[UI.subjectId] || {};
      var on2 = activeDomains();
      Object.keys(on2).forEach(function (dom) {
        if (!on2[dom]) return;
        d.propertiesOf(UI.subjectId, dom).forEach(function (r) {
          if (r.available) bag2[r.prop.key] = true;
        });
      });
      render(); return;
    }
    if ((x = hit('[data-dl-uncheck]'))) { UI.checked[UI.subjectId] = {}; render(); return; }
    if ((x = hit('[data-dl-add]'))) { e.preventDefault(); applyPanel(); return; }
    if ((x = hit('[data-dl-add-one]'))) {
      var one = x.getAttribute('data-dl-add-one');
      var bag3 = UI.checked[UI.subjectId] = UI.checked[UI.subjectId] || {};
      bag3[one] = true;
      applyPanel(); return;
    }
    if ((x = hit('[data-dl-unsel]'))) {
      var parts = x.getAttribute('data-dl-unsel').split('|');
      d.removeSelection(parts[0], parts[1]); render(); return;
    }
    if ((x = hit('[data-dl-set]'))) {
      var setName = x.getAttribute('data-dl-set');
      if (!UI.subjectId) { alert('Choose a material or fluid first, then apply a property set.'); return; }
      var keys = d.SETS[setName];
      var bag4 = UI.checked[UI.subjectId] = UI.checked[UI.subjectId] || {};
      var on3 = activeDomains();
      d.propertiesOf(UI.subjectId).forEach(function (r) {
        if (!r.available) return;
        if (keys && keys.indexOf(r.prop.key) < 0) return;
        bag4[r.prop.key] = true;
        on3[r.prop.domain] = true;
      });
      UI.tab = UI.kind === 'fluid' ? 'fluids' : 'materials';
      render(); return;
    }
    if ((x = hit('[data-dl-tpl]'))) {
      var which = x.getAttribute('data-dl-tpl');
      var text = which === 'dict' ? d.dictionaryCsv() : d.importTemplateCsv();
      var name = which === 'dict' ? 'AROGARA_PROPERTY_DICTIONARY.csv'
        : 'AROGARA_IMPORT_TEMPLATE.csv';
      try {
        var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      } catch (err) {}
      return;
    }
    if ((x = hit('[data-dl-userprop]'))) {
      close();
      var tab = document.querySelector('.nav-tab[data-tab="project-tab"]');
      if (tab) tab.click();
      setTimeout(function () {
        var el = document.getElementById('aro-ul-host');
        if (el) el.scrollIntoView({ block: 'center' });
      }, 400);
      return;
    }
  }, true);

  document.addEventListener('input', function (e) {
    if (!UI.open || !e.target) return;
    if (e.target.id === 'dl-q') {
      UI.q = e.target.value;
      clearTimeout(window.__dlq);
      window.__dlq = setTimeout(function () {
        UI.subjectId = null;
        render();
        var el = document.getElementById('dl-q');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 200);
    }
  }, true);

  document.addEventListener('change', function (e) {
    if (!UI.open || !e.target) return;
    var u = e.target.getAttribute && e.target.getAttribute('data-dl-unit');
    if (u) { UI.unit[u] = e.target.value; render(); }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (UI.open && e.key === 'Escape') close();
  });

  /* ══ LAUNCHER ═══════════════════════════════════════════════════════════ */
  function mountLauncher() {
    var tab = document.getElementById('project-tab');
    if (!tab || document.getElementById('aro-dl-launch')) return;
    css();
    var d = D();
    var st = d.stats();
    var box = document.createElement('div');
    box.id = 'aro-dl-launch';
    box.className = 'dl-host';
    box.innerHTML = '<div class="dl-hosth">AROGARA ENGINEERING DATA LIBRARY</div>'
      + '<div class="dl-hostsub">Materials, fluids and properties as a governed database: '
      + '<b>' + st.properties + ' properties</b> across <b>' + st.domains + ' domains</b>, '
      + 'selectable per project, condition-aware, with canonical SI storage and convertible display '
      + 'units. It currently holds <b>' + st.values + ' values over ' + st.subjects + ' subjects</b>, '
      + 'every one of them migrated from this application’s own module tables and marked accordingly. '
      + 'Properties with no traceable value read NOT AVAILABLE rather than being estimated.</div>'
      + '<button class="dl-launch" data-dl-open="1">OPEN ENGINEERING DATA LIBRARY →</button>';
    tab.appendChild(box);
  }

  window.ARODATAUI = { open: open, close: close, render: render, state: UI };

  function boot() {
    var iv = setInterval(function () {
      var tab = document.getElementById('project-tab');
      if (tab && tab.offsetParent && window.ARODATA) { mountLauncher(); clearInterval(iv); }
    }, 700);
    setTimeout(function () { clearInterval(iv); }, 30000);
    document.addEventListener('click', function () {
      setTimeout(mountLauncher, 120);
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

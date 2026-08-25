/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA ENGINEERING DATA LIBRARY — INTERFACE  (window.ARODATAUI)
   ---------------------------------------------------------------------------
   A three-panel workspace over the data core in aro-datalib.js, the record
   store in aro-datalib-store.js and the editors in aro-datalib-edit.js.

       LEFT     what the library holds — families, favourites, project data
       CENTRE   the chosen material or fluid: domains, then properties
       RIGHT    one property in full — value, table, graph, condition, source,
                the layer it resolved from, where it is used, what may be done

   The workflow the panels enforce, in order:

       search → select subject → choose domains → choose properties
              → choose units → read value / table / graph
              → check source and condition → use in design
              → choose module and object → map property to input → override

   Four rules are structural rather than cosmetic.

   NOTHING IS APPLIED SILENTLY. A mapping records what a design object is
   meant to be using. It writes nothing into a module input, and when the
   value beneath it moves, the mapping goes OUTDATED and says so rather than
   quietly following.

   AN EMPTY FIELD STAYS EMPTY — BUT IT IS NOT A DEAD END. Where the library
   holds no traceable value the property reads NOT AVAILABLE in the same list
   as the ones that do, and it carries the four things an engineer can
   actually do about it. A visible gap is information; a plausible invented
   number is the opposite; and a gap with no way forward is just an obstacle.

   THE RIGHT PANEL IS NEVER BLANK. With no property selected it shows the
   subject — identity, completeness, what is missing for each module. There is
   no state of this workspace that answers a question with empty space.

   THE HIERARCHY IS ALWAYS VISIBLE. Every value shows which layer it resolved
   from and what sits underneath it, because a number whose provenance takes a
   second click is a number that gets used without one.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var D = function () { return window.ARODATA; };
  var S = function () { return window.ARODATASTORE; };
  var E = function () { return window.ARODATAEDIT; };

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
    tab: 'materials',
    kind: 'material',
    family: null,
    q: '',
    qProp: '',                   /* search within the property table */
    subjectId: null,
    domains: null,               /* null = defaults for the subject kind */
    collapsed: {},               /* domain key -> true when folded shut */
    checked: {},                 /* subjectId -> { propKey: true } */
    prop: null,
    unit: {},                    /* propKey -> display unit */
    view: 'VALUE',               /* VALUE | TABLE | GRAPH */
    favouritesOnly: false,
    compact: false,
    cmp: {},                     /* subjectId -> true, for COMPARE */
    subjectTab: 'properties',    /* properties | composition | identity */
    onlyHeld: false,
    mappingId: null              /* when inspecting a mapping's resolution */
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
  function checkedKeys() {
    var bag = UI.checked[UI.subjectId] || {};
    return Object.keys(bag).filter(function (k) { return bag[k]; });
  }

  /* ══ STYLE ══════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-dl-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      /* ── ONE PALETTE, TWO THEMES ────────────────────────────────────────
         This workspace was written in fixed dark colours, so an engineer who
         had chosen the light theme opened the library and got a black window
         in the middle of a white application. The colours are tokens now, and
         daylight redeclares them — nothing below this block names a literal
         surface colour. */
      '#aro-dl{--dl-bg:#0b1220;--dl-panel:#0f172a;--dl-ink:#e2e8f0;--dl-head:#f1f5f9;',
      '  --dl-muted:#64748b;--dl-sub:#94a3b8;--dl-line:#1e293b;--dl-hair:#16202f;',
      '  --dl-accent:#38bdf8;--dl-hover:rgba(56,189,248,.07);--dl-sel:rgba(56,189,248,.14);',
      '  --dl-field:#0b1220;--dl-thead:#e8edf3;--dl-shadow:rgba(0,0,0,.55);}',
      'body.theme-day #aro-dl{--dl-bg:#eef1f4;--dl-panel:#f7f8fa;--dl-ink:#1e293b;--dl-head:#0b1220;',
      '  --dl-muted:#64748b;--dl-sub:#475569;--dl-line:#d5dbe3;--dl-hair:#e6eaef;',
      '  --dl-accent:#0369a1;--dl-hover:rgba(3,105,161,.07);--dl-sel:rgba(3,105,161,.13);',
      '  --dl-field:#ffffff;--dl-thead:#e6ebf1;--dl-shadow:rgba(15,23,42,.18);}',
      '#aro-dl{position:fixed;inset:0;z-index:99990;background:var(--dl-bg);color:var(--dl-ink);',
      '  display:flex;flex-direction:column;font-family:var(--font-sans,system-ui,sans-serif);}',
      '#aro-dl *{box-sizing:border-box;}',
      '.dl-top{display:flex;align-items:center;gap:14px;padding:10px 16px;background:var(--dl-panel);',
      '  border-bottom:1px solid var(--dl-line);flex:none;}',
      '.dl-brand{display:flex;align-items:center;gap:9px;}',
      '.dl-brand img{width:26px;height:26px;border-radius:5px;}',
      '.dl-bn{font-weight:800;font-size:13px;letter-spacing:.03em;color:var(--dl-head);line-height:1.1;}',
      '.dl-bt{font-size:9px;letter-spacing:.14em;color:var(--dl-muted);text-transform:uppercase;}',
      '.dl-title{font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;',
      '  letter-spacing:.1em;color:var(--dl-accent);white-space:nowrap;}',
      '.dl-search{flex:1;max-width:480px;display:flex;align-items:center;gap:7px;background:var(--dl-field);',
      '  border:1px solid var(--dl-line);border-radius:6px;padding:7px 11px;}',
      '.dl-search input{flex:1;background:none;border:none;outline:none;color:var(--dl-ink);font-size:12px;}',
      '.dl-x{background:#dc2626;border:none;color:#fff;padding:7px 15px;',
      '  border-radius:5px;cursor:pointer;font-weight:700;font-size:11px;}',
      '.dl-tabs{display:flex;gap:2px;padding:0 16px;background:var(--dl-panel);border-bottom:1px solid var(--dl-line);',
      '  flex:none;overflow-x:auto;}',
      '.dl-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--dl-muted);',
      '  padding:9px 14px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.05em;white-space:nowrap;}',
      '.dl-tab.on{color:var(--dl-accent);border-bottom-color:var(--dl-accent);}',
      '.dl-body{flex:1;display:grid;min-height:0;}',
      '@media(max-width:1100px){.dl-body{grid-template-columns:190px 4px minmax(0,1fr)!important;}',
      '  .dl-right,.dl-grip2{display:none;}}',
      '.dl-left,.dl-mid,.dl-right{overflow-y:auto;min-height:0;}',
      '.dl-left{background:var(--dl-panel);border-right:1px solid var(--dl-line);padding:10px 0;}',
      '.dl-right{background:var(--dl-panel);border-left:1px solid var(--dl-line);padding:12px 14px;}',
      '.dl-mid{padding:12px 14px;}',
      '.dl-grip{cursor:col-resize;background:var(--dl-line);}',
      '.dl-grip:hover{background:var(--dl-accent);}',
      '.dl-sec{font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.1em;color:var(--dl-muted);',
      '  padding:10px 14px 5px;text-transform:uppercase;}',
      '.dl-fam{display:flex;justify-content:space-between;align-items:center;padding:6px 14px;',
      '  cursor:pointer;font-size:11.5px;color:var(--dl-ink);gap:8px;}',
      '.dl-fam:hover{background:var(--dl-hover);}',
      '.dl-fam.on{background:var(--dl-sel);color:var(--dl-accent);font-weight:700;}',
      '.dl-fam span:last-child{font-family:var(--font-mono,monospace);font-size:10px;color:var(--dl-muted);}',
      '.dl-list{border:1px solid var(--dl-line);border-radius:6px;overflow:hidden;}',
      '.dl-row{display:grid;grid-template-columns:20px 22px minmax(0,1fr) auto;gap:8px;align-items:center;',
      '  padding:7px 10px;border-bottom:1px solid var(--dl-hair);cursor:pointer;}',
      '.dl-row:hover{background:var(--dl-hover);}',
      '.dl-row.on{background:var(--dl-sel);}',
      '.dl-star{background:none;border:none;color:var(--dl-muted);cursor:pointer;font-size:13px;line-height:1;padding:0;}',
      '.dl-star.on{color:#f59e0b;}',
      '.dl-nm{font-family:var(--font-mono,monospace);font-size:11.5px;font-weight:700;color:var(--dl-ink);}',
      '.dl-sub{font-size:9.5px;color:var(--dl-muted);margin-top:1px;}',
      '.dl-badge{font-family:var(--font-mono,monospace);font-size:8px;letter-spacing:.05em;',
      '  padding:2px 6px;border-radius:3px;white-space:nowrap;display:inline-block;}',
      '.dl-b-ver{background:rgba(74,222,128,.16);color:#4ade80;}',
      '.dl-b-ref{background:rgba(56,189,248,.16);color:var(--dl-accent);}',
      '.dl-b-user{background:rgba(129,140,248,.18);color:#a5b4fc;}',
      '.dl-b-na{background:rgba(148,163,184,.14);color:var(--dl-sub);}',
      '.dl-b-con{background:rgba(248,113,113,.16);color:#f87171;}',
      '.dl-b-inc{background:rgba(251,191,36,.16);color:#fbbf24;}',
      '.dl-h1{font-family:var(--font-mono,monospace);font-size:16px;font-weight:800;color:var(--dl-head);}',
      '.dl-h2{font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.09em;',
      '  color:var(--dl-accent);margin:14px 0 7px;text-transform:uppercase;}',
      '.dl-ident{font-size:10.5px;color:var(--dl-sub);margin-top:3px;}',
      '.dl-domh{display:flex;align-items:center;gap:9px;padding:7px 9px;border:1px solid var(--dl-line);',
      '  border-radius:5px;margin-top:6px;cursor:pointer;background:var(--dl-panel);}',
      '.dl-domh:hover{border-color:var(--dl-accent);}',
      '.dl-domh b{font-size:11px;color:var(--dl-ink);flex:1;}',
      '.dl-domh .cnt{font-family:var(--font-mono,monospace);font-size:9px;color:var(--dl-muted);}',
      '.dl-bar{width:74px;height:4px;border-radius:2px;background:var(--dl-line);overflow:hidden;flex:none;}',
      '.dl-bar i{display:block;height:100%;background:var(--dl-accent);}',
      '.dl-pt{width:100%;border-collapse:collapse;font-size:11px;}',
      '.dl-pt th{text-align:left;font-family:var(--font-mono,monospace);font-size:8.5px;',
      '  letter-spacing:.07em;color:var(--dl-muted);padding:6px 8px;border-bottom:1px solid var(--dl-line);',
      '  position:sticky;top:-12px;background:var(--dl-field);z-index:2;}',
      '.dl-pt td{padding:6px 8px;border-bottom:1px solid var(--dl-hair);}',
      '.dl-pt tr.pr{cursor:pointer;}',
      '.dl-pt tr.pr:hover td{background:var(--dl-hover);}',
      '.dl-pt tr.on td{background:var(--dl-sel);}',
      '.dl-pt.compact td,.dl-pt.compact th{padding:3px 7px;font-size:10.5px;}',
      '.dl-na{color:var(--dl-muted);font-style:italic;}',
      '.dl-act{background:none;border:1px solid var(--dl-line);color:var(--dl-muted);border-radius:3px;',
      '  font-family:var(--font-mono,monospace);font-size:8.5px;padding:2px 6px;cursor:pointer;margin-right:4px;}',
      '.dl-act:hover{border-color:var(--dl-accent);color:var(--dl-accent);}',
      '.dl-val{font-family:var(--font-mono,monospace);font-size:22px;font-weight:800;color:var(--dl-head);}',
      '.dl-kv{display:grid;grid-template-columns:132px minmax(0,1fr);gap:3px 9px;font-size:10.5px;margin-top:8px;}',
      '.dl-kv span:nth-child(odd){color:var(--dl-muted);font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.05em;}',
      '.dl-kv span:nth-child(even){color:var(--dl-ink);word-break:break-word;}',
      '.dl-btn{font-family:var(--font-mono,monospace);font-size:10px;font-weight:700;letter-spacing:.04em;',
      '  padding:7px 11px;border-radius:4px;cursor:pointer;border:1px solid var(--dl-line);',
      '  background:transparent;color:var(--dl-ink);}',
      '.dl-btn:hover{border-color:var(--dl-accent);color:var(--dl-accent);}',
      '.dl-btn.go{background:var(--dl-accent);border-color:var(--dl-accent);color:#04121e;}',
      '.dl-btn.go:hover{color:#04121e;}',
      '.dl-btn.sm{font-size:9px;padding:5px 8px;}',
      '.dl-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;}',
      '.dl-sel{background:var(--dl-field);border:1px solid var(--dl-line);border-radius:4px;color:var(--dl-ink);',
      '  padding:5px 7px;font-family:var(--font-mono,monospace);font-size:10.5px;}',
      '.dl-tbl{width:100%;border-collapse:collapse;font-family:var(--font-mono,monospace);font-size:10px;}',
      '.dl-tbl th,.dl-tbl td{border:1px solid var(--dl-line);padding:4px 7px;text-align:right;}',
      '.dl-tbl th{color:var(--dl-muted);font-weight:400;}',
      '.dl-note{font-size:10.5px;line-height:1.6;color:#93c5fd;border-left:2px solid var(--dl-accent);',
      '  padding-left:8px;margin-top:10px;}',
      '.dl-warn{font-size:10.5px;line-height:1.6;color:#fbbf24;border-left:2px solid #fbbf24;',
      '  padding-left:8px;margin-top:10px;}',
      '.dl-empty{padding:26px 14px;text-align:center;color:var(--dl-muted);font-size:11.5px;line-height:1.7;}',
      '.dl-chip{font-family:var(--font-mono,monospace);font-size:9.5px;padding:5px 9px;border-radius:3px;',
      '  border:1px solid var(--dl-line);background:transparent;color:var(--dl-sub);cursor:pointer;margin:0 5px 5px 0;}',
      '.dl-chip.on{background:var(--dl-accent);border-color:var(--dl-accent);color:#04121e;font-weight:800;}',
      '.dl-counts{font-family:var(--font-mono,monospace);font-size:10px;color:var(--dl-sub);',
      '  letter-spacing:.04em;margin:2px 0 8px;}',
      '.dl-counts b{color:var(--dl-head);}',
      '.dl-counts i{font-style:normal;color:var(--dl-accent);}',
      '.dl-launch{font-family:var(--font-mono,monospace);font-size:11px;font-weight:800;letter-spacing:.06em;',
      '  padding:11px 18px;border-radius:6px;cursor:pointer;border:none;',
      '  background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;}',
      '.dl-host{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;padding:14px;}',
      '.dl-hosth{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:var(--dl-accent);}',
      '.dl-hostsub{font-size:10.5px;color:var(--text-muted);margin:4px 0 12px;line-height:1.55;}',
      '.dl-mod{border:1px solid var(--dl-line);border-radius:5px;padding:9px 10px;margin-bottom:6px;cursor:pointer;}',
      '.dl-mod:hover{border-color:var(--dl-accent);}',
      '.dl-mod b{font-size:11.5px;color:var(--dl-ink);}',
      '.dl-mod div{font-size:10px;color:var(--dl-muted);margin-top:2px;}',
      '.dl-lin{display:grid;grid-template-columns:140px 92px minmax(0,1fr);gap:4px 9px;font-size:10px;',
      '  padding:5px 0;border-bottom:1px solid var(--dl-hair);align-items:baseline;}',
      '.dl-lin b{font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.05em;color:var(--dl-muted);}',
      '.dl-lin i{font-style:normal;font-family:var(--font-mono,monospace);font-size:8.5px;}',
      '.dl-lin.act{background:var(--dl-hover);}',
      '.dl-lin.act b{color:var(--dl-accent);}'
    ].join('');
    document.head.appendChild(s);
  }

  function badgeClass(status) {
    if (/^VERIFIED/.test(status)) return 'dl-b-ver';
    if (status === 'REFERENCE ONLY') return 'dl-b-ref';
    if (status === 'USER INPUT' || status === 'USER SUPPLIED') return 'dl-b-user';
    if (status === 'CONFLICT') return 'dl-b-con';
    if (/OVERRIDE|CONDITION INCOMPLETE|PENDING REVIEW|OUTDATED/.test(status)) return 'dl-b-inc';
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
    var d = D(), st = S();
    var fams = UI.kind === 'fluid' ? d.FLUID_FAMILIES : d.MATERIAL_FAMILIES;
    var all = d.subjects(UI.kind);
    var counts = {};
    all.forEach(function (s) { counts[s.family] = (counts[s.family] || 0) + 1; });
    var maps = st ? st.mappings() : [];
    var outdated = maps.filter(function (m) { return m.status === 'OUTDATED'; }).length;
    return '<div class="dl-sec">Data library</div>'
      + '<div class="dl-fam' + (UI.kind === 'material' && !UI.family && !UI.favouritesOnly ? ' on' : '')
      + '" data-dl-kind="material"><span>Materials</span><span>'
      + d.subjects('material').length + '</span></div>'
      + '<div class="dl-fam' + (UI.kind === 'fluid' && !UI.family && !UI.favouritesOnly ? ' on' : '')
      + '" data-dl-kind="fluid"><span>Fluids</span><span>'
      + d.subjects('fluid').length + '</span></div>'
      + '<div class="dl-fam' + (UI.favouritesOnly ? ' on' : '') + '" data-dl-fav="1">'
      + '<span>★ Favourites</span><span>' + d.favourites().length + '</span></div>'
      + '<div class="dl-sec">' + (UI.kind === 'fluid' ? 'Fluid families' : 'Material families') + '</div>'
      + fams.map(function (f) {
        var n = counts[f] || 0;
        return '<div class="dl-fam' + (UI.family === f ? ' on' : '') + '" data-dl-family="'
          + esc(f) + '"><span>' + esc(f) + '</span><span>' + n + '</span></div>';
      }).join('')
      + '<div class="dl-sec">Workflow</div>'
      + '<div class="dl-fam' + (UI.tab === 'project' ? ' on' : '') + '" data-dl-tab="project">'
      + '<span>Project data</span><span>' + maps.length
      + (outdated ? ' <span style="color:#fbbf24;">(' + outdated + '!)</span>' : '') + '</span></div>'
      + '<div class="dl-fam' + (UI.tab === 'sets' ? ' on' : '') + '" data-dl-tab="sets">'
      + '<span>Property sets</span><span>' + Object.keys(d.SETS).length + '</span></div>'
      + '<div class="dl-fam' + (UI.tab === 'sources' ? ' on' : '') + '" data-dl-tab="sources">'
      + '<span>Source registry</span><span>&rsaquo;</span></div>'
      + '<div class="dl-fam' + (UI.tab === 'qa' ? ' on' : '') + '" data-dl-tab="qa">'
      + '<span>Data QA</span><span>&rsaquo;</span></div>'
      + '<div class="dl-fam' + (UI.tab === 'ingest' ? ' on' : '') + '" data-dl-tab="ingest">'
      + '<span>Import &amp; templates</span><span>&rsaquo;</span></div>'
      + '<div class="dl-sec">Display</div>'
      + '<div class="dl-fam' + (UI.compact ? ' on' : '') + '" data-dl-compact="1">'
      + '<span>' + (UI.compact ? '☑' : '☐') + ' Compact rows</span><span></span></div>'
      + '<div class="dl-fam' + (UI.onlyHeld ? ' on' : '') + '" data-dl-onlyheld="1">'
      + '<span>' + (UI.onlyHeld ? '☑' : '☐') + ' Hide NOT AVAILABLE</span><span></span></div>';
  }

  /* ══ CENTRE — SUBJECT LIST ══════════════════════════════════════════════ */
  function subjectListHtml() {
    var d = D();
    var list = d.searchSubjects(UI.q, { kind: UI.kind, family: UI.family,
      favouritesOnly: UI.favouritesOnly });
    var nCmp = Object.keys(UI.cmp).filter(function (k) { return UI.cmp[k]; }).length;
    var head = '<div class="dl-btns" style="margin:0 0 9px;">'
      + '<button class="dl-btn" data-dl-newsubject="1">+ NEW ' + (UI.kind === 'fluid' ? 'FLUID' : 'MATERIAL') + '</button>'
      + '<button class="dl-btn" data-dl-compare="1"' + (nCmp < 2 ? ' disabled' : '') + '>COMPARE ('
      + nCmp + ')</button>'
      + (nCmp ? '<button class="dl-btn" data-dl-cmpclear="1">CLEAR COMPARE</button>' : '')
      + '</div>';
    if (!list.length) {
      return head + '<div class="dl-empty">Nothing matches. The library holds what has been '
        + 'migrated from this application’s own property tables plus what has been entered or '
        + 'imported here — use <b>Import &amp; templates</b> to bring in a traceable dataset, or '
        + '<b>+ NEW</b> to create a subject and record values against it.</div>';
    }
    return head + '<div class="dl-list">' + list.map(function (s) {
      var c = d.completeness(s.id) || { held: 0, total: 0, pct: 0 };
      var fav = d.isFavourite(s.id);
      return '<div class="dl-row' + (UI.subjectId === s.id ? ' on' : '') + '" data-dl-subject="'
        + esc(s.id) + '">'
        + '<input type="checkbox" data-dl-cmp="' + esc(s.id) + '"'
        + (UI.cmp[s.id] ? ' checked' : '') + ' title="compare">'
        + '<button class="dl-star' + (fav ? ' on' : '') + '" data-dl-fav-id="' + esc(s.id) + '">'
        + (fav ? '★' : '☆') + '</button>'
        + '<div><div class="dl-nm">' + esc(s.name) + '</div>'
        + '<div class="dl-sub">' + esc(s.family) + ' · ' + c.held + ' of ' + c.total
        + ' properties held (' + c.pct + '%)</div></div>'
        + '<span class="dl-badge ' + (/USER/.test(s.origin) ? 'dl-b-user' : 'dl-b-ref') + '">'
        + (/USER/.test(s.origin) ? 'USER' : 'REFERENCE') + '</span>'
        + '</div>';
    }).join('') + '</div>';
  }

  /* ══ CENTRE — ONE SUBJECT ═══════════════════════════════════════════════ */
  function subjectHtml() {
    var d = D(), st = S();
    var s = d.get(UI.subjectId);
    if (!s) { UI.subjectId = null; return subjectListHtml(); }

    var id = s.identity || {};
    var identLine = s.kind === 'fluid'
      ? ['CAS ' + esc(id.cas), 'Formula ' + esc(id.formula), esc(s.family)].join(' · ')
      : ['Grade ' + esc(id.grade), 'UNS ' + esc((id.designations || {}).UNS),
        'ASTM ' + esc((id.designations || {}).ASTM), esc(s.family)].join(' · ');

    var head = '<button class="dl-btn" data-dl-back="1" style="margin-bottom:10px;">&larr; ALL '
      + (UI.kind === 'fluid' ? 'FLUIDS' : 'MATERIALS') + '</button>'
      + '<div class="dl-h1">' + esc(s.name) + '</div>'
      + '<div class="dl-ident">' + identLine + '</div>'
      + '<div class="dl-btns" style="margin-top:9px;">'
      + ['properties|PROPERTIES', 'composition|COMPOSITION', 'identity|IDENTITY & ALIASES']
        .map(function (t) {
          var p = t.split('|');
          return '<button class="dl-chip' + (UI.subjectTab === p[0] ? ' on' : '')
            + '" data-dl-subtab="' + p[0] + '">' + p[1] + '</button>';
        }).join('')
      + '</div>';

    if (UI.subjectTab === 'composition') return head + compositionHtml(s);
    if (UI.subjectTab === 'identity') return head + identityHtml(s);

    var doms = d.domainCounts(UI.subjectId);
    var on = activeDomains();
    var checked = UI.checked[UI.subjectId] || {};
    var nChecked = checkedKeys().length;

    /* Every property this subject can carry, so the header counts describe
       the whole subject and not just the domains currently ticked. */
    var allRows = d.propertiesOf(UI.subjectId);
    var nAvail = allRows.filter(function (r) { return r.available; }).length;

    var shownRows = [];
    doms.forEach(function (dom) {
      if (!on[dom.key]) return;
      shownRows.push({ domain: dom });
      if (UI.collapsed[dom.key]) return;
      d.propertiesOf(UI.subjectId, dom.key).forEach(function (r) {
        if (UI.onlyHeld && !r.available) return;
        if (UI.qProp) {
          var hay = (r.prop.label + ' ' + r.prop.key).toLowerCase();
          if (hay.indexOf(UI.qProp.toLowerCase()) < 0) return;
        }
        shownRows.push({ row: r });
      });
    });

    var h = head
      + '<div class="dl-h2">Property domains</div>'
      + doms.map(function (x) {
        var pct = x.total ? Math.round(x.held / x.total * 100) : 0;
        return '<div class="dl-domh" data-dl-domain="' + esc(x.key) + '">'
          + '<span style="color:#38bdf8;font-family:ui-monospace,monospace;">'
          + (on[x.key] ? '☑' : '☐') + '</span>'
          + '<b>' + esc(x.label) + '</b>'
          + '<span class="dl-bar"><i style="width:' + pct + '%"></i></span>'
          + '<span class="cnt">' + x.held + ' / ' + x.total + '</span>'
          + '<span class="cnt" data-dl-fold="' + esc(x.key) + '" style="cursor:pointer;">'
          + (UI.collapsed[x.key] ? '▸' : '▾') + '</span>'
          + '</div>';
      }).join('')

      + '<div class="dl-h2">Properties</div>'
      + '<div class="dl-counts"><b>' + allRows.length + '</b> PROPERTIES &nbsp;/&nbsp; <i>'
      + nAvail + '</i> AVAILABLE &nbsp;/&nbsp; <b>' + nChecked + '</b> SELECTED &nbsp;/&nbsp; '
      + (allRows.length - nAvail) + ' NOT AVAILABLE</div>'
      + '<div class="dl-btns" style="margin:0 0 8px;">'
      + '<input class="dl-sel" id="dl-qprop" type="search" placeholder="filter properties…" value="'
      + esc(UI.qProp) + '" style="min-width:170px;">'
      + '<button class="dl-btn sm" data-dl-checkall="1">SELECT AVAILABLE</button>'
      + '<button class="dl-btn sm" data-dl-uncheck="1">CLEAR SELECTION</button>'
      + '<button class="dl-btn sm" data-dl-selectdomain="1">SELECT DOMAIN</button>'
      + '<button class="dl-btn sm" data-dl-tab="sets">SELECT PROPERTY SET</button>'
      + '<button class="dl-btn sm" data-dl-addprop="1">+ ADD PROPERTY</button>'
      + '<button class="dl-btn sm" data-dl-template="1">APPLY TEMPLATE</button>'
      + '<button class="dl-btn sm" data-dl-bulk="1">BULK EDIT</button>'
      + '<button class="dl-btn sm" data-dl-dup="1">DUPLICATE SUBJECT</button>'
      + '</div>';

    h += shownRows.length
      ? '<table class="dl-pt' + (UI.compact ? ' compact' : '') + '">'
        + '<tr><th></th><th>PROPERTY</th><th>VALUE</th><th>UNIT</th>'
        + (UI.compact ? '' : '<th>CONDITION</th><th>FORM</th>')
        + '<th>STATUS</th><th>LAYER</th></tr>'
        + shownRows.map(function (x) {
          if (x.domain) {
            return '<tr><td colspan="' + (UI.compact ? 6 : 8) + '" style="background:#0f172a;'
              + 'font-family:ui-monospace,monospace;font-size:8.5px;letter-spacing:.1em;'
              + 'color:#475569;padding:7px 8px;">' + esc(x.domain.label.toUpperCase())
              + ' — ' + x.domain.held + ' OF ' + x.domain.total + ' HELD</td></tr>';
          }
          return propRowHtml(x.row, checked);
        }).join('') + '</table>'
      : '<div class="dl-empty">No domain is open. Tick a domain above to list its properties.</div>';

    h += '<div class="dl-btns">'
      + '<button class="dl-btn go" data-dl-use="1">USE IN DESIGN (' + nChecked + ')</button>'
      + '<button class="dl-btn" data-dl-addvalue="1">+ ADD VALUE</button>'
      + '</div>';
    return h;
  }

  function propRowHtml(r, checked) {
    var d = D();
    var p = r.prop;
    var res = d.resolve(UI.subjectId, p.key);
    var v = res.effective;
    var unit = UI.unit[p.key] || d.siUnit(p.qty);
    var shown = v && v.si != null ? fmt(d.convert(v.si, p.qty, unit)) : null;
    var avail = !!v;

    var valueCell;
    if (!avail) {
      /* NOT AVAILABLE is kept, and made actionable. A gap with nothing to do
         about it is an obstacle; a gap with four ways forward is a task. */
      valueCell = '<span class="dl-na">NOT AVAILABLE</span><br>'
        + '<button class="dl-act" data-dl-addone="' + esc(p.key) + '">+ ADD VALUE</button>'
        + '<button class="dl-act" data-dl-findsrc="' + esc(p.key) + '">SEARCH SOURCES</button>'
        + '<button class="dl-act" data-dl-import="1">IMPORT DATA</button>';
    } else if (v.form === 'CATEGORICAL') {
      valueCell = esc(v.categorical);
    } else if (v.form === 'TEXT') {
      valueCell = esc(v.text);
    } else if (v.form === 'RANGE' && v.siMin != null) {
      valueCell = '<b>' + esc(fmt(d.convert(v.siMin, p.qty, unit))) + ' … '
        + esc(fmt(d.convert(v.siMax, p.qty, unit))) + '</b>';
    } else if ((v.form === 'TABULAR' || v.form === 'CURVE') && v.table) {
      valueCell = '<b>' + v.table.length + ' points</b> <span style="color:#64748b;">'
        + esc(fmt(d.convert(v.table[0][1], p.qty, unit))) + '…'
        + esc(fmt(d.convert(v.table[v.table.length - 1][1], p.qty, unit))) + '</span>';
    } else {
      valueCell = shown != null ? '<b>' + esc(shown) + '</b>' : '—';
    }

    return '<tr class="pr' + (UI.prop === p.key ? ' on' : '') + '" data-dl-prop="' + esc(p.key) + '">'
      + '<td><input type="checkbox" data-dl-check="' + esc(p.key) + '"'
      + (checked[p.key] ? ' checked' : '') + (avail ? '' : ' disabled') + '></td>'
      + '<td>' + esc(p.label) + (p.userDefined
        ? ' <span class="dl-badge dl-b-user">USER PROPERTY</span>' : '')
      + (res.records > 1 ? ' <span class="dl-badge ' + (res.conflict ? 'dl-b-con' : 'dl-b-ref')
        + '">' + res.records + ' RECORDS</span>' : '')
      + '</td>'
      + '<td>' + valueCell + '</td>'
      + '<td>' + (avail && v.form !== 'CATEGORICAL' && v.form !== 'TEXT' ? esc(unit) : '') + '</td>'
      + (UI.compact ? ''
        : '<td>' + (avail ? esc(d.conditionSummary(v.condition || d.condition({}))) : '') + '</td>'
          + '<td>' + (avail ? esc(v.form) : '') + '</td>')
      + '<td><span class="dl-badge ' + badgeClass(res.status) + '">' + esc(res.status)
      + '</span></td>'
      + '<td style="font-family:ui-monospace,monospace;font-size:8.5px;color:#64748b;">'
      + esc(res.layer === 'MASTER LIBRARY' ? 'MASTER' : res.layer.replace(' OVERRIDE', ' OVR'))
      + '</td></tr>';
  }

  function compositionHtml(s) {
    var st = S();
    var rows = st ? st.composition(s.id) : [];
    return '<div class="dl-h2">Composition</div>'
      + (rows.length
        ? '<table class="dl-pt"><tr><th>ELEMENT</th><th>MIN %</th><th>MAX %</th><th>TYPICAL %</th></tr>'
          + rows.map(function (r) {
            return '<tr><td><b>' + esc(r.element) + '</b></td>'
              + '<td>' + (r.min == null ? '<span class="dl-na">not stated</span>' : esc(r.min)) + '</td>'
              + '<td>' + (r.max == null ? '<span class="dl-na">not stated</span>' : esc(r.max)) + '</td>'
              + '<td>' + (r.typical == null ? '<span class="dl-na">not stated</span>' : esc(r.typical))
              + '</td></tr>';
          }).join('') + '</table>'
          + '<div class="dl-note">Minimum and maximum are specification limits; typical is a '
          + 'measured or quoted figure. The library keeps them apart, because a specification '
          + 'maximum used as a typical value overstates what the material actually contains.</div>'
        : '<div class="dl-empty">No composition recorded for ' + esc(s.name) + '. It is not '
          + 'inferred from the grade name — 316L implies a composition to an engineer, and implying '
          + 'it here would put numbers in the library that nobody entered.</div>')
      + '<div class="dl-btns"><button class="dl-btn go" data-dl-comp="1">'
      + (rows.length ? 'EDIT COMPOSITION' : 'RECORD COMPOSITION') + '</button></div>';
  }

  function identityHtml(s) {
    var d = D();
    var id = s.identity || {};
    var kv = s.kind === 'fluid'
      ? [['PREFERRED NAME', id.preferredName], ['CAS', id.cas], ['FORMULA', id.formula],
        ['MOLECULAR WEIGHT', id.molecularWeight], ['INCHI', id.inchi], ['SMILES', id.smiles],
        ['FAMILY', id.family], ['SYNONYMS', (id.synonyms || []).join(', ') || d.NOT_STATED]]
      : [['PREFERRED NAME', id.preferredName], ['GRADE', id.grade], ['FAMILY', id.family],
        ['UNS', (id.designations || {}).UNS], ['ASTM', (id.designations || {}).ASTM],
        ['ASME', (id.designations || {}).ASME], ['EN', (id.designations || {}).EN],
        ['DIN', (id.designations || {}).DIN], ['JIS', (id.designations || {}).JIS],
        ['IS', (id.designations || {}).IS],
        ['ALIASES', (id.aliases || []).join(', ') || d.NOT_STATED]];
    return '<div class="dl-h2">Identity</div>'
      + '<div class="dl-kv">' + kv.map(function (r) {
        return '<span>' + esc(r[0]) + '</span><span>'
          + (r[1] == null || r[1] === d.NOT_STATED
            ? '<span class="dl-na">NOT STATED</span>' : esc(r[1])) + '</span>';
      }).join('') + '</div>'
      + '<div class="dl-note">A material is a grade and a designation before it is a name. Where a '
      + 'field reads NOT STATED the library does not hold it — it is not filled in from the grade '
      + 'name, however obvious the equivalence is, because an unverified alias is exactly how two '
      + 'different grades quietly become one record.</div>'
      + '<div class="dl-h2">Origin</div>'
      + '<div class="dl-kv"><span>ORIGIN</span><span>' + esc(s.origin) + '</span>'
      + '<span>LIBRARY ID</span><span style="font-family:ui-monospace,monospace;">'
      + esc(s.id) + '</span></div>';
  }

  /* ══ CENTRE — ROUTER ════════════════════════════════════════════════════ */
  function midHtml() {
    if (UI.tab === 'project') return projectHtml();
    if (UI.tab === 'sets') return setsHtml();
    if (UI.tab === 'qa') return qaHtml();
    if (UI.tab === 'sources') return sourcesHtml();
    if (UI.tab === 'ingest') return ingestHtml();
    if (!UI.subjectId) {
      return '<div class="dl-h2">' + (UI.kind === 'fluid' ? 'Fluids' : 'Materials')
        + (UI.family ? ' — ' + esc(UI.family) : '') + '</div>' + subjectListHtml();
    }
    return subjectHtml();
  }

  /* ══ RIGHT PANEL ════════════════════════════════════════════════════════ */
  function rightHtml() {
    var d = D();
    if (!UI.subjectId) return workspaceSummaryHtml();
    if (!UI.prop) return subjectSummaryHtml();
    return propertyDetailHtml();
  }

  /* With nothing chosen the panel explains what the library is holding, so
     the workspace never answers a question with empty space. */
  function workspaceSummaryHtml() {
    var d = D(), st = S();
    var s = d.stats();
    var maps = st ? st.mappings() : [];
    var od = maps.filter(function (m) { return m.status === 'OUTDATED'; });
    return '<div class="dl-h2">The library right now</div>'
      + '<div class="dl-kv">'
      + '<span>SUBJECTS</span><span>' + s.subjects + '</span>'
      + '<span>VALUES HELD</span><span>' + s.values + '</span>'
      + '<span>PROPERTIES DEFINED</span><span>' + s.properties + '</span>'
      + '<span>DOMAINS</span><span>' + s.domains + '</span>'
      + '<span>DESIGN MAPPINGS</span><span>' + maps.length
      + (od.length ? ' <span class="dl-badge dl-b-inc">' + od.length + ' OUTDATED</span>' : '') + '</span>'
      + '<span>PROJECT OVERRIDES</span><span>' + (st ? st.projectOverrides().length : 0) + '</span>'
      + '</div>'
      + (od.length
        ? '<div class="dl-warn">' + od.length + ' design mapping'
          + (od.length === 1 ? ' is' : 's are') + ' OUTDATED — the library value beneath '
          + (od.length === 1 ? 'it has' : 'them has') + ' changed since '
          + (od.length === 1 ? 'it was' : 'they were') + ' accepted. Open <b>Project data</b> to '
          + 'see what moved and decide whether the design should follow it.</div>'
        : '')
      + '<div class="dl-h2">Choose a subject</div>'
      + '<div style="font-size:11px;color:#94a3b8;line-height:1.7;">Pick a material or a fluid on '
      + 'the left, then a property, and this panel shows the value, the condition it applies at, '
      + 'the layer it resolved from, the source behind it, and everywhere it is currently used.</div>';
  }

  function subjectSummaryHtml() {
    var d = D();
    var s = d.get(UI.subjectId);
    var c = d.completeness(UI.subjectId);
    if (!s || !c) return workspaceSummaryHtml();
    return '<div class="dl-h2">' + esc(s.kind === 'fluid' ? 'Fluid' : 'Material') + '</div>'
      + '<div class="dl-h1" style="font-size:14px;">' + esc(s.name) + '</div>'
      + '<div class="dl-ident">' + esc(s.family) + ' · ' + esc(s.origin) + '</div>'
      + '<div class="dl-h2">Completeness</div>'
      + '<div class="dl-kv"><span>PROPERTIES HELD</span><span><b>' + c.held + '</b> of ' + c.total
      + ' (' + c.pct + '%)</span><span>NOT AVAILABLE</span><span>' + c.missing + '</span></div>'
      + '<div class="dl-note">Completeness is not a score to raise. It says how much of what this '
      + 'subject could carry is actually recorded — the number below matters far more, because a '
      + 'material holding all eight piping properties is complete for piping whatever else is '
      + 'missing.</div>'
      + '<div class="dl-h2">Ready for which module</div>'
      + c.forModules.map(function (m) {
        var ok = m.have === m.need;
        return '<div style="font-size:10.5px;padding:5px 0;border-bottom:1px solid #16202f;">'
          + '<b style="color:#e2e8f0;">' + esc(m.label) + '</b> '
          + '<span class="dl-badge ' + (ok ? 'dl-b-ver' : 'dl-b-inc') + '">' + m.have + ' / '
          + m.need + '</span>'
          + (m.missing.length ? '<div style="color:#64748b;margin-top:2px;">missing: '
            + m.missing.map(function (k) { return esc((d.PROPS[k] || {}).label || k); }).join(', ')
            + '</div>' : '')
          + '</div>';
      }).join('')
      + '<div class="dl-h2">Where used</div>'
      + whereUsedHtml(s, null)
      + '<div class="dl-btns">'
      + '<button class="dl-btn go" data-dl-use="1">USE IN DESIGN</button>'
      + '<button class="dl-btn" data-dl-addvalue="1">+ ADD VALUE</button>'
      + '<button class="dl-btn" data-dl-dup="1">DUPLICATE</button>'
      + '</div>';
  }

  function propertyDetailHtml() {
    var d = D(), st = S();
    var s = d.get(UI.subjectId);
    var p = d.PROPS[UI.prop];
    if (!s || !p) return subjectSummaryHtml();
    var res = d.resolve(UI.subjectId, UI.prop, { mappingId: UI.mappingId });
    var v = res.effective;
    var unit = UI.unit[p.key] || d.siUnit(p.qty);

    var h = '<div class="dl-h2">' + esc(p.domain) + ' · ' + esc(s.name) + '</div>'
      + '<div class="dl-h1" style="font-size:14px;">' + esc(p.label) + '</div>';

    if (!v) {
      h += '<div class="dl-val" style="font-size:15px;color:#64748b;">NOT AVAILABLE</div>'
        + '<div class="dl-note">The library holds no traceable value for this property of '
        + esc(s.name) + '. It is shown rather than hidden so the gap is visible, and it is left '
        + 'empty rather than estimated — a plausible number with no source is the one an engineer '
        + 'would never think to question.</div>'
        + '<div class="dl-btns">'
        + '<button class="dl-btn go" data-dl-addone="' + esc(p.key) + '">+ ADD VALUE</button>'
        + '<button class="dl-btn" data-dl-findsrc="' + esc(p.key) + '">SEARCH SOURCES</button>'
        + '<button class="dl-btn" data-dl-import="1">IMPORT DATA</button>'
        + '</div>'
        + '<div class="dl-h2">What would be recorded</div>'
        + '<div class="dl-kv"><span>QUANTITY</span><span>' + esc(p.qty) + '</span>'
        + '<span>CANONICAL UNIT</span><span>' + esc(d.siUnit(p.qty)) + '</span>'
        + '<span>DISPLAY UNITS</span><span>' + esc(d.unitsFor(p.qty).join(', ')) + '</span></div>';
      return h;
    }

    /* ── value / table / graph ──────────────────────────────────────────── */
    /* A property may carry a series in its own right, or acquire one from
       several single values each stated at its own temperature. The second is
       assembled for display only — nothing is merged in the store. */
    var ownSeries = (v.form === 'TABULAR' || v.form === 'CURVE') && v.table && v.table.length > 1;
    var series = ownSeries ? { table: v.table, xUnit: v.xUnit, xProperty: v.xProperty }
      : (res.series ? { table: res.series.table, xUnit: res.series.xUnit,
        xProperty: 'temperature', assembled: true } : null);
    var hasSeries = !!series;
    h += '<div class="dl-btns" style="margin:8px 0 0;">'
      + ['VALUE', 'TABLE', 'GRAPH'].map(function (m) {
        var dis = (m !== 'VALUE' && !hasSeries);
        return '<button class="dl-chip' + (UI.view === m ? ' on' : '') + '" data-dl-view="' + m + '"'
          + (dis ? ' disabled style="opacity:.35;cursor:not-allowed;"' : '') + '>' + m + '</button>';
      }).join('') + '</div>';

    if (UI.view === 'VALUE' || !hasSeries) {
      var shown;
      if (v.form === 'CATEGORICAL') shown = esc(v.categorical);
      else if (v.form === 'TEXT') shown = esc(v.text);
      else if (v.form === 'RANGE' && v.siMin != null) {
        shown = esc(fmt(d.convert(v.siMin, p.qty, unit))) + ' … '
          + esc(fmt(d.convert(v.siMax, p.qty, unit)))
          + ' <span style="font-size:13px;color:#64748b;">' + esc(unit) + '</span>';
      } else if (hasSeries) {
        shown = esc(fmt(d.convert(series.table[0][1], p.qty, unit)))
          + ' <span style="font-size:13px;color:#64748b;">' + esc(unit) + ' at '
          + esc(series.table[0][0]) + ' ' + esc(series.xUnit) + '</span>';
      } else {
        shown = v.si != null ? esc(fmt(d.convert(v.si, p.qty, unit)))
          + ' <span style="font-size:13px;color:#64748b;">' + esc(unit) + '</span>' : '—';
      }
      h += '<div class="dl-val">' + shown + '</div>';
    } else if (UI.view === 'TABLE') {
      var disp = series.table.map(function (t) { return [t[0], d.convert(t[1], p.qty, unit)]; });
      h += '<table class="dl-tbl" style="margin-top:9px;"><tr><th>' + esc(series.xProperty)
        + ' (' + esc(series.xUnit) + ')</th><th>' + esc(p.label) + ' (' + esc(unit) + ')</th></tr>'
        + disp.map(function (t) {
          return '<tr><td>' + esc(fmt(t[0], 2)) + '</td><td>' + esc(fmt(t[1], 4)) + '</td></tr>';
        }).join('') + '</table>'
        + (series.assembled
          ? '<div class="dl-warn">These points are separate records, each stated at its own '
            + 'temperature, shown together because that is what they are. Nothing has been merged '
            + 'in the library and no record has been rewritten — they came from different '
            + 'entries and may have come from different sources.</div>'
          : '<div class="dl-note">Interpolated between these points and never extrapolated beyond '
            + 'them. Outside ' + esc(series.table[0][0]) + '–'
            + esc(series.table[series.table.length - 1][0]) + ' ' + esc(series.xUnit)
            + ' the library reports OUT OF RANGE rather than continuing the last slope.</div>');
    } else {
      var disp2 = series.table.map(function (t) { return [t[0], d.convert(t[1], p.qty, unit)]; });
      h += graph(disp2, series.xProperty + ' (' + series.xUnit + ')', p.label + ' (' + unit + ')')
        + (v.curveLabel ? '<div class="dl-note">Digitised from: ' + esc(v.curveLabel) + '. Read off '
          + 'a chart, so its precision is that of the chart and not of the digits shown.</div>' : '')
        + (series.assembled ? '<div class="dl-warn">Assembled from separate records at different '
          + 'temperatures. The line between the points is drawn to make the trend readable, not '
          + 'because anything was measured between them.</div>' : '');
    }

    if (v.form !== 'CATEGORICAL' && v.form !== 'TEXT' && d.unitsFor(p.qty).length > 1) {
      h += '<div style="margin-top:8px;"><select class="dl-sel" data-dl-unit="' + esc(p.key) + '">'
        + d.unitsFor(p.qty).map(function (u) {
          return '<option value="' + esc(u) + '"' + (u === unit ? ' selected' : '') + '>'
            + esc(u) + '</option>';
        }).join('') + '</select>'
        + '<span style="font-size:9.5px;color:#64748b;margin-left:8px;">display only — the stored '
        + 'quantity does not change</span></div>';
    }

    /* ── the hierarchy, always visible ──────────────────────────────────── */
    h += '<div class="dl-h2">Where this value resolved from</div>'
      + res.lineage.map(function (l) {
        var active = (l.layer === res.layer);
        return '<div class="dl-lin' + (active ? ' act' : '') + '">'
          + '<b>' + esc(l.layer) + '</b>'
          + '<i class="dl-badge ' + (l.state === 'HELD' || l.state === 'SELECTED' || l.state === 'CURRENT'
            ? 'dl-b-ver' : (l.state === 'OVERRIDDEN' || l.state === 'OUTDATED' ? 'dl-b-inc' : 'dl-b-na'))
          + '">' + esc(l.state) + '</i>'
          + '<span style="color:#94a3b8;">' + esc(l.detail || '') + '</span></div>';
      }).join('')
      + '<div style="font-size:10px;color:#64748b;margin-top:6px;line-height:1.6;">A calculation '
      + 'would see the <b style="color:#38bdf8;">' + esc(res.layer) + '</b> value. Each layer '
      + 'replaces the one above it and changes nothing in it.</div>';

    /* ── the record ─────────────────────────────────────────────────────── */
    var src = v.source || d.source({});
    h += '<div class="dl-h2">The record</div>'
      + '<div class="dl-kv">'
      + '<span>DATA FORM</span><span>' + esc(v.form) + '</span>'
      + '<span>CANONICAL SI</span><span>' + esc(fmt(v.si, 6)) + ' ' + esc(d.siUnit(p.qty)) + '</span>'
      + '<span>AS PUBLISHED</span><span>' + (v.original != null
        ? esc(v.original) + ' ' + esc(v.originalUnit || '') : '—') + '</span>'
      + '<span>CONDITION</span><span>' + esc(d.conditionSummary(d.condition(v.condition))) + '</span>'
      + '<span>STATUS</span><span><span class="dl-badge ' + badgeClass(res.status) + '">'
      + esc(res.status) + '</span></span>'
      + '<span>USABLE IN CALC</span><span>' + (res.usableInCalc
        ? 'YES' : 'NO — screening only') + '</span>'
      + '<span>ENGINEERING SOURCE</span><span>' + esc(src.engineeringSource || d.NOT_STATED) + '</span>'
      + '<span>SOURCE TYPE</span><span>' + esc(src.sourceType || d.NOT_STATED) + '</span>'
      + '<span>EDITION</span><span>' + esc(src.edition || d.NOT_STATED) + '</span>'
      + '<span>SECTION</span><span>' + esc(src.section || d.NOT_STATED) + '</span>'
      + '<span>DATE CHECKED</span><span>' + esc(src.dateChecked || d.NOT_STATED) + '</span>'
      + '<span>SOFTWARE SOURCE</span><span>' + esc(src.softwareSource || d.NOT_STATED) + '</span>'
      + (v.reason ? '<span>REASON</span><span>' + esc(v.reason) + '</span>' : '')
      + (v.by ? '<span>ENTERED BY</span><span>' + esc(v.by) + '</span>' : '')
      + '</div>';

    var note = (d.STATUS[res.status] || {}).note;
    if (note) h += '<div class="dl-note">' + esc(note) + '</div>';

    /* ── every record kept ──────────────────────────────────────────────── */
    if (res.master.length > 1) {
      h += '<div class="dl-h2">All records (' + res.master.length + ')</div>'
        + res.master.map(function (x) {
          return '<div style="font-size:10.5px;padding:6px 0;border-bottom:1px solid #16202f;">'
            + '<b style="font-family:ui-monospace,monospace;">'
            + esc(x.si != null ? fmt(d.convert(x.si, p.qty, unit)) + ' ' + unit
              : (x.categorical || x.text || '—')) + '</b> · '
            + esc((x.source || {}).engineeringSource || (x.source || {}).softwareSource || '—')
            + ' · <span class="dl-badge ' + badgeClass(x.status) + '">' + esc(x.status) + '</span>'
            + '</div>';
        }).join('')
        + '<div class="dl-warn">Two records disagree. Both are kept and neither is averaged — an '
        + 'average of two sourced numbers is a third number with no source at all. Resolve it by '
        + 'choosing which source the project follows and recording a project override.</div>';
    }

    /* ── where used and what a change would touch ───────────────────────── */
    h += '<div class="dl-h2">Where used</div>' + whereUsedHtml(s, p.key);

    h += '<div class="dl-btns">'
      + '<button class="dl-btn go" data-dl-add-one="' + esc(p.key) + '">USE IN DESIGN</button>'
      + '<button class="dl-btn" data-dl-editone="' + esc(p.key) + '">'
      + (res.layer === 'MASTER LIBRARY' && v.origin === 'USER ENTERED' ? 'EDIT VALUE' : '+ ADD VALUE')
      + '</button>'
      + '<button class="dl-btn" data-dl-override="' + esc(p.key) + '">CREATE PROJECT OVERRIDE</button>'
      + '<button class="dl-btn" data-dl-impact="' + esc(p.key) + '">IMPACT ANALYSIS</button>'
      + '</div>';
    if (res.projectOverride) {
      h += '<div class="dl-btns"><button class="dl-btn" data-dl-clearov="' + esc(p.key)
        + '">CLEAR PROJECT OVERRIDE</button></div>';
    }
    return h;
  }

  function whereUsedHtml(s, propKey) {
    var d = D(), st = S();
    var out = [];
    try {
      var L = window.AROENGLIB;
      if (L && L.whereUsed) {
        var key = s.id.split(':').slice(1).join(':');
        L.whereUsed(key, s.kind).forEach(function (u) {
          out.push('<div style="font-size:10.5px;color:#cbd5e1;padding:3px 0;">'
            + esc(u.module) + ' — ' + esc(u.value)
            + ' <span class="dl-badge dl-b-na">MODULE TABLE</span></div>');
        });
      }
    } catch (e) {}
    var maps = st ? st.mappingsFor(s.id, propKey) : [];
    maps.forEach(function (m) {
      out.push('<div style="font-size:10.5px;color:#cbd5e1;padding:3px 0;">'
        + '<b>' + esc(m.object || '—') + '</b> · ' + esc(m.moduleLabel) + ' — '
        + m.pairs.length + ' mapped '
        + '<span class="dl-badge ' + (m.status === 'CURRENT' ? 'dl-b-ver' : 'dl-b-inc') + '">'
        + esc(m.status) + '</span></div>');
    });
    return out.length ? out.join('')
      : '<div style="font-size:10.5px;color:#64748b;">Not used by any design object yet.</div>';
  }

  /* ══ OTHER TABS ═════════════════════════════════════════════════════════ */
  function projectHtml() {
    var d = D(), st = S();
    var maps = st ? st.mappings() : [];
    var ovs = st ? st.projectOverrides() : [];
    var modOvs = st ? st.moduleOverrides() : [];
    var revs = st ? st.revisions() : [];

    return '<div class="dl-h2">Design mappings</div>'
      + (maps.length
        ? '<table class="dl-pt"><tr><th>OBJECT</th><th>MODULE</th><th>SUBJECT</th>'
          + '<th>PROPERTY → INPUT</th><th>STATUS</th><th></th></tr>'
          + maps.map(function (m) {
            return '<tr><td><b>' + esc(m.object || '—') + '</b></td>'
              + '<td>' + esc(m.moduleLabel) + '</td>'
              + '<td>' + esc(m.subjectName) + '</td>'
              + '<td style="font-size:10px;color:#94a3b8;">' + m.pairs.map(function (p) {
                return esc(p.propertyLabel) + ' → ' + esc(p.inputLabel);
              }).join('<br>') + '</td>'
              + '<td><span class="dl-badge ' + (m.status === 'CURRENT' ? 'dl-b-ver' : 'dl-b-inc')
              + '">' + esc(m.status) + '</span>'
              + (m.statusReason ? '<div style="font-size:9px;color:#64748b;margin-top:2px;">'
                + esc(m.statusReason) + '</div>' : '') + '</td>'
              + '<td>' + (m.status === 'OUTDATED'
                ? '<button class="dl-act" data-dl-accept="' + esc(m.id) + '">REVIEW &amp; ACCEPT</button>'
                : '')
              + '<button class="dl-act" data-dl-openmap="' + esc(m.id) + '">OPEN</button>'
              + '<button class="dl-act" data-dl-unmap="' + esc(m.id) + '">REMOVE</button></td></tr>';
          }).join('') + '</table>'
          + '<div class="dl-note">A mapping states which library property a design object is meant '
          + 'to be using. It writes nothing into the module. When the value beneath it moves the '
          + 'mapping goes OUTDATED and stays that way until an engineer looks at what changed.</div>'
        : '<div class="dl-empty">No design mapping yet. Choose a material or fluid, tick the '
          + 'properties the design needs, and use <b>USE IN DESIGN</b> to bind them to an object.</div>')

      + '<div class="dl-h2">Project overrides</div>'
      + (ovs.length
        ? '<table class="dl-pt"><tr><th>SUBJECT</th><th>PROPERTY</th><th>VALUE</th><th>REPLACED</th>'
          + '<th>REASON</th><th></th></tr>'
          + ovs.map(function (o) {
            return '<tr><td>' + esc(o.subjectName || o.subjectId) + '</td>'
              + '<td>' + esc(o.propertyLabel || o.property) + '</td>'
              + '<td style="font-family:ui-monospace,monospace;"><b>' + esc(fmt(o.si, 5)) + '</b></td>'
              + '<td style="color:#64748b;">' + esc(o.was || '—') + '</td>'
              + '<td style="font-size:10px;">' + esc(o.reason) + '</td>'
              + '<td><button class="dl-act" data-dl-clearov2="'
              + esc(o.subjectId + '|' + o.property) + '">CLEAR</button></td></tr>';
          }).join('') + '</table>'
        : '<div style="font-size:11px;color:#64748b;">None. The project uses the library values.</div>')

      + (modOvs.length
        ? '<div class="dl-h2">Module overrides</div>'
          + '<table class="dl-pt"><tr><th>OBJECT</th><th>PROPERTY</th><th>VALUE</th><th>REASON</th></tr>'
          + modOvs.map(function (o) {
            return '<tr><td><b>' + esc(o.object || '—') + '</b></td>'
              + '<td>' + esc(o.propertyLabel || o.property) + '</td>'
              + '<td style="font-family:ui-monospace,monospace;">' + esc(fmt(o.si, 5)) + '</td>'
              + '<td style="font-size:10px;">' + esc(o.reason) + '</td></tr>';
          }).join('') + '</table>'
        : '')

      + '<div class="dl-h2">Revisions (' + revs.length + ')</div>'
      + (revs.length
        ? '<table class="dl-pt"><tr><th>WHEN</th><th>LAYER</th><th>ACTION</th><th>WHAT</th><th>WHY</th></tr>'
          + revs.slice(0, 40).map(function (r) {
            return '<tr><td style="color:#64748b;font-size:10px;">'
              + esc(String(r.at).replace('T', ' ').slice(0, 16)) + '</td>'
              + '<td style="font-size:9.5px;">' + esc(r.layer) + '</td>'
              + '<td style="font-size:10px;">' + esc(r.action) + '</td>'
              + '<td style="font-size:10px;">' + esc([r.subjectName, r.propertyLabel].filter(Boolean).join(' · '))
              + (r.to ? ' → <b>' + esc(r.to) + '</b>' : '')
              + (r.detail ? '<div style="color:#64748b;">' + esc(r.detail) + '</div>' : '') + '</td>'
              + '<td style="font-size:10px;color:#94a3b8;">' + esc(r.reason || '—') + '</td></tr>';
          }).join('') + '</table>'
        : '<div style="font-size:11px;color:#64748b;">Nothing has changed yet.</div>')

      + '<div class="dl-btns">'
      + '<button class="dl-btn" data-dl-exportproj="1">EXPORT PROJECT DATA (JSON)</button>'
      + '<button class="dl-btn" data-dl-importproj="1">IMPORT PROJECT DATA</button>'
      + '</div>';
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
      }).join('')
      + '<div class="dl-h2">Property templates</div>'
      + '<div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-bottom:10px;">'
      + 'What an engineer is normally expected to record for a kind of subject. A template opens '
      + 'the domains and ticks the properties — it creates <b>empty rows to fill</b>, never values. '
      + 'Its purpose is to make the gaps on a new material visible.</div>'
      + d.templatesFor().map(function (t) {
        return '<div class="dl-mod" data-dl-tpl2="' + esc(t.name) + '"><b>' + esc(t.name) + '</b>'
          + '<div>' + esc(t.note) + ' · ' + t.props.length + ' properties</div></div>';
      }).join('');
  }

  /* Every distinct source behind the library, with what it is backing. The
     registry is how an engineer answers "what is this library actually built
     on?" without opening a hundred records. */
  function sourcesHtml() {
    var d = D();
    var reg = {};
    d.subjects().forEach(function (s) {
      d.propertiesOf(s.id).forEach(function (r) {
        r.values.forEach(function (v) {
          var src = v.source || {};
          var name = src.engineeringSource && src.engineeringSource !== d.NOT_STATED
            ? src.engineeringSource : (src.softwareSource || 'NOT STATED');
          var key = name + ' | ' + (src.sourceType || 'NOT STATED');
          if (!reg[key]) {
            reg[key] = { name: name, type: src.sourceType || 'NOT STATED', n: 0,
              subjects: {}, usable: 0 };
          }
          reg[key].n++;
          reg[key].subjects[s.id] = true;
          if (d.canCalculate(v.status)) reg[key].usable++;
        });
      });
    });
    var rows = Object.keys(reg).map(function (k) { return reg[k]; })
      .sort(function (a, b) { return b.n - a.n; });
    return '<div class="dl-h2">Source registry</div>'
      + '<div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-bottom:10px;">'
      + 'Every distinct basis behind a value in this library, and how much rests on it. '
      + '<b>LEGACY MODULE VALUE</b> is the honest name for a number that was already inside this '
      + 'application when the library was built: it says only that the software has been using the '
      + 'figure, which is not the same as a source.</div>'
      + '<table class="dl-pt"><tr><th>SOURCE</th><th>TYPE</th><th>VALUES</th><th>SUBJECTS</th>'
      + '<th>CLEARED FOR CALC</th></tr>'
      + rows.map(function (r) {
        return '<tr><td>' + esc(r.name) + '</td>'
          + '<td><span class="dl-badge ' + (/PRIMARY|GOVERNMENT|LICENSED/.test(r.type) ? 'dl-b-ver'
            : (/LEGACY|SOFTWARE/.test(r.type) ? 'dl-b-na' : 'dl-b-ref')) + '">'
          + esc(r.type) + '</span></td>'
          + '<td><b>' + r.n + '</b></td>'
          + '<td>' + Object.keys(r.subjects).length + '</td>'
          + '<td>' + r.usable + '</td></tr>';
      }).join('') + '</table>';
  }

  function qaHtml() {
    var d = D(), st = S();
    var s = d.stats();
    var rows = Object.keys(s.byStatus).sort(function (a, b) {
      return (d.STATUS[a] || {}).rank - (d.STATUS[b] || {}).rank;
    });
    var maps = st ? st.mappings() : [];
    var conflicts = 0, noCond = 0;
    d.subjects().forEach(function (sub) {
      d.propertiesOf(sub.id).forEach(function (r) {
        if (r.values.length > 1) conflicts++;
        r.values.forEach(function (v) {
          if (!v.condition || v.condition.temperature === d.NOT_STATED) noCond++;
        });
      });
    });
    return '<div class="dl-h2">Data QA</div>'
      + '<div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-bottom:10px;">'
      + 'The data administrator’s view. Engineers use the library; this is where its condition is '
      + 'inspected. The existing conflict and provenance checking on the project page is unchanged '
      + 'and still runs there.</div>'
      + '<table class="dl-pt"><tr><th>MEASURE</th><th>COUNT</th></tr>'
      + '<tr><td>Subjects held</td><td><b>' + s.subjects + '</b></td></tr>'
      + '<tr><td>Property values held</td><td><b>' + s.values + '</b></td></tr>'
      + '<tr><td>Properties in the dictionary</td><td><b>' + s.properties + '</b></td></tr>'
      + '<tr><td>Domains</td><td><b>' + s.domains + '</b></td></tr>'
      + '<tr><td>Properties carrying more than one record</td><td><b>' + conflicts + '</b></td></tr>'
      + '<tr><td>Values with no stated temperature</td><td><b>' + noCond + '</b></td></tr>'
      + '<tr><td>Design mappings</td><td><b>' + maps.length + '</b></td></tr>'
      + '<tr><td>Mappings OUTDATED</td><td><b>'
      + maps.filter(function (m) { return m.status === 'OUTDATED'; }).length + '</b></td></tr>'
      + rows.map(function (k) {
        return '<tr><td><span class="dl-badge ' + badgeClass(k) + '">' + esc(k) + '</span>'
          + '<div style="font-size:9.5px;color:#64748b;margin-top:3px;">'
          + esc((d.STATUS[k] || {}).note || '') + '</div></td>'
          + '<td><b>' + s.byStatus[k] + '</b></td></tr>';
      }).join('')
      + '</table>'
      + '<div class="dl-note">Most of what is held was migrated from this application’s own module '
      + 'property tables and has not been checked against a primary source — which is why it reads '
      + 'REFERENCE ONLY rather than VERIFIED, and why none of it feeds a calculation through this '
      + 'library. The modules keep using their own tables exactly as before.</div>';
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
      + '<button class="dl-btn go" data-dl-import="1">IMPORT DATA (PREVIEW FIRST)</button>'
      + '<button class="dl-btn" data-dl-tpl="import">DOWNLOAD IMPORT TEMPLATE (CSV)</button>'
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

  /* ══ RENDER ═════════════════════════════════════════════════════════════ */
  var host = null;
  var widths = { left: 230, right: 380 };
  try {
    var w = JSON.parse(localStorage.getItem('aro_dl_widths_v1') || 'null');
    if (w && w.left && w.right) widths = w;
  } catch (e) {}

  function render() {
    if (!host) return;
    var logo = 'icon-512.png';
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
        'ingest|IMPORT', 'sources|SOURCE REGISTRY', 'qa|DATA QA'].map(function (t) {
        var p = t.split('|');
        return '<button class="dl-tab' + (UI.tab === p[0] ? ' on' : '') + '" data-dl-tab="'
          + p[0] + '">' + p[1] + '</button>';
      }).join('')
      + '</div>'
      + '<div class="dl-body" style="grid-template-columns:' + widths.left + 'px 4px minmax(0,1fr) 4px '
      + widths.right + 'px;">'
      + '<div class="dl-left">' + leftHtml() + '</div>'
      + '<div class="dl-grip" data-dl-grip="left"></div>'
      + '<div class="dl-mid">' + midHtml() + '</div>'
      + '<div class="dl-grip dl-grip2" data-dl-grip="right"></div>'
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

  function refresh() { if (UI.open) render(); }

  /* ══ PANEL RESIZE ═══════════════════════════════════════════════════════ */
  document.addEventListener('mousedown', function (e) {
    if (!UI.open || !e.target || !e.target.getAttribute) return;
    var side = e.target.getAttribute('data-dl-grip');
    if (!side) return;
    e.preventDefault();
    var startX = e.clientX;
    var start = side === 'left' ? widths.left : widths.right;
    function move(ev) {
      var dx = ev.clientX - startX;
      var v = side === 'left' ? start + dx : start - dx;
      v = Math.max(150, Math.min(620, v));
      widths[side] = v;
      var body = host.querySelector('.dl-body');
      if (body) {
        body.style.gridTemplateColumns = widths.left + 'px 4px minmax(0,1fr) 4px ' + widths.right + 'px';
      }
    }
    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      try { localStorage.setItem('aro_dl_widths_v1', JSON.stringify(widths)); } catch (er) {}
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, true);

  /* ══ EVENTS ═════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('[data-dl-open]')) { e.preventDefault(); open(); return; }
    if (!UI.open) return;
    var d = D(), st = S(), ed = E();
    var x;
    function hit(sel) { return t.closest(sel); }
    function subj() { return d.get(UI.subjectId); }

    if ((x = hit('[data-dl-close]'))) { e.preventDefault(); close(); return; }
    if ((x = hit('[data-dl-fav-id]'))) {
      e.preventDefault(); e.stopPropagation();
      d.toggleFavourite(x.getAttribute('data-dl-fav-id')); render(); return;
    }
    if ((x = hit('[data-dl-cmp]'))) {
      e.stopPropagation();
      var cid = x.getAttribute('data-dl-cmp');
      UI.cmp[cid] = !UI.cmp[cid];
      setTimeout(render, 0); return;
    }
    if ((x = hit('[data-dl-cmpclear]'))) { UI.cmp = {}; render(); return; }
    if ((x = hit('[data-dl-compare]'))) {
      var ids = Object.keys(UI.cmp).filter(function (k) { return UI.cmp[k]; });
      if (ids.length > 5) { alert('Compare takes up to five subjects at a time.'); return; }
      ed.compareView(ids); return;
    }
    if ((x = hit('[data-dl-kind]'))) {
      UI.kind = x.getAttribute('data-dl-kind'); UI.family = null; UI.subjectId = null;
      UI.prop = null; UI.domains = null; UI.favouritesOnly = false;
      UI.tab = UI.kind === 'fluid' ? 'fluids' : 'materials'; render(); return;
    }
    if ((x = hit('[data-dl-fav="1"]'))) {
      UI.favouritesOnly = !UI.favouritesOnly; UI.subjectId = null; render(); return;
    }
    if ((x = hit('[data-dl-compact]'))) { UI.compact = !UI.compact; render(); return; }
    if ((x = hit('[data-dl-onlyheld]'))) { UI.onlyHeld = !UI.onlyHeld; render(); return; }
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
    if ((x = hit('[data-dl-subtab]'))) { UI.subjectTab = x.getAttribute('data-dl-subtab'); render(); return; }
    if ((x = hit('[data-dl-back]'))) { UI.subjectId = null; UI.prop = null; render(); return; }
    if ((x = hit('[data-dl-subject]'))) {
      UI.subjectId = x.getAttribute('data-dl-subject');
      UI.domains = null; UI.prop = null; UI.subjectTab = 'properties'; render(); return;
    }
    if ((x = hit('[data-dl-fold]'))) {
      e.stopPropagation();
      var fk = x.getAttribute('data-dl-fold');
      UI.collapsed[fk] = !UI.collapsed[fk];
      setTimeout(render, 0); return;
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
    if ((x = hit('[data-dl-view]'))) { UI.view = x.getAttribute('data-dl-view'); render(); return; }

    /* The row actions live inside a property row, so they must be answered
       before the row's own click handler — otherwise a button inside a row
       only ever succeeds in selecting the row it sits in. */
    if ((x = hit('[data-dl-addprop]'))) {
      ed.addProperty({ kind: subj() ? subj().kind : 'both', onDone: function () { render(); } });
      return;
    }
    if ((x = hit('[data-dl-addvalue]')) || (x = hit('[data-dl-addone]')) || (x = hit('[data-dl-editone]'))) {
      e.stopPropagation();
      var s0 = subj();
      if (!s0) return;
      var key = x.getAttribute('data-dl-addone') || x.getAttribute('data-dl-editone') || UI.prop;
      if (!key) {
        /* No property chosen yet — open the first NOT AVAILABLE one so the
           button always leads somewhere rather than doing nothing. */
        var first = d.propertiesOf(s0.id).filter(function (r) { return !r.available; })[0];
        key = first ? first.prop.key : d.propertiesOf(s0.id)[0].prop.key;
      }
      var res0 = d.resolve(s0.id, key);
      var own = res0.master.filter(function (v) { return v.origin === 'USER ENTERED'; })[0];
      var raw = own ? (st.userValues().filter(function (v) { return v.id === own.id; })[0]) : null;
      ed.editValue({ subjectId: s0.id, subjectName: s0.name, kind: s0.kind, property: key,
        layer: 'MASTER', existing: x.getAttribute('data-dl-editone') ? raw : null,
        onDone: function () { UI.prop = key; render(); } });
      return;
    }
    if ((x = hit('[data-dl-override]'))) {
      var s1 = subj();
      if (!s1) return;
      ed.editValue({ subjectId: s1.id, subjectName: s1.name, kind: s1.kind,
        property: x.getAttribute('data-dl-override'), layer: 'PROJECT',
        onDone: function () { render(); } });
      return;
    }
    if ((x = hit('[data-dl-clearov]'))) {
      st.clearProjectOverride(UI.subjectId, x.getAttribute('data-dl-clearov')); render(); return;
    }
    if ((x = hit('[data-dl-clearov2]'))) {
      var pr = x.getAttribute('data-dl-clearov2').split('|');
      st.clearProjectOverride(pr[0], pr[1]); render(); return;
    }
    if ((x = hit('[data-dl-impact]'))) {
      e.stopPropagation();
      ed.impact({ subjectId: UI.subjectId, property: x.getAttribute('data-dl-impact') }); return;
    }
    if ((x = hit('[data-dl-findsrc]'))) {
      e.stopPropagation();
      sourceGuidance(x.getAttribute('data-dl-findsrc')); return;
    }
    if ((x = hit('[data-dl-import]'))) {
      e.stopPropagation();
      ed.importDialog({ onDone: function () { render(); } }); return;
    }

    if ((x = hit('[data-dl-prop]'))) {
      UI.prop = x.getAttribute('data-dl-prop');
      UI.view = 'VALUE'; render(); return;
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
    if ((x = hit('[data-dl-selectdomain]'))) {
      /* Ticks everything in the domains currently open, held or not, so an
         engineer can carry the gaps into the design discussion rather than
         quietly dropping them. */
      var bag5 = UI.checked[UI.subjectId] = UI.checked[UI.subjectId] || {};
      var on5 = activeDomains();
      Object.keys(on5).forEach(function (dom) {
        if (!on5[dom]) return;
        d.propertiesOf(UI.subjectId, dom).forEach(function (r) {
          if (r.available) bag5[r.prop.key] = true;
        });
      });
      render(); return;
    }
    if ((x = hit('[data-dl-uncheck]'))) { UI.checked[UI.subjectId] = {}; render(); return; }

    if ((x = hit('[data-dl-bulk]'))) {
      ed.bulkEdit({ subjectId: UI.subjectId, onDone: function () { render(); } }); return;
    }
    if ((x = hit('[data-dl-dup]'))) {
      ed.duplicateSubject({ subjectId: UI.subjectId, onDone: function (id) {
        UI.subjectId = id; UI.prop = null; render();
      } }); return;
    }
    if ((x = hit('[data-dl-comp]'))) {
      ed.compositionDialog({ subjectId: UI.subjectId, onDone: function () { render(); } }); return;
    }
    if ((x = hit('[data-dl-newsubject]'))) {
      var name = prompt('Name the new ' + (UI.kind === 'fluid' ? 'fluid' : 'material')
        + '. It will be created with every property NOT AVAILABLE — nothing is filled in for it.');
      if (!name) return;
      var made = st.addSubject({ kind: UI.kind, name: name.trim(),
        family: UI.family || (UI.kind === 'fluid' ? 'User Defined Fluids' : 'User Defined Materials') });
      d.rebuild();
      UI.subjectId = made.id; UI.prop = null; render(); return;
    }
    if ((x = hit('[data-dl-template]'))) {
      var s2 = subj();
      if (!s2) return;
      var tpls = d.templatesFor(s2.kind);
      var pickName = prompt('Apply a property template — it ticks the properties this kind of '
        + 'subject is normally specified on, and creates no values:\n\n'
        + tpls.map(function (t, i) { return (i + 1) + '. ' + t.name + ' — ' + t.note; }).join('\n'));
      var idx = parseInt(pickName, 10) - 1;
      if (!(idx >= 0 && idx < tpls.length)) return;
      applyTemplate(tpls[idx]); return;
    }
    if ((x = hit('[data-dl-use]')) || (x = hit('[data-dl-add-one]'))) {
      var one = x.getAttribute('data-dl-add-one');
      if (one) {
        var bag3 = UI.checked[UI.subjectId] = UI.checked[UI.subjectId] || {};
        bag3[one] = true;
      }
      var s3 = subj();
      if (!s3) return;
      ed.useInDesign({ subjectId: s3.id, keys: checkedKeys(), onDone: function () {
        UI.tab = 'project'; render();
      } });
      return;
    }
    if ((x = hit('[data-dl-accept]'))) {
      st.acceptMapping(x.getAttribute('data-dl-accept')); render(); return;
    }
    if ((x = hit('[data-dl-unmap]'))) {
      st.removeMapping(x.getAttribute('data-dl-unmap')); render(); return;
    }
    if ((x = hit('[data-dl-openmap]'))) {
      var mid = x.getAttribute('data-dl-openmap');
      var m = st.mappings().filter(function (y) { return y.id === mid; })[0];
      if (m) {
        UI.subjectId = m.subjectId; UI.mappingId = m.id;
        UI.prop = m.pairs.length ? m.pairs[0].property : null;
        UI.tab = m.kind === 'fluid' ? 'fluids' : 'materials';
        UI.kind = m.kind || 'material';
        UI.domains = null;
        render();
      }
      return;
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
    if ((x = hit('[data-dl-tpl2]'))) {
      if (!UI.subjectId) { alert('Choose a material or fluid first, then apply a template.'); return; }
      var nm = x.getAttribute('data-dl-tpl2');
      var t2 = d.templatesFor().filter(function (y) { return y.name === nm; })[0];
      if (t2) applyTemplate(t2);
      return;
    }
    if ((x = hit('[data-dl-tpl]'))) {
      var which = x.getAttribute('data-dl-tpl');
      download(which === 'dict' ? d.dictionaryCsv() : d.importTemplateCsv(),
        which === 'dict' ? 'AROGARA_PROPERTY_DICTIONARY.csv' : 'AROGARA_IMPORT_TEMPLATE.csv',
        'text/csv');
      return;
    }
    if ((x = hit('[data-dl-exportproj]'))) {
      download(JSON.stringify(st.exportAll(), null, 2),
        'AROGARA_PROJECT_DATA.json', 'application/json');
      return;
    }
    if ((x = hit('[data-dl-importproj]'))) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var res = st.importAll(JSON.parse(String(fr.result)), 'merge');
            if (!res.ok) { alert(res.error); return; }
            d.rebuild(); render();
          } catch (er) { alert('That file could not be read as an AROGARA project package.'); }
        };
        fr.readAsText(f);
      };
      inp.click();
      return;
    }
  }, true);

  function applyTemplate(t) {
    var d = D();
    var bag = UI.checked[UI.subjectId] = UI.checked[UI.subjectId] || {};
    var on = activeDomains();
    t.props.forEach(function (k) {
      var p = d.PROPS[k];
      if (!p) return;
      on[p.domain] = true;
      bag[k] = true;
    });
    UI.tab = UI.kind === 'fluid' ? 'fluids' : 'materials';
    UI.onlyHeld = false;
    render();
    /* Say plainly what a template did and did not do. */
    var missing = t.props.filter(function (k) {
      return d.masterValues(UI.subjectId, k).length === 0;
    });
    if (missing.length) {
      alert(t.name + ' applied.\n\n' + missing.length + ' of its ' + t.props.length
        + ' properties are NOT AVAILABLE on this subject:\n\n'
        + missing.map(function (k) { return '· ' + (d.PROPS[k] || {}).label; }).join('\n')
        + '\n\nThe template ticks what should be recorded. It does not fill anything in.');
    }
  }

  /* A property with no value is a research task, not a prompt to invent one.
     This says where the number would legitimately come from, and refuses to
     produce it. */
  function sourceGuidance(propKey) {
    var d = D(), ed = E();
    var p = d.PROPS[propKey];
    var s = d.get(UI.subjectId);
    var where = {
      MECHANICAL: 'the material specification (ASTM / EN / IS), a mill certificate, or the '
        + 'manufacturer’s datasheet for the product form and heat treatment concerned',
      THERMAL: 'the manufacturer’s datasheet, a materials handbook, or a measured value from the '
        + 'project’s own testing',
      PHYSICAL: 'the material or product specification, or a supplier datasheet',
      TRANSPORT: 'the fluid supplier’s datasheet, a properties database the project is licensed '
        + 'for, or a measured value at the service condition',
      THERMODYNAMIC: 'a properties database or equation of state the project is licensed for',
      CHEMICAL: 'a corrosion chart from the material supplier, or the project’s materials '
        + 'selection report',
      CODE: 'the design code itself — ASME II-D, EN 13445-2 or the applicable table, at the '
        + 'design temperature',
      SURFACE: 'the piping specification for ε, or a measured surface finish for Ra',
      SAFETY: 'the safety data sheet for the substance as supplied'
    }[p.domain] || 'the specification, datasheet or test report the project holds for it';

    ed.modal('SEARCH SOURCES', p.label + ' · ' + (s ? s.name : ''),
      '<div class="de-note">This library will not produce a value for you. A plausible number for '
      + esc(p.label) + ' is easy to generate and impossible to check, and an engineer who is handed '
      + 'one has no way of knowing it was never sourced.</div>'
      + '<div class="de-sec">Where this number legitimately comes from</div>'
      + '<div style="font-size:11.5px;line-height:1.75;color:#cbd5e1;">' + esc(where) + '.</div>'
      + '<div class="de-sec">What the library will accept</div>'
      + '<div style="font-size:11.5px;line-height:1.75;color:#cbd5e1;">'
      + 'A value in ' + esc(d.unitsFor(p.qty).join(', ')) + ', with the condition it applies at and '
      + 'the document it came from. Enter it with <b>+ ADD VALUE</b>, or bring a prepared dataset '
      + 'through <b>IMPORT DATA</b>. Either way it lands labelled with exactly the provenance it '
      + 'actually has.</div>'
      + '<div class="de-warn">Do not copy extended text or whole tables out of a copyrighted '
      + 'handbook. Cite it — the citation is what makes the value traceable, and the reproduction '
      + 'adds nothing that traceability needs.</div>',
      '<button class="de-btn" data-de-cancel="1">CLOSE</button>'
      + '<button class="de-btn go" data-dl-addone="' + esc(propKey) + '">+ ADD VALUE</button>');
    var backs = document.querySelectorAll('.de-back');
    var back = backs[backs.length - 1];
    back.addEventListener('click', function (e) {
      if (e.target.closest && (e.target.closest('[data-de-cancel]') || e.target.closest('[data-dl-addone]'))) {
        back.remove();
      }
    }, true);
  }

  function download(text, name, type) {
    try {
      var blob = new Blob([text], { type: type + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (err) {}
  }

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
    if (e.target.id === 'dl-qprop') {
      UI.qProp = e.target.value;
      clearTimeout(window.__dlqp);
      window.__dlqp = setTimeout(function () {
        render();
        var el2 = document.getElementById('dl-qprop');
        if (el2) { el2.focus(); el2.setSelectionRange(el2.value.length, el2.value.length); }
      }, 220);
    }
  }, true);

  document.addEventListener('change', function (e) {
    if (!UI.open || !e.target) return;
    var u = e.target.getAttribute && e.target.getAttribute('data-dl-unit');
    if (u) { UI.unit[u] = e.target.value; render(); }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!UI.open) return;
    if (e.key === 'Escape' && !document.querySelector('.de-back')) close();
    /* Ctrl+F inside the workspace goes to the library search rather than the
       browser's, which cannot see a table this one paginates. */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      var el = document.getElementById(UI.subjectId ? 'dl-qprop' : 'dl-q');
      if (el) { e.preventDefault(); el.focus(); el.select(); }
    }
  });

  /* ══ LAUNCHER ═══════════════════════════════════════════════════════════ */
  function mountLauncher() {
    var tab = document.getElementById('project-tab');
    if (!tab || document.getElementById('aro-dl-launch')) return;
    css();
    var d = D();
    var st = d.stats();
    var store = S();
    var maps = store ? store.mappings().length : 0;
    var box = document.createElement('div');
    box.id = 'aro-dl-launch';
    box.className = 'dl-host';
    box.innerHTML = '<div class="dl-hosth">AROGARA ENGINEERING DATA LIBRARY</div>'
      + '<div class="dl-hostsub">Materials, fluids and properties as a governed database: '
      + '<b>' + st.properties + ' properties</b> across <b>' + st.domains + ' domains</b>, '
      + 'condition-aware, canonical SI storage with convertible display units, and a mandatory '
      + 'hierarchy from the master library through project and module overrides to the calculation. '
      + 'It holds <b>' + st.values + ' values over ' + st.subjects + ' subjects</b>'
      + (maps ? ' and <b>' + maps + ' design mapping' + (maps === 1 ? '' : 's') + '</b>' : '')
      + '. Properties with no traceable value read NOT AVAILABLE rather than being estimated — and '
      + 'each of them carries the ways forward.</div>'
      + '<button class="dl-launch" data-dl-open="1">OPEN ENGINEERING DATA LIBRARY →</button>';
    tab.appendChild(box);
  }

  window.ARODATAUI = { open: open, close: close, render: refresh, state: UI };

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

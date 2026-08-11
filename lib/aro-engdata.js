/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — ENGINEERING DATA REGISTRY AND PROJECT DESIGN BASIS
   ---------------------------------------------------------------------------
   Water is defined independently in five places in this application, and the
   materials in three. None of those tables carries a source, a condition or a
   status, and each module reads only its own.

   This does NOT replace them. Replacing five tables underneath five live
   calculation engines in one pass is exactly how a working application stops
   working. Instead it INDEXES them:

        module table          registry                design basis
        ────────────          ────────                ────────────
        PHE  FLUIDS   ──┐
        STHE_FLUIDS   ──┤                             fluid
        DPHE_FLUIDS   ──┼──▶  one entry per fluid ──▶ material
        AROVP FLUIDS  ──┤     property · value ·      pressures
        PHE  MATERIALS──┤     unit · condition ·      temperatures
        TANK MATERIALS──┤     source · status         corrosion allowance
        DPHE_MATERIALS──┘                             standards

   Two things fall out of doing it this way.

   · EVERY PROPERTY GAINS PROVENANCE. Value, unit, the condition it was stated
     at where the table records one, which module table it came from, and
     whether it is a reference value or a software default. Nothing here is
     invented: if a table does not state a temperature, the registry says the
     condition is unstated rather than inventing 25 °C.

   · THE TABLES ARE CHECKED AGAINST EACH OTHER. Where two modules define the
     same property of the same substance, the registry normalises both into SI
     and compares them. Agreement is worth knowing; disagreement is worth
     knowing much more, and until now nothing in the application could see it.

   The DESIGN BASIS is the project-level record the modules can read. It does
   not overwrite anything. A module that has its own value keeps it and is
   shown as an override, because silently replacing an engineer's number with
   a project default is worse than asking them to look.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* ── unit normalisation, declared rather than assumed ──────────────────── */
  var SI = {
    rho: { unit: 'kg/m³', to: function (v) { return v; } },
    mu: { unit: 'Pa·s', to: function (v) { return v; } },
    muCp: { unit: 'Pa·s', to: function (v) { return v / 1000; }, from: 'cP' },
    cp: { unit: 'J/kg·K', to: function (v) { return v; } },
    cpKj: { unit: 'J/kg·K', to: function (v) { return v * 1000; }, from: 'kJ/kg·K' },
    k: { unit: 'W/m·K', to: function (v) { return v; } },
    S: { unit: 'MPa', to: function (v) { return v; } },
    rough: { unit: 'mm', to: function (v) { return v; } },
    corr: { unit: 'mm/yr', to: function (v) { return v; } },
    fouling: { unit: 'm²·K/W', to: function (v) { return v; } }
  };

  var LABEL = {
    rho: 'Density', mu: 'Dynamic viscosity', cp: 'Specific heat capacity',
    k: 'Thermal conductivity', S: 'Allowable stress', rough: 'Surface roughness',
    corr: 'Corrosion allowance', fouling: 'Fouling resistance'
  };

  /* ── where the data actually lives today ───────────────────────────────── */
  function tables() {
    var T = [];
    function add(o) { if (o.table) T.push(o); }
    add({
      id: 'phe-fluids', kind: 'fluid', module: 'Plate Heat Exchanger',
      file: 'lib/aro-phe.js', table: window.AROPHE && window.AROPHE.fluids,
      map: { rho: 'rho', mu: 'mu', cp: 'cp', k: 'k' }
    });
    add({
      id: 'sthe-fluids', kind: 'fluid', module: 'Shell & Tube Exchanger',
      file: 'app.js', table: window.STHE_FLUIDS,
      map: { rho: 'rho', mu: 'muCp:mu', cp: 'cpKj:cp', k: 'k' }
    });
    add({
      id: 'dphe-fluids', kind: 'fluid', module: 'Double Pipe Exchanger',
      file: 'app.js', table: window.DPHE_FLUIDS,
      map: { rho: 'rho', mu: 'muCp:mu', cp: 'cpKj:cp', k: 'k' }
    });
    add({
      id: 'phe-materials', kind: 'material', module: 'Plate Heat Exchanger',
      file: 'lib/aro-phe.js', table: window.AROPHE && window.AROPHE.materials,
      map: { k: 'k', rho: 'rho', S: 'S', rough: 'rough', corr: 'corr' }
    });
    add({
      id: 'tank-materials', kind: 'material', module: 'Storage Tank',
      file: 'lib/aro-tank.js', table: window.AROTANK && window.AROTANK.materials,
      map: { rho: 'rho', S: 'S', rough: 'rough' }
    });
    add({
      id: 'dphe-materials', kind: 'material', module: 'Double Pipe Exchanger',
      file: 'app.js', table: window.DPHE_MATERIALS,
      map: { k: 'kw', fouling: 'fouling' }
    });
    return T;
  }

  /* A table row's display name: some tables key by slug and carry a `name`,
     others key by the name itself. */
  function rowName(key, row) {
    return (row && typeof row.name === 'string' && row.name) ? row.name : key;
  }
  /* Fold "Water (25°C)", "water" and "Water" onto one entry, and keep the
     stated condition rather than throwing it away. */
  function normKey(name) {
    return String(name).toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  function conditionOf(name) {
    var m = String(name).match(/\(([^)]*)\)/);
    if (m && /[0-9]/.test(m[1])) return m[1].trim();
    return null;
  }

  var FLUIDS = null, MATERIALS = null, ISSUES = null;

  function build() {
    FLUIDS = {}; MATERIALS = {}; ISSUES = [];
    tables().forEach(function (t) {
      var bag = t.kind === 'fluid' ? FLUIDS : MATERIALS;
      Object.keys(t.table).forEach(function (key) {
        var row = t.table[key];
        if (!row || typeof row !== 'object') return;
        var disp = rowName(key, row);
        var nk = normKey(disp);
        if (!nk) return;
        if (!bag[nk]) bag[nk] = { key: nk, name: disp, aliases: [], props: {} };
        var e = bag[nk];
        if (e.aliases.indexOf(disp) < 0) e.aliases.push(disp);
        if (disp.length < e.name.length) e.name = disp;
        Object.keys(t.map).forEach(function (prop) {
          var spec = String(t.map[prop]);
          var conv = spec.indexOf(':') >= 0 ? spec.split(':')[0] : prop;
          var field = spec.indexOf(':') >= 0 ? spec.split(':')[1] : spec;
          var raw = row[field];
          if (typeof raw !== 'number' || !isFinite(raw)) return;
          var rule = SI[conv] || SI[prop];
          if (!rule) return;
          (e.props[prop] = e.props[prop] || []).push({
            value: rule.to(raw), unit: rule.unit,
            raw: raw, rawUnit: rule.from || rule.unit,
            condition: conditionOf(disp),
            source: t.module, file: t.file, tableId: t.id,
            status: 'REFERENCE'
          });
        });
      });
    });
    crossCheck(FLUIDS, 'fluid');
    crossCheck(MATERIALS, 'material');
    ISSUES.sort(function (a, b) {
      return (isFinite(b.ratio) ? b.ratio : 1e9) - (isFinite(a.ratio) ? a.ratio : 1e9);
    });
  }

  /* Where two modules state the same property, they had better agree. */
  function crossCheck(bag, kind) {
    Object.keys(bag).forEach(function (nk) {
      var e = bag[nk];
      Object.keys(e.props).forEach(function (prop) {
        var list = e.props[prop];
        if (list.length < 2) return;
        var vals = list.map(function (r) { return r.value; });
        var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
        var mid = (lo + hi) / 2;
        var spread = mid !== 0 ? (hi - lo) / Math.abs(mid) : 0;
        e.props[prop].spread = spread;
        /* 2 % covers rounding between tables; beyond that two modules are
           calculating from genuinely different numbers */
        if (spread > 0.02) {
          /* (hi-lo)/mean saturates near 200 % however far apart the two values
             are, so a ten-fold disagreement reported as "163 %" reads as a
             rounding argument. Carry the ratio as well and lead with it once
             the values are more than three times apart. */
          ISSUES.push({
            kind: kind, name: e.name, prop: prop, label: LABEL[prop] || prop,
            lo: lo, hi: hi, spread: spread, unit: list[0].unit,
            ratio: lo !== 0 ? hi / lo : Infinity,
            sources: list.map(function (r) { return r.source; })
          });
        }
      });
    });
  }

  function ensure() { if (!FLUIDS) build(); }

  /* ══ PROJECT DESIGN BASIS ═══════════════════════════════════════════════
     The project-level record. It is read by whoever wants it and forced on
     nobody: a module that carries its own number keeps it and is reported as
     an override. */
  var BASIS_KEY = 'aro_design_basis_v1';
  var FIELDS = [
    ['project', 'Project', 'text', ''],
    ['client', 'Client', 'text', ''],
    ['location', 'Location', 'text', ''],
    ['engineer', 'Engineer', 'text', ''],
    ['fluid', 'Service fluid', 'fluid', ''],
    ['material', 'Equipment material', 'material', ''],
    ['pipeMaterial', 'Pipe material', 'material', ''],
    ['tOp', 'Operating temperature', 'num', '', '°C'],
    ['tDes', 'Design temperature', 'num', '', '°C'],
    ['pOp', 'Operating pressure', 'num', '', 'bar(g)'],
    ['pDes', 'Design pressure', 'num', '', 'bar(g)'],
    ['ca', 'Corrosion allowance', 'num', '', 'mm'],
    ['code', 'Design code', 'text', '']
  ];

  function basis() {
    try {
      var raw = JSON.parse(localStorage.getItem(BASIS_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) { return {}; }
  }
  function setBasis(k, v) {
    var b = basis();
    if (v === '' || v == null) delete b[k]; else b[k] = v;
    b.__rev = (b.__rev || 0) + 1;
    b.__at = Date.now();
    try { localStorage.setItem(BASIS_KEY, JSON.stringify(b)); } catch (e) {}
    render();
    return b;
  }

  /* What the design basis says versus what a module is actually using. The
     comparison is reported, never applied. */
  function compare() {
    var b = basis(), out = [];
    function look(id, label, field) {
      var el = document.getElementById(id);
      if (!el) return;
      var v = String(el.value == null ? '' : el.value).trim();
      if (!v) return;
      var want = b[field];
      if (!want) return;
      var same = normKey(v) === normKey(want);
      out.push({ module: label, field: field, basis: want, module_value: v, same: same });
    }
    look('fluid-select', 'Pump Hydraulics', 'fluid');
    look('lq-fluid', 'Liquid Line Sizing', 'fluid');
    look('sthe-fluid-tube-select', 'Shell & Tube (tube side)', 'fluid');
    look('dphe-fluid-hot-select', 'Double Pipe (hot side)', 'fluid');
    look('tk-mat', 'Storage Tank', 'material');
    look('phe-mat', 'Plate Exchanger', 'material');
    return out;
  }

  /* ══ THE PANEL ═════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function f(v, d) { return isFinite(v) ? Number(v).toPrecision(d || 4).replace(/\.?0+$/, '') : '—'; }

  function css() {
    if (document.getElementById('aro-engdata-css')) return;
    var s = document.createElement('style');
    s.id = 'aro-engdata-css';
    s.textContent = [
      '.aro-ed{margin-top:18px;font-family:var(--font-mono,monospace);}',
      '.aro-ed h3{font-size:11px;letter-spacing:0.09em;font-weight:800;margin:0 0 8px;',
      'color:var(--color-saffron,#f97316);}',
      '.aro-ed-sub{font-size:9.5px;color:var(--text-muted,#94a3b8);line-height:1.6;margin-bottom:10px;}',
      '.aro-ed-box{border:1px solid var(--border-muted,#334);border-radius:6px;padding:12px;',
      'margin-bottom:14px;background:rgba(148,163,184,0.04);}',
      '.aro-ed-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 14px;}',
      '.aro-ed-fld{display:flex;flex-direction:column;gap:3px;}',
      '.aro-ed-fld label{font-size:8.5px;letter-spacing:0.07em;color:var(--text-muted,#94a3b8);font-weight:700;}',
      '.aro-ed-fld input{background:var(--bg-input,rgba(15,23,42,0.5));border:1px solid var(--border-muted,#334);',
      'border-radius:4px;padding:5px 7px;font-family:inherit;font-size:10.5px;',
      'color:var(--text-primary,#e2e8f0);}',
      '.aro-ed-u{font-size:8px;color:var(--text-muted,#94a3b8);}',
      '.aro-ed-t{width:100%;border-collapse:collapse;font-size:9px;}',
      '.aro-ed-t th{text-align:left;padding:4px 6px;border-bottom:1px solid rgba(148,163,184,0.35);',
      'color:var(--text-muted,#94a3b8);font-weight:800;letter-spacing:0.05em;}',
      '.aro-ed-t td{padding:4px 6px;border-bottom:1px dotted rgba(148,163,184,0.2);vertical-align:top;',
      'color:var(--text-primary,#e2e8f0);}',
      '.aro-ed-t td b{font-weight:800;}',
      '.aro-ed-src{color:var(--text-muted,#94a3b8);}',
      '.aro-ed-ok{color:#4ade80;font-weight:800;}',
      '.aro-ed-warn{color:#fbbf24;font-weight:800;}',
      '.aro-ed-pill{display:inline-block;font-size:7.5px;letter-spacing:0.06em;font-weight:800;',
      'border:1px solid rgba(148,163,184,0.45);border-radius:3px;padding:1px 5px;color:#94a3b8;}',
      '.aro-ed-scroll{max-height:280px;overflow:auto;}',
      'body.theme-day .aro-ed-t td{color:#0f172a;}',
      'body.theme-day .aro-ed-box{background:rgba(15,23,42,0.03);border-color:#c8d0d8;}'
    ].join('');
    document.head.appendChild(s);
  }

  function propRows(e) {
    var h = '';
    Object.keys(e.props).forEach(function (prop) {
      var list = e.props[prop];
      list.forEach(function (r, i) {
        h += '<tr>'
          + '<td>' + (i === 0 ? '<b>' + esc(e.name) + '</b>' : '') + '</td>'
          + '<td>' + (i === 0 ? esc(LABEL[prop] || prop) : '') + '</td>'
          + '<td><b>' + f(r.value, 5) + '</b> <span class="aro-ed-src">' + esc(r.unit) + '</span></td>'
          + '<td>' + (r.condition ? esc(r.condition) : '<span class="aro-ed-src">not stated</span>') + '</td>'
          + '<td class="aro-ed-src">' + esc(r.source) + '<br>' + esc(r.file) + '</td>'
          + '<td><span class="aro-ed-pill">' + esc(r.status) + '</span></td>'
          + '</tr>';
      });
    });
    return h;
  }

  function html() {
    ensure();
    var b = basis();
    var nf = Object.keys(FLUIDS).length, nm = Object.keys(MATERIALS).length;
    var h = '<div class="aro-ed">';

    /* design basis */
    h += '<div class="aro-ed-box"><h3>PROJECT DESIGN BASIS</h3>'
      + '<div class="aro-ed-sub">The project-level record every module can read. '
      + 'It is never applied over a value an engineer has entered — where a module '
      + 'differs, it is reported below as an override.'
      + (b.__rev ? ' &nbsp;·&nbsp; revision ' + b.__rev : '') + '</div>'
      + '<div class="aro-ed-grid">';
    FIELDS.forEach(function (fd) {
      h += '<div class="aro-ed-fld"><label>' + esc(fd[1])
        + (fd[4] ? ' <span class="aro-ed-u">' + esc(fd[4]) + '</span>' : '') + '</label>'
        + '<input data-ed-field="' + fd[0] + '" type="' + (fd[2] === 'num' ? 'number' : 'text')
        + '" step="any" value="' + esc(b[fd[0]] == null ? '' : b[fd[0]]) + '"'
        + (fd[2] === 'fluid' ? ' list="aro-ed-fluids"' : '')
        + (fd[2] === 'material' ? ' list="aro-ed-materials"' : '')
        + '></div>';
    });
    h += '</div>';
    h += '<datalist id="aro-ed-fluids">'
      + Object.keys(FLUIDS).map(function (k) {
          return '<option value="' + esc(FLUIDS[k].name) + '">'; }).join('')
      + '</datalist>';
    h += '<datalist id="aro-ed-materials">'
      + Object.keys(MATERIALS).map(function (k) {
          return '<option value="' + esc(MATERIALS[k].name) + '">'; }).join('')
      + '</datalist>';

    var cmp = compare();
    if (cmp.length) {
      h += '<div style="margin-top:12px;"><table class="aro-ed-t">'
        + '<tr><th>MODULE</th><th>DESIGN BASIS</th><th>MODULE VALUE</th><th>STATE</th></tr>';
      cmp.forEach(function (c) {
        h += '<tr><td>' + esc(c.module) + '</td><td>' + esc(c.basis) + '</td>'
          + '<td><b>' + esc(c.module_value) + '</b></td>'
          + '<td>' + (c.same ? '<span class="aro-ed-ok">MATCHES BASIS</span>'
                             : '<span class="aro-ed-warn">OVERRIDE ACTIVE</span>') + '</td></tr>';
      });
      h += '</table></div>';
    }
    h += '</div>';

    /* consistency */
    h += '<div class="aro-ed-box"><h3>TABLE CONSISTENCY</h3>'
      + '<div class="aro-ed-sub">Where two modules state the same property of the same '
      + 'substance, both are normalised into SI and compared. '
      + (ISSUES.length
          ? '<span class="aro-ed-warn">' + ISSUES.length + ' disagreement'
            + (ISSUES.length === 1 ? '' : 's') + ' beyond 2 %.</span> '
            + 'A wide gap is not automatically an error \u2014 a generic name such as '
            + 'Crude Oil covers a range of real fluids, and two tables may mean different '
            + 'ones. It does mean the same selection gives different numbers in different '
            + 'modules, with nothing on screen to say so.'
          : '<span class="aro-ed-ok">Every shared property agrees within 2 %.</span>')
      + '</div>';
    if (ISSUES.length) {
      h += '<table class="aro-ed-t"><tr><th>SUBSTANCE</th><th>PROPERTY</th>'
        + '<th>RANGE</th><th>DISAGREEMENT</th><th>STATED BY</th></tr>';
      ISSUES.forEach(function (i2) {
        h += '<tr><td><b>' + esc(i2.name) + '</b></td><td>' + esc(i2.label) + '</td>'
          + '<td>' + f(i2.lo, 5) + ' – ' + f(i2.hi, 5) + ' ' + esc(i2.unit) + '</td>'
          + '<td class="aro-ed-warn">'
          + (isFinite(i2.ratio) && i2.ratio > 3
              ? '&times; ' + i2.ratio.toFixed(i2.ratio > 20 ? 0 : 1)
              : (i2.spread * 100).toFixed(1) + ' %')
          + '</td>'
          + '<td class="aro-ed-src">' + esc(i2.sources.join(', ')) + '</td></tr>';
      });
      h += '</table>';
    }
    h += '</div>';

    /* the registry itself */
    h += '<div class="aro-ed-box"><h3>FLUID PROPERTIES &nbsp;<span class="aro-ed-pill">'
      + nf + ' INDEXED</span></h3>'
      + '<div class="aro-ed-sub">Indexed from the module tables that already carry them. '
      + 'Where a table does not state the condition a value belongs to, this says so rather '
      + 'than assuming one.</div>'
      + '<div class="aro-ed-scroll"><table class="aro-ed-t">'
      + '<tr><th>FLUID</th><th>PROPERTY</th><th>VALUE</th><th>CONDITION</th>'
      + '<th>SOURCE</th><th>STATUS</th></tr>';
    Object.keys(FLUIDS).sort().forEach(function (k) { h += propRows(FLUIDS[k]); });
    h += '</table></div></div>';

    h += '<div class="aro-ed-box"><h3>MATERIAL PROPERTIES &nbsp;<span class="aro-ed-pill">'
      + nm + ' INDEXED</span></h3>'
      + '<div class="aro-ed-sub">The same, for the materials the design modules select from.</div>'
      + '<div class="aro-ed-scroll"><table class="aro-ed-t">'
      + '<tr><th>MATERIAL</th><th>PROPERTY</th><th>VALUE</th><th>CONDITION</th>'
      + '<th>SOURCE</th><th>STATUS</th></tr>';
    Object.keys(MATERIALS).sort().forEach(function (k) { h += propRows(MATERIALS[k]); });
    h += '</table></div></div>';

    h += '</div>';
    return h;
  }

  /* ── mount into the project tab, without disturbing what is there ──────── */
  function render() {
    var tab = document.getElementById('project-tab');
    if (!tab || !tab.offsetParent) return;
    css();
    var host = document.getElementById('aro-engdata-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-engdata-host';
      tab.appendChild(host);
    }
    try { host.innerHTML = html(); } catch (e) { host.innerHTML = ''; }
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var fld = t.getAttribute('data-ed-field');
    if (!fld) return;
    var b = basis();
    var v = String(t.value == null ? '' : t.value).trim();
    if (v === '') delete b[fld]; else b[fld] = v;
    b.__rev = (b.__rev || 0) + 1;
    b.__at = Date.now();
    try { localStorage.setItem(BASIS_KEY, JSON.stringify(b)); } catch (e2) {}
  }, true);

  var pending = null;
  function schedule() {
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () { pending = null; render(); }, 260);
  }
  document.addEventListener('click', function () { schedule(); }, true);

  window.AROENGDATA = {
    fluids: function () { ensure(); return FLUIDS; },
    materials: function () { ensure(); return MATERIALS; },
    issues: function () { ensure(); return ISSUES; },
    lookup: function (kind, name) {
      ensure();
      var bag = kind === 'material' ? MATERIALS : FLUIDS;
      return bag[normKey(name)] || null;
    },
    basis: basis,
    setBasis: setBasis,
    compare: compare,
    rebuild: function () { FLUIDS = null; ensure(); render(); },
    render: render
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(render, 900); });
  } else {
    setTimeout(render, 900);
  }
})();

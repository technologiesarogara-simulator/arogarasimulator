/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — USER-DEFINED DATA, EXPORT AND IMPORT  (window.AROUSERLIB)
   ---------------------------------------------------------------------------
   Phases 43–46. Everything in the common library came out of the module tables
   that shipped with the application. A project fluid nobody anticipated, a
   grade off a mill certificate, a valve from a vendor quotation — none of it
   could be entered at all, so it was typed straight into a module input where
   it carried no source, no condition and no status.

   THE ONE RULE. A user value never masquerades as reference data. Every record
   added here is stamped USER VALUE, carries the engineer who entered it and
   the date, and reads AUTO-APPLY CAUTION wherever it appears. It sits beside
   the reference tables and is never confused with them. That is the whole
   point of allowing it: a number an engineer stands behind is worth more than
   a table value, but only if the report can tell the reader which it was.

   VALIDATION IS A CONVERSATION, NOT A GATE. A density of zero is impossible
   and is refused. A density of 13 500 kg/m³ is mercury and is unusual, so it
   is questioned and accepted. Rejecting valid data for being uncommon is how
   an engineering tool becomes useless on the job that actually needed it, so
   the rules below separate what cannot be true from what is merely rare.

   IMPORT SHOWS ITS WORK. Nothing is committed from a file until the engineer
   has seen what it contains: how many records, which are new, which collide
   with something already held, and which fail a rule and why. A silent import
   of a malformed file is the fastest way to poison a library.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ══ WHAT CAN BE ENTERED ════════════════════════════════════════════════
     The same property taxonomy the common library uses, so a user value and
     a table value are the same quantity in the same canonical unit and can be
     compared without conversion arguments. */
  var FIELDS = {
    fluid: [
      ['rho', 'Density', 'kg/m³'],
      ['mu', 'Dynamic viscosity', 'cP'],
      ['cp', 'Specific heat capacity', 'kJ/kg·K'],
      ['k', 'Thermal conductivity', 'W/m·K']
    ],
    material: [
      ['rho', 'Density', 'kg/m³'],
      ['S', 'Allowable stress', 'MPa'],
      ['k', 'Thermal conductivity', 'W/m·K'],
      ['epsHyd', 'Absolute hydraulic roughness ε', 'mm'],
      ['finishRa', 'Surface finish Ra', 'µm']
    ],
    component: [
      ['nps', 'Nominal size', 'in'],
      ['K', 'Resistance coefficient K', '—'],
      ['cv', 'Flow coefficient Cv', '—']
    ]
  };

  /* ══ PHASE 46 · VALIDATION RULES ════════════════════════════════════════
     `hard` is what cannot be true and is refused. `odd` is what is rare
     enough to be worth a second look and is accepted with a note. */
  var RULES = {
    rho: { hard: function (v) { return v > 0; }, hardWhy: 'Density must be greater than zero.',
      odd: function (v) { return v >= 300 && v <= 14000; },
      oddWhy: 'Outside 300–14 000 kg/m³. Mercury is 13 546 and liquid hydrogen is 71, so '
        + 'unusual is not impossible — check it and keep it if it is right.' },
    mu: { hard: function (v) { return v > 0; }, hardWhy: 'Dynamic viscosity must be greater than zero.',
      odd: function (v) { return v >= 0.001 && v <= 1e6; },
      oddWhy: 'Outside 0.001–1 000 000 cP. Bitumen at ambient genuinely reaches this far.' },
    cp: { hard: function (v) { return v > 0; }, hardWhy: 'Specific heat capacity must be greater than zero.',
      odd: function (v) { return v >= 0.1 && v <= 15; },
      oddWhy: 'Outside 0.1–15 kJ/kg·K. Liquid hydrogen is about 9.7; mercury is 0.14.' },
    k: { hard: function (v) { return v > 0; }, hardWhy: 'Thermal conductivity must be greater than zero.',
      odd: function (v) { return v >= 0.01 && v <= 450; },
      oddWhy: 'Outside 0.01–450 W/m·K. Silver is 429; an insulant can be under 0.03.' },
    S: { hard: function (v) { return v > 0; }, hardWhy: 'Allowable stress must be greater than zero.',
      odd: function (v) { return v >= 10 && v <= 800; },
      oddWhy: 'Outside 10–800 MPa for a design allowable.' },
    epsHyd: { hard: function (v) { return v >= 0; }, hardWhy: 'Absolute roughness cannot be negative.',
      odd: function (v) { return v <= 10; },
      oddWhy: 'Over 10 mm. Riveted steel — the roughest entry on a Moody chart — is 0.9 mm.' },
    finishRa: { hard: function (v) { return v >= 0; }, hardWhy: 'Surface finish cannot be negative.',
      odd: function (v) { return v <= 50; }, oddWhy: 'Over 50 µm is coarse for a machined finish.' },
    nps: { hard: function (v) { return v > 0; }, hardWhy: 'Nominal size must be greater than zero.',
      odd: function (v) { return v <= 60; }, oddWhy: 'Over NPS 60 is outside ASME B36.10M.' },
    K: { hard: function (v) { return v >= 0; }, hardWhy: 'A resistance coefficient cannot be negative.',
      odd: function (v) { return v <= 1000; }, oddWhy: 'K over 1000 is extreme for a single fitting.' },
    cv: { hard: function (v) { return v > 0; }, hardWhy: 'Cv must be greater than zero.',
      odd: function (v) { return v <= 1e5; }, oddWhy: 'Cv over 100 000 is extreme.' }
  };

  /* Validate one record. Returns { ok, errors[], warnings[] } — errors stop
     it, warnings do not. */
  function validate(rec) {
    var out = { ok: true, errors: [], warnings: [] };
    if (!rec || typeof rec !== 'object') {
      out.ok = false; out.errors.push('Not a record.'); return out;
    }
    var kind = rec.kind;
    if (!FIELDS[kind]) { out.ok = false; out.errors.push('Unknown kind "' + kind + '".'); return out; }
    if (!rec.name || !String(rec.name).trim()) {
      out.ok = false; out.errors.push('A name is required.');
    }
    var any = false;
    FIELDS[kind].forEach(function (f) {
      var key = f[0];
      var v = rec.props ? rec.props[key] : undefined;
      if (v === undefined || v === null || v === '') return;
      var n = Number(v);
      if (!isFinite(n)) {
        out.ok = false; out.errors.push(f[1] + ': "' + v + '" is not a number.'); return;
      }
      any = true;
      var r = RULES[key];
      if (!r) return;
      if (!r.hard(n)) { out.ok = false; out.errors.push(f[1] + ': ' + r.hardWhy); return; }
      if (r.odd && !r.odd(n)) out.warnings.push(f[1] + ' = ' + n + ' ' + f[2] + '. ' + r.oddWhy);
    });
    if (!any) { out.ok = false; out.errors.push('At least one property is required.'); }
    if (!rec.condition) {
      out.warnings.push('No condition stated. The record is kept and marked CONDITION NOT STATED — '
        + 'a property without the temperature it was measured at cannot be applied automatically.');
    }
    if (!rec.source) {
      out.warnings.push('No source stated. It will read USER VALUE with no reference behind it.');
    }
    return out;
  }

  /* ══ STORAGE ════════════════════════════════════════════════════════════ */
  var KEY = 'aro_userlib_v1';
  function all() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    render(true);
  }
  function engineer() {
    try {
      var b = window.AROENGDATA ? window.AROENGDATA.basis() : {};
      if (b && b.engineer) return b.engineer;
    } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem('aro_session_v1') || '{}');
      return s.name || (s.email ? String(s.email).split('@')[0] : '') || 'Not recorded';
    } catch (e) {}
    return 'Not recorded';
  }

  function add(rec) {
    var v = validate(rec);
    if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };
    var list = all();
    var stored = {
      id: 'U' + (list.length + 1) + '-' + Date.now().toString(36),
      kind: rec.kind,
      name: String(rec.name).trim(),
      grade: rec.grade ? String(rec.grade).trim() : null,
      condition: rec.condition ? String(rec.condition).trim() : null,
      source: rec.source ? String(rec.source).trim() : null,
      note: rec.note ? String(rec.note).trim() : null,
      props: {},
      /* Never anything else. A user record cannot claim reference status. */
      status: 'USER VALUE',
      by: engineer(),
      at: Date.now()
    };
    FIELDS[rec.kind].forEach(function (f) {
      var val = rec.props ? rec.props[f[0]] : undefined;
      if (val === undefined || val === null || val === '') return;
      stored.props[f[0]] = Number(val);
    });
    list.push(stored);
    save(list);
    return { ok: true, record: stored, warnings: v.warnings };
  }

  function remove(id) {
    save(all().filter(function (r) { return r.id !== id; }));
  }

  /* ══ PHASE 44 · EXPORT ══════════════════════════════════════════════════ */
  function download(name, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    } catch (e) { return false; }
  }
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* The whole library as one sheet — the reference records the modules ship
     with and the user records side by side, each carrying its status so the
     two can never be mistaken for one another in a spreadsheet either. */
  function exportCsv() {
    var rows = [['SUBJECT', 'KIND', 'GRADE', 'PROPERTY', 'VALUE', 'UNIT', 'SI VALUE', 'SI UNIT',
      'CONDITION', 'STATUS', 'ENGINEERING SOURCE', 'SOFTWARE SOURCE', 'ENTERED BY']];
    try {
      var L = window.AROENGLIB;
      if (L) {
        L.records().forEach(function (r) {
          rows.push([r.subject, r.kind, r.grade || '', r.label,
            L.fromSI(r.si, r.prop), (L.props()[r.prop] || {}).display[0][0],
            r.si, r.siUnit, r.condition || 'NOT STATED', r.status,
            r.engSource, r.softSource + ' · ' + r.module, '']);
        });
      }
    } catch (e) {}
    /* A user row carries the same canonical SI value as a reference row, so
       the two can be compared in a spreadsheet without a unit argument. The
       component fields — nominal size, K, Cv — are not quantities the common
       library holds, so their SI columns stay empty rather than carrying a
       number that means nothing. */
    var L = window.AROENGLIB;
    all().forEach(function (r) {
      Object.keys(r.props).forEach(function (k) {
        var f = null;
        (FIELDS[r.kind] || []).forEach(function (x) { if (x[0] === k) f = x; });
        var si = '', siUnit = '';
        try {
          var P = L ? L.props()[k] : null;
          if (P && f && L.toSI) {
            var v = L.toSI(r.props[k], f[2]);
            if (isFinite(v)) { si = v; siUnit = P.si; }
          }
        } catch (e) {}
        rows.push([r.name, r.kind, r.grade || '', f ? f[1] : k, r.props[k], f ? f[2] : '',
          si, siUnit, r.condition || 'NOT STATED', 'USER VALUE', r.source || 'Not stated',
          'User-defined library', r.by]);
      });
    });
    return download('AROGARA_ENGINEERING_LIBRARY.csv',
      rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'),
      'text/csv;charset=utf-8');
  }

  /* Everything that belongs to the project rather than to the application:
     the design basis, the user records, the criteria overrides and the
     revision history. Deliberately not the module tables — those ship with
     the software and re-importing them somewhere else would be pointless. */
  function projectPackage() {
    function safe(fn, fb) { try { return fn(); } catch (e) { return fb; } }
    return {
      format: 'AROGARA-PROJECT',
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: engineer(),
      designBasis: safe(function () { return window.AROENGDATA.basis(); }, {}),
      userLibrary: all(),
      criteriaOverrides: safe(function () { return window.AROCRIT.overrides(); }, {}),
      revisions: safe(function () { return window.AROIMPACT.revisions(); }, [])
    };
  }
  function exportJson() {
    return download('AROGARA_PROJECT_PACKAGE.json',
      JSON.stringify(projectPackage(), null, 2), 'application/json');
  }

  /* ══ PHASE 45 · IMPORT SAFETY ═══════════════════════════════════════════
     Read, classify, show. Nothing is written until the preview is accepted. */
  function inspect(text) {
    var report = { ok: false, error: null, records: [], newCount: 0, dupCount: 0,
      badCount: 0, warnCount: 0, basis: null, overrides: null, revisions: 0 };
    var data;
    try { data = JSON.parse(text); } catch (e) {
      report.error = 'The file is not valid JSON, so nothing in it can be trusted.';
      return report;
    }
    if (!data || typeof data !== 'object') {
      report.error = 'The file does not contain an object.'; return report;
    }
    if (data.format !== 'AROGARA-PROJECT') {
      report.error = 'This is not an AROGARA project package. Expected format '
        + '"AROGARA-PROJECT", found ' + (data.format ? '"' + data.format + '"' : 'nothing') + '.';
      return report;
    }
    var have = {};
    all().forEach(function (r) { have[(r.kind + '|' + r.name + '|' + (r.grade || '')).toLowerCase()] = r; });

    (Array.isArray(data.userLibrary) ? data.userLibrary : []).forEach(function (r) {
      var v = validate(r);
      var key = (String(r && r.kind) + '|' + String(r && r.name) + '|' + String((r && r.grade) || '')).toLowerCase();
      var row = { record: r, name: (r && r.name) || '(unnamed)', kind: (r && r.kind) || '?',
        ok: v.ok, errors: v.errors, warnings: v.warnings, duplicate: !!have[key] };
      report.records.push(row);
      if (!v.ok) report.badCount++;
      else if (row.duplicate) report.dupCount++;
      else report.newCount++;
      if (v.warnings.length) report.warnCount += v.warnings.length;
    });

    report.basis = data.designBasis && typeof data.designBasis === 'object' ? data.designBasis : null;
    report.overrides = data.criteriaOverrides && typeof data.criteriaOverrides === 'object'
      ? data.criteriaOverrides : null;
    report.revisions = Array.isArray(data.revisions) ? data.revisions.length : 0;
    report.ok = true;
    return report;
  }

  /* Commits only what the preview showed as importable. A record that failed
     a rule is never written, and a duplicate is skipped rather than silently
     overwriting something an engineer entered by hand. */
  function commit(report, opts) {
    opts = opts || {};
    var list = all(), n = 0;
    report.records.forEach(function (row) {
      if (!row.ok) return;
      if (row.duplicate && !opts.replaceDuplicates) return;
      var r = row.record;
      var stored = {
        id: 'U' + (list.length + 1) + '-' + Date.now().toString(36) + '-i',
        kind: r.kind, name: String(r.name).trim(),
        grade: r.grade || null, condition: r.condition || null,
        source: r.source || null, note: r.note || null,
        props: {}, status: 'USER VALUE',
        by: (r.by || 'Imported'), at: Date.now(), imported: true
      };
      (FIELDS[r.kind] || []).forEach(function (f) {
        var v = r.props ? r.props[f[0]] : undefined;
        if (v === undefined || v === null || v === '') return;
        stored.props[f[0]] = Number(v);
      });
      if (row.duplicate && opts.replaceDuplicates) {
        list = list.filter(function (x) {
          return (x.kind + '|' + x.name + '|' + (x.grade || '')).toLowerCase()
            !== (stored.kind + '|' + stored.name + '|' + (stored.grade || '')).toLowerCase();
        });
      }
      list.push(stored); n++;
    });
    save(list);
    if (opts.basis && report.basis && window.AROENGDATA) {
      Object.keys(report.basis).forEach(function (k) {
        if (/^__/.test(k)) return;
        try { window.AROENGDATA.setBasis(k, report.basis[k]); } catch (e) {}
      });
    }
    return n;
  }

  /* ══ UI ═════════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-userlib-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-ul{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;}',
      '.ul-h{background:rgba(129,140,248,.10);border-bottom:1px solid var(--border-muted);padding:10px 12px;}',
      '.ul-h b{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#818cf8;}',
      '.ul-sub{font-size:10.5px;color:var(--text-muted);margin-top:3px;line-height:1.5;}',
      '.ul-bar{display:flex;gap:6px;padding:9px 12px;border-bottom:1px solid var(--border-muted);flex-wrap:wrap;}',
      '.ul-btn{font-family:var(--font-mono);font-size:9.5px;font-weight:700;letter-spacing:.05em;',
      '  padding:6px 11px;border-radius:4px;cursor:pointer;border:1px solid var(--border-muted);',
      '  background:transparent;color:var(--text-muted);}',
      '.ul-btn.on{background:#818cf8;border-color:#818cf8;color:#0b0f2a;}',
      '.ul-btn:hover{border-color:#818cf8;color:#818cf8;}',
      '.ul-btn.on:hover{color:#0b0f2a;}',
      '.ul-form{padding:11px 12px;border-bottom:1px solid var(--border-muted);',
      '  display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;}',
      '.ul-f label{display:block;font-family:var(--font-mono);font-size:8.5px;letter-spacing:.06em;',
      '  color:var(--text-muted);margin-bottom:3px;}',
      '.ul-f input,.ul-f select{width:100%;background:var(--surface-2,rgba(148,163,184,.08));',
      '  border:1px solid var(--border-muted);border-radius:4px;padding:6px 8px;color:inherit;',
      '  font-family:var(--font-mono);font-size:11px;}',
      '.ul-msg{padding:9px 12px;font-size:10.5px;line-height:1.55;border-bottom:1px solid var(--border-muted);}',
      '.ul-msg.err{color:#f87171;} .ul-msg.warn{color:#fbbf24;} .ul-msg.ok{color:#4ade80;}',
      '.ul-r{padding:8px 12px;border-bottom:1px dashed var(--border-muted);font-size:10.5px;',
      '  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start;}',
      '.ul-n{font-family:var(--font-mono);font-weight:700;}',
      '.ul-p{color:var(--text-muted);font-size:10px;margin-top:2px;}',
      '.ul-meta{font-size:9px;color:var(--text-muted);margin-top:2px;}',
      '.ul-badge{font-family:var(--font-mono);font-size:8.5px;letter-spacing:.05em;padding:2px 6px;',
      '  border-radius:3px;background:rgba(129,140,248,.18);color:#818cf8;display:inline-block;}',
      '.ul-empty{padding:20px 12px;font-size:11px;color:var(--text-muted);line-height:1.6;}',
      '.ul-x{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;line-height:1;}',
      '.ul-x:hover{color:#f87171;}'
    ].join('');
    document.head.appendChild(s);
  }

  var UI = { kind: 'fluid', msg: null };

  function formHtml() {
    var fs = FIELDS[UI.kind];
    return '<div class="ul-form">'
      + '<div class="ul-f"><label>KIND</label><select id="ul-kind">'
      + ['fluid', 'material', 'component'].map(function (k) {
        return '<option value="' + k + '"' + (UI.kind === k ? ' selected' : '') + '>'
          + k.toUpperCase() + '</option>';
      }).join('') + '</select></div>'
      + '<div class="ul-f"><label>NAME</label><input id="ul-name" placeholder="e.g. Reactor effluent"></div>'
      + '<div class="ul-f"><label>GRADE / QUALIFIER</label><input id="ul-grade" placeholder="optional"></div>'
      + '<div class="ul-f"><label>CONDITION</label><input id="ul-cond" placeholder="e.g. 80°C"></div>'
      + '<div class="ul-f"><label>SOURCE</label><input id="ul-src" placeholder="mill cert, datasheet…"></div>'
      + fs.map(function (f) {
        return '<div class="ul-f"><label>' + esc(f[1].toUpperCase()) + ' (' + esc(f[2]) + ')</label>'
          + '<input id="ul-p-' + f[0] + '" type="number" step="any" placeholder="optional"></div>';
      }).join('')
      + '<div class="ul-f" style="display:flex;align-items:flex-end;">'
      + '<button class="ul-btn on" data-ul="add" style="width:100%;padding:7px;">ADD RECORD</button></div>'
      + '</div>';
  }

  function html() {
    var list = all();
    return '<div id="aro-ul">'
      + '<div class="ul-h"><b>USER-DEFINED DATA &amp; PROJECT PACKAGE</b>'
      + '<div class="ul-sub">A project fluid, a grade off a mill certificate, a valve from a vendor '
      + 'quotation. Every record entered here is stamped USER VALUE with the engineer and the date, '
      + 'and reads AUTO-APPLY CAUTION wherever it appears — it sits beside the reference tables and '
      + 'is never mistaken for one.</div></div>'
      + '<div class="ul-bar">'
      + '<button class="ul-btn" data-ul="csv">EXPORT LIBRARY CSV</button>'
      + '<button class="ul-btn" data-ul="json">EXPORT PROJECT PACKAGE</button>'
      + '<button class="ul-btn" data-ul="import">IMPORT PACKAGE…</button>'
      + '<input type="file" id="ul-file" accept="application/json,.json" style="display:none;">'
      + '</div>'
      + formHtml()
      + (UI.msg ? '<div class="ul-msg ' + UI.msg.cls + '">' + UI.msg.html + '</div>' : '')
      + (list.length
        ? list.slice().reverse().map(function (r) {
          var fs = FIELDS[r.kind] || [];
          var props = Object.keys(r.props).map(function (k) {
            var f = null; fs.forEach(function (x) { if (x[0] === k) f = x; });
            return (f ? f[1] : k) + ' ' + r.props[k] + (f ? ' ' + f[2] : '');
          });
          return '<div class="ul-r"><div>'
            + '<div class="ul-n">' + esc(r.name) + (r.grade ? ' (' + esc(r.grade) + ')' : '')
            + ' <span class="ul-badge">USER VALUE</span></div>'
            + '<div class="ul-p">' + esc(props.join('  ·  ')) + '</div>'
            + '<div class="ul-meta">' + esc(r.kind.toUpperCase()) + ' · '
            + esc(r.condition || 'CONDITION NOT STATED') + ' · '
            + esc(r.source || 'no source stated') + ' · ' + esc(r.by) + ' · '
            + esc(new Date(r.at).toISOString().slice(0, 10))
            + (r.imported ? ' · IMPORTED' : '') + '</div></div>'
            + '<button class="ul-x" data-ul-del="' + esc(r.id) + '" title="Remove">&times;</button>'
            + '</div>';
        }).join('')
        : '<div class="ul-empty">No user records yet. Anything added here is exported with the '
          + 'project package and can be imported into another project.</div>')
      + '</div>';
  }

  function render(force) {
    var tab = document.getElementById('project-tab');
    if (!tab || !tab.offsetParent) return;
    css();
    var host = document.getElementById('aro-ul-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-ul-host';
      tab.appendChild(host);
    }
    var sig = UI.kind + '|' + all().length + '|' + (UI.msg ? UI.msg.html.length : 0);
    if (!force && host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig);
    try { host.innerHTML = html(); } catch (e) { host.innerHTML = ''; }
  }

  function readForm() {
    function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
    var rec = { kind: UI.kind, name: v('ul-name'), grade: v('ul-grade'),
      condition: v('ul-cond'), source: v('ul-src'), props: {} };
    (FIELDS[UI.kind] || []).forEach(function (f) {
      var x = document.getElementById('ul-p-' + f[0]);
      if (x && x.value !== '') rec.props[f[0]] = x.value;
    });
    return rec;
  }

  function showImport(report) {
    if (!report.ok) {
      UI.msg = { cls: 'err', html: '<b>Import refused.</b> ' + esc(report.error) };
      render(true); return;
    }
    var lines = [];
    lines.push('<b>' + report.newCount + ' new</b>, ' + report.dupCount + ' already held, '
      + report.badCount + ' rejected.');
    if (report.basis) lines.push('A design basis is included.');
    if (report.revisions) lines.push(report.revisions + ' revision(s) in the file are shown for '
      + 'reference and are not merged into this project’s history.');
    report.records.filter(function (r) { return !r.ok; }).slice(0, 6).forEach(function (r) {
      lines.push('<span style="color:#f87171;">REJECTED</span> ' + esc(r.name) + ' — '
        + esc(r.errors.join(' ')));
    });
    report.records.filter(function (r) { return r.ok && r.warnings.length; }).slice(0, 4)
      .forEach(function (r) {
        lines.push('<span style="color:#fbbf24;">CHECK</span> ' + esc(r.name) + ' — '
          + esc(r.warnings[0]));
      });
    lines.push('<div style="margin-top:8px;">'
      + '<button class="ul-btn on" data-ul="commit">IMPORT ' + report.newCount + ' RECORD'
      + (report.newCount === 1 ? '' : 'S') + '</button> '
      + (report.basis ? '<button class="ul-btn" data-ul="commit-basis">IMPORT WITH DESIGN BASIS</button> ' : '')
      + '<button class="ul-btn" data-ul="cancel">CANCEL</button></div>');
    PENDING = report;
    UI.msg = { cls: report.badCount ? 'warn' : 'ok', html: lines.join('<br>') };
    render(true);
  }
  var PENDING = null;

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'ul-kind') {
      UI.kind = e.target.value; UI.msg = null; render(true); return;
    }
    if (e.target && e.target.id === 'ul-file') {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { showImport(inspect(String(rd.result || ''))); };
      rd.onerror = function () {
        UI.msg = { cls: 'err', html: 'The file could not be read.' }; render(true);
      };
      rd.readAsText(f);
    }
  }, true);

  document.addEventListener('click', function (e) {
    var d = e.target && e.target.closest ? e.target.closest('[data-ul-del]') : null;
    if (d) { e.preventDefault(); remove(d.getAttribute('data-ul-del')); return; }
    var t = e.target && e.target.closest ? e.target.closest('[data-ul]') : null;
    if (!t) { setTimeout(function () { render(false); }, 80); return; }
    e.preventDefault();
    var a = t.getAttribute('data-ul');
    if (a === 'csv') { exportCsv(); return; }
    if (a === 'json') { exportJson(); return; }
    if (a === 'import') { var f = document.getElementById('ul-file'); if (f) f.click(); return; }
    if (a === 'cancel') { PENDING = null; UI.msg = null; render(true); return; }
    if (a === 'commit' || a === 'commit-basis') {
      if (!PENDING) return;
      var n = commit(PENDING, { basis: a === 'commit-basis' });
      UI.msg = { cls: 'ok', html: '<b>' + n + ' record(s) imported.</b> Each is stamped USER VALUE '
        + 'and can be removed individually.' };
      PENDING = null;
      render(true);
      return;
    }
    if (a === 'add') {
      var res = add(readForm());
      if (!res.ok) {
        UI.msg = { cls: 'err', html: '<b>Not added.</b><br>' + res.errors.map(esc).join('<br>') };
      } else {
        UI.msg = { cls: res.warnings.length ? 'warn' : 'ok',
          html: '<b>Added as USER VALUE.</b>'
            + (res.warnings.length ? '<br>' + res.warnings.map(esc).join('<br>') : '') };
        ['ul-name', 'ul-grade', 'ul-cond', 'ul-src'].forEach(function (id) {
          var x = document.getElementById(id); if (x) x.value = '';
        });
      }
      render(true);
    }
  }, true);

  window.AROUSERLIB = {
    FIELDS: FIELDS,
    validate: validate,
    all: all,
    add: add,
    remove: remove,
    exportCsv: exportCsv,
    exportJson: exportJson,
    projectPackage: projectPackage,
    inspect: inspect,
    commit: commit,
    render: function () { render(true); }
  };

  function boot() {
    var iv = setInterval(function () {
      var tab = document.getElementById('project-tab');
      if (tab && tab.offsetParent) { render(true); clearInterval(iv); }
    }, 700);
    setTimeout(function () { clearInterval(iv); }, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

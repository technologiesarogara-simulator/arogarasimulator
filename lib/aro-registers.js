/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — PROJECT REGISTERS  (window.AROREG)
   ---------------------------------------------------------------------------
   Phases 29–37. The project page held a design basis and nothing else, so the
   question "what is in this project?" had no answer anywhere in the
   application. These are the registers a process package is actually
   delivered with: equipment, lines, fluids, materials, valves, instruments,
   drawings and reports.

   THEY ARE DERIVED, NOT ENTERED. Every row is read from something that
   already exists — the calculation state machine, the published checks, the
   engineering library, the workbench flowsheet, the drawing registry. Nothing
   here is a second copy of the design that could drift away from it, and a
   register that has nothing to show says so rather than inventing a row.

   That constraint decides what a register can honestly report. A line list
   normally carries FROM and TO, and this one leaves those columns empty
   unless the workbench flowsheet supplies them, because a line-sizing
   calculation does not know where its line runs. Guessing would fill the
   column and empty the register of meaning.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function f(v, d) { return (typeof v === 'number' && isFinite(v)) ? v.toFixed(d == null ? 2 : d) : '—'; }
  function el(id) { return document.getElementById(id); }
  function val(id) { var e = el(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function selText(id) {
    var e = el(id);
    if (!e) return '';
    if (e.tagName === 'SELECT' && e.selectedIndex >= 0 && e.options[e.selectedIndex]) {
      return e.options[e.selectedIndex].text.trim();
    }
    return String(e.value == null ? '' : e.value).trim();
  }

  var ST = function () { return window.AROSTATE || null; };
  function stateOf(id) { var s = ST(); return s ? s.state(id) : 'unknown'; }
  function revOf(id) { var s = ST(); return s ? s.inputRev(id) : 0; }
  function atOf(id) { var s = ST(); return s ? s.at(id) : 0; }
  function tallyOf(id) {
    try { var s = window.AROENG.status(id); return s ? s.tally : null; } catch (e) { return null; }
  }
  function verdictOf(id) {
    var t = tallyOf(id);
    if (!t) return null;
    return t.fail ? 'FAIL' : (t.warn ? 'REVIEW' : (t.pass ? 'PASS' : null));
  }
  function when(ms) {
    if (!ms) return '—';
    var d = new Date(ms);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }

  /* ══ MODULE MAP ═════════════════════════════════════════════════════════ */
  var EQUIP = [
    { id: 'pump', tag: 'P-101', type: 'Centrifugal pump', module: 'Pump Hydraulics',
      service: function () { return selText('pump-fluid'); },
      material: function () { return ''; }, dwg: 'pump', d3: 'pump' },
    { id: 'sthe', tag: 'E-101', type: 'Shell & tube exchanger', module: 'Shell & Tube',
      service: function () { return selText('sthe-fluid-shell-select') || selText('sthe-fluid-tube-select'); },
      material: function () { return ''; }, dwg: 'sthe', d3: 'sthe' },
    { id: 'dphe', tag: 'E-102', type: 'Double pipe exchanger', module: 'Double Pipe',
      service: function () { return selText('dphe-fluid-hot-select'); },
      material: function () { return selText('dphe-mat-hot'); }, dwg: 'dphe', d3: 'dphe' },
    { id: 'phe', tag: 'E-103', type: 'Plate heat exchanger', module: 'Plate Exchanger',
      service: function () { return selText('phe-hf-name'); },
      material: function () { return selText('phe-mat'); }, dwg: 'phe', d3: 'phe' },
    { id: 'tank', tag: 'T-101', type: 'Storage tank', module: 'Storage Tank',
      service: function () { return ''; },
      material: function () { return selText('tk-mat'); }, dwg: 'tank', d3: 'tank' }
  ];

  var LINES = [
    { id: 'line-liquid', tag: 'L-101', service: 'Liquid', fluid: 'lq-fluid', prefix: 'lq' },
    { id: 'line-gas', tag: 'L-102', service: 'Gas', fluid: 'gs-fluid', prefix: 'gs' },
    { id: 'line-steam', tag: 'L-103', service: 'Steam', fluid: 'st-fluid', prefix: 'st' },
    { id: 'line-slurry', tag: 'L-104', service: 'Slurry', fluid: 'sl-fluid', prefix: 'sl' },
    { id: 'line-twophase', tag: 'L-105', service: 'Two-phase', fluid: '', prefix: 'tp2' }
  ];

  /* Only a module that has actually been run belongs in a register. A module
     nobody has opened is not "not calculated" — it is not part of the
     project, and listing it would fill an equipment register with equipment
     the project does not contain. */
  function engaged(id) {
    var s = stateOf(id);
    return s === 'CALCULATED' || s === 'OUTDATED' || s === 'ERROR' || revOf(id) > 0;
  }

  /* ══ REGISTERS ══════════════════════════════════════════════════════════ */
  function equipment() {
    return EQUIP.filter(function (e) { return engaged(e.id); }).map(function (e) {
      var vals = null;
      try { vals = window.AROENG.values(e.id); } catch (x) {}
      return {
        tag: e.tag, type: e.type, service: e.service() || '—',
        material: e.material() || '—', module: e.module,
        state: stateOf(e.id), verdict: verdictOf(e.id),
        rev: revOf(e.id), at: atOf(e.id),
        drawing: hasDrawing(e.dwg), model3d: has3D(e.d3),
        report: stateOf(e.id) === 'CALCULATED' || stateOf(e.id) === 'OUTDATED',
        moduleId: e.id
      };
    });
  }

  function lines() {
    return LINES.filter(function (l) { return engaged(l.id); }).map(function (l) {
      var vals = null;
      try { vals = window.AROENG.values(l.id); } catch (x) {}
      var v = vals || {};
      return {
        tag: l.tag, service: l.service,
        fluid: (l.fluid ? selText(l.fluid) : '') || '—',
        nps: v.nps != null ? String(v.nps) + '"' : '—',
        sch: v.sch != null ? String(v.sch) : '—',
        material: val(l.prefix + '-mat') || '—',
        pDes: v.P1 != null ? f(v.P1, 2) + ' bar' : '—',
        tDes: v.T != null ? f(v.T, 1) + ' °C' : '—',
        from: '', to: '',
        state: stateOf(l.id), verdict: verdictOf(l.id), rev: revOf(l.id), at: atOf(l.id),
        moduleId: l.id
      };
    });
  }

  function fluids() {
    var L = window.AROENGLIB;
    if (!L) return [];
    var out = [], seen = {};
    L.subjects('fluid').forEach(function (e) {
      var used = L.whereUsed(e.key, 'fluid');
      if (!used.length || seen[e.key]) return;
      seen[e.key] = 1;
      var rho = (e.props.rho || [])[0], mu = (e.props.mu || [])[0];
      var conds = {};
      Object.keys(e.props).forEach(function (p) {
        e.props[p].forEach(function (r) { if (r.condition) conds[r.condition] = 1; });
      });
      var cond = Object.keys(conds);
      out.push({
        id: 'F-' + String(out.length + 1).padStart(3, '0'),
        name: e.name, grades: e.grades.join(', ') || '—',
        condition: cond.length ? cond.join(' / ') : 'NOT STATED',
        rho: rho ? f(rho.si, 1) + ' kg/m³' : '—',
        mu: mu ? (mu.si * 1000).toFixed(3) + ' cP' : '—',
        status: rho ? rho.status : 'REFERENCE',
        used: used.map(function (u) { return u.module; }),
        source: rho ? rho.engSource : '—'
      });
    });
    return out;
  }

  function materials() {
    var L = window.AROENGLIB;
    if (!L) return [];
    var out = [];
    L.subjects('material').forEach(function (e) {
      var used = L.whereUsed(e.key, 'material');
      if (!used.length) return;
      var S = (e.props.S || [])[0], k = (e.props.k || [])[0];
      out.push({
        id: 'M-' + String(out.length + 1).padStart(3, '0'),
        grade: e.name,
        S: S ? (S.si / 1e6).toFixed(0) + ' MPa' : '—',
        k: k ? f(k.si, 1) + ' W/m·K' : '—',
        condition: (S && S.condition) || 'NOT STATED',
        status: S ? S.status : (k ? k.status : 'REFERENCE'),
        used: used.map(function (u) { return u.module; }),
        source: S ? S.engSource : (k ? k.engSource : '—')
      });
    });
    return out;
  }

  /* Valves and instruments come from the workbench flowsheet — the only place
     in the application where an individual valve or transmitter is placed and
     tagged. With no flowsheet there is nothing to list, and the register says
     that rather than manufacturing a tag list from the module inputs. */
  function wbNodes(pred) {
    var W = window.AROWB;
    if (!W || !W.nodes || !W.nodes.length) return [];
    return W.nodes.filter(pred);
  }
  function isValve(n) { return /valve|gate|globe|ball|butterfly|check|needle|psv|plug|knife|pinch|solenoid/i.test(n.t || ''); }
  function isInstrument(n) {
    return /gauge|transmitter|indicator|meter|switch|analy|thermowell|orifice|rotameter|sight|positioner/i.test(n.t || '');
  }
  function valves() {
    return wbNodes(isValve).map(function (n, i) {
      return { tag: n.tag || ('XV-' + String(101 + i)), type: prettyType(n.t),
        line: n.line || '—', size: n.nps ? n.nps + '"' : '—',
        cls: n.rating || '—', material: n.material || '—',
        ends: n.ends || '—', actuation: /control|solenoid|deluge/i.test(n.t) ? 'Actuated' : 'Manual' };
    });
  }
  function instruments() {
    return wbNodes(isInstrument).map(function (n, i) {
      return { tag: n.tag || ('PI-' + String(101 + i)), type: prettyType(n.t),
        service: n.service || '—', on: n.line || '—',
        range: n.range || '—', unit: n.unit || '—',
        signal: /transmitter|meter|analy/i.test(n.t || '') ? '4–20 mA' : 'Local' };
    });
  }
  function prettyType(t) {
    return String(t || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function hasDrawing(id) {
    try { return !!(window.ARODWG && window.ARODWG.has && window.ARODWG.has(id)); }
    catch (e) { return false; }
  }
  function has3D(id) {
    try {
      var P = window.ARO3DI && window.ARO3DI.panels ? window.ARO3DI.panels() : null;
      return !!(P && P[id] && P[id].asm);
    } catch (e) { return false; }
  }

  function drawings() {
    var out = [];
    EQUIP.concat(LINES.map(function (l) { return { id: l.id, tag: l.tag, dwg: l.id, d3: l.id, type: l.service + ' line' }; }))
      .forEach(function (e) {
        if (!engaged(e.id)) return;
        var st = stateOf(e.id);
        var status = st === 'CALCULATED' ? 'CURRENT' : (st === 'OUTDATED' ? 'SUPERSEDED' : 'NOT ISSUED');
        if (hasDrawing(e.dwg || e.id)) {
          out.push({ no: 'DWG-' + String(out.length + 1).padStart(3, '0'), type: '2D general arrangement',
            tag: e.tag, title: (e.type || '') + ' — general arrangement',
            rev: revOf(e.id), status: status, at: atOf(e.id) });
        }
        if (has3D(e.d3 || e.id)) {
          out.push({ no: 'DWG-' + String(out.length + 1).padStart(3, '0'), type: 'Piping isometric',
            tag: e.tag, title: (e.type || '') + ' — isometric from the 3D route',
            rev: revOf(e.id), status: status, at: atOf(e.id) });
        }
      });
    return out;
  }

  function reports() {
    var out = [];
    EQUIP.concat(LINES).forEach(function (e) {
      if (!engaged(e.id)) return;
      var st = stateOf(e.id);
      out.push({
        id: 'RPT-' + String(out.length + 1).padStart(3, '0'),
        module: e.module || (e.service + ' Line Sizing'),
        tag: e.tag, rev: revOf(e.id),
        calc: (function () { try { return window.AROENG.status(e.id).tally; } catch (x) { return null; } })(),
        at: atOf(e.id),
        status: st === 'CALCULATED' ? 'ISSUABLE' : (st === 'OUTDATED' ? 'RECALCULATION REQUIRED' : 'NOT CALCULATED')
      });
    });
    return out;
  }

  /* ══ UI ═════════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-reg-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-reg{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;}',
      '.rg-h{background:rgba(74,222,128,.08);border-bottom:1px solid var(--border-muted);padding:10px 12px;}',
      '.rg-h b{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#4ade80;}',
      '.rg-sub{font-size:10.5px;color:var(--text-muted);margin-top:3px;line-height:1.5;}',
      '.rg-tabs{display:flex;gap:5px;padding:9px 12px;border-bottom:1px solid var(--border-muted);flex-wrap:wrap;}',
      '.rg-tab{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.05em;padding:5px 9px;border-radius:3px;',
      '  border:1px solid var(--border-muted);background:transparent;color:var(--text-muted);cursor:pointer;}',
      '.rg-tab.on{background:#4ade80;border-color:#4ade80;color:#04180b;font-weight:800;}',
      '.rg-tab b{color:inherit;}',
      '.rg-wrap{overflow-x:auto;}',
      '.rg-t{width:100%;border-collapse:collapse;font-size:10.5px;min-width:640px;}',
      '.rg-t th{text-align:left;font-family:var(--font-mono);font-size:9px;letter-spacing:.07em;',
      '  color:var(--text-muted);padding:7px 10px;border-bottom:1px solid var(--border-muted);white-space:nowrap;}',
      '.rg-t td{padding:7px 10px;border-bottom:1px dashed var(--border-muted);vertical-align:top;}',
      '.rg-t tr:hover td{background:rgba(74,222,128,.05);}',
      '.rg-tag{font-family:var(--font-mono);font-weight:800;}',
      '.rg-b{font-family:var(--font-mono);font-size:8.5px;letter-spacing:.05em;padding:2px 6px;border-radius:3px;display:inline-block;}',
      '.rg-b.PASS,.rg-b.CURRENT,.rg-b.ISSUABLE,.rg-b.CALCULATED{background:rgba(74,222,128,.15);color:#4ade80;}',
      '.rg-b.REVIEW,.rg-b.SUPERSEDED,.rg-b.OUTDATED{background:rgba(251,191,36,.15);color:#fbbf24;}',
      '.rg-b.FAIL,.rg-b.ERROR{background:rgba(248,113,113,.15);color:#f87171;}',
      '.rg-b.NOTISSUED,.rg-b.NOT_CALCULATED,.rg-b.RECALCULATIONREQUIRED{background:rgba(148,163,184,.15);color:var(--text-muted);}',
      '.rg-dim{color:var(--text-muted);}',
      '.rg-empty{padding:20px 12px;font-size:11px;color:var(--text-muted);line-height:1.6;}'
    ].join('');
    document.head.appendChild(s);
  }

  function badge(t) {
    var cls = String(t || '—').replace(/[^A-Za-z_]/g, '');
    return '<span class="rg-b ' + cls + '">' + esc(t || '—') + '</span>';
  }

  function table(cols, rows, cells) {
    if (!rows.length) return null;
    return '<div class="rg-wrap"><table class="rg-t"><tr>'
      + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('')
      + '</tr>' + rows.map(function (r) {
        return '<tr>' + cells(r).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></div>';
  }

  var TAB = 'equipment';
  var VIEWS = {
    equipment: {
      label: 'EQUIPMENT', get: equipment,
      empty: 'No equipment yet. A module joins the register once it has been run — '
           + 'listing modules nobody has opened would fill this with equipment the project does not contain.',
      html: function (rows) {
        return table(['TAG', 'TYPE', 'SERVICE', 'MATERIAL', 'MODULE', 'STATUS', 'VERDICT', 'REV',
          'LAST CALCULATED', '2D', '3D'], rows, function (r) {
          return ['<span class="rg-tag">' + esc(r.tag) + '</span>', esc(r.type),
            esc(r.service), esc(r.material), esc(r.module),
            badge(r.state), r.verdict ? badge(r.verdict) : '<span class="rg-dim">—</span>',
            String(r.rev), '<span class="rg-dim">' + esc(when(r.at)) + '</span>',
            r.drawing ? '✓' : '<span class="rg-dim">—</span>',
            r.model3d ? '✓' : '<span class="rg-dim">—</span>'];
        });
      }
    },
    lines: {
      label: 'LINE LIST', get: lines,
      empty: 'No lines yet. Run a line-sizing service and it is listed here.',
      html: function (rows) {
        return table(['LINE TAG', 'SERVICE', 'FROM', 'TO', 'FLUID', 'NPS', 'SCH', 'MATERIAL',
          'DESIGN P', 'DESIGN T', 'STATUS', 'REV'], rows, function (r) {
          return ['<span class="rg-tag">' + esc(r.tag) + '</span>', esc(r.service),
            '<span class="rg-dim">—</span>', '<span class="rg-dim">—</span>',
            esc(r.fluid), esc(r.nps), esc(r.sch), esc(r.material),
            esc(r.pDes), esc(r.tDes), badge(r.state), String(r.rev)];
        }) + '<div class="rg-empty">FROM and TO are left empty on purpose. A line-sizing '
          + 'calculation knows the duty and the route length, not where the line runs — those '
          + 'columns fill from the ARO Workbench flowsheet when one connects the line.</div>';
      }
    },
    fluids: {
      label: 'FLUIDS', get: fluids,
      empty: 'No fluid is currently selected in any module. The fluid register lists what the '
           + 'project is actually using, read from the module selections.',
      html: function (rows) {
        return table(['ID', 'NAME', 'GRADE', 'CONDITION', 'DENSITY', 'VISCOSITY', 'STATUS',
          'USED BY', 'SOURCE'], rows, function (r) {
          return ['<span class="rg-tag">' + esc(r.id) + '</span>', esc(r.name), esc(r.grades),
            esc(r.condition), esc(r.rho), esc(r.mu), badge(r.status),
            esc(r.used.join(' · ')), '<span class="rg-dim">' + esc(r.source) + '</span>'];
        });
      }
    },
    materials: {
      label: 'MATERIALS', get: materials,
      empty: 'No material is currently selected in any module.',
      html: function (rows) {
        return table(['ID', 'GRADE', 'ALLOWABLE STRESS', 'CONDUCTIVITY', 'CONDITION', 'STATUS',
          'USED BY', 'SOURCE'], rows, function (r) {
          return ['<span class="rg-tag">' + esc(r.id) + '</span>', esc(r.grade), esc(r.S), esc(r.k),
            esc(r.condition), badge(r.status), esc(r.used.join(' · ')),
            '<span class="rg-dim">' + esc(r.source) + '</span>'];
        });
      }
    },
    valves: {
      label: 'VALVES', get: valves,
      empty: 'No valves placed. Valves are listed from the ARO Workbench flowsheet, which is the '
           + 'only place an individual valve is placed and tagged — a module input describes a line, not a valve.',
      html: function (rows) {
        return table(['TAG', 'TYPE', 'LINE', 'SIZE', 'CLASS', 'MATERIAL', 'END CONNECTION',
          'ACTUATION'], rows, function (r) {
          return ['<span class="rg-tag">' + esc(r.tag) + '</span>', esc(r.type), esc(r.line),
            esc(r.size), esc(r.cls), esc(r.material), esc(r.ends), esc(r.actuation)];
        });
      }
    },
    instruments: {
      label: 'INSTRUMENTS', get: instruments,
      empty: 'No instruments placed. The instrument index is built from the ARO Workbench flowsheet.',
      html: function (rows) {
        return table(['TAG', 'TYPE', 'SERVICE', 'LINE / EQUIPMENT', 'RANGE', 'UNIT', 'SIGNAL'],
          rows, function (r) {
            return ['<span class="rg-tag">' + esc(r.tag) + '</span>', esc(r.type), esc(r.service),
              esc(r.on), esc(r.range), esc(r.unit), esc(r.signal)];
          });
      }
    },
    drawings: {
      label: 'DRAWINGS', get: drawings,
      empty: 'No drawings yet. A drawing is registered once its module has been calculated.',
      html: function (rows) {
        return table(['DRAWING NO', 'TYPE', 'TAG', 'TITLE', 'REV', 'STATUS', 'LAST UPDATED'],
          rows, function (r) {
            return ['<span class="rg-tag">' + esc(r.no) + '</span>', esc(r.type), esc(r.tag),
              esc(r.title), String(r.rev), badge(r.status),
              '<span class="rg-dim">' + esc(when(r.at)) + '</span>'];
          });
      }
    },
    reports: {
      label: 'REPORTS', get: reports,
      empty: 'No reports yet.',
      html: function (rows) {
        return table(['REPORT ID', 'MODULE', 'TAG', 'REV', 'CHECKS', 'DATE', 'STATUS'],
          rows, function (r) {
            return ['<span class="rg-tag">' + esc(r.id) + '</span>', esc(r.module), esc(r.tag),
              String(r.rev),
              r.calc ? (r.calc.pass + ' pass / ' + r.calc.warn + ' review / ' + r.calc.fail + ' fail')
                : '<span class="rg-dim">—</span>',
              '<span class="rg-dim">' + esc(when(r.at)) + '</span>',
              badge(r.status)];
          });
      }
    }
  };

  function html() {
    var order = ['equipment', 'lines', 'fluids', 'materials', 'valves', 'instruments', 'drawings', 'reports'];
    var counts = {};
    order.forEach(function (k) { try { counts[k] = VIEWS[k].get().length; } catch (e) { counts[k] = 0; } });
    var v = VIEWS[TAB];
    var rows = [];
    try { rows = v.get(); } catch (e) { rows = []; }
    var body = rows.length ? v.html(rows) : '<div class="rg-empty">' + esc(v.empty) + '</div>';
    return '<div id="aro-reg">'
      + '<div class="rg-h"><b>PROJECT REGISTERS</b>'
      + '<div class="rg-sub">Equipment, lines, fluids, materials, valves, instruments, drawings and '
      + 'reports — every row derived from the live design rather than typed a second time, so a '
      + 'register cannot drift away from what was actually calculated.</div></div>'
      + '<div class="rg-tabs">'
      + order.map(function (k) {
        return '<button class="rg-tab' + (TAB === k ? ' on' : '') + '" data-rg-tab="' + k + '">'
          + '<b>' + counts[k] + '</b> ' + esc(VIEWS[k].label) + '</button>';
      }).join('')
      + '</div>' + body + '</div>';
  }

  function render(force) {
    var tab = document.getElementById('project-tab');
    if (!tab || !tab.offsetParent) return;
    css();
    var host = document.getElementById('aro-reg-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-reg-host';
      tab.appendChild(host);
    }
    var sig = TAB + '|' + (ST() ? ST().modules().map(function (m) {
      return stateOf(m) + revOf(m);
    }).join(',') : '');
    if (!force && host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig);
    try { host.innerHTML = html(); } catch (e) { host.innerHTML = ''; }
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-rg-tab]') : null;
    if (t) {
      e.preventDefault();
      TAB = t.getAttribute('data-rg-tab');
      render(true);
      return;
    }
    /* Returning to the project tab has to redraw. A state change that lands
       while this panel is hidden returns before it renders, so without this
       the registers showed the counts they had when the tab was last open —
       an empty equipment register beside a pump that had just been sized.

       The redraw is deferred because the click that switches tabs arrives
       while the old tab is still the visible one: rendering synchronously
       here bails on the visibility test and nothing is redrawn. The
       signature check makes the common case free either way. */
    render(false);
    setTimeout(function () { render(false); }, 80);
  }, true);

  window.AROREG = {
    equipment: equipment, lines: lines, fluids: fluids, materials: materials,
    valves: valves, instruments: instruments, drawings: drawings, reports: reports,
    render: function () { render(true); }
  };

  function boot() {
    var iv = setInterval(function () {
      var tab = document.getElementById('project-tab');
      if (tab && tab.offsetParent) { render(true); clearInterval(iv); }
    }, 700);
    setTimeout(function () { clearInterval(iv); }, 30000);
    if (window.AROSTATE && window.AROSTATE.onChange) {
      window.AROSTATE.onChange(function () { render(true); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ═══════════════════════════════════════════════════════════════════════
   AROGARA PROJECT

   The suite could size a pump, a line, an exchanger and a tank, and it could
   draw a P&ID — but those were five unrelated pieces of work. Nothing said
   that the P-101 on the drawing and the pump in the sizing module were the
   same machine, nothing counted how much of the design was done, and nothing
   could issue the set as one document.

   This is the layer that ties them together. A project holds tagged objects:

       AROGARA PROJECT
         ├── Equipment   P-101   E-101   T-101
         ├── Lines       L-101   L-102
         ├── P&ID        (ARO Workbench)
         ├── Design Review
         └── Project Report

   Each object names the module that sizes it. Opening the object opens that
   module with the project and the tag already loaded, and the result comes
   back to the object as a status. There is no second calculation engine
   here and no duplicated maths: the modules do exactly what they did
   before, and this layer records what they produced against a tag.

   Working outside a project is untouched. Open Pump Sizing directly and it
   behaves as it always has; the project context simply is not there.

   The module register at the bottom is the extension point. A future
   compressor, control valve or column module is one entry — a tag prefix,
   the tab it lives on, and how to seed it — not a rewrite.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS = 'aro_project_v2';
  var LS_LIST = 'aro_project_list_v2';

  /* ── The module register ──────────────────────────────────────────────
     kind      equipment or line — decides which list an object joins
     tagPrefix the default tag series (P-101, E-101, T-101, L-101)
     seed      how a tag and its process data reach the module's own fields.
               Everything crosses in SI through setInputFromSI, so a project
               in m³/h opens correctly in a workspace displaying US units. */
  var REG = {
    pump: {
      kind: 'equipment', label: 'Pump Hydraulics', type: 'Centrifugal Pump',
      tagPrefix: 'P', tab: 'pump-tab', state: 'pump',
      inputSel: '#pump-form input, #pump-form select, #pump-tab input, #pump-tab select',
      seed: function (o) {
        setText('pump-tag', o.tag);
        setText('pump-service', o.service);
        setFluid('pump-fluid', o.fluid);
        if (isNum(o.flow)) setSI('pump-vol-flow-lhr', o.flow * 1000, 0);
        if (isNum(o.temp)) setSI('pump-temp-op', o.temp, 1);
        if (isNum(o.press)) setSI('pump-vessel-press-g', o.press, 4);
      }
    },
    sthe: {
      kind: 'equipment', label: 'Shell & Tube Exchanger', type: 'Shell & Tube Heat Exchanger',
      tagPrefix: 'E', tab: 'sthe-tab', state: 'sthe',
      inputSel: '#sthe-form input, #sthe-form select',
      seed: function (o) {
        setFluid('sthe-fluid-shell-select', o.fluid);
        if (isNum(o.temp)) setSI('sthe-tin-shell', o.temp, 1);
        if (isNum(o.press)) setSI('sthe-press-shell', o.press, 3);
      }
    },
    dphe: {
      kind: 'equipment', label: 'Double Pipe Exchanger', type: 'Double Pipe Heat Exchanger',
      tagPrefix: 'E', tab: 'sthe-tab', state: 'dphe',
      inputSel: '#dphe-form input, #dphe-form select',
      seed: function (o) { if (isNum(o.temp)) setSI('dphe-tin-hot', o.temp, 1); }
    },
    phe: {
      kind: 'equipment', label: 'Plate Heat Exchanger', type: 'Plate & Frame Heat Exchanger',
      tagPrefix: 'E', tab: 'sthe-tab', state: 'phe',
      inputSel: '#phe-sub [id^="phe-"]',
      seed: function (o) { if (isNum(o.temp)) setSI('phe-hf-tin', o.temp, 1); }
    },
    tank: {
      kind: 'equipment', label: 'Tank Design', type: 'Storage Tank',
      tagPrefix: 'T', tab: 'tank-tab', state: 'tank',
      inputSel: '#tank-tab input, #tank-tab select',
      seed: function (o) {
        setText('tk-tag', o.tag);
        setText('tk-service', o.service);
        setFluid('tk-fluid', o.fluid);
        if (isNum(o.temp)) setSI('tk-tdes', o.temp, 1);
      }
    },
    'line-liquid': {
      kind: 'line', label: 'Liquid Line Sizing', type: 'Process Line — Liquid',
      tagPrefix: 'L', tab: 'line-tab', state: 'line-liquid',
      inputSel: '#line-liquid-content input, #line-liquid-content select',
      seed: function (o) { seedLine('lq', o); }
    },
    'line-gas': {
      kind: 'line', label: 'Gas Line Sizing', type: 'Process Line — Gas',
      tagPrefix: 'L', tab: 'line-tab', state: 'line-gas',
      inputSel: '#line-gas-content input, #line-gas-content select',
      seed: function (o) { seedLine('gs', o); }
    },
    'line-steam': {
      kind: 'line', label: 'Steam Line Sizing', type: 'Process Line — Steam',
      tagPrefix: 'L', tab: 'line-tab', state: 'line-steam',
      inputSel: '#line-steam-content input, #line-steam-content select',
      seed: function (o) { seedLine('st', o); }
    },
    'line-slurry': {
      kind: 'line', label: 'Slurry Line Sizing', type: 'Process Line — Slurry',
      tagPrefix: 'L', tab: 'line-tab', state: 'line-slurry',
      inputSel: '#line-slurry-content input, #line-slurry-content select',
      seed: function (o) { seedLine('sl', o); }
    },
    'line-twophase': {
      kind: 'line', label: 'Two-Phase Line Sizing', type: 'Process Line — Two-Phase',
      tagPrefix: 'L', tab: 'line-tab', state: 'line-twophase',
      inputSel: '#line-twophase-content input, #line-twophase-content select',
      seed: function (o) { seedLine('tp2', o); }
    }
  };

  function seedLine(p, o) {
    setText(p + '-lineno', o.tag);
    setText(p + '-svcdesc', o.service);
    setText(p + '-from', o.from);
    setText(p + '-to', o.to);
    setFluid(p + '-fluid', o.fluid);
    if (isNum(o.flow)) setSI(p + '-q', o.flow, 3);
    if (isNum(o.temp)) setSI(p + '-tnorm', o.temp, 1);
    if (isNum(o.press)) setSI(p + '-pup', o.press, 3);
  }

  /* ── helpers ─────────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function isNum(v) { return v != null && v !== '' && isFinite(parseFloat(v)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function nowISO() { return new Date().toISOString(); }
  function stamp(iso) { return iso ? String(iso).slice(0, 16).replace('T', ' ') : '—'; }
  function uid(p) { return (p || 'o') + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  function setText(id, v) {
    var e = $(id);
    if (!e || v == null || v === '') return false;
    e.value = String(v);
    e.setAttribute('data-aro-touched', '1');
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function setSI(id, si, dp) {
    var e = $(id);
    if (!e || !isFinite(si)) return false;
    if (typeof window.setInputFromSI === 'function') window.setInputFromSI(id, si, dp);
    else e.value = String(si);
    e.setAttribute('data-aro-touched', '1');
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function setFluid(id, name) {
    var e = $(id);
    if (!e || !name) return false;
    var want = String(name).toLowerCase().trim();
    for (var i = 0; i < e.options.length; i++) {
      if ((e.options[i].text || '').toLowerCase().trim() === want) {
        e.selectedIndex = i;
        e.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  /* ── Full input capture / restore ─────────────────────────────────────
     seed() above writes only the four or five fields a project object
     always carries (tag, service, fluid, flow, temp, press) — the rest of
     a module's design is left at whatever the module's own defaults are.
     That is enough to start a duty from the P&ID, but it means reopening a
     tagged design after it has actually been sized loses everything the
     engineer typed beyond those few fields — the pipe schedule, the
     geometry, the material, every override. This walks every real input
     under the module's own scope (never a computed/readonly field feeding
     back its own output) and captures it as one id->value map, so a design
     that has been run once comes back exactly as it was, not just tagged. */
  function snapshotInputs(moduleId) {
    var r = REG[moduleId];
    if (!r || !r.inputSel) return null;
    var els;
    try { els = document.querySelectorAll(r.inputSel); } catch (e) { return null; }
    var out = {};
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (!e.id) continue;
      var tag = e.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') continue;
      if (e.type === 'hidden' || e.type === 'button' || e.type === 'submit') continue;
      if (e.readOnly || e.disabled) continue;
      if (/^aro-/.test(e.id)) continue;
      out[e.id] = (e.type === 'checkbox' || e.type === 'radio') ? (e.checked ? 1 : 0) : e.value;
    }
    return out;
  }
  function restoreInputs(map) {
    if (!map) return 0;
    var n = 0;
    for (var id in map) {
      var e = $(id);
      if (!e) continue;
      try {
        if (e.type === 'checkbox' || e.type === 'radio') e.checked = !!map[id];
        else e.value = map[id];
        e.dispatchEvent(new Event('input', { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
        n++;
      } catch (er) {}
    }
    return n;
  }

  /* ── The project record ───────────────────────────────────────────── */
  function blank() {
    return {
      id: uid('prj'), projectName: '', client: '', projectNumber: '', location: '',
      engineer: '', company: '', description: '', revision: '0',
      date: nowISO().slice(0, 10), createdAt: nowISO(), modifiedAt: nowISO(),
      equipment: [], lines: []
    };
  }
  var P = null;                 // the open project, or null
  var CTX = null;               // { objId, tag, service, module } while a design is open

  function load() {
    try {
      var raw = localStorage.getItem(LS);
      if (!raw) return null;
      var o = JSON.parse(raw);
      o.equipment = o.equipment || [];
      o.lines = o.lines || [];
      return o;
    } catch (e) { return null; }
  }
  function save() {
    if (!P) return;
    /* The untitled workspace is a stand-in, not a project. Storing it would
       put a nameless entry in the archive that nobody asked for. */
    if (P.transient && !P.projectName) {
      readForm(P);
      if (!P.projectName) {
        alert('Give the project a name first — the NEW PROJECT fields are at the foot of this page.');
        return;
      }
    }
    delete P.transient;
    P.modifiedAt = nowISO();
    try {
      localStorage.setItem(LS, JSON.stringify(P));
      var list = archive();
      list[P.id] = { id: P.id, projectName: P.projectName, projectNumber: P.projectNumber,
                     client: P.client, revision: P.revision, modifiedAt: P.modifiedAt };
      localStorage.setItem(LS_LIST, JSON.stringify(list));
      localStorage.setItem(LS + ':' + P.id, JSON.stringify(P));
      dirty = false;
      render();
    } catch (e) {
      alert('The project could not be saved — browser storage is full or blocked.');
    }
  }
  function archive() {
    try { return JSON.parse(localStorage.getItem(LS_LIST) || '{}'); } catch (e) { return {}; }
  }
  var dirty = false;
  function touch() { dirty = true; render(); }

  function objects() { return (P ? P.equipment.concat(P.lines) : []); }
  function byId(id) {
    var a = objects();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function nextTag(moduleId) {
    var r = REG[moduleId];
    if (!r) return 'X-101';
    var n = 100, used = objects();
    for (var i = 0; i < used.length; i++) {
      var m = /^([A-Z]+)-(\d+)/.exec(used[i].tag || '');
      if (m && m[1] === r.tagPrefix) n = Math.max(n, parseInt(m[2], 10));
    }
    return r.tagPrefix + '-' + (n + 1);
  }

  /* ── Status ──────────────────────────────────────────────────────────
     An object's status is whatever its module last reported for it. It is
     recorded when a calculation completes while that object is the open
     context — never guessed, and never inherited from a different tag. */
  var STATUS = {
    pass:  { icon: '&#10003;', label: 'PASS',           cls: 'ok' },
    warn:  { icon: '&#9888;',  label: 'REVIEW',         cls: 'warn' },
    fail:  { icon: '&#10007;', label: 'FAIL',           cls: 'fail' },
    none:  { icon: '&mdash;',  label: 'NOT CALCULATED', cls: 'none' },
    stale: { icon: '&#9888;',  label: 'OUTDATED',       cls: 'warn' }
  };
  function statusOf(o) { return STATUS[o.status] || STATUS.none; }

  function captureResult(moduleId) {
    if (!P || !CTX || CTX.module !== moduleId) return;
    /* The same rule as the panel: no result, no verdict. A module publishes
       whenever it renders, including the recalculation triggered by seeding
       this object's own tag and duty into its fields. Recording that as the
       object's status would stamp P-101 FAIL for the crime of being opened. */
    if (window.AROSTATE && !window.AROSTATE.isCalculated(moduleId)) return;
    var o = byId(CTX.objId);
    if (!o) return;
    var s = window.AROENG ? window.AROENG.status(moduleId) : null;
    var t = s ? s.tally : null;
    o.status = !t ? 'none' : (t.fail ? 'fail' : (t.warn ? 'warn' : (t.pass ? 'pass' : 'none')));
    o.pass = t ? t.pass : 0;
    o.warn = t ? (t.warn || 0) : 0;
    o.fail = t ? (t.fail || 0) : 0;
    o.lastCalculated = nowISO();
    o.revision = o.revision || '0';
    o.engine = window.AROENG ? window.AROENG.version : '';
    /* The result object and the full input set the module actually ran
       against — not just the four fields seed() writes — so reopening this
       tag later restores the real design, not a re-tagged default one. */
    o.results = window.AROENG && window.AROENG.values ? window.AROENG.values(moduleId) : null;
    o.inputs = snapshotInputs(moduleId);
    save();
  }

  /* ── Opening an object ────────────────────────────────────────────── */
  function open(objId) {
    var o = byId(objId);
    if (!o || !P) return;
    var r = REG[o.module];
    if (!r) return;
    CTX = { objId: o.id, tag: o.tag, service: o.service, module: o.module };
    var btn = document.querySelector('.nav-tab[data-tab="' + r.tab + '"]');
    if (btn) btn.click();
    setTimeout(function () {
      try { r.seed(o); } catch (e) {}
      /* A full input snapshot — taken the last time this tag was actually
         calculated — is the complete design; the light seed() above only
         covers the handful of fields a brand-new or Workbench-adopted
         object carries. Where a snapshot exists it wins, restoring every
         field the engineer set, not just tag/fluid/flow/temp/press. */
      try { if (o.inputs) restoreInputs(o.inputs); } catch (e) {}
      contextStrip();
      if (window.AROENG && window.AROENG.refresh) window.AROENG.refresh();
      if (window.AROENG && window.AROENG.toast) {
        window.AROENG.toast(o.tag + ' — ' + (o.service || r.label)
          + ' opened in ' + r.label + '. Project and tag are loaded; enter the duty and run.');
      }
    }, 320);
  }
  function closeContext() {
    CTX = null;
    var s = document.getElementById('aro-ctx');
    if (s) s.remove();
  }

  /* The context strip tells the engineer, on the module screen, which
     project object they are working on. Without it a tagged design and a
     scratch calculation look identical. */
  function contextStrip() {
    var old = document.getElementById('aro-ctx');
    if (old) old.remove();
    if (!P || !CTX) return;
    var o = byId(CTX.objId);
    if (!o) return;
    var r = REG[o.module];
    var tab = $(r.tab);
    if (!tab) return;
    var st = statusOf(o);
    var d = document.createElement('div');
    d.id = 'aro-ctx';
    d.className = 'aro-ctx';
    d.innerHTML = '<span class="aro-ctx-k">PROJECT</span><b>' + esc(P.projectName || 'UNTITLED') + '</b>'
      + '<span class="aro-ctx-sep"></span>'
      + '<span class="aro-ctx-k">TAG</span><b class="aro-ctx-tag">' + esc(o.tag) + '</b>'
      + (o.service ? '<span class="aro-ctx-sep"></span><span class="aro-ctx-k">SERVICE</span><b>' + esc(o.service) + '</b>' : '')
      + '<span class="aro-ctx-sep"></span>'
      + '<span class="aro-ctx-k">STATUS</span><b class="aro-st aro-st-' + st.cls + '">' + st.icon + ' ' + st.label + '</b>'
      + '<span style="flex:1"></span>'
      + '<button class="aro-pj-btn" data-pj="back">&#8592; BACK TO PROJECT</button>'
      + '<button class="aro-pj-btn" data-pj="detach" title="Work on this module outside the project">DETACH</button>';
    tab.insertBefore(d, tab.firstChild);
  }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = [
    '.aro-pj{padding:16px 18px;font-family:var(--font-mono);color:var(--text-main);max-width:1500px;margin:0 auto;}',
    '.aro-pj h2{font-size:15px;letter-spacing:.10em;color:var(--text-header);margin:0 0 3px;font-weight:800;}',
    '.aro-pj h3{font-size:10px;letter-spacing:.14em;color:var(--color-saffron);margin:22px 0 9px;',
    '  font-weight:800;border-bottom:1px solid var(--border-muted);padding-bottom:6px;}',
    '.aro-pj-sub{font-size:11px;color:var(--text-muted);margin-bottom:4px;}',
    '.aro-pj-btn{background:transparent;border:1px solid var(--border-muted);color:var(--text-main);',
    '  font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.06em;',
    '  padding:6px 11px;border-radius:3px;cursor:pointer;}',
    '.aro-pj-btn:hover{border-color:var(--color-saffron);color:var(--color-saffron);}',
    '.aro-pj-btn.pri{border-color:var(--color-saffron);color:var(--color-saffron);}',
    '.aro-pj-bar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px;}',
    '.aro-pj-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px 16px;}',
    '.aro-pj-kv label{display:block;font-size:9px;letter-spacing:.09em;color:var(--text-muted);margin-bottom:3px;}',
    '.aro-pj-kv input,.aro-pj-kv textarea{width:100%;background:var(--bg-input);color:var(--text-header);',
    '  border:1px solid var(--border-muted);border-radius:3px;padding:6px 8px;',
    '  font-family:var(--font-mono);font-size:11px;}',
    '.aro-pj-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:6px;}',
    '.aro-pj-stat{border:1px solid var(--border-muted);border-radius:4px;padding:11px 13px;}',
    '.aro-pj-stat b{display:block;font-size:22px;line-height:1.15;color:var(--text-header);}',
    '.aro-pj-stat span{font-size:9px;letter-spacing:.10em;color:var(--text-muted);}',
    '.aro-st{font-weight:800;letter-spacing:.05em;}',
    '.aro-st-ok{color:var(--color-ok,#16835b);}',
    '.aro-st-warn{color:var(--color-warn,#b7791f);}',
    '.aro-st-fail{color:var(--color-fail,#c63d3d);}',
    '.aro-st-none{color:var(--text-muted);}',
    '.aro-pj-tbl{width:100%;border-collapse:collapse;font-size:11px;}',
    '.aro-pj-tbl th{text-align:left;padding:6px 8px;border:1px solid var(--border-muted);',
    '  font-size:9px;letter-spacing:.08em;color:var(--text-muted);font-weight:700;white-space:nowrap;}',
    '.aro-pj-tbl td{padding:6px 8px;border:1px solid var(--border-muted);vertical-align:middle;}',
    '.aro-pj-tbl tr[data-open]{cursor:pointer;}',
    '.aro-pj-tbl tr[data-open]:hover td{background:rgba(217,107,22,0.08);}',
    '.aro-pj-tag{font-weight:800;color:var(--text-header);letter-spacing:.04em;}',
    '.aro-pj-empty{border:1px dashed var(--border-muted);border-radius:5px;padding:22px;',
    '  text-align:center;color:var(--text-muted);font-size:11px;line-height:1.7;}',
    '.aro-pj-prog{height:8px;border-radius:4px;background:var(--border-muted);overflow:hidden;margin:8px 0 4px;}',
    '.aro-pj-prog i{display:block;height:100%;background:var(--color-saffron);}',
    '.aro-pj-rev{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--text-muted);}',
    /* the context strip on a module screen */
    '.aro-ctx{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:7px 14px;',
    '  border-bottom:1px solid var(--border-muted);background:var(--bg-panel);',
    '  font-family:var(--font-mono);font-size:10px;color:var(--text-main);}',
    '.aro-ctx b{color:var(--text-header);font-weight:800;}',
    '.aro-ctx-k{font-size:9px;letter-spacing:.10em;color:var(--text-muted);font-weight:700;}',
    '.aro-ctx-tag{color:var(--color-saffron) !important;letter-spacing:.06em;}',
    '.aro-ctx-sep{width:1px;height:14px;background:var(--border-muted);}',
    '.aro-pj-note{border-left:3px solid var(--color-saffron);padding:8px 12px;margin:10px 0;',
    '  font-size:10px;color:var(--text-muted);line-height:1.65;}'
  ].join('');

  function injectCss() {
    if ($('aro-project-css')) return;
    var s = document.createElement('style');
    s.id = 'aro-project-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── Rendering ────────────────────────────────────────────────────── */
  /* ONE PAGE, FOR EVERY ENGINEER.
     This used to render two entirely different screens: engineers with a
     saved project got the workspace — status, equipment, lines — and
     engineers without one got a bare NEW PROJECT form. Two people at the same
     company comparing screens saw different applications, and the second had
     no way of telling that the first screen even existed.

     There is now one screen. Where no project has been created, an untitled
     working project stands in so the workspace is present from the first
     visit, and the create/open block moves to the foot of the same page. The
     stand-in is held in memory only and is never written to storage until the
     engineer presses SAVE — an empty project appearing in the archive because
     somebody opened a tab would be its own kind of wrong. */
  function ensureWorkspace() {
    if (P) return;
    P = blank();
    P.transient = true;
  }

  function render() {
    var host = $('project-tab');
    if (!host) return;
    ensureWorkspace();
    host.innerHTML = projectHtml();
    contextStrip();
  }

  /* NEW PROJECT and SAVED PROJECTS, at the foot of the workspace. This is
     what used to be the whole of the other screen. */
  function projectsBlock() {
    var list = archive(), keys = Object.keys(list).sort(function (a, b) {
      return String(list[b].modifiedAt || '').localeCompare(String(list[a].modifiedAt || ''));
    });
    var h = '<h3>' + (P && P.transient ? 'NEW PROJECT' : 'START ANOTHER PROJECT') + '</h3>'
      + formHtml(P && P.transient ? P : blank(), true)
      + '<div class="aro-pj-bar"><button class="aro-pj-btn pri" data-pj="create">CREATE PROJECT</button></div>';
    h += '<h3>SAVED PROJECTS</h3>';
    if (!keys.length) {
      h += '<div class="aro-pj-empty">No projects saved in this browser yet. Projects are stored in '
        + 'this browser only &mdash; use EXPORT PROJECT to take one elsewhere.</div>';
    } else {
      h += '<table class="aro-pj-tbl"><tr><th>PROJECT</th><th>NUMBER</th><th>CLIENT</th>'
        + '<th>REV</th><th>LAST SAVED</th><th></th></tr>'
        + keys.map(function (k) {
            var r = list[k];
            return '<tr data-openprj="' + esc(k) + '"><td class="aro-pj-tag">' + esc(r.projectName || 'UNTITLED')
              + '</td><td>' + esc(r.projectNumber || '—') + '</td><td>' + esc(r.client || '—')
              + '</td><td>' + esc(r.revision || '0') + '</td><td>' + esc(stamp(r.modifiedAt))
              + '</td><td><button class="aro-pj-btn" data-openprj="' + esc(k) + '">OPEN</button>'
              + '<button class="aro-pj-btn" data-delprj="' + esc(k) + '" style="margin-left:6px;">DELETE</button></td></tr>';
          }).join('') + '</table>';
    }
    return h;
  }

  function welcomeHtml() {
    var list = archive(), keys = Object.keys(list).sort(function (a, b) {
      return String(list[b].modifiedAt || '').localeCompare(String(list[a].modifiedAt || ''));
    });
    var h = '<div class="aro-pj"><h2>AROGARA PROJECT</h2>'
      + '<div class="aro-pj-sub">Digital Engineering Design Platform &mdash; project workspace</div>'
      + '<div class="aro-pj-note">A project holds tagged equipment and lines, the P&amp;ID that shows '
      + 'them, and the design each one carries. Every module still works on its own; a project simply '
      + 'gives the work a tag, a revision and somewhere to live.</div>'
      + '<h3>NEW PROJECT</h3>' + formHtml(blank(), true)
      + '<div class="aro-pj-bar"><button class="aro-pj-btn pri" data-pj="create">CREATE PROJECT</button></div>';
    h += '<h3>SAVED PROJECTS</h3>';
    if (!keys.length) {
      h += '<div class="aro-pj-empty">No projects saved in this browser yet.</div>';
    } else {
      h += '<table class="aro-pj-tbl"><tr><th>PROJECT</th><th>NUMBER</th><th>CLIENT</th>'
        + '<th>REV</th><th>LAST SAVED</th><th></th></tr>'
        + keys.map(function (k) {
            var r = list[k];
            return '<tr data-openprj="' + esc(k) + '"><td class="aro-pj-tag">' + esc(r.projectName || 'UNTITLED')
              + '</td><td>' + esc(r.projectNumber || '—') + '</td><td>' + esc(r.client || '—')
              + '</td><td>' + esc(r.revision || '0') + '</td><td>' + esc(stamp(r.modifiedAt))
              + '</td><td><button class="aro-pj-btn" data-openprj="' + esc(k) + '">OPEN</button>'
              + '<button class="aro-pj-btn" data-delprj="' + esc(k) + '" style="margin-left:6px;">DELETE</button></td></tr>';
          }).join('') + '</table>';
    }
    return h + '</div>';
  }

  function field(k, label, val, wide) {
    /* The project date was a plain text box holding an ISO string, so it
       showed 2026-08-18 and offered no calendar at all — the one date field
       in the suite that was never a real date control. */
    var type = (k === 'date') ? 'date' : 'text';
    return '<div' + (wide ? ' style="grid-column:1/-1;"' : '') + '><label>' + esc(label) + '</label>'
      + '<input type="' + type + '" id="aro-pf-' + k + '" value="' + esc(val || '') + '"></div>';
  }
  function formHtml(o) {
    return '<div class="aro-pj-kv">'
      + field('projectName', 'PROJECT NAME', o.projectName)
      + field('client', 'CLIENT', o.client)
      + field('projectNumber', 'PROJECT NUMBER', o.projectNumber)
      + field('location', 'PROJECT LOCATION', o.location)
      + field('engineer', 'ENGINEER', o.engineer)
      + field('company', 'COMPANY', o.company)
      + field('date', 'DATE', o.date)
      + field('revision', 'REVISION', o.revision)
      + field('description', 'DESCRIPTION', o.description, true)
      + '</div>';
  }

  function roll() {
    var a = objects(), t = { pass: 0, warn: 0, fail: 0, none: 0 };
    a.forEach(function (o) { t[o.status || 'none'] = (t[o.status || 'none'] || 0) + 1; });
    t.total = a.length;
    t.done = t.pass + t.warn + t.fail;
    t.pct = t.total ? Math.round(100 * t.done / t.total) : 0;
    return t;
  }
  function overall(t) {
    if (!t.total) return { txt: 'NO OBJECTS YET', cls: 'none' };
    if (t.none) return { txt: 'INCOMPLETE — ' + t.none + ' NOT CALCULATED', cls: 'none' };
    if (t.fail) return { txt: '&#10007; DESIGN NOT ACCEPTABLE', cls: 'fail' };
    if (t.warn) return { txt: '&#9888; REVIEW REQUIRED', cls: 'warn' };
    return { txt: '&#10003; ACCEPTABLE', cls: 'ok' };
  }

  function lastCalc() {
    var a = objects(), best = '';
    a.forEach(function (o) { if (o.lastCalculated && o.lastCalculated > best) best = o.lastCalculated; });
    return best ? stamp(best) : '—';
  }

  function objRow(o) {
    var st = statusOf(o), r = REG[o.module] || {};
    return '<tr data-open="' + esc(o.id) + '">'
      + '<td class="aro-pj-tag">' + esc(o.tag) + '</td>'
      + '<td>' + esc(o.type || r.type || '—') + '</td>'
      + '<td>' + esc(o.service || '—') + '</td>'
      + (o.from !== undefined ? '<td>' + esc(o.from || '—') + ' &rarr; ' + esc(o.to || '—') + '</td>' : '')
      + '<td class="aro-st aro-st-' + st.cls + '">' + st.icon + ' ' + st.label + '</td>'
      + '<td>' + esc(r.label || o.module) + '</td>'
      + '<td>' + esc(o.revision || '0') + '</td>'
      + '<td>' + esc(o.lastCalculated ? stamp(o.lastCalculated) : '—') + '</td>'
      + '<td><button class="aro-pj-btn" data-open="' + esc(o.id) + '">OPEN DESIGN</button>'
      + '<button class="aro-pj-btn" data-dup="' + esc(o.id) + '" style="margin-left:5px;" title="Duplicate as the next tag">DUPLICATE</button>'
      + '<button class="aro-pj-btn" data-del="' + esc(o.id) + '" style="margin-left:5px;">REMOVE</button></td></tr>';
  }

  function addRow(kind) {
    var opts = Object.keys(REG).filter(function (k) { return REG[k].kind === kind; })
      .map(function (k) { return '<option value="' + k + '">' + esc(REG[k].label) + '</option>'; }).join('');
    return '<div class="aro-pj-bar">'
      + '<select id="aro-pj-add-' + kind + '" class="aro-pj-btn" style="padding:6px 8px;">' + opts + '</select>'
      + '<input id="aro-pj-tag-' + kind + '" class="aro-pj-btn" style="width:110px;" placeholder="TAG">'
      + '<input id="aro-pj-svc-' + kind + '" class="aro-pj-btn" style="width:230px;" placeholder="SERVICE DESCRIPTION">'
      + '<button class="aro-pj-btn pri" data-add="' + kind + '">ADD ' + (kind === 'line' ? 'LINE' : 'EQUIPMENT') + '</button>'
      + '</div>';
  }

  function projectHtml() {
    var t = roll(), ov = overall(t);
    var h = '<div class="aro-pj">';
    h += '<h2>AROGARA PROJECT &mdash; ' + esc(P.projectName || 'UNTITLED')
      + (dirty && !P.transient ? ' *' : '') + '</h2>'
      + '<div class="aro-pj-sub">' + esc(P.projectNumber || 'no project number') + ' &nbsp;·&nbsp; '
      + esc(P.client || 'no client') + ' &nbsp;·&nbsp; Rev ' + esc(P.revision) + '</div>';
    if (P.transient) {
      h += '<div class="aro-pj-note">This workspace is not a saved project yet. Everything below '
        + 'works, and every design still stands on its own — name it in NEW PROJECT at the foot of '
        + 'this page, or press SAVE, and it becomes a project with a revision and a home.</div>';
    }
    h += '<div class="aro-pj-bar">'
      + '<button class="aro-pj-btn pri" data-pj="save">SAVE</button>'
      + '<button class="aro-pj-btn" data-pj="settings">PROJECT SETTINGS</button>'
      + '<button class="aro-pj-btn" data-pj="review">DESIGN REVIEW</button>'
      + '<button class="aro-pj-btn" data-pj="report">GENERATE PROJECT REPORT</button>'
      + '<button class="aro-pj-btn" data-pj="pid">OPEN P&amp;ID</button>'
      + '<button class="aro-pj-btn" data-pj="export">EXPORT PROJECT</button>'
      + '<button class="aro-pj-btn" data-pj="rev">NEXT REVISION</button>'
      + '<button class="aro-pj-btn" data-pj="close">CLOSE PROJECT</button></div>';

    /* ── dashboard ── */
    h += '<h3>PROJECT STATUS</h3><div class="aro-pj-stats">'
      + '<div class="aro-pj-stat"><b>' + P.equipment.length + '</b><span>EQUIPMENT</span></div>'
      + '<div class="aro-pj-stat"><b>' + P.lines.length + '</b><span>LINES</span></div>'
      + '<div class="aro-pj-stat"><b class="aro-st-ok">' + t.pass + '</b><span>PASS</span></div>'
      + '<div class="aro-pj-stat"><b class="aro-st-warn">' + t.warn + '</b><span>REVIEW</span></div>'
      + '<div class="aro-pj-stat"><b class="aro-st-fail">' + t.fail + '</b><span>FAIL</span></div>'
      + '<div class="aro-pj-stat"><b class="aro-st-none">' + t.none + '</b><span>NOT CALCULATED</span></div>'
      + '</div>';
    h += '<div class="aro-pj-prog"><i style="width:' + t.pct + '%"></i></div>'
      + '<div class="aro-pj-rev"><span>PROJECT COMPLETION <b style="color:var(--text-header)">' + t.pct + '%</b></span>'
      + '<span>&nbsp;·&nbsp; OVERALL <b class="aro-st aro-st-' + ov.cls + '">' + ov.txt + '</b></span>'
      + '<span>&nbsp;·&nbsp; REVISION <b style="color:var(--text-header)">' + esc(P.revision) + '</b></span>'
      + '<span>&nbsp;·&nbsp; LAST CALCULATED <b style="color:var(--text-header)">' + lastCalc() + '</b></span></div>';

    /* ── equipment ── */
    h += '<h3>EQUIPMENT</h3>' + addRow('equipment');
    h += P.equipment.length
      ? '<table class="aro-pj-tbl"><tr><th>TAG</th><th>TYPE</th><th>SERVICE</th><th>STATUS</th>'
        + '<th>DESIGN MODULE</th><th>REV</th><th>LAST CALCULATED</th><th></th></tr>'
        + P.equipment.map(objRow).join('') + '</table>'
      : '<div class="aro-pj-empty">No equipment yet. Add a pump, exchanger or tank above &mdash; or place '
        + 'one on the P&amp;ID in ARO Workbench and assign it a tag.</div>';

    /* ── lines ── */
    h += '<h3>LINES</h3>' + addRow('line');
    h += P.lines.length
      ? '<table class="aro-pj-tbl"><tr><th>TAG</th><th>TYPE</th><th>SERVICE</th><th>FROM &rarr; TO</th>'
        + '<th>STATUS</th><th>DESIGN MODULE</th><th>REV</th><th>LAST CALCULATED</th><th></th></tr>'
        + P.lines.map(objRow).join('') + '</table>'
      : '<div class="aro-pj-empty">No lines yet.</div>';

    h += '<div class="aro-pj-note">Clicking a row opens that object in its design module with the '
      + 'project, tag and service already loaded. The result comes back here as a status &mdash; nothing '
      + 'is recalculated by this screen.</div>';
    h += projectsBlock();
    return h + '</div>';
  }

  /* ── Design review ────────────────────────────────────────────────── */
  function reviewHtml() {
    var t = roll(), ov = overall(t);
    var rows = objects().map(function (o) {
      var st = statusOf(o), r = REG[o.module] || {};
      var detail = (o.status === 'none')
        ? 'Not calculated. Open the design and run it.'
        : (o.pass || 0) + ' passed, ' + (o.warn || 0) + ' warning(s), ' + (o.fail || 0) + ' critical.';
      return '<tr data-open="' + esc(o.id) + '"><td class="aro-st aro-st-' + st.cls + '">' + st.icon
        + '</td><td class="aro-pj-tag">' + esc(o.tag) + '</td><td>' + esc(r.label || o.module)
        + '</td><td>' + esc(o.service || '—') + '</td><td>' + esc(detail) + '</td></tr>';
    }).join('');
    return '<div class="aro-pj" style="padding:0;">'
      + '<div class="aro-pj-note">Every object in the project, with what its module reported. Click a '
      + 'row to open that design.</div>'
      + '<div class="aro-pj-stats" style="margin-bottom:14px;">'
      + '<div class="aro-pj-stat"><b class="aro-st-ok">' + t.pass + '</b><span>PASS</span></div>'
      + '<div class="aro-pj-stat"><b class="aro-st-warn">' + t.warn + '</b><span>REVIEW</span></div>'
      + '<div class="aro-pj-stat"><b class="aro-st-fail">' + t.fail + '</b><span>FAIL</span></div>'
      + '<div class="aro-pj-stat"><b class="aro-st-none">' + t.none + '</b><span>NOT CALCULATED</span></div>'
      + '</div>'
      + '<div style="font-size:12px;font-weight:800;margin-bottom:10px;">OVERALL PROJECT STATUS: '
      + '<span class="aro-st aro-st-' + ov.cls + '">' + ov.txt + '</span></div>'
      + (rows ? '<table class="aro-pj-tbl"><tr><th></th><th>TAG</th><th>MODULE</th><th>SERVICE</th>'
                + '<th>RESULT</th></tr>' + rows + '</table>'
              : '<div class="aro-pj-empty">Nothing to review yet.</div>')
      + '</div>';
  }

  /* ── Project report ───────────────────────────────────────────────── */
  function reportHtml() {
    var t = roll(), ov = overall(t);
    function sec(n, title, inner) {
      return '<div style="margin-bottom:16px;"><div style="font-size:11px;font-weight:800;'
        + 'letter-spacing:.09em;color:#a8500c;border-bottom:1px solid #d1d5db;padding-bottom:4px;'
        + 'margin-bottom:8px;">' + n + ' &middot; ' + esc(title) + '</div>' + inner + '</div>';
    }
    function tbl(head, rows) {
      return '<table style="width:100%;border-collapse:collapse;font-size:9px;">'
        + '<tr>' + head.map(function (x) {
            return '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;">' + esc(x) + '</th>';
          }).join('') + '</tr>'
        + (rows.length ? rows.map(function (r) {
            return '<tr>' + r.map(function (c) {
              return '<td style="border:1px solid #d1d5db;padding:3px 6px;">' + c + '</td>';
            }).join('') + '</tr>';
          }).join('') : '<tr><td colspan="' + head.length + '" style="border:1px solid #d1d5db;padding:5px;">None.</td></tr>')
        + '</table>';
    }
    var h = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;padding:18px;">';
    h += '<div style="border-bottom:3px solid #d96b16;padding-bottom:9px;margin-bottom:14px;">'
      + '<div style="font-size:19px;font-weight:800;letter-spacing:.04em;">AROGARA FLOWSIZE</div>'
      + '<div style="font-size:13px;color:#374151;">PROJECT DESIGN REPORT &mdash; ' + esc(P.projectName || 'UNTITLED') + '</div></div>';

    h += sec(1, 'PROJECT INFORMATION', tbl(['ITEM', 'VALUE'], [
      ['Project name', esc(P.projectName || '—')], ['Project number', esc(P.projectNumber || '—')],
      ['Client', esc(P.client || '—')], ['Location', esc(P.location || '—')],
      ['Engineer', esc(P.engineer || '—')], ['Company', esc(P.company || '—')],
      ['Date', esc(P.date || '—')], ['Revision', esc(P.revision || '0')],
      ['Description', esc(P.description || '—')],
      ['Unit system', esc((function () { var s = $('global-unit-system');
        return s && s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : 'SI'; })())],
      ['Software', 'AROGARA FLOWSIZE — engine v' + (window.AROENG ? window.AROENG.version : '—')]
    ].map(function (r) { return r; })));

    h += sec(2, 'REVISION AND STATUS', tbl(['ITEM', 'VALUE'], [
      ['Project revision', esc(P.revision || '0')],
      ['Created', esc(stamp(P.createdAt))], ['Last saved', esc(stamp(P.modifiedAt))],
      ['Last calculated', esc(lastCalc())],
      ['Objects', String(t.total)], ['Completion', t.pct + ' %'],
      ['Overall status', ov.txt.replace(/&#\d+;/g, '').trim()]
    ]));

    h += sec(3, 'DESIGN BASIS', '<div style="font-size:10px;line-height:1.65;">Each design in this '
      + 'project is calculated by its own module against the standards and correlations that module '
      + 'declares. Those are recorded per design in the module&rsquo;s own engineering basis and '
      + 'calculation trace, and are not restated here. Calculation methods are referenced to the '
      + 'applicable engineering standards (IS / API / ASME / TEMA); this report is a calculation '
      + 'record and not a certification.</div>');

    h += sec(4, 'EQUIPMENT LIST', tbl(['TAG', 'TYPE', 'SERVICE', 'MODULE', 'STATUS', 'REV', 'LAST CALCULATED'],
      P.equipment.map(function (o) {
        var r = REG[o.module] || {};
        return [esc(o.tag), esc(o.type || r.type || '—'), esc(o.service || '—'),
                esc(r.label || o.module), statusOf(o).label, esc(o.revision || '0'),
                esc(o.lastCalculated ? stamp(o.lastCalculated) : '—')];
      })));

    h += sec(5, 'LINE LIST', tbl(['TAG', 'SERVICE', 'FROM', 'TO', 'MODULE', 'STATUS', 'REV', 'LAST CALCULATED'],
      P.lines.map(function (o) {
        var r = REG[o.module] || {};
        return [esc(o.tag), esc(o.service || '—'), esc(o.from || '—'), esc(o.to || '—'),
                esc(r.label || o.module), statusOf(o).label, esc(o.revision || '0'),
                esc(o.lastCalculated ? stamp(o.lastCalculated) : '—')];
      })));

    h += sec(6, 'DESIGN REVIEW', tbl(['TAG', 'MODULE', 'RESULT', 'PASSED', 'WARNINGS', 'CRITICAL'],
      objects().map(function (o) {
        var r = REG[o.module] || {};
        return [esc(o.tag), esc(r.label || o.module), statusOf(o).label,
                String(o.pass || 0), String(o.warn || 0), String(o.fail || 0)];
      })));

    h += sec(7, 'WARNINGS AND DEVIATIONS', (function () {
      var bad = objects().filter(function (o) { return o.status === 'warn' || o.status === 'fail'; });
      if (!bad.length) return '<div style="font-size:10px;">No warnings or failures are outstanding '
        + 'against the calculated objects in this project.</div>';
      return tbl(['TAG', 'MODULE', 'RESULT', 'ACTION'], bad.map(function (o) {
        var r = REG[o.module] || {};
        return [esc(o.tag), esc(r.label || o.module), statusOf(o).label,
                o.status === 'fail' ? 'Resolve or formally disposition before issue.'
                                    : 'Engineering judgement required — review the module&rsquo;s validation list.'];
      }));
    })());

    h += sec(8, 'FINAL SUMMARY', '<div style="font-size:10px;line-height:1.65;">'
      + esc(P.projectName || 'This project') + ' contains ' + P.equipment.length + ' item(s) of equipment '
      + 'and ' + P.lines.length + ' line(s). ' + t.done + ' of ' + t.total + ' have been calculated ('
      + t.pct + ' %). Overall status: ' + ov.txt.replace(/&#\d+;/g, '').trim() + '. '
      + 'The per-design calculations, assumptions, engineering basis and validation are held in each '
      + 'module and can be exported individually from the engineering bar.</div>');

    h += '<div style="margin-top:20px;border-top:1px solid #d1d5db;padding-top:8px;font-size:9px;color:#6b7280;">'
      + 'AROGARA FLOWSIZE — Digital Engineering Design Platform. This report is a calculation record. '
      + 'Results are only as good as the inputs and assumptions recorded against each design; final '
      + 'equipment selection and design approval remain subject to qualified engineering review and '
      + 'the applicable project and vendor requirements.</div></div>';
    return h;
  }

  /* ── Modal (reuses the engineering layer's shell when present) ────── */
  function modal(title, body, footer) {
    var old = $('aro-mod');
    if (old) old.remove();
    var w = document.createElement('div');
    w.className = 'aro-mod';
    w.id = 'aro-mod';
    w.innerHTML = '<div class="aro-mod-box"><div class="aro-mod-h"><span>' + esc(title) + '</span>'
      + '<button class="aro-x" id="aro-mod-x">&#10005;</button></div>'
      + '<div class="aro-mod-b">' + body + '</div>'
      + (footer ? '<div class="aro-mod-f">' + footer + '</div>' : '') + '</div>';
    document.body.appendChild(w);
    $('aro-mod-x').onclick = function () { w.remove(); };
    w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
    return w;
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }

  /* ── Actions ──────────────────────────────────────────────────────── */
  function readForm(target) {
    ['projectName', 'client', 'projectNumber', 'location', 'engineer', 'company',
     'date', 'revision', 'description'].forEach(function (k) {
      var e = $('aro-pf-' + k);
      if (e) target[k] = e.value.trim();
    });
  }

  function addObject(kind) {
    var sel = $('aro-pj-add-' + kind), tagI = $('aro-pj-tag-' + kind), svcI = $('aro-pj-svc-' + kind);
    if (!sel) return;
    var mod = sel.value, r = REG[mod];
    var tag = (tagI && tagI.value.trim()) || nextTag(mod);
    if (objects().some(function (o) { return o.tag.toUpperCase() === tag.toUpperCase(); })) {
      alert('Tag ' + tag + ' is already used in this project. Every object needs its own tag.');
      return;
    }
    var o = { id: uid('o'), tag: tag, module: mod, type: r.type,
              service: (svcI && svcI.value.trim()) || '', status: 'none',
              revision: '0', lastCalculated: '', pass: 0, warn: 0, fail: 0 };
    if (kind === 'line') { o.from = ''; o.to = ''; P.lines.push(o); }
    else P.equipment.push(o);
    save();
  }

  function duplicate(id) {
    var o = byId(id);
    if (!o) return;
    var c = JSON.parse(JSON.stringify(o));
    c.id = uid('o');
    c.tag = nextTag(o.module);
    c.status = 'none'; c.lastCalculated = ''; c.pass = c.warn = c.fail = 0;
    c.revision = '0';
    if (REG[o.module].kind === 'line') P.lines.push(c); else P.equipment.push(c);
    save();
  }

  function remove(id) {
    if (!confirm('Remove this object from the project? The design data held against it is removed with it.')) return;
    P.equipment = P.equipment.filter(function (o) { return o.id !== id; });
    P.lines = P.lines.filter(function (o) { return o.id !== id; });
    if (CTX && CTX.objId === id) closeContext();
    save();
  }

  function bumpRev() {
    var r = String(P.revision || '0');
    P.revision = /^\d+$/.test(r) ? String(parseInt(r, 10) + 1)
               : (/^[A-Z]$/.test(r) ? (r === 'Z' ? 'AA' : String.fromCharCode(r.charCodeAt(0) + 1)) : r + '1');
    save();
  }

  function openProject(id) {
    var raw;
    try { raw = localStorage.getItem(LS + ':' + id); } catch (e) {}
    if (!raw) return;
    try { P = JSON.parse(raw); } catch (e) { return; }
    P.equipment = P.equipment || []; P.lines = P.lines || [];
    try { localStorage.setItem(LS, raw); } catch (e) {}
    dirty = false;
    closeContext();
    render();
  }

  function actions(e) {
    var el = e.target && e.target.closest ? e.target : null;
    if (!el) return;

    var openPrj = el.closest('[data-openprj]');
    if (openPrj) { openProject(openPrj.getAttribute('data-openprj')); return; }
    var delPrj = el.closest('[data-delprj]');
    if (delPrj) {
      e.stopPropagation();
      if (!confirm('Delete this saved project? This cannot be undone.')) return;
      var k = delPrj.getAttribute('data-delprj');
      var list = archive(); delete list[k];
      try { localStorage.setItem(LS_LIST, JSON.stringify(list)); localStorage.removeItem(LS + ':' + k); } catch (er) {}
      render();
      return;
    }

    var add = el.closest('[data-add]');
    if (add) { addObject(add.getAttribute('data-add')); return; }
    var dup = el.closest('[data-dup]');
    if (dup) { e.stopPropagation(); duplicate(dup.getAttribute('data-dup')); return; }
    var del = el.closest('[data-del]');
    if (del) { e.stopPropagation(); remove(del.getAttribute('data-del')); return; }
    var op = el.closest('[data-open]');
    if (op) { open(op.getAttribute('data-open')); return; }

    var pj = el.closest('[data-pj]');
    if (!pj) return;
    var a = pj.getAttribute('data-pj');
    if (a === 'create') {
      /* If the engineer has been working in the untitled stand-in, naming it
         must not throw that work away — the equipment and lines they added
         belong to the project they are creating. */
      if (!P || !P.transient) P = blank();
      readForm(P);
      if (!P.projectName) { alert('Give the project a name before creating it.'); return; }
      save();
    } else if (a === 'save') { save(); }
    else if (a === 'settings') {
      modal('PROJECT SETTINGS', '<div class="aro-pj">' + formHtml(P) + '</div>',
        '<button class="aro-pj-btn pri" data-pj="apply">APPLY</button>');
    } else if (a === 'apply') { readForm(P); save(); var m = $('aro-mod'); if (m) m.remove(); }
    else if (a === 'rev') { bumpRev(); }
    else if (a === 'review') { modal('DESIGN REVIEW — ' + (P.projectName || 'UNTITLED'), reviewHtml()); }
    else if (a === 'report') {
      modal('PROJECT DESIGN REPORT', '<div id="aro-prj-rep" style="background:#fff;">' + reportHtml() + '</div>',
        '<button class="aro-pj-btn" data-pj="report-pdf">DOWNLOAD PDF</button>'
        + '<button class="aro-pj-btn" data-pj="report-print">PRINT</button>');
    } else if (a === 'report-pdf') {
      var body = $('aro-prj-rep');
      if (body && typeof window.AROPDF === 'function') {
        window.AROPDF(body, (P.projectName || 'PROJECT').replace(/[^A-Za-z0-9_-]+/g, '_')
          + '_REV' + P.revision + '_PROJECT_REPORT.pdf', { landscape: false, bg: '#ffffff' });
      } else { window.print(); }
    } else if (a === 'report-print') { window.print(); }
    else if (a === 'pid') {
      var wb = document.querySelector('.nav-tab[data-tab="workbench-tab"]');
      if (wb) wb.click();
    } else if (a === 'export') {
      download(new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' }),
        (P.projectName || 'project').replace(/[^A-Za-z0-9_-]+/g, '_') + '.arogara-project.json');
    } else if (a === 'close') {
      if (dirty && !confirm('Close the project? Unsaved changes will be lost.')) return;
      /* Drop the open-project pointer too. Leaving it meant a closed project
         came straight back on the next reload, which now shows as the
         workspace still being occupied by something the engineer closed. The
         saved copy in the archive is untouched. */
      try { localStorage.removeItem(LS); } catch (er) {}
      P = null; dirty = false; closeContext(); render();
    } else if (a === 'back') {
      var pb = document.querySelector('.nav-tab[data-tab="project-tab"]');
      if (pb) pb.click();
    } else if (a === 'detach') { closeContext(); }
  }

  /* ── Workbench bridge ─────────────────────────────────────────────────
     A tagged item on the P&ID and a project object are the same thing. When
     the Workbench hands equipment over to a design module and a project is
     open, the item joins the project under its tag rather than becoming an
     untracked scratch calculation. */
  function adopt(item, moduleId) {
    if (!P || !item) return null;
    var tag = (item.tag || '').trim() || nextTag(moduleId);
    var found = objects().filter(function (o) { return o.tag.toUpperCase() === tag.toUpperCase(); })[0];
    if (!found) {
      found = { id: uid('o'), tag: tag, module: moduleId, type: (REG[moduleId] || {}).type,
                service: item.service || item.name || '', status: 'none', revision: '0',
                lastCalculated: '', pass: 0, warn: 0, fail: 0,
                fluid: item.fluid, flow: item.flow, temp: item.temp, press: item.press };
      if ((REG[moduleId] || {}).kind === 'line') { found.from = item.from || ''; found.to = item.to || ''; P.lines.push(found); }
      else P.equipment.push(found);
    } else {
      found.fluid = item.fluid || found.fluid;
      if (isNum(item.flow)) found.flow = item.flow;
      if (isNum(item.temp)) found.temp = item.temp;
      if (isNum(item.press)) found.press = item.press;
      if (item.service) found.service = item.service;
    }
    save();
    CTX = { objId: found.id, tag: found.tag, service: found.service, module: moduleId };
    return found;
  }

  /* ── Boot ─────────────────────────────────────────────────────────── */
  function boot() {
    injectCss();
    P = load();
    render();
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && (e.target.closest('#project-tab') || e.target.closest('#aro-mod')
          || e.target.closest('#aro-ctx'))) actions(e);
    });
    /* a design that finishes while a project object is open records itself */
    if (window.AROENG && window.AROENG.publish) {
      var orig = window.AROENG.publish;
      window.AROENG.publish = function (id) {
        var r = orig.apply(this, arguments);
        try { captureResult(id); } catch (er) {}
        return r;
      };
    }
    /* keep the context strip alive as tabs are switched */
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.nav-tab')) setTimeout(contextStrip, 350);
    }, true);
  }

  window.AROPROJECT = {
    isOpen: function () { return !!P; },
    project: function () { return P; },
    context: function () { return CTX; },
    open: open,
    adopt: adopt,
    register: function (id, def) { REG[id] = def; },
    modules: function () { return REG; },
    refresh: render
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

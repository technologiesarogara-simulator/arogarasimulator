/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — COMMON COMPONENT OBJECT  (window.AROCOMP)
   ---------------------------------------------------------------------------
   Phases 13, 15, 16, 38, 56–59. A gate valve was four unrelated things in this
   application: a palette entry with 2D artwork and ports, a schematic glyph
   chosen by category on the P&ID, a casting in the 3D engine, and a line in a
   take-off. Nothing tied them together, so a component could be placed on the
   flowsheet, drawn as one symbol, modelled as a different casting and counted
   as neither — and no single place could say what a gate valve IS.

   This is that place. One record per component resolves every representation
   from one key:

        AROCOMP.get('gate-valve')
          → { id, name, category, keywords, tagPrefix,
              pid:   the schematic category the P&ID draws it from
              icon:  the shared symbol key (window.AROSYM)
              model: the 3D factory key (ARO 3D CAD engine)
              node:  the workbench palette entry, with its ports
              K:     resistance coefficient by NPS, where the component has one
              bom:   how it is counted in a take-off }

   IT DOES NOT REPLACE THE THREE LIBRARIES. Each keeps owning its own artwork
   and geometry, because that is where the drawing skill lives. What this adds
   is the identity that binds them, and — more useful than any of it — the
   AUDIT that says where the binding is missing.

   THE AUDIT IS THE POINT. A unified object whose links are all asserted and
   never checked is worse than none: it looks authoritative and lies. So every
   link is resolved against the live libraries at build time, and a component
   with no 3D casting, or a P&ID symbol nobody draws, is reported rather than
   quietly filled in with something that resembles it.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ══ TAG PREFIXES ═══════════════════════════════════════════════════════
     What a component is called on a P&ID. Held here so the flowsheet, the
     registers and the report cannot each invent their own convention. */
  var TAG = [
    [/pump|metering-skid/i, 'P'],
    [/compressor|blower|fan/i, 'K'],
    [/turbine/i, 'TU'],
    [/sthe|exchanger|hx|reboiler|condenser|evaporator|cooler|chiller/i, 'E'],
    [/boiler|heater|furnace/i, 'H'],
    [/tank|silo|hopper/i, 'T'],
    [/vessel|drum|sphere|bullet|separator|cyclone/i, 'V'],
    [/column|absorber|stripper/i, 'C'],
    [/reactor|cstr|pfr/i, 'R'],
    [/filter|strainer/i, 'F'],
    [/tower/i, 'CT'],
    [/control-valve|psv|relief|solenoid|deluge|three-way/i, 'XV'],
    [/valve|gate|globe|ball|butterfly|check|needle|plug|knife|pinch/i, 'V'],
    [/pressure-(gauge|indicator|transmitter|switch)|^pi$/i, 'PI'],
    [/temp|thermowell/i, 'TI'],
    [/level|radar/i, 'LI'],
    [/flow|orifice|rotameter|venturi|vortex|coriolis/i, 'FI'],
    [/ph-meter|conductivity|o2-analyzer|analy/i, 'AI'],
    [/motor|electrical-machine|generator|transformer/i, 'M'],
    [/support|anchor|guide|hanger|shoe|saddle/i, 'PS'],
    [/pipe|spool|elbow|tee|cross|reducer|expander|flange|blind|spectacle|union|cap|nozzle|manway/i, 'PL']
  ];
  function tagPrefixFor(key, name, cat) {
    var hay = [key, name, cat].join(' ');
    for (var i = 0; i < TAG.length; i++) if (TAG[i][0].test(hay)) return TAG[i][1];
    return 'EQ';
  }

  /* ══ THE FITTING SET ════════════════════════════════════════════════════
     The eighteen fittings the line-sizing services count, in the order their
     K table uses. Mapping them here is what lets a component carry the same
     resistance the hydraulics applied — one list, not two that drift. */
  var FIT_KEYS = ['gate', 'globe', 'angle', 'ball', 'plug', 'plug3', 'plugbranch',
    'checkswing', 'checklift', 'elbow90', 'elbow45', 'elbowlr', 'teerun',
    'teebranch', 'mitre0', 'mitre30', 'mitre60', 'mitre90'];

  /* A workbench type key or a 3D factory key mapped onto its fitting index,
     so a placed component can be priced for pressure drop by the same table
     the line sizing used. Only the components that genuinely correspond are
     listed: a butterfly valve has no entry in that table, and inventing one
     would be worse than leaving the field empty. */
  var FIT_OF = {
    'gate-valve': 0, gate: 0, 'knife-gate': 0,
    'globe-valve': 1, globe: 1,
    'angle-valve': 2, angle: 2,
    'ball-valve': 3, ball: 3,
    'plug-valve': 4, plug: 4,
    'three-way-valve': 5, plug3: 5, '3way': 5,
    plugbranch: 6,
    /* The palette spells a swing check "check" or "swing-check"; the K table
       keeps swing and lift apart because their resistances differ by an order
       of magnitude — 1.00 against 11.4 at NPS 2. Both spellings are mapped so
       neither silently loses its coefficient. */
    'check-valve': 7, checkswing: 7, 'check': 7, 'swing-check': 7,
    'foot-valve': 8, checklift: 8, 'lift-check': 8,
    elbow90: 9, 'elbow-90': 9,
    elbow45: 10, 'elbow-45': 10,
    elbowlr: 11, 'elbow-lr': 11,
    teerun: 12, tee: 12,
    teebranch: 13
  };

  /* ══ HOW A COMPONENT IS COUNTED ═════════════════════════════════════════
     A take-off does not count everything the same way. Pipe is a length,
     valves and fittings are pieces, and a flanged joint drags gaskets and
     bolting along with it. Stating that per component is what lets a bill of
     material be generated rather than assembled by hand. */
  var BOM = {
    LENGTH: { unit: 'm', note: 'Counted by length off the routed geometry.' },
    PIECE: { unit: 'off', note: 'Counted as a piece.' },
    FLANGED: { unit: 'off', gasket: 1, studsPerJoint: true,
      note: 'Counted as a piece; each flanged joint also carries a gasket and a stud set.' }
  };
  function bomFor(key, cat) {
    if (/^(pipe|spool|header-pipe)/.test(key)) return BOM.LENGTH;
    if (/flange|blind|spectacle|valve|manway|nozzle/.test(key + ' ' + cat)) return BOM.FLANGED;
    return BOM.PIECE;
  }

  /* ══ SYMBOL RESOLUTION ══════════════════════════════════════════════════
     The shared symbol set uses its own key names. Where a component's key is
     not one of them, an explicit alias is recorded — never a fuzzy match,
     because a fuzzy match is how a butterfly valve ends up drawn as a globe
     and nobody notices. */
  var ICON_ALIAS = {
    'gate-valve': 'gate', 'knife-gate': 'gate', 'cryo-valve': 'gate', 'deluge-valve': 'gate',
    'globe-valve': 'globe', 'diaphragm-valve': 'globe', 'pinch-valve': 'globe',
    'ball-valve': 'ball', 'butterfly-valve': 'butterfly', 'check-valve': 'checkswing',
    'foot-valve': 'checklift', 'control-valve': 'control', 'solenoid-valve': 'control',
    'psv-valve': 'relief', 'breather-valve': 'relief', 'needle-valve': 'needle',
    'angle-valve': 'angle', 'flush-bottom': 'angle', 'three-way-valve': 'plug3',
    'steam-trap': 'strainer', 'pipe-spool': 'spool', 'header-pipe': 'pipe',
    'elbow-lr': 'elbowlr', 'tee-fitting': 'tee', 'cross-fitting': 'cross',
    'reducer-fitting': 'reducer', 'ecc-reducer': 'eccreducer', 'flange-pair': 'flange',
    'flange-fitting': 'wnflange', 'blind-flange': 'blind', 'spectacle-blind': 'spectacle',
    'pipe-union': 'union', 'pipe-cap': 'cap', 'manway': 'flange', 'small-nozzle': 'nozzle',
    'static-mixer': 'pipe', 'y-strainer': 'strainer', 't-strainer': 'strainer',
    'basket-filter': 'strainer', 'bag-filter': 'strainer', 'duplex-filter': 'strainer',
    'self-clean-filter': 'strainer', 'filter': 'strainer',
    'orifice-plate': 'orifice', 'rotameter-tube': 'orifice', 'venturi-meter': 'orifice',
    'vortex-meter': 'orifice', 'coriolis-meter': 'orifice', 'flow-meter': 'orifice',
    'inline-instrument': 'orifice',
    'pressure-gauge': 'gauge', 'pressure-indicator': 'gauge', 'temp-indicator': 'gauge',
    'level-indicator': 'gauge', 'sight-glass': 'gauge', 'thermowell-bare': 'gauge',
    'pressure-switch': 'gauge', 'temp-switch': 'gauge', 'flow-switch': 'gauge',
    'level-switch': 'gauge',
    'pressure-transmitter': 'transmitter', 'dp-transmitter': 'transmitter',
    'temp-transmitter': 'transmitter', 'level-transmitter': 'transmitter',
    'radar-level': 'transmitter', 'ph-meter': 'transmitter',
    'conductivity-meter': 'transmitter', 'o2-analyzer': 'transmitter',
    'valve-positioner': 'control',
    'centrifugal-pump': 'pump', 'multistage-pump': 'pump', 'split-case-pump': 'pump',
    'vertical-turbine-pump': 'pump', 'submersible-pump': 'pump', 'slurry-pump': 'pump',
    'gear-pump': 'pump', 'lobe-pump': 'pump', 'screw-twin-pump': 'pump',
    'recip-pump': 'pump', 'metering-skid': 'pump', 'compressor': 'pump',
    'axial-compressor': 'pump', 'fan': 'pump', 'turbine-steam': 'pump',
    'steam-ejector': 'pump', 'electrical-machine': 'pump',
    'v-vessel': 'vessel', 'h-vessel': 'vessel', 'sphere': 'vessel', 'bullet': 'vessel',
    'cyclone-sep': 'vessel', 'panel': 'vessel', 'transformer': 'vessel',
    'cone-tank': 'tank', 'atm-tank': 'tank', 'silo-hopper': 'tank', 'package': 'tank',
    'column': 'column', 'reactor': 'reactor', 'reactor-cstr': 'reactor',
    'reactor-pfr': 'reactor', 'agitated-tank': 'reactor',
    'sthe': 'exchanger', 'plate-hx': 'exchanger', 'double-pipe-hx': 'exchanger',
    'spiral-coil-hx': 'exchanger', 'aircooler': 'exchanger', 'reboiler': 'exchanger',
    'condenser-hx': 'exchanger', 'evaporator-hx': 'exchanger', 'cooling-tower': 'exchanger',
    'fired-boiler': 'exchanger', 'chiller-pkg': 'exchanger',
    'support': 'support', 'safety-post': 'support'
  };

  /* ══ BUILD ══════════════════════════════════════════════════════════════ */
  var REC = null, BY_ID = null, AUDIT = null;

  function symKeys() {
    try { return window.AROSYM ? window.AROSYM.keys() : []; } catch (e) { return []; }
  }
  function facKeys() {
    try { return window.ARO3D && window.ARO3D.factories ? window.ARO3D.factories() : []; }
    catch (e) { return []; }
  }
  /* The engine answers which casting a palette type resolves to, from its own
     dispatch rather than from a table here that could disagree with it. */
  function modelKeyFor(t) {
    try {
      return (window.ARO3D && window.ARO3D.modelKeyFor) ? window.ARO3D.modelKeyFor(t) : null;
    } catch (e) { return null; }
  }
  function nodeIndex() {
    try { return window.AROWB && window.AROWB.libIndex ? window.AROWB.libIndex() : {}; }
    catch (e) { return {}; }
  }
  function pidCat(t) {
    try { return window.AROWB && window.AROWB.pidCatOf ? window.AROWB.pidCatOf(t) : null; }
    catch (e) { return null; }
  }

  function pretty(k) {
    return String(k).replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function build() {
    REC = []; BY_ID = {};
    var syms = symKeys(), facs = facKeys(), nodes = nodeIndex();
    var haveSym = {}, haveFac = {};
    syms.forEach(function (k) { haveSym[k] = 1; });
    facs.forEach(function (k) { haveFac[k] = 1; });

    /* Every key any of the three libraries knows about. A component that
       exists in only one of them is still a component — and is exactly what
       the audit is for. */
    var keys = {};
    Object.keys(nodes).forEach(function (k) { keys[k] = 1; });
    facs.forEach(function (k) { keys[k] = 1; });

    Object.keys(keys).sort().forEach(function (key) {
      var node = nodes[key] || null;
      var cat = node ? (node.cat || '') : '';
      var name = node ? (node.n || pretty(key)) : pretty(key);

      var icon = ICON_ALIAS[key] || (haveSym[key] ? key : null);
      if (icon && !haveSym[icon]) icon = null;

      /* A palette type and a factory key are not the same namespace — the
         palette calls it "gate", the engine calls the casting "gate-valve".
         Ask the engine which one it would build rather than guessing from
         the spelling. */
      var model = haveFac[key] ? key : (node ? modelKeyFor(key) : null);
      var pid = node ? pidCat(key) : null;

      var fitIdx = FIT_OF[key];
      var rec = {
        id: key,
        name: name,
        category: cat || null,
        keywords: [key, name, cat].join(' ').toLowerCase().replace(/[-_]+/g, ' '),
        tagPrefix: tagPrefixFor(key, name, cat),
        pid: pid,
        icon: icon,
        model: model,
        node: node,
        ports: node && node.ports ? node.ports.length : null,
        fitIndex: typeof fitIdx === 'number' ? fitIdx : null,
        fitName: typeof fitIdx === 'number'
          ? (window.AROFIT ? window.AROFIT.names()[fitIdx] : FIT_KEYS[fitIdx]) : null,
        bom: bomFor(key, cat)
      };
      REC.push(rec);
      BY_ID[key] = rec;
    });

    audit();
  }

  /* K for this component at a given line size, taken from the same table the
     line-sizing services use. Returns null rather than a number when the
     component has no entry — a fabricated K is a fabricated pressure drop. */
  function kOf(id, nps) {
    var r = BY_ID[id];
    if (!r || r.fitIndex == null) return null;
    if (!window.AROFIT) return null;
    var band = window.AROFIT.band(isFinite(nps) ? nps : 4);
    var k = band ? band[r.fitIndex] : null;
    return typeof k === 'number' ? k : null;
  }

  function audit() {
    AUDIT = { total: REC.length, issues: [], counts: {} };
    function flag(kind, r, detail) {
      AUDIT.issues.push({ kind: kind, id: r.id, name: r.name, detail: detail });
      AUDIT.counts[kind] = (AUDIT.counts[kind] || 0) + 1;
    }
    REC.forEach(function (r) {
      if (!r.model) flag('NO 3D CASTING', r,
        'Placeable on the flowsheet but the 3D engine has no factory for it, so it '
        + 'falls back to a generic shape when the model is built.');
      if (!r.node) flag('NOT PLACEABLE', r,
        'The 3D engine can build it but no palette entry places it, so it can only be '
        + 'reached by loading a flowsheet that already contains one.');
      if (!r.icon) flag('NO SYMBOL', r,
        'No entry in the shared symbol set, so its picker tile falls back to a plain spool.');
      if (r.node && !r.pid) flag('NO P&ID CATEGORY', r,
        'Drawn as the generic schematic shape on a P&ID.');
    });
    /* How many placeable types share one casting. Some sharing is right — a
       swing, lift, wafer and dual check valve are one shape at flowsheet
       scale. Some is a gap: an API 650 cone-roof tank, a floating-roof tank
       and a cryogenic tank are visibly different vessels and are currently
       drawn as the same one. Reported with the count so the difference
       between the two cases is the engineer's to judge, not this file's. */
    var byModel = {};
    REC.forEach(function (r) {
      if (!r.node || !r.model) return;
      (byModel[r.model] = byModel[r.model] || []).push(r);
    });
    AUDIT.castings = Object.keys(byModel).length;
    Object.keys(byModel).forEach(function (m) {
      var list = byModel[m];
      if (list.length < 5) return;
      AUDIT.issues.push({
        kind: 'SHARED CASTING', id: m, name: m,
        detail: list.length + ' palette types are modelled by the one casting "' + m + '" — '
          + list.map(function (r) { return r.id; }).join(', ')
          + '. Defensible where the shapes really are the same at flowsheet scale, '
          + 'a gap where they are not.'
      });
      AUDIT.counts['SHARED CASTING'] = (AUDIT.counts['SHARED CASTING'] || 0) + 1;
    });

    AUDIT.complete = REC.filter(function (r) { return r.model && r.node && r.icon && r.pid; }).length;
    var order = ['NO 3D CASTING', 'NOT PLACEABLE', 'NO SYMBOL', 'NO P&ID CATEGORY', 'SHARED CASTING'];
    AUDIT.issues.sort(function (a, b) { return order.indexOf(a.kind) - order.indexOf(b.kind); });
  }

  function ensure() { if (!REC) build(); }

  /* ══ SEARCH AND COMPATIBILITY ═══════════════════════════════════════════ */
  var SYN = { centrif: 'centrifugal', sthe: 'shell tube', hx: 'exchanger', psv: 'relief',
    xv: 'control valve', cv: 'control valve', instr: 'instrument', temp: 'temperature' };
  function search(q, o) {
    ensure();
    o = o || {};
    var terms = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
      .map(function (w) { return SYN[w] || w; });
    var out = REC.slice();
    if (o.category) out = out.filter(function (r) { return r.category === o.category; });
    if (o.placeable) out = out.filter(function (r) { return !!r.node; });
    if (o.modelled) out = out.filter(function (r) { return !!r.model; });
    if (terms.length) {
      out = out.filter(function (r) {
        return terms.every(function (t) { return r.keywords.indexOf(t) >= 0; });
      });
    }
    return out;
  }

  /* Phase 16. What the active line can actually take. Nothing is hidden —
     compatibility sorts the list, it does not filter it, because an engineer
     reaching for a component the line does not yet suit is usually about to
     change the line. */
  function activeLine() {
    function num(id) { var e = document.getElementById(id); return e ? parseFloat(e.value) : NaN; }
    function txt(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
    var v = null;
    try { v = window.AROENG && window.AROENG.values ? window.AROENG.values('line-liquid') : null; } catch (e) {}
    var nps = v && v.nps != null ? Number(v.nps) : num('lq-nps');
    var sch = v && v.sch != null ? String(v.sch) : txt('lq-sch');
    if (!isFinite(nps)) return null;
    return { nps: nps, sch: sch || null, material: txt('lq-mat') || null,
      rating: txt('lq-class') || 'Class 150' };
  }
  function compatible(line) {
    ensure();
    line = line || activeLine();
    if (!line) return { line: null, list: REC.slice() };
    var list = REC.slice().sort(function (a, b) {
      var av = (a.fitIndex != null || /valve|flange|elbow|tee|reducer|pipe|spool/.test(a.id)) ? 0 : 1;
      var bv = (b.fitIndex != null || /valve|flange|elbow|tee|reducer|pipe|spool/.test(b.id)) ? 0 : 1;
      if (av !== bv) return av - bv;
      return a.name.localeCompare(b.name);
    });
    return { line: line, list: list };
  }

  /* ══ UI ═════════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-comp-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-comp{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;}',
      '.cp-h{background:rgba(167,139,250,.10);border-bottom:1px solid var(--border-muted);padding:10px 12px;}',
      '.cp-h b{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#a78bfa;}',
      '.cp-sub{font-size:10.5px;color:var(--text-muted);margin-top:3px;line-height:1.5;}',
      '.cp-bar{display:flex;gap:6px;padding:9px 12px;border-bottom:1px solid var(--border-muted);flex-wrap:wrap;align-items:center;}',
      '.cp-bar input{flex:1;min-width:180px;background:var(--surface-2,rgba(148,163,184,.08));',
      '  border:1px solid var(--border-muted);border-radius:4px;padding:7px 9px;color:inherit;',
      '  font-family:var(--font-mono);font-size:11px;}',
      '.cp-chip{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.05em;padding:5px 9px;',
      '  border-radius:3px;border:1px solid var(--border-muted);background:transparent;',
      '  color:var(--text-muted);cursor:pointer;}',
      '.cp-chip.on{background:#a78bfa;border-color:#a78bfa;color:#150a2e;font-weight:800;}',
      '.cp-chip.bad{border-color:#f87171;color:#f87171;}',
      '.cp-chip.bad.on{background:#f87171;color:#180606;}',
      '.cp-wrap{overflow-x:auto;max-height:460px;overflow-y:auto;}',
      '.cp-t{width:100%;border-collapse:collapse;font-size:10.5px;min-width:700px;}',
      '.cp-t th{text-align:left;font-family:var(--font-mono);font-size:9px;letter-spacing:.07em;',
      '  color:var(--text-muted);padding:7px 10px;border-bottom:1px solid var(--border-muted);',
      '  position:sticky;top:0;background:var(--surface-1,#0f172a);white-space:nowrap;}',
      '.cp-t td{padding:6px 10px;border-bottom:1px dashed var(--border-muted);vertical-align:middle;}',
      '.cp-t tr:hover td{background:rgba(167,139,250,.06);}',
      '.cp-nm{font-family:var(--font-mono);font-weight:700;}',
      '.cp-id{font-size:9px;color:var(--text-muted);}',
      '.cp-y{color:#4ade80;font-weight:800;}',
      '.cp-n{color:#f87171;font-weight:800;}',
      '.cp-tag{font-family:var(--font-mono);font-weight:800;color:#a78bfa;}',
      '.cp-ic svg{background:rgba(148,163,184,.12);border-radius:3px;padding:1px 2px;vertical-align:middle;}',
      '.cp-empty{padding:20px 12px;font-size:11px;color:var(--text-muted);line-height:1.6;}',
      '.cp-iss{padding:8px 12px;border-bottom:1px dashed var(--border-muted);font-size:10.5px;line-height:1.55;}',
      '.cp-ik{font-family:var(--font-mono);font-size:9px;letter-spacing:.06em;color:#f87171;}'
    ].join('');
    document.head.appendChild(s);
  }

  var UI = { q: '', view: 'all' };

  function iconTile(r) {
    if (r.icon && window.AROSYM) {
      return '<span class="cp-ic">' + window.AROSYM.svg(r.icon, { w: 34 }) + '</span>';
    }
    return '<span class="cp-n">—</span>';
  }

  function rowsFor() {
    ensure();
    if (UI.view === 'issues') return null;
    var o = {};
    if (UI.view === 'placeable') o.placeable = true;
    if (UI.view === 'modelled') o.modelled = true;
    return search(UI.q, o);
  }

  function html() {
    ensure();
    var line = activeLine();
    var body;
    if (UI.view === 'issues') {
      body = AUDIT.issues.length
        ? '<div class="cp-wrap">' + AUDIT.issues.map(function (i) {
          return '<div class="cp-iss"><span class="cp-ik">' + esc(i.kind) + '</span> &nbsp;'
            + '<b>' + esc(i.name) + '</b> <span class="cp-id">' + esc(i.id) + '</span><br>'
            + esc(i.detail) + '</div>';
        }).join('') + '</div>'
        : '<div class="cp-empty">Every component resolves to a symbol, a palette entry, '
          + 'a P&amp;ID category and a 3D casting.</div>';
    } else {
      var rows = rowsFor();
      body = rows.length
        ? '<div class="cp-wrap"><table class="cp-t"><tr>'
          + '<th>ICON</th><th>COMPONENT</th><th>CATEGORY</th><th>TAG</th>'
          + '<th>P&amp;ID</th><th>2D</th><th>3D</th><th>PORTS</th><th>K @ '
          + (line ? line.nps + '&Prime;' : '4&Prime;') + '</th><th>COUNTED</th></tr>'
          + rows.map(function (r) {
            var k = kOf(r.id, line ? line.nps : 4);
            return '<tr><td>' + iconTile(r) + '</td>'
              + '<td><div class="cp-nm">' + esc(r.name) + '</div>'
              + '<div class="cp-id">' + esc(r.id) + '</div></td>'
              + '<td>' + esc(r.category || '—') + '</td>'
              + '<td><span class="cp-tag">' + esc(r.tagPrefix) + '</span></td>'
              + '<td>' + (r.pid ? esc(r.pid) : '<span class="cp-n">—</span>') + '</td>'
              + '<td>' + (r.node ? '<span class="cp-y">✓</span>' : '<span class="cp-n">—</span>') + '</td>'
              + '<td>' + (r.model ? '<span class="cp-y">✓</span>' : '<span class="cp-n">—</span>') + '</td>'
              + '<td>' + (r.ports == null ? '—' : r.ports) + '</td>'
              + '<td>' + (k == null ? '<span style="color:var(--text-muted);">—</span>' : k.toFixed(2)) + '</td>'
              + '<td>' + esc(r.bom.unit) + '</td></tr>';
          }).join('') + '</table></div>'
        : '<div class="cp-empty">Nothing matches that search.</div>';
    }

    function chip(v, label, cls) {
      return '<button class="cp-chip ' + (cls || '') + (UI.view === v ? ' on' : '')
        + '" data-cp-view="' + v + '">' + esc(label) + '</button>';
    }
    return '<div id="aro-comp">'
      + '<div class="cp-h"><b>COMMON COMPONENT OBJECT</b>'
      + '<div class="cp-sub">One record per component, resolving its P&amp;ID category, its 2D symbol, '
      + 'its 3D casting, its ports, its tag prefix, its resistance coefficient and how a take-off counts '
      + 'it — from a single key. The three libraries keep their own artwork; this binds them, and reports '
      + 'where a binding is missing rather than filling it in with something that merely resembles it.'
      + (line ? ' <b>Active line: NPS ' + line.nps + '&Prime;'
        + (line.sch ? ' SCH ' + esc(line.sch) : '') + '</b> — K is shown at that size.' : '')
      + '</div></div>'
      + '<div class="cp-bar">'
      + '<input id="cp-q" type="search" placeholder="Search components — name, key, category…" value="'
      + esc(UI.q) + '" autocomplete="off">'
      + chip('all', 'ALL ' + REC.length) + chip('placeable', 'PLACEABLE')
      + chip('modelled', 'MODELLED IN 3D')
      + chip('issues', AUDIT.issues.length + ' UNRESOLVED LINKS', 'bad')
      + '</div>' + body + '</div>';
  }

  function render(force) {
    var tab = document.getElementById('project-tab');
    if (!tab || !tab.offsetParent) return;
    css();
    var host = document.getElementById('aro-comp-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-comp-host';
      tab.appendChild(host);
    }
    var sig = UI.view + '|' + UI.q;
    if (!force && host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig);
    try { host.innerHTML = html(); } catch (e) { host.innerHTML = ''; }
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-cp-view]') : null;
    if (t) { e.preventDefault(); UI.view = t.getAttribute('data-cp-view'); render(true); return; }
    setTimeout(function () { render(false); }, 80);
  }, true);

  var typing = null;
  document.addEventListener('input', function (e) {
    if (!e.target || e.target.id !== 'cp-q') return;
    UI.q = e.target.value;
    if (UI.view === 'issues') UI.view = 'all';
    if (typing) clearTimeout(typing);
    typing = setTimeout(function () {
      typing = null;
      render(true);
      var el = document.getElementById('cp-q');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 180);
  }, true);

  window.AROCOMP = {
    all: function () { ensure(); return REC.slice(); },
    get: function (id) { ensure(); return BY_ID[id] || null; },
    search: search,
    audit: function () { ensure(); return AUDIT; },
    kOf: function (id, nps) { ensure(); return kOf(id, nps); },
    tagPrefix: function (id) { var r = this.get(id); return r ? r.tagPrefix : 'EQ'; },
    activeLine: activeLine,
    compatible: compatible,
    rebuild: function () { REC = null; ensure(); render(true); },
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

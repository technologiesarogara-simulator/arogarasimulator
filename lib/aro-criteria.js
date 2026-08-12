/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — ENGINEERING CRITERIA, STANDARDS REGISTER, ORIGIN MODE
   (window.AROCRIT)
   ---------------------------------------------------------------------------
   Three things that were scattered, and belong together because they answer
   the same question in three different ways: WHERE DID THIS NUMBER COME FROM?

   01 · ENGINEERING CRITERIA (Phase 42)
        A preferred velocity band is not a property of a fluid. It is a design
        rule someone chose, and it was buried in the UI code that drew the
        verdict — which meant it could not be seen, cited, or overridden
        without editing the module. Criteria are records here: value or range,
        unit, the service they apply to, the basis they rest on, and where a
        project or a module has overridden them.

   02 · STANDARDS REGISTER (Phase 41)
        Metadata only. No standard's text is reproduced — a register says
        which document a figure was taken from and which modules lean on it,
        and nothing more. The wording is REFERENCE BASIS throughout: this
        application screens a design against published practice, which is not
        the same claim as compliance, and saying "COMPLIANT" would assert an
        audit nobody performed.

   03 · PROPERTY ORIGIN (Phase 52)
        A developer switch. With it on, every figure the modules publish can
        be traced back through the value, the input it came from, the library
        record behind it and the module that computed it. Off by default and
        stored per browser, because it is a debugging tool and not a feature.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* ══ 01 · ENGINEERING CRITERIA ══════════════════════════════════════════
     `basis` says what kind of rule this is, which governs how hard it may be
     applied. A code clause and a rule of thumb are both useful and they are
     not interchangeable. */
  var BASIS = {
    CODE: 'CODE CLAUSE',
    STANDARD: 'INDUSTRY STANDARD',
    PRACTICE: 'PUBLISHED PRACTICE',
    THUMB: 'RULE OF THUMB',
    SOFTWARE: 'SOFTWARE DEFAULT'
  };

  var CRITERIA = [
    { id: 'vel-liquid-pump-suction', group: 'LINE SIZING', service: 'Liquid — pump suction',
      label: 'Preferred velocity', min: 0.6, max: 1.5, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'Pump suction piping practice',
      note: 'Low enough to protect NPSHa. A suction line sized on the discharge '
          + 'band is the commonest cause of a cavitating pump that calculates clean.' },
    { id: 'vel-liquid-discharge', group: 'LINE SIZING', service: 'Liquid — pump discharge',
      label: 'Preferred velocity', min: 1.5, max: 3.5, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'General process piping practice' },
    { id: 'vel-liquid-general', group: 'LINE SIZING', service: 'Liquid — general process',
      label: 'Preferred velocity', min: 1.0, max: 3.0, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'General process piping practice' },
    { id: 'vel-gas', group: 'LINE SIZING', service: 'Gas / vapour',
      label: 'Preferred velocity', min: 15, max: 30, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'General process piping practice' },
    { id: 'mach-gas', group: 'LINE SIZING', service: 'Gas / vapour',
      label: 'Mach number limit', max: 0.3, unit: '—', basis: BASIS.PRACTICE,
      source: 'Compressible flow practice',
      note: 'Above roughly Mach 0.3 the incompressible pressure-drop treatment '
          + 'stops being defensible and density change along the line matters.' },
    { id: 'vel-steam-sat', group: 'LINE SIZING', service: 'Saturated steam',
      label: 'Preferred velocity', min: 20, max: 40, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'Steam distribution practice' },
    { id: 'vel-steam-sup', group: 'LINE SIZING', service: 'Superheated steam',
      label: 'Preferred velocity', min: 30, max: 60, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'Steam distribution practice' },
    { id: 'vel-slurry-deposit', group: 'LINE SIZING', service: 'Slurry',
      label: 'Velocity above deposition', min: 1.0, unit: '× V_deposit', basis: BASIS.PRACTICE,
      source: 'Durand / Wasp settling-slurry practice',
      note: 'Below the deposition velocity solids drop out and the line silts up. '
          + 'The margin is on top of the calculated deposition velocity, not a fixed speed.' },
    { id: 'erosional-c', group: 'LINE SIZING', service: 'Two-phase / erosional',
      label: 'API 14E erosional constant C', min: 100, max: 125, unit: '(US units)',
      basis: BASIS.STANDARD, source: 'API RP 14E',
      note: 'C is empirical and the standard itself cautions against treating it '
          + 'as a design velocity. It screens; it does not size.' },

    { id: 'npsh-margin', group: 'PUMP', service: 'Centrifugal pump',
      label: 'NPSH margin over NPSHr', min: 1.0, unit: 'm', basis: BASIS.CODE,
      source: 'API 610 / ISO 13709 cl. 6.1.6',
      note: 'The greater of 1 m and 10 % of NPSHr.' },
    { id: 'nss-limit', group: 'PUMP', service: 'Centrifugal pump',
      label: 'Suction specific speed', max: 11000, unit: '(US units)', basis: BASIS.CODE,
      source: 'API 610 cl. 6.1.7' },
    { id: 'rated-bep', group: 'PUMP', service: 'Centrifugal pump',
      label: 'Rated point relative to BEP', min: 80, max: 110, unit: '% of BEP flow',
      basis: BASIS.CODE, source: 'API 610 cl. 6.1.4' },
    { id: 'por', group: 'PUMP', service: 'Centrifugal pump',
      label: 'Preferred operating region', min: 70, max: 120, unit: '% of BEP flow',
      basis: BASIS.CODE, source: 'API 610 cl. 6.1.11' },
    { id: 'motor-loading', group: 'PUMP', service: 'Motor',
      label: 'Motor loading at rated duty', max: 95, unit: '%', basis: BASIS.PRACTICE,
      source: 'Driver sizing practice' },

    { id: 'hx-excess-area', group: 'HEAT EXCHANGER', service: 'Shell & tube / double pipe',
      label: 'Excess area over required', min: 10, max: 40, unit: '%', basis: BASIS.PRACTICE,
      source: 'Exchanger design practice',
      note: 'Under 10 % leaves nothing for fouling; over 40 % is metal nobody needs.' },
    { id: 'hx-tube-vel', group: 'HEAT EXCHANGER', service: 'Tube side — liquid',
      label: 'Preferred velocity', min: 1.0, max: 3.0, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'TEMA practice',
      note: 'Below about 1 m/s fouling accelerates; above about 3 m/s erosion and '
          + 'tube-inlet damage become the limit.' },
    { id: 'hx-shell-vel', group: 'HEAT EXCHANGER', service: 'Shell side — liquid',
      label: 'Preferred velocity', min: 0.3, max: 1.5, unit: 'm/s', basis: BASIS.PRACTICE,
      source: 'TEMA practice' },
    { id: 'hx-baffle-cut', group: 'HEAT EXCHANGER', service: 'Shell & tube',
      label: 'Baffle cut', min: 20, max: 35, unit: '% of shell ID', basis: BASIS.PRACTICE,
      source: 'TEMA practice' },
    { id: 'hx-baffle-space', group: 'HEAT EXCHANGER', service: 'Shell & tube',
      label: 'Baffle spacing', min: 20, max: 100, unit: '% of shell ID', basis: BASIS.STANDARD,
      source: 'TEMA RCB-4' },

    { id: 'tank-hd', group: 'TANK', service: 'Vertical storage tank',
      label: 'Height to diameter ratio', min: 0.5, max: 2.0, unit: '—', basis: BASIS.THUMB,
      source: 'Atmospheric tank proportioning practice',
      note: 'A screening proportion. Wind, seismic, foundation cost and plot '
          + 'availability decide the real shape.' },
    { id: 'tank-freeboard', group: 'TANK', service: 'Vertical storage tank',
      label: 'Freeboard above HLL', min: 300, unit: 'mm', basis: BASIS.PRACTICE,
      source: 'Tank layout practice' },
    { id: 'tank-ca', group: 'TANK', service: 'Carbon steel, non-corrosive service',
      label: 'Corrosion allowance', min: 1.5, max: 3.0, unit: 'mm', basis: BASIS.PRACTICE,
      source: 'Fixed-equipment practice' }
  ];

  /* ══ 02 · STANDARDS REGISTER ════════════════════════════════════════════
     Metadata only — name, edition where the application relies on a specific
     one, topic, and which modules lean on it. No clause text is reproduced.  */
  var STANDARDS = [
    { name: 'ASME B36.10M', topic: 'Welded and seamless wrought steel pipe — dimensions',
      used: ['Line Sizing', 'Pump Hydraulics', 'Industrial 3D', 'Bill of material'] },
    { name: 'ASME B16.5', topic: 'Pipe flanges and flanged fittings, NPS ½ through 24',
      used: ['Industrial 3D', 'ARO Workbench', 'Bill of material'] },
    { name: 'API 610 / ISO 13709', topic: 'Centrifugal pumps for petroleum, petrochemical and natural gas industries',
      used: ['Pump Hydraulics'] },
    { name: 'ANSI/HI 9.6.7', topic: 'Effects of liquid viscosity on rotodynamic pump performance',
      used: ['Pump Hydraulics'] },
    { name: 'IEC 60072', topic: 'Dimensions and output series for rotating electrical machines',
      used: ['Pump Hydraulics — motor selection'] },
    { name: 'API RP 14E', topic: 'Offshore production platform piping systems — erosional velocity',
      used: ['Two-Phase Line Sizing', 'Liquid Line Sizing'] },
    { name: 'TEMA', topic: 'Standards of the Tubular Exchanger Manufacturers Association',
      used: ['Shell & Tube Exchanger', 'Double Pipe Exchanger'] },
    { name: 'ASME BPVC Section VIII Division 1', topic: 'Rules for construction of pressure vessels',
      used: ['Shell & Tube Exchanger', 'Plate Heat Exchanger', 'Storage Tank'] },
    { name: 'ASME BPVC Section II Part D', topic: 'Material properties — allowable stress',
      used: ['Storage Tank', 'Plate Heat Exchanger', 'Common Engineering Library'] },
    { name: 'API 650', topic: 'Welded tanks for oil storage',
      used: ['Storage Tank'] },
    { name: 'AHRI / API 662', topic: 'Plate heat exchangers for general refinery service',
      used: ['Plate Heat Exchanger'] },
    { name: 'EN 13445', topic: 'Unfired pressure vessels',
      used: ['Plate Heat Exchanger'] },
    { name: 'ISA S5.1', topic: 'Instrumentation symbols and identification',
      used: ['ARO Workbench P&ID'] }
  ];

  /* ══ OVERRIDES ══════════════════════════════════════════════════════════
     A project may move a criterion; a module may move it again. Both are
     recorded, and the origin of the value in force is always visible. */
  var KEY = 'aro_criteria_override_v1';
  function overrides() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '{}');
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }
  function setOverride(id, patch) {
    var o = overrides();
    if (patch == null) delete o[id];
    else o[id] = Object.assign({}, o[id] || {}, patch, { at: Date.now() });
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    render(true);
    return o[id] || null;
  }
  function effective(id) {
    var base = null;
    for (var i = 0; i < CRITERIA.length; i++) if (CRITERIA[i].id === id) base = CRITERIA[i];
    if (!base) return null;
    var ov = overrides()[id];
    var out = Object.assign({}, base, { origin: 'LIBRARY DEFAULT', overridden: false });
    if (ov) {
      if (typeof ov.min === 'number') out.min = ov.min;
      if (typeof ov.max === 'number') out.max = ov.max;
      out.origin = ov.scope === 'module' ? 'MODULE OVERRIDE' : 'PROJECT OVERRIDE';
      out.overridden = true;
      out.overriddenAt = ov.at;
      out.was = { min: base.min, max: base.max };
    }
    return out;
  }

  /* ══ 03 · PROPERTY ORIGIN MODE ══════════════════════════════════════════ */
  var ORIGIN_KEY = 'aro_origin_mode_v1';
  function originOn() {
    try { return localStorage.getItem(ORIGIN_KEY) === '1'; } catch (e) { return false; }
  }
  function setOrigin(on) {
    try { localStorage.setItem(ORIGIN_KEY, on ? '1' : '0'); } catch (e) {}
    document.documentElement.classList.toggle('aro-origin', !!on);
    render(true);
  }

  /* What is known about one published figure, gathered from every layer that
     touched it. Nothing is inferred: a layer that has nothing to say is
     absent from the answer rather than guessed at. */
  function originOf(moduleId, valueKey) {
    var out = { module: moduleId, key: valueKey };
    try {
      var vals = window.AROENG && window.AROENG.values ? window.AROENG.values(moduleId) : null;
      if (vals && vals[valueKey] !== undefined) out.value = vals[valueKey];
    } catch (e) {}
    try {
      var st = window.AROSTATE;
      if (st) { out.state = st.state(moduleId); out.inputRev = st.inputRev(moduleId); }
    } catch (e) {}
    try {
      var s = window.AROENG && window.AROENG.status ? window.AROENG.status(moduleId) : null;
      if (s) out.tally = s.tally;
    } catch (e) {}
    return out;
  }

  function fmtRange(c) {
    var u = c.unit && c.unit !== '—' ? ' ' + c.unit : '';
    if (typeof c.min === 'number' && typeof c.max === 'number') return c.min + ' – ' + c.max + u;
    if (typeof c.min === 'number') return '≥ ' + c.min + u;
    if (typeof c.max === 'number') return '≤ ' + c.max + u;
    return '—';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ══ UI ═════════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-crit-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-crit{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;}',
      '.cr-h{background:rgba(245,158,11,.08);border-bottom:1px solid var(--border-muted);padding:10px 12px;}',
      '.cr-h b{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#f59e0b;}',
      '.cr-sub{font-size:10.5px;color:var(--text-muted);margin-top:3px;line-height:1.5;}',
      '.cr-tabs{display:flex;gap:6px;padding:9px 12px;border-bottom:1px solid var(--border-muted);flex-wrap:wrap;}',
      '.cr-tab{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.06em;padding:5px 10px;border-radius:3px;',
      '  border:1px solid var(--border-muted);background:transparent;color:var(--text-muted);cursor:pointer;}',
      '.cr-tab.on{background:#f59e0b;border-color:#f59e0b;color:#1a1204;font-weight:800;}',
      '.cr-grp{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.09em;color:#f59e0b;',
      '  padding:9px 12px 4px;font-weight:800;}',
      '.cr-row{display:grid;grid-template-columns:minmax(0,1.5fr) 128px minmax(0,1.1fr) 96px;gap:8px;',
      '  padding:7px 12px;border-bottom:1px dashed var(--border-muted);align-items:start;font-size:10.5px;}',
      '@media(max-width:820px){.cr-row{grid-template-columns:1fr;}}',
      '.cr-lb{font-family:var(--font-mono);font-weight:700;}',
      '.cr-sv{color:var(--text-muted);font-size:9.5px;margin-top:2px;}',
      '.cr-val{font-family:var(--font-mono);font-weight:800;}',
      '.cr-was{color:var(--text-muted);text-decoration:line-through;font-weight:400;font-size:9.5px;}',
      '.cr-src{font-size:9.5px;color:var(--text-muted);line-height:1.5;}',
      '.cr-basis{font-family:var(--font-mono);font-size:8.5px;letter-spacing:.05em;padding:2px 6px;',
      '  border-radius:3px;border:1px solid var(--border-muted);display:inline-block;color:var(--text-muted);}',
      '.cr-basis.CODE{border-color:#4ade80;color:#4ade80;}',
      '.cr-note{grid-column:1/-1;font-size:9.5px;line-height:1.55;color:#93c5fd;',
      '  border-left:2px solid #38bdf8;padding-left:7px;margin-top:3px;}',
      '.cr-ov{font-family:var(--font-mono);font-size:8.5px;color:#f59e0b;}',
      '.cr-std{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.1fr);gap:8px;',
      '  padding:8px 12px;border-bottom:1px dashed var(--border-muted);font-size:10.5px;align-items:start;}',
      '@media(max-width:820px){.cr-std{grid-template-columns:1fr;}}',
      '.cr-ref{font-family:var(--font-mono);font-size:8.5px;letter-spacing:.05em;color:#4ade80;}',
      '.cr-orig{padding:12px;font-size:11px;line-height:1.65;}',
      '.cr-orig code{font-family:var(--font-mono);font-size:10px;}',
      '.cr-sw{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border-muted);}',
      '.cr-sw button{font-family:var(--font-mono);font-size:10px;padding:6px 12px;border-radius:4px;cursor:pointer;',
      '  border:1px solid var(--border-muted);background:transparent;color:var(--text-muted);}',
      '.cr-sw button.on{background:#38bdf8;border-color:#38bdf8;color:#04121e;font-weight:800;}'
    ].join('');
    document.head.appendChild(s);
  }

  var TAB = 'criteria';

  function criteriaHtml() {
    var groups = [];
    CRITERIA.forEach(function (c) { if (groups.indexOf(c.group) < 0) groups.push(c.group); });
    return groups.map(function (g) {
      return '<div class="cr-grp">' + esc(g) + '</div>'
        + CRITERIA.filter(function (c) { return c.group === g; }).map(function (c0) {
          var c = effective(c0.id);
          return '<div class="cr-row">'
            + '<div><div class="cr-lb">' + esc(c.label) + '</div>'
            + '<div class="cr-sv">' + esc(c.service) + '</div></div>'
            + '<div><div class="cr-val">' + esc(fmtRange(c)) + '</div>'
            + (c.overridden ? '<div class="cr-was">was ' + esc(fmtRange(c.was)) + ' ' + esc(c.unit || '') + '</div>'
              + '<div class="cr-ov">' + esc(c.origin) + '</div>' : '')
            + '</div>'
            + '<div class="cr-src">' + esc(c.source) + '</div>'
            + '<div><span class="cr-basis ' + (c.basis === BASIS.CODE ? 'CODE' : '') + '">'
            + esc(c.basis) + '</span></div>'
            + (c.note ? '<div class="cr-note">' + esc(c.note) + '</div>' : '')
            + '</div>';
        }).join('');
    }).join('');
  }

  function standardsHtml() {
    return '<div class="cr-grp">REFERENCE BASIS &mdash; METADATA ONLY</div>'
      + '<div class="cr-std" style="border-bottom:1px solid var(--border-muted);">'
      + '<div class="cr-lb">STANDARD</div><div class="cr-lb">TOPIC</div><div class="cr-lb">USED BY</div></div>'
      + STANDARDS.map(function (s) {
        return '<div class="cr-std">'
          + '<div><div class="cr-lb">' + esc(s.name) + '</div>'
          + '<div class="cr-ref">REFERENCE BASIS</div></div>'
          + '<div class="cr-src">' + esc(s.topic) + '</div>'
          + '<div class="cr-src">' + esc(s.used.join(' · ')) + '</div>'
          + '</div>';
      }).join('')
      + '<div class="cr-orig" style="color:var(--text-muted);">No clause text is reproduced here. '
      + 'This register records which document a figure was taken from and which modules rely on it. '
      + 'AROGARA screens a design against published practice; that is not the same claim as compliance, '
      + 'and nothing in this application should be read as certifying a design against a standard.</div>';
  }

  function originHtml() {
    var on = originOn();
    var mods = [];
    try { mods = window.AROSTATE ? window.AROSTATE.modules() : []; } catch (e) {}
    return '<div class="cr-sw"><button data-cr-origin="' + (on ? '0' : '1') + '" class="' + (on ? 'on' : '') + '">'
      + (on ? 'PROPERTY ORIGIN — ON' : 'PROPERTY ORIGIN — OFF') + '</button>'
      + '<span class="cr-sub" style="margin:0;">A debugging aid. With it on, each module reports the state, '
      + 'input revision and check tally behind the figures it published.</span></div>'
      + '<div class="cr-orig">'
      + (on
        ? (mods.length
          ? mods.map(function (m) {
            var o = originOf(m);
            return '<div style="padding:6px 0;border-bottom:1px dashed var(--border-muted);">'
              + '<code><b>' + esc(m) + '</b></code> &nbsp; state <code>' + esc(o.state || '—') + '</code>'
              + ' &nbsp; input rev <code>' + esc(String(o.inputRev == null ? '—' : o.inputRev)) + '</code>'
              + (o.tally ? ' &nbsp; checks <code>' + o.tally.pass + ' pass / ' + o.tally.warn
                + ' review / ' + o.tally.fail + ' fail</code>' : '')
              + '</div>';
          }).join('')
          : 'No modules are registered yet.')
        : 'Switch it on to trace a published figure back through its module state, its input revision '
          + 'and the checks that were evaluated against it.')
      + '</div>';
  }

  function html() {
    var body = TAB === 'criteria' ? criteriaHtml()
      : TAB === 'standards' ? standardsHtml() : originHtml();
    function tab(id, label) {
      return '<button class="cr-tab' + (TAB === id ? ' on' : '') + '" data-cr-tab="' + id + '">'
        + esc(label) + '</button>';
    }
    return '<div id="aro-crit">'
      + '<div class="cr-h"><b>ENGINEERING CRITERIA &amp; REFERENCE BASIS</b>'
      + '<div class="cr-sub">The design rules the verdicts are measured against, held as records rather '
      + 'than buried in the code that draws them — each with the service it applies to, the basis it '
      + 'rests on and the document it came from.</div></div>'
      + '<div class="cr-tabs">' + tab('criteria', 'CRITERIA (' + CRITERIA.length + ')')
      + tab('standards', 'STANDARDS (' + STANDARDS.length + ')')
      + tab('origin', 'PROPERTY ORIGIN') + '</div>'
      + body + '</div>';
  }

  function render(force) {
    var tab = document.getElementById('project-tab');
    if (!tab || !tab.offsetParent) return;
    css();
    var host = document.getElementById('aro-crit-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-crit-host';
      tab.appendChild(host);
    } else if (!force && host.getAttribute('data-sig') === TAB + originOn()) {
      return;
    }
    host.setAttribute('data-sig', TAB + originOn());
    try { host.innerHTML = html(); } catch (e) { host.innerHTML = ''; }
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-cr-tab],[data-cr-origin]') : null;
    if (!t) return;
    e.preventDefault();
    if (t.hasAttribute('data-cr-tab')) { TAB = t.getAttribute('data-cr-tab'); render(true); }
    else setOrigin(t.getAttribute('data-cr-origin') === '1');
  }, true);

  window.AROCRIT = {
    BASIS: BASIS,
    criteria: function () { return CRITERIA.map(function (c) { return effective(c.id); }); },
    criterion: effective,
    setOverride: setOverride,
    overrides: overrides,
    standards: function () { return STANDARDS.slice(); },
    originMode: originOn,
    setOriginMode: setOrigin,
    originOf: originOf,
    render: function () { render(true); }
  };

  function boot() {
    if (originOn()) document.documentElement.classList.add('aro-origin');
    var iv = setInterval(function () {
      var tab = document.getElementById('project-tab');
      if (tab && tab.offsetParent) { render(true); clearInterval(iv); }
    }, 700);
    setTimeout(function () { clearInterval(iv); }, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

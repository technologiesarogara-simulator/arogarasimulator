/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — ENGINEERING LAYER

   Everything in this file exists to answer four questions an engineer asks
   of any calculation before they will put their name on it:

     · Does it pass?          — the verdict, stated once, for the whole design
     · Where did that number come from?  — input, calculated, or selected
     · On what basis?         — the standards, the correlations, the assumptions
     · Which revision is it?  — project, revision, calculation version, date

   The suite already computes all of this. What it did not do was SAY it in
   one place. Nine modules each rendered their own verdict rows in their own
   markup, the assumptions lived in the source, and there was no such thing
   as a project — close the tab and the design was gone.

   This layer sits above the modules and does not reach into their maths.
   It takes what they already publish, normalises it, and presents it as one
   engineering record. Modules that publish structured checks are read
   directly; the rest are harvested from the verdict rows they render, so
   every module gets a status without nine separate rewrites.

   Nothing here changes a result. If this file fails to load, every module
   still calculates exactly as before.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS_PROJECTS = 'aro_projects_v1';
  var LS_CURRENT  = 'aro_project_current_v1';
  var LS_PROV     = 'aro_provenance_v1';
  var ENGINE_VERSION = '3.4.0';

  /* ── The module register ──────────────────────────────────────────────
     A module is a thing that produces a design. The tab is where it lives;
     several modules share a tab (five line-sizing services, three heat
     exchanger types), so the bar tracks which one last produced a result. */
  var MODULES = {
    pump:        { tab: 'pump-tab',      name: 'Pump Hydraulics',        code: 'PU' },
    'line-liquid':   { tab: 'line-tab',  name: 'Liquid Line Sizing',     code: 'LL' },
    'line-gas':      { tab: 'line-tab',  name: 'Gas Line Sizing',        code: 'LG' },
    'line-steam':    { tab: 'line-tab',  name: 'Steam Line Sizing',      code: 'LS' },
    'line-slurry':   { tab: 'line-tab',  name: 'Slurry Line Sizing',     code: 'LY' },
    'line-twophase': { tab: 'line-tab',  name: 'Two-Phase Line Sizing',  code: 'LT' },
    sthe:        { tab: 'sthe-tab',      name: 'Shell & Tube Exchanger', code: 'ST' },
    dphe:        { tab: 'sthe-tab',      name: 'Double Pipe Exchanger',  code: 'DP' },
    phe:         { tab: 'sthe-tab',      name: 'Plate Heat Exchanger',   code: 'PH' },
    tank:        { tab: 'tank-tab',      name: 'Storage Tank',           code: 'TK' },
    workbench:   { tab: 'workbench-tab', name: 'ARO Workbench',          code: 'WB' }
  };

  /* ── Design basis and assumptions ─────────────────────────────────────
     Written out per module, because "what did the software assume" is a
     question with a real answer and an engineer is entitled to it before
     they issue anything. Standards are cited by clause where the module
     actually applies a clause, and not where it does not — a citation that
     is decorative is worse than none. */
  var BASIS = {
    pump: {
      purpose: 'Sizes a centrifugal pump from the process duty: suction condition and NPSH available, '
             + 'differential head, hydraulic and shaft power, driver rating, and nozzle velocities.',
      standards: [
        ['API 610 / ISO 13709 cl. 6.1.6', 'NPSH margin — the greater of 1 m and 10 % of NPSHr'],
        ['API 610 cl. 6.1.7',  'Suction specific speed, and the recirculation limit it implies'],
        ['API 610 cl. 6.1.11', 'Minimum continuous stable flow, and continuous rise to shut-off'],
        ['API 610 cl. 6.1.4',  'Rated point held between 80 % and 110 % of best-efficiency flow'],
        ['API 610 Table 12',   'Driver power margin over rated pump power'],
        ['ANSI/HI 9.6.7',      'Viscous performance correction to head, flow and efficiency'],
        ['ASME B36.10M',       'Nozzle bores taken from standard-wall pipe schedules'],
        ['IEC 60072',          'Motor selected from the preferred rating series']
      ],
      assumptions: [
        'Steady-state, single-phase, incompressible flow at the stated density.',
        'Fluid density and viscosity are evaluated at the operating temperature and held constant '
          + 'through the pump; the temperature rise across the impeller is not modelled.',
        'Suction and discharge line losses are taken as entered. The software does not size the '
          + 'lines — use the Line Sizing module and bring the loss back here.',
        'Static head is measured from the low liquid level to the pump centreline. On a saturated '
          + 'suction the vapour pressure equals the suction pressure by definition, so vessel '
          + 'pressure cancels out of NPSHa and only elevation and line loss remain.',
        'NPSHr is a vendor number. Where none is entered it is predicted from suction specific '
          + 'speed as a screening figure and is flagged as such — it is not a rating.',
        'The pump curve, where predicted, is an affinity-scaled screening model. A vendor curve '
          + 'replaces it and changes the operating point.',
        'Efficiency is a correlation against specific speed and flow, corrected for viscosity '
          + 'when ν exceeds the ANSI/HI threshold.',
        'Motor efficiency and service factor are as entered; no derating for altitude, ambient '
          + 'temperature or starting method is applied.'
      ],
      limits: [
        'Single-phase liquid only — no flashing, no entrained gas, no slurry settling.',
        'Centrifugal machines. Positive-displacement duty is not covered.',
        'No transient, water-hammer, start-up or parallel-operation analysis.',
        'Nozzle sizing is by velocity band, not by nozzle-load or piping-stress analysis.'
      ]
    },
    line: {
      purpose: 'Sizes a process line to the velocity band for the service, the allowable pressure '
             + 'drop, and the erosional limit, and reports the pressure delivered at the far end.',
      standards: [
        ['API RP 14E',    'Erosional velocity limit, ρv² form, with the C factor stated per service'],
        ['ASME B36.10M / B36.19M', 'Pipe outside diameters and wall thicknesses by schedule'],
        ['Colebrook–White', 'Friction factor, solved iteratively; laminar below Re 2300'],
        ['Darcy–Weisbach', 'Straight-run friction loss'],
        ['Crane TP-410',  'Fitting and valve resistance coefficients (ΣK)'],
        ['NORSOK P-001',  'Velocity bands and momentum-flux screening by service']
      ],
      assumptions: [
        'Steady, fully developed, isothermal flow at the stated density and viscosity.',
        'Absolute roughness as entered; commercial steel is taken at 0.045 mm unless changed.',
        'Fittings are lumped into a single ΣK applied at the line velocity.',
        'Elevation change is applied as a static head at the flowing density.',
        'Gas and steam lines are treated as compressible only through the density supplied at the '
          + 'stated condition; where the pressure drop exceeds about 10 % of the inlet pressure, '
          + 'segment the line and re-run.',
        'Slurry duty applies a settling-velocity check in addition to the velocity band; the '
          + 'carrier properties are used for friction unless a slurry viscosity is entered.'
      ],
      limits: [
        'One straight run with lumped fittings — not a network solver.',
        'No thermal profile, no heat loss, no condensation along the run.',
        'No surge, no relief sizing, no flare backpressure.',
        'Two-phase flow uses a screening correlation and a flow-regime map; it does not replace '
          + 'a rigorous multiphase simulation.'
      ]
    },
    hx: {
      purpose: 'Thermal and hydraulic design of a heat exchanger: duty, LMTD and its correction, '
             + 'film coefficients, overall coefficient clean and dirty, surface required against '
             + 'surface provided, and pressure drop on both sides.',
      standards: [
        ['TEMA (10th ed.)', 'Shell and tube nomenclature, clearances and mechanical arrangement'],
        ['Kern',           'Shell-side film coefficient and pressure drop (screening method)'],
        ['Sieder–Tate',    'Tube-side film coefficient, turbulent, with viscosity correction'],
        ['Hausen',         'Tube-side film coefficient in the transitional and laminar range'],
        ['Bowman/Mueller/Nagle', 'LMTD correction factor F for multipass arrangements'],
        ['TEMA Table RGP-T-2.4', 'Fouling resistances where the default values are used'],
        ['ASME B36.10M',   'Nozzle and pipe bores']
      ],
      assumptions: [
        'Steady state, no phase change unless the duty is entered as latent.',
        'Physical properties are constant, evaluated at the mean bulk temperature of each stream.',
        'No heat loss to ambient — the two duties are taken as equal.',
        'Fouling resistances are as entered; the design coefficient is the clean coefficient '
          + 'degraded by them, and the excess area follows directly from that.',
        'Shell-side film coefficient by Kern is a screening method: it does not resolve leakage '
          + 'and bypass streams the way a Bell–Delaware analysis does, and it is normally '
          + 'conservative on ho and optimistic on shell-side ΔP.',
        'Pressure drops exclude nozzle losses unless nozzle sizes are entered.',
        'Wall resistance uses the tube or inner-pipe wall thickness and the stated conductivity.'
      ],
      limits: [
        'Thermal and hydraulic design only. No mechanical design, no tube-sheet thickness, no '
          + 'expansion joint, no vibration analysis.',
        'No condensing or boiling correlations — a two-phase duty needs a specialist method.',
        'No temperature cross beyond what the F correction permits; F below 0.75 is reported as '
          + 'a design that should be re-arranged, not accepted.'
      ]
    },
    tank: {
      purpose: 'Sizes an atmospheric or low-pressure storage tank: capacity, shell course '
             + 'thicknesses, roof and bottom arrangement, and the venting the duty calls for.',
      standards: [
        ['API 650',      'Welded tanks for oil storage — shell thickness by the one-foot method'],
        ['API 650 App. E', 'Seismic considerations where a zone is entered'],
        ['API 2000',      'Venting: normal thermal in-breathing and out-breathing, and emergency'],
        ['ASME B96.1',    'Aluminium dome roofs, where selected'],
        ['NFPA 30',       'Separation and diking where a flammable service is entered']
      ],
      assumptions: [
        'Vertical cylindrical tank on a flat foundation, atmospheric or low pressure.',
        'Product density and design temperature as entered; corrosion allowance added to the '
          + 'calculated thickness, not included in it.',
        'The one-foot method applies to tanks up to 60 m diameter; above that the variable-design-'
          + 'point method governs and this result is a screening figure.',
        'Wind and seismic are screening checks only where entered.'
      ],
      limits: [
        'No detailed foundation, anchorage, or settlement analysis.',
        'No pressure-vessel design — API 620 and ASME VIII duties are out of scope.',
        'Venting is sized to API 2000 for the stated duty; fire-case relief needs the exposed '
          + 'wetted-area basis confirmed against the installed layout.'
      ]
    },
    workbench: {
      purpose: 'Draughting environment for P&ID, 2D general arrangement and 3D layout. It records '
             + 'and presents a design; it does not calculate one.',
      standards: [
        ['ISA-5.1',  'Instrumentation symbols and identification'],
        ['ISO 10628', 'Diagrams for the chemical and petrochemical industry'],
        ['ASME Y14.5', 'Dimensioning and tolerancing conventions on the 2D sheet']
      ],
      assumptions: [
        'The drawing carries whatever the engineer places on it. Equipment dropped from the '
          + 'library has nominal geometry only until it is linked to a sized design.',
        'Line numbers, tags and stream data are recorded as entered — they are not validated '
          + 'against the sizing modules unless the item is linked to one.'
      ],
      limits: [
        'Not a calculation module: nothing on the sheet is checked against a standard.',
        '3D geometry is schematic and is not suitable for clash detection or fabrication.'
      ]
    }
  };
  function basisFor(id) {
    if (BASIS[id]) return BASIS[id];
    if (/^line-/.test(id)) return BASIS.line;
    if (id === 'sthe' || id === 'dphe' || id === 'phe') return BASIS.hx;
    return null;
  }

  /* ── Published designs ────────────────────────────────────────────────
     PUB[moduleId] = { checks, values, at, version, trace }.
     A check is { key, label, detail, status } where status is one of
     pass | warn | fail | info. */
  var PUB = {};
  var LAST_TAB_MODULE = {};        // tabId -> moduleId that last produced a result
  var STALE = {};                  // moduleId -> inputs edited since it last ran
  var CALCV = {};                  // moduleId -> calculation version counter

  var PROJECT = {
    id: null, name: 'UNTITLED', rev: 'A', client: '', engineer: '', note: '',
    created: null, modified: null, dirty: false
  };

  /* ── small helpers ────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function now() { return new Date(); }
  function hhmmss(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function isoDate(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function activeTab() {
    var t = document.querySelector('.tab-content.active');
    return t ? t.id : 'pump-tab';
  }
  /* The module whose result the bar is describing: the one that last ran on
     the tab you are looking at. Before anything has run, the tab's first
     module stands in so the basis and assumptions are still reachable. */
  /* Several modules share one tab: three exchangers on the heat-exchanger
     tab, five services on the line tab. Each keeps its own sub-panel and only
     one is ever on screen, so the panel that is displayed IS the module the
     engineer is working in. */
  var MODULE_PANEL = {
    sthe: '#sthe-sub', dphe: '#dphe-sub', phe: '#phe-sub',
    'line-liquid': '#line-liquid-content', 'line-gas': '#line-gas-content',
    'line-steam': '#line-steam-content', 'line-slurry': '#line-slurry-content',
    'line-twophase': '#line-twophase-content'
  };

  function activeModule() {
    var tab = activeTab();
    /* What is ON SCREEN decides. This used to answer with whichever module
       last produced a result on the tab, which meant that after running the
       plate exchanger, opening the 2D drawing while looking at the double
       pipe gave you the plate exchanger's sheet — or told you no drawing
       existed for a module that has one. The engineer's own view is not a
       tie-breaker; it is the answer. */
    var visible = [];
    for (var m in MODULES) {
      if (MODULES[m].tab !== tab) continue;
      var sel = MODULE_PANEL[m];
      if (!sel) continue;
      var el = null;
      try { el = document.querySelector(sel); } catch (e) {}
      if (el && el.offsetParent !== null) visible.push(m);
    }
    if (visible.length === 1) return visible[0];
    /* Two panels visible at once means the page is mid-transition, or this
       tab does not partition that way — fall back to what last ran. */
    if (LAST_TAB_MODULE[tab] && MODULES[LAST_TAB_MODULE[tab]]) {
      if (!visible.length || visible.indexOf(LAST_TAB_MODULE[tab]) >= 0) return LAST_TAB_MODULE[tab];
    }
    if (visible.length) return visible[0];
    for (var k in MODULES) if (MODULES[k].tab === tab) return k;
    return 'pump';
  }
  function tally(checks) {
    var t = { pass: 0, warn: 0, fail: 0, info: 0 };
    (checks || []).forEach(function (c) { t[c.status] = (t[c.status] || 0) + 1; });
    return t;
  }
  function verdict(t) { return t.fail ? 'fail' : (t.warn ? 'warn' : (t.pass ? 'pass' : 'none')); }

  /* ── Harvest: modules that render verdicts but publish nothing ────────
     Five of the modules draw their design validation as a row per check —
     a label, a verdict, and a class that says which. Reading those rows is
     not elegant, but it is the difference between a status system that
     covers the whole suite and one that covers the two modules that happened
     to expose an object. The published route is preferred wherever it
     exists; this only fills the gaps. */
  function harvest(tab) {
    var root = $(tab);
    if (!root) return [];
    var rows = root.querySelectorAll('.aln-rr, .tk-rr, .tp2-rr, .pid-rr');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.offsetParent === null) continue;                 // not on screen: not this service
      var lab = r.querySelector('span'), val = r.querySelector('b');
      if (!lab || !val) continue;
      var txt = (val.textContent || '').trim().toUpperCase();
      /* Only rows that actually state a verdict are checks. The same row
         class is used for plain reported values, and counting those as
         passes would inflate every design to green. */
      if (!/^(PASS|FAIL|OK|WARN|WARNING|MARGINAL|REVIEW)$/.test(txt)) continue;
      var st = /FAIL/.test(txt) ? 'fail'
             : (/WARN|MARGINAL|REVIEW/.test(txt) ? 'warn'
             : (r.classList.contains('warn') ? 'fail' : (r.classList.contains('mid') ? 'warn' : 'pass')));
      var full = (lab.textContent || '').trim();
      var dash = full.indexOf(' — ');
      out.push({
        key: 'h' + i,
        label: dash > 0 ? full.slice(0, dash) : full,
        detail: dash > 0 ? full.slice(dash + 3) : '',
        status: st
      });
    }
    /* the pump's own headline banner is a check in its own right */
    var ban = root.querySelector('.status-banner');
    if (ban && ban.offsetParent !== null) {
      var msg = ban.querySelector('.banner-message');
      if (msg && (msg.textContent || '').trim()) {
        out.unshift({
          key: 'banner', label: 'Overall design status', detail: msg.textContent.trim(),
          status: ban.classList.contains('banner-red') ? 'fail'
                : (ban.classList.contains('banner-amber') ? 'warn' : 'pass')
        });
      }
    }
    return out;
  }

  function checksFor(id) {
    /* A verdict count is a claim that the design was judged. If the
       calculation state says nothing has been calculated, there is nothing to
       count — otherwise the same strip reads "DESIGN STATUS 11 PASS" next to
       "RESULT — NOT CALCULATED", which are not both true. The published
       checks are kept; they simply are not reported until a calculation
       stands behind them. */
    var st = window.AROSTATE;
    if (st && st.modules && st.modules().indexOf(id) >= 0 && !st.isCalculated(id)) return [];
    var p = PUB[id];
    if (p && p.checks && p.checks.length) return p.checks;
    return harvest(MODULES[id] ? MODULES[id].tab : activeTab());
  }

  /* ═══ 1 · THE ENGINEERING BAR ═══════════════════════════════════════ */
  var BAR_CSS = [
    '.aro-ebar{display:flex;flex-direction:column;padding:0;flex:0 0 auto;',
    '  background:var(--bg-panel);border-bottom:1px solid var(--border-muted);',
    '  font-family:var(--font-mono);font-size:10px;color:var(--text-muted);',
    '  user-select:none;z-index:9;}',
    '.aro-eb-row{display:flex;align-items:center;gap:10px;padding:0 14px;height:29px;',
    '  overflow-x:auto;overflow-y:hidden;white-space:nowrap;}',
    '.aro-eb-row:first-child{border-bottom:1px solid var(--border-muted);}',
    '.aro-eb-row::-webkit-scrollbar{height:0;}',
    '.aro-eb-grp{display:flex;align-items:center;gap:6px;flex:0 0 auto;}',
    '.aro-eb-sep{width:1px;height:16px;background:var(--border-muted);flex:0 0 auto;}',
    '.aro-eb-k{letter-spacing:.10em;color:var(--text-muted);font-size:9px;font-weight:700;}',
    '.aro-eb-v{color:var(--text-header);font-weight:700;}',
    '.aro-eb-btn{background:transparent;border:1px solid var(--border-muted);color:var(--text-main);',
    '  font-family:var(--font-mono);font-size:9px;font-weight:700;letter-spacing:.06em;',
    '  padding:3px 8px;border-radius:3px;cursor:pointer;flex:0 0 auto;}',
    '.aro-eb-btn:hover{border-color:var(--color-saffron);color:var(--color-saffron);}',
    '.aro-eb-btn.on{border-color:var(--color-saffron);color:var(--color-saffron);}',
    '.aro-eb-st{display:flex;align-items:center;gap:8px;padding:2px 9px;border-radius:3px;',
    '  border:1px solid var(--border-muted);cursor:pointer;flex:0 0 auto;font-weight:700;}',
    '.aro-eb-st.pass{border-color:rgba(22,131,91,0.5);}',
    '.aro-eb-st.warn{border-color:rgba(183,121,31,0.55);}',
    '.aro-eb-st.fail{border-color:rgba(198,61,61,0.55);}',
    '.aro-eb-c-pass{color:var(--color-ok,#22c55e);}',
    '.aro-eb-c-warn{color:var(--color-warn,#f59e0b);}',
    '.aro-eb-c-fail{color:var(--color-fail,#ef4444);}',
    '.aro-eb-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:0 0 auto;}',
    '.aro-eb-right{margin-left:auto;display:flex;align-items:center;gap:10px;flex:0 0 auto;}',

    /* ── modal ── */
    '.aro-mod{position:fixed;inset:0;background:rgba(6,10,18,0.62);z-index:100000;display:flex;',
    '  align-items:center;justify-content:center;padding:24px;}',
    '.aro-mod-box{background:var(--bg-panel);border:1px solid var(--border-muted);border-radius:6px;',
    '  width:min(980px,96vw);max-height:88vh;display:flex;flex-direction:column;',
    '  box-shadow:0 18px 60px rgba(0,0,0,0.35);}',
    '.aro-mod-h{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;',
    '  border-bottom:1px solid var(--border-muted);font-family:var(--font-mono);font-size:12px;',
    '  font-weight:800;letter-spacing:.08em;color:var(--text-header);}',
    '.aro-mod-b{padding:16px;overflow:auto;font-family:var(--font-mono);font-size:11px;',
    '  color:var(--text-main);line-height:1.65;}',
    '.aro-mod-f{padding:10px 16px;border-top:1px solid var(--border-muted);display:flex;gap:8px;',
    '  justify-content:flex-end;flex-wrap:wrap;}',
    '.aro-x{background:transparent;border:1px solid var(--border-muted);color:var(--text-muted);',
    '  cursor:pointer;font-size:14px;line-height:1;padding:3px 8px;border-radius:3px;}',
    '.aro-x:hover{color:var(--color-fail,#ef4444);border-color:var(--color-fail,#ef4444);}',

    /* ── check list ── */
    '.aro-ck{display:flex;gap:10px;padding:8px 10px;border:1px solid var(--border-muted);',
    '  border-radius:4px;margin-bottom:6px;align-items:flex-start;}',
    '.aro-ck-b{flex:0 0 74px;font-size:9px;font-weight:800;letter-spacing:.08em;text-align:center;',
    '  padding:3px 0;border-radius:3px;border:1px solid currentColor;}',
    '.aro-ck-l{font-weight:700;color:var(--text-header);}',
    '.aro-ck-d{color:var(--text-muted);}',
    '.aro-ck-c{font-size:9px;color:var(--text-muted);letter-spacing:.06em;}',
    '.aro-sum{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;}',
    '.aro-sum div{flex:1 1 120px;border:1px solid var(--border-muted);border-radius:4px;padding:9px 11px;}',
    '.aro-sum b{display:block;font-size:20px;line-height:1.15;}',
    '.aro-sum span{font-size:9px;letter-spacing:.10em;color:var(--text-muted);}',

    /* ── document sections ── */
    '.aro-sec{margin:0 0 18px;}',
    '.aro-sec h4{font-size:10px;letter-spacing:.12em;color:var(--color-saffron);margin:0 0 8px;',
    '  font-weight:800;border-bottom:1px solid var(--border-muted);padding-bottom:5px;}',
    '.aro-sec ul{margin:0;padding-left:17px;}',
    '.aro-sec li{margin-bottom:5px;}',
    '.aro-tbl{width:100%;border-collapse:collapse;font-size:10px;}',
    '.aro-tbl th{text-align:left;padding:5px 7px;border:1px solid var(--border-muted);',
    '  font-size:9px;letter-spacing:.08em;color:var(--text-muted);font-weight:700;}',
    '.aro-tbl td{padding:5px 7px;border:1px solid var(--border-muted);vertical-align:top;}',
    '.aro-tbl td.n{text-align:right;font-variant-numeric:tabular-nums;}',
    '.aro-step{border:1px solid var(--border-muted);border-radius:4px;padding:9px 11px;margin-bottom:8px;}',
    '.aro-step .s1{font-size:9px;letter-spacing:.09em;color:var(--text-muted);font-weight:700;}',
    '.aro-step .s2{color:var(--color-saffron);margin:4px 0;font-size:11px;}',
    '.aro-step .s3{color:var(--text-main);}',
    '.aro-step .s4{color:var(--text-header);font-weight:700;margin-top:3px;}',
    '.aro-note{border-left:3px solid var(--color-saffron);padding:7px 11px;margin:10px 0;',
    '  font-size:10px;color:var(--text-muted);}',

    /* ── provenance ── */
    '.aro-prov-chip{display:inline-block;font-family:var(--font-mono);font-size:8px;font-weight:800;',
    '  letter-spacing:.07em;padding:1px 4px;border-radius:2px;margin-left:5px;vertical-align:middle;',
    '  border:1px solid currentColor;}',
    '.aro-prov-input{color:#d96b16;}',
    '.aro-prov-calc{color:#2563a6;}',
    '.aro-prov-sel{color:#16835b;}',
    '.aro-prov-def{color:#6b7280;}',
    'body:not(.theme-day) .aro-prov-input{color:#ff9d5c;}',
    'body:not(.theme-day) .aro-prov-calc{color:#60a5fa;}',
    'body:not(.theme-day) .aro-prov-sel{color:#4ade80;}',
    'body:not(.theme-day) .aro-prov-def{color:#94a3b8;}',

    /* ── project tree ── */
    '.aro-tree{border:1px solid var(--border-muted);border-radius:4px;overflow:hidden;}',
    '.aro-tree-r{display:flex;align-items:center;gap:9px;padding:7px 11px;cursor:pointer;',
    '  border-bottom:1px solid var(--border-muted);}',
    '.aro-tree-r:last-child{border-bottom:none;}',
    '.aro-tree-r:hover{background:rgba(217,107,22,0.07);}',
    '.aro-tree-r.sel{background:rgba(217,107,22,0.12);}',
    '.aro-tree-n{font-weight:700;color:var(--text-header);flex:1;}',
    '.aro-tree-m{font-size:9px;color:var(--text-muted);}',
    '.aro-kv{display:grid;grid-template-columns:150px 1fr;gap:5px 12px;font-size:11px;}',
    '.aro-kv>i{font-style:normal;color:var(--text-muted);font-size:9px;letter-spacing:.08em;}',
    '.aro-in{background:var(--bg-input);border:1px solid var(--border-muted);color:var(--text-header);',
    '  font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;width:100%;}'
  ].join('');

  function injectCss() {
    if ($('aro-eng-css')) return;
    var s = document.createElement('style');
    s.id = 'aro-eng-css';
    s.textContent = BAR_CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function buildBar() {
    if ($('aro-ebar')) return;
    var nav = document.querySelector('.terminal-nav');
    if (!nav || !nav.parentNode) return;
    var bar = document.createElement('div');
    bar.className = 'aro-ebar';
    bar.id = 'aro-ebar';
    nav.parentNode.insertBefore(bar, nav.nextSibling);
    renderBar();
  }

  function statusColourClass(v) {
    return v === 'fail' ? 'aro-eb-c-fail' : (v === 'warn' ? 'aro-eb-c-warn' : 'aro-eb-c-pass');
  }

  function renderBar() {
    var bar = $('aro-ebar');
    if (!bar) return;
    var id = activeModule(), m = MODULES[id] || { name: '—', code: '--' };
    var ck = checksFor(id), t = tally(ck), v = verdict(t);
    var p = PUB[id];
    var ran = p && p.at;
    var stt = window.AROSTATE;
    var known = stt && stt.modules && stt.modules().indexOf(id) >= 0;
    var live2 = known ? stt.state(id) : null;
    var engine = (known ? (live2 === 'NOT_CALCULATED' || live2 === 'ERROR') : !ran)
                 ? { dot: '#9ca3af', txt: 'NOT CALCULATED' }
               : ((known ? live2 === 'OUTDATED' : STALE[id])
                 ? { dot: '#b7791f', txt: 'INPUTS CHANGED — RECALCULATE' }
                 : { dot: '#16835b', txt: 'READY' });

    /* One project, one name. AROGARA PROJECT is the project of record once
       it is open; this bar's own lightweight workspace store stands in only
       when no project has been created. Showing both left the header saying
       UNTITLED over a screen headed "Water Transfer System". */
    var live = (window.AROPROJECT && window.AROPROJECT.isOpen()) ? window.AROPROJECT.project() : null;
    var pName = live ? (live.projectName || 'UNTITLED') : PROJECT.name;
    var pRev = live ? (live.revision || '0') : PROJECT.rev;
    var ctxObj = live && window.AROPROJECT.context();

    /* ── Two rows, because they answer two different questions ──────────
       Fifteen items in one strip is a list, not a header. Row 1 says WHAT
       design this is — project, tag, module, revision, calculation version
       and whether the result still matches its inputs. Row 2 is what you can
       DO with it. Scanning either one is now a single left-to-right read. */
    var st = window.AROSTATE, sState = st ? st.state(id) : null;
    var inputRev = st && st.inputRev ? st.inputRev(id) : 0;
    var resultTxt, resultCls;
    if (sState === 'OUTDATED') { resultTxt = '\u26a0 OUTDATED'; resultCls = 'aro-eb-c-warn'; }
    else if (sState === 'CALCULATED') { resultTxt = '\u2713 CURRENT'; resultCls = 'aro-eb-c-pass'; }
    else { resultTxt = '\u2014 NOT CALCULATED'; resultCls = ''; }

    var h = '';
    /* ── row 1 · identity ── */
    h += '<div class="aro-eb-row">';
    h += '<div class="aro-eb-grp"><span class="aro-eb-k">PROJECT</span>'
       + '<span class="aro-eb-v" id="aro-eb-proj">' + esc(pName) + (!live && PROJECT.dirty ? ' *' : '') + '</span></div>';
    if (ctxObj && ctxObj.tag) {
      h += '<div class="aro-eb-sep"></div>'
         + '<div class="aro-eb-grp"><span class="aro-eb-k">TAG</span>'
         + '<span class="aro-eb-v" style="color:var(--color-saffron);">' + esc(ctxObj.tag) + '</span></div>';
    }
    h += '<div class="aro-eb-sep"></div>'
       + '<div class="aro-eb-grp"><span class="aro-eb-k">MODULE</span><span class="aro-eb-v">'
       + esc(m.name) + '</span></div>';
    h += '<div class="aro-eb-sep"></div>'
       + '<div class="aro-eb-grp"><span class="aro-eb-k">REV</span><span class="aro-eb-v">' + esc(pRev) + '</span></div>';
    h += '<div class="aro-eb-grp"><span class="aro-eb-k">INPUT REV</span><span class="aro-eb-v">'
       + (inputRev < 10 ? '0' + inputRev : inputRev) + '</span></div>';
    h += '<div class="aro-eb-grp"><span class="aro-eb-k">CALC</span><span class="aro-eb-v">v'
       + (CALCV[id] || 0) + '</span></div>';
    h += '<div class="aro-eb-grp"><span class="aro-eb-k">RESULT</span>'
       + '<span class="aro-eb-v ' + resultCls + '">' + resultTxt + '</span></div>';
    h += '<div class="aro-eb-right">'
       + '<span class="aro-eb-dot" style="background:' + engine.dot + '"></span>'
       + '<span class="aro-eb-k">ENGINE</span><span class="aro-eb-v">' + engine.txt + '</span>'
       + '<span class="aro-eb-k">' + (ran ? 'LAST CALC ' + hhmmss(new Date(p.at)) : '') + '</span>'
       + '<span class="aro-eb-k">v' + ENGINE_VERSION + '</span>'
       + '</div>';
    h += '</div>';

    /* ── row 2 · controls ── */
    h += '<div class="aro-eb-row">';
    if (ck.length) {
      h += '<div class="aro-eb-st ' + v + '" id="aro-eb-status" title="Open the design status report">'
         + '<span class="aro-eb-c-pass">&#10003; ' + t.pass + '</span>'
         + '<span class="aro-eb-c-warn">&#9888; ' + (t.warn || 0) + '</span>'
         + '<span class="aro-eb-c-fail">&#10007; ' + (t.fail || 0) + '</span>'
         + '<span class="aro-eb-k">DESIGN STATUS</span></div>';
    } else {
      h += '<div class="aro-eb-st" id="aro-eb-status" title="Nothing has been calculated on this module yet">'
         + '<span class="aro-eb-k">&mdash; NOT CALCULATED</span></div>';
    }
    h += '<button class="aro-eb-btn" id="aro-eb-basis">BASIS</button>';
    h += '<button class="aro-eb-btn" id="aro-eb-assum">ASSUMPTIONS</button>';
    h += '<button class="aro-eb-btn" id="aro-eb-trace">CALCULATION</button>';
    h += '<button class="aro-eb-btn" id="aro-eb-dwg">2D DRAWING</button>';
    h += '<button class="aro-eb-btn" id="aro-eb-report">REPORT</button>';
    h += '<button class="aro-eb-btn' + (provOn ? ' on' : '') + '" id="aro-eb-prov" '
       + 'title="Badge every field as user input, calculated, or selected">PROVENANCE</button>';
    h += '<button class="aro-eb-btn" id="aro-eb-proj-btn">PROJECT</button>';
    /* The whole-workspace reset. Built here rather than appended afterwards:
       this bar replaces its own innerHTML on every module and status change,
       so a control added from outside disappeared a second later and was
       missing exactly when somebody reached for it. */
    h += '<button class="aro-eb-btn" id="aro-eb-sysreset" style="color:#f87171;" '
       + 'title="Clear every design module — and optionally everything stored in this browser">'
       + '\u21ba RESET SYSTEM</button>';
    /* ── The unit lock ────────────────────────────────────────────────
       The unit system is a property of the calculation record, not a view
       setting: change it half way through and every field on every tab is
       re-expressed, which is correct but is also the fastest way to make a
       checked design unrecognisable to the person checking it. Locking it
       does not change any number — it stops the system being changed by
       accident once a design exists. */
    h += '<div class="aro-eb-grp"><span class="aro-eb-k">UNITS</span>'
       + '<button class="aro-eb-btn' + (unitsLocked ? ' on' : '') + '" id="aro-eb-units" '
       + 'title="' + (unitsLocked ? 'Units are locked to ' + esc(unitSystemName()) + ' — click to unlock'
                                  : 'Lock the unit system so it cannot be changed by accident') + '">'
       + (unitsLocked ? '&#128274; ' : '') + esc(shortUnits()) + '</button></div>';
    h += '</div>';

    bar.innerHTML = h;

    bind('aro-eb-status', openStatus);
    bind('aro-eb-basis', openBasis);
    bind('aro-eb-assum', openAssumptions);
    bind('aro-eb-trace', openTrace);
    bind('aro-eb-report', openReport);
    bind('aro-eb-dwg', function () { if (window.ARODWG) window.ARODWG.open(activeModule()); });
    bind('aro-eb-sysreset', function () { if (window.AROSYSRESET) window.AROSYSRESET.open(); });
    bind('aro-eb-prov', toggleProvenance);
    bind('aro-eb-proj-btn', function () {
      /* the workspace store is the fallback; the project tab is the real one */
      var t = document.querySelector('.nav-tab[data-tab="project-tab"]');
      if (t) { t.click(); return; }
      openProject();
    });
    bind('aro-eb-units', toggleUnitLock);
  }
  function bind(id, fn) { var e = $(id); if (e) e.onclick = fn; }

  /* ═══ 2 · MODAL ════════════════════════════════════════════════════ */
  function modal(title, bodyHtml, footer) {
    closeModal();
    var w = document.createElement('div');
    w.className = 'aro-mod';
    w.id = 'aro-mod';
    w.innerHTML = '<div class="aro-mod-box"><div class="aro-mod-h"><span>' + esc(title) + '</span>'
      + '<button class="aro-x" id="aro-mod-x">&#10005;</button></div>'
      + '<div class="aro-mod-b">' + bodyHtml + '</div>'
      + (footer ? '<div class="aro-mod-f">' + footer + '</div>' : '') + '</div>';
    document.body.appendChild(w);
    $('aro-mod-x').onclick = closeModal;
    w.addEventListener('mousedown', function (e) { if (e.target === w) closeModal(); });
    return w;
  }
  function closeModal() { var m = $('aro-mod'); if (m) m.remove(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ═══ 3 · DESIGN STATUS ════════════════════════════════════════════ */
  var BADGE = {
    pass: ['PASS', 'aro-eb-c-pass'], warn: ['WARNING', 'aro-eb-c-warn'],
    fail: ['FAIL', 'aro-eb-c-fail'], info: ['NOTE', 'aro-eb-c-pass']
  };
  function checkList(ck) {
    if (!ck.length) return '<div class="aro-note">Nothing has been calculated on this module yet. '
      + 'Run the design and the checks will be listed here.</div>';
    var order = { fail: 0, warn: 1, info: 2, pass: 3 };
    var s = ck.slice().sort(function (a, b) { return order[a.status] - order[b.status]; });
    return s.map(function (c) {
      var b = BADGE[c.status] || BADGE.info;
      return '<div class="aro-ck"><div class="aro-ck-b ' + b[1] + '">' + b[0] + '</div><div>'
        + '<div class="aro-ck-l">' + esc(c.label) + '</div>'
        + (c.detail ? '<div class="aro-ck-d">' + esc(c.detail) + '</div>' : '')
        + (c.clause ? '<div class="aro-ck-c">' + esc(c.clause) + (c.cite ? ' — ' + esc(c.cite) : '') + '</div>' : '')
        + '</div></div>';
    }).join('');
  }
  function openStatus() {
    var id = activeModule(), ck = checksFor(id), t = tally(ck);
    var m = MODULES[id];
    var head = '<div class="aro-sum">'
      + '<div><b class="aro-eb-c-pass">' + t.pass + '</b><span>CHECKS PASSED</span></div>'
      + '<div><b class="aro-eb-c-warn">' + (t.warn || 0) + '</b><span>WARNINGS</span></div>'
      + '<div><b class="aro-eb-c-fail">' + (t.fail || 0) + '</b><span>CRITICAL FAILURES</span></div>'
      + '<div><b>' + (CALCV[id] || 0) + '</b><span>CALCULATION VERSION</span></div>'
      + '</div>';
    var v = verdict(t);
    var verdictLine = v === 'fail'
      ? 'This design does not satisfy every check. The failures below have to be resolved or '
        + 'formally dispositioned before the design is issued.'
      : v === 'warn'
        ? 'Every critical check is satisfied. The warnings below are judgement calls — read them '
          + 'and decide, rather than accepting them by default.'
        : v === 'pass'
          ? 'Every check is satisfied at the current inputs.'
          : 'No verdicts to report yet.';
    modal('DESIGN STATUS — ' + (m ? m.name : ''),
      head + '<div class="aro-note">' + verdictLine + '</div>' + checkList(ck),
      '<button class="aro-eb-btn" onclick="window.AROENG.report()">GENERATE DESIGN REPORT</button>');
  }

  /* ═══ 4 · BASIS / ASSUMPTIONS ══════════════════════════════════════ */
  function basisHtml(id) {
    var b = basisFor(id);
    if (!b) return '<div class="aro-note">No design basis is registered for this module.</div>';
    var h = '<div class="aro-sec"><h4>PURPOSE</h4><div>' + esc(b.purpose) + '</div></div>';
    h += '<div class="aro-sec"><h4>STANDARDS AND METHODS APPLIED</h4><table class="aro-tbl">'
       + '<tr><th style="width:230px;">REFERENCE</th><th>WHAT IT GOVERNS HERE</th></tr>'
       + b.standards.map(function (r) {
           return '<tr><td><b>' + esc(r[0]) + '</b></td><td>' + esc(r[1]) + '</td></tr>';
         }).join('') + '</table></div>';
    h += '<div class="aro-sec"><h4>UNITS</h4><div>Working units: <b>'
       + esc(unitSystemName()) + '</b>. Every quantity is converted to SI internally, calculated in '
       + 'SI, and converted back for display — so changing the unit system changes the presentation '
       + 'and never the result.</div></div>';
    return h;
  }
  var unitsLocked = false;
  try { unitsLocked = localStorage.getItem('aro_units_locked_v1') === '1'; } catch (e) {}
  var SHORT_UNITS = { 'SI': 'SI', 'US': 'US', 'CGS': 'MIXED', 'SI-KPA': 'SI·kPa' };
  function shortUnits() {
    var sel = $('global-unit-system');
    var v = sel ? sel.value : (window.activeUnitSystem || 'SI');
    return SHORT_UNITS[v] || v;
  }
  function applyUnitLock() {
    var sel = $('global-unit-system');
    if (!sel) return;
    sel.disabled = unitsLocked;
    sel.title = unitsLocked
      ? 'Locked to ' + unitSystemName() + '. Unlock from the UNITS button on the engineering bar.'
      : '';
    sel.style.opacity = unitsLocked ? '0.6' : '';
    sel.style.cursor = unitsLocked ? 'not-allowed' : '';
  }
  function toggleUnitLock() {
    unitsLocked = !unitsLocked;
    try { localStorage.setItem('aro_units_locked_v1', unitsLocked ? '1' : '0'); } catch (e) {}
    applyUnitLock();
    renderBar();
    toast(unitsLocked
      ? 'Units locked to ' + unitSystemName() + '. No number has changed — the system simply cannot '
        + 'be switched now without unlocking it first.'
      : 'Units unlocked. Changing the system re-expresses every field on every tab.');
  }

  function unitSystemName() {
    var sel = $('global-unit-system');
    if (sel && sel.options[sel.selectedIndex]) return sel.options[sel.selectedIndex].text;
    return window.activeUnitSystem || 'SI';
  }
  function openBasis() {
    var id = activeModule();
    modal('ENGINEERING BASIS — ' + (MODULES[id] ? MODULES[id].name : ''), basisHtml(id));
  }
  function openAssumptions() {
    var id = activeModule(), b = basisFor(id);
    if (!b) { modal('DESIGN ASSUMPTIONS', '<div class="aro-note">None registered.</div>'); return; }
    var h = '<div class="aro-note">These are the assumptions the calculation is built on. Where one '
      + 'of them does not hold for your duty, the result is not wrong so much as inapplicable — '
      + 'read them before issuing anything.</div>';
    h += '<div class="aro-sec"><h4>ENGINEERING ASSUMPTIONS</h4><ul>'
       + b.assumptions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="aro-sec"><h4>OUT OF SCOPE</h4><ul>'
       + b.limits.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
    modal('DESIGN ASSUMPTIONS — ' + MODULES[id].name, h);
  }

  /* ═══ 5 · CALCULATION TRACE ════════════════════════════════════════
     A trace is the working: the equation as it is written in the reference,
     the same equation with this design's numbers substituted, and the result.
     Modules that publish a trace supply their own; for the rest it is derived
     here from the data they already publish, which is exactly the same
     arithmetic and avoids nine parallel implementations drifting apart. */
  function num(v, dp) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(3);
    return v.toFixed(dp == null ? 3 : dp);
  }
  function step(title, formula, subst, result, note) {
    return { title: title, formula: formula, subst: subst, result: result, note: note };
  }

  function pumpTrace() {
    var s = window.state && window.state.pump;
    if (!s || !s.calculated) return null;
    var i = s.inputs, r = s.results, T = [];
    var g = 9.80665;
    T.push(step('1 · Design flow',
      'Q_design = Q_normal × (1 + margin/100)',
      num(i.volFlowM3hr, 2) + ' m³/h with a ' + num(i.margin, 1) + ' % design margin',
      num(r.designVolFlow, 2) + ' m³/h',
      'API 610 cl. 6.1.2 — the rated point sits above the normal duty.'));
    T.push(step('2 · Vapour pressure at the suction condition',
      i.fluidState === 'saturated' ? 'P_v = P_suction  (saturated liquid)' : 'P_v = f(T) — Antoine',
      i.fluidState === 'saturated'
        ? 'the liquid is at its bubble point, so P_v and the vessel pressure are the same number ('
          + num(r.pVapBarA, 4) + ' bar a) and cancel out of NPSHa'
        : 'T = ' + num(i.tempMaxC, 1) + ' °C → P_v = ' + num(r.pVapBarA, 4) + ' bar a',
      num(r.pVapBarA, 4) + ' bar a  =  ' + num(r.pVapM, 3) + ' m',
      i.vpBasis));
    T.push(step('3 · Suction pressure at the pump flange',
      'P_suction = P_vessel + ρ g H_s − ΔP_suction     (worked in bar absolute)',
      'H_s = low liquid level ' + num(i.lll, 3) + ' m − pump centreline ' + num(i.zPump, 3) + ' m = '
        + num(r.Hs, 3) + ' m, so the static term is ' + num(r.staticHeadBar, 4) + ' bar; the suction '
        + 'line loss is ' + num(i.sucDp, 4) + ' bar',
      num(r.vesselPressA, 4) + ' + ' + num(r.staticHeadBar, 4) + ' − ' + num(i.sucDp, 4) + ' = '
        + num(r.pSucA, 4) + ' bar a  (' + num(r.hSuc, 3) + ' m of liquid)',
      'The suction line loss is a PRESSURE, not a head — it is entered and carried in bar.'));
    T.push(step('4 · NPSH available',
      'NPSHa = (P_suction − P_v) / (ρ g)',
      num(r.hSuc, 3) + ' m from the flange pressure, less the vapour pressure head '
        + num(r.pVapM, 3) + ' m at ρ = ' + num(i.rho, 1) + ' kg/m³',
      num(r.npsha, 3) + ' m',
      i.fluidState === 'saturated'
        ? 'Saturated suction: P_v equals the vessel pressure, so vessel pressure cancels and only '
          + 'elevation and line loss are left to provide the margin.'
        : ''));
    T.push(step('5 · NPSH margin',
      'margin = NPSHa − NPSHr,   required ≥ max(1 m, 0.10 × NPSHr)',
      num(r.npsha, 3) + ' − ' + num(i.npshr, 3) + ' = ' + num(r.npshMargin, 3)
        + ' m against a requirement of ' + num(r.npshReq, 3) + ' m',
      num(r.npshMargin, 3) + ' m — ' + (r.npshCodeOk ? 'satisfied' : 'NOT satisfied'),
      'API 610 / ISO 13709 cl. 6.1.6.'));
    T.push(step('6 · Differential head',
      'H = (P_discharge − P_suction) / (ρ g)',
      '(' + num(r.pDischA, 4) + ' − ' + num(r.pSucA, 4) + ') bar at ρ = ' + num(i.rho, 1) + ' kg/m³',
      num(r.diffHeadCal, 3) + ' m'));
    T.push(step('7 · Hydraulic power',
      'P_hyd = ρ g Q H / 3.6×10⁶',
      num(i.rho, 1) + ' × ' + g.toFixed(3) + ' × ' + num(r.designVolFlow, 2) + ' × ' + num(r.diffHeadCal, 2),
      num(r.hydPower, 3) + ' kW'));
    T.push(step('8 · Shaft power',
      'P_shaft = P_hyd / η_pump',
      num(r.hydPower, 3) + ' kW / ' + num(r.pumpEff, 1) + ' %',
      num(r.bhp, 3) + ' kW',
      (r.visc && r.visc.applies)
        ? 'Efficiency corrected for viscosity to ANSI/HI 9.6.7: ' + num(r.pumpEffWater, 1)
          + ' % on water → ' + num(r.pumpEffVisc, 1) + ' % at ' + num(r.nu_cSt, 1) + ' cSt.'
        : 'No viscous correction — ν = ' + num(r.nu_cSt, 1) + ' cSt is below the ANSI/HI threshold.'));
    T.push(step('9 · Driver rating',
      'P_motor = P_shaft × margin, then rounded up to the preferred series',
      num(r.bhp, 3) + ' kW × ' + num(r.usedMarginFactor, 2) + ' → ' + num(r.motorSelKw, 2) + ' kW',
      num(r.stdMotorKw, 2) + ' kW at ' + num(r.motorLoading, 1) + ' % loading',
      'API 610 Table 12 band: ' + (r.apiMarginBand || '—') + '; IEC 60072 preferred ratings.'));
    T.push(step('10 · Specific speed and the suction limit',
      'Ns = N√Q / H^0.75  ·  Nss = N√Q / NPSHr^0.75',
      'N = ' + num(r.pumpSpeedRpm, 0) + ' rpm, Q = ' + num(r.designVolFlow, 2) + ' m³/h, H = '
        + num(r.diffHeadCal, 2) + ' m, NPSHr = ' + num(i.npshr, 2) + ' m',
      'Ns = ' + num(r.Ns, 0) + ' (' + (r.NsType || '—') + '), Nss = ' + num(r.Nss, 0) + ' (US units)',
      'API 610 cl. 6.1.7. Minimum continuous stable flow follows from Nss: '
        + num(r.mcsfFlow, 2) + ' m³/h, ' + num((r.mcsfFrac || 0) * 100, 0) + ' % of rated.'));
    T.push(step('11 · Nozzle sizing',
      'A = Q / v, then the next standard bore that keeps v in band',
      'suction target ' + num(i.targetSucVel, 2) + ' m/s, discharge target ' + num(i.targetDisVel, 2) + ' m/s',
      'suction NPS ' + (r.sucNozzle ? r.sucNozzle.nps : '—') + ' at ' + num(r.velSuc, 2)
        + ' m/s, discharge NPS ' + (r.disNozzle ? r.disNozzle.nps : '—') + ' at ' + num(r.velDis, 2) + ' m/s',
      'Bores from ASME B36.10M standard wall.'));
    return T;
  }

  function lineTrace(id) {
    /* The line modules hand over their own result object, so the trace is
       the very arithmetic that produced the panel. The legacy
       window.lineReportData is the fallback for the older liquid path. */
    var r = (PUB[id] && PUB[id].values) || null;
    if (r && isFinite(r.V)) {
      var T = [];
      T.push(step('1 · Bore and flow area',
        'A = π D² / 4',
        'NPS ' + r.nps + '" sch ' + r.sch + ' → ID ' + num(r.Dmm, 2) + ' mm in ' + (r.matName || 'CS'),
        'A = ' + num(Math.PI * r.D * r.D / 4, 6) + ' m²',
        'Bore from ASME B36.10M.'));
      T.push(step('2 · Velocity',
        'v = Q / A',
        'Q = ' + num(r.Q, 5) + ' m³/s at ρ = ' + num(r.rho, 2) + ' kg/m³ (ṁ = ' + num(r.W, 3) + ' kg/s)',
        num(r.V, 3) + ' m/s',
        'Service band ' + num(r.vMin, 2) + '–' + num(r.vMax, 2) + ' m/s for ' + (r.svc || 'this service') + '.'));
      T.push(step('3 · Reynolds number and flow regime',
        'Re = ρ v D / μ',
        num(r.rho, 2) + ' × ' + num(r.V, 3) + ' × ' + num(r.D, 5) + ' / ' + num(r.mu, 6),
        'Re = ' + num(r.Re, 0) + ' — ' + (r.flow || '')));
      T.push(step('4 · Friction factor',
        '1/√f = −2 log₁₀( ε/3.7D + 5.74/Re^0.9 )   — Swamee–Jain form of Colebrook–White',
        'ε = ' + num(r.eps, 4) + ' mm, ε/D = ' + num(r.relRough, 6)
          + (r.Re < 2100 ? ' — laminar, so f = 64/Re' : ''),
        'f = ' + num(r.f, 5)));
      T.push(step('5 · Straight-run friction loss',
        'ΔP = f (L/D) (ρ v² / 2)   — Darcy–Weisbach',
        'L = ' + num(r.L, 2) + ' m, D = ' + num(r.D, 5) + ' m, v = ' + num(r.V, 3) + ' m/s',
        num(r.dpFricPa / 1e5, 5) + ' bar  (head loss ' + num(r.headLoss, 3) + ' m)'));
      T.push(step('6 · Fittings and static head',
        'ΔP_fit = ΣK (ρ v² / 2)   ·   ΔP_static = ρ g Δz',
        'ΣK = ' + num(r.sumK, 2) + ' over ' + ((r.fitList && r.fitList.length) || 0)
          + ' fitting types, Δz = ' + num(r.dz, 2) + ' m',
        'fittings ' + num(r.dpFitPa / 1e5, 5) + ' bar, static ' + num(r.dpStatPa / 1e5, 5) + ' bar'));
      T.push(step('7 · Total drop and what is left downstream',
        'ΔP_total = ΔP_friction + ΔP_fittings + ΔP_static + ΔP_equipment',
        'upstream ' + num(r.pUp, 3) + ' bar'
          + (isFinite(r.dpAllow) ? ', allowance ' + num(r.dpAllow, 4) + ' bar' : ', no stated allowance'),
        num(r.dpTotal, 5) + ' bar total; ' + num(r.pDown, 4) + ' bar remains at the far end'));
      T.push(step('8 · Erosional velocity',
        'v_e = C / √ρ   — API RP 14E',
        'C = ' + num(r.C, 1) + ' (' + num(r.pct, 0) + ' % of v_e taken as the design allowable), ρ = '
          + num(r.rho, 2) + ' kg/m³',
        'v_e = ' + num(r.Ve, 3) + ' m/s, allowable ' + num(r.Vallow, 3) + ' m/s against '
          + num(r.V, 3) + ' m/s — ' + (r.eroOk ? 'within limit' : 'EXCEEDED')));
      if (r.mom && isFinite(r.mom.momentumFlux)) {
        T.push(step('9 · Momentum flux',
          'ρv² — erosion and noise screening',
          'ρ = ' + num(r.rho, 2) + ' kg/m³ at v = ' + num(r.V, 3) + ' m/s',
          num(r.mom.momentumFlux / 1000, 2) + ' kPa against a limit of '
            + num((r.mom.limitPa || 0) / 1000, 2) + ' kPa',
          r.mom.basis || ''));
      }
      return T;
    }
    var d = window.lineReportData;
    if (!d) return null;
    return [
      step('1 · Velocity', 'v = Q / A',
        'NPS ' + d.nps + '" sch ' + d.schedule + ', ID ' + num(d.id_mm, 2) + ' mm, ρ = ' + num(d.density, 2) + ' kg/m³',
        num(d.velocity, 3) + ' m/s'),
      step('2 · Reynolds number', 'Re = ρ v D / μ',
        'μ = ' + num(d.viscosity, 6) + ' Pa·s', 'Re = ' + num(d.re, 0) + ' — ' + (d.regime || '')),
      step('3 · Friction loss', 'ΔP = f (L/D) (ρ v² / 2)',
        'f = ' + num(d.f, 5) + ', L = ' + num(d.length, 2) + ' m', num(d.dpMajor / 1e5, 5) + ' bar'),
      step('4 · Total drop', 'ΔP_total = friction + fittings + static',
        'ΣK = ' + num(d.sumK, 2) + ', Δz = ' + num(d.elevation, 2) + ' m',
        num(d.dpTotal / 1e5, 5) + ' bar'),
      step('5 · Erosional velocity', 'v_e = C / √ρ  — API RP 14E',
        'ρ = ' + num(d.density, 2) + ' kg/m³',
        'allowable ' + num(d.vErosion, 3) + ' m/s — ' + (d.erosionStatus || ''))
    ];
  }

  function dpheTrace() {
    var d = window.dpheReportData;
    if (!d) return null;
    var T = [];
    T.push(step('1 · Duty',
      'Q = ṁ c_p ΔT',
      'cold side: ' + num(d.mc, 3) + ' kg/s × ' + num(d.Cpc, 3) + ' kJ/kg·K × ('
        + num(d.Tco, 2) + ' − ' + num(d.Tci, 2) + ') K',
      num(d.Q, 3) + ' kW',
      'The hot-side duty is taken as equal — no loss to ambient is modelled.'));
    T.push(step('2 · Log mean temperature difference',
      'LMTD = (ΔT₁ − ΔT₂) / ln(ΔT₁/ΔT₂)',
      'counter-current: ΔT₁ = ' + num(d.Thi - d.Tco, 2) + ' K, ΔT₂ = ' + num(d.Tho - d.Tci, 2) + ' K',
      num(d.LMTD, 3) + ' K'));
    T.push(step('3 · Tube-side film coefficient',
      'Nu = 0.027 Re^0.8 Pr^(1/3) (μ/μ_w)^0.14   — Sieder–Tate',
      'Re = ' + num(d.Re_t, 0) + ', Pr = ' + num(d.Pr_h, 3),
      'Nu = ' + num(d.Nu_h, 2) + ' → h_io = ' + num(d.hio, 1) + ' W/m²·K',
      'Referred to the outside area of the inner pipe.'));
    T.push(step('4 · Annulus film coefficient',
      'Nu = 0.027 Re^0.8 Pr^(1/3), on the equivalent diameter D_e',
      'D_e = ' + num(d.De, 5) + ' m, Re = ' + num(d.Re_a, 0) + ', Pr = ' + num(d.Pr_c, 3),
      'Nu = ' + num(d.Nu_c, 2) + ' → h_o = ' + num(d.ho, 1) + ' W/m²·K',
      'The heat-transfer equivalent diameter is used for h and the hydraulic one for ΔP — they '
        + 'are different numbers and using one for both is a common error.'));
    T.push(step('5 · Overall coefficient',
      '1/U_d = 1/h_io + 1/h_o + R_di + R_do + wall',
      'R_di = ' + num(d.Rdi, 5) + ', R_do = ' + num(d.Rdo, 5) + ' m²·K/W, k_wall = ' + num(d.kw, 2) + ' W/m·K',
      'U_c = ' + num(d.Uc, 1) + ' clean, U_d = ' + num(d.Ud, 1) + ' W/m²·K dirty'));
    T.push(step('6 · Surface required against surface provided',
      'A_req = Q / (U_d × LMTD)',
      num(d.Q, 3) + ' kW / (' + num(d.Ud, 1) + ' × ' + num(d.LMTD, 2) + ')',
      'A_req = ' + num(d.Areq, 4) + ' m², provided ' + num(d.Aavail, 4) + ' m² in ' + d.nHp
        + ' hairpins — excess ' + num(d.excessArea, 1) + ' %'));
    T.push(step('7 · Pressure drop',
      'ΔP = 4f (L/D) (ρ v² / 2) + return-bend losses',
      'tube f = ' + num(d.f_t, 5) + ' at v = ' + num(d.velTube, 3) + ' m/s; annulus f = '
        + num(d.f_a, 5) + ' at v = ' + num(d.velAnn, 3) + ' m/s',
      'tube ' + num(d.dP_inner, 3) + ' kPa, annulus ' + num(d.dP_annulus, 3) + ' kPa'));
    return T;
  }

  function stheTrace() {
    var s = window.state && window.state.sthe;
    if (!s || !s.results) return null;
    var r = s.results, i = s.inputs || {};
    return [
      step('1 · Duty', 'Q = ṁ c_p ΔT',
        'shell side ' + num(i.m_shell, 3) + ' kg/s × ' + num(i.Cp_shell, 3) + ' kJ/kg·K across '
          + num(Math.abs((i.Tin_shell || 0) - (i.Tout_shell || 0)), 2) + ' K',
        num(r.Q_kW, 3) + ' kW',
        'Both duties are taken as equal — no loss to ambient is modelled.'),
      step('2 · Corrected mean temperature difference',
        'ΔT_m = F × LMTD',
        (i.flowArrangement || 'counter-current') + ', ' + (i.Np || 1) + ' tube pass(es)',
        num(r.dT_lm, 3) + ' K',
        'F below 0.75 means the arrangement is fighting a temperature cross and should be '
          + 're-passed rather than accepted (Bowman/Mueller/Nagle).'),
      step('3 · Film coefficients',
        'tube side Sieder–Tate · shell side Kern',
        'h_i = ' + num(r.hi, 1) + ' W/m²·K, h_o = ' + num(r.ho, 1) + ' W/m²·K',
        'U calculated = ' + num(r.U_calc, 1) + ' W/m²·K against ' + num(r.U_assumed, 1) + ' assumed',
        'Kern is a screening method: it does not resolve leakage and bypass streams the way '
          + 'Bell–Delaware does.'),
      step('4 · Surface required against surface provided',
        'A_req = Q / (U × ΔT_m)',
        num(r.Q_kW, 3) + ' kW / (' + num(r.U_calc, 1) + ' × ' + num(r.dT_lm, 2) + ')',
        'A_req = ' + num(r.Ar, 3) + ' m², provided ' + num(r.Aa, 3) + ' m² — excess '
          + num(r.excessArea, 1) + ' % (' + (r.areaStatus || '') + ')'),
      step('5 · Bundle and shell',
        'N_t from the tube count correlation at the chosen layout and pitch',
        (i.layout || '') + ' layout, TEMA ' + (r.temaDesignation || ''),
        r.Nt + ' tubes in a ' + num(r.Db_mm, 1) + ' mm bundle, ' + num(r.Ds_used_mm, 1) + ' mm shell'),
      step('6 · Pressure drop',
        'tube side: 4f(L/D)(ρv²/2) + 4 passes × ρv²/2  ·  shell side: Kern crossflow',
        'nozzles: tube NPS ' + (r.noz_tube_nps || '—') + ', shell NPS ' + (r.noz_shell_nps || '—'),
        'tube ' + num(r.dp_tube_kPa, 2) + ' kPa, shell ' + num(r.dp_shell_kPa, 2) + ' kPa')
    ];
  }

  function pheTrace(id) {
    var r = PUB[id] && PUB[id].values;
    if (!r || !isFinite(r.Q)) return null;
    return [
      step('1 · Duty and energy balance', 'Q = ṁ c_p ΔT, both sides',
        'Qh/Qc = ' + num(r.Qbal, 4),
        num(r.Q / 1000, 3) + ' kW',
        'A closure worse than ±5 % means the two duties as entered describe different exchangers.'),
      step('2 · Corrected mean temperature difference', 'ΔT_m = F × LMTD',
        'LMTD = ' + num(r.lmtd, 3) + ' K, F = ' + num(r.F, 3) + ' ('
          + (r.counter ? 'counter-current' : 'co-current') + ')',
        num(r.dTm, 3) + ' K'),
      step('3 · Effectiveness and NTU', 'ε = f(NTU, C_r)',
        'C_r = ' + num(r.Cr, 3) + ', NTU = ' + num(r.NTU, 3),
        'ε = ' + num(r.eff * 100, 1) + ' %'),
      step('4 · Overall coefficient', '1/U_d = 1/h_h + 1/h_c + R_f + plate wall',
        'clean U = ' + num(r.Uclean, 0) + ' W/m²·K',
        'dirty U = ' + num(r.Ud, 0) + ' W/m²·K — ' + (r.uInBand ? 'inside' : 'OUTSIDE')
          + ' the band a plate exchanger achieves'),
      step('5 · Surface', 'A_req = Q / (U_d × ΔT_m), then plates to suit',
        num(r.N, 0) + ' plates in ' + num(r.npass, 0) + ' pass(es), ' + num(r.Ncp, 0) + ' channels per pass',
        'over-surface ' + num(r.overSurf, 1) + ' %'),
      step('6 · Pressure drop', 'channels + ports',
        'hot ' + num(r.dpH.dp, 1) + ' kPa against ' + num(r.dpHa, 1) + ' allowable; cold '
          + num(r.dpC.dp, 1) + ' kPa against ' + num(r.dpCa, 1),
        (r.dpH.dp <= r.dpHa && r.dpC.dp <= r.dpCa) ? 'both sides within allowance' : 'ALLOWANCE EXCEEDED')
    ];
  }

  function tankTrace(id) {
    var r = PUB[id] && PUB[id].values;
    if (!r || !isFinite(r.Dm)) return null;
    return [
      step('1 · Geometry', 'V = π D² H / 4',
        'D = ' + num(r.Dm, 3) + ' m, H = ' + num(r.Hm, 3) + ' m, L/D = ' + num(r.LD, 2),
        num(r.geoCap, 2) + ' m³ geometric'),
      step('2 · Working capacity', 'between low and high liquid level, less freeboard',
        'freeboard ' + num(r.freeboard / 1000, 3) + ' m above HLL',
        num(r.workCap, 2) + ' m³ working against ' + num(r.reqCap, 2) + ' m³ required'),
      step('3 · Shell thickness', 't = 4.9 D (H − 0.3) G / S_d + CA   — API 650 one-foot method',
        'product SG ' + num(r.G, 3) + ', corrosion allowance ' + num(r.CA, 1) + ' mm, joint efficiency ' + num(r.E, 2) + ',',
        num(r.t, 2) + ' mm selected',
        'The one-foot method applies up to 60 m diameter; above that the variable-design-point '
          + 'method governs and this is a screening figure.'),
      step('4 · Weights', 'shell + roof + bottom, at the plate density',
        'roof type ' + (r.roof || '—'),
        num(r.wEmpty, 0) + ' kg erection weight')
    ];
  }

  function traceFor(id) {
    var p = PUB[id];
    if (p && p.trace && p.trace.length) return p.trace;
    if (id === 'pump') return pumpTrace();
    if (/^line-/.test(id)) return lineTrace(id);
    if (id === 'dphe') return dpheTrace();
    if (id === 'sthe') return stheTrace();
    if (id === 'phe') return pheTrace(id);
    if (id === 'tank') return tankTrace(id);
    return null;
  }

  function openTrace() {
    var id = activeModule(), T = traceFor(id);
    var name = MODULES[id] ? MODULES[id].name : '';
    if (!T || !T.length) {
      modal('CALCULATION — ' + name,
        '<div class="aro-note">There is no calculation to show yet. Run the design first — the '
        + 'trace is built from the result, not from the inputs.</div>'
        + '<div class="aro-sec"><h4>WHAT THIS PANEL SHOWS</h4><div>Each step gives the equation as '
        + 'the reference states it, the same equation with this design&rsquo;s numbers substituted, '
        + 'and the result — so a reviewer can follow the arithmetic without opening the source.</div></div>');
      return;
    }
    var h = '<div class="aro-note">Every step below is the working behind a number on the results '
      + 'panel. Units are SI throughout; the panel converts for display only.</div>';
    h += T.map(function (s) {
      return '<div class="aro-step"><div class="s1">' + esc(s.title) + '</div>'
        + '<div class="s2">' + esc(s.formula) + '</div>'
        + '<div class="s3">' + esc(s.subst) + '</div>'
        + '<div class="s4">= ' + esc(s.result) + '</div>'
        + (s.note ? '<div class="aro-ck-d" style="margin-top:5px;">' + esc(s.note) + '</div>' : '')
        + '</div>';
    }).join('');
    modal('CALCULATION TRACE — ' + name, h,
      '<button class="aro-eb-btn" onclick="window.AROENG.basis()">SHOW ENGINEERING BASIS</button>');
  }

  /* ═══ 6 · PROVENANCE ═══════════════════════════════════════════════
     Three questions about any field on the screen: did I type this, did the
     software work it out, or did the software pick it from a standard list?
     A design review that cannot tell those apart is not a review. */
  var provOn = false;
  try { provOn = localStorage.getItem(LS_PROV) === '1'; } catch (e) {}

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') {
      t.setAttribute('data-aro-touched', '1');
      markStale();
      if (provOn) paintProvenance();
    }
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.id && (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio')) {
      t.setAttribute('data-aro-touched', '1');
      markStale();
      if (provOn) paintProvenance();
    }
  }, true);

  function markStale() {
    var id = activeModule();
    if (PUB[id] && PUB[id].at) { STALE[id] = true; PROJECT.dirty = true; renderBar(); }
  }

  function provClass(el) {
    if (el.readOnly || el.disabled || el.getAttribute('aria-readonly') === 'true')
      return ['CALCULATED', 'aro-prov-calc'];
    if (el.tagName === 'SELECT') return ['SELECTED', 'aro-prov-sel'];
    if (el.getAttribute('data-aro-touched') === '1') return ['INPUT', 'aro-prov-input'];
    return ['DEFAULT', 'aro-prov-def'];
  }
  function clearProvenance() {
    var c = document.querySelectorAll('.aro-prov-chip');
    for (var i = 0; i < c.length; i++) c[i].remove();
  }
  function paintProvenance() {
    clearProvenance();
    if (!provOn) return;
    var root = $(activeTab());
    if (!root) return;
    var f = root.querySelectorAll('input, select, textarea');
    for (var i = 0; i < f.length; i++) {
      var el = f[i];
      if (el.type === 'hidden' || el.type === 'button' || el.type === 'submit') continue;
      if (el.offsetParent === null) continue;
      /* the chip goes on the label, because a chip inside a numeric field
         would cover the number it is describing */
      var host = null;
      if (el.id) host = root.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (!host) {
        var p = el.closest('label');
        if (p) host = p;
      }
      if (!host) {
        var grp = el.closest('.form-group, .aln-field, .tk-field, .wb-field, .input-row');
        if (grp) host = grp.querySelector('label, .form-label, .aln-lab, .tk-lab');
      }
      if (!host || host.querySelector('.aro-prov-chip')) continue;
      var pc = provClass(el);
      var chip = document.createElement('span');
      chip.className = 'aro-prov-chip ' + pc[1];
      chip.textContent = pc[0];
      host.appendChild(chip);
    }
  }
  function toggleProvenance() {
    provOn = !provOn;
    try { localStorage.setItem(LS_PROV, provOn ? '1' : '0'); } catch (e) {}
    paintProvenance();
    renderBar();
  }

  /* ═══ 7 · THE DESIGN REPORT ════════════════════════════════════════
     One document, the same content whether it leaves as PDF or as a
     spreadsheet: who, what, on what basis, with what assumptions, the
     working, the checks, and the revision it belongs to. */
  function fieldSnapshot(tab) {
    var root = $(tab);
    if (!root) return [];
    var out = [], f = root.querySelectorAll('input, select, textarea');
    for (var i = 0; i < f.length; i++) {
      var el = f[i];
      if (!el.id || el.type === 'hidden' || el.type === 'button') continue;
      if (el.offsetParent === null) continue;
      if (el.type === 'checkbox' || el.type === 'radio') { if (!el.checked) continue; }
      var v = (el.tagName === 'SELECT' && el.options[el.selectedIndex])
        ? el.options[el.selectedIndex].text : el.value;
      if (v === '' || v == null) continue;
      var lab = null;
      try { lab = root.querySelector('label[for="' + CSS.escape(el.id) + '"]'); } catch (e) {}
      if (!lab) { var pl = el.closest('label'); if (pl) lab = pl; }
      var name = lab ? (lab.textContent || '').replace(/\s+/g, ' ').trim() : el.id;
      var pc = provClass(el);
      out.push({ id: el.id, name: name.slice(0, 70), value: String(v).slice(0, 60), prov: pc[0] });
    }
    return out;
  }

  function reportSections(id) {
    var m = MODULES[id] || {}, b = basisFor(id) || { standards: [], assumptions: [], limits: [], purpose: '' };
    var ck = checksFor(id), t = tally(ck), T = traceFor(id) || [];
    var fields = fieldSnapshot(m.tab || activeTab());
    var d = now();
    return {
      title: 'DESIGN REPORT — ' + (m.name || ''),
      meta: [
        ['Project', PROJECT.name], ['Client', PROJECT.client || '—'],
        ['Module', m.name || ''], ['Revision', PROJECT.rev],
        ['Calculation version', 'v' + (CALCV[id] || 0)],
        ['Date', isoDate(d) + ' ' + hhmmss(d)],
        ['Engineer', PROJECT.engineer || '—'],
        ['Unit system', unitSystemName()],
        ['Software', 'AROGARA FLOWSIZE — engine v' + ENGINE_VERSION],
        ['Status', t.fail ? 'NOT ACCEPTED — ' + t.fail + ' critical failure(s)'
                 : (t.warn ? 'ACCEPTED WITH ' + t.warn + ' WARNING(S)'
                 : (t.pass ? 'ACCEPTED — all ' + t.pass + ' checks passed' : 'NOT CALCULATED'))]
      ],
      purpose: b.purpose, standards: b.standards, assumptions: b.assumptions, limits: b.limits,
      fields: fields, checks: ck, tally: t, trace: T
    };
  }

  function reportHtml(id) {
    var R = reportSections(id);
    var h = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;padding:18px;">';
    h += '<div style="border-bottom:3px solid #d96b16;padding-bottom:9px;margin-bottom:14px;">'
      + '<div style="font-size:19px;font-weight:800;letter-spacing:.04em;">AROGARA FLOWSIZE</div>'
      + '<div style="font-size:13px;color:#374151;">' + esc(R.title) + '</div></div>';

    h += '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;">';
    for (var i = 0; i < R.meta.length; i += 2) {
      h += '<tr>';
      for (var j = i; j < i + 2 && j < R.meta.length; j++) {
        h += '<th style="text-align:left;background:#f3f4f6;border:1px solid #d1d5db;padding:4px 7px;width:130px;">'
          + esc(R.meta[j][0]) + '</th><td style="border:1px solid #d1d5db;padding:4px 7px;">'
          + esc(R.meta[j][1]) + '</td>';
      }
      h += '</tr>';
    }
    h += '</table>';

    function sec(title, inner) {
      return '<div style="margin-bottom:16px;"><div style="font-size:11px;font-weight:800;'
        + 'letter-spacing:.09em;color:#a8500c;border-bottom:1px solid #d1d5db;padding-bottom:4px;'
        + 'margin-bottom:8px;">' + esc(title) + '</div>' + inner + '</div>';
    }
    h += sec('1 · PURPOSE AND SCOPE', '<div style="font-size:10px;line-height:1.6;">' + esc(R.purpose) + '</div>');

    h += sec('2 · DESIGN BASIS — STANDARDS AND METHODS',
      '<table style="width:100%;border-collapse:collapse;font-size:10px;">'
      + R.standards.map(function (s) {
          return '<tr><td style="border:1px solid #d1d5db;padding:4px 7px;width:210px;"><b>'
            + esc(s[0]) + '</b></td><td style="border:1px solid #d1d5db;padding:4px 7px;">'
            + esc(s[1]) + '</td></tr>';
        }).join('') + '</table>');

    h += sec('3 · DESIGN INPUTS',
      '<table style="width:100%;border-collapse:collapse;font-size:9px;">'
      + '<tr><th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;">PARAMETER</th>'
      + '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;">VALUE</th>'
      + '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;">SOURCE</th></tr>'
      + R.fields.map(function (f) {
          return '<tr><td style="border:1px solid #d1d5db;padding:3px 6px;">' + esc(f.name)
            + '</td><td style="border:1px solid #d1d5db;padding:3px 6px;">' + esc(f.value)
            + '</td><td style="border:1px solid #d1d5db;padding:3px 6px;color:#4b5563;">' + esc(f.prov) + '</td></tr>';
        }).join('') + '</table>');

    h += sec('4 · ENGINEERING ASSUMPTIONS',
      '<ol style="font-size:10px;line-height:1.6;margin:0;padding-left:18px;">'
      + R.assumptions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ol>');

    h += sec('5 · OUT OF SCOPE',
      '<ol style="font-size:10px;line-height:1.6;margin:0;padding-left:18px;">'
      + R.limits.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ol>');

    /* ── The drawing belongs in the report ──────────────────────────────
       A report that is only a table of numbers makes the reader rebuild the
       arrangement in their head. The sheet is generated from the same
       result as the tables beside it — it cannot show a different design —
       and it carries a figure number and a caption like any other engineering
       document. */
    var dwg = (window.ARODWG && window.ARODWG.has(id)) ? window.ARODWG.svgFor(id) : null;
    if (dwg) {
      h += sec('6 · ENGINEERING DRAWING',
        '<div style="border:1px solid #d1d5db;padding:6px;background:#fff;">' + dwg + '</div>'
        + '<div style="font-size:9px;color:#4b5563;margin-top:5px;text-align:center;">'
        + 'Figure 1. ' + esc((MODULES[id] || {}).name || '') + ' — engineering design drawing, generated from this '
        + 'calculation. Not for fabrication.</div>');
    }

    /* ── and so does the model ──────────────────────────────────────────
       The drawing gives the dimensions; the 3D view gives the arrangement.
       The layer refuses to hand over a still unless the module is calculated
       and current, so this figure cannot show a superseded design. */
    var shot = null;
    try { shot = window.ARO3DI ? window.ARO3DI.snapshot(id) : null; } catch (e) {}
    if (shot) {
      h += sec((dwg ? '7' : '6') + ' · INDUSTRIAL 3D MODEL',
        '<div style="border:1px solid #d1d5db;padding:6px;background:#fff;text-align:center;">'
        + '<img src="' + shot + '" style="max-width:100%;height:auto;" alt="">' + '</div>'
        + '<div style="font-size:9px;color:#4b5563;margin-top:5px;text-align:center;">'
        + 'Figure ' + (dwg ? '2' : '1') + '. ' + esc((MODULES[id] || {}).name || '')
        + ' — industrial 3D model, built from this calculation. '
        + 'Arrangement steel and access items are indicative.</div>');
    }
    /* ── the isometric, projected from the same 3D route ────────────────── */
    var iso = null;
    try { iso = window.ARO3DI ? window.ARO3DI.isometric(id) : null; } catch (e) {}
    var nSec = (dwg ? 1 : 0) + (shot ? 1 : 0);
    if (iso) {
      nSec += 1;
      h += sec((5 + nSec) + ' · PIPING ISOMETRIC',
        '<div style="border:1px solid #d1d5db;padding:6px;background:#fff;">' + iso + '</div>'
        + '<div style="font-size:9px;color:#4b5563;margin-top:5px;text-align:center;">'
        + 'Figure ' + nSec + '. ' + esc((MODULES[id] || {}).name || '')
        + ' — piping isometric, projected from the 3D route on standard isometric axes.</div>');
    }

    /* ── bill of material, taken off the assembled model ─────────────────── */
    var bom = null;
    try { bom = window.ARO3DI ? window.ARO3DI.bom(id) : null; } catch (e) {}
    if (bom && bom.length) {
      nSec += 1;
      h += sec((5 + nSec) + ' · BILL OF MATERIAL',
        '<div style="font-size:9px;color:#4b5563;margin-bottom:6px;">Taken from the assembled 3D '
        + 'model — every quantity is counted from a component that is actually in it.</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:9px;">'
        + '<tr><th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;width:34px;">ITEM</th>'
        + '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;">DESCRIPTION</th>'
        + '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;width:110px;">SIZE</th>'
        + '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:right;width:70px;">QTY</th>'
        + '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;width:150px;">MATERIAL</th></tr>'
        + bom.map(function (r, i) {
            return '<tr><td style="border:1px solid #d1d5db;padding:3px 6px;">'
              + (i + 1 < 10 ? '0' : '') + (i + 1) + '</td>'
              + '<td style="border:1px solid #d1d5db;padding:3px 6px;"><b>' + esc(r.label) + '</b>'
              + (r.rating ? ' <i style="color:#6b7280;">' + esc(r.rating) + '</i>' : '')
              + (r.detail ? '<br><span style="color:#6b7280;">' + esc(r.detail) + '</span>' : '')
              + '</td><td style="border:1px solid #d1d5db;padding:3px 6px;">' + esc(r.size) + '</td>'
              + '<td style="border:1px solid #d1d5db;padding:3px 6px;text-align:right;font-weight:800;">'
              + (r.unit === 'm' ? Number(r.qty).toFixed(2) + ' m' : Math.round(r.qty) + ' ' + esc(r.unit))
              + '</td><td style="border:1px solid #d1d5db;padding:3px 6px;">' + esc(r.material) + '</td></tr>';
          }).join('')
        + '</table>');
    }

    if (R.trace.length) {
      h += sec((6 + nSec) + ' · CALCULATION',
        R.trace.map(function (s) {
          return '<div style="border:1px solid #d1d5db;border-radius:3px;padding:7px 9px;margin-bottom:6px;font-size:10px;">'
            + '<div style="font-weight:800;color:#374151;">' + esc(s.title) + '</div>'
            + '<div style="color:#a8500c;font-family:monospace;margin:3px 0;">' + esc(s.formula) + '</div>'
            + '<div style="font-family:monospace;color:#4b5563;">' + esc(s.subst) + '</div>'
            + '<div style="font-family:monospace;font-weight:800;">= ' + esc(s.result) + '</div>'
            + (s.note ? '<div style="color:#6b7280;margin-top:3px;">' + esc(s.note) + '</div>' : '')
            + '</div>';
        }).join(''));
    }

    h += sec((7 + nSec) + ' · DESIGN VALIDATION',
      '<div style="font-size:10px;margin-bottom:8px;"><b>' + R.tally.pass + '</b> passed &nbsp;·&nbsp; <b>'
      + (R.tally.warn || 0) + '</b> warnings &nbsp;·&nbsp; <b>' + (R.tally.fail || 0) + '</b> critical failures</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:9px;">'
      + '<tr><th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;width:70px;">RESULT</th>'
      + '<th style="border:1px solid #d1d5db;padding:3px 6px;background:#f3f4f6;text-align:left;">CHECK</th></tr>'
      + (R.checks.length ? R.checks.map(function (c) {
          var col = c.status === 'fail' ? '#b02b2b' : (c.status === 'warn' ? '#8a5a0f' : '#126b4a');
          return '<tr><td style="border:1px solid #d1d5db;padding:3px 6px;color:' + col + ';font-weight:800;">'
            + (BADGE[c.status] || BADGE.info)[0] + '</td><td style="border:1px solid #d1d5db;padding:3px 6px;">'
            + '<b>' + esc(c.label) + '</b>' + (c.clause ? ' <i style="color:#6b7280;">(' + esc(c.clause) + ')</i>' : '')
            + (c.detail ? '<br>' + esc(c.detail) : '') + '</td></tr>';
        }).join('') : '<tr><td colspan="2" style="border:1px solid #d1d5db;padding:5px;">Not calculated.</td></tr>')
      + '</table>');

    h += '<div style="margin-top:20px;border-top:1px solid #d1d5db;padding-top:8px;font-size:9px;color:#6b7280;">'
      + 'This report is a calculation record produced by AROGARA FLOWSIZE engine v' + ENGINE_VERSION
      + '. Results are only as good as the inputs and the assumptions listed in section 4; the '
      + 'issuing engineer remains responsible for the design.</div></div>';
    return h;
  }

  function openReport() {
    var id = activeModule();
    /* ── A report must not be issued from superseded results ────────────
       The report is the artefact that leaves the building. Generating one
       from a calculation the inputs have already moved away from produces a
       document that looks issued, carries a revision, and describes a design
       nobody computed. The block is on the REPORT, not on the screen: the
       results stay visible, marked outdated, so the engineer can still see
       what the last run said. */
    var st = window.AROSTATE;
    if (st) {
      var sState = st.state(id), label = st.label ? st.label(id) : id;
      if (sState === 'OUTDATED') {
        modal('REPORT BLOCKED — RESULTS ARE OUT OF DATE',
          '<div class="aro-note">The design inputs for ' + esc(label) + ' have changed since the last '
          + 'calculation, so the results on screen no longer describe the design as it now stands. '
          + 'A report generated from them would carry a revision and a date against numbers nobody '
          + 'calculated.</div>'
          + '<div class="aro-sec"><h4>WHAT TO DO</h4><div>Press RUN CALCULATION on the module, then '
          + 'generate the report. Nothing has been lost — the previous results are still on screen, '
          + 'marked as superseded.</div></div>',
          '<button class="aro-eb-btn" id="aro-rep-run">RUN CALCULATION</button>');
        bind('aro-rep-run', function () {
          closeModal();
          var strip = document.querySelector('[data-aro-run="' + id + '"]');
          if (strip) strip.click();
        });
        return;
      }
      if (sState === 'NOT_CALCULATED' || sState === 'ERROR') {
        modal('NOTHING TO REPORT',
          '<div class="aro-note">' + esc(label) + ' has not been calculated. A design report is a record '
          + 'of a calculation; there is nothing yet to record.</div>'
          + '<div class="aro-sec"><h4>WHAT TO DO</h4><div>Enter the design inputs and press RUN '
          + 'CALCULATION, then generate the report.</div></div>');
        return;
      }
    }
    var body = '<div id="aro-rep-body" style="background:#fff;">' + reportHtml(id) + '</div>';
    modal('DESIGN REPORT — ' + (MODULES[id] ? MODULES[id].name : ''), body,
      '<button class="aro-eb-btn" id="aro-rep-pdf">DOWNLOAD PDF</button>'
      + '<button class="aro-eb-btn" id="aro-rep-xls">DOWNLOAD EXCEL</button>'
      + '<button class="aro-eb-btn" id="aro-rep-print">PRINT</button>');
    bind('aro-rep-pdf', function () { reportPdf(id); });
    bind('aro-rep-xls', function () { reportExcel(id); });
    bind('aro-rep-print', function () { window.print(); });
  }

  function fileStem(id) {
    var m = MODULES[id] || { code: 'XX' };
    return (PROJECT.name || 'UNTITLED').replace(/[^A-Za-z0-9_-]+/g, '_')
      + '_' + m.code + '_REV' + PROJECT.rev + '_' + isoDate(now());
  }

  function reportPdf(id) {
    var el = $('aro-rep-body');
    if (!el) return;
    if (typeof window.AROPDF === 'function') {
      window.AROPDF(el, fileStem(id) + '.pdf', { landscape: false, bg: '#ffffff' });
    } else {
      window.print();
    }
  }

  /* Excel: an HTML workbook. Every spreadsheet in use opens it, it needs no
     library, and unlike CSV it keeps the sheet structure and the headings. */
  function reportExcel(id) {
    var R = reportSections(id);
    function row(a, b, c) {
      return '<tr><td>' + esc(a) + '</td><td>' + esc(b == null ? '' : b) + '</td><td>'
        + esc(c == null ? '' : c) + '</td></tr>';
    }
    var x = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">'
      + '<style>td,th{border:1px solid #999;padding:3px 5px;font-family:Arial;font-size:10pt;} '
      + 'th{background:#eee;font-weight:bold;} .h{background:#d96b16;color:#fff;font-weight:bold;}</style>'
      + '</head><body><table>';
    x += '<tr><td class="h" colspan="3">' + esc(R.title) + '</td></tr>';
    R.meta.forEach(function (m) { x += row(m[0], m[1], ''); });
    x += '<tr><td class="h" colspan="3">DESIGN BASIS</td></tr>';
    R.standards.forEach(function (s) { x += row(s[0], s[1], ''); });
    x += '<tr><td class="h" colspan="3">DESIGN INPUTS</td></tr>';
    x += '<tr><th>PARAMETER</th><th>VALUE</th><th>SOURCE</th></tr>';
    R.fields.forEach(function (f) { x += row(f.name, f.value, f.prov); });
    x += '<tr><td class="h" colspan="3">ENGINEERING ASSUMPTIONS</td></tr>';
    R.assumptions.forEach(function (a, i) { x += row(i + 1, a, ''); });
    x += '<tr><td class="h" colspan="3">OUT OF SCOPE</td></tr>';
    R.limits.forEach(function (a, i) { x += row(i + 1, a, ''); });
    if (R.trace.length) {
      x += '<tr><td class="h" colspan="3">CALCULATION</td></tr>';
      x += '<tr><th>STEP</th><th>EQUATION / SUBSTITUTION</th><th>RESULT</th></tr>';
      R.trace.forEach(function (s) { x += row(s.title, s.formula + '  |  ' + s.subst, s.result); });
    }
    x += '<tr><td class="h" colspan="3">DESIGN VALIDATION</td></tr>';
    x += '<tr><th>RESULT</th><th>CHECK</th><th>DETAIL</th></tr>';
    R.checks.forEach(function (c) {
      x += row((BADGE[c.status] || BADGE.info)[0], c.label + (c.clause ? ' (' + c.clause + ')' : ''), c.detail);
    });
    x += '</table></body></html>';
    download(new Blob([x], { type: 'application/vnd.ms-excel' }), fileStem(id) + '.xls');
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }

  /* ═══ 8 · PROJECTS ═════════════════════════════════════════════════
     A design that only exists until the tab closes is not a design. A
     project is every field on every tab, the unit system, the revision, and
     the calculation versions — enough to reopen the work exactly as it was
     left, and enough to hand to somebody else. */
  function allFields() {
    var out = {}, f = document.querySelectorAll('input[id], select[id], textarea[id]');
    for (var i = 0; i < f.length; i++) {
      var el = f[i];
      if (el.type === 'hidden' || el.type === 'button' || el.type === 'submit' || el.type === 'file') continue;
      if (/^aro-/.test(el.id)) continue;                       // this layer's own controls
      out[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? !!el.checked : el.value;
    }
    return out;
  }
  function restoreFields(map) {
    var n = 0;
    for (var id in map) {
      var el = $(id);
      if (!el) continue;
      try {
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!map[id];
        else el.value = map[id];
        el.setAttribute('data-aro-touched', '1');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        n++;
      } catch (e) {}
    }
    return n;
  }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(LS_PROJECTS) || '{}'); } catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(LS_PROJECTS, JSON.stringify(s)); return true; }
    catch (e) { alert('The project could not be saved — browser storage is full or blocked.'); return false; }
  }

  function snapshot() {
    var mods = {};
    for (var k in PUB) {
      if (!PUB[k]) continue;
      mods[k] = { at: PUB[k].at, version: CALCV[k] || 0, checks: PUB[k].checks || [] };
    }
    return {
      id: PROJECT.id, name: PROJECT.name, rev: PROJECT.rev, client: PROJECT.client,
      engineer: PROJECT.engineer, note: PROJECT.note,
      created: PROJECT.created, modified: new Date().toISOString(),
      units: (($('global-unit-system') || {}).value) || 'SI',
      fields: allFields(), modules: mods, engine: ENGINE_VERSION
    };
  }

  function doSave(asNew, name) {
    var store = loadStore();
    if (asNew || !PROJECT.id) {
      PROJECT.id = 'p' + Date.now().toString(36);
      PROJECT.created = new Date().toISOString();
      if (name) PROJECT.name = name;
    }
    var snap = snapshot();
    store[PROJECT.id] = snap;
    if (!saveStore(store)) return false;
    PROJECT.modified = snap.modified;
    PROJECT.dirty = false;
    try { localStorage.setItem(LS_CURRENT, PROJECT.id); } catch (e) {}
    renderBar();
    toast('Project saved — ' + PROJECT.name + ' rev ' + PROJECT.rev);
    return true;
  }

  function doOpen(pid) {
    var store = loadStore(), p = store[pid];
    if (!p) return;
    PROJECT.id = p.id; PROJECT.name = p.name; PROJECT.rev = p.rev || 'A';
    PROJECT.client = p.client || ''; PROJECT.engineer = p.engineer || '';
    PROJECT.note = p.note || ''; PROJECT.created = p.created; PROJECT.modified = p.modified;
    PROJECT.dirty = false;
    var us = $('global-unit-system');
    if (us && p.units) { us.value = p.units; us.dispatchEvent(new Event('change', { bubbles: true })); }
    var n = restoreFields(p.fields || {});
    for (var k in (p.modules || {})) CALCV[k] = p.modules[k].version || 0;
    try { localStorage.setItem(LS_CURRENT, pid); } catch (e) {}
    closeModal();
    renderBar();
    toast('Opened ' + p.name + ' rev ' + PROJECT.rev + ' — ' + n + ' fields restored. Re-run each module to refresh its results.');
  }

  function doNew() {
    if (PROJECT.dirty && !confirm('The current project has unsaved changes. Start a new one anyway?')) return;
    PROJECT = { id: null, name: 'UNTITLED', rev: 'A', client: '', engineer: '', note: '',
                created: null, modified: null, dirty: false };
    PUB = {}; STALE = {}; CALCV = {}; LAST_TAB_MODULE = {};
    try { localStorage.removeItem(LS_CURRENT); } catch (e) {}
    closeModal();
    renderBar();
    toast('New project. Field values are left as they are — reset a module to clear them.');
  }

  function bumpRev() {
    var r = PROJECT.rev;
    if (/^[A-Z]$/.test(r)) PROJECT.rev = r === 'Z' ? 'AA' : String.fromCharCode(r.charCodeAt(0) + 1);
    else if (/^\d+$/.test(r)) PROJECT.rev = String(parseInt(r, 10) + 1);
    else PROJECT.rev = r + '1';
    PROJECT.dirty = true;
    renderBar();
  }

  function projectTree() {
    var groups = {};
    for (var k in MODULES) {
      var m = MODULES[k];
      (groups[m.tab] = groups[m.tab] || []).push(k);
    }
    var tabName = { 'pump-tab': 'PUMPS', 'line-tab': 'LINES', 'sthe-tab': 'HEAT EXCHANGERS',
                    'tank-tab': 'TANKS', 'workbench-tab': 'DRAWINGS' };
    var h = '<div class="aro-tree">';
    for (var tab in groups) {
      h += '<div class="aro-tree-r" style="background:rgba(148,163,184,0.08);cursor:default;">'
        + '<span class="aro-tree-n">' + esc(tabName[tab] || tab) + '</span></div>';
      groups[tab].forEach(function (k) {
        var p = PUB[k], ck = p ? (p.checks || []) : [], t = tally(ck);
        var state = !p ? '<span class="aro-tree-m">not calculated</span>'
          : '<span class="aro-tree-m ' + statusColourClass(verdict(t)) + '">'
            + t.pass + ' pass · ' + (t.warn || 0) + ' warn · ' + (t.fail || 0) + ' fail  ·  v'
            + (CALCV[k] || 0) + '</span>';
        h += '<div class="aro-tree-r" data-goto="' + k + '" style="padding-left:26px;">'
          + '<span class="aro-tree-n" style="font-weight:' + (p ? 700 : 400) + ';">'
          + esc(MODULES[k].name) + '</span>' + state + '</div>';
      });
    }
    h += '</div>';
    return h;
  }

  function openProject() {
    var store = loadStore();
    var keys = Object.keys(store).sort(function (a, b) {
      return String(store[b].modified || '').localeCompare(String(store[a].modified || ''));
    });
    var h = '<div class="aro-sec"><h4>CURRENT PROJECT</h4><div class="aro-kv">'
      + '<i>PROJECT NAME</i><input class="aro-in" id="aro-pj-name" value="' + esc(PROJECT.name) + '">'
      + '<i>CLIENT</i><input class="aro-in" id="aro-pj-client" value="' + esc(PROJECT.client) + '">'
      + '<i>ENGINEER</i><input class="aro-in" id="aro-pj-eng" value="' + esc(PROJECT.engineer) + '">'
      + '<i>REVISION</i><input class="aro-in" id="aro-pj-rev" value="' + esc(PROJECT.rev) + '">'
      + '<i>NOTE</i><input class="aro-in" id="aro-pj-note" value="' + esc(PROJECT.note) + '">'
      + '</div><div style="margin-top:9px;display:flex;gap:7px;flex-wrap:wrap;">'
      + '<button class="aro-eb-btn" id="aro-pj-apply">APPLY</button>'
      + '<button class="aro-eb-btn" id="aro-pj-bump">NEXT REVISION</button></div></div>';

    h += '<div class="aro-sec"><h4>DESIGN TREE — THIS PROJECT</h4>' + projectTree() + '</div>';

    h += '<div class="aro-sec"><h4>SAVED PROJECTS</h4>';
    if (!keys.length) {
      h += '<div class="aro-note">Nothing saved yet. SAVE writes the whole workspace — every field '
         + 'on every tab, the unit system and the revision — into this browser.</div>';
    } else {
      h += '<div class="aro-tree">' + keys.map(function (k) {
        var p = store[k];
        return '<div class="aro-tree-r' + (k === PROJECT.id ? ' sel' : '') + '" data-open="' + k + '">'
          + '<span class="aro-tree-n">' + esc(p.name) + ' <span class="aro-tree-m">rev ' + esc(p.rev || 'A') + '</span></span>'
          + '<span class="aro-tree-m">' + esc(String(p.modified || '').slice(0, 16).replace('T', ' ')) + '</span>'
          + '<button class="aro-x" data-del="' + k + '" title="Delete">&#10005;</button></div>';
      }).join('') + '</div>';
    }
    h += '</div>';

    modal('PROJECT — ' + PROJECT.name,
      h,
      '<button class="aro-eb-btn" id="aro-pj-new">NEW</button>'
      + '<button class="aro-eb-btn" id="aro-pj-save">SAVE</button>'
      + '<button class="aro-eb-btn" id="aro-pj-saveas">SAVE AS</button>'
      + '<button class="aro-eb-btn" id="aro-pj-export">EXPORT JSON</button>'
      + '<button class="aro-eb-btn" id="aro-pj-import">IMPORT JSON</button>');

    bind('aro-pj-apply', function () {
      PROJECT.name = ($('aro-pj-name').value || 'UNTITLED').trim();
      PROJECT.client = $('aro-pj-client').value.trim();
      PROJECT.engineer = $('aro-pj-eng').value.trim();
      PROJECT.rev = ($('aro-pj-rev').value || 'A').trim();
      PROJECT.note = $('aro-pj-note').value.trim();
      PROJECT.dirty = true;
      renderBar();
      toast('Project details updated.');
    });
    bind('aro-pj-bump', function () { bumpRev(); $('aro-pj-rev').value = PROJECT.rev; toast('Revision ' + PROJECT.rev); });
    bind('aro-pj-new', doNew);
    bind('aro-pj-save', function () { if ($('aro-pj-name')) PROJECT.name = ($('aro-pj-name').value || 'UNTITLED').trim(); doSave(false); closeModal(); });
    bind('aro-pj-saveas', function () {
      var n = prompt('Save the current workspace as a new project named:', PROJECT.name + ' COPY');
      if (n) { doSave(true, n.trim()); closeModal(); }
    });
    bind('aro-pj-export', function () {
      download(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }),
        (PROJECT.name || 'project').replace(/[^A-Za-z0-9_-]+/g, '_') + '.arogara.json');
    });
    bind('aro-pj-import', function () {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var p = JSON.parse(rd.result);
            var store = loadStore();
            p.id = p.id || ('p' + Date.now().toString(36));
            store[p.id] = p;
            saveStore(store);
            doOpen(p.id);
          } catch (e) { alert('That file is not an AROGARA project export.'); }
        };
        rd.readAsText(f);
      };
      inp.click();
    });

    var box = $('aro-mod');
    if (box) box.addEventListener('click', function (e) {
      var del = e.target.getAttribute && e.target.getAttribute('data-del');
      if (del) {
        e.stopPropagation();
        if (confirm('Delete this saved project? This cannot be undone.')) {
          var s = loadStore(); delete s[del]; saveStore(s); openProject();
        }
        return;
      }
      var r = e.target.closest ? e.target.closest('[data-open]') : null;
      if (r) { doOpen(r.getAttribute('data-open')); return; }
      var g = e.target.closest ? e.target.closest('[data-goto]') : null;
      if (g) { gotoModule(g.getAttribute('data-goto')); closeModal(); }
    });
  }

  /* ═══ 8b · STALE BLOCKING DIALOGS ══════════════════════════════════
     Six modules answer a RUN with missing inputs by throwing up a
     full-viewport "REQUIRED INPUTS MISSING" dialog, each named
     <prefix>-reqinput-modal. None of them closes when you leave the tab —
     and because the dialog is position:fixed and covers the whole window,
     it goes on swallowing every click on whatever tab you move to. The
     symptom is the worst kind: buttons on a completely different module
     stop responding, silently, with nothing on screen to explain it (the
     dialog is drawn over the tab you have just left, so you never see it).

     A dialog like that is an answer to a button you pressed on a tab you
     are no longer looking at. Leaving the tab withdraws the question. */
  function dismissStaleDialogs() {
    var d = document.querySelectorAll('[id$="-reqinput-modal"]');
    for (var i = 0; i < d.length; i++) d[i].remove();
  }

  function gotoModule(id) {
    var m = MODULES[id];
    if (!m) return;
    var t = document.querySelector('.nav-tab[data-tab="' + m.tab + '"]');
    if (t) t.click();
    LAST_TAB_MODULE[m.tab] = id;
    setTimeout(renderBar, 220);
  }

  /* ═══ 8c · P&ID → EQUIPMENT → DESIGN MODULE ════════════════════════
     A tag on a P&ID and a design in a sizing module are the same piece of
     equipment, and until now they were two unrelated pieces of data typed
     twice. This carries what the drawing already knows — tag, service fluid,
     duty, temperature, pressure — into the module that sizes it, and takes
     you there.

     Everything crosses in SI and is written through setInputFromSI, so a
     drawing whose flow is in m³/h lands correctly in a workspace displaying
     US customary. What the drawing does not know is left alone rather than
     guessed: this seeds a design, it does not complete one. */
  var LINK_TARGET = {
    pump:          { tab: 'pump-tab',  module: 'pump', label: 'Pump Hydraulics' },
    compressor:    { tab: 'pump-tab',  module: 'pump', label: 'Pump Hydraulics' },
    heatexchanger: { tab: 'sthe-tab',  module: 'sthe', label: 'Heat Exchanger' },
    vessel:        { tab: 'tank-tab',  module: 'tank', label: 'Tank Design' }
  };

  function setSI(id, si, dp) {
    var el = $(id);
    if (!el || si == null || !isFinite(si)) return false;
    if (typeof window.setInputFromSI === 'function') window.setInputFromSI(id, si, dp);
    else el.value = String(si);
    el.setAttribute('data-aro-touched', '1');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function setText(id, v) {
    var el = $(id);
    if (!el || v == null || v === '') return false;
    el.value = String(v);
    el.setAttribute('data-aro-touched', '1');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  /* Match a free-text fluid name against a <select> by its option text. */
  function setFluid(id, name) {
    var el = $(id);
    if (!el || !name) return false;
    var want = String(name).toLowerCase().trim();
    for (var i = 0; i < el.options.length; i++) {
      if ((el.options[i].text || '').toLowerCase().trim() === want) {
        el.selectedIndex = i;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function sendToModule(item) {
    item = item || {};
    var t = LINK_TARGET[item.category];
    if (!t) {
      toast('There is no sizing module for a ' + (item.category || 'component of this kind') + '.');
      return false;
    }
    /* With a project open, a tagged item on the drawing is a project object,
       not a scratch calculation. Hand it to the project layer first so the
       design is recorded against its tag and comes back with a status. */
    if (window.AROPROJECT && window.AROPROJECT.isOpen()) {
      var adopted = window.AROPROJECT.adopt(item, t.module);
      if (adopted) {
        window.AROPROJECT.open(adopted.id);
        toast(adopted.tag + ' → ' + t.label + '. Recorded in the project; the design status comes '
          + 'back to the equipment list when you run it.');
        return true;
      }
    }

    var carried = [];
    var tabBtn = document.querySelector('.nav-tab[data-tab="' + t.tab + '"]');
    if (tabBtn) tabBtn.click();
    dismissStaleDialogs();

    if (t.module === 'pump') {
      if (setText('pump-tag', item.tag)) carried.push('tag ' + item.tag);
      if (setFluid('pump-fluid', item.fluid)) carried.push('fluid ' + item.fluid);
      /* the drawing carries m³/h; the field is litres per hour in SI */
      if (isFinite(item.flow) && item.flow > 0 && setSI('pump-vol-flow-lhr', item.flow * 1000, 0))
        carried.push('flow ' + item.flow + ' m³/h');
      if (isFinite(item.temp) && setSI('pump-temp-op', item.temp, 1)) carried.push('temperature ' + item.temp + ' °C');
      if (isFinite(item.press) && setSI('pump-vessel-press-g', item.press, 4)) carried.push('suction pressure ' + item.press + ' bar g');
    } else if (t.module === 'sthe') {
      /* An exchanger has two streams and the drawing knows one. Seed the
         shell side — the hot service on the majority of these drawings —
         and say so, rather than splitting one temperature across both. */
      if (setFluid('sthe-fluid-shell-select', item.fluid)) carried.push('shell fluid ' + item.fluid);
      if (isFinite(item.temp) && setSI('sthe-tin-shell', item.temp, 1)) carried.push('shell inlet ' + item.temp + ' °C');
      if (isFinite(item.press) && setSI('sthe-press-shell', item.press, 3)) carried.push('shell pressure ' + item.press + ' bar g');
    } else if (t.module === 'tank') {
      if (setText('tk-tag', item.tag)) carried.push('tag ' + item.tag);
      if (setFluid('tk-fluid', item.fluid)) carried.push('fluid ' + item.fluid);
      if (isFinite(item.temp) && setSI('tk-tdes', item.temp, 1)) carried.push('design temperature ' + item.temp + ' °C');
    }
    LAST_TAB_MODULE[t.tab] = t.module;
    setTimeout(renderBar, 260);
    toast(carried.length
      ? (item.name || 'Equipment') + ' → ' + t.label + ': ' + carried.join(', ')
        + '. Everything else the drawing does not know is left for you to enter.'
      : 'Opened ' + t.label + '. The drawing carried nothing that fits this module — enter the duty here.');
    return true;
  }

  /* ═══ 9 · TOAST ════════════════════════════════════════════════════ */
  function toast(msg) {
    var t = $('aro-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'aro-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:46px;transform:translateX(-50%);z-index:100001;'
        + 'background:var(--bg-panel);border:1px solid var(--border-muted);border-left:3px solid #d96b16;'
        + 'color:var(--text-main);font-family:var(--font-mono);font-size:11px;padding:9px 15px;'
        + 'border-radius:4px;box-shadow:0 8px 26px rgba(0,0,0,0.28);max-width:min(560px,92vw);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.style.display = 'none'; }, 4200);
    var sb = $('statusBarMsg');
    if (sb) sb.textContent = msg;
  }

  /* ═══ 10 · KEYBOARD ════════════════════════════════════════════════
     The shortcuts an engineer already has in their fingers. Ctrl+Z and
     Ctrl+Y are deliberately NOT intercepted while the caret is in a field —
     undoing a typo is what those keys mean there, and taking that away to
     undo a design step instead is worse than not having the shortcut. */
  function inField(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }
  function clickIn(tab, sel) {
    var root = $(tab);
    if (!root) return false;
    var b = root.querySelector(sel);
    if (b && b.offsetParent !== null) { b.click(); return true; }
    return false;
  }
  function recalcActive() {
    var tab = activeTab();
    var sels = ['#lq-calc', '[id$="-calc-btn"]', 'button[type="submit"]', '.aln-apply'];
    for (var i = 0; i < sels.length; i++) if (clickIn(tab, sels[i])) return true;
    if (tab === 'pump-tab' && typeof window.runActualPumpCalculations === 'function') {
      window.runActualPumpCalculations();
      return true;
    }
    return false;
  }

  document.addEventListener('keydown', function (e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F5' && !ctrl) {
      e.preventDefault();
      toast(recalcActive() ? 'Recalculating…' : 'Nothing to recalculate on this tab.');
      return;
    }
    if (!ctrl) return;
    var k = (e.key || '').toLowerCase();
    if (k === 's') { e.preventDefault(); if (e.shiftKey) { openProject(); } else { doSave(false); } }
    else if (k === 'o') { e.preventDefault(); openProject(); }
    else if (k === 'p') { e.preventDefault(); openReport(); }
    else if (k === 'e') { e.preventDefault(); reportExcel(activeModule()); }
    else if ((k === 'z' || k === 'y') && !inField(e)) {
      var tab = activeTab();
      if (clickIn(tab, k === 'z' ? '[id$="-undo-btn"],[id$="-undo"]' : '[id$="-redo-btn"],[id$="-redo"]')) {
        e.preventDefault();
      }
    }
  });

  /* ═══ 11 · PUBLIC API ══════════════════════════════════════════════ */
  function publish(id, payload) {
    if (!MODULES[id]) return;
    payload = payload || {};
    PUB[id] = {
      checks: normalise(payload.checks),
      values: payload.values || null,
      trace: payload.trace || null,
      at: Date.now()
    };
    CALCV[id] = (CALCV[id] || 0) + 1;
    STALE[id] = false;
    LAST_TAB_MODULE[MODULES[id].tab] = id;
    PROJECT.dirty = true;
    renderBar();
    if (provOn) paintProvenance();
  }
  /* Modules describe a check as {ok:true/false} or as {status:'warn'}; both
     spellings arrive here and leave in one shape. */
  function normalise(list) {
    if (!list || !list.length) return [];
    return list.map(function (c, i) {
      var st = c.status;
      if (!st) st = (c.ok === false) ? 'fail' : (c.ok === true ? 'pass' : 'info');
      if (st === 'error') st = 'fail';
      if (st === 'ok') st = 'pass';
      if (st === 'warning') st = 'warn';
      return {
        key: c.key || ('c' + i), label: c.label || c.msg || ('Check ' + (i + 1)),
        detail: c.detail || (c.label ? '' : (c.msg || '')), clause: c.clause || '', cite: c.cite || '',
        status: st
      };
    });
  }

  window.AROENG = {
    publish: publish,
    module: activeModule,
    /* the module's own result object, so the drawing and the 3D read the
       same numbers the panel did rather than a parallel copy */
    values: function (id) { var p = PUB[id || activeModule()]; return p ? p.values : null; },
    status: function (id) { var ck = checksFor(id || activeModule()); return { checks: ck, tally: tally(ck) }; },
    openStatus: openStatus, basis: openBasis, assumptions: openAssumptions,
    trace: openTrace, report: openReport, project: openProject,
    save: function () { return doSave(false); },
    sendToModule: sendToModule,
    canSize: function (cat) { return !!LINK_TARGET[cat]; },
    toast: toast,
    refresh: renderBar,
    version: ENGINE_VERSION
  };

  /* ═══ 12 · BOOT ════════════════════════════════════════════════════ */
  function boot() {
    injectCss();
    buildBar();
    /* reopen whatever was last worked on, so a reload is not a loss */
    try {
      var cur = localStorage.getItem(LS_CURRENT);
      var store = loadStore();
      if (cur && store[cur]) {
        var p = store[cur];
        PROJECT.id = p.id; PROJECT.name = p.name; PROJECT.rev = p.rev || 'A';
        PROJECT.client = p.client || ''; PROJECT.engineer = p.engineer || '';
        PROJECT.created = p.created; PROJECT.modified = p.modified;
        for (var k in (p.modules || {})) CALCV[k] = p.modules[k].version || 0;
      }
    } catch (e) {}
    applyUnitLock();
    renderBar();
    /* the bar describes the tab you are on, so it repaints when you move */
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.nav-tab') : null;
      if (t) { dismissStaleDialogs(); setTimeout(renderBar, 260); }
    }, true);
    /* modules that only render verdicts get picked up on a delay after any
       button press inside a tab — cheap, and it keeps the bar honest without
       a mutation observer running over the whole document */
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('button')) setTimeout(function () {
        renderBar();
        if (provOn) paintProvenance();
      }, 900);
    }, true);
    var us = $('global-unit-system');
    if (us) us.addEventListener('change', function () { setTimeout(renderBar, 400); });
    if (provOn) setTimeout(paintProvenance, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

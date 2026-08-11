/* ══════════════════════════════════════════════════════════════════════
   AROGARA — LANDING / FRONT PAGE

   Shown on first visit (no session yet). Returning users skip straight to
   the app. "Launch App" dissolves this layer and reveals the sign-in gate
   mounted underneath by arogara-auth.js.

   Order of the page:
     hero → figures → vision & mission → modules → workflow → standards →
     industries → library → AI copilot → why AROGARA → who it is for →
     roadmap → CTA → footer

   A NOTE ON THE FIGURES: every number in the "By the numbers" band is
   counted from this repository, not chosen for effect. The counts are
   listed against their source in FIGURES below so they can be re-checked
   when the code changes. Nothing on this page claims a capability the
   suite does not have; items that are not built yet live under Roadmap and
   say so.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var SESSION_KEY = 'aro_session_v1';
  function hasSession() { try { return !!JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return false; } }

  /* ── verified figures ────────────────────────────────────────────────
     n           what is shown
     label       what it counts
     source      where it was counted, so it can be re-verified          */
  var FIGURES = [
    { n: '30',  label: 'Named correlations',   source: 'Colebrook, Darcy–Weisbach, Antoine, Dittus–Boelter, Sieder–Tate, Kern, Bell–Delaware, ε-NTU, Lockhart–Martinelli, Beggs–Brill, Durand, Churchill, Martin, Muley–Manglik and more' },
    { n: '20+', label: 'Codes & standards',    source: 'ASME, API, TEMA, ANSI/HI, IEC, ISO, IS and ASTM references cited in the calculations' },
    { n: '42',  label: 'Materials',            source: '25 tank and 17 plate-exchanger materials with allowable stress and conductivity' },
    { n: '22',  label: 'Fluids with vapour data', source: 'Antoine constants from Perry’s Table 2-8, plus aqueous solutions by water activity' },
    { n: '25',  label: 'Unit quantities',      source: 'each convertible across SI, US customary and mixed metric' },
    { n: '6',   label: 'Design modules',       source: 'pump, line sizing, shell & tube, double pipe, plate exchanger, tank & workbench' }
  ];

  var MODULES = [
    { ic: 'pump', t: 'Pump Hydraulics', d: 'Duty to datasheet: NPSH, total head, power and motor selection with a live 3D pump loop.',
      f: ['Pump selection', 'Total dynamic head', 'NPSH available & required', 'Predicted pump curves', 'Cavitation check', 'Motor power & loading', 'System curves'] },
    { ic: 'line', t: 'Line Sizing', d: 'Every phase on one engine, with the velocity and erosion limits that govern each.',
      f: ['Liquid', 'Steam', 'Gas', 'Slurry', 'Two-phase', 'Pressure drop', 'Velocity limits', 'Erosion check'] },
    { ic: 'exchanger', t: 'Shell &amp; Tube (STHE)', d: 'Thermal and hydraulic design with TEMA layouts and fabrication-ready output.',
      f: ['TEMA front/shell/rear', 'Kern & Bell–Delaware', 'Tube layout & passes', 'Baffle design', 'Industrial 3D view', 'GA drawing & BOM', 'Design datasheet'] },
    { ic: 'hairpin', t: 'Double-Pipe (DPHE)', d: 'Hairpin sizing with the counter- and co-current cases compared side by side.',
      f: ['Hairpin sizing', 'Counter vs co-current', 'Annulus hydraulics', 'Fouling allowance', 'Manufacturing drawing', 'Datasheet'] },
    { ic: 'plate', t: 'Plate HEx (PHE)', d: 'Chevron-plate design by ε-NTU with the over-surface tuned automatically.',
      f: ['Chevron plate design', 'ε-NTU method', 'Auto-optimised over-surface', 'Plate count & pass layout', 'GA drawing & BOM', 'Performance graphs'] },
    { ic: 'tank', t: 'Tank Design', d: 'Vertical and horizontal storage tanks with the shell course build-up worked out.',
      f: ['Vertical & horizontal', 'Shell course thickness', 'Roof design', 'Bottom design', 'Nozzle schedule', 'Wind & seismic load'] },
    { ic: 'cube', t: '3D Workbench', d: 'Build the loop on a canvas and watch the model turn as the design changes.',
      f: ['Drag-and-drop P&ID', 'Live 3D plant view', 'Fittings & valves library', 'Flow animation', 'Export to report'] },
    { ic: 'ai', t: 'ARO AI Copilot', d: 'Ask about the design in plain language and get an engineer’s answer, not a search result.',
      f: ['Explains every result', 'Suggests corrections', 'Reads your current design', 'Cites the governing clause'] }
  ];

  var WORKFLOW = [
    { ic: 'data', t: 'Process data',        d: 'Duty, fluid, temperature, pressure.' },
    { ic: 'engine', t: 'Calculation engine',  d: 'Transparent, standards-based formulae.' },
    { ic: 'caliper', t: 'Equipment sizing',    d: 'Bores, areas, heads, power.' },
    { ic: 'target', t: 'Optimisation',        d: 'Auto-design corrections, one click each.' },
    { ic: 'cube', t: '3D model',            d: 'Built from the calculated design.' },
    { ic: 'drawing', t: 'Fabrication drawing', d: 'GA drawings and bills of material.' },
    { ic: 'datasheet', t: 'Datasheet',           d: 'The enquiry document, filled in.' },
    { ic: 'report', t: 'PDF report',          d: 'The whole design package, exported.' }
  ];

  var STANDARDS = [
    ['ASME VIII',  'Pressure vessel design'],
    ['ASME B36.10M', 'Welded & seamless pipe'],
    ['TEMA',       'Exchanger classes & layout'],
    ['API 610',    'Centrifugal pumps'],
    ['API 650',    'Welded storage tanks'],
    ['API 660',    'Shell & tube exchangers'],
    ['API 661',    'Air-cooled exchangers'],
    ['API 14E',    'Erosional velocity'],
    ['ANSI/HI 9.6.7', 'Viscous performance correction'],
    ['HEI',        'Heat exchange institute practice'],
    ['IEC 60072',  'Motor frame & rating'],
    ['ASTM · ISO · IS', 'Materials & general practice']
  ];

  var INDUSTRIES = [
    ['derrick', 'Oil &amp; Gas'], ['flask', 'Chemical Plants'], ['plant', 'Petrochemical'],
    ['tower', 'Refineries'], ['bolt', 'Power Plants'], ['grain', 'Food Industry'],
    ['pill', 'Pharmaceutical'], ['droplet', 'Water Treatment'], ['molecule', 'Hydrogen Plants'],
    ['sprout', 'Fertilizer']
  ];

  var LIBRARY = [
    ['steam',     'Steam tables',           'Saturated and superheated properties.'],
    ['droplet',   'Water properties',       'Density, viscosity and vapour pressure with temperature.'],
    ['layers',    'Material database',      'Allowable stress, conductivity and roughness.'],
    ['swap',      'Unit converter',         '25 quantities across three unit systems.'],
    ['book',      'Formula reference',      'Every correlation shown with its source.'],
    ['caliper',   'Pipe schedule database', 'Bores by NPS and schedule to ASME B36.10M.'],
    ['ring',      'Flange database',        'Ratings and facings to ASME B16.5.'],
    ['pump',      'Pump database',          'Efficiency bands and suction specific speed limits.'],
    ['exchanger', 'Exchanger database',     'TEMA types, layouts and fouling factors.']
  ];

  var ASK = [
    'Select a pipe size for this duty.',
    'Why is the pressure drop so high?',
    'Suggest a better pump for this NPSHa.',
    'Optimise this heat exchanger.',
    'Explain the TEMA layout you chose.'
  ];

  var AUDIENCE = [
    ['flask', 'Chemical Engineers'], ['wrench', 'Mechanical Engineers'], ['chart', 'Process Consultants'],
    ['scope', 'Research Institutes'], ['cap', 'Engineering Students'], ['crane', 'Plant Designers']
  ];

  var ROADMAP = [
    'Pressure Vessel', 'Distillation Column', 'Cooling Tower',
    'Reactor', 'Cost Estimation', 'Plant Layout'
  ];

  /* Footer links. `to` scrolls to a section that exists; `app` opens the
     workbench; anything else is not built yet and is labelled as such
     rather than given a link that goes nowhere. */
  var FOOTER = [
    { h: 'Product', items: [
      { t: 'Modules', to: 'al-modules' }, { t: 'Workflow', to: 'al-flow' },
      { t: 'Standards', to: 'al-standards' }, { t: 'Roadmap', to: 'al-roadmap' } ] },
    { h: 'Resources', items: [
      { t: 'Documentation', app: 1 }, { t: 'Engineering Library', to: 'al-library' },
      { t: 'Tutorials', soon: 1 } ] },
    { h: 'Company', items: [
      { t: 'Vision &amp; Mission', to: 'al-vision' }, { t: 'Who it’s for', to: 'al-who' },
      { t: 'Contact', mail: 'technologiesarogara@gmail.com' } ] }
  ];

  function css() {
    return '<style id="aro-land-css">'
      + '#aro-landing{position:fixed;inset:0;z-index:100001;overflow-y:auto;overflow-x:hidden;background:#050912;color:#dbe7ff;font-family:"Outfit",system-ui,sans-serif;-webkit-font-smoothing:antialiased;}'
      + '#aro-landing *{box-sizing:border-box;min-width:0;}'
      + '#aro-landing a{color:inherit;text-decoration:none;}'
      + '#aro-landing :focus-visible{outline:2px solid #ff9d66;outline-offset:3px;border-radius:8px;}'
      + '.al-bg{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;}'
      + '.al-orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.45;animation:alFloat 16s ease-in-out infinite;}'
      + '.al-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(126,162,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(126,162,255,.06) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(ellipse at 50% 0%,#000 40%,transparent 78%);}'
      + '@keyframes alFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-28px)}}'
      + '.al-wrap{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:0 24px;}'

      /* The nav is sticky. It used to have only a blur and no background, so
         content scrolling beneath it showed through as a smeared rectangle.
         It is full-bleed with its own surface now. */
      + '.al-navbar{position:sticky;top:0;z-index:20;background:rgba(5,9,18,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(126,162,255,.10);}'
      + '.al-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 24px;max-width:1180px;margin:0 auto;}'
      + '.al-brand{display:flex;align-items:center;gap:11px;flex:none;}'
      + '.al-brand img{width:36px;height:36px;border-radius:11px;box-shadow:0 6px 22px rgba(255,117,56,.32);}'
      + '.al-brand .bn{font-weight:700;font-size:15.5px;letter-spacing:.14em;color:#fff;line-height:1.1;}'
      + '.al-brand .bt{font-size:9.5px;letter-spacing:.24em;color:#8fa6d4;font-weight:600;}'
      + '.al-navlinks{display:flex;align-items:center;gap:22px;font-size:13.5px;color:#a9bce0;font-weight:500;}'
      + '.al-navlinks a{padding:5px 2px;border-bottom:1px solid transparent;transition:color .16s,border-color .16s;white-space:nowrap;}'
      + '.al-navlinks a:hover{color:#fff;border-bottom-color:#ff7538;}'

      + '.al-btn{cursor:pointer;font-family:inherit;font-weight:600;border-radius:11px;border:none;transition:transform .12s,box-shadow .2s,background .2s;white-space:nowrap;}'
      + '.al-btn:active{transform:translateY(1px);}'
      + '.al-btn-primary{background:linear-gradient(135deg,#ff7538,#ff9d4d);color:#231000;padding:11px 22px;font-size:14px;box-shadow:0 10px 30px rgba(255,117,56,.32);}'
      + '.al-btn-primary:hover{box-shadow:0 14px 40px rgba(255,117,56,.48);}'
      + '.al-btn-ghost{background:rgba(126,162,255,.08);border:1px solid rgba(126,162,255,.25);color:#dbe7ff;padding:11px 22px;font-size:14px;}'
      + '.al-btn-ghost:hover{background:rgba(126,162,255,.16);}'

      + '.al-hero{text-align:center;padding:70px 24px 26px;position:relative;z-index:1;max-width:920px;margin:0 auto;}'
      + '.al-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border:1px solid rgba(126,162,255,.24);border-radius:999px;background:rgba(13,22,47,.55);font-size:12px;color:#9fb4e0;letter-spacing:.04em;margin-bottom:22px;}'
      + '.al-pill .dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;}'
      + '.al-hero h1{font-size:clamp(32px,5.6vw,56px);line-height:1.09;font-weight:700;color:#fff;margin:0 0 20px;letter-spacing:-.015em;}'
      + '.al-hero h1 .g{background:linear-gradient(90deg,#ff9d66,#7ea2ff 75%);-webkit-background-clip:text;background-clip:text;color:transparent;}'
      + '.al-hero p{font-size:clamp(15px,2.1vw,18.5px);line-height:1.62;color:#93a8d4;max-width:680px;margin:0 auto 30px;}'
      + '.al-cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}'
      + '.al-trust{margin-top:24px;font-size:12.5px;color:#6f86b6;letter-spacing:.03em;display:inline-flex;align-items:center;gap:7px;justify-content:center;}'
      + '.al-heroVid{max-width:900px;margin:38px auto 0;border-radius:14px;overflow:hidden;'
      +   'border:1px solid rgba(148,163,184,0.22);box-shadow:0 30px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(255,117,56,0.06);'
      +   'background:#070b14;}'
      + '.al-heroVid video{display:block;width:100%;height:auto;}'
      + '.al-heroVidHint{padding:10px 14px;text-align:center;font-size:12px;color:#6f86b6;background:#070b14;}'

      /* The nav is sticky, so an anchor jump must stop short of it or the
         section's eyebrow lands underneath the bar. */
      + '.al-sec{padding:58px 0;scroll-margin-top:86px;}'
      + '.al-eyebrow{text-align:center;font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:#ff9d66;font-weight:700;margin-bottom:12px;}'
      + '.al-h2{text-align:center;font-size:clamp(25px,3.7vw,36px);font-weight:700;color:#fff;margin:0 0 12px;letter-spacing:-.01em;}'
      + '.al-lead{text-align:center;font-size:15.5px;color:#93a8d4;max-width:660px;margin:0 auto 40px;line-height:1.6;}'

      /* One card surface for the whole page, so every block reads as a set. */
      + '.al-card{border:1px solid rgba(126,162,255,.14);border-radius:18px;background:rgba(13,22,47,.5);transition:transform .18s,border-color .18s,background .18s;}'
      + '.al-card:hover{transform:translateY(-3px);border-color:rgba(255,117,56,.45);background:rgba(19,30,60,.7);}'

      + '.al-figs{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;max-width:1080px;margin:40px auto 0;}'
      + '.al-fig{padding:18px 12px;text-align:center;}'
      /* A gradient clipped to text samples a different slice for every number,
         so "30" read orange and "6" read grey. Solid, with the accent kept as
         a rule above the figure instead. */
      + '.al-fig{position:relative;}'
      + '.al-fig::before{content:"";position:absolute;top:0;left:22%;right:22%;height:2px;border-radius:2px;background:linear-gradient(90deg,#ff7538,#7ea2ff);opacity:.75;}'
      + '.al-fig .n{font-size:clamp(20px,2.4vw,28px);font-weight:700;color:#fff;line-height:1.1;letter-spacing:-.01em;}'
      + '.al-fig .l{font-size:11.5px;color:#8fa6d4;margin-top:5px;line-height:1.35;}'

      + '.al-vm{display:grid;grid-template-columns:1fr 1fr;gap:20px;}'
      + '.al-vmc{border:1px solid rgba(126,162,255,.16);border-radius:20px;padding:30px;background:linear-gradient(160deg,rgba(16,26,54,.7),rgba(9,15,33,.85));position:relative;overflow:hidden;}'
      + '.al-vmc::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#ff7538,#2a52be);}'
      + '.al-vmc .ic{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;color:#ff9d66;background:linear-gradient(135deg,rgba(255,117,56,.16),rgba(42,82,190,.16));border:1px solid rgba(126,162,255,.18);margin-bottom:14px;}'
      + '.al-vmc h3{font-size:19px;color:#fff;margin:0 0 10px;font-weight:600;}'
      + '.al-vmc p{font-size:14.5px;color:#9fb4e0;line-height:1.66;margin:0;}'

      + '.al-mods{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:stretch;}'
      + '.al-mod{padding:22px;display:flex;flex-direction:column;}'
      + '.al-mod .mi{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ff9d66;background:linear-gradient(135deg,rgba(255,117,56,.18),rgba(42,82,190,.18));border:1px solid rgba(126,162,255,.18);margin-bottom:14px;}'
      + '.al-mod h4{font-size:16px;color:#fff;margin:0 0 6px;font-weight:600;}'
      + '.al-mod > p{font-size:13px;color:#93a8d4;line-height:1.55;margin:0 0 13px;}'
      + '.al-feat{list-style:none;margin:auto 0 0;padding:12px 0 0;border-top:1px solid rgba(126,162,255,.10);display:flex;flex-direction:column;gap:5px;}'
      + '.al-feat li{font-size:12.5px;color:#b9cbec;display:flex;gap:7px;align-items:flex-start;line-height:1.4;}'
      + '.al-feat li::before{content:"✓";color:#4ade80;font-weight:700;flex:none;font-size:11.5px;line-height:1.5;}'

      /* Workflow: a numbered chain that wraps without ever overlapping. */
      + '.al-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;counter-reset:alstep;}'
      + '.al-step{padding:18px 16px;position:relative;counter-increment:alstep;}'
      + '.al-step::after{content:counter(alstep,decimal-leading-zero);position:absolute;top:12px;right:14px;font-size:11px;font-weight:700;color:rgba(126,162,255,.4);font-family:ui-monospace,monospace;}'
      + '.al-step .si{display:flex;align-items:center;color:#7ea2ff;margin-bottom:9px;}'
      + '.al-step b{display:block;color:#fff;font-size:14px;font-weight:600;margin-bottom:4px;}'
      + '.al-step span{font-size:12.5px;color:#8fa6d4;line-height:1.5;}'

      + '.al-std{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}'
      + '.al-stditem{display:flex;gap:10px;align-items:flex-start;padding:14px 16px;}'
      + '.al-stditem .ck{flex:none;width:22px;height:22px;border-radius:7px;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.4);color:#4ade80;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;}'
      + '.al-stditem b{display:block;color:#e6eeff;font-size:13.5px;font-weight:600;}'
      + '.al-stditem span{display:block;color:#8fa6d4;font-size:12px;margin-top:2px;line-height:1.45;}'

      + '.al-inds{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}'
      + '.al-ind{display:inline-flex;align-items:center;gap:9px;padding:9px 16px;border-radius:999px;border:1px solid rgba(126,162,255,.16);background:rgba(13,22,47,.55);font-size:13.5px;color:#c3d4f2;transition:border-color .16s,background .16s,transform .16s;}'
      + '.al-ind:hover{border-color:rgba(255,117,56,.5);background:rgba(19,30,60,.75);transform:translateY(-2px);}'
      + '.al-ind .aro-ic{color:#7ea2ff;flex:none;}'
      + '.al-ind:hover .aro-ic{color:#ff9d66;}'

      + '.al-lib{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}'
      + '.al-libitem{padding:18px;display:flex;gap:12px;align-items:flex-start;}'
      + '.al-libitem .li{display:flex;align-items:center;flex:none;color:#7ea2ff;margin-top:1px;}'
      + '.al-libitem b{display:block;color:#fff;font-size:14px;font-weight:600;margin-bottom:3px;}'
      + '.al-libitem span{font-size:12.5px;color:#8fa6d4;line-height:1.5;}'

      + '.al-ai{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:center;}'
      + '.al-asks{display:flex;flex-direction:column;gap:10px;}'
      + '.al-ask{display:flex;gap:10px;align-items:center;padding:13px 16px;border-radius:13px;border:1px solid rgba(126,162,255,.16);background:rgba(13,22,47,.6);font-size:14px;color:#dbe7ff;}'
      + '.al-ask .q{color:#ff9d66;font-weight:700;flex:none;}'
      + '.al-aitext h3{font-size:clamp(22px,3vw,30px);color:#fff;margin:0 0 12px;font-weight:700;}'
      + '.al-aitext p{font-size:15px;color:#93a8d4;line-height:1.65;margin:0 0 14px;}'

      + '.al-caps{display:grid;grid-template-columns:repeat(2,1fr);gap:14px 30px;max-width:900px;margin:0 auto;}'
      + '.al-cap{display:flex;gap:12px;align-items:flex-start;}'
      + '.al-cap .ck{flex:none;width:26px;height:26px;border-radius:8px;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.4);color:#4ade80;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;}'
      + '.al-cap b{color:#e6eeff;font-size:14.5px;font-weight:600;}.al-cap span{display:block;color:#8fa6d4;font-size:13px;margin-top:2px;line-height:1.5;}'

      + '.al-who{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;}'
      + '.al-whoitem{padding:18px 12px;text-align:center;}'
      + '.al-whoitem .wi{display:flex;align-items:center;justify-content:center;color:#ff9d66;margin-bottom:8px;}'
      + '.al-whoitem b{font-size:13px;color:#dbe7ff;font-weight:600;line-height:1.35;display:block;}'

      + '.al-road{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}'
      + '.al-roaditem{padding:14px 16px;display:flex;align-items:center;gap:10px;border:1px dashed rgba(126,162,255,.22);border-radius:14px;background:rgba(13,22,47,.35);}'
      + '.al-roaditem .rd{width:7px;height:7px;border-radius:50%;background:#ff9d66;flex:none;box-shadow:0 0 9px rgba(255,157,102,.7);}'
      + '.al-roaditem b{font-size:13.5px;color:#c3d4f2;font-weight:600;}'

      + '.al-band{margin:20px auto 0;border-radius:24px;padding:48px 32px;text-align:center;background:linear-gradient(135deg,rgba(255,117,56,.14),rgba(42,82,190,.16));border:1px solid rgba(126,162,255,.2);}'
      + '.al-band h2{font-size:clamp(24px,4vw,34px);color:#fff;margin:0 0 12px;font-weight:700;}'
      + '.al-band p{color:#a9bce0;font-size:15px;margin:0 0 26px;}'

      + '.al-foot{border-top:1px solid rgba(126,162,255,.12);margin-top:40px;padding:44px 24px 26px;}'
      + '.al-footgrid{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1.8fr repeat(3,1fr);gap:32px;}'
      + '.al-footbrand .fb{color:#fff;font-weight:700;letter-spacing:.12em;font-size:14px;margin-bottom:8px;}'
      + '.al-footbrand p{color:#7d93c2;font-size:12.5px;line-height:1.7;margin:0;max-width:280px;}'
      + '.al-footcol h5{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#ff9d66;margin:0 0 12px;font-weight:700;}'
      + '.al-footcol ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px;}'
      + '.al-footcol a,.al-footcol .na{font-size:13px;color:#93a8d4;transition:color .16s;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}'
      + '.al-footcol a:hover{color:#fff;}'
      + '.al-footcol .na{color:#5d719c;cursor:default;}'
      + '.al-soon{font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:1px 5px;border-radius:5px;border:1px solid rgba(126,162,255,.28);color:#7d93c2;font-weight:700;}'
      + '.al-footbot{max-width:1180px;margin:32px auto 0;padding-top:20px;border-top:1px solid rgba(126,162,255,.10);text-align:center;color:#6f86b6;font-size:12.5px;line-height:1.8;}'

      /* Reveal on scroll — purely decorative, and off when the reader has
         asked for reduced motion. */
      + '.al-rv{opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s ease;}'
      + '.al-rv.in{opacity:1;transform:none;}'
      + '@media(prefers-reduced-motion:reduce){.al-rv{opacity:1;transform:none;transition:none;}.al-orb{animation:none;}}'

      /* Breakpoints. Each grid steps down rather than squeezing, so nothing
         ever overlaps or overflows the viewport. */
      + '@media(max-width:1100px){.al-mods,.al-flow,.al-std,.al-road{grid-template-columns:repeat(3,1fr);}.al-figs,.al-who{grid-template-columns:repeat(3,1fr);}}'
      + '@media(max-width:860px){.al-navlinks a{display:none;}.al-mods,.al-flow,.al-std,.al-road,.al-lib,.al-vm,.al-caps,.al-ai{grid-template-columns:repeat(2,1fr);}.al-footgrid{grid-template-columns:repeat(2,1fr);}.al-footbrand{grid-column:1/-1;}}'
      /* ── engineering-console sections ─────────────────────────────── */
      + '.al-statement{font-size:clamp(15px,2.3vw,20px)!important;color:#dbe6ff!important;font-weight:600;'
      +   'max-width:760px!important;margin:0 auto 14px!important;line-height:1.5!important;}'
      + '.al-pipe{margin:26px auto 0;max-width:760px;text-align:center;}'
      + '.al-pipeRow{margin:0;}'
      + '.al-pipeArrow{color:#5c74a8;font-size:16px;line-height:1.5;margin:5px 0;}'
      + '.al-node{display:inline-block;font-family:ui-monospace,"IBM Plex Mono",monospace;font-size:11px;'
      +   'font-weight:700;letter-spacing:.09em;color:#cfe0ff;background:rgba(42,82,190,.16);'
      +   'border:1px solid rgba(126,162,255,.42);border-radius:5px;padding:8px 16px;}'
      + '.al-pipeFan{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px;}'
      + '.al-leaf{font-family:ui-monospace,"IBM Plex Mono",monospace;font-size:10px;font-weight:700;'
      +   'letter-spacing:.08em;color:#ffca9e;background:rgba(255,117,56,.12);'
      +   'border:1px solid rgba(255,157,102,.42);border-radius:5px;padding:7px 12px;}'
      + '.al-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:26px;}'
      + '.al-step{background:rgba(255,255,255,.028);border:1px solid rgba(126,162,255,.18);'
      +   'border-top:2px solid rgba(255,117,56,.6);border-radius:8px;padding:16px 14px;}'
      + '.al-stepn{font-family:ui-monospace,monospace;font-size:20px;font-weight:800;color:#ff9d66;'
      +   'line-height:1;margin-bottom:8px;}'
      + '.al-step h4{margin:0 0 6px;font-size:12px;letter-spacing:.09em;color:#fff;font-weight:700;}'
      + '.al-step p{margin:0;font-size:12.5px;line-height:1.55;color:#93a8d4;}'
      + '.al-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:22px;}'
      + '.al-chip{font-family:ui-monospace,monospace;font-size:10.5px;letter-spacing:.05em;color:#c3d3f2;'
      +   'background:rgba(255,255,255,.04);border:1px solid rgba(126,162,255,.24);'
      +   'border-radius:4px;padding:6px 10px;}'
      + '.al-chip-a{color:#ffca9e;border-color:rgba(255,157,102,.38);background:rgba(255,117,56,.08);}'
      + '.al-tri{display:grid;grid-template-columns:1fr 26px 1fr 26px 1fr;gap:10px;align-items:stretch;margin-top:26px;}'
      + '.al-tric{background:rgba(255,255,255,.028);border:1px solid rgba(126,162,255,.2);'
      +   'border-radius:8px;padding:16px 15px;}'
      + '.al-tric h4{margin:0 0 10px;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.08em;'
      +   'color:#ff9d66;font-weight:800;}'
      + '.al-tric ul{margin:0;padding-left:16px;}'
      + '.al-tric li{font-size:12.5px;line-height:1.7;color:#a9bce0;}'
      + '.al-triA{display:flex;align-items:center;justify-content:center;color:#5c74a8;font-size:18px;}'
      + '.al-audit{margin-top:24px;max-width:620px;border:1px solid rgba(126,162,255,.22);border-radius:8px;'
      +   'overflow:hidden;background:rgba(255,255,255,.026);}'
      + '.al-auditrow{display:flex;justify-content:space-between;align-items:center;padding:9px 15px;'
      +   'border-bottom:1px solid rgba(126,162,255,.12);font-family:ui-monospace,monospace;font-size:11px;}'
      + '.al-auditrow:last-child{border-bottom:none;}'
      + '.al-auditk{color:#b7c8ea;letter-spacing:.07em;}'
      + '.al-auditv{font-weight:800;letter-spacing:.08em;}'
      + '.al-auditv.ok{color:#4ade80;}.al-auditv.warn{color:#fbbf24;}.al-auditv.bad{color:#f87171;}'
      + '.al-auditsum{margin-top:12px;font-family:ui-monospace,monospace;font-size:11.5px;font-weight:800;'
      +   'letter-spacing:.07em;color:#cfe0ff;}'
      + '.al-dim{color:#6f86b6;font-weight:400;letter-spacing:.04em;}'
      + '.al-trace{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:24px;}'
      + '.al-traceA{color:#5c74a8;font-size:14px;}'
      + '@media(max-width:900px){.al-steps{grid-template-columns:repeat(2,1fr);}'
      +   '.al-tri{grid-template-columns:1fr;}.al-triA{display:none;}}'
      + '@media(max-width:560px){.al-mods,.al-flow,.al-std,.al-road,.al-lib,.al-vm,.al-caps,.al-ai,.al-figs{grid-template-columns:1fr;}.al-who{grid-template-columns:repeat(2,1fr);}.al-footgrid{grid-template-columns:repeat(2,1fr);}.al-sec{padding:42px 0;}.al-hero{padding:48px 18px 20px;}}'
      + '</style>';
  }

  var esc = function (s) { return String(s); };   // all copy here is authored, not user input

  /* Marks are line icons from AROICON rather than emoji: emoji render
     differently on every platform and carry meanings the design did not
     choose — a flame stood for heat exchangers and, separately, refineries. */
  function I(name, size) { return window.AROICON ? window.AROICON(name, size || 22) : ''; }

  function figure(f) {
    return '<div class="al-card al-fig" title="' + f.source.replace(/"/g, '&quot;') + '">'
      + '<div class="n">' + f.n + '</div><div class="l">' + f.label + '</div></div>';
  }
  function moduleCard(m) {
    return '<div class="al-card al-mod"><div class="mi">' + I(m.ic, 22) + '</div>'
      + '<h4>' + m.t + '</h4><p>' + m.d + '</p>'
      + '<ul class="al-feat">' + m.f.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
  }
  function step(s) {
    return '<div class="al-card al-step"><span class="si">' + I(s.ic, 21) + '</span><b>' + s.t + '</b><span>' + s.d + '</span></div>';
  }
  function stdItem(s) {
    return '<div class="al-card al-stditem"><span class="ck">✓</span><div><b>' + s[0] + '</b><span>' + s[1] + '</span></div></div>';
  }
  function libItem(l) {
    return '<div class="al-card al-libitem"><span class="li">' + I(l[0], 20) + '</span><div><b>' + l[1] + '</b><span>' + l[2] + '</span></div></div>';
  }
  function cap(t, d) {
    return '<div class="al-cap"><span class="ck">✓</span><div><b>' + t + '</b><span>' + d + '</span></div></div>';
  }
  function footCol(c) {
    return '<div class="al-footcol"><h5>' + c.h + '</h5><ul>' + c.items.map(function (i) {
      if (i.to)   return '<li><a href="#' + i.to + '">' + i.t + '</a></li>';
      if (i.app)  return '<li><a data-launch role="button" tabindex="0">' + i.t + '</a></li>';
      if (i.mail) return '<li><a href="mailto:' + i.mail + '">' + i.t + '</a></li>';
      return '<li><span class="na">' + i.t + ' <span class="al-soon">soon</span></span></li>';
    }).join('') + '</ul></div>';
  }

  function html() {
    return css()
      + '<div class="al-bg">'
      + '  <div class="al-grid"></div>'
      + '  <div class="al-orb" style="width:460px;height:460px;background:#2a52be;top:-160px;left:-120px;"></div>'
      + '  <div class="al-orb" style="width:380px;height:380px;background:#ff7538;top:120px;right:-120px;animation-delay:-7s;"></div>'
      + '</div>'

      + '<div class="al-navbar"><nav class="al-nav">'
      + '  <div class="al-brand"><img src="icon-192.png" alt="AROGARA"/><div><div class="bn">AROGARA</div><div class="bt">TECHNOLOGIES</div></div></div>'
      + '  <div class="al-navlinks">'
      +      '<a href="#al-architecture">Architecture</a><a href="#al-modules">Modules</a>'
      +      '<a href="#al-steps">Workflow</a><a href="#al-3d">3D</a><a href="#al-deliver">Deliverables</a>'
      +      '<a href="#al-standards">Standards</a><a href="#al-roadmap">Roadmap</a>'
      +      '<button class="al-btn al-btn-primary" data-launch>Launch Platform →</button>'
      + '  </div>'
      + '</nav></div>'

      + '<header class="al-hero">'
      + '  <div class="al-pill"><span class="dot"></span> Digital Engineering Design Platform · Made in India</div>'
      + '  <h1>AROGARA FLOWSIZE<br><span class="g">Digital Engineering Design Platform</span></h1>'
      + '  <p class="al-statement">From Engineering Inputs to Calculation, Validation, Visualization, '
      +      'Drawing &amp; Design Report — in One Platform.</p>'
      + '  <p>Process Equipment &nbsp;·&nbsp; Fluid Systems &nbsp;·&nbsp; Heat Transfer &nbsp;·&nbsp; '
      +      'Piping &nbsp;·&nbsp; Tank Design &nbsp;·&nbsp; Engineering Workbench</p>'
      + '  <div class="al-cta"><button class="al-btn al-btn-primary" data-launch>Launch Engineering Platform</button><button class="al-btn al-btn-ghost" data-scroll="al-modules">Explore Modules</button></div>'
      + '  <div class="al-trust">' + I('lock', 14) + ' Verified access · Your design data stays with you · Built for Indian industry</div>'
      + '  <div class="al-heroVid"><video autoplay muted loop playsinline controls preload="metadata" poster="" aria-label="AROGARA FlowSize — 20 second overview">'
      +      '<source src="assets/video/arogara-flowsize-promo-20s.mp4" type="video/mp4"></video>'
      +   '<div class="al-heroVidHint">🔊 Video has sound — unmute on the player to hear it</div></div>'
      + '</header>'

      + '<div class="al-wrap">'

      + '  <section class="al-sec al-rv" style="padding-top:8px;" id="al-figures">'
      + '    <div class="al-eyebrow">By the numbers</div>'
      + '    <p class="al-lead" style="margin-bottom:0;">Counted from the engine itself — hover any figure to see what it counts.</p>'
      + '    <div class="al-figs">' + FIGURES.map(figure).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-architecture">'
      + '    <div class="al-eyebrow">Product architecture</div>'
      + '    <h2 class="al-h2">One engineering model. Complete engineering output.</h2>'
      + '    <p class="al-lead">Design once. Validate once. Every output is generated from the same '
      +      'engineering data, so the drawing, the model, the take-off and the report cannot describe '
      +      'different designs.</p>'
      + '    <div class="al-pipe">'
      + '      <div class="al-pipeRow"><span class="al-node">ENGINEERING INPUT</span></div>'
      + '      <div class="al-pipeArrow">↓</div>'
      + '      <div class="al-pipeRow"><span class="al-node">CALCULATION ENGINE</span></div>'
      + '      <div class="al-pipeArrow">↓</div>'
      + '      <div class="al-pipeRow"><span class="al-node">DESIGN VALIDATION</span></div>'
      + '      <div class="al-pipeArrow">↓</div>'
      + '      <div class="al-pipeFan">'
      +        ['2D DRAWING', '3D MODEL', 'ISOMETRIC', 'BOM / MTO', 'GRAPHS', 'REPORT']
             .map(function (x) { return '<span class="al-leaf">' + x + '</span>'; }).join('')
      + '      </div>'
      + '    </div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-steps">'
      + '    <div class="al-eyebrow">How it works</div><h2 class="al-h2">The engineering workflow</h2>'
      + '    <div class="al-steps">'
      +      [['01', 'DESIGN', 'Define engineering requirements and operating conditions.'],
              ['02', 'CALCULATE', 'Perform engineering sizing and design calculations.'],
              ['03', 'VALIDATE', 'Check engineering limits, assumptions, margins and design criteria.'],
              ['04', 'VISUALIZE', 'Generate engineering-oriented 2D and 3D representations.'],
              ['05', 'DOCUMENT', 'Generate drawings, take-off, graphs, calculations and reports.']]
             .map(function (t) {
               return '<div class="al-step"><div class="al-stepn">' + t[0] + '</div>'
                 + '<h4>' + t[1] + '</h4><p>' + t[2] + '</p></div>'; }).join('')
      + '    </div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-3d">'
      + '    <div class="al-eyebrow">Visualization</div><h2 class="al-h2">Engineering-grade 3D</h2>'
      + '    <p class="al-lead">Beyond symbolic visualisation. Components are built from the calculated '
      +      'dimensions and assembled port to port, so the model communicates real geometry, real '
      +      'connections and real design intent — and the bill of material is counted from it.</p>'
      + '    <div class="al-chips">'
      +      ['Pipe', 'Elbow', 'Tee', 'Reducer', 'Weld-neck flange', 'Gasket', 'Stud bolts &amp; nuts',
              'Gate valve', 'Globe valve', 'Ball valve', 'Check valve', 'Control valve with actuator',
              'Pressure gauge', 'Pipe shoe support', 'Nozzles', 'Equipment internals']
             .map(function (x) { return '<span class="al-chip">' + x + '</span>'; }).join('')
      + '    </div>'
      + '    <div class="al-chips" style="margin-top:14px;">'
      +      ['ROTATE', 'ZOOM', 'PAN', 'FIT MODEL', 'ISO / FRONT / TOP / SIDE', 'INSPECT COMPONENT',
              'FLOW', 'SIMPLE / INDUSTRIAL / ENGINEERING']
             .map(function (x) { return '<span class="al-chip al-chip-a">' + x + '</span>'; }).join('')
      + '    </div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-deliver">'
      + '    <div class="al-eyebrow">Deliverables</div>'
      + '    <h2 class="al-h2">From engineering data to engineering drawing</h2>'
      + '    <div class="al-tri">'
      + '      <div class="al-tric"><h4>2D ENGINEERING DRAWING</h4><ul>'
      +        '<li>Dimensions and centre lines</li><li>Nozzle and connection callouts</li>'
      +        '<li>Piping arrangement</li><li>Title block and revision</li>'
      +        '<li>Piping isometric with take-off</li></ul></div>'
      + '      <div class="al-triA">→</div>'
      + '      <div class="al-tric"><h4>3D ENGINEERING MODEL</h4><ul>'
      +        '<li>Parametric industrial geometry</li><li>Flanges, gaskets, bolting</li>'
      +        '<li>Valves and instruments</li><li>Supports and equipment</li>'
      +        '<li>Component inspection</li></ul></div>'
      + '      <div class="al-triA">→</div>'
      + '      <div class="al-tric"><h4>DESIGN REPORT</h4><ul>'
      +        '<li>Calculations and trace</li><li>Design validation</li>'
      +        '<li>2D drawing, 3D view, isometric</li><li>Bill of material</li>'
      +        '<li>Assumptions, basis, revision</li></ul></div>'
      + '    </div>'
      + '    <p class="al-lead" style="margin-top:22px;">A single engineering data source drives the '
      +      'complete design output. Where a module has not yet been connected end to end, the platform '
      +      'says so rather than presenting an output it did not generate.</p>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-audit">'
      + '    <div class="al-eyebrow">Design status</div><h2 class="al-h2">Design status — at a glance</h2>'
      + '    <p class="al-lead">Every module keeps a running audit of its own design. This is an '
      +      'illustration of the panel; on a real design each line is a check the calculation actually '
      +      'performed.</p>'
      + '    <div class="al-audit">'
      +      [['MASS BALANCE', 'PASS'], ['VELOCITY', 'PASS'], ['PRESSURE DROP', 'PASS'],
              ['NPSH', 'PASS'], ['DESIGN MARGIN', 'REVIEW'], ['STANDARD SIZE', 'PASS'],
              ['OPERATING ENVELOPE', 'PASS']]
             .map(function (r) {
               var cls = r[1] === 'PASS' ? 'ok' : (r[1] === 'FAIL' ? 'bad' : 'warn');
               return '<div class="al-auditrow"><span class="al-auditk">' + r[0] + '</span>'
                 + '<span class="al-auditv ' + cls + '">' + r[1] + '</span></div>'; }).join('')
      + '    </div>'
      + '    <div class="al-auditsum">6 PASS &nbsp;·&nbsp; 1 REVIEW &nbsp;·&nbsp; 0 FAIL '
      +      '<span class="al-dim">— illustrative</span></div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-trace">'
      + '    <div class="al-eyebrow">Credibility</div><h2 class="al-h2">Engineering traceability</h2>'
      + '    <div class="al-trace">'
      +      ['INPUT', 'ASSUMPTION', 'CALCULATION', 'RESULT', 'VALIDATION', 'DRAWING', 'REPORT']
             .map(function (x, i) {
               return (i ? '<span class="al-traceA">→</span>' : '')
                 + '<span class="al-node">' + x + '</span>'; }).join('')
      + '    </div>'
      + '    <p class="al-lead" style="margin-top:20px;">Transparent assumptions. Traceable '
      +      'calculations. Every value carries where it came from — entered, calculated, selected, '
      +      'predicted or a software default — and no result is shown before it has been computed.</p>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-vision">'
      + '    <div class="al-eyebrow">Our purpose</div><h2 class="al-h2">Vision &amp; Mission</h2>'
      + '    <div class="al-vm">'
      + '      <div class="al-vmc"><span class="ic">' + I('globe', 26) + '</span><h3>Our Vision</h3><p>To make world-class process-engineering design accessible to every process engineer — replacing scattered spreadsheets and costly desktop tools with a single, intuitive, cloud workbench that turns rigorous calculation into a delightful experience.</p></div>'
      + '      <div class="al-vmc"><span class="ic">' + I('compass', 26) + '</span><h3>Our Mission</h3><p>To help teams size pumps, pipelines, exchangers and tanks accurately and confidently — coupling transparent, standards-based engineering with live 3D insight, smart optimisation and instant, fabrication-ready documentation.</p></div>'
      + '    </div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-modules">'
      + '    <div class="al-eyebrow">What\'s inside</div><h2 class="al-h2">Everything you need to size a plant</h2>'
      + '    <p class="al-lead">Integrated modules share one clean interface, one unit system and one report engine — so you never leave the workbench.</p>'
      + '    <div class="al-mods">' + MODULES.map(moduleCard).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-flow">'
      + '    <div class="al-eyebrow">How it works</div><h2 class="al-h2">From process data to a finished package</h2>'
      + '    <p class="al-lead">One continuous chain. Change an input at step one and everything downstream — including the 3D model and the drawings — follows.</p>'
      + '    <div class="al-flow">' + WORKFLOW.map(step).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-standards">'
      + '    <div class="al-eyebrow">Engineering standards</div><h2 class="al-h2">Every result cites the clause behind it</h2>'
      + '    <p class="al-lead">Calculations follow published practice, and each check names the code and section it applies — so a reviewer can trace any number back to its source.</p>'
      + '    <div class="al-std">' + STANDARDS.map(stdItem).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-industries">'
      + '    <div class="al-eyebrow">Industries served</div><h2 class="al-h2">Built for the plants you work on</h2>'
      + '    <p class="al-lead">The same engine sizes a refinery pump loop and a pharmaceutical water skid — the standards and fluid data change, the workflow does not.</p>'
      + '    <div class="al-inds">' + INDUSTRIES.map(function (i) {
             return '<span class="al-ind">' + I(i[0], 17) + '<span>' + i[1] + '</span></span>'; }).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-library">'
      + '    <div class="al-eyebrow">Engineering resources</div><h2 class="al-h2">The reference data, built in</h2>'
      + '    <p class="al-lead">No separate handbook and no copying figures between tools — the properties, schedules and databases live inside the calculation.</p>'
      + '    <div class="al-lib">' + LIBRARY.map(libItem).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-ai">'
      + '    <div class="al-ai">'
      + '      <div class="al-aitext">'
      + '        <div class="al-eyebrow" style="text-align:left;">ARO AI Copilot</div>'
      + '        <h3>Ask about your design in plain language</h3>'
      + '        <p>The copilot reads the design you have open — the duty, the fluid, the results and the checks that passed or failed — and answers as an engineer would, pointing at the governing clause rather than a search result.</p>'
      + '        <button class="al-btn al-btn-primary" data-launch>Try the copilot →</button>'
      + '      </div>'
      + '      <div class="al-asks">' + ASK.map(function (a) {
               return '<div class="al-ask"><span class="q">›</span>' + a + '</div>'; }).join('') + '</div>'
      + '    </div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-why">'
      + '    <div class="al-eyebrow">Why teams choose it</div><h2 class="al-h2">A warm, modern engineering experience</h2>'
      + '    <p class="al-lead">Powerful where it counts, friendly everywhere else.</p>'
      + '    <div class="al-caps">'
      + cap('Live 3D visualisation', 'See every design update as a rotating 3D model and internal-flow animation.')
      + cap('Auto-optimisation', 'Corrections you can apply in one click — and a clear all-clear when nothing needs changing.')
      + cap('Standards-aligned', 'Calculations follow ASME, TEMA, API and ANSI/HI practice with transparent formulae.')
      + cap('Multi-unit ready', 'Switch SI · US · CGS instantly — every value, chart, drawing and report converts together.')
      + cap('Instant documentation', 'Fabrication GA drawings, BOMs and engineering reports export to clean PDFs.')
      + cap('Secure &amp; private', 'Sign in once; your design data stays with you. Installable as an app.')
      + '    </div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-who">'
      + '    <div class="al-eyebrow">Designed for</div><h2 class="al-h2">Whoever has to defend the number</h2>'
      + '    <div class="al-who">' + AUDIENCE.map(function (a) {
             return '<div class="al-card al-whoitem"><span class="wi">' + I(a[0], 22) + '</span><b>' + a[1] + '</b></div>'; }).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv" id="al-roadmap">'
      + '    <div class="al-eyebrow">Coming soon</div><h2 class="al-h2">What we are building next</h2>'
      + '    <p class="al-lead">Not yet available — listed so you can see where the suite is going before you commit to it.</p>'
      + '    <div class="al-road">' + ROADMAP.map(function (r) {
             return '<div class="al-roaditem"><span class="rd"></span><b>' + r + '</b></div>'; }).join('') + '</div>'
      + '  </section>'

      + '  <section class="al-sec al-rv"><div class="al-band">'
      + '    <h2>Build. Calculate. Validate. Visualize.</h2>'
      + '    <p>AROGARA FLOWSIZE brings engineering calculations, design validation, visualization and '
      +      'documentation into one digital engineering environment.</p>'
      + '    <button class="al-btn al-btn-primary" data-launch>Launch AROGARA FLOWSIZE</button>'
      + '  </div></section>'

      + '</div>'

      + '<footer class="al-foot">'
      + '  <div class="al-footgrid">'
      + '    <div class="al-footbrand"><div class="fb">AROGARA FLOWSIZE</div>'
      + '      <p>Digital Engineering Design Platform.<br>Engineering · Calculation · Visualization · Documentation</p></div>'
      +      FOOTER.map(footCol).join('')
      + '  </div>'
      + '  <div class="al-footbot">Made in India 🇮🇳 · Digital India Initiative · © ' + (new Date().getFullYear()) + ' AROGARA Technologies. All rights reserved.</div>'
      + '</footer>';
  }

  /* While the landing covers the screen the app beneath must not scroll —
     it is wider than a phone viewport, and letting it move sideways under a
     fixed overlay reads as a broken page. */
  var priorOverflow = null;
  function lockScroll(on) {
    if (on) { priorOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    else if (priorOverflow !== null) { document.body.style.overflow = priorOverflow; priorOverflow = null; }
  }

  function launch() {
    var el = document.getElementById('aro-landing');
    if (!el) return;
    el.style.transition = 'opacity .4s ease';
    el.style.opacity = '0';
    lockScroll(false);
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 420);
  }

  function wire(root) {
    root.querySelectorAll('[data-launch]').forEach(function (b) {
      b.addEventListener('click', launch);
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(); } });
    });
    root.querySelectorAll('[data-scroll]').forEach(function (b) {
      b.addEventListener('click', function () { var t = document.getElementById(b.getAttribute('data-scroll')); if (t) t.scrollIntoView({ behavior: 'smooth' }); });
    });
    root.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); } });
    });

    /* Reveal sections as they come into view. If the observer is missing,
       or motion is unwanted, everything is simply shown. */
    var rv = root.querySelectorAll('.al-rv');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (!('IntersectionObserver' in window) || reduce) {
      rv.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { root: root, rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    rv.forEach(function (e) { io.observe(e); });
    /* Anything already on screen at mount should not wait for a scroll. */
    setTimeout(function () {
      rv.forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.top < (window.innerHeight || 800)) e.classList.add('in');
      });
    }, 80);
  }

  function mount() {
    if (hasSession()) return;                       // returning user → straight to app
    if (document.getElementById('aro-landing')) return;
    var d = document.createElement('div');
    d.id = 'aro-landing';
    d.innerHTML = html();
    document.body.appendChild(d);
    lockScroll(true);
    wire(d);
    window.AROLanding = { launch: launch, figures: FIGURES };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 60); });
  else setTimeout(mount, 60);
})();

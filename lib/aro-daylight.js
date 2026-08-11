/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — DAYLIGHT THEME

   The suite had two themes and both of them were dark. The second one was
   called "light" but index.html quietly redefined it as a warmer graphite,
   with a comment saying why: the modules render their panels as inline
   styles, hand-tuned light-on-dark — 1348 colour declarations across 110
   distinct literals — and a white ground would have left pale text on white
   through half the application. So the honest short-term answer was to keep
   both themes dark.

   This is the piece of work that was deferred. It is a real daylight theme,
   it is the DEFAULT, and it is built in two layers:

     1 · TOKENS. The palette below is the engineering-drawing set: a cool
         near-white ground, white cards, navy text, and one warm accent.
         Everything that already reads from the design tokens follows this
         for free.

     2 · A LITERAL REMAP. The inline styles cannot read tokens — they were
         written before the tokens existed — so the second layer catches
         them by matching the literal in the style attribute and overriding
         it. That is the only mechanism that reaches an inline style short
         of rewriting every module, and it is precise: each rule names both
         the property and the exact colour it replaces, so a value is only
         ever touched where it was actually used.

   The remap covers the literals that the running application actually
   emits — collected from the live DOM across every tab rather than guessed
   at — so the list is finite, checkable, and grows only when a module
   introduces a new hard-coded colour.

   Dark is untouched. Nothing here applies unless body carries .theme-day.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── The engineering daylight palette ────────────────────────────────── */
  var DAY = {
    /* Surfaces, darkest ground to brightest data. The ground is NOT white:
       an engineering workstation reads as a grey desk with white data on it,
       and white is spent only where a number is entered or reported. */
    app:      '#e7ebef',   // outer application ground
    workspace:'#eef1f4',   // the calculation canvas inside a tab
    card:     '#f7f8fa',   // primary card / panel
    card2:    '#f1f3f5',   // secondary card, nested section
    input:    '#ffffff',   // input fields and single result cells only
    nav:      '#e4e8ed',   // module navigation strip
    header:   '#e1e6eb',   // top header and table headers

    border:   '#c8d0d8',   // standard 1 px rule
    borderStrong: '#aeb7c2',

    text:     '#18212b',   // primary — dark navy
    muted:    '#4b5563',   // secondary
    faint:    '#6b7280',   // muted labels and units
    disabled: '#9ca3af',

    accent:      '#d96b16',  // AROGARA orange — fills, indicators, borders
    accentSoft:  '#fce8d7',
    accentBorder:'#e39a63',
    accentFocus: '#fff8f2',  // focused input ground

    ok:   '#16835b',
    warn: '#b7791f',
    fail: '#c63d3d',
    info: '#2563a6',
    infoSoft: '#e8f0fa',     // auto-calculated badge ground

    /* ── Verdict washes ─────────────────────────────────────────────────
       A result card states a NUMBER; the verdict is a tint behind it and a
       rule down its edge, not a filled block of colour. A saturated green
       panel two columns wide reads as decoration and swamps the figure it is
       supposed to qualify — and once every passing card is green, green
       stops meaning anything. These are 4–6 % washes: visible when you scan
       the panel, invisible when you read the number. */
    okWash:   '#eff6f2', okLine:   '#9ecdb6',
    warnWash: '#fdf6ea', warnLine: '#e0c893',
    failWash: '#fbeff0', failLine: '#e2b4b4',

    /* The dark technical canvas. The viewport stays dark in light mode ON
       PURPOSE: pipes, contours, flow arrows and dimension labels are drawn
       to read against it, and a grey viewport flattens all of them. */
    viewport:     '#20252d',
    viewportEdge: '#252b33',

    /* ── The accents, darkened where they have to carry 11 px type ──────
       Measured on the #F7F8FA card: the brand orange lands at 3.3:1 and the
       amber at 3.5:1, both under the 4.5:1 body text needs. Success, error
       and blue already pass and are used unchanged. Fills, borders and the
       active-tab indicator keep the reference values above — there the
       colour is a mark, not a letter. */
    accentText: '#a8500c',   // 5.26:1 on the card
    warnText:   '#8a5a0f',   // 5.6:1
    okText:     '#126b4a',   // 5.9:1 — the supplied #16835B measures 4.55:1 on
                             //   the #F7F8FA card and drops below 4.5 on the
                             //   greyer #F1F3F5 console, so the text twin is
                             //   carried one step down; fills keep #16835B
    failText:   '#b02b2b',   // 5.9:1 — same reasoning for #C63D3D
    infoText:   '#2563a6'    // 5.85:1 — passes as supplied
  };

  /* ── Literal remap table ──────────────────────────────────────────────
     [ css property, [literals as they appear in the style attribute], value ]
     Both spellings are matched: the author's own text (#e2e8f0) and the
     form the CSSOM serialises to when a module assigns el.style.color. */
  var REMAP = [
    /* text that was written to sit on a dark ground */
    ['color', ['#e2e8f0', 'rgb(226, 232, 240)'], DAY.text],
    ['color', ['#f8fafc', 'rgb(248, 250, 252)'], DAY.text],
    ['color', ['#f1f5f9', '#e5e7eb', '#d1d5db'], DAY.text],
    ['color', ['#cbd5e1', 'rgb(203, 213, 225)'], DAY.text],
    ['color', ['#94a3b8', 'rgb(148, 163, 184)'], DAY.muted],
    ['color', ['#64748b', 'rgb(100, 116, 139)'], DAY.muted],
    ['color', ['#a0aec0', '#7ea2d8', '#b4c5e4', '#8b96ab'], DAY.muted],
    ['color', ['#475569', '#334155'], DAY.muted],

    /* accents that are legible on graphite but not on paper */
    ['color', ['#4ade80', '#86efac', '#22c55e', '#6ee7b7', '#34d399', '#10b981', '#14b8a6', '#2dd4bf',
               'rgb(34, 197, 94)', 'rgb(134, 239, 172)', 'rgb(74, 222, 128)'], DAY.okText],
    ['color', ['#f59e0b', '#fbbf24', '#fcd34d', '#facc15', '#eab308', 'rgb(245, 158, 11)'], DAY.warnText],
    ['color', ['#ef4444', '#f87171', '#fca5a5', '#dc2626', 'rgb(239, 68, 68)', 'rgb(248, 113, 113)'], DAY.failText],
    ['color', ['#38bdf8', '#60a5fa', '#7dd3fc', '#93c5fd', '#3b82f6', '#0ea5e9', 'rgb(59, 130, 246)'], DAY.infoText],
    ['color', ['#ff7538', '#f97316', '#fb923c', '#ea580c', '#ffb28a', '#fdba74', '#fed7aa',
               'rgb(255, 117, 56)', 'rgb(234, 88, 12)'], DAY.accentText],
    ['color', ['#a78bfa', '#8b5cf6', '#c4b5fd'], '#6d28d9'],
    ['color', ['#f9a8d4', '#f472b6'], '#be185d'],

    /* recessed wells and dark panel grounds */
    ['background', ['rgba(2,6,18,', 'rgba(2, 6, 18,'], DAY.input],
    ['background', ['rgba(15,23,42,', 'rgba(15, 23, 42,'], DAY.card2],
    ['background', ['#0b1220', '#0f172a', '#0f1524', '#111827', '#020617'], DAY.card2],
    ['background', ['#1e293b', '#1f2937', '#334155'], DAY.card2],
    ['background', ['#050d05', '#071007', '#0a1a0a', '#04121c', '#0a0f1e'], DAY.card2],
    /* A module that assigns el.style.background gets its value serialised by
       the CSSOM, so the attribute reads rgb(5, 13, 5) and not #050d05. Both
       spellings have to be listed or the field stays black on a white sheet. */
    ['background', ['rgb(5, 13, 5)', 'rgb(7, 16, 7)', 'rgb(10, 26, 10)', 'rgb(4, 18, 28)',
                    'rgb(11, 18, 32)', 'rgb(15, 23, 42)', 'rgb(30, 41, 59)', 'rgb(2, 6, 18)'], DAY.card2],
    ['background', ['rgba(148,163,184,0.04', 'rgba(148, 163, 184, 0.04'], DAY.card2],

    /* hairlines drawn as a translucent light on dark vanish on paper */
    ['border-color', ['rgba(148,163,184,', 'rgba(148, 163, 184,'], DAY.border],
    ['border-color', ['#334155', '#1e293b', '#475569'], DAY.border]
  ];

  /* Build the override sheet. Each literal contributes one selector; the
     property is named explicitly so a colour used for text is never
     mistaken for the same colour used as a fill. */
  function remapCss() {
    var out = [];
    for (var i = 0; i < REMAP.length; i++) {
      var prop = REMAP[i][0], lits = REMAP[i][1], val = REMAP[i][2];
      var sel = [];
      for (var j = 0; j < lits.length; j++) {
        var lit = lits[j];
        /* the declaration as written, with and without the space after the
           colon — both spellings occur across the modules */
        sel.push('body.theme-day [style*="' + prop + ':' + lit + '"]');
        sel.push('body.theme-day [style*="' + prop + ': ' + lit + '"]');
      }
      /* background-color and background are interchangeable in the source,
         so a background rule has to set both to win either way */
      var decl = (prop === 'background')
        ? 'background-color:' + val + ' !important;background-image:none !important;'
        : prop + ':' + val + ' !important;';
      out.push(sel.join(',') + '{' + decl + '}');
    }
    return out.join('\n');
  }


  /* ── Inside a viewport, the remap has to be undone ────────────────────
     The literal remap is global, so it darkens the labels drawn over the 3D
     model too — and those sit on a dark ground, where dark text is invisible.
     Rather than exempt the viewport from the remap (an inline style cannot
     be reached selectively), this restores each literal to ITSELF inside the
     viewport: the module authored those colours for exactly this ground, so
     identity is the correct mapping. */
  /* The Workbench entries here used to be #wb-canvas / #wb-3d / .wb-stage.
     None of the three exists: the drawing sheet is svg.wb-canvas inside
     div.wb-canvas-wrap, and the 3D CAD view is canvas#wb-3d-canvas. So the
     rules never fired, and the 3D canvas — which carries an inline
     background:#0b1220 — was being caught by the literal remap and lifted to
     the light card grey instead. The drawing sheet stays WHITE (it is a
     drawing, not a viewport); the 3D CAD view joins the other dark
     viewports, which is where it belonged all along. */
  var VP = ['[id$="3dblock"]', '[id$="-3d-container"]', '[id$="-3d-wrapper"]',
            '[id$="-sim-overlay"]', '#pump-canvas', '#wb-3d-canvas'];

  function viewportRestoreCss() {
    var out = [];
    for (var i = 0; i < REMAP.length; i++) {
      var prop = REMAP[i][0], lits = REMAP[i][1];
      if (prop !== 'color') continue;
      for (var j = 0; j < lits.length; j++) {
        var lit = lits[j], sel = [];
        for (var v = 0; v < VP.length; v++) {
          sel.push('body.theme-day ' + VP[v] + ' [style*="' + prop + ':' + lit + '"]');
          sel.push('body.theme-day ' + VP[v] + ' [style*="' + prop + ': ' + lit + '"]');
        }
        out.push(sel.join(',') + '{color:' + lit + ' !important;}');
      }
    }
    /* anything in there without its own colour takes the dark-ground text */
    var plain = [], surf = [];
    for (var k = 0; k < VP.length; k++) {
      plain.push('body.theme-day ' + VP[k] + ',body.theme-day ' + VP[k] + ' *:not(canvas):not([style*="color"])');
      surf.push('body.theme-day ' + VP[k] + ' *:not(canvas)');
    }
    out.push(plain.join(',') + '{color:#e2e8f0 !important;}');
    out.push(surf.join(',') + '{background-color:transparent !important;border-color:rgba(255,255,255,0.16) !important;}');
    return out.join('\n');
  }

  var CSS = [
    /* ── 1 · TOKENS ───────────────────────────────────────────────────── */
    'body.theme-day{',
    '  --bg-app:' + DAY.app + ';',
    '  --bg-panel:' + DAY.card + ';',
    '  --bg-input:' + DAY.input + ';',
    '  --surf-0:' + DAY.workspace + ';',
    '  --surf-1:' + DAY.card + ';',
    '  --surf-2:' + DAY.card2 + ';',
    '  --border-muted:' + DAY.border + ';',
    '  --hairline:' + DAY.border + ';',
    '  --border-active:' + DAY.accent + ';',
    /* These tokens are read for TEXT far more often than for fills, so they
       carry the readable weights; --border-active keeps the brand orange for
       rules and indicators, where it is a mark and not a letter. */
    '  --color-saffron:' + DAY.accentText + ';',
    '  --color-green:' + DAY.okText + ';',
    '  --color-chakra:' + DAY.infoText + ';',
    '  --color-ok:' + DAY.okText + ';--color-warn:' + DAY.warnText + ';--color-fail:' + DAY.failText + ';',
    '  --color-red:' + DAY.failText + ';--color-amber:' + DAY.warnText + ';',
    '  --color-blue:' + DAY.infoText + ';--color-teal:' + DAY.okText + ';',
    '  --color-white:' + DAY.text + ';',
    '  --bg-ok:rgba(22,131,91,0.10);--border-ok:rgba(22,131,91,0.32);',
    '  --bg-warn:rgba(183,121,31,0.12);--border-warn:rgba(183,121,31,0.34);',
    '  --bg-fail:rgba(198,61,61,0.10);--border-fail:rgba(198,61,61,0.32);',
    '  --text-main:' + DAY.text + ';',
    '  --text-muted:' + DAY.muted + ';',
    '  --text-header:' + DAY.text + ';',
    '  --saffron-glow:rgba(217,107,22,0.10);',
    '  --green-glow:rgba(22,131,91,0.10);',
    '  --chakra-glow:rgba(37,99,166,0.10);',
    /* Depth comes from a rule and a change of grey, not from a drop shadow.
       A drawing office does not have soft shadows in it. */
    '  --shadow-main:0 1px 0 rgba(23,33,43,0.04);',
    '  --tick:rgba(217,107,22,0.40);',
    '  --grid-line:rgba(23,33,43,0.030);',
    '  color-scheme:light;',
    '}',
    'body.theme-day{background-color:' + DAY.app + ';background-image:none;}',
    'body.theme-day .terminal-container{background-color:' + DAY.workspace + ';}',
    'body.theme-day .tab-content{background:transparent;}',

    /* ── 2 · CHROME ───────────────────────────────────────────────────── */
    'body.theme-day .terminal-header{background:' + DAY.header + ' !important;',
    '  border-bottom:1px solid ' + DAY.border + ' !important;}',
    'body.theme-day .terminal-nav{background:' + DAY.nav + ' !important;',
    '  border-bottom:1px solid ' + DAY.border + ' !important;}',
    'body.theme-day .terminal-logs{background:' + DAY.header + ' !important;',
    '  border-top:1px solid ' + DAY.border + ' !important;color:' + DAY.muted + ';}',
    /* The active module lifts to the card grey and is marked by an orange
       rule along its base — the strongest single cue in the chrome. */
    'body.theme-day .nav-tab{color:' + DAY.muted + ';background:transparent;}',
    'body.theme-day .nav-tab:hover{color:' + DAY.text + ';background:rgba(255,255,255,0.45);}',
    'body.theme-day .nav-tab.active{background:' + DAY.card + ' !important;color:' + DAY.text + ' !important;',
    '  border-bottom:3px solid ' + DAY.accent + ' !important;}',
    'body.theme-day .nav-tab.active .tab-num{color:' + DAY.accentText + ' !important;}',
    'body.theme-day .tab-num{color:' + DAY.muted + ' !important;}',
    'body.theme-day .logo-text{background:none;-webkit-text-fill-color:' + DAY.text + ';color:' + DAY.text + ';}',
    'body.theme-day .logo-accent,body.theme-day .wb-brand{color:#6e3405 !important;}',
    'body.theme-day .logs-status-val{color:' + DAY.text + ' !important;}',
    'body.theme-day .status-label{color:' + DAY.okText + ' !important;}',
    'body.theme-day .header-time,body.theme-day .logs-title{color:' + DAY.muted + ' !important;}',
    'body.theme-day .digital-badge{background:' + DAY.accentSoft + ' !important;color:' + DAY.accentText + ' !important;',
    '  border:1px solid ' + DAY.accentBorder + ' !important;}',

    /* ── 3 · SURFACES: ground → workspace → card → data ───────────────── */
    /* The left panel is the control console and the right one the
       calculation canvas, so they sit a shade apart from each other and both
       sit above the ground. Section cards then lift off the console, and the
       data itself is the only white on the screen. Four surfaces, four
       levels — that is what makes it read as depth rather than as a page. */
    'body.theme-day .panel,body.theme-day .sizing-panel{background:' + DAY.card + ';',
    '  border:1px solid ' + DAY.border + ';box-shadow:none;border-radius:6px;}',
    'body.theme-day .panel-input,body.theme-day .pump-left-panel{',
    '  background:' + DAY.card2 + ' !important;border:1px solid ' + DAY.border + ' !important;}',
    'body.theme-day .panel-output,body.theme-day .pump-right-panel,',
    'body.theme-day .results-column-data{background:' + DAY.workspace + ' !important;',
    '  border:1px solid ' + DAY.border + ' !important;}',
    'body.theme-day .panel-header{background:' + DAY.header + ';border-bottom:1px solid ' + DAY.border + ';}',
    'body.theme-day .analysis-section,body.theme-day .pump-accordion,',
    'body.theme-day .pump-summary-box,body.theme-day .aln-bern,',
    'body.theme-day .status-banner{',
    '  background:' + DAY.card + ' !important;color:' + DAY.text + ' !important;',
    '  border:1px solid ' + DAY.border + ' !important;box-shadow:none !important;}',
    'body.theme-day .pump-accordion>summary{background:' + DAY.card2 + ' !important;color:' + DAY.text + ' !important;',
    '  border-bottom:1px solid ' + DAY.border + ';}',
    /* Prose inside those containers is coloured by its own class rules,
       written near-white for graphite; anything that does not carry its own
       inline colour inherits the daylight text colour. */
    'body.theme-day .pump-accordion *:not([style*="color"]):not(.text-green):not(.text-teal),',
    'body.theme-day .pump-summary-box *:not([style*="color"]),',
    'body.theme-day .aln-bern *:not([style*="color"]),',
    'body.theme-day .status-banner *:not([style*="color"]){color:' + DAY.text + ';}',
    /* A result card is the grey it reports on; the number itself is white. */
    'body.theme-day .result-card,body.theme-day .pump-res-card,',
    'body.theme-day tr.eff-row{background:' + DAY.card + ' !important;color:' + DAY.text + ' !important;',
    '  border:1px solid ' + DAY.border + ' !important;box-shadow:none !important;border-radius:5px;}',
    'body.theme-day .card-label,body.theme-day .res-label{color:' + DAY.muted + ' !important;}',
    'body.theme-day .card-value,body.theme-day .res-value,',
    'body.theme-day .res-value span{color:' + DAY.text + ';text-shadow:none;}',
    'body.theme-day .res-sub,body.theme-day .res-sub span,',
    'body.theme-day .card-sub,body.theme-day .card-sub span{color:' + DAY.muted + ';}',
    'body.theme-day .highlight-card{background:' + DAY.input + ' !important;',
    '  border:1px solid ' + DAY.accentBorder + ' !important;box-shadow:none;}',
    'body.theme-day .highlight-card .res-value,',
    'body.theme-day .highlight-card .res-value span{color:' + DAY.accentText + ';text-shadow:none;}',

    /* ── 3b · THE VERDICT LIVES ON THE EDGE OF THE CARD ────────────────
       A calculated figure with no verdict attached is NEUTRAL — light grey,
       like every other card, because most numbers are not a pass or a fail,
       they are just the answer. Only a card that has actually been judged
       takes a colour, and it takes it as a 4–6 % wash plus a 3 px rule down
       its leading edge. The rule is what you see from across the room; the
       wash is what you see when you look at the card. Neither of them
       obscures the number, and nothing on the panel becomes a solid block of
       green. The dark theme keeps its glowing tiles untouched. */
    'body.theme-day .result-card.status-ok,body.theme-day .pump-res-card.status-ok,',
    'body.theme-day .cav-status-card.status-ok,body.theme-day .aro-card-pass{',
    '  background:' + DAY.okWash + ' !important;border:1px solid ' + DAY.okLine + ' !important;',
    '  border-left:3px solid ' + DAY.ok + ' !important;box-shadow:none !important;}',
    'body.theme-day .result-card.status-warn,body.theme-day .pump-res-card.status-warn,',
    'body.theme-day .cav-status-card.status-warn,body.theme-day .aro-card-warn{',
    '  background:' + DAY.warnWash + ' !important;border:1px solid ' + DAY.warnLine + ' !important;',
    '  border-left:3px solid ' + DAY.warn + ' !important;box-shadow:none !important;}',
    'body.theme-day .result-card.status-fail,body.theme-day .pump-res-card.status-fail,',
    'body.theme-day .cav-status-card.status-fail,body.theme-day .aro-card-fail{',
    '  background:' + DAY.failWash + ' !important;border:1px solid ' + DAY.failLine + ' !important;',
    '  border-left:3px solid ' + DAY.fail + ' !important;box-shadow:none !important;',
    /* the dark theme pulses a red glow behind a cavitating pump. A glow is a
       screen effect; on a light sheet it reads as a flicker, so the card is
       simply red-edged and still. */
    '  animation:none !important;}',
    /* the headline figure carries the verdict colour; its label stays neutral
       so the card does not turn into one solid hue */
    'body.theme-day .status-ok .res-value,body.theme-day .status-ok .res-value span,',
    'body.theme-day .status-ok .card-value{color:' + DAY.okText + ' !important;text-shadow:none !important;}',
    'body.theme-day .status-warn .res-value,body.theme-day .status-warn .res-value span,',
    'body.theme-day .status-warn .card-value{color:' + DAY.warnText + ' !important;text-shadow:none !important;}',
    'body.theme-day .status-fail .res-value,body.theme-day .status-fail .res-value span,',
    'body.theme-day .status-fail .card-value{color:' + DAY.failText + ' !important;text-shadow:none !important;}',
    'body.theme-day .status-ok .res-label,body.theme-day .status-warn .res-label,',
    'body.theme-day .status-fail .res-label,body.theme-day .status-ok .card-label,',
    'body.theme-day .status-warn .card-label,body.theme-day .status-fail .card-label{',
    '  color:' + DAY.muted + ' !important;}',
    /* the 4 px gradient strip at the head of the cavitation card is the old
       dark-theme glow; on paper it becomes a flat rule in the verdict colour */
    'body.theme-day .status-ok .card-accent{background:' + DAY.ok + ' !important;height:3px !important;}',
    'body.theme-day .status-warn .card-accent{background:' + DAY.warn + ' !important;height:3px !important;}',
    'body.theme-day .status-fail .card-accent{background:' + DAY.fail + ' !important;height:3px !important;}',
    /* ── The NPSH stat tiles ───────────────────────────────────────────
       These are the "large solid green-gray blocks". They are painted
       rgba(13,31,13,0.5) — a half-opacity DARK GREEN authored for graphite —
       and half-opacity dark over a light card composites to sage mud. It is
       invisible to a contrast audit (the text on it still passes) and plainly
       wrong to look at, which is why it survived the first two passes. On
       paper they are what they actually are: four neutral tiles reporting
       four numbers, with the verdict left to the card that carries one. */
    'body.theme-day .pump-mini-card,body.theme-day #card-cavitation-display{',
    '  background:' + DAY.card2 + ' !important;background-image:none !important;',
    '  border:1px solid ' + DAY.border + ' !important;border-radius:4px;box-shadow:none !important;}',
    'body.theme-day .pump-mini-card>div:first-child,',
    /* 8 px caps: DAY.faint measures 4.35:1 on the tile and misses AA, so the
       label takes the darker muted weight */
    'body.theme-day #card-cavitation-display>div:first-child{color:' + DAY.muted + ' !important;',
    '  opacity:1 !important;}',
    'body.theme-day .pump-mini-card>div:not(:first-child){color:' + DAY.text + ' !important;',
    '  text-shadow:none !important;}',
    /* the 3D simulation bezel is the frame around a dark canvas, not a
       viewport itself — it takes the light panel grey so the dark ground
       stops exactly where the model starts */
    'body.theme-day .iso-animation-wrapper{background:' + DAY.card2 + ' !important;',
    '  border:1px solid ' + DAY.border + ' !important;}',

    /* the banner above the cards follows the same restraint */
    'body.theme-day .status-banner.banner-teal{background:' + DAY.okWash + ' !important;',
    '  border:1px solid ' + DAY.okLine + ' !important;border-left:3px solid ' + DAY.ok + ' !important;}',
    'body.theme-day .status-banner.banner-amber{background:' + DAY.warnWash + ' !important;',
    '  border:1px solid ' + DAY.warnLine + ' !important;border-left:3px solid ' + DAY.warn + ' !important;}',
    'body.theme-day .status-banner.banner-red{background:' + DAY.failWash + ' !important;',
    '  border:1px solid ' + DAY.failLine + ' !important;border-left:3px solid ' + DAY.fail + ' !important;}',
    'body.theme-day .banner-teal .banner-message,body.theme-day .banner-teal .banner-badge{color:' + DAY.okText + ' !important;}',
    'body.theme-day .banner-amber .banner-message,body.theme-day .banner-amber .banner-badge{color:' + DAY.warnText + ' !important;}',
    'body.theme-day .banner-red .banner-message,body.theme-day .banner-red .banner-badge{color:' + DAY.failText + ' !important;}',

    /* ── 4 · INPUTS: white data on a grey console ─────────────────────── */
    'body.theme-day .form-control,body.theme-day input[type="text"],',
    'body.theme-day input[type="number"],body.theme-day input[type="date"],',
    'body.theme-day select,body.theme-day textarea{',
    '  background:' + DAY.input + ';border:1px solid ' + DAY.border + ';color:' + DAY.text + ';',
    '  box-shadow:none;border-radius:4px;}',
    'body.theme-day input[readonly]{background:' + DAY.card2 + ';color:' + DAY.muted + ';}',
    'body.theme-day input::placeholder,body.theme-day textarea::placeholder{color:' + DAY.disabled + ';}',
    'body.theme-day .form-control:hover,body.theme-day input:hover:not([readonly]),',
    'body.theme-day select:hover{border-color:' + DAY.borderStrong + ';}',
    'body.theme-day .form-control:focus,body.theme-day input:focus,',
    'body.theme-day select:focus,body.theme-day textarea:focus{',
    '  border-color:' + DAY.accent + ';background:' + DAY.accentFocus + ';',
    '  box-shadow:0 0 0 2px rgba(217,107,22,0.18);outline:none;}',

    /* ── 5 · TABLES read as calculation sheets ────────────────────────── */
    'body.theme-day table{color:' + DAY.text + ';border-color:' + DAY.border + ';}',
    'body.theme-day th{background:' + DAY.header + ' !important;color:' + DAY.muted + ' !important;',
    '  border-color:' + DAY.border + ' !important;}',
    'body.theme-day td{border-color:' + DAY.border + ';}',
    'body.theme-day tbody tr{background:' + DAY.card + ';}',
    'body.theme-day tbody tr:nth-child(even),body.theme-day .highlight-row{background:' + DAY.workspace + ';}',

    /* ── 6 · BUTTONS keep their hierarchy ─────────────────────────────── */
    'body.theme-day .btn,body.theme-day button{border-radius:4px;}',
    'body.theme-day .aln-hbtn,body.theme-day .tk-act,body.theme-day .wb-tool,',
    'body.theme-day .sthe-collapse-btn{background:' + DAY.card2 + ';color:' + DAY.text + ';',
    '  border:1px solid ' + DAY.border + ';}',
    /* undo / redo read as neutral with an engineering-blue mark */
    'body.theme-day [id$="-undo-btn"],body.theme-day [id$="-redo-btn"],',
    'body.theme-day [id$="-undo"],body.theme-day [id$="-redo"],',
    'body.theme-day .aln-hbtn.aln-blue{background:' + DAY.card2 + ' !important;',
    '  color:' + DAY.infoText + ' !important;border:1px solid ' + DAY.border + ' !important;}',
    'body.theme-day [id$="-undo-btn"] *,body.theme-day [id$="-redo-btn"] *,',
    'body.theme-day [id$="-undo"] *,body.theme-day [id$="-redo"] *,',
    'body.theme-day .aln-hbtn.aln-blue *{color:' + DAY.infoText + ' !important;}',
    /* reset is a destructive control and says so, quietly */
    'body.theme-day [id$="-reset-btn"],body.theme-day [id$="-reset"],',
    'body.theme-day .aln-hbtn.aln-red{',
    '  background:rgba(198,61,61,0.08) !important;color:' + DAY.failText + ' !important;',
    '  border:1px solid rgba(198,61,61,0.45) !important;}',
    'body.theme-day [id$="-reset-btn"] *,body.theme-day [id$="-reset"] *,',
    'body.theme-day .aln-hbtn.aln-red *{color:' + DAY.failText + ' !important;}',
    'body.theme-day .wb-tool.active{background:' + DAY.accentText + ' !important;color:#ffffff !important;',
    '  border-color:' + DAY.accentText + ' !important;}',
    'body.theme-day .aln-cardh,body.theme-day .tk-cardh,body.theme-day .wb-cat,',
    'body.theme-day .tk-viewbtn,body.theme-day .aln-apply,body.theme-day .aln-close-apply,',
    'body.theme-day .apply-pump-correction{color:' + DAY.accentText + ' !important;}',
    'body.theme-day .wb-menubar{background:' + DAY.nav + ' !important;border-color:' + DAY.border + ' !important;}',
    'body.theme-day .wb-menubar,body.theme-day .wb-menubar button{color:' + DAY.text + ' !important;}',
    'body.theme-day .wb-statusbar{background:' + DAY.header + ' !important;color:' + DAY.muted + ' !important;',
    '  border-color:' + DAY.border + ' !important;}',
    'body.theme-day .wb-palette{background:' + DAY.card2 + ' !important;}',
    'body.theme-day .wb-props{background:' + DAY.card + ' !important;}',
    'body.theme-day .wb-prop-empty,body.theme-day .wb-count{color:' + DAY.muted + ' !important;}',
    'body.theme-day .text-teal,body.theme-day .text-green{color:' + DAY.okText + ' !important;}',
    'body.theme-day [style*="color:var(--color-saffron)"],',
    'body.theme-day [style*="color: var(--color-saffron)"]{color:' + DAY.accentText + ' !important;}',

    /* the module verdict palettes, shipped as class rules inside each
       module's own injected stylesheet */
    'body.theme-day .aln-rr b,body.theme-day .tk-rr b,',
    'body.theme-day .tp2-rr b,body.theme-day .pid-rr b{color:' + DAY.text + ';}',
    'body.theme-day .aln-rr.ok b,body.theme-day .tk-rr.ok b,',
    'body.theme-day .tp2-rr.ok b,body.theme-day .pid-rr.ok b{color:' + DAY.okText + ';}',
    'body.theme-day .aln-rr.warn b,body.theme-day .tk-rr.warn b,',
    'body.theme-day .tp2-rr.warn b,body.theme-day .pid-rr.warn b{color:' + DAY.failText + ';}',
    'body.theme-day .aln-rr.mid b,body.theme-day .tk-rr.mid b,',
    'body.theme-day .tp2-rr.mid b,body.theme-day .pid-rr.mid b{color:' + DAY.warnText + ';}',

    /* an auto-calculated field is stated in engineering blue on its own wash */
    'body.theme-day .sthe-auto-badge,body.theme-day [id$="-tag"] span{',
    '  background:' + DAY.infoSoft + ';color:' + DAY.infoText + ' !important;',
    '  padding:1px 5px;border-radius:3px;}',

    /* white type only stays white where the fill behind it is still dark */
    'body.theme-day .pump-summary-box [style*="color:#fff"],',
    'body.theme-day .pump-summary-box [style*="color: #fff"],',
    'body.theme-day .pump-res-card [style*="color:#fff"],',
    'body.theme-day .pump-res-card [style*="color: #fff"],',
    'body.theme-day .result-card [style*="color:#fff"],',
    'body.theme-day .result-card [style*="color: #fff"]{color:' + DAY.text + ' !important;}',
    'body.theme-day .pump-res-card b,body.theme-day .result-card b{color:' + DAY.text + ';}',
    'body.theme-day .nozzle-advice{color:' + DAY.muted + ' !important;}',
    'body.theme-day .nozzle-advice.ok{color:' + DAY.okText + ' !important;}',

    /* ── 7 · THE LITERAL REMAP ────────────────────────────────────────── */
    remapCss(),

    /* ── 8 · THE VIEWPORT STAYS DARK ──────────────────────────────────────
       Deliberate, and it comes AFTER the remap so it wins: the 3D model,
       the live line view and the schematic canvases keep a dark technical
       ground in light mode. Pipes, pressure contours, flow arrows and
       dimension labels are all drawn to read against dark; lifting them onto
       grey flattens every one of them. The application around the viewport
       is light — the contrast between the two is the point. */
    'body.theme-day #pump-3d-container,body.theme-day #pump-canvas,',
    'body.theme-day #pump-sim-overlay,body.theme-day #sthe-3d-container,',
    'body.theme-day #sthe-sim-overlay,body.theme-day #dphe-3d-container,',
    'body.theme-day #dphe-3d-wrapper,body.theme-day #tp-3d-container,',
    'body.theme-day #tp-sim-overlay,body.theme-day #tp-animation-canvas,',
    'body.theme-day [id$="3dblock"],body.theme-day [id$="-3d-container"],',
    'body.theme-day [id$="-sim-overlay"],body.theme-day #wb-3d-canvas{',
    '  background:' + DAY.viewport + ' !important;background-image:none !important;',
    '  border:1px solid ' + DAY.borderStrong + ' !important;border-radius:6px;}',
    /* …but the CAD / P&ID drawing sheet is not a viewport. A P&ID is a
       DRAWING: it is issued on white, the line work and tag bubbles are
       black on white, and the grid is a faint construction rule. It stays
       white in both themes, and the remap is held off it explicitly so a
       component that paints itself cannot drag the sheet grey. */
    'body.theme-day .wb-canvas-wrap,body.theme-day .wb-canvas,',
    'body.theme-day #wb-svg{background:#ffffff !important;background-image:none !important;}',
    'body.theme-day #wb-svg text{fill:' + DAY.text + ';}',
    /* everything inside a viewport keeps the dark-ground palette it was
       drawn for — the remap must not reach in there */
    'body.theme-day [id$="3dblock"] *:not(canvas),',
    'body.theme-day [id$="-3d-container"] *:not(canvas),',
    'body.theme-day [id$="-sim-overlay"] *:not(canvas),',
    'body.theme-day #pump-3d-container *:not(canvas){background-color:transparent !important;}',
    'body.theme-day canvas{background-color:transparent;}',
    viewportRestoreCss(),
    /* the scale strip is a chip ON the dark canvas, so it keeps a dark chip */
    'body.theme-day [id$="3dblock"] .aln-scale{background:' + DAY.viewportEdge + ' !important;',
    '  border:1px solid rgba(255,255,255,0.18) !important;color:#e2e8f0 !important;}',
    'body.theme-day [id$="3dblock"] .aln-scale *{color:#e2e8f0 !important;}',

    /* ── 9 · CHARTS keep their engineering colours ────────────────────── */
    'body.theme-day .chart-container,body.theme-day .chart-box{',
    '  background:' + DAY.card + ';border:1px solid ' + DAY.border + ';border-radius:5px;}',

    /* Print artefacts are black on white by design and are left alone. */
    'body.theme-day .report-paper,body.theme-day .report-paper *{background-image:none;}',
    'body.theme-day [id$="-drawing-modal"] svg{background:#ffffff !important;}',
    'body.theme-day [id$="-drawing-modal"] svg text{fill:#0f172a;}',

    /* Scrollbars sit on the grey ground rather than staying black. */
    'body.theme-day ::-webkit-scrollbar{width:10px;height:10px;}',
    'body.theme-day ::-webkit-scrollbar-track{background:' + DAY.workspace + ';}',
    'body.theme-day ::-webkit-scrollbar-thumb{background:' + DAY.borderStrong + ';border-radius:5px;}',
    'body.theme-day ::-webkit-scrollbar-thumb:hover{background:#94a0ad;}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('aro-daylight-css')) return;
    var s = document.createElement('style');
    s.id = 'aro-daylight-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── The three-way preference ─────────────────────────────────────────
     light · dark · system. Light is the default, so a first-time engineer
     opens the suite on paper rather than on a console. "system" follows the
     operating system and keeps following it — a stored 'system' is not
     resolved once and forgotten. */
  var KEY = 'aro_theme_mode';
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    /* migrate the old two-value key; anything else starts on light */
    try {
      var old = localStorage.getItem('theme');
      if (old === 'dark') return 'dark';
    } catch (e) {}
    return 'light';
  }

  function resolve(mode) {
    if (mode === 'system') return (mql && mql.matches) ? 'dark' : 'light';
    return mode;
  }

  function paint(mode) {
    var eff = resolve(mode);
    var b = document.body;
    if (!b) return;
    b.classList.toggle('theme-day', eff === 'light');
    /* the graphite variant is a separate, older choice; the day theme must
       never sit on top of it */
    if (eff === 'light') b.classList.remove('light-theme');
    b.setAttribute('data-theme', eff);
    try { if (typeof window.redrawChartsThemeUpdate === 'function') window.redrawChartsThemeUpdate(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('aro-theme-change', { detail: { mode: mode, effective: eff } })); } catch (e) {}
  }

  var current = stored();

  window.AROTHEME = {
    mode: function () { return current; },
    effective: function () { return resolve(current); },
    set: function (m) {
      if (m !== 'light' && m !== 'dark' && m !== 'system') m = 'light';
      current = m;
      try { localStorage.setItem(KEY, m); } catch (e) {}
      paint(m);
      /* Keep the control in step. A theme set from anywhere other than the
         dropdown used to leave the dropdown reading the old choice, so the
         header claimed "Light" over a dark application. */
      var sel = document.getElementById('theme-mode');
      if (sel && sel.value !== m) sel.value = m;
      return m;
    }
  };

  if (mql && mql.addEventListener) {
    mql.addEventListener('change', function () { if (current === 'system') paint(current); });
  }

  /* Paint before first paint where possible, so the app never flashes the
     dark ground on its way to the light one. */
  injectCss();
  function boot() {
    paint(current);
    var sel = document.getElementById('theme-mode');
    if (sel) {
      sel.value = current;
      sel.addEventListener('change', function () { window.AROTHEME.set(this.value); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

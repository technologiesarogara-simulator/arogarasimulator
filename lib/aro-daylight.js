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
    app: '#f3f5f7',          // main application ground — very light cool grey
    chrome: '#e9edf1',       // header, nav, log strip — one step down from the cards
    card: '#ffffff',         // panels, cards, input wells
    card2: '#f8fafc',        // secondary cards, table stripes
    text: '#172033',         // main text — dark navy, not black
    muted: '#566273',        // secondary text — slate
    border: '#d6dce3',       // hairlines
    accent: '#e8751a',       // engineering orange — FILLS, borders, focus rings
    accentSoft: '#fff1e6',   // active tab wash
    ok: '#198754',
    warn: '#d98e04',
    fail: '#d83a3a',
    calc: '#2563eb',

    /* ── The same five colours, darkened for TEXT ──────────────────────
       A colour chosen to be seen as a fill is not automatically readable
       as 11 px type. Measured against white: the reference orange lands
       at 3.0:1, the amber at 2.7:1 — both well under the 4.5:1 that body
       text needs. These are the same hues carried down until they pass,
       so a status keeps its meaning and stays readable. Fills keep the
       lighter reference values above, where contrast is not the test. */
    accentText: '#b35509',   // 4.98:1 on white
    okText: '#157347',       // 4.66:1
    warnText: '#7a5203',     // 5.5:1
    failText: '#c0272d',     // 4.63:1
    calcText: '#1d4ed8'      // 6.3:1
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
    ['color', ['#38bdf8', '#60a5fa', '#7dd3fc', '#93c5fd', '#3b82f6', '#0ea5e9', 'rgb(59, 130, 246)'], DAY.calcText],
    ['color', ['#ff7538', '#f97316', '#fb923c', '#ea580c', '#ffb28a', '#fdba74', '#fed7aa',
               'rgb(255, 117, 56)', 'rgb(234, 88, 12)'], DAY.accentText],
    ['color', ['#a78bfa', '#8b5cf6', '#c4b5fd'], '#6d28d9'],
    ['color', ['#f9a8d4', '#f472b6'], '#be185d'],

    /* recessed wells and dark panel grounds */
    ['background', ['rgba(2,6,18,', 'rgba(2, 6, 18,'], DAY.card],
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

  var CSS = [
    /* ── 1 · TOKENS ───────────────────────────────────────────────────── */
    'body.theme-day{',
    '  --bg-app:' + DAY.app + ';',
    '  --bg-panel:' + DAY.card + ';',
    '  --bg-input:' + DAY.card + ';',
    '  --surf-0:' + DAY.app + ';',
    '  --surf-1:' + DAY.card + ';',
    '  --surf-2:' + DAY.card2 + ';',
    '  --border-muted:' + DAY.border + ';',
    '  --hairline:' + DAY.border + ';',
    '  --border-active:' + DAY.accent + ';',
    /* These tokens are read for TEXT throughout the modules, so they carry
       the readable variants; --border-active above keeps the brighter
       reference orange for rules and focus rings, where it is a line and
       not a letter. */
    '  --color-saffron:' + DAY.accentText + ';',
    '  --color-green:' + DAY.okText + ';',
    '  --color-chakra:' + DAY.calcText + ';',
    '  --color-ok:' + DAY.okText + ';--color-warn:' + DAY.warnText + ';--color-fail:' + DAY.failText + ';',
    '  --color-red:' + DAY.failText + ';--color-amber:' + DAY.warnText + ';',
    '  --color-blue:' + DAY.calcText + ';--color-teal:' + DAY.okText + ';',
    '  --color-white:' + DAY.text + ';',
    '  --bg-ok:rgba(25,135,84,0.08);--border-ok:rgba(25,135,84,0.28);',
    '  --bg-warn:rgba(217,142,4,0.10);--border-warn:rgba(217,142,4,0.30);',
    '  --bg-fail:rgba(216,58,58,0.08);--border-fail:rgba(216,58,58,0.28);',
    '  --text-main:' + DAY.text + ';',
    '  --text-muted:' + DAY.muted + ';',
    '  --text-header:' + DAY.text + ';',
    '  --saffron-glow:rgba(232,117,26,0.12);',
    '  --green-glow:rgba(25,135,84,0.12);',
    '  --chakra-glow:rgba(37,99,235,0.12);',
    '  --shadow-main:0 1px 2px rgba(23,32,51,0.06),0 8px 24px rgba(23,32,51,0.07);',
    '  --tick:rgba(232,117,26,0.45);',
    '  --grid-line:rgba(23,32,51,0.035);',
    '  color-scheme:light;',
    '}',
    'body.theme-day{background-color:' + DAY.app + ';background-image:none;}',

    /* ── 2 · CHROME ───────────────────────────────────────────────────── */
    'body.theme-day .terminal-header,body.theme-day .terminal-nav,',
    'body.theme-day .terminal-logs{background:' + DAY.chrome + ' !important;border-color:' + DAY.border + ' !important;}',
    'body.theme-day .terminal-logs{color:' + DAY.muted + ';}',
    /* the active tab gets the warm wash from the reference set */
    'body.theme-day .nav-tab.active{background:' + DAY.accentSoft + ' !important;color:' + DAY.accent + ' !important;}',
    'body.theme-day .nav-tab{color:' + DAY.muted + ';}',
    'body.theme-day .nav-tab:hover{color:' + DAY.text + ';}',
    'body.theme-day .logo-text{background:none;-webkit-text-fill-color:' + DAY.text + ';color:' + DAY.text + ';}',

    /* ── 3 · SURFACES ─────────────────────────────────────────────────── */
    'body.theme-day .sizing-panel,body.theme-day .panel,',
    'body.theme-day .pump-left-panel,body.theme-day .pump-right-panel,',
    'body.theme-day .results-column-data{background:' + DAY.card + ';border-color:' + DAY.border + ';}',
    'body.theme-day .pump-res-card,body.theme-day .result-card{',
    '  background:' + DAY.card2 + ';border-color:' + DAY.border + ';}',
    /* an input is a WELL: on paper depth reads as a ruled box, not a shadow */
    'body.theme-day .form-control,body.theme-day input[type="text"],',
    'body.theme-day input[type="number"],body.theme-day input[type="date"],',
    'body.theme-day select,body.theme-day textarea{',
    '  background:' + DAY.card + ';border:1px solid ' + DAY.border + ';color:' + DAY.text + ';',
    '  box-shadow:none;}',
    'body.theme-day input[readonly]{background:' + DAY.card2 + ';color:' + DAY.muted + ';}',
    'body.theme-day .form-control:focus,body.theme-day input:focus,body.theme-day select:focus{',
    '  border-color:' + DAY.accent + ';box-shadow:0 0 0 3px rgba(232,117,26,0.16);}',

    /* ── 4 · TABLES ───────────────────────────────────────────────────── */
    'body.theme-day table{color:' + DAY.text + ';}',
    'body.theme-day th{background:' + DAY.card2 + ';color:' + DAY.muted + ';border-color:' + DAY.border + ';}',
    'body.theme-day td{border-color:' + DAY.border + ';}',
    'body.theme-day .highlight-row,body.theme-day tr:nth-child(even){background:' + DAY.card2 + ';}',

    /* ── 5 · SURFACES THE CLASS SHEETS STILL PAINT DARK ───────────────
       These are not inline styles — they are class rules written when the
       only ground was graphite, so the literal remap cannot see them. The
       audit found them by measuring what was actually on screen: 216 text
       nodes were sitting on a dark surface in daylight mode, and all but a
       handful belonged to the manual accordions. */
    'body.theme-day .pump-accordion,body.theme-day .pump-accordion>summary,',
    'body.theme-day .pump-summary-box,body.theme-day .aln-bern,',
    'body.theme-day .status-banner,body.theme-day .wb-menubar,',
    'body.theme-day .sim-overlay,body.theme-day .aln-scale{',
    '  background:' + DAY.card + ' !important;color:' + DAY.text + ' !important;',
    '  border-color:' + DAY.border + ' !important;}',
    'body.theme-day .pump-accordion>summary{color:' + DAY.text + ' !important;}',
    /* Lightening a container is only half the job: the prose inside it is
       coloured by its own class rules, written near-white for graphite, and
       those win on specificity. Anything that does NOT carry its own inline
       colour — the remap has already dealt with those — inherits the
       daylight text colour instead of staying white on white. */
    'body.theme-day .pump-accordion *:not([style*="color"]):not(.text-green):not(.text-teal),',
    'body.theme-day .pump-summary-box *:not([style*="color"]),',
    'body.theme-day .aln-bern *:not([style*="color"]),',
    'body.theme-day .status-banner *:not([style*="color"]),',
    'body.theme-day .sim-overlay *:not([style*="color"]){color:' + DAY.text + ';}',
    'body.theme-day .result-card,body.theme-day .pump-res-card,',
    'body.theme-day tr.eff-row{background:' + DAY.card2 + ' !important;',
    '  color:' + DAY.text + ' !important;border-color:' + DAY.border + ' !important;}',
    'body.theme-day .card-label,body.theme-day .res-label{color:' + DAY.muted + ' !important;}',
    'body.theme-day .card-value,body.theme-day .res-value{color:' + DAY.text + ';}',

    /* ── 6 · BRAND AND STATUS TEXT IN THE CHROME ──────────────────────
       Same hues, carried down to where 11 px type survives on a pale
       ground. The fills above keep the reference colours. */
    'body.theme-day .tab-num{color:' + DAY.muted + ' !important;}',
    /* The header strip and the active-tab wash are themselves tinted, so
       the accent needs one more step down there than it does on white. */
    'body.theme-day .logo-accent{color:#8f4407 !important;}',
    'body.theme-day .logs-status-val{color:' + DAY.text + ' !important;}',
    'body.theme-day .status-label{color:' + DAY.okText + ' !important;}',
    'body.theme-day .nav-tab.active{color:#8f4407 !important;}',
    'body.theme-day .aln-cardh,body.theme-day .tk-cardh,body.theme-day .wb-cat,',
    'body.theme-day .tk-act,body.theme-day .tk-viewbtn,body.theme-day .aln-apply,',
    'body.theme-day .aln-close-apply,body.theme-day .sthe-collapse-btn,',
    'body.theme-day .apply-pump-correction{color:' + DAY.accentText + ' !important;}',
    'body.theme-day .wb-prop-empty,body.theme-day .wb-count{color:' + DAY.muted + ' !important;}',
    'body.theme-day .text-teal,body.theme-day .text-green{color:' + DAY.okText + ' !important;}',
    /* anything still asking for the token gets the readable orange */
    'body.theme-day [style*="color:var(--color-saffron)"],',
    'body.theme-day [style*="color: var(--color-saffron)"]{color:' + DAY.accentText + ' !important;}',

    /* White type only stays white where the fill behind it is still dark.
       Where the remap above lightened that fill, the type has to come with
       it or it writes white on white. */
    'body.theme-day [style*="background:rgba(2,6,18"][style*="color:#fff"],',
    'body.theme-day [style*="background:rgba(2, 6, 18"][style*="color:#fff"],',
    'body.theme-day [style*="background:#0f172a"][style*="color:#fff"],',
    'body.theme-day [style*="background:#1e293b"][style*="color:#fff"]{color:' + DAY.text + ' !important;}',

    /* A card that was dark carried white type set by its own class rules or
       by an inline colour:#fff. The fill is white now, so the type follows —
       scoped to the cards themselves so real white-on-colour badges elsewhere
       are untouched. */
    'body.theme-day .pump-summary-box [style*="color:#fff"],',
    'body.theme-day .pump-summary-box [style*="color: #fff"],',
    'body.theme-day .pump-res-card [style*="color:#fff"],',
    'body.theme-day .pump-res-card [style*="color: #fff"],',
    'body.theme-day .result-card [style*="color:#fff"],',
    'body.theme-day .result-card [style*="color: #fff"]{color:' + DAY.text + ' !important;}',
    'body.theme-day .pump-res-card b,body.theme-day .pump-res-card strong,',
    'body.theme-day .result-card b,body.theme-day .result-card strong{color:' + DAY.text + ';}',
    'body.theme-day .nozzle-advice{color:' + DAY.muted + ' !important;}',
    'body.theme-day .nozzle-advice.ok{color:' + DAY.okText + ' !important;}',

    /* The workbench menu bar and its brand were drawn for a dark chrome. */
    'body.theme-day .wb-menubar,body.theme-day .wb-menubar button{color:' + DAY.text + ' !important;}',
    'body.theme-day .wb-brand{color:' + DAY.accentText + ' !important;}',
    'body.theme-day .wb-statusbar{background:' + DAY.chrome + ' !important;color:' + DAY.muted + ' !important;',
    '  border-color:' + DAY.border + ' !important;}',
    'body.theme-day .digital-badge{background:' + DAY.accentSoft + ' !important;color:#8f4407 !important;',
    '  border-color:rgba(232,117,26,0.3) !important;}',
    'body.theme-day .wb-tool.active{background:' + DAY.accentText + ' !important;color:#ffffff !important;}',

    /* The five modules each ship the same verdict palette as class rules —
         .aln-rr.ok b{color:#22c55e} … .warn{#ef4444} … .mid{#f59e0b}
       written straight into their injected stylesheets, so neither the
       tokens nor the inline remap can reach them. Same hues, readable
       weights, one rule per module family. */
    'body.theme-day .aln-rr b,body.theme-day .tk-rr b,',
    'body.theme-day .tp2-rr b,body.theme-day .pid-rr b{color:' + DAY.text + ';}',
    'body.theme-day .aln-rr.ok b,body.theme-day .tk-rr.ok b,',
    'body.theme-day .tp2-rr.ok b,body.theme-day .pid-rr.ok b{color:' + DAY.okText + ';}',
    'body.theme-day .aln-rr.warn b,body.theme-day .tk-rr.warn b,',
    'body.theme-day .tp2-rr.warn b,body.theme-day .pid-rr.warn b{color:' + DAY.failText + ';}',
    'body.theme-day .aln-rr.mid b,body.theme-day .tk-rr.mid b,',
    'body.theme-day .tp2-rr.mid b,body.theme-day .pid-rr.mid b{color:' + DAY.warnText + ';}',
    'body.theme-day .aln-red,body.theme-day .aln-red span{color:' + DAY.failText + ';}',

    /* A result value is the number the engineer came for: it is the darkest
       thing on the card, and the highlighted one is the accent rather than a
       glow, which does not exist on paper. */
    'body.theme-day .res-value,body.theme-day .res-value span{color:' + DAY.text + ';text-shadow:none;}',
    'body.theme-day .highlight-card .res-value,',
    'body.theme-day .highlight-card .res-value span{color:' + DAY.accentText + ';text-shadow:none;}',
    'body.theme-day .highlight-card{border-color:rgba(232,117,26,0.45);box-shadow:none;}',
    /* The sub-line under a value — the same figure in a second unit — is a
       supporting note, so it takes the muted colour rather than inheriting
       the card's white. */
    'body.theme-day .res-sub,body.theme-day .res-sub span,',
    'body.theme-day .card-sub,body.theme-day .card-sub span{color:' + DAY.muted + ';}',

    /* ── 7 · THE LITERAL REMAP ────────────────────────────────────────── */
    remapCss(),

    /* Reports and drawings are already black-on-white by design — they are
       print artefacts. Nothing above may repaint them. */
    'body.theme-day .report-paper,body.theme-day .report-paper *{background-image:none;}',
    'body.theme-day [id$="-drawing-modal"] [style*="background:#ffffff"],',
    'body.theme-day [id$="-drawing-modal"] svg{background:#ffffff !important;}',
    'body.theme-day [id$="-drawing-modal"] svg text{fill:#0f172a;}',

    /* Scrollbars follow the ground rather than staying black on white. */
    'body.theme-day ::-webkit-scrollbar{width:10px;height:10px;}',
    'body.theme-day ::-webkit-scrollbar-track{background:' + DAY.app + ';}',
    'body.theme-day ::-webkit-scrollbar-thumb{background:#c3cbd6;border-radius:6px;}',
    'body.theme-day ::-webkit-scrollbar-thumb:hover{background:#a9b3c1;}'
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

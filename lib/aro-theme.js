/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — INSTRUMENT SKIN

   The suite looked like a generic dark dashboard: one blue-black ground,
   every panel the same translucent navy box with the same thin border, and
   the brand orange used for headings, borders, buttons and values alike —
   so nothing on the screen was louder than anything else and the eye had
   nowhere to land. Everything was also set in the same two or three sizes
   of monospace, which removes the last cue that could have built a
   hierarchy.

   This layer gives the app the character of a measuring instrument rather
   than a console skin, on four rules:

     1 · A neutral graphite ground instead of blue-black. Blue-black is the
         house style of every sci-fi dashboard; graphite is what precision
         equipment is actually made of, and it lets a single warm accent
         carry the brand.
     2 · Real material logic. Four surface levels, and input fields are
         RECESSED into their panel while result cards are RAISED off it —
         so "where I type" and "what the software computed" are told apart
         by depth, before any colour or label is read.
     3 · Accent discipline. Saffron now means one thing: this is active or
         this needs you. Green means pass, amber caution, red fail. Nothing
         else is allowed to use them, which is what makes them readable.
     4 · A typographic scale with real contrast — a computed number is set
         much larger than its label, in tabular figures so columns of
         results line up digit under digit the way a datasheet does.

   The signature detail is the corner tick: four hairline registration
   marks on every panel, the way a drawing sheet is marked up. It is a
   quiet thing that belongs to engineering documents and to nothing else.

   It is written as an override layer on top of the existing tokens rather
   than a rewrite of the stylesheet, so the whole skin can be turned off by
   removing one script tag.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CSS = [

    /* ── 1 · GROUND & SURFACES ─────────────────────────────────────────── */
    ':root{',
    '  --bg-app:#0b0d10;',            /* graphite canvas */
    '  --bg-panel:rgba(19,22,26,0.92);',
    '  --bg-input:#07080a;',          /* recessed well */
    '  --border-muted:rgba(148,163,184,0.13);',
    '  --border-active:#ff7538;',
    '  --text-main:#c3cbd6;',
    '  --text-muted:#8a94a3;',        /* was #5770a3 — under 4.5:1 on this ground */
    '  --text-header:#eef2f7;',
    '  --shadow-main:0 10px 34px rgba(0,0,0,0.55);',
    /* surface ladder + one shared hairline, used by the rules below */
    '  --surf-0:#0b0d10;',
    '  --surf-1:#131619;',
    '  --surf-2:#1a1e23;',
    '  --hairline:rgba(148,163,184,0.13);',
    '  --tick:rgba(255,117,56,0.42);',
    '}',

    /* The alternate theme is a SECOND DARK TONE, not a white one. That is a
       deliberate decision recorded in index.html: hundreds of result panels
       and cards are hand-tuned light-on-dark and have no light counterpart,
       so a true white theme leaves dark text on dark cards across half the
       suite. This is the warm, lifted graphite — clearly a different room
       from the cool primary, and every existing rule still holds in it.
       A genuine daylight/print theme is a separate piece of work. */
    'body.light-theme{',
    '  --bg-app:#1c2028;',
    '  --bg-panel:rgba(38,43,53,0.92);',
    '  --bg-input:#171b22;',
    '  --border-muted:rgba(180,192,210,0.18);',
    '  --text-main:#d3dae5;',
    '  --text-muted:#98a3b5;',
    '  --text-header:#f6f9fc;',
    '  --surf-0:#1c2028;--surf-1:#262b33;--surf-2:#2f353f;',
    '  --hairline:rgba(180,192,210,0.16);',
    '  --tick:rgba(255,140,84,0.5);',
    '}',
    /* Header, nav and log strip follow the same ladder in both themes so the
       chrome never sits a shade apart from the panels beneath it. */
    'body.light-theme .terminal-header,body.light-theme .terminal-nav,',
    'body.light-theme .terminal-logs{background:var(--surf-1);border-color:var(--hairline);}',

    /* Graph-paper ground: a hairline grid, barely there, so the canvas
       reads as drawing stock rather than as flat black. */
    'body{background-color:var(--bg-app);}',
    ':root{--grid-line:rgba(148,163,184,0.045);}',
    'body.light-theme{--grid-line:rgba(190,202,220,0.055);}',
    '.terminal-container{',
    '  background-image:linear-gradient(var(--grid-line) 1px,transparent 1px),',
    '                   linear-gradient(90deg,var(--grid-line) 1px,transparent 1px);',
    '  background-size:56px 56px;background-position:-1px -1px;',
    '}',

    /* ── 2 · PANELS: RAISED, WITH DRAWING-SHEET CORNER TICKS ───────────── */
    '.sizing-panel,.panel,.pump-left-panel,.pump-right-panel,.results-column-data{',
    '  position:relative;background:var(--surf-1);border:1px solid var(--hairline);',
    '  border-radius:10px;box-shadow:var(--shadow-main);',
    '}',
    /* the registration marks — two pseudo-elements, four corners */
    '.sizing-panel::before,.panel::before{',
    '  content:"";position:absolute;left:7px;top:7px;width:11px;height:11px;',
    '  border-left:1px solid var(--tick);border-top:1px solid var(--tick);',
    '  pointer-events:none;border-radius:1px 0 0 0;',
    '}',
    '.sizing-panel::after,.panel::after{',
    '  content:"";position:absolute;right:7px;bottom:7px;width:11px;height:11px;',
    '  border-right:1px solid var(--tick);border-bottom:1px solid var(--tick);',
    '  pointer-events:none;border-radius:0 0 1px 0;',
    '}',

    /* ── 3 · INPUTS ARE RECESSED ───────────────────────────────────────── */
    '.form-control,input[type="text"],input[type="number"],input[type="date"],select,textarea{',
    '  background:var(--bg-input);border:1px solid var(--hairline);border-radius:5px;',
    '  color:var(--text-header);',
    '  box-shadow:inset 0 1px 2px rgba(0,0,0,0.45);',
    '  transition:border-color .15s,box-shadow .15s;',
    '}',
    'body.light-theme .form-control,body.light-theme input[type="text"],',
    'body.light-theme input[type="number"],body.light-theme select,body.light-theme textarea{',
    '  box-shadow:inset 0 1px 2px rgba(15,23,42,0.07);',
    '}',
    '.form-control:hover,input:hover:not([readonly]),select:hover{border-color:rgba(255,117,56,0.32);}',
    '.form-control:focus,input:focus,select:focus,textarea:focus{',
    '  border-color:var(--border-active);',
    '  box-shadow:inset 0 1px 2px rgba(0,0,0,0.45),0 0 0 3px rgba(255,117,56,0.16);',
    '  outline:none;',
    '}',
    'input[readonly]{opacity:0.92;cursor:default;}',

    /* ── 4 · RESULT CARDS ARE RAISED ───────────────────────────────────── */
    '.pump-res-card,.result-card{',
    '  background:var(--surf-2);border:1px solid var(--hairline);border-radius:8px;',
    '  box-shadow:0 1px 0 rgba(255,255,255,0.03) inset,0 2px 8px rgba(0,0,0,0.3);',
    '  transition:border-color .15s,transform .15s;',
    '}',
    '.pump-res-card:hover,.result-card:hover{border-color:rgba(255,117,56,0.3);}',

    /* ── 5 · TYPOGRAPHY: LABEL SMALL AND QUIET, NUMBER LARGE AND CALM ──── */
    /* Labels: sans, sentence-weight, muted — they are not the message. */
    '.pump-res-card .res-label,.result-card .card-label,.res-label,.card-label{',
    '  font-family:var(--font-ui);font-size:10.5px;font-weight:500;letter-spacing:0.06em;',
    '  text-transform:uppercase;color:var(--text-muted);',
    '}',
    /* Numbers: mono, tabular figures, noticeably larger. Tabular figures are
       the point — without them a column of results does not line up. */
    '.res-value,.card-value{',
    '  font-family:var(--font-mono);font-size:17px;font-weight:600;',
    '  font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;',
    '  color:var(--text-header);letter-spacing:-0.01em;',
    '}',
    '.res-unit,.card-unit{',
    '  font-family:var(--font-mono);font-size:10px;font-weight:500;',
    '  color:var(--text-muted);letter-spacing:0.02em;',
    '}',
    /* Every number in the app lines up, not only the result cards. */
    'input[type="number"],.text-data,td,th{font-variant-numeric:tabular-nums;}',

    /* ── 6 · SECTION HEADINGS: A DATUM RULE, NOT A BLOCK OF ORANGE ─────── */
    '.pump-accordion>summary{',
    '  position:relative;background:transparent;color:var(--text-header);',
    '  font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.1em;',
    '  padding-left:20px;',
    '}',
    '.pump-accordion>summary::before{',
    '  content:"";position:absolute;left:9px;top:50%;transform:translateY(-50%);',
    '  width:3px;height:13px;border-radius:2px;background:var(--hairline);transition:background .15s;',
    '}',
    '.pump-accordion[open]>summary::before{background:var(--border-active);}',
    '.pump-accordion[open]>summary{background:rgba(255,117,56,0.05);}',
    '.pump-accordion{background:var(--surf-1);border:1px solid var(--hairline);}',
    '.pump-accordion[open]{border-color:rgba(255,117,56,0.3);}',

    /* ── 7 · NAVIGATION: THE ACTIVE TAB IS THE ONLY LOUD ONE ───────────── */
    '.terminal-nav{background:var(--surf-1);border-bottom:1px solid var(--hairline);}',
    '.nav-tab{',
    '  position:relative;background:transparent;border:none;color:var(--text-muted);',
    '  font-family:var(--font-mono);font-size:12px;font-weight:600;letter-spacing:0.09em;',
    '  transition:color .15s;',
    '}',
    '.nav-tab:hover{color:var(--text-main);}',
    '.nav-tab.active{color:var(--text-header);background:transparent;}',
    '.nav-tab.active::after{',
    '  content:"";position:absolute;left:12px;right:12px;bottom:0;height:2px;',
    '  background:var(--border-active);border-radius:2px 2px 0 0;',
    '}',
    '.nav-tab .tab-num{color:var(--text-muted);font-weight:500;}',
    '.nav-tab.active .tab-num{color:var(--border-active);}',

    /* ── 8 · HEADER & STATUS BAR ───────────────────────────────────────── */
    '.terminal-header{background:var(--surf-1);border-bottom:1px solid var(--hairline);backdrop-filter:none;}',
    '.terminal-footer,.status-bar{background:var(--surf-1);border-top:1px solid var(--hairline);}',
    '.header-divider{background:var(--hairline);}',

    /* ── 9 · BUTTONS: ONE PRIMARY, EVERYTHING ELSE QUIET ───────────────── */
    '.btn-primary,.run-btn,button[type="submit"]{',
    '  background:linear-gradient(180deg,#ff8a52,#ef6a2c);color:#12161b;',
    '  border:1px solid rgba(255,138,82,0.7);border-radius:6px;',
    '  font-family:var(--font-mono);font-weight:700;letter-spacing:0.07em;',
    '  box-shadow:0 1px 0 rgba(255,255,255,0.28) inset,0 2px 10px rgba(239,106,44,0.24);',
    '  transition:filter .15s,transform .06s;',
    '}',
    '.btn-primary:hover,.run-btn:hover,button[type="submit"]:hover{filter:brightness(1.08);}',
    '.btn-primary:active,.run-btn:active,button[type="submit"]:active{transform:translateY(1px);}',

    /* ── 10 · STATE COLOURS MEAN ONE THING EACH ────────────────────────── */
    '.status-banner.ok,.badge-ok,.pass{color:#34d399;border-color:rgba(52,211,153,0.35);background:rgba(52,211,153,0.08);}',
    '.status-banner.warn,.badge-warn{color:#fbbf24;border-color:rgba(251,191,36,0.35);background:rgba(251,191,36,0.08);}',
    '.status-banner.fail,.badge-fail,.fail{color:#f87171;border-color:rgba(248,113,113,0.35);background:rgba(248,113,113,0.08);}',

    /* ── 11 · TABLES READ AS A DATASHEET ───────────────────────────────── */
    'table th{',
    '  background:var(--surf-2);color:var(--text-muted);font-family:var(--font-mono);',
    '  font-size:10px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;',
    '  border-bottom:1px solid var(--hairline);',
    '}',
    'table td{border-bottom:1px solid var(--hairline);color:var(--text-main);}',
    'table tbody tr:hover td{background:rgba(255,117,56,0.05);}',

    /* ── 12 · SCROLLBARS BELONG TO THE INSTRUMENT TOO ──────────────────── */
    '*::-webkit-scrollbar{width:10px;height:10px;}',
    '*::-webkit-scrollbar-track{background:transparent;}',
    '*::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.22);border-radius:6px;border:2px solid transparent;background-clip:content-box;}',
    '*::-webkit-scrollbar-thumb:hover{background:rgba(255,117,56,0.45);background-clip:content-box;}'

  ].join('\n');

  function inject() {
    if (document.getElementById('aro-theme-css')) return;
    var st = document.createElement('style');
    st.id = 'aro-theme-css';
    st.textContent = CSS;
    // last in <head> so it wins over style.css without needing !important
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();

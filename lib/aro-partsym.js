/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — INDUSTRIAL COMPONENT SYMBOLS  (window.AROSYM)
   ---------------------------------------------------------------------------
   One symbol set for every place the application names a piping component: the
   ARO Workbench palette, the fittings and valves list in the five line-sizing
   services, and anywhere else a part has to be picked from a list.

   Until now those lists were words. "Plug valve 3-way through" and "Plug valve
   branch flow" are two different castings and two different resistances, and
   nothing on the screen showed which was which — the engineer had to know the
   wording. A drawn symbol is how a piping engineer reads a component, so the
   component list should be drawn.

   The symbols are solid rather than line-art on purpose. A P&ID uses flat
   schematic glyphs and that convention is preserved where a P&ID is being
   drawn (see pidSymbol in aro-workbench.js); this set is for the equipment
   PICKER, where the point is to recognise a casting at 30 px.

   Roundness is drawn the way an isometric hand drawing does it: a dark bore
   stroke with a lighter highlight stroke riding above its centreline, so a
   bend reads as a tube rather than as a bent wire. Nothing here uses a
   filter, a shadow or a mask — a palette holds two hundred of these and they
   have to cost nothing.

       AROSYM.svg('elbow90')            → '<svg …>…</svg>'  (44 × 30)
       AROSYM.svg('gate', { w: 26 })    → sized for an inline label
       AROSYM.glyph('gate')             → inner markup only, for embedding
       AROSYM.has('gate')               → true
       AROSYM.FIT                       → the 18 line-sizing fitting keys,
                                            in the order of FIT_NAMES

   Unknown keys return a neutral spool rather than nothing, so a list can ask
   for a symbol it does not have without leaving a hole in the row.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var W = 44, H = 30, CY = 15;

  /* ── palette ──────────────────────────────────────────────────────────── */
  var STEEL_D = '#64748b',   /* bore, in shade            */
    STEEL_L = '#cbd5e1',     /* the lit side of the tube  */
    EDGE = '#334155',        /* casting outline           */
    BODY = '#94a3b8',        /* valve body                */
    BODY_L = '#e2e8f0',
    WHEEL = '#b45309',       /* handwheel — painted, as it is on site */
    WHEEL_L = '#f59e0b',
    SEAT = '#475569',
    FLUID = '#38bdf8';

  /* A run of pipe drawn as a tube: bore in shade, highlight above centre.
     `t` is the outside diameter in pixels. */
  function tube(d, t, dark, light) {
    t = t || 9;
    return '<path d="' + d + '" fill="none" stroke="' + (dark || STEEL_D) + '" stroke-width="' + t
      + '" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="' + d + '" fill="none" stroke="' + (light || STEEL_L) + '" stroke-width="' + (t * 0.30)
      + '" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,' + (-t * 0.24).toFixed(2) + ')" opacity="0.85"/>';
  }

  /* A raised-face flange seen edge on, with its bolt heads. */
  function flangePlate(x, halfH, thick) {
    halfH = halfH || 9; thick = thick || 3.2;
    var y0 = CY - halfH;
    return '<rect x="' + (x - thick / 2) + '" y="' + y0 + '" width="' + thick + '" height="' + (halfH * 2)
      + '" rx="0.8" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="0.9"/>'
      + '<rect x="' + (x - thick / 2) + '" y="' + y0 + '" width="' + (thick * 0.34) + '" height="' + (halfH * 2)
      + '" fill="' + BODY_L + '" opacity="0.75"/>'
      + '<circle cx="' + x + '" cy="' + (y0 + 1.6) + '" r="0.9" fill="' + EDGE + '"/>'
      + '<circle cx="' + x + '" cy="' + (CY + halfH - 1.6) + '" r="0.9" fill="' + EDGE + '"/>';
  }

  /* Short pipe stubs either side, so every fitting reads as installed in a
     line rather than floating on its own. */
  function stubs(x0, x1) {
    return tube('M0 ' + CY + ' H' + x0, 8) + tube('M' + x1 + ' ' + CY + ' H' + W, 8);
  }

  function wheel(cx, cy, r) {
    r = r || 5;
    return '<line x1="' + cx + '" y1="' + (cy + r) + '" x2="' + cx + '" y2="' + (cy + r + 4) + '" stroke="' + SEAT + '" stroke-width="1.8"/>'
      + '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r + '" ry="' + (r * 0.42) + '" fill="none" stroke="' + WHEEL + '" stroke-width="2.1"/>'
      + '<ellipse cx="' + cx + '" cy="' + (cy - 0.7) + '" rx="' + (r * 0.92) + '" ry="' + (r * 0.34) + '" fill="none" stroke="' + WHEEL_L + '" stroke-width="0.9"/>'
      + '<line x1="' + (cx - r) + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="' + WHEEL + '" stroke-width="1"/>';
  }

  /* The classic two-cone valve body, shaded so it sits in space. */
  function bowtie(cx, r) {
    r = r || 8;
    var t = r * 0.86;
    return '<path d="M' + (cx - r) + ' ' + (CY - t) + ' L' + cx + ' ' + CY + ' L' + (cx - r) + ' ' + (CY + t) + ' Z" '
      + 'fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1" stroke-linejoin="round"/>'
      + '<path d="M' + (cx + r) + ' ' + (CY - t) + ' L' + cx + ' ' + CY + ' L' + (cx + r) + ' ' + (CY + t) + ' Z" '
      + 'fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1" stroke-linejoin="round"/>'
      + '<path d="M' + (cx - r) + ' ' + (CY - t) + ' L' + cx + ' ' + CY + ' L' + (cx - r + 2.2) + ' ' + (CY - t * 0.35) + ' Z" fill="' + BODY_L + '" opacity="0.8"/>'
      + '<path d="M' + (cx + r) + ' ' + (CY - t) + ' L' + cx + ' ' + CY + ' L' + (cx + r - 2.2) + ' ' + (CY - t * 0.35) + ' Z" fill="' + BODY_L + '" opacity="0.8"/>';
  }

  /* A vertical cylindrical shell (vessel, column, reactor) with dished ends. */
  function shell(cx, halfW, top, bot) {
    var h = bot - top;
    return '<rect x="' + (cx - halfW) + '" y="' + top + '" width="' + (halfW * 2) + '" height="' + h + '" rx="' + (halfW * 0.55) + '" '
      + 'fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
      + '<rect x="' + (cx - halfW * 0.72) + '" y="' + (top + 1.6) + '" width="' + (halfW * 0.5) + '" height="' + (h - 3.2) + '" rx="' + (halfW * 0.25) + '" '
      + 'fill="' + BODY_L + '" opacity="0.7"/>';
  }

  /* ── the catalogue ────────────────────────────────────────────────────── */
  var G = {

    /* — pipe and fittings ————————————————————————————————— */
    pipe: function () {
      return tube('M0 ' + CY + ' H' + W, 11) + flangePlate(5) + flangePlate(W - 5);
    },
    spool: function () {
      return tube('M0 ' + CY + ' H' + W, 10) + flangePlate(4.5, 8) + flangePlate(W - 4.5, 8)
        + '<line x1="14" y1="' + (CY - 6.6) + '" x2="14" y2="' + (CY + 6.6) + '" stroke="' + EDGE + '" stroke-width="0.8" opacity="0.6"/>';
    },
    elbow90: function () {
      return tube('M2 8 H22 A12 12 0 0 1 34 20 V28', 10)
        + '<circle cx="22" cy="8" r="1.1" fill="' + EDGE + '" opacity="0.5"/>';
    },
    elbowlr: function () {
      return tube('M1 6 H14 A19 19 0 0 1 33 25 V29', 10);
    },
    elbow45: function () {
      return tube('M1 22 H16 A9 9 0 0 0 23 18 L36 5', 10);
    },
    tee: function () {
      return tube('M0 11 H' + W, 10) + tube('M22 11 V29', 10)
        + '<path d="M0 7 H' + W + '" stroke="' + STEEL_L + '" stroke-width="2.4" opacity="0.7" stroke-linecap="round"/>';
    },
    teebranch: function () {
      return tube('M0 11 H' + W, 10) + tube('M22 11 V29', 10)
        + '<path d="M6 11 H22 V26" fill="none" stroke="' + FLUID + '" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M19 22 L22 27 L25 22" fill="none" stroke="' + FLUID + '" stroke-width="1.6" stroke-linecap="round"/>';
    },
    teerun: function () {
      return tube('M0 11 H' + W, 10) + tube('M22 11 V29', 10)
        + '<path d="M5 11 H38" fill="none" stroke="' + FLUID + '" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M34 8 L39 11 L34 14" fill="none" stroke="' + FLUID + '" stroke-width="1.6" stroke-linecap="round"/>';
    },
    cross: function () {
      return tube('M0 ' + CY + ' H' + W, 10) + tube('M22 2 V28', 10);
    },
    reducer: function () {
      return tube('M0 ' + CY + ' H10', 11) + tube('M34 ' + CY + ' H' + W, 6)
        + '<path d="M10 9.5 L34 12.5 L34 17.5 L10 20.5 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<path d="M10 9.5 L34 12.5 L34 14 L10 11.8 Z" fill="' + BODY_L + '" opacity="0.85"/>';
    },
    expander: function () {
      return tube('M0 ' + CY + ' H10', 6) + tube('M34 ' + CY + ' H' + W, 11)
        + '<path d="M10 12.5 L34 9.5 L34 20.5 L10 17.5 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<path d="M10 12.5 L34 9.5 L34 11 L10 13.8 Z" fill="' + BODY_L + '" opacity="0.85"/>';
    },
    eccreducer: function () {
      return tube('M0 12 H10', 11) + tube('M34 18.5 H' + W, 6)
        + '<path d="M10 6.5 L34 16 L34 21 L10 17.5 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<path d="M10 6.5 L34 16 L34 17.4 L10 8.4 Z" fill="' + BODY_L + '" opacity="0.85"/>';
    },
    flange: function () {
      return tube('M0 ' + CY + ' H' + W, 9) + flangePlate(18, 10, 3.6) + flangePlate(26, 10, 3.6)
        + '<rect x="20.4" y="' + (CY - 10) + '" width="3.2" height="20" fill="#1f2937" opacity="0.55"/>';
    },
    wnflange: function () {
      return tube('M0 ' + CY + ' H22', 8)
        + '<path d="M22 9 L28 6 L28 24 L22 21 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + flangePlate(30, 11, 4)
        + tube('M33 ' + CY + ' H' + W, 9);
    },
    blind: function () {
      return tube('M0 ' + CY + ' H24', 9) + flangePlate(26, 11, 4.2)
        + '<rect x="28.2" y="' + (CY - 11) + '" width="4.6" height="22" rx="1" fill="' + EDGE + '"/>';
    },
    spectacle: function () {
      return tube('M0 ' + CY + ' H16', 8) + tube('M30 ' + CY + ' H' + W, 8)
        + '<circle cx="21" cy="' + CY + '" r="5.6" fill="' + EDGE + '"/>'
        + '<circle cx="21" cy="' + CY + '" r="5.6" fill="none" stroke="' + BODY_L + '" stroke-width="1"/>'
        + '<circle cx="31" cy="6" r="4.4" fill="none" stroke="' + EDGE + '" stroke-width="1.6"/>'
        + '<line x1="24.4" y1="12.4" x2="28.4" y2="8.8" stroke="' + EDGE + '" stroke-width="1.6"/>';
    },
    cap: function () {
      return tube('M0 ' + CY + ' H26', 10)
        + '<path d="M26 9.6 A7 5.4 0 0 1 26 20.4 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1"/>';
    },
    union: function () {
      return tube('M0 ' + CY + ' H' + W, 9)
        + '<rect x="17" y="' + (CY - 8) + '" width="10" height="16" rx="1.4" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<rect x="17" y="' + (CY - 8) + '" width="10" height="4.4" fill="' + BODY_L + '" opacity="0.8"/>';
    },
    mitre0: function () { return tube('M0 ' + CY + ' H' + W, 10) + '<line x1="22" y1="9" x2="22" y2="21" stroke="' + EDGE + '" stroke-width="1.1"/>'; },
    mitre30: function () {
      return tube('M0 22 H20 L40 11', 10)
        + '<line x1="19" y1="16.6" x2="22.6" y2="26.6" stroke="' + EDGE + '" stroke-width="1"/>';
    },
    mitre60: function () {
      return tube('M0 25 H18 L32 4', 10)
        + '<line x1="15.6" y1="19.6" x2="21.6" y2="28.4" stroke="' + EDGE + '" stroke-width="1"/>';
    },
    mitre90: function () {
      return tube('M0 9 H22 V28', 10)
        + '<line x1="16.4" y1="3.4" x2="27.6" y2="14.6" stroke="' + EDGE + '" stroke-width="1"/>';
    },

    /* — valves ————————————————————————————————————————————— */
    gate: function () {
      return stubs(13, 31) + bowtie(22) + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6)
        + '<rect x="20.4" y="4.4" width="3.2" height="9" rx="0.8" fill="' + SEAT + '"/>' + wheel(22, 4.5, 5.4);
    },
    globe: function () {
      return stubs(13, 31) + bowtie(22)
        + '<circle cx="22" cy="' + CY + '" r="4.6" fill="' + BODY_L + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<ellipse cx="20.6" cy="13.6" rx="2" ry="1.5" fill="#fff" opacity="0.75"/>'
        + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6)
        + '<rect x="20.4" y="4.4" width="3.2" height="7" rx="0.8" fill="' + SEAT + '"/>' + wheel(22, 4.5, 5.4);
    },
    angle: function () {
      return tube('M0 ' + CY + ' H14', 8) + tube('M22 22 V' + H, 8)
        + '<path d="M14 8 L14 22 L22 22 L22 8 Z" fill="none"/>'
        + '<path d="M14 7.6 L22 ' + CY + ' L14 22.4 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
        + '<path d="M14.6 22.6 L22 ' + CY + ' L29.4 22.6 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
        + '<path d="M14 7.6 L22 ' + CY + ' L15.6 10.6 Z" fill="' + BODY_L + '" opacity="0.8"/>'
        + '<rect x="20.4" y="5" width="3.2" height="8" rx="0.8" fill="' + SEAT + '"/>' + wheel(22, 5, 5);
    },
    ball: function () {
      return stubs(13, 31) + bowtie(22)
        + '<circle cx="22" cy="' + CY + '" r="4.8" fill="' + BODY_L + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<line x1="17.2" y1="' + CY + '" x2="26.8" y2="' + CY + '" stroke="' + EDGE + '" stroke-width="1.4"/>'
        + '<ellipse cx="20.4" cy="13" rx="1.7" ry="1.2" fill="#fff" opacity="0.8"/>'
        + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6)
        + '<rect x="20.4" y="5.4" width="3.2" height="5" fill="' + SEAT + '"/>'
        + '<rect x="15" y="2.4" width="14" height="3.4" rx="1.7" fill="' + WHEEL + '"/>'
        + '<rect x="15" y="2.4" width="14" height="1.3" rx="0.7" fill="' + WHEEL_L + '"/>';
    },
    plug: function () {
      return stubs(13, 31) + bowtie(22)
        + '<path d="M18.6 10.6 L25.4 10.6 L24.2 19.6 L19.8 19.6 Z" fill="' + BODY_L + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6)
        + '<rect x="20.4" y="5.4" width="3.2" height="5.2" fill="' + SEAT + '"/>'
        + '<rect x="15.6" y="2.4" width="12.8" height="3.2" rx="1.6" fill="' + WHEEL + '"/>';
    },
    plug3: function () {
      return G.plug() + tube('M22 19 V' + H, 8)
        + '<path d="M8 ' + CY + ' H36" fill="none" stroke="' + FLUID + '" stroke-width="1.8" stroke-linecap="round"/>';
    },
    plugbranch: function () {
      return G.plug() + tube('M22 19 V' + H, 8)
        + '<path d="M8 ' + CY + ' H22 V27" fill="none" stroke="' + FLUID + '" stroke-width="1.8" stroke-linecap="round"/>'
        + '<path d="M19.4 23.6 L22 28 L24.6 23.6" fill="none" stroke="' + FLUID + '" stroke-width="1.5"/>';
    },
    checkswing: function () {
      return stubs(13, 31) + bowtie(22)
        + '<line x1="17.6" y1="21.4" x2="24.6" y2="9.4" stroke="' + EDGE + '" stroke-width="1.8" stroke-linecap="round"/>'
        + '<circle cx="17.6" cy="21.4" r="1.5" fill="' + EDGE + '"/>'
        + '<path d="M28 ' + CY + ' L33 ' + CY + '" stroke="' + FLUID + '" stroke-width="1.6"/>'
        + '<path d="M31 12.6 L34.6 ' + CY + ' L31 17.4" fill="none" stroke="' + FLUID + '" stroke-width="1.5"/>'
        + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6);
    },
    checklift: function () {
      return stubs(13, 31) + bowtie(22)
        + '<rect x="19.4" y="7.6" width="5.2" height="4.6" rx="1" fill="' + BODY_L + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<line x1="22" y1="12.2" x2="22" y2="' + CY + '" stroke="' + EDGE + '" stroke-width="1.3"/>'
        + '<path d="M28 ' + CY + ' L33 ' + CY + '" stroke="' + FLUID + '" stroke-width="1.6"/>'
        + '<path d="M31 12.6 L34.6 ' + CY + ' L31 17.4" fill="none" stroke="' + FLUID + '" stroke-width="1.5"/>'
        + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6);
    },
    butterfly: function () {
      return stubs(15, 29) + '<rect x="15" y="' + (CY - 9) + '" width="14" height="18" rx="2" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
        + '<rect x="15" y="' + (CY - 9) + '" width="4.6" height="18" fill="' + BODY_L + '" opacity="0.7"/>'
        + '<line x1="17.4" y1="21.4" x2="26.6" y2="8.6" stroke="' + EDGE + '" stroke-width="2.2" stroke-linecap="round"/>'
        + '<rect x="20.6" y="2.4" width="2.8" height="4.6" fill="' + SEAT + '"/>'
        + '<rect x="16" y="0.6" width="12" height="2.6" rx="1.3" fill="' + WHEEL + '"/>';
    },
    needle: function () {
      return stubs(13, 31) + bowtie(22)
        + '<path d="M22 6.6 L23.8 ' + CY + ' L20.2 ' + CY + ' Z" fill="' + EDGE + '"/>'
        + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6) + wheel(22, 4.4, 4.6);
    },
    control: function () {
      return stubs(13, 31) + bowtie(22) + flangePlate(13.4, 8, 2.6) + flangePlate(30.6, 8, 2.6)
        + '<rect x="20.6" y="4" width="2.8" height="4" fill="' + SEAT + '"/>'
        + '<path d="M14.6 4 A7.4 4.6 0 0 1 29.4 4 Z" fill="' + BODY_L + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<line x1="14.6" y1="4" x2="29.4" y2="4" stroke="' + EDGE + '" stroke-width="1"/>';
    },
    relief: function () {
      return tube('M0 24 H14', 8) + tube('M24 12 H' + W, 7)
        + '<path d="M14 17.4 L14 ' + H + ' L24 ' + H + ' L24 6.6 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
        + '<path d="M17 8 l4 -3 -4 -3" fill="none" stroke="' + EDGE + '" stroke-width="1.1" transform="translate(0,4)"/>'
        + '<path d="M15.6 6 q3 -2 6 0 q3 2 6 0" fill="none" stroke="' + WHEEL + '" stroke-width="1.4"/>';
    },
    orifice: function () {
      return tube('M0 ' + CY + ' H' + W, 10) + flangePlate(18, 10, 3.2) + flangePlate(26, 10, 3.2)
        + '<line x1="22" y1="' + (CY - 10) + '" x2="22" y2="' + (CY - 3) + '" stroke="' + EDGE + '" stroke-width="1.8"/>'
        + '<line x1="22" y1="' + (CY + 3) + '" x2="22" y2="' + (CY + 10) + '" stroke="' + EDGE + '" stroke-width="1.8"/>';
    },
    strainer: function () {
      return tube('M0 11 H' + W, 9)
        + '<path d="M17 13 L31 13 L25 27 L21 27 Z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
        + '<path d="M18.4 16 H29.6 M19.6 19 H28.4 M20.8 22 H27.2" stroke="' + EDGE + '" stroke-width="0.8" opacity="0.75"/>';
    },
    support: function () {
      return tube('M0 10 H' + W, 10)
        + '<path d="M18 15 h8 v9 h-8 z" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1"/>'
        + '<rect x="12" y="24" width="20" height="3.4" rx="0.8" fill="' + SEAT + '"/>';
    },

    /* — equipment ————————————————————————————————————————— */
    pump: function () {
      return '<circle cx="20" cy="18" r="9" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.2"/>'
        + '<circle cx="20" cy="18" r="9" fill="none" stroke="' + BODY_L + '" stroke-width="2.4" stroke-dasharray="10 30" transform="rotate(-120 20 18)"/>'
        + '<path d="M16.6 13.6 L26 18 L16.6 22.4 Z" fill="' + EDGE + '"/>'
        + tube('M0 18 H11', 7) + tube('M20 9 V0', 7)
        + '<rect x="8" y="26.4" width="24" height="3.4" rx="0.8" fill="' + SEAT + '"/>';
    },
    vessel: function () {
      return shell(22, 8, 3, 27) + tube('M22 0 V4', 5) + tube('M22 26 V' + H, 5)
        + '<line x1="14" y1="10" x2="30" y2="10" stroke="' + EDGE + '" stroke-width="0.7" opacity="0.5"/>';
    },
    reactor: function () {
      return shell(22, 9, 2, 28)
        + '<rect x="21" y="0" width="2" height="7" fill="' + SEAT + '"/>'
        + '<line x1="22" y1="7" x2="22" y2="22" stroke="' + SEAT + '" stroke-width="1.6"/>'
        + '<path d="M17 21 h10 M17.5 17 h9" stroke="' + SEAT + '" stroke-width="1.6" stroke-linecap="round"/>'
        + '<rect x="16" y="0" width="12" height="2.6" rx="1.3" fill="' + WHEEL + '"/>';
    },
    column: function () {
      return shell(22, 6.6, 1, 29)
        + '<path d="M16 8 h12 M16 13 h12 M16 18 h12 M16 23 h12" stroke="' + EDGE + '" stroke-width="0.8" stroke-dasharray="2.4 1.8" opacity="0.8"/>';
    },
    tank: function () {
      return '<rect x="7" y="9" width="30" height="18" rx="1.4" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
        + '<rect x="9" y="10.6" width="7" height="15" fill="' + BODY_L + '" opacity="0.7"/>'
        + '<path d="M7 9 L22 3 L37 9 Z" fill="' + BODY_L + '" stroke="' + EDGE + '" stroke-width="1.1" stroke-linejoin="round"/>'
        + '<rect x="9" y="19" width="26" height="8" fill="' + FLUID + '" opacity="0.35"/>';
    },
    exchanger: function () {
      return '<rect x="6" y="9" width="32" height="13" rx="2" fill="' + BODY + '" stroke="' + EDGE + '" stroke-width="1.1"/>'
        + '<rect x="6" y="9" width="32" height="4" fill="' + BODY_L + '" opacity="0.7"/>'
        + '<path d="M10 15.5 h24 M10 18.5 h24" stroke="' + EDGE + '" stroke-width="0.8" opacity="0.8"/>'
        + tube('M0 ' + CY + ' H6', 6) + tube('M38 ' + CY + ' H' + W, 6)
        + tube('M12 9 V3', 5) + tube('M32 22 V28', 5);
    },
    gauge: function () {
      return tube('M0 24 H' + W, 8)
        + '<line x1="22" y1="20" x2="22" y2="13" stroke="' + SEAT + '" stroke-width="2"/>'
        + '<circle cx="22" cy="8" r="6.4" fill="' + BODY_L + '" stroke="' + EDGE + '" stroke-width="1.2"/>'
        + '<line x1="22" y1="8" x2="25.6" y2="4.6" stroke="#b91c1c" stroke-width="1.4"/>'
        + '<circle cx="22" cy="8" r="1" fill="' + EDGE + '"/>';
    },
    transmitter: function () {
      return tube('M0 24 H' + W, 8)
        + '<line x1="22" y1="20" x2="22" y2="14" stroke="' + SEAT + '" stroke-width="2"/>'
        + '<circle cx="22" cy="9" r="7" fill="#fff" stroke="' + EDGE + '" stroke-width="1.3"/>'
        + '<line x1="15" y1="9" x2="29" y2="9" stroke="' + EDGE + '" stroke-width="0.9"/>'
        + '<text x="22" y="8" font-size="5.4" font-weight="700" fill="' + EDGE + '" text-anchor="middle" font-family="Arial">PT</text>'
        + '<text x="22" y="14" font-size="5.4" font-weight="700" fill="' + EDGE + '" text-anchor="middle" font-family="Arial">101</text>';
    },
    nozzle: function () {
      return '<path d="M2 4 Q2 ' + CY + ' 2 26" stroke="' + BODY + '" stroke-width="4" fill="none"/>'
        + tube('M2 ' + CY + ' H30', 8) + flangePlate(32, 10, 4);
    }
  };

  /* Anything asked for and not drawn falls back to a plain spool, so a list
     never renders a gap where a symbol should be. */
  function glyph(key) {
    var f = G[String(key || '').toLowerCase()];
    return (f || G.spool)();
  }

  function svg(key, o) {
    o = o || {};
    var w = o.w || 44, h = o.h || Math.round(w * H / W);
    return '<svg class="aroic" width="' + w + '" height="' + h + '" viewBox="0 0 ' + W + ' ' + H + '" '
      + 'style="display:inline-block;vertical-align:middle;' + (o.style || '') + '" aria-hidden="true">'
      + glyph(key) + '</svg>';
  }

  /* The eighteen fittings the line-sizing services count, in the order of
     FIT_NAMES in aro-linesize.js. Held here so the symbol and the K value can
     never drift apart in two separate lists. */
  var FIT = ['gate', 'globe', 'angle', 'ball', 'plug', 'plug3', 'plugbranch',
    'checkswing', 'checklift', 'elbow90', 'elbow45', 'elbowlr', 'teerun',
    'teebranch', 'mitre0', 'mitre30', 'mitre60', 'mitre90'];

  window.AROSYM = {
    svg: svg,
    glyph: glyph,
    has: function (k) { return !!G[String(k || '').toLowerCase()]; },
    keys: function () { return Object.keys(G); },
    FIT: FIT
  };
})();

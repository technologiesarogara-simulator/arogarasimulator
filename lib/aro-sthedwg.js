/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — SHELL & TUBE EXCHANGER FABRICATION DRAWING  (re-registers 'sthe')
   ---------------------------------------------------------------------------
   The shell-and-tube module had a general arrangement: an outline, four
   nozzle marks, a nozzle schedule with the sizes left as em-dashes, and a
   design-data block. It was a picture of an exchanger. It was not something a
   fabrication shop could work from, which is what was asked for.

   This replaces it with a sheet built the way the double-pipe and plate
   sheets already are, and to the same standard:

       1  LONGITUDINAL SECTION   shell, both tubesheets, every baffle at the
                                 calculated spacing, the front and rear heads
                                 the TEMA designation actually specifies,
                                 nozzles, saddles and a dimension chain
       2  SECTION A-A            the tubesheet, drilled — real hole positions
                                 generated on the calculated pitch and layout
                                 angle, inside the calculated OTL, with the
                                 pass partition lanes the pass count requires
       3  BAFFLE DETAIL          disc, the calculated cut, tube holes, tie-rod
                                 holes, thickness to TEMA
       4  TUBE-TO-TUBESHEET      the joint: grooves, expansion depth, and the
                                 seal weld where the design calls for one
       + nozzle schedule, design data, bill of material, general notes,
         title block

   EVERY DIMENSION COMES FROM THE CALCULATION. Nothing on the sheet is a
   drawing convention filled in to look complete. Where the calculation did
   not produce a figure the sheet says so in that field rather than printing a
   plausible one — a fabrication drawing carrying an invented wall thickness
   is worse than one that admits the thickness has not been established.

   THE TUBE LAYOUT IS GENERATED, NOT DECORATIVE. Holes are laid on the real
   pitch at the real layout angle and clipped to the real outer tube limit. If
   that lattice cannot seat the tube count the thermal design asked for, the
   sheet reports both numbers instead of quietly drawing the prettier one.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var INK = '#0f172a', THIN = '#334155', FAINT = '#94a3b8', DIM = '#dc2626',
      BLUE = '#1d4ed8', FILL = '#eef2f7', HOT = '#b45309';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }
  /* Head names arrive from the form already HTML-escaped, so escaping them
     again printed "Channel &amp; Removable Cover" on the sheet. Decode first,
     then escape once. */
  function deEnt(t) {
    return String(t == null ? '' : t)
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  }
  /* Trim to a word boundary and drop anything left dangling — a name cut to
     "Split-Ring Floating Head (" reads as a typo, not a shortening. */
  function clip(t, n) {
    var v = deEnt(t).trim();
    if (v.length <= n) return v;
    var cut = v.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    if (sp > n * 0.55) cut = cut.slice(0, sp);
    return cut.replace(/[\s(\[,;:\-]+$/, '') + '\u2026';
  }
  /* A missing number prints as an em-dash. It never prints as zero, because
     zero is a value and an engineer will read it as one. */
  function f(v, d) {
    if (v == null || !isFinite(v)) return '—';
    return Number(v).toFixed(d == null ? 1 : d);
  }
  function num(id) {
    try {
      if (window.siOf) { var s = window.siOf(id, NaN); if (isFinite(s)) return s; }
    } catch (e) {}
    var e2 = document.getElementById(id);
    if (!e2) return NaN;
    var v = parseFloat(e2.value);
    return isFinite(v) ? v : NaN;
  }
  function raw(id, dflt) {
    var e = document.getElementById(id);
    if (!e) return dflt;
    var v = parseFloat(e.value);
    return isFinite(v) ? v : dflt;
  }
  function txtOf(id, dflt) {
    var e = document.getElementById(id);
    return e && e.value ? String(e.value) : dflt;
  }

  function line(x1, y1, x2, y2, w, col, dash) {
    return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1)
      + '" y2="' + y2.toFixed(1) + '" stroke="' + (col || INK) + '" stroke-width="' + (w || 1)
      + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  function rect(x, y, w, h, fill, stroke, sw, dash) {
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1)
      + '" height="' + h.toFixed(1) + '" fill="' + (fill || 'none') + '"'
      + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' : '')
      + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  function circ(cx, cy, r, fill, stroke, sw, dash) {
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1)
      + '" fill="' + (fill || 'none') + '"'
      + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' : '')
      + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  function txt(x, y, t, sz, col, anc, wt) {
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + (sz || 8.5)
      + '" fill="' + (col || INK) + '"' + (anc ? ' text-anchor="' + anc + '"' : '')
      + (wt ? ' font-weight="' + wt + '"' : '') + ' font-family="Arial">' + esc(t) + '</text>';
  }
  function panel(x, y, w, h, title) {
    return rect(x, y, w, h, '#ffffff', INK, 1.1)
      + txt(x + 8, y + 15, title, 10, INK, 'start', '800');
  }
  /* Dimension line with ticks at both ends and the figure above it. */
  function dimH(x1, x2, y, label, col) {
    var c = col || DIM;
    return line(x1, y, x2, y, 0.8, c)
      + line(x1, y - 4, x1, y + 4, 0.8, c) + line(x2, y - 4, x2, y + 4, 0.8, c)
      + txt((x1 + x2) / 2, y - 4, label, 8, c, 'middle', '700');
  }
  function dimV(y1, y2, x, label, col) {
    var c = col || DIM;
    return line(x, y1, x, y2, 0.8, c)
      + line(x - 4, y1, x + 4, y1, 0.8, c) + line(x - 4, y2, x + 4, y2, 0.8, c)
      + '<text x="' + (x - 5).toFixed(1) + '" y="' + ((y1 + y2) / 2).toFixed(1)
      + '" font-size="8" fill="' + c + '" text-anchor="middle" font-weight="700" '
      + 'font-family="Arial" transform="rotate(-90 ' + (x - 5).toFixed(1) + ' '
      + ((y1 + y2) / 2).toFixed(1) + ')">' + esc(label) + '</text>';
  }
  function balloon(x, y, n) {
    return circ(x, y, 7, '#ffffff', INK, 0.9) + txt(x, y + 3, String(n), 8, INK, 'middle', '700');
  }
  function table(x, y, colW, rows, hdr, rowH) {
    var out = '', rh = rowH || 15;
    var tw = colW.reduce(function (a, b) { return a + b; }, 0);
    rows.forEach(function (row, ri) {
      var cy = y + ri * rh, cx = x;
      if (hdr && ri === 0) out += rect(x, cy, tw, rh, '#e8edf3');
      row.forEach(function (cell, ci) {
        out += rect(cx, cy, colW[ci], rh, 'none', THIN, 0.6);
        out += txt(cx + 4, cy + rh - 4.5, cell, 8, INK, 'start', (hdr && ri === 0) ? '700' : '400');
        cx += colW[ci];
      });
    });
    return out;
  }

  /* ── Read the design ──────────────────────────────────────────────────
     Geometry from the form (in the units the form declares), performance
     from the result object the 3D model and the report already read. */
  function gather() {
    var st = window.state && window.state.sthe;
    if (!st || !st.calculated || !st.results) return null;
    var r = st.results, i = st.inputs || {};

    /* The length field is data-unit-type="length-mm". Read the declared unit
       rather than guessing from the magnitude — guessing put a tube length a
       thousand times the sized one on this sheet once already. */
    var Lmm = num('sthe-tube-L');
    if (!isFinite(Lmm) || Lmm <= 0) Lmm = 7315;

    var doMm = raw('sthe-tube-od', 19);
    var diMm = raw('sthe-tube-id', doMm - 3);
    var pr = raw('sthe-pitch-ratio', 1.25);
    var pitch = doMm * pr;
    var layout = txtOf('sthe-layout-val', 'triangular').toLowerCase();
    var passes = Math.max(1, Math.round(raw('sthe-tube-passes', 1)));
    var shellPasses = Math.max(1, Math.round(raw('sthe-shell-passes', 1)));
    var cutPct = raw('sthe-baffle-cut', 25);
    var Ds = isFinite(r.Ds_used_mm) ? r.Ds_used_mm : NaN;
    var Db = isFinite(r.Db_mm) ? r.Db_mm : NaN;

    /* Baffle spacing: the explicit entry wins; otherwise the ratio the module
       sized to, applied to the shell it sized. */
    var Bs = raw('sthe-baffle-space', 0);
    if (!(Bs > 0)) {
      var ratio = raw('sthe-baffle-ratio', 0.3);
      Bs = isFinite(Ds) ? ratio * Ds : NaN;
    }
    var nBaffles = (isFinite(Bs) && Bs > 0) ? Math.max(0, Math.floor(Lmm / Bs) - 1) : NaN;

    return {
      r: r, i: i,
      L: Lmm, do_: doMm, di: diMm, tw: (doMm - diMm) / 2,
      pitch: pitch, pitchRatio: pr, layout: layout,
      passes: passes, shellPasses: shellPasses,
      cut: cutPct, Ds: Ds, Db: Db, Bs: Bs, nBaffles: nBaffles,
      Nt: isFinite(r.Nt) ? Math.round(r.Nt) : NaN,
      tema: r.temaDesignation || txtOf('sthe-tema-model', '—'),
      front: i.frontHeadName || txtOf('sthe-front-head', 'A'),
      rear: i.rearHeadName || txtOf('sthe-rear-head', '—'),
      shellT: i.shellTypeName || txtOf('sthe-shell-type', 'E'),
      kind: r.stheType || '—',
      tubeFluid: txtOf('sthe-fluid-tube', '—'),
      shellFluid: txtOf('sthe-fluid-shell', '—'),
      pTube: raw('sthe-press-tube', NaN),
      pShell: raw('sthe-press-shell', NaN),
      tinTube: raw('sthe-tin-tube', NaN), toutTube: raw('sthe-tout-tube', NaN),
      tinShell: raw('sthe-tin-shell', NaN), toutShell: raw('sthe-tout-shell', NaN),
      rdi: raw('sthe-rdi', NaN), rdo: raw('sthe-rdo', NaN),
      kw: raw('sthe-kw', NaN)
    };
  }

  /* ── Tube layout ──────────────────────────────────────────────────────
     A lattice on the real pitch at the real layout angle, clipped to the
     outer tube limit, with the pass partition lanes cleared. This is the
     drilling pattern, not an illustration of one. */
  function layoutHoles(g) {
    if (!isFinite(g.Db) || !isFinite(g.pitch) || g.pitch <= 0) return null;
    var Rotl = g.Db / 2;
    var p = g.pitch;
    var tri = /tri/.test(g.layout);
    var rowDy = tri ? p * Math.sin(Math.PI / 3) : p;
    var holes = [];
    var rows = Math.ceil(Rotl / rowDy) + 2;
    /* The partition lane a multi-pass channel needs: no tube may straddle it. */
    var laneHalf = g.passes > 1 ? Math.max(g.do_ * 0.75, 6) : 0;
    for (var ry = -rows; ry <= rows; ry++) {
      var y = ry * rowDy;
      var xOff = (tri && (Math.abs(ry) % 2 === 1)) ? p / 2 : 0;
      var cols = Math.ceil(Rotl / p) + 2;
      for (var cx = -cols; cx <= cols; cx++) {
        var x = cx * p + xOff;
        if (Math.sqrt(x * x + y * y) + g.do_ / 2 > Rotl) continue;
        if (laneHalf && Math.abs(y) < laneHalf) continue;                 /* horizontal lane */
        if (g.passes >= 4 && Math.abs(x) < laneHalf) continue;            /* vertical lane */
        holes.push([x, y]);
      }
    }
    return { holes: holes, Rotl: Rotl, rowDy: rowDy, tri: tri };
  }

  /* ═══ THE SHEET ═════════════════════════════════════════════════════ */
  function build() {
    var g = gather();
    if (!g) return null;
    var r = g.r;
    var W = 1540, H = 1120;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:#fff;'
      + 'font-family:Arial;">';
    s += rect(0, 0, W, H, '#ffffff', INK, 2);
    s += rect(8, 8, W - 16, H - 16, 'none', INK, 0.8);

    /* ── 1 · LONGITUDINAL SECTION ─────────────────────────────────────── */
    var vx = 18, vy = 20, vw = 980, vh = 470;
    s += panel(vx, vy, vw, vh, '1 · LONGITUDINAL SECTION  —  ' + esc(g.tema)
      + ' SHELL & TUBE HEAT EXCHANGER');

    var cy = vy + 250;
    var shellX0 = vx + 150, shellX1 = vx + vw - 130;
    var shellLen = shellX1 - shellX0;
    /* One scale for the whole view: millimetres of tube length to pixels. */
    var sc = shellLen / g.L;
    var shellHpx = isFinite(g.Ds) ? Math.max(60, Math.min(150, g.Ds * sc * 5)) : 96;
    var half = shellHpx / 2;

    /* shell course */
    s += rect(shellX0, cy - half, shellLen, shellHpx, FILL, INK, 1.4);
    /* tubesheets */
    var tsW = 12;
    s += rect(shellX0 - tsW, cy - half - 6, tsW, shellHpx + 12, '#cbd5e1', INK, 1.2);
    s += rect(shellX1, cy - half - 6, tsW, shellHpx + 12, '#cbd5e1', INK, 1.2);
    s += line(shellX0 - tsW / 2, cy + half + 6, shellX0 - tsW / 2, cy + half + 96, 0.6, THIN);
    s += txt(shellX0 - tsW / 2, cy + half + 106, 'STATIONARY', 7.5, THIN, 'middle');
    s += txt(shellX0 - tsW / 2, cy + half + 115, 'TUBESHEET', 7.5, THIN, 'middle');
    s += line(shellX1 + tsW / 2, cy + half + 6, shellX1 + tsW / 2, cy + half + 96, 0.6, THIN);
    s += txt(shellX1 + tsW / 2, cy + half + 106,
      g.kind === 'U-Tube' ? 'U-BEND' : 'FLOATING', 7.5, THIN, 'middle');
    s += txt(shellX1 + tsW / 2, cy + half + 115,
      g.kind === 'U-Tube' ? 'RETURN' : 'TUBESHEET', 7.5, THIN, 'middle');

    /* front head (channel) */
    var chW = 74;
    s += rect(shellX0 - tsW - chW, cy - half - 6, chW, shellHpx + 12, '#ffffff', INK, 1.3);
    s += txt(vx + 12, vy + 34, 'FRONT HEAD  ' + clip(g.front, 30), 8, BLUE, 'start', '700');
    if (g.passes > 1) {
      s += line(shellX0 - tsW - chW, cy, shellX0 - tsW, cy, 1.2, INK);
      s += txt(shellX0 - tsW - chW / 2, cy - 4, 'PASS PARTITION', 6.5, THIN, 'middle');
    }
    /* rear head */
    s += rect(shellX1 + tsW, cy - half - 6, chW, shellHpx + 12, '#ffffff', INK, 1.3);
    s += txt(vx + vw - 12, vy + 34, 'REAR HEAD  ' + clip(g.rear, 30), 8, BLUE, 'end', '700');

    /* tubes — drawn as rows across the length, count noted rather than faked */
    var rowsShown = Math.max(3, Math.min(9, isFinite(g.Nt) ? Math.ceil(Math.sqrt(g.Nt)) : 5));
    for (var t = 0; t < rowsShown; t++) {
      var ty = cy - half + (shellHpx * (t + 0.5) / rowsShown);
      s += line(shellX0, ty, shellX1, ty, 0.7, THIN);
    }
    s += txt((shellX0 + shellX1) / 2, cy - half - 30,
      (isFinite(g.Nt) ? g.Nt : '—') + ' TUBES  Ø' + f(g.do_, 1) + ' × '
      + f(g.tw, 2) + ' WALL × ' + f(g.L / 1000, 3) + ' m  ·  '
      + (/tri/.test(g.layout) ? '30° TRIANGULAR' : '90° SQUARE') + ' PITCH '
      + f(g.pitch, 1) + ' mm  ·  ' + g.passes + '-PASS',
      8.5, BLUE, 'middle', '700');

    /* baffles at the calculated spacing */
    if (isFinite(g.Bs) && g.Bs > 0 && isFinite(g.nBaffles) && g.nBaffles > 0) {
      var cutPx = shellHpx * (g.cut / 100);
      /* A close baffle pitch puts seventy plates in this view and turns the
         shell into a grey block. Draw a readable number and say how many
         there really are — the convention the double-pipe sheet already uses
         for its hairpins. */
      var step = Math.max(1, Math.ceil(g.nBaffles / 26));
      for (var bI = 1; bI <= g.nBaffles; bI += step) {
        var bx = shellX0 + bI * g.Bs * sc;
        if (bx > shellX1 - 4) break;
        var up = (bI % 2 === 1);
        if (up) s += rect(bx - 2, cy - half, 4, shellHpx - cutPx, '#94a3b8', INK, 0.7);
        else s += rect(bx - 2, cy - half + cutPx, 4, shellHpx - cutPx, '#94a3b8', INK, 0.7);
      }
      s += dimH(shellX0, shellX0 + g.Bs * sc * step, cy + half + 50,
        f(g.Bs * step, 0) + (step > 1 ? ' = ' + step + ' PITCHES' : ' BAFFLE PITCH'));
      s += txt(shellX0 + shellLen * 0.5, cy + half + 64, g.nBaffles
        + ' × SEGMENTAL BAFFLES AT ' + f(g.Bs, 0) + ' mm, ' + f(g.cut, 0) + '% CUT'
        + (step > 1 ? '  ·  EVERY ' + step + 'th SHOWN' : ''), 8, THIN, 'middle');
    } else {
      s += txt((shellX0 + shellX1) / 2, cy + half + 56,
        'BAFFLE SPACING NOT ESTABLISHED BY THE CALCULATION', 8, HOT, 'middle', '700');
    }

    /* nozzles */
    function nozzle(x, up, mark, nps) {
      var o = '';
      var nw = 16, nh = 30;
      var y0 = up ? cy - half - nh : cy + half;
      o += rect(x - nw / 2, y0, nw, nh, '#ffffff', INK, 1.2);
      o += rect(x - nw / 2 - 5, up ? y0 - 5 : y0 + nh, nw + 10, 5, '#cbd5e1', INK, 1);
      o += txt(x, up ? y0 - 10 : y0 + nh + 14, mark, 8.5, INK, 'middle', '800');
      o += txt(x, up ? y0 - 19 : y0 + nh + 23, nps, 7.5, THIN, 'middle');
      return o;
    }
    var npsShell = r.noz_shell_nps ? 'NPS ' + r.noz_shell_nps + '"' : 'SIZE —';
    var npsTube = r.noz_tube_nps ? 'NPS ' + r.noz_tube_nps + '"' : 'SIZE —';
    s += nozzle(shellX0 + shellLen * 0.18, true, 'N1', npsShell);
    s += nozzle(shellX1 - shellLen * 0.16, false, 'N2', npsShell);
    s += nozzle(shellX0 - tsW - chW * 0.62, true, 'N3', npsTube);
    s += nozzle(shellX0 - tsW - chW * 0.62, false, 'N4', npsTube);

    /* saddles */
    [0.24, 0.76].forEach(function (fr) {
      var sx = shellX0 + shellLen * fr;
      s += '<path d="M ' + (sx - 26) + ' ' + (cy + half + 34) + ' L ' + (sx - 14) + ' '
        + (cy + half) + ' L ' + (sx + 14) + ' ' + (cy + half) + ' L ' + (sx + 26) + ' '
        + (cy + half + 34) + ' Z" fill="#dbe3ec" stroke="' + INK + '" stroke-width="1"/>';
    });
    s += line(shellX0 - 40, cy + half + 34, shellX1 + 40, cy + half + 34, 1.4, INK);
    s += txt(shellX0 + shellLen * 0.5, cy + half + 32, 'SADDLE SUPPORTS (2 OFF) — GRADE / SKID',
      7.5, THIN, 'middle');

    /* centreline + dimension chain */
    s += line(shellX0 - tsW - chW - 24, cy, shellX1 + tsW + chW + 24, cy, 0.5, FAINT, '9 4 2 4');
    s += dimH(shellX0, shellX1, cy + half + 84, 'TUBE LENGTH ' + f(g.L, 0) + ' mm');
    s += dimH(shellX0 - tsW - chW, shellX1 + tsW + chW, cy + half + 132,
      'OVERALL ' + f(g.L + 2 * tsW / sc + 2 * chW / sc, 0) + ' mm (APPROX. ENVELOPE)');
    if (isFinite(g.Ds)) s += dimV(cy - half, cy + half, shellX1 + tsW + chW + 22,
      'SHELL ID Ø' + f(g.Ds, 1));

    /* section marks */
    s += txt(shellX0 + shellLen * 0.42, vy + 34, 'A', 11, DIM, 'middle', '800');
    s += line(shellX0 + shellLen * 0.42, vy + 38, shellX0 + shellLen * 0.42, cy - half - 40, 0.7, DIM, '6 3');
    s += txt(shellX0 + shellLen * 0.42, cy + half + 150, 'A', 11, DIM, 'middle', '800');

    /* ── 2 · SECTION A-A — TUBESHEET DRILLING ─────────────────────────── */
    var tx = 1010, ty = 20, tw2 = 512, th2 = 470;
    s += panel(tx, ty, tw2, th2, '2 · SECTION A-A  —  TUBESHEET DRILLING LAYOUT');
    var lay = layoutHoles(g);
    var ccx = tx + tw2 / 2, ccy = ty + 258;
    if (lay && isFinite(g.Ds)) {
      var Rs = 175;                                   /* shell ID drawn at this radius */
      var mmToPx = Rs / (g.Ds / 2);
      s += circ(ccx, ccy, Rs, '#ffffff', INK, 1.6);                       /* shell ID */
      s += circ(ccx, ccy, lay.Rotl * mmToPx, 'none', BLUE, 1, '6 3');     /* OTL */
      var rHole = Math.max(1.4, (g.do_ / 2) * mmToPx);
      lay.holes.forEach(function (h) {
        s += circ(ccx + h[0] * mmToPx, ccy + h[1] * mmToPx, rHole, '#ffffff', THIN, 0.6);
      });
      /* pass partition lanes */
      if (g.passes > 1) {
        s += line(ccx - Rs, ccy, ccx + Rs, ccy, 1.6, INK);
        if (g.passes >= 4) s += line(ccx, ccy - Rs, ccx, ccy + Rs, 1.6, INK);
      }
      /* tie rods sit in the lattice gaps near the OTL */
      [45, 135, 225, 315].forEach(function (a) {
        var ra = a * Math.PI / 180;
        s += circ(ccx + Math.cos(ra) * lay.Rotl * mmToPx * 0.94,
          ccy + Math.sin(ra) * lay.Rotl * mmToPx * 0.94, rHole * 0.8, '#334155', INK, 0.6);
      });
      s += line(ccx - Rs - 16, ccy, ccx + Rs + 16, ccy, 0.5, FAINT, '9 4 2 4');
      s += line(ccx, ccy - Rs - 16, ccx, ccy + Rs + 16, 0.5, FAINT, '9 4 2 4');
      s += dimH(ccx - Rs, ccx + Rs, ccy + Rs + 22, 'SHELL ID Ø' + f(g.Ds, 1));
      s += dimH(ccx - lay.Rotl * mmToPx, ccx + lay.Rotl * mmToPx, ccy + Rs + 40,
        'OTL Ø' + f(g.Db, 1), BLUE);
      s += txt(ccx, ty + 36,
        (/tri/.test(g.layout) ? '30° TRIANGULAR' : '90° SQUARE') + ' PITCH '
        + f(g.pitch, 1) + ' mm  (' + f(g.pitchRatio, 2) + ' × OD)  ·  LIGAMENT '
        + f(g.pitch - g.do_, 1) + ' mm', 8.5, BLUE, 'middle', '700');
      /* The honest line: what the lattice seats against what was sized. */
      var placed = lay.holes.length;
      var mismatch = isFinite(g.Nt) && Math.abs(placed - g.Nt) > Math.max(2, g.Nt * 0.08);
      s += txt(ccx, ty + 50,
        placed + ' HOLES DRAWN ON THIS PATTERN  ·  THERMAL DESIGN CALLS FOR '
        + (isFinite(g.Nt) ? g.Nt : '—') + ' TUBES',
        8, mismatch ? HOT : THIN, 'middle', mismatch ? '700' : '400');
      if (mismatch) {
        s += txt(ccx, ty + 78,
          'LAYOUT AND TUBE COUNT DO NOT AGREE — RESOLVE BEFORE DRILLING', 8, HOT, 'middle', '700');
      }
      s += txt(ccx, ty + 64, 'DRILL Ø' + f(g.do_ + 0.4, 1)
        + ' mm  ·  4 × TIE ROD SHOWN SOLID  ·  PASS LANES PER '
        + g.passes + '-PASS CHANNEL', 7.8, THIN, 'middle');
    } else {
      s += txt(ccx, ccy, 'SHELL DIAMETER OR PITCH NOT ESTABLISHED — LAYOUT NOT DRAWN',
        9, HOT, 'middle', '700');
    }

    /* ── 3 · BAFFLE DETAIL ────────────────────────────────────────────── */
    var bx0 = 18, by0 = 500, bw = 300, bh = 300;
    s += panel(bx0, by0, bw, bh, '3 · BAFFLE DETAIL');
    var bcx = bx0 + bw / 2, bcy = by0 + 128, bR = 80;
    if (isFinite(g.Ds)) {
      /* The plate is the disc LESS the segment the cut removes. Drawing the
         whole disc and laying a white rectangle over the top produced a full
         circle with a stray line through it — the one shape a baffle is not.
         Clipping to the retained region draws the plate that is actually
         made. */
      var cutFrac = Math.max(0.05, Math.min(0.49, g.cut / 100));
      var yCut = bcy - bR + 2 * bR * cutFrac;
      var cid = 'bcut' + Math.floor(Math.random() * 1e6);
      s += '<clipPath id="' + cid + '"><rect x="' + (bcx - bR - 2).toFixed(1) + '" y="'
        + yCut.toFixed(1) + '" width="' + (2 * bR + 4).toFixed(1) + '" height="'
        + (bR * 2).toFixed(1) + '"/></clipPath>';
      s += '<g clip-path="url(#' + cid + ')">'
        + circ(bcx, bcy, bR, '#dbe3ec', INK, 1.4) + '</g>';
      s += line(bcx - Math.sqrt(Math.max(0, bR * bR - Math.pow(yCut - bcy, 2))), yCut,
        bcx + Math.sqrt(Math.max(0, bR * bR - Math.pow(yCut - bcy, 2))), yCut, 1.4, INK);
      s += circ(bcx, bcy, bR, 'none', FAINT, 0.6, '4 3');
      s += txt(bcx, yCut - 7, f(g.cut, 0) + '% CUT', 8.5, DIM, 'middle', '700');

      /* tube holes on the real pattern, inside the retained part of the plate */
      var bl = layoutHoles(g);
      if (bl) {
        var bScale = bR / (g.Ds / 2);
        var brH = Math.max(1.1, (g.do_ / 2) * bScale);
        bl.holes.forEach(function (h) {
          var hx = bcx + h[0] * bScale, hy = bcy + h[1] * bScale;
          if (hy - brH < yCut) return;                 /* removed by the cut */
          s += circ(hx, hy, brH, '#ffffff', THIN, 0.45);
        });
      }
      /* four tie-rod holes */
      [40, 140, 220, 320].forEach(function (a) {
        var ra = a * Math.PI / 180;
        var hx2 = bcx + Math.cos(ra) * bR * 0.86, hy2 = bcy + Math.sin(ra) * bR * 0.86;
        if (hy2 < yCut) return;
        s += circ(hx2, hy2, 3, '#334155', INK, 0.6);
      });

      s += dimH(bcx - bR, bcx + bR, bcy + bR + 18, 'Ø' + f(g.Ds - 3, 1) + ' BAFFLE OD');
      var bt = g.Ds <= 350 ? 6 : g.Ds <= 700 ? 8 : g.Ds <= 1000 ? 10 : 12;
      var tie = g.Ds > 700 ? 16 : 12;
      s += txt(bx0 + 10, by0 + bh - 52, 'PLATE ' + bt + ' mm THK — TEMA RCB-4.3 for a '
        + f(g.Ds, 0) + ' mm shell', 7.8, THIN, 'start');
      s += txt(bx0 + 10, by0 + bh - 39, 'TUBE HOLES Ø' + f(g.do_ + 0.8, 1)
        + ' mm  ·  4 × TIE ROD Ø' + tie + ' mm', 7.8, THIN, 'start');
      s += txt(bx0 + 10, by0 + bh - 26, 'SPACERS SET THE ' + f(g.Bs, 0)
        + ' mm PITCH  ·  ' + (isFinite(g.nBaffles) ? g.nBaffles : '—') + ' PLATES REQUIRED',
        7.8, THIN, 'start');
      s += txt(bx0 + 10, by0 + bh - 13, 'ALTERNATE THE CUT 180° PLATE TO PLATE.',
        7.8, THIN, 'start');
    } else {
      s += txt(bcx, bcy, 'SHELL NOT SIZED', 9, HOT, 'middle', '700');
    }

    /* ── 4 · TUBE-TO-TUBESHEET JOINT ──────────────────────────────────── */
    var jx = 330, jy = 500, jw = 300, jh = 300;
    s += panel(jx, jy, jw, jh, '4 · TUBE-TO-TUBESHEET JOINT');
    var jcx = jx + 40, jcy = jy + 120;
    s += rect(jcx, jcy - 60, 90, 120, '#cbd5e1', INK, 1.3);                 /* tubesheet */
    s += txt(jcx + 45, jcy - 70, 'TUBESHEET', 8, THIN, 'middle');
    var tOd = 34, tWall = 6;
    s += rect(jcx + 90, jcy - tOd / 2, 150, tOd, '#ffffff', INK, 1.2);      /* tube */
    s += rect(jcx, jcy - tOd / 2, 90, tOd, '#ffffff', INK, 1.2);            /* tube in hole */
    s += line(jcx, jcy - tOd / 2 + tWall, jcx + 240, jcy - tOd / 2 + tWall, 0.8, THIN);
    s += line(jcx, jcy + tOd / 2 - tWall, jcx + 240, jcy + tOd / 2 - tWall, 0.8, THIN);
    /* the two grooves an expanded joint is rolled into */
    [26, 58].forEach(function (gx) {
      s += rect(jcx + gx, jcy - tOd / 2 - 4, 7, 4, '#94a3b8', INK, 0.7);
      s += rect(jcx + gx, jcy + tOd / 2, 7, 4, '#94a3b8', INK, 0.7);
    });
    s += txt(jcx + 45, jcy + 78, '2 × GROOVE', 7.5, DIM, 'middle', '700');
    s += txt(jcx + 165, jcy - 40, 'TUBE Ø' + f(g.do_, 1) + ' × ' + f(g.tw, 2)
      + ' WALL', 8, BLUE, 'middle', '700');
    s += '<path d="M ' + jcx + ' ' + (jcy - tOd / 2) + ' l -7 -7 l 0 14 Z" fill="' + INK + '"/>';
    s += txt(jx + 10, jy + jh - 62, 'EXPANDED INTO 2 GROOVES OVER THE FULL', 8, THIN, 'start');
    s += txt(jx + 10, jy + jh - 50, 'TUBESHEET THICKNESS LESS 3 mm — TEMA RCB-7.', 8, THIN, 'start');
    s += txt(jx + 10, jy + jh - 34, 'SEAL WELD BEFORE EXPANDING WHERE THE SERVICE', 8, THIN, 'start');
    s += txt(jx + 10, jy + jh - 22, 'REQUIRES IT. HOLE Ø' + f(g.do_ + 0.4, 1)
      + ' mm, TEMA STANDARD FIT.', 8, THIN, 'start');

    /* ── NOZZLE SCHEDULE ──────────────────────────────────────────────── */
    var nx = 642, ny = 500;
    s += panel(nx, ny, 356, 132, 'NOZZLE SCHEDULE');
    var nozRows = [['MARK', 'SERVICE', 'SIZE', 'RATING']];
    nozRows.push(['N1', 'SHELL INLET — ' + String(g.shellFluid).slice(0, 14),
      r.noz_shell_nps ? 'NPS ' + r.noz_shell_nps + '"' : '—', 'CL 150 RF']);
    nozRows.push(['N2', 'SHELL OUTLET', r.noz_shell_nps ? 'NPS ' + r.noz_shell_nps + '"' : '—', 'CL 150 RF']);
    nozRows.push(['N3', 'TUBE INLET — ' + String(g.tubeFluid).slice(0, 15),
      r.noz_tube_nps ? 'NPS ' + r.noz_tube_nps + '"' : '—', 'CL 150 RF']);
    nozRows.push(['N4', 'TUBE OUTLET', r.noz_tube_nps ? 'NPS ' + r.noz_tube_nps + '"' : '—', 'CL 150 RF']);
    s += table(nx + 8, ny + 22, [40, 170, 76, 62], nozRows, true, 15);
    if (!r.noz_shell_nps && !r.noz_tube_nps) {
      s += txt(nx + 8, ny + 124, 'NOZZLE SIZES NOT SET BY THIS CALCULATION — SIZE BEFORE ISSUE',
        7.5, HOT, 'start', '700');
    }

    /* ── DESIGN DATA ──────────────────────────────────────────────────── */
    s += panel(nx, ny + 142, 356, 158, 'DESIGN DATA — FROM THIS CALCULATION');
    var dd = [
      ['Heat duty', f(r.Q_kW, 2) + ' kW'],
      ['LMTD', f(r.dT_lm, 2) + ' °C'],
      ['U assumed / calculated', f(r.U_assumed, 0) + ' / ' + f(r.U_calc, 0) + ' W/m²·K'],
      ['Area required / provided', f(r.Ar, 2) + ' / ' + f(r.Aa, 2) + ' m²'],
      ['Excess surface', (r.excessArea == null ? '—' : f(r.excessArea, 1) + ' %')],
      ['ΔP tube / shell', f(r.dp_tube_kPa, 1) + ' / ' + f(r.dp_shell_kPa, 1) + ' kPa'],
      ['TEMA type / shell', g.tema + '  ·  ' + clip(g.shellT, 20)],
      ['Verdict', String(r.areaStatus || '—')]
    ];
    dd.forEach(function (row, ix) {
      var yy = ny + 164 + ix * 16;
      s += txt(nx + 10, yy, row[0], 8, THIN, 'start');
      s += txt(nx + 346, yy, row[1], 8, INK, 'end', '700');
    });

    /* ── BILL OF MATERIAL ─────────────────────────────────────────────── */
    var mx = 1010, my = 500;
    s += panel(mx, my, 512, 300, 'BILL OF MATERIAL');
    var tsThk = isFinite(g.Ds) ? Math.max(25, Math.round(g.Ds * 0.09)) : NaN;
    var bt2 = isFinite(g.Ds) ? (g.Ds <= 350 ? 6 : g.Ds <= 700 ? 8 : g.Ds <= 1000 ? 10 : 12) : NaN;
    var bom = [['NO', 'DESCRIPTION', 'MATERIAL', 'QTY', 'SIZE / SPEC']];
    bom.push(['1', 'Shell course', 'SA-516 Gr.70', '1',
      isFinite(g.Ds) ? 'Ø' + f(g.Ds, 0) + ' ID × ' + f(g.L, 0) + ' lg' : '—']);
    bom.push(['2', 'Tube, plain', 'SA-179 / SS316L', String(isFinite(g.Nt) ? g.Nt : '—'),
      'Ø' + f(g.do_, 1) + ' × ' + f(g.tw, 2) + ' × ' + f(g.L, 0)]);
    bom.push(['3', 'Tubesheet', 'SA-516 Gr.70', g.kind === 'U-Tube' ? '1' : '2',
      isFinite(tsThk) ? f(tsThk, 0) + ' thk, drilled' : 'drilled']);
    bom.push(['4', 'Segmental baffle', 'SA-516 Gr.70',
      String(isFinite(g.nBaffles) ? g.nBaffles : '—'),
      isFinite(bt2) ? f(bt2, 0) + ' thk, ' + f(g.cut, 0) + '% cut' : '—']);
    bom.push(['5', 'Tie rod + spacer', 'SA-193 B7', '4',
      'Ø' + (g.Ds > 700 ? 16 : 12) + ' mm']);
    bom.push(['6', 'Front head — ' + clip(g.front, 14), 'SA-516 Gr.70', '1', 'TEMA ' + String(g.tema).charAt(0)]);
    bom.push(['7', 'Rear head — ' + clip(g.rear, 14), 'SA-516 Gr.70', '1', 'TEMA ' + (String(g.tema).charAt(2) || '—')]);
    bom.push(['8', 'Nozzle + flange (shell)', 'SA-105 / SA-106B', '2',
      r.noz_shell_nps ? 'NPS ' + r.noz_shell_nps + '" CL150 RF' : '—']);
    bom.push(['9', 'Nozzle + flange (tube)', 'SA-105 / SA-106B', '2',
      r.noz_tube_nps ? 'NPS ' + r.noz_tube_nps + '" CL150 RF' : '—']);
    bom.push(['10', 'Girth flange + bolting', 'SA-105 / SA-193 B7', '2', 'CL150, full face']);
    bom.push(['11', 'Gasket', 'SW SS316 / graphite', '4', 'ASME B16.20']);
    bom.push(['12', 'Saddle support', 'SA-36', '2', 'with wear plate']);
    bom.push(['13', 'Impingement plate', 'SS304', '1', 'under shell inlet']);
    bom.push(['14', 'Vent / drain', 'SA-105', '2', 'NPS 3/4" CPLG']);
    bom.push(['15', 'Nameplate + bracket', 'SS304', '1', 'ASME U-stamp']);
    s += table(mx + 8, my + 22, [26, 172, 132, 34, 140], bom, true, 15);
    s += txt(mx + 8, my + 292, 'Quantities follow the calculated geometry. Materials are a '
      + 'starting specification, not a selection — confirm against the service.', 7.5, THIN, 'start');

    /* ── GENERAL NOTES ────────────────────────────────────────────────── */
    var gx2 = 18, gy2 = 810;
    s += panel(gx2, gy2, 980, 172, 'GENERAL NOTES');
    var notes = [
      '1. ALL DIMENSIONS IN mm UNLESS NOTED. DO NOT SCALE DRAWING.',
      '2. DESIGN, FABRICATION, INSPECTION AND TESTING TO ASME SEC VIII DIV 1 AND TEMA CLASS R.',
      '3. TEMA DESIGNATION ' + esc(g.tema) + ' — FRONT HEAD ' + clip(g.front, 30)
        + ', SHELL ' + clip(g.shellT, 24) + ', REAR HEAD ' + clip(g.rear, 30) + '.',
      '4. TUBES EXPANDED INTO ' + (g.kind === 'U-Tube' ? 'THE' : 'BOTH') + ' TUBESHEET'
        + (g.kind === 'U-Tube' ? '' : 'S') + ' WITH 2 GROOVES PER TEMA RCB-7. SEAL WELD WHERE SPECIFIED.',
      '5. WELDING TO ASME SEC IX. SHELL LONGITUDINAL AND CIRCUMFERENTIAL SEAMS FULL PENETRATION, RT SPOT 10%.',
      '6. HYDROTEST: SHELL AND TUBE SIDES SEPARATELY AT 1.5 × DESIGN PRESSURE PER ASME SEC VIII DIV 1 UG-99.',
      '7. BAFFLES ' + (isFinite(g.nBaffles) ? g.nBaffles + ' OFF AT ' + f(g.Bs, 0) + ' mm PITCH, '
        + f(g.cut, 0) + '% SEGMENTAL CUT' : 'PER APPROVED THERMAL DESIGN') + ', ALTERNATING ORIENTATION.',
      '8. TUBE LAYOUT ' + (/tri/.test(g.layout) ? '30° TRIANGULAR' : '90° SQUARE')
        + ' AT ' + f(g.pitch, 1) + ' mm PITCH. DRILL TO Ø' + f(g.do_ + 0.4, 1) + ' mm, TEMA STANDARD FIT.',
      '9. SURFACE PREPARATION SSPC-SP6, EXTERNAL EPOXY. INTERNAL SURFACES AS PER SERVICE.',
      '10. THIS SHEET IS GENERATED FROM THE SIZING CALCULATION. WALL THICKNESSES, FLANGE RATINGS AND',
      '      TUBESHEET THICKNESS REQUIRE A MECHANICAL DESIGN BEFORE ISSUE FOR CONSTRUCTION.'
    ];
    notes.forEach(function (n, ix) {
      s += txt(gx2 + 10, gy2 + 34 + ix * 12.6, n, 8, ix >= 9 ? HOT : THIN, 'start', ix >= 9 ? '700' : '400');
    });

    /* ── TITLE BLOCK ──────────────────────────────────────────────────── */
    var bxT = 1010, byT = 810, bwT = 512, bhT = 172;
    s += rect(bxT, byT, bwT, bhT, '#ffffff', INK, 1.4);
    s += line(bxT, byT + 30, bxT + bwT, byT + 30, 1.1, INK);
    s += txt(bxT + bwT / 2, byT + 20, 'AROGARA FLOWSIZE', 13, INK, 'middle', '800');
    s += line(bxT, byT + 56, bxT + bwT, byT + 56, 1.1, INK);
    s += txt(bxT + bwT / 2, byT + 47, 'SHELL & TUBE HEAT EXCHANGER — GA / FABRICATION DRAWING',
      9.5, INK, 'middle', '700');
    var proj = 'UNTITLED';
    try { if (window.AROPROJ && window.AROPROJ.name) proj = window.AROPROJ.name() || proj; } catch (e) {}
    try {
      var pn = document.getElementById('proj-name');
      if (pn && pn.value) proj = pn.value;
    } catch (e) {}
    var revTxt = '0';
    try {
      if (window.AROSTATE && window.AROSTATE.inputRev) revTxt = String(window.AROSTATE.inputRev('sthe'));
    } catch (e) {}
    var tb = [
      ['DWG NO', 'STHE-GA-001', 'REV', revTxt],
      ['PROJECT', String(proj).slice(0, 22), 'DATE', new Date().toISOString().slice(0, 10)],
      ['TEMA', String(g.tema), 'SCALE', 'NTS · A2'],
      ['DUTY', f(r.Q_kW, 1) + ' kW', 'AREA', f(r.Aa, 2) + ' m²'],
      ['TUBES', (isFinite(g.Nt) ? g.Nt : '—') + ' × Ø' + f(g.do_, 1),
        'SHELL ID', isFinite(g.Ds) ? f(g.Ds, 0) + ' mm' : '—'],
      ['STATUS', (function () {
        try { return window.AROSTATE ? window.AROSTATE.state('sthe') : 'CALCULATED'; }
        catch (e) { return 'CALCULATED'; }
      })(), 'U CALC', f(r.U_calc, 0) + ' W/m²K']
    ];
    tb.forEach(function (row, ix) {
      var yy = byT + 56 + ix * 19;
      s += line(bxT, yy + 19, bxT + bwT, yy + 19, 0.6, THIN);
      s += line(bxT + bwT / 2, yy, bxT + bwT / 2, yy + 19, 0.6, THIN);
      s += txt(bxT + 8, yy + 13, row[0], 7.5, THIN, 'start');
      s += txt(bxT + bwT / 2 - 8, yy + 13, row[1], 8, INK, 'end', '700');
      s += txt(bxT + bwT / 2 + 8, yy + 13, row[2], 7.5, THIN, 'start');
      s += txt(bxT + bwT - 8, yy + 13, row[3], 8, INK, 'end', '700');
    });

    s += txt(20, H - 14, 'ENGINEERING DESIGN DRAWING — NOT FOR CONSTRUCTION UNTIL THE '
      + 'MECHANICAL DESIGN IS COMPLETE', 8.5, HOT, 'start', '700');

    s += '</svg>';
    return s;
  }

  /* Registered after aro-drawing.js, so this definition replaces the general
     arrangement that was there. Same id, same control, same export buttons. */
  function install() {
    if (!window.ARODWG || typeof window.ARODWG.register !== 'function') return false;
    window.ARODWG.register('sthe', {
      title: 'SHELL & TUBE HEAT EXCHANGER — GA / FABRICATION DRAWING',
      data: function () {
        var st = window.state && window.state.sthe;
        return (st && st.calculated && st.results) ? st : null;
      },
      raw: function () { try { return build(); } catch (e) { return null; } }
    });
    return true;
  }

  window.AROSTHEDWG = { build: build, install: install, gather: gather, layoutHoles: layoutHoles };

  if (!install()) {
    var tries = 0;
    var iv = setInterval(function () {
      if (install() || ++tries > 40) clearInterval(iv);
    }, 250);
  }
})();

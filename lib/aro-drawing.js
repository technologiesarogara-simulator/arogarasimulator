/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — 2D ENGINEERING DRAWING LAYER

   A design that exists only as a table of numbers is hard to check. An
   engineer reads a drawing: where the nozzles are, which way the flow goes,
   what the bore is, how far apart things sit. The suite already produced a
   proper fabrication drawing for the double-pipe exchanger; the pump and the
   lines had nothing but a decorative schematic.

   This is the shared drawing kit and the module drawings built on it.

   ONE SOURCE OF TRUTH. Every dimension on every sheet is read from the
   result the module published — never recomputed here, never guessed, never
   defaulted. If the calculation says the suction nozzle is NPS 6, the sheet
   says NPS 6 and the 3D model says NPS 6, because all three are reading the
   same number. A drawing that quietly disagrees with the calculation it
   illustrates is worse than no drawing.

   NO RESULT, NO DRAWING. The same rule as everywhere else: before a
   calculation there is nothing to draw, and the sheet says so rather than
   showing a plausible-looking machine with invented dimensions. After an
   input changes, the sheet is stamped SUPERSEDED — the geometry on it
   belongs to the previous run.

   NOT FOR FABRICATION. Every sheet carries it. These are design
   representations produced from a sizing calculation: they show what was
   sized, at what duty, with which connections. They are not detailed
   mechanical drawings and they have not been through a fabrication check.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var INK = '#0f172a', THIN = '#475569', FAINT = '#94a3b8', DIM = '#1d4ed8',
      METAL = '#e2e8f0', METAL2 = '#cbd5e1', HOT = '#dc2626', COLD = '#2563eb';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function f(n, dp) { return isFinite(n) ? Number(n).toFixed(dp == null ? 1 : dp) : '—'; }
  function $(id) { return document.getElementById(id); }

  /* ── The primitive kit ──────────────────────────────────────────────────
     Engineering drawing conventions, not decoration: extension lines stand
     off the object, dimension lines carry arrowheads and sit clear of the
     geometry, centre lines are chain-dashed, and every leader points at the
     thing it names. */
  var K = {
    txt: function (x, y, s, o) {
      o = o || {};
      return '<text x="' + x + '" y="' + y + '" fill="' + (o.fill || INK)
        + '" font-family="Arial,Helvetica,sans-serif" font-size="' + (o.size || 9) + '"'
        + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '')
        + (o.weight ? ' font-weight="' + o.weight + '"' : '')
        + (o.rotate ? ' transform="rotate(' + o.rotate + ' ' + x + ' ' + y + ')"' : '')
        + '>' + esc(s) + '</text>';
    },
    line: function (x1, y1, x2, y2, o) {
      o = o || {};
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2
        + '" stroke="' + (o.stroke || INK) + '" stroke-width="' + (o.w || 0.8) + '"'
        + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>';
    },
    rect: function (x, y, w, h, o) {
      o = o || {};
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h
        + '" fill="' + (o.fill || 'none') + '" stroke="' + (o.stroke || INK)
        + '" stroke-width="' + (o.w || 0.9) + '"'
        + (o.rx ? ' rx="' + o.rx + '"' : '')
        + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>';
    },
    circle: function (cx, cy, r, o) {
      o = o || {};
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (o.fill || 'none')
        + '" stroke="' + (o.stroke || INK) + '" stroke-width="' + (o.w || 0.9) + '"/>';
    },
    path: function (d, o) {
      o = o || {};
      return '<path d="' + d + '" fill="' + (o.fill || 'none') + '" stroke="' + (o.stroke || INK)
        + '" stroke-width="' + (o.w || 0.9) + '"'
        + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>';
    },
    /* a centre line is chain-dashed and runs past the object it centres */
    centre: function (x1, y1, x2, y2) {
      return K.line(x1, y1, x2, y2, { stroke: FAINT, w: 0.6, dash: '9,3,2,3' });
    },
    /* horizontal dimension: extension lines up from the object, an arrowed
       dimension line between them, the value sitting on it */
    dimH: function (x1, x2, y, label, o) {
      o = o || {};
      var s = '', up = o.from == null ? y - 10 : o.from;
      s += K.line(x1, up, x1, y + 3, { stroke: DIM, w: 0.5 });
      s += K.line(x2, up, x2, y + 3, { stroke: DIM, w: 0.5 });
      s += K.line(x1, y, x2, y, { stroke: DIM, w: 0.7 });
      s += K.path('M' + x1 + ' ' + y + ' l6 -2.4 v4.8 z', { fill: DIM, stroke: DIM });
      s += K.path('M' + x2 + ' ' + y + ' l-6 -2.4 v4.8 z', { fill: DIM, stroke: DIM });
      s += '<rect x="' + ((x1 + x2) / 2 - (String(label).length * 2.6 + 5)) + '" y="' + (y - 8)
        + '" width="' + (String(label).length * 5.2 + 10) + '" height="11" fill="#ffffff"/>';
      s += K.txt((x1 + x2) / 2, y + 1, label, { anchor: 'middle', size: 8, fill: DIM });
      return s;
    },
    /* vertical dimension, same conventions rotated */
    dimV: function (y1, y2, x, label, o) {
      o = o || {};
      var s = '', from = o.from == null ? x + 10 : o.from;
      s += K.line(from, y1, x - 3, y1, { stroke: DIM, w: 0.5 });
      s += K.line(from, y2, x - 3, y2, { stroke: DIM, w: 0.5 });
      s += K.line(x, y1, x, y2, { stroke: DIM, w: 0.7 });
      s += K.path('M' + x + ' ' + y1 + ' l-2.4 6 h4.8 z', { fill: DIM, stroke: DIM });
      s += K.path('M' + x + ' ' + y2 + ' l-2.4 -6 h4.8 z', { fill: DIM, stroke: DIM });
      s += K.txt(x - 3, (y1 + y2) / 2, label, { anchor: 'middle', size: 8, fill: DIM,
                                                rotate: -90 });
      return s;
    },
    /* a leader points at geometry and lands under its own text */
    leader: function (px, py, tx, ty, label, o) {
      o = o || {};
      var s = K.path('M' + px + ' ' + py + ' L' + tx + ' ' + ty, { stroke: THIN, w: 0.6 });
      s += K.circle(px, py, 1.6, { fill: THIN, stroke: THIN });
      var w = String(label).length * 4.9 + 8;
      var lx = o.anchor === 'end' ? tx - w : tx;
      s += K.line(lx, ty, lx + w, ty, { stroke: THIN, w: 0.6 });
      s += K.txt(o.anchor === 'end' ? tx : tx + 3, ty - 3, label,
                 { size: 8, fill: THIN, anchor: o.anchor === 'end' ? 'end' : 'start' });
      return s;
    },
    flow: function (x, y, len, label, colour) {
      var c = colour || INK;
      var s = K.line(x, y, x + len - 7, y, { stroke: c, w: 1.2 });
      s += K.path('M' + (x + len) + ' ' + y + ' l-8 -3.4 v6.8 z', { fill: c, stroke: c });
      if (label) s += K.txt(x + len / 2, y - 5, label, { anchor: 'middle', size: 8, fill: c, weight: 'bold' });
      return s;
    },
    /* a flanged joint, drawn as the pair of raised faces it is */
    flange: function (x, y, h, o) {
      o = o || {};
      var t = o.t || 3.2;
      return K.rect(x - t, y - h / 2 - 2.5, t * 2, h + 5, { fill: METAL2, stroke: INK, w: 0.9 });
    },
    tag: function (x, y, text) {
      var w = String(text).length * 5.4 + 12;
      return K.rect(x - w / 2, y - 8, w, 16, { fill: '#ffffff', stroke: INK, w: 1 })
        + K.txt(x, y + 4, text, { anchor: 'middle', size: 9.5, weight: 'bold' });
    },
    esc: esc, f: f, INK: INK, THIN: THIN, FAINT: FAINT, DIM: DIM,
    METAL: METAL, METAL2: METAL2, HOT: HOT, COLD: COLD
  };

  /* ── The sheet ─────────────────────────────────────────────────────────
     Double border, title, and a title block that records what the drawing
     is OF and what state it is in — including SUPERSEDED, so a printout of
     an out-of-date design says so on its face. */
  function sheet(o, body) {
    var W = o.w || 900, H = o.h || 620;
    var tbH = 84, tbW = 330, tbX = W - tbW - 16, tbY = H - tbH - 16;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" '
      + 'style="width:100%;max-width:' + W + 'px;background:#ffffff;border:1px solid #94a3b8;">';
    s += K.rect(6, 6, W - 12, H - 12, { w: 1.8 });
    s += K.rect(13, 13, W - 26, H - 26, { w: 0.6 });
    s += K.txt(W / 2, 36, o.title, { anchor: 'middle', size: 15, weight: 'bold' });
    if (o.subtitle) s += K.txt(W / 2, 52, o.subtitle, { anchor: 'middle', size: 9, fill: THIN });

    s += body(W, H, tbY);

    /* title block */
    s += K.rect(tbX, tbY, tbW, tbH, { w: 1.1, fill: '#ffffff' });
    var rows = o.block || [];
    var rh = tbH / Math.max(rows.length + 1, 4);
    s += K.txt(tbX + 8, tbY + rh - 4, 'AROGARA FLOWSIZE', { size: 10, weight: 'bold' });
    s += K.txt(tbX + tbW - 8, tbY + rh - 4, 'ENGINEERING DESIGN DRAWING',
               { size: 7.5, fill: THIN, anchor: 'end' });
    s += K.line(tbX, tbY + rh, tbX + tbW, tbY + rh, { w: 0.6 });
    for (var i = 0; i < rows.length; i++) {
      var y = tbY + rh * (i + 2) - 4;
      s += K.txt(tbX + 8, y, rows[i][0], { size: 7.5, fill: THIN });
      s += K.txt(tbX + 108, y, rows[i][1], { size: 8.5, weight: 'bold' });
      if (i < rows.length - 1) s += K.line(tbX, tbY + rh * (i + 2), tbX + tbW, tbY + rh * (i + 2),
                                           { stroke: FAINT, w: 0.4 });
    }
    /* the stamp every one of these sheets has to carry */
    s += K.txt(22, H - 34, 'ENGINEERING DESIGN DRAWING — NOT FOR FABRICATION',
               { size: 9, weight: 'bold', fill: HOT });
    s += K.txt(22, H - 22,
      'Produced from the sizing calculation. Not a detailed mechanical drawing; '
      + 'confirm against issued-for-construction documents.', { size: 7, fill: THIN });
    if (o.superseded) {
      s += '<g opacity="0.16">' + K.txt(W / 2, H / 2, 'SUPERSEDED',
        { anchor: 'middle', size: 96, weight: 'bold', fill: HOT, rotate: -22 }) + '</g>';
    }
    return s + '</svg>';
  }

  /* ── The register ────────────────────────────────────────────────────── */
  var REG = {};
  function register(id, def) { REG[id] = def; }

  /* Common title-block rows: what this is, and whether it is current. */
  function blockFor(id, extra) {
    var pj = (window.AROPROJECT && window.AROPROJECT.isOpen()) ? window.AROPROJECT.project() : null;
    var ctx = pj && window.AROPROJECT.context();
    var st = window.AROSTATE;
    var state = st ? st.state(id) : null;
    var rows = [];
    rows.push(['PROJECT', pj ? (pj.projectName || 'UNTITLED') : 'UNTITLED']);
    if (ctx && ctx.tag) rows.push(['TAG', ctx.tag]);
    (extra || []).forEach(function (r) { rows.push(r); });
    rows.push(['REV / CALC', (pj ? 'Rev ' + (pj.revision || '0') : 'Rev 0')
      + '  ·  INPUT REV ' + (st && st.inputRev ? st.inputRev(id) : 0)]);
    rows.push(['STATUS', state === 'OUTDATED' ? 'SUPERSEDED — RE-RUN REQUIRED'
      : (state === 'CALCULATED' ? 'CURRENT — ' + new Date().toISOString().slice(0, 10) : 'NOT CALCULATED')]);
    return rows;
  }

  /* ── Build ─────────────────────────────────────────────────────────────
     Returns the SVG for a module, or null when there is nothing to draw. */
  function svgFor(id) {
    var def = REG[id];
    if (!def) return null;
    var st = window.AROSTATE;
    if (st && st.modules && st.modules().indexOf(id) >= 0 && !st.isCalculated(id)) return null;
    var data;
    try { data = def.data(); } catch (e) { return null; }
    if (!data) return null;
    /* A module that already produces a proper sheet keeps it. The layer adds
       what it was missing — the calculation-state stamp — rather than
       drawing a second, competing version of the same equipment. */
    if (def.raw) {
      try {
        var raw = def.raw(data);
        if (!raw) return null;
        if (st && st.state(id) === 'OUTDATED') {
          raw = raw.replace(/<\/svg>\s*$/,
            '<g opacity="0.16"><text x="50%" y="52%" text-anchor="middle" fill="' + HOT
            + '" font-family="Arial" font-size="90" font-weight="bold" '
            + 'transform="rotate(-22 400 300)">SUPERSEDED</text></g></svg>');
        }
        return raw;
      } catch (e) { return null; }
    }
    try {
      return sheet({
        title: def.title, subtitle: typeof def.subtitle === 'function' ? def.subtitle(data) : def.subtitle,
        w: def.w, h: def.h, block: blockFor(id, def.block ? def.block(data) : null),
        superseded: st ? st.state(id) === 'OUTDATED' : false
      }, function (W, H, tbY) { return def.draw(data, K, W, H, tbY); });
    } catch (e) {
      return null;
    }
  }
  function has(id) { return !!REG[id]; }

  /* ── Export ────────────────────────────────────────────────────────── */
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }
  function stem(id) {
    var pj = (window.AROPROJECT && window.AROPROJECT.isOpen()) ? window.AROPROJECT.project() : null;
    var ctx = pj && window.AROPROJECT.context();
    return ((pj ? pj.projectName : 'AROGARA') + '_' + (ctx && ctx.tag ? ctx.tag : id) + '_DRAWING')
      .replace(/[^A-Za-z0-9_-]+/g, '_');
  }
  /* SVG → PNG at print resolution, so the raster is usable rather than a
     screenshot of a screen. */
  function toPng(svg, scale, cb) {
    var m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    var w = m ? parseFloat(m[1]) : 900, h = m ? parseFloat(m[2]) : 620;
    var img = new Image();
    var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = Math.round(w * (scale || 3));
      c.height = Math.round(h * (scale || 3));
      var x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  /* ── The viewer ───────────────────────────────────────────────────── */
  var CSS = [
    '.aro-dwg-wrap{background:#ffffff;padding:8px;border-radius:4px;}',
    '.aro-dwg-none{border:1px dashed var(--border-muted);border-radius:5px;padding:26px 18px;',
    '  text-align:center;font-family:var(--font-mono);color:var(--text-muted);font-size:11px;line-height:1.7;}',
    '.aro-dwg-none b{display:block;font-size:12px;letter-spacing:.12em;margin-bottom:6px;}'
  ].join('');

  function injectCss() {
    if ($('aro-dwg-css')) return;
    var s = document.createElement('style');
    s.id = 'aro-dwg-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function open(id) {
    id = id || (window.AROENG && window.AROENG.module());
    var def = REG[id];
    var name = (window.AROSTATE && window.AROSTATE.label) ? window.AROSTATE.label(id) : id;
    if (!def) {
      modal('2D ENGINEERING DRAWING',
        '<div class="aro-dwg-none"><b>NO DRAWING FOR THIS MODULE YET</b>'
        + 'A dimensioned engineering drawing has not been built for ' + esc(name) + '. '
        + 'The modules that have one draw it from the calculated design.</div>');
      return;
    }
    var svg = svgFor(id);
    if (!svg) {
      modal('2D ENGINEERING DRAWING — ' + esc(name),
        '<div class="aro-dwg-none"><b>&mdash; NOT CALCULATED</b>'
        + 'There is nothing to draw yet. The drawing is generated from the calculated design — '
        + 'every dimension on it comes from the result, so it cannot be produced before there is one.'
        + '<br>Enter the design inputs and run the calculation.</div>');
      return;
    }
    modal('2D ENGINEERING DRAWING — ' + esc(name),
      '<div class="aro-dwg-wrap" id="aro-dwg-body">' + svg + '</div>',
      '<button class="aro-eb-btn" id="aro-dwg-svg">EXPORT SVG</button>'
      + '<button class="aro-eb-btn" id="aro-dwg-png">EXPORT PNG</button>'
      + '<button class="aro-eb-btn" id="aro-dwg-pdf">EXPORT PDF</button>');
    bind('aro-dwg-svg', function () {
      download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), stem(id) + '.svg');
    });
    bind('aro-dwg-png', function () {
      toPng(svg, 3, function (c) {
        if (!c) return;
        c.toBlob(function (b) { if (b) download(b, stem(id) + '.png'); });
      });
    });
    bind('aro-dwg-pdf', function () {
      var body = $('aro-dwg-body');
      if (body && typeof window.AROPDF === 'function') {
        window.AROPDF(body, stem(id) + '.pdf', { landscape: true, bg: '#ffffff' });
      } else { window.print(); }
    });
  }

  function modal(title, body, footer) {
    var old = $('aro-mod');
    if (old) old.remove();
    var w = document.createElement('div');
    w.className = 'aro-mod';
    w.id = 'aro-mod';
    w.innerHTML = '<div class="aro-mod-box" style="width:min(1180px,97vw);"><div class="aro-mod-h">'
      + '<span>' + esc(title) + '</span><button class="aro-x" id="aro-mod-x">&#10005;</button></div>'
      + '<div class="aro-mod-b">' + body + '</div>'
      + (footer ? '<div class="aro-mod-f">' + footer + '</div>' : '') + '</div>';
    document.body.appendChild(w);
    $('aro-mod-x').onclick = function () { w.remove(); };
    w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
  }
  function bind(id, fn) { var e = $(id); if (e) e.onclick = fn; }

  /* ═══════════════════════════════════════════════════════════════════════
     PUMP — general arrangement
     Suction pipe → casing → discharge pipe, with the driver train behind it
     on a baseplate and foundation. Every dimension and every nozzle size is
     the one the calculation selected.
     ═══════════════════════════════════════════════════════════════════════ */
  register('pump', {
    title: 'CENTRIFUGAL PUMP — GENERAL ARRANGEMENT',
    w: 940, h: 668,
    subtitle: function (d) {
      return 'ELEVATION  ·  ' + f(d.Q, 1) + ' m³/h AT ' + f(d.H, 1) + ' m DIFFERENTIAL HEAD  ·  '
        + f(d.motor, 2) + ' kW DRIVER  ·  ' + esc(d.fluid || 'PROCESS FLUID');
    },
    data: function () {
      var s = window.state && window.state.pump;
      if (!s || !s.calculated || !s.results) return null;
      var r = s.results, i = s.inputs;
      return {
        tag: i.pumpTag || 'P-101', fluid: i.fluidVal, service: i.dsService,
        Q: r.designVolFlow, H: r.diffHeadCal, motor: r.stdMotorKw, eff: r.pumpEff,
        sucNps: r.sucNozzle ? r.sucNozzle.nps : '—', sucId: r.sucNozzle ? r.sucNozzle.id : NaN,
        disNps: r.disNozzle ? r.disNozzle.nps : '—', disId: r.disNozzle ? r.disNozzle.id : NaN,
        vs: r.velSuc, vd: r.velDis, p1: r.pSucA, p2: r.pDischA,
        npsha: r.npsha, npshr: i.npshr, cl: i.zPump, lll: i.lll, rho: i.rho, rpm: r.pumpSpeedRpm
      };
    },
    block: function (d) {
      return [['SERVICE', (d.service || d.fluid || '—').slice(0, 26)],
              ['DUTY', f(d.Q, 1) + ' m³/h @ ' + f(d.H, 1) + ' m']];
    },
    draw: function (d, K, W, H) {
      var s = '';
      var baseY = 400, cx = 430, cy = 300;
      var casR = 52;

      /* foundation and baseplate */
      s += K.rect(190, baseY + 38, 470, 26, { fill: '#f1f5f9', stroke: K.INK, w: 1.1 });
      s += K.path('M190 ' + (baseY + 64) + ' L660 ' + (baseY + 64), { stroke: K.INK, w: 1.6 });
      for (var hx = 200; hx < 660; hx += 22) {
        s += K.line(hx, baseY + 64, hx - 8, baseY + 74, { stroke: K.FAINT, w: 0.6 });
      }
      s += K.txt(425, baseY + 55, 'CONCRETE FOUNDATION', { anchor: 'middle', size: 7.5, fill: K.THIN });
      s += K.rect(210, baseY, 430, 38, { fill: K.METAL, stroke: K.INK, w: 1.2 });
      s += K.txt(425, baseY + 24, 'BASEPLATE', { anchor: 'middle', size: 8, fill: K.THIN });

      /* pump casing — volute with the discharge rising from its top */
      s += K.circle(cx, cy, casR, { fill: K.METAL, stroke: K.INK, w: 1.4 });
      s += K.circle(cx, cy, casR - 13, { fill: '#ffffff', stroke: K.THIN, w: 0.7 });
      s += K.circle(cx, cy, 7, { fill: K.METAL2, stroke: K.INK, w: 0.9 });
      /* impeller vanes, indicative */
      for (var a = 0; a < 6; a++) {
        var t0 = a * Math.PI / 3, t1 = t0 + 0.7;
        s += K.path('M' + (cx + 8 * Math.cos(t0)) + ' ' + (cy + 8 * Math.sin(t0))
          + ' Q' + (cx + 26 * Math.cos(t0 + 0.35)) + ' ' + (cy + 26 * Math.sin(t0 + 0.35))
          + ' ' + (cx + (casR - 15) * Math.cos(t1)) + ' ' + (cy + (casR - 15) * Math.sin(t1)),
          { stroke: K.THIN, w: 0.7 });
      }
      /* casing feet down to the baseplate */
      s += K.path('M' + (cx - 34) + ' ' + (cy + 44) + ' L' + (cx - 40) + ' ' + baseY
        + ' L' + (cx + 40) + ' ' + baseY + ' L' + (cx + 34) + ' ' + (cy + 44) + ' Z',
        { fill: K.METAL2, stroke: K.INK, w: 1 });

      /* suction: horizontal into the eye */
      var sucY = cy, sucX0 = 120;
      s += K.rect(sucX0, sucY - 13, cx - casR - sucX0, 26, { fill: '#ffffff', stroke: K.INK, w: 1.1 });
      s += K.flange(cx - casR - 4, sucY, 26);
      s += K.flange(sucX0 + 4, sucY, 26);
      s += K.centre(sucX0 - 14, sucY, cx + 14, sucY);
      s += K.flow(sucX0 + 116, sucY - 22, 96, 'FLOW', COLD);
      s += K.leader(cx - casR - 4, sucY - 13, cx - 96, sucY - 104,
        'SUCTION NOZZLE  NPS ' + d.sucNps + '  (ID ' + f(d.sucId, 1) + ' mm)  v = ' + f(d.vs, 2) + ' m/s',
        { anchor: 'end' });

      /* discharge: up from the volute top, then across */
      var disX = cx + 4, disTop = 150;
      s += K.rect(disX - 13, disTop, 26, cy - casR - disTop + 16, { fill: '#ffffff', stroke: K.INK, w: 1.1 });
      s += K.rect(disX - 13, disTop, 250, 26, { fill: '#ffffff', stroke: K.INK, w: 1.1 });
      s += K.flange(disX, disTop + 40, 26, { t: 3.2 });
      s += K.flange(disX + 233, disTop + 13, 26);
      s += K.centre(disX, disTop - 12, disX, cy);
      s += K.flow(disX + 30, disTop - 24, 96, 'FLOW', HOT);
      s += K.leader(disX + 13, disTop + 13, disX + 96, 74,
        'DISCHARGE NOZZLE  NPS ' + d.disNps + '  (ID ' + f(d.disId, 1) + ' mm)  v = ' + f(d.vd, 2) + ' m/s');

      /* pressure tapping points */
      /* The tapping value reads ABOVE the bubble. Below it, the text landed
         on the pipe and on the flow arrow, which is where a reader looks
         for the geometry. */
      function tap(x, y, label, val, drop) {
        var t = K.circle(x, y, 11, { fill: '#ffffff', stroke: K.INK, w: 1 });
        t += K.txt(x, y + 3.5, label, { anchor: 'middle', size: 8, weight: 'bold' });
        t += K.line(x, y + 11, x, y + 11 + drop, { stroke: K.INK, w: 0.8 });
        t += K.txt(x, y - 16, val, { anchor: 'middle', size: 8.5, weight: 'bold', fill: K.THIN });
        return t;
      }
      s += tap(sucX0 + 62, sucY - 66, 'P1', f(d.p1, 3) + ' bar a', 53);
      s += tap(disX + 175, disTop - 62, 'P2', f(d.p2, 3) + ' bar a', 38);

      /* driver train */
      var mX = 640, mW = 150, mH = 84;
      s += K.rect(mX, cy - mH / 2, mW, mH, { fill: K.METAL, stroke: K.INK, w: 1.3, rx: 5 });
      for (var fx = mX + 12; fx < mX + mW - 8; fx += 11) {
        s += K.line(fx, cy - mH / 2 + 6, fx, cy + mH / 2 - 6, { stroke: K.FAINT, w: 0.5 });
      }
      s += K.txt(mX + mW / 2, cy + 4, 'M', { anchor: 'middle', size: 20, weight: 'bold', fill: K.THIN });
      s += K.rect(mX + 14, cy + mH / 2, 30, baseY - cy - mH / 2, { fill: K.METAL2, stroke: K.INK, w: 0.9 });
      s += K.rect(mX + mW - 44, cy + mH / 2, 30, baseY - cy - mH / 2, { fill: K.METAL2, stroke: K.INK, w: 0.9 });
      s += K.leader(mX + mW / 2, cy - mH / 2, mX + 40, 120,
        'DRIVER  ' + f(d.motor, 2) + ' kW  ·  ' + f(d.rpm, 0) + ' rpm');
      /* coupling and guard */
      s += K.rect(cx + casR + 6, cy - 15, mX - cx - casR - 12, 30, { fill: '#ffffff', stroke: K.INK, w: 0.9, dash: '4,3' });
      s += K.line(cx + casR + 6, cy, mX, cy, { stroke: K.INK, w: 1.4 });
      s += K.txt((cx + casR + mX) / 2, cy - 21, 'COUPLING + GUARD', { anchor: 'middle', size: 7.5, fill: K.THIN });
      s += K.centre(cx - 90, cy, mX + mW + 14, cy);

      /* dimensions */
      /* No baseplate dimension: the baseplate is indicative geometry, not
         something this calculation sized, and a dimension line implies it
         was. Only the pump centreline elevation is dimensioned, because
         that IS an input to the NPSH calculation. */
      s += K.dimV(cy, baseY + 64, 130, 'PUMP \u2104 ' + f(d.cl, 3) + ' m ABOVE DATUM', { from: 190 });
      s += K.line(96, baseY + 64, 660, baseY + 64, { stroke: K.FAINT, w: 0.5, dash: '6,4' });
      s += K.txt(100, baseY + 78, 'DATUM (GRADE)', { size: 7.5, fill: K.THIN });

      /* tag and the numbers that matter */
      s += K.tag(cx, 96, d.tag);
      var nx = 40, ny = 486;
      s += K.rect(nx, ny, 300, 118, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(nx + 8, ny + 15, 'CALCULATED DUTY', { size: 8.5, weight: 'bold' });
      s += K.line(nx, ny + 21, nx + 300, ny + 21, { stroke: K.FAINT, w: 0.5 });
      var rows = [
        ['Rated flow', f(d.Q, 2) + ' m³/h'],
        ['Differential head', f(d.H, 2) + ' m'],
        ['Pump efficiency', f(d.eff, 1) + ' %'],
        ['NPSHa / NPSHr', f(d.npsha, 2) + ' / ' + f(d.npshr, 2) + ' m'],
        ['Fluid density', f(d.rho, 1) + ' kg/m³']
      ];
      rows.forEach(function (r, i2) {
        s += K.txt(nx + 8, ny + 36 + i2 * 16, r[0], { size: 8, fill: K.THIN });
        s += K.txt(nx + 292, ny + 36 + i2 * 16, r[1], { size: 8.5, weight: 'bold', anchor: 'end' });
      });
      return s;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════
     LINE SIZING — piping spool
     P1 ─ pipe ─ P2, at the calculated bore, with the fittings the design
     actually contains and the elevation it actually has. No invented elbows.
     ═══════════════════════════════════════════════════════════════════════ */
  function lineData(mod) {
    return function () {
      /* the line modules hand their whole result object to the engineering
         layer when they publish, so the sheet is dimensioned from the very
         numbers the panel reported */
      var r = null;
      try { r = window.AROENG && window.AROENG.values ? window.AROENG.values(mod) : null; } catch (e) {}
      if (!r) return null;
      /* two-phase carries the mixture velocity under its own name */
      if (!isFinite(r.V) && isFinite(r.Vmix)) r = Object.assign({}, r, { V: r.Vmix });
      if (!isFinite(r.V)) return null;
      return r;
    };
  }

  ['line-liquid', 'line-gas', 'line-steam', 'line-slurry', 'line-twophase'].forEach(function (mod) {
    var nice = { 'line-liquid': 'LIQUID', 'line-gas': 'GAS', 'line-steam': 'STEAM',
                 'line-slurry': 'SLURRY', 'line-twophase': 'TWO-PHASE' }[mod];
    register(mod, {
      title: nice + ' LINE — PIPING SPOOL ARRANGEMENT',
      w: 960, h: 640,
      data: lineData(mod),
      subtitle: function (r) {
        return 'NPS ' + r.nps + '" SCH ' + r.sch + '  ·  ID ' + f(r.Dmm, 1) + ' mm  ·  '
          + f(r.L, 2) + ' m RUN  ·  ' + f(r.V, 2) + ' m/s  ·  ' + esc(r.svc || 'PROCESS SERVICE');
      },
      block: function (r) {
        return [['SERVICE', (r.svc || '—').slice(0, 26)],
                ['LINE SIZE', 'NPS ' + r.nps + '" SCH ' + r.sch]];
      },
      draw: function (r, K, W, H) {
        var s = '';
        var y = 236, x0 = 150, x1 = 740;
        var od = r.odIn ? r.odIn * 25.4 : r.Dmm * 1.12;
        var pxOD = Math.max(22, Math.min(60, od / 5));
        var pxID = pxOD * (r.Dmm / od);
        var rise = isFinite(r.dz) && r.dz !== 0 ? (r.dz > 0 ? -48 : 48) : 0;
        var yEnd = y + rise;

        /* the run, as a spool between two flanged ends. A rise is drawn as a
           rise — the sheet should not show a level line for a line that
           climbs 2 m. */
        s += K.path('M' + x0 + ' ' + (y - pxOD / 2) + ' L' + x1 + ' ' + (yEnd - pxOD / 2)
          + ' L' + x1 + ' ' + (yEnd + pxOD / 2) + ' L' + x0 + ' ' + (y + pxOD / 2) + ' Z',
          { fill: '#ffffff', stroke: K.INK, w: 1.3 });
        s += K.path('M' + x0 + ' ' + (y - pxID / 2) + ' L' + x1 + ' ' + (yEnd - pxID / 2),
          { stroke: K.FAINT, w: 0.6, dash: '7,4' });
        s += K.path('M' + x0 + ' ' + (y + pxID / 2) + ' L' + x1 + ' ' + (yEnd + pxID / 2),
          { stroke: K.FAINT, w: 0.6, dash: '7,4' });
        s += K.flange(x0 + 4, y, pxOD);
        s += K.flange(x1 - 4, yEnd, pxOD);
        s += K.centre(x0 - 20, y, x1 + 20, yEnd);

        s += K.flow(x0 + 150, y - pxOD / 2 - 42, 150, 'FLOW  ' + f(r.V, 2) + ' m/s', COLD);

        /* Bore as a LEADER, not a dimension line: at this scale a 114 mm OD
           dimension between two extension lines 12 px apart is unreadable,
           and it crowded the terminal point. */
        var mx = (x0 + x1) / 2, my = (y + yEnd) / 2;
        s += K.leader(mx, my - pxOD / 2, mx - 40, my - 92,
          'NPS ' + r.nps + '\u2033 SCH ' + r.sch + '  \u00b7  OD ' + f(od, 1)
          + ' / ID ' + f(r.Dmm, 1) + ' mm  \u00b7  ' + String(r.matName || 'CS'));

        /* fittings actually in the design — nothing invented */
        /* The module writes each fitting as {name, qty, k, total}. Filtering
           on .n matched nothing, so a line with four elbows in it drew as a
           straight run — the sheet would have contradicted the ΣK the same
           calculation used. */
        var fits = (r.fitList || []).filter(function (x) { return x && (x.qty || 0) > 0; });
        if (fits.length) {
          var span = (x1 - x0) - 200, step = span / (fits.length + 1);
          fits.slice(0, 5).forEach(function (ft, i2) {
            var fx = x0 + 100 + step * (i2 + 1);
            var fy = y + rise * ((fx - x0) / (x1 - x0));
            s += K.rect(fx - 9, fy - pxOD / 2 - 3, 18, pxOD + 6, { fill: K.METAL2, stroke: K.INK, w: 1 });
            s += K.leader(fx, fy + pxOD / 2 + 3, fx - 6, 322 + (i2 % 2) * 15,
              (ft.qty || 1) + ' \u00d7 ' + (ft.name || 'fitting'));
          });
          if (fits.length > 5) {
            s += K.txt(x0 + 100, 358, '+ ' + (fits.length - 5)
              + ' further fitting type(s) \u2014 see the calculation', { size: 7.5, fill: K.THIN });
          }
        } else {
          s += K.txt(mx, 322, 'NO FITTINGS IN THE DESIGN \u2014 STRAIGHT RUN',
            { anchor: 'middle', size: 8, fill: K.THIN });
        }

        function node(x, yy, lab, val) {
          var t = K.circle(x, yy, 14, { fill: '#ffffff', stroke: K.INK, w: 1.2 });
          t += K.txt(x, yy + 4, lab, { anchor: 'middle', size: 9, weight: 'bold' });
          t += K.txt(x, yy - 22, val, { anchor: 'middle', size: 8.5, weight: 'bold' });
          return t;
        }
        s += node(x0 - 58, y, 'P1', f(r.pUp, 3) + ' bar');
        s += node(x1 + 58, yEnd, 'P2', f(r.pDown, 3) + ' bar');

        s += K.dimH(x0, x1, 386, 'RUN  ' + f(r.L, 2) + ' m', { from: y + pxOD / 2 + 8 });
        if (rise !== 0) {
          s += K.dimV(y, yEnd, x1 + 116, '\u0394z ' + f(r.dz, 2) + ' m', { from: x1 + 76 });
        }

        var nx = 40, ny = 414;
        s += K.rect(nx, ny, 340, 136, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
        s += K.txt(nx + 8, ny + 15, 'CALCULATED HYDRAULICS', { size: 8.5, weight: 'bold' });
        s += K.line(nx, ny + 21, nx + 340, ny + 21, { stroke: K.FAINT, w: 0.5 });
        var rows = [
          /* the exact calculated bore, not just the 1-dp value the callout
             carries — the sheet should hold the number the engine produced */
          ['Bore (ID)', f(r.Dmm, 2) + ' mm'],
          ['Velocity', f(r.V, 3) + ' m/s   (band ' + f(r.vMin, 2) + '\u2013' + f(r.vMax, 2) + ')'],
          ['Reynolds', isFinite(r.Re) ? Math.round(r.Re).toLocaleString() + '  ' + (r.flow || '') : '\u2014'],
          ['Friction factor', f(r.f, 5)],
          ['Total \u0394P', f(r.dpTotal, 5) + ' bar'],
          ['Erosional allowable', f(r.Vallow, 2) + ' m/s  (API RP 14E)']
        ];
        rows.forEach(function (rw, i3) {
          s += K.txt(nx + 8, ny + 36 + i3 * 16, rw[0], { size: 8, fill: K.THIN });
          s += K.txt(nx + 332, ny + 36 + i3 * 16, rw[1], { size: 8.5, weight: 'bold', anchor: 'end' });
        });
        return s;
      }
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
     DOUBLE PIPE EXCHANGER
     The module already draws a full fabrication sheet — hairpin elevation,
     nozzle schedule, supports, notes and title block — from its own result.
     Drawing a second one here would be two sheets of the same exchanger that
     could disagree. This registers the existing one so the drawing control
     reaches it, and adds the calculation-state stamp it did not have.
     ═══════════════════════════════════════════════════════════════════════ */
  register('dphe', {
    title: 'DOUBLE PIPE HEAT EXCHANGER — FABRICATION DRAWING',
    data: function () { return window.dpheReportData || null; },
    raw: function (d) {
      if (typeof window.buildDPHEFabDrawingSVG === 'function') return window.buildDPHEFabDrawingSVG(d);
      return null;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════
     STORAGE TANK — elevation
     Shell, roof, bottom, the calculated liquid levels in their calculated
     positions, nozzles, and the dimensions the design was sized to.
     ═══════════════════════════════════════════════════════════════════════ */
  register('tank', {
    title: 'VERTICAL STORAGE TANK — GENERAL ARRANGEMENT',
    w: 900, h: 688,
    data: function () {
      var r = null;
      try { r = window.AROENG && window.AROENG.values ? window.AROENG.values('tank') : null; } catch (e) {}
      if (!r || !isFinite(r.Dm) || !isFinite(r.Hm)) return null;
      return r;
    },
    subtitle: function (r) {
      return 'ELEVATION  ·  \u00d8 ' + f(r.Dm, 3) + ' m \u00d7 ' + f(r.Hm, 3) + ' m SHELL  ·  '
        + f(r.workCap, 2) + ' m\u00b3 WORKING  ·  ' + esc(r.fluid || 'PRODUCT');
    },
    block: function (r) {
      return [['SERVICE', String(r.svc || r.fluid || '—').slice(0, 26)],
              ['CAPACITY', f(r.workCap, 2) + ' m³ working']];
    },
    draw: function (r, K, W, H) {
      var s = '';
      /* the shell is drawn to the design H/D ratio, scaled to the sheet */
      var top = 110, bot = 470, hPx = bot - top;
      var wPx = Math.max(90, Math.min(320, hPx * (r.Dm / r.Hm)));
      var cx = 360, x0 = cx - wPx / 2, x1 = cx + wPx / 2;
      var mPerPx = r.Hm / hPx;
      var yOf = function (m) { return bot - m / mPerPx; };

      /* foundation */
      s += K.rect(x0 - 34, bot, wPx + 68, 16, { fill: '#f1f5f9', stroke: K.INK, w: 1.1 });
      for (var hx = x0 - 28; hx < x1 + 34; hx += 20) {
        s += K.line(hx, bot + 16, hx - 8, bot + 26, { stroke: K.FAINT, w: 0.6 });
      }
      s += K.txt(cx, bot + 40, 'FOUNDATION / RING WALL', { anchor: 'middle', size: 7.5, fill: K.THIN });

      /* shell and roof */
      s += K.rect(x0, top, wPx, hPx, { fill: '#ffffff', stroke: K.INK, w: 1.4 });
      var roof = String(r.roof || '').toLowerCase();
      if (roof.indexOf('cone') >= 0) {
        s += K.path('M' + x0 + ' ' + top + ' L' + cx + ' ' + (top - 40) + ' L' + x1 + ' ' + top,
          { fill: K.METAL, stroke: K.INK, w: 1.3 });
      } else if (roof.indexOf('dome') >= 0) {
        s += K.path('M' + x0 + ' ' + top + ' Q' + cx + ' ' + (top - 68) + ' ' + x1 + ' ' + top,
          { fill: K.METAL, stroke: K.INK, w: 1.3 });
      } else {
        s += K.rect(x0, top - 12, wPx, 12, { fill: K.METAL, stroke: K.INK, w: 1.2 });
      }
      s += K.txt(cx, top - 50, String(r.roof || 'ROOF').toUpperCase(), { anchor: 'middle', size: 8, fill: K.THIN });
      s += K.centre(cx, top - 58, cx, bot + 30);

      /* liquid, at the calculated working level */
      var lvl = yOf((r.workH || 0) / 1000);
      s += K.rect(x0 + 2, lvl, wPx - 4, bot - lvl, { fill: '#dbeafe', stroke: 'none', w: 0 });
      s += K.line(x0 + 2, lvl, x1 - 2, lvl, { stroke: COLD, w: 1.2 });

      /* the levels the design actually computed */
      function level(mm, label, colour) {
        if (!isFinite(mm)) return '';
        var yy = yOf(mm / 1000);
        if (yy < top || yy > bot) return '';
        var t = K.line(x0 - 26, yy, x1 + 26, yy, { stroke: colour || K.THIN, w: 0.7, dash: '7,4' });
        t += K.txt(x1 + 30, yy + 3, label + '  ' + f(mm / 1000, 3) + ' m', { size: 7.5, fill: colour || K.THIN });
        return t;
      }
      s += level(r.elHHLL, 'HHLL', HOT);
      s += level(r.elHLL, 'HLL', K.THIN);
      s += level(r.elLLL, 'LLL', K.THIN);
      s += level(r.elLLLL, 'LLLL', HOT);

      /* nozzles */
      function noz(yy, side, label) {
        var xx = side < 0 ? x0 : x1;
        var t = K.rect(side < 0 ? xx - 30 : xx, yy - 6, 30, 12, { fill: '#ffffff', stroke: K.INK, w: 1 });
        t += K.flange(side < 0 ? xx - 30 : xx + 30, yy, 16);
        t += K.txt(side < 0 ? xx - 36 : xx + 36, yy + 3, label,
                   { size: 7.5, fill: K.THIN, anchor: side < 0 ? 'end' : 'start' });
        return t;
      }
      s += noz(yOf(0.25), -1, 'OUTLET  NPS ' + (r.noz_out_nps || r.dOut || '—'));
      s += noz(top + 26, 1, 'INLET  NPS ' + (r.noz_in_nps || '—'));
      s += noz(yOf((r.elOverflow || 0) / 1000) || top + 60, -1, 'OVERFLOW');
      /* manway and vent */
      s += K.circle(x0 + 26, bot - 34, 12, { fill: '#ffffff', stroke: K.INK, w: 1 });
      s += K.txt(x0 + 26, bot - 31, 'MW', { anchor: 'middle', size: 6.5, weight: 'bold' });
      s += K.rect(cx + 30, top - 30, 12, 20, { fill: '#ffffff', stroke: K.INK, w: 1 });
      s += K.txt(cx + 48, top - 20, 'VENT', { size: 7.5, fill: K.THIN });

      /* dimensions */
      s += K.dimH(x0, x1, bot + 66, '\u00d8 ' + f(r.Dm, 3) + ' m', { from: bot });
      s += K.dimV(top, bot, x0 - 70, 'SHELL ' + f(r.Hm, 3) + ' m', { from: x0 - 6 });
      s += K.dimV(lvl, bot, x0 - 118, 'WORKING ' + f((r.workH || 0) / 1000, 3) + ' m', { from: x0 - 76 });

      s += K.tag(cx, 78, r.tag || 'T-101');

      /* the numbers */
      var nx = 560, ny = 110;
      s += K.rect(nx, ny, 310, 150, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(nx + 8, ny + 15, 'CALCULATED DESIGN', { size: 8.5, weight: 'bold' });
      s += K.line(nx, ny + 21, nx + 310, ny + 21, { stroke: K.FAINT, w: 0.5 });
      var rows = [
        ['Geometric capacity', f(r.geoCap, 2) + ' m³'],
        ['Working capacity', f(r.workCap, 2) + ' m³'],
        ['Required capacity', f(r.reqCap, 2) + ' m³'],
        ['H / D ratio', f(r.LD, 2)],
        ['Shell thickness', f(r.t, 2) + ' mm  (CA ' + f(r.CA, 1) + ')'],
        ['Freeboard above HLL', f(r.freeboard, 0) + ' mm'],
        ['Erection weight', f(r.wEmpty, 0) + ' kg']
      ];
      rows.forEach(function (rw, i2) {
        s += K.txt(nx + 8, ny + 36 + i2 * 16, rw[0], { size: 8, fill: K.THIN });
        s += K.txt(nx + 302, ny + 36 + i2 * 16, rw[1], { size: 8.5, weight: 'bold', anchor: 'end' });
      });
      return s;
    }
  });

  /* Show any generated sheet with the same export controls the drawing has.
     The isometric the 3D layer generates is a drawing like any other. */
  function showSvg(svg, name, title) {
    if (!svg) return;
    modal(title || 'PIPING ISOMETRIC — GENERATED FROM THE 3D ROUTE',
      '<div class="aro-dwg-wrap" id="aro-dwg-body">' + svg + '</div>',
      '<button class="aro-eb-btn" id="aro-dwg-svg">EXPORT SVG</button>'
      + '<button class="aro-eb-btn" id="aro-dwg-png">EXPORT PNG</button>'
      + '<button class="aro-eb-btn" id="aro-dwg-pdf">EXPORT PDF</button>');
    var stemName = String(name || 'AROGARA_ISOMETRIC');
    bind('aro-dwg-svg', function () {
      download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), stemName + '.svg');
    });
    bind('aro-dwg-png', function () {
      toPng(svg, 3, function (c) {
        if (!c) return;
        c.toBlob(function (b) { if (b) download(b, stemName + '.png'); });
      });
    });
    bind('aro-dwg-pdf', function () {
      var body = $('aro-dwg-body');
      if (body && typeof window.AROPDF === 'function') {
        window.AROPDF(body, stemName + '.pdf', { landscape: true, bg: '#ffffff' });
      } else { window.print(); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SHELL & TUBE EXCHANGER — GENERAL ARRANGEMENT
     The module reported "NO DRAWING FOR THIS MODULE YET". The geometry has
     been in the result all along: shell diameter, bundle diameter, tube count
     and length, baffle spacing, the TEMA designation and the four nozzle
     sizes. This draws that — longitudinal arrangement, a tube-layout section
     on the real pitch, a nozzle schedule and the design data — from the same
     result object the 3D model and the report read.
     ═══════════════════════════════════════════════════════════════════════ */
  register('sthe', {
    title: 'SHELL & TUBE HEAT EXCHANGER — GENERAL ARRANGEMENT',
    w: 1020, h: 720,
    data: function () {
      var st = window.state && window.state.sthe;
      if (!st || !st.calculated || !st.results) return null;
      var r = st.results, i = st.inputs || {};
      function dom(id) { var e = document.getElementById(id); return e ? parseFloat(e.value) : NaN; }
      var L = dom('sthe-tube-L');
      if (!isFinite(L) || L <= 0) L = 4.88;
      if (L > 40) L = L / 1000;
      var tod = dom('sthe-tube-od');
      if (!isFinite(tod) || tod <= 0) tod = 19.05;
      if (tod < 1) tod = tod * 1000;
      return {
        Ds: r.Ds_used_mm, Db: r.Db_mm, Nt: r.Nt, Np: i.Np || dom('sthe-tube-passes') || 1,
        L: L, tubeOd: tod, pitch: (dom('sthe-pitch-ratio') || 1.25) * tod,
        layout: i.layout, tema: r.temaDesignation, type: r.stheType,
        nozT: r.noz_tube_nps, nozS: r.noz_shell_nps,
        dT: r.D_nozzle_tube_in, dS: r.D_nozzle_shell_in,
        Q: r.Q_kW, lmtd: r.dT_lm, U: r.U_calc, Aa: r.Aa, Ar: r.Ar, excess: r.excessArea,
        dpt: r.dp_tube_kPa, dps: r.dp_shell_kPa,
        baffle: dom('sthe-baffle-space'), cut: dom('sthe-baffle-cut'),
        tubeFluid: i.tubeSideFluid, shellFluid: i.shellSideFluid,
        frontHead: i.frontHeadName, rearHead: i.rearHeadName, shellType: i.shellTypeName,
        /* sthe-tube-mat holds a wall conductivity, not a grade — reading it as
           a material printed "60" on the sheet */
        tag: (window.AROPROJECT && window.AROPROJECT.context && window.AROPROJECT.context()
              && window.AROPROJECT.context().tag) || 'E-101'
      };
    },
    subtitle: function (d) {
      return (d.tema ? 'TEMA ' + d.tema + '  \u00b7  ' : '')
        + f(d.Ds, 0) + ' mm SHELL ID  \u00b7  ' + (d.Nt || '\u2014') + ' TUBES \u00d7 '
        + f(d.tubeOd, 2) + ' mm OD \u00d7 ' + f(d.L, 3) + ' m  \u00b7  ' + d.Np + ' PASS';
    },
    block: function (d) {
      return [['SERVICE', String(d.shellFluid || '\u2014').slice(0, 24)],
              ['DUTY', f(d.Q, 1) + ' kW']];
    },
    draw: function (d, K, W, H) {
      var s = '';
      var Ds = d.Ds, Db = isFinite(d.Db) && d.Db > 0 ? d.Db : Ds * 0.86;

      /* ── longitudinal arrangement, scaled to the sheet ────────────────── */
      var x0 = 176, x1 = 648, cy = 212;
      var pxL = x1 - x0;
      var mmPerPx = (d.L * 1000) / pxL;
      var pxD = Math.max(46, Math.min(132, Ds / mmPerPx));
      /* the head, its cover and the two channel nozzles all live to the left
         of x0 — hold them inside the sheet rather than off its edge */
      var headL = Math.min(pxD * 0.7, pxL * 0.20, x0 - 96);

      /* shell */
      s += K.rect(x0, cy - pxD / 2, pxL, pxD, { fill: '#ffffff', stroke: K.INK, w: 1.5 });
      /* channel head and cover at the front, bonnet at the rear */
      s += K.rect(x0 - headL, cy - pxD / 2 * 1.04, headL, pxD * 1.04,
        { fill: K.METAL, stroke: K.INK, w: 1.3 });
      s += K.rect(x0 - headL - 9, cy - pxD / 2 * 1.10, 9, pxD * 1.10,
        { fill: K.METAL2, stroke: K.INK, w: 1.2 });
      s += K.path('M' + x1 + ' ' + (cy - pxD / 2) + ' Q' + (x1 + headL * 1.1) + ' ' + cy
        + ' ' + x1 + ' ' + (cy + pxD / 2), { fill: K.METAL, stroke: K.INK, w: 1.3 });
      /* tubesheets */
      s += K.rect(x0 - 4, cy - pxD / 2, 8, pxD, { fill: K.METAL2, stroke: K.INK, w: 1.1 });
      s += K.rect(x1 - 4, cy - pxD / 2, 8, pxD, { fill: K.METAL2, stroke: K.INK, w: 1.1 });
      s += K.leader(x0, cy + pxD / 2, x0 - 34, cy + pxD / 2 + 54, 'TUBESHEET');

      /* the bundle envelope and a representative tube row */
      var pxB = pxD * (Db / Ds);
      s += K.path('M' + x0 + ' ' + (cy - pxB / 2) + ' L' + x1 + ' ' + (cy - pxB / 2),
        { stroke: K.FAINT, w: 0.7, dash: '7,4' });
      s += K.path('M' + x0 + ' ' + (cy + pxB / 2) + ' L' + x1 + ' ' + (cy + pxB / 2),
        { stroke: K.FAINT, w: 0.7, dash: '7,4' });
      var rows = Math.max(2, Math.min(9, Math.floor(pxB / 9)));
      for (var rr = 0; rr < rows; rr++) {
        var ty = cy - pxB / 2 + (pxB * (rr + 0.5)) / rows;
        s += K.line(x0, ty, x1, ty, { stroke: K.THIN, w: 0.55 });
      }
      s += K.leader(x1 - 120, cy - pxB / 2, x1 - 150, cy - pxD / 2 - 46,
        (d.Nt || '\u2014') + ' \u00d7 \u00d8' + f(d.tubeOd, 2) + ' TUBES');

      /* segmental baffles at the calculated spacing */
      var B = isFinite(d.baffle) && d.baffle > 0 ? d.baffle : Ds;
      var nB = Math.max(0, Math.min(18, Math.floor((d.L * 1000) / B) - 1));
      for (var b = 1; b <= nB; b++) {
        var bx = x0 + (pxL * b) / (nB + 1);
        var up = b % 2 === 0;
        s += K.rect(bx - 1.6, up ? cy - pxB / 2 : cy - pxB * 0.18, 3.2, pxB * 0.68,
          { fill: K.METAL2, stroke: K.INK, w: 0.7 });
      }
      if (nB) {
        s += K.leader(x0 + pxL / (nB + 1), cy - pxB / 2, x0 - 46, cy - pxD / 2 - 30,
          nB + (nB === 1 ? ' BAFFLE @ ' : ' BAFFLES @ ') + f(B, 0) + ' mm'
          + (isFinite(d.cut) ? ', ' + f(d.cut, 0) + '% CUT' : ''));
      }
      s += K.centre(x0 - headL - 22, cy, x1 + headL * 1.3 + 16, cy);

      /* ── nozzles, with the schedule tags the table below repeats ──────── */
      function noz(x, up, tag, nps) {
        var h = 30, w = Math.max(9, Math.min(24, (isFinite(nps) ? nps : 3) * 3.4));
        var y = up ? cy - pxD / 2 : cy + pxD / 2;
        s += K.rect(x - w / 2, up ? y - h : y, w, h, { fill: '#ffffff', stroke: K.INK, w: 1.2 });
        /* K.flange draws a vertical bar; a nozzle standing up or down needs
           its face across the stub, so the flange plate is drawn directly */
        s += K.rect(x - w * 0.75, (up ? y - h : y + h) - 1.8, w * 1.5, 3.6,
          { fill: K.METAL2, stroke: K.INK, w: 0.9 });
        s += K.txt(x, up ? y - h - 12 : y + h + 18, tag,
          { anchor: 'middle', size: 8.5, weight: 'bold' });
      }
      noz(x0 + pxL * 0.14, true, 'N1', d.nozS);
      noz(x1 - pxL * 0.10, false, 'N2', d.nozS);
      s += K.rect(x0 - headL - 9 - 26, cy - pxD * 0.30 - 9, 26, 18,
        { fill: '#ffffff', stroke: K.INK, w: 1.2 });
      s += K.txt(x0 - headL - 44, cy - pxD * 0.30 + 4, 'N3', { anchor: 'end', size: 8.5, weight: 'bold' });
      s += K.rect(x0 - headL - 9 - 26, cy + pxD * 0.30 - 9, 26, 18,
        { fill: '#ffffff', stroke: K.INK, w: 1.2 });
      s += K.txt(x0 - headL - 44, cy + pxD * 0.30 + 4, 'N4', { anchor: 'end', size: 8.5, weight: 'bold' });

      /* saddles */
      [0.30, 0.68].forEach(function (t) {
        var sx = x0 + pxL * t;
        s += K.path('M' + (sx - pxD * 0.42) + ' ' + (cy + pxD / 2)
          + ' L' + (sx - pxD * 0.30) + ' ' + (cy + pxD / 2 + 40)
          + ' L' + (sx + pxD * 0.30) + ' ' + (cy + pxD / 2 + 40)
          + ' L' + (sx + pxD * 0.42) + ' ' + (cy + pxD / 2) + ' Z',
          { fill: K.METAL, stroke: K.INK, w: 1.1 });
        s += K.rect(sx - pxD * 0.40, cy + pxD / 2 + 40, pxD * 0.80, 7,
          { fill: K.METAL2, stroke: K.INK, w: 1 });
      });
      s += K.txt(x0 + pxL * 0.30, cy + pxD / 2 + 62, 'SADDLE SUPPORT',
        { anchor: 'middle', size: 7.5, fill: K.THIN });

      /* dimensions */
      s += K.dimH(x0, x1, cy + pxD / 2 + 96, 'TUBE LENGTH  ' + f(d.L, 3) + ' m',
        { from: cy + pxD / 2 + 50 });
      s += K.dimV(cy - pxD / 2, cy + pxD / 2, x1 + headL * 1.3 + 46,
        '\u00d8 ' + f(d.Ds, 0) + ' mm ID', { from: x1 + headL * 1.3 + 6 });

      s += K.tag(x0 + pxL * 0.62, cy + pxD / 2 + 78, d.tag);
      s += K.flow(x0 + pxL * 0.16 + 26, cy - pxD / 2 - 46, 92,
        'SHELL SIDE  ' + String(d.shellFluid || ''), HOT);

      /* ── tube layout section, on the calculated pitch ──────────────────── */
      var sx0 = 790, sy0 = 176, secR = 96;
      s += K.txt(sx0, sy0 - secR - 22, 'SECTION A-A \u2014 TUBE LAYOUT',
        { anchor: 'middle', size: 9, weight: 'bold' });
      s += K.circle(sx0, sy0, secR, { fill: '#ffffff', stroke: K.INK, w: 1.5 });
      var secB = secR * (Db / Ds);
      s += K.circle(sx0, sy0, secB, { stroke: K.FAINT, w: 0.8, dash: '7,4', fill: 'none' });
      /* The true pitch scaled into a 96 px section is under a pixel on a large
         bundle — every tube lands on top of the next and the section reads as
         a smudge. Below a legible pitch the layout is drawn enlarged and the
         caption says so, which is what a layout sheet does anyway. */
      var truePx = (d.pitch / Ds) * secR * 2;
      var pxPitch = Math.max(6, truePx);
      var enlarged = pxPitch > truePx * 1.01;
      var tri = String(d.layout || '').toLowerCase().indexOf('squ') < 0;
      var rTube = Math.max(1.6, (d.tubeOd / d.pitch) * pxPitch * 0.5);
      var drawn = 0, half = Math.ceil(secB / Math.max(2, pxPitch)) + 1;
      for (var ri = -half; ri <= half && drawn < 260; ri++) {
        for (var ci = -half; ci <= half && drawn < 260; ci++) {
          var tx = ci * pxPitch + (tri && (ri % 2) ? pxPitch / 2 : 0);
          var tz = ri * pxPitch * (tri ? 0.866 : 1);
          if (tx * tx + tz * tz <= (secB - rTube) * (secB - rTube)) {
            s += K.circle(sx0 + tx, sy0 + tz, rTube, { stroke: K.THIN, w: 0.5, fill: 'none' });
            drawn++;
          }
        }
      }
      s += K.txt(sx0, sy0 + secR + 20,
        (tri ? 'TRIANGULAR' : 'SQUARE') + ' PITCH ' + f(d.pitch, 1) + ' mm  \u00b7  '
        + drawn + ' SHOWN OF ' + (d.Nt || '\u2014'),
        { anchor: 'middle', size: 7.5, fill: K.THIN });
      if (enlarged) {
        s += K.txt(sx0, sy0 + secR + 32, 'LAYOUT ENLARGED FOR LEGIBILITY \u2014 NOT TO SECTION SCALE',
          { anchor: 'middle', size: 7, fill: HOT });
      }
      s += K.centre(sx0 - secR - 14, sy0, sx0 + secR + 14, sy0);
      s += K.centre(sx0, sy0 - secR - 14, sx0, sy0 + secR + 14);

      /* ── nozzle schedule ──────────────────────────────────────────────── */
      var nx = 40, ny = 452;
      s += K.rect(nx, ny, 430, 122, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(nx + 8, ny + 15, 'NOZZLE SCHEDULE', { size: 8.5, weight: 'bold' });
      s += K.line(nx, ny + 21, nx + 430, ny + 21, { stroke: K.FAINT, w: 0.5 });
      [['MARK', 'SERVICE', 'SIZE', 'RATING'],
       ['N1', 'SHELL INLET', d.nozS ? 'NPS ' + d.nozS + '\u2033' : f(d.dS, 0) + ' mm', 'CL 150 RF'],
       ['N2', 'SHELL OUTLET', d.nozS ? 'NPS ' + d.nozS + '\u2033' : f(d.dS, 0) + ' mm', 'CL 150 RF'],
       ['N3', 'TUBE INLET', d.nozT ? 'NPS ' + d.nozT + '\u2033' : f(d.dT, 0) + ' mm', 'CL 150 RF'],
       ['N4', 'TUBE OUTLET', d.nozT ? 'NPS ' + d.nozT + '\u2033' : f(d.dT, 0) + ' mm', 'CL 150 RF']]
        .forEach(function (row, i) {
          var yy = ny + 36 + i * 17;
          var head = i === 0;
          s += K.txt(nx + 10, yy, row[0], { size: 8, weight: head ? 'bold' : 'normal', fill: head ? K.INK : K.THIN });
          s += K.txt(nx + 70, yy, row[1], { size: 8.5, weight: head ? 'bold' : 'normal' });
          s += K.txt(nx + 250, yy, row[2], { size: 8.5, weight: head ? 'bold' : 'bold' });
          s += K.txt(nx + 350, yy, row[3], { size: 8, fill: K.THIN });
        });

      /* ── design data ──────────────────────────────────────────────────── */
      var dx = 490, dy = 452;
      s += K.rect(dx, dy, 490, 122, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(dx + 8, dy + 15, 'DESIGN DATA \u2014 FROM THIS CALCULATION', { size: 8.5, weight: 'bold' });
      s += K.line(dx, dy + 21, dx + 490, dy + 21, { stroke: K.FAINT, w: 0.5 });
      var col = [
        ['Heat duty', f(d.Q, 2) + ' kW'],
        ['LMTD', f(d.lmtd, 2) + ' \u00b0C'],
        ['U calculated', f(d.U, 1) + ' W/m\u00b2\u00b7K'],
        ['Area provided / required', f(d.Aa, 2) + ' / ' + f(d.Ar, 2) + ' m\u00b2'],
        ['Excess surface', f(d.excess, 1) + ' %'],
        ['\u0394P tube / shell', f(d.dpt, 2) + ' / ' + f(d.dps, 2) + ' kPa']
      ];
      col.forEach(function (rw, i) {
        var yy = dy + 36 + i * 14;
        s += K.txt(dx + 10, yy, rw[0], { size: 8, fill: K.THIN });
        s += K.txt(dx + 250, yy, rw[1], { size: 8.5, weight: 'bold' });
      });
      function cut(v, n) {
        var t = String(v == null || v === '' ? '\u2014' : v);
        return t.length > n ? t.slice(0, n - 1) + '\u2026' : t;
      }
      var col2 = [
        ['TEMA type', cut(d.tema, 18)],
        ['Front head', cut(d.frontHead, 20)],
        ['Shell type', cut(d.shellType, 20)],
        ['Rear head', cut(d.rearHead, 20)],
        ['Tube pitch / layout', f(d.pitch, 1) + ' mm ' + (tri ? 'TRI' : 'SQ')],
        ['Tube / shell fluid', cut(d.tubeFluid, 10) + ' / ' + cut(d.shellFluid, 10)]
      ];
      col2.forEach(function (rw, i) {
        var yy = dy + 36 + i * 14;
        s += K.txt(dx + 320, yy, rw[0], { size: 7.5, fill: K.THIN });
        s += K.txt(dx + 482, yy, rw[1], { size: 8, weight: 'bold', anchor: 'end' });
      });
      return s;
    }
  });

  window.ARODWG = {
    register: register, svgFor: svgFor, open: open, has: has, K: K, sheet: sheet,
    blockFor: blockFor, showSvg: showSvg, stem: stem,
    modules: function () { return Object.keys(REG); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCss);
  else injectCss();
})();

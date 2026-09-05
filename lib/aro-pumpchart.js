/* ══════════════════════════════════════════════════════════════════════
   AROGARA — shared HD chrome for the pump module's small 2D-canvas charts
   window.AROPUMPCHART

   Flow-Head Selection Map, Pressure-Temperature Envelope and the Affinity
   curve each draw their own axes into a canvas with a fixed backing-store
   resolution (640x320) that CSS then stretches to the panel's actual width
   — on any display wider than ~640 CSS px, and on any high-DPI screen, the
   browser is upscaling a low-res bitmap, which is what reads as blurry/
   "not HD". hd() re-backs the canvas at its real CSS size times
   devicePixelRatio and returns a context already scaled so callers keep
   drawing in the same CSS-pixel coordinate space as before — no other line
   of their drawing code needs to change.

   grid() adds the numbered gridlines every one of these charts was
   missing (only an axis-name label, no scale to read a value off), and
   legend() adds the line/box key so multiple overlapping series are
   distinguishable instead of just "lots of lines". ══════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* Re-back canvas at CSS-size * devicePixelRatio and scale the context to
     match, so 1 drawing unit = 1 CSS pixel exactly like before this file
     existed. Safe to call on every redraw — it only touches canvas.width/
     height (which resets the bitmap) when the size actually changed. */
  function hd(canvas) {
    /* Fall back to the canvas's ORIGINAL declared size (captured once,
       before this function ever touches it) - never to its own current
       canvas.width/height. Those are the mutable backing-store pixels this
       function itself sets, so using them as a stand-in when the canvas is
       momentarily unlaid-out (display:none ancestor - e.g. gated results,
       or a still-collapsed section - reports an 0x0 rect) would re-scale
       an already-scaled number on every redraw and run away unbounded. */
    if (canvas._hdBaseW == null) { canvas._hdBaseW = canvas.width || 1; canvas._hdBaseH = canvas.height || 1; }
    var rect = canvas.getBoundingClientRect();
    var cssW = Math.max(1, Math.round(rect.width || canvas.clientWidth || canvas._hdBaseW));
    var cssH = Math.max(1, Math.round(rect.height || canvas.clientHeight || canvas._hdBaseH));
    var dpr = window.devicePixelRatio || 1;
    if (canvas._hdW !== cssW || canvas._hdH !== cssH || canvas._hdDpr !== dpr) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas._hdW = cssW; canvas._hdH = cssH; canvas._hdDpr = dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: cssW, H: cssH };
  }

  /* 'nice' tick step so labels read as round numbers (1/2/5 x10^n),
     not raw fractions of the axis max. */
  function niceStep(range, targetTicks) {
    var raw = range / Math.max(1, targetTicks);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = (norm < 1.5) ? 1 : (norm < 3.5) ? 2 : (norm < 7.5) ? 5 : 10;
    return step * mag;
  }

  /* Draws gridlines + numeric tick labels on both axes, plus the axis
     name labels this file's callers already had. fmt formats a tick
     value to text (default: trims to at most 1 decimal). */
  function grid(ctx, W, H, pad, pal, opt) {
    opt = opt || {};
    var xMax = opt.xMax || 1, yMax = opt.yMax || 1;
    var xFmt = opt.xFmt || function (v) { return v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString(); };
    var yFmt = opt.yFmt || xFmt;
    var xStep = niceStep(xMax, opt.xTicks || 5);
    var yStep = niceStep(yMax, opt.yTicks || 5);
    var plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;

    ctx.save();
    ctx.strokeStyle = pal.grid; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    ctx.fillStyle = pal.textMuted || pal.axis; ctx.font = '11px monospace';

    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var yv = 0; yv <= yMax + 1e-9; yv += yStep) {
      var y = H - pad.b - (yv / yMax) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillText(yFmt(yv), pad.l - 6, y); ctx.globalAlpha = 0.35;
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var xv = 0; xv <= xMax + 1e-9; xv += xStep) {
      var x = pad.l + (xv / xMax) * plotW;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillText(xFmt(xv), x, H - pad.b + 4); ctx.globalAlpha = 0.35;
    }
    ctx.restore();

    // axis frame on top of the gridlines, and the axis-name labels
    ctx.strokeStyle = pal.axis; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
    if (opt.xLabel) {
      ctx.fillStyle = pal.axis; ctx.font = '600 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(opt.xLabel, pad.l + plotW / 2, opt.xLabelY || (H - 4));
    }
    if (opt.yLabel) {
      ctx.save(); ctx.translate(11, pad.t + plotH / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = pal.axis; ctx.font = '600 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(opt.yLabel, 0, 0); ctx.restore();
    }
    if (opt.title) {
      ctx.fillStyle = pal.text; ctx.font = '700 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(opt.title, pad.l, 2);
    }
  }

  /* items: [{label, color, alpha, dash:[..]|null, swatch:'line'|'box',
     key, hidden}]. Drawn as a wrapped row of chips anchored at (x, y),
     background boxed for legibility over whatever the plot drew
     underneath. Returns the total height consumed so a caller can
     reserve space above it.

     opts: { canvas, onToggle(key) } - when both are given, every item
     that carries a `key` becomes clickable: a click toggles that item and
     calls onToggle(key), and a hidden item draws dimmed with a strike
     through its label so "click to hide a line" is discoverable and its
     state is visible without reading a tooltip. The hit-test itself is a
     single delegated click listener wired once per canvas (idempotent -
     safe to call legend() again on every redraw), reading whatever
     hitboxes THIS call just computed off the canvas element. */
  function legend(ctx, x, y, maxW, items, pal, opts) {
    if (!items || !items.length) return 0;
    opts = opts || {};
    var clickable = !!(opts.canvas && opts.onToggle);
    ctx.save();
    ctx.font = '11px monospace';
    var padX = 6, gap = 10, chipH = 17, rowGap = 4, swatchW = 15;
    var rows = [[]], rowWidths = [0], rowW = 0;
    items.forEach(function (it) {
      var w = swatchW + 4 + ctx.measureText(it.label).width + padX * 2;
      if (rowW + w > maxW && rowW > 0) { rows.push([]); rowWidths.push(0); rowW = 0; }
      rows[rows.length - 1].push({ it: it, w: w });
      rowW += w + gap;
      rowWidths[rowWidths.length - 1] = rowW - gap;
    });
    var totalH = rows.length * (chipH + rowGap);

    // one right-sized background box per row, not a full-width bar
    var legendBg = (pal && pal.legendBg) || 'rgba(2,6,18,0.55)';
    rows.forEach(function (row, ri) {
      var ry0 = y + ri * (chipH + rowGap);
      ctx.fillStyle = legendBg;
      ctx.fillRect(x - 4, ry0 - 3, Math.min(maxW, rowWidths[ri] + 8), chipH + rowGap + 1);
    });

    var hitboxes = [];
    rows.forEach(function (row, ri) {
      var rx = x;
      var ry = y + ri * (chipH + rowGap) + chipH / 2;
      row.forEach(function (cell) {
        var it = cell.it;
        var dim = !!it.hidden;
        ctx.globalAlpha = dim ? 0.32 : (it.alpha == null ? 1 : it.alpha);
        if (it.swatch === 'box') {
          ctx.strokeStyle = it.color; ctx.lineWidth = 1.5;
          ctx.strokeRect(rx, ry - 5, swatchW, 10);
        } else {
          ctx.strokeStyle = it.color; ctx.lineWidth = 2;
          if (it.dash) ctx.setLineDash(it.dash); else ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + swatchW, ry); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = dim ? (pal.textMuted || pal.text) : pal.text;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(it.label, rx + swatchW + 4, ry + 1);
        if (dim) {
          var tw = ctx.measureText(it.label).width;
          ctx.strokeStyle = pal.textMuted || pal.text; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(rx + swatchW + 4, ry + 1); ctx.lineTo(rx + swatchW + 4 + tw, ry + 1); ctx.stroke();
        }
        if (clickable && it.key != null) hitboxes.push({ x: rx, y: ry - chipH / 2, w: cell.w - gap, h: chipH, key: it.key });
        rx += cell.w + gap;
      });
    });
    ctx.restore();

    if (clickable) {
      opts.canvas._legendHitboxes = hitboxes;
      opts.canvas._legendOnToggle = opts.onToggle;
      if (!opts.canvas._legendClickWired) {
        opts.canvas._legendClickWired = true;
        function hitAt(ev) {
          var boxes = opts.canvas._legendHitboxes;
          if (!boxes || !boxes.length) return null;
          var rect = opts.canvas.getBoundingClientRect();
          var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
          for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b;
          }
          return null;
        }
        opts.canvas.addEventListener('click', function (ev) {
          var b = hitAt(ev);
          if (b) opts.canvas._legendOnToggle(b.key);
        });
        opts.canvas.addEventListener('mousemove', function (ev) {
          opts.canvas.style.cursor = hitAt(ev) ? 'pointer' : '';
        });
      }
    }
    return totalH;
  }

  window.AROPUMPCHART = { hd: hd, grid: grid, legend: legend, niceStep: niceStep };
})();

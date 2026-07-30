/* ══════════════════════════════════════════════════════════════════════
   AROGARA — SVG LABEL LAYOUT ENGINE  (window.AROLAYOUT)

   Every schematic in the suite was drawn by putting labels at fixed
   offsets from a handful of anchors. That works for the one set of
   numbers it was written against and breaks for every other: change the
   liquid level and the level caption lands on the static-head box; make
   the vessel short and the summary box leaves a hand's width of dead
   space above it; lengthen a riser and the valve symbols sit on the
   elbow.

   The fix is not another offset. It is to lay the drawing out from what
   is actually on it:

     · every shape and every label registers the rectangle it occupies;
     · a label asks for a preferred position and is given the first
       candidate that collides with nothing already placed;
     · the viewBox is computed from the content, so a small drawing is a
       small drawing rather than a large one with a gap in it.

   Text is measured, not guessed at: character widths for the sans face
   the schematics use, summed per character, which is within a few per
   cent of the rendered width and always errs wide.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Per-character width as a fraction of font-size, Arial/Helvetica.
     Narrow characters would otherwise be over-reserved by a flat factor
     and wide ones under-reserved — the second of those is what lets two
     labels touch. */
  var W_NARROW = 'iljI|!.,:;\'`()[]{}/\\ ';
  var W_WIDE = 'mMwWQO@%';
  function textWidth(str, fontSize, bold) {
    str = String(str == null ? '' : str);
    var w = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (W_NARROW.indexOf(c) !== -1) w += 0.30;
      else if (W_WIDE.indexOf(c) !== -1) w += 0.86;
      else if (c >= '0' && c <= '9') w += 0.556;
      else if (c === c.toUpperCase() && c !== c.toLowerCase()) w += 0.68;
      else w += 0.52;
    }
    return w * fontSize * (bold ? 1.06 : 1);
  }

  function overlaps(a, b, pad) {
    pad = pad || 0;
    return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad
        && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  }

  /* A layout holds the occupied rectangles for one drawing. */
  function create(opts) {
    opts = opts || {};
    var pad = opts.pad != null ? opts.pad : 3;
    var occ = [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    function grow(r) {
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.w > maxX) maxX = r.x + r.w;
      if (r.y + r.h > maxY) maxY = r.y + r.h;
    }

    /* Register something that is drawn — a shape, a box, anything a label
       must not land on. `soft` items bound the view but do not block. */
    function reserve(x, y, w, h, soft) {
      var r = { x: x, y: y, w: w, h: h };
      grow(r);
      if (!soft) occ.push(r);
      return r;
    }

    function free(r) {
      for (var i = 0; i < occ.length; i++) if (overlaps(r, occ[i], pad)) return false;
      return true;
    }

    /* Find the first candidate that is clear. Candidates are tried in
       order, so the first is the preferred position and the rest are the
       fallbacks in the order the drawing would rather use them. */
    function fit(w, h, candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        var r = { x: c.x, y: c.y, w: w, h: h };
        if (free(r)) return { x: c.x, y: c.y, anchor: c.anchor || 'start', found: true };
      }
      /* Nothing was clear. Take the last candidate and push it down until
         it is — a label pushed out of place still reads; a label written
         over another does not. */
      var last = candidates[candidates.length - 1];
      var y = last.y, guard = 0;
      while (!free({ x: last.x, y: y, w: w, h: h }) && guard++ < 200) y += 4;
      return { x: last.x, y: y, anchor: last.anchor || 'start', found: false };
    }

    /* Place a single line of text. `x`,`y` is the preferred baseline
       position; `alt` are fallback baselines. Returns the SVG string. */
    function text(str, x, y, o) {
      o = o || {};
      var fs = o.size || 9;
      var bold = !!o.bold;
      var anchor = o.anchor || 'start';
      var w = textWidth(str, fs, bold);
      var h = fs * 1.25;
      var toRect = function (px, py, an) {
        var rx = an === 'middle' ? px - w / 2 : (an === 'end' ? px - w : px);
        return { x: rx, y: py - fs, w: w, h: h };
      };
      var cands = [{ x: x, y: y, anchor: anchor }].concat(o.alt || []);
      var picked = null;
      for (var i = 0; i < cands.length && !picked; i++) {
        var c = cands[i];
        var an = c.anchor || anchor;
        var r = toRect(c.x, c.y, an);
        if (free(r)) picked = { x: c.x, y: c.y, anchor: an, rect: r };
      }
      if (!picked) {
        var last = cands[cands.length - 1];
        var an2 = last.anchor || anchor;
        var yy = last.y, guard = 0;
        while (!free(toRect(last.x, yy, an2)) && guard++ < 240) yy += 4;
        picked = { x: last.x, y: yy, anchor: an2, rect: toRect(last.x, yy, an2) };
      }
      occ.push(picked.rect); grow(picked.rect);
      return '<text x="' + picked.x.toFixed(1) + '" y="' + picked.y.toFixed(1) + '"'
        + (picked.anchor !== 'start' ? ' text-anchor="' + picked.anchor + '"' : '')
        + ' font-size="' + fs + '"' + (bold ? ' font-weight="bold"' : '')
        + ' fill="' + (o.fill || '#1e40af') + '"'
        + (o.family ? ' font-family="' + o.family + '"' : '')
        + '>' + esc(str) + '</text>';
    }

    /* A boxed group of lines, kept together and placed as one unit. */
    function box(lines, x, y, o) {
      o = o || {};
      var fs = o.size || 8;
      var lh = o.lineHeight || fs * 1.45;
      var padX = o.padX != null ? o.padX : 7;
      var padY = o.padY != null ? o.padY : 6;
      var w = 0;
      lines.forEach(function (l) {
        var t = typeof l === 'string' ? l : l.t;
        var b = typeof l === 'string' ? false : !!l.bold;
        var s = typeof l === 'string' ? fs : (l.size || fs);
        w = Math.max(w, textWidth(t, s, b));
      });
      w += padX * 2;
      var h = lines.length * lh + padY * 2 - (lh - fs);
      var spot = fit(w, h, [{ x: x, y: y }].concat(o.alt || []));
      var r = { x: spot.x, y: spot.y, w: w, h: h };
      occ.push(r); grow(r);
      var s = '<rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + w.toFixed(1)
        + '" height="' + h.toFixed(1) + '" rx="' + (o.rx || 5) + '" fill="' + (o.fill || '#eff6ff')
        + '" stroke="' + (o.stroke || '#3b82f6') + '" stroke-width="' + (o.strokeWidth || 1) + '"/>';
      lines.forEach(function (l, i) {
        var t = typeof l === 'string' ? l : l.t;
        var b = typeof l === 'string' ? false : !!l.bold;
        var sz = typeof l === 'string' ? fs : (l.size || fs);
        var col = typeof l === 'string' ? (o.colour || '#1e40af') : (l.fill || o.colour || '#1e40af');
        s += '<text x="' + (r.x + w / 2).toFixed(1) + '" y="' + (r.y + padY + sz + i * lh).toFixed(1)
          + '" text-anchor="middle" font-size="' + sz + '"' + (b ? ' font-weight="bold"' : '')
          + ' fill="' + col + '">' + esc(t) + '</text>';
      });
      return s;
    }

    /* A stack of lines that must stay in the order they are written and
       together as one block — a pressure with its unit under it, a caption
       with its value. Placing the lines one at a time let a later line be
       pushed above an earlier one, which read as the wrong number. */
    function textBlock(lines, x, y, o) {
      o = o || {};
      var fs = o.size || 9;
      var lh = o.lineHeight || fs * 1.35;
      var w = 0;
      lines.forEach(function (l) {
        var t = typeof l === 'string' ? l : l.t;
        var b = typeof l === 'string' ? false : !!l.bold;
        var sz = typeof l === 'string' ? fs : (l.size || fs);
        w = Math.max(w, textWidth(t, sz, b));
      });
      var h = lines.length * lh;
      var anchor = o.anchor || 'start';
      var toX = function (px) { return anchor === 'middle' ? px - w / 2 : (anchor === 'end' ? px - w : px); };
      var cands = [{ x: x, y: y }].concat(o.alt || []);
      var spot = null;
      for (var i = 0; i < cands.length && !spot; i++) {
        var r = { x: toX(cands[i].x), y: cands[i].y - fs, w: w, h: h };
        if (free(r)) spot = { x: cands[i].x, y: cands[i].y, rect: r };
      }
      if (!spot) {
        var last = cands[cands.length - 1];
        var yy = last.y, guard = 0;
        while (!free({ x: toX(last.x), y: yy - fs, w: w, h: h }) && guard++ < 240) yy += 4;
        spot = { x: last.x, y: yy, rect: { x: toX(last.x), y: yy - fs, w: w, h: h } };
      }
      occ.push(spot.rect); grow(spot.rect);
      var out = '';
      lines.forEach(function (l, i) {
        var t = typeof l === 'string' ? l : l.t;
        var b = typeof l === 'string' ? false : !!l.bold;
        var sz = typeof l === 'string' ? fs : (l.size || fs);
        var col = typeof l === 'string' ? (o.fill || '#1e40af') : (l.fill || o.fill || '#1e40af');
        out += '<text x="' + spot.x.toFixed(1) + '" y="' + (spot.y + i * lh).toFixed(1) + '"'
          + (anchor !== 'start' ? ' text-anchor="' + anchor + '"' : '')
          + ' font-size="' + sz + '"' + (b ? ' font-weight="bold"' : '')
          + ' fill="' + col + '">' + esc(t) + '</text>';
      });
      return out;
    }

    /* The viewBox that hugs what was actually drawn. */
    function viewBox(margin) {
      margin = margin != null ? margin : 12;
      if (!isFinite(minX)) return '0 0 800 500';
      var x = minX - margin, y = minY - margin;
      var w = (maxX - minX) + margin * 2, h = (maxY - minY) + margin * 2;
      return x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1);
    }

    function bounds() { return { minX: minX, minY: minY, maxX: maxX, maxY: maxY }; }

    return { reserve: reserve, text: text, textBlock: textBlock, box: box, fit: fit, free: free,
             viewBox: viewBox, bounds: bounds, occupied: occ, textWidth: textWidth };
  }

  function esc(x) {
    return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  window.AROLAYOUT = { create: create, textWidth: textWidth, overlaps: overlaps, esc: esc };
})();

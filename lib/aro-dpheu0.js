/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — DOUBLE PIPE U₀ ASSUMPTION, ON THE INPUT SIDE  (window.ARODPHEU0)
   ---------------------------------------------------------------------------
   The double-pipe module asked for its assumed overall coefficient in the
   RESULTS panel. An input living among the outputs is awkward in itself, but
   the real cost was ordering: U₀ is an assumption an engineer makes BEFORE
   sizing, and the sheet only offered it afterwards, next to the verdict on
   whether the guess had been any good. Shell-and-tube gets this right — its
   assumed U sits in the input form with the fluid-pair reference beside it —
   and this brings the double pipe into line.

   WHAT THIS BLOCK IS. The assumed U₀, on the input side, with the band the
   selected service actually falls in drawn next to it, so the number is
   entered against a reference rather than into a vacuum. Once a calculation
   exists, the coefficient it produced is drawn on the same scale, and the
   verdict says whether the assumption held.

   WHERE THE BAND COMES FROM. dpheTypicalU() — the same function the results
   charts already use. Not a second table that could drift away from the
   first, and not a range invented here.

   WHAT IT DOES NOT DO. It does not size anything, and it does not write U₀
   into the calculation on the engineer's behalf: blank still means "take the
   band midpoint for this service", exactly as before. The output-side field
   stays, and the two are the same value — typing in either updates the other,
   because two boxes for one quantity that can disagree is worse than one box
   in an awkward place.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var HOST = 'aro-dphe-u0';
  var built = false;

  function $(id) { return document.getElementById(id); }
  function n(id, d) {
    var e = $(id);
    if (!e) return d;
    var v = parseFloat(e.value);
    return isFinite(v) ? v : d;
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }
  /* Convert into the active unit system and return the NUMBER. fromSIDisplay
     returns the figure with its unit attached, which printed
     "100 W/m²·°C–350 W/m²·°C W/m²·°C" once the label added the symbol as
     well. The symbol is supplied once, by whoever writes the label. */
  function conv(si) {
    try {
      var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS.htc;
      if (C) return C.fromSI(si, window.activeUnitSystem || 'SI');
    } catch (e) {}
    return si;
  }
  function disp(si, dec) {
    var v = conv(si);
    return isFinite(v) ? Number(v).toFixed(dec == null ? 0 : dec) : '—';
  }
  function unitSym() {
    try {
      var C = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS.htc;
      if (C) return C.symbol(window.activeUnitSystem || 'SI');
    } catch (e) {}
    return 'W/m²·°C';
  }

  /* The service band, from the module's own table. Hot side may be in either
     the tube or the annulus, so the viscosities are handed over the way the
     results charts hand them over. */
  function band() {
    if (typeof window.dpheTypicalU !== 'function') return null;
    var hotInTube = false;
    var sel = $('dphe-hot-side');
    if (sel) hotInTube = /tube|inner/i.test(sel.value || '');
    var muH = n('dphe-mu-hot', NaN), muC = n('dphe-mu-cold', NaN);
    if (!isFinite(muH) || !isFinite(muC)) return null;
    try {
      return window.dpheTypicalU(hotInTube ? muH : muC, hotInTube ? muC : muH);
    } catch (e) { return null; }
  }

  /* The coefficient the last calculation produced, if there was one. */
  function calculatedU() {
    try {
      if (window.AROSTATE && window.AROSTATE.state('dphe') === 'NOT_CALCULATED') return NaN;
    } catch (e) {}
    var d = window.dpheReportData;
    if (d && isFinite(d.Ud)) return d.Ud;
    var el = $('dphe-out-ud');
    if (el) {
      var v = parseFloat(String(el.textContent).replace(/[^0-9.\-]/g, ''));
      if (isFinite(v) && v > 0) {
        try {
          if (window.toSIValue) return window.toSIValue('htc', v);
        } catch (e) {}
        return v;
      }
    }
    return NaN;
  }

  var CSSID = 'aro-dphe-u0-css';
  function css() {
    if ($(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#' + HOST + '{margin-top:14px;padding:10px 12px;border-radius:5px;',
      '  background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.24);}',
      '#' + HOST + ' .u0-h{font-family:var(--font-mono);font-size:9px;letter-spacing:.07em;',
      '  font-weight:700;color:#f59e0b;margin-bottom:7px;}',
      '#' + HOST + ' .u0-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;}',
      '#' + HOST + ' .u0-in{flex:0 0 132px;}',
      '#' + HOST + ' label{display:block;font-family:var(--font-mono);font-size:8.5px;',
      '  letter-spacing:.05em;color:var(--text-muted);margin-bottom:3px;}',
      '#' + HOST + ' .u0-ref{flex:1;min-width:170px;font-size:9.5px;line-height:1.55;',
      '  color:var(--text-main,#cbd5e1);background:rgba(0,0,0,.16);border-radius:3px;padding:6px 8px;}',
      '#' + HOST + ' .u0-ref b{color:#f59e0b;}',
      '#' + HOST + ' .u0-v{font-family:var(--font-mono);font-size:9px;font-weight:700;margin-top:7px;line-height:1.5;}',
      '#' + HOST + ' svg{display:block;width:100%;height:auto;margin-top:8px;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── The band chart ───────────────────────────────────────────────────
     One axis, logarithmic, because overall coefficients across services span
     two decades and a linear axis buries every organic service against the
     left edge. The typical band is a bar; the assumption and the calculated
     coefficient are marks on it. Nothing is drawn that has not been
     established: before a calculation there is no calculated mark. */
  function chart(b, uAssumed, uCalc) {
    var W = 340, H = 92, L = 8, R = 8, T = 26, B = 20;
    var lo = 30, hi = 3000;
    var pts = [b.lo, b.hi, uAssumed, uCalc].filter(function (v) { return isFinite(v) && v > 0; });
    if (pts.length) {
      lo = Math.min(lo, Math.min.apply(null, pts) * 0.7);
      hi = Math.max(hi, Math.max.apply(null, pts) * 1.3);
    }
    var l0 = Math.log10(lo), l1 = Math.log10(hi);
    function x(v) { return L + (Math.log10(v) - l0) / (l1 - l0) * (W - L - R); }
    var g = '';
    var yBar = T + 14;
    /* the typical band for this service */
    g += '<rect x="' + x(b.lo).toFixed(1) + '" y="' + yBar + '" width="'
      + (x(b.hi) - x(b.lo)).toFixed(1) + '" height="18" fill="rgba(245,158,11,.28)" '
      + 'stroke="#f59e0b" stroke-width="1"/>';
    g += '<text x="' + ((x(b.lo) + x(b.hi)) / 2).toFixed(1) + '" y="' + (yBar + 13)
      + '" fill="#f59e0b" font-size="8" text-anchor="middle" font-weight="700" '
      + 'font-family="ui-monospace,monospace">' + disp(b.lo, 0) + '–' + disp(b.hi, 0) + '</text>';
    /* decade ticks */
    for (var d = Math.ceil(l0); d <= Math.floor(l1); d++) {
      var xv = x(Math.pow(10, d));
      g += '<line x1="' + xv.toFixed(1) + '" y1="' + (yBar + 18) + '" x2="' + xv.toFixed(1)
        + '" y2="' + (yBar + 23) + '" stroke="#64748b" stroke-width="0.7"/>'
        + '<text x="' + xv.toFixed(1) + '" y="' + (yBar + 33) + '" fill="#64748b" font-size="7.5" '
        + 'text-anchor="middle" font-family="ui-monospace,monospace">'
        + disp(Math.pow(10, d), 0) + '</text>';
    }
    function mark(v, col, label, up) {
      if (!isFinite(v) || v <= 0) return '';
      var xv = x(v);
      var y1 = up ? yBar - 8 : yBar + 26, y2 = up ? yBar : yBar + 18;
      return '<line x1="' + xv.toFixed(1) + '" y1="' + y1 + '" x2="' + xv.toFixed(1) + '" y2="'
        + y2 + '" stroke="' + col + '" stroke-width="1.6"/>'
        + '<text x="' + xv.toFixed(1) + '" y="' + (up ? y1 - 3 : y2 + 32) + '" fill="' + col
        + '" font-size="7.5" text-anchor="middle" font-weight="700" '
        + 'font-family="ui-monospace,monospace">' + esc(label) + '</text>';
    }
    g += mark(uAssumed, '#38bdf8', 'U₀ ' + disp(uAssumed, 0), true);
    if (isFinite(uCalc) && uCalc > 0) g += mark(uCalc, '#22c55e', 'Ud ' + disp(uCalc, 0), false);

    g += '<text x="' + L + '" y="12" fill="#94a3b8" font-size="8" '
      + 'font-family="ui-monospace,monospace">TYPICAL BAND — ' + esc(b.label.toUpperCase())
      + '  (' + esc(unitSym()) + ')</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="background:rgba(0,0,0,.16);'
      + 'border-radius:4px;">' + g + '</svg>';
  }

  function render() {
    var host = $(HOST);
    if (!host) return;
    var b = band();
    var typed = n('aro-dphe-u0-in', 0);
    var uAssumed = typed > 0 ? typed : (b ? Math.sqrt(b.lo * b.hi) : NaN);
    var uCalc = calculatedU();

    var ref = host.querySelector('.u0-ref');
    if (ref) {
      ref.innerHTML = b
        ? 'Service reads as <b>' + esc(b.label) + '</b>.<br>Typical U₀ <b>' + disp(b.lo, 0)
          + '–' + disp(b.hi, 0) + ' ' + esc(unitSym()) + '</b>'
          + (typed > 0 ? '' : ' — blank uses the midpoint, <b>' + disp(uAssumed, 0) + '</b>.')
        : 'Enter both viscosities and the service band appears here. It is not '
          + 'assumed before they are known.';
    }
    var gEl = host.querySelector('.u0-graph');
    if (gEl) gEl.innerHTML = b ? chart(b, uAssumed, uCalc) : '';

    var v = host.querySelector('.u0-v');
    if (v) {
      if (!isFinite(uCalc) || uCalc <= 0) {
        v.style.color = 'var(--text-muted)';
        v.textContent = 'Run the calculation to check the assumption against the coefficient it produces.';
      } else if (!isFinite(uAssumed) || uAssumed <= 0) {
        v.style.color = 'var(--text-muted)';
        v.textContent = 'Calculated Ud = ' + disp(uCalc, 1) + ' ' + unitSym() + '.';
      } else {
        var dev = (uCalc - uAssumed) / uAssumed * 100;
        var ok = Math.abs(dev) <= 30;
        v.style.color = ok ? '#22c55e' : '#f59e0b';
        v.textContent = ok
          ? '✓ VERIFIED — Ud = ' + disp(uCalc, 1) + ' ' + unitSym()
            + ' is within ±30% of U₀ (' + dev.toFixed(1) + '%).'
          : '⚠ NOT MATCHED — Ud = ' + disp(uCalc, 1) + ' ' + unitSym() + ' deviates '
            + dev.toFixed(1) + '% from U₀. Re-iterate with U₀ = ' + disp(uCalc, 0) + '.';
      }
    }
  }

  /* The two fields are one quantity. Typing in either moves the other, so a
     sheet can never be produced against an assumption the engineer changed on
     the input side and never saw applied. */
  function syncFrom(srcId, dstId) {
    var a = $(srcId), b2 = $(dstId);
    if (!a || !b2) return;
    if (b2.value !== a.value) {
      b2.value = a.value;
      try {
        b2.dispatchEvent(new Event('input', { bubbles: true }));
        b2.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }
  }

  function build() {
    if (built) return true;
    var form = $('dphe-form');
    var out = $('dphe-u-assumed');
    if (!form || !out) return false;
    /* Insert above the run button, so it is the last thing an engineer sets
       before sizing — which is where an assumption belongs. */
    var runBtn = form.querySelector('button[type="submit"]');
    var anchor = runBtn ? runBtn.parentNode : null;
    if (!anchor || anchor.parentNode !== form) anchor = null;

    css();
    var box = document.createElement('div');
    box.id = HOST;
    box.innerHTML =
      '<div class="u0-h">U₀ ASSUMPTION &mdash; OVERALL COEFFICIENT BEFORE SIZING</div>'
      + '<div class="u0-row">'
      + '<div class="u0-in"><label>ASSUMED U₀ (' + esc(unitSym()) + ')</label>'
      + '<input type="number" id="aro-dphe-u0-in" class="form-control text-data" step="any" '
      + 'value="' + esc(out.value || '0') + '" data-unit-type="htc" '
      + 'style="font-size:13px;font-weight:700;color:#f59e0b;" '
      + 'title="Blank or 0 takes the midpoint of the typical band for this service"></div>'
      + '<div class="u0-ref"></div>'
      + '</div>'
      + '<div class="u0-graph"></div>'
      + '<div class="u0-v"></div>';

    if (anchor) form.insertBefore(box, anchor);
    else form.appendChild(box);

    /* keep both boxes in step, in both directions */
    var mine = $('aro-dphe-u0-in');
    mine.addEventListener('input', function () { syncFrom('aro-dphe-u0-in', 'dphe-u-assumed'); render(); });
    out.addEventListener('input', function () { syncFrom('dphe-u-assumed', 'aro-dphe-u0-in'); render(); });
    out.addEventListener('change', function () { syncFrom('dphe-u-assumed', 'aro-dphe-u0-in'); render(); });

    /* the band follows the viscosities and the hot-side selection */
    ['dphe-mu-hot', 'dphe-mu-cold', 'dphe-hot-side'].forEach(function (id) {
      var e = $(id);
      if (!e) return;
      e.addEventListener('input', render);
      e.addEventListener('change', render);
    });

    built = true;
    render();
    return true;
  }

  window.ARODPHEU0 = { build: build, render: render, band: band };

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      if (build() || ++tries > 60) clearInterval(iv);
    }, 400);
    /* A calculation changes the verdict, and so does a unit-system change. */
    document.addEventListener('click', function () { setTimeout(render, 900); }, true);
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'global-unit-system') setTimeout(render, 200);
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

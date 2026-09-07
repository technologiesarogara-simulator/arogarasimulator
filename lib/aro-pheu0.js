/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — PLATE HEAT EXCHANGER U₀ ASSUMPTION, ON THE INPUT SIDE  (window.AROPHEU0)
   ---------------------------------------------------------------------------
   Same idea as the double-pipe module's own input-side U₀ box
   (aro-dpheu0.js): an assumed overall coefficient, entered against the
   band the chosen service actually falls in, before the design is sized —
   not just a verdict handed back afterwards. Neither module's assumed U₀
   ever drives its geometry: DPHE sizes off the pipe/annulus diameters the
   user picks, PHE sizes off the plate/channel count, and in both cases the
   coefficient that number produces is CALCULATED, not assumed. The box is
   a target to check that calculated figure against, entered where the
   assumption is actually made instead of only seeing it compared
   afterwards.

   WHERE THE BAND COMES FROM. window.AROPHE.sideClass / .uBand — the exact
   functions the results card itself uses. Not a second table.

   THE BOX'S OWN NUMBER. Shows the band midpoint by default, tracked via
   AROPROV (the app's existing default/user marker) the same way every
   other auto-suggested field in the app works — typing over it makes it
   the assumption and this file stops touching the box.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var HOST = 'aro-phe-u0';
  var built = false;

  function $(id) { return document.getElementById(id); }
  function n(id, d) {
    var e = $(id);
    if (!e) return d;
    var v = parseFloat(e.value);
    return isFinite(v) ? v : d;
  }
  function val(id, d) { var e = $(id); return e ? (e.value || d) : d; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }
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

  /* Same read boundary compute() uses: cp fields are kJ/kg·°C on screen,
     the classification rule needs J/kg·K. */
  function band() {
    var AP = window.AROPHE;
    if (!AP || typeof AP.sideClass !== 'function' || typeof AP.uBand !== 'function') return null;
    var hPhase = val('phe-hf-phase', 'Liquid'), cPhase = val('phe-cf-phase', 'Liquid');
    var hot = { cp: n('phe-hf-cp', 4.198) * 1000, k: n('phe-hf-k', 0.668) };
    var cold = { cp: n('phe-cf-cp', 4.180) * 1000, k: n('phe-cf-k', 0.628) };
    var hc = AP.sideClass(hot, hPhase), cc = AP.sideClass(cold, cPhase);
    return AP.uBand(hc, cc);
  }

  /* The coefficient the last RUN produced, if there was one. */
  function calculatedU() {
    try {
      var r = window.pheLastResult && window.pheLastResult();
      if (r && isFinite(r.Ud)) return r.Ud;
    } catch (e) {}
    return NaN;
  }

  var CSSID = 'aro-phe-u0-css';
  function css() {
    if ($(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#' + HOST + '{margin:10px 0 14px;padding:10px 12px;border-radius:5px;',
      '  background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.24);}',
      '#' + HOST + ' .u0-h{font-family:var(--font-mono);font-size:9px;letter-spacing:.07em;',
      '  font-weight:700;color:#38bdf8;margin-bottom:7px;}',
      '#' + HOST + ' .u0-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;}',
      '#' + HOST + ' .u0-in{flex:0 0 132px;}',
      '#' + HOST + ' label{display:block;font-family:var(--font-mono);font-size:8.5px;',
      '  letter-spacing:.05em;color:var(--text-muted);margin-bottom:3px;}',
      '#' + HOST + ' .u0-ref{flex:1;min-width:170px;font-size:9.5px;line-height:1.55;',
      '  color:var(--text-main,#cbd5e1);background:rgba(0,0,0,.16);border-radius:3px;padding:6px 8px;}',
      '#' + HOST + ' .u0-ref b{color:#38bdf8;}',
      '#' + HOST + ' .u0-v{font-family:var(--font-mono);font-size:9px;font-weight:700;margin-top:7px;line-height:1.5;}',
      '#' + HOST + ' svg{display:block;width:100%;height:auto;margin-top:8px;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Same band-chart the DPHE input-side box draws — one log-scale number
     line, the typical band as a bar, the assumption as an upward mark and
     (once calculated) the resulting Ud as a downward mark. */
  function chart(b, uAssumed, uCalc) {
    var W = 340, H = 92, L = 8, R = 8, T = 26;
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
    g += '<rect x="' + x(b.lo).toFixed(1) + '" y="' + yBar + '" width="'
      + (x(b.hi) - x(b.lo)).toFixed(1) + '" height="18" fill="rgba(56,189,248,.24)" '
      + 'stroke="#38bdf8" stroke-width="1"/>';
    g += '<text x="' + ((x(b.lo) + x(b.hi)) / 2).toFixed(1) + '" y="' + (yBar + 13)
      + '" fill="#38bdf8" font-size="8" text-anchor="middle" font-weight="700" '
      + 'font-family="ui-monospace,monospace">' + disp(b.lo, 0) + '–' + disp(b.hi, 0) + '</text>';
    /* the number line the decade ticks sit on */
    g += '<line x1="' + L + '" y1="' + (yBar + 18) + '" x2="' + (W - R).toFixed(1) + '" y2="'
      + (yBar + 18) + '" stroke="#94a3b8" stroke-width="1"/>';
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
      + 'font-family="ui-monospace,monospace">TYPICAL BAND — ' + esc(b.basis.toUpperCase())
      + '  (' + esc(unitSym()) + ')</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="background:rgba(0,0,0,.16);'
      + 'border-radius:4px;">' + g + '</svg>';
  }

  function render() {
    var host = $(HOST);
    if (!host) return;
    var b = band();
    var el = $('aro-phe-u0-in');
    /* Pre-fill with the band midpoint until the engineer types a real
       entry, same rule every other auto-suggested field in the app
       follows, tracked via AROPROV so it stops the moment they do. */
    var isUserSet = !!(el && window.AROPROV && window.AROPROV.of(el) === 'user');
    if (el && !isUserSet && b) {
      var mid = Math.sqrt(b.lo * b.hi);
      var decs = mid < 10 ? 2 : (mid < 100 ? 1 : 0);
      var display = disp(mid, decs);
      if (display !== '—' && el.value !== display) {
        el.value = display;
        if (window.AROPROV) window.AROPROV.set(el, 'default');
      }
    }
    var typed = n('aro-phe-u0-in', 0);
    var uAssumed = typed > 0 ? typed : (b ? Math.sqrt(b.lo * b.hi) : NaN);
    var uCalc = calculatedU();

    var ref = host.querySelector('.u0-ref');
    if (ref) {
      ref.innerHTML = b
        ? 'Service reads as <b>' + esc(b.basis) + '</b>.<br>Typical U₀ <b>' + disp(b.lo, 0)
          + '–' + disp(b.hi, 0) + ' ' + esc(unitSym()) + '</b>'
          + (isUserSet ? '' : ' — shown here as the midpoint, <b>' + disp(uAssumed, 0)
            + '</b>. Edit the box to use your own figure instead.')
          + ' Sizing here is driven by the plate/channel count, not this figure — it only '
          + 'feeds the comparison chart and verdict below.'
        : 'Set both phases and the fluid properties to see the expected band for this service.';
    }
    var gEl = host.querySelector('.u0-graph');
    if (gEl) gEl.innerHTML = b ? chart(b, uAssumed, uCalc) : '';

    var v = host.querySelector('.u0-v');
    if (v) {
      if (!b) {
        v.style.color = 'var(--text-muted)';
        v.textContent = '';
      } else if (!isFinite(uCalc) || uCalc <= 0) {
        v.style.color = 'var(--text-muted)';
        v.textContent = 'Run the calculation to check the assumption against the coefficient it produces.';
      } else {
        var dev = (uCalc - uAssumed) / uAssumed * 100;
        var ok = Math.abs(dev) <= 30;
        v.style.color = ok ? '#22c55e' : '#f59e0b';
        v.textContent = ok
          ? '✓ MATCHED — Ud = ' + disp(uCalc, 1) + ' ' + unitSym()
            + ' is within ±30% of your U₀ (' + dev.toFixed(1) + '%).'
          : '⚠ NOT MATCHED — Ud = ' + disp(uCalc, 1) + ' ' + unitSym() + ' deviates '
            + dev.toFixed(1) + '% from U₀ — review the plate/channel count or the fluid data entered.';
      }
    }
  }

  function build() {
    if (built) return true;
    var runBtn = $('phe-calc');
    if (!runBtn || !runBtn.parentNode) return false;

    css();
    var box = document.createElement('div');
    box.id = HOST;
    box.innerHTML =
      '<div class="u0-h">U₀ ASSUMPTION &mdash; BEFORE SIZING</div>'
      + '<div class="u0-row">'
      + '<div class="u0-in"><label>YOUR U₀ (' + esc(unitSym()) + ')</label>'
      + '<input type="number" id="aro-phe-u0-in" class="form-control text-data" step="any" '
      + 'value="0" data-unit-type="htc" '
      + 'style="font-size:13px;font-weight:700;color:#38bdf8;" '
      + 'title="Pre-filled with the typical band\'s midpoint for this service — type over it to use your own figure. Comparison only: PHE sizes the plate/channel count to the duty, not to this number."></div>'
      + '<div class="u0-ref"></div>'
      + '</div>'
      + '<div class="u0-graph"></div>'
      + '<div class="u0-v"></div>';

    runBtn.parentNode.insertBefore(box, runBtn);

    var mine = $('aro-phe-u0-in');
    mine.addEventListener('input', render);

    ['phe-hf-phase', 'phe-cf-phase', 'phe-hf-cp', 'phe-cf-cp', 'phe-hf-k', 'phe-cf-k',
      'phe-hf-name', 'phe-cf-name'].forEach(function (id) {
      var e = $(id);
      if (!e) return;
      e.addEventListener('input', render);
      e.addEventListener('change', render);
    });

    built = true;
    render();
    return true;
  }

  window.AROPHEU0 = { build: build, render: render, band: band };

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      if (build() || ++tries > 60) clearInterval(iv);
    }, 400);
    /* a RUN PHE CALCULATION click changes the Ud mark; a unit-system change
       changes the displayed figures. */
    document.addEventListener('click', function () { setTimeout(render, 900); }, true);
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'global-unit-system') setTimeout(render, 200);
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  else setTimeout(boot, 500);
})();

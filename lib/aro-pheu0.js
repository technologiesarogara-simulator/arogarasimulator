/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — PLATE HEAT EXCHANGER U₀ REFERENCE, ON THE INPUT SIDE  (window.AROPHEU0)
   ---------------------------------------------------------------------------
   Double pipe (aro-dpheu0.js) puts its assumed U₀ in the input form because
   an engineer picks that number before sizing, from the fluid pair alone.
   PHE is built differently: the plate/channel count is what the user sets,
   and the overall coefficient Ud FALLS OUT of that geometry and the flow —
   nothing in the PHE sizing math ever reads a user-typed "assumed U". So
   this file does NOT add an editable box (that would imply PHE sizes off
   it, and it does not). It adds the same early, before-you-size REFERENCE
   the results card already gives afterwards (see the "U₀ ASSUMPTION —
   SERVICE-FLUID DESIGN CRITERIA" card in aro-phe.js), so the expected band
   for the chosen service is visible while the fluids are still being set
   up, not just after RUN PHE CALCULATION.

   WHERE THE BAND COMES FROM. window.AROPHE.sideClass / .uBand — the exact
   functions the results card itself uses. Not a second table.

   WHAT THIS BLOCK DOES NOT DO. It never sizes anything and it is never
   editable — the box shown is the CALCULATED Ud once a run exists
   (window.pheLastResult()), never a target the geometry search tracks.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var HOST = 'aro-phe-u0';
  var built = false;

  function $(id) { return document.getElementById(id); }
  function num(id, d) {
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
    var hot = { cp: num('phe-hf-cp', 4.198) * 1000, k: num('phe-hf-k', 0.668) };
    var cold = { cp: num('phe-cf-cp', 4.180) * 1000, k: num('phe-cf-k', 0.628) };
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
      '  font-weight:700;color:#38bdf8;margin-bottom:5px;}',
      '#' + HOST + ' .u0-tag{display:inline-block;font-size:8px;font-weight:700;letter-spacing:.04em;',
      '  color:#94a3b8;background:rgba(148,163,184,.14);border-radius:3px;padding:1px 6px;margin-left:6px;',
      '  vertical-align:1px;}',
      '#' + HOST + ' .u0-ref{font-size:9.5px;line-height:1.55;color:var(--text-main,#cbd5e1);',
      '  background:rgba(0,0,0,.16);border-radius:3px;padding:6px 8px;margin-bottom:6px;}',
      '#' + HOST + ' .u0-ref b{color:#38bdf8;}',
      '#' + HOST + ' .u0-v{font-family:var(--font-mono);font-size:9px;font-weight:700;margin-top:7px;line-height:1.5;}',
      '#' + HOST + ' svg{display:block;width:100%;height:auto;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Same band-chart the DPHE input-side reference draws — one log-scale
     number line, the typical band as a bar, and (once calculated) the
     resulting Ud as a mark on it. No "assumed U₀" mark here: PHE never
     assumes one, so the only mark is the outcome, when there is one. */
  function chart(b, uCalc) {
    var W = 340, H = 78, L = 8, R = 8, T = 26;
    var lo = 30, hi = 3000;
    var pts = [b.lo, b.hi, uCalc].filter(function (v) { return isFinite(v) && v > 0; });
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
    if (isFinite(uCalc) && uCalc > 0) {
      var xv2 = x(uCalc);
      g += '<line x1="' + xv2.toFixed(1) + '" y1="' + (yBar + 26) + '" x2="' + xv2.toFixed(1) + '" y2="'
        + (yBar + 18) + '" stroke="#22c55e" stroke-width="1.6"/>'
        + '<text x="' + xv2.toFixed(1) + '" y="' + (yBar + 44) + '" fill="#22c55e" font-size="7.5" '
        + 'text-anchor="middle" font-weight="700" font-family="ui-monospace,monospace">Ud '
        + disp(uCalc, 0) + '</text>';
    }
    g += '<text x="' + L + '" y="12" fill="#94a3b8" font-size="8" '
      + 'font-family="ui-monospace,monospace">EXPECTED U BAND — ' + esc(b.basis.toUpperCase())
      + '  (' + esc(unitSym()) + ')</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + (H + (isFinite(uCalc) && uCalc > 0 ? 14 : 0)) + '" '
      + 'style="background:rgba(0,0,0,.16);border-radius:4px;">' + g + '</svg>';
  }

  function render() {
    var host = $(HOST);
    if (!host) return;
    var b = band();
    var uCalc = calculatedU();

    var ref = host.querySelector('.u0-ref');
    if (ref) {
      ref.innerHTML = b
        ? 'Service reads as <b>' + esc(b.basis) + '</b>. Plate exchangers of this kind typically '
          + 'land at <b>' + disp(b.lo, 0) + '–' + disp(b.hi, 0) + ' ' + esc(unitSym()) + '</b> overall. '
          + 'This is a reference only — PHE sizes the plate/channel count to the duty and the '
          + 'coefficient falls out of that; there is nothing to type in here.'
        : 'Set both phases and the fluid properties to see the expected band for this service.';
    }
    var gEl = host.querySelector('.u0-graph');
    if (gEl) gEl.innerHTML = b ? chart(b, uCalc) : '';

    var v = host.querySelector('.u0-v');
    if (v) {
      if (!b) {
        v.style.color = 'var(--text-muted)';
        v.textContent = '';
      } else if (!isFinite(uCalc) || uCalc <= 0) {
        v.style.color = 'var(--text-muted)';
        v.textContent = 'Run the calculation to see where the sized Ud lands on this band.';
      } else {
        var inBand = uCalc >= b.lo && uCalc <= b.hi;
        v.style.color = inBand ? '#22c55e' : '#f59e0b';
        v.textContent = inBand
          ? '✓ Sized Ud = ' + disp(uCalc, 1) + ' ' + unitSym() + ' falls within the expected band.'
          : '⚠ Sized Ud = ' + disp(uCalc, 1) + ' ' + unitSym() + ' is outside the expected band — '
            + 'review the plate/channel count or the fluid data entered.';
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
      '<div class="u0-h">EXPECTED U₀ — BEFORE SIZING<span class="u0-tag">REFERENCE ONLY</span></div>'
      + '<div class="u0-ref"></div>'
      + '<div class="u0-graph"></div>'
      + '<div class="u0-v"></div>';

    runBtn.parentNode.insertBefore(box, runBtn);

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

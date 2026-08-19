/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — ACCEPTABLE RANGES ON EVERY INPUT  (window.ARORANGE)
   ---------------------------------------------------------------------------
   "Accepting any nonsense input — need to correct."
   "Must show or indicate acceptable range."

   Measured on the running application before this file existed. Density was
   typed as 034566446654545645 — the number the engineer photographed — and
   the pump sized itself without complaint:

       hydraulic power   183,112,294,507,801.84 kW
       banner            STABLE - NO CAVITATION.  Motor: 1000.00 kW

   A density of 3.4×10¹⁶ kg/m³ is denser than a neutron star. Negative
   density, 1e308 and 0e34 were all accepted the same way. Not one numeric
   field in the application carried a min or a max, so the browser had nothing
   to check against and the modules had nothing to refuse.

   WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT DO
   ---------------------------------------------------
   Two tiers, because "impossible" and "unusual" are different answers and
   only one of them is the application's business.

     HARD    Outside physical possibility, or outside what the arithmetic can
             carry: a density of zero divides by zero, a temperature below
             absolute zero is not a temperature. These BLOCK the calculation
             and say why. A result computed from an impossible input is not a
             result, and printing one on a datasheet is worse than refusing.

     TYPICAL Unusual but real. Liquid metal at 13,500 kg/m³ is a genuine
             service; so is a 900 °C flue gas. These are flagged amber and
             the design runs. The engineer is told the value is outside the
             usual band and left to decide — the application does not know
             the service better than the person specifying it.

   NOTHING IS EVER CHANGED. No value is clamped, rounded, corrected or
   replaced. A rejected entry stays in the box exactly as it was typed, so
   the engineer can see what they wrote and fix it themselves. Silently
   moving an engineering input to the edge of a range would be the same
   failure as silently filling one in.

   The bounds themselves are held in SI and shown in whatever unit system is
   active, so the hint under a pressure field reads "0 – 1000 bar a" in SI and
   "0 – 14504 psia" in US, and re-renders when the system is switched.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  /* ── The bounds, in SI base units ─────────────────────────────────────────
     SI bases as UNIT_CONVERSIONS defines them: pressure and press-drop in
     bar, press-drop-kpa in kPa, density kg/m³, viscosity cP, mass-flow kg/hr,
     mass-flow-s kg/s, vol-flow m³/hr, vol-flow-lhr l/hr, length-m m,
     length-mm mm, velocity m/s, power and heat-duty kW, cp kJ/kg·°C,
     thermal-cond W/m·K, htc W/m²·K, fouling m²·K/W, area m², stress MPa,
     volume m³, mass kg, temperature and temp-diff °C.

     hard  — [min, max] inclusive; a value outside this cannot be computed.
     typ   — [min, max] the usual engineering band; outside is a note, not a
             refusal.
     why   — plain words for the one that gets shown when a value is rejected. */
  var R = {
    'temperature':    { hard: [-273.15, 6000],  typ: [-100, 600],      why: 'below absolute zero' },
    'temp-diff':      { hard: [0, 3000],        typ: [0.1, 300],       why: 'a temperature difference cannot be negative' },
    'pressure':       { hard: [0, 1000],        typ: [0.01, 250],      why: 'absolute pressure cannot be negative' },
    'press-drop':     { hard: [0, 100],         typ: [0.0001, 20],     why: 'a pressure drop cannot be negative' },
    'press-drop-kpa': { hard: [0, 10000],       typ: [0.01, 2000],     why: 'a pressure drop cannot be negative' },
    /* The typical band is only worth having if it is narrow enough to mean
       something. A band of 0.05–20000 kg/m³ covers everything from vacuum
       gas to molten tungsten and so flags nothing; 3000 puts brines and
       heavy slurries inside it and leaves mercury, molten lead and packed
       ore solids to be noticed and confirmed. */
    'density':        { hard: [1e-6, 30000],    typ: [0.05, 3000],     why: 'density must be greater than zero — the hydraulics divide by it' },
    'viscosity':      { hard: [1e-9, 1e7],      typ: [0.05, 50000],    why: 'viscosity must be greater than zero' },
    'mass-flow':      { hard: [0, 1e9],         typ: [0.001, 5e6],     why: 'flow cannot be negative' },
    'mass-flow-s':    { hard: [0, 3e5],         typ: [1e-6, 2000],     why: 'flow cannot be negative' },
    'vol-flow':       { hard: [0, 1e7],         typ: [1e-4, 5e5],      why: 'flow cannot be negative' },
    'vol-flow-lhr':   { hard: [0, 1e10],        typ: [0.1, 5e8],       why: 'flow cannot be negative' },
    'length-m':       { hard: [0, 10000],       typ: [0.001, 500],     why: 'a length cannot be negative' },
    'length-mm':      { hard: [0, 1e6],         typ: [0.1, 1e5],       why: 'a length cannot be negative' },
    'velocity':       { hard: [0, 1000],        typ: [0.01, 100],      why: 'velocity cannot be negative' },
    'power':          { hard: [0, 1e6],         typ: [0.01, 5e4],      why: 'power cannot be negative' },
    'heat-duty':      { hard: [0, 1e7],         typ: [0.01, 1e6],      why: 'duty cannot be negative' },
    'cp':             { hard: [1e-6, 100],      typ: [0.1, 20],        why: 'specific heat must be greater than zero' },
    'thermal-cond':   { hard: [1e-9, 5000],     typ: [0.005, 500],     why: 'conductivity must be greater than zero' },
    'htc':            { hard: [1e-6, 2e6],      typ: [1, 2e5],         why: 'a heat transfer coefficient must be greater than zero' },
    'fouling':        { hard: [0, 1],           typ: [0, 0.01],        why: 'a fouling resistance cannot be negative' },
    'area':           { hard: [1e-9, 1e6],      typ: [0.001, 1e5],     why: 'area must be greater than zero' },
    'stress':         { hard: [0, 5000],        typ: [10, 1000],       why: 'allowable stress cannot be negative' },
    'volume':         { hard: [0, 1e7],         typ: [1e-4, 1e6],      why: 'a volume cannot be negative' },
    'mass':           { hard: [0, 1e9],         typ: [0.01, 1e7],      why: 'a mass cannot be negative' }
  };

  /* Fields that carry no unit type but still have obvious bounds. Keyed by
     element id, or by a pattern where a family of ids shares a meaning.
     `u` is the unit shown in the hint; these are dimensionless or percent, so
     they do not move with the unit system. */
  var BY_ID = {
    'pump-margin':   { hard: [0, 200],  typ: [0, 30],   u: '%',  why: 'a design margin is a percentage added on top' },
    'pump-eff':      { hard: [1, 100],  typ: [30, 92],  u: '%',  why: 'efficiency is a percentage and cannot reach zero' },
    'pump-motor-eff':{ hard: [1, 100],  typ: [70, 98],  u: '%',  why: 'efficiency is a percentage and cannot reach zero' },
    /* The field already carried max="95" — a native attribute that only
       affects :invalid styling, never actually stops a value being typed or
       committed. A vessel needs headroom above its low-level line for the
       high-level alarm and vapour space, so 95% was always the intended
       ceiling; it just was not enforced anywhere. */
    'pump-lll':      { hard: [0, 95],   typ: [5, 80],   u: '%',  why: 'the vessel needs headroom above the low level for HLL and vapour space' }
  };
  var BY_PATTERN = [
    { re: /(^|-)eff(-|$)|efficiency/i,  r: { hard: [1, 100],   typ: [20, 98],  u: '%',  why: 'efficiency is a percentage and cannot reach zero' } },
    { re: /margin|-oversize|overdesign/i, r: { hard: [0, 200], typ: [0, 40],   u: '%',  why: 'a margin is a percentage added on top' } },
    { re: /roughness/i,                 r: { hard: [0, 50],    typ: [0.001, 5], u: 'mm', why: 'roughness cannot be negative' } },
    { re: /-npass|passes|n-pass/i,      r: { hard: [1, 16],    typ: [1, 8],    u: '',   why: 'there is at least one pass' } }
  ];

  /* ── Coordinates and readings are SIGNED; magnitudes are not ─────────────
     An ELEVATION is measured from a datum and the datum is not the bottom of
     the world. A suction vessel in a pit sits below grade, its elevation is
     negative, and the static suction head that follows is negative — which
     is exactly the case an NPSH check exists to catch. Refusing it as "a
     length cannot be negative" was wrong: it is not a length, it is a
     position on an axis, and the pump module has always read it that way.

     A GAUGE pressure is measured from atmosphere and goes below it under
     vacuum. Its real floor is a perfect vacuum, −1.01325 bar g, which is a
     better bound than zero rather than a looser one — a gauge reading of
     −2 bar g is genuinely impossible, and now says so.

     Absolute pressures are not in this set: those really do stop at zero.
     The `-a` suffix on the destination and vessel-absolute fields keeps
     them out of it. */
  var SIGNED = [
    { re: /(^|[-_])(el|elev|elevation|grade|datum)([-_]|$)|elevation/i,
      floor: null,                                    /* mirror the upper bound */
      why: 'that is further from the datum than this plant can be',
      types: { 'length-m': 1, 'length-mm': 1 } },
    { re: /press[-_]?g$|[-_]press[-_]g([-_]|$)|gauge[-_]?press/i,
      floor: -1.01325,                                /* a perfect vacuum, in bar g */
      why: 'a gauge pressure cannot read below a perfect vacuum (−1.01325 bar g)',
      types: { 'pressure': 1, 'press-drop': 1 } }
  ];

  function signedRule(base, type, id) {
    for (var i = 0; i < SIGNED.length; i++) {
      var S = SIGNED[i];
      if (!S.re.test(id)) continue;
      if (type && !S.types[type]) continue;
      var lo = (S.floor === null) ? -base.hard[1] : S.floor;
      var tlo = base.typ ? ((S.floor === null) ? -base.typ[1] : S.floor) : null;
      return {
        hard: [lo, base.hard[1]],
        typ: base.typ ? [tlo, base.typ[1]] : null,
        u: base.u,
        why: S.why
      };
    }
    return base;
  }

  function ruleFor(el) {
    if (!el || el.tagName !== 'INPUT') return null;
    if (el.type !== 'number' && el.type !== 'text') return null;
    if (el.readOnly || el.disabled) return null;
    var id = el.id || '';
    if (BY_ID[id]) return { r: BY_ID[id], type: null };
    var t = el.getAttribute('data-unit-type');
    if (t && R[t]) return { r: signedRule(R[t], t, id), type: t };
    /* a pattern rule only applies to a real number box, never to a free text
       field that happens to be named something similar */
    if (el.type !== 'number') return null;
    for (var i = 0; i < BY_PATTERN.length; i++) {
      if (BY_PATTERN[i].re.test(id)) return { r: BY_PATTERN[i].r, type: null };
    }
    return null;
  }

  /* ── Showing a bound in the engineer's units ──────────────────────────── */
  function sys() { return window.activeUnitSystem || 'SI'; }
  function disp(type, si) {
    if (type == null) return si;
    var U = window.UNIT_CONVERSIONS;
    if (!U || !U[type] || typeof U[type].fromSI !== 'function') return si;
    try { return U[type].fromSI(si, sys()); } catch (e) { return si; }
  }
  function symbolOf(type, fallback) {
    if (type == null) return fallback || '';
    var U = window.UNIT_CONVERSIONS;
    if (!U || !U[type] || typeof U[type].symbol !== 'function') return fallback || '';
    try { return U[type].symbol(sys()) || ''; } catch (e) { return fallback || ''; }
  }
  /* A range hint reads badly with fifteen significant figures, and badly
     again if a small bound rounds away to 0. Significant figures, not
     decimal places. */
  function num(v) {
    if (!isFinite(v)) return String(v);
    var a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1e6 || a < 1e-3) return v.toExponential(1).replace('e+', 'e');
    if (a >= 100) return String(Math.round(v));
    if (a >= 1) return String(Math.round(v * 100) / 100);
    return String(Number(v.toPrecision(2)));
  }
  function rangeText(rule) {
    var r = rule.r, t = rule.type;
    var u = symbolOf(t, r.u);
    return num(disp(t, r.hard[0])) + ' – ' + num(disp(t, r.hard[1])) + (u ? ' ' + u : '');
  }
  function typicalText(rule) {
    var r = rule.r, t = rule.type;
    if (!r.typ) return '';
    var u = symbolOf(t, r.u);
    return num(disp(t, r.typ[0])) + ' – ' + num(disp(t, r.typ[1])) + (u ? ' ' + u : '');
  }

  /* Did the engineer put this number here, or is it what the sheet was built
     with? A field nobody has touched is not an entry to be judged. Provenance
     already tracks this and marks the element; the typed flag the overwrite
     guard sets is the same answer from the other direction. */
  function userEntered(el) {
    return !!(el.__aroUserTyped || el.classList.contains('aro-prov-user'));
  }

  /* ── Judging one field ────────────────────────────────────────────────── */
  /* Returns null when there is nothing to say: an empty box is the concern of
     the required-inputs check, not this one. */
  function check(el) {
    var rule = ruleFor(el);
    if (!rule) return null;
    var raw = String(el.value == null ? '' : el.value).trim();
    if (raw === '') return null;
    var shown = parseFloat(raw);
    /* A plain 0 sitting in a field that must be positive means NOT SPECIFIED,
       not "impossible". Measured: the DPHE assumed-U₀ box (aro-dphe-u0-in)
       ships at 0 and is meant to be left there until an engineer overrides
       it, and reading that as a violation blocked every exchanger on the
       tab from calculating at all. Whether a field has been filled in is the
       required-inputs check's question, and it already asks it.
       A 0 the engineer actually typed is judged normally — including 0e34,
       which is the screenshot's entry and reads as zero. */
    if (shown === 0 && rule.r.hard[0] > 0 && !userEntered(el)) return null;
    if (!isFinite(shown)) {
      return { level: 'hard', el: el, rule: rule, value: raw,
               msg: 'This is not a number.', range: rangeText(rule) };
    }
    /* the bounds are in SI, so the entry has to be read the same way */
    var si = shown;
    if (rule.type && window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS[rule.type]) {
      try { si = window.UNIT_CONVERSIONS[rule.type].toSI(shown, sys()); } catch (e) { si = shown; }
    }
    var r = rule.r;
    if (si < r.hard[0] || si > r.hard[1]) {
      return { level: 'hard', el: el, rule: rule, value: raw,
               msg: r.why, range: rangeText(rule) };
    }
    if (r.typ && (si < r.typ[0] || si > r.typ[1])) {
      return { level: 'typical', el: el, rule: rule, value: raw,
               msg: 'outside the usual band', range: typicalText(rule) };
    }
    return null;
  }

  /* ── The hint under the box ───────────────────────────────────────────── */
  var CSSID = 'aro-range-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '.aro-range-hint{font-family:var(--font-mono);font-size:9.5px;line-height:1.35;',
      '  letter-spacing:0.02em;margin-top:3px;color:#64748b;}',
      '.aro-range-hint.warn{color:#d97706;}',
      '.aro-range-hint.bad{color:#ef4444;font-weight:700;}',
      'body.theme-day .aro-range-hint{color:#64748b;}',
      'body.theme-day .aro-range-hint.warn{color:#b45309;}',
      'body.theme-day .aro-range-hint.bad{color:#b91c1c;}',
      'input.aro-range-bad{border-color:#ef4444 !important;box-shadow:0 0 0 1px rgba(239,68,68,0.35) inset;}',
      'input.aro-range-warn{border-color:#d97706 !important;}',
      /* the blocking dialog */
      '#aro-rng{position:fixed;inset:0;z-index:100070;display:flex;align-items:center;',
      '  justify-content:center;padding:20px;background:rgba(2,6,18,0.72);}',
      '#aro-rng .rn-card{background:#0f172a;border:2px solid #ef4444;border-radius:9px;max-width:600px;',
      '  width:100%;padding:20px 22px;box-shadow:0 24px 70px rgba(0,0,0,0.55);font-family:var(--font-mono);',
      '  max-height:80vh;overflow:auto;}',
      '#aro-rng h4{margin:0 0 10px;font-size:13.5px;font-weight:800;color:#ef4444;letter-spacing:0.04em;}',
      '#aro-rng p{font-size:11.5px;color:#cbd5e1;line-height:1.6;margin:0 0 12px;}',
      '#aro-rng ul{list-style:none;padding:0;margin:0 0 14px;}',
      '#aro-rng li{font-size:11px;color:#e2e8f0;padding:8px 10px;margin-bottom:6px;border-radius:4px;',
      '  background:rgba(239,68,68,0.08);border-left:3px solid #ef4444;cursor:pointer;}',
      '#aro-rng li:hover{background:rgba(239,68,68,0.16);}',
      '#aro-rng li b{color:#fbbf24;}',
      '#aro-rng li .rn-r{display:block;color:#94a3b8;margin-top:3px;font-size:10px;}',
      '#aro-rng button{width:100%;font-family:var(--font-mono);font-size:11.5px;font-weight:800;',
      '  padding:11px;border-radius:5px;cursor:pointer;border:1px solid #ef4444;background:transparent;color:#ef4444;}',
      '#aro-rng button:hover{background:rgba(239,68,68,0.12);}',
      'body.theme-day #aro-rng{background:rgba(15,23,42,0.35);}',
      'body.theme-day #aro-rng .rn-card{background:#fff;box-shadow:0 24px 70px rgba(15,23,42,0.28);}',
      'body.theme-day #aro-rng p{color:#334155;}',
      'body.theme-day #aro-rng li{color:#1e293b;background:rgba(239,68,68,0.07);}',
      'body.theme-day #aro-rng li b{color:#b45309;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function hintOf(el, make) {
    var h = el.__aroHint;
    if (h && h.parentNode) return h;
    if (!make) return null;
    h = document.createElement('div');
    h.className = 'aro-range-hint';
    var host = el.closest('.input-with-unit') || el.parentElement;
    /* sit the hint under the whole value+unit group, not inside it, so the
       box and its unit chip keep the width they had */
    var anchor = (host && host.parentElement) ? host.parentElement : el.parentElement;
    if (anchor) anchor.appendChild(h); else return null;
    el.__aroHint = h;
    return h;
  }

  /* Paint one field. `always` keeps the hint on screen (used while the box has
     focus, and whenever something is wrong); otherwise a clean field says
     nothing and the form stays quiet. */
  function paint(el, always) {
    var rule = ruleFor(el);
    if (!rule) return null;
    var v = check(el);
    el.classList.remove('aro-range-bad', 'aro-range-warn');
    var h = hintOf(el, !!(v || always));
    if (!h) return v;
    if (v && v.level === 'hard') {
      el.classList.add('aro-range-bad');
      h.className = 'aro-range-hint bad';
      h.textContent = '✕ ' + v.msg + ' · accepted range ' + v.range;
    } else if (v && v.level === 'typical') {
      el.classList.add('aro-range-warn');
      h.className = 'aro-range-hint warn';
      h.textContent = '⚠ unusual — typical is ' + v.range + ' · this value will still be used';
    } else if (always) {
      h.className = 'aro-range-hint';
      var t = typicalText(rule);
      h.textContent = 'range ' + rangeText(rule) + (t ? ' · typical ' + t : '');
    } else {
      h.textContent = '';
    }
    return v;
  }

  /* The bounds are recorded on the element and shown on hover, expressed in
     the DISPLAYED unit and rewritten when the unit system changes.

     They are deliberately NOT written to min/max. The browser enforces those
     itself, bluntly and silently: with min="0.000001" on the DPHE assumed-U₀
     box — which ships at 0 meaning "not specified" — clicking RUN did
     nothing at all, because native constraint validation refused the form
     submit and said so nowhere the engineer could see. Measured:

         formValid false · aro-dphe-u0-in = 0
         "Value must be greater than or equal to 0.000001."

     The check in this file knows that a plain 0 means unfilled and a typed
     0e34 does not. The browser cannot know the difference, so it is kept out
     of the decision and the refusal is made here, with a reason attached. */
  function stamp(el) {
    var rule = ruleFor(el);
    if (!rule) return;
    if (el.type !== 'number') return;
    var lo = disp(rule.type, rule.r.hard[0]), hi = disp(rule.type, rule.r.hard[1]);
    if (isFinite(lo)) el.setAttribute('data-aro-min', String(lo));
    if (isFinite(hi)) el.setAttribute('data-aro-max', String(hi));
    var t = typicalText(rule);
    el.title = 'Accepted range ' + rangeText(rule) + (t ? '\nTypical ' + t : '');
  }

  function fields(scope) {
    var out = [];
    var list = (scope || document).querySelectorAll('input');
    for (var i = 0; i < list.length; i++) if (ruleFor(list[i])) out.push(list[i]);
    return out;
  }

  function stampAll(scope) {
    var f = fields(scope);
    for (var i = 0; i < f.length; i++) stamp(f[i]);
    return f.length;
  }

  /* ── Blocking a run that rests on an impossible number ────────────────── */
  function offenders(scope) {
    var bad = [];
    var f = fields(scope);
    for (var i = 0; i < f.length; i++) {
      if (!f[i].offsetParent) continue;              /* not on screen — not this module's */
      var v = check(f[i]);
      if (v && v.level === 'hard') { paint(f[i], true); bad.push(v); }
    }
    return bad;
  }

  function labelOf(el) {
    var l = el.id ? document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]') : null;
    if (l) return (l.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s*AUTO\s*$/, '');
    var c = el.closest('.input-cell,.input-group,.form-row');
    var s = c ? c.querySelector('label') : null;
    if (s) return (s.textContent || '').replace(/\s+/g, ' ').trim();
    return el.id || 'this field';
  }

  function goTo(el) {
    if (!el) return;
    var d = el.closest('details');
    if (d && !d.open) d.open = true;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    setTimeout(function () { try { el.focus({ preventScroll: true }); el.select && el.select(); } catch (e) {} }, 220);
  }

  function refuse(bad) {
    css();
    var old = document.getElementById('aro-rng'); if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'aro-rng';
    var items = bad.map(function (v, i) {
      return '<li data-i="' + i + '"><b>' + labelOf(v.el) + '</b> = ' + v.value
        + ' — ' + v.msg
        + '<span class="rn-r">accepted range ' + v.range + ' · click to go there</span></li>';
    }).join('');
    m.innerHTML = '<div class="rn-card">'
      + '<h4>&#10005; THIS CANNOT BE CALCULATED</h4>'
      + '<p>' + (bad.length === 1 ? 'One entry is' : bad.length + ' entries are')
      + ' outside what the physics allows, so the design has not been run. '
      + 'Nothing has been changed — the values are exactly as you typed them.</p>'
      + '<ul>' + items + '</ul>'
      + '<button type="button">CLOSE AND FIX IT</button>'
      + '</div>';
    document.body.appendChild(m);
    var close = function () { if (m.parentNode) m.remove(); };
    m.querySelector('button').onclick = function () { close(); setTimeout(function () { goTo(bad[0].el); }, 60); };
    Array.prototype.forEach.call(m.querySelectorAll('li'), function (li) {
      li.onclick = function () { var i = +li.getAttribute('data-i'); close(); setTimeout(function () { goTo(bad[i].el); }, 60); };
    });
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
  }

  /* The run is stopped ONLY when something is actually impossible. On a clean
     sheet nothing is intercepted at all — the click reaches the module as the
     trusted gesture it was, which the calculation state machine requires to
     count the run. Swallowing every click and replaying it would break that. */
  function guardRun(e) {
    /* narrowest sheet first: the form, then the sub-panel a module occupies,
       and only then the tab — so one module's sheet never speaks for another's */
    var t = e.target && e.target.closest ? e.target : null;
    var scope = (t && (t.closest('form') || t.closest('[id$="-sub"]') || t.closest('.tab-content,[id$="-tab"]'))) || document;
    var bad = offenders(scope);
    if (!bad.length) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    refuse(bad);
  }

  var RUN_RE = /RUN\s|RUN$|CALCULAT|SIZE\s+THE|^SIZE$/i;
  /* Both nets are needed and neither is redundant. Measured: clicking RUN
     PUMP CALCULATION — a button[type=submit] inside #pump-form — fires no
     submit event at all, because the module handles the click itself and
     never lets the form submit. Deferring submit-type buttons to the submit
     listener meant the run went through unchecked. The click net therefore
     covers submit buttons too; the submit net stays for a form sent with
     Enter, where there is no button click to see. */
  document.addEventListener('submit', guardRun, true);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    if (b.closest('#aro-rng,#aro-rg,#aro-ovr,[id$="-reqinput-modal"],#aro-mod')) return;
    var txt = (b.textContent || '').replace(/\s+/g, ' ').trim();
    if (b.type !== 'submit' && !RUN_RE.test(txt)) return;
    if (document.getElementById('aro-rng')) return;   /* already refused */
    guardRun(e);
  }, true);

  /* ── The live preview must not publish an impossible design either ─────
     Blocking RUN alone was not enough, and the measurement said so: with
     034566446654545645 in the density box the RUN was refused, and the
     results panel still read 183,112,294,507,801.84 kW. The modules
     recalculate as you type, so the absurd figure had already been written
     before RUN was ever pressed.

     Each module's published calculation is wrapped rather than edited. The
     wrapper only ever declines to call the original — it changes no formula,
     no input and no output — so a sheet with nothing wrong behaves exactly
     as it did. Declining leaves the previous results standing, which is the
     honest state: the last figures that came from numbers that were real. */
  /* Scoped to each module's OWN sheet, never to the tab it shares. The three
     exchangers live together under #sthe-tab, and scoping there meant a
     figure on the DPHE sheet stopped the STHE from calculating — measured:
     a single DPHE field blocked every exchanger on the tab. */
  var ENTRIES = [
    ['runActualPumpCalculations',    '#pump-form'],
    ['executePumpCalculations',      '#pump-form'],
    ['runActualLineCalculations',    '#line-tab'],
    ['runActualGasCalculations',     '#line-tab'],
    ['runActualSteamCalculations',   '#line-tab'],
    ['runActualSlurryCalculations',  '#line-tab'],
    ['runActualTwoPhaseCalculations', '#line-tab'],
    ['executeLineCalculations',      '#line-tab'],
    ['calculateSTHE',                '#sthe-form']
  ];
  function hardIn(sel) {
    var scope = document.querySelector(sel);
    if (!scope) return false;
    var f = fields(scope);
    for (var i = 0; i < f.length; i++) {
      if (!f[i].offsetParent) continue;
      var v = check(f[i]);
      if (v && v.level === 'hard') return true;
    }
    return false;
  }
  function wrapEntries() {
    for (var i = 0; i < ENTRIES.length; i++) {
      (function (name, sel) {
        var fn = window[name];
        if (typeof fn !== 'function' || fn.__aroRangeWrapped) return;
        var w = function () {
          try { if (hardIn(sel)) return; } catch (e) {}
          return fn.apply(this, arguments);
        };
        w.__aroRangeWrapped = true;
        try { window[name] = w; } catch (e) {}
      })(ENTRIES[i][0], ENTRIES[i][1]);
    }
  }

  /* ── Live feedback while typing ───────────────────────────────────────── */
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT') return;
    if (!ruleFor(el)) return;
    paint(el, document.activeElement === el);
  }, true);
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el && el.tagName === 'INPUT' && ruleFor(el)) paint(el, true);
  }, true);
  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (el && el.tagName === 'INPUT' && ruleFor(el)) paint(el, false);
  }, true);

  /* Bounds are shown in the active system, so they are restamped when it
     changes — otherwise a US sheet would carry SI numbers in its hints. */
  function onUnitChange() {
    setTimeout(function () {
      stampAll(document);
      var f = fields(document);
      for (var i = 0; i < f.length; i++) if (f[i].__aroHint) paint(f[i], document.activeElement === f[i]);
    }, 120);
  }
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'global-unit-system') onUnitChange();
  }, true);

  function boot() {
    css();
    stampAll(document);
    wrapEntries();
    /* modules build their sheets late; restamp as the page settles rather
       than watching every mutation for the life of the session */
    [400, 1200, 3000, 6000].forEach(function (t) {
      setTimeout(function () { stampAll(document); wrapEntries(); }, t);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.ARORANGE = {
    check: check, ruleFor: ruleFor, offenders: offenders, stampAll: stampAll,
    paint: paint, rangeText: rangeText, typicalText: typicalText, fields: fields,
    hardIn: hardIn, wrapEntries: wrapEntries,
    RULES: R, BY_ID: BY_ID
  };
})();

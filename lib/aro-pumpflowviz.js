/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Internal Flow Visualization (schematic — NOT CFD)
   window.AROPUMPFLOWVIZ

   Phase 17 of the Pump Hydraulics Advanced Upgrade.

   THIS IS NOT A CFD RESULT. No flow field is solved here. This engine
   only threads together velocities the app has ALREADY calculated at
   six named stations along the wetted path (suction nozzle -> impeller
   eye -> impeller exit, relative and absolute -> volute throat ->
   discharge nozzle) and normalizes them onto a common 0-1 intensity
   scale for a directional, illustrative diagram — exactly the same
   "show what's already known, plainly" spirit as every other panel in
   this suite, just drawn as a flow path instead of a table.

   Split the usual way:
     1. buildFlowStations(...) / colorForIntensity(...) — pure, no DOM,
        no canvas. Unit-testable in Node.
     2. Viewer — a thin 2D <canvas> renderer (no WebGL needed for this
        one), browser-only, verified visually like the rest of the app's
        graphics.

   The only NEW arithmetic here is two standard vector/continuity
   relations that no other phase already exports:
     - impeller eye meridional velocity  Cm1 = Q / (pi/4 * D1^2)
       (the same Q = V*A continuity used inline for nozzle sizing
       elsewhere in this app — restated locally because no phase
       exports an "eye velocity" function to call instead)
     - impeller exit absolute velocity magnitude
       |C2| = sqrt(Cu2^2 + Cm2^2)   (Pythagorean combination of the two
       exit velocity COMPONENTS Phase 4 already computed — not a new
       physical model)
   Every other station's velocity is read verbatim from an existing
   phase's result object.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var G_UNUSED = null; // no gravity/energy terms needed here — velocities only

  function eyeVelocity_ms(Q_m3h, D1_m) {
    if (!isFinite(Q_m3h) || Q_m3h <= 0 || !isFinite(D1_m) || D1_m <= 0) return NaN;
    var A1_m2 = (Math.PI / 4) * D1_m * D1_m;
    return (Q_m3h / 3600) / A1_m2;
  }

  /* input = { Q_m3h, vs_ms, vd_ms, D1_m, eulerResult, casingResult } —
     eulerResult is Phase 4's AROPUMPIMPELLER.eulerHead() output,
     casingResult is Phase 5's AROPUMPCASING.screenCasing() output, both
     passed through verbatim exactly as app.js already holds them. */
  function buildFlowStations(input) {
    input = input || {};
    var eu = input.eulerResult, ca = input.casingResult;

    if (!isFinite(input.vs_ms) || !isFinite(input.vd_ms) || !eu || !eu.applicable) {
      return { applicable: false, status: 'DATA REQUIRED',
        reason: 'Suction/discharge velocities and the impeller classification (Phase 4) all have to be known first — run the pump hydraulic calculation.' };
    }

    var Cm1 = eyeVelocity_ms(input.Q_m3h, input.D1_m);
    var absExit2 = Math.sqrt(eu.Cu2_ms * eu.Cu2_ms + eu.Cm2_ms * eu.Cm2_ms);

    var stations = [
      { id: 'suction-nozzle', label: 'Suction Nozzle', velocity_ms: input.vs_ms,
        note: 'Suction line velocity from nozzle sizing (section 09).' },
      { id: 'impeller-eye', label: 'Impeller Eye', velocity_ms: Cm1,
        note: isFinite(Cm1) ? 'Meridional velocity at the eye, Cm1 = Q / A_eye, from the eye diameter Phase 4/5 already fixed.' : 'Eye diameter not available yet.' },
      { id: 'impeller-exit-relative', label: 'Impeller Exit (relative, W2)', velocity_ms: eu.W2_ms,
        note: 'Relative velocity leaving the vane tip, in the rotating frame — Phase 4\'s exit velocity triangle.' },
      { id: 'impeller-exit-absolute', label: 'Impeller Exit (absolute, |C2|)', velocity_ms: absExit2,
        note: '|C2| = sqrt(Cu2^2 + Cm2^2), the fixed-frame exit velocity Phase 4\'s triangle closes to.' },
      { id: 'volute-throat', label: 'Volute Throat', velocity_ms: (ca && ca.applicable) ? ca.volute.Vth_ms : NaN,
        note: (ca && ca.applicable) ? 'Volute throat velocity from Phase 5\'s casing screening.' : 'Not applicable — no casing was screened for this configuration (Phase 5).' },
      { id: 'discharge-nozzle', label: 'Discharge Nozzle', velocity_ms: input.vd_ms,
        note: 'Discharge line velocity from nozzle sizing (section 09).' },
    ];

    var known = stations.filter(function (s) { return isFinite(s.velocity_ms) && s.velocity_ms > 0; });
    var vMax = known.reduce(function (m, s) { return Math.max(m, s.velocity_ms); }, 0);
    var vMin = known.reduce(function (m, s) { return Math.min(m, s.velocity_ms); }, Infinity);
    var span = (vMax > vMin) ? (vMax - vMin) : 1;

    stations.forEach(function (s) {
      s.known = isFinite(s.velocity_ms) && s.velocity_ms > 0;
      s.intensity = s.known ? Math.max(0, Math.min(1, (s.velocity_ms - vMin) / span)) : null;
    });

    return { applicable: true, status: 'CALCULATED', stations: stations, vMax_ms: vMax, vMin_ms: (vMin === Infinity ? NaN : vMin) };
  }

  /* Blue (slow) -> amber (mid) -> red (fast), same three-stop gradient
     idea used nowhere else in this app but kept dependency-free. */
  function colorForIntensity(t) {
    if (t == null || !isFinite(t)) return '#64748b';
    t = Math.max(0, Math.min(1, t));
    var stops = [
      { t: 0.0, c: [56, 189, 248] },   // #38bdf8
      { t: 0.5, c: [245, 158, 11] },   // #f59e0b
      { t: 1.0, c: [239, 68, 68] },    // #ef4444
    ];
    var a = stops[0], b = stops[1];
    if (t > 0.5) { a = stops[1]; b = stops[2]; }
    var localT = (t - a.t) / (b.t - a.t);
    var r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * localT);
    var g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * localT);
    var bl = Math.round(a.c[2] + (b.c[2] - a.c[2]) * localT);
    return '#' + [r, g, bl].map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }

  var AROPUMPFLOWVIZ = { eyeVelocity_ms: eyeVelocity_ms, buildFlowStations: buildFlowStations, colorForIntensity: colorForIntensity };

  /* ── Viewer: plain 2D canvas — no WebGL needed for a flow-path diagram ── */
  if (typeof document !== 'undefined') {
    function Viewer(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this._raf = null;
      this._t = 0;
      this._stations = [];
    }

    Viewer.prototype.setStations = function (stations) {
      this._stations = stations || [];
      this._draw();
    };

    Viewer.prototype._draw = function () {
      var canvas = this.canvas, ctx = this.ctx;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var stations = this._stations;
      if (!stations.length) return;

      var padX = 46, padY = 36;
      var usableW = canvas.width - padX * 2;
      var midY = canvas.height / 2 - 6;
      var n = stations.length;
      var xs = stations.map(function (_, i) { return padX + (usableW * i) / (n - 1); });

      // path segments, thickness/color by the segment's leading station intensity
      for (var i = 0; i < n - 1; i++) {
        var s = stations[i];
        var col = (typeof window !== 'undefined' && window.AROPUMPFLOWVIZ) ? window.AROPUMPFLOWVIZ.colorForIntensity(s.intensity) : '#64748b';
        ctx.strokeStyle = col;
        ctx.lineWidth = s.known ? (2 + s.intensity * 8) : 1.5;
        if (!s.known) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(xs[i], midY);
        ctx.lineTo(xs[i + 1], midY);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // moving dots per segment, speed hinting relative velocity
      for (var j = 0; j < n - 1; j++) {
        var sj = stations[j];
        if (!sj.known) continue;
        var speed = 0.15 + sj.intensity * 0.65;
        var phase = (this._t * speed + j * 0.31) % 1;
        var dx = xs[j] + (xs[j + 1] - xs[j]) * phase;
        ctx.beginPath();
        ctx.fillStyle = window.AROPUMPFLOWVIZ.colorForIntensity(sj.intensity);
        ctx.arc(dx, midY, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // station markers + labels
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      stations.forEach(function (s, i) {
        var col = window.AROPUMPFLOWVIZ.colorForIntensity(s.intensity);
        ctx.beginPath();
        ctx.fillStyle = s.known ? col : '#334155';
        ctx.arc(xs[i], midY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        var label = s.label.length > 16 ? s.label.replace(' (', '\n(') : s.label;
        label.split('\n').forEach(function (line, li) {
          ctx.fillText(line, xs[i], midY + 20 + li * 10);
        });
        ctx.fillStyle = s.known ? '#e2e8f0' : '#64748b';
        ctx.fillText(s.known ? s.velocity_ms.toFixed(2) + ' m/s' : 'n/a', xs[i], midY - 12);
      });
    };

    Viewer.prototype.start = function () {
      var self = this;
      function tick() {
        self._t += 0.016;
        self._draw();
        self._raf = requestAnimationFrame(tick);
      }
      if (!this._raf) tick();
    };

    Viewer.prototype.dispose = function () {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    };

    AROPUMPFLOWVIZ.Viewer = Viewer;
  }

  window.AROPUMPFLOWVIZ = AROPUMPFLOWVIZ;
})();

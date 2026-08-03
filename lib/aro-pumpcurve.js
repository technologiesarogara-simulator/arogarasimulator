/* ══════════════════════════════════════════════════════════════════════
   AROGARA — PUMP CURVE MODEL  (window.AROPUMPCURVE)

   Until now the panel took NPSHr and efficiency as numbers the engineer
   typed and had no curve behind them, so it could size a duty but never
   say where on a pump that duty sat. This models the machine:

     · NPSHr from the suction specific speed the pump is built to,
       NPSHr = ( N·√Q / Nss )^(4/3), the standard inversion of the Nss
       definition used for screening before a vendor curve exists;
     · attainable efficiency at best efficiency point from the Hydraulic
       Institute attainable-efficiency data — flow sets the level and
       specific speed applies the penalty away from the 2000–3000 band;
     · head, efficiency, NPSHr and power against flow as dimensionless
       curves anchored at that BEP, with the shut-off rise taken from
       specific speed as API 610 cl. 6.1.11 expects it to be checked;
     · the operating point as the intersection with the system curve.

   EVERY NUMBER HERE IS A PREDICTION, not a rating. It exists so a duty
   can be placed on a curve and checked against the preferred operating
   region before an enquiry goes out. A vendor curve replaces it, and the
   panel says so wherever one of these figures is used.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var M3H_TO_GPM = 4.402868, M_TO_FT = 3.280840;

  /* ── NPSHr from suction specific speed ───────────────────────────────
     Nss = N·√Q / NPSHr^0.75 (rpm, gpm, ft) inverts to the expression
     below. A conventional single-suction process pump is built around
     Nss ≈ 9000; API 610 treats 11 000 as the ceiling worth reviewing, and
     a conservatively designed eye sits nearer 7000-8500. */
  function npshrPredict(N_rpm, Q_m3h, Nss, doubleSuction) {
    var Qg = Q_m3h * M3H_TO_GPM / (doubleSuction ? 2 : 1);
    var S = Nss > 0 ? Nss : 9000;
    if (!(N_rpm > 0) || !(Qg > 0)) return NaN;
    var ft = Math.pow(N_rpm * Math.sqrt(Qg) / S, 4 / 3);
    return ft / M_TO_FT;                                  // metres
  }

  /* ── attainable efficiency at BEP ────────────────────────────────────
     Level from flow, after the Hydraulic Institute attainable-efficiency
     data for single-stage centrifugal pumps; then a specific-speed
     penalty, because a very low Ns impeller is narrow and leaks, and a
     very high Ns one gives up efficiency to axial flow. */
  var EFF_Q = [   25,  50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000 ];  // US gpm
  var EFF_E = [   38,  46,  56,  65,  74,   79,   83,   86,    88,    89 ];  // per cent

  function attainableEfficiency(Q_m3h, Ns_us) {
    var Qg = Q_m3h * M3H_TO_GPM;
    if (!(Qg > 0)) return NaN;
    var e;
    if (Qg <= EFF_Q[0]) e = EFF_E[0];
    else if (Qg >= EFF_Q[EFF_Q.length - 1]) e = EFF_E[EFF_E.length - 1];
    else {
      for (var i = 0; i < EFF_Q.length - 1; i++) {
        if (Qg >= EFF_Q[i] && Qg <= EFF_Q[i + 1]) {
          /* interpolate on log flow — the data is a straight line there */
          var t = (Math.log(Qg) - Math.log(EFF_Q[i])) / (Math.log(EFF_Q[i + 1]) - Math.log(EFF_Q[i]));
          e = EFF_E[i] + t * (EFF_E[i + 1] - EFF_E[i]);
          break;
        }
      }
    }
    /* Specific-speed penalty, zero across the 2000-3000 plateau. */
    var pen = 0;
    if (isFinite(Ns_us) && Ns_us > 0) {
      if (Ns_us < 2000) pen = 9 * Math.pow((2000 - Ns_us) / 2000, 1.4);
      else if (Ns_us > 3000) pen = 6 * Math.pow((Ns_us - 3000) / 7000, 1.1);
    }
    return Math.max(20, Math.min(92, e - pen));
  }

  /* ── shut-off head rise ──────────────────────────────────────────────
     API 610 cl. 6.1.11 wants a curve that rises continuously to shut-off,
     and normally by 5-20 %. A low specific-speed radial impeller gives
     the flatter curve; a mixed-flow one is steeper. */
  function shutoffRatio(Ns_us) {
    if (!isFinite(Ns_us) || Ns_us <= 0) return 1.15;
    if (Ns_us < 1000) return 1.12;
    if (Ns_us < 2500) return 1.18;
    if (Ns_us < 4500) return 1.26;
    return 1.40;
  }

  /* ── the curves ──────────────────────────────────────────────────────
     Dimensionless in x = Q/Q_bep, anchored on the predicted BEP.
       head        quadratic through (0, shut-off) and (1, 1), falling
       efficiency  parabola peaking at x = 1
       NPSHr       rises with flow, roughly with the square
       power       ρgQH/η, computed rather than fitted                    */
  function make(opts) {
    var Qb = opts.Qbep, Hb = opts.Hbep, Eb = opts.etaBep, Nb = opts.npshrBep;
    var so = shutoffRatio(opts.Ns);
    /* H/Hb = so + b·x + c·x², with H(1) = 1 and dH/dx < 0 throughout. */
    var c = -(so - 1) * 0.65, b = (1 - so) - c;

    function head(Q) {
      var x = Qb > 0 ? Q / Qb : 0;
      return Hb * (so + b * x + c * x * x);
    }
    function eff(Q) {
      var x = Qb > 0 ? Q / Qb : 0;
      if (x <= 0) return 0;
      var f = 2 * x - x * x;                      // 0 at x=0, 1 at x=1
      return Math.max(0, Eb * Math.max(0, f));
    }
    function npshr(Q) {
      var x = Qb > 0 ? Q / Qb : 0;
      return Nb * (0.30 + 0.70 * x * x);
    }
    function power(Q, rho) {
      var e = eff(Q);
      if (!(e > 0)) return NaN;
      return (rho * 9.81 * (Q / 3600) * head(Q)) / 1000 / (e / 100);
    }
    return { head: head, eff: eff, npshr: npshr, power: power,
             Qbep: Qb, Hbep: Hb, etaBep: Eb, npshrBep: Nb, shutoff: so, Ns: opts.Ns };
  }

  /* ── system curve and the operating point ────────────────────────────
     H_sys = H_static + k·Q². The duty the engineer entered is one point
     on it, so k follows from that point. The operating point is where the
     two curves cross, found by bisection. */
  function systemCurve(Hstatic, Qduty, Hduty) {
    var k = (Qduty > 0) ? (Hduty - Hstatic) / (Qduty * Qduty) : 0;
    return { Hstatic: Hstatic, k: k, head: function (Q) { return Hstatic + k * Q * Q; } };
  }

  function operatingPoint(pump, sys) {
    var lo = 1e-6, hi = pump.Qbep * 2.2;
    var f = function (Q) { return pump.head(Q) - sys.head(Q); };
    if (f(lo) < 0) return null;                       // system above shut-off
    if (f(hi) > 0) hi = pump.Qbep * 4;
    if (f(hi) > 0) return null;
    for (var i = 0; i < 90; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    var Q = (lo + hi) / 2;
    return { Q: Q, H: pump.head(Q), eff: pump.eff(Q), npshr: pump.npshr(Q),
             pctBep: pump.Qbep > 0 ? (Q / pump.Qbep) * 100 : NaN };
  }

  /* API 610 cl. 6.1.11 preferred and allowable operating regions. */
  function region(pctBep) {
    if (!isFinite(pctBep)) return { name: '—', ok: true };
    if (pctBep >= 70 && pctBep <= 120) return { name: 'preferred operating region (70–120 % of BEP)', ok: true };
    if (pctBep >= 50 && pctBep <= 130) return { name: 'allowable but outside the preferred region', ok: false };
    return { name: 'outside the allowable operating region', ok: false };
  }

  window.AROPUMPCURVE = {
    npshrPredict: npshrPredict,
    attainableEfficiency: attainableEfficiency,
    shutoffRatio: shutoffRatio,
    make: make, systemCurve: systemCurve, operatingPoint: operatingPoint, region: region,
    M3H_TO_GPM: M3H_TO_GPM, M_TO_FT: M_TO_FT
  };
})();

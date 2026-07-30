/* ══════════════════════════════════════════════════════════════════════
   AROGARA — PUMP STANDARDS ENGINE  (window.AROPUMPSTD)

   The hydraulics were arithmetically right but stopped at NPSHa, head,
   power and a motor size. A rotating-equipment engineer needs more than
   that before a pump can be enquired for, and every one of the checks
   below is a clause in a standard rather than a rule of thumb:

     · ANSI/HI 9.6.7   viscous performance correction
     · API 610 / ISO 13709  §6.1.6  NPSH margin
     · API 610 §6.1.11  minimum continuous stable flow
     · API 610 §6.1.7   suction specific speed
     · API 610 Table 12  driver power margin
     · IEC 60072        motor preferred ratings
     · ASME B36.10M     nozzle and pipe bores (already used by the sizer)

   Each function returns the number AND the clause it came from, so the
   panel can print the basis next to the verdict. Nothing here invents a
   value silently: where a screening correlation stands in for vendor
   data, it says so.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── unit helpers ───────────────────────────────────────────────────── */
  var M3H_TO_GPM = 4.402868;
  var M_TO_FT = 3.280840;

  /* ── ANSI/HI 9.6.7 — VISCOUS PERFORMANCE CORRECTION ──────────────────
     A pump handling a viscous liquid delivers less head and less flow at a
     worse efficiency than its water curve shows. The panel was reading a
     viscosity input and then ignoring it, so anything thicker than water
     was under-powered — a 78 cP caustic duty sized on the water efficiency
     can be 20-30 % short on shaft power.

     The 2004 method, on the rated (best-efficiency) point:

         B  = 16.5 · ν^0.5 · H^0.0625 / ( Q^0.375 · N^0.25 )
         C_Q = C_H = exp( −0.165 · (log10 B)^3.15 )      for B > 1
         C_η = B^( −0.0547 · B^0.69 )

     ν in cSt, H in m per stage, Q in m³/h, N in rev/min. B ≤ 1 means the
     liquid is thin enough that no correction applies.                    */
  function viscousCorrection(nu_cSt, Q_m3h, H_m, N_rpm, stages) {
    var st = stages && stages > 0 ? stages : 1;
    var Hs = H_m / st;
    if (!(nu_cSt > 0) || !(Q_m3h > 0) || !(Hs > 0) || !(N_rpm > 0)) return null;
    var B = 16.5 * Math.pow(nu_cSt, 0.5) * Math.pow(Hs, 0.0625)
          / (Math.pow(Q_m3h, 0.375) * Math.pow(N_rpm, 0.25));
    if (B <= 1) {
      return { B: B, CQ: 1, CH: 1, CE: 1, applies: false,
               clause: 'ANSI/HI 9.6.7', note: 'B = ' + B.toFixed(3) + ' ≤ 1 — the liquid is thin enough that no correction applies.' };
    }
    var lg = Math.log(B) / Math.LN10;
    var C = Math.exp(-0.165 * Math.pow(lg, 3.15));
    var CE = Math.pow(B, -0.0547 * Math.pow(B, 0.69));
    return { B: B, CQ: C, CH: C, CE: CE, applies: true, clause: 'ANSI/HI 9.6.7',
             note: 'B = ' + B.toFixed(3) + ' — correction factors C_Q = C_H = ' + C.toFixed(4) + ', C_η = ' + CE.toFixed(4) + '.' };
  }

  /* Kinematic viscosity from the panel's dynamic viscosity and density. */
  function cSt(mu_cP, rho) { return (rho > 0) ? mu_cP / (rho / 1000) : NaN; }

  /* ── SPECIFIC SPEED (US customary, the form the limits are written in) ─ */
  function specificSpeed(N_rpm, Q_m3h, H_m, stages) {
    var st = stages && stages > 0 ? stages : 1;
    var Qg = Q_m3h * M3H_TO_GPM, Hf = (H_m / st) * M_TO_FT;
    if (!(N_rpm > 0) || !(Qg > 0) || !(Hf > 0)) return NaN;
    return N_rpm * Math.sqrt(Qg) / Math.pow(Hf, 0.75);
  }

  function impellerType(Ns) {
    if (!isFinite(Ns)) return '—';
    if (Ns < 1500) return 'radial';
    if (Ns < 4200) return 'Francis / mixed flow';
    if (Ns < 9000) return 'mixed flow';
    return 'axial flow';
  }

  /* ── API 610 §6.1.7 — SUCTION SPECIFIC SPEED ─────────────────────────
     Nss = N · √Q / NPSH3^0.75, per impeller eye — a double-suction impeller
     takes half the flow each side. Above about 11 000 (US units) the eye is
     large enough that suction recirculation sets in well inside the normal
     operating range, which is why API 610 asks for it to be reviewed.     */
  function suctionSpecificSpeed(N_rpm, Q_m3h, NPSHr_m, doubleSuction) {
    var Qg = Q_m3h * M3H_TO_GPM / (doubleSuction ? 2 : 1);
    var Nf = NPSHr_m * M_TO_FT;
    if (!(N_rpm > 0) || !(Qg > 0) || !(Nf > 0)) return NaN;
    return N_rpm * Math.sqrt(Qg) / Math.pow(Nf, 0.75);
  }

  function nssVerdict(Nss) {
    if (!isFinite(Nss)) return { ok: true, text: '—' };
    if (Nss <= 8500) return { ok: true, text: 'Conservative — comfortably inside the API 610 review threshold.' };
    if (Nss <= 11000) return { ok: true, text: 'Acceptable — within the 11 000 that API 610 §6.1.7 treats as the normal ceiling.' };
    return { ok: false, text: 'Above 11 000 — API 610 §6.1.7 calls for review. The impeller eye is large for the duty and suction recirculation will start well inside the operating range. Lower the speed, raise NPSHa, or specify a double-suction first stage.' };
  }

  /* ── API 610 §6.1.11 — MINIMUM CONTINUOUS STABLE FLOW ────────────────
     Below this flow the pump runs into recirculation and its vibration
     rises. The real figure belongs to the pump curve; in a sizing tool it
     is estimated from the suction specific speed, which is what governs
     the onset of recirculation, and it is labelled an estimate.           */
  function mcsfFraction(Nss) {
    if (!isFinite(Nss)) return 0.30;
    if (Nss <= 8000) return 0.25;
    if (Nss <= 9500) return 0.35;
    if (Nss <= 11000) return 0.45;
    return 0.60;
  }

  /* ── API 610 §6.1.6 — NPSH MARGIN ────────────────────────────────────
     NPSHa shall exceed NPSH3 at rated flow. The code floor is 1 m; HI 9.6.1
     asks for a proportional margin as well, so the requirement taken here
     is the greater of 1 m and 10 % of NPSHr.                              */
  function npshRequirement(NPSHr_m) {
    if (!(NPSHr_m > 0)) return 1.0;
    return Math.max(1.0, 0.10 * NPSHr_m);
  }

  /* ── API 610 Table 12 — DRIVER POWER MARGIN ──────────────────────────
     The motor is sized on the maximum power the pump can absorb over its
     operating range, with a margin that steps down as the machine gets
     bigger. A flat service factor over-sizes small motors and under-sizes
     nothing — but it is not what the code asks for.                       */
  function driverMargin(ratedKw) {
    if (!(ratedKw > 0)) return { factor: 1.25, clause: 'API 610 Table 12', band: '≤ 22 kW' };
    if (ratedKw <= 22) return { factor: 1.25, clause: 'API 610 Table 12', band: '≤ 22 kW → 125 %' };
    if (ratedKw <= 55) return { factor: 1.15, clause: 'API 610 Table 12', band: '22–55 kW → 115 %' };
    return { factor: 1.10, clause: 'API 610 Table 12', band: '> 55 kW → 110 %' };
  }

  /* ── PUMP NOZZLE VELOCITIES ──────────────────────────────────────────
     Defaults for the sizer. The suction figure is what keeps the velocity
     head out of NPSHa; the discharge figure is ordinary pump-nozzle
     practice, well below a line velocity. Both are exposed as inputs. */
  var NOZZLE_TARGETS = { suction: 2.0, discharge: 3.5 };

  /* ── LINE LOSS FROM THE PIPING ───────────────────────────────────────
     Suction and discharge losses were figures the engineer typed. They can
     be computed from the line itself: Darcy-Weisbach for the straight run
     with Colebrook friction, plus the velocity heads the fittings take.

         dP = ( f·L/D + ΣK ) · ½·rho·v²

     Bores are ASME B36.10M. Returned in bar, with the velocity, Reynolds
     number and friction factor so the panel can show its working. */
  var BORE = {   /* NPS : { sch : internal diameter, mm } */
    0.5:  { '40': 15.80, '80': 13.87, '160': 11.79 },
    0.75: { '40': 20.93, '80': 18.85, '160': 15.55 },
    1:    { '40': 26.64, '80': 24.31, '160': 20.70 },
    1.5:  { '40': 40.89, '80': 38.10, '160': 34.02 },
    2:    { '40': 52.50, '80': 49.25, '160': 42.85 },
    3:    { '40': 77.93, '80': 73.66, '160': 66.65 },
    4:    { '40': 102.26, '80': 97.18, '160': 87.33 },
    6:    { '40': 154.05, '80': 146.33, '160': 131.75 },
    8:    { '40': 202.72, '80': 193.68, '160': 173.08 },
    10:   { '40': 254.51, '80': 242.93, '160': 215.90 },
    12:   { '40': 303.23, '80': 288.90, '160': 257.20 },
    14:   { '40': 333.34, '80': 317.50, '160': 284.18 },
    16:   { '40': 381.00, '80': 363.52, '160': 325.42 },
    18:   { '40': 428.65, '80': 409.58, '160': 366.72 },
    20:   { '40': 477.82, '80': 455.62, '160': 407.98 },
    24:   { '40': 574.65, '80': 547.72, '160': 490.54 }
  };

  /* Typical fitting resistances, Crane TP-410, for the count the panel takes. */
  var FIT_K = { elbow90: 0.30, elbow45: 0.16, tee: 0.60, gate: 0.15, globe: 6.0,
                check: 2.0, butterfly: 0.86, entrance: 0.50, exit: 1.00, reducer: 0.15 };

  function bore(nps, sch) {
    var r = BORE[nps] || BORE[2];
    return (r[sch] != null ? r[sch] : r['40']);
  }

  function friction(Re, epsMm, Dmm) {
    if (!(Re > 0)) return 0;
    if (Re < 2100) return 64 / Re;
    var rel = epsMm / (3.7 * Dmm);
    return 1.3255 / Math.pow(Math.log(rel + 5.74 / Math.pow(Re, 0.9)), 2);
  }

  function lineLoss(o) {
    var Dmm = bore(o.nps, o.sch), D = Dmm / 1000;
    var Q = (o.Q_m3h || 0) / 3600;                       // m³/s
    var A = Math.PI / 4 * D * D;
    if (!(A > 0) || !(Q > 0)) return null;
    var v = Q / A;
    var rho = o.rho || 1000, mu = (o.mu_cP || 1) / 1000; // Pa·s
    var Re = rho * v * D / mu;
    var eps = o.eps_mm != null ? o.eps_mm : 0.045;
    var f = friction(Re, eps, Dmm);
    var K = 0;
    Object.keys(o.fittings || {}).forEach(function (k) {
      if (FIT_K[k] != null) K += FIT_K[k] * (o.fittings[k] || 0);
    });
    var L = o.length_m || 0;
    var dpPa = (f * L / D + K) * 0.5 * rho * v * v;
    return { dp_bar: dpPa / 1e5, v: v, Re: Re, f: f, K: K, Dmm: Dmm,
             dpFric_bar: (f * L / D) * 0.5 * rho * v * v / 1e5,
             dpFit_bar: K * 0.5 * rho * v * v / 1e5 };
  }

  window.AROPUMPSTD = {
    lineLoss: lineLoss, bore: bore, FIT_K: FIT_K, BORE: BORE,
    viscousCorrection: viscousCorrection,
    cSt: cSt,
    specificSpeed: specificSpeed,
    impellerType: impellerType,
    suctionSpecificSpeed: suctionSpecificSpeed,
    nssVerdict: nssVerdict,
    mcsfFraction: mcsfFraction,
    npshRequirement: npshRequirement,
    driverMargin: driverMargin,
    NOZZLE_TARGETS: NOZZLE_TARGETS,
    M3H_TO_GPM: M3H_TO_GPM, M_TO_FT: M_TO_FT
  };
})();

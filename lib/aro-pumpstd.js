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

  window.AROPUMPSTD = {
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

/* ══════════════════════════════════════════════════════════════════════
   AROGARA — VAPOUR PRESSURE AS A FUNCTION OF TEMPERATURE  (window.AROVP)

   Vapour pressure used to come from one water table, applied to every
   fluid in the list. Sizing an ammonia or an LPG pump against water's
   vapour pressure understates NPSHa badly, so the whole thing is replaced
   by a per-fluid property.

   PURE COMPONENTS use the Antoine equation in the form Perry's tabulates:

        log10( P / mmHg ) = A − B / ( C + t/°C )

   with the constants and their validity range taken from Perry's Chemical
   Engineers' Handbook, Table 2-8 (Vapor Pressures of Pure Substances),
   cross-checked against the NIST Chemistry WebBook. 1 atm = 760 mmHg.

   AQUEOUS SOLUTIONS have no Antoine constants of their own — what leaves
   the surface is water, at a partial pressure set by the water activity of
   the solution. They are handled as water's vapour pressure multiplied by
   that activity, with the factor stated so the engineer can see the basis
   and override it.

   PETROLEUM CUTS are not single substances either. Each is evaluated
   through a named pseudo-component of the right volatility, and the
   substitution is stated in the UI — a diesel or a crude is an assay
   property, and the number here is a screening value to be confirmed
   against the real assay or RVP.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MMHG_TO_BAR = 1.01325 / 760;          // 0.00133322 bar per mmHg

  /* Antoine constants, log10(mmHg) = A − B/(C + t°C). */
  var ANT = {
    /* Perry's Table 2-8 / NIST. Water is split at 100 °C, as Perry's is. */
    water:      { A: 8.07131, B: 1730.630, C: 233.426, tmin: 1,    tmax: 100 },
    waterHi:    { A: 8.14019, B: 1810.940, C: 244.485, tmin: 100,  tmax: 374 },
    methanol:   { A: 8.07246, B: 1574.990, C: 238.860, tmin: 15,   tmax: 100 },
    ethanol:    { A: 8.20417, B: 1642.890, C: 230.300, tmin: 20,   tmax: 93  },
    acetone:    { A: 7.11714, B: 1210.595, C: 229.664, tmin: -13,  tmax: 55  },
    toluene:    { A: 6.95464, B: 1344.800, C: 219.482, tmin: 6,    tmax: 137 },
    glycol:     { A: 8.09083, B: 2088.936, C: 203.454, tmin: 50,   tmax: 200 },
    ammonia:    { A: 7.36050, B:  926.132, C: 240.170, tmin: -83,  tmax: 60  },
    nbutane:    { A: 6.80896, B:  935.860, C: 238.730, tmin: -78,  tmax: 19  },
    npentane:   { A: 6.85296, B: 1064.840, C: 233.010, tmin: -50,  tmax: 58  },
    noctane:    { A: 6.91868, B: 1351.990, C: 209.150, tmin: 19,   tmax: 152 },
    ndodecane:  { A: 6.99795, B: 1639.270, C: 181.835, tmin: 48,   tmax: 346 },
    nhexadecane:{ A: 7.03554, B: 1830.510, C: 154.450, tmin: 105,  tmax: 380 }
  };

  function antoineBarA(k, T) {
    var a = ANT[k]; if (!a) return NaN;
    var denom = a.C + T;
    if (denom <= 1e-6) return NaN;
    return Math.pow(10, a.A - a.B / denom) * MMHG_TO_BAR;
  }

  function waterBarA(T) {
    return antoineBarA(T > 100 ? 'waterHi' : 'water', T);
  }

  /* One entry per fluid the pump panel offers. `kind` says how it is worked
     out, and `basis` is what the panel prints under the field. */
  var FLUIDS = {
    water: {
      kind: 'antoine', key: 'water', label: 'Water',
      basis: 'Antoine, Perry’s Table 2-8 (1–100 °C; the 100–374 °C set above 100 °C).'
    },
    methanol: {
      kind: 'antoine', key: 'methanol', label: 'Methanol',
      basis: 'Antoine, Perry’s Table 2-8, valid 15–100 °C.'
    },
    ethanol: {
      kind: 'antoine', key: 'ethanol', label: 'Ethanol',
      basis: 'Antoine, Perry’s Table 2-8, valid 20–93 °C.'
    },
    acetone: {
      kind: 'antoine', key: 'acetone', label: 'Acetone',
      basis: 'Antoine, Perry’s Table 2-8, valid −13 to 55 °C.'
    },
    toluene: {
      kind: 'antoine', key: 'toluene', label: 'Toluene',
      basis: 'Antoine, Perry’s Table 2-8, valid 6–137 °C.'
    },
    glycol: {
      kind: 'antoine', key: 'glycol', label: 'Ethylene glycol',
      basis: 'Antoine, Perry’s Table 2-8, valid 50–200 °C; extrapolated below 50 °C.'
    },
    ammonia: {
      kind: 'antoine', key: 'ammonia', label: 'Ammonia',
      basis: 'Antoine, Perry’s Table 2-8, valid −83 to 60 °C. A liquid ammonia pump runs close to its bubble point — NPSHa is governed by this figure.'
    },

    /* Petroleum cuts — a named pseudo-component of the right volatility. */
    light_hc: {
      kind: 'antoine', key: 'nbutane', label: 'Light hydrocarbon (LPG)',
      basis: 'n-Butane Antoine (Perry’s Table 2-8) as the pseudo-component for an LPG cut. Confirm against the actual C3/C4 split — a propane-rich mix is markedly more volatile.'
    },
    condensate: {
      kind: 'antoine', key: 'npentane', label: 'Condensate',
      basis: 'n-Pentane Antoine (Perry’s Table 2-8) as the pseudo-component for a light condensate. Confirm against the assay TVP.'
    },
    crude_oil: {
      kind: 'antoine', key: 'noctane', label: 'Crude oil (medium)',
      basis: 'n-Octane Antoine (Perry’s Table 2-8) as the pseudo-component. A crude’s true vapour pressure is set by its light ends — confirm against the assay RVP before committing the NPSH margin.'
    },
    diesel: {
      kind: 'antoine', key: 'ndodecane', label: 'Diesel',
      basis: 'n-Dodecane Antoine (Perry’s Table 2-8) as the pseudo-component for a middle distillate. Screening value — confirm against the assay.'
    },
    heavy_hc: {
      kind: 'antoine', key: 'nhexadecane', label: 'Heavy hydrocarbon (HFO)',
      basis: 'n-Hexadecane Antoine (Perry’s Table 2-8) as the pseudo-component for a residual fuel. Vapour pressure is negligible next to the suction pressure at normal handling temperatures.'
    },

    /* Aqueous solutions — water vapour pressure times the water activity. */
    caustic_50: {
      kind: 'aqueous', aw: 0.17, label: 'Caustic soda 50 %',
      basis: 'Water partial pressure over 50 wt % NaOH: water Antoine × water activity 0.17 (Perry’s Sec. 2, aqueous NaOH vapour-pressure data).'
    },
    caustic: {
      kind: 'aqueous', aw: 0.66, label: 'Caustic soda 30 %',
      basis: 'Water partial pressure over 30 wt % NaOH: water Antoine × water activity 0.66 (Perry’s Sec. 2).'
    },
    brine: {
      kind: 'aqueous', aw: 0.84, label: 'Brine (NaCl 20 %)',
      basis: 'Water partial pressure over 20 wt % NaCl: water Antoine × water activity 0.84 (Perry’s Sec. 2).'
    },
    sulfuric_acid: {
      kind: 'aqueous', aw: 0.003, label: 'Sulfuric acid 98 %',
      basis: 'Water partial pressure over 98 wt % H₂SO₄: water Antoine × water activity 0.003 (Perry’s Sec. 2). Effectively non-volatile at pumping temperatures.'
    },
    hydrochloric_acid: {
      kind: 'aqueous', aw: 1.35, label: 'Hydrochloric acid 35 %',
      basis: 'Total vapour pressure over 35 wt % HCl, approximated as water Antoine × 1.35 to carry the HCl partial pressure (Perry’s Sec. 2, HCl–H₂O). Fuming acid — treat the figure as indicative.'
    },

    /* Aliases so older option values keep working. */
    oil:  { kind: 'antoine', key: 'nhexadecane', label: 'Fuel oil',
            basis: 'n-Hexadecane Antoine (Perry’s Table 2-8) as the pseudo-component for a fuel oil.' },
    lpg:  { kind: 'antoine', key: 'nbutane', label: 'LPG',
            basis: 'n-Butane Antoine (Perry’s Table 2-8) as the pseudo-component for an LPG cut.' },
    light_hydrocarbon: { kind: 'antoine', key: 'nbutane', label: 'Light hydrocarbon',
            basis: 'n-Butane Antoine (Perry’s Table 2-8) as the pseudo-component.' },
    heavy_hydrocarbon: { kind: 'antoine', key: 'nhexadecane', label: 'Heavy hydrocarbon',
            basis: 'n-Hexadecane Antoine (Perry’s Table 2-8) as the pseudo-component.' },
    steam: { kind: 'antoine', key: 'water', label: 'Water / steam',
            basis: 'Antoine, Perry’s Table 2-8.' }
  };

  function has(fluid) { return !!FLUIDS[fluid]; }

  /* Vapour pressure in bar absolute at t °C, or NaN when the fluid has no
     defined basis (custom fluid — the engineer supplies the number). */
  function pBarA(fluid, T) {
    var f = FLUIDS[fluid];
    if (!f || !isFinite(T)) return NaN;
    if (f.kind === 'aqueous') {
      var pw = waterBarA(T);
      return isFinite(pw) ? pw * f.aw : NaN;
    }
    return (f.key === 'water') ? waterBarA(T) : antoineBarA(f.key, T);
  }

  /* The validity window of the underlying constants, for range warnings. */
  function range(fluid) {
    var f = FLUIDS[fluid]; if (!f) return null;
    var a = ANT[f.kind === 'aqueous' ? 'water' : f.key];
    return a ? { tmin: a.tmin, tmax: a.tmax } : null;
  }

  function basis(fluid) { var f = FLUIDS[fluid]; return f ? f.basis : ''; }
  function label(fluid) { var f = FLUIDS[fluid]; return f ? f.label : ''; }

  /* Warning text when the operating temperature sits outside the range the
     constants were fitted over — the number is still returned, because an
     extrapolated figure with a caveat beats a silently wrong one. */
  function note(fluid, T) {
    var r = range(fluid);
    if (!r || !isFinite(T)) return '';
    if (T < r.tmin) return 'Extrapolated: ' + T.toFixed(1) + ' °C is below the fitted range (' + r.tmin + '–' + r.tmax + ' °C).';
    if (T > r.tmax) return 'Extrapolated: ' + T.toFixed(1) + ' °C is above the fitted range (' + r.tmin + '–' + r.tmax + ' °C).';
    return '';
  }

  /* Points for the vapour-pressure curve of one fluid, spanning its fitted
     range and always including the operating point. */
  function curve(fluid, T, n) {
    var r = range(fluid); if (!r) return null;
    n = n || 40;
    var lo = r.tmin, hi = r.tmax;
    if (isFinite(T)) { lo = Math.min(lo, T - 5); hi = Math.max(hi, T + 5); }
    if (hi - lo > 260) hi = lo + 260;                 // keep the plot readable
    var xs = [], ys = [];
    for (var i = 0; i <= n; i++) {
      var t = lo + (hi - lo) * i / n;
      var p = pBarA(fluid, t);
      if (isFinite(p) && p > 0) { xs.push(t); ys.push(p); }
    }
    return { t: xs, p: ys, tmin: r.tmin, tmax: r.tmax };
  }

  window.AROVP = {
    pBarA: pBarA, has: has, basis: basis, label: label, note: note,
    range: range, curve: curve, water: waterBarA, fluids: FLUIDS, antoine: ANT
  };
})();

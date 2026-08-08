/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — MOMENTUM FLUX & EROSION SCREENING ENGINE

   One implementation, used by all five line-sizing modules (liquid, gas,
   steam, slurry, two-phase). The calculation is deliberately independent of
   any UI: it takes numbers in and returns numbers out, so the five review
   panels share the arithmetic instead of each carrying its own copy of it.

   Two quantities that are routinely conflated are kept apart here, because
   confusing them is how a line gets sized on the wrong criterion:

     · MOMENTUM FLUX      J = ρV²      [Pa]
       The momentum the stream carries per unit area. A severity indicator.

     · DYNAMIC PRESSURE   q = ½ρV²     [Pa]
       Exactly half of it, and a different thing — the stagnation rise.

     · EROSIONAL VELOCITY Ve = C/√ρ    [API RP 14E]
       A velocity, not a momentum. It is an empirical SCREENING relation
       for clean, solid-free service, not a universal momentum limit, and
       it is offered here as an optional check rather than as a verdict.

   There is no universal allowable momentum flux, so this module refuses to
   invent one. With no project limit configured a line reports its momentum
   as INFO and says so; a limit has to be supplied before anything is called
   a pass or a failure. The 80 % / 100 % thresholds are software screening
   bands, configurable, and are not claimed to be a standard.

   Everything is computed at FLOWING conditions from the density and
   velocity the hydraulics already used — never from a standard density, and
   never from a nominal bore. The caller passes the values it computed; this
   module does not recompute density, velocity or internal diameter.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LB_PER_M3 = 16.0185;      // kg/m³ per lb/ft³
  var FT = 0.3048;              // m per ft

  /* ── 1 · Momentum flux and dynamic pressure ─────────────────────────── */
  function calculateMomentumFlux(density_kg_m3, velocity_m_s) {
    var rho = Number(density_kg_m3), v = Number(velocity_m_s);
    if (!isFinite(rho) || !isFinite(v) || rho <= 0) {
      return { momentumFluxPa: NaN, momentumFluxKPa: NaN,
               dynamicPressurePa: NaN, dynamicPressureKPa: NaN };
    }
    var J = rho * v * v;          // Pa
    var q = 0.5 * J;              // Pa — exactly half, by definition
    return {
      momentumFluxPa: J, momentumFluxKPa: J / 1000,
      dynamicPressurePa: q, dynamicPressureKPa: q / 1000
    };
  }

  /* ── 2 · API RP 14E erosional velocity ──────────────────────────────────
     Ve = C / √ρ is written in field units: ρ in lb/ft³ gives Ve in ft/s.
     Feeding it an SI density with a field-unit C is the classic way to get
     an answer that is wrong by a factor of four, so the conversion is done
     here rather than left to each caller. */
  function calculateErosionalVelocity(opts) {
    opts = opts || {};
    var rho = Number(opts.density_kg_m3);
    var C = Number(opts.C_factor);
    var service = opts.service || 'user';
    if (!isFinite(rho) || rho <= 0 || !isFinite(C) || C <= 0) {
      return { erosionalVelocity_m_s: NaN, erosionalVelocity_ft_s: NaN,
               C_factor: C, units: 'm/s', method: 'API RP 14E',
               assumptions: 'Not evaluated — a density and a C factor are both required.' };
    }
    var rhoLb = rho / LB_PER_M3;
    var VeFt = C / Math.sqrt(rhoLb);
    var NOTE = {
      clean: 'C for continuous, clean, solid-free service. API RP 14E is a screening '
           + 'relation only; it carries no allowance for sand or erosion-corrosion.',
      corrosion: 'C for a corrosion-controlled service with an inhibitor or a resistant '
               + 'alloy. Still a screening relation, not a wear model.',
      solids: 'Solids present. API RP 14E was never intended for solid-bearing streams — '
            + 'treat this figure as indicative only and size on a solids erosion model.',
      user: 'C factor supplied by the user. The basis for it is the user’s to state.'
    };
    return {
      erosionalVelocity_m_s: VeFt * FT,
      erosionalVelocity_ft_s: VeFt,
      C_factor: C, units: 'm/s', method: 'API RP 14E (Ve = C/√ρ)',
      service: service,
      assumptions: NOTE[service] || NOTE.user
    };
  }

  /* ── 3 · Momentum criterion, only when a limit exists ───────────────── */
  function evaluateMomentumCriterion(opts) {
    opts = opts || {};
    var J = Number(opts.momentumFluxPa);
    var lim = Number(opts.limitPa);
    var warn = isFinite(opts.warningPercent) ? Number(opts.warningPercent) : 80;
    var fail = isFinite(opts.failPercent) ? Number(opts.failPercent) : 100;
    if (!isFinite(J)) {
      return { utilizationPercent: NaN, status: 'INFO', configured: false,
               message: 'Momentum flux not available for this duty.' };
    }
    if (!isFinite(lim) || lim <= 0) {
      /* No universal allowable exists, so none is assumed. */
      return { utilizationPercent: NaN, status: 'INFO', configured: false,
               message: 'No allowable momentum limit configured — the figure is reported '
                      + 'for design validation, not judged.' };
    }
    var u = (J / lim) * 100;
    var status = u > fail ? 'FAIL' : u > warn ? 'WARNING' : 'PASS';
    return {
      utilizationPercent: u, status: status, configured: true,
      warningPercent: warn, failPercent: fail,
      message: status === 'FAIL'
        ? 'Momentum flux is over the configured limit for this service.'
        : status === 'WARNING'
          ? 'Momentum flux is within the limit but inside the warning band.'
          : 'Momentum flux is inside the configured limit.'
    };
  }

  /* ── 4 · The wrapper every module calls ─────────────────────────────────
     opts:
       flowType   label for the stream, e.g. 'Water', 'Wet gas'
       phase      'liquid' | 'gas' | 'steam' | 'slurry' | 'twophase'
       density    FLOWING density [kg/m³] the hydraulics used
       velocity   actual velocity [m/s] from the ACTUAL internal diameter
       C_factor / service     optional, for the API RP 14E screening
       limitPa / warningPercent / failPercent    optional project limit
       phases     optional [{name, density, velocity}] for two-phase
                  contributions, reported separately and never merged
       basis      optional note on where the mixture properties came from */
  function calculateFlowMomentumCheck(opts) {
    opts = opts || {};
    var flux = calculateMomentumFlux(opts.density, opts.velocity);
    var ero = calculateErosionalVelocity({
      density_kg_m3: opts.density, C_factor: opts.C_factor, service: opts.service
    });
    var crit = evaluateMomentumCriterion({
      momentumFluxPa: flux.momentumFluxPa, limitPa: opts.limitPa,
      warningPercent: opts.warningPercent, failPercent: opts.failPercent
    });

    // velocity against the screening relation — a velocity check, kept
    // separate from the momentum one on purpose
    var vUtil = NaN, eroStatus = 'INFO';
    if (isFinite(ero.erosionalVelocity_m_s) && ero.erosionalVelocity_m_s > 0 && isFinite(opts.velocity)) {
      var allow = isFinite(opts.allowableVelocity) && opts.allowableVelocity > 0
        ? opts.allowableVelocity : ero.erosionalVelocity_m_s;
      vUtil = (opts.velocity / allow) * 100;
      eroStatus = vUtil > 100 ? 'FAIL' : vUtil > 80 ? 'WARNING' : 'PASS';
    }

    var contributions = null;
    if (opts.phases && opts.phases.length) {
      contributions = opts.phases.map(function (p) {
        var f = calculateMomentumFlux(p.density, p.velocity);
        return { name: p.name, density: p.density, velocity: p.velocity,
                 momentumFluxPa: f.momentumFluxPa, momentumFluxKPa: f.momentumFluxKPa };
      });
    }

    return {
      flowType: opts.flowType || '', phase: opts.phase || '',
      density: opts.density, velocity: opts.velocity,
      momentumFluxPa: flux.momentumFluxPa, momentumFluxKPa: flux.momentumFluxKPa,
      dynamicPressurePa: flux.dynamicPressurePa, dynamicPressureKPa: flux.dynamicPressureKPa,
      erosion: ero, velocityUtilizationPercent: vUtil, erosionStatus: eroStatus,
      allowableVelocity: isFinite(opts.allowableVelocity) ? opts.allowableVelocity : NaN,
      criterion: crit,
      contributions: contributions,
      basis: opts.basis || '',
      /* Which check leads for this service. Momentum is never the primary
         criterion for a liquid line, and saying so stops it being read as
         one. */
      priority: PRIORITY[opts.phase] || PRIORITY.liquid
    };
  }

  var PRIORITY = {
    liquid:   { primary: 'Velocity and pressure drop', momentum: 'secondary — design check only' },
    gas:      { primary: 'Velocity, Mach number and pressure drop', momentum: 'important secondary check' },
    steam:    { primary: 'Velocity, Mach number and pressure drop', momentum: 'important secondary check' },
    slurry:   { primary: 'Minimum transport velocity, erosion and pressure drop', momentum: 'important secondary check' },
    twophase: { primary: 'Flow regime, phase velocities and pressure drop', momentum: 'critical' }
  };

  /* ── 5 · One shared review block, so five panels cannot drift apart ──── */
  function render(m, fmt) {
    if (!m) return '';
    var f = fmt || {};
    var num = f.num || function (v, d) { return isFinite(v) ? v.toFixed(d == null ? 2 : d) : '—'; };
    var vel = f.vel || function (v) { return num(v, 2) + ' m/s'; };
    var rho = f.rho || function (v) { return num(v, 1) + ' kg/m³'; };
    var COL = { PASS: '#22c55e', WARNING: '#f59e0b', FAIL: '#ef4444', INFO: '#7ea2d8' };
    var row = function (k, v, c) {
      return '<div class="aln-rr"><span>' + k + '</span><b'
        + (c ? ' style="color:' + c + ';"' : '') + '>' + v + '</b></div>';
    };
    var h = '<div class="aln-cardh">MOMENTUM &amp; EROSION CHECK</div>';
    h += row('Flow type', m.flowType || '—');
    h += row('Flowing density', rho(m.density));
    h += row('Actual velocity', vel(m.velocity));
    h += row('Momentum flux  J = ρV²', num(m.momentumFluxKPa, 2) + ' kPa');
    h += row('Dynamic pressure  q = ½ρV²', num(m.dynamicPressureKPa, 2) + ' kPa');
    if (m.contributions) {
      m.contributions.forEach(function (c) {
        h += row('&nbsp;&nbsp;· ' + c.name + ' contribution', num(c.momentumFluxKPa, 2) + ' kPa');
      });
    }
    h += row('Applicable criterion', m.criterion.configured ? 'Project / user defined' : 'None configured');
    h += row('Allowable limit', m.criterion.configured
      ? num(m.criterion.utilizationPercent >= 0 ? (m.momentumFluxPa / (m.criterion.utilizationPercent / 100)) / 1000 : NaN, 2) + ' kPa'
      : 'Not configured');
    h += row('Utilisation', m.criterion.configured ? num(m.criterion.utilizationPercent, 1) + ' %' : '—');
    h += row('Momentum status', m.criterion.status, COL[m.criterion.status]);
    h += '<div class="aln-cardh" style="margin-top:10px;">EROSIONAL VELOCITY SCREENING</div>';
    h += row('Method', m.erosion.method);
    h += row('C factor', isFinite(m.erosion.C_factor) ? String(m.erosion.C_factor) : '—');
    h += row('Erosional velocity Ve', vel(m.erosion.erosionalVelocity_m_s));
    if (isFinite(m.allowableVelocity)) h += row('Allowable used', vel(m.allowableVelocity));
    h += row('Velocity utilisation', isFinite(m.velocityUtilizationPercent)
      ? num(m.velocityUtilizationPercent, 1) + ' %' : '—');
    h += row('Erosion screening', m.erosionStatus, COL[m.erosionStatus]);
    h += '<div class="wb-prop-note" style="margin-top:6px;font-family:var(--font-mono);font-size:9.5px;'
      + 'color:#94a3b8;line-height:1.55;">'
      + '<b>Engineering note.</b> ' + (m.basis ? m.basis + ' ' : '')
      + 'Momentum flux is reported for design validation. ' + m.criterion.message + ' '
      + 'For this service the governing checks are ' + m.priority.primary.toLowerCase()
      + '; momentum is ' + m.priority.momentum + '. '
      + m.erosion.assumptions
      + '</div>';
    return h;
  }

  window.AROMOM = {
    calculateMomentumFlux: calculateMomentumFlux,
    calculateErosionalVelocity: calculateErosionalVelocity,
    evaluateMomentumCriterion: evaluateMomentumCriterion,
    calculateFlowMomentumCheck: calculateFlowMomentumCheck,
    render: render,
    PRIORITY: PRIORITY
  };
})();

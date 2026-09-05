/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Life-Cycle Cost (energy component)
   window.AROPUMPLCC

   Phase 24 of the Pump Hydraulics Advanced Upgrade.

   A full pump life-cycle cost has several buckets (Hydraulic Institute/
   DOE "Pump Life Cycle Costs" guide): initial purchase, installation,
   energy, operation, maintenance, downtime, environmental, and
   decommissioning. This suite has no vendor pricing, no maintenance
   history, and no downtime data for any of those buckets EXCEPT one:
   energy — because the electrical input power this pump actually draws
   is already calculated (mhp = bhp / motor efficiency, computed in
   app.js's own runActualPumpCalculations()). Rather than invent numbers
   for the buckets it cannot support, this engine computes the energy
   bucket honestly and precisely, and says plainly that the rest are not
   modelled here.

   The three inputs this needs beyond the already-calculated electrical
   power (electricity rate, annual operating hours, an evaluation
   horizon, and an optional discount rate) are ECONOMIC parameters, not
   engineering design inputs — the same distinction Phase 23's reported
   symptom draws between a diagnostic input and a design one. They do
   not feed back into the pump's own sizing.

   buildLifeCycleCost(...) is pure — no DOM. Loadable/unit-testable in
   Node like every other engine here.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Hydraulic Institute / US DOE "Pump Life Cycle Costs" guidance: for a
     pump running continuously or near-continuously, energy typically
     makes up roughly 85-90% of total life-cycle cost — cited here as
     context for why an energy-only figure is still informative, not
     used in the arithmetic below. */
  var ENERGY_SHARE_NOTE = 'Energy is typically 85-90% of a continuously-run pump\'s total life-cycle cost (Hydraulic Institute / US DOE Pump Life Cycle Costs guidance) — the figure below is that dominant share, not the whole picture.';

  var NOT_MODELED_BUCKETS = [
    { id: 'capital', label: 'Initial Purchase Cost', reason: 'No vendor pricing is available in this suite.' },
    { id: 'installation', label: 'Installation Cost', reason: 'No vendor pricing is available in this suite.' },
    { id: 'maintenance', label: 'Maintenance Cost', reason: 'No maintenance-interval or spare-parts cost data is available in this suite.' },
    { id: 'downtime', label: 'Downtime / Lost-Production Cost', reason: 'Requires a process-specific value of lost production, which this suite does not model.' },
    { id: 'decommissioning', label: 'Decommissioning Cost', reason: 'No vendor pricing is available in this suite.' },
  ];

  /* input = { mhp_kW (electrical input power, already calculated as
     bhp / motor efficiency), electricityRate (user-entered, currency
     per kWh), annualOperatingHours (user-entered), horizonYears
     (user-entered), discountRatePct (user-entered, optional, 0 if
     omitted — reduces to a simple undiscounted sum) } */
  function buildLifeCycleCost(input) {
    input = input || {};
    var mhp = input.mhp_kW, rate = input.electricityRate, hours = input.annualOperatingHours, years = input.horizonYears;
    var discountPct = (input.discountRatePct == null || !isFinite(input.discountRatePct)) ? 0 : input.discountRatePct;

    if (!isFinite(mhp) || mhp <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Run the pump hydraulic calculation first — electrical input power is not available yet.' };
    }
    if (!isFinite(rate) || rate <= 0 || !isFinite(hours) || hours <= 0 || !isFinite(years) || years <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Enter an electricity rate, annual operating hours, and an evaluation horizon (all economic inputs, not design inputs) to estimate energy cost.' };
    }
    if (hours > 8760) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Annual operating hours cannot exceed 8,760 (the hours in a year).' };
    }

    var annualEnergy_kWh = mhp * hours;
    var annualEnergyCost = annualEnergy_kWh * rate;

    var r = discountPct / 100;
    var npvEnergyCost = 0;
    for (var t = 1; t <= Math.round(years); t++) {
      npvEnergyCost += annualEnergyCost / Math.pow(1 + r, t);
    }
    var undiscountedTotal = annualEnergyCost * years;

    return {
      applicable: true, status: 'CALCULATED',
      mhp_kW: mhp, electricityRate: rate, annualOperatingHours: hours, horizonYears: years, discountRatePct: discountPct,
      annualEnergy_kWh: annualEnergy_kWh, annualEnergyCost: annualEnergyCost,
      undiscountedTotalEnergyCost: undiscountedTotal, npvEnergyCost: npvEnergyCost,
      energyShareNote: ENERGY_SHARE_NOTE, notModeledBuckets: NOT_MODELED_BUCKETS,
    };
  }

  window.AROPUMPLCC = { buildLifeCycleCost: buildLifeCycleCost, NOT_MODELED_BUCKETS: NOT_MODELED_BUCKETS };
})();

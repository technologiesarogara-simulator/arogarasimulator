/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Motor / Driver / Coupling screening engine
   window.AROPUMPDRIVER

   Phase 10 of the Pump Hydraulics Advanced Upgrade. Pure calculation
   module — no DOM access — same "one IIFE, one namespace" pattern as
   the other pump engines, loadable and unit-testable in Node with
   nothing but `global.window = global`.

   PURPOSE
   Three small, independent screenings, each reusing something an
   earlier phase already produced rather than asking for a new input:
     1. screenMotorEnclosure(): hazardous-area motor enclosure rating,
        driven by the same fluid hazard classification Phase 9 already
        uses for seal-plan selection (benign/flammable/toxic/
        toxic-corrosive → area-classification-appropriate enclosure).
     2. recommendCoupling(): coupling type (disc/diaphragm, gear,
        elastomeric) plus the continuous and peak torque a coupling
        must be rated for, from the torque Phase 7 already computed —
        and correctly declines to run when Phase 3's selected API 610
        class is close-coupled (OH5), where no separate coupling
        exists at all.
     3. screenStartingMethod(): a starting-method note (direct-on-line
        / reduced-voltage / VFD) from the motor size the base
        calculation already selects.

   This module does not depend on AROPUMPSEAL or AROPUMPCONFIG at load
   time — the caller passes the hazard class and coupling type those
   modules already computed, so all three stay independently loadable
   and testable.

   WHAT THIS IS NOT
   - Not a specific vendor coupling or motor selection — no frame sizes
     or catalogue part numbers, only the torque rating and enclosure
     class a real selection has to meet.
   - Not an electrical/area-classification study. Enclosure guidance
     follows the same fluid hazard tag Phase 9 uses; an actual area
     classification (zone/division) depends on ventilation, layout and
     release scenario this tool has no input for.

   API
     AROPUMPDRIVER.ENCLOSURE_TYPES
     AROPUMPDRIVER.COUPLING_TYPES
     AROPUMPDRIVER.screenMotorEnclosure(input)
     AROPUMPDRIVER.recommendCoupling(input)
     AROPUMPDRIVER.screenStartingMethod(input)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  function sortRanked(list) { return list.sort(function (a, b) { return VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]; }); }

  var ENCLOSURE_TYPES = [
    { id: 'tefc', name: 'TEFC (Totally Enclosed Fan Cooled)',
      note: 'Standard industrial enclosure — no ignition-protection rating, for a non-hazardous atmosphere only.' },
    { id: 'ex-e', name: 'Increased Safety, Ex e (IEC 60079-7)',
      note: 'No internal arcing/sparking parts by design — common for less severe hazardous-area zones.' },
    { id: 'ex-d', name: 'Flameproof, Ex d (IEC 60079-1)',
      note: 'Contains an internal ignition within the enclosure rather than preventing one — the most conservative rating of the three.' },
  ];

  /* ── screenMotorEnclosure: hazard-class-driven enclosure screening ── */
  function screenMotorEnclosure(input) {
    input = input || {};
    var hazardClass = input.hazardClass;
    if (!hazardClass) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Fluid hazard classification is not available — select a listed service fluid.' };
    }
    var hazardous = (hazardClass === 'flammable' || hazardClass === 'toxic' || hazardClass === 'toxic-corrosive');

    var ranked = ENCLOSURE_TYPES.map(function (e) {
      var verdict, reasons = [], warnings = [];
      if (e.id === 'tefc') {
        if (hazardous) { verdict = 'NOT RECOMMENDED'; warnings.push('A standard enclosure is not rated for a ' + hazardClass + ' atmosphere.'); }
        else { verdict = 'SUITABLE'; reasons.push('No hazardous-area rating is indicated for this fluid.'); }
      } else if (e.id === 'ex-e') {
        if (hazardous) { verdict = 'SUITABLE'; reasons.push('Common practice for a ' + hazardClass + ' fluid in a less severe hazardous-area zone.'); }
        else { verdict = 'CHECK'; warnings.push('Available, but likely an unnecessary cost premium for a non-hazardous fluid.'); }
      } else {
        if (hazardous) { verdict = 'SUITABLE'; reasons.push('The most conservative rating — suitable for any hazardous-area zone this fluid might require.'); }
        else { verdict = 'CHECK'; warnings.push('Available, but likely an unnecessary cost premium for a non-hazardous fluid.'); }
      }
      return { id: e.id, name: e.name, verdict: verdict, reasons: reasons, warnings: warnings, note: e.note };
    });
    sortRanked(ranked);

    return { applicable: true, status: 'PREDICTED', hazardClass: hazardClass, hazardous: hazardous, ranked: ranked, top: ranked[0] };
  }

  var COUPLING_TYPES = [
    { id: 'disc-diaphragm', name: 'Disc/Diaphragm Coupling', note: 'The modern default for API 610 process service — a non-lubricated metallic membrane with no wear parts.' },
    { id: 'gear', name: 'Gear Coupling', note: 'Higher misalignment tolerance than a disc coupling, at the cost of periodic re-lubrication — still common on older or heavy-duty installations.' },
    { id: 'elastomeric', name: 'Elastomeric (Jaw/Tyre) Coupling', note: 'Simple and inexpensive, absorbs shock and minor misalignment well — the standard utility-duty choice.' },
  ];

  var COUPLING_SERVICE_FACTOR = 1.5; // continuous torque rating margin over the calculated running torque
  var COUPLING_PEAK_FACTOR = 2.5;    // peak/starting torque margin (motor breakaway/locked-rotor torque spikes)

  /* ── recommendCoupling: type + required torque rating ───────────────
     input = { torque_Nm, apiClassCouplingType (optional, from
     AROPUMPCONFIG's top result — 'none (close-coupled)' means there is
     no separate coupling to recommend at all) } */
  function recommendCoupling(input) {
    input = input || {};
    if (input.apiClassCouplingType === 'none (close-coupled)') {
      return { applicable: false, status: 'NOT APPLICABLE',
        reason: 'This configuration is close-coupled (the impeller mounts directly on the motor shaft extension) — there is no separate coupling to select.' };
    }
    if (!isFinite(input.torque_Nm) || input.torque_Nm <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Running torque is not available yet — run the pump hydraulic calculation and let the shaft screening (Phase 7) finish.' };
    }
    var isProcessContext = !!input.apiClassCouplingType;
    var requiredContinuousTorque_Nm = input.torque_Nm * COUPLING_SERVICE_FACTOR;
    var requiredPeakTorque_Nm = input.torque_Nm * COUPLING_PEAK_FACTOR;

    var ranked = COUPLING_TYPES.map(function (c) {
      var verdict = 'SUITABLE', reasons = [], warnings = [];
      if (c.id === 'elastomeric' && isProcessContext) {
        verdict = 'CHECK';
        warnings.push('API 610 process service typically specifies a non-lubricated metallic coupling rather than an elastomeric type — confirm against your project specification.');
      }
      return { id: c.id, name: c.name, verdict: verdict, reasons: reasons, warnings: warnings, note: c.note };
    });
    sortRanked(ranked);

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION',
      torque_Nm: input.torque_Nm, serviceFactor: COUPLING_SERVICE_FACTOR, peakFactor: COUPLING_PEAK_FACTOR,
      requiredContinuousTorque_Nm: requiredContinuousTorque_Nm, requiredPeakTorque_Nm: requiredPeakTorque_Nm,
      ranked: ranked, top: ranked[0],
      assumptions: [
        'Required continuous torque rating = running torque × ' + COUPLING_SERVICE_FACTOR + ' (typical published service-factor margin for an electric-motor-driven centrifugal pump).',
        'Required peak torque rating = running torque × ' + COUPLING_PEAK_FACTOR + ' (typical allowance for motor starting/breakaway torque spikes).',
      ],
    };
  }

  /* ── screenStartingMethod: DOL / reduced-voltage / VFD note ────────── */
  function screenStartingMethod(input) {
    input = input || {};
    var motorKw = input.motorKw;
    if (!isFinite(motorKw) || motorKw <= 0) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Motor size is not available yet — run the pump hydraulic calculation first.' };
    }
    var band, recommendation;
    if (motorKw <= 37) {
      band = 'small'; recommendation = 'Direct-on-line (DOL) starting is typical at this size — the inrush current is usually well within a standard supply\'s capability.';
    } else if (motorKw <= 160) {
      band = 'medium'; recommendation = 'Reduced-voltage starting (star-delta, soft starter) or a VFD is typical practice at this size to limit inrush current and starting torque shock.';
    } else {
      band = 'large'; recommendation = 'A VFD or soft starter is strongly typical at this size — direct-on-line inrush current would be significant for the supply and the driven equipment.';
    }
    return { applicable: true, status: 'PREDICTED', motorKw: motorKw, band: band, recommendation: recommendation };
  }

  window.AROPUMPDRIVER = {
    ENCLOSURE_TYPES: ENCLOSURE_TYPES,
    COUPLING_TYPES: COUPLING_TYPES,
    screenMotorEnclosure: screenMotorEnclosure,
    recommendCoupling: recommendCoupling,
    screenStartingMethod: screenStartingMethod,
  };
})();

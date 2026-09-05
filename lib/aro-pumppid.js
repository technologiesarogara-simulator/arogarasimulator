/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Automatic Service-Dependent P&ID Line List
   window.AROPUMPPID

   Phase 19 of the Pump Hydraulics Advanced Upgrade.

   This app already has a full P&ID drafting/design-rule-check tool
   (lib/aro-pid.js, ~2900 lines — symbol library, routing rules, reducer
   orientation checks, and more) for hand-built diagrams. That tool is
   generic and works; it is NOT rebuilt or touched here.

   What did not exist is something that reads what THIS pump's own
   calculation already decided — which mechanical seal plan Phase 9
   picked, whether Phase 2 put a positive-displacement machine on top,
   whether Phase 14 found overpressure protection missing — and turns
   those decisions into the P&ID content list a real project would need:
   the seal support piping, the pulsation dampeners, the relief valve,
   the minimum-flow line. That is what this engine assembles.

   buildPidRequirements(...) is pure — no DOM. Every item's status is
   either read straight off an existing phase's verdict (the seal
   support system, pulsation dampening, overpressure protection) or is a
   fixed, duty-independent reference item in the same spirit as Phase
   15's CIP/SIP checklist (pressure gauges, hazard-driven instruments) —
   nothing here invents a pass/fail judgement a prior phase did not
   already make.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* What each API 682 seal plan implies on the P&ID, beyond the seal
     symbol itself. Reference content, not a calculation — same role as
     Phase 15's CIP_SIP_CHECKLIST. */
  var SEAL_SUPPORT_PIPING = {
    '11': 'Discharge recirculation line back to the seal chamber, taken off the pump\'s own discharge — no external connections.',
    '13': 'Seal chamber vent/drain line routed back to the suction side.',
    '21': 'Discharge recirculation through an external cooler ahead of the seal chamber.',
    '23': 'Recirculating loop from the seal chamber through an external cooler, piston-driven.',
    '32': 'External clean flush supply piped to the seal chamber, with a restriction orifice (RO) and a flow indicator (FI).',
    '52': 'Unpressurized buffer fluid reservoir with a level switch (LSL), a pressure gauge (PI), and fill/vent connections.',
    '53A': 'Pressurized barrier fluid reservoir with a level switch (LSL), a pressure gauge (PI), and a pressure switch (PSL) for barrier-loss alarm.',
  };

  function sealSupportItem(sealPlanResult) {
    if (!sealPlanResult || !sealPlanResult.applicable) {
      return { id: 'seal-support', label: 'Mechanical Seal Support System', status: 'DATA REQUIRED',
        detail: (sealPlanResult && sealPlanResult.reason) || 'Run the pump hydraulic calculation and let seal plan selection (section 15) finish first.' };
    }
    var plan = sealPlanResult.top;
    var piping = SEAL_SUPPORT_PIPING[plan.id] || 'Piping per the selected plan\'s standard API 682 arrangement.';
    return { id: 'seal-support', label: 'Mechanical Seal Support System — ' + plan.name, status: 'REQUIRED', detail: piping };
  }

  function quenchItem(sealPlanResult) {
    if (!sealPlanResult || !sealPlanResult.applicable) {
      return { id: 'seal-quench', label: 'Seal Quench (Plan 62)', status: 'DATA REQUIRED', detail: 'Run the pump hydraulic calculation first.' };
    }
    if (sealPlanResult.quenchRecommended) {
      return { id: 'seal-quench', label: 'Seal Quench (Plan 62)', status: 'RECOMMENDED', detail: sealPlanResult.quenchReason };
    }
    return { id: 'seal-quench', label: 'Seal Quench (Plan 62)', status: 'NOT APPLICABLE', detail: 'Not indicated for this service.' };
  }

  function pulsationItem(pulsationResult, topFamilyCategory) {
    if (topFamilyCategory !== 'pd-rotary' && topFamilyCategory !== 'pd-reciprocating') {
      return { id: 'pulsation-dampener', label: 'Pulsation Dampeners', status: 'NOT APPLICABLE',
        detail: 'Centrifugal duty — pulsation dampening is a reciprocating positive-displacement requirement (see the Positive-Displacement Mode section).' };
    }
    if (!pulsationResult || !pulsationResult.applicable) {
      return { id: 'pulsation-dampener', label: 'Pulsation Dampeners', status: (pulsationResult && pulsationResult.status) || 'NOT APPLICABLE',
        detail: (pulsationResult && pulsationResult.reason) || 'Rotary positive-displacement — does not pulse the same way as a reciprocating machine.' };
    }
    return { id: 'pulsation-dampener', label: 'Pulsation Dampeners (suction and discharge)', status: 'REQUIRED', detail: pulsationResult.message };
  }

  function reliefValveItem(overpressureResult, topFamilyCategory) {
    if (topFamilyCategory !== 'pd-rotary' && topFamilyCategory !== 'pd-reciprocating') {
      return { id: 'relief-valve', label: 'Discharge Relief Valve', status: 'NOT APPLICABLE',
        detail: 'Centrifugal duty — the pump\'s own shutoff head self-limits discharge pressure against a blocked line, so a relief valve is a system/piping-level decision rather than a pump-mandated one the way it is for a constant-flow positive-displacement machine.' };
    }
    if (!overpressureResult || !overpressureResult.applicable) {
      return { id: 'relief-valve', label: 'Discharge Relief Valve', status: 'DATA REQUIRED',
        detail: (overpressureResult && overpressureResult.reason) || 'Run the pump hydraulic calculation first.' };
    }
    return { id: 'relief-valve', label: 'Discharge Relief Valve — MANDATORY for a PD pump', status: overpressureResult.verdict, detail: overpressureResult.message };
  }

  function minFlowLineItem(mcsfFlow, mcsfFrac) {
    if (!isFinite(mcsfFlow) || !isFinite(mcsfFrac)) {
      return { id: 'min-flow-line', label: 'Minimum-Flow Recirculation Line', status: 'DATA REQUIRED', detail: 'Run the pump hydraulic calculation first.' };
    }
    return { id: 'min-flow-line', label: 'Minimum-Flow Recirculation Line', status: 'RECOMMENDED',
      detail: 'Estimated minimum continuous stable flow ' + mcsfFlow.toFixed(1) + ' m³/h (' + Math.round(mcsfFrac * 100)
        + '% of rated, from Section 08\'s suction specific speed). Standard practice per API 610 §6.1.11 is a bypass back to source if the process can turn this pump down below that flow.' };
  }

  function instrumentationItem(hazardClass) {
    if (!hazardClass) {
      return { id: 'hazard-instrumentation', label: 'Hazard-Driven Instrumentation', status: 'DATA REQUIRED', detail: 'Select a listed service fluid first.' };
    }
    if (hazardClass === 'benign') {
      return { id: 'hazard-instrumentation', label: 'Hazard-Driven Instrumentation', status: 'NOT APPLICABLE', detail: 'No hazardous-service classification for this fluid.' };
    }
    return { id: 'hazard-instrumentation', label: 'Hazard-Driven Instrumentation', status: 'RECOMMENDED',
      detail: 'Fluid is classified "' + hazardClass + '" (from the seal plan hazard table) — gas/vapor detection near the pump and a local leak-containment kerb are worth reviewing with the site\'s hazardous-area classification.' };
  }

  var GAUGE_ITEM = { id: 'suction-discharge-gauges', label: 'Suction and Discharge Pressure Gauges', status: 'RECOMMENDED',
    detail: 'A local pressure indicator (PI) at both the suction and discharge nozzles is standard practice for startup checks and ongoing condition monitoring, independent of duty.' };

  /* input = { sealPlanResult (Phase 9's selectSealPlan() output),
     topFamilyCategory (Phase 2's top family category id), pulsationResult
     and overpressureResult (Phase 14's screenPulsationDampening()/
     screenOverpressureProtection() outputs), mcsfFlow, mcsfFrac (Section
     08's minimum-continuous-stable-flow estimate), hazardClass (Phase 9's
     FLUID_SEAL_HAZARD lookup) } — every field the verbatim
     object/value app.js already holds. */
  function buildPidRequirements(input) {
    input = input || {};
    var items = [
      sealSupportItem(input.sealPlanResult),
      quenchItem(input.sealPlanResult),
      pulsationItem(input.pulsationResult, input.topFamilyCategory),
      reliefValveItem(input.overpressureResult, input.topFamilyCategory),
      minFlowLineItem(input.mcsfFlow, input.mcsfFrac),
      instrumentationItem(input.hazardClass),
      GAUGE_ITEM,
    ];
    return { items: items, status: 'CALCULATED' };
  }

  window.AROPUMPPID = { buildPidRequirements: buildPidRequirements, SEAL_SUPPORT_PIPING: SEAL_SUPPORT_PIPING };
})();

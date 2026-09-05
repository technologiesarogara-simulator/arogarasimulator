/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Operator Inspection Mode (14-point walkthrough content)
   window.AROPUMPINSPECTION

   Phase 20 of the Pump Hydraulics Advanced Upgrade.

   The physical walk/climb-to-equipment mechanics ALREADY EXIST — the ARO
   Workbench's operator avatar (window.ARO3D in lib/aro-workbench-3d.js)
   already walks to equipment, climbs ladders to platforms, and runs a
   generic geometric "operability report" (access paths, clearances,
   platform requirements) for whatever equipment nodes are placed in a
   workbench scene. That system is large (~7,400 lines), general-purpose,
   and works — it is NOT touched or rebuilt here.

   What it does not have — and what this phase adds — is PROCESS content
   for a pump-specific inspection stop: when an operator physically
   reaches a pump, what are the 14 things worth checking, and what does
   THIS pump's own calculation already say about each of them? That is
   a content problem, not a 3D/pathfinding one, so it is solved the same
   way as every other content phase in this suite: a pure engine that
   reads results Phases 1/6/7/8/9/10 (and this suite's own Phase 19 P&ID
   list) already computed, with zero new engineering judgement.

   buildInspectionPoints(...) is pure — no DOM, no ARO3D dependency.
   Loadable/unit-testable in Node like every other engine here.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Classifies an EXISTING status string (never re-derives the number
     behind it) into this suite's shared vocabulary, for a uniform badge
     next to text various phases already phrased in their own words. */
  function classifyStatusText(text) {
    if (!text) return 'DATA REQUIRED';
    var t = String(text).toUpperCase();
    if (t.indexOf('N/A') !== -1) return 'NOT APPLICABLE';
    if (t.indexOf('OVERLOAD') !== -1 || t.indexOf('ABOVE STANDARD') !== -1) return 'NOT RECOMMENDED';
    if (t.indexOf('HIGH') !== -1 || t.indexOf('OVERSIZED') !== -1) return 'CHECK';
    if (t.indexOf('NORMAL') !== -1 || t.indexOf('GOOD') !== -1) return 'SUITABLE';
    return 'DATA REQUIRED';
  }

  function cavStatus(cavType) {
    return cavType === 'ok' ? 'SUITABLE' : (cavType === 'warn' ? 'CHECK' : (cavType ? 'NOT RECOMMENDED' : 'DATA REQUIRED'));
  }

  function pt(no, label, status, detail) { return { no: no, label: label, status: status, detail: detail }; }

  function fromPidItem(pidItems, id, labelOverride) {
    var it = (pidItems || []).filter(function (i) { return i.id === id; })[0];
    if (!it) return { status: 'DATA REQUIRED', label: labelOverride, detail: 'Run the pump hydraulic calculation first.' };
    return { status: it.status, label: labelOverride || it.label, detail: it.detail };
  }

  /* input = { cavType, cavText (Phase 1's cavitation verdict/text),
     pSucA, pDischA (Phase 1's calculated absolute pressures, bar),
     motorStatus, motorLoading (Phase 1), bearingResult (Phase 8's
     screenAllBearingTypes()), sealPlanResult (Phase 9's
     selectSealPlan()), shaftResult (Phase 7's screenAllShaftMaterials()),
     mocCasing (Phase 6's screenMaterials() for the casing component),
     coupling (Phase 10's recommendCoupling()), driverEnclosure (Phase
     10's screenMotorEnclosure()), pidItems (Phase 19's
     buildPidRequirements().items — reused directly for the 3 points
     that are also P&ID line items, rather than re-deriving them) } */
  function buildInspectionPoints(input) {
    input = input || {};
    var points = [];

    points.push(pt(1, 'Cavitation / NPSH Margin', cavStatus(input.cavType), input.cavText || 'Run the pump hydraulic calculation first.'));

    points.push(pt(2, 'Suction & Discharge Pressure Readings',
      (isFinite(input.pSucA) && isFinite(input.pDischA)) ? 'RECOMMENDED' : 'DATA REQUIRED',
      (isFinite(input.pSucA) && isFinite(input.pDischA))
        ? 'Calculated: suction ' + input.pSucA.toFixed(3) + ' bar a, discharge ' + input.pDischA.toFixed(3) + ' bar a. Compare against the local gauges at each nozzle tapping.'
        : 'Run the pump hydraulic calculation first.'));

    points.push(pt(3, 'Motor Loading / Amperage', classifyStatusText(input.motorStatus),
      isFinite(input.motorLoading) ? 'Calculated loading ' + input.motorLoading.toFixed(1) + '% (' + input.motorStatus + '). Compare against the measured running amperage.' : (input.motorStatus || 'Run the pump hydraulic calculation first.')));

    var br = input.bearingResult;
    points.push(pt(4, 'Bearing Condition & Lubrication',
      (br && br.applicable) ? br.top.verdict : 'DATA REQUIRED',
      (br && br.applicable) ? br.top.bearingName + ', calculated L10 life ' + Math.round(br.top.L10h).toLocaleString() + ' h. Check for unusual noise, heat, or grease/oil condition.' : (br && br.reason)));

    var sl = input.sealPlanResult;
    points.push(pt(5, 'Mechanical Seal Faces (visual leak check)',
      (sl && sl.applicable) ? sl.top.verdict : 'DATA REQUIRED',
      (sl && sl.applicable) ? sl.top.name + ' selected — inspect for weeping or crystallized product at the seal gland.' : (sl && sl.reason)));

    var seal6 = fromPidItem(input.pidItems, 'seal-support', 'Seal Support System Level & Pressure');
    points.push(pt(6, seal6.label, seal6.status, seal6.detail));

    var co = input.coupling;
    if (co && co.status === 'NOT APPLICABLE') {
      points.push(pt(7, 'Coupling Guard & Alignment', 'NOT APPLICABLE', co.reason));
    } else {
      points.push(pt(7, 'Coupling Guard & Alignment', (co && co.applicable) ? co.top.verdict : 'DATA REQUIRED',
        (co && co.applicable) ? co.top.name + ' — confirm the guard is fitted and secure; alignment is a maintenance-mode task, not a running check.' : (co && co.reason)));
    }

    var sh = input.shaftResult;
    points.push(pt(8, 'Shaft Vibration / Critical Speed Margin',
      (sh && sh.applicable) ? sh.top.criticalVerdict : 'DATA REQUIRED',
      (sh && sh.applicable) ? 'First critical speed at ' + (sh.top.criticalSpeedRatio * 100).toFixed(0) + '% of running speed — listen/feel for abnormal vibration at the bearing housings.' : (sh && sh.reason)));

    var mc = input.mocCasing;
    points.push(pt(9, 'Casing External Condition / Corrosion',
      (mc && mc.applicable) ? mc.top.verdict : 'DATA REQUIRED',
      (mc && mc.applicable) ? mc.top.name + ' — inspect for external corrosion, coating damage, or gasket weeping at the casing split.' : (mc && mc.reason)));

    var minFlow10 = fromPidItem(input.pidItems, 'min-flow-line', 'Minimum-Flow Valve Position');
    points.push(pt(10, minFlow10.label, minFlow10.status, minFlow10.detail));

    var fndItems = (input.foundation && input.foundation.items) || null;
    var fndGrout = fndItems && fndItems.filter(function (i) { return i.id === 'grout-thickness'; })[0];
    if (fndGrout) {
      points.push(pt(11, 'Baseplate / Foundation Bolts & Grouting', fndGrout.status === 'NOT APPLICABLE' ? 'NOT APPLICABLE' : 'RECOMMENDED',
        fndGrout.detail + ' Visually check for cracked grout or loose hold-down bolts regardless.'));
    } else {
      points.push(pt(11, 'Baseplate / Foundation Bolts & Grouting', 'NOT APPLICABLE',
        'Foundation/baseplate sizing is a later item in this upgrade — shown here for a complete walkthrough list only, not yet a calculated selection. Visually check for cracked grout or loose hold-down bolts regardless.'));
    }

    var dr = input.driverEnclosure;
    points.push(pt(12, 'Driver Enclosure & Ventilation',
      (dr && dr.applicable) ? dr.top.verdict : 'DATA REQUIRED',
      (dr && dr.applicable) ? dr.top.name + ' enclosure, hazard class ' + dr.hazardClass + ' — check cooling fan/vents are unobstructed.' : (dr && dr.reason)));

    var relief13 = fromPidItem(input.pidItems, 'relief-valve', 'Relief Valve / Pulsation Dampener');
    var pulsation13 = fromPidItem(input.pidItems, 'pulsation-dampener', null);
    var combined13Detail = (relief13.status === 'NOT APPLICABLE' && pulsation13.status === 'NOT APPLICABLE')
      ? relief13.detail : (relief13.detail + (pulsation13.status !== 'NOT APPLICABLE' ? ' ' + pulsation13.detail : ''));
    var combined13Status = (relief13.status === 'NOT RECOMMENDED' || pulsation13.status === 'NOT RECOMMENDED') ? 'NOT RECOMMENDED'
      : (relief13.status === 'REQUIRED' || pulsation13.status === 'REQUIRED') ? 'REQUIRED' : relief13.status;
    points.push(pt(13, 'Relief Valve / Pulsation Dampener', combined13Status, combined13Detail));

    points.push(pt(14, 'General Housekeeping & Leak Check', 'RECOMMENDED',
      'Walk the full skid for pooled fluid, loose fasteners, missing guards, and unusual odor — independent of duty, on every physical round.'));

    return { points: points, status: 'CALCULATED' };
  }

  window.AROPUMPINSPECTION = { classifyStatusText: classifyStatusText, buildInspectionPoints: buildInspectionPoints };
})();

/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Reliability & Failure Analysis
   window.AROPUMPRELIABILITY

   Phase 23 of the Pump Hydraulics Advanced Upgrade.

   This is a diagnostic aid, not a design calculation: the operator picks
   a SYMPTOM they are actually observing (a USER-ENTERED CONDITION — data
   this app cannot verify, only take as reported), and for each candidate
   explanation this engine checks it against CALCULATED EVIDENCE this
   duty's own calculation already produced (NPSH margin, bearing/seal/
   shaft verdicts, motor loading, %BEP, PD overpressure screening) to see
   whether that evidence supports, is neutral on, or argues against the
   cause — producing a ranked list of POSSIBLE DIAGNOSTIC CAUSES. A cause
   this app has no way to check from a calculation (misalignment, wear-
   ring clearance, actual lubricant condition) is always labelled
   REQUIRES FIELD INSPECTION with a DATA REQUIRED support status — never
   silently promoted to "supported" or "ruled out."

   These three labels are never mixed: the symptom is always the user's
   report, calculated evidence is always read straight from an existing
   phase's result (reusing AROPUMPINSPECTION's own motor-status
   classifier rather than re-deriving it), and a possible cause's support
   level is always a plain comparison between the two — this file adds
   no new engineering formula.

   buildFailureAnalysis(...) and listSymptoms() are pure — no DOM.
   Loadable/unit-testable in Node like every other engine here.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SUPPORT_RANK = { 'SUPPORTED': 0, 'POSSIBLE': 1, 'NOT SUPPORTED': 2, 'DATA REQUIRED': 3, 'NOT APPLICABLE': 4 };

  var SYMPTOMS = {
    'cavitation-noise': { label: 'Cavitation Noise / Crackling at the Pump', causes: [
      { id: 'low-npsh-margin', cause: 'NPSH margin is insufficient at this operating point', evidenceKey: 'npsh' },
      { id: 'high-flow-left-of-curve', cause: 'Operating well above BEP flow, where NPSHr rises steeply', evidenceKey: 'pctBep-high' },
      { id: 'entrained-air', cause: 'Air or vapor entrainment at the suction line', evidenceKey: 'not-calculable' },
    ] },
    'seal-leak': { label: 'Mechanical Seal Leaking', causes: [
      { id: 'flashing-risk', cause: 'Tight NPSH margin can cause the fluid to flash at the seal faces', evidenceKey: 'flashing' },
      { id: 'wrong-seal-plan', cause: 'Selected seal plan may not suit this fluid\'s hazard/dirty-service classification', evidenceKey: 'seal-verdict' },
      { id: 'seal-support-not-installed', cause: 'Seal plan\'s support piping may not be installed/maintained as specified', evidenceKey: 'seal-support' },
    ] },
    'high-bearing-temp': { label: 'High Bearing Temperature', causes: [
      { id: 'inadequate-l10', cause: 'Selected bearing may be undersized for the calculated radial/axial load', evidenceKey: 'bearing-verdict' },
      { id: 'misalignment-bearing', cause: 'Coupling misalignment', evidenceKey: 'not-calculable' },
      { id: 'lubrication', cause: 'Incorrect lubricant grade, level, or contamination', evidenceKey: 'not-calculable' },
    ] },
    'high-vibration': { label: 'High Vibration', causes: [
      { id: 'critical-speed', cause: 'Running speed is close to the shaft\'s calculated first critical speed', evidenceKey: 'critical-speed' },
      { id: 'off-bep-operation', cause: 'Operating far from BEP, increasing radial hydraulic unbalance', evidenceKey: 'pctBep-far' },
      { id: 'bearing-wear', cause: 'Bearing wear or damage', evidenceKey: 'bearing-verdict' },
      { id: 'misalignment-vib', cause: 'Coupling misalignment', evidenceKey: 'not-calculable' },
    ] },
    'motor-overload': { label: 'Motor Overload Trip', causes: [
      { id: 'undersized-motor', cause: 'Motor may be undersized for the actual calculated brake power at this duty', evidenceKey: 'motor-loading' },
      { id: 'higher-viscosity', cause: 'Actual fluid viscosity or specific gravity may be higher than assumed, raising required power', evidenceKey: 'not-calculable' },
      { id: 'restricted-discharge', cause: 'Discharge may be throttled or blocked, raising head and power beyond design', evidenceKey: 'pd-overpressure' },
    ] },
  };

  function evaluateEvidence(key, e) {
    switch (key) {
      case 'npsh':
        if (!isFinite(e.npshMargin)) return na();
        if (e.npshMargin < 1) return supported('Calculated NPSH margin is only ' + e.npshMargin.toFixed(2) + ' m — tight enough to risk cavitation.');
        if (e.npshMargin < 3) return possible('Calculated NPSH margin is ' + e.npshMargin.toFixed(2) + ' m — moderate, worth checking against the actual pump curve.');
        return notSupported('Calculated NPSH margin is a comfortable ' + e.npshMargin.toFixed(2) + ' m — an NPSH shortfall is unlikely to be the cause.');
      case 'pctBep-high':
        if (!isFinite(e.opPctBep)) return na();
        if (e.opPctBep > 110) return supported('Operating at ' + e.opPctBep.toFixed(0) + '% of BEP — well above BEP, where NPSHr climbs steeply.');
        if (e.opPctBep > 100) return possible('Operating at ' + e.opPctBep.toFixed(0) + '% of BEP — modestly above BEP.');
        return notSupported('Operating at ' + e.opPctBep.toFixed(0) + '% of BEP — not running above BEP.');
      case 'pctBep-far':
        if (!isFinite(e.opPctBep)) return na();
        if (e.opPctBep < 70 || e.opPctBep > 120) return supported('Operating at ' + e.opPctBep.toFixed(0) + '% of BEP — well outside the preferred operating region.');
        if (e.opPctBep < 85 || e.opPctBep > 110) return possible('Operating at ' + e.opPctBep.toFixed(0) + '% of BEP — at the edge of the preferred operating region.');
        return notSupported('Operating at ' + e.opPctBep.toFixed(0) + '% of BEP — within the preferred operating region.');
      case 'flashing':
        if (!e.sealPlanResult || !e.sealPlanResult.applicable) return na();
        return e.sealPlanResult.flashingWarning
          ? supported(e.sealPlanResult.flashingWarning)
          : notSupported('No flashing risk was flagged for this duty\'s NPSH margin.');
      case 'seal-verdict':
        if (!e.sealPlanResult || !e.sealPlanResult.applicable) return na();
        var sv = e.sealPlanResult.top.verdict;
        if (sv === 'NOT RECOMMENDED') return supported('Selected seal plan verdict is NOT RECOMMENDED for this service.');
        if (sv === 'CHECK') return possible('Selected seal plan verdict is CHECK for this service.');
        return notSupported('Selected seal plan verdict is SUITABLE for this service.');
      case 'seal-support':
        if (!e.sealPlanResult || !e.sealPlanResult.applicable) return na();
        return { evidenceType: 'REQUIRES FIELD INSPECTION', supportStatus: 'DATA REQUIRED',
          evidenceText: 'This calculation cannot verify what is actually installed in the field — confirm the seal support piping (section 28) matches the selected plan and is in service.' };
      case 'bearing-verdict':
        if (!e.bearingResult || !e.bearingResult.applicable) return na();
        var bv = e.bearingResult.top.verdict;
        if (bv === 'NOT RECOMMENDED') return supported('Selected bearing verdict is NOT RECOMMENDED (L10 life ' + Math.round(e.bearingResult.top.L10h).toLocaleString() + ' h) for this load.');
        if (bv === 'CHECK') return possible('Selected bearing verdict is CHECK (L10 life ' + Math.round(e.bearingResult.top.L10h).toLocaleString() + ' h) for this load.');
        return notSupported('Selected bearing verdict is SUITABLE (L10 life ' + Math.round(e.bearingResult.top.L10h).toLocaleString() + ' h) for this load.');
      case 'critical-speed':
        if (!e.shaftResult || !e.shaftResult.applicable) return na();
        var ratio = e.shaftResult.top.criticalSpeedRatio;
        if (e.shaftResult.top.criticalVerdict === 'CHECK') return supported('First critical speed is only ' + (ratio * 100).toFixed(0) + '% of running speed — below the recommended 120% margin.');
        if (ratio < 1.4) return possible('First critical speed is ' + (ratio * 100).toFixed(0) + '% of running speed — a modest margin.');
        return notSupported('First critical speed is ' + (ratio * 100).toFixed(0) + '% of running speed — a healthy margin.');
      case 'motor-loading':
        if (!isFinite(e.motorLoading) || !e.motorStatus) return na();
        var cls = (typeof window !== 'undefined' && window.AROPUMPINSPECTION) ? window.AROPUMPINSPECTION.classifyStatusText(e.motorStatus) : 'DATA REQUIRED';
        if (cls === 'NOT RECOMMENDED') return supported('Calculated motor loading is ' + e.motorLoading.toFixed(1) + '% (' + e.motorStatus + ').');
        if (cls === 'CHECK') return possible('Calculated motor loading is ' + e.motorLoading.toFixed(1) + '% (' + e.motorStatus + ').');
        return notSupported('Calculated motor loading is ' + e.motorLoading.toFixed(1) + '% (' + e.motorStatus + ') — not running overloaded by this calculation.');
      case 'pd-overpressure':
        if (e.topFamilyCategory !== 'pd-rotary' && e.topFamilyCategory !== 'pd-reciprocating') {
          return { evidenceType: 'CALCULATED EVIDENCE', supportStatus: 'NOT APPLICABLE', evidenceText: 'Centrifugal duty — this cause is specific to a positive-displacement pump\'s constant-flow behavior.' };
        }
        if (!e.overpressureResult || !e.overpressureResult.applicable) return na();
        return e.overpressureResult.verdict === 'NOT RECOMMENDED'
          ? supported('Overpressure protection screening is NOT RECOMMENDED — ' + e.overpressureResult.message)
          : notSupported('Overpressure protection screening is SUITABLE — relief is sized for the rated flow.');
      case 'not-calculable':
      default:
        return { evidenceType: 'REQUIRES FIELD INSPECTION', supportStatus: 'DATA REQUIRED',
          evidenceText: 'This cause cannot be evaluated from calculated results — verify by physical inspection.' };
    }
    function supported(t) { return { evidenceType: 'CALCULATED EVIDENCE', supportStatus: 'SUPPORTED', evidenceText: t }; }
    function possible(t) { return { evidenceType: 'CALCULATED EVIDENCE', supportStatus: 'POSSIBLE', evidenceText: t }; }
    function notSupported(t) { return { evidenceType: 'CALCULATED EVIDENCE', supportStatus: 'NOT SUPPORTED', evidenceText: t }; }
    function na() { return { evidenceType: 'CALCULATED EVIDENCE', supportStatus: 'DATA REQUIRED', evidenceText: 'Run the pump hydraulic calculation first.' }; }
  }

  function listSymptoms() {
    return Object.keys(SYMPTOMS).map(function (id) { return { id: id, label: SYMPTOMS[id].label }; });
  }

  /* symptomId = the USER-ENTERED CONDITION (one of listSymptoms()'s ids).
     evidence = { npshMargin, opPctBep, sealPlanResult, bearingResult,
     shaftResult, motorLoading, motorStatus, topFamilyCategory,
     overpressureResult } — every field the verbatim object/value app.js
     already holds for that phase. */
  function buildFailureAnalysis(symptomId, evidence) {
    evidence = evidence || {};
    var symptom = SYMPTOMS[symptomId];
    if (!symptom) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'Select a reported symptom from the list.' };
    }
    var causes = symptom.causes.map(function (c) {
      var ev = evaluateEvidence(c.evidenceKey, evidence);
      return { id: c.id, cause: c.cause, evidenceType: ev.evidenceType, supportStatus: ev.supportStatus, evidenceText: ev.evidenceText };
    });
    causes.sort(function (a, b) { return SUPPORT_RANK[a.supportStatus] - SUPPORT_RANK[b.supportStatus]; });
    return { applicable: true, status: 'CALCULATED', symptomId: symptomId, symptomLabel: symptom.label, condition: 'USER-ENTERED CONDITION', causes: causes };
  }

  window.AROPUMPRELIABILITY = { listSymptoms: listSymptoms, buildFailureAnalysis: buildFailureAnalysis };
})();

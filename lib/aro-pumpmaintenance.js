/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Maintenance Mode: Clearance / Removal Envelopes
   window.AROPUMPMAINTENANCE

   Phase 21 of the Pump Hydraulics Advanced Upgrade.

   The ARO Workbench (lib/aro-workbench-3d.js) already computes a generic
   "maintenanceAccess"/"maintenanceConflict" verdict for any equipment
   node in a 3D scene, from that node's real modelled geometry versus
   whatever else is placed around it (found during Phase 20's
   investigation). That geometric clearance CHECK already exists and is
   untouched here.

   What it needs, and does not have for a pump specifically, is the
   pump's own REQUIRED clearance ENVELOPE to check space against — how
   much room does back-pull-out rotor withdrawal actually need, how much
   room does lifting the casing cover need. That is a mechanical-
   configuration question this suite already has the pieces for (Phase
   3's configuration pick, Phase 4's impeller OD, Phase 5's casing
   geometry, Phase 7's shaft overhang), so this engine assembles it —
   it introduces no new formula beyond simple envelope addition, and it
   never invents a dimension nothing upstream has computed (a coupling
   spacer's own length, for instance, is explicitly called out as not
   yet modelled rather than assumed).

   buildMaintenanceEnvelopes(...) is pure — no DOM. Loadable/unit-
   testable in Node like every other engine here.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Typical published guidance for casing/cover lift clearance is
     expressed as a multiple of the component's own largest diameter, to
     leave room for a sling/hoist angle and hand clearance around the
     lifted part — the same "typical ratio, documented, not a vendor
     drawing" pattern Phase 5's casing screening already uses for its own
     volute/cutwater coefficients. */
  var COVER_LIFT_MULTIPLIER = 1.5;

  function rotorWithdrawalEnvelope(configResult, shaftResult, eulerResult) {
    if (!configResult || !configResult.applicable) {
      return { id: 'rotor-withdrawal', label: 'Back-Pull-Out Rotor Withdrawal Envelope', status: 'DATA REQUIRED',
        detail: (configResult && configResult.reason) || 'Run the pump hydraulic calculation and let configuration selection (section 04) finish first.' };
    }
    var top = configResult.top;
    var isBpoCapable = (top.couplingType === 'flexible' || top.couplingType === 'flexible with spacer')
      && top.bearingFrame === 'separate bearing housing';
    if (!isBpoCapable) {
      return { id: 'rotor-withdrawal', label: 'Back-Pull-Out Rotor Withdrawal Envelope', status: 'NOT APPLICABLE',
        detail: 'Selected configuration (' + top.id + ') has a "' + top.bearingFrame + '" bearing frame with a "' + top.couplingType
          + '" coupling — back-pull-out withdrawal (bearing frame, shaft and impeller out the back without disturbing the casing or piping) does not apply to this arrangement.' };
    }
    if (!shaftResult || !shaftResult.applicable || !eulerResult || !eulerResult.applicable) {
      return { id: 'rotor-withdrawal', label: 'Back-Pull-Out Rotor Withdrawal Envelope', status: 'DATA REQUIRED',
        detail: 'This configuration is back-pull-out capable, but the shaft overhang (section 06) and impeller OD (section 03) both have to be calculated first.' };
    }
    var clearance_mm = (shaftResult.top.overhang_m + eulerResult.D2_m) * 1000;
    return {
      id: 'rotor-withdrawal', label: 'Back-Pull-Out Rotor Withdrawal Envelope', status: 'PRELIMINARY ASSUMPTION',
      clearance_mm: clearance_mm,
      detail: 'At least ' + Math.round(clearance_mm) + ' mm of clear axial space behind the driver (calculated shaft overhang '
        + Math.round(shaftResult.top.overhang_m * 1000) + ' mm + impeller OD ' + Math.round(eulerResult.D2_m * 1000)
        + ' mm) to slide the bearing frame, shaft and impeller out as one assembly. This does NOT yet include the coupling spacer\'s own length — add it once a vendor coupling is selected, since no coupling dimension is modelled at this stage.',
    };
  }

  function casingCoverEnvelope(casingResult) {
    if (!casingResult || !casingResult.applicable) {
      return { id: 'casing-cover-clearance', label: 'Casing Cover Lift Clearance', status: 'DATA REQUIRED',
        detail: (casingResult && casingResult.reason) || 'Run the pump hydraulic calculation and let casing screening (section 05) finish first.' };
    }
    var clearance_mm = casingResult.cutwater.casingID_mm * COVER_LIFT_MULTIPLIER;
    return {
      id: 'casing-cover-clearance', label: 'Casing Cover Lift Clearance', status: 'PRELIMINARY ASSUMPTION',
      clearance_mm: clearance_mm,
      detail: 'At least ' + Math.round(clearance_mm) + ' mm of clear overhead space (' + COVER_LIFT_MULTIPLIER
        + '× the calculated casing bore, ' + Math.round(casingResult.cutwater.casingID_mm)
        + ' mm) to sling and lift the casing cover clear for internal inspection — a typical published ratio, not a vendor lifting drawing.',
    };
  }

  /* input = { configResult (Phase 3's AROPUMPCONFIG selection, .top has
     couplingType/bearingFrame), shaftResult (Phase 7's
     screenAllShaftMaterials(), .top has overhang_m), eulerResult (Phase 4's
     eulerHead(), has D2_m), casingResult (Phase 5's screenCasing(), has
     cutwater.casingID_mm) } — every field the verbatim object app.js
     already holds for that phase. */
  function buildMaintenanceEnvelopes(input) {
    input = input || {};
    var items = [
      rotorWithdrawalEnvelope(input.configResult, input.shaftResult, input.eulerResult),
      casingCoverEnvelope(input.casingResult),
    ];
    return { items: items, status: 'CALCULATED' };
  }

  window.AROPUMPMAINTENANCE = { COVER_LIFT_MULTIPLIER: COVER_LIFT_MULTIPLIER, buildMaintenanceEnvelopes: buildMaintenanceEnvelopes };
})();

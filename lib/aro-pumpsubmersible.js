/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Submersible Pump Mechanical Design (screening) engine
   window.AROPUMPSUBMERSIBLE

   Pump build Step 5. Pure calculation module — no DOM access — same
   "one IIFE, one namespace" pattern as the other pump engines, loadable
   and unit-testable in Node with nothing but `global.window = global`.

   PURPOSE
   A submersible pump IS a centrifugal pump — Phase 4/5/7/8's Euler
   head, casing, shaft and L10 bearing screening already run for it
   exactly as they do for a dry-mounted centrifugal, and this module
   does not re-derive any of that. It adds only what is genuinely
   different about a submerged, wet-motor machine, for whichever of the
   four PUMP_SELECTION_STANDARD submersible rows Section 10 picked
   (dewatering/sump, sewage/wastewater, borehole/turbine, or slurry):
     1. screenSealCartridge() — a sealed dual-mechanical-seal-and-oil-
        barrier-chamber design, the standard submersible seal
        arrangement. This is NOT the API 682 piped piping-plan screening
        Phase 9 (AROPUMPSEAL) already runs generically for every family
        — a submersible's seals are a self-contained cartridge, not
        plumbed to an external flush/quench system, so Plans 11-53A
        genuinely do not apply here; this screens the cartridge's own
        two faces and its moisture-sensor practice instead.
     2. cableEntryNote() — the potted/molded IP68 cable-entry guidance
        every submersible needs, escalated for continuous-duty branches
        and (for the borehole branch specifically) the column/cable
        voltage-drop caveat PUMP_SELECTION_STANDARD's own row already
        carries.
     3. selectDischargeConfig() — the mechanical discharge interface,
        which differs materially by branch: a portable hose/camlock
        connection for dewatering, a guide-rail auto-coupling discharge
        elbow for a permanently installed lift-station or slurry unit,
        or a threaded/flanged column-pipe connection for a borehole
        unit.
     4. verticalThrustAddition() — the one correction the reused
        centrifugal bearing screening needs: a submersible's shaft is
        vertical, so the rotor's own weight loads the THRUST bearing
        (adds to axial load), not the radial bearing the way it would
        on a horizontal machine — the caller adds this to the axial
        thrust Phase 8 already estimates before re-screening.

   WHAT THIS IS NOT
   - Not a vendor submersible pump selection. Seal-face and oil-chamber
     guidance is typical published practice, not a manufacturer's
     cartridge design.
   - Not an electrical cable-sizing calculation. The cable-entry note is
     qualitative construction guidance (IP68 potted entry, continuous-
     submersion cable rating) — actual conductor sizing is a separate
     electrical calculation this module does not perform.

   STANDARDS BASIS: HI (Hydraulic Institute) submersible pump standards;
   no single API standard applies — the same citation
   PUMP_SELECTION_STANDARD carries for all four submersible rows.

   API
     AROPUMPSUBMERSIBLE.SUB_BRANCHES
     AROPUMPSUBMERSIBLE.screenSealCartridge(input)
     AROPUMPSUBMERSIBLE.cableEntryNote(subBranchId)
     AROPUMPSUBMERSIBLE.selectDischargeConfig(subBranchId)
     AROPUMPSUBMERSIBLE.verticalThrustAddition(rotorWeight_N)
     AROPUMPSUBMERSIBLE.design(input) — full orchestration of all of the above
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERDICT_RANK = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  function worse(a, b) { return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b; }

  var SUB_BRANCHES = {
    'submersible-dewatering': { name: 'Dewatering / Sump', duty: 'intermittent',
      dischargeType: 'portable-hose', dischargeNote: 'A portable hose/camlock (or threaded) discharge connection — no guide-rail hardware, since the unit is meant to be relocated between excavations, trenches and sumps rather than permanently installed.' },
    'submersible-sewage': { name: 'Sewage / Wastewater', duty: 'continuous',
      dischargeType: 'guide-rail-auto-coupling', dischargeNote: 'A guide-rail auto-coupling discharge elbow bolted to the wet-well floor — standard lift-station practice, letting the pump be lowered onto and lifted off the elbow on its rail without anyone entering the wet well.' },
    'submersible-borehole': { name: 'Borehole / Turbine', duty: 'continuous',
      dischargeType: 'column-pipe', dischargeNote: 'A threaded or flanged connection directly to the column pipe (the rising main) — a fundamentally different interface than a guide-rail system, since the whole unit is set down the well on that column pipe, not lowered onto a floor-mounted elbow.' },
    'submersible-slurry': { name: 'Slurry', duty: 'continuous',
      dischargeType: 'guide-rail-auto-coupling-heavy', dischargeNote: 'A heavy-duty guide-rail auto-coupling discharge elbow and bracket, sized for the added mass of wear-resistant wetted parts — the same principle as the sewage/wastewater branch\'s rail system, built to a more robust standard for mining/dredging duty.' },
  };

  /* ── screenSealCartridge ─────────────────────────────────────────────
     input = { corrosivityClass ('mild'|'moderate'|'severe'), abrasives
     (bool), subBranchId } */
  var CORROSIVITY_FACE = {
    mild: 'Carbon-Graphite vs Ceramic (Al₂O₃)',
    moderate: 'Carbon-Graphite vs Silicon Carbide',
    severe: 'Silicon Carbide vs Silicon Carbide',
  };

  function screenSealCartridge(input) {
    input = input || {};
    var corrosivityClass = input.corrosivityClass, abrasives = !!input.abrasives, subBranchId = input.subBranchId;
    var branch = SUB_BRANCHES[subBranchId];

    var lowerFace = abrasives ? 'Silicon Carbide vs Silicon Carbide' : (CORROSIVITY_FACE[corrosivityClass] || CORROSIVITY_FACE.mild);
    var lowerReason = abrasives
      ? 'Hard-vs-hard pairing to resist the abrasive solids in this duty — the same face selection an abrasive-slurry dry-pit seal would use.'
      : 'Selected against the fluid\'s ' + (corrosivityClass || 'assumed mild') + ' corrosivity, the same tolerance ladder Phase 9\'s seal-face screening uses.';

    var upperFace = 'Carbon-Graphite vs Ceramic (Al₂O₃)';
    var upperReason = 'The upper (oil-chamber-side) seal only ever sees clean barrier oil regardless of the process fluid, so the base pairing is standard practice here even on a severe-duty lower seal.';

    var moistureVerdict = (branch && branch.duty === 'continuous') ? 'SUITABLE' : 'CHECK';
    var moistureNote = (branch && branch.duty === 'continuous')
      ? 'A moisture/oil-condition sensor in the barrier chamber is standard practice for continuous-duty submersible service — it gives an early warning of lower-seal wear long before water reaches the motor windings.'
      : 'A moisture/oil-condition sensor is worth specifying even on an intermittent-duty portable unit, though many lower-cost dewatering pumps ship without one — a cost/criticality trade-off, not a hard requirement.';

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION',
      lowerFace: lowerFace, lowerReason: lowerReason,
      upperFace: upperFace, upperReason: upperReason,
      moistureVerdict: moistureVerdict, moistureNote: moistureNote,
    };
  }

  function cableEntryNote(subBranchId) {
    var branch = SUB_BRANCHES[subBranchId];
    var base = 'IP68 potted/molded cable entry with a strain-relief grommet — a continuous-submersion-rated cable (not general-purpose flexible cord) is required end to end, sealed at the gland with an epoxy or elastomer potting compound, not a simple compression fitting.';
    if (subBranchId === 'submersible-borehole') {
      return base + ' Borehole duty adds its own check: column and drop-cable length both add real head loss and voltage drop that has to be calculated for the actual set depth, not assumed away — the longer the run, the more this matters.';
    }
    if (branch && branch.duty === 'continuous') {
      return base + ' Continuous-duty service — inspect the cable entry and jacket at every scheduled pull, not only on failure.';
    }
    return base + ' Intermittent portable duty still needs the same IP68 entry — frequent handling between relocations is, if anything, harder on the cable jacket than a permanent installation.';
  }

  function selectDischargeConfig(subBranchId) {
    var branch = SUB_BRANCHES[subBranchId];
    if (!branch) return { applicable: false, status: 'DATA REQUIRED', reason: 'Unknown submersible branch "' + subBranchId + '".' };
    return { applicable: true, status: 'PRELIMINARY ASSUMPTION', dischargeType: branch.dischargeType, note: branch.dischargeNote };
  }

  function verticalThrustAddition(rotorWeight_N) {
    if (!isFinite(rotorWeight_N) || rotorWeight_N < 0) return { applicable: false };
    return {
      applicable: true, addedAxial_N: rotorWeight_N,
      note: 'Vertical shaft orientation — the rotor\'s own weight (' + rotorWeight_N.toFixed(0) + ' N) loads the thrust bearing directly, adding to the hydraulic axial thrust already estimated, rather than adding to radial load the way it would on a horizontal machine.',
    };
  }

  /* ── design: full orchestration ─────────────────────────────────────
     input = { subBranchId, corrosivityClass, abrasives, rotorWeight_N } */
  function design(input) {
    input = input || {};
    var branch = SUB_BRANCHES[input.subBranchId];
    if (!branch) return { applicable: false, status: 'DATA REQUIRED', reason: 'Unknown submersible branch "' + input.subBranchId + '".' };

    var sealCartridge = screenSealCartridge({ corrosivityClass: input.corrosivityClass, abrasives: input.abrasives, subBranchId: input.subBranchId });
    var cableNote = cableEntryNote(input.subBranchId);
    var dischargeConfig = selectDischargeConfig(input.subBranchId);
    var verticalThrust = verticalThrustAddition(input.rotorWeight_N);

    return {
      applicable: true, status: 'PRELIMINARY ASSUMPTION',
      subBranchId: input.subBranchId, subBranchName: branch.name, duty: branch.duty,
      standardsBasis: 'HI (Hydraulic Institute) submersible pump standards; no single API standard applies',
      sealCartridge: sealCartridge, cableEntryNote: cableNote, dischargeConfig: dischargeConfig, verticalThrust: verticalThrust,
    };
  }

  window.AROPUMPSUBMERSIBLE = {
    SUB_BRANCHES: SUB_BRANCHES,
    screenSealCartridge: screenSealCartridge,
    cableEntryNote: cableEntryNote,
    selectDischargeConfig: selectDischargeConfig,
    verticalThrustAddition: verticalThrustAddition,
    design: design,
  };
})();

/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Selected-Pump Live Panel — archetype & fabrication-parts data
   window.AROPUMPLIVEPANEL

   Section 10 (lib/aro-pumpfamily.js) ranks all 23 PUMP_SELECTION_STANDARD
   rows against the entered duty and picks a top family, or the engineer
   overrides that pick with any other ranked row. Whichever family is
   selected, this engine answers: what does that machine actually look
   like, what does it take to fabricate one, and how does the live duty
   (flow, head, nozzles, elevation, fluid) sit on top of it? The results
   page's live 3D/fabrication panel and its 2D isometric drawing both
   read this same data so they can never disagree with each other.

   This file is DATA ONLY — no DOM, no Three.js, no SVG. It groups the 23
   individual family ids into a small set of VISUAL ARCHETYPES (a "Split-
   Case Centrifugal" and an "End-Suction Centrifugal" are different rows
   in the standard but the same basic horizontal-centrifugal shape and
   fabrication story for this panel's purposes) and carries a real
   fabrication-parts list per archetype. Nothing here is invented per
   individual family beyond what the standard table (aro-pumpstandard.js)
   already states — driveType/connectionType come from that row's own
   sealless/noRotatingShaft/selfPriming/standardsBasis fields wherever
   they exist, not a new guess.

   buildLivePumpPanelData(...) is pure and unit-testable in Node like
   every other engine in this suite.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── visual/fabrication archetypes ──────────────────────────────────
     Each entry: label (what the 3D viewer/drawing titles itself),
     flowPath (short description of the wetted path, used as the
     animated-flow caption), and fabricationParts — the parts a shop
     drawing for this machine shape actually needs, independent of any
     one row's numbers. materialRole flags which parts the live MOC
     (material-of-construction) screening result should label; parts
     with no materialRole are commodity/bought-out items this suite
     does not material-screen (fasteners, gaskets, motor frame). */
  var ARCHETYPES = {
    'centrifugal-horizontal': {
      label: 'Horizontal Centrifugal',
      flowPath: 'Suction nozzle → impeller eye → volute/diffuser → discharge nozzle',
      fabricationParts: [
        { tag: 'casing', label: 'Volute casing', materialRole: 'casing' },
        { tag: 'impeller', label: 'Impeller', materialRole: 'impeller' },
        { tag: 'shaft', label: 'Shaft', materialRole: 'shaft' },
        { tag: 'seal', label: 'Mechanical seal / seal chamber', materialRole: null },
        { tag: 'bearing-housing', label: 'Bearing housing', materialRole: null },
        { tag: 'coupling', label: 'Coupling', materialRole: null },
        { tag: 'baseplate', label: 'Baseplate', materialRole: null },
        { tag: 'suction-nozzle', label: 'Suction nozzle (flanged)', materialRole: 'casing' },
        { tag: 'discharge-nozzle', label: 'Discharge nozzle (flanged)', materialRole: 'casing' }
      ]
    },
    'centrifugal-vertical': {
      label: 'Vertical Centrifugal / Turbine',
      flowPath: 'Submerged first-stage bowl → column pipe stages → discharge head → discharge nozzle',
      fabricationParts: [
        { tag: 'bowl-assembly', label: 'Bowl assembly (stages)', materialRole: 'casing' },
        { tag: 'impeller', label: 'Impeller(s)', materialRole: 'impeller' },
        { tag: 'line-shaft', label: 'Line shaft', materialRole: 'shaft' },
        { tag: 'column-pipe', label: 'Column pipe', materialRole: null },
        { tag: 'discharge-head', label: 'Discharge head', materialRole: 'casing' },
        { tag: 'line-bearings', label: 'Line shaft bearings', materialRole: null },
        { tag: 'discharge-nozzle', label: 'Discharge nozzle (flanged)', materialRole: 'casing' }
      ]
    },
    'submersible': {
      label: 'Submersible',
      flowPath: 'Suction strainer → impeller → volute → discharge elbow → riser pipe to surface',
      fabricationParts: [
        { tag: 'motor-housing', label: 'Submersible motor housing (sealed)', materialRole: 'casing' },
        { tag: 'seal-cartridge', label: 'Seal cartridge (dual, oil-isolated)', materialRole: null },
        { tag: 'volute', label: 'Volute / pump end casing', materialRole: 'casing' },
        { tag: 'impeller', label: 'Impeller', materialRole: 'impeller' },
        { tag: 'shaft', label: 'Shaft', materialRole: 'shaft' },
        { tag: 'cable-entry', label: 'Cable entry gland', materialRole: null },
        { tag: 'discharge-elbow', label: 'Discharge elbow / flange', materialRole: 'casing' },
        { tag: 'guide-rail-coupling', label: 'Guide-rail / coupling foot (if wet-well mounted)', materialRole: null }
      ]
    },
    'screw': {
      label: 'Screw Pump',
      flowPath: 'Suction nozzle → intermeshing screw rotors (axial) → discharge nozzle',
      fabricationParts: [
        { tag: 'barrel', label: 'Barrel / stator housing', materialRole: 'casing' },
        { tag: 'rotors', label: 'Screw rotor(s)', materialRole: 'impeller' },
        { tag: 'timing-gears', label: 'Timing gears (twin/triple only)', materialRole: null },
        { tag: 'shaft', label: 'Drive shaft', materialRole: 'shaft' },
        { tag: 'seal', label: 'Mechanical seal', materialRole: null },
        { tag: 'bearing-housing', label: 'Bearing housing', materialRole: null },
        { tag: 'suction-nozzle', label: 'Suction nozzle (flanged)', materialRole: 'casing' },
        { tag: 'discharge-nozzle', label: 'Discharge nozzle (flanged)', materialRole: 'casing' }
      ]
    },
    'gear-lobe-vane': {
      label: 'Gear / Lobe / Vane Pump',
      flowPath: 'Suction port → meshing rotor set carries fluid around the casing → discharge port',
      fabricationParts: [
        { tag: 'casing', label: 'Pump casing / body', materialRole: 'casing' },
        { tag: 'rotors', label: 'Rotor set (gears / lobes / vanes)', materialRole: 'impeller' },
        { tag: 'timing-gears', label: 'External timing gears (lobe pumps)', materialRole: null },
        { tag: 'shaft', label: 'Drive shaft', materialRole: 'shaft' },
        { tag: 'seal', label: 'Mechanical seal', materialRole: null },
        { tag: 'front-cover', label: 'Front cover / wear plate', materialRole: 'casing' },
        { tag: 'suction-nozzle', label: 'Suction port (flanged/threaded)', materialRole: 'casing' },
        { tag: 'discharge-nozzle', label: 'Discharge port (flanged/threaded)', materialRole: 'casing' }
      ]
    },
    'progressive-cavity': {
      label: 'Progressive Cavity (Mono/Eccentric-Screw)',
      flowPath: 'Suction → helical rotor turning inside the elastomeric stator forms moving cavities → discharge',
      fabricationParts: [
        { tag: 'stator', label: 'Elastomeric stator', materialRole: null },
        { tag: 'rotor', label: 'Helical rotor', materialRole: 'impeller' },
        { tag: 'connecting-rod', label: 'Connecting rod / universal joint', materialRole: null },
        { tag: 'shaft', label: 'Drive shaft', materialRole: 'shaft' },
        { tag: 'seal', label: 'Mechanical seal / packing', materialRole: null },
        { tag: 'suction-hopper', label: 'Suction hopper/nozzle', materialRole: 'casing' },
        { tag: 'discharge-nozzle', label: 'Discharge nozzle (flanged)', materialRole: 'casing' }
      ]
    },
    'peristaltic': {
      label: 'Rotary Tube (Roller) Pump',
      flowPath: 'Suction tube → rollers/shoes compress the tube against the casing track, pushing a fluid slug forward → discharge tube',
      fabricationParts: [
        { tag: 'casing-track', label: 'Casing track (lubricated or dry-run)', materialRole: null },
        { tag: 'tube', label: 'Pump tube (elastomer, wear item)', materialRole: null },
        { tag: 'rotor-rollers', label: 'Rotor with rollers or shoes', materialRole: null },
        { tag: 'shaft', label: 'Drive shaft', materialRole: 'shaft' },
        { tag: 'tube-clamps', label: 'Tube end clamps / connectors', materialRole: null },
        { tag: 'suction-tube', label: 'Suction tube connection', materialRole: null },
        { tag: 'discharge-tube', label: 'Discharge tube connection', materialRole: null }
      ]
    },
    'reciprocating-piston': {
      label: 'Plunger / Piston Pump',
      flowPath: 'Suction check valve → cylinder bore (plunger/piston reciprocates) → discharge check valve → dampener → discharge nozzle',
      fabricationParts: [
        { tag: 'power-end', label: 'Power end (crankshaft/crosshead)', materialRole: null },
        { tag: 'fluid-cylinder', label: 'Fluid cylinder / liner', materialRole: 'casing' },
        { tag: 'plunger-piston', label: 'Plunger / piston', materialRole: 'impeller' },
        { tag: 'packing-seal', label: 'Packing (plunger) or piston seal', materialRole: null },
        { tag: 'check-valves', label: 'Suction + discharge check valves', materialRole: 'casing' },
        { tag: 'dampener', label: 'Pulsation dampener', materialRole: null },
        { tag: 'suction-nozzle', label: 'Suction manifold (flanged)', materialRole: 'casing' },
        { tag: 'discharge-nozzle', label: 'Discharge manifold (flanged)', materialRole: 'casing' }
      ]
    },
    'diaphragm': {
      label: 'Diaphragm Pump',
      flowPath: 'Suction check valve → diaphragm chamber (mechanically or hydraulically stroked, or air-driven) → discharge check valve',
      fabricationParts: [
        { tag: 'diaphragm', label: 'Diaphragm (elastomer, wear item)', materialRole: null },
        { tag: 'fluid-chamber', label: 'Fluid chamber / head', materialRole: 'casing' },
        { tag: 'check-valves', label: 'Suction + discharge check valves/balls', materialRole: 'casing' },
        { tag: 'drive-mechanism', label: 'Drive mechanism (mechanical linkage, hydraulic oil side, or air valve)', materialRole: null },
        { tag: 'suction-nozzle', label: 'Suction connection', materialRole: 'casing' },
        { tag: 'discharge-nozzle', label: 'Discharge connection', materialRole: 'casing' }
      ]
    }
  };

  /* Every one of the 23 PUMP_SELECTION_STANDARD ids maps to exactly one
     archetype above. Kept as an explicit table (not inferred from
     category) because two rows sharing a category can still need
     different shapes — axial-mixed-flow reads 'centrifugal' but looks
     nothing like an end-suction pump. */
  var FAMILY_TO_ARCHETYPE = {
    'esc-oh2': 'centrifugal-horizontal',
    'split-case': 'centrifugal-horizontal',
    'self-priming-centrifugal': 'centrifugal-horizontal',
    'canned-motor-centrifugal': 'centrifugal-horizontal',
    'mag-drive': 'centrifugal-horizontal',
    'vs-turbine-deepwell': 'centrifugal-vertical',
    'axial-mixed-flow': 'centrifugal-vertical',
    'submersible-dewatering': 'submersible',
    'submersible-sewage': 'submersible',
    'submersible-borehole': 'submersible',
    'submersible-slurry': 'submersible',
    'screw-pump': 'screw',
    'gear-external': 'gear-lobe-vane',
    'gear-internal': 'gear-lobe-vane',
    'lobe-rotary': 'gear-lobe-vane',
    'vane-pump': 'gear-lobe-vane',
    'pc-pump': 'progressive-cavity',
    'peristaltic-hose': 'peristaltic',
    'plunger-pump': 'reciprocating-piston',
    'piston-pump': 'reciprocating-piston',
    'diaphragm-mechanical': 'diaphragm',
    'diaphragm-metering': 'diaphragm',
    'aodd': 'diaphragm'
  };

  function connectionTypeFor(row) {
    if (!row) return null;
    if (row.id === 'peristaltic-hose') return 'Tube connection (barbed/clamped)';
    if (row.id === 'aodd') return 'Hose or threaded connection';
    if (row.category === 'pd-reciprocating') return 'Flanged manifold connection';
    return 'Flanged connection (ASME B16.5 / ISO equivalent)';
  }

  function driveTypeFor(row) {
    if (!row) return null;
    if (row.noRotatingShaft) return 'No rotating shaft — ' + (row.id === 'aodd' ? 'compressed-air actuated' : 'diaphragm-driven, isolated from the drive');
    if (row.sealless) return 'Sealless — ' + (row.id === 'canned-motor-centrifugal' ? 'process-lubricated canned motor' : 'magnetic coupling across a containment shell');
    if (row.id === 'lobe-rotary' || row.id === 'screw-pump') return 'External timing gears, direct or belt-coupled driver';
    return 'Direct-coupled or belt-driven, motor-driven';
  }

  /* input = { familyId, duty:{Q_m3h,H_m,fluidLabel,dischargePressureBarG,
     dischargeElevationM}, nozzles:{suction,discharge} (already-computed
     nozzle sizing labels from the results page, passed through
     unchanged), moc:{casing,impeller,shaft} (already-computed
     AROPUMPMOC verdicts, passed through unchanged) } */
  function buildLivePumpPanelData(input) {
    input = input || {};
    var row = window.AROPUMPSTANDARD ? window.AROPUMPSTANDARD.byId(input.familyId) : null;
    if (!row) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'No family selected yet — run the pump hydraulic calculation and Section 10 will pick one.' };
    }
    var archKey = FAMILY_TO_ARCHETYPE[row.id];
    var arch = ARCHETYPES[archKey];
    if (!arch) {
      return { applicable: false, status: 'DATA REQUIRED', reason: 'No visual archetype mapped for family "' + row.id + '".' };
    }
    var duty = input.duty || {};
    return {
      applicable: true,
      familyId: row.id,
      familyName: row.name,
      category: row.category,
      fullTrack: !!row.fullTrack,
      archetype: { key: archKey, label: arch.label, flowPath: arch.flowPath },
      fabricationParts: arch.fabricationParts,
      connectionType: connectionTypeFor(row),
      driveType: driveTypeFor(row),
      selfPriming: row.selfPriming,
      standardsBasis: row.standardsBasis,
      dutyReadout: {
        Q_m3h: isFinite(duty.Q_m3h) ? duty.Q_m3h : null,
        H_m: isFinite(duty.H_m) ? duty.H_m : null,
        dischargePressureBarG: isFinite(duty.dischargePressureBarG) ? duty.dischargePressureBarG : null,
        dischargeElevationM: isFinite(duty.dischargeElevationM) ? duty.dischargeElevationM : null,
        fluidLabel: duty.fluidLabel || null
      },
      nozzles: input.nozzles || null,
      moc: input.moc || null
    };
  }

  window.AROPUMPLIVEPANEL = {
    ARCHETYPES: ARCHETYPES,
    FAMILY_TO_ARCHETYPE: FAMILY_TO_ARCHETYPE,
    buildLivePumpPanelData: buildLivePumpPanelData
  };
})();

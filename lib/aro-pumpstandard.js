/* ══════════════════════════════════════════════════════════════════════
   AROGARA — PUMP SELECTION STANDARD  (window.PUMP_SELECTION_STANDARD)

   The TEMA-MODEL equivalent for pump selection: one structured reference
   table covering the realistic full set of industrial pump types, so
   Section 10's ranking engine has real selection criteria to score
   against instead of an envelope chart alone, and so a user comparing
   two families sees a real reason one beat the other — application,
   limitations, self-priming, numeric range, fluid suitability, viscosity
   behaviour, NPSH character, efficiency band, standards basis — the same
   way TEMA lets someone pick AES vs BEU and know exactly what they're
   choosing between.

   This file is DATA AND LOOKUP ONLY. It does not rank against a duty
   point (that is Phase 2, the rebuilt Section 10 engine in
   lib/aro-pumpfamily.js, which will read PUMP_SELECTION_STANDARD as its
   source instead of its own smaller FAMILIES array) and it does not
   drive any mechanical design (Phase 3+, the six full-track families).
   Adding a pump type later is a data-entry task here, not a rewrite of
   the engine that reads it.

   WHERE THE NUMBERS COME FROM. Order-of-magnitude screening ranges from
   standard pump-engineering references (Hydraulic Institute standards,
   API scope statements, Perry's Chemical Engineers' Handbook, Karassik's
   Pump Handbook, and common manufacturer catalogue ranges) — the same
   basis the existing AROPUMPFAMILY.FAMILIES seed set already used for the
   17 types it covered. Never a vendor-certified curve. Where no single
   citable figure exists for a cell (most reciprocating/PD efficiency
   bands, hose-life estimates, some reference-only families' standards
   basis), the cell says "typical practice — manufacturer-specific"
   rather than inventing false precision.

   ROW COVERAGE (23 rows, matching the build spec exactly):
     Centrifugal (7): end-suction, split-case, vertical turbine/deep-well,
       self-priming, canned-motor sealless, magnetic-drive sealless,
       axial/mixed-flow.
     Submersible (4, all fullTrack): dewatering/sump, sewage/wastewater,
       borehole/turbine multistage, slurry.
     PD-rotary (7): screw, external gear, internal gear, lobe, vane,
       progressive cavity, peristaltic/hose.
     PD-reciprocating (5): plunger, piston, diaphragm (mechanically
       actuated), diaphragm (hydraulically actuated / metering), AODD.

   fullTrack:true marks the 12 rows the build spec gives complete
   mechanical design + visualization + fabrication depth (Section 4):
   end-suction centrifugal (already built, Sections 11-19), the four
   submersible sub-types, screw, external gear, internal gear, lobe,
   peristaltic, plunger, piston. Every other row is reference-level data
   only — real numbers, no drawing, and the UI must say so plainly
   rather than borrowing another family's drawing.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Selection-affecting boolean flags, read directly by the new Section 1
     inputs in Phase 2 (abrasives / shear-sensitive / dry-run / pulsation-
     smooth-flow / hygienic). Kept on each row now so the ranking engine
     rewrite doesn't need to touch this table's shape again. */
  function suit(o) {
    return {
      clean: !!o.clean, viscous: !!o.viscous, abrasiveSlurry: !!o.abrasiveSlurry,
      shearSensitive: !!o.shearSensitive, corrosive: !!o.corrosive,
      hazardousToxic: !!o.hazardousToxic, cryogenic: !!o.cryogenic,
      hygienicSanitary: !!o.hygienicSanitary
    };
  }

  var MANUF_SPECIFIC = 'typical practice — manufacturer-specific';
  var NO_SINGLE_STANDARD = 'No single standard applies — manufacturer practice';

  var PUMP_SELECTION_STANDARD = [

    // ══════════════════════════════════ CENTRIFUGAL ══════════════════════════════════
    {
      id: 'esc-oh2', name: 'End Suction Centrifugal (ANSI/ISO, OH2)', category: 'centrifugal', apiClass: 'OH2',
      fullTrack: true,
      application: 'General-purpose process duty; the default screening candidate for most water-like services.',
      keyLimitations: 'Performance falls off sharply above roughly 3000 cSt viscosity; needs adequate NPSHa margin; not tolerant of dry running or entrained abrasives without a slurry-duty wet end.',
      selfPriming: 'No',
      flowRangeM3h: [5, 500], headRangeM: [5, 120], maxDiffPressureBar: null,
      tempRangeC: [-20, 180], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true, corrosive: true }),
      viscosityRangeCst: [1, 200], viscosityBehavior: 'degrades',
      viscosityNote: 'Head/flow/efficiency all fall with rising viscosity above ~20 cSt (ANSI/HI 9.6.7 correction becomes material).',
      npshCharacteristic: 'npsh-sensitive', dryRunCapable: false,
      efficiencyBandPct: [55, 85],
      standardsBasis: 'API 610 / ISO 13709; ANSI/HI 9.6.7 (viscous correction)',
      note: 'General-purpose process duty; the default screening candidate for most water-like services.'
    },
    {
      id: 'split-case', name: 'Split-Case (Axially/Radially Split) Centrifugal', category: 'centrifugal', apiClass: 'BB1/BB3',
      fullTrack: false,
      application: 'High-flow process, pipeline and fire/water-transfer duty beyond single-stage OH capability, where the split case allows the rotor to be pulled without disturbing suction/discharge piping.',
      keyLimitations: 'Larger footprint and higher cost than an end-suction pump for the same duty; double-suction (BB1) designs need balanced inlet piping to avoid uneven loading.',
      selfPriming: 'No',
      flowRangeM3h: [100, 5000], headRangeM: [20, 250], maxDiffPressureBar: null,
      tempRangeC: [-20, 200], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true, corrosive: true }),
      viscosityRangeCst: [1, 100], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'npsh-sensitive', dryRunCapable: false,
      efficiencyBandPct: [75, 88],
      standardsBasis: 'API 610 / ISO 13709 (BB1/BB3)',
      note: 'High-flow process and pipeline duty beyond single-stage capability.'
    },
    {
      id: 'vs-turbine-deepwell', name: 'Vertical Turbine / Deep-Well Turbine', category: 'centrifugal', apiClass: 'VS1/VS6',
      fullTrack: false,
      application: 'Long submerged suction column for deep-well water supply or a wet-pit process sump — tolerates a poor available NPSH better than any other centrifugal family since the first stage sits below the liquid level.',
      keyLimitations: 'Long shaft/line-bearing stack needs careful critical-speed and alignment attention; pull and service require crane access and column removal.',
      selfPriming: 'No — always flooded by design',
      flowRangeM3h: [20, 2000], headRangeM: [20, 300], maxDiffPressureBar: null,
      tempRangeC: [-10, 100], tempNote: null,
      fluidSuitability: suit({ clean: true, corrosive: true }),
      viscosityRangeCst: [1, 50], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'low-npshr', dryRunCapable: false,
      efficiencyBandPct: [70, 85],
      standardsBasis: 'API 610 (VS1/VS6); HI 2.1-2.6',
      note: 'Long submerged suction column tolerates a poor available NPSH better than any other centrifugal family.'
    },
    {
      id: 'self-priming-centrifugal', name: 'Self-Priming Centrifugal', category: 'centrifugal', apiClass: null,
      fullTrack: false,
      application: 'Above-ground installation where a flooded suction cannot be guaranteed — tank truck offloading, portable transfer, trench dewatering with an intermittently-uncovered suction line.',
      keyLimitations: 'Needs liquid retained in the casing to re-prime after a dry stop; priming cycle adds a delay before rated flow is reached; internal recirculation for priming costs a few points of efficiency versus an equivalent standard centrifugal.',
      selfPriming: 'Yes',
      flowRangeM3h: [2, 400], headRangeM: [5, 90], maxDiffPressureBar: null,
      tempRangeC: [-10, 90], tempNote: null,
      fluidSuitability: suit({ clean: true, abrasiveSlurry: true }),
      viscosityRangeCst: [1, 300], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'low-npshr', dryRunCapable: false,
      efficiencyBandPct: [45, 70],
      standardsBasis: NO_SINGLE_STANDARD,
      note: 'Self-priming for above-ground installations without a flooded suction.'
    },
    {
      id: 'canned-motor-centrifugal', name: 'Canned-Motor (Sealless) Centrifugal', category: 'centrifugal', apiClass: null,
      fullTrack: false, sealless: true,
      application: 'Zero-leakage containment for hazardous, toxic or high-value fluids where the process liquid itself lubricates and cools the motor bearings inside a sealed can.',
      keyLimitations: 'No mechanical seal to leak, but no seal to protect against dry-running either — process-side bearings are damaged quickly without lubricating flow; motor heat rejection depends on adequate process-liquid circulation through the can.',
      selfPriming: 'No',
      flowRangeM3h: [0.5, 300], headRangeM: [5, 150], maxDiffPressureBar: null,
      tempRangeC: [-40, 350], tempNote: 'high-temperature canned designs exist for hot-oil/thermic-fluid service — confirm can-lining and bearing material against actual temperature',
      fluidSuitability: suit({ clean: true, hazardousToxic: true, corrosive: true, cryogenic: true }),
      viscosityRangeCst: [1, 200], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'npsh-sensitive', dryRunCapable: false,
      efficiencyBandPct: [45, 70],
      standardsBasis: 'API 685',
      note: 'No mechanical seal — zero-leakage containment; process-lubricated bearings are dry-run sensitive.'
    },
    {
      id: 'mag-drive', name: 'Magnetic-Drive Sealless Centrifugal', category: 'centrifugal', apiClass: null,
      fullTrack: false, sealless: true,
      application: 'Zero-leakage containment for hazardous or toxic fluids via a magnetic coupling across a containment shell, avoiding both a mechanical seal and the canned-motor\'s process-lubricated motor bearings.',
      keyLimitations: 'Torque-limited by magnetic coupling strength — can decouple ("slip") under a sudden overload or a solids jam; internal bushings are still process-lubricated and dry-run sensitive.',
      selfPriming: 'No',
      flowRangeM3h: [1, 500], headRangeM: [5, 150], maxDiffPressureBar: null,
      tempRangeC: [-40, 260], tempNote: null,
      fluidSuitability: suit({ clean: true, hazardousToxic: true, corrosive: true }),
      viscosityRangeCst: [1, 200], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'npsh-sensitive', dryRunCapable: false,
      efficiencyBandPct: [40, 65],
      standardsBasis: 'API 685',
      note: 'No mechanical seal — zero-leakage containment for hazardous or toxic fluids, at the cost of dry-run sensitivity.'
    },
    {
      id: 'axial-mixed-flow', name: 'Axial-Flow / Mixed-Flow (Propeller) Pump', category: 'centrifugal', apiClass: null,
      fullTrack: false,
      application: 'Very high flow at low head — flood control, irrigation, cooling-water circulation, storm-water pumping stations.',
      keyLimitations: 'Head capability is inherently low; performance curve is steep and can be unstable at part flow; usually vertical wet-pit mounting only.',
      selfPriming: 'No — always flooded by design',
      flowRangeM3h: [500, 50000], headRangeM: [1, 15], maxDiffPressureBar: null,
      tempRangeC: [0, 60], tempNote: null,
      fluidSuitability: suit({ clean: true, abrasiveSlurry: true }),
      viscosityRangeCst: [1, 20], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'low-npshr', dryRunCapable: false,
      efficiencyBandPct: [70, 88],
      standardsBasis: 'HI 2.1-2.6',
      note: 'Very high flow, low head — flood control and large-volume circulation duty.'
    },

    // ══════════════════════════════════ SUBMERSIBLE ══════════════════════════════════
    {
      id: 'submersible-dewatering', name: 'Submersible Centrifugal — Dewatering / Sump', category: 'submersible', apiClass: null,
      fullTrack: true,
      application: 'Portable or semi-permanent dewatering of excavations, trenches and sumps; construction-site and utility transfer duty.',
      keyLimitations: 'Duty-rated for intermittent rather than continuous heavy-duty service in most designs; motor/seal chamber is inaccessible without a full pull; limited to moderate solids passage.',
      selfPriming: 'No — flooded/submerged by design',
      flowRangeM3h: [1, 300], headRangeM: [3, 60], maxDiffPressureBar: null,
      tempRangeC: [0, 40], tempNote: 'motor cooling relies on submergence — check the manufacturer\'s maximum dry-running / partial-submergence rating',
      fluidSuitability: suit({ clean: true, abrasiveSlurry: true }),
      viscosityRangeCst: [1, 50], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'low-npshr', dryRunCapable: false,
      efficiencyBandPct: [40, 65],
      standardsBasis: 'HI (Hydraulic Institute) submersible pump standards; no single API standard applies',
      note: 'Fully flooded suction eliminates NPSH/priming concerns; sump and dewatering service.'
    },
    {
      id: 'submersible-sewage', name: 'Submersible Centrifugal — Sewage / Wastewater', category: 'submersible', apiClass: null,
      fullTrack: true,
      application: 'Municipal and industrial wastewater lift stations — vortex or channel/cutter impeller passes rags and solids that would clog a standard closed impeller.',
      keyLimitations: 'Vortex-impeller efficiency is markedly lower than an equivalent clean-water design (the open flow path that passes solids also loses hydraulic efficiency); cutter designs add a wear item.',
      selfPriming: 'No — flooded/submerged by design',
      flowRangeM3h: [5, 800], headRangeM: [3, 60], maxDiffPressureBar: null,
      tempRangeC: [0, 40], tempNote: null,
      fluidSuitability: suit({ abrasiveSlurry: true, corrosive: true }),
      viscosityRangeCst: [1, 100], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'low-npshr', dryRunCapable: false,
      efficiencyBandPct: [35, 60],
      standardsBasis: 'HI (Hydraulic Institute) submersible pump standards; no single API standard applies',
      note: 'Vortex or channel impeller for solids passage — lift-station and wastewater duty.'
    },
    {
      id: 'submersible-borehole', name: 'Submersible Borehole / Turbine (Multistage)', category: 'submersible', apiClass: null,
      fullTrack: true,
      application: 'Deep-well water supply where a vertical-turbine drive shaft down the well is impractical — multiple low-head stages stack to reach the required lift from a small-diameter, deep-set unit.',
      keyLimitations: 'Small motor diameter (borehole-limited) caps power for a given well casing size; column pipe and cable length add real head loss and voltage-drop that must be checked, not assumed away; pull-and-service requires a rig.',
      selfPriming: 'No — flooded/submerged by design',
      flowRangeM3h: [1, 500], headRangeM: [20, 400], maxDiffPressureBar: null,
      tempRangeC: [5, 35], tempNote: null,
      fluidSuitability: suit({ clean: true }),
      viscosityRangeCst: [1, 5], viscosityBehavior: 'degrades',
      viscosityNote: 'borehole pumps are a clean-water family — not intended for viscous or solids-laden duty',
      npshCharacteristic: 'low-npshr', dryRunCapable: false,
      efficiencyBandPct: [55, 75],
      standardsBasis: 'HI (Hydraulic Institute) submersible pump standards; no single API standard applies',
      note: 'Multistage deep-well design; long column and cable runs need their own loss/voltage-drop check.'
    },
    {
      id: 'submersible-slurry', name: 'Submersible Slurry Pump', category: 'submersible', apiClass: null,
      fullTrack: true,
      application: 'Heavy-duty wear-resistant submersible construction for mining, dredging and high-solids industrial slurry duty where a dry-pit slurry pump\'s seal exposure is undesirable.',
      keyLimitations: 'Thick, wear-resistant wetted parts and a robust agitator/impeller add mass and cost; motor/seal chamber inspection interval is shorter than a clean-service submersible\'s.',
      selfPriming: 'No — flooded/submerged by design',
      flowRangeM3h: [5, 1000], headRangeM: [3, 80], maxDiffPressureBar: null,
      tempRangeC: [0, 60], tempNote: null,
      fluidSuitability: suit({ abrasiveSlurry: true }),
      viscosityRangeCst: [1, 500], viscosityBehavior: 'degrades',
      viscosityNote: null,
      npshCharacteristic: 'low-npshr', dryRunCapable: false,
      efficiencyBandPct: [30, 55],
      standardsBasis: 'HI (Hydraulic Institute) submersible pump standards; no single API standard applies',
      note: 'Heavy-duty wear-resistant construction for high-solids abrasive submersible service.'
    },

    // ══════════════════════════════════ PD ROTARY ══════════════════════════════════
    {
      id: 'screw-pump', name: 'Screw Pump (Single/Twin/Triple)', category: 'pd-rotary', apiClass: null,
      fullTrack: true,
      application: 'Very wide viscosity range, low pulsation, gentle on the fluid — the default heavy-viscosity high-flow candidate; twin/triple non-contacting rotors need external timing gears, single-screw designs do not.',
      keyLimitations: 'Close internal clearances are intolerant of hard abrasives; twin/triple designs add timing-gear cost and complexity over a single-screw design.',
      selfPriming: 'Yes',
      flowRangeM3h: [1, 1500], headRangeM: [10, 1500], maxDiffPressureBar: 100,
      tempRangeC: [-20, 300], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true, shearSensitive: true, corrosive: true }),
      viscosityRangeCst: [5, 1000000], viscosityBehavior: 'tolerant',
      viscosityNote: 'volumetric efficiency actually improves with viscosity up to a point (tighter internal slip) before mechanical/friction losses take over — the opposite of a centrifugal pump\'s behaviour.',
      npshCharacteristic: 'self-priming-dry-run-limited', dryRunCapable: false,
      efficiencyBandPct: [50, 80],
      standardsBasis: 'API 676',
      note: 'Very wide viscosity range, low pulsation, gentle on the fluid — the default heavy-viscosity high-flow candidate.'
    },
    {
      id: 'gear-external', name: 'External Gear Pump', category: 'pd-rotary', apiClass: null,
      fullTrack: true,
      application: 'Precise, self-priming, high pressure on viscous liquids — lubricating oils, resins, chemical metering at small-to-medium flow.',
      keyLimitations: 'Close clearances leak on thin, low-viscosity fluids and wear quickly on abrasives; meshing gears carry combined hydraulic and mesh-force bearing load.',
      selfPriming: 'Yes',
      flowRangeM3h: [0.1, 100], headRangeM: [20, 2000], maxDiffPressureBar: 200,
      tempRangeC: [-20, 260], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true, corrosive: true }),
      viscosityRangeCst: [10, 200000], viscosityBehavior: 'tolerant',
      viscosityNote: 'improves with viscosity (lower internal slip) up to the point where drive-torque/friction losses dominate.',
      npshCharacteristic: 'self-priming-dry-run-limited', dryRunCapable: false,
      efficiencyBandPct: [50, 85],
      standardsBasis: 'API 676',
      note: 'Precise, self-priming, high pressure on viscous liquids; close clearances leak on thin fluids and wear on abrasives.'
    },
    {
      id: 'gear-internal', name: 'Internal Gear Pump', category: 'pd-rotary', apiClass: null,
      fullTrack: true,
      application: 'One rotor inside another (gerotor-style) — smooth, low-pulsation flow at moderate pressure for viscous, often delicate fluids (food syrups, adhesives, asphalt, fuel oil transfer).',
      keyLimitations: 'Generally lower maximum pressure than an external gear pump of similar size; still intolerant of hard abrasives at the close internal clearances.',
      selfPriming: 'Yes',
      flowRangeM3h: [0.1, 150], headRangeM: [10, 700], maxDiffPressureBar: 70,
      tempRangeC: [-20, 260], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true, shearSensitive: true }),
      viscosityRangeCst: [10, 1000000], viscosityBehavior: 'tolerant',
      viscosityNote: 'improves with viscosity up to a point, same mechanism as external gear.',
      npshCharacteristic: 'self-priming-dry-run-limited', dryRunCapable: false,
      efficiencyBandPct: [50, 85],
      standardsBasis: 'API 676',
      note: 'Smooth, low-pulsation flow on viscous fluids at moderate pressure.'
    },
    {
      id: 'lobe-rotary', name: 'Rotary Lobe Pump', category: 'pd-rotary', apiClass: null,
      fullTrack: true, hygienicCapable: true,
      application: 'CIP/SIP-capable, gentle non-shearing action; the standard hygienic/sanitary positive-displacement choice for food, beverage and pharma duty, also used on shear-sensitive industrial slurries.',
      keyLimitations: 'Non-contacting lobes need external timing gears (shares this construction detail with the twin/triple screw pump); lower maximum pressure than a gear pump of similar size.',
      selfPriming: 'Yes',
      flowRangeM3h: [0.5, 500], headRangeM: [5, 150], maxDiffPressureBar: 15,
      tempRangeC: [-20, 150], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true, shearSensitive: true, abrasiveSlurry: true, hygienicSanitary: true }),
      viscosityRangeCst: [2, 100000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'self-priming-dry-run-limited', dryRunCapable: false,
      efficiencyBandPct: [50, 80],
      standardsBasis: 'API 676; 3-A / EHEDG (hygienic execution)',
      note: 'CIP/SIP-capable, gentle non-shearing action; the standard hygienic/sanitary positive-displacement choice.'
    },
    {
      id: 'vane-pump', name: 'Vane Pump', category: 'pd-rotary', apiClass: null,
      fullTrack: false,
      application: 'Thin, clean, lubricating liquids — fuels, solvents, LPG transfer — where the vanes themselves rely on the pumped fluid for lubrication.',
      keyLimitations: 'Vanes wear quickly on abrasive or dry-running service; not suited to non-lubricating or solids-laden fluids.',
      selfPriming: 'Yes',
      flowRangeM3h: [0.5, 200], headRangeM: [10, 200], maxDiffPressureBar: 20,
      tempRangeC: [-20, 120], tempNote: null,
      fluidSuitability: suit({ clean: true }),
      viscosityRangeCst: [1, 500], viscosityBehavior: 'degrades',
      viscosityNote: 'unlike gear/screw/lobe, a vane pump does not benefit from rising viscosity — thin, lubricating fluids are its actual sweet spot.',
      npshCharacteristic: 'self-priming-dry-run-limited', dryRunCapable: false,
      efficiencyBandPct: [50, 75],
      standardsBasis: MANUF_SPECIFIC,
      note: 'Thin, clean, lubricating liquids (fuels, solvents); vanes wear quickly on abrasive or dry-running service.'
    },
    {
      id: 'pc-pump', name: 'Progressive Cavity (PC / Mono / Eccentric-Screw) Pump', category: 'pd-rotary', apiClass: null,
      fullTrack: false,
      application: 'Handles high solids loading and shear-sensitive slurries at steady, low-pulsation flow — sludge, slurry and viscous-with-solids duty across water/wastewater and process industry.',
      keyLimitations: 'The elastomeric stator wears and is a wetted-material-compatibility item in its own right, separate from the rotor metallurgy; running dry destroys the stator quickly.',
      selfPriming: 'Yes',
      flowRangeM3h: [0.1, 500], headRangeM: [5, 200], maxDiffPressureBar: 24,
      tempRangeC: [-10, 120], tempNote: 'bounded by the stator elastomer\'s temperature rating, not the rotor metal',
      fluidSuitability: suit({ viscous: true, abrasiveSlurry: true, shearSensitive: true }),
      viscosityRangeCst: [20, 1000000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'self-priming-dry-run-limited', dryRunCapable: false,
      efficiencyBandPct: [40, 70],
      standardsBasis: MANUF_SPECIFIC,
      note: 'Handles high solids loading and shear-sensitive slurries at steady, low-pulsation flow.'
    },
    {
      id: 'peristaltic-hose', name: 'Peristaltic Pump', category: 'pd-rotary', apiClass: null,
      fullTrack: true,
      application: 'Rollers or shoes compress a flexible hose against a casing track — the fluid never touches a bearing, seal or rotor metal, making this the default choice for abrasive slurries, shear-sensitive fluids, and chemical dosing where zero product contamination from the drive matters.',
      keyLimitations: 'Hard pressure ceiling set by the hose\'s burst rating, not a soft preference; hose is a wear/replacement item with a finite service life; flow is inherently pulsating unless a dual-head or dampened design is used.',
      selfPriming: 'Yes — dry-run tolerant',
      flowRangeM3h: [0.001, 100], headRangeM: [5, 150], maxDiffPressureBar: 15,
      tempRangeC: [-20, 80], tempNote: 'set entirely by the hose elastomer\'s rating (NR/NBR/EPDM/Silicone/Hypalon) — not the casing metal',
      fluidSuitability: suit({ abrasiveSlurry: true, shearSensitive: true, corrosive: true, hygienicSanitary: true }),
      viscosityRangeCst: [1, 100000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'self-priming-dry-run-capable', dryRunCapable: true,
      efficiencyBandPct: [30, 55],
      standardsBasis: NO_SINGLE_STANDARD,
      note: 'Fluid never contacts a bearing, seal or rotor metal — dry-run tolerant, hard-capped by hose burst pressure.'
    },

    // ══════════════════════════════════ PD RECIPROCATING ══════════════════════════════════
    {
      id: 'plunger-pump', name: 'Plunger Pump', category: 'pd-reciprocating', apiClass: null,
      fullTrack: true,
      application: 'Very high pressure at low, precisely controllable flow — high-pressure cleaning, reverse-osmosis feed, chemical injection, hydrostatic test. Plunger (not piston) construction lets packing be replaced without removing the cylinder.',
      keyLimitations: 'Pulsating flow needs acceleration-head NPSH correction on the suction side and, usually, a pulsation dampener on the discharge side; suction/discharge check valves and packing are maintenance items.',
      selfPriming: 'Limited — needs a flooded or lightly-lifted suction; not a dry-priming design',
      flowRangeM3h: [0.01, 50], headRangeM: [100, 5000], maxDiffPressureBar: 1000,
      tempRangeC: [-10, 200], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true, corrosive: true }),
      viscosityRangeCst: [0.3, 2000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'npsh-sensitive-acceleration-head', dryRunCapable: false,
      efficiencyBandPct: [85, 92],
      standardsBasis: 'API 674',
      note: 'Very high pressure at low, precisely controllable flow. Pulsation dampening and overpressure protection are mandatory.'
    },
    {
      id: 'piston-pump', name: 'Piston Pump', category: 'pd-reciprocating', apiClass: null,
      fullTrack: true,
      application: 'Same power-end/crankshaft architecture as a plunger pump, but a piston-ring/cup seal in the cylinder bore replaces plunger packing — common at lower pressure and larger bore than a plunger design, and where the seal needs to travel with the piston rather than stay fixed in a stuffing box.',
      keyLimitations: 'Same pulsating-flow and acceleration-head considerations as a plunger pump; piston seal (rings or cups) wears against the cylinder bore rather than a fixed rod, which is a different maintenance/spares item than plunger packing.',
      selfPriming: 'Limited — needs a flooded or lightly-lifted suction; not a dry-priming design',
      flowRangeM3h: [0.01, 80], headRangeM: [50, 2000], maxDiffPressureBar: 400,
      tempRangeC: [-10, 150], tempNote: null,
      fluidSuitability: suit({ clean: true, viscous: true }),
      viscosityRangeCst: [0.3, 2000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'npsh-sensitive-acceleration-head', dryRunCapable: false,
      efficiencyBandPct: [85, 92],
      standardsBasis: 'API 674',
      note: 'Piston ring/cup seal in place of plunger packing; lower pressure, larger bore than a plunger design.'
    },
    {
      id: 'diaphragm-mechanical', name: 'Diaphragm Pump — Mechanically Actuated', category: 'pd-reciprocating', apiClass: null,
      fullTrack: false, sealless: true, noRotatingShaft: true,
      application: 'A mechanically-driven diaphragm isolates the pumped fluid from the drive/crankshaft entirely — general chemical transfer and metering at low-to-moderate pressure where leak-free containment matters more than pressure capability.',
      keyLimitations: 'Diaphragm is a fatigue/wear item with a finite cycle life; maximum pressure is well below a plunger pump\'s; flow is pulsating.',
      selfPriming: 'Yes — dry-run tolerant',
      flowRangeM3h: [0.01, 20], headRangeM: [10, 300], maxDiffPressureBar: 30,
      tempRangeC: [-10, 100], tempNote: 'set by the diaphragm elastomer rating',
      fluidSuitability: suit({ corrosive: true, hazardousToxic: true, abrasiveSlurry: true }),
      viscosityRangeCst: [0.3, 5000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'npsh-sensitive-acceleration-head', dryRunCapable: true,
      efficiencyBandPct: [50, 75],
      standardsBasis: MANUF_SPECIFIC,
      note: 'Mechanically-driven diaphragm isolates the fluid from the drive; leak-free at low-to-moderate pressure.'
    },
    {
      id: 'diaphragm-metering', name: 'Diaphragm Pump — Hydraulically Actuated (Metering)', category: 'pd-reciprocating', apiClass: null,
      fullTrack: false, sealless: true, noRotatingShaft: true,
      application: 'Precision chemical dosing/injection; a hydraulically-balanced diaphragm gives repeatable, adjustable metered flow with a leak-free process-side barrier.',
      keyLimitations: 'Flow capacity is intentionally small — this is a metering pump, not a transfer pump; diaphragm and check-valve condition directly affect dosing accuracy over time.',
      selfPriming: 'Yes — dry-run tolerant',
      flowRangeM3h: [0.001, 5], headRangeM: [10, 2000], maxDiffPressureBar: 200,
      tempRangeC: [-10, 120], tempNote: 'set by the diaphragm elastomer rating',
      fluidSuitability: suit({ corrosive: true, hazardousToxic: true }),
      viscosityRangeCst: [0.3, 5000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'npsh-sensitive-acceleration-head', dryRunCapable: true,
      efficiencyBandPct: [50, 75],
      standardsBasis: MANUF_SPECIFIC,
      note: 'Precision chemical dosing/injection; leak-free process-side diaphragm isolates the fluid from the drive.'
    },
    {
      id: 'aodd', name: 'Air-Operated Double Diaphragm (AODD)', category: 'pd-reciprocating', apiClass: null,
      fullTrack: false, sealless: true, noRotatingShaft: true,
      application: 'Self-priming, dry-run tolerant, handles abrasives and entrained solids at modest head — utility transfer, drum/tote emptying, and services where a compressed-air supply is available but electrical power near the pump is undesirable (washdown areas, hazardous locations).',
      keyLimitations: 'Head capability is modest; flow is markedly pulsating without a surge damper; running cost depends on compressed-air availability and efficiency, which is poor compared with an electrically-driven alternative.',
      selfPriming: 'Yes — dry-run tolerant',
      flowRangeM3h: [0.5, 100], headRangeM: [3, 70], maxDiffPressureBar: 8.5,
      tempRangeC: [-10, 100], tempNote: 'set by the diaphragm elastomer rating',
      fluidSuitability: suit({ abrasiveSlurry: true, corrosive: true, hazardousToxic: true }),
      viscosityRangeCst: [1, 50000], viscosityBehavior: 'tolerant',
      viscosityNote: null,
      npshCharacteristic: 'self-priming-dry-run-capable', dryRunCapable: true,
      efficiencyBandPct: [10, 30],
      standardsBasis: MANUF_SPECIFIC,
      note: 'Self-priming, dry-run tolerant, handles abrasives and entrained solids at modest head — utility/transfer duty.'
    }
  ];

  /* ── lookups ─────────────────────────────────────────────────────────── */
  function byId(id) {
    for (var i = 0; i < PUMP_SELECTION_STANDARD.length; i++) {
      if (PUMP_SELECTION_STANDARD[i].id === id) return PUMP_SELECTION_STANDARD[i];
    }
    return null;
  }
  function byCategory(cat) {
    return PUMP_SELECTION_STANDARD.filter(function (r) { return r.category === cat; });
  }
  function fullTrackRows() {
    return PUMP_SELECTION_STANDARD.filter(function (r) { return !!r.fullTrack; });
  }
  function referenceOnlyRows() {
    return PUMP_SELECTION_STANDARD.filter(function (r) { return !r.fullTrack; });
  }

  window.PUMP_SELECTION_STANDARD = PUMP_SELECTION_STANDARD;
  window.AROPUMPSTANDARD = {
    ROWS: PUMP_SELECTION_STANDARD,
    byId: byId,
    byCategory: byCategory,
    fullTrackRows: fullTrackRows,
    referenceOnlyRows: referenceOnlyRows
  };
})();

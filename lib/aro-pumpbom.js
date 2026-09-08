/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Automatic Bill of Materials
   window.AROPUMPBOM

   Phase 18 of the Pump Hydraulics Advanced Upgrade ("Automatic 2D GA +
   BOM"). The 2D general-arrangement drawing side of this item ALREADY
   EXISTS and already works — lib/aro-drawing.js's register('pump', ...)
   draws a fully dimensioned elevation (nozzles, tapping points, driver,
   coupling, baseplate, calculated duty) from the same live calculation
   this suite has been building on. Rebuilding it would violate this
   upgrade's own "do not rebuild working things" rule, so this phase
   adds the missing half instead: a procurement-style Bill of Materials,
   assembled purely from results Phases 2/4/5/6/7/8/9/10 already
   computed — nothing here is a new calculation.

   buildBOM(...) is pure — no DOM. Loadable/unit-testable in Node like
   every other engine in this suite.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function row(itemNo, description, material, qty, status, notes) {
    return { itemNo: itemNo, description: description, material: material, qty: qty, status: status, notes: notes };
  }

  var NA = 'DATA REQUIRED';

  /* p = { shapeFamily (Phase 4), configType (Phase 3), mocCasing,
     mocImpeller (Phase 6, AROPUMPMOC.screenMaterials().top per
     component), shaft (Phase 7, .top), bearing (Phase 8, .top), seal
     (Phase 9, selectSealPlan() — reads .top), coupling (Phase 10,
     recommendCoupling()), driverEnclosure (Phase 10,
     screenMotorEnclosure()), motorKw (the standard selected motor
     rating) } — every field the verbatim object/value app.js already
     holds for that phase. */
  function buildBOM(p) {
    p = p || {};
    var rows = [];
    var n = 1;

    rows.push(row(n++, 'Pump Casing' + (p.shapeFamily ? ' (' + p.shapeFamily + ')' : ''),
      (p.mocCasing && p.mocCasing.applicable) ? p.mocCasing.top.name : NA,
      1, (p.mocCasing && p.mocCasing.applicable) ? p.mocCasing.top.verdict : NA,
      (p.mocCasing && p.mocCasing.applicable) ? p.mocCasing.top.note : (p.mocCasing && p.mocCasing.reason)));

    rows.push(row(n++, 'Impeller' + (p.shapeFamily ? ' (' + p.shapeFamily + ')' : ''),
      (p.mocImpeller && p.mocImpeller.applicable) ? p.mocImpeller.top.name : NA,
      1, (p.mocImpeller && p.mocImpeller.applicable) ? p.mocImpeller.top.verdict : NA,
      (p.mocImpeller && p.mocImpeller.applicable) ? p.mocImpeller.top.note : (p.mocImpeller && p.mocImpeller.reason)));

    var sh = p.shaft;
    rows.push(row(n++, 'Pump Shaft',
      (sh && sh.applicable) ? sh.top.materialName : NA,
      1, (sh && sh.applicable) ? sh.top.verdict : NA,
      (sh && sh.applicable) ? 'Diameter ' + sh.top.shaftDiameter_mm.toFixed(1) + ' mm.' : (sh && sh.reason)));

    var br = p.bearing;
    rows.push(row(n++, 'Bearings (drive end + non-drive end)',
      (br && br.applicable) ? br.top.bearingName : NA,
      2, (br && br.applicable) ? br.top.verdict : NA,
      (br && br.applicable) ? 'Bore ' + br.top.bore_mm + ' mm, L10 life ' + Math.round(br.top.L10h).toLocaleString() + ' h.' : (br && br.reason)));

    var sl = p.seal;
    rows.push(row(n++, 'Mechanical Seal' + ((sl && sl.applicable) ? ' (API 682 Plan ' + sl.top.id + ')' : ''),
      (sl && sl.applicable) ? sl.top.name : NA,
      1, (sl && sl.applicable) ? sl.top.verdict : NA,
      (sl && sl.applicable) ? sl.top.reasons.concat(sl.top.warnings).join(' ') : (sl && sl.reason)));

    var co = p.coupling;
    if (co && co.status === 'NOT APPLICABLE') {
      rows.push(row(n++, 'Coupling', 'N/A — close-coupled', 0, 'NOT APPLICABLE', co.reason));
    } else {
      rows.push(row(n++, 'Coupling',
        (co && co.applicable) ? co.top.name : NA,
        1, (co && co.applicable) ? co.top.verdict : NA,
        (co && co.applicable) ? 'Rated for ' + Math.round(co.requiredContinuousTorque_Nm) + ' N·m continuous, ' + Math.round(co.requiredPeakTorque_Nm) + ' N·m peak.' : (co && co.reason)));
    }

    var dr = p.driverEnclosure;
    rows.push(row(n++, 'Driver (Motor)' + (isFinite(p.motorKw) ? ', ' + p.motorKw.toFixed(1) + ' kW' : ''),
      (dr && dr.applicable) ? dr.top.name + ' enclosure' : NA,
      1, (dr && dr.applicable) ? dr.top.verdict : NA,
      (dr && dr.applicable) ? 'Hazard class: ' + dr.hazardClass + '.' : (dr && dr.reason)));

    var fndStyle = p.foundation && p.foundation.items && p.foundation.items.filter(function (i) { return i.id === 'baseplate-style'; })[0];
    if (fndStyle) {
      rows.push(row(n++, 'Baseplate / Skid', fndStyle.status === 'NOT APPLICABLE' ? 'N/A — see notes' : 'Fabricated steel', 1,
        fndStyle.status, fndStyle.detail));
    } else {
      rows.push(row(n++, 'Baseplate / Skid', 'Fabricated steel', 1, 'NOT APPLICABLE',
        'Foundation/baseplate sizing is a later item in this upgrade — shown here for a complete parts list only, not yet a calculated selection.'));
    }

    return { rows: rows, status: 'CALCULATED' };
  }

  /* ── Pump build Step 9: family-specific BOMs ─────────────────────────
     The centrifugal BOM above assumes an impeller and an API 682
     mechanical seal — wrong for a screw/gear-lobe/hose/reciprocating
     pump, which have neither. Each of these reads that family's own
     design() result (verbatim, nothing recomputed) rather than the
     centrifugal shaft/bearing/seal fields, which are "illustrative
     only" for a PD family per the same pdAdvisoryPrefix() rule the
     report panels already follow. */
  function buildScrewBOM(sc) {
    var rows = []; var n = 1;
    if (!sc || !sc.applicable) return { rows: rows, status: 'DATA REQUIRED' };
    var top = sc.rotorConfig.top;
    rows.push(row(n++, top.name + ' Rotor(s)', 'Nitrided alloy steel', top.rotors, top.verdict,
      'Rotor OD ' + sc.geometry.rotorOD_mm.toFixed(0) + ' mm, effective length ' + sc.geometry.effectiveLength_mm.toFixed(0) + ' mm.'));
    rows.push(row(n++, 'Barrel Casing', 'Cast/fabricated steel', 1, 'PRELIMINARY ASSUMPTION', 'Houses the rotor set; sized to the rotor envelope above.'));
    if (top.timingGears) rows.push(row(n++, 'External Timing Gear Set', 'Hardened alloy steel', 1, 'PRELIMINARY ASSUMPTION', 'Keeps the non-contacting rotors in time — this configuration needs one, the single/triple-screw alternatives do not.'));
    rows.push(row(n++, 'Rotor Shaft', 'Nitrided alloy steel', 1, 'PRELIMINARY ASSUMPTION', 'Diameter ' + sc.shaft.shaftDiameter_mm.toFixed(1) + ' mm.'));
    rows.push(row(n++, 'Bearings', 'Per L10 screening', 2, 'PRELIMINARY ASSUMPTION', 'Radial ' + sc.loads.Fr_N.toFixed(0) + ' N, axial ' + sc.loads.Fa_N.toFixed(0) + ' N.'));
    rows.push(row(n++, sc.driveTrain.reducerNeeded ? 'Gear Reducer + Coupling' : 'Direct Coupling', 'Steel', 1, 'PRELIMINARY ASSUMPTION', sc.driveTrain.note));
    return { rows: rows, status: 'CALCULATED' };
  }

  function buildGearLobeBOM(gl) {
    var rows = []; var n = 1;
    if (!gl || !gl.applicable) return { rows: rows, status: 'DATA REQUIRED' };
    rows.push(row(n++, gl.pumpTypeName + ' Rotor Set', 'Hardened alloy steel', gl.pumpTypeId === 'gear-internal' ? 2 : 2, 'PRELIMINARY ASSUMPTION',
      'Rotor OD ' + gl.geometry.OD_mm.toFixed(0) + ' mm, face width ' + gl.geometry.faceWidth_mm.toFixed(0) + ' mm.'));
    rows.push(row(n++, 'Casing', 'Cast steel', 1, 'PRELIMINARY ASSUMPTION', 'Houses the meshing-rotor set above.'));
    if (gl.pumpTypeId === 'lobe-rotary') rows.push(row(n++, 'External Timing Gear Set', 'Hardened alloy steel', 1, 'PRELIMINARY ASSUMPTION', 'Non-contacting lobes need one, the same principle as a twin-screw pump.'));
    rows.push(row(n++, 'Shaft(s)', 'Alloy steel', gl.pumpTypeId === 'gear-internal' ? 1 : 2, 'PRELIMINARY ASSUMPTION', 'Diameter ' + gl.shaft.shaftDiameter_mm.toFixed(1) + ' mm.'));
    rows.push(row(n++, 'Bearings', 'Per L10 screening', 2, 'PRELIMINARY ASSUMPTION', 'Radial ' + gl.loads.Fr_N.toFixed(0) + ' N.'));
    rows.push(row(n++, gl.sealless.verdict === 'SUITABLE' ? 'Magnetic Drive (Sealless) Coupling' : 'Mechanical Shaft Seal', 'Per screening', 1,
      gl.sealless.verdict, gl.sealless.reasons.concat(gl.sealless.warnings).join(' ')));
    return { rows: rows, status: 'CALCULATED' };
  }

  function buildHoseBOM(h) {
    var rows = []; var n = 1;
    if (!h || !h.applicable) return { rows: rows, status: 'DATA REQUIRED' };
    rows.push(row(n++, 'Pump Hose (' + h.hoseBore.bore + ' bore)', h.elastomer.top.name, 1, h.elastomer.top.verdict,
      'Rated ' + h.elastomer.top.maxPressureBar + ' bar; estimated life ' + Math.round(h.hoseLife.estimatedHours).toLocaleString() + ' h — a wear/replacement item.'));
    rows.push(row(n++, 'Casing / Track', 'Cast steel', 1, 'PRELIMINARY ASSUMPTION', 'Guides the hose against the roller/shoe assembly.'));
    rows.push(row(n++, h.rollerConfig.config + ' Rotor', 'Steel', 1, 'PRELIMINARY ASSUMPTION', h.rollerConfig.note));
    rows.push(row(n++, 'Rotor Bearings', 'Sealed/shielded', 2, 'PRELIMINARY ASSUMPTION', h.bearingIsolation));
    rows.push(row(n++, 'Mechanical Seal', 'N/A — none fitted', 0, 'NOT APPLICABLE', 'This family has no shaft seal at all — the hose is the only wetted containment.'));
    return { rows: rows, status: 'CALCULATED' };
  }

  function buildRecipBOM(rc) {
    var rows = []; var n = 1;
    if (!rc || !rc.applicable) return { rows: rows, status: 'DATA REQUIRED' };
    rows.push(row(n++, 'Fluid-End Cylinder (' + rc.rodLoad.bore_mm.toFixed(0) + ' mm bore)', 'Forged/cast steel', 1, 'PRELIMINARY ASSUMPTION',
      'Stroke ' + rc.rodLoad.stroke_mm.toFixed(0) + ' mm, rod load ' + rc.rodLoad.Frod_N.toFixed(0) + ' N.'));
    rows.push(row(n++, rc.seal.name, 'Per fluid compatibility', 1, 'PRELIMINARY ASSUMPTION', rc.seal.note));
    rows.push(row(n++, 'Crankshaft / Connecting Rod / Crosshead', 'Forged alloy steel', 1, 'PRELIMINARY ASSUMPTION', 'Crank pin diameter ' + rc.crankShaft.crankPinDiameter_mm.toFixed(1) + ' mm.'));
    rows.push(row(n++, 'Power-End Bearings', 'Per L10 screening', 2, (rc.bearing && rc.bearing.applicable) ? rc.bearing.top.verdict : NA,
      (rc.bearing && rc.bearing.applicable) ? rc.bearing.top.bearingName + ', L10 life ' + Math.round(rc.bearing.top.L10h).toLocaleString() + ' h.' : 'Bearing screening not available.'));
    rows.push(row(n++, 'Pulsation Dampener (Discharge)', 'Fabricated steel, gas-charged', 1, 'PRELIMINARY ASSUMPTION',
      'Chamber volume ~' + rc.dampener.chamberVolume_L.toFixed(1) + ' L' + (isFinite(rc.dampener.prechargeBarG) ? ', precharge ~' + rc.dampener.prechargeBarG.toFixed(1) + ' barg.' : '.')));
    rows.push(row(n++, rc.driveTrain.reducerNeeded ? 'Gear Reducer + Coupling' : 'Direct Coupling', 'Steel', 1, 'PRELIMINARY ASSUMPTION', rc.driveTrain.note));
    return { rows: rows, status: 'CALCULATED' };
  }

  /* buildFamilyBOM: dispatches to the right family-specific BOM, or null
     when familyId isn't one of the four (caller falls back to the
     centrifugal buildBOM() above). */
  function buildFamilyBOM(familyId, results) {
    results = results || {};
    if (familyId === 'screw-pump') return buildScrewBOM(results.screw);
    if (familyId === 'gear-external' || familyId === 'gear-internal' || familyId === 'lobe-rotary') return buildGearLobeBOM(results.gearLobe);
    if (familyId === 'peristaltic-hose') return buildHoseBOM(results.hose);
    if (familyId === 'plunger-pump' || familyId === 'piston-pump') return buildRecipBOM(results.recip);
    return null;
  }

  window.AROPUMPBOM = { buildBOM: buildBOM, buildFamilyBOM: buildFamilyBOM };
})();

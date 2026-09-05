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

  window.AROPUMPBOM = { buildBOM: buildBOM };
})();

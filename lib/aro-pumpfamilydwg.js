/* ═══════════════════════════════════════════════════════════════════════
   AROGARA — 2D SCHEMATIC DRAWINGS for the PD full-track pump families
   (Pump build Step 8, part A)

   The shared drawing kit (window.ARODWG, lib/aro-drawing.js) already
   covers the centrifugal pump's general arrangement and impeller detail
   — those apply as-is to a submersible too, since a submersible IS a
   centrifugal machine. This file adds the four families that don't look
   like a volute-and-impeller at all: screw, gear/lobe, peristaltic hose,
   and reciprocating plunger/piston. Registered the same way
   lib/aro-sthedwg.js registers 'sthe' — a separate file, loaded after
   aro-drawing.js, calling the same public window.ARODWG.register(id, def).

   Same rules as every other drawing in this layer:
     ONE SOURCE OF TRUTH — every dimension is read from the family's own
     calculated result (window.pumpAdvancedState.screw/.gearLobe/.hose/
     .recip), never recomputed or guessed here.
     NO RESULT, NO DRAWING — data() returns null until that family's
     module has actually run, and svgFor() (shared) refuses to draw.
     NOT FOR FABRICATION — every sheet still carries the shared stamp;
     these are schematic representations of a sizing calculation, not
     manufacturing drawings, and explicitly so: geometry here is
     illustrative of the construction principle (how many rotors, where
     the seal sits), not a modelled part profile. stateId: 'pump' ties
     each sheet to the base hydraulic calculation's SUPERSEDED stamp,
     the same way 'pump-impeller' already does.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.ARODWG) return;
  var register = window.ARODWG.register;
  var f = window.ARODWG.K.f, esc = window.ARODWG.K.esc;

  function baseCalc() {
    var s = window.state && window.state.pump;
    if (!s || !s.calculated || !s.results) return null;
    return { i: s.inputs, r: s.results };
  }

  /* ═══════════════════════════════════════════════════════════════════
     SCREW PUMP — single/twin/triple rotor GA
     ═══════════════════════════════════════════════════════════════════ */
  register('pump-screw', {
    title: 'SCREW PUMP — GENERAL ARRANGEMENT',
    stateId: 'pump',
    w: 900, h: 560,
    subtitle: function (d) {
      return d.rotorName.toUpperCase() + '  ·  ' + f(d.Q, 2) + ' m³/h AT ' + f(d.dP, 1) + ' bar DIFFERENTIAL  ·  API 676';
    },
    data: function () {
      var b = baseCalc(); var adv = window.pumpAdvancedState; var sc = adv && adv.screw;
      if (!b || !sc || !sc.applicable) return null;
      return {
        tag: (b.i.pumpTag) || 'P-101', Q: b.r.designVolFlow, dP: b.r.pumpDp,
        rotorName: sc.rotorConfig.top.name, rotors: sc.rotorConfig.top.rotors, timingGears: sc.rotorConfig.top.timingGears,
        OD_mm: sc.geometry.rotorOD_mm, L_mm: sc.geometry.effectiveLength_mm,
        shaftDia_mm: sc.shaft.shaftDiameter_mm, Fr_N: sc.loads.Fr_N, Fa_N: sc.loads.Fa_N,
        reducer: sc.driveTrain.reducerNeeded, motorKw: b.r.stdMotorKw, rpm: b.r.pumpSpeedRpm,
      };
    },
    block: function (d) { return [['TAG', d.tag], ['CONFIGURATION', d.rotorName]]; },
    draw: function (d, K) {
      var s = '';
      var cx0 = 260, cy = 260, casW = 380, rotorGap = 26;
      var nRotors = d.rotors, rotorR = Math.min(20, 60 / nRotors);
      var casH = nRotors * (rotorR * 2 + rotorGap) + rotorGap;
      var casY = cy - casH / 2;

      /* casing */
      s += K.rect(cx0, casY, casW, casH, { fill: K.METAL, stroke: K.INK, w: 1.4, rx: 10 });
      s += K.rect(cx0 + 10, casY + 10, casW - 20, casH - 20, { fill: '#ffffff', stroke: K.THIN, w: 0.6, rx: 6 });

      /* rotors — parallel horizontal cylinders, a helical-thread hint via
         short diagonal hatch lines, not a modelled thread profile */
      for (var i = 0; i < nRotors; i++) {
        var ry = casY + rotorGap + rotorR + i * (rotorR * 2 + rotorGap);
        s += K.rect(cx0 + 20, ry - rotorR, casW - 40, rotorR * 2, { fill: K.METAL2, stroke: K.INK, w: 1, rx: rotorR });
        for (var hx = cx0 + 34; hx < cx0 + casW - 30; hx += 16) {
          s += K.line(hx, ry - rotorR + 3, hx + 10, ry + rotorR - 3, { stroke: K.THIN, w: 0.5 });
        }
      }
      s += K.centre(cx0 - 20, cy, cx0 + casW + 60, cy);

      /* timing gear box on the drive end, only when this configuration uses one */
      var driveX = cx0 + casW;
      if (d.timingGears) {
        s += K.rect(driveX, cy - 34, 46, 68, { fill: K.METAL2, stroke: K.INK, w: 1.1, rx: 4 });
        s += K.circle(driveX + 16, cy - 12, 11, { fill: '#ffffff', stroke: K.INK, w: 0.9 });
        s += K.circle(driveX + 30, cy + 12, 11, { fill: '#ffffff', stroke: K.INK, w: 0.9 });
        s += K.txt(driveX + 23, cy + 46, 'TIMING GEARS', { anchor: 'middle', size: 7, fill: K.THIN });
        driveX += 46;
      }

      /* suction / discharge */
      s += K.flange(cx0 - 4, cy, 40);
      s += K.flow(60, cy - 30, 100, 'SUCTION', K.COLD);
      s += K.leader(cx0, cy - 20, 90, 150, 'SUCTION NOZZLE');
      s += K.flange(cx0 + casW + 4, cy, 40);
      s += K.flow(cx0 + casW + 20, cy - 30, 100, 'DISCHARGE', K.HOT);

      /* driver */
      var mX = driveX + 40, mW = 120, mH = 66;
      s += K.rect(mX, cy - mH / 2, mW, mH, { fill: K.METAL, stroke: K.INK, w: 1.2, rx: 5 });
      s += K.txt(mX + mW / 2, cy + 5, 'M', { anchor: 'middle', size: 16, weight: 'bold', fill: K.THIN });
      s += K.line(driveX, cy, mX, cy, { stroke: K.INK, w: 1.2, dash: d.reducer ? '5,3' : null });
      s += K.txt((driveX + mX) / 2, cy - 44, d.reducer ? 'GEAR REDUCER' : 'DIRECT COUPLED', { anchor: 'middle', size: 7.5, fill: K.THIN });

      /* dimensions */
      s += K.dimH(cx0 + 20, cx0 + casW - 20, casY + casH + 26, 'ROTOR EFFECTIVE LENGTH  ' + f(d.L_mm, 0) + ' mm');
      s += K.dimV(casY, casY + casH, cx0 - 22, 'ROTOR OD  ' + f(d.OD_mm, 0) + ' mm', { from: cx0 - 40 });

      /* numbers box */
      var nx = 40, ny = 420;
      s += K.rect(nx, ny, 380, 108, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(nx + 8, ny + 15, 'CALCULATED DESIGN', { size: 8.5, weight: 'bold' });
      s += K.line(nx, ny + 21, nx + 380, ny + 21, { stroke: K.FAINT, w: 0.5 });
      [['Rotor OD / length', f(d.OD_mm, 0) + ' / ' + f(d.L_mm, 0) + ' mm'],
       ['Radial / axial bearing load', f(d.Fr_N, 0) + ' / ' + f(d.Fa_N, 0) + ' N'],
       ['Rotor shaft diameter', f(d.shaftDia_mm, 1) + ' mm'],
       ['Driver', f(d.motorKw, 2) + ' kW @ ' + f(d.rpm, 0) + ' rpm' + (d.reducer ? ' (geared)' : ' (direct)')],
      ].forEach(function (row, i2) {
        s += K.txt(nx + 8, ny + 36 + i2 * 18, row[0], { size: 8, fill: K.THIN });
        s += K.txt(nx + 372, ny + 36 + i2 * 18, row[1], { size: 8.5, weight: 'bold', anchor: 'end' });
      });
      s += K.tag(cx0 + casW / 2, 70, d.tag);
      return s;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     GEAR / LOBE PUMP — meshing-rotor GA, one drawing adapting to
     whichever of the three rows was actually calculated
     ═══════════════════════════════════════════════════════════════════ */
  register('pump-gearlobe', {
    title: 'GEAR / LOBE PUMP — GENERAL ARRANGEMENT',
    stateId: 'pump',
    w: 900, h: 560,
    subtitle: function (d) {
      return d.pumpTypeName.toUpperCase() + '  ·  ' + f(d.Q, 2) + ' m³/h AT ' + f(d.dP, 1) + ' bar DIFFERENTIAL  ·  ' + d.standardsBasis;
    },
    data: function () {
      var b = baseCalc(); var adv = window.pumpAdvancedState; var gl = adv && adv.gearLobe;
      if (!b || !gl || !gl.applicable) return null;
      return {
        tag: (b.i.pumpTag) || 'P-101', Q: b.r.designVolFlow, dP: b.r.pumpDp,
        pumpTypeId: gl.pumpTypeId, pumpTypeName: gl.pumpTypeName, standardsBasis: gl.standardsBasis,
        OD_mm: gl.geometry.OD_mm, faceWidth_mm: gl.geometry.faceWidth_mm,
        shaftDia_mm: gl.shaft.shaftDiameter_mm, Fr_N: gl.loads.Fr_N,
        sealless: gl.sealless.verdict, reducer: gl.driveTrain.reducerNeeded,
        motorKw: b.r.stdMotorKw, rpm: b.r.pumpSpeedRpm,
      };
    },
    block: function (d) { return [['TAG', d.tag], ['TYPE', d.pumpTypeName]]; },
    draw: function (d, K) {
      var s = '';
      var cx = 260, cy = 260;
      var R = Math.max(30, Math.min(70, d.OD_mm / 4));
      var casW = R * 4 + 60, casH = R * 2.6;
      var casX = cx - casW / 2, casY = cy - casH / 2;

      s += K.rect(casX, casY, casW, casH, { fill: K.METAL, stroke: K.INK, w: 1.4, rx: 14 });

      if (d.pumpTypeId === 'gear-internal') {
        /* gerotor — one rotor inside another, offset centres */
        s += K.circle(cx, cy, R, { fill: '#ffffff', stroke: K.INK, w: 1.1 });
        s += K.circle(cx + R * 0.32, cy, R * 0.55, { fill: K.METAL2, stroke: K.INK, w: 1 });
        for (var a1 = 0; a1 < 10; a1++) {
          var th = a1 * Math.PI / 5;
          s += K.line(cx + (R - 4) * Math.cos(th), cy + (R - 4) * Math.sin(th),
            cx + (R + 3) * Math.cos(th), cy + (R + 3) * Math.sin(th), { stroke: K.THIN, w: 0.5 });
        }
        s += K.leader(cx + R * 0.32, cy - R * 0.55, cx - 10, casY - 26, 'INNER / OUTER ROTOR (GEROTOR)');
      } else if (d.pumpTypeId === 'lobe-rotary') {
        /* two-lobe rotors, side by side, non-contacting */
        [-1, 1].forEach(function (sign) {
          var lx = cx + sign * R * 0.62;
          s += K.path('M' + (lx - R * 0.55) + ' ' + cy
            + ' Q' + lx + ' ' + (cy - R * 0.85) + ' ' + (lx + R * 0.55) + ' ' + cy
            + ' Q' + lx + ' ' + (cy + R * 0.85) + ' ' + (lx - R * 0.55) + ' ' + cy + ' Z',
            { fill: '#ffffff', stroke: K.INK, w: 1.1 });
        });
        s += K.rect(casX + casW / 2 - 5, casY - 20, 10, 16, { fill: K.METAL2, stroke: K.INK, w: 0.9 });
        s += K.leader(casX + casW / 2, casY - 12, casX + casW / 2 + 60, casY - 34, 'EXTERNAL TIMING GEARS');
      } else {
        /* external gear — two identical meshing gears */
        [-1, 1].forEach(function (sign) {
          var lx = cx + sign * R * 0.62;
          s += K.circle(lx, cy, R * 0.62, { fill: '#ffffff', stroke: K.INK, w: 1.1 });
          for (var a2 = 0; a2 < 10; a2++) {
            var th2 = a2 * Math.PI / 5;
            s += K.line(lx + (R * 0.62 - 3) * Math.cos(th2), cy + (R * 0.62 - 3) * Math.sin(th2),
              lx + (R * 0.62 + 4) * Math.cos(th2), cy + (R * 0.62 + 4) * Math.sin(th2), { stroke: K.THIN, w: 0.6 });
          }
        });
      }

      s += K.centre(casX - 40, cy, casX + casW + 40, cy);
      s += K.flange(casX - 4, cy, 36);
      s += K.flow(50, cy - 26, 90, 'SUCTION', K.COLD);
      s += K.flange(casX + casW + 4, cy, 36);
      s += K.flow(casX + casW + 16, cy - 26, 90, 'DISCHARGE', K.HOT);

      var mX = casX + casW + 90, mW = 120, mH = 66;
      s += K.rect(mX, cy - mH / 2, mW, mH, { fill: K.METAL, stroke: K.INK, w: 1.2, rx: 5 });
      s += K.txt(mX + mW / 2, cy + 5, 'M', { anchor: 'middle', size: 16, weight: 'bold', fill: K.THIN });
      s += K.line(casX + casW + 4, cy, mX, cy, { stroke: K.INK, w: 1.2, dash: d.reducer ? '5,3' : null });

      s += K.dimH(casX + 15, casX + casW - 15, casY + casH + 26, 'FACE WIDTH  ' + f(d.faceWidth_mm, 0) + ' mm');
      s += K.dimV(casY, casY + casH, casX - 22, 'ROTOR OD  ' + f(d.OD_mm, 0) + ' mm', { from: casX - 40 });

      var nx = 40, ny = 420;
      s += K.rect(nx, ny, 380, 108, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(nx + 8, ny + 15, 'CALCULATED DESIGN', { size: 8.5, weight: 'bold' });
      s += K.line(nx, ny + 21, nx + 380, ny + 21, { stroke: K.FAINT, w: 0.5 });
      [['Rotor OD / face width', f(d.OD_mm, 0) + ' / ' + f(d.faceWidth_mm, 0) + ' mm'],
       ['Radial bearing load', f(d.Fr_N, 0) + ' N'],
       ['Shaft diameter', f(d.shaftDia_mm, 1) + ' mm'],
       ['Magnetic-drive (sealless) option', d.sealless],
      ].forEach(function (row, i2) {
        s += K.txt(nx + 8, ny + 36 + i2 * 18, row[0], { size: 8, fill: K.THIN });
        s += K.txt(nx + 372, ny + 36 + i2 * 18, row[1], { size: 8.5, weight: 'bold', anchor: 'end' });
      });
      s += K.tag(cx, 70, d.tag);
      return s;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     PERISTALTIC (HOSE) PUMP — rotor/roller/hose GA
     ═══════════════════════════════════════════════════════════════════ */
  register('pump-hose', {
    title: 'PERISTALTIC (HOSE) PUMP — GENERAL ARRANGEMENT',
    stateId: 'pump',
    w: 900, h: 560,
    subtitle: function (d) {
      return d.elastomerName.toUpperCase() + ' HOSE  ·  ' + d.bore + ' BORE  ·  ' + f(d.Q, 3) + ' m³/h';
    },
    data: function () {
      var b = baseCalc(); var adv = window.pumpAdvancedState; var h = adv && adv.hose;
      if (!b || !h || !h.applicable) return null;
      return {
        tag: (b.i.pumpTag) || 'P-101', Q: b.r.designVolFlow,
        elastomerName: h.elastomer.top.name, maxPressureBar: h.elastomer.top.maxPressureBar,
        bore: h.hoseBore.bore, rollerCount: h.rollerConfig.rollerCount, rollerConfigName: h.rollerConfig.config,
        estimatedHours: h.hoseLife.estimatedHours, motorKw: b.r.stdMotorKw, rpm: b.r.pumpSpeedRpm,
      };
    },
    block: function (d) { return [['TAG', d.tag], ['HOSE', d.elastomerName]]; },
    draw: function (d, K) {
      var s = '';
      var cx = 300, cy = 260, R = 130;
      /* casing */
      s += K.circle(cx, cy, R, { fill: K.METAL, stroke: K.INK, w: 1.4 });
      /* hose loop, just inside the casing wall — the only wetted part */
      s += K.circle(cx, cy, R - 16, { fill: 'none', stroke: K.DIM, w: 4 });
      s += K.txt(cx, cy - R + 4, 'HOSE (WETTED PART)', { anchor: 'middle', size: 7, fill: K.DIM, weight: 'bold' });
      /* rotor + rollers */
      s += K.circle(cx, cy, 22, { fill: K.METAL2, stroke: K.INK, w: 1 });
      var rollerR = R - 16 - 10;
      for (var i = 0; i < d.rollerCount; i++) {
        var th = (i * 2 * Math.PI / d.rollerCount) - Math.PI / 2;
        var rx = cx + rollerR * Math.cos(th), ry = cy + rollerR * Math.sin(th);
        s += K.line(cx, cy, rx, ry, { stroke: K.THIN, w: 1 });
        s += K.circle(rx, ry, 13, { fill: '#ffffff', stroke: K.INK, w: 1 });
      }
      s += K.leader(cx + 22 * 0.7, cy - 22 * 0.7, cx - 120, cy - 140, d.rollerCount + '-ROLLER ROTOR (' + d.rollerConfigName.toUpperCase() + ')', { anchor: 'end' });
      /* isolated bearings note */
      s += K.leader(cx, cy, cx + 160, cy + 150, 'ROTOR BEARINGS — ISOLATED FROM THE PROCESS FLUID BY THE HOSE ITSELF, NO SHAFT SEAL');

      /* hose entry/exit at roughly 5 and 7 o'clock, where the loop opens */
      var entryTh = Math.PI * 0.75, exitTh = Math.PI * 0.25;
      var ex1 = cx + (R - 16) * Math.cos(entryTh), ey1 = cy + (R - 16) * Math.sin(entryTh);
      var ex2 = cx + (R - 16) * Math.cos(exitTh), ey2 = cy + (R - 16) * Math.sin(exitTh);
      s += K.flange(ex1 - 4, ey1, 24);
      s += K.flow(ex1 - 130, ey1 + 6, 90, 'SUCTION', K.COLD);
      s += K.flange(ex2 + 4, ey2, 24);
      s += K.flow(ex2 + 20, ey2 + 6, 90, 'DISCHARGE', K.HOT);

      /* driver */
      var mX = cx + R + 90, mW = 110, mH = 60;
      s += K.rect(mX, cy - mH / 2, mW, mH, { fill: K.METAL, stroke: K.INK, w: 1.2, rx: 5 });
      s += K.txt(mX + mW / 2, cy + 5, 'M', { anchor: 'middle', size: 15, weight: 'bold', fill: K.THIN });
      s += K.line(cx + R, cy, mX, cy, { stroke: K.INK, w: 1.2 });

      var nx = 40, ny = 420;
      s += K.rect(nx, ny, 380, 108, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(nx + 8, ny + 15, 'CALCULATED DESIGN', { size: 8.5, weight: 'bold' });
      s += K.line(nx, ny + 21, nx + 380, ny + 21, { stroke: K.FAINT, w: 0.5 });
      [['Hose elastomer', d.elastomerName],
       ['Rated pressure', f(d.maxPressureBar, 0) + ' bar'],
       ['Hose bore', d.bore],
       ['Estimated hose life', Math.round(d.estimatedHours).toLocaleString() + ' h'],
      ].forEach(function (row, i2) {
        s += K.txt(nx + 8, ny + 36 + i2 * 18, row[0], { size: 8, fill: K.THIN });
        s += K.txt(nx + 372, ny + 36 + i2 * 18, row[1], { size: 8.5, weight: 'bold', anchor: 'end' });
      });
      s += K.tag(cx, 90, d.tag);
      return s;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     RECIPROCATING (PLUNGER/PISTON) PUMP — power-end/fluid-end GA
     ═══════════════════════════════════════════════════════════════════ */
  register('pump-recip', {
    title: 'RECIPROCATING PUMP — GENERAL ARRANGEMENT',
    stateId: 'pump',
    w: 900, h: 560,
    subtitle: function (d) {
      return d.sealName.toUpperCase() + '  ·  ' + f(d.bore_mm, 0) + ' mm BORE × ' + f(d.stroke_mm, 0) + ' mm STROKE  ·  API 674';
    },
    data: function () {
      var b = baseCalc(); var adv = window.pumpAdvancedState; var rc = adv && adv.recip;
      if (!b || !rc || !rc.applicable) return null;
      return {
        tag: (b.i.pumpTag) || 'P-101', sealType: rc.seal.type, sealName: rc.seal.name,
        bore_mm: rc.rodLoad.bore_mm, stroke_mm: rc.rodLoad.stroke_mm, Frod_N: rc.rodLoad.Frod_N,
        crankPin_mm: rc.crankShaft.crankPinDiameter_mm, ha_m: rc.accelerationHead.ha_m,
        chamberVolume_L: rc.dampener.chamberVolume_L, motorKw: b.r.stdMotorKw, rpm: b.r.pumpSpeedRpm,
      };
    },
    block: function (d) { return [['TAG', d.tag], ['SEAL', d.sealName]]; },
    draw: function (d, K) {
      var s = '';
      var cy = 260;
      var crankCx = 190, crankR = 46;
      var cylX0 = 380, cylW = 220, cylH = 70, cylY = cy - cylH / 2;
      var boreW = Math.min(140, cylW - 40);

      /* crankcase */
      s += K.rect(crankCx - 70, cy - 70, 140, 140, { fill: K.METAL, stroke: K.INK, w: 1.3, rx: 8 });
      s += K.circle(crankCx, cy, crankR, { fill: '#ffffff', stroke: K.THIN, w: 0.7, dash: '4,3' });
      s += K.circle(crankCx + crankR, cy, 7, { fill: K.METAL2, stroke: K.INK, w: 1 });
      s += K.line(crankCx, cy, crankCx + crankR, cy, { stroke: K.INK, w: 1.4 });
      s += K.leader(crankCx, cy - 70, crankCx - 90, cy - 110, 'CRANKSHAFT · CONNECTING ROD', { anchor: 'end' });

      /* crosshead + rod to the cylinder */
      var crossX = crankCx + 110;
      s += K.rect(crossX - 12, cy - 16, 24, 32, { fill: K.METAL2, stroke: K.INK, w: 1 });
      s += K.line(crankCx + crankR, cy, crossX, cy, { stroke: K.INK, w: 1.4 });
      s += K.line(crossX, cy, cylX0, cy, { stroke: K.INK, w: 2.2 });
      s += K.leader(crossX, cy - 16, crossX - 20, cy - 90, 'CROSSHEAD');

      /* fluid-end cylinder */
      s += K.rect(cylX0, cylY, cylW, cylH, { fill: K.METAL, stroke: K.INK, w: 1.4, rx: 6 });
      s += K.rect(cylX0 + 14, cylY + (cylH - boreW / 3) / 2, cylW - 28, boreW / 3, { fill: '#ffffff', stroke: K.THIN, w: 0.7 });
      s += K.rect(cylX0 + cylW * 0.42, cy - 9, cylW * 0.3, 18, { fill: K.METAL2, stroke: K.INK, w: 1 });
      s += K.txt(cylX0 + cylW * 0.57, cy + 4, d.sealType === 'packing' ? 'PLUNGER' : 'PISTON', { anchor: 'middle', size: 7.5, weight: 'bold', fill: K.THIN });

      /* seal construction — packing gland vs ring/cup, drawn where the rod enters */
      if (d.sealType === 'packing') {
        s += K.rect(cylX0 - 18, cy - 15, 18, 30, { fill: K.METAL2, stroke: K.INK, w: 1.1 });
        for (var hy = cy - 12; hy < cy + 12; hy += 5) s += K.line(cylX0 - 16, hy, cylX0 - 2, hy, { stroke: K.THIN, w: 0.6 });
        s += K.leader(cylX0 - 9, cy - 15, cylX0 - 60, cy - 90, 'STUFFING BOX + PACKING', { anchor: 'end' });
      } else {
        for (var rgx = cylX0 + cylW * 0.5; rgx < cylX0 + cylW * 0.64; rgx += 4) {
          s += K.line(rgx, cy - 9, rgx, cy + 9, { stroke: K.THIN, w: 0.8 });
        }
        s += K.leader(cylX0 + cylW * 0.57, cy - 9, cylX0 + 30, cy - 90, 'PISTON RING / CUP SEAL', { anchor: 'end' });
      }

      /* suction / discharge check valves */
      s += K.circle(cylX0 + cylW + 20, cy - 22, 10, { fill: '#ffffff', stroke: K.INK, w: 1 });
      s += K.flow(cylX0 + cylW + 40, cy - 22, 70, 'DISCHARGE', K.HOT);
      s += K.circle(cylX0 + cylW + 20, cy + 22, 10, { fill: '#ffffff', stroke: K.INK, w: 1 });
      s += K.flow(cylX0 - 60, cy + 22, 60, '', K.COLD);
      s += K.txt(cylX0 - 80, cy + 40, 'SUCTION', { size: 8, fill: K.COLD, weight: 'bold' });

      s += K.centre(crankCx - 90, cy, cylX0 + cylW + 90, cy);
      s += K.dimH(cylX0, cylX0 + cylW * 0.42, cylY + cylH + 26, 'STROKE  ' + f(d.stroke_mm, 0) + ' mm');
      s += K.dimV(cylY, cylY + cylH, cylX0 - 22, 'BORE  ' + f(d.bore_mm, 0) + ' mm', { from: cylX0 - 40 });

      var nx = 40, ny = 420;
      s += K.rect(nx, ny, 400, 108, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
      s += K.txt(nx + 8, ny + 15, 'CALCULATED DESIGN', { size: 8.5, weight: 'bold' });
      s += K.line(nx, ny + 21, nx + 400, ny + 21, { stroke: K.FAINT, w: 0.5 });
      [['Bore × stroke', f(d.bore_mm, 0) + ' × ' + f(d.stroke_mm, 0) + ' mm'],
       ['Rod load', f(d.Frod_N, 0) + ' N'],
       ['Crank pin diameter', f(d.crankPin_mm, 1) + ' mm'],
       ['Acceleration head / dampener', f(d.ha_m, 2) + ' m / ' + f(d.chamberVolume_L, 1) + ' L'],
      ].forEach(function (row, i2) {
        s += K.txt(nx + 8, ny + 36 + i2 * 18, row[0], { size: 8, fill: K.THIN });
        s += K.txt(nx + 392, ny + 36 + i2 * 18, row[1], { size: 8.5, weight: 'bold', anchor: 'end' });
      });
      s += K.tag(cylX0 + cylW / 2, 70, d.tag);
      return s;
    }
  });
})();
